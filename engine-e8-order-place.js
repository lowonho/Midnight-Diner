"use strict";

/* ============================================================
   E8 순서 배치 (낮 준비)

   정해진 순서대로 대상을 클릭하거나 끌어다 놓는 게임 묶음입니다.

   · batterIngredients  김치전 반죽 — 밀가루 → 물 → 김치 순서로 클릭.
                        3개를 다 넣으면 곧바로 거품기(E9)로 넘어갑니다.
                        → engine-e9-whisk.js 의 setupWhiskBatter 호출
   · skewer             닭꼬치 꽂기 — 꼬치마다 닭·파를 최소 한 번씩 쓰고
                        나머지 순서는 자유롭게 5칸을 채웁니다. 총 3꼬치.
   · tteokSoak /        떡·우동면 불리기 — 재료 → 물 순서로 클릭.
     udonSoak           두 게임이 renderTteokSoak과 공통 순서 판정을 함께 씁니다.
   ============================================================ */

registerDayPrepSetup("batter",()=>setupKimchiBatter());
registerDayPrepSetup("skewer",()=>setupChickenSkewer());
registerDayPrepSetup("tteokSoak",()=>setupTteokSoak());
registerDayPrepSetup("udonSoak",()=>setupUdonSoak());

// 셋 다 포인터 클릭·드래그로 조작하므로 키 처리가 없습니다.
registerDayPrepEngine("orderPlace",{});

/* ---- E8 공통 포인터 배치 -----------------------------------
   짧게 누르면 자동 배치, 누른 채 움직이면 재료 그림이 포인터를 따라갑니다.
   브라우저 기본 drag 이벤트를 쓰지 않아 마우스와 터치가 같은 흐름을 공유합니다.

   dragOnly  짧게 누르는 자동 배치를 끕니다. 반드시 끌어다 놓아야 합니다.
             (김치전 반죽은 "볼에 붓는" 동작이라 클릭 한 번으로 들어가면
              재료가 어디로 갔는지 안 보입니다) */
function bindOrderPlacementPointers({sources,targetSelector,itemFromSource,ghostSelector,onPlace,onMiss,dragOnly=false}){
  let active=null,suppressClick=false;

  function targetAt(x,y){return document.elementFromPoint(x,y)?.closest(targetSelector)||null;}
  function clearTarget(){dom.miniContent.querySelectorAll(`${targetSelector}.order-drop-ready`).forEach(target=>target.classList.remove("order-drop-ready"));}
  function moveGhost(event){
    if(!active)return;
    const dx=event.clientX-active.startX,dy=event.clientY-active.startY;
    if(!active.dragging&&Math.hypot(dx,dy)>=5){
      active.dragging=true;active.source.classList.add("order-source-dragging");
      active.ghost=document.createElement("span");active.ghost.className=`order-drag-ghost ${active.item}`;
      const art=active.source.querySelector(ghostSelector);
      active.ghost.innerHTML=art?art.outerHTML:active.source.textContent;
      document.body.appendChild(active.ghost);
    }
    if(!active.dragging)return;
    event.preventDefault();
    active.ghost.style.left=`${event.clientX}px`;active.ghost.style.top=`${event.clientY}px`;
    clearTarget();targetAt(event.clientX,event.clientY)?.classList.add("order-drop-ready");
  }
  function finishPointer(event,cancelled=false){
    if(!active||active.pointerId!==event.pointerId)return;
    const drag=active;active=null;clearTarget();
    drag.source.classList.remove("order-source-dragging");drag.ghost?.remove();
    if(!drag.dragging)return;
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    const target=cancelled?null:targetAt(event.clientX,event.clientY);
    if(target)onPlace(drag.item,target,true,drag.source);
    else onMiss?.(drag.item,drag.source);
  }

  sources.forEach(source=>{
    source.addEventListener("pointerdown",event=>{
      if(event.pointerType==="mouse"&&event.button!==0||source.disabled)return;
      active={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,item:itemFromSource(source),source,dragging:false,ghost:null};
      source.setPointerCapture?.(event.pointerId);
    });
    source.addEventListener("pointermove",moveGhost);
    source.addEventListener("pointerup",event=>finishPointer(event));
    source.addEventListener("pointercancel",event=>finishPointer(event,true));
    source.addEventListener("lostpointercapture",event=>finishPointer(event,true));
    source.addEventListener("click",event=>{
      if(suppressClick){event.preventDefault();return;}
      if(dragOnly){onMiss?.(itemFromSource(source),source);return;}
      onPlace(itemFromSource(source),dom.miniContent.querySelector(targetSelector),false,source);
    });
    source.addEventListener("dragstart",event=>event.preventDefault());
  });
}

