"use strict";

/* ============================================================
   QA 전용 모듈

   들어가는 길은 두 가지입니다.
     1) 주소에 ?qa=1 을 직접 붙인다
     2) 타이틀 화면 왼쪽 등을 10번 클릭한다 → QA 버튼이 나타난다

   타이틀 화면 마크업(index.html)에는 QA 관련 요소가 하나도 없습니다.
   버튼은 잠금이 풀렸을 때 이 파일이 직접 만들어 붙입니다.

   제거 방법: 이 파일 · css/qa-mode.css · index.html 의 <script> 한 줄 ·
              save.js 의 QA_REMOVE 두 줄을 지우면 끝입니다.
   ============================================================ */

const QA_MODE_ENABLED=new URLSearchParams(window.location.search).get("qa")==="1";
window.QA_MODE=Object.freeze({enabled:QA_MODE_ENABLED});

const QA_UNLOCK_CLICKS=10;        // 처마를 몇 번 눌러야 QA 버튼이 나오는지
const QA_UNLOCK_RESET_MS=2500;    // 이 간격 안에 이어 눌러야 연속 클릭으로 셉니다
const QA_UNLOCK_KEY="midnightDiner.qaUnlocked";

function qaBeginSession(message="임시 QA 세션을 시작했습니다."){
  if(!titleGameReady)return;
  startGame();qaRefreshPanel(message);
}

function qaStartNewSession(event){
  event.preventDefault();event.stopImmediatePropagation();
  qaBeginSession();
}

function qaOpenFromTitle(){
  if(QA_MODE_ENABLED){qaBeginSession();return;}
  const url=new URL(window.location.href);
  url.searchParams.set("qa","1");
  url.searchParams.set("qaStart","1");
  window.location.href=url.toString();
}

// 기존 새 게임 핸들러보다 먼저 가로채 저장 데이터 삭제를 방지합니다.
if(QA_MODE_ENABLED)document.getElementById("startButton")?.addEventListener("click",qaStartNewSession,true);

/* ============================================================
   1. 숨은 입구 — 타이틀 처마 10번 클릭
   ============================================================ */

function qaUnlocked(){
  if(QA_MODE_ENABLED)return true;
  try{return sessionStorage.getItem(QA_UNLOCK_KEY)==="1";}catch{return false;}
}

function qaRememberUnlock(){
  try{sessionStorage.setItem(QA_UNLOCK_KEY,"1");}catch{/* 저장이 막혀 있어도 이번 화면에서는 동작합니다 */}
}

// 잠금이 풀렸을 때만 타이틀 창에 QA 버튼을 만들어 넣습니다.
function qaRevealTitleButton(justUnlocked=false){
  const titleWindow=document.querySelector("#titleScreen .title-window");
  if(!titleWindow)return null;
  let button=document.getElementById("qaModeButton");
  if(!button){
    button=document.createElement("button");
    button.id="qaModeButton";button.type="button";
    button.className="dark-button title-start qa-title-button";
    button.textContent="QA 모드";
    button.addEventListener("click",qaOpenFromTitle);
    const saveInfo=document.getElementById("saveInfo");
    if(saveInfo)titleWindow.insertBefore(button,saveInfo);
    else titleWindow.appendChild(button);
  }
  if(justUnlocked){
    button.classList.add("qa-just-unlocked");
    setTimeout(()=>button.classList.remove("qa-just-unlocked"),1400);
  }
  return button;
}

/* 왼쪽 등(.title-lamp.lamp-one)은 클릭이 통과하는 .title-backdrop 안에 있고,
   그 위를 .title-window(z-index:2)가 덮고 있습니다.
   그래서 등과 같은 자리에 투명한 클릭 판을 하나 깔아 씁니다.
     · 등 본체는 선 하나라 아주 얇습니다. 갓(::after)과 불빛까지 눌리도록
       실제 크기에서 사방으로 여유를 줍니다
     · 등의 자식이 아니라 형제로 두는 이유: 깜빡임 연출(filter)이 걸리면
       등이 쌓임 맥락을 만들어 클릭 판이 창 아래로 내려가기 때문입니다
     · 혹시 버튼을 덮었다면 그 버튼에게 클릭을 넘기고 횟수는 세지 않습니다 */
