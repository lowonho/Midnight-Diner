"use strict";

// 대본 데이터와 게임 로직을 분리하는 스토리 실행기입니다.
// 자기소개 대사의 출력이 끝난 뒤에만 nameRevealed를 바꿉니다.
const STORY_GUEST_IDS=["gicheol"];
let storySession=null;
let storyTypingTimer=null;
let storyRevealTimer=null;
let storyUiInitialized=false;
const STORY_CHECKPOINT_VERSION=1;

function createStoryGuestState(){
  return {nameRevealed:false,affinity:0,arcStep:0,regular:false,visits:0,lastVisitDay:0};
}

function createStoryState(){
  return {
    schemaVersion:2,
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
  base.schemaVersion=2;
  base.prologueComplete=!!raw.prologueComplete;
  base.completed={...(raw.completed||{})};
  base.choices={...(raw.choices||{})};
  base.flags={...(raw.flags||{})};
  base.pendingNightGuests=Array.isArray(raw.pendingNightGuests)
    ?raw.pendingNightGuests
      .filter(plan=>plan&&typeof plan.guestId==="string")
      .map(plan=>({
        ...plan,
        sceneId:plan.sceneId||null,
        dishId:typeof plan.dishId==="string"?plan.dishId:null,
        arrival:["early","late","last"].includes(plan.arrival)?plan.arrival:"early",
        deferUntilArrival:!!plan.deferUntilArrival,
        guestOrder:plan.guestOrder!==false,
        special:!!plan.special,
        repeat:!!plan.repeat
      }))
    :raw.pendingSpecialGuest?[{
      guestId:raw.pendingSpecialGuest,sceneId:null,dishId:null,arrival:"early",
      deferUntilArrival:false,guestOrder:true,special:true,repeat:false
    }]:[];
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
  if(!id)return "";
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
  const known=STORY_GUEST_IDS.filter(id=>isCharacterNameRevealed(id));
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
  moments.forEach(moment=>ids.push(
    ...storySceneIdsForMoment(moment).filter(id=>!STORY_SCENES[id]?.deferUntilArrival)
  ));
  playStoryScenes(ids,onComplete);
}

function resumeDeferredStoryOrderScene(){
  if(storyIsActive()||state.phase!==GAME_PHASES.OPEN)return false;
  const order=state.orders.find(item=>{
    const scene=STORY_SCENES[item.storySceneId];
    return item.customerType==="story"&&item.deferUntilArrival&&scene&&!state.story.completed[scene.id];
  });
  if(!order)return false;
  return playStoryScenes([order.storySceneId],resumeDeferredStoryOrderScene);
}

function resumeStoryForCurrentPhase(){
  if(storyIsActive()||state.screen!=="game")return;
  if(state.day===1&&!state.story?.prologueComplete){queueStoryMoments(["newGame","dayStart"]);return;}
  if(state.phase===GAME_PHASES.MENU_SELECT||state.phase===GAME_PHASES.PREP)queueStoryMoments(["dayStart"]);
  else if(state.phase===GAME_PHASES.OPEN)queueStoryMoments(["nightStart"],resumeDeferredStoryOrderScene);
  else if(state.phase===GAME_PHASES.RESULT)queueStoryMoments(["nightEnd"]);
}

function cloneStoryCheckpointValue(value){
  try{return JSON.parse(JSON.stringify(value));}
  catch(_error){return null;}
}

function isStoryCheckpointRecord(value){
  return !!value&&typeof value==="object"&&!Array.isArray(value);
}

function normalizeStoryCheckpoint(checkpoint){
  if(!isStoryCheckpointRecord(checkpoint)||checkpoint.version!==STORY_CHECKPOINT_VERSION)return null;
  if(!Array.isArray(checkpoint.queue)||!checkpoint.queue.length)return null;
  if(!checkpoint.queue.every(id=>typeof id==="string"&&!!STORY_SCENES[id]))return null;
  if(!Number.isInteger(checkpoint.queueIndex)||checkpoint.queueIndex<0||checkpoint.queueIndex>=checkpoint.queue.length)return null;
  if(typeof checkpoint.sceneId!=="string"||checkpoint.queue[checkpoint.queueIndex]!==checkpoint.sceneId)return null;
  if(!STORY_SCENES[checkpoint.sceneId]||state.story?.completed?.[checkpoint.sceneId])return null;
  if(!Array.isArray(checkpoint.lines)||!checkpoint.lines.length)return null;
  if(!checkpoint.lines.every(line=>isStoryCheckpointRecord(line)&&(typeof line.text==="string"||typeof line.prompt==="string")))return null;
  if(!Number.isInteger(checkpoint.lineIndex)||checkpoint.lineIndex<0||checkpoint.lineIndex>=checkpoint.lines.length)return null;
  if(!Array.isArray(checkpoint.actorIds))return null;
  if(!checkpoint.actorIds.every(id=>typeof id==="string"&&!!STORY_CHARACTERS[id]))return null;
  if(new Set(checkpoint.actorIds).size!==checkpoint.actorIds.length)return null;
  if(typeof checkpoint.waitingForCook!=="boolean"||typeof checkpoint.suspended!=="boolean"||typeof checkpoint.wasPaused!=="boolean")return null;
  if(checkpoint.waitingForCook!==checkpoint.suspended)return null;

  const pendingCook=checkpoint.pendingCook==null?null:checkpoint.pendingCook;
  if(checkpoint.suspended){
    if(!isStoryCheckpointRecord(pendingCook)||pendingCook.sceneId!==checkpoint.sceneId)return null;
    if(!Number.isFinite(pendingCook.orderId)||!Number.isInteger(pendingCook.lineIndex))return null;
    if(pendingCook.lineIndex<0||pendingCook.lineIndex>=checkpoint.lines.length)return null;
    if(!isStoryCheckpointRecord(pendingCook.config))return null;
    if(pendingCook.choice!=null&&!isStoryCheckpointRecord(pendingCook.choice))return null;
    if(pendingCook.choiceIndex!=null&&!Number.isInteger(pendingCook.choiceIndex))return null;
  }else if(pendingCook!==null)return null;

  const cloned=cloneStoryCheckpointValue({
    version:STORY_CHECKPOINT_VERSION,
    queue:checkpoint.queue,
    queueIndex:checkpoint.queueIndex,
    sceneId:checkpoint.sceneId,
    lines:checkpoint.lines,
    lineIndex:checkpoint.lineIndex,
    actorIds:checkpoint.actorIds,
    waitingForCook:checkpoint.waitingForCook,
    suspended:checkpoint.suspended,
    pendingCook,
    wasPaused:checkpoint.wasPaused
  });
  return isStoryCheckpointRecord(cloned)?cloned:null;
}

function captureStoryCheckpoint(){
  if(!storySession||state.story?.activeStoryCook)return null;
  const sceneId=storySession.scene?.id;
  if(!sceneId||state.story?.completed?.[sceneId])return null;
  return normalizeStoryCheckpoint({
    version:STORY_CHECKPOINT_VERSION,
    queue:storySession.queue,
    queueIndex:storySession.queueIndex,
    sceneId,
    lines:storySession.lines,
    lineIndex:storySession.lineIndex,
    actorIds:(storySession.actors||[]).map(actor=>actor.id),
    waitingForCook:!!storySession.waitingForCook,
    suspended:!!storySession.suspended,
    pendingCook:storySession.pendingCook||null,
    wasPaused:!!storySession.wasPaused
  });
}

function clearStoryRuntime(){
  const hadRuntime=!!storySession||!!state.story?.activeStoryCook;
  clearStoryTyping();
  if(storyRevealTimer){clearTimeout(storyRevealTimer);storyRevealTimer=null;}
  const revealNotice=document.getElementById("storyRevealNotice");
  const overlay=document.getElementById("storyOverlay");
  const stage=document.getElementById("storyStage");
  if(revealNotice)revealNotice.classList.remove("show");
  if(overlay)overlay.classList.remove("open");
  if(stage)stage.innerHTML="";
  if(state.story)state.story.activeStoryCook=null;
  storySession=null;
  return hadRuntime;
}

function restoreStoryCheckpoint(checkpoint){
  const restored=normalizeStoryCheckpoint(checkpoint);
  clearStoryRuntime();
  if(!restored)return false;

  const scene=STORY_SCENES[restored.sceneId];
  let pendingOrder=null;
  if(restored.suspended){
    if(state.phase!==GAME_PHASES.OPEN)return false;
    pendingOrder=(state.orders||[]).find(order=>
      order.id===restored.pendingCook.orderId
      &&order.storySceneId===restored.sceneId
    );
    if(!pendingOrder)return false;
  }

  storySession={
    queue:restored.queue,
    queueIndex:restored.queueIndex,
    scene,
    lines:restored.lines,
    lineIndex:restored.lineIndex,
    actors:[],
    wasPaused:restored.wasPaused,
    onComplete:state.phase===GAME_PHASES.OPEN?resumeDeferredStoryOrderScene:null,
    waitingForCook:restored.waitingForCook,
    suspended:restored.suspended,
    pendingCook:restored.pendingCook
  };

  document.getElementById("storySceneTitle").textContent=`${scene.id} · ${scene.title}`;
  document.getElementById("storyDayLabel").textContent=scene.moment==="newGame"?"PROLOGUE":`DAY ${scene.day}`;
  restored.actorIds.forEach(ensureStoryActor);

  if(restored.suspended){
    pendingOrder.specialRecipe=!!restored.pendingCook.config.special;
    state.selectedOrderId=pendingOrder.id;
    state.paused=false;
    document.getElementById("storyOverlay").classList.remove("open");
    updateUI(true);
    return true;
  }

  state.paused=true;
  document.getElementById("storyOverlay").classList.add("open");
  showStoryLine();
  return true;
}

function storyTimeOfDayOverride(){
  const scene=storySession?.scene
    ||(state.story?.activeStoryCook?STORY_SCENES[state.story.activeStoryCook.sceneId]:null);
  return scene&&["day","night"].includes(scene.timeOfDay)?scene.timeOfDay:null;
}

function playStoryScenes(sceneIds,onComplete=null){
  if(storyIsActive())return false;
  const queue=sceneIds.filter(id=>STORY_SCENES[id]&&!state.story.completed[id]);
  if(!queue.length){if(onComplete)onComplete();return false;}
  storySession={queue,queueIndex:0,scene:null,lines:[],lineIndex:0,actors:[],wasPaused:state.paused,onComplete};
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
  resetStoryStage();
  document.getElementById("storySceneTitle").textContent=`${scene.id} · ${scene.title}`;
  document.getElementById("storyDayLabel").textContent=scene.moment==="newGame"?"PROLOGUE":`DAY ${scene.day}`;
  showStoryLine();
}

function clearStoryTyping(){
  if(storyTypingTimer){clearTimeout(storyTypingTimer);storyTypingTimer=null;}
}

function storyLineText(line){return line.prompt||line.text||"";}
function setStoryNextButton(isCook=false){
  const button=document.getElementById("storyNextButton");
  button.innerHTML=isCook?'조리 시작 <span>▶</span>':'계속 <span>▼</span>';
}

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
  speakerEl.hidden=!speakerId;
  speakerEl.textContent=storyDisplayName(speakerId);
  badge.textContent=speakerId&&STORY_GUEST_IDS.includes(speakerId)&&isCharacterNameRevealed(speakerId)?storyRelationLabel(speakerId):"";
  setStoryPortrait(speakerId);
  choices.innerHTML="";choices.classList.remove("open");
  setStoryNextButton(false);
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
  if(typing.line.cook||typing.line.orderCook)setStoryNextButton(true);
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
  state.story.choices[scene.id]=index;
  if(choice.flag)state.story.flags[choice.flag]=true;
  if(choice.notice)showToast(choice.notice);
  if(choice.orderCook){
    audio?.click();
    suspendStoryForOrderCook(scene,choice.orderCook,{
      choice:{...choice},choiceIndex:index,lineIndex:storySession.lineIndex
    });
    return;
  }
  if(choice.affinity&&scene.character&&STORY_GUEST_IDS.includes(scene.character))getStoryGuestState(scene.character).affinity+=choice.affinity;
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
  if(storySession.waitingForCook)return true;
  if(line?.cook){
    audio?.click();
    startStoryCookChallenge(storySession.scene,line.cook,{lineIndex:storySession.lineIndex});
    return true;
  }
  if(line?.orderCook){
    audio?.click();
    suspendStoryForOrderCook(storySession.scene,line.orderCook,{lineIndex:storySession.lineIndex});
    return true;
  }
  storySession.lineIndex++;
  audio?.click();
  showStoryLine();
  return true;
}

