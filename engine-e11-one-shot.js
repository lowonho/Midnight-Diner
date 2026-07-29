"use strict";

/* ============================================================
   E11 단발 액션 — 게임 3개 (화면·조작 통일)

     두부김치 플레이팅 (밤 조리)   썬 두부 + 볶은 김치 → 접시
     냄비에 넣기 (낮 준비)          손질을 마친 재료 → 육수 냄비
     육수 넣기 (낮 준비)            육수 → 재료가 들어 있는 냄비

   셋 다 "재료를 그릇에 옮기면 끝" 인 단발 액션입니다.
   실패도 제한시간도 없고 화면 틀·조작이 완전히 같아서
   startOneShot / renderOneShot 한 벌을 셋이 함께 씁니다.
   (불리기 두 게임이 renderTteokSoak 하나를 나눠 쓰는 것과 같은 방식입니다.
    앞으로 단발 액션 게임이 늘어나도 여기에 정의만 추가하면 됩니다.)

   공통 포인터 컨트롤러는 마우스와 터치를 함께 처리하고, 마무리 연출만
   place(플레이팅) / drop(냄비 투입) / pour(육수 붓기)로 나눕니다.

   [화면 구성]  그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체됩니다.
     왼쪽   재료 카드 — 끌어다 놓거나, 눌러 집은 뒤 그릇을 눌러도 됩니다
     가운데 그릇(접시 / 냄비) + 끌어다 놓으라는 점선 화살표
     오른쪽 완성 개수 + 참고 모양
     아래   TIP 줄 오른쪽에 조작 안내 칩 (공용 setMiniTipHint 로 글자만 넣습니다)

   모양·크기는 css/day-prep-minigames.css 의 "단발 액션" 구역에 모여 있습니다.
   공용 프레임(css/minigame-frame.css, ui-mini-frame.js)은 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   ============================================================ */

/* ---- 재료 · 그릇 정의 --------------------------------------
   art  는 CSS 임시 도형 이름, asset 은 그림 파일 키입니다.
   (파일 경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고.
    파일을 넣으면 .has-asset 이 붙어 도형이 꺼지고 <img> 가 대신 보입니다)
   slot 은 그릇 안에서 놓이는 자리 이름입니다. */
const ONE_SHOT_PIECES=Object.freeze({
  tofu:{label:"썬 두부",art:"tofuSlices",asset:"osTofuSlices",slot:"plate-left"},
  friedKimchi:{label:"볶은 김치",art:"friedKimchi",asset:"osFriedKimchi",slot:"plate-right"},
  radish:{label:"썬 무",art:"radish",asset:"osRadish",slot:"pot-a"},
  fishCake:{label:"썬 어묵",art:"fishCake",asset:"osFishCake",slot:"pot-b"},
  anchovy:{label:"손질한 멸치",art:"anchovy",asset:"osAnchovy",slot:"pot-c"},
  broth:{label:"육수",art:"broth",asset:"osBroth",slot:"fill"}
});

// 그릇. asset 은 빈 그릇, doneAsset 은 오른쪽 '참고 모양'에 쓰는 완성 그림입니다.
const ONE_SHOT_VESSELS=Object.freeze({
  plate:{kind:"plate",label:"접시",action:"담기",asset:"osPlate",doneAsset:"osPlateDone"},
  pot:{kind:"pot",label:"냄비",action:"넣기",asset:"osPot",doneAsset:"osPotDone"}
});

const ONE_SHOT_VARIANTS=Object.freeze({
  place:Object.freeze({finishDelay:820}),
  drop:Object.freeze({finishDelay:680}),
  pour:Object.freeze({pourDuration:900,returnDuration:380,finishDelay:480})
});

// 도형 하나를 몇 조각(<b>)으로 그리는지. CSS 가 nth-child 로 자리를 잡습니다.
const ONE_SHOT_ART_PARTS=Object.freeze({tofuSlices:5,friedKimchi:4,radish:3,fishCake:2,anchovy:3,broth:1});

/* ---- 공용 화면 틀 ------------------------------------------ */

// 지금 화면이 단발 액션인지 확인하고 데이터를 꺼냅니다. 아니면 null.
function oneShotData(m=state.mini){
  return m&&m.data&&m.data.oneShot?m.data:null;
}

function oneShotPiece(data,id){
  return data.pieces[id]||null;
}

