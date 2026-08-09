"use strict";

// 영업 준비는 DayData가 정한 selectedMenus와 MenuData의 prep task로 구성합니다.

function createDayPrepProgress(){
  return Object.fromEntries(Object.keys(PREP_TASKS).map(id=>[id,false]));
}

function normalizePrepTaskScore(value,fallback=100){
  if(value===null||value===undefined||value==="")return fallback;
  const number=Number(value);
  return Number.isFinite(number)?Math.round(Math.max(0,Math.min(100,number))):fallback;
}

function prepTaskGroup(taskOrId){
  const task=typeof taskOrId==="string"?PREP_TASKS[taskOrId]:taskOrId;
  if(!task)return [];
  const key=task.sharedPrepKey||task.id;
  return Object.values(PREP_TASKS).filter(candidate=>(candidate.sharedPrepKey||candidate.id)===key);
}

// 같은 재료를 같은 방식으로 손질하는 작업은 메뉴가 달라도 한 번의 완료를 공유합니다.
function prepTaskCompleted(taskOrId){
  return prepTaskGroup(taskOrId).some(task=>!!state.prepProgress?.[task.id]);
}

function prepTaskScore(taskOrId,fallback=100){
  const scores=prepTaskGroup(taskOrId)
    .filter(task=>!!state.prepProgress?.[task.id])
    .map(task=>Number(state.prepTaskScores?.[task.id]))
    .filter(Number.isFinite);
  return scores.length?normalizePrepTaskScore(Math.max(...scores),fallback):fallback;
}

function createKimchiPrepProgress(){
  return {cuttingComplete:false,fryingComplete:false};
}

/* 낮 '닭꼬치 꽂기'(engine-e8)에서 **실제로 꽂은** 꼬치 배치입니다.
   밤 '닭꼬치 굽기'(engine-e5)가 이 배치 그대로 구워야 해서 낮→밤으로 넘깁니다.
   patterns : 꼬치 하나당 5칸짜리 배열 3개 (["chicken","greenOnion",...]).
   ⚠️ 꽂기를 건너뛰고 들어오는 길이 있습니다(QA 모드가 준비를 완료로 찍는 경우).
      그때는 여기가 비어 있고, engine-e5 가 기본 배치(닭·파 번갈아)로 대신합니다. */
function createSkewerPrepProgress(){
  return {patterns:[]};
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
  return Math.max(1,Math.floor(Number(dayData.maxSelectedMenus)||1));
}

function selectedDishes(){
  const selected=Array.isArray(state.selectedMenus)?state.selectedMenus:[];
  return selected.map(dishById).filter(Boolean);
}

function selectedPrepTasks(){
  return selectedPrepTasksForChecklist().filter(task=>task.isImplemented);
}

function selectedPrepTaskRuns(){
  return [...new Map(selectedPrepTasks().map(task=>[task.sharedPrepKey||task.id,task])).values()];
}

function prepTasksForDish(menuId){
  return selectedPrepTasks().filter(task=>task.menuId===menuId);
}

function nextPrepTaskForDish(menuId){
  return prepTasksForDish(menuId).find(task=>!prepTaskCompleted(task))||null;
}

function prepTaskAvailableToday(task){
  // 모든 메뉴가 Day 1부터 열리므로 메뉴에 연결된 준비 작업도 첫날부터 사용합니다.
  return !!task;
}

