"use strict";

// 낮 준비 단계 전용 로직. 공통 상태와 렌더링 도구는 game.js가 제공합니다.
function resetDay(first=false) {
  state.phase="day"; state.phaseTime=120; state.selectedDishId="kimchi"; state.selectedOrderId=null;
  state.inventory=Object.fromEntries(DISHES.map(d => [d.id,{count:0,quality:0}]));
  state.prepRun=null; state.orders=[]; state.respawns=[]; state.carrying=null;
  state.served=0; state.satisfactionTotal=0; state.fiveStar=0; state.cleanliness=100; state.dirtyDishes=0; state.trash=0;
  state.mini=null; state.player.x=620; state.player.y=430;
  dom.resultOverlay.classList.remove("open"); dom.miniOverlay.classList.remove("open");
  if(!first) showToast(`${state.day}일차 낮 준비를 시작합니다.`);
  buildMenuCards(); updateUI(true);
}

function startPrepMini(stationId) {
  const dish=dishById(state.selectedDishId);
  if(!state.prepRun || state.prepRun.dishId!==dish.id) state.prepRun={dishId:dish.id,stepIndex:0,scores:[]};
  const game={fridge:"collect",sink:"wash",board:"chop",gas:"heat"}[stationId];
  startMini(game,stationId,{mode:"prep",dishId:dish.id});
}

function updateDayObjective(){
  const dish=dishById(state.selectedDishId);const run=state.prepRun&&state.prepRun.dishId===dish.id?state.prepRun:{stepIndex:0};const req=dish.prep[run.stepIndex];
  dom.objectiveTitle.textContent="낮 준비";
  dom.objectiveBody.innerHTML=`<div><strong>${dish.name}</strong> 3인분을 준비합니다.</div><div>${STATIONS[req].label} 앞으로 이동해 상호작용하세요.</div><div class="recipe-steps">${dish.prep.map((s,i)=>`<div class="recipe-step ${i<run.stepIndex?"done":i===run.stepIndex?"current":""}"><span>${i+1}</span><span>${STATIONS[s].label}</span></div>`).join("")}</div>`;
}
