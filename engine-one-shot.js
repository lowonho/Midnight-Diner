"use strict";

/* ============================================================
   E11 단발 액션 — 밤 조리 "plateKimchi"

   버튼 한 번으로 끝나는 연출용 게임입니다. 항상 100점.
   실패가 없으므로 update / key 가 없습니다.

   쓰는 곳: 두부김치 플레이팅 (game-data.js 의 game:"plateKimchi")
   표의 "육수 넣기"(🆕)도 나중에 이 엔진에 붙습니다. (2단계)
   ============================================================ */

registerMiniEngine("plateKimchi", {
  setup(m, { set }) {
    set("두부김치 플레이팅", "영업 준비 때 볶아 둔 김치를 두부와 함께 접시에 담으세요.", 8);
    m.data = {};
    dom.miniContent.innerHTML = `<div class="kimchi-plating"><span class="plated-kimchi" aria-hidden="true">🥬</span><span class="plated-tofu" aria-hidden="true"><i></i><i></i><i></i></span><strong>볶음김치 + 두부</strong></div><button class="mini-action" id="miniAction" type="button">함께 플레이팅</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click", () => finishMini(100));
  }
});
