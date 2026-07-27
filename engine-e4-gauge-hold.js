"use strict";

/* ============================================================
   E4 게이지 유지 — 밤 조리 "heat"

   −/＋ 로 화력을 조절해 바늘을 적정 구간(43%~63%)에 오래 머무르게 합니다.
   머문 시간(inZone)이 곧 점수입니다. 5초 유지 = 100점.

   쓰는 곳: 어묵탕 끓이기 · 떡볶이 끓이기 (game-data.js 의 game:"heat")
   낮 준비의 게이지 게임도 나중에 이 엔진으로 합칩니다. (2단계)
   ============================================================ */

registerMiniEngine("heat", {
  setup(m, { set }) {
    const isOden = m.context.mode === "cook" && m.context.dishId === "oden";
    set(
      m.context.mode === "prep" ? "육수 온도 맞추기" : isOden ? "어묵탕 끓이기" : "화력 조절",
      isOden
        ? "작은 냄비의 어묵탕이 맛있게 끓도록 약불과 강불을 조절하세요."
        : "약불과 강불을 조절해 온도를 적정 구간에 오래 유지하세요.",
      8
    );
    m.data = { value: .25, velocity: .08, inZone: 0, total: 0 };
    dom.miniContent.innerHTML = `${isOden ? `<div class="serving-oden-pot" aria-label="작은 냄비에서 끓고 있는 어묵탕"><i class="oden-steam steam-one"></i><i class="oden-steam steam-two"></i><div class="serving-oden-broth"><i class="serving-radish"></i><i class="serving-fishcake fishcake-one"></i><i class="serving-fishcake fishcake-two"></i><i class="serving-green-onion"></i></div><i class="serving-pot-handle left"></i><i class="serving-pot-handle right"></i></div>` : ""}<div class="heat-wrap"><button id="heatDown" class="heat-button" type="button">−</button><div class="heat-gauge"><i class="heat-target"></i><i id="heatNeedle" class="heat-needle"></i></div><button id="heatUp" class="heat-button" type="button">＋</button></div><div class="cut-count">적정 온도 유지: <span id="zoneTime">0.0</span>초</div>`;
    dom.miniContent.querySelector("#heatDown").addEventListener("click", () => { m.data.velocity -= .16; audio.click(); });
    dom.miniContent.querySelector("#heatUp").addEventListener("click", () => { m.data.velocity += .16; audio.click(); });
  },

  update(m, dt) {
    m.data.total += dt;
    m.data.velocity += .035 * dt;
    m.data.velocity *= .985;
    m.data.value = clamp(m.data.value + m.data.velocity * dt, 0, 1);
    if (m.data.value === 0 || m.data.value === 1) m.data.velocity *= -.45;
    if (m.data.value >= .43 && m.data.value <= .63) m.data.inZone += dt;
    const needle = dom.miniContent.querySelector("#heatNeedle");
    if (needle) needle.style.left = `${m.data.value * 100}%`;
    const zone = dom.miniContent.querySelector("#zoneTime");
    if (zone) zone.textContent = m.data.inZone.toFixed(1);
  },

  key(m, k) {
    if (k === "arrowleft" || k === "a") { m.data.velocity -= .16; return true; }
    if (k === "arrowright" || k === "d") { m.data.velocity += .16; return true; }
    return false;
  },

  timeout(m) {
    finishMini(Math.round(clamp(m.data.inZone / 5 * 100, 25, 100)));
  }
});
