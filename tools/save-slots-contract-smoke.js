"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const sources=["game-data.js","story-data.js","story-cinematic.js","story.js","save.js"]
  .map(file=>fs.readFileSync(path.join(root,file),"utf8"));

const bootstrap=`
const elementStore=new Map();
function makeClassList(){
  const values=new Set();
  return {
    add(...names){names.forEach(name=>values.add(name));},
    remove(...names){names.forEach(name=>values.delete(name));},
    contains(name){return values.has(name);},
    toggle(name,force){
      const enabled=force===undefined?!values.has(name):!!force;
      if(enabled)values.add(name);else values.delete(name);
      return enabled;
    }
  };
}
function makeElement(tagName="div"){
  return {
    tagName:String(tagName).toUpperCase(),
    textContent:"",
    innerHTML:"",
    children:[],
    dataset:{},
    className:"",
    classList:makeClassList(),
    style:{display:"",setProperty(){}},
    addEventListener(){},
    appendChild(child){this.children.push(child);return child;}
  };
}
const document={
  visibilityState:"visible",
  addEventListener(){},
  createElement:makeElement,
  getElementById(id){
    if(!elementStore.has(id))elementStore.set(id,makeElement());
    return elementStore.get(id);
  }
};
const window={
  QA_MODE:null,
  addEventListener(){},
  matchMedia(){return {matches:true};}
};
const storageData=new Map();
const localStorage={
  getItem(key){return storageData.has(key)?storageData.get(key):null;},
  setItem(key,value){storageData.set(key,String(value));},
  removeItem(key){storageData.delete(key);},
  clear(){storageData.clear();}
};
const PLAYER_START={x:620,y:448,facing:"down",speed:306};
var state=null;
var nextOrderId=1;
var audio=null;
var toastMessages=[];
function showToast(message){toastMessages.push(message);}
function updateUI(){}
function normalizeDayPrepState(){}
function clampChefToWalkArea(){}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function startMini(){}
function buildMenuCards(){}
function openGameScreen(){}
function syncPhaserObjects(){}
function spawnOrder(){return false;}
function prepareStoryNight(){}
function requestAnimationFrame(callback){callback();return 1;}
`;

const runtimeSetup=`
const DISHES=MENU_DATA.map(menu=>({
  ...menu,
  name:menu.displayName,
  prepTasks:[...menu.requiredPrepTasks],
  prep:[...(menu.prep||[])],
  cook:[...(menu.cook||[])]
}));
function dishById(id){return DISHES.find(dish=>dish.id===id)||null;}
`;

