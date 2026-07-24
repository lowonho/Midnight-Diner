"use strict";

// 밤 영업 단계 전용 로직. 인기도 10점당 평균 손님이 1명씩 늘어납니다.
const NIGHT_DURATION=150;
const LEFTOVER_LOSS_RATE=.30;

function expectedCustomerCenter(popularity){return clamp(4+Math.round(popularity/10),4,14);}
function expectedCustomerRange(popularity){
  const center=expectedCustomerCenter(popularity);
  return [Math.max(2,center-2),center+2];
}
function rollNightCustomerCount(popularity){
  const [min,max]=expectedCustomerRange(popularity);
  const center=expectedCustomerCenter(popularity);
  return clamp(Math.round(center+(Math.random()+Math.random()-1)*2),min,max);
}
function wasteLossForDish(dish){return Math.round(dish.price*LEFTOVER_LOSS_RATE/100)*100;}
function reservedStock(dishId){
  const dish=dishById(dishId);
  return state.orders.filter(order=>order.dishId===dishId&&order.cookStep<dish.cook.length).length;
}
function orderableDishes(){
  return DISHES.filter(dish=>dish.isImplemented&&state.selectedMenus.includes(dish.id)&&state.inventory[dish.id]?.count>reservedStock(dish.id));
}
function hasOrderableStock(){return orderableDishes().length>0;}

function beginNight() {
  const total=Object.values(state.inventory).reduce((sum,item)=>sum+item.count,0);
  if(state.prepRun){showToast("진행 중인 음식 준비를 먼저 마쳐주세요.",true);return;}
  if(total===0){showToast("먼저 한 가지 이상의 메뉴를 준비하세요.",true);return;}
  prepareStoryNight();
  if(total<state.story.pendingNightGuests.length){
    state.story.pendingNightGuests=state.story.pendingNightGuests.filter(plan=>!plan.repeat);
  }
  const requiredStoryGuests=state.story.pendingNightGuests.filter(plan=>!plan.repeat).length;
  if(total<requiredStoryGuests){
    state.story.pendingNightGuests=[];
    showToast(`오늘 이야기 손님을 맞이하려면 최소 ${requiredStoryGuests}인분을 준비해 주세요.`,true);
    return;
  }
  state.phase="night";state.phaseTime=NIGHT_DURATION;state.prepRun=null;state.selectedOrderId=null;state.carrying=null;
  resetPlayerPosition();   // 시작 좌표는 player.js PLAYER_START
  state.orders=[];state.respawns=[];state.departures=[];state.spawnedCustomers=0;
  const plannedGuests=state.story.pendingNightGuests.length;
  state.nightCustomerTarget=Math.max(rollNightCustomerCount(state.popularity),plannedGuests);
  const initialCustomers=Math.min(CUSTOMER_SEATS.length,state.nightCustomerTarget,Math.max(2,plannedGuests));
  for(let slot=0;slot<initialCustomers;slot++)spawnOrder(slot);
  showToast(`밤 영업 시작! 오늘은 약 ${state.nightCustomerTarget}명의 손님이 방문합니다.`);audio.success();updateUI(true);saveGame();
  queueStoryMoments(["nightStart"]);
}

function calculateLeftoverLoss(){
  let count=state.discardedCount||0,loss=state.discardLoss||0;
  DISHES.forEach(dish=>{
    const portions=state.inventory[dish.id].count;
    count+=portions;
    loss+=wasteLossForDish(dish)*portions;
  });
  if(state.carrying){
    const dish=dishById(state.carrying.dishId);
    count++;
    loss+=wasteLossForDish(dish);
  }
  return {count,loss};
}

function endNight() {
  if(state.phase!=="night")return;
  const avg=avgSatisfaction();
  const unserved=Math.max(0,state.nightCustomerTarget-state.served);
  const serveRate=state.nightCustomerTarget?state.served/state.nightCustomerTarget:0;
  const beforePopularity=state.popularity;
  state.popularityBeforeResult=beforePopularity;
  state.popularityDelta=state.served?Math.round(clamp(((avg-75)/7)*serveRate+(serveRate-.8)*3,-5,5)):-5;
  state.popularity=clamp(state.popularity+state.popularityDelta,0,100);

  const leftover=calculateLeftoverLoss();
  state.leftoverCount=leftover.count;state.wasteLoss=leftover.loss;state.money-=state.wasteLoss;
  state.phase="result";state.paused=true;state.mini=null;dom.miniOverlay.classList.remove("open");
  renderNightResult();
  dom.resultOverlay.classList.add("open");audio.serve();updateUI(true);saveGame();
  queueStoryMoments(["nightEnd"]);
}

