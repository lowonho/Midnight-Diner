"use strict";

/* ============================================================
   E6 튀기기 — 밤 조리 "fry"

   [플레이 방식]
   3열 화면 전체가 하나의 조리대입니다. 하단 공용 띠(.mg-strip)는 쓰지 않습니다.
     왼쪽   튀김옷을 입힌 **아직 안 튀긴 재료** 5개 (= 설익음 그림)
     가운데 가스 버너 상판 위의 탑뷰 기름 냄비
     오른쪽 진행도 카드 + 완성 튀김을 올릴 **기름빼기 트레이**

     1) 왼쪽 재료를 끌어다 기름 냄비에 넣습니다. (한 번에 최대 5개 = 다섯 개 전부)
        넣으면 기름으로 툭 떨어져 잠기고, 그 둘레에서 기포가 끓어오릅니다.
     2) 냄비 안에서 시간이 흐르며 3단계로 익습니다.
          설익음  under   0 ~ 3.4초
          잘 익음 cooked  3.4 ~ 6.0초   ← 이때 건져야 합니다
          탐      burnt   6.0초 ~
        세 장을 겹쳐 두고 보이는 장만 바꿔 서서히 노릇해집니다(fryArtMarkup).
     3) 냄비 안의 튀김을 끌어다 오른쪽 트레이에 옮기면 그 순간의 익힘 상태로
        완성됩니다. 5개를 다 옮기면 끝납니다.

   제한시간은 없습니다(timerRuns:false). 압박은 "타기 전에 건져라" 쪽에만
   있습니다. 탄 튀김도 트레이에 올라가므로 막히는 상황이 생기지 않습니다.
   점수는 트레이에 올린 5개의 상태 평균입니다 — 전부 잘 익었으면 PERFECT.

   [감자튀김] 원래는 망에 담아 튀기지만, 구현상 감자채 뭉치 하나를 집게로
   집어 넣는 연출로 그립니다. 냄비에 들어가는 것은 감자뿐입니다.

   [마우스 포인터] 이 화면만 **DOM 으로 그린 고양이 발 집게**를 씁니다
   (.fry-screen 은 cursor:none). 아래 mountFryCursor 설명 참고.

   [화면 규격] 3열 격자·카드 껍데기는 css/minigame-parts.css 공용 규격이고,
   이 게임 고유의 모양은 css/minigames.css 의 "E6 튀기기" 구역에 있습니다.
   하단 띠를 안 쓰므로 3열이 세로 613.2 를 전부 씁니다
   (좌 패널 A1-613 · 우 아래 패널 A2-460 — 공용 규격 참고).

   쓰는 곳: 새우튀김 튀기기 · 감자튀김 튀기기 (game-data.js 의 game:"fry")
   ============================================================ */

/* ---- 선택 에셋 ----------------------------------------------
   낮 준비(day-prep-minigames.js)와 같은 방식입니다. 파일이 없으면 로딩 실패를
   무시하고 CSS 임시 도형으로 대체하므로, 그림이 하나도 없어도 돌아갑니다.

   크기·배율의 근거는 tools/build-minigame-art-webp.js 의 E6 구역에 있습니다. */
