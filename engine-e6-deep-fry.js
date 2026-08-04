"use strict";

/* ============================================================
   E6 튀기기 — 밤 조리 "fry"

   [플레이 방식]
   3열 화면 전체가 하나의 조리대입니다. 하단 공용 띠(.mg-strip)는 쓰지 않습니다.
     왼쪽   튀김옷을 입힌 **아직 안 튀긴 재료** 5개
     가운데 탑뷰 기름 냄비
     오른쪽 진행도 카드 + 완성 튀김을 올릴 **망(그릇)**

     1) 왼쪽 재료를 끌어다 기름 냄비에 넣습니다. (한 번에 최대 3개)
     2) 냄비 안에서 시간이 흐르며 3단계로 익습니다.
          설익음  under   0 ~ 3.4초
          잘 익음 cooked  3.4 ~ 7.6초   ← 이때 건져야 합니다
          탐      burnt   7.6초 ~
     3) 냄비 안의 튀김을 끌어다 오른쪽 망에 옮기면 그 순간의 익힘 상태로
        완성됩니다. 5개를 다 옮기면 끝납니다.

   제한시간은 없습니다(timerRuns:false). 압박은 "타기 전에 건져라" 쪽에만
   있습니다. 탄 튀김도 망에 올라가므로 막히는 상황이 생기지 않습니다.
   점수는 망에 올린 5개의 상태 평균입니다 — 전부 잘 익었으면 PERFECT.

   [감자튀김] 원래는 망에 담아 튀기지만, 구현상 감자채 뭉치 하나를 집게로
   집어 넣는 연출로 그립니다. 냄비에 들어가는 것은 감자뿐입니다.

   [마우스 포인터] 이 화면에서는 나중에 집게 모양 커서 에셋을 씌울 예정입니다.
   지금은 손가락(pointer) 커서 그대로 둡니다 — 에셋이 들어오면
   css/minigames.css 의 `.fry-screen` 커서 한 줄만 바꾸면 됩니다.

   [화면 규격] 3열 격자·카드 껍데기는 css/minigame-parts.css 공용 규격이고,
   이 게임 고유의 모양은 css/minigames.css 의 "E6 튀기기" 구역에 있습니다.
   하단 띠를 안 쓰므로 3열이 세로 613.2 를 전부 씁니다
   (좌 패널 A1-613 · 우 아래 패널 A2-460 — 공용 규격 참고).

   쓰는 곳: 새우튀김 튀기기 · 감자튀김 튀기기 (game-data.js 의 game:"fry")
   ============================================================ */

/* ---- 선택 에셋 ----------------------------------------------
   낮 준비(day-prep-minigames.js)와 같은 방식입니다. 파일이 없으면 로딩 실패를
   무시하고 CSS 임시 도형으로 대체하므로, 지금 이대로도 돌아갑니다.

   ⚠️ 익힘 3단계 그림(under/cooked/burnt)이 아직 없어서, 그때는 '기름에 들어가기
      직전' 그림 한 장(rawAsset)에 CSS 필터를 걸어 노릇 → 탄 색을 냅니다.
      3단계 그림이 들어오면 필터를 안 걸고 그림 그대로 씁니다(.tinted 참고). */
const FRY_ASSET_PATHS = Object.freeze({
  // 새우 : 빵가루까지 다 입혀 기름에 들어가기 직전 (E2 납품 에셋을 그대로 씁니다)
  shrimpRaw:    "assets/minigame/E2/shrimp/food_shrimp_breadcrumb_full.webp",
  shrimpUnder:  "assets/minigame/E6/food_shrimp_fry_undercooked.webp",
  shrimpCooked: "assets/minigame/E6/food_shrimp_fry_cooked.webp",
  shrimpBurnt:  "assets/minigame/E6/food_shrimp_fry_burnt.webp",
  // 감자 : 집게로 집어 넣는 감자채 뭉치 한 덩이
  friesRaw:     "assets/minigame/E6/food_fries_clump_raw.webp",
  friesUnder:   "assets/minigame/E6/food_fries_clump_undercooked.webp",
  friesCooked:  "assets/minigame/E6/food_fries_clump_cooked.webp",
  friesBurnt:   "assets/minigame/E6/food_fries_clump_burnt.webp",
  // 집기 : 탑뷰 기름 냄비 · 완성 튀김을 올리는 망
  pot:          "assets/minigame/E6/fix_fry_oil_pot_topview.webp",
  rack:         "assets/minigame/E6/fix_fry_drain_rack.webp"
});
const fryAssets = {};
Object.entries(FRY_ASSET_PATHS).forEach(([key, src]) => {
  const image = new Image();
  image.onload = () => { fryAssets[key] = src; };
  image.src = src;
});
function fryAsset(key) { return key && fryAssets[key] || ""; }

