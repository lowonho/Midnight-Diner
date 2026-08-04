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

function maxSelectedMenusForDay(dayData){
  const configuredMax=Math.max(1,Math.floor(Number(dayData.maxSelectedMenus)||1));
  if(dayData.ignoreStoryMenuLimit)return configuredMax;
  return Number(state.day)===5&&state.story?.flags?.day5_limit_menus
    ?Math.min(configuredMax,3)
    :configuredMax;
}

function prepYieldForDay(dish){
  const configuredYield=Math.max(1,Math.floor(Number(dish.prepYield)||3));
  return Number(state.day)===5&&state.story?.flags?.day5_reduce_portions
    ?Math.max(1,Math.min(configuredYield,2))
    :configuredYield;
}

function selectedDishes(){
  const selected=Array.isArray(state.selectedMenus)?state.selectedMenus:[];
  return selected.map(dishById).filter(Boolean);
}

function selectedPrepTasks(){
  return selectedPrepTasksForChecklist().filter(task=>task.isImplemented);
}

function prepTasksForDish(menuId){
  return selectedPrepTasks().filter(task=>task.menuId===menuId);
}

function nextPrepTaskForDish(menuId){
  return prepTasksForDish(menuId).find(task=>!state.prepProgress?.[task.id])||null;
}

function prepTaskAvailableToday(task){
  return !!task&&(!task.minDay||Number(state.day)>=Number(task.minDay));
}

function selectedPrepTasksForChecklist(){
  const tasks=selectedDishes().flatMap(dish=>(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(prepTaskAvailableToday));
  return [...new Map(tasks.map(task=>[task.id,task])).values()].sort((a,b)=>{
    if(Number(state.day)===4){
      const day4A=a.day4Order??1000+(a.prepOrder??999),day4B=b.day4Order??1000+(b.prepOrder??999);
      return day4A-day4B;
    }
    return (a.prepOrder??999)-(b.prepOrder??999);
  });
}

function normalizeDayPrepState(){
  const dayData=getCurrentDayData();
  const maxSelectedMenus=maxSelectedMenusForDay(dayData);
  const allowed=new Set([...dayData.requiredMenus,...dayData.optionalMenus]);
  const saved=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>allowed.has(id)&&dishById(id)):[];
  const valid=[...new Set([...dayData.requiredMenus,...saved])].slice(0,maxSelectedMenus);
  state.selectedMenus=valid;
  const draft=Array.isArray(state.menuSelectionDraft)?state.menuSelectionDraft.filter(id=>allowed.has(id)&&dishById(id)):[];
  state.menuSelectionDraft=[...new Set([...dayData.requiredMenus,...draft])].slice(0,maxSelectedMenus);
  // 예전 세이브 호환. 준비 작업을 쪼개거나 합칠 때마다 여기에 한 줄씩 추가합니다.
  // 옛 항목이 완료였으면 그 자리를 대신하는 새 항목들도 완료로 쳐 줍니다.
  // (이 처리가 없으면 이미 끝낸 준비가 미완료로 되감깁니다)
  const legacyKimchiReady=!!state.prepProgress?.prepareKimchi;                    // prepareKimchi → 자르기 + 볶기
  const legacyShrimpComplete=!!state.prepProgress?.coatShrimpBreadcrumbs;         // 기존 3단계의 마지막 완료 → 통합 작업 완료
  const legacyTteokCut=!!state.prepProgress?.cutTteokbokkiIngredients;            // 3재료 묶음 → 재료별 3개
  state.prepProgress={...createDayPrepProgress(),...(state.prepProgress||{})};
  if(legacyKimchiReady){state.prepProgress.cutTofuKimchi=true;state.prepProgress.fryTofuKimchi=true;}
  if(legacyShrimpComplete)state.prepProgress.coatShrimp=true;
  if(legacyTteokCut){state.prepProgress.cutTteokbokkiCabbage=true;state.prepProgress.cutTteokbokkiGreenOnion=true;state.prepProgress.cutTteokbokkiFishCake=true;}
  state.kimchiPrep={...createKimchiPrepProgress(),...(state.kimchiPrep||{})};
}

function setSelectedMenus(menuIds){
  const dayData=currentMenuSelectionRules(),allowed=new Set([...dayData.requiredMenus,...dayData.optionalMenus]);
  const maxSelectedMenus=maxSelectedMenusForDay(dayData);
  const unique=[...new Set(menuIds)].filter(id=>allowed.has(id)&&dishById(id));
  if(!dayData.requiredMenus.every(id=>unique.includes(id))||unique.length<dayData.minSelectedMenus||unique.length>maxSelectedMenus)return false;
  state.selectedMenus=unique;
  state.prepProgress=createDayPrepProgress();
  state.kimchiPrep=createKimchiPrepProgress();
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0}]));
  buildMenuCards();updateUI(true);saveGame();
  return true;
}