// 무대 배치 규칙: 주인공은 항상 맨 왼쪽 자리, 나머지 화자는 등장 순서대로 오른쪽 끝까지 균등 배치합니다.
// (상대 1명이면 오른쪽, 2명이면 중앙·오른쪽, 그 이상은 같은 간격으로 계속 벌어집니다.)
const STORY_ACTOR_MAX_WIDTH=24;
const STORY_ACTOR_MARGIN=2;
const STORY_ACTOR_GUTTER=1.5;

function resetStoryStage(){
  const stage=document.getElementById("storyStage");
  if(stage)stage.innerHTML="";
  if(storySession)storySession.actors=[];
}

function applyStoryPortraitArt(portrait,speakerId){
  const character=STORY_CHARACTERS[speakerId];
  if(character?.art){
    portrait.classList.add("art");
    portrait.style.setProperty("--portrait-art",`url("${character.art}")`);
    return;
  }
  if(speakerId==="protagonist"){portrait.classList.add("chef");return;}
  if(!character||character.portraitRow==null){portrait.classList.add("role");return;}
  const row=clamp(character.portraitRow,0,5);
  portrait.style.setProperty("--portrait-y",row===5?"100%":`${row*20}%`);
}

function ensureStoryActor(speakerId){
  if(!storySession||!speakerId)return null;
  if(!storySession.actors)storySession.actors=[];
  const existing=storySession.actors.find(actor=>actor.id===speakerId);
  if(existing)return existing;
  const stage=document.getElementById("storyStage");
  if(!stage)return null;
  const element=document.createElement("div");
  element.className="story-actor";
  element.dataset.speaker=speakerId;
  const portrait=document.createElement("div");
  portrait.className="story-portrait";
  applyStoryPortraitArt(portrait,speakerId);
  element.appendChild(portrait);
  stage.appendChild(element);
  const actor={id:speakerId,element};
  if(speakerId==="protagonist")storySession.actors.unshift(actor);
  else storySession.actors.push(actor);
  layoutStoryActors();
  requestAnimationFrame(()=>element.classList.add("entered"));
  return actor;
}