function qaSyncLampHit(lamp,hit){
  if(!document.getElementById("titleScreen")?.classList.contains("active"))return;
  const base=hit.parentElement?.getBoundingClientRect(),rect=lamp.getBoundingClientRect();
  if(!base||!rect.height)return;
  const pad=Math.max(20,rect.height*.25);
  hit.style.left=`${rect.left-base.left-pad}px`;
  hit.style.top=`${rect.top-base.top-pad*.4}px`;
  hit.style.width=`${rect.width+pad*2}px`;
  hit.style.height=`${rect.height+pad}px`;
}

function qaSetupLampUnlock(){
  const lamp=document.querySelector("#titleScreen .title-lamp.lamp-one");
  if(!lamp?.parentElement)return;
  const hit=document.createElement("i");
  hit.className="qa-lamp-hit";hit.setAttribute("aria-hidden","true");
  lamp.parentElement.appendChild(hit);
  qaSyncLampHit(lamp,hit);
  window.addEventListener("resize",()=>qaSyncLampHit(lamp,hit));

  let clicks=0,lastClickAt=-Infinity;
  hit.addEventListener("click",event=>{
    const covered=document.elementsFromPoint(event.clientX,event.clientY)
      .find(element=>element!==hit&&element.matches("button,input,a,select,textarea"));
    if(covered){covered.click();return;}
    if(qaUnlocked()){qaRevealTitleButton();return;}
    clicks=event.timeStamp-lastClickAt>QA_UNLOCK_RESET_MS?1:clicks+1;
    lastClickAt=event.timeStamp;
    // 남은 횟수는 알려 주지 않고, 후반부에만 등이 더 크게 깜빡입니다.
    lamp.classList.remove("qa-knock","qa-knock-strong");
    void lamp.offsetWidth;
    lamp.classList.add(clicks>=QA_UNLOCK_CLICKS/2?"qa-knock-strong":"qa-knock");
    if(clicks<QA_UNLOCK_CLICKS)return;
    clicks=0;
    qaRememberUnlock();
    qaRevealTitleButton(true);
    if(typeof audio!=="undefined")audio.success?.();
  });
}

/* ============================================================
   2. 상태 정리 · 날짜 이동
   ============================================================ */

function qaMenuNames(ids){
  return ids.map(id=>menuDataById(id)?.displayName||id).join(", ")||"없음";
}

function qaCancelTransientState(){
  if(typeof storyTypingTimer!=="undefined"&&storyTypingTimer)clearTimeout(storyTypingTimer);
  if(typeof storyRevealTimer!=="undefined"&&storyRevealTimer)clearTimeout(storyRevealTimer);
  if(typeof storySession!=="undefined")storySession=null;
  document.getElementById("storyOverlay")?.classList.remove("open");
  dom.settingsOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.remove("open");
  dom.miniOverlay.classList.remove("open");
  dom.miniContent.innerHTML="";
  state.mini=null;state.paused=false;
}

// 게임 화면이 아직 아니면 임시 세션을 열어 줍니다. 저장은 건드리지 않습니다.
function qaEnsureSession(){
  if(state.screen==="game")return true;
  if(!titleGameReady){qaRefreshPanel("게임 로딩이 끝난 뒤 다시 눌러주세요.");return false;}
  startGame();
  return true;
}

function qaJumpToDay(day){
  if(!QA_MODE_ENABLED)return false;
  if(!qaEnsureSession())return false;
  qaCancelTransientState();
  state.day=DayManager.setDay(day);
  resetDay(false);
  updateUI(true);syncPhaserObjects();
  qaRefreshPanel(`Day ${state.day} 시작 상태로 이동했습니다.`);
  return true;
}

/* ============================================================
   2-1. 같은 Day 안에서 낮 ↔ 밤 즉시 전환

   [왜 필요한가] 밤 화면 하나를 보려고 낮 준비를 전부 끝내는 시간을
   없애기 위한 기능입니다. 날짜 버튼과 달리 Day 는 그대로 둡니다.
   ============================================================ */

