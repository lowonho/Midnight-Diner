"use strict";

// 대본 데이터와 게임 로직을 분리하는 스토리 실행기입니다.
// 자기소개 대사의 출력이 끝난 뒤에만 nameRevealed를 바꿉니다.
const STORY_GUEST_IDS=["gicheol","seoyoon","narae","doyoon","miran","hyejin","sujin"];
let storySession=null;
let storyTypingTimer=null;
let storyRevealTimer=null;
let storyUiInitialized=false;

function createStoryGuestState(){
  return {nameRevealed:false,affinity:0,arcStep:0,regular:false,visits:0,lastVisitDay:0};
}

function createStoryState(){
  return {
    schemaVersion:1,
    prologueComplete:false,
    completed:{},
    choices:{},
    guestState:Object.fromEntries(STORY_GUEST_IDS.map(id=>[id,createStoryGuestState()])),
    flags:{},
    pendingNightGuests:[],
    specialServedDays:{},
    storyCookResults:{},
    activeStoryCook:null,
    endingSeen:false,
    legacyImported:false
  };
}

function normalizeStoryState(raw){
  const base=createStoryState();
  if(!raw||typeof raw!=="object")return base;
  base.schemaVersion=1;
  base.prologueComplete=!!raw.prologueComplete;
  base.completed={...(raw.completed||{})};
  base.choices={...(raw.choices||{})};
  base.flags={...(raw.flags||{})};
  base.pendingNightGuests=Array.isArray(raw.pendingNightGuests)
    ?raw.pendingNightGuests.filter(plan=>plan&&typeof plan.guestId==="string").map(plan=>({...plan,special:!!plan.special,repeat:!!plan.repeat}))
    :raw.pendingSpecialGuest?[{guestId:raw.pendingSpecialGuest,sceneId:null,special:true,repeat:false}]:[];
  base.specialServedDays={...(raw.specialServedDays||{})};
  base.storyCookResults={...(raw.storyCookResults||{})};
  base.activeStoryCook=null;
  base.endingSeen=!!raw.endingSeen;
  base.legacyImported=!!raw.legacyImported;
  STORY_GUEST_IDS.forEach(id=>{
    const saved=raw.guestState?.[id]||{};
    base.guestState[id]={...createStoryGuestState(),...saved};
    base.guestState[id].nameRevealed=!!base.guestState[id].nameRevealed;
    base.guestState[id].regular=!!base.guestState[id].regular;
    ["affinity","arcStep","visits","lastVisitDay"].forEach(key=>{
      if(!Number.isFinite(base.guestState[id][key]))base.guestState[id][key]=0;
    });
  });
  return base;
}

function getStoryGuestState(id){
  if(!state.story)state.story=createStoryState();
  if(!state.story.guestState[id])state.story.guestState[id]=createStoryGuestState();
  return state.story.guestState[id];
}

function isCharacterNameRevealed(id){
  const character=STORY_CHARACTERS[id];
  if(!character)return true;
  if(character.alwaysKnown)return true;
  return !!state.story?.guestState?.[id]?.nameRevealed;
}

function storyDisplayName(id){
  if(!id)return "이야기";
  const character=STORY_CHARACTERS[id];
  if(!character)return id;
  return isCharacterNameRevealed(id)?character.name:"???";
}

function revealCharacterName(id,showNotice=true){
  const character=STORY_CHARACTERS[id];
  if(!character||character.alwaysKnown)return false;
  const guest=getStoryGuestState(id);
  if(guest.nameRevealed)return false;
  guest.nameRevealed=true;
  updateRelationshipUI();
  if(showNotice&&storySession){
    const speaker=document.getElementById("storySpeaker");
    const notice=document.getElementById("storyRevealNotice");
    speaker.textContent=character.name;
    speaker.classList.remove("revealed");
    void speaker.offsetWidth;
    speaker.classList.add("revealed");
    notice.textContent=`${character.name}의 이름을 알게 되었습니다`;
    notice.classList.add("show");
    clearTimeout(storyRevealTimer);
    storyRevealTimer=setTimeout(()=>notice.classList.remove("show"),1800);
  }
  return true;
}