function resetDay(first=false) {
  clearIngredientHintTimer();
  const dayData=getCurrentDayData();
  state.phase=dayData.skipMenuSelect?GAME_PHASES.INGREDIENT_SELECT:GAME_PHASES.MENU_SELECT;state.phaseTime=null;state.selectedOrderId=null;
  state.selectedMenus=[...dayData.requiredMenus];state.menuSelectionDraft=[...dayData.requiredMenus];
  normalizeDayPrepState();
  state.selectedDishId=state.selectedMenus[0]||DISHES[0].id;
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0}]));
  state.prepProgress=createDayPrepProgress();state.kimchiPrep=createKimchiPrepProgress();
  state.ingredientSelection=state.phase===GAME_PHASES.INGREDIENT_SELECT?createIngredientSelectionState(state.selectedMenus):null;
  state.prepRun=null;state.orders=[];state.respawns=[];state.departures=[];state.carrying=null;
  if(state.story){state.story.pendingNightGuests=[];state.story.activeStoryCook=null;}
  state.served=0;state.satisfactionTotal=0;state.fiveStar=0;
  state.dailyRevenue=0;state.wasteLoss=0;state.leftoverCount=0;state.discardedCount=0;state.discardLoss=0;state.popularityDelta=0;state.popularityBeforeResult=state.popularity;state.nightCustomerTarget=0;state.spawnedCustomers=0;
  state.mini=null;resetPlayerPosition();state.joyX=0;state.joyY=0;   // 시작 좌표는 player.js PLAYER_START
  dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.MENU_SELECT);
  dom.ingredientSelectOverlay.dataset.signature="";
  dom.ingredientSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.INGREDIENT_SELECT);
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
  if(task.minDay&&Number(state.day)<Number(task.minDay)){showToast(`이 준비 작업은 Day ${task.minDay}부터 이용할 수 있습니다.`,true);return;}
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
    const menuTasks=(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(item=>item?.isImplemented&&prepTaskAvailableToday(item));
    if(menuTasks.length&&menuTasks.every(item=>state.prepProgress[item.id])){
      // 기존 영업·주문·정산 호환용 내부 준비 수량이며 준비 화면에는 노출하지 않습니다.
      const prepYield=prepYieldForDay(dish);
      state.inventory[dish.id]={count:prepYield,quality:100};
    }
  });
  if([3,4].includes(Number(state.day))&&prepComplete())showToast(`Day ${state.day} 준비 완료 · 영업을 시작할 수 있습니다.`);
  updateUI(true);saveGame();
}

function renderPrepChecklist(){
  const tasks=selectedPrepTasksForChecklist(),actionable=selectedPrepTasks();
  const signature=`prep|${state.selectedMenus.join(",")}|${tasks.map(task=>Number(!!state.prepProgress[task.id])).join("")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  const day3Progress=Number(state.day)===3?(()=>{
    const yakisoba=tasks.filter(task=>task.menuId==="yakisoba"),shrimp=tasks.filter(task=>task.menuId==="shrimpTempura");
    const count=items=>items.filter(task=>state.prepProgress[task.id]).length;
    return `<div class="day3-prep-progress"><strong>Day 3 준비 진행도</strong><span>볶음우동 <b>${count(yakisoba)}/${yakisoba.length}</b></span><span>새우튀김 <b>${count(shrimp)}/${shrimp.length}</b></span><span class="overall">전체 준비 <b>${count(tasks)}/${tasks.length}</b></span></div>`;
  })():"";
  const day4Progress=Number(state.day)===4?(()=>{
    // 분모는 task 목록에서 세서, 준비 작업을 쪼개도 숫자가 알아서 맞습니다.
    const day4Tasks=tasks.filter(task=>task.day4Order),count=day4Tasks.filter(task=>state.prepProgress[task.id]).length;
    const tteokbokki=day4Tasks.filter(task=>task.menuId==="tteokbokki"),fries=day4Tasks.filter(task=>task.menuId==="fries");
    const done=items=>items.filter(task=>state.prepProgress[task.id]).length;
    return `<div class="day3-prep-progress day4-prep-progress"><strong>Day 4 준비 체크리스트</strong><span>떡볶이 <b>${done(tteokbokki)}/${tteokbokki.length}</b></span><span>감자튀김 <b>${done(fries)}/${fries.length}</b></span><span class="overall">필수 준비 <b>${count}/${day4Tasks.length}</b></span></div>`;
  })():"";
  dom.inventoryList.innerHTML=`<div class="prep-checklist">${day3Progress}${day4Progress}${tasks.map((task,index)=>{
    const dish=dishById(task.menuId),done=!!state.prepProgress[task.id];
    return `<div class="prep-task-row ${done?"done":task.isImplemented?"":"disabled"}"><span>${index+1}</span><strong>${dish?.name||task.menuId}</strong><div>${done?"☑":task.isImplemented?"☐":"–"} ${task.label}</div></div>`;
  }).join("")}<div class="prep-total">준비 완료 ${actionable.filter(task=>state.prepProgress[task.id]).length} / ${actionable.length}</div></div>`;
}

function updateDayObjective(){
  const dishes=selectedDishes(),tasks=selectedPrepTasks(),pending=selectedPrepTasksForChecklist().filter(task=>!task.isImplemented);
  const completed=tasks.filter(task=>state.prepProgress[task.id]).length;
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
    </div>`;
}