function layoutStoryActors(){
  const actors=storySession?.actors||[];
  if(!actors.length)return;
  const width=Math.min(STORY_ACTOR_MAX_WIDTH,(100-STORY_ACTOR_MARGIN*2)/actors.length-STORY_ACTOR_GUTTER);
  const left=STORY_ACTOR_MARGIN+width/2;
  const right=100-STORY_ACTOR_MARGIN-width/2;
  actors.forEach((actor,index)=>{
    const x=actors.length===1
      ?(actor.id==="protagonist"?left:right)
      :left+(right-left)*index/(actors.length-1);
    actor.element.style.setProperty("--actor-x",`${x}%`);
    actor.element.style.setProperty("--actor-w",`${width}%`);
  });
}

function setStoryPortrait(speakerId){
  if(!storySession)return;
  if(speakerId)ensureStoryActor(speakerId);
  // 나레이션이면 발화자가 없으므로 전원 어둡게 유지합니다.
  (storySession.actors||[]).forEach(actor=>{
    actor.element.classList.toggle("is-active",!!speakerId&&actor.id===speakerId);
  });
}

function completeStoryScene(){
  if(!storySession)return;
  const scene=storySession.scene;
  state.story.completed[scene.id]=true;
  if(scene.completesPrologue)state.story.prologueComplete=true;
  if(scene.ending)state.story.endingSeen=true;
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    guest.affinity+=Number(scene.affinity)||0;
    guest.arcStep=Math.max(guest.arcStep,Number((scene.id.match(/-(\d\d)$/)||[])[1])||0);
    if(scene.regular)guest.regular=true;
  }
  updateRelationshipUI();
  storySession.queueIndex++;
  beginNextStoryScene();
  // 완료된 현재 장면은 체크포인트를 만들 수 없으므로, 다음 장면으로
  // 커서를 옮긴 뒤 완료 플래그와 새 재개 위치를 한 번에 저장합니다.
  saveGame(true);
}

