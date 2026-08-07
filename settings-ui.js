"use strict";

/* ============================================================
   설정창 음량 슬라이더의 "지나온 구간" 금색 칠
   ------------------------------------------------------------
   담당 범위: 슬라이더 3개의 --fill(0~100%) 갱신 한 가지

   담당 범위가 아님:
     · 슬라이더 값 자체와 실제 음량   → game.js (syncAudioControls / audio)
     · 홈·손잡이 생김새               → css/settings.css

   [왜 스크립트가 필요한가]
   크롬 계열은 input[type=range] 의 지나온 구간을 그려 주지 않습니다.
   (파이어폭스는 ::-moz-range-progress 로 브라우저가 직접 그려서 필요 없습니다)
   그래서 홈 배경에 깔 그라디언트의 경계값을 CSS 변수로 넣어 줍니다.

   [왜 game.js 가 아니라 별도 파일인가]
   game.js 는 값과 소리를 다루는 자리이고, 여기는 "칠하는 자리가 어디까지인가"
   라는 순수 표시 문제입니다. syncAudioControls 안에 한 줄 끼워 넣으면 게임
   로직 파일이 CSS 변수 이름까지 알게 됩니다. cursor-setting.js 와 같은 이유로
   나눠 뒀습니다. 이 파일과 css/settings.css 의 --fill 만 지우면 홈이 통짜
   어두운 색으로 돌아갈 뿐, 조작에는 아무 영향이 없습니다.

   [값이 바뀌는 두 경로]
   1. 사용자가 끌 때        → input 이벤트
   2. 설정창을 열 때        → game.js syncAudioControls 가 input.value 를 직접
                              넣습니다. 이때는 이벤트가 안 납니다.
                              그래서 오버레이에 .open 이 붙는 순간을
                              MutationObserver 로 보고 다시 칠합니다.
   ============================================================ */

const SETTINGS_SLIDER_IDS = ["masterVolume", "bgmVolume", "sfxVolume"];

function settingsSliders(){
  return SETTINGS_SLIDER_IDS
    .map(id => document.getElementById(id))
    .filter(Boolean);
}

function refreshSettingsSliderFill(input){
  const min = Number(input.min) || 0;
  const max = Number(input.max);
  const span = (Number.isFinite(max) ? max : 100) - min;
  // max 와 min 이 같은 비정상 값이면 0 으로 나누게 되므로 그냥 0% 로 둡니다.
  const ratio = span > 0 ? (Number(input.value) - min) / span : 0;
  input.style.setProperty("--fill", `${Math.max(0, Math.min(1, ratio)) * 100}%`);
}

function refreshAllSettingsSliderFills(){
  settingsSliders().forEach(refreshSettingsSliderFill);
}

function bindSettingsSliderFill(){
  const sliders = settingsSliders();
  if(!sliders.length) return;
  sliders.forEach(input => {
    input.addEventListener("input", () => refreshSettingsSliderFill(input));
  });

  /* 설정창이 열릴 때 game.js 가 저장된 값을 input.value 에 직접 넣습니다.
     그 순간 붙는 .open 을 보고 다시 칠합니다. class 속성만 보므로 비용은
     설정창을 여닫을 때뿐입니다. */
  const overlay = document.getElementById("settingsOverlay");
  if(overlay){
    new MutationObserver(refreshAllSettingsSliderFills)
      .observe(overlay, { attributes:true, attributeFilter:["class"] });
  }

  refreshAllSettingsSliderFills();
}

if(document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", bindSettingsSliderFill);
else
  bindSettingsSliderFill();
