"use strict";

/* ============================================================
   E3 방향 시퀀스 — 밤 조리 "stir"

   화면에 뜬 화살표 8개를 순서대로 입력합니다.
   틀릴 때마다 12점씩 깎이고, 최소 70점은 보장됩니다.

   쓰는 곳: 볶음우동 조리 (game-data.js 의 game:"stir")
   낮 준비의 김치 볶기(←→ 방향 입력)도 나중에 이 엔진으로 합칩니다. (2단계)
   ============================================================ */

registerMiniEngine("stir", {
  setup(m, { set }) {
    set("철판 볶기", "표시된 방향 순서를 빠르게 입력해 면과 채소를 골고루 볶으세요.", 10);
    const arrows = Array.from({ length: 8 }, () => ["←", "↑", "→", "↓"][Math.floor(Math.random() * 4)]);
    m.data = { arrows, index: 0, errors: 0 };
    renderArrowGame();
  },

  key(m, k) {
    const map = { arrowleft: "←", arrowup: "↑", arrowright: "→", arrowdown: "↓" };
    if (map[k]) { arrowInput(map[k]); return true; }
    return false;
  }
});

function renderArrowGame() {
  const m = state.mini; if (!m) return;
  dom.miniContent.innerHTML = `<div class="sequence-view" id="arrowSequence">${m.data.arrows.map((a, i) => `<span class="sequence-chip arrow-sequence-chip ${i === m.data.index ? "current" : ""}" data-i="${i}">${a}</span>`).join("")}</div><div class="cut-count" id="arrowProgress">진행 ${m.data.index} / ${m.data.arrows.length}</div><div class="arrow-grid" id="arrowGrid"></div>`;
  const grid = dom.miniContent.querySelector("#arrowGrid");
  ["←", "↑", "→", "↓"].forEach(a => { const b = document.createElement("button"); b.type = "button"; b.className = "arrow-button"; b.dataset.arrow = a; b.textContent = a; b.addEventListener("click", () => arrowInput(a)); grid.appendChild(b); });
}

function arrowInput(a) {
  const m = state.mini; if (!m || m.engine !== "stir") return;
  const pressed = dom.miniContent.querySelector(`.arrow-button[data-arrow="${a}"]`);
  if (pressed) { pressed.classList.remove("pressed"); void pressed.offsetWidth; pressed.classList.add("pressed"); setTimeout(() => pressed.classList.remove("pressed"), 150); }
  const expected = m.data.arrows[m.data.index];
  if (a === expected) {
    const completed = dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);
    completed.classList.remove("current"); completed.classList.add("correct");
    m.data.index++;
    const next = dom.miniContent.querySelector(`[data-i="${m.data.index}"]`); if (next) next.classList.add("current");
    const progress = dom.miniContent.querySelector("#arrowProgress"); if (progress) progress.textContent = `진행 ${m.data.index} / ${m.data.arrows.length}`;
    audio.click(); if (m.data.index === m.data.arrows.length) finishMini(Math.max(70, 100 - m.data.errors * 12));
  }
  else { m.data.errors++; audio.bad(); dom.miniFeedback.textContent = "볶는 방향이 엇갈렸어요."; }
}
