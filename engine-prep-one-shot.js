"use strict";

/* ============================================================
   E11 단발 액션 (낮 준비) — 어묵탕 재료를 냄비에 넣기

   조작이 없는 연출 전용 단계입니다.
   무·어묵·멸치 손질이 끝나면 각각 이 화면으로 넘어와,
   재료가 냄비로 떨어지는 모습을 0.65초 보여준 뒤 태스크를 완료합니다.
   이미 손질을 마친 재료는 국물 안에 함께 그려집니다.

   [들어오는 길]
   시작 함수(registerDayPrepSetup)가 없습니다.
   · engine-prep-timing-cut.js  무·어묵 썰기 완료 시
   · engine-prep-target-click.js 멸치 손질 완료 시
   두 곳에서 showOdenIngredientDrop 을 부릅니다.

   🆕 표의 "육수 넣기"도 조작 없는 단발 액션이라 이 파일에 붙이면 됩니다.
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
