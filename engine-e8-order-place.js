"use strict";

/* ============================================================
   E8 순서 배치 (낮 준비)

   정해진 순서대로 대상을 클릭하거나 끌어다 놓는 게임 묶음입니다.

   · batterIngredients  김치전 반죽 — 밀가루 → 물 → 김치 순서로 클릭.
                        3개를 다 넣으면 곧바로 거품기(E9)로 넘어갑니다.
                        → engine-e9-whisk.js 의 setupWhiskBatter 호출
   · skewer             닭꼬치 꽂기 — 꼬치마다 닭·파를 최소 한 번씩 쓰고
                        나머지 순서는 자유롭게 5칸을 채웁니다. 총 3꼬치.
   · tteokSoak /        떡·우동면 불리기 — 재료를 볼에 담은 뒤 옆의 물병을
     udonSoak           기울여 물을 채웁니다. 두 게임이 renderTteokSoak과
                        공통 순서 판정을 함께 씁니다.
   ============================================================ */

registerDayPrepSetup("batter",()=>setupKimchiBatter());
registerDayPrepSetup("skewer",()=>setupChickenSkewer());
registerDayPrepSetup("tteokSoak",()=>setupTteokSoak());
registerDayPrepSetup("udonSoak",()=>setupUdonSoak());

/* 반죽·꼬치는 포인터 클릭·드래그로만 조작합니다.
   불리기의 물 붓기만 키보드로도 되도록 아래 세 키를 받습니다
   (누르고 있으면 계속 부어지므로 keyup 까지 짝으로 봅니다). */
const SOAK_POUR_KEYS=Object.freeze([" ","enter","arrowdown"]);
registerDayPrepEngine("orderPlace",{
  key(m,k,e){
    if(!isSoakMini(m)||!SOAK_POUR_KEYS.includes(k))return false;
    if(!e?.repeat)startSoakPour();
    return true;                         // true 를 돌려주면 Space 기본 동작(miniAction)이 안 걸립니다
  },
  keyup(m,k){
    if(isSoakMini(m)&&SOAK_POUR_KEYS.includes(k))stopSoakPour();
  }
});

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
  button.classList.add("pouring");button.disabled=true;audio.click();
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

  data.lastPlaced={track:skewerIndex,slot:stack.length-1};audio.click();
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

/* ---- 떡 · 우동면 불리기 ------------------------------------
   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   재료 카드 2장 — 떡(우동면) · 물. 다른 준비 미니게임과 같은 틀입니다.
     가운데 볼 + 그 **옆에 놓인 물병**
     오른쪽 진행도(물이 찬 정도 %) · 목표

   [두 단계짜리 게임입니다]
     1) 재료를 볼까지 끌어다(또는 눌러) 담습니다  — E8 공통 순서 판정
     2) 물병을 기울일 때마다 물이 한 모금씩 들어가고, 오른쪽 진행도가
        100% 가 되면 재료가 잠겨 완료됩니다                — 아래 물 붓기
   1단계를 건너뛰고 물부터 부으려 하면 볼이 흔들리며 막힙니다.

   ⚠️ 예전에는 좌우에 재료 카드 두 장(.tteok-source · .water-source)을 두고
      물도 "한 번 놓으면 끝" 이었습니다. 좌우 패널을 다른 게임과 같은 3열로
      맞추면서 물만 물병 조작으로 바뀌었습니다. 순서 데이터(ORDER_PLACE_CONFIG)는
      그대로라, 물이 다 차는 순간 placeOrderedItem 으로 순서 상태도 함께 채웁니다.

   모양·크기는 css/day-prep-minigames.css 의 "떡/우동 불리기" 구역에 모여 있습니다.
   3열 격자와 패널 껍데기는 css/minigame-parts.css 공용 규격입니다.
   ------------------------------------------------------------ */

const SOAK_CONFIG_IDS=Object.freeze(["tteokSoak","udonSoak"]);
/* 물이 찬 정도를 그린 볼 그림의 눈금(%). 이 순서가 곧 겹쳐 놓는 순서입니다.
   에셋 키는 soakTteokWater00 ~ soakUdonWater100 (day-prep-minigames.js).
   ⚠️ 볼·재료·물이 **한 장에 다 그려져** 있어서, 물이 차오르는 모습은
      CSS 수위(.water-fill)가 아니라 이 장들을 갈아 끼워 만듭니다. */
