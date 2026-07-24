"use strict";

// 영업 준비는 DayData가 정한 selectedMenus와 MenuData의 prep task로 구성합니다.

function createDayPrepProgress(){
  return Object.fromEntries(Object.keys(PREP_TASKS).map(id=>[id,false]));
}

function createKimchiPrepProgress(){
  return {cuttingComplete:false,fryingComplete:false};
}

function isPrepPhase(){
  return state.phase===GAME_PHASES.PREP;
}

function getCurrentDayData(){
  DayManager.setDay(state.day);
  state.day=DayManager.currentDay;
  return DayManager.getDayData();
}

function selectedDishes(){
  const selected=Array.isArray(state.selectedMenus)?state.selectedMenus:[];
  return selected.map(dishById).filter(Boolean);
}

function selectedPrepTasks(){
  return selectedPrepTasksForChecklist().filter(task=>task.isImplemented);
}

function selectedPrepTasksForChecklist(){
  const tasks=selectedDishes().flatMap(dish=>(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(Boolean));
  return [...new Map(tasks.map(task=>[task.id,task])).values()].sort((a,b)=>(a.prepOrder??999)-(b.prepOrder??999));
}

function normalizeDayPrepState(){
  const dayData=getCurrentDayData();
  const allowed=new Set([...dayData.requiredMenus,...dayData.optionalMenus]);
  const saved=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>allowed.has(id)&&dishById(id)):[];
  const valid=[...new Set([...dayData.requiredMenus,...saved])].slice(0,dayData.maxSelectedMenus);
  state.selectedMenus=valid;
  state.menuSelectionDraft=Array.isArray(state.menuSelectionDraft)?state.menuSelectionDraft.filter(id=>allowed.has(id)):[];
  const legacyKimchiReady=!!state.prepProgress?.prepareKimchi;
  state.prepProgress={...createDayPrepProgress(),...(state.prepProgress||{})};
  if(legacyKimchiReady){state.prepProgress.cutTofuKimchi=true;state.prepProgress.fryTofuKimchi=true;}
  state.kimchiPrep={...createKimchiPrepProgress(),...(state.kimchiPrep||{})};
}

function setSelectedMenus(menuIds){
  const dayData=getCurrentDayData(),allowed=new Set([...dayData.requiredMenus,...dayData.optionalMenus]);
  const unique=[...new Set(menuIds)].filter(id=>allowed.has(id)&&dishById(id));
  if(!dayData.requiredMenus.every(id=>unique.includes(id))||unique.length<dayData.minSelectedMenus||unique.length>dayData.maxSelectedMenus)return false;
  state.selectedMenus=unique;
  state.prepProgress=createDayPrepProgress();
  state.kimchiPrep=createKimchiPrepProgress();
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0}]));
  buildMenuCards();updateUI(true);saveGame();
  return true;
}

function resetDay(first=false) {
  const dayData=getCurrentDayData();
  state.phase=dayData.skipMenuSelect?GAME_PHASES.PREP:GAME_PHASES.MENU_SELECT;state.phaseTime=null;state.selectedOrderId=null;
  state.selectedMenus=[...dayData.requiredMenus];state.menuSelectionDraft=[...dayData.requiredMenus];
  normalizeDayPrepState();
  state.selectedDishId=state.selectedMenus[0]||DISHES[0].id;
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0}]));
  state.prepProgress=createDayPrepProgress();state.kimchiPrep=createKimchiPrepProgress();
  state.prepRun=null;state.orders=[];state.respawns=[];state.departures=[];state.carrying=null;
  if(state.story){state.story.pendingNightGuests=[];state.story.activeStoryCook=null;}
  state.served=0;state.satisfactionTotal=0;state.fiveStar=0;state.cleanliness=100;state.dirtyDishes=0;state.trash=0;
  state.dailyRevenue=0;state.wasteLoss=0;state.leftoverCount=0;state.discardedCount=0;state.discardLoss=0;state.popularityDelta=0;state.popularityBeforeResult=state.popularity;state.nightCustomerTarget=0;state.spawnedCustomers=0;
  state.mini=null;resetPlayerPosition();state.joyX=0;state.joyY=0;   // 시작 좌표는 player.js PLAYER_START
  dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.MENU_SELECT);
  if(dom.miniClose)dom.miniClose.hidden=true;
  if(!first)showToast(`${state.day}일차 영업 준비를 시작합니다.`);
  buildMenuCards();updateUI(true);
}