/* 익힘 색을 입힐 때 쓰는 --art 값(url(...))을 만듭니다.

   ⚠️ **경로를 반드시 절대 경로로 바꿔야 합니다.** 커스텀 속성 안의 url() 은
      값을 적은 곳이 아니라 **그 변수를 실제로 쓰는 스타일시트** 기준으로 풀립니다.
      여기서 쓰는 곳이 css/minigames.css 라, 상대 경로를 그대로 넘기면
      css/assets/... 를 찾다 실패해 색이 통째로 안 입혀집니다(조용히 실패합니다).
   ⚠️ 홑따옴표입니다. style="" 안에 들어가는 값이라 겹따옴표는 속성을 끊습니다. */
function fryArtUrl(src) {
  return `url('${new URL(src, document.baseURI).href}')`;
}
function fryAssetMarkup(key, className, alt = "") {
  const src = fryAsset(key);
  return src ? `<img class="${className}" src="${src}" alt="${alt}" draggable="false" />` : "";
}

/* ---- 익힘 시간표 --------------------------------------------
   냄비에 들어간 뒤 흐른 시간(초)으로만 판정합니다. 건질 수 있는 구간이
   4.2초라, 3개를 동시에 넣어도 차례로 건질 수 있습니다. */
const FRY_COOK = Object.freeze({
  underUntil:  3.4,   // 여기까지 설익음
  cookedUntil: 7.6,   // 여기까지 잘 익음 → 넘으면 탐
  potLimit:    3,     // 기름 냄비에 한 번에 들어갈 수 있는 개수
  finishDelay: 900    // 마지막 한 개를 올린 뒤 결과 연출 시간(ms)
});

// 익힘 상태별 점수. 망에 올린 5개의 평균이 이 미니게임의 점수입니다.
const FRY_STAGE_SCORE = Object.freeze({ under: 62, cooked: 100, burnt: 40 });
const FRY_STAGE_LABEL = Object.freeze({ under: "설익은", cooked: "잘 익은", burnt: "탄" });

const FRY_DISHES = Object.freeze({
  shrimp: Object.freeze({
    key: "shrimp", label: "새우튀김", pieceLabel: "새우튀김", count: 5,
    potWidth: 34, rackWidth: 46,
    rawAsset: "shrimpRaw",
    stateAssets: Object.freeze({ under: "shrimpUnder", cooked: "shrimpCooked", burnt: "shrimpBurnt" })
  }),
  fries: Object.freeze({
    key: "fries", label: "감자튀김", pieceLabel: "감자채 뭉치", count: 5,
    potWidth: 30, rackWidth: 42,
    rawAsset: "friesRaw",
    stateAssets: Object.freeze({ under: "friesUnder", cooked: "friesCooked", burnt: "friesBurnt" })
  })
});

/* 냄비 안에서 조각 한가운데가 갈 수 있는 가장 바깥(냄비 칸 한가운데 기준 %).
   기름 원이 칸의 거의 전부라 반지름이 50 인데, 조각이 쇠테에 걸치지 않게
   24 로 묶습니다. (E11 의 FREE_PLATE_RADIUS 와 같은 방식)
     24 + 조각 반지름(34% 짜리 그림의 대각선 절반 ≒ 23) = 47  <  50
   tools/e6-deep-fry-visual-smoke.html 의 reach 값으로 잽니다 — 1.0 이 냄비 테두리입니다. */
