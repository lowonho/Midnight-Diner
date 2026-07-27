"use strict";

/* ============================================================
   E1 타이밍 칼질 (밤 조리 "chop")

   ⚠️ 이 엔진은 아직 반쪽입니다.
   표의 E1 은 게임 7개(어묵·무·김치·파·닭·두부·떡볶이양배추)를 묶지만,
   그중 낮 준비 6개는 지금도 day-prep-minigames.js 에 따로 있습니다.
   여기 있는 건 밤 조리 쪽 한 벌뿐입니다. 합치는 건 2단계입니다.

   [두 갈래]
   · 정밀 손질  — 노란 중심(50%)에 가까울수록 고득점, 5회. 지금 유일하게 살아있는 경로.
                 스토리 PR-02 튜토리얼에서만 불립니다. (story.js)
   · 두부 썰기  — 초록 구간 안에서만 성공, 세로 5 + 가로 1 = 6회.
                 ♻️ 지금은 호출되는 곳이 없는 죽은 코드입니다.
                 조건이 mode==="cook" && dishId==="tofu" 인데
                 두부김치의 조리 단계는 plateKimchi 라서 절대 만족되지 않습니다.
                 표에 "죽은코드 부활"로 잡혀 있어 지우지 않고 그대로 옮겼습니다.
   ============================================================ */

registerMiniEngine("chop", {
  setup(m, { set }) {
    const isTofu = m.context.mode === "cook" && m.context.dishId === "tofu";
    set(
      isTofu ? "두부 썰기" : "정밀 손질",
      isTofu
        ? "무와 김치를 썰 때처럼 포인터가 초록 구간에 들어왔을 때 누르세요. 세로 5번, 마지막에 가로 1번 썹니다."
        : "움직이는 칼 표시가 노란 중심에 들어왔을 때 SPACE 또는 썰기 버튼을 누르세요.",
      10
    );
    m.data = isTofu
      ? { marker: 0, dir: 1, speed: .78, hits: [], cuts: 0, total: 6, tofuStyle: true, zoneWidth: .14, zoneStarts: [.18, .56, .3, .67, .42, .22] }
      : { marker: 0, dir: 1, speed: .92, hits: [], cuts: 0 };
    if (isTofu) dom.miniTimer.textContent = "0 / 6";
    dom.miniContent.innerHTML = isTofu
      ? `<div class="prep-work-object tofu-shape tofu-cook-object" id="tofuCookObject" aria-label="두부">${Array.from({ length: 5 }, (_, index) => `<i class="cut-line" data-tofu-cut="${index}" style="left:${(index + 1) / 6 * 100}%"></i>`).join("")}<i class="cut-line tofu-horizontal-line" data-tofu-cut="5"></i><i class="knife-effect"></i></div><div class="prep-timing-bar"><i class="prep-success-zone" id="tofuSuccessZone" style="left:${m.data.zoneStarts[0] * 100}%;width:${m.data.zoneWidth * 100}%"></i><i id="miniMarker" class="prep-timing-marker"></i></div><div class="cut-count">세로 썰기 · 0 / 6</div><button class="mini-action" id="miniAction" type="button">두부 썰기</button>`
      : `<div class="progress-track"><i class="progress-zone" style="left:38%;width:24%"></i><i class="progress-perfect" style="left:47%;width:6%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">0 / 5회</div><button class="mini-action" id="miniAction" type="button">썰기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click", miniAction);
  },

  // 두부 썰기는 타이머 자리에 "3 / 6" 처럼 횟수를 쓰므로 시간이 흐르지 않습니다.
  timerRuns(m) {
    return !m.data.tofuStyle;
  },

  update(m, dt) {
    advanceBounceMarker(m, dt);
  },

  action(m) {
    if (m.data.tofuStyle) { tofuChopAction(m); return; }
    const score = markerScore(m, .5);
    m.data.hits.push(score); m.data.cuts++; audio.click();
    dom.miniContent.querySelector(".cut-count").textContent = `${m.data.cuts} / 5회`;
    const tofuObject = dom.miniContent.querySelector("#tofuCookObject");
    if (tofuObject) {
      tofuObject.querySelector(`[data-tofu-cut="${m.data.cuts - 1}"]`)?.classList.add("done");
      tofuObject.classList.remove("slice-hit"); void tofuObject.offsetWidth; tofuObject.classList.add("slice-hit");
    }
    m.data.marker = 0; m.data.dir = 1; m.data.speed += .08;
    if (m.data.cuts >= 5) finishMini(Math.round(m.data.hits.reduce((a, b) => a + b, 0) / m.data.hits.length));
  }
});

function tofuChopAction(m) {
  const data = m.data, zoneStart = data.zoneStarts[data.cuts], zoneEnd = zoneStart + data.zoneWidth;
  if (data.marker < zoneStart || data.marker > zoneEnd) {
    dom.miniFeedback.textContent = "절단선을 놓쳤습니다. 초록 구간에서 다시 썰어주세요."; audio.bad(); return;
  }
  const center = zoneStart + data.zoneWidth / 2;
  data.hits.push(Math.round(clamp(100 - Math.abs(data.marker - center) * 300, 70, 100)));
  const tofuObject = dom.miniContent.querySelector("#tofuCookObject");
  tofuObject?.querySelector(`[data-tofu-cut="${data.cuts}"]`)?.classList.add("done");
  tofuObject?.classList.remove("slice-hit"); if (tofuObject) { void tofuObject.offsetWidth; tofuObject.classList.add("slice-hit"); }
  data.cuts++; audio.click();
  dom.miniTimer.textContent = `${data.cuts} / ${data.total}`;
  dom.miniContent.querySelector(".cut-count").textContent = data.cuts < 5 ? `세로 썰기 · ${data.cuts} / ${data.total}` : data.cuts === 5 ? `다음은 가로 썰기 · ${data.cuts} / ${data.total}` : `완료 · ${data.cuts} / ${data.total}`;
  if (data.cuts >= data.total) { finishMini(Math.round(data.hits.reduce((sum, score) => sum + score, 0) / data.hits.length)); return; }
  if (data.cuts === 5) tofuObject?.classList.add("horizontal-cut");
  const successZone = dom.miniContent.querySelector("#tofuSuccessZone");
  if (successZone) successZone.style.left = `${data.zoneStarts[data.cuts] * 100}%`;
  data.marker = 0; data.dir = 1; data.speed += .05; dom.miniFeedback.textContent = "절단 성공";
}