// 밤으로 넘어가려면 준비가 끝나 있어야 합니다(night.js beginNight 검사).
// 그래서 건너뛰지 않고 오늘 목록을 실제 완료 함수로 처리해 재료 수량까지 맞춥니다.
function qaFinishTodayPrep(){
  const dayData=getCurrentDayData();
  if(state.phase===GAME_PHASES.MENU_SELECT||!state.selectedMenus?.length){
    const picks=[...dayData.requiredMenus];
    dayData.optionalMenus.forEach(id=>{if(picks.length<dayData.minSelectedMenus&&!picks.includes(id))picks.push(id);});
    setSelectedMenus(picks);
  }
  state.phase=GAME_PHASES.PREP;state.paused=false;state.prepRun=null;
  dom.menuSelectOverlay.classList.remove("open");
  selectedPrepTasks().forEach(task=>completeDayPrepTask(task.id));
  // 오늘 준비 목록이 비어 있는 메뉴(그날 아직 안 열린 작업 등)는 재료가 채워지지 않습니다.
  // 재료가 하나도 없으면 밤 전환 자체가 막히므로 QA에서만 직접 채워 둡니다.
  selectedDishes().filter(dish=>dish.isImplemented).forEach(dish=>{
    if(!state.inventory[dish.id]?.count)state.inventory[dish.id]={count:Math.max(1,Math.floor(Number(dish.prepYield)||3)),quality:100};
  });
}

function qaSwitchToNight(){
  if(!QA_MODE_ENABLED)return false;
  if(!qaEnsureSession())return false;
  if(state.phase===GAME_PHASES.OPEN){qaRefreshPanel("이미 밤 영업 중입니다.");return false;}
  qaCancelTransientState();
  qaFinishTodayPrep();
  updateUI(true);
  beginNight();   // 손님 수·이야기 손님까지 실제 규칙대로 시작합니다
  syncPhaserObjects();
  if(state.phase!==GAME_PHASES.OPEN){qaRefreshPanel("밤 전환이 막혔습니다. 위 안내 토스트를 확인해 주세요.");return false;}
  qaRefreshPanel(`Day ${state.day} 밤 영업으로 전환했습니다.`);
  return true;
}

// 준비 진행도와 재료는 일부러 그대로 둡니다. 처음부터 다시 보려면 날짜 버튼을 쓰세요.
function qaSwitchToDay(){
  if(!QA_MODE_ENABLED)return false;
  if(!qaEnsureSession())return false;
  if(state.phase===GAME_PHASES.PREP){qaRefreshPanel("이미 낮 준비 중입니다.");return false;}
  qaCancelTransientState();
  state.phase=GAME_PHASES.PREP;state.phaseTime=null;state.paused=false;state.selectedOrderId=null;
  // 남겨 두면 손님과 주문 말풍선이 낮 화면에 그대로 그려집니다.
  state.orders=[];state.respawns=[];state.departures=[];state.carrying=null;state.prepRun=null;
  state.spawnedCustomers=0;state.nightCustomerTarget=0;
  if(state.story){state.story.pendingNightGuests=[];state.story.activeStoryCook=null;}
  resetPlayerPosition();   // 시작 좌표는 player.js PLAYER_START
  updateUI(true);syncPhaserObjects();
  qaRefreshPanel(`Day ${state.day} 낮 준비로 전환했습니다. (준비 진행도·재료는 그대로)`);
  return true;
}

function qaTogglePhase(){
  return state.phase===GAME_PHASES.OPEN?qaSwitchToDay():qaSwitchToNight();
}

/* ============================================================
   3. 미니게임 바로 실행

   [왜 필요한가] 게임 하나를 확인하려고 그 장면까지 플레이해서
   가는 시간을 없애기 위한 기능입니다. 앞 단계는 QA가 대신 끝내 줍니다.

   [목록이 자동인 이유] 아래 두 표에서 직접 읽습니다.
     · 낮 준비 : game-data.js 의 PREP_TASKS + 등록된 시작함수(DAY_PREP_SETUPS)
     · 밤 조리 : game-data.js 의 MENU_DATA[].cook
   그래서 미니게임을 쪼개거나 새로 만들어도 이 파일은 고칠 필요가 없습니다.
   ============================================================ */

