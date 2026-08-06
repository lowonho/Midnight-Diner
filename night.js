"use strict";

// 밤 영업은 시간제한 없이 그날의 일반 주문 목표를 채우면 마감합니다.
// QA 코드가 참조하는 이름은 유지하되 실제 타이머로 사용하지 않습니다.
const NIGHT_DURATION=0;
let spawningInitialNightOrders=false;
let storyNightEndNoticeShown=false;

function nightGeneralOrderTarget(day=state.day){
  const configured=Number(DAY_DATA[Number(day)]?.generalOrderTarget);
  return Number.isFinite(configured)?Math.max(0,Math.floor(configured)):0;
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

function updateNightOrderEntrances(dt,storyOnly=false){
  state.orders.forEach(order=>{
    if(storyOnly&&order.customerType!=="story")return;
    order.entered=clamp((Number(order.entered)||0)+dt*2.1,0,1);
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
  return plans
    .map((plan,index)=>({plan,index}))
    .filter(item=>
      (!Object.prototype.hasOwnProperty.call(item.plan,"ready")||item.plan.ready===true)
      &&
      storyPlanArrivalReady(item.plan)
      &&(force||state.generalServed>=storyArrivalThreshold(item.plan))
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

function scheduleOrderRespawn(slot,time=3.1,forceStory=false){
  if(!Number.isInteger(slot)||slot<0)return false;
  const delay=Math.max(.05,Number(time)||.05);
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

  const remaining=Math.max(0,nightGeneralOrderTarget()-state.generalServed);
  const desiredWaiting=Math.min(2,remaining);
  const activeGeneral=state.orders.filter(order=>order.customerType!=="story").length;
  const queuedGeneral=state.respawns.filter(respawn=>!respawn.forceStory).length;
  let waiting=activeGeneral+queuedGeneral;
  let spawned=false;

  while(waiting<desiredWaiting&&state.generalSpawnedCustomers<nightGeneralOrderTarget()){
    const occupied=new Set(state.orders.map(order=>order.slot));
    state.departures.forEach(item=>occupied.add(item.slot));
    state.respawns.forEach(item=>occupied.add(item.slot));
    const freeSlot=CUSTOMER_SEATS.findIndex((_,slot)=>!occupied.has(slot));
    if(freeSlot<0)break;
    if(!spawnOrder(freeSlot,{generalOnly:true}))break;
    waiting++;
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
  state.generalServed=0;state.generalSpawnedCustomers=0;
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
  const unfinishedStory=storyIsActive()
    ||pendingPlans.length>0
    ||unservedStoryOrder
    ||storyGuestLeaving
    ||!!state.story?.pendingResultSceneId;
  if(!unfinishedStory){
    endNight();
    return true;
  }

  if(pendingPlans.length){
    const occupied=new Set(state.orders.map(order=>order.slot));
    const freeSlot=CUSTOMER_SEATS.findIndex((_,slot)=>!occupied.has(slot));
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
  dom.satisfactionResult.textContent=`${avg}점`;
  dom.fiveStarResult.textContent=state.fiveStar;
  const finalDay=state.day>=DayManager.maxDay;
  dom.nextDayButton.textContent=finalDay
    ?state.story?.endingSeen?"엔딩 완료":`Day ${DayManager.maxDay} 완료`
    :"다음 날 준비";
  dom.nextDayButton.disabled=finalDay;

  const tasteComment=avg>=90?"손님들이 음식의 맛을 오래 기억할 것 같습니다.":avg>=75?"정성스러운 맛이 손님들에게 잘 전해졌습니다.":"재료 품질과 조리 완성도를 더 높여야 합니다.";
  const demandComment=unserved?` 일반 주문 목표까지 ${unserved}건 남았습니다.`:" 오늘의 일반 주문 목표를 모두 마쳤습니다.";
  dom.resultComment.textContent=`${tasteComment}${demandComment}`;
}

function spawnOrder(slot,options={}) {
  if(state.orders.some(order=>order.slot===slot))return false;
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
    const available=orderableDishes();
    if(available.length)dish=available[Math.floor(Math.random()*available.length)];
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
      slot=CUSTOMER_SEATS.findIndex((_,candidate)=>!transitioning.has(candidate));
      if(slot<0)return false;
    }
  }else if(state.departures.some(item=>item.slot===slot)){
    return false;
  }

  const order=decorateStoryOrder({
    id:nextOrderId++,slot,dishId:dish.id,variant:Math.floor(Math.random()*6),
    entered:0,cookStep:0,cookScores:[]
  },plan);
  state.orders.push(order);
  state.spawnedCustomers++;
  if(order.customerType!=="story")state.generalSpawnedCustomers++;
  // 특별 손님이 주문할 수 있는 상태로 등장하면 남아 있던 일반 주문보다
  // 먼저 처리합니다. 이야기 직후 목표가 다시 일반 손님을 가리키면 중요한
  // 방문이 묻히므로, 등장 시점에 선택을 넘기고 떠날 때까지 우선권을 둡니다.
  if(order.customerType==="story"&&isCookableOrder(order))state.selectedOrderId=order.id;
  else if(state.selectedOrderId==null&&isCookableOrder(order))state.selectedOrderId=order.id;
  if(order.deferUntilArrival&&!spawningInitialNightOrders){
    saveGame(true);
    resumeDeferredStoryOrderScene();
  }
  if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
  return true;
}

function selectOrder(id) {
  if(state.carrying){showToast("먼저 들고 있는 음식을 주문한 손님에게 가져다주세요.",true);return;}
  const priorityStoryOrder=state.orders.find(order=>order.customerType==="story"&&isCookableOrder(order));
  if(priorityStoryOrder&&id!==priorityStoryOrder.id){
    state.selectedOrderId=priorityStoryOrder.id;
    showToast("먼저 이야기 손님의 주문을 준비해 주세요.");
    updateUI(true);
    return;
  }
  const lockedOrderId=activeStoryCookOrderId();
  if(lockedOrderId!=null&&id!==lockedOrderId){showToast("먼저 이야기 손님의 주문을 완성해 주세요.");return;}
  const order=state.orders.find(o=>o.id===id&&isCookableOrder(o));if(!order)return;
  state.selectedOrderId=id;updateUI(true);saveGame();
}

function currentOrder(){return state.orders.find(o=>o.id===state.selectedOrderId&&isCookableOrder(o))||null;}

function renderNightOrderList(){
  const activeOrders=state.orders.filter(isCookableOrder);
  const signature=`open|${state.selectedOrderId}|${state.carrying?.orderId||0}|${activeOrders.map(order=>
    `${order.id}:${order.cookStep}:${order.specialRecipe?1:0}:${order.guestId?storyDisplayName(order.guestId):""}`
  ).join(",")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  if(!activeOrders.length){
    dom.inventoryList.innerHTML='<div class="order-empty">현재 대기 중인 주문이 없습니다.</div>';
    return;
  }
  dom.inventoryList.innerHTML=`<div class="order-list">${activeOrders.map(order=>{
    const dish=dishById(order.dishId),selected=order.id===state.selectedOrderId;
    const status=state.carrying?.orderId===order.id?"완성 · 제공 대기":order.cookStep?`조리 ${order.cookStep}/${dish.cook.length}`:"조리 대기";
    return `<button class="order-row ${selected?"selected":""}" data-order-id="${order.id}" type="button"><span>${order.slot+1}</span><strong>${dish.name}</strong>${order.specialRecipe?'<small class="special-order">특별</small>':""}<em>${status}</em></button>`;
  }).join("")}</div>`;
  dom.inventoryList.querySelectorAll("[data-order-id]").forEach(button=>button.addEventListener("click",()=>selectOrder(Number(button.dataset.orderId))));
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
  if(distance(state.player.x,state.player.y,x,y)>82){showToast("주문한 손님 앞까지 음식을 가져가세요.",true);return;}
  serveOrder(order);
}

/* 만족도 = 준비 품질 + 조리 점수. 청결도 항목(0.05)이 있었지만 청결도
   시스템을 걷어내면서 남은 두 항목에 나눠 얹어 만점 100 을 유지합니다.
   여기와 updateNightObjective 의 예상 만족도가 늘 같은 식이어야 합니다. */
function satisfactionScore(inv,cookScore){
  return Math.round(clamp(inv.quality*.58+cookScore*.42,0,100));
}

function serveOrder(order) {
  const dish=dishById(order.dishId),inv=state.inventory[dish.id];
  const cookScore=state.carrying.cookScore;
  const satisfaction=satisfactionScore(inv,cookScore);
  const isStoryOrder=order.customerType==="story";
  // 일반·이야기 손님 모두 낮에 준비한 재료 품질과 밤 조리 점수를 합쳐
  // 한 접시의 최종 평가를 냅니다. 그래야 낮 준비 실력이 특별 손님의
  // 기억과 달빛 조각 결과에도 실제로 이어집니다.
  const serviceScore=satisfaction;
  const stars=clamp(Math.ceil(serviceScore/20),1,5);
  state.served++;
  if(!isStoryOrder)state.generalServed++;
  state.satisfactionTotal+=serviceScore;if(stars===5)state.fiveStar++;
  const storyResult=applyStoryCookingResult(order,serviceScore);
  const resumedStory=finishSuspendedStoryCook(order,serviceScore);
  const tier=storyCookingTier(serviceScore);
  const departureText=storyResult?.text||pickGeneralGuestBubble(tier);
  state.departures.push({slot:order.slot,variant:order.variant,guestId:order.guestId||null,bubble:departureText,life:3.2,stars,satisfaction:serviceScore});
  state.orders=state.orders.filter(o=>o.id!==order.id);state.carrying=null;
  state.selectedOrderId=state.orders.find(isCookableOrder)?.id||null;
  if(state.generalSpawnedCustomers<nightGeneralOrderTarget()||(state.story?.pendingNightGuests?.length||0))scheduleOrderRespawn(order.slot,3.1);
  spawnPopup(CUSTOMER_SEATS[order.slot],500,`${"★".repeat(stars)} ${serviceScore}점`);
  showToast(storyResult
    ?`${storyResult.name}${storyResult.special?"의 특별 조리":"에게 한 접시 제공"} · 만족도 ${serviceScore}점`
    :`${dish.name} 제공 · 만족도 ${serviceScore}점`);
  audio.serve();updateUI(true);
  if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
  // 주문 조리 대사가 재개된 경우에는 장면 완료 시점에 저장합니다.
  // 그 전에는 조리 직전 저장을 남겨 두어, 재접속 때 주문 없는 미완료 장면이 생기지 않게 합니다.
  if(!resumedStory)saveGame();
}

function autoDelivery(){if(state.phase!=="night"||!state.carrying||state.mini)return;const order=state.orders.find(o=>o.id===state.carrying.orderId);if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],CUSTOMER_SERVICE_Y)<64)serveOrder(order);}

function updateNightObjective(){
  normalizeNightOrderCounters();
  const progress=`일반 주문 ${state.generalServed} / ${nightGeneralOrderTarget()}건 · 시간제한 없음`;
  const order=currentOrder();dom.objectiveTitle.textContent="손님 주문";
  if(state.carrying){
    const o=state.orders.find(x=>x.id===state.carrying.orderId),d=dishById(state.carrying.dishId),inv=state.inventory[d.id];
    const storyOrder=o?.customerType==="story";
    const expected=satisfactionScore(inv,state.carrying.cookScore);
    const expectedLabel=storyOrder?"예상 평가":"예상 만족도";
    dom.objectiveBody.innerHTML=`<div><strong>${progress}</strong></div><div><strong>${d.name}</strong> 완성 · 조리 ${state.carrying.cookScore}점 · ${expectedLabel} ${expected}점</div><div>${o?storyOrderLabel(o):"손님"} 앞으로 가져가세요.</div>`;
    return;
  }
  if(!order){
    const storyVisitor=state.orders.some(item=>item.customerType==="story"&&!isCookableOrder(item));
    dom.objectiveBody.innerHTML=`<div><strong>${progress}</strong></div><div>${storyVisitor?"특별 손님과 이야기를 나누고 있습니다.":"다음 손님을 기다리고 있습니다."}</div>`;
    return;
  }
  const d=dishById(order.dishId),step=d.cook[order.cookStep];
  const special=order.specialRecipe?" · 특별 조리":"";
  dom.objectiveBody.innerHTML=`<div><strong>${progress}</strong></div><div><strong>${storyOrderLabel(order)} · ${d.name}${special}</strong></div><div><strong>${stationById(step.station).label}</strong>에서 조리하세요.</div><div class="recipe-steps">${d.cook.map((s,i)=>`<div class="recipe-step ${i<order.cookStep?"done":i===order.cookStep?"current":""}"><span>${i+1}</span><span>${stationById(s.station).label}</span></div>`).join("")}</div>`;
}