const tests=`
const assert=(condition,message)=>{
  if(!condition)throw new Error(message);
};
const same=(actual,expected,message)=>{
  assert(JSON.stringify(actual)===JSON.stringify(expected),
    message+"\\nactual: "+JSON.stringify(actual)+"\\nexpected: "+JSON.stringify(expected));
};
const rawSlot=slotId=>localStorage.getItem(saveKeyForSlot(slotId));
const parsedSlot=slotId=>JSON.parse(rawSlot(slotId));
const allSlotRaw=()=>Object.fromEntries(
  SAVE_SLOT_DEFS.map(slot=>[slot.id,rawSlot(slot.id)])
);
const inventory=()=>Object.fromEntries(DISHES.map(dish=>[
  dish.id,{count:0,quality:0}
]));

function freshState(day=1,phase=GAME_PHASES.PREP){
  if(state)clearStoryRuntime();
  else storySession=null;
  state={
    screen:"game",
    phase,
    paused:false,
    settingsFrom:"game",
    day,
    phaseTime:phase===GAME_PHASES.PREP?null:120,
    money:0,
    popularity:0,
    popularityBeforeResult:0,
    popularityDelta:0,
    dailyRevenue:0,
    wasteLoss:0,
    leftoverCount:0,
    discardedCount:0,
    discardLoss:0,
    nightCustomerTarget:0,
    spawnedCustomers:0,
    generalSpawnedCustomers:0,
    served:0,
    generalServed:0,
    satisfactionTotal:0,
    fiveStar:0,
    audio:{enabled:true,bgmEnabled:true,sfxEnabled:true,master:0.8,bgm:0.7,sfx:0.9},
    selectedMenus:["oden"],
    menuSelectionDraft:["oden"],
    prepProgress:{},
    kimchiPrep:{},
    selectedOrderId:null,
    inventory:inventory(),
    orders:[],
    respawns:[],
    departures:[],
    particles:[],
    popups:[],
    mini:null,
    joyX:0,
    joyY:0,
    player:{...PLAYER_START,moving:false},
    story:createStoryState()
  };
  nextOrderId=1;
  autosaveElapsed=0;
}

function applySlotMarker(marker,index){
  const guestId=STORY_GUEST_IDS[0];
  state.day=index+1;
  state.money=1000+index;
  state.story=createStoryState();
  state.story.choices["choice-"+marker]=index;
  state.story.flags["flag-"+marker]=true;
  state.story.guestState[guestId].affinity=10+index;
  state.story.guestState[guestId].previousLoopTier=index%2?"great":"warm";
  state.story.guestState[guestId].previousLoopScore=60+index;
  state.story.guestState[guestId].previouslyObtainedPartial=index%2===0;
  state.story.guestState[guestId].previouslyObtainedFull=index%2===1;
  state.story.guestResults[guestId]={
    ...createStoryGuestResult(),visited:true,
    evaluationTier:index%2?"great":"soft",evaluationScore:70+index,
    fragmentState:index%2?"full":"none",
    fragmentName:index%2?"첫 빗방울":null,
    seenStoryScenes:["SCN-G1-A"]
  };
  state.story.completed["scene-"+marker]=true;
  state.story.storyCookResults["result-"+marker]={
    score:70+index,tier:index%2?"great":"soft",day:index+1,dishId:"kimchi"
  };
  nextOrderId=100+index;
}

// 시나리오 전면 개편 배포에서는 과거 자동·수동 네 칸을 한 번만 비웁니다.
const legacyBases=[...LEGACY_SAVE_KEYS,SAVE_KEY];
legacyBases.forEach(base=>{
  localStorage.setItem(base,"legacy-auto");
  MANUAL_SAVE_SLOTS.forEach(slotId=>localStorage.setItem(base+"."+slotId,"legacy-manual"));
});
localStorage.setItem(SAVE_SCHEMA_KEY,String(SAVE_VERSION-1));
const audioSettingsBeforeMigration=JSON.stringify({enabled:false,master:.61,bgm:.42,sfx:.83});
localStorage.setItem(AUDIO_SETTINGS_KEY,audioSettingsBeforeMigration);
localStorage.setItem(JOURNAL_KEY,JSON.stringify({
  version:JOURNAL_VERSION,updatedAt:1,
  guests:{rainyChild:{id:"rainyChild",label:"비에 젖은 아이",unlocked:true}},
  fragments:{},endings:{}
}));
initializeSaveSystem();
legacyBases.forEach(base=>{
  assert(localStorage.getItem(base)===null,"구 저장의 자동 저장 키를 초기화해야 합니다.");
  MANUAL_SAVE_SLOTS.forEach(slotId=>assert(localStorage.getItem(base+"."+slotId)===null,
    "구 저장의 "+slotId+" 키를 초기화해야 합니다."));
});
assert(localStorage.getItem(SAVE_SCHEMA_KEY)===String(SAVE_VERSION),
  "저장 초기화 완료 버전을 기록해야 합니다.");
assert(localStorage.getItem(AUDIO_SETTINGS_KEY)===audioSettingsBeforeMigration,
  "진행 저장 마이그레이션이 전역 음향 설정을 삭제하면 안 됩니다.");
localStorage.removeItem(AUDIO_SETTINGS_KEY);
assert(readJournalData().guests.rainyChild?.label==="비에 젖은 아이"
  &&readJournalData().guests.rainyChild?.unlocked,
  "저장 슬롯 초기화가 영업일지 메타 기록을 삭제하면 안 됩니다.");
localStorage.setItem(saveKeyForSlot("auto"),"new-version-data");
assert(migrateSaveStorage()===false&&rawSlot("auto")==="new-version-data",
  "완료된 저장 마이그레이션을 다시 실행해 새 저장을 지우면 안 됩니다.");
localStorage.removeItem(saveKeyForSlot("auto"));

same(
  SAVE_SLOT_DEFS.map(slot=>({id:slot.id,label:slot.label,manual:slot.manual})),
  [
    {id:"auto",label:"자동 저장",manual:false},
    {id:"manual1",label:"수동 저장 1",manual:true},
    {id:"manual2",label:"수동 저장 2",manual:true},
    {id:"manual3",label:"수동 저장 3",manual:true}
  ],
  "저장 슬롯은 자동 저장 뒤에 수동 저장 1~3 순서여야 합니다."
);
assert(new Set(SAVE_SLOT_DEFS.map(slot=>saveKeyForSlot(slot.id))).size===4,
  "네 저장 슬롯은 서로 독립적인 localStorage 키를 사용해야 합니다.");

freshState();
const slotMarkers=[
  ["auto","AUTO",0],
  ["manual1","M1",1],
  ["manual2","M2",2],
  ["manual3","M3",3]
];
slotMarkers.forEach(([slotId,marker,index])=>{
  applySlotMarker(marker,index);
  const saved=slotId==="auto"?saveGame(true):saveManualGame(slotId);
  assert(saved,slotId+" 슬롯 저장에 성공해야 합니다.");
});

slotMarkers.forEach(([slotId,marker,index])=>{
  const saved=readSaveData(slotId);
  const guestId=STORY_GUEST_IDS[0];
  assert(saved&&saved.nextOrderId===100+index,slotId+"의 nextOrderId가 독립적으로 저장되어야 합니다.");
  same(saved.state.story.choices,{["choice-"+marker]:index},slotId+" 선택지 격리");
  same(saved.state.story.flags,{["flag-"+marker]:true},slotId+" 플래그 격리");
  assert(saved.state.story.guestState[guestId].affinity===10+index,slotId+" 손님 상태 격리");
  assert(saved.state.story.guestState[guestId].previousLoopScore===60+index
    &&saved.state.story.guestState[guestId].previouslyObtainedPartial===(index%2===0)
    &&saved.state.story.guestState[guestId].previouslyObtainedFull===(index%2===1),
    slotId+" 과거 회차 손님 기록 격리");
  assert(saved.state.story.guestResults[guestId].visited
    &&saved.state.story.guestResults[guestId].evaluationScore===70+index
    &&saved.state.story.guestResults[guestId].fragmentState===(index%2?"full":"none")
    &&saved.state.story.guestResults[guestId].seenStoryScenes[0]==="SCN-G1-A",
    slotId+" 현재 회차 평가·조각 결과 격리");
  same(saved.state.story.completed,{["scene-"+marker]:true},slotId+" 완료 장면 격리");
  assert(saved.state.story.storyCookResults["result-"+marker].score===70+index,slotId+" 조리 결과 격리");
});
same(readAllSaveSlots().map(slot=>slot.id),["auto","manual1","manual2","manual3"],
  "전체 슬롯 조회도 표시 순서를 보존해야 합니다.");
assert(hasAnySaveData(),"한 슬롯이라도 있으면 이어하기 저장이 존재해야 합니다.");

assert(recordJournalGuest("crowCourier",{day:4,tier:"great"})?.label==="까마귀 우편배달부",
  "스토리에서 특별 손님을 영업일지에 기록할 수 있어야 합니다.");
assert(recordJournalFragment("fragment-04",{label:"네 번째 달빛 조각",day:4})?.day===4,
  "스토리에서 받은 달빛 조각을 영업일지에 기록할 수 있어야 합니다.");
assert(recordJournalEnding("morning_together")?.label==="함께 오는 아침",
  "스토리에서 확인한 엔딩을 영업일지에 기록할 수 있어야 합니다.");
const journalSnapshot=readJournalData();
assert(journalSnapshot.guests.crowCourier?.unlocked&&journalSnapshot.fragments["fragment-04"]
  &&journalSnapshot.endings.morning_together?.unlocked,
  "손님·조각·엔딩 기록은 같은 영업일지에 누적되어야 합니다.");
assert(window.MoonlightTableSave.readJournal===readJournalData
  &&window.MoonlightTableSave.recordGuest===recordJournalGuest
  &&window.MoonlightTableSave.recordFragment===recordJournalFragment
  &&window.MoonlightTableSave.recordEnding===recordJournalEnding,
  "story.js가 사용할 영업일지 helper API를 공개해야 합니다.");

// 타이틀 영업일지는 진행 세이브와 별개인 영구 컬렉션입니다. raw 저장은
// 해금 항목만 가져도 되지만 collectionPages()는 잠긴 페이지까지 합쳐
// 언제나 손님 8장 + 엔딩 5장을 같은 순서로 반환해야 합니다.
const expectedTitleGuestIds=[
  "rainyChild","lanternGuest","twinShadows","crowCourier",
  "starBeast","seawaterGuest","schoolDoll","facelessDaeun"
];
const expectedTitleEndingIds=[
  "loop_return","alone_morning","guests_dawn","open_forever","morning_together"
];
same(TITLE_JOURNAL_GUEST_DEFS.map(page=>page.guestId||page.id),expectedTitleGuestIds,
  "타이틀 손님 페이지는 여덟 장 고정이어야 합니다.");
same(TITLE_JOURNAL_ENDING_DEFS.map(page=>page.id),expectedTitleEndingIds,
  "타이틀 엔딩 페이지는 회귀 기록을 포함해 다섯 장 고정이어야 합니다.");
const fixedJournalData=readJournalData();
same(Object.keys(fixedJournalData.guests),expectedTitleGuestIds,
  "영구 localStorage 손님 컬렉션은 잠금 페이지까지 여덟 키를 유지해야 합니다.");
same(Object.keys(fixedJournalData.endings),expectedTitleEndingIds,
  "영구 localStorage 엔딩 컬렉션은 잠금 페이지까지 다섯 키를 유지해야 합니다.");
assert(typeof window.MoonlightTableSave.collectionPages==="function"
  &&typeof window.MoonlightTableSave.pendingUnlocks==="function"
  &&typeof window.MoonlightTableSave.acknowledgeUnlock==="function"
  &&typeof window.MoonlightTableSave.unlockTrueEndingEpilogues==="function",
  "타이틀 고정 페이지와 최초 해금 알림 API를 공개해야 합니다.");
const fixedPages=window.MoonlightTableSave.collectionPages();
const fixedGuests=Array.isArray(fixedPages)
  ?fixedPages.filter(page=>page.kind==="guest")
  :fixedPages.guests;
const fixedEndings=Array.isArray(fixedPages)
  ?fixedPages.filter(page=>page.kind==="ending")
  :fixedPages.endings;
assert(Array.isArray(fixedGuests)&&Array.isArray(fixedEndings),
  "collectionPages()는 손님과 엔딩 페이지를 구분해 반환해야 합니다.");
same(fixedGuests.map(page=>page.id),expectedTitleGuestIds,
  "잠금 항목을 포함한 타이틀 손님 페이지 순서");
same(fixedEndings.map(page=>page.id),expectedTitleEndingIds,
  "잠금 항목을 포함한 타이틀 엔딩 페이지 순서");
assert(fixedGuests.length+fixedEndings.length===13,
  "타이틀 영업일지는 잠긴 페이지까지 항상 13장이어야 합니다.");

const warmGuest=recordJournalGuest("lanternGuest",{
  label:"등불 손님",tier:"warm",note:"기억의 일부"
});
assert(warmGuest&&warmGuest.unlocked===false,
  "타이틀 손님 페이지는 맛있다 이하 평가로 해금되면 안 됩니다.");
const perfectGuest=recordJournalGuest("lanternGuest",{
  label:"등불 손님",tier:"great",note:"기억 회복"
});
assert(perfectGuest?.unlocked===true&&perfectGuest?.newlyUnlocked===true,
  "타이틀 손님 페이지는 최초 완벽 평가에서만 새로 해금되어야 합니다.");
const repeatedPerfectGuest=recordJournalGuest("lanternGuest",{
  label:"등불 손님",tier:"great",note:"기억 회복"
});
assert(repeatedPerfectGuest?.unlocked===true&&!repeatedPerfectGuest?.newlyUnlocked,
  "이미 해금한 손님 페이지를 다시 신규 해금으로 알리면 안 됩니다.");

const firstLoopEnding=recordJournalEnding("SCN-J01",{label:"되돌아간 첫째 날"});
const repeatedLoopEnding=recordJournalEnding("SCN-J01",{label:"되돌아간 첫째 날"});
assert(firstLoopEnding?.id==="loop_return"&&firstLoopEnding.unlocked
  &&firstLoopEnding.newlyUnlocked===true,
  "첫 자동 회귀는 loop_return 엔딩 페이지를 새로 해금해야 합니다.");
assert(repeatedLoopEnding?.id==="loop_return"&&repeatedLoopEnding.unlocked
  &&!repeatedLoopEnding.newlyUnlocked,
  "같은 회귀 엔딩은 중복 페이지나 두 번째 신규 알림을 만들면 안 됩니다.");
const pendingTitleUnlocks=window.MoonlightTableSave.pendingUnlocks();
assert(pendingTitleUnlocks.some(item=>item.kind==="guest"&&item.id==="lanternGuest")
  &&pendingTitleUnlocks.some(item=>item.kind==="ending"&&item.id==="loop_return"),
  "최초 손님·엔딩 해금은 타이틀 알림 대기열에 한 번씩 남아야 합니다.");
assert(window.MoonlightTableSave.acknowledgeUnlock("guest","lanternGuest")
  &&window.MoonlightTableSave.acknowledgeUnlock("ending","loop_return"),
  "타이틀에서 확인한 최초 해금 알림을 소비할 수 있어야 합니다.");
assert(!window.MoonlightTableSave.pendingUnlocks().some(item=>
  (item.kind==="guest"&&item.id==="lanternGuest")
  ||(item.kind==="ending"&&item.id==="loop_return")
),"확인한 최초 해금 알림을 다시 표시하면 안 됩니다.");

const guestsBeforeTrueEnding=window.MoonlightTableSave.collectionPages()
  .filter(page=>page.kind==="guest"&&page.unlocked);
assert(guestsBeforeTrueEnding.length>0
  &&guestsBeforeTrueEnding.every(page=>page.epilogueUnlocked===false),
  "진엔딩 전에는 해금한 손님도 후일담 본문이 잠겨 있어야 합니다.");
assert(window.MoonlightTableSave.unlockTrueEndingEpilogues(),
  "진엔딩 완료 시 영구 손님 후일담 해금 기록을 저장해야 합니다.");
const guestsAfterTrueEnding=window.MoonlightTableSave.collectionPages()
  .filter(page=>page.kind==="guest");
assert(guestsAfterTrueEnding.filter(page=>page.unlocked)
  .every(page=>page.epilogueUnlocked===true),
  "진엔딩 뒤에는 이미 해금한 모든 손님의 후일담을 공개해야 합니다.");
assert(guestsAfterTrueEnding.filter(page=>!page.unlocked)
  .every(page=>page.epilogueUnlocked===false),
  "진엔딩을 보아도 만나지 않은 손님 페이지 자체가 열리면 안 됩니다.");

const manualBeforeAuto=MANUAL_SAVE_SLOTS.map(rawSlot);
const autoBefore=rawSlot("auto");
applySlotMarker("AUTO-ONLY",4);
assert(saveGame(true),"saveGame(true)는 저장 가능 상태에서 성공해야 합니다.");
assert(rawSlot("auto")!==autoBefore,"saveGame(true)는 자동 저장 슬롯을 갱신해야 합니다.");
same(MANUAL_SAVE_SLOTS.map(rawSlot),manualBeforeAuto,
  "saveGame(true)는 수동 저장 슬롯을 건드리면 안 됩니다.");

const autoBeforeManual=rawSlot("auto");
autosaveElapsed=3.25;
applySlotMarker("MANUAL-ONLY",5);
assert(saveManualGame("manual1"),"수동 저장은 성공해야 합니다.");
assert(rawSlot("auto")===autoBeforeManual,"수동 저장은 자동 저장 문자열을 바꾸면 안 됩니다.");
assert(autosaveElapsed===3.25,"수동 저장은 자동 저장 타이머를 초기화하면 안 됩니다.");

const validAutoRaw=rawSlot("auto");
const validManual1Raw=rawSlot("manual1");
localStorage.setItem(saveKeyForSlot("manual2"),"{broken");
const oldManual3=parsedSlot("manual3");
oldManual3.version=SAVE_VERSION-1;
localStorage.setItem(saveKeyForSlot("manual3"),JSON.stringify(oldManual3));
assert(readSaveData("manual2")===null&&rawSlot("manual2")===null,
  "손상된 슬롯은 해당 슬롯만 삭제해야 합니다.");
assert(readSaveData("manual3")===null&&rawSlot("manual3")===null,
  "구버전 슬롯은 해당 슬롯만 삭제해야 합니다.");
assert(rawSlot("auto")===validAutoRaw&&rawSlot("manual1")===validManual1Raw,
  "한 슬롯의 손상 또는 구버전 삭제가 다른 슬롯에 전파되면 안 됩니다.");

applySlotMarker("M2-RESTORED",2);
assert(saveManualGame("manual2"),"manual2 재작성");
applySlotMarker("M3-RESTORED",3);
assert(saveManualGame("manual3"),"manual3 재작성");

const slotsBeforeQaDelete=allSlotRaw();
window.QA_MODE={enabled:true};
assert(clearSaveData("manual2")===false,
  "QA 모드에서는 기존 저장 슬롯 삭제를 거부해야 합니다.");
same(allSlotRaw(),slotsBeforeQaDelete,
  "QA 모드의 삭제 요청은 어떤 저장 슬롯도 바꾸면 안 됩니다.");
window.QA_MODE=null;

MANUAL_SAVE_SLOTS.forEach(slotId=>{
  const snapshot=allSlotRaw();
  autosaveElapsed=3.25;
  assert(clearSaveData(slotId),slotId+" 삭제는 성공을 반환해야 합니다.");
  assert(rawSlot(slotId)===null,slotId+" 저장 데이터만 삭제되어야 합니다.");
  SAVE_SLOT_DEFS.filter(slot=>slot.id!==slotId).forEach(slot=>{
    assert(rawSlot(slot.id)===snapshot[slot.id],
      slotId+" 삭제가 "+slot.id+" 슬롯에 영향을 주면 안 됩니다.");
  });
  assert(autosaveElapsed===3.25,
    "수동 저장 삭제는 자동 저장 타이머를 초기화하면 안 됩니다.");
  localStorage.setItem(saveKeyForSlot(slotId),snapshot[slotId]);
});

const manualsBeforeClear=MANUAL_SAVE_SLOTS.map(rawSlot);
autosaveElapsed=4.5;
assert(clearAutoSaveForTrueEnding(),"진엔딩 자동 저장 삭제는 성공을 반환해야 합니다.");
assert(rawSlot("auto")===null,"자동 저장 삭제는 자동 저장만 지워야 합니다.");
same(MANUAL_SAVE_SLOTS.map(rawSlot),manualsBeforeClear,
  "자동 저장 삭제 뒤에도 수동 저장 3개는 유지되어야 합니다.");
assert(autosaveElapsed===0,
  "자동 저장 삭제는 자동 저장 타이머를 초기화해야 합니다.");

const manualsBeforeTimer=MANUAL_SAVE_SLOTS.map(rawSlot);
applySlotMarker("FIVE-SECONDS",4);
autosaveElapsed=4.9;
updateAutosave(0.2);
assert(rawSlot("auto")!==null,"5초 자동 저장 타이머는 자동 저장 슬롯을 만들어야 합니다.");
same(MANUAL_SAVE_SLOTS.map(rawSlot),manualsBeforeTimer,
  "5초 자동 저장은 수동 저장 슬롯을 바꾸면 안 됩니다.");
assert(autosaveElapsed===0,"5초 자동 저장이 끝나면 자동 저장 타이머가 초기화되어야 합니다.");

freshState(7,GAME_PHASES.RESULT);
applySlotMarker("ENDING-MANUAL",7);
state.story.choices["SCN-J02"]=0;
assert(saveManualGame("manual1"),"엔딩 직전 수동 저장을 준비할 수 있어야 합니다.");
const manualsBeforeEndingCheckpoint=MANUAL_SAVE_SLOTS.map(rawSlot);
const endingRetryAction={
  type:"endingRetryMenu",
  judgementSceneId:"SCN-J02",
  endingSceneId:"END-01",
  endingTitle:"혼자 맞은 아침"
};
assert(saveEndingRetryCheckpoint(endingRetryAction),
  "일반 엔딩은 숨은 재시도 체크포인트를 저장해야 합니다.");
assert(rawSlot("auto")===null,
  "엔딩 재시도 체크포인트를 남긴 뒤 자동 저장 슬롯은 비워야 합니다.");
same(MANUAL_SAVE_SLOTS.map(rawSlot),manualsBeforeEndingCheckpoint,
  "엔딩 재시도 체크포인트가 수동 저장 3칸을 바꾸면 안 됩니다.");
const endingCheckpoint=readEndingRetryCheckpoint();
assert(endingCheckpoint?.action?.endingSceneId==="END-01"
  &&endingCheckpoint?.saveData?.state?.story?.choices?.["SCN-J02"]===0,
  "숨은 체크포인트는 엔딩 동작과 마지막 선택 상태를 함께 보존해야 합니다.");
assert(readAllSaveSlots().length===4
  &&!readAllSaveSlots().some(slot=>slot.id===ENDING_RETRY_CHECKPOINT_KEY),
  "숨은 엔딩 체크포인트는 이어하기 네 슬롯에 노출되면 안 됩니다.");

state.story.choices["SCN-J02"]=1;
assert(saveEndingRetryCheckpoint({...endingRetryAction,endingSceneId:"END-02",endingTitle:"손님들의 새벽"}),
  "다른 일반 엔딩은 기존 숨은 체크포인트를 안전하게 교체해야 합니다.");
const replacedEndingCheckpoint=readEndingRetryCheckpoint();
assert(replacedEndingCheckpoint?.action?.endingSceneId==="END-02"
  &&replacedEndingCheckpoint?.saveData?.state?.story?.choices?.["SCN-J02"]===1,
  "중복 페이지를 만들지 않고 가장 최근 엔딩 체크포인트 하나만 유지해야 합니다.");
assert(clearEndingRetryCheckpoint()&&readEndingRetryCheckpoint()===null,
  "엔딩 선택을 마치면 숨은 체크포인트를 삭제할 수 있어야 합니다.");

localStorage.setItem(ENDING_RETRY_CHECKPOINT_KEY,"{broken-json");
assert(readEndingRetryCheckpoint()===null
  &&localStorage.getItem(ENDING_RETRY_CHECKPOINT_KEY)===null,
  "손상된 엔딩 체크포인트는 예외 없이 무시하고 정리해야 합니다.");

const autoBeforeRejectedSave=rawSlot("auto");
state.mini={kind:"test"};
assert(!saveGame(true)&&!saveManualGame("manual1"),"미니게임 중에는 자동/수동 저장을 거부해야 합니다.");
assert(rawSlot("auto")===autoBeforeRejectedSave,"거부된 미니게임 저장은 기존 자동 저장을 덮어쓰면 안 됩니다.");
state.mini=null;
state.story.activeStoryCook={sceneId:"SCN-P01",dishId:"tofu"};
assert(!saveGame(true)&&!saveManualGame("manual1"),"직접 스토리 조리 중에는 자동/수동 저장을 거부해야 합니다.");
assert(rawSlot("auto")===autoBeforeRejectedSave,"거부된 직접 조리 저장은 기존 자동 저장을 덮어쓰면 안 됩니다.");
state.story.activeStoryCook=null;

let restoreCheckpointCalls=0;
const actualRestoreStoryCheckpoint=restoreStoryCheckpoint;
restoreStoryCheckpoint=function(checkpoint){
  restoreCheckpointCalls++;
  return actualRestoreStoryCheckpoint(checkpoint);
};

const choiceScene=Object.values(STORY_SCENES).find(scene=>
  scene.lines.some(line=>Array.isArray(line.choices)&&line.choices.length>=2)
);
assert(!!choiceScene,"분기 저장을 검증할 선택지 장면이 있어야 합니다.");
freshState(choiceScene.day||7,GAME_PHASES.OPEN);
delete state.generalServed;
delete state.generalSpawnedCustomers;
state.story.loop=Math.max(1,Number(choiceScene.minLoop)||1);
STORY_GUEST_IDS.slice(0,Number(choiceScene.shardRange?.[0])||0)
  .forEach(id=>{state.story.guestResults[id].fragmentState="full";});
(choiceScene.requiredFlags||[]).forEach(flag=>{state.story.flags[flag]=true;});
assert(playStoryScenes([choiceScene.id]),choiceScene.id+" 대화를 시작할 수 있어야 합니다.");
const choiceLineIndex=storySession.lines.findIndex(line=>Array.isArray(line.choices)&&line.choices.length>=2);
assert(choiceLineIndex>=0,"분기 장면에서 선택지를 찾아야 합니다.");
storySession.lineIndex=choiceLineIndex;
showStoryLine();
const choiceBaseLineCount=storySession.lines.length;
assert(saveManualGame("manual1"),"선택 전 대화 체크포인트를 수동 저장할 수 있어야 합니다.");
const beforeChoiceSave=readSaveData("manual1");
assert(beforeChoiceSave.storyCheckpoint.lineIndex===choiceLineIndex,
  "선택 전 체크포인트는 선택지 줄에서 재개해야 합니다.");
assert(beforeChoiceSave.state.story.choices[choiceScene.id]===undefined,
  "선택 전 저장에 미래 선택이 들어가면 안 됩니다.");

// 실제 선택 처리 방식이 엔딩 전환으로 바뀌어도, 세이브 계약은 선택 인덱스와
// 그 순간의 대화 체크포인트를 그대로 보존해야 합니다.
state.story.choices[choiceScene.id]=0;
storySession.lineIndex=choiceLineIndex;
assert(saveManualGame("manual2"),"선택 후 수정된 대화 체크포인트를 수동 저장할 수 있어야 합니다.");
const afterChoiceSave=readSaveData("manual2");
assert(afterChoiceSave.state.story.choices[choiceScene.id]===0,
  "선택 후 체크포인트에 고른 분기가 포함되어야 합니다.");

state.story.choices[choiceScene.id]=1;
restoreGameState(afterChoiceSave);
assert(state.story.choices[choiceScene.id]===0,
  "선택 후 저장 복원은 선택한 분기를 정확히 되돌려야 합니다.");
assert(state.generalServed===0,"구 저장에 없는 일반 손님 제공 수는 0으로 정규화해야 합니다.");
assert(state.generalSpawnedCustomers===0,"구 저장에 없는 일반 손님 생성 수는 0으로 정규화해야 합니다.");
assert(storySession.lines.length===choiceBaseLineCount&&storySession.lineIndex===choiceLineIndex,
  "선택 후 복원은 저장 당시 대사 배열과 위치를 되돌려야 합니다.");
restoreGameState(afterChoiceSave);
assert(state.story.choices[choiceScene.id]===0&&storySession.lines.length===choiceBaseLineCount,
  "같은 체크포인트를 반복 복원해도 선택과 대사가 중복되면 안 됩니다.");

restoreGameState(beforeChoiceSave);
assert(state.story.choices[choiceScene.id]===undefined,
  "선택 전 저장을 불러오면 다른 선택지를 고를 수 있는 상태로 돌아가야 합니다.");
assert(storySession.lineIndex===choiceLineIndex
  &&storySession.lines.length===choiceBaseLineCount,
  "선택 전 복원은 선택지 줄과 원본 대사 배열을 복원해야 합니다.");

freshState(1,GAME_PHASES.PREP);
assert(playStoryScenes(["SCN-P01","SCN-P02"]),"연속 프롤로그 장면을 시작할 수 있어야 합니다.");
completeStoryScene();
const sceneBoundarySave=readSaveData("auto");
assert(sceneBoundarySave?.state.story.completed["SCN-P01"]===true,
  "장면 완료 직후 자동 저장에 완료 플래그가 반영되어야 합니다.");
assert(sceneBoundarySave?.storyCheckpoint?.sceneId==="SCN-P02",
  "장면 완료 직후 자동 저장은 다음 장면의 재개 위치를 가리켜야 합니다.");

const orderScene=Object.values(STORY_SCENES).find(scene=>scene.specialGuest&&scene.guestOrder);
assert(!!orderScene,"특별 손님 주문 저장을 검증할 장면이 있어야 합니다.");
freshState(orderScene.day,GAME_PHASES.OPEN);
state.selectedMenus=[orderScene.dishId];
state.orders=[{
  id:777,slot:0,dishId:orderScene.dishId,storyDishId:orderScene.dishId,
  customerType:"story",guestId:orderScene.character,storySceneId:orderScene.id,
  storyArrival:"early",deferUntilArrival:true,guestOrder:false,awaitingDishChoice:true,
  specialRecipe:false,repeatVisit:true,satisfaction:0
}];
nextOrderId=778;
assert(playStoryScenes([orderScene.id]),orderScene.id+" 대화를 시작할 수 있어야 합니다.");
assert(suspendStoryForOrderCook(orderScene,{
  dishId:orderScene.dishId,special:true,thresholds:STORY_SCORE_THRESHOLDS,suppressReply:true
},{lineIndex:0}),
  "특별 손님 주문 대화를 조리 대기 상태로 전환할 수 있어야 합니다.");
assert(storyCookingIsActive()&&activeStoryCookOrderId()===777,
  "주문 조리 시작 뒤 대화가 suspended 상태가 되어야 합니다.");
assert(saveManualGame("manual3"),"suspended orderCook 상태는 수동 저장할 수 있어야 합니다.");
const suspendedSave=readSaveData("manual3");
assert(suspendedSave.storyCheckpoint.suspended
  &&suspendedSave.storyCheckpoint.pendingCook.orderId===777,
  "suspended 체크포인트에 대기 주문을 보존해야 합니다.");

state.orders[0].specialRecipe=false;
state.selectedOrderId=null;
clearStoryRuntime();
restoreGameState(suspendedSave);
assert(storyCookingIsActive()&&activeStoryCookOrderId()===777,
  "suspended orderCook을 불러오면 같은 주문 조리 상태로 돌아가야 합니다.");
assert(state.selectedOrderId===777&&state.orders[0].specialRecipe===true,
  "suspended orderCook 복원은 선택 주문과 특별 조리 여부를 되살려야 합니다.");
assert(state.orders[0].dishId===orderScene.dishId&&!state.orders[0].awaitingDishChoice
  &&state.orders[0].guestOrder,
  "선택한 특별 손님 음식과 조리 가능 상태를 저장·복원해야 합니다.");
assert(restoreCheckpointCalls>=4,
  "restoreGameState는 저장된 스토리 체크포인트 복원 함수를 호출해야 합니다.");

const legacyAudioSave=JSON.parse(JSON.stringify(suspendedSave));
legacyAudioSave.state.audio={master:.31,bgm:.52,sfx:.73};
localStorage.removeItem(AUDIO_SETTINGS_KEY);
restoreGameState(legacyAudioSave);
same(state.audio,{enabled:true,bgmEnabled:true,sfxEnabled:true,master:.31,bgm:.52,sfx:.73},
  "ON/OFF 필드가 없는 구 저장 음향은 켜진 상태로 호환해야 합니다.");
same(readStoredAudioSettings(),state.audio,
  "전역 설정이 없으면 구 저장의 음향 값을 한 번 승격해 저장해야 합니다.");

const globalAudio=writeAudioSettings({
  enabled:false,bgmEnabled:false,sfxEnabled:true,master:.64,bgm:.35,sfx:.86
});
const differentSlotAudio=JSON.parse(JSON.stringify(legacyAudioSave));
differentSlotAudio.state.audio={enabled:true,master:.1,bgm:.2,sfx:.3};
restoreGameState(differentSlotAudio);
same(state.audio,globalAudio,
  "저장 슬롯을 불러와도 전역 음향 ON/OFF와 슬라이더 값이 우선해야 합니다.");
const permanentAudioBeforeDelete=localStorage.getItem(AUDIO_SETTINGS_KEY);

const permanentJournalBeforeDelete=localStorage.getItem(JOURNAL_KEY);
assert(permanentJournalBeforeDelete,"영구 타이틀 영업일지가 저장되어 있어야 합니다.");
assert(clearAllSaveData(),"새 게임·전체 진행 초기화에 해당하는 저장 슬롯 삭제가 성공해야 합니다.");
assert(localStorage.getItem(JOURNAL_KEY)===permanentJournalBeforeDelete,
  "새 게임이나 진행 세이브 전체 삭제가 타이틀 영구 영업일지를 지우면 안 됩니다.");
assert(localStorage.getItem(AUDIO_SETTINGS_KEY)===permanentAudioBeforeDelete,
  "새 게임이나 진행 세이브 전체 삭제가 전역 음향 설정을 지우면 안 됩니다.");
assert(window.MoonlightTableSave.collectionPages()
  .filter(page=>page.kind==="guest"&&page.unlocked)
  .every(page=>page.epilogueUnlocked===true),
  "새 게임이나 진행 세이브 전체 삭제 뒤에도 진엔딩 후일담 해금을 유지해야 합니다.");

console.log("SAVE_SLOTS_CONTRACT_OK 83");
`;

const context={
  console:{
    log:message=>process.stdout.write(String(message)+"\n"),
    warn(){}
  },
  Map,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Set,
  Number,
  String,
  Boolean,
  RegExp,
  Error,
  URLSearchParams,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(
  [bootstrap,sources[0],runtimeSetup,...sources.slice(1),tests].join("\n;\n"),
  context,
  {filename:"save-slots-contract-smoke.bundle.js"}
);
