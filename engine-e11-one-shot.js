"use strict";

/* ============================================================
   E11 단발 액션 — 공통 상태·완료 컨트롤러

   ready → triggered → complete 흐름은 공통으로 처리하고, 각 게임의 그림과
   연출 마크업은 그대로 분리합니다. 이후 에셋은 config의 assetKeys와 각
   렌더러만 교체하면 됩니다.
   ============================================================ */

const ONE_SHOT_CONFIG=Object.freeze({
  plateKimchi:Object.freeze({trigger:"click",duration:0,completion:"night",score:100,assetKeys:Object.freeze(["plateKimchi","plateTofu"])}),
  potDrop:Object.freeze({trigger:"auto",duration:650,completion:"dayPrep",assetKeys:Object.freeze(["odenPot","odenIngredient"])}),
  brothPour:Object.freeze({trigger:"click",duration:650,completion:"dayPrep",assetKeys:Object.freeze(["odenPot","odenBroth"])}),
});

function createOneShotData(configId,extra={}){
  return {configId,status:"ready",...extra};
}

function triggerOneShot(m,onTriggered){
  if(!m||m.complete||m.data.status!=="ready")return false;
  const config=ONE_SHOT_CONFIG[m.data.configId];if(!config)return false;
  m.data.status="triggered";
  onTriggered?.(m);
  const complete=()=>{
    if(state.mini!==m||m.complete)return;
    m.data.status="complete";
    if(config.completion==="night")finishMini(config.score);
    else finishDayPrepTask(m.data.taskId,m.data.completionMessage);
  };
  if(config.duration>0)setTimeout(complete,config.duration);else complete();
  return true;
}

/* ---- 두부김치 플레이팅 (밤 조리) ------------------------- */

registerMiniEngine("plateKimchi",{
  setup(m,{set}){
    set("두부김치 플레이팅","영업 준비 때 볶아 둔 김치를 두부와 함께 접시에 담으세요.",8);
    m.data=createOneShotData("plateKimchi");
    dom.miniContent.innerHTML=`<div class="kimchi-plating"><span class="plated-kimchi" aria-hidden="true">🥬</span><span class="plated-tofu" aria-hidden="true"><i></i><i></i><i></i></span><strong>볶음김치 + 두부</strong></div><button class="mini-action" id="miniAction" type="button">함께 플레이팅</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",()=>triggerOneShot(m));
  },
  action(m){triggerOneShot(m);},
  timeout(m){finishMini(35);}
});

/* ---- 어묵탕 재료 냄비 투입 (낮 준비 · 자동 연출) -------- */

registerDayPrepEngine("oneShot",{
  action(){oneShotDayAction();}
});

function showOdenIngredientDrop(taskId,ingredient,message){
  const ingredientOrder=["radish","fishCake","anchovy"];
  const completedIngredients=ingredientOrder.filter(item=>item===ingredient||(
    item==="radish"&&state.prepProgress.cutRadish||
    item==="fishCake"&&state.prepProgress.cutFishCake||
    item==="anchovy"&&state.prepProgress.cleanAnchovy
  ));
  const m=setDayPrepData(createOneShotData("potDrop",{mode:"oneShot",taskId,ingredient,completionMessage:message}));
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
  triggerOneShot(m);
}

/* ---- 육수 넣기 (낮 준비 · 클릭 1회) ---------------------- */

registerDayPrepSetup("odenBroth",taskId=>setupOdenBroth(taskId));

function setupOdenBroth(taskId){
  const m=setDayPrepData(createOneShotData("brothPour",{mode:"oneShot",taskId,completionMessage:"어묵탕 육수 넣기 완료"}));
  if(!m)return;
  dom.miniTitle.textContent="어묵탕 · 육수 넣기";
  dom.miniDescription.textContent="손질을 마친 재료 위에 육수를 부어 어묵탕 준비를 마칩니다.";
  renderOdenBroth();
}

function renderOdenBroth(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="oneShot"||m.data.configId!=="brothPour")return;
  const poured=m.data.status!=="ready";
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

function oneShotDayAction(){
  const m=state.mini;if(m?.data?.configId==="brothPour")pourOdenBroth();
}

function pourOdenBroth(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="oneShot"||m.data.configId!=="brothPour")return;
  triggerOneShot(m,()=>{
    audio.click();renderOdenBroth();dom.miniFeedback.textContent="육수가 냄비를 채웁니다.";
  });
}
