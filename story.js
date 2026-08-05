"use strict";

// 대본 데이터와 게임 로직을 분리하는 스토리 실행기입니다.
// 특별 손님의 묘사형 호칭은 가명이나 미공개 이름이 아니라 실제 표시명입니다.
const STORY_GUEST_IDS=[
  "rainyChild","lanternGuest","twinShadows","crowCourier",
  "starBeast","seawaterGuest","schoolDoll","facelessDaeun"
];
let storySession=null;
let storyTypingTimer=null;
let storyRevealTimer=null;
let storySceneIntroTimer=null;
let storyUiInitialized=false;
const STORY_CHECKPOINT_VERSION=1;
const STORY_SCENE_INTRO_DURATION=1700;
const STORY_GAME_UI_VISIBLE_CLASS="show-game-ui";

function createStoryGuestState(){
  return {
    nameRevealed:true,
    affinity:0,
    arcStep:0,
    regular:false,
    visits:0,
    lastVisitDay:0,
    clueFound:false,
    foodConfirmed:false,
    memoryUnlocked:false,
    shardOwned:false,
    currentTier:null,
    currentScore:null
  };
}

function createStoryState(){
  return {
    schemaVersion:3,
    loop:1,
    prologueComplete:false,
    completed:{},
    seenScenes:{},
    choices:{},
    guestState:Object.fromEntries(STORY_GUEST_IDS.map(id=>[id,createStoryGuestState()])),
    flags:{},
    pendingNightGuests:[],
    specialServedDays:{},
    specialHandledDays:{},
    storyCookResults:{},
    activeStoryCook:null,
    pendingResultSceneId:null,
    endingSeen:false,
    endingsSeen:{},
    judgmentComplete:false,
    legacyImported:false
  };
}

