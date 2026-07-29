"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const sources=["game-data.js","story-data.js","story.js","save.js"]
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
    served:0,
    satisfactionTotal:0,
    fiveStar:0,
    cleanliness:100,
    dirtyDishes:0,
    trash:0,
    audio:{master:0.8,bgm:0.7,sfx:0.9},
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
  state.day=index+1;
  state.money=1000+index;
  state.story=createStoryState();
  state.story.choices["choice-"+marker]=index;
  state.story.flags["flag-"+marker]=true;
  state.story.guestState.gicheol.affinity=10+index;
  state.story.completed["scene-"+marker]=true;
  state.story.storyCookResults["result-"+marker]={
    score:70+index,tier:index%2?"great":"soft",day:index+1,dishId:"kimchi"
  };
  nextOrderId=100+index;
}

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
  assert(saved&&saved.nextOrderId===100+index,slotId+"의 nextOrderId가 독립적으로 저장되어야 합니다.");
  same(saved.state.story.choices,{["choice-"+marker]:index},slotId+" 선택지 격리");
  same(saved.state.story.flags,{["flag-"+marker]:true},slotId+" 플래그 격리");
  assert(saved.state.story.guestState.gicheol.affinity===10+index,slotId+" 호감도 격리");
  same(saved.state.story.completed,{["scene-"+marker]:true},slotId+" 완료 장면 격리");
  assert(saved.state.story.storyCookResults["result-"+marker].score===70+index,slotId+" 조리 결과 격리");
});
same(readAllSaveSlots().map(slot=>slot.id),["auto","manual1","manual2","manual3"],
  "전체 슬롯 조회도 표시 순서를 보존해야 합니다.");
assert(hasAnySaveData(),"한 슬롯이라도 있으면 이어하기 저장이 존재해야 합니다.");

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
const manualsBeforeClear=MANUAL_SAVE_SLOTS.map(rawSlot);
clearSaveData("auto");
assert(rawSlot("auto")===null,"자동 저장 삭제는 자동 저장만 지워야 합니다.");
same(MANUAL_SAVE_SLOTS.map(rawSlot),manualsBeforeClear,
  "자동 저장 삭제 뒤에도 수동 저장 3개는 유지되어야 합니다.");

const manualsBeforeTimer=MANUAL_SAVE_SLOTS.map(rawSlot);
applySlotMarker("FIVE-SECONDS",4);
autosaveElapsed=4.9;
updateAutosave(0.2);
assert(rawSlot("auto")!==null,"5초 자동 저장 타이머는 자동 저장 슬롯을 만들어야 합니다.");
same(MANUAL_SAVE_SLOTS.map(rawSlot),manualsBeforeTimer,
  "5초 자동 저장은 수동 저장 슬롯을 바꾸면 안 됩니다.");
assert(autosaveElapsed===0,"5초 자동 저장이 끝나면 자동 저장 타이머가 초기화되어야 합니다.");

const autoBeforeRejectedSave=rawSlot("auto");
state.mini={kind:"test"};
assert(!saveGame(true)&&!saveManualGame("manual1"),"미니게임 중에는 자동/수동 저장을 거부해야 합니다.");
assert(rawSlot("auto")===autoBeforeRejectedSave,"거부된 미니게임 저장은 기존 자동 저장을 덮어쓰면 안 됩니다.");
state.mini=null;
state.story.activeStoryCook={sceneId:"PR-01",dishId:"tofu"};
assert(!saveGame(true)&&!saveManualGame("manual1"),"직접 스토리 조리 중에는 자동/수동 저장을 거부해야 합니다.");
assert(rawSlot("auto")===autoBeforeRejectedSave,"거부된 직접 조리 저장은 기존 자동 저장을 덮어쓰면 안 됩니다.");
state.story.activeStoryCook=null;

let restoreCheckpointCalls=0;
const actualRestoreStoryCheckpoint=restoreStoryCheckpoint;
restoreStoryCheckpoint=function(checkpoint){
  restoreCheckpointCalls++;
  return actualRestoreStoryCheckpoint(checkpoint);
};

freshState(2,GAME_PHASES.OPEN);
assert(playStoryScenes(["G-02"]),"G-02 대화를 시작할 수 있어야 합니다.");
const g02ChoiceLineIndex=storySession.lines.findIndex(line=>
  Array.isArray(line.choices)&&line.choices.some(choice=>Number(choice.affinity)>0)
);
assert(g02ChoiceLineIndex>=0,"G-02 일반 선택지를 찾아야 합니다.");
storySession.lineIndex=g02ChoiceLineIndex;
showStoryLine();
const g02BaseLineCount=storySession.lines.length;
const g02Choice=storySession.lines[g02ChoiceLineIndex].choices[0];
const g02Reply=g02Choice.reply;
assert(saveManualGame("manual1"),"선택 전 대화 체크포인트를 수동 저장할 수 있어야 합니다.");
const beforeChoiceSave=readSaveData("manual1");
assert(beforeChoiceSave.storyCheckpoint.lineIndex===g02ChoiceLineIndex,
  "선택 전 체크포인트는 선택지 줄에서 재개해야 합니다.");
