"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const source=["js/game-data.js","js/story-data.js","js/story.js","js/night.js"]
  .map(file=>fs.readFileSync(path.join(root,file),"utf8"))
  .join("\n");

const bootstrap=`
var state={};
const window={MoonlightTableSave:null,QA_MODE:null,addEventListener(){},matchMedia(){return {matches:false};}};
const document={getElementById(){return null;}};
const CUSTOMER_SEATS=[240,520,800,1080,1360];
const CUSTOMER_USABLE_SEATS=4;
const CUSTOMER_VARIANT_COUNT=6;
let nextOrderId=1;
const dom={};
const audio={played:[],serve(){},play(name){this.played.push(name);}};
const UI_TEXT={toast:{
  discardDone:name=>name+" 폐기",
  discardLimit:name=>name+"은 이미 한 번 폐기했습니다. 손님에게 내어 주세요."
}};
let nearStationId=null,trashAnimationCount=0,lastSaveAllowDuringStory=null;
const toastMessages=[];
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function saveGame(allowDuringStory=false){lastSaveAllowDuringStory=allowDuringStory;return true;}
function updateUI(){}
function showToast(message){toastMessages.push(message);}
function startMini(){}
function stationById(){return null;}
function nearestStation(preferredId=null){
  return nearStationId&&(!preferredId||preferredId===nearStationId)
    ?{id:nearStationId,facing:"right"}:null;
}
function playTrashDiscardAnimation(){trashAnimationCount++;}
`;

