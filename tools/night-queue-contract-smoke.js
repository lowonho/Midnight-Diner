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
const CUSTOMER_VARIANT_COUNT=6;
let nextOrderId=1;
const dom={};
const audio={serve(){}};
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function saveGame(){return true;}
function updateUI(){}
function showToast(){}
function startMini(){}
function stationById(){return null;}
`;

const test=`
const DISHES=MENU_DATA.map(menu=>({
  ...menu,
  name:menu.displayName,
  prepTasks:[...menu.requiredPrepTasks],
  cook:[...(menu.cook||[])]
}));
function dishById(id){return DISHES.find(dish=>dish.id===id)||null;}
function dishPreparedForService(id){return state.inventory?.[id]?.prepared===true;}

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const makeInventory=()=>Object.fromEntries(DISHES.map(dish=>[
  dish.id,{count:1,quality:80,prepared:true}
]));
const resetNight=day=>{
  storySession=null;
  nextOrderId=1;
  state={
    day,phase:GAME_PHASES.OPEN,screen:"game",paused:false,mini:null,carrying:null,
    story:createStoryState(),orders:[],respawns:[],departures:[],selectedOrderId:null,
    selectedMenus:DISHES.map(dish=>dish.id),inventory:makeInventory(),
    generalServed:0,generalSpawnedCustomers:0,spawnedCustomers:0,served:0,
    nightCustomerTarget:DAY_DATA[day].generalOrderTarget,satisfactionTotal:0,fiveStar:0
  };
  prepareStoryNight();
};

let played=[];
playStoryScenes=ids=>{played.push([...ids]);return true;};

// Day 1: 첫 일반 손님 다음 순번으로 아이가 이미 들어오되, 선대화하지 않습니다.
resetNight(1);
ensureNightOrders();
assert(state.orders.length===2,"첫날 시작 대기 손님은 두 명이어야 합니다.");
assert(state.orders[0].customerType==="general"
  &&state.orders[1].guestId==="rainyChild",
  "첫날 도착 순서는 일반 손님 다음 비에 젖은 아이여야 합니다.");
assert(state.generalSpawnedCustomers===1
  &&state.orders[1].entryDelay>0
  &&state.orders[1].bubble==="",
  "아이는 두 번째로 나타나며 자기 차례 전에는 말풍선을 띄우면 안 됩니다.");
assert(currentOrder()?.id===state.orders[0].id&&played.length===0,
  "아이가 와 있어도 첫 일반 손님의 차례를 추월하면 안 됩니다.");

const firstGeneral=state.orders[0];
const rainyChild=state.orders[1];
spawnOrder(2,{generalOnly:true});
assert(currentOrder()?.id===firstGeneral.id,
  "뒤 손님이 더 생겨도 첫 주문이 자동 선택되어야 합니다.");

updateNightOrderEntrances(.7);
updateNightOrderEntrances(.5);
assert(rainyChild.entered===1,"아이의 두 번째 입장 연출이 완료되어야 합니다.");

state.carrying={orderId:firstGeneral.id,dishId:firstGeneral.dishId,cookScore:80};
serveOrder(firstGeneral);
assert(state.generalServed===1&&!state.carrying
  &&!state.orders.some(order=>order.id===firstGeneral.id),
  "실제 제공 경로가 첫 일반 손님을 완료하고 운반 상태를 해제해야 합니다.");
assert(currentOrder()===null,
  "대화 전 특별 손님이 선두라면 뒤 일반 주문을 건너뛰어 조리하면 안 됩니다.");

state.mini={type:"heat",context:{orderId:rainyChild.id}};
assert(!resumeDeferredStoryOrderScene()&&played.length===0,
  "미니게임 중에는 특별 손님 대화를 열면 안 됩니다.");
state.mini=null;state.carrying={orderId:999,dishId:"oden",cookScore:80};
assert(!resumeDeferredStoryOrderScene()&&played.length===0,
  "음식 운반 중에는 특별 손님 대화를 열면 안 됩니다.");
state.carrying=null;state.departures=[{slot:firstGeneral.slot,life:1}];
assert(!resumeDeferredStoryOrderScene()&&played.length===0,
  "앞 손님의 반응과 퇴장이 끝나기 전에 특별 손님 대화를 열면 안 됩니다.");
state.departures=[];
assert(resumeDeferredStoryOrderScene()&&played.length===1
  &&played[0][0]===rainyChild.storySceneId,
  "첫 손님을 대접하고 안전해진 뒤 아이의 대화를 시작해야 합니다.");

rainyChild.guestOrder=true;
assert(currentOrder()?.id===rainyChild.id,
  "대화가 끝나 주문이 정해지면 아이가 다음 조리 차례가 되어야 합니다.");

// Day 3: 일반 둘 다음의 특별 손님 순번을 미니게임이 끝날 때까지 예약합니다.
resetNight(3);played=[];
ensureNightOrders();
assert(state.orders.map(order=>order.customerType).join(",")==="general,general,story"
  &&state.orders[2].guestId==="twinShadows",
  "셋째 날 실제 초기 생성도 일반 둘 다음의 특별 손님 순서여야 합니다.");

resetNight(3);played=[];
state.orders=[
  {id:1,slot:0,dishId:"oden",customerType:"general",guestOrder:true,entered:1,cookStep:0,cookScores:[]},
  {id:2,slot:1,dishId:"tofu",customerType:"general",guestOrder:true,entered:1,cookStep:0,cookScores:[]}
];
state.generalSpawnedCustomers=2;nextOrderId=3;state.mini={type:"chop",context:{orderId:1}};
assert(!processStoryNightTrigger()
  &&!state.orders.some(order=>order.customerType==="story"),
  "미니게임 중에는 도착 차례가 된 특별 손님의 입장을 시작하면 안 됩니다.");
state.mini=null;
assert(processStoryNightTrigger(),"안전해지면 예약된 특별 손님이 입장해야 합니다.");
assert(state.orders.map(order=>order.customerType).join(",")==="general,general,story"
  &&state.orders[2].guestId==="twinShadows",
  "셋째 날 특별 손님은 두 일반 손님 다음의 세 번째 순번이어야 합니다.");

console.log("NIGHT_QUEUE_CONTRACT_OK FIFO · deferred special arrival/dialogue");
`;

vm.runInNewContext(`${bootstrap}\n${source}\n${test}`,{
  console,setTimeout,clearTimeout,URLSearchParams,location:{search:""},performance
},{filename:"night-queue-contract-smoke.bundle.js"});
