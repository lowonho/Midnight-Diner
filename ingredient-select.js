"use strict";

// 메뉴 데이터의 짧은 소개용 재료 목록과 별개로, 냉장고 게임에서 사용하는
// 실제 준비 재료를 한곳에 둡니다. 이후 재고 시스템을 붙일 때도 이 id를 재사용할 수 있습니다.
const FRIDGE_INGREDIENTS=Object.freeze({
  fishCake:{id:"fishCake",label:"어묵",icon:"🍢",asset:"assets/minigame/E1/fish-cake-0.png"},
  radish:{id:"radish",label:"무",icon:"🥕",asset:"assets/minigame/E1/radish-0.png"},
  greenOnion:{id:"greenOnion",label:"대파",icon:"🌿",asset:"assets/minigame/E1/green-onion-0.png"},
  anchovy:{id:"anchovy",label:"멸치",icon:"🐟",asset:"assets/minigame/E10/food_anchovy_whole_group_3.webp"},
  tofu:{id:"tofu",label:"두부",icon:"⬜",asset:"assets/minigame/E11/food_tofu_kimchi_ingredient_tofu.webp"},
  kimchi:{id:"kimchi",label:"김치",icon:"🥬",asset:"assets/minigame/E11/food_tofu_kimchi_ingredient_kimchi.webp"},
  // 돼지고기 전용 원화가 없어 같은 화풍의 손질 전 고기 원물을 공용으로 사용합니다.
  pork:{id:"pork",label:"돼지고기",icon:"🥩",asset:"assets/minigame/E1/chicken-0.png"},
  flour:{id:"flour",label:"밀가루",icon:"🌾",asset:"assets/minigame/E8/02_food_pancake_flour_panel.webp"},
  water:{id:"water",label:"물",icon:"💧",asset:"assets/minigame/E8/03_food_water_cup_panel.webp"},
  chicken:{id:"chicken",label:"닭고기",icon:"🍗",asset:"assets/minigame/E8/food_skewer_chicken_group.webp"},
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

const FRIDGE_RECIPES=Object.freeze({
  oden:["fishCake","radish","greenOnion","anchovy"],
  tofu:["tofu","kimchi","pork"],
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

const INGREDIENT_BOARD_SIZE=12;
const INGREDIENT_HINT_DELAY=7000;
const INGREDIENT_ASSET_BASE=document.currentScript?.src||document.baseURI;
let ingredientHintTimer=null;

function ingredientRecipe(menuId){return FRIDGE_RECIPES[menuId]||[];}
function ingredientInfo(id){return FRIDGE_INGREDIENTS[id]||{id,label:id,icon:"·"};}
function ingredientArt(item,className=""){
  return item.asset
    ?`<img class="${className}" src="${new URL(item.asset,INGREDIENT_ASSET_BASE).href}" alt="" draggable="false" />`
    :`<span class="${className}">${item.icon}</span>`;
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

function ingredientBoardForMenus(menuIds=[]){
  const required=fridgeIngredientIdsForMenus(menuIds);
  const distractors=shuffle(Object.keys(FRIDGE_INGREDIENTS).filter(id=>fridgeIngredientId(id)&&!required.includes(id)));
  const boardSize=Math.max(INGREDIENT_BOARD_SIZE,required.length);
  return shuffle([...required,...distractors.slice(0,Math.max(0,boardSize-required.length))]);
}

function createIngredientSelectionState(menuIds=[]){
  return {picked:[],board:ingredientBoardForMenus(menuIds),hintedId:null};
}

function normalizeIngredientSelectionState(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT){
    if(!state.ingredientSelection)state.ingredientSelection=null;
    return;
  }
  const menus=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>ingredientRecipe(id).length):[];
  const saved=state.ingredientSelection&&typeof state.ingredientSelection==="object"?state.ingredientSelection:{};
  const required=fridgeIngredientIdsForMenus(menus);
  const picked=[...new Set(Array.isArray(saved.picked)?saved.picked.filter(id=>fridgeIngredientId(id)):[])];
  const savedBoard=Array.isArray(saved.board)?[...new Set(saved.board.filter(fridgeIngredientId))]:[];
  const board=savedBoard.length&&required.every(id=>savedBoard.includes(id))
    ?savedBoard
    :ingredientBoardForMenus(menus);
  state.ingredientSelection={picked,board,hintedId:board.includes(saved.hintedId)?saved.hintedId:null};
}

function currentIngredientRoundComplete(){
  const progress=state.ingredientSelection,required=allRequiredIngredientIds();
  return !!progress&&required.every(id=>progress.picked.includes(id));
}

function allRequiredIngredientIds(){
  return fridgeIngredientIdsForMenus(state.selectedMenus||[]);
}

function clearIngredientHintTimer(){
  clearTimeout(ingredientHintTimer);ingredientHintTimer=null;
}

function scheduleIngredientHint(){
  clearIngredientHintTimer();
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||currentIngredientRoundComplete())return;
  ingredientHintTimer=setTimeout(()=>{
    if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return;
    const progress=state.ingredientSelection;
    const missing=allRequiredIngredientIds().find(id=>!progress.picked.includes(id));
    if(!missing)return;
    progress.hintedId=missing;
    renderIngredientSelection();
    dom.ingredientSelectFeedback.textContent="천천히 찾아도 괜찮아요. 반짝이는 재료를 살펴보세요.";
  },INGREDIENT_HINT_DELAY);
}

function startIngredientSelection(){
  if(!Array.isArray(state.selectedMenus)||!state.selectedMenus.length)return false;
  clearIngredientHintTimer();
  const required=fridgeIngredientIdsForMenus(state.selectedMenus);
  dom.menuSelectOverlay.classList.remove("open");
  if(!required.length){
    state.phase=GAME_PHASES.PREP;state.phaseTime=null;state.paused=false;state.ingredientSelection=null;
    dom.ingredientSelectOverlay.classList.remove("open");
    showToast("냉장고에서 꺼낼 재료는 없어요. 바로 손질을 시작합니다.");
    updateUI(true);saveGame();
    return true;
  }
  state.phase=GAME_PHASES.INGREDIENT_SELECT;state.phaseTime=null;state.paused=false;
  state.ingredientSelection=createIngredientSelectionState(state.selectedMenus);
  dom.ingredientSelectOverlay.dataset.signature="";
  dom.ingredientSelectOverlay.classList.add("open");
  dom.ingredientSelectFeedback.textContent="필요한 재료를 눌러 장바구니에 담아보세요.";
  renderIngredientSelection();updateUI(true);saveGame();
  return true;
}

function selectIngredient(id,button=null){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||!FRIDGE_INGREDIENTS[id])return false;
  const progress=state.ingredientSelection,recipe=allRequiredIngredientIds();
  if(progress.picked.includes(id))return false;
  if(!recipe.includes(id)){
    dom.ingredientSelectFeedback.textContent=`${ingredientInfo(id).label}은(는) 오늘 메뉴에는 필요하지 않아요. 다른 재료를 골라볼까요?`;
    button?.classList.add("wrong");
    setTimeout(()=>button?.classList.remove("wrong"),420);
    scheduleIngredientHint();
    return false;
  }
  clearIngredientHintTimer();
  progress.picked.push(id);progress.hintedId=null;
  dom.ingredientSelectFeedback.textContent=`${ingredientInfo(id).label}, 좋아요! 장바구니에 담았어요.`;
  renderIngredientSelection();saveGame();
  if(!currentIngredientRoundComplete())scheduleIngredientHint();
  return true;
}

function continueIngredientSelection(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||!currentIngredientRoundComplete())return false;
  clearIngredientHintTimer();
  state.phase=GAME_PHASES.PREP;state.phaseTime=null;
  dom.ingredientSelectOverlay.classList.remove("open");
  showToast("필요한 재료를 모두 챙겼어요. 이제 손질을 시작해볼까요?");
  updateUI(true);saveGame();
  return true;
}

