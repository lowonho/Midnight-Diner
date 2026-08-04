"use strict";

// 브라우저 저장소와 게임 상태 직렬화/복원을 전담합니다.
const SAVE_KEY="midnightDiner.save.v1";
const SAVE_VERSION=3;
const AUTO_SAVE_SLOT="auto";
const MANUAL_SAVE_SLOTS=Object.freeze(["manual1","manual2","manual3"]);
const SAVE_SLOT_DEFS=Object.freeze([
  Object.freeze({id:AUTO_SAVE_SLOT,label:"자동 저장",manual:false}),
  ...MANUAL_SAVE_SLOTS.map((id,index)=>Object.freeze({id,label:`수동 저장 ${index+1}`,manual:true}))
]);
let autosaveElapsed=0;
let saveSystemInitialized=false;

function initializeSaveSystem(){
  if(saveSystemInitialized)return;
  saveSystemInitialized=true;
  window.addEventListener("pagehide",()=>saveGame(true));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")saveGame(true);
  });
}

function saveKeyForSlot(slotId=AUTO_SAVE_SLOT){
  if(slotId===AUTO_SAVE_SLOT)return SAVE_KEY;
  if(MANUAL_SAVE_SLOTS.includes(slotId))return `${SAVE_KEY}.${slotId}`;
  throw new Error(`알 수 없는 저장 슬롯입니다: ${slotId}`);
}

function readSaveData(slotId=AUTO_SAVE_SLOT){
  let key;
  try{
    key=saveKeyForSlot(slotId);
    const raw=localStorage.getItem(key);if(!raw)return null;
    const data=migrateSaveData(JSON.parse(raw));
    const validInventory=data.state?.inventory&&typeof data.state.inventory==="object";
    if(data.version!==SAVE_VERSION||!data.state||!Object.values(GAME_PHASES).includes(data.state.phase)||!Number.isFinite(data.state.day)||!validInventory){
      throw new Error("지원하지 않는 저장 데이터");
    }
    return data;
  }catch(error){
    console.warn(`${slotId} 저장 데이터를 읽지 못했습니다.`,error);
    if(key){
      try{localStorage.removeItem(key);}catch(_error){}
    }
    return null;
  }
}

function readAllSaveSlots(){
  return SAVE_SLOT_DEFS.map(definition=>({...definition,data:readSaveData(definition.id)}));
}

function hasAnySaveData(){
  return SAVE_SLOT_DEFS.some(definition=>!!readSaveData(definition.id));
}

function migrateSaveData(data){
  if(!data||typeof data!=="object")throw new Error("저장 데이터 형식이 올바르지 않습니다.");
  return data;
}

function writeSaveSlot(slotId,{allowDuringStory=false,resetAutosave=false}={}){
  // QA_REMOVE: qa-mode.js와 함께 제거하면 됩니다. QA 이동은 실제 세이브를 덮어쓰지 않습니다.
  if(window.QA_MODE?.enabled)return false;
  const activeStory=storyIsActive();
  if(
    state.screen!=="game"
    ||!Object.values(GAME_PHASES).includes(state.phase)
    ||state.mini
    ||state.story?.activeStoryCook
    ||(activeStory&&!allowDuringStory)
  )return false;
  try{
    const key=saveKeyForSlot(slotId);
    const storyCheckpoint=typeof captureStoryCheckpoint==="function"?captureStoryCheckpoint():null;
    // 대화 중에는 정확한 재개 위치가 없으면 저장하지 않습니다.
    if(activeStory&&allowDuringStory&&!storyCheckpoint)return false;
    const snapshot=JSON.parse(JSON.stringify(state));
    snapshot.screen="game";snapshot.settingsFrom="game";snapshot.paused=snapshot.phase==="result";
    snapshot.mini=null;snapshot.particles=[];snapshot.popups=[];snapshot.departures=[];snapshot.joyX=0;snapshot.joyY=0;snapshot.player.moving=false;
    snapshot.story=normalizeStoryState(snapshot.story);
    localStorage.setItem(key,JSON.stringify({
      version:SAVE_VERSION,
      savedAt:Date.now(),
      nextOrderId,
      storyCheckpoint,
      state:snapshot
    }));
    if(resetAutosave)autosaveElapsed=0;
    return true;
  }catch(error){console.warn("게임을 저장하지 못했습니다.",error);return false;}
}

function saveGame(allowDuringStory=false){
  return writeSaveSlot(AUTO_SAVE_SLOT,{allowDuringStory,resetAutosave:true});
}

function saveManualGame(slotId){
  if(!MANUAL_SAVE_SLOTS.includes(slotId))return false;
  return writeSaveSlot(slotId,{allowDuringStory:true,resetAutosave:false});
}

function clearSaveData(slotId=AUTO_SAVE_SLOT){
  // QA_REMOVE: QA 스토리 탐색 중에는 기존 저장 슬롯을 삭제하지 않습니다.
  if(window.QA_MODE?.enabled)return false;
  try{
    localStorage.removeItem(saveKeyForSlot(slotId));
    if(slotId===AUTO_SAVE_SLOT)autosaveElapsed=0;
    return true;
  }catch(error){
    console.warn(`${slotId} 저장 데이터를 삭제하지 못했습니다.`,error);
    return false;
  }
}

function clearAllSaveData(){
  const cleared=SAVE_SLOT_DEFS.map(definition=>clearSaveData(definition.id)).every(Boolean);
  autosaveElapsed=0;
  return cleared;
}

function restoreGameState(data){
  if(typeof clearStoryRuntime==="function")clearStoryRuntime();
  const saved=data.state;
  const savedAudio={...state.audio,...(saved.audio||{})};
  Object.assign(state,saved);
  state.day=DayManager.setDay(saved.day);

  const numericDefaults={
    day:1,money:0,popularity:0,popularityBeforeResult:0,popularityDelta:0,
    dailyRevenue:0,wasteLoss:0,leftoverCount:0,discardedCount:0,discardLoss:0,nightCustomerTarget:0,
    spawnedCustomers:0,served:0,satisfactionTotal:0,fiveStar:0
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
  try{
    if(typeof restoreStoryCheckpoint==="function")restoreStoryCheckpoint(data.storyCheckpoint);
  }catch(error){
    console.warn("스토리 체크포인트를 복원하지 못했습니다.",error);
    if(typeof clearStoryRuntime==="function")clearStoryRuntime();
  }
  autosaveElapsed=0;
}

function updateAutosave(dt){
  if(state.mini)return;
  autosaveElapsed+=dt;
  if(autosaveElapsed>=5){autosaveElapsed=0;saveGame(true);}
}
