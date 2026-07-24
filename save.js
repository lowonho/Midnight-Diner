"use strict";

// 브라우저 저장소와 게임 상태 직렬화/복원을 전담합니다.
const SAVE_KEY="midnightDiner.save.v1";
const SAVE_VERSION=2;
let autosaveElapsed=0;
let saveSystemInitialized=false;

function initializeSaveSystem(){
  if(saveSystemInitialized)return;
  saveSystemInitialized=true;
  window.addEventListener("pagehide",()=>saveGame());
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")saveGame();
  });
}

function readSaveData(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
    const data=migrateSaveData(JSON.parse(raw));
    const validInventory=data.state?.inventory&&typeof data.state.inventory==="object";
    if(data.version!==SAVE_VERSION||!data.state||!Object.values(GAME_PHASES).includes(data.state.phase)||!Number.isFinite(data.state.day)||!validInventory){
      throw new Error("지원하지 않는 저장 데이터");
    }
    return data;
  }catch(error){
    console.warn("저장 데이터를 읽지 못했습니다.",error);
    try{localStorage.removeItem(SAVE_KEY);}catch(_error){}
    return null;
  }
}

function migrateSaveData(data){
  if(!data||typeof data!=="object")throw new Error("저장 데이터 형식이 올바르지 않습니다.");
  if(data.version===1&&data.state){
    const story=normalizeStoryState(data.state.story);
    story.prologueComplete=true;
    story.legacyImported=true;
    revealNamesFromLegacyProgress(data.state,story);
    data.state.story=story;
    data.state.departures=[];
    data.state.orders=Array.isArray(data.state.orders)?data.state.orders.map(normalizeStoryOrder):[];
    data.version=SAVE_VERSION;
  }
  return data;
}

function revealNamesFromLegacyProgress(savedState,story){
  const currentDay=Math.max(1,Math.floor(Number(savedState.day)||1));
  const pendingMomentByPhase={menuSelect:"dayStart",day:"dayStart",night:"nightStart",result:"nightEnd"};
  const momentOrder={newGame:0,dayStart:1,nightStart:2,nightEnd:3};
  const pendingOrder=momentOrder[pendingMomentByPhase[savedState.phase]]??1;

  Object.entries(STORY_EVENT_SCHEDULE).forEach(([moment,days])=>{
    Object.entries(days).forEach(([scheduledDay,sceneIds])=>{
      const sceneDay=Number(scheduledDay);
      const momentPassed=sceneDay<currentDay||(sceneDay===currentDay&&momentOrder[moment]<pendingOrder);
      sceneIds.forEach(sceneId=>{
        const scene=STORY_SCENES[sceneId];
        if(!scene||(!momentPassed&&!story.completed[sceneId]))return;
        scene.lines.forEach(line=>{
          if(line.reveal&&story.guestState[line.reveal])story.guestState[line.reveal].nameRevealed=true;
        });
      });
    });
  });
}

function saveGame(allowDuringStory=false){
  // QA_REMOVE: qa-mode.js와 함께 제거하면 됩니다. QA 이동은 실제 세이브를 덮어쓰지 않습니다.
  if(window.QA_MODE?.enabled)return false;
  if(state.screen!=="game"||!Object.values(GAME_PHASES).includes(state.phase)||state.mini||(storyIsActive()&&!allowDuringStory))return false;
  try{
    const snapshot=JSON.parse(JSON.stringify(state));
    snapshot.screen="game";snapshot.settingsFrom="game";snapshot.paused=snapshot.phase==="result";
    snapshot.mini=null;snapshot.particles=[];snapshot.popups=[];snapshot.departures=[];snapshot.joyX=0;snapshot.joyY=0;snapshot.player.moving=false;
    snapshot.story=normalizeStoryState(snapshot.story);
    localStorage.setItem(SAVE_KEY,JSON.stringify({version:SAVE_VERSION,savedAt:Date.now(),nextOrderId,state:snapshot}));
    autosaveElapsed=0;
    return true;
  }catch(error){console.warn("게임을 저장하지 못했습니다.",error);return false;}
}

function clearSaveData(){
  try{localStorage.removeItem(SAVE_KEY);}catch(error){console.warn("저장 데이터를 삭제하지 못했습니다.",error);}
  autosaveElapsed=0;
}

function restoreGameState(data){
  const saved=data.state;
  const savedAudio={...state.audio,...(saved.audio||{})};
  Object.assign(state,saved);
  state.day=DayManager.setDay(saved.day);

  const numericDefaults={
    day:1,money:0,popularity:0,popularityBeforeResult:0,popularityDelta:0,
    dailyRevenue:0,wasteLoss:0,leftoverCount:0,discardedCount:0,discardLoss:0,nightCustomerTarget:0,
    spawnedCustomers:0,served:0,satisfactionTotal:0,fiveStar:0,
    cleanliness:100,dirtyDishes:0,trash:0
  };
  Object.entries(numericDefaults).forEach(([key,fallback])=>{
    if(!Number.isFinite(state[key]))state[key]=fallback;
  });

  state.audio=savedAudio;
  state.story=normalizeStoryState(saved.story);
  normalizeDayPrepState();
  state.inventory=Object.fromEntries(DISHES.map(dish=>[
    dish.id,{count:0,quality:0,...(saved.inventory?.[dish.id]||{})}
  ]));
  state.orders=Array.isArray(saved.orders)?saved.orders.map(normalizeStoryOrder):[];
  state.respawns=Array.isArray(saved.respawns)?saved.respawns:[];
  state.departures=[];
  // speed 는 세이브 값을 쓰지 않고 항상 PLAYER_START 를 따릅니다.
  // 진행 상황이 아니라 밸런스 상수라서, 값을 조정하면 기존 세이브에도 바로 적용돼야 합니다.
  // (이 줄이 없으면 예전 세이브가 옛날 speed 를 그대로 되살립니다)
  state.player={...PLAYER_START,moving:false,...(saved.player||{}),moving:false,speed:PLAYER_START.speed};
  clampChefToWalkArea(state.player);   // chef-walk-area.js — 예전 세이브 위치를 새 영역으로 보정
  state.screen="game";state.settingsFrom="game";state.paused=state.phase==="result";
  state.mini=null;state.particles=[];state.popups=[];state.joyX=0;state.joyY=0;
  if(state.phase===GAME_PHASES.PREP||state.phase===GAME_PHASES.MENU_SELECT)state.phaseTime=null;
  else if(!Number.isFinite(state.phaseTime))state.phaseTime=0;
  nextOrderId=Math.max(Number(data.nextOrderId)||1,...state.orders.map(order=>(Number(order.id)||0)+1));
  autosaveElapsed=0;
}

function updateAutosave(dt){
  if(state.mini)return;
  autosaveElapsed+=dt;
  if(autosaveElapsed>=5){autosaveElapsed=0;saveGame();}
}
