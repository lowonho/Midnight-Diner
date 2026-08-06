"use strict";

/* ============================================================
   고양이 마우스 포인터 켜기/끄기 설정
   ------------------------------------------------------------
   담당 범위: 설정 화면의 "고양이 마우스" ON/OFF 한 줄 ·
              그 값의 저장/복원 · <html> 클래스 반영

   담당 범위가 아님: 포인터 그림과 어디에 걸리는지
              → css/cursor.css

   [왜 game.js · save.js 를 안 건드렸는가]
   저장 키가 `moonlightTable.audio.v1`(음향 전용)이라 커서 설정을 거기
   끼워 넣으면 뜻이 어긋납니다. 그렇다고 save.js 에 비슷한 블록을 하나 더
   만들면 게임 로직 파일이 UI 취향 설정까지 떠안게 됩니다.
   설정값 하나 · 버튼 하나뿐이라 이 파일 안에서 다 끝냅니다.
   dom 목록(game.js)에도 등록하지 않고 getElementById 로 직접 잡습니다.

   [끄는 법] 이 파일과 index.html 의 설정 행(#catCursorRow) 을 지우면
   고양이 포인터가 항상 켜진 상태로 돌아갑니다.
   ============================================================ */

const CAT_CURSOR_KEY = "moonlightTable.catCursor.v1";

/* <html> 에 붙이는 클래스. css/cursor.css 의 `:root.cat-cursor-off` 와 같은 이름이어야 합니다.
   body 가 아니라 <html> 인 이유 : 아래 [깜빡임] 참고. */
const CAT_CURSOR_OFF_CLASS = "cat-cursor-off";

/* 저장된 값이 없으면 켜짐입니다. localStorage 를 막아 둔 브라우저에서도
   게임이 멈추면 안 되므로 읽기/쓰기 둘 다 실패를 삼킵니다. */
function catCursorIsEnabled(){
  try{ return localStorage.getItem(CAT_CURSOR_KEY) !== "off"; }
  catch(_error){ return true; }
}

function writeCatCursorSetting(enabled){
  try{ localStorage.setItem(CAT_CURSOR_KEY, enabled ? "on" : "off"); }
  catch(error){ console.warn("고양이 마우스 설정을 저장하지 못했습니다.", error); }
}

/* [깜빡임] 이 파일은 <head> 에서 CSS 다음에 읽힙니다.
   스크립트를 다른 파일들처럼 </body> 앞에 두면, 껐는데도 페이지가 그려지는
   동안 잠깐 고양이가 보였다가 사라집니다. <head> 에서는 <body> 가 아직
   없으므로 클래스를 document.documentElement 에 붙입니다. */
function applyCatCursorSetting(){
  document.documentElement.classList.toggle(CAT_CURSOR_OFF_CLASS, !catCursorIsEnabled());
}

applyCatCursorSetting();

/* 설정 화면 버튼. 생김새·문구 규칙은 음향 토글 3개(game.js syncAudioToggle)와
   같은 모양으로 맞췄습니다 — 같은 화면에 나란히 서므로 다르면 어색합니다. */
function syncCatCursorToggle(){
  const button = document.getElementById("catCursorToggle");
  if(!button) return;
  const enabled = catCursorIsEnabled();
  button.textContent = enabled ? "ON" : "OFF";
  button.classList.toggle("is-off", !enabled);
  button.setAttribute("aria-pressed", String(enabled));
  button.setAttribute("aria-label", enabled
    ? "고양이 마우스 포인터 켜짐. 누르면 끄기"
    : "고양이 마우스 포인터 꺼짐. 누르면 켜기");
}

function toggleCatCursor(){
  const next = !catCursorIsEnabled();
  writeCatCursorSetting(next);
  applyCatCursorSetting();
  syncCatCursorToggle();
  // 효과음은 game.js 의 전역입니다. 이 파일이 먼저 읽히므로 있는지 확인하고 부릅니다.
  if(typeof sfxAudioIsEnabled === "function" && sfxAudioIsEnabled() && typeof audio === "object")
    audio.uiClick?.();
}

function bindCatCursorSetting(){
  const button = document.getElementById("catCursorToggle");
  if(!button) return;
  button.addEventListener("click", toggleCatCursor);
  syncCatCursorToggle();
}

// <head> 에서 읽히므로 버튼은 아직 없습니다. 문서가 다 그려진 뒤에 잡습니다.
if(document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", bindCatCursorSetting);
else
  bindCatCursorSetting();

// 콘솔에서 확인할 수 있도록 노출
window.catCursorIsEnabled = catCursorIsEnabled;
window.toggleCatCursor = toggleCatCursor;