/* 단발 액션 게임 하나를 시작합니다.
     pieces   재료 정의 묶음 (id → ONE_SHOT_PIECES 항목)
     items    왼쪽 카드로 내보낼 재료 id 목록 (= 옮겨야 하는 것)
     preset   이미 그릇에 들어 있는 재료 id 목록 (냄비의 손질 끝난 재료 등)
     vessel   ONE_SHOT_VESSELS 항목
     mode     낮 준비 엔진 이름. 밤 조리는 비워 둡니다.
     onDone   전부 옮겼을 때 부를 마무리 함수 */
function startOneShot(config){
  const m=state.mini;if(!m)return null;
  clearOneShotPointer();
  const data={oneShot:true,pieces:ONE_SHOT_PIECES,items:[],preset:[],placed:[],selected:null,finishing:false,variant:"place",actionPhase:"idle",activeItem:null,doneCalled:false,...config};
  if(data.mode)setDayPrepData(data);   // 낮 준비는 엔진 이름도 함께 바뀝니다
  else m.data=data;
  if(config.title)dom.miniTitle.textContent=config.title;
  if(config.description)dom.miniDescription.textContent=config.description;
  renderOneShot();
  return m;
}

function renderOneShot(){
  const data=oneShotData();if(!data)return;
  const done=data.placed.length>=data.items.length?1:0;
  dom.miniTimer.textContent=`${done} / 1`;   // 공용 타이머 자리는 이 게임에서 숨깁니다
  // TIP 줄 오른쪽 조작 안내 칩(공용). 글자만 넘기고 모양은 CSS 가 그립니다.
  setMiniTipHint(data.hint||"드래그 : 담기");
  dom.miniContent.innerHTML=oneShotSceneMarkup(data);
  bindOneShotEvents();
}

function oneShotSceneMarkup(data){
  const allPlaced=data.placed.length>=data.items.length;
  const visualComplete=allPlaced&&(data.variant!=="pour"||data.actionPhase==="complete");
  return `<div class="one-shot-scene">
      <aside class="os-col">
        <div class="os-panel os-ing-panel">
          <h3 class="os-col-title starred">재료</h3>
          <div class="os-ing-list">${data.items.map(id=>{
            const piece=oneShotPiece(data,id),placed=data.placed.includes(id);
            return `<button type="button" class="os-ing-card ${placed?"placed":""} ${data.selected===id?"selected":""}" data-os-item="${id}" draggable="false" ${placed||data.finishing?"disabled":""}>
              <span class="os-ing-art">${oneShotArtMarkup(piece)}</span>
              <span class="os-ing-name">${piece.label}<b>×1</b></span>
            </button>`;
          }).join("")}</div>
        </div>
      </aside>

      <div class="os-board variant-${data.variant} phase-${data.actionPhase} ${visualComplete?"complete":""}">
        <div class="os-drop ${data.selected?"armed":""}" role="button" tabindex="0" aria-label="${data.vessel.label}에 ${data.vessel.action}">
          ${oneShotVesselMarkup(data,data.placed)}
        </div>
        ${oneShotActionMarkup(data)}
        ${allPlaced?"":`<i class="os-drag-hint" aria-hidden="true"></i>`}
        ${visualComplete?`<span class="os-complete-sparks" aria-hidden="true">${"<i></i>".repeat(6)}</span>`:""}
      </div>

      <aside class="os-col">
        <div class="os-panel os-count">
          <h3 class="os-col-title">완성 개수</h3>
          <strong>${allPlaced?1:0} / 1</strong>
        </div>
        <div class="os-panel os-guide">
          <h3 class="os-col-title">참고 모양</h3>
          <div class="os-guide-figure">${oneShotVesselMarkup(data,data.items,{guide:true})}</div>
        </div>
      </aside>
    </div>`;
}