function storyCookingTier(score,thresholds=null){
  const custom=thresholds&&typeof thresholds==="object"?thresholds:null;
  const great=Number.isFinite(custom?.great)?custom.great:80;
  const hasWarm=custom?Object.prototype.hasOwnProperty.call(custom,"warm"):true;
  const warm=hasWarm&&Number.isFinite(custom?.warm)?custom.warm:custom?null:60;
  if(score>=great)return "great";
  if(warm!=null&&score>=warm)return "warm";
  return "soft";
}

function startStoryCookChallenge(scene,cook,metadata={}){
  if(!storySession||state.story.activeStoryCook)return false;
  const dish=dishById(cook?.dishId||scene.dishId);
  if(!dish||!Array.isArray(dish.cook)||!dish.cook.length){
    showToast("조리할 메뉴 정보를 찾지 못했습니다.",true);
    return false;
  }
  const lineIndex=Number.isInteger(metadata.lineIndex)?metadata.lineIndex:storySession.lineIndex;
  state.story.activeStoryCook={
    sceneId:scene.id,
    guestId:scene.character||null,
    dishId:dish.id,
    steps:dish.cook.map(step=>({...step})),
    stepIndex:0,
    scores:[],
    lineIndex,
    resultKey:cook.resultKey||`${scene.id}:line:${lineIndex}`,
    tutorial:!!cook.tutorial,
    special:!!cook.special,
    thresholds:cook.thresholds&&typeof cook.thresholds==="object"?{...cook.thresholds}:null
  };
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
    special:!!challenge.special,tutorial:!!challenge.tutorial,guestId:challenge.guestId,
    resultKey:challenge.resultKey
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
  const tier=storyCookingTier(average,challenge.thresholds);
  state.story.storyCookResults[challenge.resultKey]={
    score:average,tier,day:state.day,dishId:challenge.dishId
  };
  state.story.activeStoryCook=null;

  if(storySession){
    storySession.waitingForCook=false;storySession.suspended=false;
    storySession.lineIndex=challenge.lineIndex+1;
    state.paused=true;
    document.getElementById("storyOverlay").classList.add("open");
    showStoryLine();
  }
  return true;
}