function pulseOrderTarget(target,className="order-place-reject"){
  if(!target)return;
  target.classList.remove(className);void target.offsetWidth;target.classList.add(className);
  setTimeout(()=>target.classList.remove(className),360);
}

/* ---- 김치전 반죽 재료 넣기 ---------------------------------
   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 3장 — 부침가루 → 물 → 김치, 넣을 차례가 깜빡입니다
     가운데 위에서 내려다본 반죽 볼
     오른쪽 완성 개수 + 참고 모양
   재료를 다 넣으면 화면 틀은 그대로 두고 가운데만 젓기(E9)로 바뀝니다.
   그래서 화면 틀은 batterSceneMarkup 한 곳에서 만들고
   engine-e9-whisk.js 도 같은 함수를 불러 씁니다.

   모양·크기는 css/day-prep-minigames.css 의 "김치전 반죽" 구역에 모여 있습니다.
   공용 프레임(css/minigame-frame.css, ui-mini-frame.js)은 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   ------------------------------------------------------------ */

// 넣는 순서 = 왼쪽 카드가 위에서 아래로 놓이는 순서입니다.
// 그림은 assets/minigame/E8/ 의 납품 에셋입니다 (day-prep-minigames.js 의 경로표 참고).
const BATTER_INGREDIENTS=Object.freeze([
  {id:"flour",label:"부침가루",asset:"batterFlour"},
  {id:"water",label:"물",asset:"batterWater"},
  {id:"kimchi",label:"김치",asset:"batterKimchi"}
]);

/* 볼 안을 그리는 그림은 **넣은 재료 조합마다 한 장**입니다.
   키는 넣은 순서 그대로 이어 붙인 것입니다. 납품 파일 이름이 순서를 담고 있어서
   (08 kimchi_flour ↔ 11 flour_kimchi — 재료는 같고 쌓인 순서만 다릅니다) 그대로 따랐습니다.
   그림이 따로 없는 순서 두 가지는 재료가 같은 그림으로 되돌립니다.
   셋 다 들어간 볼은 순서와 상관없이 한 장(batterBowlAll)입니다.

   ⚠️ 지금 게임은 부침가루 → 물 → 김치 한 순서만 받으므로 실제로 보이는 것은
      empty · flour · (flour,water) · all 네 장입니다. 나머지는 순서 규칙을
      풀거나 바꿀 때 바로 쓰이도록 미리 이어 둔 것입니다. */
const BATTER_BOWL_ASSETS=Object.freeze({
  "":"batterBowlEmpty",
  "flour":"batterBowlFlour",
  "water":"batterBowlWater",
  "kimchi":"batterBowlKimchi",
  "kimchi,flour":"batterBowlKimchiFlour",
  "flour,kimchi":"batterBowlFlourKimchi",
  "water,flour":"batterBowlWaterFlour",
  "water,kimchi":"batterBowlWaterKimchi",
  "flour,water":"batterBowlWaterFlour",     // 전용 그림 없음 — 재료가 같은 09 로
  "kimchi,water":"batterBowlWaterKimchi"    // 전용 그림 없음 — 재료가 같은 10 으로
});

function batterBowlAssetKey(added=[]){
  if(added.length>=BATTER_INGREDIENTS.length)return "batterBowlAll";
  return BATTER_BOWL_ASSETS[added.join(",")]||"batterBowlEmpty";
}

// 반죽 볼 하나. stateClass 로 담긴 양(step-0~3)이나 섞인 정도(stage-0~4)를 줍니다.
//   assetKey  볼 그림. E8은 재료 조합별 9장 중 하나를, E9는 빈 볼 한 장을 씁니다.
//             그림이 볼 안까지 그려 주므로(E8), 있을 때는 CSS 반죽 도형을 끕니다(.state-art).
function batterBowlMarkup(stateClass,{id="",extra="",assetKey="batterBowl"}={}){
  const has=hasDayPrepAsset(assetKey),stateArt=has&&assetKey!=="batterBowl";
  return `<div class="bt-bowl ${stateClass} ${has?"has-asset":""} ${stateArt?"state-art":""}"${id?` id="${id}"`:""}>
      ${dayPrepAssetMarkup(assetKey,"bt-bowl-asset","반죽 볼")}<i class="bt-batter"></i>${extra}
    </div>`;
}

/* 오른쪽 '참고 모양' 칸. E8과 E9는 목표가 달라 그림도 다릅니다.
     filled  E8 재료 넣기 — 세 가지가 다 담긴, 아직 안 섞인 볼
     mixed   E9 젓기      — 고르게 섞인 완성 반죽
   한 장으로 묶어 두면 재료를 넣는 동안 이미 섞인 반죽이 목표로 보입니다. */
