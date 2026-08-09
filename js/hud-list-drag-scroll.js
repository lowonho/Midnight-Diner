"use strict";

/* ============================================================
   좌측 HUD 목록을 잡고 끌어서 굴리기

   [담당 범위] `.drag-scroll` 이 붙은 목록 — 낮 준비 목록(day.js)과
   밤 주문 목록(night.js). 자리·스크롤 규칙은 css/hud.css 에 있습니다.

   [왜 필요한가] 준비 목록에 메뉴별 세부 작업이 들어가면서 패널 최대 높이
   (css/hud.css 의 .left-hud max-height)를 넘칩니다. 휠은 브라우저가
   알아서 굴려 주지만, 마우스로 잡아 끄는 길이 없으면 휠 없는 환경에서
   아래쪽 항목을 볼 방법이 없습니다.

   [왜 위임(delegation)인가] 목록은 day.js/night.js 가 innerHTML 로 통째로
   갈아 끼웁니다. 목록 요소에 직접 리스너를 달면 다시 그려지는 순간 사라집니다.
   그래서 document 한 곳에서 받고 closest() 로 목록을 찾습니다.

   [터치는 일부러 뺍니다] 터치는 브라우저 기본 스크롤이 이미 더 잘 돕니다
   (관성·튕김). 여기서 같이 처리하면 한 번 끌 때 두 번 굴러 두 배로 움직입니다.

   [끄는 법] index.html 에서 이 파일 <script> 한 줄을 빼면 됩니다.
   휠 스크롤은 CSS(overflow-y:auto)만으로 그대로 남습니다.
   ============================================================ */

(() => {
  const SELECTOR = ".drag-scroll";
  // 이만큼 움직이기 전에는 끌기로 안 봅니다. 누를 것이 있는 목록(밤 주문 줄)에서
  // 손이 살짝 흔들렸다고 클릭이 씹히면 안 됩니다.
  const DRAG_THRESHOLD = 4;
  // 끌기가 끝난 직후에 오는 click 한 번만 삼킵니다. 시간으로 끊어야
  // "끌고 놨는데 click 이 안 온" 경우에 플래그가 남아 다음 클릭을 먹지 않습니다.
  const CLICK_BLOCK_MS = 250;

  let list = null;         // 지금 끌고 있는 목록
  let pointerId = null;
  let startY = 0;
  let startTop = 0;
  let dragged = false;     // 문턱을 넘겼는가
  let blockClickUntil = 0;

  const scrollable = node => node.scrollHeight - node.clientHeight > 1;

  document.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const found = event.target.closest?.(SELECTOR);
    if (!found || !scrollable(found)) return;
    list = found;
    pointerId = event.pointerId;
    startY = event.clientY;
    startTop = found.scrollTop;
    dragged = false;
  });

  document.addEventListener("pointermove", event => {
    if (!list || event.pointerId !== pointerId) return;
    const moved = event.clientY - startY;
    if (!dragged) {
      if (Math.abs(moved) < DRAG_THRESHOLD) return;
      dragged = true;
      list.classList.add("dragging");
    }
    // 아래로 끌면 목록이 따라 내려와야 하므로 scrollTop 은 반대로 갑니다.
    list.scrollTop = startTop - moved;
    // 글자 선택(드래그 하이라이트)이 같이 걸리는 것을 막습니다.
    event.preventDefault();
  });

  const endDrag = () => {
    if (!list) return;
    list.classList.remove("dragging");
    if (dragged) blockClickUntil = performance.now() + CLICK_BLOCK_MS;
    list = null;
    pointerId = null;
    dragged = false;
  };
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  // 캡처 단계에서 잡아야 목록 안쪽 요소의 클릭 처리보다 먼저 막을 수 있습니다.
  document.addEventListener("click", event => {
    if (performance.now() >= blockClickUntil) return;
    blockClickUntil = 0;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  /* 끌 수 있는 상태일 때만 손 모양 커서와 진한 스크롤 막대를 씁니다.
     (`can-scroll` 을 보는 규칙은 css/hud.css · css/cursor.css)
     목록은 innerHTML 로 다시 그려지므로 DOM 변화를 보고 다시 판정합니다. */
  const syncScrollableFlags = () => {
    document.querySelectorAll(SELECTOR).forEach(node =>
      node.classList.toggle("can-scroll", scrollable(node)));
  };

  const start = () => {
    const hud = document.querySelector("#leftHud");
    if (hud) new MutationObserver(syncScrollableFlags)
      .observe(hud, { childList: true, subtree: true });
    // 창 크기가 바뀌면 --upx 가 따라 변해 목록 높이도 같이 변합니다.
    addEventListener("resize", syncScrollableFlags);
    syncScrollableFlags();
  };

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", start);
  else start();
})();
