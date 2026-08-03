"use strict";

/* ============================================================
   E11 단발 액션 — 게임 1개

     두부김치 플레이팅 (밤 조리)   썬 두부 6 + 볶은 김치 5 → 접시

   "재료를 그릇에 옮기면 끝" 인 단발 액션입니다.
   실패도 제한시간도 없습니다.
   (불리기 두 게임이 renderTteokSoak 하나를 나눠 쓰는 것과 같은 방식으로,
    앞으로 단발 액션 게임이 늘어나면 여기에 정의만 추가하면 됩니다.)

   공통 포인터 컨트롤러는 마우스와 터치를 함께 처리하고, 마무리 연출은
   place(플레이팅) / drop(그릇에 투입) / pour(붓기) / free(자유 플레이팅)로
   나뉩니다.

   [자유 플레이팅 free]  두부김치가 쓰는 방식입니다.
     재료 카드를 끌면 **한 조각씩** 딸려 나오고, 접시 안이라면 놓은 그 자리에
     그대로 얹힙니다(정해진 자리가 없습니다). 카드에는 남은 개수가 표시되고
     0 이 되면 꺼집니다. 정해진 개수를 다 얹으면 완성입니다.
     · 접시 밖으로 놓으면 접시 가장자리 안쪽으로 당겨 붙습니다.
     · 조각 그림·크기는 pieceArt / pieceAsset / pieceWidth 로 정합니다.

   [♻️ 지금 쓰는 곳이 없는 것] drop · pour 연출
     어묵탕의 "냄비에 넣기" 3개와 "육수 넣기" 를 없애면서 부르는 곳이
     사라졌습니다. 다음 단발 액션 게임이 그대로 쓸 수 있게 연출 코드만
     남기고, 냄비·재료 정의와 그림은 아래에서 함께 지웠습니다.

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
   slot 은 그릇 안에서 놓이는 자리 이름입니다(정해진 자리에 놓는 방식 전용).

   자유 플레이팅(free)은 slot 대신 아래 셋을 씁니다.
     pieceArt    한 조각짜리 CSS 임시 도형 이름
     pieceAsset  한 조각짜리 그림 파일 키 (없으면 도형으로 그립니다)
     pieceWidth  접시 가로폭 대비 조각 크기(%)
     pieceTilt   눕히는 각도를 하나로 못박습니다. 안 적으면 놓을 때마다
                 FREE_PLATE_TILTS 를 돌려 써서 각도가 조금씩 달라집니다. */
const ONE_SHOT_PIECES=Object.freeze({
  /* pieceWidth 는 '참고 모양' 그림에서 두부 한 조각이 접시 가로의 21% 인 것을
     그대로 옮긴 값입니다. 김치는 낱개 그림이 한 조각이 아니라 서너 가닥 뭉치라
     한 단계 큽니다. 둘을 키우면 11조각이 접시를 넘칩니다.

     ⚠️ 두부는 pieceTilt:0 으로 각도를 고정합니다. 납품 그림이 비스듬히 내려다본
        입체 덩이라, 돌리면 그림 안의 원근(윗면이 보이는 방향)과 어긋나 조각마다
        다른 방향에서 본 두부처럼 보입니다. 김치는 뭉쳐 놓은 가닥이라 돌려도
        그런 어긋남이 없어 그대로 둡니다. */
  tofu:{label:"썬 두부",art:"tofuSlices",asset:"osTofuSlices",slot:"plate-left",
        pieceArt:"tofuPiece",pieceAsset:"osTofuPiece",pieceWidth:21,pieceTilt:0},
  friedKimchi:{label:"볶은 김치",art:"friedKimchi",asset:"osFriedKimchi",slot:"plate-right",
        pieceArt:"kimchiPiece",pieceAsset:"osKimchiPiece",pieceWidth:22}
});

