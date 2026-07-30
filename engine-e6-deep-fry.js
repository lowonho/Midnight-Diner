"use strict";

/* ============================================================
   E6 튀기기 — 밤 조리 "fry"

   두 단계입니다.
     1) 익힘 포인터가 초록 GOOD(18%) 안의 금색 PERFECT(7%)에 왔을 때 Space 로 건집니다.
     2) 바스켓을 올린 뒤 Space 를 빠르게 두 번(탁탁) 눌러 기름을 텁니다.
        각 Space 입력 순간 바스켓이 좌우로 한 번씩 즉시 움직입니다.
        두 번째 입력이 0.55초를 넘기면 처음부터 다시.

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

const FRY_CONFIG=Object.freeze({
  shrimp:Object.freeze({speed:.23,itemCount:5,goodStart:.67,goodEnd:.85,perfectStart:.725,perfectEnd:.795,perfectCenter:.76,burnStart:.9,tapWindow:.55}),
  fries:Object.freeze({speed:.26,itemCount:36,goodStart:.67,goodEnd:.85,perfectStart:.725,perfectEnd:.795,perfectCenter:.76,burnStart:.9,tapWindow:.55})
});

function fryVisualStage(marker){
  if(marker<.25)return "raw";
  if(marker<.5)return "setting";
  if(marker<.7)return "golden";
  if(marker<.9)return "ready";
  return "over";
}

function fryTimingGrade(marker,config){
  if(marker>=config.perfectStart&&marker<=config.perfectEnd)return "perfect";
  if(marker>=config.goodStart&&marker<=config.goodEnd)return "good";
  return "miss";
}

function fryTimingScore(marker,config){
  const grade=fryTimingGrade(marker,config),distance=Math.abs(marker-config.perfectCenter);
  if(grade==="perfect")return Math.round(clamp(100-distance/(config.perfectEnd-config.perfectCenter)*4,96,100));
  if(grade==="good")return Math.round(clamp(92-distance*130,78,92));
  return 25;
}

function fryCompletionGrade(data){return data.liftGrade==="perfect"&&!(data.drainErrors||0)&&!(data.fryErrors||0)?"perfect":"good";}

function updateFryVisual(data){
  const scene=dom.miniContent.querySelector(".fry-scene");if(!scene)return;
  const stage=fryVisualStage(data.marker);
  scene.style.setProperty("--fry-progress",data.marker.toFixed(3));
  scene.classList.remove("fry-raw","fry-setting","fry-golden","fry-ready","fry-over");
  scene.classList.add(`fry-${stage}`);
}

registerMiniEngine("fry", {
  setup(m, { set, dish }) {
    const fryerStyle = dish?.id === "shrimpTempura" ? "shrimp" : dish?.id === "fries" ? "fries" : null;
    const config=fryerStyle?FRY_CONFIG[fryerStyle]:null;
    const itemName = fryerStyle === "shrimp" ? "새우튀김" : fryerStyle === "fries" ? "감자튀김" : "튀김";
    set(
      fryerStyle ? `${itemName} 튀기기` : "튀김기 건지기",
      fryerStyle ? "녹색 구간에서 건진 후 스페이스바를 두 번 눌러 기름을 털어주세요!" : "색이 황금빛 구간에 들어왔을 때 바스켓을 들어 올리세요.",
      fryerStyle ? 12 : 9
    );
    m.data = fryerStyle
      // totalTime 은 진행도 카드의 남은 시간 바가 쓰는 기준값입니다(set 이 난이도 보정을 끝낸 뒤 값).
      ? { marker: 0, dir: 1, speed: config.speed, fryerStyle, phase: "frying", liftScore: 0, liftGrade:"miss", oilTaps: 0, oilTapWindow: 0, drainErrors:0, fryErrors:0, totalTime: m.time }
      : { marker: 0, dir: 1, speed: .34 };
    if(fryerStyle)audio.loop?.("deep_fry",m,.68);
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
    if (!m.data.fryerStyle) {
      advanceBounceMarker(m, dt);
      return;
    }
    if (m.data.phase === "frying") {
      // 음식은 다시 덜 익은 상태로 돌아가지 않으므로 포인터도 한 방향으로만 진행합니다.
      m.data.marker=Math.min(1,m.data.marker+m.data.speed*dt);
      const marker=dom.miniContent.querySelector("#miniMarker");if(marker)marker.style.left=`${m.data.marker*100}%`;
      updateFryVisual(m.data);
      // 진행도 카드 안 남은 시간 바. 다시 그리지 않고 폭만 바꿉니다.
      const timeBar = dom.miniContent.querySelector("#fryTimeBar");
      if (timeBar) timeBar.style.width = `${fryTimePercent(m)}%`;
      return;
    }
    // 탁 한 번만 누르고 멈춘 경우: 설정된 짧은 시간 안에 두 번째가 없으면 처음부터
    if (m.data.phase === "draining" && m.data.oilTaps === 1) {
      m.data.oilTapWindow -= dt;
      if (m.data.oilTapWindow <= 0) {
        m.data.oilTaps = 0; m.data.oilTapWindow = 0; m.data.drainErrors=(m.data.drainErrors||0)+1;
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
    return e?.code === "Space" && e.repeat && !!m.data.fryerStyle;
  },

  // 온도를 놓쳐도 실패가 아니라 6초를 더 줍니다.
  timeout(m) {
    if (m.data.fryerStyle) {
      m.time = 6; m.data.totalTime = 6; m.data.marker = 0; m.data.dir = 1; m.data.fryErrors=(m.data.fryErrors||0)+1;
      const marker=dom.miniContent.querySelector("#miniMarker");if(marker)marker.style.left="0%";updateFryVisual(m.data);
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
   바스켓은 phase 에 따라 기름 속(frying) / 위(basket-raised) 로 움직입니다.
   첫 번째와 두 번째 탁은 각각 oil-tap-one / oil-tap-two 연출을 즉시 재생합니다. */
