"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const source=["game-data.js","story-data.js","story.js","night.js"]
  .map(file=>fs.readFileSync(path.join(root,file),"utf8"))
  .join("\n");

const bootstrap=`
var state={};
const window={MoonlightTableSave:null,QA_MODE:null,addEventListener(){},matchMedia(){return {matches:false};}};
const document={getElementById(){return null;}};
const CUSTOMER_SEATS=[240,520,800,1080];
const CUSTOMER_SERVICE_Y=620;
const CUSTOMER_VARIANT_COUNT=6;
let nextOrderId=1;
const element=()=>({textContent:"",innerHTML:"",disabled:false,classList:{add(){},remove(){}}});
const dom={
  servedResult:element(),satisfactionResult:element(),fiveStarResult:element(),
  nextDayButton:element(),resultComment:element(),objectiveTitle:element(),objectiveBody:element()
};
const audio={serve(){}};
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function avgSatisfaction(){return state.served?Math.round(state.satisfactionTotal/state.served):0;}
function saveGame(){return true;}
function updateUI(){}
let toastMessages=[];
function showToast(message){toastMessages.push(String(message));}
function startMini(){}
function stationById(id){return {id,label:id};}
function distance(a,b,c,d){return Math.hypot(a-c,b-d);}
`;

const test=`
const DISHES=MENU_DATA.map(menu=>({
  ...menu,name:menu.displayName,prepTasks:[...menu.requiredPrepTasks],cook:[...(menu.cook||[])]
}));
function dishById(id){return DISHES.find(dish=>dish.id===id)||null;}
function dishPreparedForService(id){return state.inventory?.[id]?.prepared===true;}

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const makeInventory=()=>Object.fromEntries(DISHES.map(dish=>[
  dish.id,{count:1,quality:80,prepared:true}
]));
const resetNight=()=>{
  storySession=null;
  toastMessages=[];
  state={
    day:1,phase:GAME_PHASES.OPEN,screen:"game",paused:false,mini:null,carrying:null,
    story:{pendingNightGuests:[],pendingResultSceneId:null},orders:[],respawns:[],departures:[],
    selectedOrderId:null,selectedMenus:DISHES.map(dish=>dish.id),inventory:makeInventory(),
    generalServed:0,generalSpawnedCustomers:0,spawnedCustomers:0,served:0,
    nightCustomerTarget:DAY_DATA[1].generalOrderTarget,satisfactionTotal:0,fiveStar:0
  };
};
const order=(customerType="general")=>({
  id:1,slot:0,variant:0,dishId:"oden",customerType,
  guestId:customerType==="story"?"rainyChild":null,
  guestOrder:true,specialRecipe:customerType==="story",cookStep:0,cookScores:[],entered:1
});

// 특별 손님의 식사와 퇴장은 결과 대화 안에서 끝나므로 일반 퇴장 큐에 넣지 않습니다.
applyStoryCookingResult=()=>({matched:true,name:"비에 젖은 아이",special:true,text:"고마워요."});
finishSuspendedStoryCook=()=>false;
processStoryNightTrigger=()=>false;
resetNight();
state.orders=[order("story")];
state.carrying={orderId:1,dishId:"oden",cookScore:80};
serveOrder(state.orders[0]);
assert(state.orders.length===0&&state.departures.length===0,
  "특별 손님 결과 대화 후 일반 식사 말풍선과 퇴장 연출이 다시 생기면 안 됩니다.");

// 정답이 아닌 음식을 냈을 때도 기존 결과 장면이 퇴장을 담당합니다.
applyStoryCookingResult=()=>({matched:false,name:"비에 젖은 아이",special:false,text:"찾던 음식이 아니에요."});
resetNight();
state.orders=[order("story")];
state.carrying={orderId:1,dishId:"oden",cookScore:55};
serveOrder(state.orders[0]);
assert(state.orders.length===0&&state.departures.length===0,
  "오답 특별 손님도 결과 대화 뒤 일반 퇴장 큐로 되돌아가면 안 됩니다.");

// 마지막 일반 손님은 반응과 퇴장이 끝나기 전에는 마감하지 않습니다.
applyStoryCookingResult=()=>null;
resetNight();
state.generalServed=nightGeneralOrderTarget()-1;
state.generalSpawnedCustomers=nightGeneralOrderTarget();
state.orders=[order("general")];
state.carrying={orderId:1,dishId:"oden",cookScore:80};
serveOrder(state.orders[0]);
assert(state.departures.length===1&&!state.departures[0].guestId,
  "일반 손님은 기존 식사 반응과 퇴장 연출을 유지해야 합니다.");
let ended=0;
endNight=()=>{ended++;state.phase=GAME_PHASES.RESULT;};
assert(!tryEndNight("complete")&&ended===0&&state.phase===GAME_PHASES.OPEN,
  "마지막 일반 손님의 퇴장 연출 중에는 영업을 종료하면 안 됩니다.");
assert(!toastMessages.some(message=>message.includes("특별 손님")),
  "일반 손님 반응을 기다리는 동안 특별 손님 안내를 잘못 표시하면 안 됩니다.");
state.departures=[];
assert(tryEndNight("complete")&&ended===1&&state.phase===GAME_PHASES.RESULT,
  "마지막 일반 손님이 떠난 뒤에는 정상적으로 영업을 종료해야 합니다.");

// 플레이 화면에는 내부 점수를 숨기되 계산과 판정 데이터는 유지합니다.
resetNight();
state.orders=[order("general")];
state.carrying={orderId:1,dishId:"oden",cookScore:83};
updateNightObjective();
assert(!/조리\\s*\\d+점|예상 (?:평가|만족도)\\s*\\d+점/.test(dom.objectiveBody.innerHTML),
  "음식 운반 안내에 조리 점수나 예상 평가 숫자를 표시하면 안 됩니다.");

state.served=4;state.generalServed=3;state.satisfactionTotal=352;state.fiveStar=2;
renderNightResult();
assert(!/\\d/.test(dom.satisfactionResult.textContent)&&!/\\d/.test(dom.fiveStarResult.textContent),
  "영업 기록의 만족도와 좋은 접시는 숫자 대신 정성적인 반응으로 표시해야 합니다.");

console.log("NIGHT_RESULT_FLOW_CONTRACT_OK special exit · final reaction · qualitative feedback");
`;

vm.runInNewContext(`${bootstrap}\n${source}\n${test}`,{
  console,setTimeout,clearTimeout,URLSearchParams,location:{search:""},performance
},{filename:"night-result-flow-contract-smoke.bundle.js"});