// 그릇 하나. placedIds 는 그릇 안에 그릴 재료들(미리 들어 있던 것 + 이번에 옮긴 것)입니다.
function oneShotVesselMarkup(data,placedIds,{guide=false}={}){
  const vessel=data.vessel;
  const assetKey=guide&&hasDayPrepAsset(vessel.doneAsset)?vessel.doneAsset:vessel.asset;
  const hasAsset=hasDayPrepAsset(assetKey);
  // 완성 그림 한 장으로 대체되는 참고 모양에는 재료를 따로 얹지 않습니다.
  const showFood=!(guide&&hasAsset&&assetKey===vessel.doneAsset);
  const inside=data.preset.concat(placedIds);
  const food=!showFood?"":inside.map(id=>{
    const piece=oneShotPiece(data,id);if(!piece)return "";
    const justAdded=!guide&&data.placed.includes(id)&&id===data.placed[data.placed.length-1];
    return `<span class="os-food slot-${piece.slot} ${justAdded?"just-added":""}">${oneShotArtMarkup(piece)}</span>`;
  }).join("");
  const receiving=!guide&&data.variant==="pour"&&data.actionPhase==="pouring";
  return `<div class="os-vessel ${vessel.kind} ${hasAsset?"has-asset":""} ${guide?"guide":""} ${inside.includes("broth")?"filled":""} ${receiving?"receiving":""}">
      ${hasAsset?dayPrepAssetMarkup(assetKey,"os-vessel-asset",vessel.label):`<i class="os-vessel-shape"></i>`}
      <span class="os-vessel-food">${food}</span>
    </div>`;
}

function oneShotActionMarkup(data){
  if(data.variant!=="pour"||!data.activeItem||!["pouring","returning"].includes(data.actionPhase))return "";
  const piece=oneShotPiece(data,data.activeItem);
  return `<span class="os-pour-action ${data.actionPhase}" aria-hidden="true"><span class="os-pour-jug">${oneShotArtMarkup(piece)}</span><i class="os-pour-stream"></i></span>`;
}

// 재료 그림 한 덩이. 에셋이 있으면 <img>, 없으면 CSS 임시 도형(<b> 여러 개)입니다.
function oneShotArtMarkup(piece){
  if(!piece)return "";
  const hasAsset=hasDayPrepAsset(piece.asset);
  const parts=Array.from({length:ONE_SHOT_ART_PARTS[piece.art]||1},()=>"<b></b>").join("");
  return `<span class="os-art ${piece.art} ${hasAsset?"has-asset":""}">${hasAsset?dayPrepAssetMarkup(piece.asset,"os-art-asset",piece.label):parts}</span>`;
}

/* ---- 조작 : Pointer Events 드래그 · 클릭 · Space ------------ */

let oneShotPointer=null;
let suppressOneShotClick=false;

function clearOneShotPointer(){
  oneShotPointer?.ghost?.remove();oneShotPointer=null;
  document.querySelectorAll(".os-drop.drop-hover").forEach(drop=>drop.classList.remove("drop-hover"));
}

function oneShotDropAt(x,y){return document.elementFromPoint(x,y)?.closest(".os-drop")||null;}

function moveOneShotPointer(event){
  const drag=oneShotPointer;if(!drag||drag.pointerId!==event.pointerId)return;
  const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
  if(!drag.dragging&&Math.hypot(dx,dy)>=5){
    drag.dragging=true;drag.card.classList.add("dragging");
    drag.ghost=document.createElement("span");drag.ghost.className=`os-drag-ghost item-${drag.id}`;
    drag.ghost.innerHTML=drag.card.querySelector(".os-ing-art")?.innerHTML||"";
    document.body.appendChild(drag.ghost);
  }
  if(!drag.dragging)return;
  event.preventDefault();drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;
  document.querySelectorAll(".os-drop.drop-hover").forEach(drop=>drop.classList.remove("drop-hover"));
  oneShotDropAt(event.clientX,event.clientY)?.classList.add("drop-hover");
}

function returnOneShotGhost(drag){
  if(!drag.ghost)return;
  const data=oneShotData();if(data?.selected===drag.id)data.selected=null;
  drag.card.classList.remove("selected");dom.miniContent.querySelector(".os-drop")?.classList.remove("armed");
  const rect=drag.card.getBoundingClientRect();
  drag.ghost.classList.add("returning");drag.ghost.style.left=`${rect.left+rect.width/2}px`;drag.ghost.style.top=`${rect.top+rect.height/2}px`;
  setTimeout(()=>drag.ghost?.remove(),240);
}

function finishOneShotPointer(event,cancelled=false){
  const drag=oneShotPointer;if(!drag||drag.pointerId!==event.pointerId)return;
  oneShotPointer=null;drag.card.classList.remove("dragging");
  document.querySelectorAll(".os-drop.drop-hover").forEach(drop=>drop.classList.remove("drop-hover"));
  if(!drag.dragging)return;
  suppressOneShotClick=true;setTimeout(()=>{suppressOneShotClick=false;},0);
  const drop=cancelled?null:oneShotDropAt(event.clientX,event.clientY);
  if(drop){drag.ghost?.remove();placeOneShotItem(drag.id);}
  else returnOneShotGhost(drag);
}