const FRY_POT_RADIUS = 24;

// 좌표 없이(스페이스·클릭) 넣을 때 쓰는 냄비 안 기본 자리. 컨셉 이미지의 배치입니다.
const FRY_POT_SEATS = Object.freeze([
  { x: 37, y: 37 }, { x: 63, y: 50 }, { x: 41, y: 70 }
]);
// 조각이 눕는 각도. 난수를 쓰지 않아 다시 그려도 각도가 그대로입니다.
const FRY_TILTS = Object.freeze([-14, 8, -5, 16, -9, 4, 12, -17]);

/* 오른쪽 망 위 다섯 자리. 위에서부터 차례로 채웁니다.
   좌우로 엇갈리게 놓습니다 — 한 줄로 세우면 조각이 망 폭(226)에 맞춰
   작아져서 왼쪽 재료보다 초라해 보입니다. */
const FRY_RACK_SEATS = Object.freeze([
  { x: 34, y: 14, rot: -6 }, { x: 66, y: 32, rot: 5 }, { x: 33, y: 50, rot: -3 },
  { x: 67, y: 68, rot: 7 }, { x: 36, y: 86, rot: -5 }
]);

/* ---- 판정 --------------------------------------------------- */

function fryStageAt(t) {
  if (t < FRY_COOK.underUntil) return "under";
  if (t < FRY_COOK.cookedUntil) return "cooked";
  return "burnt";
}

// 그림 색을 익힘에 따라 바꾸는 0~1 값. 잘 익은 구간 끝에서 1 이 되고 그 뒤로 더 탑니다.
function fryCookRatio(t) {
  return clamp(t / FRY_COOK.cookedUntil, 0, 1.6);
}

function fryScore(data) {
  if (!data.done.length) return 0;
  const total = data.done.reduce((sum, piece) => sum + (FRY_STAGE_SCORE[piece.stage] || 0), 0);
  return Math.round(clamp(total / data.done.length, 25, 100));
}

function fryCompletionGrade(data) {
  return data.done.length && data.done.every(piece => piece.stage === "cooked") ? "perfect" : "good";
}

function fryData(m = state.mini) {
  return m && m.data && m.data.fryerStyle ? m.data : null;
}

function fryDish(data) { return FRY_DISHES[data.fryerStyle]; }

/* ---- 엔진 등록 ---------------------------------------------- */

registerMiniEngine("fry", {
  // 제한시간이 없습니다 — 타는 것 자체가 시간 압박입니다.
  timerRuns() { return false; },

  setup(m, { set, dish }) {
    // 이 게임을 쓰는 요리는 새우튀김·감자튀김 둘뿐입니다. 그 밖은 새우 규격으로 둡니다.
    const fryerStyle = dish?.id === "fries" ? "fries" : "shrimp";
    const config = FRY_DISHES[fryerStyle];
    set(`${config.label} 튀기기`, "알맞게 익었을 때 집게로 건져주세요!", 30);
    m.data = {
      fryerStyle,
      raw: config.count,   // 왼쪽에 남은, 아직 안 튀긴 재료 수
      pot: [],             // 기름 냄비 안 {id,t,stage,x,y,rot}
      done: [],            // 망 위 {id,stage,rot}
      nextId: 1,
      selected: null,      // {type:"raw"} | {type:"piece",id}
      finishing: false,
      completionGrade: null
    };
    clearFryPointer();
    audio.loop?.("deep_fry", m, .68);
    renderFry();
  },

  update(m, dt) {
    const data = fryData(m);
    if (!data || data.finishing) return;
    data.pot.forEach(piece => {
      piece.t += dt;
      const stage = fryStageAt(piece.t);
      const changed = stage !== piece.stage;
      piece.stage = stage;
      const element = dom.miniContent.querySelector(`[data-fry-piece="${piece.id}"]`);
      if (element) {
        element.style.setProperty("--cook", fryCookRatio(piece.t).toFixed(3));
        if (changed) element.dataset.stage = stage;
      }
      if (!changed) return;
      if (stage === "cooked") dom.miniFeedback.textContent = "노릇하게 익었어요! 집게로 건져 완성 그릇에 옮겨주세요.";
      if (stage === "burnt") { dom.miniFeedback.textContent = "타고 있어요! 얼른 건져주세요."; audio.bad?.(); }
    });
  },

  // Space / ACTION 버튼 : 마우스 없이도 진행할 수 있는 길입니다.
  //   건질 게 있으면 가장 오래 익은 것부터 건지고, 없으면 재료를 하나 넣습니다.
  action(m) {
    const data = fryData(m);
    if (!data || m.complete || data.finishing) return;
    const ready = data.pot.filter(piece => piece.stage !== "under").sort((a, b) => b.t - a.t)[0]
      || data.pot.slice().sort((a, b) => b.t - a.t)[0];
    if (ready && (ready.stage !== "under" || !data.raw || data.pot.length >= FRY_COOK.potLimit)) {
      liftFryPiece(ready.id);
      return;
    }
    dropFryPiece();
  },

  // 꾹 누르고 있을 때 연타로 들어가지 않게 막습니다.
  key(m, k, e) {
    return e?.code === "Space" && e.repeat;
  }
});

