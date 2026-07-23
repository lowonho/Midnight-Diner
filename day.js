"use strict";

// 낮 준비 단계 전용 로직. 공통 상태와 렌더링 도구는 game.js가 제공합니다.
const DAY1_SELECTED_MENUS = ["oden", "tofu"];
const DAY1_PREP_TASKS = [
  { id:"cutRadish", menuId:"oden", stationId:"board", label:"무 썰기" },
  { id:"cleanAnchovy", menuId:"oden", stationId:"sink", label:"멸치 손질" },
  { id:"prepareKimchi", menuId:"tofu", stationId:"board", label:"김치 준비하기" }
];

function createDayPrepProgress(){
  return {cutRadish:false,cleanAnchovy:false,prepareKimchi:false};
}

function createKimchiPrepProgress(){
  return {cuttingComplete:false,fryingComplete:false};
}

function isDay1PrepDay(){
  return state.day===1&&state.phase==="day";
}

function normalizeDayPrepState(){
  state.selectedMenus=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>DISHES.some(dish=>dish.id===id)):[];
  state.prepProgress={...createDayPrepProgress(),...(state.prepProgress||{})};
  state.kimchiPrep={...createKimchiPrepProgress(),...(state.kimchiPrep||{})};
  if(state.day===1&&state.phase==="day")state.selectedMenus=[...DAY1_SELECTED_MENUS];
}

function resetDay(first=false) {
  state.phase="day"; state.phaseTime=null; state.selectedDishId=state.day===1?"oden":"kimchi"; state.selectedOrderId=null;
  state.inventory=Object.fromEntries(DISHES.map(d => [d.id,{count:0,quality:0}]));
  state.selectedMenus=state.day===1?[...DAY1_SELECTED_MENUS]:[];
  state.prepProgress=createDayPrepProgress();state.kimchiPrep=createKimchiPrepProgress();
  state.prepRun=null; state.orders=[]; state.respawns=[]; state.departures=[]; state.carrying=null;
  if(state.story){state.story.pendingNightGuests=[];state.story.activeStoryCook=null;}
  state.served=0; state.satisfactionTotal=0; state.fiveStar=0; state.cleanliness=100; state.dirtyDishes=0; state.trash=0;
  state.dailyRevenue=0;state.wasteLoss=0;state.leftoverCount=0;state.discardedCount=0;state.discardLoss=0;state.popularityDelta=0;state.popularityBeforeResult=state.popularity;state.nightCustomerTarget=0;state.spawnedCustomers=0;
  state.mini=null;state.player.x=620;state.player.y=430;state.player.facing="down";state.player.moving=false;state.joyX=0;state.joyY=0;
  dom.resultOverlay.classList.remove("open"); dom.miniOverlay.classList.remove("open");
  if(dom.miniClose)dom.miniClose.hidden=true;
  if(!first) showToast(`${state.day}일차 낮 준비를 시작합니다.`);
  buildMenuCards(); updateUI(true);
}

function advanceToNextDay(){
  if(storyIsActive())return;
  state.day++;
  state.paused=false;
  resetDay(false);
  saveGame();
  queueStoryMoments(["dayStart"]);
}

function currentDay1PrepTask(){
  return DAY1_PREP_TASKS.find(task=>!state.prepProgress?.[task.id])||null;
}

function day1PrepComplete(){
  return DAY1_PREP_TASKS.every(task=>state.prepProgress?.[task.id]);
}

function startPrepMini(stationId) {
  if(isDay1PrepDay()){
    const task=currentDay1PrepTask();
    if(!task)return;
    if(task.stationId!==stationId){showToast(`다음 준비 장소는 ${STATIONS[task.stationId].label}입니다.`,true);return;}
    startDayPrepMini(task);
    return;
  }
  const dish=dishById(state.selectedDishId);
  if(!state.prepRun || state.prepRun.dishId!==dish.id) state.prepRun={dishId:dish.id,stepIndex:0,scores:[]};
  const game={fridge:"collect",sink:"wash",board:"chop",gas:"heat"}[stationId];
  startMini(game,stationId,{mode:"prep",dishId:dish.id});
}

function completeDayPrepTask(taskId){
  if(!Object.prototype.hasOwnProperty.call(state.prepProgress,taskId)||state.prepProgress[taskId])return;
  state.prepProgress[taskId]=true;
  if(taskId==="cleanAnchovy"&&state.prepProgress.cutRadish){
    state.inventory.oden={count:3,quality:100};
  }
  if(taskId==="prepareKimchi"){
    state.kimchiPrep.cuttingComplete=true;state.kimchiPrep.fryingComplete=true;
    state.inventory.tofu={count:3,quality:100};
  }
  updateUI(true);saveGame();
}

function updateDayObjective(){
  if(isDay1PrepDay()){
    const task=currentDay1PrepTask();
    const doneCount=DAY1_PREP_TASKS.filter(item=>state.prepProgress[item.id]).length;
    const mark=id=>state.prepProgress[id]?"☑":"☐";
    dom.objectiveTitle.textContent="Day 1 영업 준비";
    dom.objectiveBody.innerHTML=`
      <div class="prep-checklist">
        <strong>[어묵탕]</strong>
        <div class="${state.prepProgress.cutRadish?"done":""}">${mark("cutRadish")} 무 썰기</div>
        <div class="${state.prepProgress.cleanAnchovy?"done":""}">${mark("cleanAnchovy")} 멸치 손질</div>
        <strong>[두부김치]</strong>
        <div class="${state.prepProgress.prepareKimchi?"done":""}">${mark("prepareKimchi")} 김치 준비하기</div>
        <div class="prep-total">전체 진행도 ${doneCount} / ${DAY1_PREP_TASKS.length}</div>
        <small>${task?`${STATIONS[task.stationId].label}에서 ${task.label}를 시작하세요.`:"모든 준비가 끝났습니다. 영업을 시작할 수 있습니다."}</small>
      </div>`;
    return;
  }
  const dish=dishById(state.selectedDishId);const run=state.prepRun&&state.prepRun.dishId===dish.id?state.prepRun:{stepIndex:0};const req=dish.prep[run.stepIndex];
  const [minGuests,maxGuests]=expectedCustomerRange(state.popularity);const stock=Object.values(state.inventory).reduce((sum,item)=>sum+item.count,0);
  dom.objectiveTitle.textContent="낮 준비";
  dom.objectiveBody.innerHTML=`<div><strong>인기도 ${state.popularity} · 예상 손님 ${minGuests}~${maxGuests}명</strong></div><div>현재 준비 재고 ${stock}인분 · 남은 재고는 정산 때 손실됩니다.</div><div style="margin-top:6px"><strong>${dish.name}</strong> 3인분을 준비합니다.</div><div>${STATIONS[req].label} 앞으로 이동해 상호작용하세요.</div><div class="recipe-steps">${dish.prep.map((s,i)=>`<div class="recipe-step ${i<run.stepIndex?"done":i===run.stepIndex?"current":""}"><span>${i+1}</span><span>${STATIONS[s].label}</span></div>`).join("")}</div>`;
}
