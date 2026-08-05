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
const QA_STORY_MOMENT_ORDER=Object.freeze({
  newGame:0,
  dayStart:1,
  nightStart:2,
  specialGuest:3,
  specialGuestMissing:4,
  specialGuestResult:5,
  nightEnd:6,
  nightJudgement:7,
  ending:8,
  epilogue:9
});
const QA_STORY_MOMENT_LABELS=Object.freeze({
  newGame:"프롤로그",
  dayStart:"낮 시작",
  nightStart:"밤 영업",
  specialGuest:"특별 손님",
  specialGuestMissing:"음식 미준비",
  specialGuestResult:"조리 결과",
  nightEnd:"마감",
  nightJudgement:"일곱째 밤 판정",
  ending:"엔딩",
  epilogue:"에필로그"
});
const QA_STORY_KIND_LABELS=Object.freeze({
  sound:"음향",
  bubble:"일반 손님",
  system:"시스템",
  journal:"일지"
});
let qaStorySelectedDay=0;
let qaStorySelectedSceneId=null;
let qaStorySelectedLine=0;
let qaStoryReturnContext=null;
const qaStoryJournalStates={};
/* ⚠️ 예전에는 QA 에서만 메뉴를 1~8개까지 자유롭게 고를 수 있었습니다
   (qaIngredientMenuSelectionRules + qaIngredientAllMenus). 실제 플레이 규칙(그날 5개 고정)과
   달라서 테스트 의미가 없어 2026-08-06 에 걷어냈습니다. QA 도 그날 규칙을 그대로 씁니다. */

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

