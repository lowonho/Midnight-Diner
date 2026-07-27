"use strict";

/* ============================================================
   E3 방향 시퀀스 — 단일 입력·판정 컨트롤러

     김치 볶기 (낮 준비)   ← → 중 10회
     볶음우동 (밤 조리)    ← ↑ → ↓ 중 12회

   입력 순서 생성, 정답·오답 판정, 진행 및 완료 처리는 같은 컨트롤러가
   담당합니다. 두 게임의 화면 마크업은 에셋을 따로 붙일 수 있도록 유지합니다.
   ============================================================ */

registerDayPrepSetup("kimchiFry",taskId=>setupKimchiFry(taskId));

const DIRECTION_SEQUENCE_CONFIG=Object.freeze({
  kimchi:Object.freeze({
    total:10,
    directions:Object.freeze(["left","right"]),
    completion:"dayPrep",
    taskId:"fryTofuKimchi",
    completionMessage:"두부김치용 김치 볶기 완료",
    wrongMessage:"방향이 다릅니다. 검게 변하지 않은 첫 화살표부터 다시 확인하세요."
  }),
  yakisoba:Object.freeze({
    total:12,
    directions:Object.freeze(["left","up","right","down"]),
    completion:"night",
    errorPenalty:12,
    wrongMessage:"볶는 방향이 엇갈렸어요."
  })
});

const DIRECTION_SYMBOL=Object.freeze({left:"←",up:"↑",right:"→",down:"↓"});
const DIRECTION_KEY=Object.freeze({arrowleft:"left",arrowup:"up",arrowright:"right",arrowdown:"down"});

function createDirectionSequence(configId,overrides={}){
  const config=DIRECTION_SEQUENCE_CONFIG[configId];
  return {
    configId,
    taskId:overrides.taskId||config.taskId||null,
    sequence:Array.from({length:config.total},()=>config.directions[Math.floor(Math.random()*config.directions.length)]),
    index:0,
    errors:0
  };
}

function directionSequenceKey(m,key){
  const direction=DIRECTION_KEY[key];
  if(!direction)return false;
  directionSequenceInput(direction);return true;
}

function directionSequenceInput(direction){
  const m=state.mini;if(!m||m.complete)return false;
  const data=m.data,config=DIRECTION_SEQUENCE_CONFIG[data.configId];
  if(!config||!config.directions.includes(direction))return false;

  animateDirectionInput(data.configId,direction);
  if(data.sequence[data.index]!==direction){
    data.errors++;audio.bad();dom.miniFeedback.textContent=config.wrongMessage;
    return false;
  }

  data.index++;audio.click();dom.miniFeedback.textContent="볶기 성공";
  updateDirectionSequenceView(m);
  if(data.index<config.total)return true;

  if(config.completion==="dayPrep")finishDayPrepTask(data.taskId,config.completionMessage);
  else finishMini(Math.max(70,100-data.errors*(config.errorPenalty||0)));
  return true;
}

function animateDirectionInput(configId,direction){
  if(configId==="kimchi"){
    const work=dom.miniContent.querySelector("#fryWorkArea");if(!work)return;
    const tossClass=direction==="left"?"toss-left":"toss-right";
    work.classList.remove("toss-left","toss-right");void work.offsetWidth;work.classList.add(tossClass);
    setTimeout(()=>work.classList.remove(tossClass),170);
    return;
  }
  const symbol=DIRECTION_SYMBOL[direction];
  const pressed=dom.miniContent.querySelector(`.arrow-button[data-arrow="${symbol}"]`);
  if(pressed){pressed.classList.remove("pressed");void pressed.offsetWidth;pressed.classList.add("pressed");setTimeout(()=>pressed.classList.remove("pressed"),150);}
}