// 그릇. asset 은 빈 그릇, doneAsset 은 오른쪽 '참고 모양'에 쓰는 완성 그림입니다.
const ONE_SHOT_VESSELS=Object.freeze({
  plate:{kind:"plate",label:"접시",action:"담기",asset:"osPlate",doneAsset:"osPlateDone"}
});

const ONE_SHOT_VARIANTS=Object.freeze({
  place:Object.freeze({finishDelay:820}),
  drop:Object.freeze({finishDelay:680}),
  pour:Object.freeze({pourDuration:900,returnDuration:380,finishDelay:480}),
  free:Object.freeze({finishDelay:900})
});

// 도형 하나를 몇 조각(<b>)으로 그리는지. CSS 가 nth-child 로 자리를 잡습니다.
const ONE_SHOT_ART_PARTS=Object.freeze({tofuSlices:5,friedKimchi:4,tofuPiece:1,kimchiPiece:1});

/* ---- 자유 플레이팅 좌표 규격 --------------------------------
   x · y 는 접시 칸(.os-drop) 왼쪽 위를 0, 오른쪽 아래를 100 으로 본 값입니다.
   접시는 칸을 꽉 채우는 타원이라 반지름은 50 인데, 조각이 접시 밖으로
   삐져나오지 않게 아래 반지름 안쪽으로만 놓이게 잡아 둡니다.
   (대각선 자리가 가장 빠듯해서 36 · 34 로 잡았습니다 — 더 키우면 접시
    귀퉁이에 놓은 조각이 접시 밖으로 삐져나옵니다) */
const FREE_PLATE_RADIUS=Object.freeze({x:36,y:34});

// 조각이 눕는 각도. 놓은 순서대로 돌려 쓰기만 하고 난수는 쓰지 않습니다
// (다시 그려도 각도가 바뀌지 않아야 합니다).
const FREE_PLATE_TILTS=Object.freeze([-14,9,-5,17,-11,4,13,-8,6,-17,11]);

/* 마우스 없이(스페이스·ACTION 버튼) 놓을 때 쓰는 기본 자리이자,
   오른쪽 '참고 모양' 칸에 그리는 예시 담음새입니다.
   두부는 접시 가장자리를 따라, 김치는 가운데로 모읍니다. */
const FREE_PLATE_SAMPLE=Object.freeze([
  // 두부 여섯 자리의 rot 이 전부 0 인 것은 pieceTilt:0 과 맞춘 것입니다
  {id:"tofu",x:24,y:30,rot:0},{id:"tofu",x:16,y:50,rot:0},{id:"tofu",x:25,y:71,rot:0},
  {id:"tofu",x:76,y:30,rot:0},{id:"tofu",x:84,y:51,rot:0},{id:"tofu",x:75,y:71,rot:0},
  {id:"friedKimchi",x:44,y:35,rot:-10},{id:"friedKimchi",x:58,y:38,rot:8},
  {id:"friedKimchi",x:50,y:52,rot:-4},{id:"friedKimchi",x:41,y:66,rot:14},
  {id:"friedKimchi",x:60,y:65,rot:-9}
]);

/* ---- 공용 화면 틀 ------------------------------------------ */

// 지금 화면이 단발 액션인지 확인하고 데이터를 꺼냅니다. 아니면 null.
function oneShotData(m=state.mini){
  return m&&m.data&&m.data.oneShot?m.data:null;
}

function oneShotPiece(data,id){
  return data.pieces[id]||null;
}

/* ---- 개수 세기 ---------------------------------------------
   정해진 자리에 놓는 방식은 "재료 종류 수 = 놓을 개수" 이고,
   자유 플레이팅은 stock(종류별 개수)의 합이 놓을 개수입니다. */
function oneShotTotal(data){
  return data.free?Object.values(data.stock).reduce((sum,count)=>sum+count,0):data.items.length;
}

function oneShotDoneCount(data){
  return data.free?data.placements.length:data.placed.length;
}

