"use strict";

/* ============================================================
   E5 양면 굽기 — 밤 조리 "twoSideCook"

   앞면 익히기 → 뒤집기 → 뒷면 익히기. 뒤집는 방법이 요리마다 다릅니다.

   [단계(phase) 흐름]
     cook  ─ 좁은 금색 PERFECT 또는 주변 초록 GOOD 구간에서 Space. 두 번(앞·뒤) 겪습니다.
       └ 김치전  → flip ─ ↑를 꾹 눌러 반동을 40% 이상 모으고 ↓로 뒤집기
       │           → flipping (연출 0.62초) → 다시 cook(뒷면)
       └ 닭꼬치  → skewerFlip ─ 꼬치마다 ← 다음 → 를 0.7초 안에. 3개 반복
                   → skewerFinishing (연출 0.3초) → 다시 cook(뒷면)

   두 요리의 뒤집기 방식과 익는 속도만 설정으로 나누고 양면 익힘 판정,
   조리 진행 시각화, 완료 점수는 공통 컨트롤러가 담당합니다.

   [화면] 두 요리가 같은 3열 화면을 씁니다. 아래 "공통 화면 틀" 구역 참고.
   판정·조작 규칙은 예전 그대로이고, 놓이는 자리만 바뀌었습니다.

   쓰는 곳: 김치전 굽기 · 닭꼬치 굽기 (game-data.js 의 game:"twoSideCook")
   ============================================================ */

const TWO_SIDE_COOK_CONFIG=Object.freeze({
  pancake:Object.freeze({
    sideSpeeds:Object.freeze([.21,.24]),goodStart:.67,goodEnd:.85,perfectStart:.725,perfectEnd:.795,perfectCenter:.76,
    foodAsset:"cookPancakeFood"
  }),
  skewer:Object.freeze({
    sideSpeeds:Object.freeze([.23,.26]),goodStart:.67,goodEnd:.85,perfectStart:.725,perfectEnd:.795,perfectCenter:.76,
    foodAsset:"cookSkewerFood"
  })
});

function twoSideCookVisualStage(marker){
  if(marker<.24)return "raw";
  if(marker<.5)return "setting";
  if(marker<.7)return "golden";
  if(marker<.89)return "ready";
  return "over";
}

function twoSideCookTimingGrade(marker,config){
  if(marker>=config.perfectStart&&marker<=config.perfectEnd)return "perfect";
  if(marker>=config.goodStart&&marker<=config.goodEnd)return "good";
  return "miss";
}

function twoSideCookTimingScore(marker,config){
  const grade=twoSideCookTimingGrade(marker,config),distance=Math.abs(marker-config.perfectCenter);
  if(grade==="perfect")return Math.round(clamp(100-distance/(config.perfectEnd-config.perfectCenter)*4,96,100));
  if(grade==="good"){
    const goodHalf=Math.max(config.perfectCenter-config.goodStart,config.goodEnd-config.perfectCenter);
    const perfectHalf=Math.max(config.perfectCenter-config.perfectStart,config.perfectEnd-config.perfectCenter);
    return Math.round(clamp(92-(distance-perfectHalf)/Math.max(.001,goodHalf-perfectHalf)*14,78,92));
  }
  return 25;
}

function twoSideCookGrade(data){
  return data.hits.every(score=>score>=94)&&!(data.flipErrors||0)&&!(data.cookErrors||0)?"perfect":"good";
}

function updateTwoSideCookVisual(data){
  const stage=twoSideCookVisualStage(data.marker);
  const pan=dom.miniContent.querySelector(".two-side-pan");
  if(pan){
    pan.style.setProperty("--cook-progress",data.marker.toFixed(3));
    pan.classList.remove("cook-raw","cook-setting","cook-golden","cook-ready","cook-over");
    pan.classList.add(`cook-${stage}`);
  }
}

