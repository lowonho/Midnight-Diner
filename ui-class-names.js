"use strict";

/* ============================================================
   JS 가 CSS 에 붙이는 클래스 이름 표

   [왜 따로 모으나]
   `el.classList.add("phase-prep")` 처럼 JS 안에 문자열로 흩어져 있으면,
   CSS 에서 그 이름을 바꾸거나 지워도 **아무 에러가 안 납니다.**
   화면만 조용히 안 바뀌어서 원인을 찾기가 어렵습니다.
   (id 는 getElementById 가 null 이라도 돌려주지만 클래스는 그것도 없습니다)

   실제로 그렇게 죽어 있던 것이 두 개 있었습니다.
     phase-title  · phase-result  — JS 는 계속 붙이는데 CSS 규칙이 0건
   이번에 둘 다 지웠습니다.

   [쓰는 법]
   여기 있는 이름과 css/*.css 의 선택자는 짝입니다. 한쪽을 고치면
   반드시 다른 쪽도 고쳐야 합니다. 이 파일이 그 "짝 목록" 입니다.

   [로드 순서]
   game.js 보다 먼저 로드해야 합니다.
   ============================================================ */

const UI_CLASS = Object.freeze({
  /* 진행 단계 — #gameApp 에 붙습니다. css/hud.css 가 이 두 개로 HUD 를 줄입니다.
     ※ 메뉴 선택·정산 단계는 CSS 규칙이 없어서 클래스를 붙이지 않습니다. */
  phasePrep: "phase-prep",     // css/hud.css:203~213
  phaseOpen: "phase-open",     // css/hud.css:214

  /* 보임 / 숨김 */
  hudHidden: "hidden-hud",     // css/app-shell.css — 투명 + 클릭 차단 (HUD 3종)
  hidden: "is-hidden",         // css/components.css — display:none (버튼 개별 숨김)
  screenActive: "active",      // css/app-shell.css — 타이틀 ↔ 게임 화면 전환

  /* 오버레이 (설정 · 미니게임) */
  overlayOpen: "open",         // css/components.css:73

  /* 토스트 */
  toastShow: "show",           // css/interaction.css:136
  toastBad: "bad",             // css/interaction.css:137

  /* 상호작용 프롬프트 · 모바일 액션 버튼 */
  promptShow: "show",          // css/interaction.css:37
  actionAvailable: "available",

  /* 메뉴 카드 (ui-hud.js 가 그립니다) */
  menuCard: "menu-card",
  menuCardIcon: "food-icon",
  menuCardIconEmpty: "menu-icon-placeholder",
  menuCardTag: "menu-tag",
  menuCardOrderCount: "order-count"
});

/* JS 가 값을 넘기고, 그 값으로 무엇을 그릴지는 CSS 가 정합니다.
   예) JS 는 "청결도 62" 만 넘기고, 막대로 그릴지 원으로 그릴지는 CSS 가 결정 */
const UI_VAR = Object.freeze({
  cleanliness: "--clean",      // css/hud.css   .clean-track i
  promptX: "--prompt-x",       // css/interaction.css  .station-prompt
  promptY: "--prompt-y",
  knobX: "--knob-x",           // css/interaction.css  .joystick-knob
  knobY: "--knob-y"
});
