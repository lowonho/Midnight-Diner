"use strict";

// 브라우저 저장소와 게임 상태 직렬화/복원을 전담합니다.
const SAVE_KEY="moonlightTable.save.v2";
const SAVE_VERSION=4;
const SAVE_SCHEMA_KEY="moonlightTable.save.schema";
const LEGACY_SAVE_KEYS=Object.freeze(["midnightDiner.save.v1"]);
const JOURNAL_KEY="moonlightTable.journal.v1";
const JOURNAL_VERSION=2;
const JOURNAL_ENDING_ALIASES=Object.freeze({"SCN-J01":"loop_return"});
const AUDIO_SETTINGS_KEY="moonlightTable.audio.v1";
const ENDING_RETRY_CHECKPOINT_KEY="moonlightTable.endingRetry.v1";
const ENDING_RETRY_CHECKPOINT_VERSION=1;
const DEFAULT_AUDIO_SETTINGS=Object.freeze({
  enabled:true,
  bgmEnabled:true,
  sfxEnabled:true,
  master:.70,
  bgm:.45,
  sfx:.75
});
const AUTO_SAVE_SLOT="auto";
const MANUAL_SAVE_SLOTS=Object.freeze(["manual1","manual2","manual3"]);
const SAVE_SLOT_DEFS=Object.freeze([
  Object.freeze({id:AUTO_SAVE_SLOT,label:"자동 저장",manual:false}),
  // 화면에 "자동 저장" 과 나란히 서는 이름이라 "수동" 을 빼도 뜻이 갈립니다.
  ...MANUAL_SAVE_SLOTS.map((id,index)=>Object.freeze({id,label:`저장 ${index+1}`,manual:true}))
]);
let autosaveElapsed=0;
let saveSystemInitialized=false;

function normalizeAudioSettings(value={}){
  const normalizedValue=value&&typeof value==="object"?value:{};
  const volume=(key)=>{
    const number=Number(normalizedValue[key]);
    return Number.isFinite(number)
      ?Math.max(0,Math.min(1,number))
      :DEFAULT_AUDIO_SETTINGS[key];
  };
  return {
    enabled:normalizedValue.enabled!==false,
    bgmEnabled:normalizedValue.bgmEnabled!==false,
    sfxEnabled:normalizedValue.sfxEnabled!==false,
    master:volume("master"),
    bgm:volume("bgm"),
    sfx:volume("sfx")
  };
}

function readStoredAudioSettings(){
  try{
    const raw=localStorage.getItem(AUDIO_SETTINGS_KEY);
    if(!raw)return null;
    return normalizeAudioSettings(JSON.parse(raw));
  }catch(error){
    console.warn("음향 설정을 읽지 못했습니다.",error);
    try{localStorage.removeItem(AUDIO_SETTINGS_KEY);}catch(_storageError){}
    return null;
  }
}

function readAudioSettings(fallback=DEFAULT_AUDIO_SETTINGS){
  return readStoredAudioSettings()||normalizeAudioSettings(fallback);
}

function writeAudioSettings(value){
  const normalized=normalizeAudioSettings(value);
  try{localStorage.setItem(AUDIO_SETTINGS_KEY,JSON.stringify(normalized));}
  catch(error){console.warn("음향 설정을 저장하지 못했습니다.",error);}
  return normalized;
}