const BATTER_GUIDE=Object.freeze({
  filled:{title:"참고 모양",note:"재료 3가지",alt:"재료를 다 넣은 볼"},
  mixed:{title:"참고 모양",note:"고르게 섞인 반죽",alt:"완성된 반죽"}
});

function batterGuideMarkup(kind){
  const guide=BATTER_GUIDE[kind]||BATTER_GUIDE.mixed;
  const figure=kind==="filled"
    ? batterBowlMarkup("step-3",{assetKey:"batterBowlAll"})
    : hasDayPrepAsset("batterDone")
      ? dayPrepAssetMarkup("batterDone","bt-guide-asset",guide.alt)
      : batterBowlMarkup("stage-4");
  return `<h3 class="bt-col-title">${guide.title}</h3>
          <div class="bt-guide-figure">${figure}</div>
          <p class="bt-guide-note">${guide.note}</p>`;
}

// 재료 넣기(E8)와 젓기(E9)가 함께 쓰는 화면 틀. 가운데(center)만 갈아 끼웁니다.
//   addedCount 넣은 재료 수(왼쪽 카드 표시)
//   done       완성 개수(오른쪽 카드 표시)
//   guide      오른쪽 참고 모양 종류 — "filled"(E8) / "mixed"(E9)
function batterSceneMarkup(center,addedCount,{done=0,guide="mixed"}={}){
  return `<div class="batter-prep-scene">
      <aside class="bt-col">
        <div class="bt-panel bt-ing-panel">
          <h3 class="bt-col-title starred">재료</h3>
          <div class="bt-ing-list">${BATTER_INGREDIENTS.map((item,index)=>{
            const added=index<addedCount;
            return `<button type="button" class="bt-ing-card ${item.id} ${added?"added":""} ${index===addedCount?"next":""}" data-batter-ingredient="${item.id}" ${added||addedCount>=BATTER_INGREDIENTS.length?"disabled":""}>
              <span class="bt-ing-art ${hasDayPrepAsset(item.asset)?"has-asset":""}"><i></i>${dayPrepAssetMarkup(item.asset,"bt-ing-asset",item.label)}</span>
              <span class="bt-ing-name">${item.label}<b>×1</b></span>
            </button>`;
          }).join("")}</div>
        </div>
      </aside>

      <div class="bt-board">${center}</div>

      <aside class="bt-col">
        <div class="bt-panel bt-count">
          <h3 class="bt-col-title">완성 개수</h3>
          <strong>${done} / 1</strong>
        </div>
        <div class="bt-panel bt-guide">${batterGuideMarkup(guide)}</div>
      </aside>
    </div>`;
}

// 마지막 재료를 넣은 뒤 젓기(E9)로 넘어가기 전에 볼을 보여 주는 시간.
// 이 사이가 없으면 세 가지가 다 담긴 볼(12번 그림)이 화면에 뜨자마자 지워집니다.
const BATTER_FULL_HOLD_MS=1150;

function setupKimchiBatter(){
  // holding : 재료를 다 넣고 젓기로 넘어가기 전, 담긴 볼을 보여 주는 동안만 true
  setDayPrepData({...createOrderPlacementState("batter"),ingredients:BATTER_INGREDIENTS,mistakes:0,lastPlaced:null,holding:false});
  dom.miniTitle.textContent="김치전 반죽";
  dom.miniDescription.textContent="부침가루 → 물 → 김치 순서로 재료를 볼까지 끌어다 놓아주세요!";
  renderKimchiBatterIngredients();
}

function renderKimchiBatterIngredients(){
  const data=state.mini.data,current=data.ingredients[data.step];
  // 볼 그림은 지금까지 넣은 재료 조합으로 고릅니다 (placements[0] 이 넣은 순서 그대로입니다).
  const added=data.placements[0]||[];
  dom.miniTimer.textContent=`${data.step} / ${data.ingredients.length}`;   // 공용 카드는 CSS 로 숨겨져 있습니다
  dom.miniContent.innerHTML=batterSceneMarkup(`
      <div class="bt-bowl-wrap ${data.lastPlaced?`receive-${data.lastPlaced}`:""} ${data.holding?"filled":""}" data-order-target="batter">${batterBowlMarkup(`step-${data.step}`,{assetKey:batterBowlAssetKey(added)})}</div>
      <p class="bt-progress">${current?`다음 재료 · <b>${current.label}</b>`:"재료 준비 완료! <b>이제 저어 주세요</b>"}</p>`,
    data.step,{guide:"filled"});
  bindOrderPlacementPointers({
    sources:dom.miniContent.querySelectorAll("[data-batter-ingredient]"),
    targetSelector:'[data-order-target="batter"]',
    itemFromSource:source=>source.dataset.batterIngredient,
    ghostSelector:".bt-ing-art",
    dragOnly:true,               // 클릭 자동 배치 없이 볼까지 끌어다 놓아야 합니다
    onPlace:(ingredientId,target,dragged,source)=>addBatterIngredient(ingredientId,source,target),
    onMiss:()=>{dom.miniFeedback.textContent="재료를 반죽 볼 안으로 끌어다 놓아주세요.";pulseOrderTarget(dom.miniContent.querySelector('[data-order-target="batter"]'));}
  });
}

