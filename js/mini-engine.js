"use strict";

/* ============================================================
   미니게임 엔진 등록소

   [왜 이게 있나]
   예전에는 game.js 의 setupMini / updateMini / keydown 세 곳이
   각각 11갈래 if/else 로 "어떤 미니게임인지"를 판별했습니다.
   게임 하나를 고치려면 그 세 곳을 전부 찾아 고쳐야 했고,
   여러 명이 동시에 작업하면 같은 줄에서 충돌했습니다.

   지금은 각 엔진이 자기 파일에서 registerMiniEngine 으로 스스로 등록하고,
   game.js 는 등록소에서 찾아 부르기만 합니다.

   [새 엔진을 추가하려면]
   1. engine-<이름>.js 파일을 새로 만들고
   2. 그 안에서 registerMiniEngine("<이름>", { ... }) 을 호출하고
   3. index.html 에 <script> 한 줄을 추가합니다.
   → 이 파일도, game.js 도 고칠 필요가 없습니다. (그게 이 구조의 목적입니다)

   [엔진이 가질 수 있는 항목 — 전부 선택입니다]
     setup(m, ctx)     시작할 때 한 번. ctx = { dish, set, difficulty }
                       set(제목, 설명, 제한시간) 으로 공용 패널 문구를 채웁니다.
     update(m, dt)     매 프레임. dt 는 지난 시간(초).
     timerRuns(m)      제한시간을 깎을지 여부. 생략하면 true(깎음).
                       두부 썰기처럼 타이머 자리에 횟수를 쓰는 게임은 false.
     timeout(m)        제한시간이 0 이 됐을 때. 생략하면 finishMini(m.score||35).
     action(m)         Space / ACTION 버튼 / 화면 안 조작 버튼을 눌렀을 때.
     teardown(m)       미니게임 화면이 실제로 닫히기 직전 한 번. document.body에
                       붙인 커서나 전역 이벤트 리스너를 즉시 정리할 때 사용합니다.
     noKeyboard        true 면 **마우스 전용 게임**입니다. game.js 가 키를 통째로
                       무시합니다 — 아래 key/keyup 도, Space 기본 동작(action)도
                       부르지 않습니다. 화면에 키 안내가 없는 게임에 붙이세요.
                       (클릭·드래그로 다 되는 게임에 키가 몰래 먹으면, 안내에 없는
                        조작이 생겨 QA 에서 매번 되묻게 됩니다)
     key(m, k, e)      키를 눌렀을 때. k 는 소문자 키 이름.
                       true 를 반환하면 "내가 처리했다"는 뜻이라 Space 기본
                       동작(action 호출)이 실행되지 않습니다.
     keyup(m, k, e)    키에서 손을 뗐을 때.

   m 은 state.mini 이고, 어떤 엔진을 쓸지는 m.engine 에 들어 있습니다.
   (밤 조리는 startMini 가, 낮 준비는 startDayPrepMini 가 채웁니다)
   ============================================================ */

const MINI_ENGINES = {};

/* 설정창이 열린 동안에도 브라우저의 기본 setTimeout/setInterval 은 계속
   흐릅니다. 미니게임 연출·완료 콜백을 이 등록소로 통일하면 설정을 여는
   순간 남은 시간을 보관하고, 닫은 뒤 정확히 그 지점부터 이어갈 수 있습니다. */
const MINI_ASYNC_TASKS = new Set();
let miniAsyncPaused = false;

function armMiniAsyncTask(task) {
  if (!task || task.cancelled || miniAsyncPaused || task.handle !== null) return;
  task.startedAt = performance.now();
  task.handle = setTimeout(() => {
    task.handle = null;
    if (task.cancelled) return;
    if (task.interval === null) MINI_ASYNC_TASKS.delete(task);
    task.callback();
    if (task.interval !== null && !task.cancelled) {
      task.remaining = task.interval;
      armMiniAsyncTask(task);
    }
  }, Math.max(0, task.remaining));
}

function createMiniAsyncTask(callback, delay, interval = null) {
  const task = {
    callback,
    remaining: Math.max(0, Number(delay) || 0),
    interval,
    startedAt: 0,
    handle: null,
    cancelled: false
  };
  MINI_ASYNC_TASKS.add(task);
  armMiniAsyncTask(task);
  return task;
}

function miniSetTimeout(callback, delay = 0) {
  return createMiniAsyncTask(callback, delay, null);
}