function storyRelationLabel(id){
  const guest=state.story?.guestState?.[id];
  if(!guest)return "";
  if(guest.regular)return "단골";
  if(guest.affinity>=4)return "마음을 나눔";
  if(guest.affinity>=2)return "낯익은 손님";
  return "첫인사";
}

function updateRelationshipUI(){
  const list=document.getElementById("relationshipList");
  if(!list||!state.story)return;
  const known=STORY_GUEST_IDS.filter(id=>id!=="sujin"&&isCharacterNameRevealed(id));
  if(!known.length){
    list.innerHTML='<span class="relationship-empty">아직 이름을 아는 손님이 없습니다.</span>';
    return;
  }
  list.innerHTML=known.map(id=>{
    const guest=getStoryGuestState(id);
    return `<div class="relationship-row"><strong>${STORY_CHARACTERS[id].name}</strong><span>${guest.regular?"단골":`인연 ${guest.affinity}`}</span></div>`;
  }).join("");
}

function initializeStoryUI(){
  if(storyUiInitialized)return;
  storyUiInitialized=true;
  document.getElementById("storyNextButton").addEventListener("click",storyAdvance);
  document.getElementById("storyText").addEventListener("click",storyAdvance);
}

function storyIsActive(){return !!storySession;}
function storyDialogueIsActive(){return !!storySession&&!storySession.suspended;}
function storyCookingIsActive(){return !!storySession?.suspended;}
function activeStoryCookOrderId(){return storySession?.pendingCook?.orderId??null;}

function storySceneIdsForMoment(moment,day=state.day){
  return [...(STORY_EVENT_SCHEDULE[moment]?.[day]||[])];
}

function queueStoryMoments(moments,onComplete=null){
  const ids=[];
  moments.forEach(moment=>ids.push(...storySceneIdsForMoment(moment)));
  playStoryScenes(ids,onComplete);
}

function resumeStoryForCurrentPhase(){
  if(storyIsActive()||state.screen!=="game")return;
  if(state.day===1&&!state.story?.prologueComplete){queueStoryMoments(["newGame","dayStart"]);return;}
  if(state.phase==="day")queueStoryMoments(["dayStart"]);
  else if(state.phase==="night")queueStoryMoments(["nightStart"]);
  else if(state.phase==="result")queueStoryMoments(["nightEnd"]);
}

function playStoryScenes(sceneIds,onComplete=null){
  if(storyIsActive())return false;
  const queue=sceneIds.filter(id=>STORY_SCENES[id]&&!state.story.completed[id]);
  if(!queue.length){if(onComplete)onComplete();return false;}
  storySession={queue,queueIndex:0,scene:null,lines:[],lineIndex:0,wasPaused:state.paused,onComplete};
  state.paused=true;
  document.getElementById("storyOverlay").classList.add("open");
  beginNextStoryScene();
  return true;
}

function beginNextStoryScene(){
  if(!storySession)return;
  while(storySession.queueIndex<storySession.queue.length&&state.story.completed[storySession.queue[storySession.queueIndex]])storySession.queueIndex++;
  if(storySession.queueIndex>=storySession.queue.length){finishStorySession();return;}
  const id=storySession.queue[storySession.queueIndex];
  const scene=STORY_SCENES[id];
  storySession.scene=scene;
  storySession.lines=scene.lines.map(line=>({...line,choices:line.choices?.map(choice=>({...choice}))}));
  storySession.lineIndex=0;
  document.getElementById("storySceneTitle").textContent=`${scene.id} · ${scene.title}`;
  document.getElementById("storyDayLabel").textContent=scene.moment==="newGame"?"PROLOGUE":`DAY ${scene.day}`;
  showStoryLine();
}

function clearStoryTyping(){
  if(storyTypingTimer){clearTimeout(storyTypingTimer);storyTypingTimer=null;}
}

function storyLineText(line){return line.prompt||line.text||"";}

