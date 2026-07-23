"use strict";

// 영업 준비 데이터는 날짜가 아니라 selectedMenus와 state.phase를 기준으로 구성합니다.
const DEFAULT_SELECTED_MENUS=["oden","tofu"];
const PREP_TASKS={
  cutRadish:{id:"cutRadish",menuId:"oden",label:"무 썰기",objectLabel:"무 바구니",objectKind:"radish"},
  cleanAnchovy:{id:"cleanAnchovy",menuId:"oden",label:"멸치 손질",objectLabel:"멸치 바구니",objectKind:"anchovy"},
  prepareKimchi:{id:"prepareKimchi",menuId:"tofu",label:"김치 준비하기",objectLabel:"김치통",objectKind:"kimchi"}
};

function createDayPrepProgress(){
  return Object.fromEntries(Object.keys(PREP_TASKS).map(id=>[id,false]));
}

function createKimchiPrepProgress(){
  return {cuttingComplete:false,fryingComplete:false};
}

function isPrepPhase(){
  return state.phase==="day";
}

function selectedDishes(){
  const selected=Array.isArray(state.selectedMenus)?state.selectedMenus:[];
  const ids=selected.length?selected:DEFAULT_SELECTED_MENUS;
  return ids.map(dishById).filter(Boolean);
}

function selectedPrepTasks(){
  return selectedDishes().flatMap(dish=>(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(Boolean));
}

function normalizeDayPrepState(){
  const valid=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>DISHES.some(dish=>dish.id===id)):[];
  state.selectedMenus=valid.length?valid:[...DEFAULT_SELECTED_MENUS];
  state.prepProgress={...createDayPrepProgress(),...(state.prepProgress||{})};
  state.kimchiPrep={...createKimchiPrepProgress(),...(state.kimchiPrep||{})};
}

function setSelectedMenus(menuIds){
  const unique=[...new Set(menuIds)].filter(id=>DISHES.some(dish=>dish.id===id));
  if(!unique.length)return false;
  state.selectedMenus=unique;
  state.prepProgress=createDayPrepProgress();
  state.kimchiPrep=createKimchiPrepProgress();
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0}]));
  buildMenuCards();updateUI(true);saveGame();
  return true;
}

function resetDay(first=false) {
  state.phase="day";state.phaseTime=null;state.selectedOrderId=null;
  normalizeDayPrepState();
  state.selectedDishId=state.selectedMenus[0]||DISHES[0].id;
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0}]));
  state.prepProgress=createDayPrepProgress();state.kimchiPrep=createKimchiPrepProgress();
  state.prepRun=null;state.orders=[];state.respawns=[];state.departures=[];state.carrying=null;
  if(state.story){state.story.pendingNightGuests=[];state.story.activeStoryCook=null;}
  state.served=0;state.satisfactionTotal=0;state.fiveStar=0;state.cleanliness=100;state.dirtyDishes=0;state.trash=0;
  state.dailyRevenue=0;state.wasteLoss=0;state.leftoverCount=0;state.discardedCount=0;state.discardLoss=0;state.popularityDelta=0;state.popularityBeforeResult=state.popularity;state.nightCustomerTarget=0;state.spawnedCustomers=0;
  state.mini=null;state.player.x=620;state.player.y=448;state.player.facing="down";state.player.moving=false;state.joyX=0;state.joyY=0;
  dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  if(dom.miniClose)dom.miniClose.hidden=true;
  if(!first)showToast(`${state.day}일차 영업 준비를 시작합니다.`);
  buildMenuCards();updateUI(true);
}

function advanceToNextDay(){
  if(storyIsActive())return;
  state.day++;
  state.paused=false;
  resetDay(false);
  saveGame();
  queueStoryMoments(["dayStart"]);
}

function currentPrepTask(){
  return selectedPrepTasks().find(task=>!state.prepProgress?.[task.id])||null;
}

function prepComplete(){
  const tasks=selectedPrepTasks();
  return tasks.length>0&&tasks.every(task=>state.prepProgress?.[task.id]);
}

function startPrepTask(taskId){
  const task=selectedPrepTasks().find(item=>item.id===taskId);
  if(!task)return;
  if(state.prepProgress[task.id]){showToast("이미 준비한 재료입니다.");return;}
  startDayPrepMini(task);
}

// 이전 station 기반 호출 지점을 위한 호환 진입점입니다.
function startPrepMini(){
  const task=currentPrepTask();
  if(task)startPrepTask(task.id);
}

function completeDayPrepTask(taskId){
  const task=PREP_TASKS[taskId];
  if(!task||state.prepProgress[taskId])return;
  state.prepProgress[taskId]=true;
  if(taskId==="prepareKimchi"){
    state.kimchiPrep.cuttingComplete=true;state.kimchiPrep.fryingComplete=true;
  }
  const dish=dishById(task.menuId);
  const menuTasks=(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(Boolean);
  if(menuTasks.length&&menuTasks.every(item=>state.prepProgress[item.id])){
    // 기존 영업·주문·정산 호환용 내부 준비 수량이며 준비 화면에는 노출하지 않습니다.
    state.inventory[dish.id]={count:3,quality:100};
  }
  updateUI(true);saveGame();
}

function renderPrepChecklist(){
  const dishes=selectedDishes(),tasks=selectedPrepTasks();
  const completed=tasks.filter(task=>state.prepProgress[task.id]).length;
  const signature=`prep|${state.selectedMenus.join(",")}|${tasks.map(task=>Number(!!state.prepProgress[task.id])).join("")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  dom.inventoryList.innerHTML=`<div class="prep-checklist">${dishes.map(dish=>{
    const dishTasks=(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(Boolean);
    return `<section class="prep-menu-group"><strong>[${dish.name}]</strong>${dishTasks.map(task=>`<div class="${state.prepProgress[task.id]?"done":""}">${state.prepProgress[task.id]?"☑":"☐"} ${task.label}</div>`).join("")}</section>`;
  }).join("")}<div class="prep-total">준비 완료 ${completed} / ${tasks.length}</div></div>`;
}

function updateDayObjective(){
  const dishes=selectedDishes(),tasks=selectedPrepTasks();
  const completed=tasks.filter(task=>state.prepProgress[task.id]).length;
  const nearby=typeof nearestPrepObject==="function"?nearestPrepObject():null;
  dom.objectiveTitle.textContent="영업 준비";
  dom.objectiveBody.innerHTML=`
    <div class="prep-summary">
      <strong>오늘의 메뉴</strong>
      <div>${dishes.map(dish=>dish.name).join(" · ")||"선택된 메뉴 없음"}</div>
      <strong>준비할 작업</strong>
      <div>완료 ${completed} · 남음 ${Math.max(0,tasks.length-completed)}</div>
      <strong>조작</strong>
      <div>WASD 이동 · SPACE 상호작용 · ESC 메뉴</div>
      <strong>현재 상호작용 대상</strong>
      <div>${nearby?`SPACE — ${nearby.task.objectLabel}`:"재료 가까이 이동하세요"}</div>
    </div>`;
}
