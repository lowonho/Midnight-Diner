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
     key(m, k, e)      키를 눌렀을 때. k 는 소문자 키 이름.
                       true 를 반환하면 "내가 처리했다"는 뜻이라 Space 기본
                       동작(action 호출)이 실행되지 않습니다.
     keyup(m, k, e)    키에서 손을 뗐을 때.

   m 은 state.mini 이고, 어떤 엔진을 쓸지는 m.engine 에 들어 있습니다.
   (밤 조리는 startMini 가, 낮 준비는 startDayPrepMini 가 채웁니다)
   ============================================================ */

const MINI_ENGINES = {};

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

/* ---- 여러 엔진이 함께 쓰는 도우미 ----------------------------
   왕복하는 포인터(#miniMarker)와 그 위치로 점수를 내는 계산은
   썰기·뒤집기·튀기기·직화구이가 똑같이 씁니다.
   숫자를 바꾸면 네 게임에 동시에 반영되니 주의하세요. */

// 포인터를 좌우로 왕복시키고 화면에 반영합니다.
function advanceBounceMarker(m, dt) {
  m.data.marker += m.data.dir * m.data.speed * dt;
  if (m.data.marker >= 1) { m.data.marker = 1; m.data.dir = -1; }
  if (m.data.marker <= 0) { m.data.marker = 0; m.data.dir = 1; }
  const marker = dom.miniContent.querySelector("#miniMarker");
  if (marker) marker.style.left = `${m.data.marker * 100}%`;
}

// 목표 지점에서 얼마나 벗어났는지로 25~100점을 냅니다.
function markerScore(m, target) {
  return Math.round(clamp(100 - Math.abs(m.data.marker - target) * 260, 25, 100));
}