const SOAK_WATER_STEPS=Object.freeze(["00","25","50","75","100"]);
/* 물병을 한 번 기울일 때 차오르는 양(%). 4번이면 가득 찹니다.
   ⚠️ 눈금(25)과 같은 값이어야 합니다. 한 모금 = 그림 한 장이라야 부을 때마다
      볼이 눈에 띄게 바뀝니다. 예전 값 20 은 다섯 모금이라 그림과 어긋났습니다. */
const SOAK_POUR_STEP=25;
// 한 모금에 걸리는 시간. 물병을 누르고 있으면 이 간격으로 이어서 부어집니다.
const SOAK_POUR_MS=520;
// 물이 다 찬 뒤 불리는 모습을 보여주는 시간
const SOAK_SETTLE_MS=1500;

function isSoakMini(m=state.mini){
  return isDayPrepMini(m)&&m.data?.mode==="orderPlace"&&SOAK_CONFIG_IDS.includes(m.data.orderConfigId);
}

// 불리기 게임 하나를 시작합니다. 떡과 우동면은 재료 이름·그림만 다릅니다.
function startSoakGame(configId,config){
  setDayPrepData({
    ...createOrderPlacementState(configId),...config,
    added:{[config.ingredientKey]:false,water:false},
    water:0,                 // 부은 물 0~100 (= 오른쪽 진행도)
    finishing:false,mistakes:0,completionGrade:""
  });
  renderTteokSoak();
}

function setupTteokSoak(){
  if(Number(state.day)<4||!state.mini)return;
  dom.miniTitle.textContent="떡볶이 · 떡 불려두기";
  dom.miniDescription.textContent="떡을 볼에 담고, 옆의 물병을 기울여 진행도가 꽉 찰 때까지 물을 부어주세요!";
  startSoakGame("tteokSoak",{taskId:DAY4_PREP_CONFIG.soak.taskId,menuId:"tteokbokki",ingredientKey:"tteok",ingredientLabel:"떡"});
}

function setupUdonSoak(){
  if(Number(state.day)<3||!state.mini)return;
  dom.miniTitle.textContent="볶음우동 · 우동면 불려두기";
  dom.miniDescription.textContent="우동면을 볼에 담고, 옆의 물병을 기울여 진행도가 꽉 찰 때까지 물을 부어주세요!";
  startSoakGame("udonSoak",{taskId:"soakUdon",menuId:"yakisoba",ingredientKey:"udon",ingredientLabel:"우동면"});
}

// 재료 카드·물병이 함께 쓰는 그림 자리. 에셋이 있으면 <img>, 없으면 CSS 도형입니다.
function soakArtMarkup(assetKey,kind,alt){
  return `<span class="soak-ing-art ${kind} ${hasDayPrepAsset(assetKey)?"has-asset":""}"><i></i>${dayPrepAssetMarkup(assetKey,"soak-art-asset",alt)}</span>`;
}

/* 물병 3자세 — 세워 둠 · 25도 · 45도. 같은 자리에 겹쳐 두고 부을 때 갈아 끼웁니다.
   ⚠️ **CSS 로 돌리지 않습니다.** 세워 둔 그림을 rotate 로 돌리면 병 안의 물 면까지
      같이 기울어 물이 한쪽 벽에 붙어 보입니다. 기울여 그린 두 장은 물 면이
      수평으로 다시 그려져 있습니다.
   ⚠️ 갈아 끼우는 순서와 시각은 전부 CSS 가 잡습니다(.soak-stage.pouring 의
      transition-delay). 자바스크립트 타이머가 없으니 중간에 미니게임이 닫혀도
      뒷정리할 것이 없습니다 — 화구(.mg-burner)와 같은 방식입니다. */
