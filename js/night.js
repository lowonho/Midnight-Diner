"use strict";

// 밤 영업은 시간제한 없이 그날의 일반 주문 목표를 채우면 마감합니다.
// QA 코드가 참조하는 이름은 유지하되 실제 타이머로 사용하지 않습니다.
const NIGHT_DURATION=0;
let spawningInitialNightOrders=false;
let storyNightEndNoticeShown=false;

/* 일반 손님 재방문 간격(초). 날짜가 뒤로 갈수록 흐름만 조금 빨라지고,
   같은 날짜 안에서도 매번 다른 박자로 들어옵니다. 마지막 한 명은 별도 범위를
   써서 주문판이 한참 빈 뒤에야 나타나는 느낌을 없앱니다. */
const NIGHT_GENERAL_ARRIVAL_WINDOWS=Object.freeze({
  1:Object.freeze({min:2.15,max:2.90,lastMin:1.15,lastMax:1.65}),
  2:Object.freeze({min:2.05,max:2.80,lastMin:1.10,lastMax:1.60}),
  3:Object.freeze({min:1.95,max:2.70,lastMin:1.05,lastMax:1.55}),
  4:Object.freeze({min:1.90,max:2.60,lastMin:1.00,lastMax:1.50}),
  5:Object.freeze({min:1.80,max:2.50,lastMin:.95,lastMax:1.45}),
  6:Object.freeze({min:1.70,max:2.40,lastMin:.90,lastMax:1.40}),
  7:Object.freeze({min:1.60,max:2.30,lastMin:.85,lastMax:1.35})
});

function generalOrderArrivalDelay(day=state.day){
  const window=NIGHT_GENERAL_ARRIVAL_WINDOWS[Number(day)]||NIGHT_GENERAL_ARRIVAL_WINDOWS[1];
  const unspawned=Math.max(0,nightGeneralOrderTarget(day)-(Number(state.generalSpawnedCustomers)||0));
  const lastGeneral=unspawned===1;
  const min=lastGeneral?window.lastMin:window.min;
  const max=lastGeneral?window.lastMax:window.max;
  return min+(max-min)*Math.random();
}

function generalOrderEntranceSpeed(){return 1.9+Math.random()*.4;}
function generalOrderEntranceDelay(){return .08+Math.random()*.18;}

function nightGeneralOrderTarget(day=state.day){
  const configured=Number(DAY_DATA[Number(day)]?.generalOrderTarget);
  return Number.isFinite(configured)?Math.max(0,Math.floor(configured)):0;
}

/* 아직 안 받은 일반 손님 수. 밤에는 시간이 아니라 이 숫자로 마감을 세므로
   상단 HUD("남은 손님")와 손님 추가 생성이 같은 값을 봅니다. */
function nightGuestsRemaining(){
  const served=Math.max(0,Math.floor(Number(state.generalServed)||0));
  return Math.max(0,nightGeneralOrderTarget()-served);
}

function normalizeNightOrderCounters(){
  state.nightCustomerTarget=nightGeneralOrderTarget();
  if(!Number.isFinite(state.generalServed))state.generalServed=0;
  state.generalServed=Math.max(0,Math.floor(state.generalServed));
  // 일반 주문은 중도 이탈하지 않으므로 누적 생성 수 = 완료 수 + 현재 주문 수입니다.
  // 이 방식이면 구버전 세이브에 새 카운터가 없어도 즉시 정확히 복원됩니다.
  const waiting=(state.orders||[]).filter(order=>order.customerType!=="story").length;
  state.generalSpawnedCustomers=state.generalServed+waiting;
}

function orderableDishes(){
  return DISHES.filter(dish=>
    dish.isImplemented
    &&dishPreparedForService(dish.id)
  );
}
function hasOrderableStock(){return orderableDishes().length>0;}

/* 좌석은 CUSTOMER_USABLE_SEATS(customers.js) 개까지만 씁니다. 손님이 앉는 자리를
   늘리거나 줄이려면 그 값만 바꾸면 되고, 여기와 story.js 의 예비 경로가 함께
   따라옵니다. */
function randomFreeCustomerSlot(occupied=new Set()){
  const usable=Math.min(CUSTOMER_SEATS.length,CUSTOMER_USABLE_SEATS);
  const freeSlots=CUSTOMER_SEATS
    .map((_,slot)=>slot)
    .filter(slot=>slot<usable&&!occupied.has(slot));
  return freeSlots.length
    ?freeSlots[Math.floor(Math.random()*freeSlots.length)]
    :-1;
}