function bindOneShotEvents(){
  const scene=dom.miniContent.querySelector(".one-shot-scene");if(!scene)return;
  scene.querySelectorAll("[data-os-item]").forEach(card=>{
    const id=card.dataset.osItem;
    card.addEventListener("pointerdown",event=>{
      if(oneShotPointer||card.disabled||event.pointerType==="mouse"&&event.button!==0)return;
      event.preventDefault();selectOneShotItem(id);
      oneShotPointer={pointerId:event.pointerId,id,card,startX:event.clientX,startY:event.clientY,dragging:false,ghost:null};
      card.setPointerCapture?.(event.pointerId);
    });
    card.addEventListener("pointermove",moveOneShotPointer);
    card.addEventListener("pointerup",event=>finishOneShotPointer(event));
    card.addEventListener("pointercancel",event=>finishOneShotPointer(event,true));
    card.addEventListener("lostpointercapture",event=>finishOneShotPointer(event,true));
    card.addEventListener("click",event=>{if(suppressOneShotClick){event.preventDefault();return;}selectOneShotItem(id);});
    card.addEventListener("dragstart",event=>event.preventDefault());
  });

  const drop=scene.querySelector(".os-drop");if(!drop)return;
  // 집어 든 재료를 클릭/엔터로 놓기
  drop.addEventListener("click",()=>placeOneShotItem(oneShotData()?.selected));
  drop.addEventListener("keydown",event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    event.preventDefault();placeOneShotItem(oneShotData()?.selected);
  });
}

// 재료 집기. 다시 그리지 않고 선택 표시만 바꿉니다.
function selectOneShotItem(id){
  const m=state.mini,data=oneShotData(m);
  if(!data||m.complete||data.finishing||data.placed.includes(id))return;
  data.selected=id;
  dom.miniContent.querySelectorAll("[data-os-item]").forEach(card=>card.classList.toggle("selected",card.dataset.osItem===id));
  dom.miniContent.querySelector(".os-drop")?.classList.add("armed");
  dom.miniFeedback.textContent=`${oneShotPiece(data,id).label}을(를) 집었습니다. ${data.vessel.label}에 놓으세요.`;
}

// Space / ACTION 버튼 : 아직 안 옮긴 첫 재료를 바로 옮깁니다.
function nextOneShotItemId(data){
  return data.items.find(id=>!data.placed.includes(id))||null;
}

function placeOneShotItem(id){
  const m=state.mini,data=oneShotData(m);
  if(!data||m.complete||data.finishing)return;
  if(!id){dom.miniFeedback.textContent=`왼쪽 재료를 ${data.vessel.label}로 끌어다 놓으세요.`;return;}
  const piece=oneShotPiece(data,id);
  if(!piece||!data.items.includes(id)||data.placed.includes(id))return;

  if(data.variant==="pour")return startOneShotPour(m,data,id,piece);

  data.placed.push(id);data.selected=null;audio.click();
  const allPlaced=data.placed.length>=data.items.length;
  if(allPlaced){data.finishing=true;data.actionPhase="complete";}
  dom.miniFeedback.textContent=`${piece.label} ${data.vessel.action} 완료`;
  renderOneShot();
  if(!allPlaced)return;
  if(data.doneMessage)dom.miniFeedback.textContent=data.doneMessage;
  finishOneShotAfter(m,data,ONE_SHOT_VARIANTS[data.variant]?.finishDelay||680);
}

function startOneShotPour(m,data,id,piece){
  const timing=ONE_SHOT_VARIANTS.pour;
  data.selected=null;data.finishing=true;data.activeItem=id;data.actionPhase="pouring";
  dom.miniFeedback.textContent=`${piece.label}을(를) 붓는 중...`;audio.click();renderOneShot();
  setTimeout(()=>settleOneShotPour(m,data,id),timing.pourDuration);
}

function settleOneShotPour(m,data,id){
  if(state.mini!==m||m.complete||data.actionPhase!=="pouring")return;
  if(!data.placed.includes(id))data.placed.push(id);
  data.actionPhase="returning";
  dom.miniFeedback.textContent=data.doneMessage||"육수가 냄비를 채웁니다.";renderOneShot();
  setTimeout(()=>completeOneShotPour(m,data),ONE_SHOT_VARIANTS.pour.returnDuration);
}

function completeOneShotPour(m,data){
  if(state.mini!==m||m.complete||data.actionPhase!=="returning")return;
  data.actionPhase="complete";renderOneShot();
  finishOneShotAfter(m,data,ONE_SHOT_VARIANTS.pour.finishDelay);
}

