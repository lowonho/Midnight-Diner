"use strict";

/* ============================================================
   냉장고 재료 찾기 (E13) — 화면과 재료 데이터

   규칙은 engine-e13-fridge-find.js 에 있고, 여기서는
   "무엇을 채울지 · 무엇을 그릴지 · 무엇을 눌렀을 때 뭐라고 할지"만 봅니다.

   [재료 표가 둘인 이유]
     FRIDGE_INGREDIENTS  요리에 실제로 쓰는 재료. 오늘 메뉴에 들어가면 '찾아야 할 재료'가 됩니다.
     FRIDGE_EXTRAS       냉장고를 채우는 용도로만 쓰는 재료. 절대 목표가 되지 않습니다.
   둘을 섞어 24칸을 채웁니다. 오늘 안 쓰는 요리 재료도 방해물이 되므로
   "어제는 목표였던 무가 오늘은 방해물" 같은 그림이 자연스럽게 나옵니다.

   [그림이 없는 재료]
   컨셉 이미지에 있지만 아직 원화가 없는 재료(양파 · 계란 · 오징어 …)는
   `css` 키만 갖습니다. 그림 대신 css/ingredient-select.css 의 임시 도형
   (.fridge-art-css.ic-*)이 그려집니다. 나중에 원화가 들어오면 그 항목에
   `asset` 을 적어 주기만 하면 됩니다 — 도형은 자동으로 안 쓰입니다.

   [고르는 기준 두 가지]
   1. **손질 전 모습만 씁니다.** 냉장고는 요리를 시작하기 전이라, 우리 조리
      과정에서 이미 썰린 그림(E11 두부 5쪽 · E11 썬 김치 · E8 깍둑 닭 정육 ·
      E3 썬 모둠채소)은 넣지 않습니다. 통두부(E1) · 통김치(E1)처럼 통짜 그림이
      있으면 그쪽을 씁니다.
   2. **눕혀 그린 원화는 세웁니다.** 가로:세로가 2 이상이면 `standing:true` 를
      주어 냉장고 안에서 90도 세웁니다(css 의 .fridge-art.standing).
      좁고 높은 칸(72 x 130)에 눕힌 채로 넣으면 손톱만 해집니다.
      두부는 세우면 판이 서 버려서 예외로 눕혀 둡니다.
   ============================================================ */

const FRIDGE_INGREDIENTS=Object.freeze({
  fishCake:{id:"fishCake",label:"어묵",icon:"🍢",asset:"assets/minigame/E1/fish-cake-0.png"},
  radish:{id:"radish",label:"무",icon:"🥕",asset:"assets/minigame/E1/radish-0.png",standing:true},
  greenOnion:{id:"greenOnion",label:"대파",icon:"🌿",asset:"assets/minigame/E1/green-onion-0.png",standing:true},
  anchovy:{id:"anchovy",label:"멸치",icon:"🐟",asset:"assets/minigame/E10/food_anchovy_whole_group_3.webp",standing:true},
  // 두부·김치는 E11(두부김치) 그림이 이미 썰린 모습이라 E1 썰기 게임의 통짜 그림을 씁니다.
  tofu:{id:"tofu",label:"두부",icon:"⬜",asset:"assets/minigame/E1/tofu-0.png"},
  kimchi:{id:"kimchi",label:"김치",icon:"🥬",asset:"assets/minigame/E1/kimchi-0.png",standing:true},
  flour:{id:"flour",label:"밀가루",icon:"🌾",asset:"assets/minigame/E8/02_food_pancake_flour_panel.webp"},
  water:{id:"water",label:"물",icon:"💧",asset:"assets/minigame/E8/03_food_water_cup_panel.webp"},
  chicken:{id:"chicken",label:"닭고기",icon:"🍗",asset:"assets/minigame/E1/chicken-0.png",standing:true},
  udon:{id:"udon",label:"우동면",icon:"🍜",asset:"assets/minigame/E3/food_udon_noodles.webp"},
  cabbage:{id:"cabbage",label:"양배추",icon:"🥬",asset:"assets/minigame/E2/food_cabbage_ingredient.webp"},
  carrot:{id:"carrot",label:"당근",icon:"🥕",asset:"assets/minigame/E2/food_carrot_ingredient.webp"},
  yakisobaSauce:{id:"yakisobaSauce",label:"볶음우동 소스",icon:"🫙",asset:"assets/minigame/E3/food_udon_sauce.webp"},
  shrimp:{id:"shrimp",label:"새우",icon:"🍤",asset:"assets/minigame/E2/shrimp/food_shrimp_raw.webp"},
  egg:{id:"egg",label:"계란물",icon:"🥚",asset:"assets/minigame/E2/shrimp/food_egg_wash_panel.webp"},
  breadcrumbs:{id:"breadcrumbs",label:"빵가루",icon:"🍞",asset:"assets/minigame/E2/shrimp/food_wet_breadcrumbs_panel.webp"},
  tteok:{id:"tteok",label:"떡",icon:"🍚",asset:"assets/minigame/E8/Soaking/food_soak_tteok_ingredient_bowl.webp"},
  gochujang:{id:"gochujang",label:"고추장",icon:"🌶️",asset:"assets/minigame/E7/food_tteokbokki_gochujang_play_open.webp"},
  potato:{id:"potato",label:"감자",icon:"🥔",asset:"assets/minigame/E2/food_potato_ingredient.png"},
  oil:{id:"oil",label:"식용유",icon:"🫗",asset:"assets/minigame/E7/food_yakisoba_chili_oil_play_labeled.webp"},
  starch:{id:"starch",label:"전분",icon:"🥣",asset:"assets/minigame/E2/fries/food_frying_powder_panel.webp"}
});