/* 일반 손님 주문은 선택 메뉴를 무작위로 계속 뽑지 않고 한 바퀴씩 순회합니다.
   한 바퀴 안에서는 모든 메뉴가 정확히 한 번씩 나오며, 바퀴가 바뀔 때마다
   날짜와 순번으로 다시 섞습니다. 누적 일반 손님 번호로 계산하므로 저장 후
   불러와도 메뉴 분배가 이어지고 별도 세이브 필드가 필요하지 않습니다. */
function shuffledGeneralDishes(available,cycle){
  const dishes=[...available];
  let seed=2166136261;
  const source=`${state.day}|${cycle}|${dishes.map(dish=>dish.id).join("|")}`;
  for(let index=0;index<source.length;index++){
    seed=Math.imul(seed^source.charCodeAt(index),16777619)>>>0;
  }
  const random=()=>{
    seed=(seed+0x6d2b79f5)>>>0;
    let value=seed;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
  for(let index=dishes.length-1;index>0;index--){
    const swapIndex=Math.floor(random()*(index+1));
    [dishes[index],dishes[swapIndex]]=[dishes[swapIndex],dishes[index]];
  }
  return dishes;
}

function dishForNextGeneralOrder(available=orderableDishes()){
  if(!available.length)return null;
  const orderIndex=Math.max(0,Math.floor(Number(state.generalSpawnedCustomers)||0));
  const cycle=Math.floor(orderIndex/available.length);
  return shuffledGeneralDishes(available,cycle)[orderIndex%available.length]||null;
}

function updateNightOrderEntrances(dt,storyOnly=false){
  state.orders.forEach(order=>{
    if(storyOnly&&order.customerType!=="story")return;
    if((Number(order.entryDelay)||0)>0){
      order.entryDelay=Math.max(0,Number(order.entryDelay)-dt);
      return;
    }
    order.entered=clamp((Number(order.entered)||0)+dt*(Number(order.entrySpeed)||2.1),0,1);
  });
}

function storyArrivalRank(plan){
  return plan.arrival==="last"?2:plan.arrival==="late"?1:0;
}
function storyArrivalThreshold(plan){
  const configured=Number(plan?.triggerAfterGeneral);
  if(Number.isFinite(configured))return Math.max(0,Math.floor(configured));
  if(plan.arrival==="last")return nightGeneralOrderTarget();
  if(plan.arrival==="late")return Math.max(1,state.nightCustomerTarget-2);
  return 0;
}
function storyPlanArrivalReady(plan){
  if(plan.arrival!=="last")return true;
  if(state.generalServed<nightGeneralOrderTarget())return false;
  const generalOrderRemaining=state.orders.some(order=>order.customerType!=="story"&&!order.storySceneId);
  const generalGuestLeaving=state.departures.some(item=>!item.guestId);
  return !generalOrderRemaining&&!generalGuestLeaving;
}
function waitingForLastStoryGuest(){
  return (state.story?.pendingNightGuests||[]).some(plan=>
    plan.arrival==="last"
    &&state.generalServed>=storyArrivalThreshold(plan)
    &&!storyPlanArrivalReady(plan)
  );
}
function storyPlansForSpawn(force=false){
  const plans=state.story?.pendingNightGuests||[];
  const arrived=typeof storyGeneralArrivals==="function"
    ?storyGeneralArrivals()
    :Math.max(0,Math.floor(Number(state.generalSpawnedCustomers)||0));
  return plans
    .map((plan,index)=>({plan,index}))
    .filter(item=>
      (!Object.prototype.hasOwnProperty.call(item.plan,"ready")||item.plan.ready===true)
      &&
      storyPlanArrivalReady(item.plan)
      &&(force||arrived>=storyArrivalThreshold(item.plan))
    )
    .sort((a,b)=>storyArrivalRank(a.plan)-storyArrivalRank(b.plan)||a.index-b.index)
    .map(item=>item.plan);
}
function dishForStoryPlan(plan){
  const available=orderableDishes();
  if(plan.guestOrder===false)return available[0]||null;
  if(plan.dishId){
    const dish=dishById(plan.dishId);
    return dishPreparedForService(dish?.id)?dish:null;
  }
  return available.length?available[Math.floor(Math.random()*available.length)]:null;
}

function scheduleOrderRespawn(slot,time=null,forceStory=false){
  if(!Number.isInteger(slot)||slot<0)return false;
  const configured=Number(time);
  const delay=time==null||!Number.isFinite(configured)
    ?generalOrderArrivalDelay()
    :Math.max(.05,configured);
  const existing=state.respawns.find(item=>item.slot===slot);
  if(existing){
    existing.time=Math.min(Number.isFinite(existing.time)?existing.time:delay,delay);
    existing.forceStory=!!(existing.forceStory||forceStory);
    return true;
  }
  state.respawns.push({slot,time:delay,forceStory:!!forceStory});
  return true;
}

function processOrderRespawn(respawn){
  if(!respawn)return false;
  const forceStory=!!respawn.forceStory;
  if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
  const dueStoryPlan=(state.story?.pendingNightGuests||[]).some(plan=>
    typeof storyNightPlanReady==="function"&&storyNightPlanReady(plan)
  );
  // 특별 손님이 다음 도착 순번을 받았으면 빈자리가 생길 때까지 그 순서를
  // 예약합니다. 미니게임 중이라고 일반 손님이 먼저 들어와 추월하지 않습니다.
  if(!forceStory&&dueStoryPlan){
    scheduleOrderRespawn(respawn.slot,.2,false);
    return false;
  }
  // 화면에 대기하는 손님은 특별 손님을 포함해 둘까지 유지합니다.
  if(!forceStory&&state.orders.length>=2){
    scheduleOrderRespawn(respawn.slot,.2,false);
    return false;
  }
  const spawned=spawnOrder(respawn.slot,{forceStory});
  if(!spawned&&(forceStory||waitingForLastStoryGuest())){
    // 마지막 일반 손님의 퇴장 연출이 끝나기 전이라면 시도를 버리지 않습니다.
    scheduleOrderRespawn(respawn.slot,.2,forceStory);
  }
  if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
  return spawned;
}

function ensureNightOrders(){
  if(state.phase!==GAME_PHASES.OPEN)return false;
  normalizeNightOrderCounters();

  // "영업 전" 특별 손님은 오늘의 첫 손님입니다. 해당 손님의 등장 대사가
  // 시작되기 전에는 일반 주문을 먼저 화면에 올리지 않습니다.
  const beforePlanWaiting=(state.story?.pendingNightGuests||[]).some(plan=>
    plan.triggerTiming==="before"&&state.generalServed===0
  );
  const beforeGuestActive=state.orders.some(order=>{
    if(order.customerType!=="story")return false;
    return STORY_SCENES[order.storySceneId]?.triggerTiming==="before";
  });
  if(beforePlanWaiting||beforeGuestActive)return false;

  const dueStoryPlan=(state.story?.pendingNightGuests||[]).some(plan=>
    typeof storyNightPlanReady==="function"&&storyNightPlanReady(plan)
  );
  if(dueStoryPlan)return false;

  const desiredWaiting=Math.min(2,nightGuestsRemaining());
  let waiting=state.orders.length+state.respawns.length;
  let spawned=false;

  while(waiting<desiredWaiting&&state.generalSpawnedCustomers<nightGeneralOrderTarget()){
    const occupied=new Set(state.orders.map(order=>order.slot));
    state.departures.forEach(item=>occupied.add(item.slot));
    state.respawns.forEach(item=>occupied.add(item.slot));
    const freeSlot=randomFreeCustomerSlot(occupied);
    if(freeSlot<0)break;
    if(!spawnOrder(freeSlot,{generalOnly:true}))break;
    waiting=state.orders.length+state.respawns.length;
    spawned=true;
  }
  return spawned;
}

function beginNight() {
  if(state.phase===GAME_PHASES.PREP&&!prepComplete()){
    showToast(`Day ${state.day}의 준비 작업을 모두 완료해야 영업을 시작할 수 있습니다.`,true);return;
  }
  if(state.prepRun){showToast("진행 중인 음식 준비를 먼저 마쳐주세요.",true);return;}
  if(!hasOrderableStock()){showToast("먼저 오늘 선택한 메뉴의 준비를 완료하세요.",true);return;}
  prepareStoryNight();
  state.phase="night";state.phaseTime=null;state.prepRun=null;state.selectedOrderId=null;state.carrying=null;
  resetPlayerPosition();   // 시작 좌표는 player.js PLAYER_START
  state.orders=[];state.respawns=[];state.departures=[];state.spawnedCustomers=0;
  state.generalServed=0;state.generalSpawnedCustomers=0;state.generalSatisfactionTotal=0;
  storyNightEndNoticeShown=false;
  state.nightCustomerTarget=nightGeneralOrderTarget();
  showToast(`밤 영업 시작! 오늘의 일반 주문 목표는 ${state.nightCustomerTarget}건입니다.`);updateUI(true);saveGame();
  queueStoryMoments(["nightStart"],()=>{
    // SCN-D01을 본 뒤 그날의 특별 손님을 먼저 판정합니다. before 손님이
    // 없다면 이 자리에서 기존과 같은 일반 주문 두 건을 채웁니다.
    processStoryNightTrigger();
    ensureNightOrders();
    resumeDeferredStoryOrderScene();
  });
}

function calculateLeftoverLoss(){
  return {count:0,loss:0};
}

function isCookableOrder(order){
  return !!order&&(order.customerType!=="story"||order.guestOrder!==false);
}

function tryEndNight(reason="complete"){
  if(state.phase!=="night")return state.phase==="result";
  normalizeNightOrderCounters();
  if(state.generalServed<nightGeneralOrderTarget())return false;
  const pendingPlans=state.story?.pendingNightGuests||[];
  const unservedStoryOrder=state.orders.some(order=>order.customerType==="story"||order.storySceneId);
  const storyGuestLeaving=state.departures.some(item=>!!item.guestId);
  const generalGuestLeaving=state.departures.some(item=>!item.guestId);
  const unfinishedStory=storyIsActive()
    ||pendingPlans.length>0
    ||unservedStoryOrder
    ||storyGuestLeaving
    ||!!state.story?.pendingResultSceneId;
  if(!unfinishedStory&&!generalGuestLeaving){
    endNight();
    return true;
  }

  // 마지막 일반 손님도 접시를 비우고 반응한 뒤 자리에서 완전히 사라져야
  // 영업 종료 화면으로 넘어갑니다. 이 대기는 특별 손님과 무관하므로
  // 아래의 "특별 손님 이야기" 안내도 띄우지 않습니다.
  if(!unfinishedStory&&generalGuestLeaving)return false;

  if(pendingPlans.length){
    const occupied=new Set(state.orders.map(order=>order.slot));
    const freeSlot=randomFreeCustomerSlot(occupied);
    if(freeSlot>=0){
      state.respawns=state.respawns.filter(respawn=>respawn.slot!==freeSlot);
      processOrderRespawn({slot:freeSlot,forceStory:true});
    }
  }
  if(!storyNightEndNoticeShown){
    storyNightEndNoticeShown=true;
    showToast("오늘의 특별 손님 이야기를 마친 뒤 영업을 종료합니다.");
  }
  return false;
}

function endNight() {
  if(state.phase!=="night")return;
  state.popularityDelta=0;state.popularityBeforeResult=state.popularity;
  state.leftoverCount=0;state.wasteLoss=0;state.discardedCount=0;state.discardLoss=0;state.dailyRevenue=0;
  state.phase="result";state.paused=true;state.mini=null;dom.miniOverlay.classList.remove("open");
  renderNightResult();
  dom.resultOverlay.classList.add("open");audio.serve();updateUI(true);saveGame();
  queueStoryMoments(["nightEnd"]);
}

function renderNightResult(){
  const avg=avgSatisfaction();
  normalizeNightOrderCounters();
  const target=nightGeneralOrderTarget();
  const unserved=Math.max(0,target-state.generalServed);
  dom.servedResult.textContent=`${state.generalServed} / ${target}건`;
  dom.satisfactionResult.textContent=cookingScoreMessage(avg);
  dom.fiveStarResult.textContent=state.fiveStar<=0
    ?"다음에는 더 잘할 수 있어요"
    :state.fiveStar>=state.served
    ?"모든 접시에 정성이 전해졌어요"
    :"기억에 남은 접시가 있었어요";
  const finalDay=state.day>=DayManager.maxDay;
  dom.nextDayButton.textContent=finalDay
    ?state.story?.endingSeen?"엔딩 완료":`Day ${DayManager.maxDay} 완료`
    :"다음 날 준비";
  dom.nextDayButton.disabled=finalDay;

  const tasteTier=cookingScoreTier(avg);
  const tasteComment=tasteTier==="perfect"?"손님들이 완벽한 음식의 맛을 오래 기억할 것 같습니다.":tasteTier==="tasty"?"맛있는 한 끼의 정성이 손님들에게 잘 전해졌습니다.":"조금 아쉬운 맛이었습니다. 재료 품질과 조리 완성도를 더 높여야 합니다.";
  const demandComment=unserved?` 일반 주문 목표까지 ${unserved}건 남았습니다.`:" 오늘의 일반 주문 목표를 모두 마쳤습니다.";
  dom.resultComment.textContent=`${tasteComment}${demandComment}`;
}

function spawnOrder(slot,options={}) {
  if(state.orders.some(order=>order.slot===slot))return false;
  // 막아 둔 자리로 들어온 호출(예전 세이브의 재등장 예약 등)은 열려 있는
  // 자리로 옮겨 앉힙니다. 빈자리가 없으면 등장 자체를 미룹니다.
  if(!(slot>=0&&slot<Math.min(CUSTOMER_SEATS.length,CUSTOMER_USABLE_SEATS))){
    slot=randomFreeCustomerSlot(new Set([
      ...state.orders.map(order=>order.slot),
      ...state.departures.map(item=>item.slot),
      ...state.respawns.map(item=>item.slot)
    ]));
    if(slot<0)return false;
  }
  normalizeNightOrderCounters();
  const forceStory=!!options.forceStory;
  const generalOnly=!!options.generalOnly;

  let plan=null,dish=null;
  const requestedPlan=options.storyPlan;
  const pendingPlans=state.story?.pendingNightGuests||[];
  if(
    !generalOnly
    &&
    requestedPlan
    &&pendingPlans.includes(requestedPlan)
    &&(!Object.prototype.hasOwnProperty.call(requestedPlan,"ready")||requestedPlan.ready===true)
    &&storyPlanArrivalReady(requestedPlan)
  ){
    const plannedDish=dishForStoryPlan(requestedPlan);
    if(plannedDish){plan=requestedPlan;dish=plannedDish;}
  }
  if(requestedPlan&&!plan)return false;
  if(!generalOnly&&!plan)for(const candidate of storyPlansForSpawn(forceStory)){
    const plannedDish=dishForStoryPlan(candidate);
    if(plannedDish){plan=candidate;dish=plannedDish;break;}
  }
  if(!plan){
    // 마지막 이야기 손님은 모든 일반 손님이 떠난 뒤에만 등장합니다.
    // 그 시점까지 빈 좌석을 새 일반 손님으로 채우면 대본 순서가 뒤집힙니다.
    if(forceStory||waitingForLastStoryGuest())return false;
    if(state.generalSpawnedCustomers>=nightGeneralOrderTarget())return false;
    dish=dishForNextGeneralOrder();
  }
  if(!generalOnly&&!dish&&(state.story?.pendingNightGuests?.length||0)){
    for(const candidate of storyPlansForSpawn(true)){
      const plannedDish=dishForStoryPlan(candidate);
      if(plannedDish){plan=candidate;dish=plannedDish;break;}
    }
  }
  if(!dish)return false;

  // 이야기 손님은 방금 일어난 손님의 퇴장 연출이나 이미 예약된 재등장과
  // 같은 좌석을 공유하지 않습니다. 호출자가 고른 자리가 전환 중이면 다른
  // 빈 좌석을 찾아 등장시켜 캐릭터가 겹치는 현상을 막습니다.
  if(plan){
    const transitioning=new Set([
      ...state.orders.map(order=>order.slot),
      ...state.departures.map(item=>item.slot),
      ...state.respawns.map(item=>item.slot)
    ]);
    if(transitioning.has(slot)){
      slot=randomFreeCustomerSlot(transitioning);
      if(slot<0)return false;
    }
  }else if(state.departures.some(item=>item.slot===slot)){
    return false;
  }

  const generalEntranceIndex=Math.max(0,Math.floor(Number(state.generalSpawnedCustomers)||0));
  const order=decorateStoryOrder({
    // variant = 일반 손님 그림 번호. 종류 수는 customers.js 가 정합니다.
    id:nextOrderId++,slot,dishId:dish.id,variant:Math.floor(Math.random()*CUSTOMER_VARIANT_COUNT),
    entered:0,
    // 일반 손님과 같은 프레임에 예약된 특별 손님도 화면에서는 그 다음에
    // 들어오도록 짧게 늦춥니다. 영업 전 첫 손님과 마지막 손님은 바로 나타납니다.
    entryDelay:plan&&plan.triggerTiming!=="before"&&plan.arrival!=="last"
      ?.65
      :(plan||generalEntranceIndex===0)?0:generalOrderEntranceDelay(),
    entrySpeed:plan?2.1:generalOrderEntranceSpeed(),
    cookStep:0,cookScores:[],discardedOnce:false
  },plan);
  state.orders.push(order);
  state.spawnedCustomers++;
  if(order.customerType!=="story")state.generalSpawnedCustomers++;
  syncSelectedOrderToQueue();
  if(order.deferUntilArrival&&!spawningInitialNightOrders){
    saveGame(true);
    resumeDeferredStoryOrderScene();
  }
  if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
  return true;
}

function ordersInArrivalOrder(){
  return state.orders
    .map((order,index)=>({order,index}))
    .sort((a,b)=>(Number(a.order.id)||0)-(Number(b.order.id)||0)||a.index-b.index)
    .map(item=>item.order);
}

function alreadyStartedOrder(){
  const activeId=state.carrying?.orderId
    ??state.mini?.context?.orderId
    ??(typeof activeStoryCookOrderId==="function"?activeStoryCookOrderId():null);
  if(activeId!=null)return state.orders.find(order=>order.id===activeId)||null;
  const selected=state.orders.find(order=>order.id===state.selectedOrderId);
  return selected&&(Number(selected.cookStep)||0)>0?selected:null;
}

function syncSelectedOrderToQueue(){
  // 이미 시작한 접시만 마저 끝낼 수 있게 두고, 새 접시는 언제나 가장 먼저
  // 들어온 손님부터 처리합니다. 특별 손님도 일반 손님을 추월하지 않습니다.
  const order=alreadyStartedOrder()||ordersInArrivalOrder()[0]||null;
  const cookable=isCookableOrder(order)?order:null;
  state.selectedOrderId=cookable?.id??null;
  return cookable;
}

function currentOrder(){return syncSelectedOrderToQueue();}

function renderNightOrderList(){
  const activeOrders=ordersInArrivalOrder();
  syncSelectedOrderToQueue();
  const signature=`open|${state.selectedOrderId}|${state.carrying?.orderId||0}|${activeOrders.map(order=>
    `${order.id}:${order.cookStep}:${order.guestOrder?1:0}:${order.specialRecipe?1:0}:${order.guestId?storyDisplayName(order.guestId):""}`
  ).join(",")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  if(!activeOrders.length){
    dom.inventoryList.innerHTML='<div class="order-empty">현재 대기 중인 주문이 없습니다.</div>';
    return;
  }
  // drag-scroll : 좌측 패널이 최대 높이에 걸리면 잡고 끌어 굴릴 수 있게 합니다.
  //               (동작은 hud-list-drag-scroll.js, 자리는 css/hud.css)
  dom.inventoryList.innerHTML=`<div class="order-list drag-scroll">${activeOrders.map((order,index)=>{
    const cookable=isCookableOrder(order),dish=cookable?dishById(order.dishId):null;
    const selected=order.id===state.selectedOrderId;
    const name=dish?.name||storyOrderLabel(order);
    const status=state.carrying?.orderId===order.id
      ?"완성 · 제공 대기"
      :!cookable
        ?index===0?"대화 대기":`${index+1}번째 차례 · 대기`
        :order.cookStep?`조리 ${order.cookStep}/${dish.cook.length}`
        :selected?"현재 차례 · 조리 대기":`${index+1}번째 차례 · 대기`;
    return `<div class="order-row ${selected?"selected":""}"${selected?' aria-current="true"':""}><span>${index+1}</span><strong>${name}</strong>${order.specialRecipe?'<small class="special-order">특별</small>':""}<em>${status}</em></div>`;
  }).join("")}</div>`;
}

function startCookMini(stationId) {
  const order=currentOrder();if(!order)return;
  const dish=dishById(order.dishId);
  if(!dishPreparedForService(dish.id)){showToast(`${dish.name} 준비를 먼저 완료하세요.`,true);return;}
  const step=dish.cook[order.cookStep];
  startMini(step.game,stationId,{mode:"cook",orderId:order.id,dishId:dish.id,special:!!order.specialRecipe,guestId:order.guestId||null});
}

function tryDeliver() {
  if(!state.carrying)return;
  const order=state.orders.find(o=>o.id===state.carrying.orderId);if(!order)return;
  const x=CUSTOMER_SEATS[order.slot],y=CUSTOMER_SERVICE_Y;
  if(distance(state.player.x,state.player.y,x,y)>CUSTOMER_SERVE_REACH){showToast("주문한 손님 바로 앞까지 음식을 가져가세요.",true);return;}
  serveOrder(order);
}

function discardCarriedDish(){
  if(state.phase!==GAME_PHASES.OPEN||state.paused||state.mini||!state.carrying)return false;
  const trash=nearestStation("trash");
  if(!trash||trash.id!=="trash")return false;
  const order=state.orders.find(item=>item.id===state.carrying.orderId);
  const dish=dishById(state.carrying.dishId);
  if(!order||!dish)return false;

  // 폐기는 음식 종류가 아니라 현재 손님의 주문 한 접시를 기준으로 한 번만
  // 허용합니다. 같은 메뉴를 주문한 다음 손님은 자기 주문에서 다시 한 번
  // 폐기할 수 있고, 구 저장처럼 필드가 없으면 아직 폐기하지 않은 상태입니다.
  if(order.discardedOnce===true){
    showToast(UI_TEXT.toast.discardLimit(dish.name),true);
    return false;
  }

  order.discardedOnce=true;
  order.cookStep=0;
  order.cookScores=[];
  state.carrying=null;
  syncSelectedOrderToQueue();
  if(typeof playTrashDiscardAnimation==="function")playTrashDiscardAnimation();
  showToast(UI_TEXT.toast.discardDone(dish.name));
  updateUI(true);
  saveGame(storyCookingIsActive());
  return true;
}

/* 최종 평가는 밤에 실제로 완성한 조리 점수만 사용합니다.
   낮 준비 점수는 준비 과정의 피드백으로만 남고 손님의 반응이나
   특별 손님 결과를 올리거나 내리지 않습니다. */
function satisfactionScore(cookScore){
  return Math.round(clamp(Number(cookScore)||0,0,100));
}

function serveOrder(order) {
  const dish=dishById(order.dishId);
  const cookScore=state.carrying.cookScore;
  const satisfaction=satisfactionScore(cookScore);
  const isStoryOrder=order.customerType==="story";
  // 일반·이야기 손님 모두 밤 조리 점수만으로 한 접시를 평가합니다.
  const serviceScore=satisfaction;
  const stars=clamp(Math.ceil(serviceScore/20),1,5);
  state.served++;
  if(!isStoryOrder){
    state.generalServed++;
    state.generalSatisfactionTotal=(Number(state.generalSatisfactionTotal)||0)+serviceScore;
  }
  state.satisfactionTotal+=serviceScore;if(stars===5)state.fiveStar++;
  const storyResult=applyStoryCookingResult(order,serviceScore);
  const resumedStory=finishSuspendedStoryCook(order,serviceScore);
  const mismatchedStoryDish=storyResult?.matched===false;
  if(!isStoryOrder){
    const tier=storyCookingTier(serviceScore);
    state.departures.push({
      slot:order.slot,variant:order.variant,guestId:null,
      bubble:pickGeneralGuestBubble(tier),life:3.2,
      stars,satisfaction:serviceScore
    });
  }
  state.orders=state.orders.filter(o=>o.id!==order.id);state.carrying=null;
  syncSelectedOrderToQueue();
  const hasRemainingGeneral=state.generalSpawnedCustomers<nightGeneralOrderTarget();
  const hasPendingStory=!!(state.story?.pendingNightGuests?.length||0);
  const storyGuestIsDue=hasPendingStory&&(state.story.pendingNightGuests||[]).some(plan=>
    typeof storyNightPlanReady==="function"&&storyNightPlanReady(plan)
  );
  if(hasRemainingGeneral||hasPendingStory){
    // 일반 손님만 새 랜덤 간격을 쓰고, 특별 손님의 기존 3.1초 연출 호흡은 유지합니다.
    scheduleOrderRespawn(order.slot,hasRemainingGeneral&&!storyGuestIsDue?null:3.1);
  }
  showToast(mismatchedStoryDish
    ?`${storyResult.name}에게 내어 준 음식이 찾던 음식과 달랐습니다. 들은 단서를 영업일지에 남깁니다.`
    :storyResult
    ?`${storyResult.name}${storyResult.special?"의 특별 조리를 마쳤습니다.":"에게 한 접시를 내었습니다."}`
    :`${dish.name} 제공 완료`);
  audio.serve();updateUI(true);
  if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
  // 주문 조리 대사가 재개된 경우에는 장면 완료 시점에 저장합니다.
  // 그 전에는 조리 직전 저장을 남겨 두어, 재접속 때 주문 없는 미완료 장면이 생기지 않게 합니다.
  if(!resumedStory)saveGame();
}

/* 밤 우측 HUD = "지금 뭘, 어디서" 두 줄.
   ------------------------------------------------------------
   낮 패널(day.js updateDayObjective)과 같은 규칙으로 정리했습니다 —
   화면 어딘가에 이미 있는 것은 여기에 두 번 쓰지 않습니다.
     시간제한 없음      애초에 규칙이 아닙니다. 없는 제약을 굳이 알릴 이유가
                       없어서 아예 뺐습니다.
     일반 주문 n / m건   상단 HUD 「남은 손님」 칸과 같은 수입니다(game.js).
     n번 손님           좌측 「현재 주문」 목록이 줄마다 번호를 답니다
                       (renderNightOrderList). 서빙할 때 자리 번호는 E 프롬프트가
                       알려 줍니다(ui-hud.js serve). 머리 위 자리 번호는 이미
                       같은 이유로 빠졌습니다(customers.js).
   그래서 요리 이름과 조리대만 남깁니다. 특별 손님 이름은 번호와 달리 그 자체가
   정보라서 (누구에게 내는 접시인지) 운반 안내에만 남겨 둡니다. */
function updateNightObjective(){
  normalizeNightOrderCounters();
  const order=currentOrder();dom.objectiveTitle.textContent="현재 목표";
  if(state.carrying){
    const o=state.orders.find(x=>x.id===state.carrying.orderId),d=dishById(state.carrying.dishId);
    // 일반 손님은 "3번 손님" 이 아니라 그냥 손님입니다. 어느 자리인지는
    // 가까이 가면 E 프롬프트가 자리 번호로 짚어 줍니다.
    const target=o?.guestId?`${storyOrderLabel(o)} 앞으로`:"주문한 손님 앞으로";
    dom.objectiveBody.innerHTML=`
      <div class="prep-summary">
        <strong>${d.name} 완성</strong>
        <div>${target} 가져가세요.</div>
      </div>`;
    return;
  }
  if(!order){
    // 마지막 일반 손님이 식사하고 반응을 남기는 동안에는 새 손님을
    // 기다린다는 안내를 띄우지 않습니다. 반응이 끝나면 곧바로 마감 또는
    // 마지막 특별 손님 등장 흐름으로 넘어갑니다.
    const lastGeneralGuestLeaving=state.generalServed>=nightGeneralOrderTarget()
      &&state.departures.some(item=>!item.guestId);
    if(lastGeneralGuestLeaving){
      // 예전에는 진행 수만 남겼는데, 그 줄을 빼고 나니 판이 통째로 비었습니다.
      dom.objectiveBody.innerHTML=`
        <div class="prep-summary">
          <strong>마무리</strong>
          <div>마지막 손님이 식사를 마치는 중입니다.</div>
        </div>`;
      return;
    }
    const storyVisitor=state.orders.some(item=>item.customerType==="story"&&!isCookableOrder(item));
    dom.objectiveBody.innerHTML=`
      <div class="prep-summary">
        <strong>대기</strong>
        <div>${storyVisitor?"특별 손님이 자신의 차례를 기다리고 있습니다.":"다음 손님을 기다리고 있습니다."}</div>
      </div>`;
    return;
  }
  const d=dishById(order.dishId),step=d.cook[order.cookStep];
  const special=order.specialRecipe?'<small class="special-order"> · 특별 조리</small>':"";
  /* 조리 단계 칸은 **두 단계 이상일 때만** 답니다. 지금 메뉴는 전부 한 단계라
     (game-data.js MENU_DATA 의 cook 배열) 늘 달면 바로 위 「조리대」 줄과 똑같은
     칸 하나가 붙을 뿐입니다. 여러 단계짜리 메뉴가 생기면 저절로 다시 나옵니다. */
  const steps=d.cook.length>1
    ?`<div class="recipe-steps">${d.cook.map((s,i)=>
        `<div class="recipe-step ${i<order.cookStep?"done":i===order.cookStep?"current":""}"><span>${i+1}</span><span>${stationById(s.station).label}</span></div>`).join("")}</div>`
    :"";
  /* 「요리 김치전 | 조리대 프라이팬」 — 네 줄이던 것을 **한 줄**에 둡니다
     (.objective-line). 구분선 | 은 CSS 가 넣습니다.
     이름과 값을 한 묶음(.objective-pair)에 넣는 것이 핵심입니다 — 같은 줄상자
     안에 있어야 도트 글꼴 두 벌(이름=굵은 글꼴 · 값=본문 글꼴)의 밑선이 맞습니다.
     따로 떼어 격자 칸에 앉히면 「요리」만 아래로 처져 보였습니다.
     줄어든 만큼 판 아래가 비는데, 그 자리는 index.html 의 점수 기준 칸이 씁니다. */
  dom.objectiveBody.innerHTML=`
    <div class="prep-summary objective-line">
      <span class="objective-pair"><strong>요리</strong><span>${d.name}${special}</span></span>
      <span class="objective-pair"><strong>조리대</strong><span>${stationById(step.station).label}</span></span>
      ${steps}
    </div>`;
}