const FRY_ASSET_PATHS = Object.freeze({
  /* 튀김 3단계 x 2종. **설익음 장은 왼쪽 재료 칸에도 그대로 씁니다** —
     아직 안 튀긴 재료와 갓 넣은 튀김이 같은 그림입니다. */
  shrimpUnder:  "assets/minigame/E6/food_shrimp_tempura_undercooked.webp",
  shrimpCooked: "assets/minigame/E6/food_shrimp_tempura_perfect.webp",
  shrimpBurnt:  "assets/minigame/E6/food_shrimp_tempura_burnt80.webp",
  friesUnder:   "assets/minigame/E6/food_fries_undercooked.webp",
  friesCooked:  "assets/minigame/E6/food_fries_perfect.webp",
  friesBurnt:   "assets/minigame/E6/food_fries_burnt80.webp",
  // 조리대 : 위에서 본 가스 버너 상판 · 기름 냄비 · 기름빼기 트레이
  burner:       "assets/minigame/E6/fix_gas_burner_top_3297x2453.webp",
  pot:          "assets/minigame/E6/fix_fry_pot_oil_smooth.webp",
  /* 냄비 안 기름만 따로 뽑은 장. 냄비와 캔버스가 같아서 같은 자리에 겹칩니다.
     **튀김 위에 반투명으로 한 번 더 덮는 용도**입니다 — 이래야 기름에 잠겨 보입니다. */
  oilSurface:   "assets/minigame/E6/fix_fry_oil_smooth_01.webp",
  rack:         "assets/minigame/E6/prop_fry_drain_tray_empty.webp",
  /* 집게 커서. 닫힌 집게는 아래팔·윗팔 두 장으로 나뉘어 있고, 그 사이에 집은
     튀김이 들어갑니다. 겹쳐 놓으면 닫힌 집게 한 장과 픽셀까지 같습니다. */
  tongsOpen:    "assets/minigame/E6/ui_cursor_catpaw_tongs_open.webp",
  tongsBottom:  "assets/minigame/E6/ui_cursor_catpaw_tongs_closed_bottom.webp",
  tongsTop:     "assets/minigame/E6/ui_cursor_catpaw_tongs_closed_top.webp",
  // 건져 올린 튀김에서 떨어지는 기름 방울
  oilDrop1:     "assets/minigame/E6/fx_fry_oil_drop_01.webp",
  oilDrop2:     "assets/minigame/E6/fx_fry_oil_drop_02.webp",
  oilDrop3:     "assets/minigame/E6/fx_fry_oil_drop_03.webp"
});
const fryAssets = {};
Object.entries(FRY_ASSET_PATHS).forEach(([key, src]) => {
  const image = new Image();
  image.onload = () => {
    fryAssets[key] = src;
    /* 집게 그림만 늦게 와도 따라잡을 수 있게 해 둡니다. 나머지는 다시 그릴 때
       알아서 붙지만, 커서는 화면을 다시 그리는 일이 없으면 한 판 내내 기본
       포인터로 남습니다 (mountFryCursor 는 화면이 없으면 그냥 돌아갑니다).
       ⚠️ try 로 감쌉니다. 이 파일은 index.html 에서 game.js 보다 **먼저** 실행되는데,
          그림이 그 사이에 도착하면 아직 없는 dom 을 읽다 ReferenceError 가 납니다.
          그때는 그냥 넘어가면 됩니다 — 첫 화면을 그릴 때 bindFryEvents 가 다시 붙입니다. */
    if (key.startsWith("tongs")) { try { mountFryCursor(); } catch (error) { /* 아직 이릅니다 */ } }
  };
  image.src = src;
});
function fryAsset(key) { return key && fryAssets[key] || ""; }

function fryAssetMarkup(key, className, alt = "") {
  const src = fryAsset(key);
  return src ? `<img class="${className}" src="${src}" alt="${alt}" draggable="false" />` : "";
}

/* ---- 익힘 시간표 --------------------------------------------
   냄비에 들어간 뒤 흐른 시간(초)으로만 판정합니다. 건질 수 있는 구간이
   2.6초입니다 — 한 번 끌어다 놓는 데 0.5초 안팎이라 **한꺼번에 다섯 개를
   넣으면 그 안에 다 못 건집니다.** 두세 개씩 나눠 넣어 시차를 두는 것이
   이 게임의 정답이 되도록 일부러 좁혀 둔 값입니다(예전 4.2초는 한꺼번에
   넣어도 다 건질 수 있어 압박이 없었습니다. 3.0초도 재 봤는데 아직 헐거워
   2.6초로 정했습니다 — 손으로 쳐 보고 고른 값이라 계산으로 되돌리지 마세요).
   ⚠️ 여기를 더 좁히면 tools/day4-logic-smoke.html 의 E6 검사(넣고 5초 뒤 =
      잘 익음)가 깨집니다. 그쪽 프레임 수와 한 짝입니다. */
const FRY_COOK = Object.freeze({
  underUntil:  3.4,   // 여기까지 설익음
  cookedUntil: 6.0,   // 여기까지 잘 익음 → 넘으면 탐
  potLimit:    5,     // 기름 냄비에 한 번에 들어갈 수 있는 개수(= 한 판 전체)
  finishDelay: 900    // 마지막 한 개를 올린 뒤 결과 연출 시간(ms)
});

// 익힘 상태별 점수. 망에 올린 5개의 평균이 이 미니게임의 점수입니다.
const FRY_MISTAKE_PENALTY = 10;
const FRY_STAGE_LABEL = Object.freeze({ under: "설익은", cooked: "잘 익은", burnt: "탄" });

/* potWidth 는 냄비 칸(.fry-pot 461), rackWidth 는 트레이 안쪽 상자
   (.fry-rack-food 197.6) 가로 대비 %입니다. artRatio 는 납품 그림의 가로/세로 —
   3단계 그림이 한 자리에 겹쳐 있어서 상자 높이를 그림에서 못 받고(전부 absolute)
   여기서 줍니다.
   ⚠️ rackWidth 를 키우면 다섯 자리(FRY_RACK_SEATS)가 철망 밖으로 밀려납니다.
      조각이 커진 만큼 위아래 여유가 줄어들기 때문입니다 — 둘은 한 짝입니다. */