function showStoryLine(){
  if(!storySession)return;
  clearStoryTyping();
  const scene=storySession.scene;
  const line=storySession.lines[storySession.lineIndex];
  if(!line){completeStoryScene();return;}
  const textEl=document.getElementById("storyText");
  const speakerEl=document.getElementById("storySpeaker");
  const badge=document.getElementById("storyRelationBadge");
  const choices=document.getElementById("storyChoices");
  const next=document.getElementById("storyNextButton");
  const speakerId=line.speaker||null;
  speakerEl.classList.remove("revealed");
  speakerEl.textContent=speakerId?storyDisplayName(speakerId):"이야기";
  badge.textContent=speakerId&&STORY_GUEST_IDS.includes(speakerId)&&isCharacterNameRevealed(speakerId)?storyRelationLabel(speakerId):"";
  setStoryPortrait(speakerId);
  choices.innerHTML="";choices.classList.remove("open");
  next.style.display=line.choices?"none":"block";
  const fullText=storyLineText(line);
  textEl.textContent="";
  storySession.typing={line,fullText,index:0,complete:false,revealApplied:false};
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){finishStoryTyping();return;}
  const typeCharacter=()=>{
    if(!storySession?.typing||storySession.typing.complete)return;
    const typing=storySession.typing;
    typing.index++;
    textEl.textContent=typing.fullText.slice(0,typing.index);
    if(typing.index>=typing.fullText.length){finishStoryTyping();return;}
    storyTypingTimer=setTimeout(typeCharacter,typing.fullText[typing.index-1].match(/[.!?。？！]/)?85:14);
  };
  typeCharacter();
}

function finishStoryTyping(){
  if(!storySession?.typing||storySession.typing.complete)return;
  clearStoryTyping();
  const typing=storySession.typing;
  typing.complete=true;
  typing.index=typing.fullText.length;
  document.getElementById("storyText").textContent=typing.fullText;
  if(typing.line.reveal&&!typing.revealApplied){
    typing.revealApplied=true;
    revealCharacterName(typing.line.reveal,true);
  }
  if(typing.line.choices)renderStoryChoices(typing.line);
}

function renderStoryChoices(line){
  const wrap=document.getElementById("storyChoices");
  wrap.innerHTML="";
  line.choices.forEach((choice,index)=>{
    const button=document.createElement("button");
    button.type="button";button.className="story-choice";button.textContent=choice.text;
    button.addEventListener("click",()=>chooseStoryOption(choice,index));
    wrap.appendChild(button);
  });
  wrap.classList.add("open");
}

function chooseStoryOption(choice,index){
  if(!storySession)return;
  const scene=storySession.scene;
  if(scene.specialCook&&!state.story.storyCookResults[scene.id]){
    if(scene.moment==="nightStart"&&suspendStoryForOrderCook(scene,choice,index))return;
    startStoryCookChallenge(scene,choice,index);
    return;
  }
  state.story.choices[scene.id]=index;
  if(!scene.specialCook&&choice.affinity&&scene.character&&STORY_GUEST_IDS.includes(scene.character))getStoryGuestState(scene.character).affinity+=choice.affinity;
  if(choice.flag)state.story.flags[choice.flag]=true;
  const reply={speaker:choice.speaker||scene.character||"protagonist",text:choice.reply||"고개를 끄덕였다."};
  storySession.lines.splice(storySession.lineIndex+1,0,reply);
  storySession.lineIndex++;
  audio?.click();
  showStoryLine();
}

function storyAdvance(){
  if(!storySession)return false;
  if(storySession.typing&&!storySession.typing.complete){finishStoryTyping();return true;}
  const line=storySession.lines[storySession.lineIndex];
  if(line?.choices)return true;
  storySession.lineIndex++;
  audio?.click();
  showStoryLine();
  return true;
}

function setStoryPortrait(speakerId){
  const wrap=document.getElementById("storyPortraitWrap");
  const portrait=document.getElementById("storyPortrait");
  portrait.className="story-portrait";
  portrait.style.removeProperty("--portrait-y");
  if(!speakerId){wrap.classList.add("no-portrait");return;}
  wrap.classList.remove("no-portrait");
  if(speakerId==="protagonist"){portrait.classList.add("chef");return;}
  const character=STORY_CHARACTERS[speakerId];
  if(!character||character.portraitRow==null){portrait.classList.add("role");return;}
  const row=clamp(character.portraitRow,0,5);
  portrait.style.setProperty("--portrait-y",row===5?"100%":`${row*20}%`);
}