function soakPitcherFramesMarkup(){
  const upright=dayPrepAssetMarkup("soakWater","soak-pitcher-asset","물병");
  if(!hasDayPrepAsset("soakWaterTilt1")||!hasDayPrepAsset("soakWaterTilt2"))return upright;
  return upright
    +dayPrepAssetMarkup("soakWaterTilt1","soak-pitcher-asset tilt1")
    +dayPrepAssetMarkup("soakWaterTilt2","soak-pitcher-asset tilt2");
}

// 기울인 그림이 다 있는지. 없으면 예전처럼 CSS 로 돌려 씁니다(자리 값이 다릅니다).
function hasSoakTiltArt(){
  return hasDayPrepAsset("soakWaterTilt1")&&hasDayPrepAsset("soakWaterTilt2");
}

// 오른쪽 목표·진행도 칸의 물방울. 큰 것과 작은 것이 같은 그림입니다.
function soakDropMarkup(size=""){
  return hasDayPrepAsset("soakDrop")
    ? dayPrepAssetMarkup("soakDrop",`soak-drop-asset ${size}`)
    : `<i class="soak-drop ${size}" aria-hidden="true"></i>`;
}

// 지금 몇 번째 물 그림인지. 재료를 담기 전이면 -1(빈 볼만) 입니다.
// 눈금(25)이 아닌 값이 들어와도 가장 가까운 장으로 붙습니다.
function soakWaterFrame(data){
  if(!data.added[data.ingredientKey])return -1;
  return Math.max(0,Math.min(SOAK_WATER_STEPS.length-1,Math.round(data.water/25)));
}

/* 볼 그림 한 벌. 빈 볼을 맨 아래 깔고 그 위에 물 5장을 순서대로 겹칩니다.
   지금 단계까지가 `on`(불투명)이고, 맨 위 한 장만 `fresh` 로 부드럽게 나타납니다.
   ⚠️ 위 장이 아래 장을 완전히 덮으므로, 갈아 끼울 때 아래를 지우지 않습니다.
      한 장만 두고 src 를 바꾸거나 서로 흐려지게 하면 겹치는 순간 두 장 다
      반투명이 되어 볼 너머로 판 바닥이 비칩니다. */
function soakBowlFramesMarkup(data,isUdon,label){
  const prefix=isUdon?"soakUdonWater":"soakTteokWater";
  const keys=[["soakBowl","빈 볼"],...SOAK_WATER_STEPS.map(step=>[`${prefix}${step}`,`${label} · 물 ${Number(step)}%`])];
  if(!keys.every(([key])=>hasDayPrepAsset(key)))return "";
  const frame=soakWaterFrame(data);
  return keys.map(([key,alt],index)=>{
    const on=index<=frame+1;            // 0 번은 빈 볼이라 항상 켭니다
    return dayPrepAssetMarkup(key,`soak-bowl-asset${on?" on":""}${index&&index===frame+1?" fresh":""}`,alt);
  }).join("");
}

