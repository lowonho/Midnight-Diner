"use strict";

// 타이틀 화면과 새 게임/이어하기 화면 전환을 전담합니다.
let titleGameReady=false;

function initializeTitleScreen(){
  dom.startButton.disabled=true;
  dom.startButton.textContent="게임 불러오는 중…";
  dom.continueButton.disabled=true;
  dom.startButton.addEventListener("click",startNewGame);
  dom.continueButton.addEventListener("click",continueGame);
  dom.titleSettingsButton.addEventListener("click",()=>openSettings("title"));
  dom.returnTitleButton.addEventListener("click",returnTitle);
  updateContinueButton();
}

function savePhaseLabel(phase){
  return phase===GAME_PHASES.MENU_SELECT?"메뉴 선택":phase===GAME_PHASES.INGREDIENT_SELECT?"재료 고르기":phase===GAME_PHASES.PREP?"낮 준비":phase===GAME_PHASES.OPEN?"밤 영업":"영업 정산";
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
  dom.menuSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.MENU_SELECT);
  dom.ingredientSelectOverlay.classList.toggle("open",state.phase===GAME_PHASES.INGREDIENT_SELECT);
  buildMenuCards();openGameScreen();updateUI(true);syncPhaserObjects();
  if(state.phase==="result")renderNightResult();
  else audio.startBgm();
  setTimeout(resumeStoryForCurrentPhase,0);
  return true;
}

function startNewGame(){
  if(readSaveData(AUTO_SAVE_SLOT)&&!window.confirm("자동 저장을 새 게임으로 교체할까요?\n수동 저장 3칸은 그대로 유지됩니다."))return;
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
  clearIngredientHintTimer();
  dom.settingsOverlay.classList.remove("open");dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");dom.menuSelectOverlay.classList.remove("open");dom.ingredientSelectOverlay.classList.remove("open");
  dom.gameScreen.classList.remove("active");dom.titleScreen.classList.add("active");
  showGameHud(false);audio.stopBgm();updateContinueButton();
}
