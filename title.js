"use strict";

// 타이틀 화면과 새 게임/이어하기 화면 전환을 전담합니다.
let titleGameReady=false;
let journalReturnFocus=null;
let journalMode="collection";
let journalPageIndex=0;
let journalPages=[];
let journalWasPaused=false;

function initializeTitleScreen(){
  dom.startButton.disabled=true;
  dom.startButton.textContent="게임 불러오는 중…";
  dom.continueButton.disabled=true;
  dom.startButton.addEventListener("click",startNewGame);
  dom.continueButton.addEventListener("click",continueGame);
  dom.titleSettingsButton.addEventListener("click",()=>openSettings("title"));
  dom.returnTitleButton.addEventListener("click",returnTitle);
  initializeJournalUI();
  updateContinueButton();
}

function journalElements(){
  return {
    overlay:document.getElementById("journalOverlay"),
    openButton:document.getElementById("journalButton"),
    gameplayButton:document.getElementById("codexButton"),
    closeButton:document.getElementById("journalClose"),
    modeLabel:document.getElementById("journalModeLabel"),
    title:document.getElementById("journalTitle"),
    description:document.getElementById("journalDescription"),
    page:document.getElementById("journalPage"),
    pageKind:document.getElementById("journalPageKind"),
    pageProgress:document.getElementById("journalPageProgress"),
    pagePortrait:document.getElementById("journalPagePortrait"),
    pageTitle:document.getElementById("journalPageTitle"),
    pageNote:document.getElementById("journalPageNote"),
    pageMeta:document.getElementById("journalPageMeta"),
    previous:document.getElementById("journalPrevious"),
    next:document.getElementById("journalNext"),
    tabs:document.getElementById("journalPageTabs")
  };
}

function normalizedJournalPage(page,index,mode){
  const id=String(page?.id||page?.guestId||`page-${index+1}`);
  const label=page?.label||page?.guestName||page?.displayName||page?.title||id;
  const unlocked=page?.unlocked===true||page?.locked===false
    ||Number(page?.level)>0||Number(page?.storyLevel)>0;
  return {...page,id,label,unlocked,mode};
}

function collectionJournalPages(){
  const pages=window.MoonlightTableSave?.collectionPages?.()||[];
  return pages.map((page,index)=>normalizedJournalPage(page,index,"collection"));
}

function gameplayJournalPages(){
  const pages=typeof getGameplayJournalPages==="function"?getGameplayJournalPages():[];
  return (Array.isArray(pages)?pages:[]).map((page,index)=>normalizedJournalPage(page,index,"gameplay"));
}

function journalPageKindLabel(page){
  if(journalMode==="gameplay")return page.dayLabel?`현재 진행 · ${page.dayLabel}`:"현재 진행";
  return page.kind==="ending"?"엔딩":"특별 손님";
}

function journalField(label,value){
  const text=Array.isArray(value)
    ?value.length?value.join(", "):"없음"
    :value==null||value===""?"???":String(value);
  return `${label} · ${text}`;
}

function journalSection(title,fields){
  return [`[${title}]`,...fields].join("\n");
}

function firstJournalValue(page,keys,fallback="???"){
  for(const key of keys){
    const value=page?.[key];
    if(value!==undefined&&value!==null&&value!=="")return value;
  }
  return fallback;
}

function journalFirstUnlockLabel(page){
  if(!page.unlocked)return "미달성";
  const timestamp=Number(page.unlockedAt);
  if(!Number.isFinite(timestamp)||timestamp<=0)return "달성 기록 있음";
  return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"})
    .format(new Date(timestamp));
}