function renderTteokSoak(){
  const m=state.mini;if(!isSoakMini(m))return;
  stopSoakPour();                       // 화면을 새로 그리면 지금 잡고 있는 물병이 사라집니다
  const data=m.data,key=data.ingredientKey,label=data.ingredientLabel,isUdon=key==="udon";
  const ingredientAsset=isUdon?"soakUdon":"soakTteok";
  const placed=data.added[key],full=data.water>=100;
  // 볼 그림 한 벌이 다 있으면 그것만 씁니다. 한 장이라도 없으면 예전처럼
  // CSS 볼에 재료 조각(<b>)과 물 높이(.water-fill)를 얹습니다.
  const bowlFrames=soakBowlFramesMarkup(data,isUdon,label);
  const bowlPieces=!bowlFrames&&placed?"<b></b>".repeat(isUdon?5:7):"";
  dom.miniTimer.textContent=`${data.water}%`;   // 공용 타이머 자리는 이 게임에서 숨깁니다
  setMiniTipHint(placed?"누르기 : 물병 기울이기":"드래그 : 볼에 담기");
  dom.miniContent.innerHTML=`
    <div class="soak-scene ${data.finishing?"settling":""}">
      <aside class="soak-col">
        <div class="soak-panel soak-ing-panel">
          <h3 class="soak-col-title starred">재료</h3>
          <div class="soak-ing-list">
            <button type="button" class="soak-ing-card ${key} ${placed?"added":"next"}" data-soak-item="${key}" ${placed||data.finishing?"disabled":""}>
              ${soakArtMarkup(ingredientAsset,key,label)}
              <span class="soak-ing-name">${label}<b>×1</b></span>
            </button>
            <button type="button" class="soak-ing-card water ${full?"added":placed?"next":""}" data-soak-item="water" ${full||data.finishing?"disabled":""}>
              ${soakArtMarkup("soakWater","water","물")}
              <span class="soak-ing-name">물<b class="soak-ing-amount">${data.water}%</b></span>
            </button>
          </div>
        </div>
      </aside>

      <div class="soak-board">
        <div class="soak-stage ${placed&&!data.water?"ready":""}" style="--soak-fill:${data.water}">
          <div class="soaking-bowl ${isUdon?"udon-bowl":""} ${bowlFrames?"has-asset":""} ${placed?"has-ingredient":""} ${data.finishing?"settling":""}" data-order-target="soak" aria-label="${label}을 불리는 볼">
            ${bowlFrames||`<i class="water-fill"></i><span class="soak-bowl-food">${bowlPieces}</span>`}${data.finishing?'<i class="soak-bubbles"><b></b><b></b><b></b><b></b></i>':""}
          </div>
          <button type="button" class="soak-pitcher ${hasDayPrepAsset("soakWater")?"has-asset":""} ${hasSoakTiltArt()?"has-tilt":""}" data-soak-pour ${!placed||full||data.finishing?"disabled":""} aria-label="물병을 기울여 물 붓기">
            ${soakPitcherFramesMarkup()}<i class="soak-pitcher-shape"></i><i class="soak-pour-stream" aria-hidden="true"></i>
          </button>
        </div>
        <p class="soak-board-note">${
          data.finishing?`<b>${label}을 불리는 중...</b>`
          :!placed?`먼저 <b>${label}</b>을 볼에 담아주세요`
          :`물병을 눌러 <b>물을 부어주세요</b>`}</p>
        ${data.finishing?`<strong class="order-result soak-result ${data.completionGrade} show">${data.completionGrade==="perfect"?"PERFECT":"GOOD"}</strong>`:""}
      </div>

      <aside class="soak-col">
        <div class="soak-panel soak-count">
          <h3 class="soak-col-title">진행도</h3>
          <strong>${data.water}%</strong>
          <div class="soak-gauge">${soakDropMarkup("tiny")}<span class="soak-gauge-track"><b style="width:${data.water}%"></b></span></div>
        </div>
        <div class="soak-panel soak-guide">
          <h3 class="soak-col-title">목표</h3>
          <div class="soak-guide-figure">${soakDropMarkup()}</div>
          <p class="soak-guide-note">${label}이 잠길 정도로<br />물을 채워주세요!</p>
        </div>
      </aside>
    </div>`;
  bindSoakEvents();
}

function bindSoakEvents(){
  const scene=dom.miniContent.querySelector(".soak-scene");if(!scene)return;
  // 재료 카드는 다른 E8 게임과 같은 방식으로 볼까지 끌거나 눌러서 담습니다.
  // 물 카드도 같은 창구를 타지만, 실제로 물을 넣는 것은 물병뿐이라 안내만 띄웁니다.
  bindOrderPlacementPointers({
    sources:scene.querySelectorAll("[data-soak-item]"),
    targetSelector:'[data-order-target="soak"]',
    itemFromSource:source=>source.dataset.soakItem,
    ghostSelector:".soak-ing-art",
    onPlace:(item,target)=>addTteokSoakItem(item,target),
    onMiss:item=>{
      if(item==="water")return rejectSoakWaterCard();
      dom.miniFeedback.textContent="재료를 가운데 볼 안에 놓아주세요.";
      pulseOrderTarget(scene.querySelector('[data-order-target="soak"]'));
    }
  });

  const pitcher=scene.querySelector("[data-soak-pour]");if(!pitcher)return;
  pitcher.addEventListener("pointerdown",event=>{
    if(event.pointerType==="mouse"&&event.button!==0)return;
    event.preventDefault();
    pitcher.setPointerCapture?.(event.pointerId);
    startSoakPour();
  });
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>pitcher.addEventListener(type,()=>stopSoakPour()));
  pitcher.addEventListener("dragstart",event=>event.preventDefault());
}