/* ---- 화면 -------------------------------------------------- */

function renderFry() {
  const m = state.mini, data = fryData(m);
  if (!data) return;
  const dish = fryDish(data);
  const done = data.done.length;
  // TIP 줄 오른쪽 조작 안내 칩(공용). 글자만 넘기고 모양은 CSS 가 그립니다.
  setMiniTipHint("드래그 : 넣기 · 건지기");
  dom.miniContent.innerHTML = `
    <div class="fry-screen fryer-${data.fryerStyle}">
      <aside class="fry-col">
        <div class="fry-card fry-ing-panel">
          <h3 class="fry-card-title starred">재료</h3>
          <div class="fry-raw-list">${Array.from({ length: data.raw }, (_, index) => `
            <button type="button" class="fry-raw-item ${data.selected?.type === "raw" && index === 0 ? "selected" : ""}"
                    data-fry-source="raw" draggable="false" ${data.finishing ? "disabled" : ""}
                    aria-label="${dish.pieceLabel} 기름에 넣기">
              ${fryPieceArt(dish, null).html}
            </button>`).join("")}
          </div>
        </div>
      </aside>

      <div class="fry-work-area">
        ${fryPotMarkup(data, dish)}
        ${data.finishing ? `<strong class="e6-result ${data.completionGrade || "good"} show" id="e6Result">${data.completionGrade === "perfect" ? "PERFECT" : "GOOD"}</strong>` : ""}
      </div>

      <aside class="fry-side">
        <div class="fry-card fry-progress-card">
          <h3 class="fry-card-title">진행도</h3>
          <p class="fry-progress-value"><b>${done}</b> / ${dish.count}</p>
        </div>
        <div class="fry-card fry-rack-panel">
          <h3 class="fry-card-title starred">완성</h3>
          ${fryRackMarkup(data, dish)}
        </div>
      </aside>
    </div>`;
  bindFryEvents();
}

/* 가운데 탑뷰 기름 냄비. 에셋이 없으면 CSS 도형(테두리 + 기름 원 + 기포)입니다. */
function fryPotMarkup(data, dish) {
  const asset = fryAssetMarkup("pot", "fry-pot-asset", "기름 냄비");
  return `
    <div class="fry-pot ${asset ? "has-fry-asset" : ""} ${data.pot.length >= FRY_COOK.potLimit ? "full" : ""}"
         data-fry-drop="pot" role="button" tabindex="0" aria-label="기름 냄비">
      ${asset || `<i class="fry-pot-shape" aria-hidden="true"></i>`}
      <span class="fry-oil-bubbles" aria-hidden="true">${"<i></i>".repeat(10)}</span>
      <span class="fry-pot-food">${data.pot.map((piece, index) => fryPieceMarkup(dish, piece, {
        width: dish.potWidth, z: index + 2, source: "piece"
      })).join("")}</span>
    </div>`;
}