function updateDirectionSequenceView(m){
  const data=m.data,config=DIRECTION_SEQUENCE_CONFIG[data.configId];
  if(data.configId==="kimchi"){
    dom.miniContent.querySelectorAll("[data-sequence-index]").forEach((chip,index)=>{
      chip.classList.toggle("done",index<data.index);chip.classList.toggle("current",index===data.index);
    });
    dom.miniTimer.textContent=`${data.index} / ${config.total}`;
    const progress=dom.miniContent.querySelector(".cut-count");if(progress)progress.textContent=`진행 ${data.index} / ${config.total}`;
    return;
  }
  dom.miniContent.querySelectorAll("[data-i]").forEach((chip,index)=>{
    chip.classList.toggle("correct",index<data.index);chip.classList.toggle("current",index===data.index);
  });
  const progress=dom.miniContent.querySelector("#arrowProgress");if(progress)progress.textContent=`진행 ${data.index} / ${config.total}`;
}

/* ---- 김치 볶기 화면 --------------------------------------- */

registerDayPrepEngine("directionSequence",{key:directionSequenceKey});

function setupKimchiFry(taskId="fryTofuKimchi"){
  setDayPrepData({mode:"directionSequence",...createDirectionSequence("kimchi",{taskId})});
  dom.miniTitle.textContent="두부김치 · 김치 볶기";
  dom.miniDescription.textContent="썰어 둔 두부김치용 김치를 팬에서 볶습니다. 표시된 방향을 왼쪽부터 순서대로 누르세요.";
  renderKimchiFry();
}

function renderKimchiFry(){
  const data=state.mini.data,config=DIRECTION_SEQUENCE_CONFIG[data.configId];
  dom.miniTimer.textContent=`${data.index} / ${config.total}`;
  dom.miniContent.innerHTML=`
    <div class="fry-work-area" id="fryWorkArea">
      <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
        ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
        <i class="frying-kimchi ${hasDayPrepAsset("fryingKimchi")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryingKimchi","frying-kimchi-asset","볶는 김치")}</i>
      </div>
    </div>
    <div class="kimchi-direction-sequence" aria-label="볶기 방향 순서">
      ${data.sequence.map((direction,index)=>`<span class="kimchi-direction-chip ${index<data.index?"done":index===data.index?"current":""}" data-sequence-index="${index}">${DIRECTION_SYMBOL[direction]}</span>`).join("")}
    </div>
    <div class="cut-count">진행 ${data.index} / ${config.total}</div>
    <div class="prep-direction-buttons">
      ${config.directions.map(direction=>`<button type="button" data-direction="${direction}">${DIRECTION_SYMBOL[direction]}</button>`).join("")}
    </div>`;
  dom.miniContent.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("click",()=>directionSequenceInput(button.dataset.direction)));
}

/* ---- 볶음우동 조리 화면 ----------------------------------- */

registerMiniEngine("stir",{
  setup(m,{set}){
    const config=DIRECTION_SEQUENCE_CONFIG.yakisoba;
    set("철판 볶기","표시된 방향 순서를 빠르게 입력해 면과 채소를 골고루 볶으세요.",10);
    m.data=createDirectionSequence("yakisoba");
    renderArrowGame();
  },
  key:directionSequenceKey
});

function renderArrowGame(){
  const m=state.mini;if(!m)return;
  const config=DIRECTION_SEQUENCE_CONFIG[m.data.configId];
  dom.miniContent.innerHTML=`<div class="sequence-view" id="arrowSequence">${m.data.sequence.map((direction,index)=>`<span class="sequence-chip arrow-sequence-chip ${index===m.data.index?"current":""}" data-i="${index}">${DIRECTION_SYMBOL[direction]}</span>`).join("")}</div><div class="cut-count" id="arrowProgress">진행 ${m.data.index} / ${config.total}</div><div class="arrow-grid" id="arrowGrid"></div>`;
  const grid=dom.miniContent.querySelector("#arrowGrid");
  config.directions.forEach(direction=>{const button=document.createElement("button");button.type="button";button.className="arrow-button";button.dataset.arrow=DIRECTION_SYMBOL[direction];button.textContent=DIRECTION_SYMBOL[direction];button.addEventListener("click",()=>directionSequenceInput(direction));grid.appendChild(button);});
}