function normalizeStoryState(raw){
  const base=createStoryState();
  if(!raw||typeof raw!=="object")return base;
  base.schemaVersion=3;
  base.loop=Math.max(1,Math.floor(Number(raw.loop)||1));
  base.prologueComplete=!!raw.prologueComplete;
  base.completed={...(raw.completed||{})};
  base.seenScenes={...(raw.seenScenes||raw.completed||{})};
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
  base.specialHandledDays={...(raw.specialHandledDays||{})};
  base.storyCookResults={...(raw.storyCookResults||{})};
  base.activeStoryCook=null;
  base.pendingResultSceneId=typeof raw.pendingResultSceneId==="string"&&STORY_SCENES[raw.pendingResultSceneId]
    ?raw.pendingResultSceneId:null;
  base.endingSeen=!!raw.endingSeen;
  base.endingsSeen={...(raw.endingsSeen||{})};
  base.judgmentComplete=!!raw.judgmentComplete;
  base.legacyImported=!!raw.legacyImported;
  STORY_GUEST_IDS.forEach(id=>{
    const saved=raw.guestState?.[id]||{};
    base.guestState[id]={...createStoryGuestState(),...saved};
    base.guestState[id].nameRevealed=!!base.guestState[id].nameRevealed;
    base.guestState[id].regular=!!base.guestState[id].regular;
    base.guestState[id].clueFound=!!base.guestState[id].clueFound;
    base.guestState[id].foodConfirmed=!!base.guestState[id].foodConfirmed;
    base.guestState[id].memoryUnlocked=!!base.guestState[id].memoryUnlocked;
    base.guestState[id].shardOwned=!!base.guestState[id].shardOwned;
    base.guestState[id].currentTier=["soft","warm","great"].includes(base.guestState[id].currentTier)
      ?base.guestState[id].currentTier:null;
    base.guestState[id].currentScore=Number.isFinite(base.guestState[id].currentScore)
      ?clamp(base.guestState[id].currentScore,0,100):null;
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

function storySceneProgressKey(sceneOrId){
  const scene=typeof sceneOrId==="string"?STORY_SCENES[sceneOrId]:sceneOrId;
  if(!scene)return typeof sceneOrId==="string"?sceneOrId:"";
  const loop=Math.max(1,Number(state.story?.loop)||1);
  if(scene.dynamicJournalHint||scene.repeatDaily||scene.repeatEachDay)return `${scene.id}@loop${loop}@day${state.day}`;
  if(scene.repeatEachLoop||["endingJudgement","ending","epilogue"].includes(scene.sceneType))return `${scene.id}@loop${loop}`;
  return scene.id;
}

function storySceneCompleted(sceneOrId){
  const key=storySceneProgressKey(sceneOrId);
  return !!(key&&state.story?.completed?.[key]);
}

function markStorySceneCompleted(scene){
  const key=storySceneProgressKey(scene);
  if(key)state.story.completed[key]=true;
  state.story.seenScenes[scene.id]=true;
}

function storyShardCount({baseOnly=false}={}){
  const ids=baseOnly?STORY_GUEST_IDS.slice(0,7):STORY_GUEST_IDS;
  return ids.reduce((count,id)=>count+(getStoryGuestState(id).shardOwned?1:0),0);
}

function storyGuestArrivalScenes(){
  return Object.values(STORY_SCENES).filter(scene=>scene?.specialGuest===true&&/^SCN-G\d+-A$/.test(scene.id));
}

function storyGuestArrivalForDay(day=state.day,{includeFinal=true}={}){
  return storyGuestArrivalScenes().filter(scene=>{
    if(Number(scene.day)!==Number(day))return false;
    if(scene.id==="SCN-G8-A")return includeFinal&&storyShardCount({baseOnly:true})===7;
    return true;
  });
}

function storyPrimaryGuestForDay(day=state.day){
  return storyGuestArrivalForDay(day,{includeFinal:false})[0]||null;
}

function recordStoryJournalGuest(guestId,scene=null){
  const character=STORY_CHARACTERS[guestId];
  const api=window.MoonlightTableSave;
  if(!character||!api?.recordGuest)return null;
  return api.recordGuest(guestId,{
    label:character.name,
    day:Number(scene?.day)||Number(state.day)||1,
    note:getStoryGuestState(guestId).memoryUnlocked?"기억 회복":"만남 기록"
  });
}

function recordStoryJournalShard(scene,guestId){
  const api=window.MoonlightTableSave;
  if(!api?.recordFragment||!scene?.shardId)return null;
  return api.recordFragment(scene.shardId,{
    label:scene.shardName||scene.shardId,
    day:Number(scene.day)||Number(state.day)||1,
    guestId
  });
}

function recordStoryJournalEnding(scene){
  const api=window.MoonlightTableSave;
  if(!api?.recordEnding||!scene?.id)return null;
  return api.recordEnding(scene.id,{label:scene.title||scene.id,note:`루프 ${state.story?.loop||1}`});
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

function storySpeakerLabel(line){
  if(line?.speaker)return storyDisplayName(line.speaker);
  return typeof line?.speakerLabel==="string"?line.speakerLabel.trim():"";
}

function storySceneCardText(scene){
  return scene?`${scene.id} · ${scene.title}`:"";
}

function storySceneDayLabel(scene){
  if(scene?.moment==="newGame")return "PROLOGUE";
  return `DAY ${Number(scene?.day)||Number(state.day)||1}`;
}

function setStoryGameUiVisible(visible){
  document.getElementById("storyOverlay")?.classList.toggle(STORY_GAME_UI_VISIBLE_CLASS,!!visible);
}

function clearStorySceneIntro(){
  if(storySceneIntroTimer){clearTimeout(storySceneIntroTimer);storySceneIntroTimer=null;}
  document.getElementById("storySceneMeta")?.classList.remove("show");
  document.getElementById("storyOverlay")?.classList.remove("scene-intro");
  if(storySession)storySession.sceneIntroActive=false;
}

function finishStorySceneIntro(){
  if(!storySession?.sceneIntroActive)return false;
  clearStorySceneIntro();
  showStoryLine();
  return true;
}

function showStorySceneIntro(){
  if(!storySession?.scene)return false;
  clearStorySceneIntro();
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
    showStoryLine();
    return false;
  }
  storySession.sceneIntroActive=true;
  document.getElementById("storySceneMeta")?.classList.add("show");
  document.getElementById("storyOverlay")?.classList.add("scene-intro");
  storySceneIntroTimer=setTimeout(finishStorySceneIntro,STORY_SCENE_INTRO_DURATION);
  return true;
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
  if(guest.shardOwned)return "달빛 조각 회수";
  if(guest.foodConfirmed)return "음식 확인";
  if(guest.clueFound)return "단서 기록";
  return "첫 만남";
}

function updateRelationshipUI(){
  const list=document.getElementById("relationshipList");
  if(!list||!state.story)return;
  const known=STORY_GUEST_IDS.filter(id=>{
    const guest=state.story.guestState[id];
    return guest&&(guest.visits>0||guest.clueFound||guest.foodConfirmed||guest.shardOwned);
  });
  if(!known.length){
    list.innerHTML='<span class="relationship-empty">아직 기록된 특별 손님이 없습니다.</span>';
    return;
  }
  list.innerHTML=known.map(id=>{
    const guest=getStoryGuestState(id);
    return `<div class="relationship-row"><strong>${STORY_CHARACTERS[id].name}</strong><span>${storyRelationLabel(id)}</span></div>`;
  }).join("");
}

function initializeStoryUI(){
  if(storyUiInitialized)return;
  storyUiInitialized=true;
  document.getElementById("storyNextButton").addEventListener("click",storyAdvance);
  document.getElementById("storyText").addEventListener("click",storyAdvance);
  document.getElementById("storySkipButton")?.addEventListener("click",skipCurrentStoryScene);
}

function storySceneHasRequiredInteraction(scene){
  return !!scene?.specialGuest||!!scene?.lines?.some(line=>
    line?.cook||line?.orderCook||line?.choices?.some(choice=>choice?.orderCook||choice?.nextSceneId)
  );
}

function storySceneCanSkip(scene=storySession?.scene){
  return !!(
    scene
    &&!storySession?.qaPreview
    &&state.story?.seenScenes?.[scene.id]
    &&!storySession?.suspended
    &&!storySceneHasRequiredInteraction(scene)
  );
}

function updateStorySkipButton(){
  const button=document.getElementById("storySkipButton");
  if(!button)return;
  button.hidden=!storySceneCanSkip();
}

function skipCurrentStoryScene(){
  if(!storySceneCanSkip())return false;
  clearStoryTyping();
  clearStorySceneIntro();
  audio?.click?.();
  completeStoryScene();
  return true;
}

function storyIsActive(){return !!storySession;}
function storyDialogueIsActive(){return !!storySession&&!storySession.suspended;}
function storyCookingIsActive(){return !!storySession?.suspended;}
function activeStoryCookOrderId(){return storySession?.pendingCook?.orderId??null;}
function activeStoryCookStep(){
  const challenge=state.story?.activeStoryCook;
  return challenge?.steps?.[challenge.stepIndex]||null;
}

function storySceneIdsForMoment(moment,day=state.day){
  if(moment==="nightEnd"&&Number(day)===7){
    const shards=storyShardCount();
    const rule=Object.values(STORY_ENDING_RULES||{}).find(item=>
      shards>=item.minShards&&shards<=item.maxShards
    );
    return rule?.judgementSceneId?[rule.judgementSceneId]:[];
  }
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
  // 미준비 분기 도중 저장·불러오기를 했을 때 체크포인트 콜백은 일반 재개
  // 함수로 복원됩니다. 두 장면이 이미 끝난 방문 객체를 여기서 정리해
  // 조리할 수 없는 손님이 좌석에 영구히 남는 것을 방지합니다.
  const completedMissingVisit=state.orders.find(item=>{
    if(item.customerType!=="story"||!item.missingMenu||!item.storySceneId)return false;
    const arrival=STORY_SCENES[item.storySceneId];
    return !!arrival
      &&storySceneCompleted(arrival)
      &&storySceneCompleted(arrival.missingMenuSceneId);
  });
  if(completedMissingVisit)return finishMissingStoryVisit(completedMissingVisit);
  const order=state.orders.find(item=>{
    const scene=STORY_SCENES[item.storySceneId];
    return item.customerType==="story"&&item.deferUntilArrival&&scene&&!storySceneCompleted(scene);
  });
  if(!order)return false;
  const scene=STORY_SCENES[order.storySceneId];
  if(order.missingMenu){
    const queue=[scene.id,scene.missingMenuSceneId].filter(Boolean);
    return playStoryScenes(queue,()=>finishMissingStoryVisit(order));
  }
  return playStoryScenes([order.storySceneId],resumeDeferredStoryOrderScene);
}

function finishMissingStoryVisit(order){
  if(!order)return false;
  const stillPresent=state.orders.some(item=>item.id===order.id);
  if(stillPresent){
    state.orders=state.orders.filter(item=>item.id!==order.id);
    if(state.selectedOrderId===order.id)state.selectedOrderId=state.orders[0]?.id||null;
    state.departures.push({
      slot:order.slot,variant:order.variant,guestId:order.guestId||null,
      bubble:"다음 밤에 다시 올게요.",life:2.6,stars:0,satisfaction:null,storyMystic:true
    });
  }
  processStoryNightTrigger();
  updateUI(true);saveGame();
  return true;
}

function resumeStoryForCurrentPhase(){
  if(storyIsActive()||state.screen!=="game")return;
  if(state.story?.pendingResultSceneId){playPendingStoryResult();return;}
  if(state.day===1&&!state.story?.prologueComplete){queueStoryMoments(["newGame","dayStart"]);return;}
  if([GAME_PHASES.MENU_SELECT,GAME_PHASES.INGREDIENT_SELECT,GAME_PHASES.PREP].includes(state.phase))queueStoryMoments(["dayStart"]);
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
  if(!STORY_SCENES[checkpoint.sceneId]||storySceneCompleted(checkpoint.sceneId))return null;
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
    wasPaused:checkpoint.wasPaused,
    openJournalAfterFinish:!!checkpoint.openJournalAfterFinish,
    openMenuAfterFinish:!!checkpoint.openMenuAfterFinish
  });
  return isStoryCheckpointRecord(cloned)?cloned:null;
}

function captureStoryCheckpoint(){
  if(!storySession||state.story?.activeStoryCook)return null;
  const sceneId=storySession.scene?.id;
  if(!sceneId||storySceneCompleted(sceneId))return null;
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
    wasPaused:!!storySession.wasPaused,
    openJournalAfterFinish:!!storySession.openJournalAfterFinish,
    openMenuAfterFinish:!!storySession.openMenuAfterFinish
  });
}