// 밤 영업에만 쓰는 잡일 게임. 표에 없어서 여기에만 적습니다.
const QA_UTILITY_MINIS=Object.freeze([
  {type:"dishwasher",station:"dishwasher",label:"설거지",prepare(){state.dirtyDishes=6;}},
  {type:"trash",station:"trash",label:"쓰레기 정리",prepare(){state.trash=6;}}
]);

function qaPrepTaskList(){
  const livePrepTaskIds=new Set(MENU_DATA.flatMap(menu=>menu.requiredPrepTasks||[]));
  return Object.values(PREP_TASKS)
    .filter(task=>livePrepTaskIds.has(task.id)&&task.isImplemented&&DAY_PREP_SETUPS[task.miniGame])
    .sort((a,b)=>(a.prepOrder??999)-(b.prepOrder??999));
}

function qaCookStepList(){
  return MENU_DATA.filter(menu=>menu.isImplemented)
    .flatMap(menu=>(menu.cook||[]).map((step,index)=>({menu,step,index})));
}

// 고른 작업 하나만 바로 열 수 있도록 앞 단계(dependsOn)를 완료 처리합니다.
// 어묵탕 냄비 그림처럼 "앞 재료가 끝났는지"를 보고 그리는 연출이 있어서
// 단순히 건너뛰는 대신 실제로 완료 표시를 해 둡니다.
function qaSeedPrepContext(task){
  if(!state.selectedMenus.includes(task.menuId))state.selectedMenus=[...state.selectedMenus,task.menuId];
  const progress={...createDayPrepProgress(),...(state.prepProgress||{})};
  const markDependencies=id=>{
    (PREP_TASKS[id]?.dependsOn||[]).forEach(dependencyId=>{
      if(progress[dependencyId])return;
      progress[dependencyId]=true;markDependencies(dependencyId);
    });
  };
  markDependencies(task.id);
  progress[task.id]=false;
  state.prepProgress=progress;
}

function qaPlayPrepMini(taskId){
  if(!QA_MODE_ENABLED)return false;
  const task=PREP_TASKS[taskId];
  if(!task){qaRefreshPanel(`준비 작업을 찾지 못했습니다: ${taskId}`);return false;}
  if(!qaEnsureSession())return false;
  qaCancelTransientState();
  if(task.minDay)state.day=DayManager.setDay(task.minDay);
  state.phase=GAME_PHASES.PREP;state.paused=false;
  qaSeedPrepContext(task);
  updateUI(true);syncPhaserObjects();
  startDayPrepMini(task);
  qaRefreshPanel(`낮 준비 · ${task.label} 실행 (Day ${state.day} · ${task.miniGame})`);
  return true;
}

function qaPlayCookMini(dishId,stepIndex=0){
  if(!QA_MODE_ENABLED)return false;
  const dish=dishById(dishId),step=dish?.cook?.[stepIndex];
  if(!step){qaRefreshPanel(`조리 단계를 찾지 못했습니다: ${dishId}`);return false;}
  if(!qaEnsureSession())return false;
  qaCancelTransientState();
  // 손님·주문 없이 조리만 확인하는 용도라 밤 진행(제한시간·손님 정산)은 켜지 않습니다.
  // 그래서 phase 는 낮으로 두고, 끝나면 game.js 가 주문을 못 찾아 창만 조용히 닫습니다.
  state.phase=GAME_PHASES.PREP;state.paused=false;
  startMini(step.game,step.station,{mode:"cook",dishId,qa:true});
  dom.miniClose.hidden=false;   // QA 실행분은 언제든 ✕ 로 닫을 수 있게 합니다
  qaRefreshPanel(`밤 조리 · ${dish.displayName} ${stepIndex+1}단계 실행 (${step.game})`);
  return true;
}

