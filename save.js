"use strict";

// 브라우저 저장소와 게임 상태 직렬화/복원을 전담합니다.
const SAVE_KEY="moonlightTable.save.v2";
const SAVE_VERSION=4;
const SAVE_SCHEMA_KEY="moonlightTable.save.schema";
const LEGACY_SAVE_KEYS=Object.freeze(["midnightDiner.save.v1"]);
const JOURNAL_KEY="moonlightTable.journal.v1";
const JOURNAL_VERSION=1;
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
  migrateSaveStorage();
  saveSystemInitialized=true;
  window.addEventListener("pagehide",()=>saveGame(true));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")saveGame(true);
  });
}

// 새 시나리오와 호환되지 않는 과거 자동·수동 저장 네 칸을 최초 실행 때 한 번만
// 정리합니다. 영업일지는 슬롯과 별도 키를 사용하므로 이 마이그레이션의 영향을
// 받지 않습니다.
function migrateSaveStorage(){
  try{
    if(localStorage.getItem(SAVE_SCHEMA_KEY)===String(SAVE_VERSION))return false;
    const bases=new Set([...LEGACY_SAVE_KEYS,SAVE_KEY]);
    bases.forEach(base=>{
      localStorage.removeItem(base);
      MANUAL_SAVE_SLOTS.forEach(slotId=>localStorage.removeItem(`${base}.${slotId}`));
    });
    localStorage.setItem(SAVE_SCHEMA_KEY,String(SAVE_VERSION));
    autosaveElapsed=0;
    return true;
  }catch(error){
    console.warn("저장 데이터 초기화를 완료하지 못했습니다.",error);
    return false;
  }
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

// 진엔딩에서는 반복 플레이용 수동 저장을 남기고, 이어하기의 기본 지점인
// 자동 저장만 비웁니다. story.js는 진엔딩 기록을 남긴 뒤 이 함수를 호출합니다.
function clearAutoSaveForTrueEnding(){
  return clearSaveData(AUTO_SAVE_SLOT);
}

function createJournalData(){
  return {
    version:JOURNAL_VERSION,
    updatedAt:0,
    guests:{},
    fragments:{},
    endings:{}
  };
}

function normalizeJournalCollection(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([id,entry])=>id&&entry&&typeof entry==="object"&&!Array.isArray(entry))
    .map(([id,entry])=>[id,{...entry,id}]));
}

function normalizeJournalData(raw){
  const base=createJournalData();
  if(!raw||typeof raw!=="object"||raw.version!==JOURNAL_VERSION)return base;
  base.updatedAt=Number.isFinite(Number(raw.updatedAt))?Number(raw.updatedAt):0;
  base.guests=normalizeJournalCollection(raw.guests);
  base.fragments=normalizeJournalCollection(raw.fragments);
  base.endings=normalizeJournalCollection(raw.endings);
  return base;
}

function readJournalData(){
  try{
    const raw=localStorage.getItem(JOURNAL_KEY);
    if(!raw)return createJournalData();
    return normalizeJournalData(JSON.parse(raw));
  }catch(error){
    console.warn("영업일지를 읽지 못했습니다.",error);
    return createJournalData();
  }
}

function writeJournalData(data){
  try{
    const normalized=normalizeJournalData({...data,version:JOURNAL_VERSION});
    normalized.updatedAt=Date.now();
    localStorage.setItem(JOURNAL_KEY,JSON.stringify(normalized));
    if(typeof window.refreshJournalUI==="function")window.refreshJournalUI(normalized);
    return normalized;
  }catch(error){
    console.warn("영업일지를 저장하지 못했습니다.",error);
    return null;
  }
}

function recordJournalEntry(collection,id,details={}){
  if(!["guests","fragments","endings"].includes(collection)||typeof id!=="string"||!id.trim())return null;
  const journal=readJournalData();
  const entryId=id.trim();
  const previous=journal[collection][entryId]||{};
  journal[collection][entryId]={
    ...previous,
    ...(details&&typeof details==="object"?details:{}),
    id:entryId,
    firstRecordedAt:previous.firstRecordedAt||Date.now(),
    lastRecordedAt:Date.now()
  };
  return writeJournalData(journal)?.[collection]?.[entryId]||null;
}

function recordJournalGuest(id,details={}){
  return recordJournalEntry("guests",id,details);
}

function recordJournalFragment(id,details={}){
  return recordJournalEntry("fragments",id,details);
}

function recordJournalEnding(id,details={}){
  return recordJournalEntry("endings",id,details);
}

// 스토리 쪽에서 전역 변수 결합 없이 호출할 수 있는 안정적인 연결점입니다.
window.MoonlightTableSave=Object.freeze({
  readJournal:readJournalData,
  recordGuest:recordJournalGuest,
  recordFragment:recordJournalFragment,
  recordEnding:recordJournalEnding,
  clearAutoSaveForTrueEnding
});

function restoreGameState(data){
  if(typeof clearStoryRuntime==="function")clearStoryRuntime();
  const saved=data.state;
  const savedAudio={...state.audio,...(saved.audio||{})};
  Object.assign(state,saved);
  state.day=DayManager.setDay(saved.day);

  const numericDefaults={
    day:1,money:0,popularity:0,popularityBeforeResult:0,popularityDelta:0,
    dailyRevenue:0,wasteLoss:0,leftoverCount:0,discardedCount:0,discardLoss:0,nightCustomerTarget:0,
    spawnedCustomers:0,generalSpawnedCustomers:0,served:0,generalServed:0,satisfactionTotal:0,fiveStar:0
  };
  Object.entries(numericDefaults).forEach(([key,fallback])=>{
    if(!Number.isFinite(state[key]))state[key]=fallback;
  });

  state.audio=savedAudio;
  state.story=normalizeStoryState(saved.story);
  normalizeDayPrepState();
  if(typeof normalizeIngredientSelectionState==="function")normalizeIngredientSelectionState();
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
  if([GAME_PHASES.PREP,GAME_PHASES.MENU_SELECT,GAME_PHASES.INGREDIENT_SELECT].includes(state.phase))state.phaseTime=null;
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