/* 냉장고를 채우는 용도로만 쓰는 재료입니다(목표가 되지 않습니다).
   앞의 다섯은 이미 있는 원화를 빌려 쓰고, 나머지는 임시 CSS 도형입니다.
   ⚠️ 여기 id 를 레시피(FRIDGE_RECIPES)에 쓰면 안 됩니다 — 목표로 잡히지 않습니다.
      요리에 쓰게 되면 위 FRIDGE_INGREDIENTS 로 옮기세요. */
const FRIDGE_EXTRAS=Object.freeze({
  potatoRaw:{id:"potatoRaw",label:"감자",asset:"assets/minigame/E2/food_potato_whole_01.webp"},
  carrotRaw:{id:"carrotRaw",label:"당근",asset:"assets/minigame/E2/food_carrot_whole_01.webp"},
  cabbageRaw:{id:"cabbageRaw",label:"양배추",asset:"assets/minigame/E2/food_cabbage_whole_01.webp"},
  anchovyBox:{id:"anchovyBox",label:"멸치",asset:"assets/minigame/E10/food_anchovy_whole_group_3.webp",standing:true},
  // ⚠️ E3 모둠채소(썬 것) · E8 닭 정육(깍둑 썬 것)은 손질 뒤 그림이라 뺐습니다.
  onion:{id:"onion",label:"양파",css:"onion"},
  eggBasket:{id:"eggBasket",label:"계란",css:"egg"},
  sausage:{id:"sausage",label:"소시지",css:"sausage"},
  squid:{id:"squid",label:"오징어",css:"squid"},
  kelp:{id:"kelp",label:"다시마",css:"kelp"},
  mackerel:{id:"mackerel",label:"고등어",css:"mackerel"},
  corn:{id:"corn",label:"옥수수",css:"corn"},
  beef:{id:"beef",label:"소고기",css:"beef"},
  bokchoy:{id:"bokchoy",label:"청경채",css:"bokchoy"},
  napa:{id:"napa",label:"배추",css:"napa"},
  mushroom:{id:"mushroom",label:"느타리버섯",css:"mushroom"},
  enoki:{id:"enoki",label:"팽이버섯",css:"enoki"},
  pumpkin:{id:"pumpkin",label:"단호박",css:"pumpkin"}
});

const FRIDGE_RECIPES=Object.freeze({
  oden:["fishCake","radish","greenOnion","anchovy"],
  tofu:["tofu","kimchi"],
  kimchi:["kimchi","flour","water"],
  skewer:["chicken","greenOnion"],
  yakisoba:["udon","cabbage","carrot","yakisobaSauce"],
  shrimpTempura:["shrimp","flour","egg","breadcrumbs"],
  tteokbokki:["tteok","gochujang","fishCake","cabbage","greenOnion"],
  fries:["potato","oil","starch"]
});