function dishPreparedForService(dishId){
  const dish=dishById(dishId);
  if(!dish||!dish.isImplemented||!state.selectedMenus?.includes(dish.id))return false;
  const tasks=(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(task=>task?.isImplemented);
  return tasks.length>0&&tasks.every(prepTaskCompleted);
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

/* 낮 준비 체크리스트에 올라가는 줄 = 메뉴 하나.
   ------------------------------------------------------------
   주방 바 위에 놓이는 준비물도 메뉴당 하나이므로(prep.js prepDishGroups)
   체크리스트 줄 수와 준비물 수가 1:1로 맞습니다. 그래서 "완료"는 작업
   하나가 아니라 그 메뉴의 준비 작업이 전부 끝났을 때만 붙습니다.
   순서는 작업 순서(selectedPrepTasksForChecklist)를 그대로 따라가므로
   Day 4 전용 순서도 여기에 딸려 옵니다. */
function prepChecklistDishes(){
  const ordered=selectedPrepTasksForChecklist();
  const menuIds=[];
  ordered.forEach(task=>{if(!menuIds.includes(task.menuId))menuIds.push(task.menuId);});
  // 준비 작업이 하나도 없는 메뉴도 줄은 있어야 하므로 뒤에 붙입니다.
  selectedDishes().forEach(dish=>{if(!menuIds.includes(dish.id))menuIds.push(dish.id);});
  return menuIds.map(menuId=>{
    const dish=dishById(menuId);
    if(!dish)return null;
    const tasks=ordered.filter(task=>task.menuId===menuId&&task.isImplemented);
    return {dish,tasks,done:tasks.length>0&&tasks.every(prepTaskCompleted)};
  }).filter(Boolean);
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
  // v4 이전 세이브에는 작업별 점수가 없습니다. 당시 완료 작업은 항상 품질 100을
  // 주었으므로, 완료된 작업만 기존 메뉴 품질(없으면 100)로 채워 이어서 계산합니다.
  const savedScores=state.prepTaskScores&&typeof state.prepTaskScores==="object"?state.prepTaskScores:{};
  state.prepTaskScores={};
  Object.keys(PREP_TASKS).forEach(taskId=>{
    if(!state.prepProgress[taskId])return;
    const task=PREP_TASKS[taskId];
    const legacyQuality=state.inventory?.[task?.menuId]?.quality;
    state.prepTaskScores[taskId]=normalizePrepTaskScore(
      savedScores[taskId],
      Number.isFinite(Number(legacyQuality))&&Number(legacyQuality)>0?normalizePrepTaskScore(legacyQuality):100
    );
  });
  state.kimchiPrep={...createKimchiPrepProgress(),...(state.kimchiPrep||{})};
  state.skewerPrep={...createSkewerPrepProgress(),...(state.skewerPrep||{})};
}

function setSelectedMenus(menuIds){
  const dayData=currentMenuSelectionRules(),allowed=new Set([...dayData.requiredMenus,...dayData.optionalMenus]);
  const maxSelectedMenus=maxSelectedMenusForDay(dayData);
  const unique=[...new Set(menuIds)].filter(id=>allowed.has(id)&&dishById(id));
  if(!dayData.requiredMenus.every(id=>unique.includes(id))||unique.length<dayData.minSelectedMenus||unique.length>maxSelectedMenus)return false;
  state.selectedMenus=unique;
  state.prepProgress=createDayPrepProgress();
  state.prepTaskScores={};
  state.kimchiPrep=createKimchiPrepProgress();
  state.skewerPrep=createSkewerPrepProgress();
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0,prepared:false}]));
  buildMenuCards();updateUI(true);saveGame();
  return true;
}

function resetDay(first=false) {
  stopIngredientTimer();
  const dayData=getCurrentDayData();
  state.phase=dayData.skipMenuSelect?GAME_PHASES.INGREDIENT_SELECT:GAME_PHASES.MENU_SELECT;state.phaseTime=null;state.selectedOrderId=null;
  state.selectedMenus=[...dayData.requiredMenus];state.menuSelectionDraft=[...dayData.requiredMenus];
  normalizeDayPrepState();
  state.selectedDishId=state.selectedMenus[0]||DISHES[0].id;
  state.inventory=Object.fromEntries(DISHES.map(dish=>[dish.id,{count:0,quality:0,prepared:false}]));
  state.prepProgress=createDayPrepProgress();state.prepTaskScores={};state.kimchiPrep=createKimchiPrepProgress();state.skewerPrep=createSkewerPrepProgress();
  state.ingredientSelection=state.phase===GAME_PHASES.INGREDIENT_SELECT?createIngredientSelectionState(state.selectedMenus):null;
  state.prepRun=null;state.orders=[];state.respawns=[];state.departures=[];state.carrying=null;
  if(state.story){state.story.pendingNightGuests=[];state.story.activeStoryCook=null;}
  state.served=0;state.generalServed=0;state.generalSpawnedCustomers=0;state.satisfactionTotal=0;state.fiveStar=0;
  state.dailyRevenue=0;state.wasteLoss=0;state.leftoverCount=0;state.discardedCount=0;state.discardLoss=0;state.popularityDelta=0;state.popularityBeforeResult=state.popularity;state.nightCustomerTarget=0;state.spawnedCustomers=0;
  state.mini=null;resetPlayerPosition();state.joyX=0;state.joyY=0;   // 시작 좌표는 player.js PLAYER_START
  dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  // 오늘의 메뉴는 화면 전환과 동시에 띄우지 않습니다. 플레이어가 직접
  // 냉장고 앞으로 걸어가 상호작용했을 때만 선택창을 엽니다.
  dom.menuSelectOverlay.classList.remove("open");
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
  return selectedPrepTaskRuns().find(task=>!prepTaskCompleted(task))||null;
}