/* 오른쪽 완성 망. 위에서부터 다섯 자리를 차례로 채웁니다. */
function fryRackMarkup(data, dish) {
  const asset = fryAssetMarkup("rack", "fry-rack-asset", "완성 그릇");
  return `
    <div class="fry-rack ${asset ? "has-fry-asset" : ""}" data-fry-drop="rack" role="button" tabindex="0" aria-label="완성 그릇">
      ${asset || `<i class="fry-rack-shape" aria-hidden="true"></i>`}
      <span class="fry-rack-food">${data.done.map((piece, index) => {
        const seat = FRY_RACK_SEATS[index] || FRY_RACK_SEATS[FRY_RACK_SEATS.length - 1];
        return fryPieceMarkup(dish, { ...piece, x: seat.x, y: seat.y, rot: seat.rot }, {
          width: dish.rackWidth, z: index + 2, done: true, last: index === data.done.length - 1
        });
      }).join("")}</span>
    </div>`;
}

/* 튀김 한 조각. 냄비 안 · 망 위 · 끌고 다니는 그림이 전부 이 함수 한 벌입니다.
     --cook  익힘 0~1.6 (노릇해지는 정도)
     --art   익힘 색을 덧입힐 때 쓰는 그림 경로 (아래 fryPieceArt 설명 참고)
     data-stage  under | cooked | burnt */
function fryPieceMarkup(dish, piece, { width, z = 2, source = null, done = false, last = false } = {}) {
  const stage = piece.stage || "under";
  const art = fryPieceArt(dish, stage);
  const drag = source ? `data-fry-source="${source}" data-fry-piece="${piece.id}"` : "";
  return `<span class="fry-piece ${art.tint} ${done ? "on-rack" : ""} ${last ? "just-added" : ""}"
      ${drag} data-stage="${stage}"
      style="--x:${piece.x}%;--y:${piece.y}%;--w:${width}%;--rot:${piece.rot || 0}deg;--cook:${fryCookRatio(piece.t || 0).toFixed(3)};${art.artVar}z-index:${z}">
      ${art.html}
    </span>`;
}

/* 재료 그림 한 덩이와, 그 위에 익힘 색을 어떻게 입힐지.
     tint ""            익힘 3단계 그림이 있는 경우 — 그림 그대로 씁니다
          "tinted"      '기름에 들어가기 직전' 그림 한 장 + 색 덧입히기
          "shape-tinted" 그림이 없어 CSS 임시 도형 + 필터

   ⚠️ **원본에 필터만 거는 방법으로는 튀김이 갈색이 안 됩니다.** 새우 그림의
      빵가루가 거의 흰색이라 sepia 를 걸어도 흰색 그대로고(sepia 는 밝기를 지킵니다),
      brightness 로 어둡게 하면 갈색이 아니라 잿빛이 됩니다. 그래서 같은 그림을
      한 장 더 깔고 그 사본만 갈색으로 만들어 --cook 만큼 겹칩니다 — 규칙은
      css/minigames.css 의 `.fry-piece.tinted::after` 입니다. */
function fryPieceArt(dish, stage) {
  const stateSrc = fryAsset(stage && dish.stateAssets[stage]);
  const src = stateSrc || fryAsset(dish.rawAsset);
  if (src) return {
    tint: stateSrc ? "" : "tinted",
    artVar: stateSrc ? "" : `--art:${fryArtUrl(src)};`,
    html: `<img class="fry-art-asset" src="${src}" alt="${dish.pieceLabel}" draggable="false" />`
  };
  return {
    tint: "shape-tinted",
    artVar: "",
    html: dish.key === "fries" ? fryClumpShapeMarkup() : fryShrimpShapeMarkup()
  };
}