function gameplayJournalEntryNote(entry){
  return [
    journalSection(entry.guestName,[
      journalField("음식 단서",entry.clue),
      journalField("확인 음식",entry.confirmedDish),
      journalField("최근 평가",entry.latestEvaluation),
      journalField("공개 이야기",entry.revealedStory)
    ]),
    journalSection("과거 영업 기록",[
      journalField("이전 회차 평가",entry.previousLoopEvaluation),
      journalField("이전 회차 부분 조각",entry.previouslyObtainedPartial),
      journalField("이전 회차 완전 조각",entry.previouslyObtainedFull),
      journalField("본 장면",entry.seenStoryScenes)
    ]),
    journalSection("현재 회차",[
      journalField("방문",entry.currentLoopVisited),
      journalField("평가",entry.currentLoopEvaluation),
      journalField("조각 상태",entry.currentFragmentState),
      journalField("조각명",entry.currentFragmentName)
    ])
  ].join("\n\n");
}

function journalPageNote(page){
  if(journalMode==="gameplay"&&page.pageType==="rules"){
    return journalSection("주의사항",(page.rules||[]).map((rule,index)=>`${index+1}. ${rule}`));
  }
  if(journalMode==="gameplay"&&page.pageType==="day"){
    if(!page.recorded||!page.entries?.length){
      return "기록 없음\n\n그날 손님을 직접 만난 뒤 얻은 단서와 결과가 여기에 기록됩니다.";
    }
    return page.entries.map(gameplayJournalEntryNote).join("\n\n────────\n\n");
  }
  if(!page.unlocked){
    if(journalMode==="gameplay")return [
      journalSection("손님 정보",[
        journalField("이름","???"),
        journalField("등장","기록 없음"),
        journalField("단서","???"),
        journalField("확인 음식","???"),
        journalField("공개 이야기","???")
      ]),
      journalSection("과거 영업 기록",[
        journalField("이전 회차 평가","평가 기록 없음"),
        journalField("이전 회차 부분 조각","없음"),
        journalField("이전 회차 완전 조각","없음"),
        journalField("본 장면","없음")
      ]),
      journalSection("현재 회차",[
        journalField("방문","미방문"),
        journalField("평가","평가 기록 없음"),
        journalField("조각 상태","미획득"),
        journalField("조각명","???")
      ])
    ].join("\n\n");
    if(journalMode==="collection"&&page.kind==="ending")return [
      journalField("엔딩 번호",page.number),
      journalField("엔딩 제목","???"),
      journalField("요약","???"),
      journalField("마지막 대사","???"),
      journalField("최초 달성","미달성")
    ].join("\n");
    return [
      journalField("손님 이름","???"),
      journalField("기억하는 음식","???"),
      journalField("좋아한 스타일","???"),
      journalField("완성된 손님 이야기","???"),
      journalField("남긴 달빛 조각","???"),
      journalField("진엔딩 이후 후일담","???")
    ].join("\n");
  }
  if(journalMode==="collection"&&page.kind==="ending"){
    return [
      journalField("엔딩 번호",page.number),
      journalField("요약",page.summary),
      journalField("마지막 대사",page.lastLine?`“${page.lastLine}”`:"???"),
      journalField("최초 달성",journalFirstUnlockLabel(page))
    ].join("\n");
  }
  if(journalMode==="collection"){
    return [
      journalField("이름",page.displayName||page.label),
      journalField("기억의 음식",page.dishName),
      journalField("좋아한 스타일",page.preferredStyle),
      journalField("완성된 이야기",page.completedStory),
      journalField("달빛 조각",page.shardName),
      journalField("진엔딩 이후 후일담",page.epilogueUnlocked?page.epilogue:"???")
    ].join("\n");
  }
  return [
    journalSection("손님 정보",[
      journalField("이름",page.guestName),
      journalField("등장",page.appearance),
      journalField("단서",page.clue),
      journalField("확인 음식",page.confirmedDish),
      journalField("공개 이야기",page.revealedStory)
    ]),
    journalSection("과거 영업 기록",[
      journalField("이전 회차 평가",firstJournalValue(page,["previousLoopEvaluation","previousEvaluation","pastEvaluation"])),
      journalField("이전 회차 부분 조각",firstJournalValue(page,["previouslyObtainedPartial","previousPartialStory","pastPartialStory"])),
      journalField("이전 회차 완전 조각",firstJournalValue(page,["previouslyObtainedFull","previousCompleteStory","pastCompleteStory"])),
      journalField("본 장면",firstJournalValue(page,["seenStoryScenes","previousSeenScene","pastSeenScene"])),
    ]),
    journalSection("현재 회차",[
      journalField("방문",firstJournalValue(page,["currentLoopVisited","currentVisit","visitStatus"])),
      journalField("평가",firstJournalValue(page,["currentLoopEvaluation","currentEvaluation","latestEvaluation"])),
      journalField("조각 상태",firstJournalValue(page,["currentFragmentState","currentShardStatus","shardStatus"])),
      journalField("조각명",firstJournalValue(page,["currentFragmentName","currentShardName","shardName"]))
    ])
  ].join("\n\n");
}