function advanceToNextDay(){
  if(storyIsActive())return;
  DayManager.setDay(state.day);
  const previousDay=DayManager.currentDay;
  state.day=DayManager.nextDay();
  if(state.day===previousDay){showToast("현재 지원되는 마지막 날짜는 Day 7입니다.",true);return false;}
  state.paused=false;
  resetDay(false);
  saveGame();
  queueStoryMoments(["dayStart"]);
  return true;
}

function currentPrepTask(){
  return selectedPrepTasks().find(task=>!state.prepProgress?.[task.id])||null;
}

function prepComplete(){
  const tasks=selectedPrepTasks();
  return tasks.every(task=>state.prepProgress?.[task.id]);
}

function startPrepTask(taskId){
  const task=selectedPrepTasks().find(item=>item.id===taskId);
  if(!task)return;
  if(state.prepProgress[task.id]){showToast("이미 준비한 재료입니다.");return;}
  const dependency=(task.dependsOn||[]).map(id=>PREP_TASKS[id]).find(item=>item&&!state.prepProgress[item.id]);
  if(dependency){showToast(`먼저 ${dependency.label} 작업을 완료하세요.`,true);return;}
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
  selectedDishes().filter(dish=>dish.isImplemented).forEach(dish=>{
    const menuTasks=(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(item=>item?.isImplemented);
    if(menuTasks.length&&menuTasks.every(item=>state.prepProgress[item.id])){
      // 기존 영업·주문·정산 호환용 내부 준비 수량이며 준비 화면에는 노출하지 않습니다.
      state.inventory[dish.id]={count:3,quality:100};
    }
  });
  updateUI(true);saveGame();
}

function renderPrepChecklist(){
  const tasks=selectedPrepTasksForChecklist(),actionable=selectedPrepTasks();
  const signature=`prep|${state.selectedMenus.join(",")}|${tasks.map(task=>Number(!!state.prepProgress[task.id])).join("")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  dom.inventoryList.innerHTML=`<div class="prep-checklist">${tasks.map((task,index)=>{
    const dish=dishById(task.menuId),done=!!state.prepProgress[task.id];
    return `<div class="prep-task-row ${done?"done":task.isImplemented?"":"disabled"}"><span>${index+1}</span><strong>${dish?.name||task.menuId}</strong><div>${done?"☑":task.isImplemented?"☐":"–"} ${task.label}</div></div>`;
  }).join("")}<div class="prep-total">준비 완료 ${actionable.filter(task=>state.prepProgress[task.id]).length} / ${actionable.length}</div></div>`;
}

function updateDayObjective(){
  const dishes=selectedDishes(),tasks=selectedPrepTasks(),pending=selectedPrepTasksForChecklist().filter(task=>!task.isImplemented);
  const completed=tasks.filter(task=>state.prepProgress[task.id]).length;
  const nearby=typeof nearestPrepObject==="function"?nearestPrepObject():null;
  dom.objectiveTitle.textContent="영업 준비";
  dom.objectiveBody.innerHTML=`
    <div class="prep-summary">
      <strong>오늘의 메뉴</strong>
      <div>${dishes.map(dish=>dish.name).join(" · ")||"선택된 메뉴 없음"}</div>
      <strong>준비할 작업</strong>
      <div>완료 ${completed} · 남음 ${Math.max(0,tasks.length-completed)}</div>
      ${pending.length?`<div>${pending.length}개 작업은 다음 구현 단계에서 연결됩니다.</div>`:""}
      <strong>조작</strong>
      <div>WASD 이동 · E 상호작용 · ESC 메뉴</div>
      <strong>현재 상호작용 대상</strong>
      <div>${nearby?`E — ${nearby.task.objectLabel}`:"재료 가까이 이동하세요"}</div>
    </div>`;
}

function renderMenuSelection(){
  if(state.phase!==GAME_PHASES.MENU_SELECT)return;
  const dayData=getCurrentDayData();
  const required=new Set(dayData.requiredMenus);
  const available=[...dayData.requiredMenus,...dayData.optionalMenus];
  const draft=Array.isArray(state.menuSelectionDraft)?state.menuSelectionDraft:[...dayData.requiredMenus];
  state.menuSelectionDraft=[...new Set([...dayData.requiredMenus,...draft.filter(id=>available.includes(id))])].slice(0,dayData.maxSelectedMenus);
  dom.menuSelectTitle.textContent=`Day ${state.day} · 오늘의 메뉴 선택`;
  dom.menuSelectDescription.textContent=dayData.isSpecialDay
    ?`오늘의 특별음식 ${dishById(dayData.specialMenu).name}은 필수입니다. 총 ${dayData.minSelectedMenus}~${dayData.maxSelectedMenus}개를 선택하세요.`
    :`필수 메뉴를 포함해 최소 ${dayData.minSelectedMenus}개, 최대 ${dayData.maxSelectedMenus}개를 선택하세요.`;
  const signature=`${state.day}|${state.menuSelectionDraft.join(",")}`;
  if(dom.menuSelectGrid.dataset.signature!==signature){
    dom.menuSelectGrid.dataset.signature=signature;
    dom.menuSelectGrid.innerHTML=available.map(id=>{
      const dish=dishById(id),isRequired=required.has(id),selected=state.menuSelectionDraft.includes(id);
      const special=dayData.specialMenu===id?" · 특별음식":"";
      return `<button class="menu-select-option ${selected?"selected":""} ${isRequired?"required":""}" data-menu-id="${id}" type="button" aria-pressed="${selected}" ${isRequired?"disabled":""}><strong>${dish.name}</strong><small>${isRequired?"필수 메뉴":"선택 메뉴"}${special}</small><small>${dish.isImplemented?"플레이 가능":"조리 기능 준비 중"}</small></button>`;
    }).join("");
    dom.menuSelectGrid.querySelectorAll("[data-menu-id]").forEach(button=>button.addEventListener("click",()=>toggleMenuSelection(button.dataset.menuId)));
  }
  dom.menuSelectCount.textContent=`선택 ${state.menuSelectionDraft.length} · 최소 ${dayData.minSelectedMenus} / 최대 ${dayData.maxSelectedMenus}`;
  dom.menuSelectConfirm.disabled=state.menuSelectionDraft.length<dayData.minSelectedMenus||!dayData.requiredMenus.every(id=>state.menuSelectionDraft.includes(id));
  dom.menuSelectOverlay.classList.add("open");
}

function toggleMenuSelection(menuId){
  if(state.phase!==GAME_PHASES.MENU_SELECT)return false;
  const dayData=getCurrentDayData();
  if(dayData.requiredMenus.includes(menuId))return false;
  const selected=state.menuSelectionDraft.includes(menuId);
  if(!selected&&state.menuSelectionDraft.length>=dayData.maxSelectedMenus){showToast(`메뉴는 최대 ${dayData.maxSelectedMenus}개까지 선택할 수 있습니다.`,true);return false;}
  state.menuSelectionDraft=selected?state.menuSelectionDraft.filter(id=>id!==menuId):[...state.menuSelectionDraft,menuId];
  renderMenuSelection();audio.click();
  return true;
}

function confirmMenuSelection(){
  if(state.phase!==GAME_PHASES.MENU_SELECT||!setSelectedMenus(state.menuSelectionDraft)){showToast("메뉴 선택을 확인해 주세요.",true);return false;}
  state.phase=GAME_PHASES.PREP;state.paused=false;
  dom.menuSelectOverlay.classList.remove("open");
  showToast("오늘의 메뉴가 저장되었습니다. 영업 준비를 시작합니다.");
  updateUI(true);saveGame();
  return true;
}
