"use strict";

/* ============================================================
   E8 순서 배치 (낮 준비)

   정해진 순서대로 대상을 클릭하거나 끌어다 놓는 게임 묶음입니다.

   · batterIngredients  김치전 반죽 — 밀가루 → 물 → 김치 순서로 클릭.
                        3개를 다 넣으면 곧바로 거품기(E9)로 넘어갑니다.
                        → engine-e9-whisk.js 의 setupWhiskBatter 호출
   · skewer             닭꼬치 꽂기 — 꼬치마다 5칸의 정답 배치가 무작위로
                        정해지고, 칸 테두리 색에 맞는 재료를 꽂습니다. 총 3꼬치.
   ============================================================ */

registerDayPrepSetup("batter",()=>setupKimchiBatter());
registerDayPrepSetup("skewer",()=>setupChickenSkewer());

/* 반죽·꼬치는 포인터 클릭·드래그로만 조작합니다. */
registerDayPrepEngine("orderPlace",{noKeyboard:true});

/* ---- E8 공통 포인터 배치 -----------------------------------
   짧게 누르면 자동 배치, 누른 채 움직이면 재료 그림이 포인터를 따라갑니다.
   브라우저 기본 drag 이벤트를 쓰지 않아 마우스와 터치가 같은 흐름을 공유합니다.

   dragOnly  짧게 누르는 자동 배치를 끕니다. 반드시 끌어다 놓아야 합니다.
             (김치전 반죽은 "볼에 붓는" 동작이라 클릭 한 번으로 들어가면
              재료가 어디로 갔는지 안 보입니다)

   ⚠️ 끄는 일을 **원본 카드에 매달지 않습니다.** 커서를 따라오는 그림(유령)은
      화면(dom.miniContent)이 다시 그려져도 살아남는 document.body 에 붙는데,
      끄는 도중에 화면이 다시 그려져 카드가 사라지면 크롬은 그 카드에 pointerup 도
      lostpointercapture 도 보내 주지 않습니다. 그러면 유령을 지울 사람이 없어서
      **그림이 화면에 영구히 붙어 버립니다** — 김치전 반죽에서 재료를 놓은 뒤
      420ms 뒤의 재렌더(renderKimchiBatterIngredients) 사이에 다음 재료를 집었다
      놓으면 물컵이 그대로 남던 것이 이 경우입니다. 젓기(E9)로 넘어가도, 창을
      닫아도 남습니다.
      그래서 움직임·놓기는 **창(window) 전체에서 캡처 단계로** 받고,
      주인이 사라진 유령은 sweepStaleOrderDragGhosts 로 걷어냅니다. */

/* 지금 끌고 있는 유령만 담아 둡니다. 여기 없는 .order-drag-ghost 는 주인이 사라진
   찌꺼기라는 뜻입니다. */
const liveOrderDragGhosts=new Set();

// 화면을 다시 묶을 때(= 매 렌더) 부릅니다. 주인 없는 것만 지우므로,
// 끌고 있는 그림은 화면이 갈아 끼워져도 그대로 커서를 따라옵니다.
function sweepStaleOrderDragGhosts(){
  document.querySelectorAll(".order-drag-ghost").forEach(ghost=>{if(!liveOrderDragGhosts.has(ghost))ghost.remove();});
}

// 미니게임 화면을 떠날 때 부릅니다. 끌고 있던 것까지 통째로 지웁니다.
function clearOrderDragGhosts(){
  liveOrderDragGhosts.clear();
  document.querySelectorAll(".order-drag-ghost").forEach(ghost=>ghost.remove());
}