// 감자채 뭉치 임시 도형 — 가닥을 엇갈리게 쌓습니다(컨셉 이미지의 뭉치 모양).
function fryClumpShapeMarkup() {
  const sticks = Array.from({ length: 13 }, (_, i) =>
    `<b style="--fx:${8 + (i * 27) % 70}%;--fy:${14 + (i * 43) % 60}%;--ft:${-62 + (i * 39) % 124}deg"></b>`).join("");
  return `<span class="fry-art clump" aria-hidden="true">${sticks}</span>`;
}

// 새우튀김 임시 도형 — 몸통 한 덩이 + 꼬리
function fryShrimpShapeMarkup() {
  return `<span class="fry-art shrimp" aria-hidden="true"><b class="body"></b><b class="tail"></b></span>`;
}

/* ---- 조작 : Pointer Events 드래그 · 클릭 · Space ------------
   E11(단발 액션)과 같은 방식입니다. 마우스와 터치를 한 벌로 처리합니다. */

let fryPointer = null;
let suppressFryClick = false;

function clearFryPointer() {
  fryPointer?.ghost?.remove();
  fryPointer = null;
  document.querySelectorAll("[data-fry-drop].drop-hover").forEach(drop => drop.classList.remove("drop-hover"));
}

function fryDropAt(x, y) {
  return document.elementFromPoint(x, y)?.closest("[data-fry-drop]") || null;
}

function moveFryPointer(event) {
  const drag = fryPointer;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
  if (!drag.dragging && Math.hypot(dx, dy) >= 5) {
    drag.dragging = true;
    drag.card.classList.add("dragging");
    drag.ghost = document.createElement("span");
    // 익힘 색까지 그대로 들고 나옵니다 — 집어 든 순간 튀김이 다시 하얘지면 안 됩니다
    drag.ghost.className = `fry-drag-ghost ${drag.card.className.includes("tinted") ? "tinted" : ""}`;
    drag.ghost.dataset.stage = drag.stage || "under";
    drag.ghost.style.setProperty("--cook", drag.card.style.getPropertyValue("--cook") || 0);
    const artUrl = drag.card.style.getPropertyValue("--art");
    if (artUrl) drag.ghost.style.setProperty("--art", artUrl);
    drag.ghost.innerHTML = drag.card.querySelector(".fry-art-asset,.fry-art")?.outerHTML || "";
    // 끌고 다니는 크기를 냄비에 놓였을 때와 같게 맞춥니다 — 놓는 순간 크기가
    // 달라지면 "여기 놓는다" 가 눈으로 어긋납니다.
    const potWidth = dom.miniContent.querySelector(".fry-pot")?.getBoundingClientRect().width;
    const dish = fryDish(fryData() || {});
    if (potWidth && dish) drag.ghost.style.width = `${potWidth * dish.potWidth / 100}px`;
    document.body.appendChild(drag.ghost);
  }
  if (!drag.dragging) return;
  event.preventDefault();
  drag.ghost.style.left = `${event.clientX}px`;
  drag.ghost.style.top = `${event.clientY}px`;
  document.querySelectorAll("[data-fry-drop].drop-hover").forEach(drop => drop.classList.remove("drop-hover"));
  fryDropAt(event.clientX, event.clientY)?.classList.add("drop-hover");
}

function returnFryGhost(drag) {
  if (!drag.ghost) return;
  const rect = drag.card.getBoundingClientRect();
  drag.ghost.classList.add("returning");
  drag.ghost.style.left = `${rect.left + rect.width / 2}px`;
  drag.ghost.style.top = `${rect.top + rect.height / 2}px`;
  setTimeout(() => drag.ghost?.remove(), 240);
}

