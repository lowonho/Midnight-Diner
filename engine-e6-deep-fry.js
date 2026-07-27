"use strict";

/* ============================================================
   E6 튀기기 — 밤 조리 "fry"

   두 단계입니다.
     1) 기름 온도가 황금빛 구간(62%~87%)에 왔을 때 Space 로 바스켓을 건집니다.
     2) 바스켓을 올린 뒤 Space 를 빠르게 두 번(탁탁) 눌러 기름을 텁니다.
        두 번째 입력이 0.65초를 넘기면 처음부터 다시.
   최종 점수 = (건진 점수 + 100) / 2

   1)에서 시간이 다 되면 실패가 아니라 6초를 다시 주고 재도전시킵니다.
   기름 터는 동안(2단계)에는 제한시간이 흐르지 않습니다. → timerRuns 참고

   fryerStyle 이 없는 구형 분기는 지금 아무도 호출하지 않지만
   그대로 두었습니다. (1단계는 옮기기만 하고 지우지 않습니다)

   [화면 구성] 레퍼런스와 같은 3열입니다. 규칙은 css/minigames.css 아래쪽
   "E6 튀기기" 구역에 몰아두었습니다.
     [재료 카드]   [튀김기 + 온도 바]   [진행도 카드 · 조작 카드]
   공용 프레임(ui-mini-frame.js / css/minigame-frame.css)은 건드리지 않습니다.
   이 화면이 떠 있는 동안에만 .mini-content 의 가운데 열 제한을 풀고,
   오른쪽 카드와 겹치는 공용 타이머 카드(#miniTimer)를 숨깁니다.
   남은 시간은 진행도 카드 안의 얇은 바(#fryTimeBar)가 대신 보여줍니다.

   [에셋] 아래 FRY_ASSET_PATHS 경로에 파일을 넣으면 CSS 임시 도형 대신
   자동으로 그림이 쓰입니다. 없으면 지금처럼 CSS 도형으로 그립니다.

   쓰는 곳: 새우튀김 튀기기 · 감자튀김 튀기기 (game-data.js 의 game:"fry")
   ============================================================ */

/* ---- 선택 에셋 ----------------------------------------------
   낮 준비(day-prep-minigames.js)의 방식과 같습니다. 파일이 없으면
   로딩 실패를 무시하고 CSS 도형으로 대체하므로 지금 그대로 돌아갑니다. */
const FRY_ASSET_PATHS = Object.freeze({
  fryerBody: "assets/night/fry/fryer-body.png",          // 튀김기 통
  friesBasket: "assets/night/fry/fries-basket.png",      // 감자튀김이 담긴 바스켓 한 장
  shrimpBasket: "assets/night/fry/shrimp-basket.png",    // 새우튀김이 담긴 바스켓 한 장
  friesIngredient: "assets/night/fry/fries-ingredient.png",   // 재료 카드 그림
  shrimpIngredient: "assets/night/fry/shrimp-ingredient.png"
});
const fryAssets = {};
Object.entries(FRY_ASSET_PATHS).forEach(([key, src]) => {
  const image = new Image();
  image.onload = () => { fryAssets[key] = src; };
  image.src = src;
});
function fryAssetMarkup(key, className, alt = "") {
  if (!fryAssets[key]) return "";
  return `<img class="fry-asset ${className}" src="${fryAssets[key]}" alt="${alt}" draggable="false" />`;
}