const FRY_DISHES = Object.freeze({
  shrimp: Object.freeze({
    key: "shrimp", label: "새우튀김", pieceLabel: "새우튀김", count: 5,
    potWidth: 31, rackWidth: 56, artRatio: 1200 / 1127, heldRot: 32,
    stateAssets: Object.freeze({ under: "shrimpUnder", cooked: "shrimpCooked", burnt: "shrimpBurnt" })
  }),
  fries: Object.freeze({
    key: "fries", label: "감자튀김", pieceLabel: "감자채 뭉치", count: 5,
    potWidth: 27, rackWidth: 52, artRatio: 733 / 658, heldRot: -6,
    stateAssets: Object.freeze({ under: "friesUnder", cooked: "friesCooked", burnt: "friesBurnt" })
  })
});

/* 냄비 안에서 조각 한가운데가 갈 수 있는 가장 바깥(냄비 칸 한가운데 기준 %).
   ⚠️ **.fry-pot 칸은 냄비 전체가 아니라 기름 타원입니다** (css 의 .fry-pot-asset
      참고). 그래서 기름 가장자리가 곧 반지름 50 이고, 조각이 쇠테에 걸치지 않게
      26 으로 묶습니다.
        26 + 조각 반지름(31% 짜리 그림의 대각선 절반 ≒ 21.2) = 47.2  <  50
   ⚠️ 다 익은 조각은 떠오르면서 1.08배까지 커집니다(css 의 fry-float). 그 몫까지
      들어간 값이라 더 키우지 마세요 — 대각선으로 가장 멀리 놓았을 때
      떠오르는 순간 조각 귀퉁이가 쇠테를 넘습니다.
   tools/e6-deep-fry-visual-smoke.html 의 reach 값으로 잽니다 — 1.0 이 기름 가장자리입니다.
      (reach 는 커지기 전 크기로 재므로, 여기 값을 만질 때는 1.08 을 곱해 보세요) */
const FRY_POT_RADIUS = 26;

/* 좌표 없이(스페이스·클릭) 넣을 때 쓰는 냄비 안 기본 자리. 다섯 개가 다 들어가므로
   기름 한가운데를 중심으로 반지름 20 짜리 오각형에 하나씩 앉힙니다 — 전부
   FRY_POT_RADIUS(26) 안이라 쇠테에 걸치지 않습니다.
   조각이 커서(냄비 칸 대비 31%) 다섯이면 서로 조금씩 겹치는데, 기름에 가득
   찬 모습이 목적이라 그래도 됩니다. 위 → 좌우 → 아래 순서로 채워서 두세 개만
   넣었을 때도 한쪽으로 쏠리지 않습니다. */
const FRY_POT_SEATS = Object.freeze([
  { x: 50, y: 30 }, { x: 31, y: 44 }, { x: 69, y: 44 },
  { x: 38, y: 66 }, { x: 62, y: 66 }
]);
// 조각이 눕는 각도. 난수를 쓰지 않아 다시 그려도 각도가 그대로입니다.
const FRY_TILTS = Object.freeze([-14, 8, -5, 16, -9, 4, 12, -17]);

/* 오른쪽 트레이 위 다섯 자리. 위에서부터 차례로 채웁니다.
   조각을 크게 담고 좌우로 조금씩만 엇갈리게 놓습니다 — **서로 겹치는 것은
   괜찮습니다.** 튀김을 트레이에 수북이 담아 둔 모습이 목적이라, 띄엄띄엄
   놓으면 다섯 개를 다 튀겨 놓고도 트레이가 허전해 보입니다.

   ⚠️ **다섯 자리가 전부 철망 안에 들어와야 합니다.** 자리는 .fry-rack-food
      (트레이에서 상하 10 · 좌우 14 를 들인 상자) 기준 0~100 인데, 트레이 그림에서
      철망은 위 7% ~ 아래 90% · 좌우 10% ~ 90% 뿐이고 나머지는 테두리입니다(실측).
      그 상자 좌표로 옮기면 가로 4.4% ~ 95.6% · 세로 4.5% ~ 92.4% 가 쓸 수 있는
      자리입니다. 거기서 조각을 눕힌 바깥 상자의 절반(새우 56% 기준 가로 31.0% ·
      세로 17.3%)을 사방에서 빼면 **가로 35.4~64.6 · 세로 21.8~75.1** 이 남고,
      아래 값이 그 안입니다. 조각을 키우면 이 여유가 그만큼 줄어드니
      rackWidth 와 이 표는 늘 같이 고쳐야 합니다.
      (예전 값 14~86 은 이 범위를 넘어서 다섯 번째가 트레이 밖으로 나갔습니다) */