function renderNightResult(){
  const avg=avgSatisfaction();
  const unserved=Math.max(0,state.nightCustomerTarget-state.served);
  const beforePopularity=Number.isFinite(state.popularityBeforeResult)?state.popularityBeforeResult:state.popularity-state.popularityDelta;
  const netProfit=state.dailyRevenue-state.wasteLoss;
  dom.servedResult.textContent=`${state.served} / ${state.nightCustomerTarget}명`;
  dom.satisfactionResult.textContent=`${avg}점`;
  dom.fiveStarResult.textContent=state.fiveStar;
  dom.popularityResult.textContent=`${beforePopularity} → ${state.popularity} (${state.popularityDelta>=0?"+":""}${state.popularityDelta})`;
  const discardNote=state.discardedCount?` (직접 폐기 ${state.discardedCount}인분)`:"";
  dom.wasteResult.textContent=state.leftoverCount?`${state.wasteLoss.toLocaleString()}원 · ${state.leftoverCount}인분${discardNote}`:"0원";
  dom.revenueResult.textContent=`${netProfit.toLocaleString()}원`;
  dom.nextDayButton.textContent=state.day>=DayManager.maxDay?"Day 7 완료":"다음 날 준비";
  dom.nextDayButton.disabled=state.day>=DayManager.maxDay;

  const tasteComment=avg>=90?"손님들이 음식의 맛을 오래 기억할 것 같습니다.":avg>=75?"정성스러운 맛이 손님들에게 잘 전해졌습니다.":"재료 품질과 조리 완성도를 더 높여야 합니다.";
  const demandComment=unserved?` 예상 손님 중 ${unserved}명을 받지 못했습니다.`:" 오늘의 손님을 모두 맞이했습니다.";
  dom.resultComment.textContent=`${tasteComment}${demandComment} 매출 ${state.dailyRevenue.toLocaleString()}원에서 폐기·재고 손실 ${state.wasteLoss.toLocaleString()}원이 차감되었습니다.`;
}

function spawnOrder(slot) {
  if(state.spawnedCustomers>=state.nightCustomerTarget)return false;
  const available=orderableDishes();
  if(!available.length)return false;
  const dish=available[Math.floor(Math.random()*available.length)];
  const order=decorateStoryOrder({id:nextOrderId++,slot,dishId:dish.id,variant:Math.floor(Math.random()*6),entered:0,cookStep:0,cookScores:[]});
  state.orders.push(order);
  state.spawnedCustomers++;
  if(state.selectedOrderId==null)state.selectedOrderId=state.orders[state.orders.length-1].id;
  return true;
}

function selectOrder(id) {
  if(state.carrying){showToast("먼저 들고 있는 음식을 주문한 손님에게 가져다주세요.",true);return;}
  const lockedOrderId=activeStoryCookOrderId();
  if(lockedOrderId!=null&&id!==lockedOrderId){showToast("먼저 이야기 손님의 특별 조리를 완성해 주세요.");return;}
  const order=state.orders.find(o=>o.id===id);if(!order)return;
  state.selectedOrderId=id;audio.click();updateUI(true);saveGame();
}

function currentOrder(){return state.orders.find(o=>o.id===state.selectedOrderId)||null;}