registerMiniEngine("fry", {
  setup(m, { set, dish }) {
    const fryerStyle = dish?.id === "shrimpTempura" ? "shrimp" : dish?.id === "fries" ? "fries" : null;
    const itemName = fryerStyle === "shrimp" ? "새우튀김" : fryerStyle === "fries" ? "감자튀김" : "튀김";
    set(
      fryerStyle ? `${itemName} 튀기기` : "튀김기 건지기",
      fryerStyle ? "녹색 구간에서 건진 후 스페이스바를 두 번 눌러 기름을 털어주세요!" : "색이 황금빛 구간에 들어왔을 때 바스켓을 들어 올리세요.",
      fryerStyle ? 12 : 9
    );
    m.data = fryerStyle
      // totalTime 은 진행도 카드의 남은 시간 바가 쓰는 기준값입니다(set 이 난이도 보정을 끝낸 뒤 값).
      ? { marker: 0, dir: 1, speed: .3, fryerStyle, phase: "frying", liftScore: 0, oilTaps: 0, oilTapWindow: 0, totalTime: m.time }
      : { marker: 0, dir: 1, speed: .34 };
    if (fryerStyle) renderFryer();
    else {
      dom.miniContent.innerHTML = `<div class="progress-track"><i class="progress-zone" style="left:62%;width:25%"></i><i class="progress-perfect" style="left:70%;width:8%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">연한색 → 황금빛 → 탄색</div><button class="mini-action" id="miniAction" type="button">바스켓 들기</button>`;
      dom.miniContent.querySelector("#miniAction").addEventListener("click", miniAction);
    }
  },

  // 기름을 터는 동안에는 제한시간이 흐르지 않습니다.
  timerRuns(m) {
    return !(m.data.fryerStyle && m.data.phase !== "frying");
  },

  update(m, dt) {
    if (!m.data.fryerStyle || m.data.phase === "frying") {
      advanceBounceMarker(m, dt);
      // 진행도 카드 안 남은 시간 바. 다시 그리지 않고 폭만 바꿉니다.
      const timeBar = dom.miniContent.querySelector("#fryTimeBar");
      if (timeBar) timeBar.style.width = `${fryTimePercent(m)}%`;
      return;
    }
    // 탁 한 번만 누르고 멈춘 경우: 0.65초 안에 두 번째가 없으면 처음부터
    if (m.data.phase === "draining" && m.data.oilTaps === 1) {
      m.data.oilTapWindow -= dt;
      if (m.data.oilTapWindow <= 0) {
        m.data.oilTaps = 0; m.data.oilTapWindow = 0;
        dom.miniFeedback.textContent = "두 번의 간격이 길었어요. 다시 탁탁 눌러주세요."; audio.bad(); renderFryer();
      }
    }
  },

  action(m) {
    if (m.data.fryerStyle) { fryerAction(m); return; }
    finishMini(markerScore(m, .74));
  },

  // 튀기는 중 Space 를 꾹 누르고 있으면 연타로 처리되지 않게 막습니다.
  key(m, k, e) {
    return e.code === "Space" && e.repeat && !!m.data.fryerStyle;
  },

  // 온도를 놓쳐도 실패가 아니라 6초를 더 줍니다.
  timeout(m) {
    if (m.data.fryerStyle) {
      m.time = 6; m.data.totalTime = 6; m.data.marker = 0; m.data.dir = 1;
      dom.miniFeedback.textContent = "적정 온도를 놓쳤어요. 다시 황금빛 구간을 맞춰주세요."; audio.bad(); return;
    }
    finishMini(m.score || 35);
  }
});

// 남은 시간 바의 폭(%). 온도를 놓쳐 시간이 다시 늘어나면 기준값도 같이 바뀝니다.
function fryTimePercent(m) {
  const total = m.data.totalTime || m.time || 1;
  return clamp(m.time / total * 100, 0, 100);
}

/* ---- 왼쪽 재료 카드 -----------------------------------------
   에셋이 없을 때 쓰는 임시 그림입니다. 감자튀김은 흩어진 감자채,
   새우튀김은 새우 두 마리를 CSS 도형으로 쌓습니다. */
function fryIngredientArt(fryerStyle, itemName) {
  const asset = fryAssetMarkup(fryerStyle === "fries" ? "friesIngredient" : "shrimpIngredient", "fry-ing-asset", itemName);
  if (asset) return `<span class="fry-ing-art has-fry-asset">${asset}</span>`;
  const pieces = fryerStyle === "fries"
    ? Array.from({ length: 11 }, (_, i) => `<i class="fry-ing-stick" style="--fx:${6 + (i * 29) % 74}%;--fy:${12 + (i * 41) % 62}%;--ft:${-58 + (i * 37) % 116}deg"></i>`).join("")
    : Array.from({ length: 2 }, (_, i) => `<i class="frying-shrimp shrimp-${i + 1}"></i>`).join("");
  return `<span class="fry-ing-art ${fryerStyle}" aria-hidden="true">${pieces}</span>`;
}