function qaPlayUtilityMini(type){
  if(!QA_MODE_ENABLED)return false;
  const utility=QA_UTILITY_MINIS.find(item=>item.type===type);
  if(!utility){qaRefreshPanel(`잡일 게임을 찾지 못했습니다: ${type}`);return false;}
  if(!qaEnsureSession())return false;
  qaCancelTransientState();
  state.phase=GAME_PHASES.PREP;state.paused=false;
  utility.prepare();
  startMini(utility.type,utility.station,{utility:true,qa:true});
  dom.miniClose.hidden=false;
  qaRefreshPanel(`잡일 · ${utility.label} 실행`);
  return true;
}

// 진행 중인 미니게임을 강제로 닫습니다. 밤 조리는 ESC 가 없어서 이게 탈출구입니다.
function qaAbortMini(){
  if(!QA_MODE_ENABLED||!state.mini)return false;
  if(isDayPrepMini())closeDayPrepMini(true);
  else{
    state.mini=null;
    dom.miniOverlay.classList.remove("open");
    dom.miniContent.innerHTML="";
    dom.miniClose.hidden=true;
    updateUI(true);
  }
  qaRefreshPanel("진행 중인 미니게임을 닫았습니다.");
  return true;
}

/* ---- 목록 마크업 ------------------------------------------ */

function qaMiniButtonMarkup(attribute,value,label,note,extra=""){
  return `<button ${attribute}="${value}" ${extra} type="button" title="${note}"><span>${label}</span><small>${note}</small></button>`;
}

function qaMiniListMarkup(){
  const prepTasks=qaPrepTaskList();
  const prepGroups=MENU_DATA
    .map(menu=>({menu,tasks:prepTasks.filter(task=>task.menuId===menu.id)}))
    .filter(group=>group.tasks.length);
  const prepMarkup=prepGroups.map(({menu,tasks})=>`
    <div class="qa-mini-group">
      <strong>${menu.displayName}</strong>
      ${tasks.map(task=>qaMiniButtonMarkup(
        "data-qa-prep",task.id,task.label,
        `${task.miniGame}${task.minDay?` · Day ${task.minDay}부터`:""}`
      )).join("")}
    </div>`).join("");
  const cookMarkup=`
    <div class="qa-mini-group">
      <strong>밤 조리</strong>
      ${qaCookStepList().map(({menu,step,index})=>qaMiniButtonMarkup(
        "data-qa-cook",menu.id,
        `${menu.displayName}${menu.cook.length>1?` ${index+1}단계`:""}`,
        `${step.game} · ${step.station}`,`data-qa-step="${index}"`
      )).join("")}
    </div>
    <div class="qa-mini-group">
      <strong>잡일</strong>
      ${QA_UTILITY_MINIS.map(utility=>qaMiniButtonMarkup(
        "data-qa-utility",utility.type,utility.label,utility.type
      )).join("")}
    </div>`;
  return `<div class="qa-mini-section"><em>낮 준비 (${prepTasks.length}개)</em>${prepMarkup}</div>
          <div class="qa-mini-section"><em>밤 · 잡일</em>${cookMarkup}</div>`;
}

function qaFilterMiniList(panel,keyword){
  const needle=keyword.trim().toLowerCase();
  panel.querySelectorAll(".qa-mini-group").forEach(group=>{
    let visible=0;
    group.querySelectorAll("button").forEach(button=>{
      const hit=!needle||button.textContent.toLowerCase().includes(needle)||group.querySelector("strong").textContent.toLowerCase().includes(needle);
      button.hidden=!hit;
      if(hit)visible++;
    });
    group.hidden=visible===0;
  });
  panel.querySelectorAll(".qa-mini-section").forEach(section=>{
    section.hidden=![...section.querySelectorAll(".qa-mini-group")].some(group=>!group.hidden);
  });
}

/* ============================================================
   4. 패널
   ============================================================ */