function initializeSaveSystem(){
  if(saveSystemInitialized)return;
  migrateSaveStorage();
  saveSystemInitialized=true;
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

function normalizeEndingRetryAction(action){
  if(!action||typeof action!=="object"||action.type!=="endingRetryMenu")return null;
  const judgementSceneId=typeof action.judgementSceneId==="string"
    ?action.judgementSceneId.trim()
    :"";
  const endingSceneId=typeof action.endingSceneId==="string"
    ?action.endingSceneId.trim()
    :"";
  if(!judgementSceneId||!endingSceneId)return null;
  return {
    type:"endingRetryMenu",
    judgementSceneId,
    endingSceneId,
    endingTitle:typeof action.endingTitle==="string"
      ?action.endingTitle.slice(0,120)
      :""
  };
}

function validEndingRetrySaveData(data){
  return !!data
    &&typeof data==="object"
    &&data.version===SAVE_VERSION
    &&Number.isFinite(Number(data.savedAt))
    &&data.state
    &&typeof data.state==="object"
    &&Object.values(GAME_PHASES).includes(data.state.phase)
    &&Number.isFinite(Number(data.state.day))
    &&data.state.inventory
    &&typeof data.state.inventory==="object";
}

function clearEndingRetryCheckpoint(){
  try{
    localStorage.removeItem(ENDING_RETRY_CHECKPOINT_KEY);
    return true;
  }catch(error){
    console.warn("엔딩 재시도 체크포인트를 삭제하지 못했습니다.",error);
    return false;
  }
}

function readEndingRetryCheckpoint(){
  try{
    const raw=localStorage.getItem(ENDING_RETRY_CHECKPOINT_KEY);
    if(!raw)return null;
    const checkpoint=JSON.parse(raw);
    const action=normalizeEndingRetryAction(checkpoint?.action);
    if(
      checkpoint?.version!==ENDING_RETRY_CHECKPOINT_VERSION
      ||!Number.isFinite(Number(checkpoint.savedAt))
      ||!action
      ||!validEndingRetrySaveData(checkpoint.saveData)
    )throw new Error("지원하지 않는 엔딩 재시도 체크포인트");
    return {
      version:ENDING_RETRY_CHECKPOINT_VERSION,
      savedAt:Number(checkpoint.savedAt),
      action,
      saveData:checkpoint.saveData
    };
  }catch(error){
    console.warn("엔딩 재시도 체크포인트를 읽지 못했습니다.",error);
    clearEndingRetryCheckpoint();
    return null;
  }
}

// 일반 엔딩에서는 이어하기에 노출되는 자동 저장을 비우되, 앱을 다시 열었을 때
// 엔딩 선택 화면만 복원할 수 있도록 별도의 숨은 체크포인트를 남깁니다. 저장에
// 실패하면 기존 자동 저장을 지우지 않아 진행 데이터가 함께 사라지지 않게 합니다.
function saveEndingRetryCheckpoint(action){
  const normalizedAction=normalizeEndingRetryAction(action);
  if(!normalizedAction||window.QA_MODE?.enabled)return false;
  if(!saveGame(true))return false;
  const saveData=readSaveData(AUTO_SAVE_SLOT);
  if(!saveData)return false;
  try{
    localStorage.setItem(ENDING_RETRY_CHECKPOINT_KEY,JSON.stringify({
      version:ENDING_RETRY_CHECKPOINT_VERSION,
      savedAt:Date.now(),
      action:normalizedAction,
      saveData
    }));
  }catch(error){
    console.warn("엔딩 재시도 체크포인트를 저장하지 못했습니다.",error);
    return false;
  }
  return clearSaveData(AUTO_SAVE_SLOT);
}

function titleJournalGuestDefs(){
  return typeof TITLE_JOURNAL_GUEST_DEFS!=="undefined"&&Array.isArray(TITLE_JOURNAL_GUEST_DEFS)
    ?TITLE_JOURNAL_GUEST_DEFS
    :[];
}

function titleJournalEndingDefs(){
  return typeof TITLE_JOURNAL_ENDING_DEFS!=="undefined"&&Array.isArray(TITLE_JOURNAL_ENDING_DEFS)
    ?TITLE_JOURNAL_ENDING_DEFS
    :[];
}

function journalDefinitionId(definition){
  return String(definition?.id||definition?.guestId||"").trim();
}

function journalDefinitionLabel(definition,id=journalDefinitionId(definition)){
  return definition?.displayName||definition?.label||definition?.name||definition?.title||id;
}

function fixedJournalCollection(definitions,stored={}){
  return Object.fromEntries(definitions.map(definition=>{
    const id=journalDefinitionId(definition);
    const saved=stored[id]&&typeof stored[id]==="object"?stored[id]:{};
    return [id,{
      ...definition,
      ...saved,
      id,
      label:journalDefinitionLabel(definition,id),
      unlocked:!!saved.unlocked,
      notificationPending:!!saved.notificationPending
    }];
  }).filter(([id])=>!!id));
}

function createJournalData(){
  return {
    version:JOURNAL_VERSION,
    updatedAt:0,
    trueEndingEpilogueUnlocked:false,
    guests:fixedJournalCollection(titleJournalGuestDefs()),
    fragments:{},
    endings:fixedJournalCollection(titleJournalEndingDefs())
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
  base.trueEndingEpilogueUnlocked=!!raw.trueEndingEpilogueUnlocked;
  base.guests=fixedJournalCollection(titleJournalGuestDefs(),normalizeJournalCollection(raw.guests));
  base.fragments=normalizeJournalCollection(raw.fragments);
  base.endings=fixedJournalCollection(titleJournalEndingDefs(),normalizeJournalCollection(raw.endings));
  return base;
}

function readJournalData(){
  try{
    const raw=localStorage.getItem(JOURNAL_KEY);
    if(!raw)return createJournalData();
    const parsed=JSON.parse(raw);
    if(parsed?.version!==JOURNAL_VERSION){
      localStorage.removeItem(JOURNAL_KEY);
      return createJournalData();
    }
    return normalizeJournalData(parsed);
  }catch(error){
    console.warn("영업일지를 읽지 못했습니다.",error);
    try{localStorage.removeItem(JOURNAL_KEY);}catch(_storageError){}
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

function journalUnlockRequested(details){
  return details?.perfect===true
    ||details?.tier==="great"
    ||details?.resultTier==="great";
}

function unlockFixedJournalEntry(collection,id,details={}){
  const definitions=collection==="guests"?titleJournalGuestDefs():titleJournalEndingDefs();
  const definition=definitions.find(item=>journalDefinitionId(item)===id);
  if(!definition)return null;
  const journal=readJournalData();
  const previous=journal[collection][id];
  const newlyUnlocked=!previous?.unlocked;
  const now=Date.now();
  journal[collection][id]={
    ...previous,
    ...(details&&typeof details==="object"?details:{}),
    ...definition,
    id,
    label:journalDefinitionLabel(definition,id),
    unlocked:true,
    firstRecordedAt:previous?.firstRecordedAt||now,
    lastRecordedAt:now,
    unlockedAt:previous?.unlockedAt||now,
    notificationPending:newlyUnlocked?true:!!previous?.notificationPending
  };
  const saved=writeJournalData(journal)?.[collection]?.[id];
  return saved?{...saved,newlyUnlocked}:null;
}

function recordJournalGuest(id,details={}){
  const definition=titleJournalGuestDefs().find(item=>journalDefinitionId(item)===id);
  if(!definition)return null;
  if(journalUnlockRequested(details))return unlockFixedJournalEntry("guests",id,details);
  const journal=readJournalData();
  const previous=journal.guests[id];
  const now=Date.now();
  journal.guests[id]={
    ...previous,
    ...(details&&typeof details==="object"?details:{}),
    ...definition,
    id,
    label:journalDefinitionLabel(definition,id),
    unlocked:!!previous?.unlocked,
    notificationPending:!!previous?.notificationPending,
    firstRecordedAt:previous?.firstRecordedAt||now,
    lastRecordedAt:now
  };
  const saved=writeJournalData(journal)?.guests?.[id];
  return saved?{...saved,newlyUnlocked:false}:null;
}

function recordJournalFragment(id,details={}){
  const fragment=recordJournalEntry("fragments",id,details);
  const guestId=typeof details?.guestId==="string"?details.guestId:null;
  const guest=guestId?unlockFixedJournalEntry("guests",guestId,{
    day:details.day,
    note:"기억 회복",
    fragmentId:id,
    perfect:true
  }):null;
  return fragment?{...fragment,newGuestUnlock:guest?.newlyUnlocked?guestId:null}:null;
}

function recordJournalEnding(id,details={}){
  const normalizedId=JOURNAL_ENDING_ALIASES[id]||id;
  return unlockFixedJournalEntry("endings",normalizedId,details);
}

function unlockTrueEndingEpilogues(){
  const journal=readJournalData();
  if(journal.trueEndingEpilogueUnlocked)return journal;
  journal.trueEndingEpilogueUnlocked=true;
  Object.entries(journal.guests).forEach(([id,entry])=>{
    if(entry?.unlocked)journal.guests[id]={...entry,epilogueUnlocked:true};
  });
  return writeJournalData(journal);
}

function readJournalCollectionPages(){
  const journal=readJournalData();
  const build=(kind,definitions,collection)=>definitions.map(definition=>{
    const id=journalDefinitionId(definition);
    const entry=collection[id]||{};
    return {
      ...definition,
      ...entry,
      kind,
      id,
      label:journalDefinitionLabel(definition,id),
      unlocked:!!entry.unlocked,
      epilogueUnlocked:kind==="guest"
        &&!!entry.unlocked
        &&!!(entry.epilogueUnlocked||journal.trueEndingEpilogueUnlocked),
      notificationPending:!!entry.notificationPending
    };
  });
  return [
    ...build("guest",titleJournalGuestDefs(),journal.guests),
    ...build("ending",titleJournalEndingDefs(),journal.endings)
  ];
}

function pendingJournalUnlocks(){
  return readJournalCollectionPages().filter(page=>page.unlocked&&page.notificationPending);
}

function acknowledgeJournalUnlock(kind,id){
  const collection=kind==="guest"?"guests":kind==="ending"?"endings":null;
  if(!collection)return false;
  const journal=readJournalData();
  const entry=journal[collection]?.[id];
  if(!entry?.unlocked||!entry.notificationPending)return false;
  journal[collection][id]={...entry,notificationPending:false,notificationSeenAt:Date.now()};
  return !!writeJournalData(journal);
}

// 스토리 쪽에서 전역 변수 결합 없이 호출할 수 있는 안정적인 연결점입니다.
window.MoonlightTableSave=Object.freeze({
  readJournal:readJournalData,
  recordGuest:recordJournalGuest,
  recordFragment:recordJournalFragment,
  recordEnding:recordJournalEnding,
  collectionPages:readJournalCollectionPages,
  pendingUnlocks:pendingJournalUnlocks,
  acknowledgeUnlock:acknowledgeJournalUnlock,
  unlockTrueEndingEpilogues,
  clearAutoSaveForTrueEnding,
  saveEndingRetryCheckpoint,
  readEndingRetryCheckpoint,
  clearEndingRetryCheckpoint
});

function restoreGameState(data){
  if(typeof clearStoryRuntime==="function")clearStoryRuntime();
  const saved=data.state;
  const savedAudio=normalizeAudioSettings({...state.audio,...(saved.audio||{})});
  // 음향은 진행 슬롯과 무관한 사용자 설정입니다. 전역 설정이 아직 없는
  // 구 버전에서는 불러온 슬롯의 값을 한 번 가져와 전역 설정으로 승격합니다.
  const restoredAudio=readStoredAudioSettings()||writeAudioSettings(savedAudio);
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

  state.audio=restoredAudio;
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
