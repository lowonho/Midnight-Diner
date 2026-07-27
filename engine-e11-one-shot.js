"use strict";

/* ============================================================
   E11 단발 액션 — 게임 2개

     두부김치 플레이팅 (밤 조리)   버튼 1회 → 항상 100점
     냄비에 넣기 (낮 준비)          조작 없이 0.65초 연출 → 태스크 완료

   실패가 없는 연출용 게임입니다. 그래서 둘 다 update / key 가 없습니다.

   🆕 표의 "육수 넣기"(어묵탕 P2)가 아직 없습니다. 3단계에서 여기에 붙입니다.
      조작 없는 단발 연출이므로 아래 냄비에 넣기와 같은 형태로 만들면 됩니다.
   ============================================================ */

/* ============================================================
   1. 두부김치 플레이팅 (밤 조리)
   ============================================================ */

registerMiniEngine("plateKimchi",{
  setup(m,{set}){
    set("두부김치 플레이팅","영업 준비 때 볶아 둔 김치를 두부와 함께 접시에 담으세요.",8);
    m.data={};
    dom.miniContent.innerHTML=`<div class="kimchi-plating"><span class="plated-kimchi" aria-hidden="true">🥬</span><span class="plated-tofu" aria-hidden="true"><i></i><i></i><i></i></span><strong>볶음김치 + 두부</strong></div><button class="mini-action" id="miniAction" type="button">함께 플레이팅</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",()=>finishMini(100));
  }
});

/* ============================================================
   2. 어묵탕 재료를 냄비에 넣기 (낮 준비)

   무·어묵·멸치 손질이 끝나면 각각 이 화면으로 넘어와,
   재료가 냄비로 떨어지는 모습을 보여준 뒤 태스크를 완료합니다.
   이미 손질을 마친 재료는 국물 안에 함께 그려집니다.

   [들어오는 길] 시작 함수(registerDayPrepSetup)가 없습니다.
     · engine-e1-timing-cut.js   무·어묵 썰기 완료 시
     · engine-e10-target-click.js 멸치 손질 완료 시
   ============================================================ */

// 조작이 없으므로 비어 있습니다. (ESC 로 닫는 것만 공통으로 붙습니다)
registerDayPrepEngine("potDrop",{});

function showOdenIngredientDrop(taskId,ingredient,message){
  const ingredientOrder=["radish","fishCake","anchovy"];
  const completedIngredients=ingredientOrder.filter(item=>item===ingredient||(
    item==="radish"&&state.prepProgress.cutRadish||
    item==="fishCake"&&state.prepProgress.cutFishCake||
    item==="anchovy"&&state.prepProgress.cleanAnchovy
  ));
  const m=setDayPrepData({mode:"potDrop",taskId,ingredient,message});
  if(!m)return;
  dom.miniTitle.textContent="어묵탕 · 냄비에 넣기";
  dom.miniDescription.textContent=`손질을 마친 ${ingredient==="radish"?"무":ingredient==="fishCake"?"어묵":"멸치"}를 육수 냄비에 넣습니다.`;
  dom.miniTimer.textContent="냄비";
  dom.miniContent.innerHTML=`
    <div class="oden-pot-scene">
      <div class="oden-pot-ingredients"><i class="pot-ingredient ${ingredient} dropping"></i></div>
      <div class="oden-broth">${completedIngredients.map(item=>`<i class="broth-piece ${item} ${item===ingredient?"just-added":""}"></i>`).join("")}</div>
      <div class="oden-pot"><i class="pot-rim"></i></div>
    </div>
    <div class="cut-count">손질한 재료를 냄비에 넣는 중</div>`;
  setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(taskId,message);},650);
}