function renderIngredientSelection(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return;
  normalizeIngredientSelectionState();
  const progress=state.ingredientSelection,dishes=(state.selectedMenus||[]).map(dishById).filter(Boolean);
  if(!dishes.length)return;
  const picked=new Set(progress.picked);
  const allRequired=allRequiredIngredientIds(),pickedRequired=allRequired.filter(id=>picked.has(id));
  const pantry=pantryIngredientIdsForMenus(state.selectedMenus||[]);
  const signature=[state.day,state.selectedMenus.join(","),progress.picked.join(","),progress.board.join(","),progress.hintedId||""].join("|");
  if(dom.ingredientSelectOverlay.dataset.signature===signature){
    dom.ingredientSelectOverlay.classList.add("open");
    return;
  }
  dom.ingredientSelectOverlay.dataset.signature=signature;
  dom.ingredientDishProgress.textContent=`메뉴 ${dishes.length}개`;
  dom.ingredientDishName.textContent="오늘 메뉴 한꺼번에 챙기기";
  dom.ingredientDishGallery.innerHTML=dishes.map(dish=>`<span><img src="${foodPropUrl(dish.id)||""}" alt="" /><strong>${dish.name}</strong></span>`).join("");
  dom.ingredientChecklist.innerHTML=allRequired.map(id=>{
    const item=ingredientInfo(id),done=picked.has(id);
    return `<div class="ingredient-check-item ${done?"done":""}"><span>${done?"✓":"○"}</span><strong>${item.label}</strong></div>`;
  }).join("");
  dom.ingredientPantryNote.innerHTML=pantry.length
    ?`<strong>냉장고 밖에 준비됨</strong><span>${pantry.map(id=>ingredientInfo(id).label).join(" · ")}</span>`
    :"";
  dom.ingredientGrid.innerHTML=progress.board.map(id=>{
    const item=ingredientInfo(id),selected=picked.has(id),hinted=progress.hintedId===id;
    return `<button class="ingredient-choice ${selected?"selected":""} ${hinted?"hint":""}" data-ingredient-id="${id}" type="button" ${selected?"disabled":""} aria-pressed="${selected}"><span class="ingredient-choice-art" aria-hidden="true">${ingredientArt(item)}</span><strong>${item.label}</strong>${selected?"<i>담았어요</i>":""}</button>`;
  }).join("");
  dom.ingredientGrid.querySelectorAll("[data-ingredient-id]").forEach(button=>button.addEventListener("click",()=>selectIngredient(button.dataset.ingredientId,button)));
  dom.ingredientBasket.innerHTML=pickedRequired.length?pickedRequired.map(id=>{
    const item=ingredientInfo(id);return `<span><i>${ingredientArt(item,"ingredient-basket-art")}</i>${item.label}</span>`;
  }).join(""):"<p>아직 담은 재료가 없어요.</p>";
  dom.ingredientTotalProgress.textContent=`전체 ${pickedRequired.length} / ${allRequired.length}`;
  const complete=currentIngredientRoundComplete();
  dom.ingredientSelectContinue.disabled=!complete;
  dom.ingredientSelectContinue.textContent="재료 준비 시작";
  if(complete)dom.ingredientSelectFeedback.textContent="오늘 메뉴에 필요한 냉장 재료를 모두 골랐어요!";
  dom.ingredientSelectOverlay.classList.add("open");
  if(!complete&&!ingredientHintTimer)scheduleIngredientHint();
}