function prepComplete(){
  const tasks=selectedPrepTaskRuns();
  return tasks.every(prepTaskCompleted);
}

function startPrepTask(taskId){
  const task=selectedPrepTasks().find(item=>item.id===taskId);
  if(!task)return;
  if(prepTaskCompleted(task)){showToast("이미 준비한 재료입니다.");return;}
  const dependency=(task.dependsOn||[]).map(id=>PREP_TASKS[id]).find(item=>item&&!prepTaskCompleted(item));
  if(dependency){showToast(`먼저 ${dependency.label} 작업을 완료하세요.`,true);return;}
  startDayPrepMini(task);
}

// 이전 station 기반 호출 지점을 위한 호환 진입점입니다.
function startPrepMini(){
  const task=currentPrepTask();
  if(task)startPrepTask(task.id);
}

function completeDayPrepTask(taskId,completionScore){
  const task=PREP_TASKS[taskId];
  if(!task||prepTaskCompleted(task))return;
  state.prepProgress[taskId]=true;
  // 실제 미니게임은 day-prep-minigames.js가 점수를 넘깁니다. QA/구형 호출처럼
  // 점수가 생략되면 현재 낮 미니게임의 결과를 읽고, 그것도 없으면 종전 품질 100을 씁니다.
  const runtimeScore=typeof dayPrepCompletionScore==="function"
    ?dayPrepCompletionScore(state.mini?.data)
    :100;
  state.prepTaskScores=state.prepTaskScores&&typeof state.prepTaskScores==="object"?state.prepTaskScores:{};
  state.prepTaskScores[taskId]=normalizePrepTaskScore(completionScore,runtimeScore);
  selectedDishes().filter(dish=>dish.isImplemented).forEach(dish=>{
    const menuTasks=(dish.prepTasks||[]).map(id=>PREP_TASKS[id]).filter(item=>item?.isImplemented&&prepTaskAvailableToday(item));
    if(menuTasks.length&&menuTasks.every(prepTaskCompleted)){
      const taskScores=menuTasks.map(item=>prepTaskScore(item));
      const quality=Math.round(taskScores.reduce((sum,score)=>sum+score,0)/taskScores.length);
      // count는 구버전 세이브 호환용 준비 표시일 뿐 밤 영업에서 소모하지 않습니다.
      state.inventory[dish.id]={...(state.inventory[dish.id]||{}),count:1,quality,prepared:true};
    }
  });
  if(prepComplete())showToast("오늘의 메뉴 준비 완료 · 영업을 시작할 수 있습니다.");
  updateUI(true);saveGame();
}

/* 낮 좌측 HUD 목록.
   메뉴 이름 한 줄 아래에 그 메뉴의 세부 준비 작업을 'ㄴ' 로 늘어놓습니다
   (어묵탕 → 무 썰기 · 어묵 썰기 · 멸치 손질). 'ㄴ' 기호는 글이 아니라
   표시라서 CSS(.prep-subtask::before)가 붙입니다.

   [두 덩이로 나눠 넣는 이유] 목록(.prep-checklist)만 스크롤되고
   합계 줄(.prep-total)은 늘 보여야 해서 형제로 둡니다. 그 아래 「영업 시작」
   버튼은 원래부터 #inventoryList 바깥이라 스크롤과 무관합니다.
   (자리 규칙은 css/hud.css 의 .left-hud / .prep-checklist 참고) */