function fryerSceneMarkup(data, raised, finishing, itemName) {
  const isFries = data.fryerStyle === "fries",config=FRY_CONFIG[data.fryerStyle];
  const bodyAsset = fryAssetMarkup("fryerBody", "fryer-vat-asset", "튀김기");
  const basketAsset = fryAssetMarkup(isFries ? "friesBasket" : "shrimpBasket", "fryer-basket-asset", `${itemName} 바스켓`);
  const items = isFries
    ? Array.from({ length:config.itemCount }, (_, i) => `<i class="frying-fry fry-${i + 1}"></i>`).join("")
    : Array.from({ length:config.itemCount }, (_, i) => `<i class="frying-shrimp shrimp-${i + 1}"></i>`).join("");
  const shakeClass=data.oilTaps===1&&data.phase==="draining"?"oil-tap-one":data.phase==="finishing"?"oil-tap-two":"";
  const dropCount=raised?(data.oilTaps===1?7:data.oilTaps>=2?5:3):0;
  return `
    <div class="fry-scene fryer-${data.fryerStyle} ${raised ? "basket-raised" : "frying"} ${shakeClass} fry-${fryVisualStage(data.marker)}" style="--fry-progress:${data.marker}" aria-label="튀김기 안에서 익고 있는 ${itemName}">
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
      ${Array.from({ length:dropCount }, (_, i) => `<i class="oil-drop drop-${i + 1}"></i>`).join("")}
    </div>`;
}