function finishFryPointer(event, cancelled = false) {
  const drag = fryPointer;
  if (!drag || drag.pointerId !== event.pointerId) return;
  fryPointer = null;
  drag.card.classList.remove("dragging");
  document.querySelectorAll("[data-fry-drop].drop-hover").forEach(drop => drop.classList.remove("drop-hover"));
  if (!drag.dragging) return;
  suppressFryClick = true;
  setTimeout(() => { suppressFryClick = false; }, 0);
  const drop = cancelled ? null : fryDropAt(event.clientX, event.clientY);
  const spot = drop ? { drop, clientX: event.clientX, clientY: event.clientY, drag: true } : null;
  const handled = spot && (drag.source === "raw"
    ? dropFryPiece(spot)
    : drop.dataset.fryDrop === "rack" ? liftFryPiece(drag.id, spot) : moveFryPieceInPot(drag.id, spot));
  if (handled) drag.ghost?.remove();
  else returnFryGhost(drag);
}

function bindFryEvents() {
  const scene = dom.miniContent.querySelector(".fry-screen");
  if (!scene) return;
  scene.querySelectorAll("[data-fry-source]").forEach(card => {
    const source = card.dataset.frySource, id = Number(card.dataset.fryPiece) || null;
    card.addEventListener("pointerdown", event => {
      if (fryPointer || card.disabled || event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      selectFryItem(source, id);
      fryPointer = { pointerId: event.pointerId, source, id, card, stage: card.dataset.stage,
                     startX: event.clientX, startY: event.clientY, dragging: false, ghost: null };
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener("pointermove", moveFryPointer);
    card.addEventListener("pointerup", event => finishFryPointer(event));
    card.addEventListener("pointercancel", event => finishFryPointer(event, true));
    card.addEventListener("lostpointercapture", event => finishFryPointer(event, true));
    card.addEventListener("click", event => {
      if (suppressFryClick) { event.preventDefault(); return; }
      selectFryItem(source, id);
    });
    card.addEventListener("dragstart", event => event.preventDefault());
  });

  // 집어 든 것을 클릭/엔터로 놓는 길 (마우스 드래그 없이도 진행할 수 있게)
  scene.querySelectorAll("[data-fry-drop]").forEach(drop => {
    drop.addEventListener("click", event => dropFryOnTarget(drop, { drop, clientX: event.clientX, clientY: event.clientY }));
    drop.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      dropFryOnTarget(drop, null);
    });
  });
}

// 재료·튀김 집기. 다시 그리지 않고 선택 표시만 바꿉니다.
function selectFryItem(source, id) {
  const m = state.mini, data = fryData(m);
  if (!data || m.complete || data.finishing) return;
  if (source === "raw" && !data.raw) return;
  if (source === "piece" && !data.pot.some(piece => piece.id === id)) return;
  data.selected = source === "raw" ? { type: "raw" } : { type: "piece", id };
  const dish = fryDish(data);
  dom.miniContent.querySelectorAll("[data-fry-source]").forEach(card => card.classList.toggle("selected",
    card.dataset.frySource === source && (source === "raw" || Number(card.dataset.fryPiece) === id)));
  dom.miniFeedback.textContent = source === "raw"
    ? `${dish.pieceLabel}을(를) 집었습니다. 기름 냄비에 넣어주세요.`
    : "집게로 집었습니다. 완성 그릇에 옮겨주세요.";
}

// 클릭으로 놓기 — 어디를 눌렀는지에 따라 넣기/건지기가 갈립니다.
function dropFryOnTarget(drop, spot) {
  const data = fryData();
  if (!data || !data.selected) return;
  const target = drop.dataset.fryDrop;
  if (data.selected.type === "raw") {
    if (target === "pot") dropFryPiece(spot);
    else dom.miniFeedback.textContent = "먼저 기름 냄비에 넣어 튀겨주세요!";
    return;
  }
  if (target === "rack") liftFryPiece(data.selected.id, spot);
  else moveFryPieceInPot(data.selected.id, spot);
}

/* ---- 냄비 안 자리 계산 --------------------------------------
   마우스를 뗀 자리를 냄비 칸 기준 0~100 좌표로 바꿉니다.
   기름 원 밖이면 가장 가까운 안쪽으로 당겨 붙입니다. */
function fryPotPoint(spot) {
  const rect = spot?.drop?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return null;
  let x = (spot.clientX - rect.left) / rect.width * 100;
  let y = (spot.clientY - rect.top) / rect.height * 100;
  const dx = (x - 50) / FRY_POT_RADIUS, dy = (y - 50) / FRY_POT_RADIUS, dist = Math.hypot(dx, dy);
  if (dist > 1) { x = 50 + dx / dist * FRY_POT_RADIUS; y = 50 + dy / dist * FRY_POT_RADIUS; }
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// 좌표 없이 넣을 때 쓰는 자리. 지금 비어 있는 기본 자리를 순서대로 씁니다.
function fryFreeSeat(data) {
  const used = data.pot.map(piece => piece.seat);
  const free = FRY_POT_SEATS.findIndex((_, index) => !used.includes(index));
  return free < 0 ? 0 : free;
}

/* ---- 1) 재료를 기름에 넣기 ---------------------------------- */
function dropFryPiece(spot = null) {
  const m = state.mini, data = fryData(m);
  if (!data || m.complete || data.finishing) return false;
  const dish = fryDish(data);
  if (!data.raw) { dom.miniFeedback.textContent = "튀길 재료를 다 넣었어요. 냄비 안 튀김을 건져주세요."; return false; }
  if (data.pot.length >= FRY_COOK.potLimit) {
    dom.miniFeedback.textContent = `기름 냄비에는 ${FRY_COOK.potLimit}개까지만 들어갑니다. 먼저 건져주세요!`;
    audio.bad?.();
    return false;
  }
  const seat = fryFreeSeat(data), point = fryPotPoint(spot) || FRY_POT_SEATS[seat];
  data.pot.push({
    id: data.nextId++, t: 0, stage: "under", seat,
    x: point.x, y: point.y, rot: FRY_TILTS[(data.nextId + data.pot.length) % FRY_TILTS.length]
  });
  data.raw--;
  data.selected = null;
  // 기름에 넣는 순간의 쇳소리 + 치익. 원래 바스켓을 털 때 쓰던 소리를 그대로 씁니다
  // (SFX_PRODUCTION_CHECKLIST 의 sfx_fry_basket_shake)
  audio.play?.("fry_basket_shake", { owner: m });
  dom.miniFeedback.textContent = `${dish.pieceLabel}을(를) 기름에 넣었습니다. 노릇해지면 건져주세요!`;
  renderFry();
  return true;
}

/* ---- 2) 기름 안에서 자리 옮기기 ------------------------------ */
function moveFryPieceInPot(id, spot) {
  const data = fryData();
  const piece = data?.pot.find(item => item.id === id);
  if (!piece) return false;
  const point = fryPotPoint(spot);
  if (!point) return false;
  piece.x = point.x; piece.y = point.y;
  data.selected = null;
  renderFry();
  return true;
}

/* ---- 3) 튀김을 건져 망에 올리기 ------------------------------ */
function liftFryPiece(id, spot = null) {
  const m = state.mini, data = fryData(m);
  if (!data || m.complete || data.finishing) return false;
  const index = data.pot.findIndex(piece => piece.id === id);
  if (index < 0) return false;
  const dish = fryDish(data), piece = data.pot[index];
  data.pot.splice(index, 1);
  data.done.push({ id: piece.id, stage: piece.stage, t: piece.t });
  data.selected = null;
  audio.play?.("fry_basket_lift", { owner: m });
  const allDone = data.done.length >= dish.count;
  if (allDone) {
    data.finishing = true;
    data.completionGrade = fryCompletionGrade(data);
  }
  dom.miniFeedback.textContent = allDone
    ? `${dish.label} ${dish.count}개 완성!`
    : `${FRY_STAGE_LABEL[piece.stage]} ${dish.pieceLabel} 완성 그릇으로!  (${data.done.length} / ${dish.count})`;
  if (piece.stage !== "cooked") audio.bad?.();
  renderFry();
  if (!allDone) return true;
  audio.stop?.("deep_fry", m);
  setTimeout(() => {
    if (state.mini !== m || m.complete) return;
    finishMini(fryScore(data));
  }, FRY_COOK.finishDelay);
  return true;
}