function addBatterIngredient(ingredientId,button,target){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="batter"||m.data.holding)return;
  const expected=m.data.ingredients[m.data.step],result=placeOrderedItem(m.data,ingredientId);
  if(!result.accepted){m.data.mistakes++;dom.miniFeedback.textContent=`먼저 ${expected.label}을(를) 넣으세요.`;audio.bad();pulseOrderTarget(target);return;}
  m.data.lastPlaced=ingredientId;
  button.classList.add("pouring");button.disabled=true;
  if(ingredientId==="water")audio.play?.("pour_water",{owner:m});else audio.click();
  dom.miniFeedback.textContent=`${expected.label} 넣기 완료`;
  const filled=m.data.step>=m.data.ingredients.length;
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    // 마지막 재료까지 넣었으면 곧바로 거품기(E9)로 갈아 끼우지 않습니다.
    // 세 가지가 다 담긴 볼을 한 박자 보여 준 뒤에 넘깁니다.
    m.data.holding=filled;
    renderKimchiBatterIngredients();
    if(!filled)return;
    dom.miniFeedback.textContent="재료가 모두 들어갔습니다.";
    setTimeout(()=>{
      if(state.mini!==m||m.complete||!m.data.holding)return;
      m.data.holding=false;
      // 여기서 게임 종류가 거품기(E9)로 바뀝니다.
      setupWhiskBatter("kimchiBatter",m.data.mistakes);
    },BATTER_FULL_HOLD_MS);
  },420);
}

/* ---- 닭꼬치 꽂기 -------------------------------------------
   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   닭고기·파 재료 카드 — 수량 제한 없이 자유롭게 선택
     가운데 현재 조립 중인 큰 꼬치 하나 — 아래에서 위로 5칸
     오른쪽 완성 개수 + 닭·파 최소 한 개씩 조건
   재료 카드를 클릭하면 자동으로 꽂히고, 꼬치 끝으로 직접 끌어도 됩니다.
   한 꼬치 안의 순서는 자유지만 닭과 파가 최소 한 개씩 있어야 완성됩니다.

   모양·크기는 css/day-prep-minigames.css 의 "닭꼬치 꽂기" 구역에 모여 있습니다.
   공용 프레임(css/minigame-frame.css, ui-mini-frame.js)은 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   ------------------------------------------------------------ */

const SKEWER_SLOT_COUNT=5;
const SKEWER_EXAMPLE_ORDER=["chicken","greenOnion","chicken","greenOnion","chicken"];
const SKEWER_TOTAL=SKEWER_BATCH_SIZE;                                          // 만들 꼬치 수
const SKEWER_LABEL={chicken:"닭고기",greenOnion:"파"};
const SKEWER_INGREDIENTS=Object.freeze(Object.keys(SKEWER_LABEL));
// assets/minigame/E8/ 의 그림을 씁니다. 파일이 없으면 CSS 도형으로 되돌아갑니다.
// (경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고)
//   piece  꼬치에 꽂히는 조각 한 개      group  좌측 재료 카드에 놓는 묶음 그림
const SKEWER_ASSET_KEY={chicken:"skewerChicken",greenOnion:"skewerGreenOnion"};
const SKEWER_GROUP_ASSET_KEY={chicken:"skewerChickenGroup",greenOnion:"skewerGreenOnionGroup"};

// E8의 공통 순서 데이터. 새 게임은 순서와 트랙 수만 추가하고 같은 판정을 씁니다.
const ORDER_PLACE_CONFIG=Object.freeze({
  batter:Object.freeze({order:Object.freeze(BATTER_INGREDIENTS.map(item=>item.id)),tracks:1}),
  skewer:Object.freeze({order:Object.freeze([...SKEWER_EXAMPLE_ORDER]),tracks:SKEWER_TOTAL,freeOrder:true,required:Object.freeze([...SKEWER_INGREDIENTS])}),
  tteokSoak:Object.freeze({order:Object.freeze(["tteok","water"]),tracks:1}),
  udonSoak:Object.freeze({order:Object.freeze(["udon","water"]),tracks:1})
});