function finishOneShotAfter(m,data,delay){
  setTimeout(()=>{
    if(state.mini!==m||m.complete||data.doneCalled)return;
    data.doneCalled=true;data.onDone?.(m);
  },delay);
}

/* ============================================================
   1. 두부김치 플레이팅 (밤 조리)

   썬 두부와 볶은 김치를 접시에 옮기면 끝나는 연출용 게임이라
   실패가 없습니다. 제한시간도 세지 않습니다(timerRuns:false).
   ============================================================ */

registerMiniEngine("plateKimchi",{
  timerRuns(){return false;},
  setup(m,{set}){
    // 제목·설명은 set 이 채웁니다("특별 조리" 접두어가 붙을 수 있어서입니다)
    set("두부김치 플레이팅","두부와 볶은 김치를 접시에 예쁘게 담아주세요!",8);
    startOneShot({
      variant:"place",
      hint:"드래그 : 플레이팅",
      vessel:ONE_SHOT_VESSELS.plate,
      items:["tofu","friedKimchi"],
      doneMessage:"두부김치 플레이팅 완성!",
      onDone:()=>finishMini(100)
    });
  },
  action(m){const data=oneShotData(m);if(data)placeOneShotItem(nextOneShotItemId(data));}
});

/* ============================================================
   2. 어묵탕 재료를 냄비에 넣기 (낮 준비)

   무·어묵·멸치 손질이 끝나면 각각 이 화면으로 넘어옵니다.
   이미 손질을 마친 재료는 냄비 안에 함께 그려집니다.

   [들어오는 길] 시작 함수(registerDayPrepSetup)가 없습니다.
     · engine-e1-timing-cut.js   무·어묵 썰기 완료 시
     · engine-e10-target-click.js 멸치 손질 완료 시
   ============================================================ */

registerDayPrepEngine("potDrop",{
  action(m){const data=oneShotData(m);if(data)placeOneShotItem(nextOneShotItemId(data));}
});

function showOdenIngredientDrop(taskId,ingredient,message){
  // 이번에 넣을 재료를 뺀 나머지 = 이미 냄비에 들어가 있는 재료
  const preset=["radish","fishCake","anchovy"].filter(item=>item!==ingredient&&(
    item==="radish"&&state.prepProgress.cutRadish||
    item==="fishCake"&&state.prepProgress.cutFishCake||
    item==="anchovy"&&state.prepProgress.cleanAnchovy
  ));
  const label=ONE_SHOT_PIECES[ingredient]?.label||"재료";
  const shortLabel={radish:"무",fishCake:"어묵",anchovy:"멸치"}[ingredient]||label;
  startOneShot({
    mode:"potDrop",taskId,
    variant:"drop",
    title:"어묵탕 · 냄비에 넣기",
    description:`손질을 마친 ${shortLabel}를 육수 냄비에 넣어주세요!`,
    hint:"드래그 : 냄비에 넣기",
    vessel:ONE_SHOT_VESSELS.pot,
    items:[ingredient],
    preset,
    doneMessage:`${label} 넣기 완료`,
    onDone:()=>finishDayPrepTask(taskId,message)
  });
}

/* ============================================================
   3. 육수 넣기 (낮 준비 · 어묵탕 마지막 단계)

   무 · 어묵 · 멸치를 모두 넣은 냄비에 육수를 붓습니다.
   재료를 넣는 연출(위 potDrop)과 같은 냄비 그림을 씁니다.
   ============================================================ */

registerDayPrepSetup("odenBroth",taskId=>setupOdenBroth(taskId));

registerDayPrepEngine("brothPour",{
  action(m){const data=oneShotData(m);if(data)placeOneShotItem(nextOneShotItemId(data));}
});

function setupOdenBroth(taskId){
  startOneShot({
    mode:"brothPour",taskId,
    variant:"pour",
    title:"어묵탕 · 육수 넣기",
    description:"재료가 모두 들어갔습니다. 육수를 냄비에 부어주세요!",
    hint:"드래그 : 육수 붓기",
    vessel:ONE_SHOT_VESSELS.pot,
    items:["broth"],
    preset:["radish","fishCake","anchovy"],
    doneMessage:"육수가 냄비를 채웁니다.",
    onDone:()=>finishDayPrepTask(taskId,"어묵탕 육수 넣기 완료")
  });
}