function suspendStoryForOrderCook(scene,config,metadata={}){
  if(!storySession||storySession.pendingCook)return false;
  config=config&&typeof config==="object"?config:{};
  const order=state.orders.find(item=>item.storySceneId===scene.id);
  if(!order){
    showToast("이야기 손님의 주문을 찾지 못했습니다. 손님이 도착한 뒤 다시 시도해 주세요.",true);
    return false;
  }
  order.specialRecipe=!!config.special;
  storySession.waitingForCook=true;storySession.suspended=true;
  storySession.pendingCook={
    sceneId:scene.id,
    orderId:order.id,
    config:{
      ...config,
      thresholds:config.thresholds&&typeof config.thresholds==="object"?{...config.thresholds}:null,
      replies:config.replies&&typeof config.replies==="object"?{...config.replies}:null
    },
    choice:metadata.choice?{...metadata.choice}:null,
    choiceIndex:Number.isInteger(metadata.choiceIndex)?metadata.choiceIndex:null,
    lineIndex:Number.isInteger(metadata.lineIndex)?metadata.lineIndex:storySession.lineIndex
  };
  state.selectedOrderId=order.id;
  state.paused=false;
  document.getElementById("storyOverlay").classList.remove("open");
  showToast(config.special
    ?`${storyDisplayName(order.guestId)}을 위한 특별 조리를 완성해 주세요.`
    :`${storyDisplayName(order.guestId)}의 주문을 조리해 제공해 주세요.`);
  updateUI(true);
  saveGame(true);
  return true;
}

function configuredStoryCookReply(scene,config,metadata,tier){
  const configured=config.replies?.[tier];
  if(configured&&typeof configured==="object"){
    return {
      speaker:configured.speaker||metadata.choice?.speaker||scene.character||"protagonist",
      text:String(configured.text||"잘 먹었습니다.")
    };
  }
  const fallback={
    great:"정성 들인 맛이 제대로 전해졌어요.",
    warm:"괜찮네요. 잘 먹었어요.",
    soft:"맛은 그럭저럭이네요."
  };
  return {
    speaker:metadata.choice?.speaker||scene.character||"protagonist",
    text:typeof configured==="string"?configured:fallback[tier]
  };
}

