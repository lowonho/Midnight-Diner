"use strict";

/* ============================================================
   E5 양면 굽기 — 밤 조리 "twoSideCook"

   앞면 익히기 → 뒤집기 → 뒷면 익히기. 뒤집는 방법이 요리마다 다릅니다.

   [단계(phase) 흐름]
     cook  ─ 게이지가 초록 구간(58% 이상)에 오면 Space. 두 번(앞·뒤) 겪습니다.
       └ 김치전  → flip ─ ↑를 꾹 눌러 반동을 40% 이상 모으고 ↓로 뒤집기
       │           → flipping (연출 0.62초) → 다시 cook(뒷면)
       └ 닭꼬치  → skewerFlip ─ 꼬치마다 ← 다음 → 를 0.7초 안에. 4개 반복
                   → skewerFinishing (연출 0.3초) → 다시 cook(뒷면)

   ⚠️ 한 엔진 안에 두 종류의 뒤집기가 들어 있습니다.
   2단계에서 김치전/닭꼬치를 나눌지, 파라미터로 합칠지 결정하세요.
   지금은 원래 코드 그대로입니다.

   쓰는 곳: 김치전 굽기 · 닭꼬치 굽기 (game-data.js 의 game:"twoSideCook")
   ============================================================ */

registerMiniEngine("twoSideCook", {
  setup(m, { set, dish }) {
    const isSkewer = dish.id === "skewer";
    set(
      isSkewer ? "닭꼬치 숯불 직화구이" : "김치전 양면 굽기",
      isSkewer ? "앞면이 익으면 꼬치마다 ← →를 빠르게 눌러 하나씩 뒤집으세요." : "양면을 충분히 익히고, 1면 뒤에는 팬 뒤집기 타이밍도 맞추세요.",
      26
    );
    m.data = { phase: "cook", side: 0, marker: 0, dir: 1, speed: .22, hits: [], dishStyle: isSkewer ? "skewer" : "pancake", flipErrors: 0 };
    renderTwoSideCook();
  },

  update(m, dt) {
    const data = m.data;
    if (data.phase === "cook") {
      // 이 게이지는 왕복하지 않고 한 방향으로만 찹니다.
      data.marker = Math.min(1, data.marker + data.speed * dt);
      const marker = dom.miniContent.querySelector("#miniMarker");
      if (marker) marker.style.left = `${data.marker * 100}%`;
      return;
    }
    if (data.phase === "flip") { updatePancakeFlipCharge(dt); return; }
    // ← 를 누른 뒤 0.7초 안에 → 가 오지 않으면 현재 꼬치를 처음부터
    if (data.phase === "skewerFlip" && data.flipStep === 1) {
      data.flipWindow -= dt;
      if (data.flipWindow <= 0) {
        data.flipStep = 0; data.flipWindow = 0; data.flipErrors = (data.flipErrors || 0) + 1;
        dom.miniFeedback.textContent = "조금 늦었어요. 현재 꼬치를 ←부터 다시!";
        updateSkewerFlipPrompt(data); audio.bad();
      }
    }
  },

  action() {
    twoSideCookAction();
  },

  key(m, k, e) {
    if (m.data.phase === "skewerFlip") {
      if (e.repeat) return true;              // 꾹 누르기로 연타되는 것을 막습니다
      if (k === "arrowleft") { skewerFlipInput("left"); return true; }
      if (k === "arrowright") { skewerFlipInput("right"); return true; }
    }
    if (m.data.phase === "flip") {
      if (k === "arrowup") { setPancakeFlipCharge(true); return true; }
      if (k === "arrowdown") { releasePancakeFlip(); return true; }
    }
    return false;
  },

  keyup(m, k) {
    if (k === "arrowup" && m.data.phase === "flip") setPancakeFlipCharge(false);
  }
});