function completeStoryScene(){
  if(!storySession)return;
  const scene=storySession.scene;
  state.story.completed[scene.id]=true;
  if(scene.id==="PR-03")state.story.prologueComplete=true;
  if(scene.id==="ED-02")state.story.endingSeen=true;
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    if(!scene.specialCook)guest.affinity+=Number(scene.affinity)||0;
    guest.arcStep=Math.max(guest.arcStep,Number((scene.id.match(/-(\d\d)$/)||[])[1])||0);
    if(scene.regular)guest.regular=true;
  }
  updateRelationshipUI();
  saveGame(true);
  storySession.queueIndex++;
  beginNextStoryScene();
}

function startStoryCookChallenge(scene,choice,index){
  if(!storySession||state.story.activeStoryCook)return false;
  const dish=dishById(state.selectedDishId)||DISHES[0];
  const steps=scene.id==="PR-02"
    ?[{station:"board",game:"chop"},...dish.cook]
    :[...dish.cook];
  state.story.activeStoryCook={sceneId:scene.id,guestId:scene.character||null,dishId:dish.id,steps,stepIndex:0,scores:[],choice:{...choice},choiceIndex:index};
  storySession.waitingForCook=true;storySession.suspended=true;
  document.getElementById("storyOverlay").classList.remove("open");
  showToast(`${dish.name} 한 접시를 직접 완성해 보세요.`);
  launchStoryCookStep();
  return true;
}

function launchStoryCookStep(){
  const challenge=state.story?.activeStoryCook;
  if(!challenge)return false;
  const dish=dishById(challenge.dishId)||DISHES[0];
  const step=challenge.steps[challenge.stepIndex];
  if(!step)return false;
  startMini(step.game,step.station,{
    mode:"story",storySceneId:challenge.sceneId,dishId:dish.id,
    special:true,tutorial:challenge.sceneId==="PR-02",guestId:challenge.guestId
  });
  return true;
}

function completeStoryCookStep(score){
  const challenge=state.story?.activeStoryCook;
  if(!challenge)return false;
  challenge.scores.push(score);
  challenge.stepIndex++;
  if(challenge.stepIndex<challenge.steps.length){
    setTimeout(launchStoryCookStep,300);
    return true;
  }

  const average=Math.round(challenge.scores.reduce((sum,value)=>sum+value,0)/challenge.scores.length);
  const tier=average>=85?"great":average>=65?"warm":"soft";
  const scene=STORY_SCENES[challenge.sceneId];
  const reply=recordSpecialCookChoice(scene,challenge.choice,challenge.choiceIndex,average,tier);
  state.story.activeStoryCook=null;

  if(storySession){
    storySession.waitingForCook=false;storySession.suspended=false;
    storySession.lines.splice(storySession.lineIndex+1,0,reply);
    storySession.lineIndex++;
    document.getElementById("storyOverlay").classList.add("open");
    showStoryLine();
  }
  return true;
}

function suspendStoryForOrderCook(scene,choice,index){
  const order=state.orders.find(item=>item.storySceneId===scene.id);
  if(!order)return false;
  storySession.suspended=true;
  storySession.pendingCook={sceneId:scene.id,orderId:order.id,choice:{...choice},choiceIndex:index};
  state.selectedOrderId=order.id;
  state.paused=false;
  document.getElementById("storyOverlay").classList.remove("open");
  showToast(`${storyDisplayName(order.guestId)}을 위한 특별 조리를 완성해 주세요.`);
  updateUI(true);
  return true;
}

function recordSpecialCookChoice(scene,choice,index,score,tier){
  state.story.choices[scene.id]=index;
  if(choice.flag)state.story.flags[choice.flag]=true;
  const potential=Math.max(0,Number(choice.affinity)||Number(scene.affinity)||0);
  const affinityDelta=tier==="great"?potential:tier==="warm"?Math.min(1,potential):0;
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    guest.affinity+=affinityDelta;
    if(scene.id==="PR-02"&&guest.lastVisitDay!==state.day){guest.visits++;guest.lastVisitDay=state.day;}
  }
  state.story.storyCookResults[scene.id]={score,tier,day:state.day,choiceIndex:index,affinityDelta};
  const speaker=choice.speaker||scene.character||"owner";
  const text=tier==="great"
    ?choice.reply||"정성 들인 맛이 제대로 전해졌어요."
    :tier==="warm"
      ?`${choice.reply||"따뜻한 마음이 느껴져요."} 완벽하지 않아도 오늘의 저에게 잘 맞네요.`
      :"조금 아쉬운 부분은 있어도 괜찮아요. 저를 생각하며 만든 건 알겠어요. 다음에 한 번 더 부탁할게요.";
  return {speaker,text};
}