function clearStoryRuntime(){
  const hadRuntime=!!storySession||!!state.story?.activeStoryCook;
  clearStoryTyping();
  clearStorySceneIntro();
  setStoryGameUiVisible(false);
  clearStoryCinematic();
  if(storyRevealTimer){clearTimeout(storyRevealTimer);storyRevealTimer=null;}
  const revealNotice=document.getElementById("storyRevealNotice");
  const overlay=document.getElementById("storyOverlay");
  const stage=document.getElementById("storyStage");
  const nextButton=document.getElementById("storyNextButton");
  if(revealNotice)revealNotice.classList.remove("show");
  if(overlay)overlay.classList.remove("open");
  if(stage)stage.innerHTML="";
  if(nextButton)nextButton.disabled=false;
  const skipButton=document.getElementById("storySkipButton");
  if(skipButton)skipButton.hidden=true;
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
    pendingCook:restored.pendingCook,
    openJournalAfterFinish:!!restored.openJournalAfterFinish,
    openMenuAfterFinish:!!restored.openMenuAfterFinish
  };

  document.getElementById("storySceneTitle").textContent=storySceneCardText(scene);
  document.getElementById("storyDayLabel").textContent=storySceneDayLabel(scene);
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

function playPendingStoryResult(){
  const sceneId=state.story?.pendingResultSceneId;
  if(!sceneId||!STORY_SCENES[sceneId]||storyIsActive())return false;
  return playStoryScenes([sceneId],()=>{
    state.story.pendingResultSceneId=null;
    processStoryNightTrigger();
  });
}