registerMiniEngine("twoSideCook", {
  setup(m, { set, dish }) {
    const isSkewer = dish.id === "skewer";
    const dishStyle=isSkewer?"skewer":"pancake",config=TWO_SIDE_COOK_CONFIG[dishStyle];
    set(
      isSkewer ? "닭꼬치 굽기" : "김치전 굽기",
      isSkewer ? "앞면이 익으면 꼬치마다 ← →를 빠르게 눌러 하나씩 뒤집으세요." : "양면을 충분히 익히고, 1면 뒤에는 팬 뒤집기 타이밍도 맞추세요.",
      26
    );
    m.data = { phase: "cook", side: 0, marker: 0, dir: 1, speed: config.sideSpeeds[0], hits: [], dishStyle, flipErrors: 0, cookErrors:0, timeLimit: m.time };
    audio.loop?.(isSkewer?"charcoal_grill":"pan_sizzle",m,isSkewer ? .58 : .6);
    // 타이틀 아래 부제. 공용 패널 마크업은 그대로 두고 내용만 채웁니다.
    dom.miniStation.textContent = TWO_SIDE_VIEW[m.data.dishStyle].subtitle;
    renderTwoSideCook();
  },

  update(m, dt) {
    const data = m.data;
    // 공용 타이머 카드(#miniTimer)는 오른쪽 진행도 카드와 겹쳐서 숨겨 두었습니다.
    // 대신 진행도 카드 아래 가는 띠로 남은 시간을 보여 줍니다. (시간 규칙은 그대로)
    const timeBar = dom.miniContent.querySelector("#tsTimeBar");
    if (timeBar && data.timeLimit) timeBar.style.width = `${clamp(m.time / data.timeLimit, 0, 1) * 100}%`;
    if (data.phase === "cook") {
      // 이 게이지는 왕복하지 않고 한 방향으로만 찹니다.
      data.marker = Math.min(1, data.marker + data.speed * dt);
      const marker = dom.miniContent.querySelector("#miniMarker");
      if (marker) marker.style.left = `${data.marker * 100}%`;
      updateTwoSideCookVisual(data);
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
      if (e?.repeat) return true;              // 꾹 누르기로 연타되는 것을 막습니다
      if (k === "arrowleft") { skewerFlipInput("left"); return true; }
      if (k === "arrowright") { skewerFlipInput("right"); return true; }
    }
    if (m.data.phase === "flip") {
      if (e?.repeat) return true;
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
  const skewers = Array.from({ length: SKEWER_BATCH_SIZE }, (_, index) => {
    const asset=dayPrepAssetMarkup(TWO_SIDE_COOK_CONFIG.skewer.foodAsset,"grill-skewer-asset","굽는 닭꼬치");
    const food=asset||`<i class="skewer-rod"></i><b></b><em></em><b></b><em></em><b></b>`;
    return `<span class="grill-skewer skewer-${index + 1} ${asset?"has-asset":""} ${index < flipped && data?.phase !== "cook" ? "flipped" : ""} ${data?.phase === "skewerFlip" && index === flipped ? "current" : ""}">${food}</span>`;
  }).join("");
  return `<span class="charcoal-bed" aria-hidden="true">${coals}</span><span class="grill-grate" aria-hidden="true"></span><span class="cook-food" aria-label="숯불에 굽는 닭꼬치 ${SKEWER_BATCH_SIZE}개">${skewers}</span><i class="charcoal-flame flame-one"></i><i class="charcoal-flame flame-two"></i>`;
}

/* ============================================================
   공통 화면 틀 (컨셉 이미지 3열 구성)

     [재료 카드]  [불 위의 조리 도구]  [진행도 카드 · 조작 카드]
                  └ 아래에 게이지 한 줄

   김치전과 닭꼬치가 이 틀을 함께 씁니다. 채썰기·튀김 준비(engine-e2 의
   .fp-scene)와 같은 구성이고, 다른 것은 아래 TWO_SIDE_VIEW 표뿐입니다.
     · 왼쪽 재료 카드 목록
     · 오른쪽 조작 카드에 놓을 키(세로 두 줄 / 가로 한 줄)
     · 진행도의 분모(김치전 1장 · 꼬치 3개)

   [단계마다 바뀌는 것]  가운데 그림 · 게이지 한 줄 · 조작 카드 세 곳뿐이고,
   바깥 3열은 그대로입니다. 예전 화면에 있던 조작 버튼 줄(.rebound-controls /
   .skewer-flip-controls)은 오른쪽 조작 카드의 키 버튼이 대신합니다.
   그래서 id(#reboundUp · #reboundDown · #skewerFlipLeft · #skewerFlipRight)를
   키 버튼이 그대로 물려받았고, 아래 판정 코드는 손대지 않았습니다.

   [공용 프레임과의 관계]  채썰기·김치 볶기와 같습니다.
   ui-mini-frame.js 와 css/minigame-frame.css 는 건드리지 않고,
   이 화면이 떠 있을 때만 적용되는 규칙으로 덮어씁니다.
   (css/minigames.css 의 "김치전·닭꼬치 공통 화면" 구역 참고)

   그림은 전부 임시 CSS 도형입니다. day-prep-minigames.js 의
   DAY_PREP_ASSET_PATHS 경로에 파일을 넣으면 .has-asset 이 붙어
   도형이 꺼지고 <img> 가 대신 보입니다.
   ============================================================ */

const TWO_SIDE_VIEW = Object.freeze({
  pancake: Object.freeze({
    subtitle: "녹색 타이밍에 맞춰 김치전을 뒤집어주세요!",
    ingredients: [{ id: "pancakeBatter", label: "김치전 반죽", count: 1, asset: "cookPancakeBatter" }],
    total: 1,                                   // 김치전 1장
    keyLayout: "column",                        // 키 두 개를 세로로 (앞 버튼 ↓ 뒤 버튼)
    keyLink: "↓",
    keys: [
      { id: "reboundUp", glyph: "↑", name: "앞 버튼", desc: "(꾹 누르기)" },
      { id: "reboundDown", glyph: "↓", name: "뒤 버튼", desc: "(반동으로<br />누르기)" }
    ]
  }),
  skewer: Object.freeze({
    subtitle: "녹색 타이밍에 맞춰 닭꼬치를 뒤집어주세요!",
    ingredients: [{ id: "skewerRaw", label: "닭꼬치", count: SKEWER_BATCH_SIZE, asset: "cookSkewerRaw" }],
    total: SKEWER_BATCH_SIZE,                   // 실제 준비 배치와 같은 꼬치 3개
    keyLayout: "row",                           // 키 두 개를 가로로 (← → )
    keyLink: "→",
    controlName: "좌우<br />하나씩 뒤집기",
    keys: [
      { id: "skewerFlipLeft", glyph: "←" },
      { id: "skewerFlipRight", glyph: "→" }
    ]
  })
});

// 왼쪽 재료 카드 한 장
function twoSideIngredientMarkup(item) {
  const asset = dayPrepAssetMarkup(item.asset, "ts-ing-asset", item.label);
  return `<div class="ts-ing-card ${item.id}">
      <div class="ts-ing-art ${asset ? "has-asset" : ""}"><i></i>${asset}</div>
      <p class="ts-ing-name">${item.label} <b>×${item.count}</b></p>
    </div>`;
}

// 오른쪽 조작 카드의 키. expected 에 든 id 가 지금 눌러야 할 키입니다.
// 키를 쓰지 않는 단계(익히는 중 · 뒤집는 연출)에서는 안내로만 보여 줍니다.
function twoSideKeysMarkup(view, expected = "") {
  const keys = view.keys.map(key => `<span class="ts-key-row">
      <button type="button" class="ts-key ${key.id === expected ? "expected" : ""}" id="${key.id}" ${expected ? "" : "disabled"}>${key.glyph}</button>
      ${key.name ? `<span class="ts-key-text"><b>${key.name}</b>${key.desc ? `<em>${key.desc}</em>` : ""}</span>` : ""}
    </span>`).join(`<span class="ts-key-link" aria-hidden="true">${view.keyLink}</span>`);
  return `<div class="ts-keys layout-${view.keyLayout}">${keys}</div>
    ${view.controlName ? `<p class="ts-control-name">${view.controlName}</p>` : ""}`;
}

function pancakeCookFoodMarkup(){
  const asset=dayPrepAssetMarkup(TWO_SIDE_COOK_CONFIG.pancake.foodAsset,"pancake-food-asset","굽는 김치전");
  return `<i class="cook-food ${asset?"has-asset":""}">${asset}<span class="cook-bubbles" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></span></i>`;
}

// 가운데 조리 도구. 김치전은 불 위의 팬, 닭꼬치는 숯불 화로입니다.
function twoSideStageMarkup(data, extraClass = "") {
  if (data.dishStyle === "skewer") return `<div class="two-side-pan skewer-cook ${extraClass} side-${data.side}">${charcoalSkewerMarkup(data)}</div>`;
  return `<div class="ts-cooktop">
      <i class="ts-grate" aria-hidden="true"></i><i class="ts-burner" aria-hidden="true"></i>
      <div class="two-side-pan pancake-cook ${extraClass} side-${data.side}">${pancakeCookFoodMarkup()}<i class="cook-steam steam-one"></i><i class="cook-steam steam-two"></i></div>
    </div>`;
}

function twoSideScreenMarkup(view, { board, gauge, control, strip = "", done, total, timePercent }) {
  return `<div class="ts-scene">
      <aside class="ts-col">
        <div class="ts-panel ts-ing-panel">
          <h3 class="ts-col-title starred">재료</h3>
          <div class="ts-ing-list">${view.ingredients.map(twoSideIngredientMarkup).join("")}</div>
        </div>
      </aside>
      <div class="ts-main">
        <div class="ts-board">
          <i class="ts-flip-arrow" aria-hidden="true"></i>
          ${board}
          <strong class="e5-result" id="e5Result" aria-live="polite"></strong>
        </div>
        <div class="ts-gauge-slot">${gauge}</div>
      </div>
      <aside class="ts-col">
        <div class="ts-panel ts-count">
          <h3 class="ts-col-title">진행도</h3>
          <strong><b>${done}</b> / ${total}</strong>
          <div class="ts-time" title="남은 시간"><i id="tsTimeBar" style="width:${timePercent}%"></i></div>
        </div>
        <div class="ts-panel ts-control">
          <h3 class="ts-col-title">조작</h3>
          ${control}
        </div>
      </aside>
      <div class="mg-strip">${strip}</div>
    </div>`;
}

function renderTwoSideCook() {
  const m = state.mini; if (!m || m.engine !== "twoSideCook") return;
  const data = m.data, isSkewer = data.dishStyle === "skewer", view = TWO_SIDE_VIEW[data.dishStyle];
  // 진행도 = 뒤집어 놓은 개수. 김치전은 1장, 닭꼬치는 준비 배치와 같은 3개입니다.
  const done = isSkewer ? (data.side === 1 ? view.total : data.flippedSkewers || 0) : (data.side === 1 ? 1 : 0);
  // strip : 하단 공용 띠에 들어갈 것. 지금은 굽기 단계의 조작 버튼 하나뿐이고,
  //         비어 있는 단계에서는 .mg-strip:empty 가 접혀 3열이 613.2 를 그대로 씁니다.
  let board = "", gauge = "", control = "", strip = "";
  if (data.phase === "cook") {
    const sideLabel = data.side === 0 ? "앞면" : "뒷면", config = TWO_SIDE_COOK_CONFIG[data.dishStyle];
    dom.miniDescription.textContent = `${sideLabel}을 익히다가 포인터가 작은 금색 구간 또는 주변 초록 구간에 들어오면 Space를 누르세요.`;
    board = twoSideStageMarkup(data);
    gauge = `<div class="doneness-gauge"><i class="doneness-good" style="left:${config.goodStart*100}%;width:${(config.goodEnd-config.goodStart)*100}%"></i><i class="doneness-perfect" style="left:${config.perfectStart*100}%;width:${(config.perfectEnd-config.perfectStart)*100}%"></i><i id="miniMarker" class="progress-marker" style="left:${data.marker*100}%"></i></div>
      <p class="cut-count">${sideLabel} 익히기</p>`;
    // 조작 버튼은 우측 카드가 아니라 하단 띠로 내려갑니다(E1 타이밍 칼질과 같은 처리).
    // Space 한 번으로 판정이 갈리는 게임이라 버튼이 게이지 바로 아래 한 줄에 있어야 합니다.
    control = twoSideKeysMarkup(view);
    strip = `<button class="mini-action ts-action" id="miniAction" type="button">Space · ${sideLabel} 완료</button>`;
  } else if (data.phase === "skewerFlip" || data.phase === "skewerTurning") {
    const current = Math.min(data.flippedSkewers || 0, SKEWER_BATCH_SIZE - 1);
    dom.miniDescription.textContent = "현재 꼬치에 ← 다음 →를 빠르게 누르세요. 한 쌍을 입력할 때마다 꼬치 하나가 뒤집힙니다.";
    board = twoSideStageMarkup(data, "skewer-flip-ready");
    gauge = `<div class="skewer-flip-sequence" aria-label="꼬치 뒤집기 진행도">${Array.from({ length: SKEWER_BATCH_SIZE }, (_, index) => `<span class="skewer-flip-pair ${index < (data.flippedSkewers || 0) ? "done" : index === current ? "current" : ""}"><b>←</b><b>→</b></span>`).join("")}</div>
      <p class="cut-count" id="skewerFlipLabel">꼬치 ${(data.flippedSkewers || 0) + 1} / ${SKEWER_BATCH_SIZE} · <strong>${data.flipStep === 1 ? "→" : "←"}</strong> 입력</p>`;
    control = twoSideKeysMarkup(view, data.flipStep === 1 ? "skewerFlipRight" : "skewerFlipLeft");
  } else if (data.phase === "flip") {
    dom.miniDescription.textContent = "앞 버튼(↑)을 꾹 눌렀다가 반동으로 뒤 버튼(↓)을 눌러 뒤집으세요!";
    board = `<div class="flip-rebound-scene">
        <i class="ts-grate" aria-hidden="true"></i><i class="ts-burner" aria-hidden="true"></i>
        <div class="two-side-pan pancake-cook flip-ready cook-ready" id="reboundPan">${pancakeCookFoodMarkup()}</div>
        <div class="rebound-arrow" id="reboundArrow">↑</div>
      </div>`;
    gauge = `<div class="rebound-gauge"><i id="reboundGaugeBar"></i><span class="rebound-sweet-zone"></span></div>
      <p class="cut-count" id="reboundLabel">반동 충전 0% · ↑를 꾹 누르세요</p>`;
    control = twoSideKeysMarkup(view, (data.flipCharge || 0) < 40 ? "reboundUp" : "reboundDown");
  } else {
    board = twoSideStageMarkup(data, "flipping");
    gauge = `<p class="cut-count">${isSkewer ? `꼬치 ${SKEWER_BATCH_SIZE}개` : "김치전"} 뒤집는 중…</p>`;
    control = twoSideKeysMarkup(view);
  }
  dom.miniContent.innerHTML = twoSideScreenMarkup(view, {
    board, gauge, control, strip, done, total: view.total,
    timePercent: data.timeLimit ? clamp(m.time / data.timeLimit, 0, 1) * 100 : 100
  });
  dom.miniContent.querySelector("#miniAction")?.addEventListener("click", miniAction);
  dom.miniContent.querySelector("#skewerFlipLeft")?.addEventListener("click", () => skewerFlipInput("left"));
  dom.miniContent.querySelector("#skewerFlipRight")?.addEventListener("click", () => skewerFlipInput("right"));
  const reboundUp = dom.miniContent.querySelector("#reboundUp"), reboundDown = dom.miniContent.querySelector("#reboundDown");
  if (reboundUp) {
    reboundUp.addEventListener("pointerdown", event => { event.preventDefault(); reboundUp.setPointerCapture(event.pointerId); setPancakeFlipCharge(true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(type => reboundUp.addEventListener(type, () => setPancakeFlipCharge(false)));
  }
  reboundDown?.addEventListener("click", releasePancakeFlip);
  if (data.phase === "cook") updateTwoSideCookVisual(data);
}

function twoSideCookAction() {
  const m = state.mini; if (!m || m.engine !== "twoSideCook" || m.complete) return;
  const data = m.data;
  if (data.phase === "cook") {
    const config=TWO_SIDE_COOK_CONFIG[data.dishStyle];
    const timingGrade=twoSideCookTimingGrade(data.marker,config);
    if (timingGrade==="miss") {
      data.cookErrors=(data.cookErrors||0)+1;
      const wasLate=data.marker>config.goodEnd;
      if(wasLate){data.marker=0;updateTwoSideCookVisual(data);const marker=dom.miniContent.querySelector("#miniMarker");if(marker)marker.style.left="0%";}
      dom.miniFeedback.textContent = wasLate?"타이밍을 놓쳤습니다. 다시 게이지를 맞추세요.":"타이밍 구간까지 조금 더 기다리세요."; audio.bad(); return;
    }
    data.hits.push(twoSideCookTimingScore(data.marker,config));
    if (data.side === 1) { completeTwoSideCook(m); return; }
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

function completeTwoSideCook(m){
  const data=m.data,grade=twoSideCookGrade(data);
  const average=Math.round(data.hits.reduce((sum,score)=>sum+score,0)/Math.max(1,data.hits.length));
  const score=grade==="perfect"?100:Math.round(clamp(average-(data.flipErrors||0)*5-(data.cookErrors||0)*4,70,95));
  const result=dom.miniContent.querySelector("#e5Result");
  dom.miniContent.querySelector(".ts-board")?.classList.add("e5-complete");
  if(result){result.textContent=grade==="perfect"?"PERFECT":"GOOD";result.classList.add(grade,"show");}
  dom.miniFeedback.textContent=grade==="perfect"?"양면을 완벽하게 익혔습니다!":"맛있게 구워냈습니다!";
  finishMini(score);
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
  // 오른쪽 조작 카드에서 지금 눌러야 할 키 한 개만 켜 둡니다
  markExpectedTwoSideKey(data.flipStep === 1 ? "skewerFlipRight" : "skewerFlipLeft");
}

// 조작 카드의 키 하나만 밝게 켭니다 (채썰기의 .fp-key.expected 와 같은 표시)
function markExpectedTwoSideKey(id) {
  dom.miniContent.querySelectorAll(".ts-key").forEach(key => key.classList.toggle("expected", key.id === id));
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
    updateSkewerFlipPrompt(data); return true;
  }
  data.flipStep = 0; data.flipWindow = 0;
  const completedIndex = data.flippedSkewers;
  const skewer = dom.miniContent.querySelector(`.grill-skewer.skewer-${completedIndex + 1}`);
  const pairs = dom.miniContent.querySelectorAll(".skewer-flip-pair");
  skewer?.classList.remove("current"); skewer?.classList.add("turning");
  pairs[completedIndex]?.classList.remove("current", "left-done"); pairs[completedIndex]?.classList.add("done");
  data.flippedSkewers++;
  setTimeout(() => { skewer?.classList.remove("turning"); skewer?.classList.add("flipped"); }, 300);
  if (data.flippedSkewers >= SKEWER_BATCH_SIZE) {
    data.phase = "skewerFinishing";
    dom.miniFeedback.textContent = `꼬치 ${SKEWER_BATCH_SIZE}개 뒤집기 완료!`;
    setTimeout(() => {
      if (state.mini !== m || m.complete) return;
      data.phase = "cook"; data.side = 1; data.marker = 0; data.dir = 1; data.speed = TWO_SIDE_COOK_CONFIG[data.dishStyle].sideSpeeds[1];
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
  // 반동이 충분히 차면 조작 카드의 켜진 키가 ↑ 에서 ↓ 로 넘어갑니다
  markExpectedTwoSideKey(charge < 40 ? "reboundUp" : "reboundDown");
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
    data.flipErrors=(data.flipErrors||0)+1;
    data.flipCharge = Math.max(0, charge - 18); dom.miniFeedback.textContent = "반동이 부족합니다. ↑를 조금 더 오래 눌러주세요."; audio.bad();
    return false;
  }
  data.hits.push(Math.round(clamp(100 - Math.abs(charge - 72) * 2.4, 35, 100)));
  dom.miniFeedback.textContent = charge > 90 ? "강한 반동으로 뒤집었습니다!" : "반동을 이용해 깔끔하게 뒤집었습니다!";
  // 반동을 모은 뒤 ↓를 누른 바로 그 순간에 뒤집기 효과음을 시작합니다.
  audio.play?.("pancake_flip",{owner:m});
  startTwoSideFlipAnimation(m);
  return true;
}

function startTwoSideFlipAnimation(m) {
  m.data.phase = "flipping"; renderTwoSideCook();
  setTimeout(() => {
    if (state.mini !== m || m.complete) return;
    m.data.phase = "cook"; m.data.side = 1; m.data.marker = 0; m.data.dir = 1; m.data.speed = TWO_SIDE_COOK_CONFIG[m.data.dishStyle].sideSpeeds[1];
    dom.miniFeedback.textContent = "뒤집기 완료 · 뒷면을 익히세요."; renderTwoSideCook();
  }, 620);
}