function createOrderPlacementState(configId){
  const config=ORDER_PLACE_CONFIG[configId];
  return {mode:"orderPlace",orderConfigId:configId,order:[...config.order],placements:Array.from({length:config.tracks},()=>[]),step:0};
}

function expectedOrderItem(data,trackIndex=0){
  return data.order[data.placements[trackIndex]?.length??0]??null;
}

function placeOrderedItem(data,item,trackIndex=0){
  const track=data.placements[trackIndex];
  if(!track)return {accepted:false,reason:"missingTrack",expected:null,complete:false};
  const expected=expectedOrderItem(data,trackIndex);
  if(expected!==item)return {accepted:false,reason:"wrongOrder",expected,complete:false};
  track.push(item);
  if(trackIndex===0)data.step=track.length;
  return {accepted:true,expected:null,complete:track.length>=data.order.length};
}

function allowedSkewerIngredients(stack){
  if(!stack||stack.length>=SKEWER_SLOT_COUNT)return [];
  if(stack.length===SKEWER_SLOT_COUNT-1){
    const missing=SKEWER_INGREDIENTS.find(ingredient=>!stack.includes(ingredient));
    if(missing)return [missing];
  }
  return [...SKEWER_INGREDIENTS];
}

function placeFreeSkewerItem(data,item,trackIndex=0){
  const stack=data.placements[trackIndex];
  if(!stack)return {accepted:false,reason:"missingTrack",allowed:[],complete:false};
  const allowed=allowedSkewerIngredients(stack);
  if(!allowed.includes(item))return {accepted:false,reason:stack.length>=SKEWER_SLOT_COUNT?"full":"requiredVariety",allowed,complete:false};
  stack.push(item);
  const complete=stack.length===SKEWER_SLOT_COUNT&&SKEWER_INGREDIENTS.every(ingredient=>stack.includes(ingredient));
  return {accepted:true,reason:"",allowed:allowedSkewerIngredients(stack),complete};
}

function setupChickenSkewer(){
  // holdIndex : 방금 5개를 다 꽂은 꼬치 번호. 다음 꼬치로 넘기기 전에
  //             완성된 모습을 잠깐 그대로 보여주는 동안만 값이 들어 있습니다.
  setDayPrepData({...createOrderPlacementState("skewer"),total:SKEWER_TOTAL,mistakes:0,lastPlaced:null,holdIndex:null,finishing:false,completionGrade:""});
  dom.miniTitle.textContent="닭꼬치 꽂기";
  dom.miniDescription.textContent="닭과 파를 최소 한 번씩 사용해 원하는 순서로 꼬치 3개를 만들어주세요!";
  renderChickenSkewer();
}

// 재료 한 조각. 에셋이 있으면 <img>, 없으면 CSS 도형으로 그립니다.
function skewerPieceMarkup(ingredient,extraClass=""){
  const key=SKEWER_ASSET_KEY[ingredient];
  return `<span class="sk-piece ${ingredient} ${hasDayPrepAsset(key)?"has-asset":""} ${extraClass}">${dayPrepAssetMarkup(key,"sk-piece-asset",SKEWER_LABEL[ingredient])}</span>`;
}

// 왼쪽 재료 카드의 그림 자리.
// 묶음 에셋이 있으면 그림 한 장으로 두고, 없으면 예전처럼 조각 3개를 흩뿌립니다.
// 묶음을 쓸 때도 조각 한 개(.sample)를 숨겨서 남기는 이유 :
// bindOrderPlacementPointers 가 드래그 유령을 만들 때 카드 안 첫 .sk-piece 를
// 복제해 가기 때문입니다(ghostSelector). 없으면 유령이 글자만 남습니다.
function skewerIngredientArtMarkup(ingredient){
  const groupKey=SKEWER_GROUP_ASSET_KEY[ingredient];
  if(!hasDayPrepAsset(groupKey))
    return `<span class="sk-ing-art">${skewerPieceMarkup(ingredient,"art")}${skewerPieceMarkup(ingredient,"art")}${skewerPieceMarkup(ingredient,"art")}</span>`;
  return `<span class="sk-ing-art has-group">${skewerPieceMarkup(ingredient,"sample")}${dayPrepAssetMarkup(groupKey,"sk-ing-group-asset",SKEWER_LABEL[ingredient])}</span>`;
}