function journalPageMeta(page){
  if(!page.unlocked)return "잠긴 페이지";
  const items=[];
  if(journalMode==="gameplay"){
    if(page.pageType==="rules")return "준비 메뉴 · 여덟 가지 중 매일 다섯 가지";
    if(page.pageType==="day")return page.recorded?`방문 기록 · ${page.entries.length}건`:"기록 없음";
    if(page.confirmedDish&&page.confirmedDish!=="???")items.push(`확인한 음식 · ${page.confirmedDish}`);
    if(page.currentLoopEvaluation&&page.currentLoopEvaluation!=="미평가"){
      items.push(`현재 평가 · ${page.currentLoopEvaluation}`);
    }
    items.push(`현재 조각 · ${page.currentFragmentState||"미획득"}`);
    return items.join("  ·  ");
  }
  if(journalMode==="collection"&&page.dayLabel)items.push(page.dayLabel);
  if(journalMode==="collection"&&page.dishName)items.push(`찾는 음식 · ${page.dishName}`);
  else if(page.confirmedDish&&page.confirmedDish!=="???")items.push(`확인한 음식 · ${page.confirmedDish}`);
  if(page.latestEvaluation&&page.latestEvaluation!=="평가 기록 없음")items.push(page.latestEvaluation);
  if(page.shardName&&(journalMode==="collection"||page.shardOwned))items.push(`달빛 조각 · ${page.shardName}`);
  else if(page.shardStatus)items.push(`달빛 조각 · ${page.shardStatus}`);
  if(page.day&&!page.dayLabel)items.push(`DAY ${page.day}`);
  return items.join("  ·  ")||"기록 완료";
}

function renderJournalTabs(elements){
  if(!elements.tabs)return;
  elements.tabs.style.setProperty("--journal-page-count",String(Math.max(1,journalPages.length)));
  elements.tabs.replaceChildren(...journalPages.map((page,index)=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="journal-page-tab";
    button.classList.toggle("is-active",index===journalPageIndex);
    button.classList.toggle("is-locked",!page.unlocked);
    button.classList.toggle("is-new",!!page.notificationPending);
    button.textContent=String(index+1);
    button.setAttribute("role","tab");
    button.setAttribute("aria-selected",String(index===journalPageIndex));
    button.setAttribute("aria-label",`${index+1}쪽 · ${page.unlocked?page.label:"잠긴 기록"}`);
    button.addEventListener("click",()=>selectJournalPage(index,true));
    return button;
  }));
}