function storySceneAvailable(scene){
  if(!scene)return false;
  const loop=Math.max(1,Number(state.story?.loop)||1);
  if(Number.isFinite(scene.minLoop)&&loop<scene.minLoop)return false;
  if(Number.isFinite(scene.maxLoop)&&loop>scene.maxLoop)return false;
  if(Array.isArray(scene.shardRange)){
    const count=storyShardCount();
    if(count<Number(scene.shardRange[0])||count>Number(scene.shardRange[1]))return false;
  }
  if(Number.isFinite(scene.requiredBaseShards)&&storyShardCount({baseOnly:true})<scene.requiredBaseShards)return false;
  if(Array.isArray(scene.requiredFlags)&&scene.requiredFlags.some(flag=>!state.story?.flags?.[flag]))return false;
  return true;
}

function storyJournalStatusForDay(day=state.day){
  const arrival=storyPrimaryGuestForDay(day);
  if(!arrival)return {status:"none",arrival:null,guest:null};
  const guest=getStoryGuestState(arrival.character);
  const status=guest.shardOwned?"shard":guest.foodConfirmed?"confirmed":guest.clueFound?"clue":"none";
  return {status,arrival,guest};
}

function storyLinesForScene(scene){
  let source=scene.lines||[];
  let replacements={};
  if(scene.dynamicJournalHint&&scene.journalVariants){
    const {status,arrival}=storyJournalStatusForDay();
    source=scene.journalVariants[status]||scene.journalVariants.none||source;
    const missing=arrival?STORY_SCENES[arrival.missingMenuSceneId]:null;
    const dish=arrival?dishById(arrival.dishId):null;
    replacements={
      "[영업일지 단서]":missing?.journalClue||"아직 알아내지 못한 단서",
      "[음식명]":dish?.name||dish?.displayName||"아직 모르는 음식"
    };
  }
  return source.map(line=>{
    const copy={...line,choices:line.choices?.map(choice=>({...choice}))};
    if(typeof copy.text==="string")Object.entries(replacements).forEach(([token,value])=>{copy.text=copy.text.split(token).join(value);});
    if(typeof copy.prompt==="string")Object.entries(replacements).forEach(([token,value])=>{copy.prompt=copy.prompt.split(token).join(value);});
    return copy;
  });
}

function playStoryScenes(sceneIds,onComplete=null){
  if(storyIsActive())return false;
  const queue=sceneIds.filter(id=>{
    const scene=STORY_SCENES[id];
    return scene&&storySceneAvailable(scene)&&!storySceneCompleted(scene);
  });
  if(!queue.length){if(onComplete)onComplete();return false;}
  storySession={queue,queueIndex:0,scene:null,lines:[],lineIndex:0,actors:[],wasPaused:state.paused,onComplete};
  state.paused=true;
  document.getElementById("storyOverlay").classList.add("open");
  beginNextStoryScene();
  return true;
}