// 꼬치 하나. 아래에서 위로 채우므로 화면에는 슬롯을 뒤집어 그립니다.
function skewerRackMarkup(stack,index,{active=false,lastPlaced=null}={}){
  const done=stack.length>=SKEWER_SLOT_COUNT&&SKEWER_INGREDIENTS.every(ingredient=>stack.includes(ingredient));
  const allowed=allowedSkewerIngredients(stack);
  const slots=Array.from({length:SKEWER_SLOT_COUNT},(_,slot)=>{
    if(slot<stack.length){
      const fresh=lastPlaced?.track===index&&lastPlaced.slot===slot;
      return `<span class="sk-slot filled">${skewerPieceMarkup(stack[slot],fresh?"fresh":"")}</span>`;
    }
    const forced=slot===stack.length&&allowed.length===1?`hint-${allowed[0]}`:"free";
    return `<span class="sk-slot empty ${forced} ${slot===stack.length?"next":""}"></span>`;
  }).reverse().join("");
  return `<div class="sk-rack ${active?"active":""} ${done?"done":""}" data-skewer="${index}" aria-label="${index+1}번 꼬치 · ${stack.length} / ${SKEWER_SLOT_COUNT}">
      ${skewerRodMarkup()}<div class="sk-slots">${slots}</div>
    </div>`;
}

function skewerRodMarkup(){
  return `<i class="sk-rod ${hasDayPrepAsset("skewerStick")?"has-asset":""}">${dayPrepAssetMarkup("skewerStick","sk-rod-asset")}</i>`;
}

function renderChickenSkewer(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer")return;
  const data=m.data,done=skewerDoneCount(data);
  // 완성된 꼬치를 보여주는 동안(holding)에는 그 꼬치를 계속 그리고 재료를 잠급니다.
  const holding=Number.isInteger(data.holdIndex);
  const activeIndex=holding?data.holdIndex:Math.min(done,data.total-1),activeStack=data.placements[activeIndex]||[];
  const allowed=holding?[]:allowedSkewerIngredients(activeStack);
  dom.miniTimer.textContent=`${done} / ${data.total}`;   // 공용 타이머 자리는 이 게임에서 숨깁니다
  dom.miniContent.innerHTML=`
    <div class="skewer-prep-scene">
      <aside class="sk-col">
        <div class="sk-panel sk-ing-panel">
          <h3 class="sk-col-title starred">재료</h3>
          <div class="sk-ing-list">${SKEWER_INGREDIENTS.map(ingredient=>{
            const forced=allowed.length===1&&allowed[0]===ingredient;
            const blocked=allowed.length>0&&!allowed.includes(ingredient);
            return `<button type="button" class="sk-ing-card ${ingredient} ${forced?"required":""} ${blocked?"blocked":""}" data-ingredient="${ingredient}" ${data.finishing||holding||blocked?"disabled":""}>
              ${skewerIngredientArtMarkup(ingredient)}
              <span class="sk-ing-name">${SKEWER_LABEL[ingredient]}<b>${forced?"필수":blocked?"조건 완료":"자유"}</b></span>
            </button>`;
          }).join("")}</div>
        </div>
      </aside>

      <div class="sk-board sk-single-board ${data.finishing?"complete":""} ${holding?"holding":""}">
        <div class="sk-finished-strip">${Array.from({length:data.total},(_,index)=>`<span class="${index<done?"done":index===activeIndex?"active":""}">${index<done?"✓":index+1}</span>`).join("")}</div>
        <p class="sk-active-title">${data.finishing?"꼬치 조립 완료":holding?`${activeIndex+1}번 꼬치 완성!`:`${activeIndex+1}번 꼬치 · ${activeStack.length} / ${SKEWER_SLOT_COUNT}`}</p>
        <div class="sk-active-rack" data-order-target="skewer" data-skewer="${activeIndex}">${skewerRackMarkup(activeStack,activeIndex,{active:true,lastPlaced:data.lastPlaced})}</div>
        <p class="sk-free-rule">${allowed.length===1?`마지막은 <b>${SKEWER_LABEL[allowed[0]]}</b>를 꽂아주세요`:`닭·파를 섞되<br /><b>순서는 자유!</b>`}</p>
        ${data.finishing?`<strong class="order-result ${data.completionGrade} show">${data.completionGrade==="perfect"?"PERFECT":"GOOD"}</strong>`:""}
      </div>

      <aside class="sk-col">
        <div class="sk-panel sk-count">
          <h3 class="sk-col-title">완성 개수</h3>
          <strong>${done} / ${data.total}</strong>
        </div>
        <div class="sk-panel sk-guide">
          <h3 class="sk-col-title">조립 조건</h3>
          <div class="sk-free-guide">${skewerPieceMarkup("chicken","mini")}${skewerPieceMarkup("greenOnion","mini")}<p>닭과 파<br /><b>최소 1개씩</b><br />나머지는 자유</p></div>
        </div>
      </aside>
    </div>`;
  bindChickenSkewerEvents();
}