function renderJournalPage({acknowledge=false}={}){
  const elements=journalElements();
  const page=journalPages[journalPageIndex]||null;
  if(!page){
    elements.pageKind.textContent="영업일지";
    elements.pageProgress.textContent="0 / 0";
    elements.pageTitle.textContent="표시할 기록이 없습니다.";
    elements.pageNote.textContent="이야기가 시작되면 이곳에 기록이 생깁니다.";
    elements.pageMeta.textContent="";
    elements.pagePortrait.textContent="?";
    elements.previous.disabled=true;elements.next.disabled=true;
    renderJournalTabs(elements);
    return;
  }
  elements.page.classList.toggle("is-locked",!page.unlocked);
  elements.page.classList.toggle("is-ending",page.kind==="ending");
  elements.pageKind.textContent=journalPageKindLabel(page);
  elements.pageProgress.textContent=`${journalPageIndex+1} / ${journalPages.length}`;
  const portraitRow=Number(page.portraitRow);
  const isGameplayRecord=journalMode==="gameplay";
  const isGuestPortrait=!isGameplayRecord&&page.kind!=="ending";
  const hasPortrait=isGuestPortrait&&Number.isFinite(portraitRow)&&portraitRow>=0&&portraitRow<=5;
  elements.pagePortrait.classList.toggle("has-portrait",hasPortrait);
  elements.pagePortrait.classList.toggle("portrait-placeholder",isGuestPortrait&&!hasPortrait);
  elements.pagePortrait.classList.toggle("journal-page-icon",isGameplayRecord);
  if(hasPortrait){
    const row=Math.floor(portraitRow);
    elements.pagePortrait.style.setProperty("--journal-portrait-y",row===5?"100%":`${row*20}%`);
  }
  elements.pagePortrait.textContent=!page.unlocked
    ?"?"
    :isGameplayRecord?page.pageType==="rules"?"!":String(page.day||"·")
      :page.kind==="ending"?"☾":"";
  elements.pageTitle.textContent=page.unlocked?page.label:"잠긴 기록";
  elements.pageNote.textContent=journalPageNote(page);
  elements.pageMeta.textContent=journalPageMeta(page);
  elements.previous.disabled=journalPageIndex<=0;
  elements.next.disabled=journalPageIndex>=journalPages.length-1;
  renderJournalTabs(elements);
  if(acknowledge&&journalMode==="collection"&&page.unlocked&&page.notificationPending){
    page.notificationPending=false;
    window.MoonlightTableSave?.acknowledgeUnlock?.(page.kind,page.id);
  }
}

function selectJournalPage(index,acknowledge=false){
  if(!journalPages.length)return false;
  journalPageIndex=Math.max(0,Math.min(journalPages.length-1,Number(index)||0));
  renderJournalPage({acknowledge});
  return true;
}

function refreshJournalUI(){
  const elements=journalElements();
  journalPages=journalMode==="gameplay"?gameplayJournalPages():collectionJournalPages();
  journalPageIndex=Math.max(0,Math.min(journalPageIndex,Math.max(0,journalPages.length-1)));
  elements.modeLabel.textContent=journalMode==="gameplay"?"CURRENT SAVE":"PERMANENT COLLECTION";
  elements.description.textContent=journalMode==="gameplay"
    ?"첫 장에는 영업 규칙이, 날짜 장에는 직접 만난 뒤의 기록만 남습니다."
    :"특별 손님 8장과 엔딩 5장은 새로운 플레이에서도 남습니다.";
  renderJournalPage();
}

function openJournal(mode="collection"){
  journalMode=mode==="gameplay"?"gameplay":"collection";
  journalPageIndex=0;
  const elements=journalElements();
  if(!elements.overlay)return false;
  journalReturnFocus=typeof document.activeElement?.focus==="function"
    ?document.activeElement
    :elements.openButton;
  if(journalMode==="gameplay"&&typeof state!=="undefined"){
    journalWasPaused=!!state.paused;
    state.paused=true;
    audio?.pauseLoops?.();
  }
  refreshJournalUI();
  elements.overlay.classList.add("open");
  elements.overlay.setAttribute("aria-hidden","false");
  elements.closeButton?.focus();
  renderJournalPage({acknowledge:true});
  return true;
}

function openTitleJournal(){return openJournal("collection");}
function openGameplayJournal(){return openJournal("gameplay");}

