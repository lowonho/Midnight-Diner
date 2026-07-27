"use strict";

/* ============================================================
   E3 방향 시퀀스 (낮 준비) — 두부김치용 김치 볶기

   ← → 가 무작위로 11개 늘어서고, 왼쪽부터 순서대로 누릅니다.
   틀리면 진행이 멈출 뿐 점수가 깎이거나 되돌아가지는 않습니다.

   ⚠️ 밤 조리의 볶음우동(engine-direction-seq.js)도 같은 E3 입니다.
   그쪽은 ← ↑ → ↓ 네 방향에 오답 페널티가 있습니다. 합칠지는 2단계에서.
   ============================================================ */

registerDayPrepSetup("kimchiFry",taskId=>setupKimchiFry(taskId));

registerDayPrepEngine("direction",{
  key(m,k){
    if(k==="arrowleft"||k==="arrowright"){dayPrepDirectionInput(k.replace("arrow",""));return true;}
    return false;
  }
});

function setupKimchiFry(taskId="fryTofuKimchi"){
  const config=DAY_PREP_MINI_CONFIG.fryKimchi;
  const sequence=Array.from({length:config.total},()=>config.allowedDirections[Math.floor(Math.random()*config.allowedDirections.length)]);
  setDayPrepData({mode:"direction",taskId,successes:0,total:config.total,allowedDirections:[...config.allowedDirections],sequence});
  dom.miniTitle.textContent="두부김치 · 김치 볶기";
  dom.miniDescription.textContent="썰어 둔 두부김치용 김치를 팬에서 볶습니다. 표시된 방향을 왼쪽부터 순서대로 누르세요.";
  renderKimchiFry();
}

function renderKimchiFry(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="fry-work-area" id="fryWorkArea">
      <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
        ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
        <i class="frying-kimchi ${hasDayPrepAsset("fryingKimchi")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryingKimchi","frying-kimchi-asset","볶는 김치")}</i>
      </div>
    </div>
    <div class="kimchi-direction-sequence" aria-label="볶기 방향 순서">
      ${data.sequence.map((direction,index)=>`<span class="kimchi-direction-chip ${index<data.successes?"done":index===data.successes?"current":""}" data-sequence-index="${index}">${direction==="left"?"←":"→"}</span>`).join("")}
    </div>
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <div class="prep-direction-buttons">
      ${data.allowedDirections.map(direction=>`<button type="button" data-direction="${direction}">${direction==="left"?"←":"→"}</button>`).join("")}
    </div>`;
  dom.miniContent.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("click",()=>dayPrepDirectionInput(button.dataset.direction)));
}

function dayPrepDirectionInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  const data=m.data;
  if(!data.allowedDirections.includes(direction))return;
  if(direction!==data.sequence[data.successes]){
    dom.miniFeedback.textContent="방향이 다릅니다. 검게 변하지 않은 첫 화살표부터 다시 확인하세요.";
    return;
  }
  const completed=dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`);
  completed?.classList.remove("current");completed?.classList.add("done");
  data.successes++;
  dom.miniFeedback.textContent="볶기 성공";
  dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.add("current");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const progress=dom.miniContent.querySelector(".cut-count");
  if(progress)progress.textContent=`진행 ${data.successes} / ${data.total}`;
  const work=dom.miniContent.querySelector("#fryWorkArea");
  if(work){
    const tossClass=direction==="left"?"toss-left":"toss-right";
    work.classList.remove("toss-left","toss-right");void work.offsetWidth;work.classList.add(tossClass);
    setTimeout(()=>work.classList.remove(tossClass),170);
  }
  if(data.successes>=data.total){
    finishDayPrepTask(data.taskId,"두부김치용 김치 볶기 완료");
    return;
  }
}