const FRY_RACK_SEATS = Object.freeze([
  { x: 39, y: 22,   rot: -6 }, { x: 61, y: 35.3, rot: 5 }, { x: 38, y: 48.5, rot: -3 },
  { x: 62, y: 61.8, rot: 7 },  { x: 40, y: 75,   rot: -5 }
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
  return clamp(100 - (data?.errors || 0) * FRY_MISTAKE_PENALTY, 0, 100);
}

function chargeFryMistake(m, piece) {
  const data = fryData(m);
  if (!data || !piece || piece.mistakeCharged) return false;
  piece.mistakeCharged = true;
  data.errors = (data.errors || 0) + 1;
  updateMiniScore(m);
  return true;
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
  score(m) {
    const data = fryData(m);
    return data ? fryScore(data) : 100;
  },
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
      errors: 0,
      nextId: 1,
      selected: null,      // {type:"raw"} | {type:"piece",id}
      diveId: null,        // 방금 기름에 떨어뜨린 조각 (한 번만 떨어지는 연출용)
      finishing: false,
      completionGrade: null
    };
    clearFryPointer();
    audio.loop?.("deep_fry", m, .7);
    renderFry();
  },

  update(m, dt) {
    const data = fryData(m);
    if (!data || data.finishing) return;
    /* 집게로 들어 올려 둔 조각은 **안 익습니다.** 기름 밖으로 나와 있는데 시간이
       계속 가면, 어디에 놓을지 고르는 동안 손에서 타 버립니다. */
    const lifted = fryPointer?.dragging && fryPointer.source === "piece" ? fryPointer.id : null;
    let burntMistake = false;
    data.pot.forEach(piece => {
      if (piece.id === lifted) return;
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
      if (stage === "burnt") {
        burntMistake = chargeFryMistake(m, piece) || burntMistake;
        dom.miniFeedback.textContent = `타고 있어요! 얼른 건져주세요. (${fryScore(data)}점)`;
      }
    });
    if (burntMistake) audio.bad?.();
  },

  // 이 화면에는 키 안내가 없습니다 — 키도 받지 않습니다 (mini-engine.js 참고).
  // ⚠️ 아래 action 은 그대로 삽니다. 이 게임의 조작은 드래그·클릭이고, action 은
  //    휴대용 화면의 큰 ACTION 버튼(화면에 보이는 버튼)이 부르는 길입니다.
  //    예전에는 여기로 Space 도 들어왔고, 꾹 누를 때 연타로 들어가는 것을 막으려고
  //    `key(m,k,e){ return e?.code==="Space" && e.repeat; }` 한 줄이 있었습니다 —
  //    Space 가 아예 안 들어오므로 그 줄은 함께 뺐습니다.
  noKeyboard: true,

  // ACTION 버튼 : 마우스로 끌지 않고도 진행할 수 있는 길입니다.
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
              ${fryArtMarkup(dish, "under")}
            </button>`).join("")}
          </div>
        </div>
      </aside>

      <div class="fry-work-area">
        ${fryAssetMarkup("burner", "fry-burner-asset", "가스 버너")}
        ${fryPotMarkup(data, dish)}
        ${data.finishing ? `<strong class="e6-result ${data.completionGrade || "good"} show" id="e6Result">${cookingScoreMessage(fryScore(data))}</strong>` : ""}
      </div>

      <aside class="fry-side">
        ${miniScorePanelMarkup("fry-card fry-progress-card","fry-card-title")}
        <div class="fry-card fry-rack-panel">
          <h3 class="fry-card-title starred">완성</h3>
          ${fryRackMarkup(data, dish)}
          ${miniPenaltyMarkup("fry")}
        </div>
      </aside>
    </div>`;
  // 떨어지는 연출은 한 번만 봅니다. 지우지 않으면 다시 그릴 때마다 도로 떨어집니다.
  data.diveId = null;
  bindFryEvents();
}

/* 가운데 탑뷰 기름 냄비. 에셋이 없으면 CSS 도형(테두리 + 기름 원 + 기포)입니다.

   [겹치는 순서] 아래에서 위로 — 이 순서가 "기름에 잠긴 것처럼" 의 전부입니다.
     냄비 그림 → 튀김 → **기름막** → 기포
   튀김이 기름막 아래에 깔려야 잠겨 보이고, 기포는 기름막 위로 떠야 수면에서
   터지는 것으로 보입니다. z-index 는 css 의 각 규칙에 적어 뒀습니다.

   ⚠️ **.fry-pot 칸은 냄비 전체가 아니라 기름 타원입니다.** 조각 자리(--x/--y)와
      FRY_POT_RADIUS 가 이 칸 기준이라, 칸이 기름과 같아야 끌어다 놓은 자리가
      눈에 보이는 기름 안쪽과 맞습니다. 냄비 그림은 칸 밖으로 넘겨 깝니다. */