// 재료를 볼에 담습니다. 물 카드를 눌렀을 때는 물병 쪽으로 안내만 합니다.
function addTteokSoakItem(item,target){
  const m=state.mini;if(!isSoakMini(m)||m.complete||m.data.finishing)return;
  const data=m.data;
  if(item==="water")return rejectSoakWaterCard();
  if(item!==data.ingredientKey||data.added[item])return;
  const result=placeOrderedItem(data,item);
  if(!result.accepted){data.mistakes++;audio.bad();pulseOrderTarget(target);return;}
  data.added[item]=true;audio.click();
  dom.miniFeedback.textContent=`${data.ingredientLabel}을 볼에 담았습니다. 이제 물병을 기울여 물을 부어주세요!`;
  renderTteokSoak();
}

// 물 카드는 "여기가 아니라 물병" 이라는 것만 알려 줍니다. 상태는 그대로입니다.
function rejectSoakWaterCard(){
  const m=state.mini;if(!isSoakMini(m))return;
  dom.miniFeedback.textContent=m.data.added[m.data.ingredientKey]
    ? "물은 볼 옆의 물병을 기울여 부어주세요."
    : `먼저 ${m.data.ingredientLabel}을 볼에 담아주세요.`;
  audio.bad();
  pulseOrderTarget(dom.miniContent.querySelector(m.data.added[m.data.ingredientKey]?".soak-pitcher":'[data-order-target="soak"]'));
}

/* ---- 물 붓기 ------------------------------------------------
   물병을 누르고 있는 동안 SOAK_POUR_MS 간격으로 한 모금씩 들어갑니다.
   짧게 누르면 한 모금입니다 — "기울일 때마다 한 번" 이 기본 단위입니다.

   ⚠️ 한 모금마다 화면을 통째로 다시 그리지 않습니다. innerHTML 을 새로 넣으면
      물병이 새 요소로 갈려서 기울인 자세와 포인터 캡처가 매번 끊깁니다.
      대신 updateSoakWater 가 바뀐 숫자·높이만 건드립니다. (E7 소스 볼과 같은 이유) */

let soakPourTimer=null;    // 누르고 있는 동안 이어 붓는 타이머
let soakTiltTimer=null;    // 기울인 자세를 되돌리는 타이머

function soakStage(){return dom.miniContent?.querySelector(".soak-stage")||null;}

function stopSoakPour(){
  if(soakPourTimer){clearInterval(soakPourTimer);soakPourTimer=null;}
}

// 기울인 자세는 한 모금 시간만큼 남깁니다. 짧게 눌렀을 때 기울이는 동작이
// 한 프레임 만에 사라지지 않게 하려는 것입니다(손을 떼도 그 모금은 끝까지 부어집니다).
function tiltSoakPitcher(){
  const stage=soakStage();if(!stage)return;
  stage.classList.add("pouring");
  if(soakTiltTimer)clearTimeout(soakTiltTimer);
  soakTiltTimer=setTimeout(()=>{soakTiltTimer=null;soakStage()?.classList.remove("pouring");},SOAK_POUR_MS);
}

function startSoakPour(){
  const m=state.mini;if(!isSoakMini(m)||m.complete||m.data.finishing)return;
  if(!m.data.added[m.data.ingredientKey]){
    dom.miniFeedback.textContent=`먼저 ${m.data.ingredientLabel}을 볼에 담아주세요.`;audio.bad();
    pulseOrderTarget(dom.miniContent.querySelector('[data-order-target="soak"]'));
    return;
  }
  if(m.data.water>=100||soakPourTimer)return;
  pourSoakWaterOnce();
  // ⚠️ 첫 모금에서 이미 다 찼으면 이어 붓기를 걸지 않습니다.
  //    (걸어 두면 renderTteokSoak 이 지운 타이머를 여기서 되살려 버립니다)
  if(m.data.water<100&&!m.data.finishing)soakPourTimer=setInterval(pourSoakWaterOnce,SOAK_POUR_MS);
}