function renderMenuSelection(){
  if(state.phase!==GAME_PHASES.MENU_SELECT)return;
  const dayData=currentMenuSelectionRules();
  const maxSelectedMenus=maxSelectedMenusForDay(dayData);
  const required=new Set(dayData.requiredMenus);
  const available=[...dayData.requiredMenus,...dayData.optionalMenus];
  const draft=Array.isArray(state.menuSelectionDraft)?state.menuSelectionDraft:[...dayData.requiredMenus];
  state.menuSelectionDraft=[...new Set([...dayData.requiredMenus,...draft.filter(id=>available.includes(id))])].slice(0,maxSelectedMenus);
  dom.menuSelectTitle.textContent=`Day ${state.day} · 오늘의 메뉴 선택`;
  dom.menuSelectDescription.textContent=dayData.qaAllMenus
    ?`냉장고에서 확인할 요리를 자유롭게 선택하세요. 최소 ${dayData.minSelectedMenus}개, 최대 ${maxSelectedMenus}개까지 고를 수 있습니다.`
    :dayData.isSpecialDay
      ?`오늘의 특별음식 ${dishById(dayData.specialMenu).name}은 필수입니다. 총 ${dayData.minSelectedMenus}~${maxSelectedMenus}개를 선택하세요.`
      :`필수 메뉴를 포함해 최소 ${dayData.minSelectedMenus}개, 최대 ${maxSelectedMenus}개를 선택하세요.`;
  const signature=`${dayData.qaAllMenus?"qa-all":"day"}|${state.day}|${state.menuSelectionDraft.join(",")}`;
  if(dom.menuSelectGrid.dataset.signature!==signature){
    dom.menuSelectGrid.dataset.signature=signature;
    dom.menuSelectGrid.innerHTML=available.map(id=>{
      const dish=dishById(id),isRequired=required.has(id),selected=state.menuSelectionDraft.includes(id);
      const special=dayData.specialMenu===id?" · 특별음식":"";
      return `<button class="menu-select-option ${selected?"selected":""} ${isRequired?"required":""}" data-menu-id="${id}" type="button" aria-pressed="${selected}" ${isRequired?"disabled":""}><strong>${dish.name}</strong><small>${isRequired?"필수 메뉴":"선택 메뉴"}${special}</small><small>${dish.isImplemented?"플레이 가능":"조리 기능 준비 중"}</small></button>`;
    }).join("");
    dom.menuSelectGrid.querySelectorAll("[data-menu-id]").forEach(button=>button.addEventListener("click",()=>toggleMenuSelection(button.dataset.menuId)));
  }
  dom.menuSelectCount.textContent=`선택 ${state.menuSelectionDraft.length} · 최소 ${dayData.minSelectedMenus} / 최대 ${maxSelectedMenus}`;
  dom.menuSelectConfirm.disabled=state.menuSelectionDraft.length<dayData.minSelectedMenus||!dayData.requiredMenus.every(id=>state.menuSelectionDraft.includes(id));
  dom.menuSelectOverlay.classList.add("open");
}

function toggleMenuSelection(menuId){
  if(state.phase!==GAME_PHASES.MENU_SELECT)return false;
  const dayData=currentMenuSelectionRules();
  const maxSelectedMenus=maxSelectedMenusForDay(dayData);
  if(dayData.requiredMenus.includes(menuId))return false;
  const selected=state.menuSelectionDraft.includes(menuId);
  if(!selected&&state.menuSelectionDraft.length>=maxSelectedMenus){showToast(`메뉴는 최대 ${maxSelectedMenus}개까지 선택할 수 있습니다.`,true);return false;}
  state.menuSelectionDraft=selected?state.menuSelectionDraft.filter(id=>id!==menuId):[...state.menuSelectionDraft,menuId];
  renderMenuSelection();
  return true;
}

function confirmMenuSelection(){
  if(state.phase!==GAME_PHASES.MENU_SELECT||!setSelectedMenus(state.menuSelectionDraft)){showToast("메뉴 선택을 확인해 주세요.",true);return false;}
  dom.menuSelectOverlay.classList.remove("open");
  showToast("오늘의 메뉴가 저장되었습니다. 냉장고에서 재료를 골라주세요.");
  const started=startIngredientSelection();
  if(started&&typeof qaFinishIngredientMenuSelection==="function")qaFinishIngredientMenuSelection();
  return started;
}

function currentMenuSelectionRules(){
  const dayData=getCurrentDayData();
  const qaRules=typeof qaIngredientMenuSelectionRules==="function"?qaIngredientMenuSelectionRules(dayData):null;
  return qaRules||dayData;
}