// 상온 선반·양념장에 이미 준비되어 있어 냉장고에서 찾지 않는 재료입니다.
const PANTRY_INGREDIENT_IDS=Object.freeze(new Set([
  "anchovy","flour","water","yakisobaSauce","breadcrumbs","gochujang","potato","oil","starch"
]));

const INGREDIENT_ASSET_BASE=document.currentScript?.src||document.baseURI;
const INGREDIENT_TICK=100;                 // 걸린 시간 갱신 간격(ms)
const INGREDIENT_FINISH_DELAY=1500;        // 다 찾고 낮 준비로 넘어가기까지
let ingredientTimerId=null;
let ingredientFinishId=null;

function ingredientRecipe(menuId){return FRIDGE_RECIPES[menuId]||[];}
function ingredientInfo(id){return FRIDGE_INGREDIENTS[id]||FRIDGE_EXTRAS[id]||{id,label:id,icon:"·"};}

/* 재료 한 칸의 그림. 원화가 있으면 그림, 없으면 임시 CSS 도형입니다.
   `standing` 은 냉장고 칸(.fridge-art)에서만 먹습니다 — 오른쪽 '찾아야 할 재료'
   목록은 className 이 달라 그림 방향 그대로 나옵니다(css 참고). */
function ingredientArt(item,className="fridge-art"){
  const stand=item.standing?" standing":"";
  if(item.asset)return `<img class="${className}${stand}" src="${new URL(item.asset,INGREDIENT_ASSET_BASE).href}" alt="" draggable="false" />`;
  if(item.css)return `<span class="${className} fridge-art-css ic-${item.css}" aria-hidden="true"></span>`;
  return `<span class="${className} fridge-art-emoji" aria-hidden="true">${item.icon||"·"}</span>`;
}

function fridgeIngredientId(id){return !!FRIDGE_INGREDIENTS[id]&&!PANTRY_INGREDIENT_IDS.has(id);}

function requiredIngredientIdsForMenus(menuIds=[]){
  return [...new Set(menuIds.flatMap(ingredientRecipe))];
}

function fridgeIngredientIdsForMenus(menuIds=[]){
  return requiredIngredientIdsForMenus(menuIds).filter(fridgeIngredientId);
}

function pantryIngredientIdsForMenus(menuIds=[]){
  return requiredIngredientIdsForMenus(menuIds).filter(id=>PANTRY_INGREDIENT_IDS.has(id));
}

/* 오늘 안 쓰는 재료 + 냉장고 전용 재료 = 방해물 후보.
   요리 재료를 먼저 넣고 전용 재료를 뒤에 붙입니다. 섞는 것은 엔진이 합니다. */
function fridgeFillerIds(requiredIds=[]){
  const spare=Object.keys(FRIDGE_INGREDIENTS).filter(id=>fridgeIngredientId(id)&&!requiredIds.includes(id));
  return [...spare,...Object.keys(FRIDGE_EXTRAS)];
}

function createIngredientSelectionState(menuIds=[]){
  const required=fridgeIngredientIdsForMenus(menuIds);
  return e13CreateProgress(required,fridgeFillerIds(required));
}

function normalizeIngredientSelectionState(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT){
    if(!state.ingredientSelection)state.ingredientSelection=null;
    return;
  }
  const menus=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>ingredientRecipe(id).length):[];
  const saved=state.ingredientSelection&&typeof state.ingredientSelection==="object"?state.ingredientSelection:{};
  const required=fridgeIngredientIdsForMenus(menus);
  state.ingredientSelection=e13NormalizeProgress(saved,required,fridgeFillerIds(required));
}

function allRequiredIngredientIds(){
  return fridgeIngredientIdsForMenus(state.selectedMenus||[]);
}

function currentIngredientRoundComplete(){
  return e13Complete(state.ingredientSelection);
}

/* ---- 걸린 시간 ------------------------------------------------
   제한시간이 아니라 기록이라 0.1초마다 숫자만 갈아 끼웁니다.
   화면 전체(renderIngredientSelection)를 다시 그리면 24칸이 매번 새로
   만들어져 클릭이 씹힙니다. */