function renderPrepChecklist(){
  const items=prepChecklistDishes();
  const taskDone=task=>!!state.prepProgress?.[task.id];
  const allTasks=items.flatMap(item=>item.tasks);
  const doneCount=allTasks.filter(taskDone).length;
  // ⚠️ 서명에 **작업 하나하나**의 완료 여부가 들어가야 합니다. 예전처럼 메뉴 줄의
  //    done 만 보면, 같은 메뉴 안에서 작업 하나를 끝내도 목록이 다시 안 그려집니다.
  const signature=`prep|${state.selectedMenus.join(",")}|${allTasks.map(task=>Number(taskDone(task))).join("")}`;
  if(dom.inventoryList.dataset.signature===signature)return;
  dom.inventoryList.dataset.signature=signature;
  const rows=items.map((item,index)=>{
    const rowClass=item.done?"done":item.tasks.length?"":"disabled";
    const subtasks=item.tasks.length
      ? `<div class="prep-subtasks">${item.tasks.map(task=>
          `<div class="prep-subtask ${taskDone(task)?"done":""}">${task.label}</div>`).join("")}</div>`
      : "";
    // "완료"는 이름 옆에 붙입니다. 아랫줄에 두면 끝난 줄만 두 줄이 되어
    // 목록 높이가 들쭉날쭉해집니다.
    return `<div class="prep-task-row ${rowClass}"><span>${index+1}.</span>`
      +`<strong>${item.dish.name}${item.done?" 완료":""}</strong>${subtasks}</div>`;
  }).join("");
  dom.inventoryList.innerHTML=
    `<div class="prep-checklist drag-scroll">${rows}</div>`
    +`<div class="prep-total">준비 완료 ${doneCount} / ${allTasks.length}</div>`;
}

/* 지금 손댈 수 있는 준비 작업 하나.
   순서(selectedPrepTasksForChecklist)대로 훑되, 선행 작업이 남은 것은
   지금 E 를 눌러도 startPrepTask() 가 막으므로 건너뜁니다. 전부 막혀
   있으면(있을 수 없는 배치지만) 그냥 첫 미완료 작업을 돌려줍니다. */
function nextPrepTask(){
  const remaining=selectedPrepTasks().filter(task=>!state.prepProgress?.[task.id]);
  return remaining.find(task=>!(task.dependsOn||[]).some(id=>PREP_TASKS[id]&&!state.prepProgress?.[id]))
    ||remaining[0]||null;
}

/* 낮 우측 HUD = "지금 할 일" 하나.
   ------------------------------------------------------------
   예전에는 여기에 오늘의 메뉴 목록 · 완료 수 · 조작 안내를 담았는데
   셋 다 화면 어딘가에 이미 있었습니다 —
     메뉴 목록  상단 메뉴 카드(game.js buildMenuCards)와 좌측 준비 목록
     완료 수    좌측 목록 아래 「준비 완료 n / m」(renderPrepChecklist)
     조작       바로 아래 키캡 칩(index.html .controls-help)
   그래서 어디에도 없는 것만 남깁니다: 다음에 할 작업과 그 작업이 놓인
   자리. 밤 패널(night.js)이 "다음 조리대"를 짚어 주는 것과 같은 역할입니다.

   ⚠️ 「준비물」 줄의 이름은 바 테이블 위 이름표와 **같은 문구**여야 합니다
      (prep.js drawPrepObjects 의 `${dish.name} 준비`). 한쪽만 고치면
      패널이 가리키는 이름이 화면에 없습니다. */