// 자유 플레이팅에서 아직 접시에 올리지 않은 개수
function oneShotLeft(data,id){
  return (data.stock[id]||0)-data.placements.filter(spot=>spot.id===id).length;
}

function oneShotAllPlaced(data){
  return oneShotDoneCount(data)>=oneShotTotal(data);
}

/* 단발 액션 게임 하나를 시작합니다.
     pieces   재료 정의 묶음 (id → ONE_SHOT_PIECES 항목)
     items    왼쪽 카드로 내보낼 재료 id 목록 (= 옮겨야 하는 것)
     preset   이미 그릇에 들어 있는 재료 id 목록 (냄비의 손질 끝난 재료 등)
     vessel   ONE_SHOT_VESSELS 항목
     mode     낮 준비 엔진 이름. 밤 조리는 비워 둡니다.
     onDone   전부 옮겼을 때 부를 마무리 함수

     free     true 면 자유 플레이팅입니다(아래 stock 과 함께 씁니다)
     stock    자유 플레이팅에서 종류별로 놓을 개수 {재료id:개수}.
              items 를 따로 주지 않으면 이 순서대로 카드를 만듭니다. */
function startOneShot(config){
  const m=state.mini;if(!m)return null;
  clearOneShotPointer();
  const data={oneShot:true,pieces:ONE_SHOT_PIECES,items:[],preset:[],placed:[],placements:[],stock:{},free:false,selected:null,finishing:false,variant:"place",actionPhase:"idle",activeItem:null,doneCalled:false,...config};
  if(data.free&&!config.items)data.items=Object.keys(data.stock);
  if(data.mode)setDayPrepData(data);   // 낮 준비는 엔진 이름도 함께 바뀝니다
  else m.data=data;
  if(config.title)dom.miniTitle.textContent=config.title;
  if(config.description)dom.miniDescription.textContent=config.description;
  renderOneShot();
  return m;
}

function renderOneShot(){
  const data=oneShotData();if(!data)return;
  const total=oneShotTotal(data);
  const done=data.free?oneShotDoneCount(data):(oneShotAllPlaced(data)?1:0);
  dom.miniTimer.textContent=`${done} / ${data.free?total:1}`;   // 공용 타이머 자리는 이 게임에서 숨깁니다
  // TIP 줄 오른쪽 조작 안내 칩(공용). 글자만 넘기고 모양은 CSS 가 그립니다.
  setMiniTipHint(data.hint||"드래그 : 담기");
  dom.miniContent.innerHTML=oneShotSceneMarkup(data);
  bindOneShotEvents();
}