function bindChickenSkewerEvents(){
  const scene=dom.miniContent.querySelector(".skewer-prep-scene");if(!scene)return;
  bindOrderPlacementPointers({
    sources:scene.querySelectorAll("[data-ingredient]"),
    targetSelector:'[data-order-target="skewer"]',
    itemFromSource:source=>source.dataset.ingredient,
    ghostSelector:".sk-piece",
    onPlace:(ingredient,target)=>placeSkewerPiece(Number(target.dataset.skewer),ingredient,target),
    onMiss:()=>{dom.miniFeedback.textContent="재료를 꼬치 끝에 놓아주세요.";pulseOrderTarget(scene.querySelector('[data-order-target="skewer"]'));}
  });
}

function skewerDoneCount(data){
  return data.placements.filter(stack=>stack.length>=SKEWER_SLOT_COUNT&&SKEWER_INGREDIENTS.every(ingredient=>stack.includes(ingredient))).length;
}

// 현재 큰 꼬치에 재료 한 조각을 넣습니다.
function placeSkewerPiece(skewerIndex,ingredient,target){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer"||m.data.finishing||Number.isInteger(m.data.holdIndex))return;
  const data=m.data,stack=data.placements[skewerIndex];
  if(!stack||!SKEWER_LABEL[ingredient])return;
  const activeIndex=skewerDoneCount(data);if(skewerIndex!==activeIndex)return;
  const result=placeFreeSkewerItem(data,ingredient,skewerIndex);
  if(!result.accepted){
    data.mistakes++;
    const required=result.allowed[0];
    return rejectSkewerPiece(skewerIndex,required?`이 꼬치에는 ${SKEWER_LABEL[required]}도 최소 한 개 필요합니다.`:"이 꼬치는 이미 다 찼습니다.",target);
  }

  data.lastPlaced={track:skewerIndex,slot:stack.length-1};audio.play?.("skewer_pierce",{owner:m});
  const done=skewerDoneCount(data);
  dom.miniFeedback.textContent=result.complete
    ? `꼬치 ${done} / ${data.total} 완성!`
    : `${SKEWER_LABEL[ingredient]}를 꽂았습니다.`;
  if(done>=data.total){
    data.finishing=true;data.completionGrade=data.mistakes?"good":"perfect";renderChickenSkewer();
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask("assembleChickenSkewer",`닭꼬치 ${data.total}개 꽂기 완료`);},720);
  }else if(result.complete){
    // 5개를 다 꽂았습니다. 바로 다음 꼬치로 갈아 끼우면 완성된 모습을 못 보고
    // 지나가므로, 잠깐 그대로 두었다가 넘깁니다. 그동안 재료는 잠깁니다.
    data.holdIndex=skewerIndex;renderChickenSkewer();
    setTimeout(()=>{
      if(state.mini!==m||m.complete||data.holdIndex!==skewerIndex)return;
      data.holdIndex=null;data.lastPlaced=null;renderChickenSkewer();
    },820);
  }else renderChickenSkewer();
}

// 잘못 놓았을 때: 상태는 그대로 두고 해당 꼬치만 흔듭니다.
function rejectSkewerPiece(skewerIndex,message,target){
  dom.miniFeedback.textContent=message;audio.bad();
  const rack=target||dom.miniContent.querySelector(`.sk-rack[data-skewer="${skewerIndex}"]`);
  if(!rack)return;
  rack.classList.remove("reject");void rack.offsetWidth;rack.classList.add("reject");
  setTimeout(()=>rack.classList.remove("reject"),340);
}

/* ---- 떡 · 우동면 불리기 ------------------------------------ */

function setupTteokSoak(){
  if(Number(state.day)<4||!state.mini)return;
  setDayPrepData({...createOrderPlacementState("tteokSoak"),taskId:DAY4_PREP_CONFIG.soak.taskId,menuId:"tteokbokki",ingredientKey:"tteok",ingredientLabel:"떡",added:{tteok:false,water:false},finishing:false,mistakes:0,lastAdded:null,completionGrade:""});
  dom.miniTitle.textContent="떡볶이 · 떡 불려두기";
  dom.miniDescription.textContent="떡을 볼에 넣은 뒤 물을 부어 잠시 불려주세요. 재료를 클릭하거나 볼로 끌어도 됩니다.";
  renderTteokSoak();
}

function setupUdonSoak(){
  if(Number(state.day)<3||!state.mini)return;
  setDayPrepData({...createOrderPlacementState("udonSoak"),taskId:"soakUdon",menuId:"yakisoba",ingredientKey:"udon",ingredientLabel:"우동면",added:{udon:false,water:false},finishing:false,mistakes:0,lastAdded:null,completionGrade:""});
  dom.miniTitle.textContent="볶음우동 · 우동면 불려두기";
  dom.miniDescription.textContent="우동면을 볼에 넣은 뒤 물을 부어 잠시 불려주세요. 재료를 클릭하거나 볼로 끌어도 됩니다.";
  renderTteokSoak();
}

