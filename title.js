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
  return phase==="day"?"낮 준비":phase==="night"?"밤 영업":"영업 정산";
}

function updateContinueButton(){
  const data=readSaveData();
  dom.continueButton.disabled=!titleGameReady||!data;
  dom.continueButton.textContent="이어하기";
  if(!data){dom.saveInfo.textContent="저장 데이터가 없습니다.";return;}
  dom.saveInfo.textContent=`DAY ${data.state.day} · ${savePhaseLabel(data.state.phase)} · 인기도 ${data.state.popularity}`;
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
  const data=readSaveData();if(!data){updateContinueButton();return;}
  restoreGameState(data);

  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();audio.apply();syncAudioControls();
  dom.resultOverlay.classList.toggle("open",state.phase==="result");
  buildMenuCards();openGameScreen();updateUI(true);syncPhaserObjects();
  if(state.phase==="result")renderNightResult();
  else audio.startBgm();
  audio.success();
  setTimeout(resumeStoryForCurrentPhase,0);
}

function startNewGame(){
  if(readSaveData()&&!window.confirm("기존 이어하기 데이터를 지우고 새 게임을 시작할까요?"))return;
  clearSaveData();startGame();saveGame(true);
}

function startGame(){
  audio.init();if(audio.ctx?.state==="suspended")audio.ctx.resume();
  state.screen="game";state.phase="day";state.paused=false;state.settingsFrom="game";
  state.day=1;state.money=0;state.popularity=0;state.story=createStoryState();state.departures=[];nextOrderId=1;resetDay(true);
  openGameScreen();audio.startBgm();audio.success();
  queueStoryMoments(["newGame","dayStart"]);
}

function returnTitle(){
  saveGame();state.screen="title";state.paused=true;state.mini=null;
  dom.settingsOverlay.classList.remove("open");dom.resultOverlay.classList.remove("open");dom.miniOverlay.classList.remove("open");
  dom.gameScreen.classList.remove("active");dom.titleScreen.classList.add("active");
  showGameHud(false);audio.stopBgm();updateContinueButton();
}
