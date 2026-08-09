"use strict";

/* ============================================================
   표에 없는 밤 미니게임 모음

   [현재 호출되는 곳이 없는 것 — ♻️]
     collect  재료 꺼내기 (순서 기억)
     wash     재료 씻기 (물방울 터뜨리기)
     flip     김치전 뒤집기 (2단계 타이밍) → 지금은 twoSideCook 이 대신합니다
     grill    직화구이 + 소스 바르기      → 지금은 twoSideCook 이 대신합니다

     game-data.js 의 어떤 메뉴도 이 넷을 조리 단계로 쓰지 않고,
     스토리(story.js)도 chop 하나만 씁니다.
     1단계는 "옮기기만" 이므로 지우지 않고 그대로 등록해 두었습니다.
     쓸 일이 없다고 판단되면 이 파일에서 해당 블록과 index.html 의
     <script> 줄만 지우면 됩니다. 다른 파일은 건드릴 필요가 없습니다.

   [지운 것] 설거지(dishwasher) · 쓰레기 분리(trash) 미니게임
     청결도와 쓰레기 분리 미니게임은 사용하지 않습니다.
     식기세척기는 배경 집기로 남고, 쓰레기통은 완성 음식을 들고 가까이서
     E를 누르면 해당 주문을 처음부터 다시 조리하는 용도로만 사용합니다.
   ============================================================ */

/* ---- ♻️ 재료 꺼내기 (순서 기억) ---------------------------- */
registerMiniEngine("collect", {
  setup(m, { set, dish }) {
    set("재료 꺼내기", "잠깐 보여주는 재료 순서를 기억한 뒤 같은 순서로 선택하세요.", 10);
    const target = shuffle(INGREDIENTS[dish.id]).slice(0, 3);
    m.data = { target, input: [], errors: 0, showing: true };
    dom.miniContent.innerHTML = `<div class="sequence-view">${target.map(x => `<span class="sequence-chip">${x}</span>`).join("")}</div><div class="choice-grid" id="ingredientChoices"></div>`;
    miniSetTimeout(() => { if (state.mini === m) { m.data.showing = false; dom.miniContent.querySelector(".sequence-view").innerHTML = "<span class='sequence-chip'>순서를 입력하세요</span>"; renderIngredientChoices(); } }, 1400);
  }
});

function renderIngredientChoices() {
  const m = state.mini; if (!m || m.engine !== "collect" || m.data.showing) return;
  const pool = buildIngredientChoicePool(m.data.target);
  const wrap = dom.miniContent.querySelector("#ingredientChoices"); wrap.innerHTML = "";
  pool.forEach(name => {
    const b = document.createElement("button"); b.type = "button"; b.className = "choice-button"; b.textContent = name; b.addEventListener("click", () => {
      const expected = m.data.target[m.data.input.length];
      if (name === expected) { m.data.input.push(name); b.classList.add("correct"); b.disabled = true; audio.click(); dom.miniFeedback.textContent = `${m.data.input.length} / ${m.data.target.length}`; if (m.data.input.length === m.data.target.length) finishMini(Math.max(70, 100 - m.data.errors * 15)); }
      else { m.data.errors++; b.classList.add("wrong"); miniSetTimeout(() => b.classList.remove("wrong"), 250); audio.bad(); dom.miniFeedback.textContent = "순서가 달라요!"; }
    }); wrap.appendChild(b);
  });
}

function buildIngredientChoicePool(target, choiceCount = 6) {
  const required = [...new Set(target)];
  const allIngredients = [...new Set([
    ...Object.values(INGREDIENTS).flat(),
    "달걀", "양파", "버섯", "소금"
  ])];
  const distractors = shuffle(allIngredients.filter(name => !required.includes(name)))
    .slice(0, Math.max(0, choiceCount - required.length));
  return shuffle([...required, ...distractors]);
}

/* ---- ♻️ 재료 씻기 ----------------------------------------- */
registerMiniEngine("wash", {
  setup(m, { set }) {
    set("재료 씻기", "떠오르는 물방울을 모두 눌러 재료를 깨끗하게 씻으세요.", 8);
    m.data = { remaining: 12};
    renderBubbleGrid();
  },
  timeout(m) {
    finishMini(Math.round((12 - m.data.remaining) / 12 * 100));
  }
});