function renderTteokSoak(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="orderPlace"||!["tteokSoak","udonSoak"].includes(m.data.orderConfigId))return;
  const data=m.data,key=data.ingredientKey,label=data.ingredientLabel,count=Object.values(data.added).filter(Boolean).length,isUdon=key==="udon";
  const ingredientAsset=isUdon?"soakUdon":"soakTteok";
  const sourceArt=(asset,kind,alt)=>`<span class="soak-source-art ${kind} ${hasDayPrepAsset(asset)?"has-asset":""}"><i></i>${dayPrepAssetMarkup(asset,"soak-source-asset",alt)}</span>`;
  const bowlPieces=data.added[key]?Array.from({length:isUdon?5:7},()=>hasDayPrepAsset(ingredientAsset)?dayPrepAssetMarkup(ingredientAsset,"soak-piece-asset",label):"<b></b>").join(""):"빈 볼";
  dom.miniTimer.textContent=`${count} / 2`;
  dom.miniContent.innerHTML=`
    <div class="tteok-soak-scene ${data.finishing?"settling":""}">
      <button type="button" class="tteok-source ${isUdon?"udon-source":""} ${data.added[key]?"added":""} ${data.lastAdded===key?"just-added":""}" data-soak-item="${key}" ${data.added[key]||data.finishing?"disabled":""}>${sourceArt(ingredientAsset,key,label)}<strong>${label}</strong></button>
      <div class="soaking-bowl ${isUdon?"udon-bowl":""} ${hasDayPrepAsset("soakBowl")?"has-asset":""} ${data.added.water?"has-water":""} ${data.added[key]?"has-ingredient":""} ${data.finishing?"settling":""}" data-order-target="soak" aria-label="${label}을 불리는 볼">${dayPrepAssetMarkup("soakBowl","soak-bowl-asset","불리기 볼")}<i class="water-fill"></i><span>${bowlPieces}</span>${data.finishing?'<i class="soak-bubbles"><b></b><b></b><b></b><b></b></i>':""}</div>
      <button type="button" class="water-source ${data.added.water?"added":""} ${data.lastAdded==="water"?"just-added":""}" data-soak-item="water" ${data.added.water||data.finishing?"disabled":""}>${sourceArt("soakWater","water","물통")}<strong>물통</strong></button>
      ${data.finishing?`<strong class="order-result soak-result ${data.completionGrade} show">${data.completionGrade==="perfect"?"PERFECT":"GOOD"}</strong>`:""}
    </div>
    <div class="cut-count">${label} ${data.added[key]?"✓":"○"} · 물 ${data.added.water?"✓":"○"}</div>`;
  bindOrderPlacementPointers({
    sources:dom.miniContent.querySelectorAll("[data-soak-item]"),
    targetSelector:'[data-order-target="soak"]',
    itemFromSource:source=>source.dataset.soakItem,
    ghostSelector:".soak-source-art",
    onPlace:(item,target)=>addTteokSoakItem(item,target),
    onMiss:()=>{dom.miniFeedback.textContent="재료를 가운데 볼 안에 놓아주세요.";pulseOrderTarget(dom.miniContent.querySelector('[data-order-target="soak"]'));}
  });
}

function addTteokSoakItem(item,target){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||!["tteokSoak","udonSoak"].includes(m.data.orderConfigId)||m.data.finishing||!Object.prototype.hasOwnProperty.call(m.data.added,item)||m.data.added[item])return;
  const data=m.data,result=placeOrderedItem(data,item);
  if(!result.accepted){data.mistakes++;dom.miniFeedback.textContent=`먼저 ${data.ingredientLabel}을 볼에 담아주세요.`;audio.bad();pulseOrderTarget(target);return;}
  data.added[item]=true;data.lastAdded=item;
  if(item==="water")audio.play?.("pour_water",{owner:m});else audio.click();
  dom.miniFeedback.textContent=item===data.ingredientKey?`${data.ingredientLabel}을 볼에 담았습니다.`:"볼에 물을 붓는 중입니다.";
  if(Object.values(m.data.added).every(Boolean)){
    data.finishing=true;data.completionGrade=data.mistakes?"good":"perfect";renderTteokSoak();dom.miniFeedback.textContent=`${data.ingredientLabel}과 물이 들어갔습니다. 잠시 불리는 중...`;
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,`${data.ingredientLabel} 불려두기 완료`);},1500);
  }else renderTteokSoak();
}