/* ---- 가운데 튀김기 ------------------------------------------
   바스켓은 phase 에 따라 기름 속(frying) / 위(basket-raised) 로만 움직입니다.
   기름 터는 연출(oil-shaking)은 마지막 탁 이후 한 번만 재생됩니다. */
function fryerSceneMarkup(data, raised, finishing, itemName) {
  const isFries = data.fryerStyle === "fries";
  const bodyAsset = fryAssetMarkup("fryerBody", "fryer-vat-asset", "튀김기");
  const basketAsset = fryAssetMarkup(isFries ? "friesBasket" : "shrimpBasket", "fryer-basket-asset", `${itemName} 바스켓`);
  const items = isFries
    ? Array.from({ length: 36 }, (_, i) => `<i class="frying-fry fry-${i + 1}"></i>`).join("")
    : Array.from({ length: 3 }, (_, i) => `<i class="frying-shrimp shrimp-${i + 1}"></i>`).join("");
  return `
    <div class="fry-scene fryer-${data.fryerStyle} ${raised ? "basket-raised" : "frying"} ${finishing ? "oil-shaking" : ""}" aria-label="튀김기 안에서 익고 있는 ${itemName}">
      <i class="fryer-handle left" aria-hidden="true"></i>
      <i class="fryer-handle right" aria-hidden="true"></i>
      <div class="fryer-vat ${bodyAsset ? "has-fry-asset" : ""}">
        ${bodyAsset}
        <i class="fryer-oil"></i>
        ${Array.from({ length: 9 }, (_, i) => `<i class="oil-bubble bubble-${i + 1}"></i>`).join("")}
      </div>
      <div class="fryer-basket ${basketAsset ? "has-fry-asset" : ""}">
        <i class="basket-handle" aria-hidden="true"></i>
        ${basketAsset || `<div class="fried-items ${data.fryerStyle}">${items}</div>`}
      </div>
      ${raised ? Array.from({ length: 7 }, (_, i) => `<i class="oil-drop drop-${i + 1}"></i>`).join("") : ""}
    </div>`;
}

// 가운데 아래 온도 바. 포인터(#miniMarker)는 advanceBounceMarker 가 left 만 바꿉니다.
function fryTempBarMarkup() {
  return `
    <div class="fry-temp-bar" aria-label="기름 온도">
      <div class="fry-temp-track">
        <i class="fry-temp-zone" style="left:62%;width:25%"></i>
        <i class="fry-temp-perfect" style="left:70%;width:8%"></i>
        <i class="fry-temp-burn" style="left:87%"></i>
        <i class="fry-temp-ticks"></i>
      </div>
      <i id="miniMarker" class="fry-temp-marker"></i>
    </div>`;
}

// 기름 터는 단계에서 온도 바 자리에 들어가는 SPACE 두 번 안내.
function fryTapRowMarkup(taps) {
  return `
    <div class="oil-tap-guide" aria-label="스페이스 입력 ${taps}회">
      <kbd class="${taps >= 1 ? "done" : "active"}">SPACE</kbd><b>탁</b>
      <kbd class="${taps >= 2 ? "done" : taps === 1 ? "active" : ""}">SPACE</kbd><b>탁</b>
    </div>`;
}

/* ---- 오른쪽 조작 카드 ---------------------------------------
   1) 온도 구간 그림 + "황금빛 구간에서 건지기"
   2) Space › Space + "기름 털기 n / 2"
   두 줄 다 눌러서도 진행할 수 있게 버튼입니다(마우스 전용 플레이 대비). */
function fryControlCardMarkup(data, raised, finishing, itemName, taps) {
  return `
    <div class="fry-card fry-control-card">
      <h3 class="fry-card-title">조작</h3>
      <div class="fry-step ${raised ? "done" : "current"}">
        <span class="fry-step-no">1</span>
        <button class="fry-step-body" type="button" data-fry-action aria-label="${itemName} 건지기" ${raised ? "disabled" : ""}>
          <span class="fry-gauge">
            <span class="fry-gauge-track">
              <i class="fry-temp-zone" style="left:62%;width:25%"></i>
              <i class="fry-temp-perfect" style="left:70%;width:8%"></i>
              <i class="fry-temp-burn" style="left:87%"></i>
            </span>
            <i class="fry-gauge-marker" style="left:74%"></i>
          </span>
        </button>
      </div>
      <p class="fry-step-desc">황금빛 구간에서 건지기</p>
      <i class="fry-step-split" aria-hidden="true"></i>
      <div class="fry-step ${raised && !finishing ? "current" : finishing ? "done" : ""}">
        <span class="fry-step-no">2</span>
        <button class="fry-step-body" type="button" data-fry-action aria-label="기름 털기" ${raised && !finishing ? "" : "disabled"}>
          <kbd class="fry-key ${taps >= 1 ? "done" : raised ? "active" : ""}">Space</kbd>
          <i class="fry-key-link" aria-hidden="true">›</i>
          <kbd class="fry-key ${taps >= 2 ? "done" : taps === 1 ? "active" : ""}">Space</kbd>
        </button>
      </div>
      <p class="fry-step-desc">기름 털기 ${taps} / 2</p>
    </div>`;
}