function miniClearTimeout(task) {
  if (!task) return;
  task.cancelled = true;
  if (task.handle !== null) clearTimeout(task.handle);
  task.handle = null;
  MINI_ASYNC_TASKS.delete(task);
}

function miniSetInterval(callback, interval) {
  const delay = Math.max(1, Number(interval) || 1);
  return createMiniAsyncTask(callback, delay, delay);
}

function miniClearInterval(task) {
  miniClearTimeout(task);
}

function pauseMiniAsyncTasks() {
  if (miniAsyncPaused) return;
  miniAsyncPaused = true;
  const now = performance.now();
  MINI_ASYNC_TASKS.forEach(task => {
    if (task.cancelled || task.handle === null) return;
    clearTimeout(task.handle);
    task.handle = null;
    task.remaining = Math.max(0, task.remaining - (now - task.startedAt));
  });
}

function resumeMiniAsyncTasks() {
  if (!miniAsyncPaused) return;
  miniAsyncPaused = false;
  MINI_ASYNC_TASKS.forEach(armMiniAsyncTask);
}

function registerMiniEngine(name, engine) {
  if (MINI_ENGINES[name]) {
    console.warn(`미니게임 엔진 이름이 중복됩니다: ${name} (나중에 로드된 쪽이 이깁니다)`);
  }
  MINI_ENGINES[name] = engine;
}

// 지금 진행 중인 미니게임의 엔진을 꺼냅니다. 없으면 null.
function miniEngine(m = state.mini) {
  if (!m || !m.engine) return null;
  return MINI_ENGINES[m.engine] || null;
}

/* ---- 영업 미니게임 공용 점수 카드 ----------------------------
   영업 중 조리 화면은 오른쪽 위 칸을 모두 점수 카드로 씁니다. 각 엔진은
   score(m)에서 현재까지 얻은 0~100점을 계산하고, 이 공용 함수는 화면 모양과
   갱신만 맡습니다. 이후 게임별 배점만 바꿀 때 마크업을 다시 손댈 필요가 없습니다. */
function miniCurrentScore(m = state.mini) {
  if (!m) return 0;
  const engineScore = miniEngine(m)?.score?.(m);
  const score = Number.isFinite(engineScore) ? engineScore : m.score;
  return Math.round(clamp(Number.isFinite(score) ? score : 0, 0, 100));
}

function miniScorePanelMarkup(panelClass, titleClass, m = state.mini, extra = "") {
  return `<div class="${panelClass} mini-score-panel">
      <h3 class="${titleClass}">점수</h3>
      <p class="mini-score-value"><b data-mini-score>${miniCurrentScore(m)}</b><span>점</span></p>
      ${extra}
    </div>`;
}

function updateMiniScore(m = state.mini, scoreOverride = null) {
  if (!m || !dom.miniContent) return;
  const score = Number.isFinite(scoreOverride)
    ? Math.round(clamp(scoreOverride, 0, 100))
    : miniCurrentScore(m);
  dom.miniContent.querySelectorAll("[data-mini-score]").forEach(value => {
    value.textContent = score;
  });
}

/* ---- 여러 엔진이 함께 쓰는 도우미 ----------------------------
   왕복하는 포인터(#miniMarker)와 그 위치로 점수를 내는 계산은
   썰기·뒤집기·튀기기·직화구이가 똑같이 씁니다.
   숫자를 바꾸면 네 게임에 동시에 반영되니 주의하세요. */

// 포인터를 좌우로 왕복시키고 화면에 반영합니다.
// 게임마다 진행 방향을 담는 칸 이름과 포인터 요소 id 가 달라서 옵션으로 받습니다.
//   기본값  : data.dir       + #miniMarker      (밤 조리)
//   낮 칼질 : data.direction + #dayPrepMarker
function advanceBounceMarker(m, dt, { dirKey = "dir", selector = "#miniMarker" } = {}) {
  const data = m.data;
  data.marker += data[dirKey] * data.speed * dt;
  if (data.marker >= 1) { data.marker = 1; data[dirKey] = -1; }
  if (data.marker <= 0) { data.marker = 0; data[dirKey] = 1; }
  const marker = dom.miniContent.querySelector(selector);
  if (marker) marker.style.left = `${data.marker * 100}%`;
}

// 목표 지점에서 얼마나 벗어났는지로 25~100점을 냅니다.
function markerScore(m, target) {
  return Math.round(clamp(100 - Math.abs(m.data.marker - target) * 260, 25, 100));
}