function qaRefreshPanel(message=""){
  const panel=document.getElementById("qaModePanel");
  if(!panel||typeof state==="undefined")return;
  const day=DayManager.setDay(state.day),data=DayManager.getDayData(day);
  panel.querySelectorAll("[data-qa-day]").forEach(button=>button.classList.toggle("active",Number(button.dataset.qaDay)===day));
  panel.querySelector("[data-qa-prev]").disabled=day<=DayManager.minDay;
  panel.querySelector("[data-qa-next]").disabled=day>=DayManager.maxDay;
  panel.querySelector("[data-qa-abort]").disabled=!state.mini;
  // 정산(result) 중에는 낮으로만 돌아갈 수 있어 "밤"을 현재 상태로 표시하지 않습니다.
  const nightNow=state.phase===GAME_PHASES.OPEN;
  panel.querySelector('[data-qa-phase="day"]').classList.toggle("active",state.phase===GAME_PHASES.PREP);
  panel.querySelector('[data-qa-phase="night"]').classList.toggle("active",nightNow);
  panel.querySelector("[data-qa-state]").textContent=[
    `현재: Day ${day} · ${state.phase}`,
    `미니게임: ${state.mini?`${state.mini.type} → ${state.mini.engine}`:"없음"}`,
    `필수: ${qaMenuNames(data.requiredMenus)}`,
    `선택: ${qaMenuNames(data.optionalMenus)}`,
    `확정: ${qaMenuNames(state.selectedMenus||[])}`,
    `선택 범위: ${data.minSelectedMenus}~${data.maxSelectedMenus}`,
    data.specialMenu?`특별: ${qaMenuNames([data.specialMenu])}`:"특별: 없음",
    message
  ].filter(Boolean).join("\n");
}

function qaExitMode(){
  const url=new URL(window.location.href);
  url.searchParams.delete("qa");
  window.location.href=url.toString();
}

function qaSelectTab(panel,name){
  panel.querySelectorAll("[data-qa-tab]").forEach(button=>button.classList.toggle("active",button.dataset.qaTab===name));
  panel.querySelectorAll("[data-qa-view]").forEach(view=>{view.hidden=view.dataset.qaView!==name;});
}

function qaBuildPanel(){
  const panel=document.createElement("aside");
  panel.id="qaModePanel";panel.className="qa-mode-panel";
  panel.innerHTML=`
    <header><strong>QA MODE</strong><span>저장 OFF</span><button data-qa-collapse type="button" aria-label="QA 패널 접기">−</button></header>
    <div class="qa-mode-body">
      <div class="qa-tabs">
        <button data-qa-tab="day" class="active" type="button">날짜 이동</button>
        <button data-qa-tab="mini" type="button">미니게임</button>
      </div>
      <div data-qa-view="day">
        <div class="qa-day-nav"><button data-qa-prev type="button">이전</button><strong>DAY 이동</strong><button data-qa-next type="button">다음</button></div>
        <div class="qa-day-grid">${Array.from({length:DayManager.maxDay},(_,index)=>`<button data-qa-day="${index+1}" type="button">D${index+1}</button>`).join("")}</div>
        <strong class="qa-phase-title">지금 Day 안에서 낮밤 전환</strong>
        <div class="qa-phase-switch">
          <button data-qa-phase="day" type="button">☀ 낮 준비 (Alt+D)</button>
          <button data-qa-phase="night" type="button">🌙 밤 영업 (Alt+N)</button>
        </div>
        <small class="qa-phase-hint">밤으로 갈 때는 오늘 준비를 자동으로 끝내고 실제 영업 시작 절차를 그대로 탑니다. 낮으로 돌아올 때는 준비 진행도와 재료를 그대로 둡니다.</small>
      </div>
      <div data-qa-view="mini" hidden>
        <input data-qa-search class="qa-mini-search" type="search" placeholder="메뉴·게임 이름으로 찾기" />
        <div class="qa-mini-list">${qaMiniListMarkup()}</div>
        <small class="qa-mini-hint">Day 전용 작업은 그 날짜로 자동 이동합니다. 나머지는 지금 날짜 규칙을 따릅니다(Day 4+ 는 빠른 칼질).</small>
      </div>
      <pre data-qa-state></pre>
      <button data-qa-abort class="qa-abort" type="button">미니게임 강제 종료 (Alt+0)</button>
      <small>Alt + 1~7 날짜 이동 · Alt + 0 미니게임 닫기 · Alt + D/N 낮·밤 전환 (Alt + \` 토글)</small>
      <button class="qa-exit" data-qa-exit type="button">QA 모드 종료</button>
    </div>`;
  document.body.appendChild(panel);

  panel.querySelectorAll("[data-qa-tab]").forEach(button=>button.addEventListener("click",()=>qaSelectTab(panel,button.dataset.qaTab)));
  panel.querySelectorAll("[data-qa-day]").forEach(button=>button.addEventListener("click",()=>qaJumpToDay(Number(button.dataset.qaDay))));
  panel.querySelector("[data-qa-prev]").addEventListener("click",()=>qaJumpToDay(DayManager.currentDay-1));
  panel.querySelector("[data-qa-next]").addEventListener("click",()=>qaJumpToDay(DayManager.currentDay+1));
  panel.querySelectorAll("[data-qa-phase]").forEach(button=>button.addEventListener("click",()=>{
    if(button.dataset.qaPhase==="night")qaSwitchToNight();else qaSwitchToDay();
  }));
  panel.querySelectorAll("[data-qa-prep]").forEach(button=>button.addEventListener("click",()=>qaPlayPrepMini(button.dataset.qaPrep)));
  panel.querySelectorAll("[data-qa-cook]").forEach(button=>button.addEventListener("click",()=>qaPlayCookMini(button.dataset.qaCook,Number(button.dataset.qaStep||0))));
  panel.querySelectorAll("[data-qa-utility]").forEach(button=>button.addEventListener("click",()=>qaPlayUtilityMini(button.dataset.qaUtility)));
  panel.querySelector("[data-qa-abort]").addEventListener("click",qaAbortMini);
  panel.querySelector("[data-qa-search]").addEventListener("input",event=>qaFilterMiniList(panel,event.target.value));
  panel.querySelector("[data-qa-collapse]").addEventListener("click",event=>{
    panel.classList.toggle("collapsed");event.currentTarget.textContent=panel.classList.contains("collapsed")?"+":"−";
  });
  panel.querySelector("[data-qa-exit]").addEventListener("click",qaExitMode);
  return panel;
}