// 가운데 아래 익힘 바. 초록 GOOD 안쪽에 작은 금색 PERFECT가 놓입니다.
function fryTempBarMarkup(config) {
  return `
    <div class="fry-temp-bar" aria-label="튀김 익힘 정도">
      <div class="fry-temp-track">
        <i class="fry-temp-zone" style="left:${config.goodStart*100}%;width:${((config.goodEnd-config.goodStart)*100).toFixed(1)}%"></i>
        <i class="fry-temp-perfect" style="left:${config.perfectStart*100}%;width:${((config.perfectEnd-config.perfectStart)*100).toFixed(1)}%"></i>
        <i class="fry-temp-burn" style="left:${config.burnStart*100}%"></i>
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
function fryControlCardMarkup(data, raised, finishing, itemName, taps, config) {
  return `
    <div class="fry-card fry-control-card">
      <h3 class="fry-card-title">조작</h3>
      <div class="fry-step ${raised ? "done" : "current"}">
        <span class="fry-step-no">1</span>
        <button class="fry-step-body" type="button" data-fry-action aria-label="${itemName} 건지기" ${raised ? "disabled" : ""}>
          <span class="fry-gauge">
            <span class="fry-gauge-track">
              <i class="fry-temp-zone" style="left:${config.goodStart*100}%;width:${((config.goodEnd-config.goodStart)*100).toFixed(1)}%"></i>
              <i class="fry-temp-perfect" style="left:${config.perfectStart*100}%;width:${((config.perfectEnd-config.perfectStart)*100).toFixed(1)}%"></i>
              <i class="fry-temp-burn" style="left:${config.burnStart*100}%"></i>
            </span>
            <i class="fry-gauge-marker" style="left:${config.perfectCenter*100}%"></i>
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
  const data = m.data, config=FRY_CONFIG[data.fryerStyle], itemName = data.fryerStyle === "fries" ? "감자튀김" : "새우튀김";
  const raised = data.phase !== "frying", finishing = data.phase === "finishing", taps = Math.min(data.oilTaps, 2);
  if (raised) { dom.miniDescription.textContent = `스페이스바를 빠르게 두 번 탁탁 눌러 ${itemName}의 기름을 털어내세요.`; dom.miniTimer.textContent = `탁탁 ${taps} / 2`; }
  dom.miniContent.innerHTML = `
    <div class="fry-screen">
      <aside class="fry-col">
        <div class="fry-card fry-ing-panel">
          <h3 class="fry-card-title starred">재료</h3>
          <div class="fry-ing-list">
            <div class="fry-ing-card">
              <div class="fry-ing-figure">${fryIngredientArt(data.fryerStyle, itemName)}</div>
              <p class="fry-ing-name">${itemName} <b>× 1</b></p>
            </div>
          </div>
        </div>
      </aside>

      <div class="fry-work-area">
        ${fryerSceneMarkup(data, raised, finishing, itemName)}
        ${finishing?`<strong class="e6-result ${data.completionGrade||"good"} show" id="e6Result">${data.completionGrade==="perfect"?"PERFECT":"GOOD"}</strong>`:""}
      </div>

      <aside class="fry-side">
        <div class="fry-card fry-progress-card">
          <h3 class="fry-card-title">진행도</h3>
          <p class="fry-progress-value"><b>${finishing ? 1 : 0}</b> / 1</p>
          <div class="fry-time-bar" aria-hidden="true"><i id="fryTimeBar" style="width:${fryTimePercent(m)}%"></i></div>
        </div>
        ${fryControlCardMarkup(data, raised, finishing, itemName, taps, config)}
      </aside>
      <!-- 하단 공용 띠 : 온도 바(또는 기름 털기 안내). 원래 가운데 열 안에만 있어
           824.2 였는데, 3열을 관통해 1360.2 를 씁니다. -->
      <div class="mg-strip">${data.phase === "frying" ? fryTempBarMarkup(config) : fryTapRowMarkup(taps)}</div>
    </div>`;
  const marker = dom.miniContent.querySelector("#miniMarker"); if (marker) marker.style.left = `${data.marker * 100}%`;
  dom.miniContent.querySelectorAll("[data-fry-action]").forEach(button => button.addEventListener("click", miniAction));
}

function fryerAction(m) {
  const data = m.data, config=FRY_CONFIG[data.fryerStyle], itemName = data.fryerStyle === "fries" ? "감자튀김" : "새우튀김";
  if (data.phase === "frying") {
    const timingGrade=fryTimingGrade(data.marker,config);
    if (timingGrade==="miss") {
      data.fryErrors=(data.fryErrors||0)+1;
      const wasLate=data.marker>config.goodEnd;
      if(wasLate){data.marker=0;const marker=dom.miniContent.querySelector("#miniMarker");if(marker)marker.style.left="0%";updateFryVisual(data);}
      dom.miniFeedback.textContent=wasLate?"건지는 타이밍을 놓쳤어요. 새 배치를 다시 튀겨주세요.":"조금 더 노릇해질 때까지 기다려주세요.";audio.bad();return;
    }
    data.liftGrade=timingGrade;data.liftScore=fryTimingScore(data.marker,config);
    data.phase = "draining"; data.oilTaps = 0; data.oilTapWindow = 0;
    audio.stop?.("deep_fry",m);audio.play?.("fry_basket_lift",{owner:m});
    dom.miniFeedback.textContent = `${itemName}이 잘 익었어요! 이제 스페이스바를 두 번 탁탁!`; renderFryer(); return;
  }
  if (data.phase !== "draining") return;
  data.oilTaps++;
  audio.play?.("fry_basket_shake",{owner:m});
  if (data.oilTaps === 1) { data.oilTapWindow = config.tapWindow; dom.miniFeedback.textContent = "탁! 한 번 더 빠르게!"; renderFryer(); return; }
  data.phase = "finishing"; data.oilTapWindow = 0; data.completionGrade=fryCompletionGrade(data); dom.miniFeedback.textContent = `탁탁! ${itemName}의 기름이 시원하게 털렸어요.`; renderFryer();
  setTimeout(() => {
    if (state.mini !== m || m.complete) return;
    const grade=data.completionGrade||fryCompletionGrade(data),score=grade==="perfect"?100:Math.round(clamp(data.liftScore-(data.drainErrors||0)*5-(data.fryErrors||0)*4,70,95));
    finishMini(score);
  }, 380);
}
