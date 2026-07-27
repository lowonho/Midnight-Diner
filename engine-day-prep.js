"use strict";

/* ============================================================
   낮 준비 어댑터

   낮 준비 미니게임 15종은 아직 day-prep-minigames.js 안에 한 덩어리로 있고,
   그 안에서 data.mode 문자열("timing" / "rapidCut" / "whisk" ...)로 다시
   갈라집니다. 이 파일은 그 덩어리를 "dayPrep" 엔진 하나로 포장해
   밤 조리와 같은 등록소에 올려 둡니다.

   덕분에 game.js 의 setupMini / updateMini / keydown 은
   낮과 밤을 구분할 필요가 없어졌습니다. 등록소만 보면 됩니다.

   [2단계에서 할 일]
   day-prep-minigames.js 를 엔진별로 쪼개면서
   E1 타이밍 칼질 · E2 번갈아 입력 · E7 계량 · E8 순서 배치 ...
   각각을 자기 파일에서 직접 registerMiniEngine 하도록 바꾸고,
   그 과정이 끝나면 이 어댑터 파일은 통째로 삭제하면 됩니다.

   setup 이 없는 이유: 낮 준비는 startDayPrepMini(day-prep-minigames.js)가
   판을 다 깔고 나서 시작하므로, 공용 setupMini 를 거치지 않습니다.
   ============================================================ */

registerMiniEngine("dayPrep", {
  // 낮 준비에는 제한시간이 없습니다. 타이머 자리에는 진행 횟수를 표시합니다.
  timerRuns() {
    return false;
  },

  update(m, dt) {
    updateDayPrepMini(dt);
  },

  // ACTION 버튼 / Space 로 들어오는 기본 동작
  action() {
    dayPrepPrimaryAction();
  },

  // 원래 game.js 의 keydown 안에 있던 낮 준비 분기를 그대로 옮겼습니다.
  // 낮 준비는 어떤 키든 여기서 소비합니다(원본도 무조건 return 이었습니다).
  key(m, k, e) {
    if (k === "escape") { closeDayPrepMini(); return true; }
    if (m.data.mode === "day3Mandoline" && (k === "arrowleft" || k === "arrowright")) { day3MandolineInput(k.replace("arrow", "")); return true; }
    if (m.data.mode === "day4Mandoline" && (k === "arrowup" || k === "arrowdown")) { day3MandolineInput(k.replace("arrow", "")); return true; }
    if (["shrimpCoat", "breadcrumbCoat"].includes(m.data.mode) && /^[a-z]$/.test(k)) { breadcrumbCoatInput(k); return true; }
    if (m.data.mode === "potatoStarch" && /^[a-z]$/.test(k)) { potatoStarchInput(k, e.repeat); return true; }
    if (e.code === "Space") {
      if (m.data.mode === "rapidCut") { rapidCutKeyDown(e.repeat); return true; }
      if (e.repeat && m.data.requiresDoubleTap) return true;
      dayPrepPrimaryAction(); return true;
    }
    if (k === "arrowleft" || k === "arrowright") { dayPrepDirectionInput(k.replace("arrow", "")); return true; }
    return true;
  },

  keyup(m, k, e) {
    if (e.code === "Space" && m.data.mode === "rapidCut") rapidCutKeyUp();
  }
});