function beginNextStoryScene(){
  if(!storySession)return;
  while(storySession.queueIndex<storySession.queue.length&&storySceneCompleted(storySession.queue[storySession.queueIndex]))storySession.queueIndex++;
  if(storySession.queueIndex>=storySession.queue.length){finishStorySession();return;}
  const id=storySession.queue[storySession.queueIndex];
  const scene=STORY_SCENES[id];
  storySession.scene=scene;
  storySession.lines=storyLinesForScene(scene);
  storySession.lineIndex=0;
  resetStoryStage();
  setStoryGameUiVisible(false);
  document.getElementById("storySceneTitle").textContent=storySceneCardText(scene);
  document.getElementById("storyDayLabel").textContent=storySceneDayLabel(scene);
  updateStorySkipButton();
  showStorySceneIntro();
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
  const speakerLabel=storySpeakerLabel(line);
  setStoryGameUiVisible(line.showGameUI===true);
  applyStoryCinematic(line);
  speakerEl.classList.remove("revealed");
  speakerEl.hidden=!speakerLabel;
  speakerEl.textContent=speakerLabel;
  badge.textContent=speakerId&&STORY_GUEST_IDS.includes(speakerId)&&isCharacterNameRevealed(speakerId)?storyRelationLabel(speakerId):"";
  setStoryPortrait(speakerId);
  updateStorySkipButton();
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
  if(typing.line.setsFlag)state.story.flags[typing.line.setsFlag]=true;
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
    if(choice.requiredFlag&&!state.story?.flags?.[choice.requiredFlag]){
      button.disabled=true;
      button.title="아직 필요한 기록을 얻지 못했습니다.";
    }
    button.addEventListener("click",()=>chooseStoryOption(choice,index));
    wrap.appendChild(button);
  });
  wrap.classList.add("open");
}