function fryPotMarkup(data, dish) {
  const asset = fryAssetMarkup("pot", "fry-pot-asset", "기름 냄비");
  return `
    <div class="fry-pot ${asset ? "has-fry-asset" : ""} ${data.pot.length >= FRY_COOK.potLimit ? "full" : ""}"
         data-fry-drop="pot" role="button" tabindex="0" aria-label="기름 냄비">
      ${asset || `<i class="fry-pot-shape" aria-hidden="true"></i>`}
      <span class="fry-pot-food">${data.pot.map((piece, index) => fryPieceMarkup(dish, piece, {
        width: dish.potWidth, z: index + 2, source: "piece", dive: piece.id === data.diveId
      })).join("")}</span>
      ${fryAssetMarkup("oilSurface", "fry-oil-veil-asset", "") || `<span class="fry-oil-veil" aria-hidden="true"></span>`}
      <span class="fry-oil-bubbles" aria-hidden="true">${"<i></i>".repeat(10)}</span>
      <span class="fry-fizz-layer" aria-hidden="true">${data.pot.map(piece =>
        fryFizzMarkup(dish, piece, piece.id === data.diveId)).join("")}</span>
    </div>`;
}

/* 조각 하나가 기름에 잠긴 자리에서 올라오는 기포 한 무리.
   자리를 난수로 뽑지 않는 이유는 다시 그릴 때마다 기포가 순간이동해서입니다 —
   조각 상자 기준 %로 못박아 두면 같은 조각은 늘 같은 데서 끓습니다.
   dive 가 참이면 들어간 순간의 물결(css 의 .fry-fizz.splash::after)도 같이 뜹니다. */
const FRY_FIZZ_DOTS = Object.freeze([
  { x: 22, y: 74, s: .9,  d: -.2 },  { x: 46, y: 88, s: 1.25, d: -1.5 },
  { x: 70, y: 70, s: .8,  d: -.9 },  { x: 88, y: 46, s: 1.05, d: -2.1 },
  { x: 12, y: 44, s: 1.1, d: -1.2 }, { x: 34, y: 22, s: .75,  d: -.55 },
  { x: 62, y: 14, s: .95, d: -1.8 }, { x: 84, y: 92, s: .7,   d: -2.5 },
  { x: 6,  y: 66, s: .65, d: -.75 }, { x: 30, y: 52, s: 1.15, d: -1.95 },
  { x: 54, y: 38, s: .6,  d: -.35 }, { x: 76, y: 26, s: 1.0,  d: -2.3 },
  { x: 96, y: 68, s: .85, d: -1.05 },{ x: 18, y: 12, s: .6,   d: -1.65 },
  { x: 48, y: 62, s: .7,  d: -2.75 },{ x: 66, y: 96, s: 1.05, d: -.95 }
]);
function fryFizzMarkup(dish, piece, dive = false) {
  const dots = FRY_FIZZ_DOTS.map(dot =>
    `<i style="--fx:${dot.x}%;--fy:${dot.y}%;--fs:${dot.s};animation-delay:${dot.d}s"></i>`).join("");
  return `<span class="fry-fizz ${dive ? "splash" : ""}" data-fry-fizz="${piece.id}"
      style="--x:${piece.x}%;--y:${piece.y}%;--w:${dish.potWidth}%;--ar:${dish.artRatio.toFixed(4)}">${dots}</span>`;
}