assert(beforeChoiceSave.state.story.choices["G-02"]===undefined,
  "선택 전 저장에 미래 선택이 들어가면 안 됩니다.");

chooseStoryOption(g02Choice,0);
assert(state.story.choices["G-02"]===0,"선택 직후 선택 인덱스를 기록해야 합니다.");
assert(state.story.guestState.gicheol.affinity===1,"일반 선택지 호감도는 한 번만 적용되어야 합니다.");
assert(storySession.lines.filter(line=>line.text===g02Reply).length===1,
  "일반 선택지 답변 줄은 한 번만 삽입되어야 합니다.");
assert(saveManualGame("manual2"),"선택 후 수정된 대화 체크포인트를 수동 저장할 수 있어야 합니다.");
const afterChoiceSave=readSaveData("manual2");
assert(afterChoiceSave.storyCheckpoint.lines.length===g02BaseLineCount+1,
  "선택 후 체크포인트에 삽입된 답변 줄이 포함되어야 합니다.");

state.story.guestState.gicheol.affinity=99;
storySession.lines.splice(g02ChoiceLineIndex+1,0,{speaker:"gicheol",text:g02Reply});
restoreGameState(afterChoiceSave);
assert(state.story.choices["G-02"]===0&&state.story.guestState.gicheol.affinity===1,
  "선택 후 저장 복원은 선택과 호감도를 정확히 되돌려야 합니다.");
assert(storySession.lines.length===g02BaseLineCount+1
  &&storySession.lines.filter(line=>line.text===g02Reply).length===1,
  "선택 후 복원은 삽입 답변을 중복 생성하면 안 됩니다.");
restoreGameState(afterChoiceSave);
assert(state.story.guestState.gicheol.affinity===1
  &&storySession.lines.filter(line=>line.text===g02Reply).length===1,
  "같은 체크포인트를 반복 복원해도 호감도와 답변이 중복되면 안 됩니다.");

restoreGameState(beforeChoiceSave);
assert(state.story.choices["G-02"]===undefined
  &&state.story.guestState.gicheol.affinity===0,
  "선택 전 저장을 불러오면 다른 선택지를 고를 수 있는 상태로 돌아가야 합니다.");
assert(storySession.lineIndex===g02ChoiceLineIndex
  &&storySession.lines.length===g02BaseLineCount
  &&storySession.lines.filter(line=>line.text===g02Reply).length===0,
  "선택 전 복원은 선택지 줄과 원본 대사 배열을 복원해야 합니다.");

freshState(1,GAME_PHASES.PREP);
assert(playStoryScenes(["PR-01","PR-02"]),"연속 프롤로그 장면을 시작할 수 있어야 합니다.");
completeStoryScene();
const sceneBoundarySave=readSaveData("auto");
assert(sceneBoundarySave?.state.story.completed["PR-01"]===true,
  "장면 완료 직후 자동 저장에 완료 플래그가 반영되어야 합니다.");
assert(sceneBoundarySave?.storyCheckpoint?.sceneId==="PR-02",
  "장면 완료 직후 자동 저장은 다음 장면의 재개 위치를 가리켜야 합니다.");

freshState(5,GAME_PHASES.OPEN);
state.orders=[{
  id:777,slot:0,dishId:"kimchi",storyDishId:"kimchi",
  customerType:"story",guestId:"gicheol",storySceneId:"G-03",
  storyArrival:"early",deferUntilArrival:true,guestOrder:true,
  specialRecipe:false,repeatVisit:true,satisfaction:0
}];
nextOrderId=778;
assert(playStoryScenes(["G-03"]),"G-03 대화를 시작할 수 있어야 합니다.");
const g03ChoiceLineIndex=storySession.lines.findIndex(line=>
  Array.isArray(line.choices)&&line.choices.some(choice=>choice.orderCook)
);
storySession.lineIndex=g03ChoiceLineIndex;
showStoryLine();
const specialChoice=storySession.lines[g03ChoiceLineIndex].choices[0];
chooseStoryOption(specialChoice,0);
assert(storyCookingIsActive()&&activeStoryCookOrderId()===777,
  "주문 조리 선택 뒤 대화가 suspended 상태가 되어야 합니다.");
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
assert(restoreCheckpointCalls>=4,
  "restoreGameState는 저장된 스토리 체크포인트 복원 함수를 호출해야 합니다.");

console.log("SAVE_SLOTS_CONTRACT_OK 36");
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