function oneShotSceneMarkup(data){
  const allPlaced=oneShotAllPlaced(data);
  const visualComplete=allPlaced&&(data.variant!=="pour"||data.actionPhase==="complete");
  // 자유 플레이팅은 놓은 조각 수를, 나머지는 "그릇 1개 완성" 을 셉니다.
  const total=oneShotTotal(data);
  const countText=data.free?`${oneShotDoneCount(data)} / ${total}`:`${allPlaced?1:0} / 1`;
  // 화살표 힌트는 한 조각이라도 놓으면 사라집니다(자유 플레이팅은 계속 놓기 때문입니다).
  const showHint=data.free?oneShotDoneCount(data)===0:!allPlaced;
  return `<div class="one-shot-scene">
      <aside class="os-col">
        <div class="os-panel os-ing-panel">
          <h3 class="os-col-title starred">재료</h3>
          <div class="os-ing-list">${data.items.map(id=>{
            const piece=oneShotPiece(data,id);
            const left=data.free?oneShotLeft(data,id):(data.placed.includes(id)?0:1);
            return `<button type="button" class="os-ing-card ${left?"":"placed"} ${data.selected===id?"selected":""}" data-os-item="${id}" draggable="false" ${!left||data.finishing?"disabled":""}>
              <span class="os-ing-art">${oneShotArtMarkup(piece)}</span>
              <span class="os-ing-name">${piece.label}<b>×${data.free?left:1}</b></span>
            </button>`;
          }).join("")}</div>
        </div>
      </aside>

      <div class="os-board variant-${data.variant} phase-${data.actionPhase} ${visualComplete?"complete":""}">
        <div class="os-drop ${data.selected?"armed":""}" role="button" tabindex="0" aria-label="${data.vessel.label}에 ${data.vessel.action}">
          ${oneShotVesselMarkup(data,data.placed)}
        </div>
        ${oneShotActionMarkup(data)}
        ${showHint?`<i class="os-drag-hint" aria-hidden="true"></i>`:""}
        ${visualComplete?`<span class="os-complete-sparks" aria-hidden="true">${"<i></i>".repeat(6)}</span>`:""}
      </div>

      <aside class="os-col">
        <div class="os-panel os-count">
          <h3 class="os-col-title">${data.free?"담은 개수":"완성 개수"}</h3>
          <strong>${countText}</strong>
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
  if(data.free)return oneShotFreeVesselMarkup(data,{vessel,assetKey,hasAsset,showFood,guide});
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

/* 자유 플레이팅 접시. 놓은 자리(placements)를 그대로 좌표로 씁니다.
   참고 모양 칸에는 예시 담음새(FREE_PLATE_SAMPLE)를 그립니다. */
function oneShotFreeVesselMarkup(data,{vessel,assetKey,hasAsset,showFood,guide}){
  const spots=guide?FREE_PLATE_SAMPLE:data.placements;
  const last=data.placements.length-1;
  const food=!showFood?"":spots.map((spot,index)=>{
    const piece=oneShotPiece(data,spot.id);if(!piece)return "";
    const justAdded=!guide&&index===last;
    return `<span class="os-food free ${justAdded?"just-added":""}" style="--x:${spot.x}%;--y:${spot.y}%;--w:${piece.pieceWidth}%;--rot:${spot.rot}deg;z-index:${index+2}">${oneShotPieceArtMarkup(piece)}</span>`;
  }).join("");
  return `<div class="os-vessel ${vessel.kind} free ${hasAsset?"has-asset":""} ${guide?"guide":""}">
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

// 자유 플레이팅에서 접시에 얹히는 "한 조각" 그림. 없으면 카드 그림으로 대신합니다.
function oneShotPieceArtMarkup(piece){
  if(!piece)return "";
  if(!piece.pieceArt)return oneShotArtMarkup(piece);
  const hasAsset=hasDayPrepAsset(piece.pieceAsset);
  const parts=Array.from({length:ONE_SHOT_ART_PARTS[piece.pieceArt]||1},()=>"<b></b>").join("");
  return `<span class="os-art ${piece.pieceArt} ${hasAsset?"has-asset":""}">${hasAsset?dayPrepAssetMarkup(piece.pieceAsset,"os-art-asset",piece.label):parts}</span>`;
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
    // 자유 플레이팅은 카드 그림(더미)이 아니라 딸려 나온 **한 조각**을 끌고 다닙니다.
    const data=oneShotData();
    drag.ghost=document.createElement("span");
    drag.ghost.className=`os-drag-ghost item-${drag.id} ${data?.free?"piece":""}`;
    drag.ghost.innerHTML=data?.free
      ?oneShotPieceArtMarkup(oneShotPiece(data,drag.id))
      :(drag.card.querySelector(".os-ing-art")?.innerHTML||"");
    // 끌고 다니는 크기를 접시에 놓였을 때와 같게 맞춥니다 — 놓는 순간 조각이
    // 커지거나 작아지지 않아야 "여기 놓는다" 가 눈으로 맞아떨어집니다.
    if(data?.free){
      const plateWidth=dom.miniContent.querySelector(".os-drop")?.getBoundingClientRect().width;
      const piece=oneShotPiece(data,drag.id);
      if(plateWidth&&piece)drag.ghost.style.width=`${plateWidth*piece.pieceWidth/100}px`;
    }
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
  // 자유 플레이팅은 "어디에 놓았는지" 까지 넘겨야 그 자리에 얹힙니다.
  if(drop){drag.ghost?.remove();placeOneShotItem(drag.id,{drop,clientX:event.clientX,clientY:event.clientY,drag:true});}
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
  // 집어 든 재료를 클릭/엔터로 놓기 (클릭은 누른 자리에 그대로 얹힙니다)
  drop.addEventListener("click",event=>placeOneShotItem(oneShotData()?.selected,{drop,clientX:event.clientX,clientY:event.clientY}));
  drop.addEventListener("keydown",event=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    event.preventDefault();placeOneShotItem(oneShotData()?.selected);
  });
}