function stopIngredientTimer(){
  clearInterval(ingredientTimerId);ingredientTimerId=null;
  clearTimeout(ingredientFinishId);ingredientFinishId=null;
}

function startIngredientTimer(){
  stopIngredientTimer();
  ingredientTimerId=setInterval(()=>{
    if(state.phase!==GAME_PHASES.INGREDIENT_SELECT){stopIngredientTimer();return;}
    if(!e13Tick(state.ingredientSelection,INGREDIENT_TICK/1000))return;
    updateIngredientTimeText();
  },INGREDIENT_TICK);
}

function updateIngredientTimeText(){
  const value=dom.ingredientTimer?.querySelector("b");
  if(value)value.textContent=e13TimeText(state.ingredientSelection?.elapsed||0);
}

/* ---- 열기 / 닫기 --------------------------------------------- */
function startIngredientSelection(){
  if(!Array.isArray(state.selectedMenus)||!state.selectedMenus.length)return false;
  stopIngredientTimer();
  const required=fridgeIngredientIdsForMenus(state.selectedMenus);
  dom.menuSelectOverlay.classList.remove("open");
  if(!required.length){
    state.phase=GAME_PHASES.PREP;state.phaseTime=null;state.paused=false;state.ingredientSelection=null;
    dom.ingredientSelectOverlay.classList.remove("open");
    showToast("냉장고에서 찾을 재료는 없어요. 바로 손질을 시작합니다.");
    updateUI(true);saveGame();
    return true;
  }
  state.phase=GAME_PHASES.INGREDIENT_SELECT;state.phaseTime=null;state.paused=false;
  state.ingredientSelection=createIngredientSelectionState(state.selectedMenus);
  dom.ingredientSelectOverlay.dataset.signature="";
  dom.ingredientSelectOverlay.classList.add("open");
  dom.ingredientSelectFeedback.textContent=`오늘 필요한 재료 ${required.length}가지를 냉장고에서 찾아 눌러주세요.`;
  renderIngredientSelection();updateUI(true);saveGame();
  return true;
}

function continueIngredientSelection(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||!currentIngredientRoundComplete())return false;
  stopIngredientTimer();
  state.phase=GAME_PHASES.PREP;state.phaseTime=null;
  dom.ingredientSelectOverlay.classList.remove("open");
  showToast("필요한 재료를 모두 챙겼어요. 이제 손질을 시작해볼까요?");
  updateUI(true);saveGame();
  return true;
}

/* ---- 칸 누르기 ------------------------------------------------ */
function pickIngredientSlot(slotIndex){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return false;
  const progress=state.ingredientSelection;
  if(!progress||e13Complete(progress))return false;
  const {result,id,complete}=e13Pick(progress,slotIndex);
  const item=ingredientInfo(id);
  if(result==="empty")return false;
  if(result==="wrong"){
    dom.ingredientSelectFeedback.textContent=`${item.label}은(는) 오늘 쓰지 않아요.`;
    audio.bad?.();
    flashIngredientSlot(slotIndex,"wrong");
    return false;
  }
  audio.success?.();
  const left=e13RemainingIds(progress).length;
  dom.ingredientSelectFeedback.textContent=complete
    ?"필요한 재료를 모두 찾았어요!"
    :`${item.label} 찾았어요! ${left}가지 남았습니다.`;
  renderIngredientSelection();saveGame();
  if(complete)finishIngredientSelection();
  return true;
}

/* 틀린 칸은 다시 그리지 않고 흔들기만 합니다(칸 내용이 그대로라 신호가 없습니다). */
function flashIngredientSlot(slotIndex,className){
  const slot=dom.ingredientGrid?.querySelector(`[data-slot="${slotIndex}"]`);
  if(!slot)return;
  slot.classList.remove(className);void slot.offsetWidth;slot.classList.add(className);
}