function qaCancelTransientState({preserveStoryReturn=false}={}){
  if(typeof clearStoryRuntime==="function")clearStoryRuntime();
  else{
    if(typeof storyTypingTimer!=="undefined"&&storyTypingTimer)clearTimeout(storyTypingTimer);
    if(typeof storyRevealTimer!=="undefined"&&storyRevealTimer)clearTimeout(storyRevealTimer);
    if(typeof storySession!=="undefined")storySession=null;
    document.getElementById("storyOverlay")?.classList.remove("open");
  }
  if(!preserveStoryReturn)qaStoryReturnContext=null;
  dom.settingsOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay?.classList.remove("open");
  if(typeof stopIngredientTimer==="function")stopIngredientTimer();
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

// 실제 플레이와 같은 "메뉴 선택 → 냉장고" 흐름을 현재 Day에서 바로 확인합니다.
function qaOpenIngredientSelect(){
  if(!QA_MODE_ENABLED)return false;
  if(!qaEnsureSession())return false;
  qaCancelTransientState();
  state.phase=GAME_PHASES.MENU_SELECT;state.phaseTime=null;state.paused=false;
  state.menuSelectionDraft=[];
  state.ingredientSelection=null;
  dom.ingredientSelectOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.add("open");
  updateUI(true);
  syncPhaserObjects();
  qaRefreshPanel("오늘 규칙대로 메뉴를 고른 뒤 냉장고 재료 찾기로 이어집니다.");
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
// "앞 재료가 끝났는지"를 보고 그리는 연출이 있어서 단순히 건너뛰는 대신
// 실제로 완료 표시를 해 둡니다.
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

/* ============================================================
   3-1. 일차별 스토리 · 대사 미리보기

   실제 진행용 storyAdvance / chooseStoryOption 흐름을 실행하지 않고,
   qaPreview 세션에서 원본 대사를 앞뒤로 확인합니다.
   ============================================================ */

function qaStoryDayForScene(scene,contextDay=qaStorySelectedDay){
  if(!scene)return 0;
  if(scene.moment==="newGame")return 0;
  const explicitDay=Number(scene.day);
  if(Number.isFinite(explicitDay)&&explicitDay>0){
    return Math.max(1,Math.min(DayManager.maxDay,Math.floor(explicitDay)));
  }
  const selectedDay=Number(contextDay)||Number(state?.day)||1;
  return Math.max(1,Math.min(DayManager.maxDay,Math.floor(selectedDay)));
}

function qaStoryDayLabel(day){
  return Number(day)===0?"프롤로그 · 0일차":`${Number(day)}일차`;
}

function qaStoryJournalState(scene){
  if(!scene?.dynamicJournalHint)return null;
  const keys=Object.keys(scene.journalVariants||{});
  const saved=qaStoryJournalStates[scene.id];
  return keys.includes(saved)?saved:(keys[0]||null);
}

function qaStoryLinesForScene(scene){
  const lines=[...(scene?.lines||[])];
  const journalState=qaStoryJournalState(scene);
  if(journalState)lines.push(...(scene.journalVariants[journalState]||[]));
  return lines;
}

function qaStoryContextDays(scene){
  if(scene?.moment==="newGame")return [0];
  const explicitDay=Number(scene?.day);
  if(Number.isFinite(explicitDay)&&explicitDay>0)return [qaStoryDayForScene(scene)];
  return Array.from({length:DayManager.maxDay},(_,index)=>index+1);
}

function qaStorySceneList(){
  return Object.values(STORY_SCENES)
    .flatMap((scene,sourceIndex)=>qaStoryContextDays(scene).map(day=>({
      key:`${scene.id}@${day}`,
      id:scene.id,
      scene,
      day,
      moment:scene.moment,
      sourceIndex,
      lines:qaStoryLinesForScene(scene).map((line,index)=>({index,line}))
    })))
    .sort((a,b)=>{
      const dayDifference=a.day-b.day;
      if(dayDifference)return dayDifference;
      const momentDifference=(QA_STORY_MOMENT_ORDER[a.moment]??99)
        -(QA_STORY_MOMENT_ORDER[b.moment]??99);
      return momentDifference||a.sourceIndex-b.sourceIndex;
    });
}

function qaStoryScenesForDay(day){
  return qaStorySceneList().filter(entry=>entry.day===Number(day));
}

function qaStoryClampLineIndex(scene,index,lines=qaStoryLinesForScene(scene)){
  const last=Math.max(0,(lines?.length||1)-1);
  const parsed=Math.floor(Number(index));
  return Math.max(0,Math.min(last,Number.isFinite(parsed)?parsed:0));
}

function qaStoryLineTextValue(line){
  return String(line?.prompt||line?.text||"");
}

function qaStoryLineSpeaker(line){
  if(line?.speaker)return STORY_CHARACTERS[line.speaker]?.name||line.speaker;
  if(typeof line?.speakerLabel==="string"&&line.speakerLabel.trim())return line.speakerLabel.trim();
  return QA_STORY_KIND_LABELS[line?.kind]||"";
}

function qaStoryBranchEntries(scene,line){
  // 이전 QA 보조 호출처럼 line 하나만 넘긴 경우도 계속 지원합니다.
  if(line===undefined&&scene&&!Array.isArray(scene.lines)){
    line=scene;
    scene=null;
  }
  const branches=[];
  const addReplies=(replies,prefix)=>{
    Object.entries(replies||{}).forEach(([tier,text])=>{
      const value=typeof text==="object"?text?.text:text;
      if(value)branches.push({label:`${prefix} · ${tier}`,text:String(value)});
    });
  };
  const choiceLines=scene
    ?(scene.lines||[]).filter(item=>Array.isArray(item.choices))
    :line?.choices?[line]:[];
  choiceLines.forEach(choiceLine=>(choiceLine.choices||[]).forEach((choice,index)=>{
    branches.push({
      label:`선택 ${index+1}`,
      text:String(choice.text||""),
      sceneId:choice.nextSceneId||null
    });
    if(choice.reply)branches.push({
      label:`선택 ${index+1} 응답 · ${STORY_CHARACTERS[choice.speaker]?.name||choice.speaker||"주인공"}`,
      text:String(choice.reply)
    });
    addReplies(choice.orderCook?.replies,`선택 ${index+1} 조리 반응`);
  }));
  addReplies(line?.orderCook?.replies,"조리 반응");

  if(scene?.dynamicJournalHint){
    const labels={none:"기록 없음",clue:"음식 단서",confirmed:"음식 확정",shard:"조각 획득"};
    Object.entries(scene.journalVariants||{}).forEach(([journalState,lines])=>{
      branches.push({
        label:`영업일지 · ${labels[journalState]||journalState}`,
        text:lines.map(qaStoryLineTextValue).filter(Boolean).join(" / "),
        sceneId:scene.id,
        journalState
      });
    });
  }
  if(scene?.missingMenuSceneId){
    branches.push({
      label:"음식 미준비",
      text:`${scene.missingMenuSceneId} · ${STORY_SCENES[scene.missingMenuSceneId]?.title||""}`,
      sceneId:scene.missingMenuSceneId
    });
  }
  const tierLabels={soft:"아쉽다",warm:"맛있다",great:"완벽"};
  Object.entries(scene?.resultSceneIds||{}).forEach(([tier,sceneId])=>{
    branches.push({
      label:`조리 결과 · ${tierLabels[tier]||tier}`,
      text:`${sceneId} · ${STORY_SCENES[sceneId]?.title||""}`,
      sceneId
    });
  });
  return branches;
}

function qaStoryPreviewIsActive(){
  return !!(typeof storySession!=="undefined"&&storySession?.qaPreview);
}

function qaStoryPanel(){
  return document.getElementById("qaModePanel");
}

function qaCreateStorySceneButton(entry,panel){
  const button=document.createElement("button");
  button.type="button";
  button.className="qa-story-scene";
  button.dataset.qaStoryScene=entry.id;
  button.classList.toggle("active",entry.id===qaStorySelectedSceneId);

  const title=document.createElement("strong");
  title.textContent=`${entry.id} · ${entry.scene.title}`;
  const meta=document.createElement("small");
  const journalState=qaStoryJournalState(entry.scene);
  meta.textContent=`${QA_STORY_MOMENT_LABELS[entry.moment]||entry.moment} · 대사 ${entry.lines.length}개${journalState?` · 영업일지 ${journalState}`:""}`;
  button.append(title,meta);
  button.addEventListener("click",()=>{
    qaStorySelectedSceneId=entry.id;
    qaStorySelectedLine=0;
    qaRenderStoryBrowser(panel);
    qaOpenStoryScene(entry.id,0,{contextDay:entry.day});
  });
  return button;
}

function qaCreateStoryLineButton(entry,lineEntry,panel){
  const {line,index}=lineEntry;
  const button=document.createElement("button");
  button.type="button";
  button.className="qa-story-line";
  button.dataset.qaStoryLine=String(index);
  button.classList.toggle(
    "active",
    entry.id===qaStorySelectedSceneId&&index===qaStorySelectedLine
  );
  const number=document.createElement("b");
  number.textContent=String(index+1).padStart(2,"0");
  const speaker=document.createElement("strong");
  speaker.textContent=qaStoryLineSpeaker(line);
  const text=document.createElement("small");
  text.textContent=qaStoryLineTextValue(line).replace(/\s+/g," ").trim()||"(표시 문구 없음)";
  button.append(number,speaker,text);
  button.title=qaStoryLineTextValue(line);
  button.addEventListener("click",()=>qaOpenStoryScene(entry.id,index,{contextDay:entry.day}));
  return button;
}

function qaRenderStoryBranches(panel,scene,line){
  const wrap=panel?.querySelector("[data-qa-story-branches]");
  if(!wrap)return;
  const entries=qaStoryBranchEntries(scene,line);
  wrap.replaceChildren();
  wrap.hidden=!entries.length;
  entries.forEach(entry=>{
    const row=document.createElement("div");
    const label=document.createElement("strong");
    const text=document.createElement("span");
    label.textContent=entry.label;
    text.textContent=entry.text;
    row.append(label,text);
    if(entry.sceneId){
      row.classList.add("qa-story-branch-link");
      row.tabIndex=0;
      row.setAttribute("role","button");
      const open=()=>{
        if(entry.journalState)qaStoryJournalStates[entry.sceneId]=entry.journalState;
        qaOpenStoryScene(entry.sceneId,0,{contextDay:qaStorySelectedDay,journalState:entry.journalState});
      };
      row.addEventListener("click",open);
      row.addEventListener("keydown",event=>{
        if(event.key!=="Enter"&&event.key!==" ")return;
        event.preventDefault();open();
      });
    }
    wrap.append(row);
  });
}

function qaUpdateStoryControls(panel=qaStoryPanel()){
  if(!panel)return;
  const entry=qaStorySceneList().find(item=>
    item.id===qaStorySelectedSceneId&&item.day===qaStorySelectedDay
  );
  const active=qaStoryPreviewIsActive()&&storySession.scene?.id===entry?.id;
  const total=entry?.lines.length||0;
  const previewLines=entry?.lines.map(item=>item.line)||[];
  const index=entry?qaStoryClampLineIndex(entry.scene,qaStorySelectedLine,previewLines):0;
  const prev=panel.querySelector("[data-qa-story-prev]");
  const next=panel.querySelector("[data-qa-story-next]");
  const position=panel.querySelector("[data-qa-story-position]");
  const close=panel.querySelector("[data-qa-story-close]");
  const subtitle=active?storySession.subtitle:null;
  const subtitlePage=subtitle?.pageIndex||0;
  const subtitleTotal=subtitle?.pages?.length||1;
  if(prev)prev.disabled=!active||(index<=0&&subtitlePage<=0);
  if(next)next.disabled=!active||(index>=total-1&&subtitlePage>=subtitleTotal-1);
  if(close)close.disabled=!active;
  if(position)position.textContent=entry
    ?`${entry.id} · ${index+1} / ${total}${subtitleTotal>1?` · 자막 ${subtitlePage+1} / ${subtitleTotal}`:""}`
    :"장면을 선택하세요";
}

function qaRenderStoryBrowser(panel=qaStoryPanel()){
  if(!panel)return;
  const dayTitle=panel.querySelector("[data-qa-story-day-title]");
  if(dayTitle)dayTitle.textContent=qaStoryDayLabel(qaStorySelectedDay);
  panel.querySelectorAll("[data-qa-story-day]").forEach(button=>{
    button.classList.toggle("active",Number(button.dataset.qaStoryDay)===qaStorySelectedDay);
  });

  const scenes=qaStoryScenesForDay(qaStorySelectedDay);
  if(!scenes.some(entry=>entry.id===qaStorySelectedSceneId)){
    qaStorySelectedSceneId=scenes[0]?.id||null;
    qaStorySelectedLine=0;
  }
  const sceneList=panel.querySelector("[data-qa-story-scenes]");
  sceneList?.replaceChildren(...scenes.map(entry=>qaCreateStorySceneButton(entry,panel)));

  const selected=scenes.find(entry=>entry.id===qaStorySelectedSceneId)||null;
  const selectedLines=selected?.lines.map(item=>item.line)||[];
  if(selected)qaStorySelectedLine=qaStoryClampLineIndex(selected.scene,qaStorySelectedLine,selectedLines);
  const lineList=panel.querySelector("[data-qa-story-lines]");
  lineList?.replaceChildren(...(selected?.lines||[]).map(lineEntry=>
    qaCreateStoryLineButton(selected,lineEntry,panel)
  ));
  const selectedLine=selected?.lines?.[qaStorySelectedLine]?.line||null;
  qaRenderStoryBranches(panel,selected?.scene||null,selectedLine);
  qaUpdateStoryControls(panel);
  lineList?.querySelector(".qa-story-line.active")?.scrollIntoView?.({block:"nearest"});
}

function qaSelectStoryDay(day){
  const nextDay=Math.max(0,Math.min(DayManager.maxDay,Math.floor(Number(day)||0)));
  if(qaStoryPreviewIsActive())qaCloseStoryPreview("",false);
  qaStorySelectedDay=nextDay;
  qaStorySelectedSceneId=qaStoryScenesForDay(nextDay)[0]?.id||null;
  qaStorySelectedLine=0;
  qaRenderStoryBrowser();
  qaRefreshPanel(`${qaStoryDayLabel(nextDay)} 대사 목록을 열었습니다.`);
  return true;
}

function qaSeedStoryPreviewState(sceneId,lineIndex){
  state.story=createStoryState();
  // 새 특별 손님 이름은 모두 서술형 확정 이름입니다. 실제 진행 플래그를
  // 재현하거나 변경하지 않고 빈 임시 이야기 상태만 사용합니다.
  updateRelationshipUI();
}

function qaSyncStoryPreviewNextButton(){
  if(!qaStoryPreviewIsActive())return false;
  const nextButton=document.getElementById("storyNextButton");
  if(!nextButton)return false;
  const atLast=storySession.lineIndex>=storySession.lines.length-1;
  const hasNextPage=typeof storySubtitleHasNextPage==="function"&&storySubtitleHasNextPage();
  nextButton.disabled=atLast&&!hasNextPage;
  nextButton.style.display="block";
  nextButton.innerHTML=hasNextPage
    ?'계속 <span>▼</span>'
    :atLast?'마지막 대사 <span>■</span>':'다음 대사 <span>▼</span>';
  qaUpdateStoryControls();
  return true;
}

function qaShowStoryLineAt(lineIndex){
  if(!qaStoryPreviewIsActive())return false;
  const scene=storySession.scene;
  const target=qaStoryClampLineIndex(scene,lineIndex,storySession.lines);
  clearStoryTyping();
  clearStorySceneIntro();
  if(typeof storyRevealTimer!=="undefined"&&storyRevealTimer){
    clearTimeout(storyRevealTimer);
    storyRevealTimer=null;
  }
  document.getElementById("storyRevealNotice")?.classList.remove("show");
  qaSeedStoryPreviewState(scene.id,target);
  resetStoryStage();
  for(let index=0;index<target;index++){
    const line=storySession.lines[index];
    if(line?.speaker)ensureStoryActor(line.speaker);
  }
  storySession.lineIndex=target;
  qaStorySelectedDay=qaStoryDayForScene(scene,storySession.qaContextDay);
  qaStorySelectedSceneId=scene.id;
  qaStorySelectedLine=target;
  document.getElementById("storyOverlay")?.classList.add("open");
  showStoryLine();
  finishStoryTyping();

  qaSyncStoryPreviewNextButton();
  qaRenderStoryBrowser();
  qaRefreshPanel(
    `${qaStoryDayLabel(qaStorySelectedDay)} · ${scene.id} · ${target+1}/${storySession.lines.length}`
  );
  return true;
}

function qaOpenStoryScene(sceneId,lineIndex=0,options={}){
  if(!QA_MODE_ENABLED)return false;
  const scene=STORY_SCENES[sceneId];
  if(!scene)return false;
  if(!qaEnsureSession())return false;

  const journalState=options?.journalState;
  if(journalState&&scene.journalVariants?.[journalState]){
    qaStoryJournalStates[scene.id]=journalState;
  }
  const contextDay=qaStoryDayForScene(scene,options?.contextDay??qaStorySelectedDay);
  const previewLines=qaStoryLinesForScene(scene);

  if(!qaStoryPreviewIsActive()){
    qaStoryReturnContext={
      day:state.day,
      phase:state.phase,
      phaseTime:state.phaseTime,
      paused:state.paused,
      story:state.story
    };
  }
  qaCancelTransientState({preserveStoryReturn:true});
  state.day=DayManager.setDay(contextDay||1);
  state.phase=scene.timeOfDay==="night"?GAME_PHASES.OPEN:GAME_PHASES.PREP;
  state.phaseTime=state.phase===GAME_PHASES.OPEN
    ?(typeof NIGHT_DURATION==="number"?NIGHT_DURATION:0)
    :null;
  state.paused=true;
  state.screen="game";
  openGameScreen();
  buildMenuCards();
  updateUI(true);
  syncPhaserObjects();

  storySession={
    qaPreview:true,
    qaContextDay:contextDay,
    queue:[sceneId],
    queueIndex:0,
    scene,
    lines:JSON.parse(JSON.stringify(previewLines)),
    lineIndex:0,
    actors:[],
    wasPaused:true,
    onComplete:null,
    waitingForCook:false,
    suspended:false,
    pendingCook:null
  };
  setStoryGameUiVisible(false);
  document.getElementById("storySceneTitle").textContent=storySceneCardText(scene);
  document.getElementById("storyDayLabel").textContent=scene.moment==="newGame"
    ?"PROLOGUE · DAY 0"
    :`DAY ${contextDay}`;
  document.getElementById("storyOverlay").classList.add("open");
  return qaShowStoryLineAt(lineIndex);
}

function qaStoryStep(delta){
  if(!qaStoryPreviewIsActive())return false;
  const direction=Math.sign(Number(delta)||0);
  const subtitle=storySession.subtitle;
  if(direction>0&&typeof storySubtitleHasNextPage==="function"&&storySubtitleHasNextPage()){
    showStorySubtitlePage(subtitle.pageIndex+1);
    finishStoryTyping();
    qaRenderStoryBrowser();
    return true;
  }
  if(direction<0&&subtitle?.pageIndex>0){
    showStorySubtitlePage(subtitle.pageIndex-1);
    finishStoryTyping();
    qaRenderStoryBrowser();
    return true;
  }
  const target=storySession.lineIndex+Number(delta||0);
  if(target<0||target>=storySession.lines.length){
    qaUpdateStoryControls();
    return false;
  }
  return qaShowStoryLineAt(target);
}

function qaStoryPreviewChoice(choice,index){
  if(!qaStoryPreviewIsActive())return false;
  const reply=choice?.reply
    ||Object.values(choice?.orderCook?.replies||{}).map(value=>
      typeof value==="object"?value.text:value
    ).filter(Boolean).join(" / ");
  qaRefreshPanel(
    `선택 ${Number(index)+1}: ${choice?.text||""}${reply?`\n응답: ${reply}`:""}`
  );
  return true;
}

function qaCloseStoryPreview(message="스토리 미리보기를 닫았습니다.",refresh=true){
  if(!qaStoryPreviewIsActive())return false;
  clearStoryRuntime();
  const context=qaStoryReturnContext;
  qaStoryReturnContext=null;
  if(context){
    state.day=DayManager.setDay(context.day);
    state.phase=context.phase;
    state.phaseTime=context.phaseTime;
    state.paused=context.paused;
    state.story=context.story;
  }else{
    state.paused=false;
  }
  updateUI(true);
  syncPhaserObjects();
  qaRenderStoryBrowser();
  if(refresh)qaRefreshPanel(message);
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
        task.miniGame
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
    </div>`;
  return `<div class="qa-mini-section"><em>낮 준비 (${prepTasks.length}개)</em>${prepMarkup}</div>
          <div class="qa-mini-section"><em>밤 조리</em>${cookMarkup}</div>`;
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
  panel.querySelector('[data-qa-phase="ingredient"]').classList.toggle("active",[GAME_PHASES.MENU_SELECT,GAME_PHASES.INGREDIENT_SELECT].includes(state.phase));
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
  qaUpdateStoryControls(panel);
}

function qaExitMode(){
  const url=new URL(window.location.href);
  ["qa","qaStart","qa-story","qa-line","qa-choice","qa-order","qa-score"]
    .forEach(key=>url.searchParams.delete(key));
  window.location.href=url.toString();
}

function qaSelectTab(panel,name){
  panel.querySelectorAll("[data-qa-tab]").forEach(button=>button.classList.toggle("active",button.dataset.qaTab===name));
  panel.querySelectorAll("[data-qa-view]").forEach(view=>{view.hidden=view.dataset.qaView!==name;});
  panel.classList.toggle("story-tab",name==="story");
  if(name==="story")qaRenderStoryBrowser(panel);
}

function qaBuildPanel(){
  const panel=document.createElement("aside");
  panel.id="qaModePanel";panel.className="qa-mode-panel";
  panel.innerHTML=`
    <header><strong>QA MODE</strong><span>저장 OFF</span><button data-qa-collapse type="button" aria-label="QA 패널 접기">−</button></header>
    <div class="qa-mode-body">
      <div class="qa-tabs">
        <button data-qa-tab="day" class="active" type="button">날짜 이동</button>
        <button data-qa-tab="story" type="button">스토리</button>
        <button data-qa-tab="mini" type="button">미니게임</button>
      </div>
      <div data-qa-view="day">
        <div class="qa-day-nav"><button data-qa-prev type="button">이전</button><strong>DAY 이동</strong><button data-qa-next type="button">다음</button></div>
        <div class="qa-day-grid">${Array.from({length:DayManager.maxDay},(_,index)=>`<button data-qa-day="${index+1}" type="button">D${index+1}</button>`).join("")}</div>
        <strong class="qa-phase-title">지금 Day 안에서 단계 전환</strong>
        <div class="qa-phase-switch">
          <button data-qa-phase="ingredient" type="button">🧊 메뉴 → 냉장고 (Alt+F)</button>
          <button data-qa-phase="day" type="button">☀ 낮 준비 (Alt+D)</button>
          <button data-qa-phase="night" type="button">🌙 밤 영업 (Alt+N)</button>
        </div>
        <small class="qa-phase-hint">냉장고는 오늘 메뉴를 먼저 고른 뒤 시작합니다. 밤으로 갈 때는 오늘 준비를 자동 완료하고, 낮으로 돌아올 때는 준비 진행도를 유지합니다.</small>
      </div>
      <div data-qa-view="mini" hidden>
        <input data-qa-search class="qa-mini-search" type="search" placeholder="메뉴·게임 이름으로 찾기" />
        <div class="qa-mini-list">${qaMiniListMarkup()}</div>
        <small class="qa-mini-hint">모든 낮 준비 미니게임은 현재 선택한 날짜에서 실행됩니다.</small>
      </div>
      <div data-qa-view="story" hidden>
        <div class="qa-story-heading">
          <strong data-qa-story-day-title>${qaStoryDayLabel(qaStorySelectedDay)}</strong>
          <small>일차 → 장면 → 대사 순서로 선택</small>
        </div>
        <div class="qa-story-day-grid">
          ${Array.from({length:DayManager.maxDay+1},(_,day)=>
            `<button data-qa-story-day="${day}" type="button" title="${qaStoryDayLabel(day)}">${day===0?"P":`D${day}`}</button>`
          ).join("")}
        </div>
        <div data-qa-story-scenes class="qa-story-scenes"></div>
        <div class="qa-story-nav">
          <button data-qa-story-prev type="button">◀ 이전 대사</button>
          <strong data-qa-story-position>장면을 선택하세요</strong>
          <button data-qa-story-next type="button">다음 대사 ▶</button>
        </div>
        <div data-qa-story-lines class="qa-story-lines"></div>
        <div data-qa-story-branches class="qa-story-branches" hidden></div>
        <button data-qa-story-close class="qa-story-close" type="button">스토리 미리보기 닫기</button>
        <small class="qa-story-hint">대사를 누르면 실제 대화 UI에서 바로 확인합니다. 미리보기에서는 조리·선택 결과·완료 처리를 실행하지 않습니다.</small>
      </div>
      <pre data-qa-state></pre>
      <button data-qa-abort class="qa-abort" type="button">미니게임 강제 종료 (Alt+0)</button>
      <small>Alt + 1~7 날짜 이동 · Alt + ←/→ 대사 이동 · Alt + 0 미니게임 닫기 · Alt + F/D/N 냉장고·낮·밤 전환 (Alt + \` 토글)</small>
      <button class="qa-exit" data-qa-exit type="button">QA 모드 종료</button>
    </div>`;
  document.body.appendChild(panel);

  panel.querySelectorAll("[data-qa-tab]").forEach(button=>button.addEventListener("click",()=>qaSelectTab(panel,button.dataset.qaTab)));
  panel.querySelectorAll("[data-qa-day]").forEach(button=>button.addEventListener("click",()=>qaJumpToDay(Number(button.dataset.qaDay))));
  panel.querySelector("[data-qa-prev]").addEventListener("click",()=>qaJumpToDay(DayManager.currentDay-1));
  panel.querySelector("[data-qa-next]").addEventListener("click",()=>qaJumpToDay(DayManager.currentDay+1));
  panel.querySelectorAll("[data-qa-phase]").forEach(button=>button.addEventListener("click",()=>{
    if(button.dataset.qaPhase==="ingredient")qaOpenIngredientSelect();
    else if(button.dataset.qaPhase==="night")qaSwitchToNight();
    else qaSwitchToDay();
  }));
  panel.querySelectorAll("[data-qa-story-day]").forEach(button=>button.addEventListener("click",()=>{
    qaSelectStoryDay(Number(button.dataset.qaStoryDay));
  }));
  panel.querySelector("[data-qa-story-prev]").addEventListener("click",()=>qaStoryStep(-1));
  panel.querySelector("[data-qa-story-next]").addEventListener("click",()=>qaStoryStep(1));
  panel.querySelector("[data-qa-story-close]").addEventListener("click",()=>qaCloseStoryPreview());
  panel.querySelectorAll("[data-qa-prep]").forEach(button=>button.addEventListener("click",()=>qaPlayPrepMini(button.dataset.qaPrep)));
  panel.querySelectorAll("[data-qa-cook]").forEach(button=>button.addEventListener("click",()=>qaPlayCookMini(button.dataset.qaCook,Number(button.dataset.qaStep||0))));
  panel.querySelector("[data-qa-abort]").addEventListener("click",qaAbortMini);
  panel.querySelector("[data-qa-search]").addEventListener("input",event=>qaFilterMiniList(panel,event.target.value));
  panel.querySelector("[data-qa-collapse]").addEventListener("click",event=>{
    panel.classList.toggle("collapsed");event.currentTarget.textContent=panel.classList.contains("collapsed")?"+":"−";
  });
  panel.querySelector("[data-qa-exit]").addEventListener("click",qaExitMode);
  qaRenderStoryBrowser(panel);
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
    if(qaStoryPreviewIsActive()&&event.key==="ArrowLeft"){
      event.preventDefault();qaStoryStep(-1);return;
    }
    if(qaStoryPreviewIsActive()&&event.key==="ArrowRight"){
      event.preventDefault();qaStoryStep(1);return;
    }
    if(/^[1-7]$/.test(event.key)){event.preventDefault();qaJumpToDay(Number(event.key));return;}
    if(event.key==="0"){event.preventDefault();qaAbortMini();return;}
    // 한글 입력 상태에서도 같은 자리를 누르면 되도록 event.key 대신 event.code 로 봅니다.
    if(event.code==="KeyF"){event.preventDefault();qaOpenIngredientSelect();return;}
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