function closeJournal(){
  const elements=journalElements();
  if(!elements.overlay?.classList.contains("open"))return false;
  const resumeStory=journalMode==="gameplay"
    &&typeof resumeStoryAfterJournal==="function";
  elements.overlay.classList.remove("open");
  elements.overlay.setAttribute("aria-hidden","true");
  if(journalMode==="gameplay"&&typeof state!=="undefined"){
    state.paused=journalWasPaused||state.phase===GAME_PHASES.RESULT
      ||(typeof storyDialogueIsActive==="function"&&storyDialogueIsActive());
    if(!state.paused)audio?.resumeLoops?.();
  }
  journalReturnFocus?.focus?.();
  journalReturnFocus=null;
  if(resumeStory)setTimeout(resumeStoryAfterJournal,0);
  return true;
}

function initializeJournalUI(){
  const elements=journalElements();
  if(!elements.overlay||elements.overlay.dataset.initialized==="true")return;
  elements.overlay.dataset.initialized="true";
  elements.openButton?.addEventListener("click",openTitleJournal);
  elements.gameplayButton?.addEventListener("click",openGameplayJournal);
  elements.closeButton?.addEventListener("click",closeJournal);
  elements.previous?.addEventListener("click",()=>selectJournalPage(journalPageIndex-1,true));
  elements.next?.addEventListener("click",()=>selectJournalPage(journalPageIndex+1,true));
  elements.overlay.addEventListener("click",event=>{
    if(event.target===elements.overlay)closeJournal();
  });
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape"||!elements.overlay.classList.contains("open"))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeJournal();
  },true);
  refreshJournalUI();
}

window.refreshJournalUI=refreshJournalUI;
window.openJournal=openJournal;
window.openTitleJournal=openTitleJournal;
window.openGameplayJournal=openGameplayJournal;

function savePhaseLabel(phase){
  return phase===GAME_PHASES.MENU_SELECT?"메뉴 선택":phase===GAME_PHASES.INGREDIENT_SELECT?"재료 고르기":phase===GAME_PHASES.PREP?"낮 준비":phase===GAME_PHASES.OPEN?"밤 영업":"영업 마감";
}

function updateContinueButton(){
  const slots=readAllSaveSlots();
  const saves=slots.filter(slot=>slot.data);
  const latest=saves.reduce((current,slot)=>
    !current||slot.data.savedAt>current.data.savedAt?slot:current
  ,null);
  dom.continueButton.disabled=!titleGameReady||!saves.length;
  dom.continueButton.textContent="이어하기";
  if(!latest){dom.saveInfo.textContent="저장 데이터가 없습니다.";return;}
  dom.saveInfo.textContent=`저장 ${saves.length}/4 · 최근 DAY ${latest.data.state.day} · ${savePhaseLabel(latest.data.state.phase)}`;
}

function markTitleGameReady(){
  titleGameReady=true;
  dom.startButton.disabled=false;
  dom.startButton.textContent="새 게임";
  updateContinueButton();
  setTimeout(showPendingEndingRetryCheckpoint,0);
}

function markTitleLoadFailed(){
  titleGameReady=false;
  dom.startButton.disabled=true;
  dom.startButton.textContent="에셋 로딩 실패";
  dom.continueButton.disabled=true;
  dom.pauseMessage.textContent="게임 이미지를 불러오지 못했습니다. 파일 위치를 확인해 주세요.";
}

function openGameScreen(){
  dom.settingsOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.titleScreen.classList.remove("active");dom.gameScreen.classList.add("active");
  requestAnimationFrame(()=>phaserScene?.scale.refresh());showGameHud(true);
}

function sameEndingRetryAction(left,right){
  return !!left&&!!right
    &&left.type==="endingRetryMenu"
    &&right.type==="endingRetryMenu"
    &&left.judgementSceneId===right.judgementSceneId
    &&left.endingSceneId===right.endingSceneId;
}

function showPendingEndingRetryCheckpoint(){
  const checkpoint=window.MoonlightTableSave?.readEndingRetryCheckpoint?.();
  if(!checkpoint)return false;
  const shown=typeof showEndingRetryMenu==="function"
    &&showEndingRetryMenu(checkpoint.action,{restoredCheckpoint:true});
  if(!shown)window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  return !!shown;
}

