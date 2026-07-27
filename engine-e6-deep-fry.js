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

   쓰는 곳: 새우튀김 튀기기 · 감자튀김 튀기기 (game-data.js 의 game:"fry")
   ============================================================ */

registerMiniEngine("fry", {
  setup(m, { set, dish }) {
    const fryerStyle = dish?.id === "shrimpTempura" ? "shrimp" : dish?.id === "fries" ? "fries" : null;
    const itemName = fryerStyle === "shrimp" ? "새우튀김" : fryerStyle === "fries" ? "감자튀김" : "튀김";
    set(
      fryerStyle ? `${itemName} · 튀기기` : "튀김기 건지기",
      fryerStyle ? `기름 온도가 황금빛 구간에 들어오면 ${itemName} 바스켓을 건져 올리세요.` : "색이 황금빛 구간에 들어왔을 때 바스켓을 들어 올리세요.",
      fryerStyle ? 12 : 9
    );
    m.data = fryerStyle
      ? { marker: 0, dir: 1, speed: .3, fryerStyle, phase: "frying", liftScore: 0, oilTaps: 0, oilTapWindow: 0 }
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
    if (!m.data.fryerStyle || m.data.phase === "frying") { advanceBounceMarker(m, dt); return; }
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
      m.time = 6; m.data.marker = 0; m.data.dir = 1;
      dom.miniFeedback.textContent = "적정 온도를 놓쳤어요. 다시 황금빛 구간을 맞춰주세요."; audio.bad(); return;
    }
    finishMini(m.score || 35);
  }
});

function renderFryer() {
  const m = state.mini; if (!m || m.engine !== "fry" || !m.data.fryerStyle) return;
  const data = m.data, isFries = data.fryerStyle === "fries", itemName = isFries ? "감자튀김" : "새우튀김", raised = data.phase !== "frying", finishing = data.phase === "finishing";
  if (raised) { dom.miniDescription.textContent = `스페이스바를 빠르게 두 번 탁탁 눌러 ${itemName}의 기름을 털어내세요.`; dom.miniTimer.textContent = `탁탁 ${Math.min(data.oilTaps, 2)} / 2`; }
  dom.miniContent.innerHTML = `
    <div class="shrimp-fryer-scene fryer-${data.fryerStyle} ${raised ? "basket-raised" : "frying"} ${finishing ? "oil-shaking" : ""}" aria-label="튀김기 안에서 익고 있는 ${itemName}">
      <div class="fryer-back"><i class="fryer-temp-light"></i><span>${raised ? "배유 중" : "가열 중"}</span></div>
      <div class="fryer-vat"><i class="fryer-oil"></i>${Array.from({ length: 9 }, (_, i) => `<i class="oil-bubble bubble-${i + 1}"></i>`).join("")}</div>
      <div class="fryer-basket"><i class="basket-handle"></i><div class="fried-items ${data.fryerStyle}">${isFries ? Array.from({ length: 12 }, (_, i) => `<i class="frying-fry fry-${i + 1}"></i>`).join("") : Array.from({ length: 3 }, (_, i) => `<i class="frying-shrimp shrimp-${i + 1}"></i>`).join("")}</div></div>
      ${raised ? Array.from({ length: 7 }, (_, i) => `<i class="oil-drop drop-${i + 1}"></i>`).join("") : ""}
    </div>
    ${data.phase === "frying" ? `
      <div class="progress-track fryer-temperature"><i class="progress-zone" style="left:62%;width:25%"></i><i class="progress-perfect" style="left:70%;width:8%"></i><i id="miniMarker" class="progress-marker"></i></div>
      <div class="cut-count">낮은 온도 → <strong>적정 온도</strong> → 과열</div>
      <button class="mini-action" id="miniAction" type="button">Space · ${itemName} 건지기</button>` : `
      <div class="oil-tap-guide" aria-label="스페이스 입력 ${data.oilTaps}회"><kbd class="${data.oilTaps >= 1 ? "done" : "active"}">SPACE</kbd><b>탁</b><kbd class="${data.oilTaps >= 2 ? "done" : data.oilTaps === 1 ? "active" : ""}">SPACE</kbd><b>탁</b></div>
      <div class="cut-count">기름 털기 ${Math.min(data.oilTaps, 2)} / 2</div>
      <button class="mini-action" id="miniAction" type="button" ${finishing ? "disabled" : ""}>Space · 탁탁 기름 털기</button>`}`;
  const marker = dom.miniContent.querySelector("#miniMarker"); if (marker) marker.style.left = `${data.marker * 100}%`;
  dom.miniContent.querySelector("#miniAction")?.addEventListener("click", miniAction);
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