function finishSuspendedStoryCook(order,satisfaction){
  const pending=storySession?.pendingCook;
  if(!storySession?.suspended||!pending||pending.orderId!==order.id)return false;
  const scene=STORY_SCENES[pending.sceneId];
  if(!scene)return false;
  const tier=satisfaction>=85?"great":satisfaction>=65?"warm":"soft";
  const reply=recordSpecialCookChoice(scene,pending.choice,pending.choiceIndex,satisfaction,tier);
  storySession.pendingCook=null;storySession.suspended=false;
  state.paused=true;
  storySession.lines.splice(storySession.lineIndex+1,0,reply);
  storySession.lineIndex++;
  document.getElementById("storyOverlay").classList.add("open");
  showStoryLine();
  return true;
}

function finishStorySession(){
  if(!storySession)return;
  clearStoryTyping();
  clearTimeout(storyRevealTimer);
  document.getElementById("storyRevealNotice").classList.remove("show");
  document.getElementById("storyOverlay").classList.remove("open");
  const complete=storySession.onComplete;
  const wasPaused=storySession.wasPaused;
  storySession=null;
  state.paused=state.phase==="result"?true:wasPaused;
  if(state.phase==="result")dom.nextDayButton.textContent=state.day===30&&state.story?.endingSeen?"자유 영업 시작":"다음 날 준비";
  updateRelationshipUI();
  updateUI(true);
  saveGame();
  if(complete)complete();
}

function prepareStoryNight(){
  if(!state.story)state.story=createStoryState();
  const plans=storySceneIdsForMoment("nightStart")
    .map(id=>STORY_SCENES[id])
    .filter(scene=>scene&&!state.story.completed[scene.id]&&scene.character&&STORY_CHARACTERS[scene.character]&&scene.character!=="protagonist")
    .map(scene=>({guestId:scene.character,sceneId:scene.id,special:!!scene.specialCook,repeat:false}));

  if(!plans.length){
    const regulars=STORY_GUEST_IDS.filter(id=>{
      if(id==="sujin")return false;
      const guest=state.story.guestState[id];
      return guest?.regular&&guest.lastVisitDay<state.day&&isCharacterNameRevealed(id);
    });
    const returnChance=state.day>30?.82:clamp(.42+state.popularity*.003,0,.68);
    if(regulars.length&&Math.random()<returnChance){
      const guestId=regulars[Math.floor(Math.random()*regulars.length)];
      plans.push({guestId,sceneId:null,special:false,repeat:true});
    }
  }
  state.story.pendingNightGuests=plans;
}

function decorateStoryOrder(order){
  order.customerType="general";order.guestId=null;order.specialRecipe=false;order.storySceneId=null;order.repeatVisit=false;
  order.bubble=pickGeneralGuestBubble("arrival");order.bubbleTime=4.5;order.waitingTime=0;order.waitingBubbleShown=false;
  const plan=state.story?.pendingNightGuests?.shift();
  if(!plan)return order;
  const character=STORY_CHARACTERS[plan.guestId];
  order.customerType="story";order.guestId=plan.guestId;order.specialRecipe=!!plan.special;
  order.storySceneId=plan.sceneId||null;order.repeatVisit=!!plan.repeat;
  order.variant=character?.portraitRow??order.variant;
  order.bubble=plan.repeat
    ?REGULAR_GUEST_BUBBLES[plan.guestId]||"오늘도 잘 부탁드려요."
    :plan.special?"오늘은 조금 특별하게 부탁드릴게요.":"오늘 먹고 싶은 걸 말씀드릴게요.";
  order.bubbleTime=5.5;
  return order;
}