function renderBubbleGrid() {
  const m = state.mini; if (!m) return;
  dom.miniContent.innerHTML = `<div class="bubble-grid" id="bubbleGrid"></div><div class="cut-count">남은 물방울 <span>${m.data.remaining}</span></div>`;
  const grid = dom.miniContent.querySelector("#bubbleGrid");
  for (let i = 0; i < 12; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "bubble-button"; b.textContent = "●"; b.addEventListener("click", () => { if (b.classList.contains("popped")) return; b.classList.add("popped"); m.data.remaining--; audio.click(); dom.miniContent.querySelector(".cut-count span").textContent = m.data.remaining; if (m.data.remaining <= 0) finishMini(100); }); grid.appendChild(b); }
}

/* ---- ♻️ 김치전 뒤집기 (구형 2단계 타이밍) ------------------- */
registerMiniEngine("flip", {
  setup(m, { set }) {
    set("김치전 뒤집기", "두 번의 타이밍을 정확히 맞추세요. 첫 번째는 반죽 펼치기, 두 번째는 뒤집기입니다.", 9);
    m.data = { marker: 0, dir: 1, speed: .78, round: 0, hits: [] };
    dom.miniContent.innerHTML = `<div class="progress-track"><i class="progress-zone" style="left:35%;width:30%"></i><i class="progress-perfect" style="left:47%;width:6%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count" id="flipLabel">1단계 · 반죽 펼치기</div><button class="mini-action" id="miniAction" type="button">지금!</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click", miniAction);
  },
  update(m, dt) {
    advanceBounceMarker(m, dt);
  },
  action(m) {
    m.data.hits.push(markerScore(m, .5)); m.data.round++; audio.click();
    if (m.data.round >= 2) finishMini(Math.round(m.data.hits.reduce((a, b) => a + b, 0) / 2));
    else { m.data.marker = 0; m.data.dir = 1; m.data.speed += .15; dom.miniContent.querySelector("#flipLabel").textContent = "2단계 · 전 뒤집기"; }
  }
});

/* ---- ♻️ 직화구이 + 소스 바르기 ----------------------------- */
registerMiniEngine("grill", {
  setup(m, { set }) {
    set("직화구이와 소스 바르기", "먼저 굽기 타이밍을 맞춘 뒤 1→2→3 순서로 소스를 발라주세요.", 11);
    m.data = { phase: "timing", marker: 0, dir: 1, speed: .72, timingScore: 0, sauceIndex: 0 };
    renderGrillGame();
  },
  update(m, dt) {
    if (m.data.phase === "timing") advanceBounceMarker(m, dt);
  },
  action(m) {
    if (m.data.phase !== "timing") return;
    m.data.timingScore = markerScore(m, .5);
    m.data.phase = "sauce"; audio.click(); renderGrillGame();
  }
});

function renderGrillGame() {
  const m = state.mini; if (!m) return;
  if (m.data.phase === "timing") {
    dom.miniContent.innerHTML = `<div class="progress-track"><i class="progress-zone" style="left:38%;width:26%"></i><i class="progress-perfect" style="left:47%;width:7%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">직화로 속까지 익히기</div><button class="mini-action" id="miniAction" type="button">뒤집기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click", miniAction);
  } else {
    dom.miniDescription.textContent = "구운 재료 위에 1→2→3 순서로 소스를 고르게 발라주세요.";
    dom.miniContent.innerHTML = `<div class="grill-targets">${[1, 2, 3].map(n => `<button class="sauce-target" data-n="${n}" type="button">${n}</button>`).join("")}</div>`;
    dom.miniContent.querySelectorAll(".sauce-target").forEach(b => b.addEventListener("click", () => {
      const n = Number(b.dataset.n); if (n !== m.data.sauceIndex + 1) { audio.bad(); dom.miniFeedback.textContent = "붓질 순서를 지켜주세요."; return; } b.classList.add("done"); m.data.sauceIndex++; audio.click(); if (m.data.sauceIndex === 3) finishMini(Math.round((m.data.timingScore + 100) / 2));
    }));
  }
}
