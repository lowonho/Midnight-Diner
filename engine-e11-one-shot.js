"use strict";

/* ============================================================
   E11 단발 액션 — 게임 3개

     두부김치 플레이팅 (밤 조리)   버튼 1회 → 항상 100점
     냄비에 넣기 (낮 준비)          조작 없이 0.65초 연출 → 태스크 완료
     육수 넣기 (낮 준비)            버튼 1회 → 붓는 연출 → 태스크 완료

   실패가 없는 연출용 게임입니다. 그래서 셋 다 update 가 없습니다.
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

/* ============================================================
   3. 육수 넣기 (낮 준비 · 어묵탕 마지막 단계)

   무 · 어묵 · 멸치를 모두 넣은 냄비에 육수를 붓습니다.
   버튼을 한 번 누르면 붓는 연출이 나오고 준비가 끝납니다.
   재료를 넣는 연출(위 potDrop)과 같은 냄비 그림을 씁니다.
   ============================================================ */

registerDayPrepSetup("odenBroth",taskId=>setupOdenBroth(taskId));

// 버튼 클릭만 쓰므로 키 처리가 없습니다.
registerDayPrepEngine("brothPour",{});

function setupOdenBroth(taskId){
  const m=setDayPrepData({mode:"brothPour",taskId,poured:false});
  if(!m)return;
  dom.miniTitle.textContent="어묵탕 · 육수 넣기";
  dom.miniDescription.textContent="손질을 마친 재료 위에 육수를 부어 어묵탕 준비를 마칩니다.";
  renderOdenBroth();
}

function renderOdenBroth(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="brothPour")return;
  const poured=m.data.poured;
  dom.miniTimer.textContent=poured?"완료":"육수";
  dom.miniContent.innerHTML=`
    <div class="oden-pot-scene">
      <div class="oden-pot-ingredients"><i class="pot-ingredient broth ${poured?"dropping":""}"></i></div>
      <div class="oden-broth ${poured?"broth-filled":""}">
        <i class="broth-piece radish"></i><i class="broth-piece fishCake"></i><i class="broth-piece anchovy"></i>
      </div>
      <div class="oden-pot"><i class="pot-rim"></i></div>
    </div>
    <div class="cut-count">${poured?"육수를 붓는 중…":"재료가 모두 들어갔습니다. 이제 육수를 부어주세요."}</div>
    <button class="mini-action" id="odenBrothAction" type="button" ${poured?"disabled":""}>육수 붓기</button>`;
  dom.miniContent.querySelector("#odenBrothAction")?.addEventListener("click",pourOdenBroth);
}

function pourOdenBroth(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="brothPour"||m.data.poured)return;
  m.data.poured=true;audio.click();
  renderOdenBroth();
  dom.miniFeedback.textContent="육수가 냄비를 채웁니다.";
  setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(m.data.taskId,"어묵탕 육수 넣기 완료");},650);
}