function initializeQaMode(){
  qaSetupLampUnlock();
  if(qaUnlocked())qaRevealTitleButton();
  if(!QA_MODE_ENABLED)return;
  document.body.classList.add("qa-mode-enabled");
  qaBuildPanel();

  window.addEventListener("keydown",event=>{
    if(!event.altKey){
      // 밤 조리 게임은 ESC 처리가 없어서 QA에서만 탈출구를 하나 열어 둡니다.
      if(event.key==="Escape"&&state.mini&&!isDayPrepMini())qaAbortMini();
      return;
    }
    if(/^[1-7]$/.test(event.key)){event.preventDefault();qaJumpToDay(Number(event.key));return;}
    if(event.key==="0"){event.preventDefault();qaAbortMini();return;}
    // 한글 입력 상태에서도 같은 자리를 누르면 되도록 event.key 대신 event.code 로 봅니다.
    if(event.code==="KeyD"){event.preventDefault();qaSwitchToDay();return;}
    if(event.code==="KeyN"){event.preventDefault();qaSwitchToNight();return;}
    if(event.code==="Backquote"){event.preventDefault();qaTogglePhase();}
  });
  // game.js 의 ✕ 버튼은 낮 준비만 닫습니다. QA로 연 밤 조리도 닫히게 이어 붙입니다.
  dom.miniClose?.addEventListener("click",()=>{if(state.mini&&!isDayPrepMini())qaAbortMini();});

  setInterval(()=>qaRefreshPanel(),500);
  qaRefreshPanel("날짜 버튼은 그날 시작 상태로, 미니게임 탭은 게임 하나만 바로 엽니다.");

  const params=new URLSearchParams(window.location.search);
  if(params.get("qaStart")==="1"){
    const url=new URL(window.location.href);url.searchParams.delete("qaStart");
    window.history.replaceState(null,"",url.toString());
    if(titleGameReady)qaBeginSession("타이틀의 QA 모드 버튼으로 시작했습니다.");
    else{
      const readyTimer=setInterval(()=>{
        if(!titleGameReady)return;
        clearInterval(readyTimer);qaBeginSession("타이틀의 QA 모드 버튼으로 시작했습니다.");
      },200);
    }
  }
}

window.addEventListener("load",initializeQaMode,{once:true});