const test=`
const source=${JSON.stringify(source)};
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
    player:{x:0,y:0,facing:"down"},
    story:createStoryState(),orders:[],respawns:[],departures:[],selectedOrderId:null,
    selectedMenus:DISHES.map(dish=>dish.id),inventory:makeInventory(),
    generalServed:0,generalSpawnedCustomers:0,generalSatisfactionTotal:0,spawnedCustomers:0,served:0,
    nightCustomerTarget:DAY_DATA[day].generalOrderTarget,satisfactionTotal:0,fiveStar:0
  };
  prepareStoryNight();
};

let played=[];
playStoryScenes=ids=>{played.push([...ids]);return true;};

const originalRandom=Math.random;
Math.random=()=>.99;
assert(randomFreeCustomerSlot(new Set())===3
  &&randomFreeCustomerSlot(new Set([3]))===2
  &&randomFreeCustomerSlot(new Set([0,1,2,3]))===-1,
  "손님은 열려 있는 네 좌석(1~4번)의 빈자리 중에서만 골라야 하고 5번 자리에는 앉지 않아야 합니다.");
Math.random=originalRandom;

// 날짜별 일반 손님 간격은 범위 안에서 흔들리고, 마지막 한 명은 더 빨리 옵니다.
resetNight(1);
Math.random=()=>0;
state.generalSpawnedCustomers=0;
assert(Math.abs(generalOrderArrivalDelay()-2.15)<1e-9,
  "1일차 일반 손님의 최소 재등장 간격은 2.15초여야 합니다.");
state.generalSpawnedCustomers=nightGeneralOrderTarget()-1;
assert(Math.abs(generalOrderArrivalDelay()-1.15)<1e-9,
  "마지막 일반 손님은 1일차에도 1.15초부터 입장해야 합니다.");
resetNight(7);
Math.random=()=>1;
state.generalSpawnedCustomers=0;
assert(Math.abs(generalOrderArrivalDelay()-2.3)<1e-9,
  "7일차 일반 손님의 최대 재등장 간격은 2.3초여야 합니다.");
state.generalSpawnedCustomers=nightGeneralOrderTarget()-1;
assert(Math.abs(generalOrderArrivalDelay()-1.35)<1e-9,
  "7일차 마지막 일반 손님은 최대 1.35초 안에 입장해야 합니다.");
Math.random=originalRandom;

// Day 1: 특별 손님은 일반 손님 여섯 명을 모두 마친 뒤에만 입장합니다.
resetNight(1);
ensureNightOrders();
assert(state.orders.length===2,"첫날 시작 대기 손님은 두 명이어야 합니다.");
assert(state.orders.every(order=>order.customerType==="general")
  &&state.generalSpawnedCustomers===2,
  "영업 시작에는 일반 손님만 두 명 대기해야 합니다.");
assert(state.orders.every(order=>order.entrySpeed>=1.9&&order.entrySpeed<=2.3)
  &&state.orders[0].entryDelay===0
  &&state.orders[1].entryDelay>=.08&&state.orders[1].entryDelay<=.26,
  "첫 손님은 바로, 다음 손님은 짧은 랜덤 간격과 서로 다른 입장 속도로 들어와야 합니다.");
assert(source.includes("scheduleOrderRespawn(order.slot,hasRemainingGeneral&&!storyGuestIsDue?null:3.1);"),
  "일반 손님만 랜덤 간격을 쓰고 특별 손님의 기존 3.1초 호흡은 유지해야 합니다.");
assert(state.story.pendingNightGuests[0].arrival==="last"
  &&state.story.pendingNightGuests[0].triggerAfterGeneral===6,
  "첫날 특별 손님은 일반 손님 여섯 명 뒤 마지막 순번으로 예약되어야 합니다.");

state.generalSpawnedCustomers=6;state.generalServed=5;
state.orders=[{id:6,slot:0,dishId:"oden",customerType:"general",guestOrder:true,entered:1,cookStep:0,cookScores:[]}];
nextOrderId=7;
assert(!processStoryNightTrigger()
  &&!state.orders.some(order=>order.customerType==="story"),
  "여섯 번째 일반 손님을 대접하기 전에는 특별 손님이 들어오면 안 됩니다.");

state.generalServed=6;state.generalSatisfactionTotal=480;state.orders=[];state.departures=[{slot:0,life:1}];
assert(!processStoryNightTrigger()
  &&!state.orders.some(order=>order.customerType==="story"),
  "마지막 일반 손님의 퇴장 연출이 끝나기 전에는 특별 손님이 들어오면 안 됩니다.");

state.departures=[];
assert(processStoryNightTrigger(),"일반 손님 여섯 명이 모두 떠나면 특별 손님이 입장해야 합니다.");
const rainyChild=state.orders[0];
assert(state.orders.length===1&&rainyChild.guestId==="rainyChild"
  &&rainyChild.storyArrival==="last",
  "비에 젖은 아이가 일곱 번째이자 마지막 손님이어야 합니다.");

updateNightOrderEntrances(1);
assert(resumeDeferredStoryOrderScene()&&played.length===1
  &&played[0][0]===rainyChild.storySceneId,
  "특별 손님이 입장을 마친 뒤 마지막 주문 대화를 시작해야 합니다.");

rainyChild.guestOrder=true;
assert(currentOrder()?.id===rainyChild.id,
  "대화가 끝나 주문이 정해지면 특별 손님 주문을 조리해야 합니다.");

// 일반 손님 여섯 명의 실제 평균이 80점보다 낮으면 특별 손님 예약을
// 제거하고, 등장 장면은 완료하지 않아 다음 회차에 다시 도전할 수 있습니다.
resetNight(1);played=[];
state.generalServed=6;state.generalSpawnedCustomers=6;state.generalSatisfactionTotal=479;
state.orders=[];state.departures=[];
assert(!processStoryNightTrigger()
  &&state.orders.length===0
  &&state.story.pendingNightGuests.length===0
  &&!storySceneCompleted(STORY_SCENES["SCN-G1-A"]),
  "일반 손님 실제 평균 79.83점이면 특별 손님은 오지 않고 영업 종료 대기를 남기면 안 됩니다.");

// Day 7: 교복 인형은 첫 손님, 얼굴 없는 김다은은 일반 여섯 명 뒤 마지막 손님입니다.
resetNight(7);played=[];
assert(!ensureNightOrders()&&state.orders.length===0,
  "7일차에는 교복 인형보다 일반 손님이 먼저 생성되면 안 됩니다.");
assert(processStoryNightTrigger()
  &&state.orders.length===1
  &&state.orders[0].guestId==="schoolDoll"
  &&state.orders[0].storyArrival==="early",
  "교복 인형은 7일차 영업 시작 직후 첫 손님으로 입장해야 합니다.");
assert(state.story.pendingNightGuests.some(plan=>plan.guestId==="facelessDaeun"),
  "교복 인형을 처리하는 동안 얼굴 없는 김다은의 마지막 예약을 유지해야 합니다.");

state.orders=[];state.generalServed=6;state.generalSpawnedCustomers=6;
state.generalSatisfactionTotal=480;
STORY_GUEST_IDS.slice(0,7).forEach(id=>{getStoryGuestResult(id).fragmentState="full";});
assert(processStoryNightTrigger()
  &&state.orders.length===1
  &&state.orders[0].guestId==="facelessDaeun"
  &&state.orders[0].storyArrival==="last",
  "기본 완전 조각 7개를 모으면 일반 손님 여섯 명 뒤 얼굴 없는 김다은이 마지막으로 입장해야 합니다.");

resetNight(7);played=[];
assert(processStoryNightTrigger()&&state.orders[0]?.guestId==="schoolDoll",
  "교복 인형은 일반 손님 평균이 아직 없어도 영업 전 예외로 등장해야 합니다.");
state.orders=[];state.generalServed=6;state.generalSpawnedCustomers=6;state.generalSatisfactionTotal=479;
STORY_GUEST_IDS.slice(0,7).forEach(id=>{getStoryGuestResult(id).fragmentState="full";});
assert(!processStoryNightTrigger()
  &&!state.story.pendingNightGuests.some(plan=>plan.guestId==="facelessDaeun"),
  "교복 인형은 예외지만 얼굴 없는 손님은 일반 평균 80점 미만이면 등장하면 안 됩니다.");

// 선택한 세 메뉴는 한 바퀴에 한 번씩 주문되어 여섯 명 기준 정확히 두 번씩 나옵니다.
resetNight(2);played=[];
const balancedMenuIds=["oden","tofu","kimchi"];
state.selectedMenus=[...balancedMenuIds];
Object.values(state.inventory).forEach(item=>{item.prepared=false;});
balancedMenuIds.forEach(id=>{state.inventory[id].prepared=true;});
const generalDishIds=[];
for(let index=0;index<6;index++){
  assert(spawnOrder(0,{generalOnly:true}),"일반 손님 "+(index+1)+" 생성");
  generalDishIds.push(state.orders[0].dishId);
  state.orders=[];state.generalServed++;
}
const generalDishCounts=Object.fromEntries(balancedMenuIds.map(id=>[
  id,generalDishIds.filter(dishId=>dishId===id).length
]));
assert(new Set(generalDishIds.slice(0,3)).size===3
  &&new Set(generalDishIds.slice(3,6)).size===3
  &&Object.values(generalDishCounts).every(count=>count===2),
  "선택 메뉴 순환 분배: "+generalDishIds.join(","));

// 완성 음식은 쓰레기통 가까이에서만 폐기되고, 같은 주문을 처음부터 다시 조리합니다.
resetNight(1);played=[];audio.played=[];nearStationId=null;trashAnimationCount=0;lastSaveAllowDuringStory=null;
const discardDish=DISHES.find(dish=>dish.id==="kimchi");
const discardOrder={
  id:50,slot:0,dishId:discardDish.id,customerType:"general",guestOrder:true,entered:1,
  cookStep:discardDish.cook.length,cookScores:[42,63]
};
state.orders=[discardOrder];state.selectedOrderId=discardOrder.id;
state.carrying={orderId:discardOrder.id,dishId:discardDish.id,cookScore:53};
const serviceSnapshot=[state.served,state.generalServed,state.satisfactionTotal,state.fiveStar];
assert(!discardCarriedDish()&&state.carrying?.orderId===discardOrder.id,
  "쓰레기통에서 멀리 떨어져 있으면 완성 음식을 폐기하면 안 됩니다.");
nearStationId="trash";
assert(discardCarriedDish()
  &&state.carrying===null
  &&discardOrder.cookStep===0
  &&discardOrder.cookScores.length===0
  &&discardOrder.discardedOnce===true
  &&currentOrder()?.id===discardOrder.id,
  "쓰레기통 가까이에서는 접시만 버리고 같은 선두 주문을 처음부터 다시 조리해야 합니다.");
assert(serviceSnapshot.join(",")===[state.served,state.generalServed,state.satisfactionTotal,state.fiveStar].join(",")
  &&state.departures.length===0
  &&state.respawns.length===0,
  "폐기는 서빙·평가·퇴장·재입장 결과를 만들면 안 됩니다.");
assert(trashAnimationCount===1
  &&audio.played.join(",")==="trash_discard"
  &&toastMessages.at(-1).includes("폐기")
  &&lastSaveAllowDuringStory===false,
  "일반 주문 폐기에는 쓰레기통 연출과 안내 뒤 일반 자동저장을 남겨야 합니다.");

// 같은 손님의 같은 접시는 다시 완성해도 두 번째로 버릴 수 없습니다.
discardOrder.cookStep=discardDish.cook.length;
discardOrder.cookScores=[91,87];
state.carrying={orderId:discardOrder.id,dishId:discardDish.id,cookScore:89};
const secondDiscardScores=[...discardOrder.cookScores];
const animationBeforeSecondDiscard=trashAnimationCount;
const saveBeforeSecondDiscard=lastSaveAllowDuringStory;
assert(!discardCarriedDish()
  &&state.carrying?.orderId===discardOrder.id
  &&discardOrder.cookStep===discardDish.cook.length
  &&discardOrder.cookScores.join(",")===secondDiscardScores.join(",")
  &&discardOrder.discardedOnce===true,
  "같은 손님 주문은 두 번째 폐기를 거부하고 완성 음식을 그대로 들고 있어야 합니다.");
assert(trashAnimationCount===animationBeforeSecondDiscard
  &&audio.played.join(",")==="trash_discard"
  &&lastSaveAllowDuringStory===saveBeforeSecondDiscard
  &&toastMessages.at(-1).includes("손님에게 내어"),
  "두 번째 폐기는 연출·저장을 만들지 않고 손님에게 제공하라는 안내만 보여야 합니다.");

// 메뉴가 같아도 다른 손님의 주문이면 각 주문에 한 번씩 폐기할 수 있습니다.
const sameDishNextOrder={
  id:52,slot:2,dishId:discardDish.id,customerType:"general",guestOrder:true,entered:1,
  cookStep:discardDish.cook.length,cookScores:[74,78]
};
state.orders=[discardOrder,sameDishNextOrder];
state.carrying={orderId:sameDishNextOrder.id,dishId:discardDish.id,cookScore:76};
assert(discardCarriedDish()
  &&sameDishNextOrder.discardedOnce===true
  &&sameDishNextOrder.cookStep===0
  &&discardOrder.discardedOnce===true,
  "같은 메뉴를 주문한 서로 다른 손님은 각자 자기 접시를 한 번씩 폐기할 수 있어야 합니다.");

// 특별 손님 주문을 버려도 대화 체크포인트와 선택한 음식은 유지합니다.
const specialOrder={
  id:51,slot:1,dishId:"kimchi",storyDishId:"kimchi",customerType:"story",
  guestId:"rainyChild",guestOrder:true,specialRecipe:true,entered:1,
  cookStep:discardDish.cook.length,cookScores:[88,84]
};
state.orders=[specialOrder];state.selectedOrderId=specialOrder.id;
state.carrying={orderId:specialOrder.id,dishId:"kimchi",cookScore:86};
storySession={suspended:true,pendingCook:{orderId:specialOrder.id,sceneId:"SCN-G1-A"}};
lastSaveAllowDuringStory=null;
assert(discardCarriedDish()
  &&storySession.suspended
  &&storySession.pendingCook.orderId===specialOrder.id
  &&specialOrder.dishId==="kimchi"
  &&specialOrder.storyDishId==="kimchi"
  &&specialOrder.specialRecipe
  &&specialOrder.discardedOnce===true
  &&specialOrder.cookStep===0
  &&lastSaveAllowDuringStory===true,
  "특별 손님 음식 폐기는 주문·대화 체크포인트를 유지한 채 재조리 상태로 저장해야 합니다.");

console.log("NIGHT_QUEUE_CONTRACT_OK FIFO · deferred special arrival/dialogue · one trash retry per order");
`;

vm.runInNewContext(`${bootstrap}\n${source}\n${test}`,{
  console,setTimeout,clearTimeout,URLSearchParams,location:{search:""},performance
},{filename:"night-queue-contract-smoke.bundle.js"});
