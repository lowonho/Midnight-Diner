"use strict";

// 밤 영업 단계 전용 로직. 공통 상태와 렌더링 도구는 game.js가 제공합니다.
function beginNight() {
  const total=Object.values(state.inventory).reduce((s,v)=>s+v.count,0);
  if(total===0){ showToast("먼저 한 가지 이상의 메뉴를 준비하세요.",true); return; }
  state.phase="night"; state.phaseTime=150; state.prepRun=null; state.selectedOrderId=null; state.carrying=null;
  state.player.x=620; state.player.y=430; state.orders=[]; state.respawns=[];
  for(let i=0;i<4;i++) spawnOrder(i);
  showToast("밤 영업 시작! 맛있는 한 접시를 완성하세요."); audio.success(); updateUI(true);
}

function endNight() {
  state.phase="result"; state.paused=true; state.mini=null; dom.miniOverlay.classList.remove("open");
  dom.servedResult.textContent=state.served;
  dom.satisfactionResult.textContent=`${avgSatisfaction()}점`;
  dom.fiveStarResult.textContent=state.fiveStar;
  dom.revenueResult.textContent=`${state.money.toLocaleString()}원`;
  const avg=avgSatisfaction();
  dom.resultComment.textContent=avg>=90?"손님들이 오늘의 안주를 오래 기억할 것 같습니다.":avg>=75?"정성스러운 한 접시가 손님들에게 잘 전해졌습니다.":"재료 준비와 조리 타이밍을 조금 더 다듬어 보세요.";
  dom.resultOverlay.classList.add("open"); audio.serve(); updateUI(true);
}

function spawnOrder(slot) {
  const available=DISHES.filter(d=>state.inventory[d.id].count>0);
  if(!available.length) return;
  const dish=available[Math.floor(Math.random()*available.length)];
  state.orders.push({ id:nextOrderId++, slot, dishId:dish.id, variant:Math.floor(Math.random()*6), entered:0, cookStep:0, cookScores:[] });
  if(state.selectedOrderId==null) state.selectedOrderId=state.orders[state.orders.length-1].id;
}

function selectOrder(id) {
  if(state.carrying){ showToast("먼저 들고 있는 음식을 주문한 손님에게 가져다주세요.",true); return; }
  const order=state.orders.find(o=>o.id===id); if(!order) return;
  state.selectedOrderId=id; audio.click(); updateUI(true);
}

function currentOrder() { return state.orders.find(o=>o.id===state.selectedOrderId) || null; }

function startCookMini(stationId) {
  const order=currentOrder(); if(!order) return;
  const dish=dishById(order.dishId);
  if(state.inventory[dish.id].count<=0){ showToast(`${dish.name} 준비 재료가 모두 소진되었습니다.`,true); return; }
  const step=dish.cook[order.cookStep];
  startMini(step.game,stationId,{mode:"cook",orderId:order.id,dishId:dish.id});
}

function tryDeliver() {
  if(!state.carrying)return;
  const order=state.orders.find(o=>o.id===state.carrying.orderId);if(!order)return;
  const x=CUSTOMER_SEATS[order.slot], y=CUSTOMER_SERVICE_Y;
  if(distance(state.player.x,state.player.y,x,y)>82){showToast("주문한 손님 앞까지 음식을 가져가세요.",true);return;}
  serveOrder(order);
}

function serveOrder(order) {
  const dish=dishById(order.dishId);const inv=state.inventory[dish.id];
  const satisfaction=Math.round(clamp(inv.quality*.55+state.carrying.cookScore*.40+state.cleanliness*.05,0,100));
  const stars=clamp(Math.ceil(satisfaction/20),1,5);const earned=Math.round(dish.price*(.75+satisfaction/200)/100)*100;
  state.money+=earned;state.served++;state.satisfactionTotal+=satisfaction;if(stars===5)state.fiveStar++;
  state.dirtyDishes=Math.min(6,state.dirtyDishes+1);state.cleanliness=clamp(state.cleanliness-2.5-state.trash*.4,0,100);
  state.orders=state.orders.filter(o=>o.id!==order.id);state.respawns.push({slot:order.slot,time:2.2});state.carrying=null;state.selectedOrderId=state.orders[0]?.id||null;
  spawnPopup(CUSTOMER_SEATS[order.slot],500,`${"★".repeat(stars)} ${satisfaction}점`);showToast(`${dish.name} 제공 · 만족도 ${satisfaction}점`);audio.serve();updateUI(true);
}

function autoDelivery(){if(state.phase!=="night"||!state.carrying||state.mini)return;const order=state.orders.find(o=>o.id===state.carrying.orderId);if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],CUSTOMER_SERVICE_Y)<64)serveOrder(order);}

function updateNightObjective(){
  const order=currentOrder();dom.objectiveTitle.textContent="손님 주문";
  if(state.carrying){const o=state.orders.find(x=>x.id===state.carrying.orderId),d=dishById(state.carrying.dishId);dom.objectiveBody.innerHTML=`<div><strong>${d.name}</strong> 완성!</div><div>${o?o.slot+1:"?"}번 손님 앞으로 직접 가져가면 자동으로 서빙됩니다.</div>`;return;}
  if(!order){dom.objectiveBody.innerHTML="손님을 선택하세요.";return;}
  const d=dishById(order.dishId),step=d.cook[order.cookStep];dom.objectiveBody.innerHTML=`<div><strong>${order.slot+1}번 손님 · ${d.name}</strong></div><div>낮에 준비한 재료로 <strong>${STATIONS[step.station].label}</strong>에서 바로 조리하세요.</div><div class="recipe-steps">${d.cook.map((s,i)=>`<div class="recipe-step ${i<order.cookStep?"done":i===order.cookStep?"current":""}"><span>${i+1}</span><span>${STATIONS[s.station].label}</span></div>`).join("")}</div>`;
}