/* ---- 자유 플레이팅 : 놓을 자리 정하기 ----------------------- */

/* 마우스·손가락을 뗀 자리를 접시 칸 기준 0~100 좌표로 바꿉니다.
   접시(타원) 밖이면 가장 가까운 가장자리 안쪽으로 당겨 붙입니다. */
function freePlatePoint(spot){
  const rect=spot.drop.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  let x=(spot.clientX-rect.left)/rect.width*100,y=(spot.clientY-rect.top)/rect.height*100;
  const dx=(x-50)/FREE_PLATE_RADIUS.x,dy=(y-50)/FREE_PLATE_RADIUS.y,dist=Math.hypot(dx,dy);
  if(dist>1){x=50+dx/dist*FREE_PLATE_RADIUS.x;y=50+dy/dist*FREE_PLATE_RADIUS.y;}
  return {x:Math.round(x*10)/10,y:Math.round(y*10)/10};
}

/* 좌표 없이(스페이스·ACTION 버튼) 놓을 때 쓰는 기본 자리.
   예시 담음새에서 그 재료의 아직 안 쓴 자리를 순서대로 씁니다. */
function freePlateFallbackSpot(data,id){
  const used=data.placements.filter(spot=>spot.id===id).length;
  const seats=FREE_PLATE_SAMPLE.filter(seat=>seat.id===id);
  return seats[used]||seats[seats.length-1]||{x:50,y:50,rot:0};
}

function freePlateSpotFor(data,id,spot){
  // 각도를 못박은 재료(두부)는 어디에 놓든, 어느 길로 놓든 그 각도 하나뿐입니다
  const fixed=oneShotPiece(data,id)?.pieceTilt;
  const tilt=Number.isFinite(fixed)
    ?fixed
    :FREE_PLATE_TILTS[data.placements.length%FREE_PLATE_TILTS.length];
  const point=spot?.drop?freePlatePoint(spot):null;
  if(point)return {id,x:point.x,y:point.y,rot:tilt};
  const seat=freePlateFallbackSpot(data,id);
  return {id,x:seat.x,y:seat.y,rot:Number.isFinite(fixed)?fixed:seat.rot};
}

// 재료 집기. 다시 그리지 않고 선택 표시만 바꿉니다.
function selectOneShotItem(id){
  const m=state.mini,data=oneShotData(m);
  if(!data||m.complete||data.finishing)return;
  if(data.free?oneShotLeft(data,id)<=0:data.placed.includes(id))return;
  data.selected=id;
  dom.miniContent.querySelectorAll("[data-os-item]").forEach(card=>card.classList.toggle("selected",card.dataset.osItem===id));
  dom.miniContent.querySelector(".os-drop")?.classList.add("armed");
  const piece=oneShotPiece(data,id);
  dom.miniFeedback.textContent=data.free
    ?`${piece.label} 한 조각을 집었습니다. ${data.vessel.label} 위 원하는 자리에 놓으세요.`
    :`${piece.label}을(를) 집었습니다. ${data.vessel.label}에 놓으세요.`;
}

// Space / ACTION 버튼 : 아직 안 옮긴 첫 재료를 바로 옮깁니다.
function nextOneShotItemId(data){
  if(data.free)return data.items.find(id=>oneShotLeft(data,id)>0)||null;
  return data.items.find(id=>!data.placed.includes(id))||null;
}