function normalizeStoryOrder(order){
  if(!order||typeof order!=="object")return order;
  if(!order.customerType)order.customerType="general";
  if(!("guestId" in order))order.guestId=null;
  order.specialRecipe=!!order.specialRecipe;
  order.storySceneId=order.storySceneId||null;
  order.repeatVisit=!!order.repeatVisit;
  if(!Number.isFinite(order.bubbleTime))order.bubbleTime=0;
  if(!Number.isFinite(order.waitingTime))order.waitingTime=0;
  order.waitingBubbleShown=!!order.waitingBubbleShown;
  return order;
}

function storyOrderLabel(order){
  return order?.guestId?storyDisplayName(order.guestId):`${order.slot+1}번 손님`;
}

function applyStoryCookingResult(order,satisfaction){
  if(!order?.guestId)return null;
  const tier=satisfaction>=85?"great":satisfaction>=65?"warm":"soft";
  if(STORY_GUEST_IDS.includes(order.guestId)){
    const guest=getStoryGuestState(order.guestId);
    if(order.specialRecipe&&!order.storySceneId)guest.affinity+=tier==="great"?2:tier==="warm"?1:0;
    else if(!order.storySceneId&&tier==="great")guest.affinity++;
    if(guest.lastVisitDay!==state.day){guest.visits++;guest.lastVisitDay=state.day;}
  }
  if(order.specialRecipe){
    state.story.specialServedDays[state.day]=true;
    state.story.flags[`special_${order.guestId}_${state.day}`]=tier;
  }
  if(order.storySceneId)state.story.storyCookResults[order.storySceneId]={score:satisfaction,tier,day:state.day};
  return {tier,text:pickGeneralGuestBubble(tier),name:storyDisplayName(order.guestId),special:order.specialRecipe};
}

function pickGeneralGuestBubble(type){
  const pool=GENERAL_GUEST_BUBBLES[type]||GENERAL_GUEST_BUBBLES.warm||["잘 먹겠습니다."];
  return pool[Math.floor(Math.random()*pool.length)];
}

function cookingDifficultyMultiplier(context){return context?.tutorial?.9:context?.special?1.25:1;}

function runStoryQaFromQuery(){
  const params=new URLSearchParams(location.search);
  const sceneId=params.get("qa-story");
  if(!sceneId||!STORY_SCENES[sceneId])return false;
  const qaScene=STORY_SCENES[sceneId];
  state.story=createStoryState();
  state.screen="game";state.phase=qaScene.moment==="nightEnd"?"result":qaScene.moment==="nightStart"?"night":"day";
  state.day=qaScene.day||1;state.paused=false;
  openGameScreen();buildMenuCards();updateUI(true);syncPhaserObjects();
  if(params.get("qa-order")==="1"&&state.phase==="night"){
    state.phaseTime=NIGHT_DURATION;state.orders=[];state.respawns=[];state.spawnedCustomers=0;state.nightCustomerTarget=4;
    state.inventory.kimchi={count:4,quality:85};
    if(qaScene.character&&STORY_GUEST_IDS.includes(qaScene.character))revealCharacterName(qaScene.character,false);
    prepareStoryNight();spawnOrder(0);
  }
  playStoryScenes([sceneId]);
  const lineIndex=Math.max(0,Number(params.get("qa-line"))||0);
  for(let i=0;i<lineIndex;i++){
    const line=storySession?.lines[i];
    if(line?.reveal)revealCharacterName(line.reveal,false);
  }
  if(storySession&&lineIndex<storySession.lines.length){storySession.lineIndex=lineIndex;showStoryLine();}
  const choiceIndex=params.has("qa-choice")?Number(params.get("qa-choice")):NaN;
  const choiceLine=storySession?.lines[storySession?.lineIndex];
  if(Number.isInteger(choiceIndex)&&choiceIndex>=0&&choiceLine?.choices?.[choiceIndex]){
    finishStoryTyping();
    chooseStoryOption(choiceLine.choices[choiceIndex],choiceIndex);
  }
  const qaScore=params.has("qa-score")?Number(params.get("qa-score")):NaN;
  const pendingOrderId=activeStoryCookOrderId();
  if(Number.isFinite(qaScore)&&pendingOrderId!=null){
    const order=state.orders.find(item=>item.id===pendingOrderId);
    if(order){applyStoryCookingResult(order,qaScore);finishSuspendedStoryCook(order,qaScore);}
  }
  return true;
}