function charcoalSkewerMarkup(data) {
  const coals = Array.from({ length: 9 }, () => "<i></i>").join("");
  const flipped = data?.flippedSkewers || 0;
  const skewers = Array.from({ length: SKEWER_BATCH_SIZE }, (_, index) => `<span class="grill-skewer skewer-${index + 1} ${index < flipped ? "flipped" : ""} ${data?.phase === "skewerFlip" && index === flipped ? "current" : ""}"><i class="skewer-rod"></i><b></b><em></em><b></b><em></em><b></b></span>`).join("");
  return `<span class="charcoal-bed" aria-hidden="true">${coals}</span><span class="grill-grate" aria-hidden="true"></span><span class="cook-food" aria-label="숯불에 굽는 닭꼬치 ${SKEWER_BATCH_SIZE}개">${skewers}</span><i class="charcoal-flame flame-one"></i><i class="charcoal-flame flame-two"></i>`;
}

function renderTwoSideCook() {
  const m = state.mini; if (!m || m.engine !== "twoSideCook") return;
  const data = m.data, isSkewer = data.dishStyle === "skewer";
  if (data.phase === "cook") {
    const sideLabel = data.side === 0 ? "앞면" : "뒷면";
    dom.miniDescription.textContent = `${sideLabel}이 충분히 익어 포인터가 오른쪽 초록 구간에 들어오면 Space를 누르세요.`;
    dom.miniContent.innerHTML = `
      <div class="two-side-pan ${isSkewer ? "skewer-cook" : "pancake-cook"} side-${data.side}">${isSkewer ? charcoalSkewerMarkup(data) : '<i class="cook-food"></i><i class="cook-steam steam-one"></i><i class="cook-steam steam-two"></i>'}</div>
      <div class="doneness-gauge"><i class="doneness-green"></i><i id="miniMarker" class="progress-marker"></i></div>
      <div class="cut-count">${sideLabel} 익히기 · 초록 구간 약 75%</div>
      <button class="mini-action" id="miniAction" type="button">Space · ${sideLabel} 완료</button>`;
  } else if (data.phase === "skewerFlip" || data.phase === "skewerTurning") {
    const current = Math.min(data.flippedSkewers || 0, SKEWER_BATCH_SIZE - 1);
    dom.miniDescription.textContent = "현재 꼬치에 ← 다음 →를 빠르게 누르세요. 한 쌍을 입력할 때마다 꼬치 하나가 뒤집힙니다.";
    dom.miniContent.innerHTML = `
      <div class="two-side-pan skewer-cook skewer-flip-ready side-0">${charcoalSkewerMarkup(data)}</div>
      <div class="skewer-flip-sequence" aria-label="꼬치 뒤집기 진행도">${Array.from({ length: SKEWER_BATCH_SIZE }, (_, index) => `<span class="skewer-flip-pair ${index < (data.flippedSkewers || 0) ? "done" : index === current ? "current" : ""}"><b>←</b><b>→</b></span>`).join("")}</div>
      <div class="cut-count" id="skewerFlipLabel">꼬치 ${(data.flippedSkewers || 0) + 1} / ${SKEWER_BATCH_SIZE} · <strong>${data.flipStep === 1 ? "→" : "←"}</strong> 입력</div>
      <div class="skewer-flip-controls"><button id="skewerFlipLeft" type="button">← 왼쪽</button><button id="skewerFlipRight" type="button">→ 오른쪽</button></div>`;
  } else if (data.phase === "flip") {
    dom.miniDescription.textContent = "↑를 꾹 눌러 팬을 당긴 뒤, 반동 게이지가 충분히 차면 ↓를 눌러 뒤집으세요.";
    dom.miniContent.innerHTML = `
      <div class="flip-rebound-scene">
        <div class="two-side-pan pancake-cook flip-ready" id="reboundPan"><i class="cook-food"></i></div>
        <div class="rebound-arrow" id="reboundArrow">↑</div>
      </div>
      <div class="rebound-gauge"><i id="reboundGaugeBar"></i><span class="rebound-sweet-zone"></span></div>
      <div class="cut-count" id="reboundLabel">반동 충전 0% · ↑를 꾹 누르세요</div>
      <div class="rebound-controls"><button id="reboundUp" type="button">↑ 꾹 누르기</button><button id="reboundDown" type="button">↓ 반동 뒤집기</button></div>`;
  } else {
    dom.miniContent.innerHTML = `<div class="two-side-pan ${isSkewer ? "skewer-cook" : "pancake-cook"} flipping">${isSkewer ? charcoalSkewerMarkup(data) : '<i class="cook-food"></i>'}</div><div class="cut-count">${isSkewer ? `꼬치 ${SKEWER_BATCH_SIZE}개` : "김치전"} 뒤집는 중…</div>`;
  }
  dom.miniContent.querySelector("#miniAction")?.addEventListener("click", miniAction);
  dom.miniContent.querySelector("#skewerFlipLeft")?.addEventListener("click", () => skewerFlipInput("left"));
  dom.miniContent.querySelector("#skewerFlipRight")?.addEventListener("click", () => skewerFlipInput("right"));
  const reboundUp = dom.miniContent.querySelector("#reboundUp"), reboundDown = dom.miniContent.querySelector("#reboundDown");
  if (reboundUp) {
    reboundUp.addEventListener("pointerdown", event => { event.preventDefault(); reboundUp.setPointerCapture(event.pointerId); setPancakeFlipCharge(true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(type => reboundUp.addEventListener(type, () => setPancakeFlipCharge(false)));
  }
  reboundDown?.addEventListener("click", releasePancakeFlip);
}

function twoSideCookAction() {
  const m = state.mini; if (!m || m.engine !== "twoSideCook" || m.complete) return;
  const data = m.data;
  if (data.phase === "cook") {
    if (data.marker < .58) { dom.miniFeedback.textContent = "아직 충분히 익지 않았습니다. 오른쪽 초록 구간까지 기다리세요."; audio.bad(); return; }
    data.hits.push(Math.round(clamp(100 - Math.abs(data.marker - .76) * 300, 25, 100))); audio.click();
    if (data.side === 1) { finishMini(Math.round(data.hits.reduce((sum, score) => sum + score, 0) / data.hits.length)); return; }
    if (data.dishStyle === "pancake") {
      data.phase = "flip"; data.flipCharge = 0; data.charging = false; renderTwoSideCook();
    } else {
      beginSkewerFlip(m);
    }
    return;
  }
  if (data.phase === "flip") {
    dom.miniFeedback.textContent = "↑를 누르고 반동을 모은 뒤 ↓로 뒤집으세요.";
  }
}

function beginSkewerFlip(m) {
  Object.assign(m.data, { phase: "skewerFlip", flippedSkewers: 0, flipStep: 0, flipWindow: 0 });
  dom.miniFeedback.textContent = "첫 번째 꼬치부터 ← →!";
  renderTwoSideCook();
}

function updateSkewerFlipPrompt(data) {
  const label = dom.miniContent.querySelector("#skewerFlipLabel");
  if (label) label.innerHTML = `꼬치 ${(data.flippedSkewers || 0) + 1} / ${SKEWER_BATCH_SIZE} · <strong>${data.flipStep === 1 ? "→" : "←"}</strong> 입력`;
  const pair = dom.miniContent.querySelector(".skewer-flip-pair.current");
  pair?.classList.toggle("left-done", data.flipStep === 1);
}

function skewerFlipInput(direction) {
  const m = state.mini; if (!m || m.engine !== "twoSideCook" || m.data.phase !== "skewerFlip" || m.complete) return false;
  const data = m.data, expected = data.flipStep === 0 ? "left" : "right";
  if (direction !== expected) {
    data.flipErrors = (data.flipErrors || 0) + 1;
    data.flipStep = direction === "left" ? 1 : 0;
    data.flipWindow = direction === "left" ? .7 : 0;
    dom.miniFeedback.textContent = direction === "left" ? "다시 시작 · 이제 →!" : "순서가 엇갈렸어요. ←부터 다시!";
    updateSkewerFlipPrompt(data); audio.bad(); return false;
  }
  if (direction === "left") {
    data.flipStep = 1; data.flipWindow = .7;
    dom.miniFeedback.textContent = "좋아요, 빠르게 →!";
    updateSkewerFlipPrompt(data); audio.click(); return true;
  }
  data.flipStep = 0; data.flipWindow = 0;
  const completedIndex = data.flippedSkewers;
  const skewer = dom.miniContent.querySelector(`.grill-skewer.skewer-${completedIndex + 1}`);
  const pairs = dom.miniContent.querySelectorAll(".skewer-flip-pair");
  skewer?.classList.remove("current"); skewer?.classList.add("turning");
  pairs[completedIndex]?.classList.remove("current", "left-done"); pairs[completedIndex]?.classList.add("done");
  data.flippedSkewers++;
  setTimeout(() => { skewer?.classList.remove("turning"); skewer?.classList.add("flipped"); }, 300);
  audio.success();
  if (data.flippedSkewers >= SKEWER_BATCH_SIZE) {
    data.phase = "skewerFinishing";
    dom.miniFeedback.textContent = `꼬치 ${SKEWER_BATCH_SIZE}개 뒤집기 완료!`;
    setTimeout(() => {
      if (state.mini !== m || m.complete) return;
      data.phase = "cook"; data.side = 1; data.marker = 0; data.dir = 1; data.speed = .24;
      dom.miniFeedback.textContent = "뒤집기 완료 · 뒷면을 익히세요."; renderTwoSideCook();
    }, 300);
  } else {
    dom.miniContent.querySelector(`.grill-skewer.skewer-${data.flippedSkewers + 1}`)?.classList.add("current");
    pairs[data.flippedSkewers]?.classList.add("current");
    dom.miniFeedback.textContent = `${data.flippedSkewers + 1}번째 꼬치도 바로 ← →!`;
    updateSkewerFlipPrompt(data);
  }
  return true;
}

function setPancakeFlipCharge(charging) {
  const m = state.mini; if (!m || m.engine !== "twoSideCook" || m.data.phase !== "flip" || m.complete) return false;
  m.data.charging = !!charging;
  dom.miniContent.querySelector("#reboundUp")?.classList.toggle("holding", m.data.charging);
  dom.miniContent.querySelector("#reboundArrow")?.classList.toggle("holding", m.data.charging);
  return true;
}

function updatePancakeFlipCharge(dt) {
  const data = state.mini.data;
  if (data.charging) data.flipCharge = clamp((data.flipCharge || 0) + 48 * dt, 0, 100);
  else data.flipCharge = clamp((data.flipCharge || 0) - 4 * dt, 0, 100);
  const charge = Math.round(data.flipCharge), pan = dom.miniContent.querySelector("#reboundPan");
  const bar = dom.miniContent.querySelector("#reboundGaugeBar"), label = dom.miniContent.querySelector("#reboundLabel");
  if (bar) bar.style.width = `${charge}%`;
  if (label) label.textContent = `반동 충전 ${charge}% · ${charge < 40 ? "더 당기세요" : charge <= 88 ? "↓로 뒤집기!" : "반동이 너무 강해요"}`;
  // 들어올리는 거리는 --upx(화면 크기 비례 단위, css/base.css) 배수로 줍니다.
  // px 로 주면 창을 줄였을 때 팬만 크게 튑니다.
  if (pan) pan.style.transform = `translateY(calc(${-Math.min(26, charge * .26)} * var(--upx))) rotate(${Math.min(3, charge * .03)}deg)`;
}

function releasePancakeFlip() {
  const m = state.mini; if (!m || m.engine !== "twoSideCook" || m.data.phase !== "flip" || m.complete) return false;
  const data = m.data, charge = data.flipCharge || 0; data.charging = false;
  if (charge < 40) {
    const pan = dom.miniContent.querySelector("#reboundPan");
    pan?.classList.remove("rebound-fail"); if (pan) { void pan.offsetWidth; pan.classList.add("rebound-fail"); }
    data.flipCharge = Math.max(0, charge - 18); dom.miniFeedback.textContent = "반동이 부족합니다. ↑를 조금 더 오래 눌러주세요."; audio.bad();
    return false;
  }
  data.hits.push(Math.round(clamp(100 - Math.abs(charge - 72) * 2.4, 35, 100)));
  dom.miniFeedback.textContent = charge > 90 ? "강한 반동으로 뒤집었습니다!" : "반동을 이용해 깔끔하게 뒤집었습니다!";
  startTwoSideFlipAnimation(m); audio.success();
  return true;
}

function startTwoSideFlipAnimation(m) {
  m.data.phase = "flipping"; renderTwoSideCook(); audio.click();
  setTimeout(() => {
    if (state.mini !== m || m.complete) return;
    m.data.phase = "cook"; m.data.side = 1; m.data.marker = 0; m.data.dir = 1; m.data.speed = .24;
    dom.miniFeedback.textContent = "뒤집기 완료 · 뒷면을 익히세요."; renderTwoSideCook();
  }, 620);
}