function placeOneShotItem(id,spot=null){
  const m=state.mini,data=oneShotData(m);
  if(!data||m.complete||data.finishing)return;
  if(!id){dom.miniFeedback.textContent=`왼쪽 재료를 ${data.vessel.label}로 끌어다 놓으세요.`;return;}
  const piece=oneShotPiece(data,id);
  if(!piece||!data.items.includes(id))return;
  if(data.free)return placeFreeOneShotPiece(m,data,id,piece,spot);
  if(data.placed.includes(id))return;

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

/* 자유 플레이팅 한 조각 얹기. 놓은 자리를 그대로 기억해 두고 다시 그립니다.
   남은 개수가 0 이면 카드가 꺼지고, 다 얹으면 완성 연출로 넘어갑니다. */
function placeFreeOneShotPiece(m,data,id,piece,spot){
  if(oneShotLeft(data,id)<=0){
    dom.miniFeedback.textContent=`${piece.label}은(는) 다 담았습니다.`;
    return;
  }
  data.placements.push(freePlateSpotFor(data,id,spot));
  // 눌러서 놓는 방식은 계속 눌러 담을 수 있게 집은 재료를 그대로 둡니다.
  // (끌어다 놓은 뒤에는 놓아 줍니다 — 접시를 잘못 눌러 얹히지 않게)
  data.selected=!spot?.drag&&oneShotLeft(data,id)>0?id:null;
  audio.click();
  const done=oneShotDoneCount(data),total=oneShotTotal(data),allPlaced=done>=total;
  if(allPlaced){data.finishing=true;data.actionPhase="complete";}
  dom.miniFeedback.textContent=allPlaced
    ?(data.doneMessage||`${data.vessel.label} 완성!`)
    :`${piece.label} 한 조각 ${data.vessel.action}  (${done} / ${total})`;
  renderOneShot();
  if(!allPlaced)return;
  finishOneShotAfter(m,data,ONE_SHOT_VARIANTS[data.variant]?.finishDelay||680);
}

function startOneShotPour(m,data,id,piece){
  const timing=ONE_SHOT_VARIANTS.pour;
  data.selected=null;data.finishing=true;data.activeItem=id;data.actionPhase="pouring";
  dom.miniFeedback.textContent=`${piece.label}을(를) 붓는 중...`;audio.play?.("pour_thin",{owner:m});renderOneShot();
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

   썬 두부 6조각 + 볶은 김치 5조각을 접시에 옮기면 끝나는 연출용
   게임이라 실패가 없습니다. 제한시간도 세지 않습니다(timerRuns:false).

   재료 카드를 끌면 조각이 하나씩 딸려 나오고, 접시 안 어디에 놓든
   그 자리에 그대로 얹힙니다. 11조각을 다 담으면 완성입니다.
   (담음새는 플레이어 마음대로라 자리에 따른 점수는 없습니다)
   ============================================================ */

const PLATE_KIMCHI_STOCK=Object.freeze({tofu:6,friedKimchi:5});

registerMiniEngine("plateKimchi",{
  timerRuns(){return false;},
  setup(m,{set}){
    // 제목·설명은 set 이 채웁니다("특별 조리" 접두어가 붙을 수 있어서입니다)
    set("두부김치 플레이팅","두부와 볶은 김치를 접시에 예쁘게 담아주세요!",8);
    startOneShot({
      variant:"free",
      free:true,
      hint:"드래그 : 한 조각씩 담기",
      vessel:ONE_SHOT_VESSELS.plate,
      stock:PLATE_KIMCHI_STOCK,
      doneMessage:"두부김치 플레이팅 완성!",
      onDone:()=>finishMini(100)
    });
  },
  action(m){const data=oneShotData(m);if(data)placeOneShotItem(nextOneShotItemId(data));}
});