function finishIngredientSelection(){
  stopIngredientTimer();
  const banner=dom.ingredientGrid?.closest(".fridge-cabinet");
  if(banner&&!banner.querySelector(".fridge-clear")){
    banner.insertAdjacentHTML("beforeend",`<div class="fridge-clear"><strong>재료 준비 완료</strong><span>걸린 시간 ${e13TimeText(state.ingredientSelection?.elapsed||0)}</span></div>`);
  }
  ingredientFinishId=setTimeout(continueIngredientSelection,INGREDIENT_FINISH_DELAY);
}

/* ---- 그리기 --------------------------------------------------- */

/* 칸마다 조금씩 다르게 앉히기. 칸 번호에서 뽑으므로 다시 그려도 안 흔들립니다.
   (Math.random 을 쓰면 renderIngredientSelection 이 돌 때마다 재료가 튑니다) */
function ingredientSlotPose(slotIndex,id=""){
  const seed=(slotIndex*7919+[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)*131)%1000;
  return {
    turn:(seed%9)-4,                 // -4 ~ 4도
    shift:((seed>>3)%7)-3,           // 좌우 -3 ~ 3%
    scale:.9+((seed>>6)%13)/100      // 0.90 ~ 1.02배
  };
}

function ingredientSlotMarkup(id,index){
  const {row,column,side}=e13SlotCell(index);
  const place=`grid-row:${row};grid-column:${column}`;
  if(!id)return `<span class="fridge-slot empty" style="${place}" data-slot="${index}" aria-hidden="true"></span>`;
  const item=ingredientInfo(id),pose=ingredientSlotPose(index,id);
  return `<button class="fridge-slot" style="${place};--slot-turn:${pose.turn}deg;--slot-shift:${pose.shift}%;--slot-scale:${pose.scale}" data-slot="${index}" data-side="${side}" type="button" aria-label="${item.label}">
      ${ingredientArt(item)}
      <small>${item.label}</small>
    </button>`;
}

function bindIngredientSlots(){
  dom.ingredientGrid.querySelectorAll("button[data-slot]").forEach(slot=>{
    slot.addEventListener("click",()=>pickIngredientSlot(Number(slot.dataset.slot)));
  });
}

function renderIngredientSelection(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return;
  normalizeIngredientSelectionState();
  const progress=state.ingredientSelection;
  const dishes=(state.selectedMenus||[]).map(dishById).filter(Boolean);
  if(!dishes.length)return;
  const required=progress.required,found=new Set(progress.found);
  const signature=[
    state.day,
    state.selectedMenus.join(","),
    progress.found.join(","),
    progress.slots.map(id=>id||"").join(",")
  ].join("|");
  if(dom.ingredientSelectOverlay.dataset.signature===signature){
    dom.ingredientSelectOverlay.classList.add("open");
    return;
  }
  dom.ingredientSelectOverlay.dataset.signature=signature;

  // 좌 : 오늘의 요리
  dom.ingredientDishGallery.innerHTML=dishes.map(dish=>
    `<div class="fridge-dish"><strong>${dish.name}</strong><i><img src="${foodPropUrl(dish.id)||""}" alt="" /></i></div>`
  ).join("");

  // 중 : 냉장고 24칸
  dom.ingredientGrid.innerHTML=progress.slots.map(ingredientSlotMarkup).join("");
  bindIngredientSlots();

  // 우 위 : 완료 개수 · 걸린 시간
  dom.ingredientTotalProgress.innerHTML=`<b>${progress.found.length}</b> / ${required.length}`;
  updateIngredientTimeText();

  // 우 아래 : 찾아야 할 재료
  dom.ingredientChecklist.innerHTML=required.map(id=>{
    const item=ingredientInfo(id),done=found.has(id);
    return `<div class="fridge-goal ${done?"done":""}" title="${item.label}">${ingredientArt(item,"fridge-goal-art")}<small>${item.label}</small></div>`;
  }).join("");

  const pantry=pantryIngredientIdsForMenus(state.selectedMenus||[]);
  dom.ingredientPantryNote.innerHTML=pantry.length
    ?`<strong>냉장고 밖에 준비됨</strong><span>${pantry.map(id=>ingredientInfo(id).label).join(" · ")}</span>`
    :"";

  dom.ingredientSelectOverlay.classList.add("open");
  if(!e13Complete(progress)&&!ingredientTimerId)startIngredientTimer();
}