function pourSoakWaterOnce(){
  const m=state.mini;
  // 미니게임이 닫혔거나 다 찼으면 이어 붓기를 멈춥니다(누른 채로 ESC 를 눌러도 안전).
  if(!isSoakMini(m)||m.complete||m.data.finishing||m.data.water>=100||!m.data.added[m.data.ingredientKey])return stopSoakPour();
  const data=m.data;
  data.water=Math.min(100,data.water+SOAK_POUR_STEP);
  audio.click();tiltSoakPitcher();updateSoakWater(data);
  if(data.water>=100)finishSoakWater(m);
  else dom.miniFeedback.textContent=`물을 붓는 중 · ${data.water}%`;
}

// 물이 찬 정도만 부분 갱신합니다 (볼 수위 · 진행도 숫자와 막대 · 물 카드).
function updateSoakWater(data){
  const scene=dom.miniContent?.querySelector(".soak-scene");if(!scene)return;
  const full=data.water>=100;
  const stage=scene.querySelector(".soak-stage");
  if(stage){
    stage.style.setProperty("--soak-fill",data.water);   // 에셋이 없을 때의 CSS 수위
    stage.classList.remove("ready");   // 한 모금이라도 부었으면 '눌러 달라'는 까딱임을 뗍니다
  }
  // 볼 그림을 한 장 더 켭니다. 맨 위 한 장만 fresh 로 스며들듯 나타납니다.
  const frame=soakWaterFrame(data);
  scene.querySelectorAll(".soak-bowl-asset").forEach((art,index)=>{
    art.classList.toggle("on",index<=frame+1);
    art.classList.toggle("fresh",!!index&&index===frame+1);
  });
  const value=scene.querySelector(".soak-count strong");if(value)value.textContent=`${data.water}%`;
  const bar=scene.querySelector(".soak-gauge-track b");if(bar)bar.style.width=`${data.water}%`;
  const amount=scene.querySelector(".soak-ing-amount");if(amount)amount.textContent=`${data.water}%`;
  const waterCard=scene.querySelector('[data-soak-item="water"]');
  if(waterCard){waterCard.classList.toggle("added",full);waterCard.classList.toggle("next",!full);waterCard.disabled=full;}
  /* ⚠️ 다 찼다고 여기서 물병을 잠그지 않습니다. 마지막 한 모금은 아직 부어지는
     중이라, 잠그면 :disabled 의 반투명이 **붓는 도중에** 켜집니다.
     잠그는 것은 아래 finishSoakWater 가 연출을 마치고 다시 그릴 때입니다
     (그 사이에 또 눌러도 startSoakPour 가 water>=100 에서 막습니다). */
  dom.miniTimer.textContent=`${data.water}%`;
}

// 물이 가득 찼습니다. 공통 순서 데이터에도 물 투입을 남기고 불리기 연출로 넘어갑니다.
function finishSoakWater(m){
  const data=m.data;
  stopSoakPour();
  if(data.added.water)return;
  placeOrderedItem(data,"water");
  data.added.water=true;
  data.finishing=true;data.completionGrade=data.mistakes?"good":"perfect";
  dom.miniFeedback.textContent=`${data.ingredientLabel}이 물에 잠겼습니다. 잠시 불리는 중...`;
  /* ⚠️ 화면을 여기서 바로 다시 그리면 **마지막 한 모금이 통째로 안 보입니다.**
     방금 붙인 기울인 자세와 물줄기가 새 DOM 으로 갈려 그 자리에서 사라집니다
     (예전에 "마지막 클릭에서 병이 안 기울어" 보이던 것이 이것입니다).
     그 모금이 끝나기를 기다렸다가 불리는 연출로 넘어갑니다. */
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    renderTteokSoak();      // 여기서 물병이 세워지고 잠깁니다
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(data.taskId,`${data.ingredientLabel} 불려두기 완료`);},SOAK_SETTLE_MS);
  },SOAK_POUR_MS);
}