function bindOrderPlacementPointers({sources,targetSelector,itemFromSource,ghostSelector,onPlace,onMiss,dragOnly=false}){
  let active=null,suppressClick=false;
  sweepStaleOrderDragGhosts();

  function targetAt(x,y){return document.elementFromPoint(x,y)?.closest(targetSelector)||null;}
  function clearTarget(){dom.miniContent.querySelectorAll(`${targetSelector}.order-drop-ready`).forEach(target=>target.classList.remove("order-drop-ready"));}
  function moveGhost(event){
    if(!active||active.pointerId!==event.pointerId)return;
    const dx=event.clientX-active.startX,dy=event.clientY-active.startY;
    if(!active.dragging&&Math.hypot(dx,dy)>=5){
      active.dragging=true;active.source.classList.add("order-source-dragging");
      active.ghost=document.createElement("span");active.ghost.className=`order-drag-ghost ${active.item}`;
      const art=active.source.querySelector(ghostSelector);
      active.ghost.innerHTML=art?art.outerHTML:active.source.textContent;
      document.body.appendChild(active.ghost);liveOrderDragGhosts.add(active.ghost);
    }
    if(!active.dragging)return;
    event.preventDefault();
    active.ghost.style.left=`${event.clientX}px`;active.ghost.style.top=`${event.clientY}px`;
    clearTarget();targetAt(event.clientX,event.clientY)?.classList.add("order-drop-ready");
  }
  function finishPointer(event,cancelled=false){
    if(!active||active.pointerId!==event.pointerId)return;
    const drag=active;active=null;clearTarget();detachDragWindow();
    drag.source.classList.remove("order-source-dragging");
    if(drag.ghost){liveOrderDragGhosts.delete(drag.ghost);drag.ghost.remove();}
    if(!drag.dragging)return;
    suppressClick=true;miniSetTimeout(()=>{suppressClick=false;},0);
    const target=cancelled?null:targetAt(event.clientX,event.clientY);
    if(target)onPlace(drag.item,target,true,drag.source);
    else onMiss?.(drag.item,drag.source);
  }

  /* 끄는 동안만 창에 매답니다.
     · 캡처 단계(true)로 받는 이유 : 중간에서 stopPropagation 하는 손이 있어도
       놓는 것은 반드시 우리에게 먼저 옵니다.
     · blur 도 받습니다 — 창 밖에서 손을 떼면 페이지가 pointerup 을 못 봅니다. */
  const upWindow=event=>finishPointer(event);
  const cancelWindow=event=>finishPointer(event,true);
  const blurWindow=()=>{if(active)finishPointer({pointerId:active.pointerId},true);};
  function attachDragWindow(){
    window.addEventListener("pointermove",moveGhost,true);
    window.addEventListener("pointerup",upWindow,true);
    window.addEventListener("pointercancel",cancelWindow,true);
    window.addEventListener("blur",blurWindow);
  }
  function detachDragWindow(){
    window.removeEventListener("pointermove",moveGhost,true);
    window.removeEventListener("pointerup",upWindow,true);
    window.removeEventListener("pointercancel",cancelWindow,true);
    window.removeEventListener("blur",blurWindow);
  }

  sources.forEach(source=>{
    source.addEventListener("pointerdown",event=>{
      if(event.pointerType==="mouse"&&event.button!==0||source.disabled)return;
      event.preventDefault();
      // 앞의 것이 아직 안 끝났으면(손가락 두 개 등) 먼저 접습니다 — 안 그러면 유령이 남습니다.
      if(active)finishPointer({pointerId:active.pointerId},true);
      active={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,item:itemFromSource(source),source,dragging:false,ghost:null};
      source.setPointerCapture?.(event.pointerId);
      attachDragWindow();
    });
    /* 카드에도 그대로 매달아 둡니다. 창 쪽이 이미 받았으면 finishPointer 가
       (active 가 비어) 곧바로 되돌아 나오므로 두 번 처리되지 않습니다.
       ⚠️ 이쪽을 지우면 안 됩니다 — 검사 하네스(tools/day4-logic-smoke.html)의
          dom.miniContent 는 문서에 붙지 않은 div 라, 거기서 일어난 이벤트는
          window 까지 올라오지 않습니다. */
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
  miniSetTimeout(()=>target.classList.remove(className),360);
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

const BATTER_INGREDIENT_SFX=Object.freeze({
  flour:Object.freeze({name:"pour_pancake_flour",gain:2.5}),
  water:Object.freeze({name:"pour_water",gain:.55}),
  kimchi:Object.freeze({name:"drop_pancake_kimchi",gain:.52})
});

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
  /* 맨 처음(아직 아무것도 안 넣은 화면)에만 "볼까지 끌어다 놓으세요" 점선을 그립니다.
     이 게임은 클릭 자동 배치가 없어서(dragOnly) 끌어야 하는 것을 알려 줘야 합니다.
     자리는 absolute(도마 .bt-board 기준)라 여기 순서는 그리는 순서일 뿐입니다. */
  dom.miniContent.innerHTML=batterSceneMarkup(`
      <div class="bt-bowl-wrap ${data.lastPlaced?`receive-${data.lastPlaced}`:""} ${data.holding?"filled":""}" data-order-target="batter">${batterBowlMarkup(`step-${data.step}`,{assetKey:batterBowlAssetKey(added)})}</div>
      <p class="bt-progress">${current?`다음 재료 · <b>${current.label}</b>`:"재료 준비 완료! <b>이제 저어 주세요</b>"}</p>
      ${data.step?"":`<i class="bt-drag-hint" aria-hidden="true"></i>`}`,
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
  const sfx=BATTER_INGREDIENT_SFX[ingredientId];
  audio.play?.(sfx.name,{owner:m,gain:sfx.gain});
  dom.miniFeedback.textContent=`${expected.label} 넣기 완료`;
  const filled=m.data.step>=m.data.ingredients.length;
  miniSetTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    // 마지막 재료까지 넣었으면 곧바로 거품기(E9)로 갈아 끼우지 않습니다.
    // 세 가지가 다 담긴 볼을 한 박자 보여 준 뒤에 넘깁니다.
    m.data.holding=filled;
    renderKimchiBatterIngredients();
    if(!filled)return;
    dom.miniFeedback.textContent="재료가 모두 들어갔습니다.";
    miniSetTimeout(()=>{
      if(state.mini!==m||m.complete||!m.data.holding)return;
      m.data.holding=false;
      // 여기서 게임 종류가 거품기(E9)로 바뀝니다.
      setupWhiskBatter("kimchiBatter",m.data.mistakes);
    },BATTER_FULL_HOLD_MS);
  },420);
}

/* ---- 닭꼬치 꽂기 -------------------------------------------
   화면 구성 (그림은 전부 CSS 임시 도형입니다. 에셋이 들어오면 교체)
     왼쪽   닭고기·파 재료 카드 — 아래 ×숫자는 남은 꼬치에서 더 써야 할 개수
     가운데 현재 조립 중인 큰 꼬치 하나 — 아래에서 위로 5칸
     오른쪽 완성 개수 + 이번 꼬치의 참고 모양
   재료 카드를 클릭하면 자동으로 꽂히고, 꼬치 끝으로 직접 끌어도 됩니다.

   [정답 배치]  꼬치 하나가 시작될 때 5칸의 정답이 무작위로 정해집니다.
   빈 칸은 그 칸에 들어갈 재료 색(살구빛 = 닭고기 / 연두 = 파)의 점선으로
   미리 그려지고, 색이 다른 재료를 꽂으면 꼬치가 흔들리며 막힙니다.
   ⚠️ 뽑을 때 한 꼬치 안의 최소 개수(SKEWER_MIN_PIECES · 닭고기 2 · 파 1)를
      지킵니다. 화면 안내에는 이 규칙을 적지 않습니다 — 플레이어가 지켜야 할
      규칙이 아니라 배치를 뽑는 쪽의 조건입니다.

   모양·크기는 css/day-prep-minigames.css 의 "닭꼬치 꽂기" 구역에 모여 있습니다.
   공용 프레임(css/minigame-frame.css, ui-mini-frame.js)은 건드리지 않고,
   이 게임이 켜져 있을 때만 적용되는 규칙으로 덮어씁니다.
   ------------------------------------------------------------ */

const SKEWER_SLOT_COUNT=5;
const SKEWER_EXAMPLE_ORDER=["chicken","greenOnion","chicken","greenOnion","chicken"];
const SKEWER_TOTAL=SKEWER_BATCH_SIZE;                                          // 만들 꼬치 수
// SKEWER_LABEL · SKEWER_ASSET_KEY 는 game-data.js 에 있습니다 —
// 밤 '닭꼬치 굽기'(engine-e5)가 낮에 꽂은 배치를 그대로 구우려고 같은 표를 봅니다.
const SKEWER_INGREDIENTS=Object.freeze(Object.keys(SKEWER_LABEL));
/* 꼬치 하나에 반드시 들어가야 하는 최소 개수. 정답 배치를 뽑을 때만 쓰이고
   화면 어디에도 적지 않습니다 (플레이어는 칸 색만 보면 됩니다).
   ⚠️ 합이 SKEWER_SLOT_COUNT(5)를 넘으면 안 됩니다 — 지금은 3이라 2칸이 자유입니다. */
const SKEWER_MIN_PIECES=Object.freeze({chicken:2,greenOnion:1});
// assets/minigame/E8/ 의 그림을 씁니다. 파일이 없으면 CSS 도형으로 되돌아갑니다.
// (경로는 day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 참고)
//   piece  꼬치에 꽂히는 조각 한 개 → SKEWER_ASSET_KEY (game-data.js · 밤 굽기와 공용)
//   group  좌측 재료 카드에 놓는 묶음 그림 → 아래 표 (이 게임에만 있습니다)
const SKEWER_GROUP_ASSET_KEY={chicken:"skewerChickenGroup",greenOnion:"skewerGreenOnionGroup"};

// E8의 공통 순서 데이터. 새 게임은 순서와 트랙 수만 추가하고 같은 판정을 씁니다.
const ORDER_PLACE_CONFIG=Object.freeze({
  batter:Object.freeze({order:Object.freeze(BATTER_INGREDIENTS.map(item=>item.id)),tracks:1}),
  // 꼬치는 정해진 순서가 아니라 꼬치마다 뽑은 정답 배치(data.patterns)를 씁니다.
  // 여기 order 는 칸 수(5)를 넘겨 주는 용도로만 남아 있습니다.
  skewer:Object.freeze({order:Object.freeze([...SKEWER_EXAMPLE_ORDER]),tracks:SKEWER_TOTAL})
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

/* 꼬치 한 개의 정답 배치 5칸을 뽑습니다.
   빈 칸 번호를 섞어 두고 SKEWER_MIN_PIECES 만큼 **먼저 박은 뒤** 남는 칸을
   무작위로 채웁니다. 지금 값(닭 2 · 파 1)이면 3칸이 정해지고 2칸이 자유입니다.

   ⚠️ 다 뽑아 놓고 모자란 재료를 나중에 끼워 넣는 방식은 쓰지 않습니다.
      한쪽을 채우려고 뺏어 온 칸이 반대쪽 최소 개수를 깨서 서로 뺏고 뺏기게 됩니다.
   ⚠️ 전역 shuffle() 을 안 쓰고 여기서 섞습니다 — 검사 하네스가 그 자리를
      "그대로 돌려주는" 가짜로 바꿔 놓아, 쓰면 배치가 늘 같은 자리에 박힙니다. */
function createSkewerPattern(){
  const slots=Array.from({length:SKEWER_SLOT_COUNT},(_,index)=>index);
  for(let index=slots.length-1;index>0;index--){
    const pick=Math.floor(Math.random()*(index+1));
    [slots[index],slots[pick]]=[slots[pick],slots[index]];
  }
  const pattern=[];
  SKEWER_INGREDIENTS.forEach(ingredient=>{
    for(let count=0;count<SKEWER_MIN_PIECES[ingredient];count++)pattern[slots.pop()]=ingredient;
  });
  slots.forEach(slot=>{pattern[slot]=SKEWER_INGREDIENTS[Math.random()<.5?0:1];});
  return pattern;
}

// 지금 꽂을 수 있는 재료. 정답 배치가 정한 한 가지뿐이고, 다 찼으면 빈 배열입니다.
function allowedSkewerIngredients(stack,pattern){
  if(!stack||!pattern||stack.length>=SKEWER_SLOT_COUNT)return [];
  return [pattern[stack.length]];
}

// 아래에서 위로 한 칸씩, 그 칸의 정답과 같은 재료만 받습니다.
function placeSkewerPatternItem(data,item,trackIndex=0){
  const stack=data.placements[trackIndex],pattern=data.patterns?.[trackIndex];
  if(!stack||!pattern)return {accepted:false,reason:"missingTrack",allowed:[],complete:false};
  const allowed=allowedSkewerIngredients(stack,pattern);
  if(!allowed.includes(item))return {accepted:false,reason:stack.length>=SKEWER_SLOT_COUNT?"full":"wrongSlot",allowed,complete:false};
  stack.push(item);
  return {accepted:true,reason:"",allowed:allowedSkewerIngredients(stack,pattern),complete:stack.length>=SKEWER_SLOT_COUNT};
}

/* 왼쪽 재료 카드의 ×숫자 — 남은 꼬치에서 이 재료를 더 꽂아야 하는 개수입니다.
   (컨셉 이미지의 "닭고기 ×9 / 파 ×6" 자리) 이미 꽂은 칸은 빼고 셉니다. */
function remainingSkewerCount(data,ingredient){
  return data.patterns.reduce((sum,pattern,track)=>{
    const placed=data.placements[track]?.length||0;
    return sum+pattern.filter((slot,index)=>slot===ingredient&&index>=placed).length;
  },0);
}

function setupChickenSkewer(){
  // holdIndex : 방금 5개를 다 꽂은 꼬치 번호. 다음 꼬치로 넘기기 전에
  //             완성된 모습을 잠깐 그대로 보여주는 동안만 값이 들어 있습니다.
  // patterns : 꼬치별 정답 배치. 게임을 시작할 때 3개를 한 번에 뽑아 둡니다
  //            (왼쪽 카드의 ×숫자가 남은 꼬치까지 합쳐 세야 하기 때문입니다).
  setDayPrepData({...createOrderPlacementState("skewer"),patterns:Array.from({length:SKEWER_TOTAL},createSkewerPattern),
    total:SKEWER_TOTAL,mistakes:0,lastPlaced:null,holdIndex:null,finishing:false,completionGrade:""});
  dom.miniTitle.textContent="닭꼬치 꽂기";
  dom.miniDescription.textContent="칸 테두리 색에 맞춰 아래부터 순서대로 꽂아주세요!";
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

/* 꼬치 하나. 아래에서 위로 채우므로 화면에는 슬롯을 뒤집어 그립니다.
   빈 칸은 **전부** 정답 배치의 재료 색 점선(hint-*)으로 그립니다. 그 색이
   곧 무엇을 꽂아야 하는지이고, 다음에 채울 한 칸만 .next 로 밝아집니다. */
function skewerRackMarkup(stack,index,{active=false,lastPlaced=null,pattern=[]}={}){
  const done=stack.length>=SKEWER_SLOT_COUNT;
  const slots=Array.from({length:SKEWER_SLOT_COUNT},(_,slot)=>{
    if(slot<stack.length){
      const fresh=lastPlaced?.track===index&&lastPlaced.slot===slot;
      return `<span class="sk-slot filled">${skewerPieceMarkup(stack[slot],fresh?"fresh":"")}</span>`;
    }
    const want=pattern[slot];
    return `<span class="sk-slot empty ${want?`hint-${want}`:"free"} ${slot===stack.length?"next":""}" aria-label="${want?SKEWER_LABEL[want]:"빈"} 자리"></span>`;
  }).reverse().join("");
  return `<div class="sk-rack ${active?"active":""} ${done?"done":""}" data-skewer="${index}" aria-label="${index+1}번 꼬치 · ${stack.length} / ${SKEWER_SLOT_COUNT}">
      ${skewerRodMarkup()}<div class="sk-slots">${slots}</div>
    </div>`;
}

/* 오른쪽 '참고 모양' — 이번 꼬치의 정답 배치를 작은 꼬치 한 개로 보여줍니다.
   가운데 꼬치와 위아래가 같아 보이도록 여기서도 배열을 뒤집어 쌓습니다. */
/* ⚠️ 바깥 칸(.sk-guide-figure)과 꼬치(.sk-guide-skewer)를 나눠 두는 이유 :
      꼬챙이는 감싼 상자에 위아래로 딱 붙는 absolute 라, 남는 자리를 다 받는
      상자에 그대로 넣으면 카드 높이만큼 늘어나 실오라기처럼 보입니다.
      늘어나는 것은 바깥 칸이 맡고, 꼬챙이는 조각 묶음만 한 안쪽 상자를 씁니다. */
function skewerGuideMarkup(pattern){
  const pieces=[...pattern].reverse().map(ingredient=>skewerPieceMarkup(ingredient,"mini")).join("");
  return `<div class="sk-guide-figure">
      <div class="sk-guide-skewer" aria-label="이번 꼬치의 참고 모양">${skewerRodMarkup()}<div class="sk-guide-pieces">${pieces}</div></div>
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
  const activePattern=data.patterns[activeIndex]||[];
  const allowed=holding?[]:allowedSkewerIngredients(activeStack,activePattern);
  dom.miniTimer.textContent=`${done} / ${data.total}`;   // 공용 타이머 자리는 이 게임에서 숨깁니다
  dom.miniContent.innerHTML=`
    <div class="skewer-prep-scene">
      <aside class="sk-col">
        <div class="sk-panel sk-ing-panel">
          <h3 class="sk-col-title starred">재료</h3>
          <!-- 어느 쪽도 잠그지 않습니다. 색이 다른 재료를 꽂아 보는 것까지가
               이 게임이고, 틀리면 꼬치가 흔들리며 mistakes 로 남습니다. -->
          <div class="sk-ing-list">${SKEWER_INGREDIENTS.map(ingredient=>
            `<button type="button" class="sk-ing-card ${ingredient}" data-ingredient="${ingredient}" ${data.finishing||holding?"disabled":""}>
              ${skewerIngredientArtMarkup(ingredient)}
              <span class="sk-ing-name">${SKEWER_LABEL[ingredient]}<b>×${remainingSkewerCount(data,ingredient)}</b></span>
            </button>`).join("")}</div>
        </div>
      </aside>

      <div class="sk-board sk-single-board ${data.finishing?"complete":""} ${holding?"holding":""}">
        <div class="sk-finished-strip">${Array.from({length:data.total},(_,index)=>`<span class="${index<done?"done":index===activeIndex?"active":""}">${index<done?"✓":index+1}</span>`).join("")}</div>
        <p class="sk-active-title">${data.finishing?"꼬치 조립 완료":holding?`${activeIndex+1}번 꼬치 완성!`:`${activeIndex+1}번 꼬치 · ${activeStack.length} / ${SKEWER_SLOT_COUNT}`}</p>
        <div class="sk-active-rack" data-order-target="skewer" data-skewer="${activeIndex}">${skewerRackMarkup(activeStack,activeIndex,{active:true,lastPlaced:data.lastPlaced,pattern:activePattern})}</div>
        <!-- 무엇을 꽂을지는 알려 주지 않습니다. 칸 색을 읽는 것이 이 게임입니다. -->
        <p class="sk-free-rule">빛나는 칸의<br /><b>테두리 색</b>에 맞춰<br /><b>아래부터 순서대로</b><br />꽂아주세요!</p>
        ${data.finishing?`<strong class="order-result ${data.completionGrade} show">${dayPrepGradeText(data.completionGrade)}</strong>`:""}
      </div>

      <aside class="sk-col">
        <div class="sk-panel sk-count">
          <h3 class="sk-col-title">완성 개수</h3>
          <strong>${done} / ${data.total}</strong>
        </div>
        <div class="sk-panel sk-guide">
          <h3 class="sk-col-title">참고 모양</h3>
          ${skewerGuideMarkup(activePattern)}
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

/* 방금 꽂은 3개의 배치를 밤 '닭꼬치 굽기'(engine-e5)에 넘깁니다.
   화로 위에 올라가는 꼬치가 낮에 꽂은 그 꼬치여야 해서 모양까지 그대로 옮깁니다.
   자리는 state.skewerPrep (day.js 의 createSkewerPrepProgress) 이고,
   세이브는 state 를 통째로 뜨므로 따로 저장할 것이 없습니다. */
function rememberAssembledSkewers(data){
  if(!Array.isArray(data.patterns))return;
  state.skewerPrep={...(state.skewerPrep||{}),patterns:data.patterns.map(pattern=>[...pattern])};
}

// 정답과 다른 조각은 애초에 쌓이지 않으므로, 5칸이 찼으면 곧 정답대로 꽂힌 꼬치입니다.
function skewerDoneCount(data){
  return data.placements.filter(stack=>stack.length>=SKEWER_SLOT_COUNT).length;
}

// 현재 큰 꼬치에 재료 한 조각을 넣습니다.
function placeSkewerPiece(skewerIndex,ingredient,target){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="orderPlace"||m.data.orderConfigId!=="skewer"||m.data.finishing||Number.isInteger(m.data.holdIndex))return;
  const data=m.data,stack=data.placements[skewerIndex];
  if(!stack||!SKEWER_LABEL[ingredient])return;
  const activeIndex=skewerDoneCount(data);if(skewerIndex!==activeIndex)return;
  const result=placeSkewerPatternItem(data,ingredient,skewerIndex);
  if(!result.accepted){
    data.mistakes++;
    const required=result.allowed[0];
    return rejectSkewerPiece(skewerIndex,required?`이 칸은 ${SKEWER_LABEL[required]} 자리입니다.`:"이 꼬치는 이미 다 찼습니다.",target);
  }

  data.lastPlaced={track:skewerIndex,slot:stack.length-1};audio.play?.("skewer_pierce",{owner:m});
  const done=skewerDoneCount(data);
  dom.miniFeedback.textContent=result.complete
    ? `꼬치 ${done} / ${data.total} 완성!`
    : `${SKEWER_LABEL[ingredient]}를 꽂았습니다.`;
  if(done>=data.total){
    data.finishing=true;data.completionGrade=data.mistakes?"good":"perfect";rememberAssembledSkewers(data);renderChickenSkewer();
    miniSetTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask("assembleChickenSkewer",`닭꼬치 ${data.total}개 꽂기 완료`);},720);
  }else if(result.complete){
    // 5개를 다 꽂았습니다. 바로 다음 꼬치로 갈아 끼우면 완성된 모습을 못 보고
    // 지나가므로, 잠깐 그대로 두었다가 넘깁니다. 그동안 재료는 잠깁니다.
    data.holdIndex=skewerIndex;renderChickenSkewer();
    miniSetTimeout(()=>{
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
  miniSetTimeout(()=>rack.classList.remove("reject"),340);
}