function recordStoryCookOutcome(scene,config,metadata,order,score,tier){
  const choice=metadata.choice;
  const index=metadata.choiceIndex;
  if(Number.isInteger(index))state.story.choices[scene.id]=index;
  if(choice?.flag)state.story.flags[choice.flag]=true;
  const potential=Math.max(0,Number(choice?.affinity)||0);
  const affinityDelta=tier==="great"?potential:tier==="warm"?Math.min(1,potential):0;
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    guest.affinity+=affinityDelta;
  }
  const resultKey=config.resultKey||scene.id;
  state.story.storyCookResults[resultKey]={
    score,tier,day:state.day,dishId:order.dishId,
    choiceIndex:Number.isInteger(index)?index:null,affinityDelta
  };
  return configuredStoryCookReply(scene,config,metadata,tier);
}

function finishSuspendedStoryCook(order,satisfaction){
  const pending=storySession?.pendingCook;
  if(!storySession?.suspended||!pending||pending.orderId!==order.id)return false;
  const scene=STORY_SCENES[pending.sceneId];
  if(!scene)return false;
  const tier=storyCookingTier(satisfaction,pending.config.thresholds);
  const metadata={choice:pending.choice,choiceIndex:pending.choiceIndex};
  const reply=recordStoryCookOutcome(scene,pending.config,metadata,order,satisfaction,tier);
  const lineIndex=pending.lineIndex;
  storySession.pendingCook=null;storySession.waitingForCook=false;storySession.suspended=false;
  state.paused=true;
  storySession.lines.splice(lineIndex+1,0,reply);
  storySession.lineIndex=lineIndex+1;
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
  resetStoryStage();
  const complete=storySession.onComplete;
  const wasPaused=storySession.wasPaused;
  storySession=null;
  state.paused=state.phase==="result"?true:wasPaused;
  if(state.phase===GAME_PHASES.RESULT){
    const finalDay=state.day>=DayManager.maxDay;
    dom.nextDayButton.textContent=finalDay
      ?state.story?.endingSeen?"엔딩 완료":`Day ${DayManager.maxDay} 완료`
      :"다음 날 준비";
    dom.nextDayButton.disabled=finalDay;
  }
  updateRelationshipUI();
  updateUI(true);
  saveGame();
  if(complete)complete();
}

function prepareStoryNight(){
  if(!state.story)state.story=createStoryState();
  const plans=storySceneIdsForMoment("nightStart")
    .map(id=>STORY_SCENES[id])
    .filter(scene=>
      scene?.guestOrder===true
      &&!state.story.completed[scene.id]
      &&scene.character
      &&STORY_CHARACTERS[scene.character]
      &&scene.character!=="protagonist"
    )
    .map(scene=>({
      guestId:scene.character,
      sceneId:scene.id,
      dishId:typeof scene.dishId==="string"?scene.dishId:null,
      arrival:["early","late","last"].includes(scene.arrival)?scene.arrival:"early",
      deferUntilArrival:!!scene.deferUntilArrival,
      guestOrder:true,
      special:false,
      repeat:false
    }));

  if(!plans.length){
    const regulars=STORY_GUEST_IDS.filter(id=>{
      const guest=state.story.guestState[id];
      return guest?.regular&&guest.lastVisitDay<state.day&&isCharacterNameRevealed(id);
    });
    const returnChance=state.day>DayManager.maxDay
      ?0.82
      :clamp(.42+state.popularity*.003,0,.68);
    if(regulars.length&&Math.random()<returnChance){
      const guestId=regulars[Math.floor(Math.random()*regulars.length)];
      plans.push({
        guestId,sceneId:null,dishId:null,arrival:"early",deferUntilArrival:false,
        guestOrder:true,special:false,repeat:true
      });
    }
  }
  state.story.pendingNightGuests=plans;
}