// 집게로 들어 올린 자리는 끓는 것을 멈춥니다 — 없는 재료 둘레에서 기포가 나면 안 됩니다.
function setFryFizzLifted(id, lifted) {
  dom.miniContent.querySelector(`[data-fry-fizz="${id}"]`)?.classList.toggle("lifted", lifted);
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

/* 튀김 한 조각. 냄비 안 · 망 위 · 집게에 물린 그림이 전부 이 함수 한 벌입니다.
     --w     칸 가로 대비 크기(%)     --ar 그림의 가로/세로 (상자 높이)
     --cook  익힘 0~1.6 — 그림이 없어 CSS 임시 도형을 쓸 때만 씁니다
     data-stage  under | cooked | burnt

   냄비 안 조각은 익힘 3단계를 **한 자리에 겹쳐** 들고 있고, 망 위 조각은
   상태가 굳었으니 그 한 장만 듭니다 (아래 fryArtMarkup 설명 참고). */
function fryPieceMarkup(dish, piece, { width, z = 2, source = null, done = false, last = false, dive = false } = {}) {
  const stage = piece.stage || "under";
  const drag = source ? `data-fry-source="${source}" data-fry-piece="${piece.id}"` : "";
  return `<span class="fry-piece ${fryHasArt(dish) ? "" : "shape-tinted"} ${done ? "on-rack" : "in-oil"}
      ${last ? "just-added" : ""} ${dive ? "diving" : ""}"
      ${drag} data-stage="${stage}"
      style="--x:${piece.x}%;--y:${piece.y}%;--w:${width}%;--ar:${dish.artRatio.toFixed(4)};--rot:${piece.rot || 0}deg;--cook:${fryCookRatio(piece.t || 0).toFixed(3)};--z:${z}">
      ${fryArtMarkup(dish, done ? stage : null)}
    </span>`;
}

function fryHasArt(dish) {
  return !!fryAsset(dish.stateAssets.under);
}

/* 튀김 그림 한 벌.
     stage 를 주면 그 한 장만  — 왼쪽 재료 칸(늘 under) · 망 위 · 집게에 물린 튀김
     stage 가 없으면 세 장을 한 자리에 겹쳐 — 냄비 안에서 익어 가는 조각

   ⚠️ **겹쳐 두는 것이 중요합니다.** 단계가 바뀔 때 src 를 갈아 끼우면 새 그림을
      받아 오는 동안 조각이 한 프레임 사라져 깜빡입니다. 세 장을 미리 깔아 두고
      보이는 장만 바꾸면(css 의 .fry-art-asset[data-art]) 서서히 노릇해집니다 —
      그림 세 장이 한 크기라 겹쳐도 어긋나지 않습니다
      (tools/build-minigame-art-webp.js 의 E6 구역 참고). */
function fryArtMarkup(dish, stage = null) {
  if (!fryHasArt(dish)) return dish.key === "fries" ? fryClumpShapeMarkup() : fryShrimpShapeMarkup();
  return (stage ? [stage] : ["under", "cooked", "burnt"]).map(name =>
    `<img class="fry-art-asset" data-art="${name}" src="${fryAsset(dish.stateAssets[name])}"
          alt="${dish.pieceLabel}" draggable="false" />`).join("");
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

/* ---- 고양이 발 집게 커서 ------------------------------------
   이 화면만 마우스 포인터를 **DOM 으로 그립니다** (.fry-screen.has-tongs 는
   cursor:none). CSS `cursor:url(...)` 로는 안 되는 것이 두 가지라서입니다.
     1) 집은 튀김을 **아래팔 → 튀김 → 윗팔** 순서로 끼워 넣을 수가 없습니다.
        한 장으로 구운 커서 그림에는 그 사이가 없습니다.
     2) 크롬은 128x128 이 넘는 커서 그림을 통째로 무시합니다. 집게는 그보다
        커야 튀김을 물고 있는 것이 눈에 보입니다.
   대신 진짜 포인터보다 한 프레임 늦게 따라옵니다 — 이 게임 화면 안에서만
   쓰고 그 위에 정확히 눌러야 하는 작은 표적이 없어서 티가 안 납니다.

   [무는 자리를 포인터에 맞추기] 커서 상자의 왼쪽 위 귀퉁이를 포인터에 두고,
   세 장을 각자 음수 left/top 으로 당겨 집게 끝이 포인터에 오게 합니다.
   벌린 집게와 닫힌 집게는 끝 자리가 다릅니다(실측 39.4%,93.0% / 25.0%,91.5%) —
   그래서 집게를 닫으면 끝은 제자리에 있고 손잡이 쪽이 움직입니다. 실제 집게가
   그렇게 닫힙니다. 당기는 값은 css/minigame/e6-deep-fry.css 의 .fry-tongs 에 있습니다.

   [치우기] 미니게임 엔진에는 teardown 이 없습니다. 그래서 포인터가 움직일 때마다
   .fry-screen 이 아직 있는지 보고, 없으면 그때 스스로 지웁니다. */

let fryCursor = null;         // { root, held } — document.body 에 붙습니다
let fryCursorListening = false;

function mountFryCursor() {
  const scene = dom.miniContent?.querySelector(".fry-screen");
  // 집게 그림이 없으면 손대지 않습니다 — 기본 포인터가 그대로 보여야 합니다
  if (!scene || !fryAsset("tongsOpen") || !fryAsset("tongsBottom") || !fryAsset("tongsTop")) return;
  scene.classList.add("has-tongs");
  if (!fryCursor) {
    const root = document.createElement("div");
    root.className = "fry-cursor";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <img class="fry-tongs open"   src="${fryAsset("tongsOpen")}"   alt="" draggable="false" />
      <img class="fry-tongs bottom" src="${fryAsset("tongsBottom")}" alt="" draggable="false" />
      <span class="fry-cursor-held"></span>
      <img class="fry-tongs top"    src="${fryAsset("tongsTop")}"    alt="" draggable="false" />`;
    document.body.appendChild(root);
    fryCursor = { root, held: root.querySelector(".fry-cursor-held") };
  }
  if (fryCursorListening) return;
  fryCursorListening = true;
  // capture 로 받습니다 — 중간에서 이벤트를 막아도 커서는 따라가야 합니다.
  ["pointermove", "pointerdown", "pointerup", "pointercancel"]
    .forEach(type => document.addEventListener(type, trackFryCursor, true));
}

function removeFryCursor() {
  fryCursor?.root.remove();
  fryCursor = null;
  fryCursorListening = false;
  ["pointermove", "pointerdown", "pointerup", "pointercancel"]
    .forEach(type => document.removeEventListener(type, trackFryCursor, true));
}

function trackFryCursor(event) {
  if (!fryCursor) return;
  const scene = dom.miniContent?.querySelector(".fry-screen");
  if (!scene) { removeFryCursor(); return; }        // 미니게임이 끝났습니다
  // 끌고 있는 중이라면 화면 밖으로 나가도 집게는 따라갑니다
  const inside = !!fryPointer || scene.contains(event.target);
  fryCursor.root.classList.toggle("show", inside);
  if (!inside) return;
  fryCursor.root.style.left = `${event.clientX}px`;
  fryCursor.root.style.top = `${event.clientY}px`;
  if (event.type === "pointerdown") fryCursor.root.classList.add("closed");
  if (event.type === "pointerup" || event.type === "pointercancel") fryCursor.root.classList.remove("closed");
}

/* 집게에 튀김을 뭅니다. 익힘 단계까지 그대로 들고 나옵니다 —
   집어 든 순간 튀김이 도로 설익은 색이 되면 안 됩니다.
   기름에서 건진 것(source "piece")에는 기름 방울이 뚝뚝 떨어집니다. */
function holdFryPiece(drag) {
  const dish = fryDish(fryData() || {});
  if (!fryCursor || !dish) return;
  /* 무는 크기를 냄비에 놓였을 때와 같게 맞춥니다 — 놓는 순간 크기가 달라지면
     "여기 놓는다" 가 눈으로 어긋납니다. */
  const potWidth = dom.miniContent.querySelector(".fry-pot")?.getBoundingClientRect().width || 0;
  if (potWidth) fryCursor.held.style.setProperty("--fry-held-w", `${potWidth * dish.potWidth / 100}px`);
  fryCursor.held.innerHTML = `
    <span class="fry-piece held ${fryHasArt(dish) ? "" : "shape-tinted"}" data-stage="${drag.stage || "under"}"
          style="--ar:${dish.artRatio.toFixed(4)};--held-rot:${dish.heldRot}deg;--cook:${drag.card.style.getPropertyValue("--cook") || 0}">
      ${fryArtMarkup(dish, drag.stage || "under")}
    </span>
    ${drag.source === "piece" ? fryOilDripMarkup() : ""}`;
  fryCursor.root.classList.add("holding");
}

// 건져 올린 튀김에서 떨어지는 기름. 세 장이 서로 다른 자리·박자로 떨어집니다.
function fryOilDripMarkup() {
  const drips = [{ key: "oilDrop1", x: 30, d: 0 }, { key: "oilDrop2", x: 58, d: -.45 }, { key: "oilDrop3", x: 44, d: -.9 }]
    .filter(drip => fryAsset(drip.key))
    .map(drip => `<img class="fry-oil-drip" src="${fryAsset(drip.key)}" alt=""
                       style="--dx:${drip.x}%;animation-delay:${drip.d}s" draggable="false" />`).join("");
  return drips ? `<span class="fry-oil-drips" aria-hidden="true">${drips}</span>` : "";
}

function releaseFryHold() {
  if (!fryCursor) return;
  fryCursor.held.innerHTML = "";
  fryCursor.root.classList.remove("holding");
}

/* ---- 조작 : Pointer Events 드래그 · 클릭 · Space ------------
   마우스와 터치를 한 벌로 처리합니다. */

let fryPointer = null;
let suppressFryClick = false;

function clearFryPointer() {
  fryPointer = null;
  releaseFryHold();
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
    if (drag.source === "piece") setFryFizzLifted(drag.id, true);
    holdFryPiece(drag);
  }
  if (!drag.dragging) return;
  event.preventDefault();
  document.querySelectorAll("[data-fry-drop].drop-hover").forEach(drop => drop.classList.remove("drop-hover"));
  fryDropAt(event.clientX, event.clientY)?.classList.add("drop-hover");
}

/* 놓을 데가 아닌 곳에서 손을 떼면 물고 있던 튀김이 제자리로 돌아갑니다.
   집게에서 그림 하나만 떼어 body 에 띄워 보냅니다 — 집게는 커서라 같이
   날아가면 안 되고, 튀김만 돌아가야 합니다. */
function returnFryGhost(drag) {
  const held = fryCursor?.held.querySelector(".fry-piece");
  if (!held || !drag.card.isConnected) return;
  const from = held.getBoundingClientRect(), to = drag.card.getBoundingClientRect();
  const ghost = document.createElement("span");
  ghost.className = "fry-drag-ghost";
  ghost.style.width = `${from.width}px`;
  ghost.style.left = `${from.left + from.width / 2}px`;
  ghost.style.top = `${from.top + from.height / 2}px`;
  ghost.appendChild(held.cloneNode(true));
  document.body.appendChild(ghost);
  // 붙인 프레임에 바로 자리를 바꾸면 브라우저가 시작 자리를 못 잡아 순간이동합니다
  requestAnimationFrame(() => {
    ghost.classList.add("returning");
    ghost.style.left = `${to.left + to.width / 2}px`;
    ghost.style.top = `${to.top + to.height / 2}px`;
  });
  miniSetTimeout(() => ghost.remove(), 320);
}

function finishFryPointer(event, cancelled = false) {
  const drag = fryPointer;
  if (!drag || drag.pointerId !== event.pointerId) return;
  fryPointer = null;
  drag.card.classList.remove("dragging");
  if (drag.source === "piece") setFryFizzLifted(drag.id, false);
  document.querySelectorAll("[data-fry-drop].drop-hover").forEach(drop => drop.classList.remove("drop-hover"));
  if (!drag.dragging) return;
  suppressFryClick = true;
  miniSetTimeout(() => { suppressFryClick = false; }, 0);
  const drop = cancelled ? null : fryDropAt(event.clientX, event.clientY);
  const spot = drop ? { drop, clientX: event.clientX, clientY: event.clientY, drag: true } : null;
  const handled = spot && (drag.source === "raw"
    ? dropFryPiece(spot)
    : drop.dataset.fryDrop === "rack" ? liftFryPiece(drag.id, spot) : moveFryPieceInPot(drag.id, spot));
  if (!handled) returnFryGhost(drag);
  releaseFryHold();
}

function bindFryEvents() {
  const scene = dom.miniContent.querySelector(".fry-screen");
  if (!scene) return;
  mountFryCursor();
  scene.querySelectorAll("[data-fry-source]").forEach(card => {
    const source = card.dataset.frySource, id = Number(card.dataset.fryPiece) || null;
    card.addEventListener("pointerdown", event => {
      if (fryPointer || card.disabled || event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      selectFryItem(source, id);
      fryPointer = { pointerId: event.pointerId, source, id, card, stage: card.dataset.stage,
                     startX: event.clientX, startY: event.clientY, dragging: false };
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
  // 이 한 개만 기름으로 떨어지는 연출 + 물결을 답니다 (renderFry 가 쓰고 지웁니다)
  data.diveId = data.pot[data.pot.length - 1].id;
  // 기름에 넣을 때는 짧게 내려놓는 소리를 냅니다.
  audio.play?.("fry_basket_lift", { owner: m });
  dom.miniFeedback.textContent = `${dish.pieceLabel}을(를) 기름에 넣었습니다. 노릇해지면 건져주세요!`;
  renderFry();
  return true;
}

/* ---- 2) 집게로 들었다가 기름에 도로 넣기 ----------------------
   집게에 물고 있는 동안은 **기름 밖**입니다 — 안 익고(update), 기포도 안 나고
   (setFryFizzLifted), 냄비 안 자리는 비어 보입니다(css 의 .in-oil.dragging).
   그래서 도로 넣는 것은 자리만 옮기는 게 아니라 **다시 넣는 것**이라,
   처음 넣을 때와 같은 물결·떨어지는 연출을 답니다. */
function moveFryPieceInPot(id, spot) {
  const data = fryData();
  const piece = data?.pot.find(item => item.id === id);
  if (!piece) return false;
  const point = fryPotPoint(spot);
  if (!point) return false;
  piece.x = point.x; piece.y = point.y;
  data.selected = null;
  data.diveId = piece.id;
  audio.play?.("fry_basket_lift", { owner: state.mini });
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
  const newMistake = piece.stage !== "cooked" && chargeFryMistake(m, piece);
  data.pot.splice(index, 1);
  data.done.push({ id: piece.id, stage: piece.stage, t: piece.t, mistakeCharged: piece.mistakeCharged });
  data.selected = null;
  audio.play?.("fry_basket_shake", { owner: m });
  const allDone = data.done.length >= dish.count;
  if (allDone) {
    data.finishing = true;
    data.completionGrade = fryCompletionGrade(data);
  }
  dom.miniFeedback.textContent = allDone
    ? `${dish.label} ${dish.count}개 완성!`
    : `${FRY_STAGE_LABEL[piece.stage]} ${dish.pieceLabel} 완성 그릇으로!  (${data.done.length} / ${dish.count})`;
  if (newMistake) audio.bad?.();
  renderFry();
  if (!allDone) return true;
  audio.stop?.("deep_fry", m);
  miniSetTimeout(() => {
    // 집게 커서는 이 화면 전용입니다. 결과 화면까지 따라가면 안 됩니다.
    removeFryCursor();
    if (state.mini !== m || m.complete) return;
    finishMini(fryScore(data));
  }, FRY_COOK.finishDelay);
  return true;
}