// 숨은 엔딩 체크포인트는 이어하기 슬롯으로 취급하지 않습니다. 사용자가 엔딩
// 결론창의 버튼을 눌렀을 때만 게임 상태를 복원하고 실제 게임 화면으로 전환합니다.
function restoreEndingRetryCheckpointGame(expectedAction){
  const checkpoint=window.MoonlightTableSave?.readEndingRetryCheckpoint?.();
  if(!checkpoint||!sameEndingRetryAction(checkpoint.action,expectedAction))return false;
  try{restoreGameState(checkpoint.saveData);}
  catch(error){
    console.warn("엔딩 재시도 상태를 복원하지 못했습니다.",error);
    window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
    return false;
  }

  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();audio.apply();syncAudioControls();
  dom.settingsOverlay.classList.remove("open");
  dom.miniOverlay.classList.remove("open");
  dom.resultOverlay.classList.remove("open");
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay.classList.remove("open");
  buildMenuCards();openGameScreen();updateUI(true);syncPhaserObjects();audio.startBgm();
  return true;
}

function continueGame(){
  if(!hasAnySaveData()){updateContinueButton();return;}
  openSaveSlotDialog("load","title",dom.continueButton);
}

function loadGameFromSlot(slotId=AUTO_SAVE_SLOT){
  const data=readSaveData(slotId);if(!data){updateContinueButton();return false;}
  restoreGameState(data);

  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();audio.apply();syncAudioControls();
  dom.settingsOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.resultOverlay.classList.toggle("open",state.phase==="result");
  // 메뉴 선택 단계의 저장을 불러와도 냉장고 앞 상호작용부터 다시 시작합니다.
  dom.menuSelectOverlay.classList.remove("open");
  dom.ingredientSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.INGREDIENT_SELECT);
  buildMenuCards();openGameScreen();updateUI(true);syncPhaserObjects();
  if(state.phase==="result")renderNightResult();
  else audio.startBgm();
  setTimeout(resumeStoryForCurrentPhase,0);
  return true;
}

function startNewGame(){
  if(readSaveData(AUTO_SAVE_SLOT)&&!window.confirm("자동 저장을 새 게임으로 교체할까요?\n수동 저장 3칸은 그대로 유지됩니다."))return;
  window.MoonlightTableSave?.clearEndingRetryCheckpoint?.();
  if(typeof closeEndingRetryMenu==="function")closeEndingRetryMenu();
  clearSaveData(AUTO_SAVE_SLOT);clearStoryRuntime();startGame();saveGame(true);updateContinueButton();
}

function startGame(){
  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();
  state.screen="game";state.phase=GAME_PHASES.PREP;state.paused=false;state.settingsFrom="game";
  state.day=DayManager.setDay(1);state.money=0;state.popularity=0;state.story=createStoryState();state.departures=[];nextOrderId=1;resetDay(true);
  openGameScreen();audio.startBgm();
  queueStoryMoments(["newGame","dayStart"]);
}

function returnTitle(){
  if(state.mini||state.story?.activeStoryCook){
    showToast("진행 중인 조리를 마친 뒤 타이틀로 돌아갈 수 있습니다.",true);
    return;
  }
  if(!saveGame(true)){
    showToast("자동 저장에 실패해 타이틀로 이동하지 않았습니다.",true);
    return;
  }
  // 캡처 단계에서 막 재생한 타이틀 복귀 클릭음은 남기고 조리음만 정리합니다.
  audio.stopAllFiles?.("ui_click");
  clearStoryRuntime();state.screen="title";state.paused=true;state.mini=null;
  stopIngredientTimer();
  dom.settingsOverlay.classList.remove("open");dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");dom.menuSelectOverlay.classList.remove("open");dom.ingredientSelectOverlay.classList.remove("open");
  dom.gameScreen.classList.remove("active");dom.titleScreen.classList.add("active");
  showGameHud(false);audio.stopBgm();updateContinueButton();
}