function decorateStoryOrder(order,plan=null){
  order.customerType="general";order.guestId=null;order.specialRecipe=false;order.storySceneId=null;order.repeatVisit=false;
  order.storyDishId=null;order.storyArrival=null;order.deferUntilArrival=false;order.guestOrder=false;
  order.bubble=pickGeneralGuestBubble("arrival");order.bubbleTime=4.5;order.waitingTime=0;order.waitingBubbleShown=false;
  if(!plan)return order;
  const plans=state.story?.pendingNightGuests||[];
  const planIndex=plans.indexOf(plan);
  if(planIndex>=0)plans.splice(planIndex,1);
  const character=STORY_CHARACTERS[plan.guestId];
  order.customerType="story";order.guestId=plan.guestId;order.specialRecipe=!!plan.special;
  order.storySceneId=plan.sceneId||null;order.repeatVisit=!!plan.repeat;
  order.storyDishId=plan.dishId||null;
  order.storyArrival=["early","late","last"].includes(plan.arrival)?plan.arrival:"early";
  order.deferUntilArrival=!!plan.deferUntilArrival;
  order.guestOrder=plan.guestOrder!==false;
  if(order.storyDishId)order.dishId=order.storyDishId;
  order.variant=character?.portraitRow??order.variant;
  order.bubble=plan.repeat
    ?REGULAR_GUEST_BUBBLES[plan.guestId]||"오늘도 잘 부탁드려요."
    :plan.special?"오늘은 조금 특별하게 부탁드릴게요.":"오늘 먹고 싶은 걸 말씀드릴게요.";
  order.bubbleTime=5.5;
  return order;
}

function normalizeStoryOrder(order){
  if(!order||typeof order!=="object")return order;
  const scene=STORY_SCENES[order.storySceneId]||null;
  if(!order.customerType)order.customerType=order.storySceneId?"story":"general";
  if(!("guestId" in order))order.guestId=null;
  order.specialRecipe=!!order.specialRecipe;
  order.storySceneId=order.storySceneId||null;
  order.repeatVisit=!!order.repeatVisit;
  order.storyDishId=order.storyDishId||scene?.dishId||null;
  order.storyArrival=["early","late","last"].includes(order.storyArrival)
    ?order.storyArrival
    :["early","late","last"].includes(scene?.arrival)?scene.arrival:null;
  order.deferUntilArrival=!!(order.deferUntilArrival||scene?.deferUntilArrival);
  order.guestOrder=order.guestOrder!==false&&(order.customerType==="story"||scene?.guestOrder===true);
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
  const pending=storySession?.pendingCook;
  const thresholds=pending?.orderId===order.id?pending.config?.thresholds:null;
  const tier=storyCookingTier(satisfaction,thresholds);
  if(STORY_GUEST_IDS.includes(order.guestId)){
    const guest=getStoryGuestState(order.guestId);
    if(!order.storySceneId&&tier==="great")guest.affinity++;
    if(guest.lastVisitDay!==state.day){guest.visits++;guest.lastVisitDay=state.day;}
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
  normalizeDayPrepState();
  state.screen="game";state.phase=qaScene.moment==="nightEnd"?"result":qaScene.moment==="nightStart"?"night":"day";
  state.day=qaScene.day||1;state.paused=false;
  openGameScreen();buildMenuCards();updateUI(true);syncPhaserObjects();
  if(params.get("qa-order")==="1"&&state.phase==="night"){
    state.phaseTime=NIGHT_DURATION;state.orders=[];state.respawns=[];state.spawnedCustomers=0;state.nightCustomerTarget=4;
    const qaDish=dishById(qaScene.dishId)||dishById("kimchi")||DISHES[0];
    state.selectedMenus=[qaDish.id];
    state.inventory[qaDish.id]={count:4,quality:85};
    if(qaScene.character&&STORY_GUEST_IDS.includes(qaScene.character))revealCharacterName(qaScene.character,false);
    prepareStoryNight();spawnOrder(0,{forceStory:true});
    updateUI(true);
  }
  playStoryScenes([sceneId]);
  const lineIndex=Math.max(0,Number(params.get("qa-line"))||0);
  for(let i=0;i<lineIndex;i++){
    const line=storySession?.lines[i];
    if(line?.reveal)revealCharacterName(line.reveal,false);
    if(line?.speaker)ensureStoryActor(line.speaker);
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