function chooseStoryOption(choice,index){
  if(!storySession)return;
  // QA_REMOVE: 일차별 미리보기에서는 선택 결과를 실제 진행도에 기록하지 않습니다.
  if(storySession.qaPreview){
    return typeof qaStoryPreviewChoice==="function"
      ?qaStoryPreviewChoice(choice,index)
      :true;
  }
  const scene=storySession.scene;
  if(choice.requiredFlag&&!state.story?.flags?.[choice.requiredFlag]){
    showToast("아직 이 선택에 필요한 기록을 얻지 못했습니다.",true);
    return false;
  }
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
  if(choice.nextSceneId&&STORY_SCENES[choice.nextSceneId]){
    const insertAt=storySession.queueIndex+1;
    if(storySession.queue[insertAt]!==choice.nextSceneId)storySession.queue.splice(insertAt,0,choice.nextSceneId);
    storySession.lineIndex=storySession.lines.length;
    audio?.click();
    completeStoryScene();
    return true;
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
  // QA_REMOVE: 미리보기에서는 조리·선택·완료 처리 없이 대사 인덱스만 이동합니다.
  if(storySession.qaPreview){
    return typeof qaStoryStep==="function"?qaStoryStep(1):true;
  }
  if(storySession.sceneIntroActive)return finishStorySceneIntro();
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
  clearStoryCinematic();
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

function storyGuestIdForScene(scene){
  const source=scene?.sourceSceneId?STORY_SCENES[scene.sourceSceneId]:null;
  const id=source?.character||scene?.character||null;
  if(id==="anotherDaeun")return "facelessDaeun";
  return STORY_GUEST_IDS.includes(id)?id:null;
}

function recordStorySceneOutcome(scene){
  const guestId=storyGuestIdForScene(scene);
  if(scene.specialGuest&&guestId){
    const guest=getStoryGuestState(guestId);
    guest.visits++;
    guest.lastVisitDay=state.day;
    recordStoryJournalGuest(guestId,scene);
  }
  if(scene.missingMenu&&guestId){
    const guest=getStoryGuestState(guestId);
    guest.clueFound=true;
    state.story.specialHandledDays[guestId]=state.story.loop;
    recordStoryJournalGuest(guestId,scene);
  }
  if(scene.resultTier&&guestId){
    const guest=getStoryGuestState(guestId);
    guest.foodConfirmed=true;
    guest.currentTier=scene.resultTier;
    if(scene.resultTier==="great"&&scene.grantsShard){
      guest.memoryUnlocked=true;
      if(!guest.shardOwned){
        guest.shardOwned=true;
        recordStoryJournalShard(scene,guestId);
        showToast(`달빛 조각 「${scene.shardName||scene.shardId}」을 받았습니다.`);
      }
    }
    state.story.specialHandledDays[guestId]=state.story.loop;
    state.story.pendingResultSceneId=null;
    recordStoryJournalGuest(guestId,scene);
  }
  if(scene.endingId){
    state.story.endingsSeen[scene.endingId]=true;
    recordStoryJournalEnding({...scene,id:scene.endingId,title:scene.endingTitle||scene.title});
  }
}

function queueStoryConclusion(scene){
  if(!storySession||!scene)return;
  if(scene.autoLoop)storySession.conclusionAction={type:"nextLoop",toTitle:false};
  else if(scene.continuePolicy==="nextLoop")storySession.conclusionAction={type:"nextLoop",toTitle:true};
  else if(scene.continuePolicy==="finalChoiceCheckpoint")storySession.conclusionAction={type:"finalChoiceCheckpoint"};
  else if(scene.trueEndingEpilogue)storySession.conclusionAction={type:"trueEnding"};
}

function completeStoryScene(){
  if(!storySession)return;
  const scene=storySession.scene;
  markStorySceneCompleted(scene);
  if(scene.completesPrologue)state.story.prologueComplete=true;
  if(scene.ending)state.story.endingSeen=true;
  if(scene.autoOpenJournal)storySession.openJournalAfterFinish=true;
  if(scene.opensMenuSelection)storySession.openMenuAfterFinish=true;
  recordStorySceneOutcome(scene);
  queueStoryConclusion(scene);
  if(scene.character&&STORY_GUEST_IDS.includes(scene.character)){
    const guest=getStoryGuestState(scene.character);
    guest.affinity+=Number(scene.affinity)||0;
    guest.arcStep=Math.max(guest.arcStep,Number((scene.id.match(/-(\d\d)$/)||[])[1])||0);
    if(scene.regular)guest.regular=true;
  }
  if(scene.nextSceneId&&!scene.autoLoop&&STORY_SCENES[scene.nextSceneId]){
    const insertAt=storySession.queueIndex+1;
    if(storySession.queue[insertAt]!==scene.nextSceneId)storySession.queue.splice(insertAt,0,scene.nextSceneId);
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
  const warm=hasWarm&&Number.isFinite(custom?.warm)?custom.warm:custom?null:50;
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
  const startStation=stationById(cook.startStation);
  if(startStation&&state.player){
    state.player.x=startStation.ix;
    state.player.y=startStation.iy;
    state.player.facing=startStation.facing;
    state.player.moving=false;
  }
  state.paused=false;
  document.getElementById("storyOverlay").classList.remove("open");
  showStoryCookStationGuide();
  updateUI(true);
  return true;
}

function storyCookStationGuideText(){
  const challenge=state.story?.activeStoryCook;
  const step=activeStoryCookStep();
  if(!challenge||!step)return "";
  const dish=dishById(challenge.dishId)||DISHES[0];
  const station=stationById(step.station);
  return `${dish.name} 조리: ${station?.label||step.station} 가까이 이동해 상호작용하세요.`;
}

function showStoryCookStationGuide(){
  const text=storyCookStationGuideText();
  if(!text)return false;
  showToast(text);
  return true;
}

function launchStoryCookStep(stationId){
  const challenge=state.story?.activeStoryCook;
  const step=activeStoryCookStep();
  if(!challenge||!step||stationId!==step.station)return false;
  const dish=dishById(challenge.dishId)||DISHES[0];
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
    state.paused=false;
    showStoryCookStationGuide();
    updateUI(true);
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

function showTitleAfterStory({save=true}={}){
  if(save)saveGame(true);
  audio.stopAllFiles?.();
  clearStoryRuntime();
  state.screen="title";state.paused=true;state.mini=null;
  clearIngredientHintTimer?.();
  dom.settingsOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.miniOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay?.classList.remove("open");
  dom.gameScreen.classList.remove("active");
  dom.titleScreen.classList.add("active");
  showGameHud(false);audio.stopBgm();
  updateContinueButton();
}

function beginNextStoryLoop({toTitle=false}={}){
  state.story.loop=Math.max(1,Number(state.story.loop)||1)+1;
  state.story.pendingNightGuests=[];
  state.story.specialHandledDays={};
  state.story.activeStoryCook=null;
  state.story.pendingResultSceneId=null;
  state.story.judgmentComplete=false;
  state.story.endingSeen=false;
  state.day=DayManager.setDay(1);
  state.paused=false;
  resetDay(false);
  saveGame();
  if(toTitle){showTitleAfterStory({save:false});return;}
  queueStoryMoments(["dayStart"]);
}

function restoreFinalChoiceCheckpoint(){
  const judgement=STORY_SCENES["SCN-J03"];
  const ending=STORY_SCENES["END-03"];
  delete state.story.completed[storySceneProgressKey(judgement)];
  delete state.story.completed[storySceneProgressKey(ending)];
  delete state.story.choices["SCN-J03"];
  state.story.endingSeen=false;
  state.story.judgmentComplete=false;
  showTitleAfterStory({save:true});
}

function finishTrueEnding(){
  window.MoonlightTableSave?.clearAutoSaveForTrueEnding?.();
  showTitleAfterStory({save:false});
}

function runStoryConclusion(action){
  if(!action)return;
  if(action.type==="nextLoop")beginNextStoryLoop({toTitle:!!action.toTitle});
  else if(action.type==="finalChoiceCheckpoint")restoreFinalChoiceCheckpoint();
  else if(action.type==="trueEnding")finishTrueEnding();
}

function finishStorySession(){
  if(!storySession)return;
  clearStoryTyping();
  clearStorySceneIntro();
  setStoryGameUiVisible(false);
  clearTimeout(storyRevealTimer);
  document.getElementById("storyRevealNotice").classList.remove("show");
  document.getElementById("storyOverlay").classList.remove("open");
  resetStoryStage();
  const complete=storySession.onComplete;
  const wasPaused=storySession.wasPaused;
  const conclusionAction=storySession.conclusionAction||null;
  const openJournalAfterFinish=!!storySession.openJournalAfterFinish;
  const openMenuAfterFinish=!!storySession.openMenuAfterFinish;
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
  if(openMenuAfterFinish&&state.phase===GAME_PHASES.MENU_SELECT)dom.menuSelectOverlay.classList.add("open");
  saveGame();
  if(complete)complete();
  if(openJournalAfterFinish&&!conclusionAction&&typeof openJournal==="function")setTimeout(openJournal,0);
  if(state.story?.pendingResultSceneId&&!conclusionAction)setTimeout(playPendingStoryResult,0);
  if(conclusionAction)setTimeout(()=>runStoryConclusion(conclusionAction),0);
}

function prepareStoryNight(){
  if(!state.story)state.story=createStoryState();
  const sceneIds=STORY_SPECIAL_GUEST_BY_DAY?.[state.day]||[];
  const plans=sceneIds
    .map(id=>STORY_SCENES[id])
    .filter(scene=>scene&&!storySceneCompleted(scene))
    .map(scene=>{
      const menuSelected=state.selectedMenus.includes(scene.dishId);
      return {
        guestId:scene.character,
        sceneId:scene.id,
        dishId:scene.dishId,
        arrival:["early","late","last"].includes(scene.arrival)?scene.arrival:"early",
        deferUntilArrival:true,
        guestOrder:menuSelected,
        menuSelected,
        missingMenu:!menuSelected,
        special:true,
        repeat:true,
        triggerTiming:scene.triggerTiming==="before"?"before":"after",
        triggerAfterGeneral:Math.max(0,Number(scene.triggerAfterGeneral)||0),
        triggerOnNightEnd:!!scene.triggerOnNightEnd,
        requiredBaseShards:Math.max(0,Number(scene.requiredBaseShards)||0),
        ready:false
      };
    });
  state.story.pendingNightGuests=plans;
}

function storyNightPlanReady(plan){
  if(!plan||plan.ready)return !!plan?.ready;
  if((Number(plan.requiredBaseShards)||0)>storyShardCount({baseOnly:true}))return false;
  const served=Math.max(0,Number(state.generalServed)||0);
  if(plan.triggerTiming==="before")return served===0;
  return served>=Math.max(0,Number(plan.triggerAfterGeneral)||0);
}

function processStoryNightTrigger(){
  if(state.phase!==GAME_PHASES.OPEN||storyIsActive()||state.story?.pendingResultSceneId)return false;
  const hasActiveStoryVisit=state.orders.some(order=>order.customerType==="story"||order.storySceneId);
  if(hasActiveStoryVisit){resumeDeferredStoryOrderScene();return false;}
  const plans=state.story?.pendingNightGuests||[];
  const served=Math.max(0,Number(state.generalServed)||0);
  plans.slice().forEach(candidate=>{
    const impossibleFinalGuest=candidate.triggerOnNightEnd
      &&served>=Math.max(0,Number(candidate.triggerAfterGeneral)||0)
      &&(Number(candidate.requiredBaseShards)||0)>storyShardCount({baseOnly:true});
    if(impossibleFinalGuest){
      const index=plans.indexOf(candidate);
      if(index>=0)plans.splice(index,1);
    }
  });
  const plan=plans.find(candidate=>storyNightPlanReady(candidate));
  if(!plan)return false;
  // "손님이 나가자"라는 대본과 화면이 어긋나지 않도록 일반 손님의
  // 퇴장 페이드가 끝난 뒤에 다음 특별 손님을 등장시킵니다.
  if(plan.triggerTiming==="after"&&state.departures.some(item=>!item.guestId))return false;
  plan.ready=true;
  const occupied=new Set(state.orders.map(order=>order.slot));
  state.departures.forEach(item=>occupied.add(item.slot));
  state.respawns.forEach(item=>occupied.add(item.slot));
  const freeSlot=CUSTOMER_SEATS.findIndex((_,slot)=>!occupied.has(slot));
  if(freeSlot<0)return false;
  state.respawns=state.respawns.filter(respawn=>respawn.slot!==freeSlot);
  const spawned=spawnOrder(freeSlot,{forceStory:true,storyPlan:plan});
  if(spawned)resumeDeferredStoryOrderScene();
  return spawned;
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
  order.menuSelected=plan.menuSelected!==false;
  order.missingMenu=!!plan.missingMenu;
  order.storyMystic=true;
  if(order.guestOrder&&order.storyDishId)order.dishId=order.storyDishId;
  order.variant=Number.isFinite(character?.portraitRow)
    ?clamp(character.portraitRow,0,5)
    :order.variant;
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
  order.menuSelected=order.menuSelected!==false;
  order.missingMenu=!!order.missingMenu;
  order.storyMystic=!!(order.storyMystic||order.customerType==="story");
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
  const scene=STORY_SCENES[order.storySceneId]||null;
  const thresholds=pending?.orderId===order.id?pending.config?.thresholds:scene?.thresholds;
  const tier=storyCookingTier(satisfaction,thresholds);
  if(STORY_GUEST_IDS.includes(order.guestId)){
    const guest=getStoryGuestState(order.guestId);
    if(!order.storySceneId&&tier==="great")guest.affinity++;
    if(guest.lastVisitDay!==state.day){guest.visits++;guest.lastVisitDay=state.day;}
  }
  if(order.storySceneId){
    state.story.storyCookResults[order.storySceneId]={score:satisfaction,tier,day:state.day,dishId:order.dishId};
    const guestId=storyGuestIdForScene(scene)||order.guestId;
    const guest=getStoryGuestState(guestId);
    guest.currentScore=satisfaction;
    guest.currentTier=tier;
    const resultSceneId=scene?.resultSceneIds?.[tier]||null;
    if(resultSceneId){
      state.story.pendingResultSceneId=resultSceneId;
      setTimeout(playPendingStoryResult,0);
    }
  }
  return {
    tier,
    text:pickGeneralGuestBubble(tier),
    name:storyDisplayName(order.guestId),
    special:order.specialRecipe,
    resultSceneId:state.story.pendingResultSceneId
  };
}

function pickGeneralGuestBubble(type){
  const pool=GENERAL_GUEST_BUBBLES[type]||GENERAL_GUEST_BUBBLES.warm||["잘 먹겠습니다."];
  return pool[Math.floor(Math.random()*pool.length)];
}

function cookingDifficultyMultiplier(context){return context?.tutorial?.9:context?.special?1.25:1;}

function runStoryQaFromQuery(){
  if(!window.QA_MODE?.enabled)return false;
  const params=new URLSearchParams(location.search);
  const sceneId=params.get("qa-story");
  if(!sceneId||!STORY_SCENES[sceneId])return false;
  const qaScene=STORY_SCENES[sceneId];
  state.story=createStoryState();
  normalizeDayPrepState();
  const qaResult=["nightJudgement","ending","epilogue"].includes(qaScene.moment);
  const qaNight=qaScene.moment!=="newGame"&&qaScene.timeOfDay==="night";
  state.screen="game";
  state.phase=qaResult?GAME_PHASES.RESULT:qaNight?GAME_PHASES.OPEN:GAME_PHASES.PREP;
  state.day=qaScene.day||1;state.paused=false;
  openGameScreen();buildMenuCards();updateUI(true);syncPhaserObjects();
  if(params.get("qa-order")==="1"&&state.phase==="night"){
    state.phaseTime=null;state.orders=[];state.respawns=[];state.spawnedCustomers=0;state.nightCustomerTarget=4;
    const qaDish=dishById(qaScene.dishId)||dishById("kimchi")||DISHES[0];
    state.selectedMenus=[qaDish.id];
    (qaDish.prepTasks||[]).forEach(taskId=>{state.prepProgress[taskId]=true;});
    state.inventory[qaDish.id]={count:1,quality:85,prepared:true};
    if(qaScene.character&&STORY_GUEST_IDS.includes(qaScene.character))revealCharacterName(qaScene.character,false);
    prepareStoryNight();
    const qaPlan=state.story.pendingNightGuests.find(plan=>
      plan.sceneId===(qaScene.specialGuest?qaScene.id:qaScene.sourceSceneId)
    )||state.story.pendingNightGuests[0];
    if(qaPlan){
      qaPlan.ready=true;
      spawningInitialNightOrders=true;
      try{spawnOrder(0,{forceStory:true,storyPlan:qaPlan});}
      finally{spawningInitialNightOrders=false;}
    }
    updateUI(true);
  }
  playStoryScenes([sceneId]);
  clearStorySceneIntro();
  const lineIndex=Math.max(
    0,
    Math.min(qaScene.lines.length-1,Math.floor(Number(params.get("qa-line"))||0))
  );
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