function renderFryer() {
  const m = state.mini; if (!m || m.engine !== "fry" || !m.data.fryerStyle) return;
  const data = m.data, itemName = data.fryerStyle === "fries" ? "감자튀김" : "새우튀김";
  const raised = data.phase !== "frying", finishing = data.phase === "finishing", taps = Math.min(data.oilTaps, 2);
  if (raised) { dom.miniDescription.textContent = `스페이스바를 빠르게 두 번 탁탁 눌러 ${itemName}의 기름을 털어내세요.`; dom.miniTimer.textContent = `탁탁 ${taps} / 2`; }
  dom.miniContent.innerHTML = `
    <div class="fry-screen">
      <aside class="fry-card fry-ing-card">
        <h3 class="fry-card-title starred">재료</h3>
        <div class="fry-ing-figure">${fryIngredientArt(data.fryerStyle, itemName)}</div>
        <p class="fry-ing-name">${itemName} <b>× 1</b></p>
      </aside>

      <div class="fry-work-area">
        ${fryerSceneMarkup(data, raised, finishing, itemName)}
        ${data.phase === "frying" ? fryTempBarMarkup() : fryTapRowMarkup(taps)}
      </div>

      <aside class="fry-side">
        <div class="fry-card fry-progress-card">
          <h3 class="fry-card-title">진행도</h3>
          <p class="fry-progress-value"><b>${finishing ? 1 : 0}</b> / 1</p>
          <div class="fry-time-bar" aria-hidden="true"><i id="fryTimeBar" style="width:${fryTimePercent(m)}%"></i></div>
        </div>
        ${fryControlCardMarkup(data, raised, finishing, itemName, taps)}
      </aside>
    </div>`;
  const marker = dom.miniContent.querySelector("#miniMarker"); if (marker) marker.style.left = `${data.marker * 100}%`;
  dom.miniContent.querySelectorAll("[data-fry-action]").forEach(button => button.addEventListener("click", miniAction));
}

function fryerAction(m) {
  const data = m.data, itemName = data.fryerStyle === "fries" ? "감자튀김" : "새우튀김";
  if (data.phase === "frying") {
    if (data.marker < .62 || data.marker > .87) { dom.miniFeedback.textContent = data.marker < .62 ? "아직 온도가 낮아요. 황금빛 구간에서 건져주세요." : "온도가 너무 높아요. 황금빛 구간으로 돌아오면 건져주세요."; audio.bad(); return; }
    data.liftScore = Math.round(clamp(100 - Math.abs(data.marker - .74) * 260, 70, 100));
    data.phase = "draining"; data.oilTaps = 0; data.oilTapWindow = 0; audio.click();
    dom.miniFeedback.textContent = `${itemName}이 잘 익었어요! 이제 스페이스바를 두 번 탁탁!`; renderFryer(); return;
  }
  if (data.phase !== "draining") return;
  data.oilTaps++;
  if (data.oilTaps === 1) { data.oilTapWindow = .65; audio.click(); dom.miniFeedback.textContent = "탁! 한 번 더 빠르게!"; renderFryer(); return; }
  data.phase = "finishing"; data.oilTapWindow = 0; audio.click(); dom.miniFeedback.textContent = `탁탁! ${itemName}의 기름이 시원하게 털렸어요.`; renderFryer();
  setTimeout(() => { if (state.mini === m && !m.complete) finishMini(Math.round((data.liftScore + 100) / 2)); }, 380);
}
