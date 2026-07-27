"use strict";

/* ============================================================
   E3 방향 시퀀스 — 게임 2개

     김치 볶기 (낮 준비 · 두부김치)   ← → 11개
     볶음우동 조리 (밤 조리)          ← ↑ → ↓ 8개

   제시된 방향 배열을 왼쪽부터 순서대로 입력합니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례와 맞는가 / 다음으로 넘긴다" 판정은 아래 도우미로 합쳤습니다.
   · 두 게임은 아직 규칙이 다릅니다.
       방향 수   : 4방향(볶음우동) vs 2방향(김치)
       오답 처리 : 볶음우동은 12점 감점, 김치는 감점 없이 안내만
       완료 처리 : 밤은 점수 정산, 낮은 준비 태스크 완료
     완전히 한 벌로 만들려면 이 차이를 데이터(표)로 빼야 합니다.
     화면 마크업도 서로 다른데, 이쪽은 에셋 작업 영역이라 두었습니다.
   ============================================================ */

registerDayPrepSetup("kimchiFry",taskId=>setupKimchiFry(taskId));

/* ---- 공통 판정 규칙 ---------------------------------------- */

// 입력이 지금 차례와 맞는가
function sequenceMatches(sequence,index,input){
  return sequence[index]===input;
}

/* ============================================================
   1. 김치 볶기 (낮 준비)
   ============================================================ */

registerDayPrepEngine("direction",{
  key(m,k){
    if(k==="arrowleft"||k==="arrowright"){kimchiFryInput(k.replace("arrow",""));return true;}
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
  dom.miniContent.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("click",()=>kimchiFryInput(button.dataset.direction)));
}

function kimchiFryInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  const data=m.data;
  if(!data.allowedDirections.includes(direction))return;
  if(!sequenceMatches(data.sequence,data.successes,direction)){
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

/* ============================================================
   2. 볶음우동 조리 (밤 조리)
   ============================================================ */

registerMiniEngine("stir",{
  setup(m,{set}){
    set("철판 볶기","표시된 방향 순서를 빠르게 입력해 면과 채소를 골고루 볶으세요.",10);
    const arrows=Array.from({length:8},()=>["←","↑","→","↓"][Math.floor(Math.random()*4)]);
    m.data={arrows,index:0,errors:0};
    renderArrowGame();
  },

  key(m,k){
    const map={arrowleft:"←",arrowup:"↑",arrowright:"→",arrowdown:"↓"};
    if(map[k]){arrowInput(map[k]);return true;}
    return false;
  }
});

function renderArrowGame(){
  const m=state.mini;if(!m)return;
  dom.miniContent.innerHTML=`<div class="sequence-view" id="arrowSequence">${m.data.arrows.map((a,i)=>`<span class="sequence-chip arrow-sequence-chip ${i===m.data.index?"current":""}" data-i="${i}">${a}</span>`).join("")}</div><div class="cut-count" id="arrowProgress">진행 ${m.data.index} / ${m.data.arrows.length}</div><div class="arrow-grid" id="arrowGrid"></div>`;
  const grid=dom.miniContent.querySelector("#arrowGrid");
  ["←","↑","→","↓"].forEach(a=>{const b=document.createElement("button");b.type="button";b.className="arrow-button";b.dataset.arrow=a;b.textContent=a;b.addEventListener("click",()=>arrowInput(a));grid.appendChild(b);});
}

function arrowInput(a){
  const m=state.mini;if(!m||m.engine!=="stir")return;
  const pressed=dom.miniContent.querySelector(`.arrow-button[data-arrow="${a}"]`);
  if(pressed){pressed.classList.remove("pressed");void pressed.offsetWidth;pressed.classList.add("pressed");setTimeout(()=>pressed.classList.remove("pressed"),150);}
  if(sequenceMatches(m.data.arrows,m.data.index,a)){
    const completed=dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);
    completed.classList.remove("current");completed.classList.add("correct");
    m.data.index++;
    const next=dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);if(next)next.classList.add("current");
    const progress=dom.miniContent.querySelector("#arrowProgress");if(progress)progress.textContent=`진행 ${m.data.index} / ${m.data.arrows.length}`;
    audio.click();if(m.data.index===m.data.arrows.length)finishMini(Math.max(70,100-m.data.errors*12));
  }
  else{m.data.errors++;audio.bad();dom.miniFeedback.textContent="볶는 방향이 엇갈렸어요.";}
}