function renderNightOrderList(){
  const signature=`open|${state.selectedOrderId}|${state.carrying?.orderId||0}|${state.orders.map(order=>`${order.id}:${order.cookStep}`).join(",")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  if(!state.orders.length){
    dom.inventoryList.innerHTML='<div class="order-empty">현재 대기 중인 주문이 없습니다.</div>';
    return;
  }
  dom.inventoryList.innerHTML=`<div class="order-list">${state.orders.map(order=>{
    const dish=dishById(order.dishId),selected=order.id===state.selectedOrderId;
    const status=state.carrying?.orderId===order.id?"완성 · 제공 대기":order.cookStep?`조리 ${order.cookStep}/${dish.cook.length}`:"조리 대기";
    return `<button class="order-row ${selected?"selected":""}" data-order-id="${order.id}" type="button"><span>${order.slot+1}</span><strong>${dish.name}</strong>${order.specialRecipe?'<small class="special-order">특별</small>':""}<em>${status}</em></button>`;
  }).join("")}</div>`;
  dom.inventoryList.querySelectorAll("[data-order-id]").forEach(button=>button.addEventListener("click",()=>selectOrder(Number(button.dataset.orderId))));
}

function startCookMini(stationId) {
  const order=currentOrder();if(!order)return;
  const dish=dishById(order.dishId);
  if(state.inventory[dish.id].count<=0){showToast(`${dish.name} 준비 재료가 모두 소진되었습니다.`,true);return;}
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

function discardCarriedDish(){
  if(state.phase!=="night"||!state.carrying)return false;
  const carrying=state.carrying;
  const order=state.orders.find(item=>item.id===carrying.orderId);
  const dish=dishById(carrying.dishId);
  if(!order||!dish){
    state.carrying=null;
    showToast("완성 음식의 주문 정보를 찾지 못해 손에서 내려놓았습니다.",true);
    updateUI(true);saveGame();
    return false;
  }

  const inventory=state.inventory[dish.id];
  if(!inventory||inventory.count<=0){
    showToast(`${dish.name} 재조리에 쓸 준비 재료가 없어 폐기할 수 없습니다.`,true);
    return false;
  }

  order.cookStep=0;
  order.cookScores=[];
  state.selectedOrderId=order.id;
  state.carrying=null;
  state.discardedCount=(state.discardedCount||0)+1;
  state.discardLoss=(state.discardLoss||0)+wasteLossForDish(dish);
  state.trash=Math.min(6,state.trash+1);
  state.dirtyDishes=Math.min(6,state.dirtyDishes+1);
  state.cleanliness=clamp(state.cleanliness-1,0,100);
  spawnPopup(STATIONS.trash.ix,STATIONS.trash.iy-55,"폐기");
  showToast(`${dish.name} 완성품을 폐기했습니다. 남은 준비 재료로 다시 조리하세요.`);
  audio.bad();updateUI(true);saveGame();
  return true;
}

function serveOrder(order) {
  const dish=dishById(order.dishId),inv=state.inventory[dish.id];
  const satisfaction=Math.round(clamp(inv.quality*.55+state.carrying.cookScore*.40+state.cleanliness*.05,0,100));
  const stars=clamp(Math.ceil(satisfaction/20),1,5),earned=Math.round(dish.price*(.75+satisfaction/200)/100)*100;
  state.money+=earned;state.dailyRevenue+=earned;state.served++;state.satisfactionTotal+=satisfaction;if(stars===5)state.fiveStar++;
  state.dirtyDishes=Math.min(6,state.dirtyDishes+1);state.cleanliness=clamp(state.cleanliness-2.5-state.trash*.4,0,100);
  const storyResult=applyStoryCookingResult(order,satisfaction);
  finishSuspendedStoryCook(order,satisfaction);
  const tier=satisfaction>=85?"great":satisfaction>=65?"warm":"soft";
  const departureText=storyResult?.text||pickGeneralGuestBubble(tier);
  state.departures.push({slot:order.slot,variant:order.variant,guestId:order.guestId||null,bubble:departureText,life:3.2,stars,satisfaction});
  state.orders=state.orders.filter(o=>o.id!==order.id);state.carrying=null;state.selectedOrderId=state.orders[0]?.id||null;
  if(state.spawnedCustomers<state.nightCustomerTarget)state.respawns.push({slot:order.slot,time:3.1});
  spawnPopup(CUSTOMER_SEATS[order.slot],500,`${"★".repeat(stars)} ${satisfaction}점`);
  showToast(storyResult
    ?`${storyResult.name}${storyResult.special?"의 특별 조리":"에게 한 접시 제공"} · 만족도 ${satisfaction}점`
    :`${dish.name} 제공 · 만족도 ${satisfaction}점`);
  audio.serve();updateUI(true);saveGame();
}

function autoDelivery(){if(state.phase!=="night"||!state.carrying||state.mini)return;const order=state.orders.find(o=>o.id===state.carrying.orderId);if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],CUSTOMER_SERVICE_Y)<64)serveOrder(order);}

function updateNightObjective(){
  const progress=`손님 ${state.served} / ${state.nightCustomerTarget}명 · 남은 시간 ${formatTime(state.phaseTime)}`;
  const order=currentOrder();dom.objectiveTitle.textContent="손님 주문";
  if(state.carrying){
    const o=state.orders.find(x=>x.id===state.carrying.orderId),d=dishById(state.carrying.dishId),inv=state.inventory[d.id];
    const expected=Math.round(clamp(inv.quality*.55+state.carrying.cookScore*.40+state.cleanliness*.05,0,100));
    const retry=inv.count>0
      ?"마음에 들지 않으면 쓰레기통에서 폐기하고 다시 조리할 수 있습니다."
      :"재조리할 준비 재료가 없어 이 음식은 폐기할 수 없습니다.";
    dom.objectiveBody.innerHTML=`<div><strong>${progress}</strong></div><div><strong>${d.name}</strong> 완성 · 조리 ${state.carrying.cookScore}점 · 예상 만족도 ${expected}점</div><div>${o?storyOrderLabel(o):"손님"} 앞으로 가져가세요.</div><div>${retry}</div>`;
    return;
  }
  if(!order){dom.objectiveBody.innerHTML=`<div><strong>${progress}</strong></div><div>다음 손님을 기다리고 있습니다.</div>`;return;}
  const d=dishById(order.dishId),step=d.cook[order.cookStep];
  const special=order.specialRecipe?" · 특별 조리":"";
  dom.objectiveBody.innerHTML=`<div><strong>${progress}</strong></div><div><strong>${storyOrderLabel(order)} · ${d.name}${special}</strong></div><div><strong>${stationById(step.station).label}</strong>에서 조리하세요.</div><div class="recipe-steps">${d.cook.map((s,i)=>`<div class="recipe-step ${i<order.cookStep?"done":i===order.cookStep?"current":""}"><span>${i+1}</span><span>${stationById(s.station).label}</span></div>`).join("")}</div>`;
}