function updateDayObjective(){
  const next=nextPrepTask();
  dom.objectiveTitle.textContent="현재 목표";
  if(!next){
    dom.objectiveBody.innerHTML=`
      <div class="prep-summary">
        <strong>준비 완료</strong>
        <div>왼쪽 「${UI_TEXT.phaseButton}」 버튼으로 밤 영업을 시작하세요.</div>
      </div>`;
    return;
  }
  const dish=dishById(next.menuId);
  dom.objectiveBody.innerHTML=`
    <div class="prep-summary">
      <strong>다음 작업</strong>
      <div>${next.label}</div>
      <strong>준비물</strong>
      <div>바 테이블의 「${dish?`${dish.name} 준비`:next.objectLabel}」</div>
    </div>`;
}

function updateMenuSelectionObjective(){
  const signature=`menu-select-standby|${state.day}`;
  if(dom.inventoryList.dataset.signature!==signature){
    dom.inventoryList.dataset.signature=signature;
    // 좌측은 "고른 메뉴 목록" 칸입니다. 무엇을 해야 하는지는 우측이 맡으므로
    // 여기서는 목록이 비었다는 사실만 알립니다(같은 안내를 두 판에 쓰지 않습니다).
    dom.inventoryList.innerHTML='<div class="order-empty">아직 정한 메뉴가 없습니다.</div>';
  }
  dom.objectiveTitle.textContent="현재 목표";
  dom.objectiveBody.innerHTML=`
    <div class="prep-summary">
      <strong>메뉴 정하기</strong>
      <div>주방의 냉장고 앞으로 이동해 오늘 준비할 메뉴를 정하세요.</div>
    </div>`;
}

function openMenuSelectionAtFridge(){
  if(state.phase!==GAME_PHASES.MENU_SELECT)return false;
  renderMenuSelection();
  dom.menuSelectOverlay.classList.add("open");
  return true;
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
      :dayData.minSelectedMenus===maxSelectedMenus
        ?`오늘 준비할 메뉴 ${maxSelectedMenus}개를 선택하세요.`
        :`최소 ${dayData.minSelectedMenus}개, 최대 ${maxSelectedMenus}개를 선택하세요.`;
  const signature=`${dayData.qaAllMenus?"qa-all":"day"}|${state.day}|${state.menuSelectionDraft.join(",")}`;
  if(dom.menuSelectGrid.dataset.signature!==signature){
    dom.menuSelectGrid.dataset.signature=signature;
    dom.menuSelectGrid.innerHTML=available.map(id=>{
      const dish=dishById(id),isRequired=required.has(id),selected=state.menuSelectionDraft.includes(id);
      const special=dayData.specialMenu===id?" · 특별음식":"";
      /* 칸에는 이름과 음식 그림만 둡니다. 예전엔 "필수/선택 메뉴"와 "플레이 가능"
         두 줄이 더 있었는데, 필수 여부는 칸 테두리(.required)와 창 위 설명줄이
         이미 말해 주고 있어서 글자로 또 적을 필요가 없었습니다. 그 자리를 그림에
         내줍니다. 글자로만 남기던 정보(필수·특별음식)는 title 로 옮깁니다.
         등급은 기본(normal, 평범한 요리)입니다. 아직 조리 전이라 잘 만들지 못
         만들지 정해지지 않은 자리라, 메뉴 카드·주문 말풍선과 같은 등급을 씁니다. */
      const art=typeof foodPropUrl==="function"?foodPropUrl(id):null;
      return `<button class="menu-select-option ${selected?"selected":""} ${isRequired?"required":""}" data-menu-id="${id}" type="button" aria-pressed="${selected}" title="${dish.name}${isRequired?" · 필수 메뉴":""}${special}" ${isRequired?"disabled":""}><strong>${dish.name}</strong><img class="menu-select-option-art" src="${art||""}" alt="" /></button>`;
    }).join("");
    dom.menuSelectGrid.querySelectorAll("[data-menu-id]").forEach(button=>button.addEventListener("click",()=>toggleMenuSelection(button.dataset.menuId)));
  }
  dom.menuSelectCount.textContent=`선택 ${state.menuSelectionDraft.length} / 필수 ${dayData.minSelectedMenus}`;
  dom.menuSelectConfirm.disabled=state.menuSelectionDraft.length<dayData.minSelectedMenus||!dayData.requiredMenus.every(id=>state.menuSelectionDraft.includes(id));
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
