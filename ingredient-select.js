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
  flour:{id:"flour",label:"밀가루",icon:"🌾",asset:"assets/minigame/E8/02_food_pancake_flour_panel.webp"},
  water:{id:"water",label:"물",icon:"💧",asset:"assets/minigame/E8/03_food_water_cup_panel.webp"},
  chicken:{id:"chicken",label:"닭고기",icon:"🍗",asset:"assets/minigame/E1/chicken-0.png"},
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

function createIngredientSelectionState(menuIds=[]){
  return e13CreateProgress(fridgeIngredientIdsForMenus(menuIds));
}

function normalizeIngredientSelectionState(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT){
    if(!state.ingredientSelection)state.ingredientSelection=null;
    return;
  }
  const menus=Array.isArray(state.selectedMenus)?state.selectedMenus.filter(id=>ingredientRecipe(id).length):[];
  const saved=state.ingredientSelection&&typeof state.ingredientSelection==="object"?state.ingredientSelection:{};
  const required=fridgeIngredientIdsForMenus(menus);
  state.ingredientSelection=e13NormalizeProgress(saved,required);
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
    const move=e13FindHint(progress);
    if(!move)return;
    progress.hintedMove=move;
    renderIngredientSelection();
    dom.ingredientSelectFeedback.textContent="반짝이는 재료를 직접 잡아 표시된 칸으로 옮겨보세요.";
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
  dom.ingredientSelectFeedback.textContent=state.ingredientSelection.queue.length
    ?"재료를 맞춰 자리를 비우면 뒤쪽에 놓인 재료가 같은 냉장고 안에서 앞으로 나와요."
    :"재료 그림을 직접 잡아 원하는 냉장고 칸으로 옮겨보세요.";
  renderIngredientSelection();updateUI(true);saveGame();
  return true;
}

function moveIngredientAsset(fromShelf,fromSlot,toShelf){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return false;
  const progress=state.ingredientSelection,result=e13Move(progress,fromShelf,fromSlot,toShelf);
  clearIngredientHintTimer();
  if(!result.moved){
    dom.ingredientSelectFeedback.textContent="재료가 가득 찬 칸에는 더 놓을 수 없어요. 다른 칸을 골라주세요.";
    scheduleIngredientHint();
    return false;
  }
  if(result.revealedId){
    dom.ingredientSelectFeedback.textContent=`${ingredientInfo(result.matchedId).label} 3개 완성! 뒤에 있던 ${ingredientInfo(result.revealedId).label}이(가) 앞으로 나왔어요.`;
  }else if(result.matchedId){
    dom.ingredientSelectFeedback.textContent=`${ingredientInfo(result.matchedId).label} 3개 완성! 장바구니에 담았어요.`;
  }else{
    dom.ingredientSelectFeedback.textContent="좋아요. 같은 재료 3개를 모아 필요한 재료를 계속 꺼내보세요.";
  }
  renderIngredientSelection();saveGame();
  if(!currentIngredientRoundComplete())scheduleIngredientHint();
  return true;
}

function selectIngredientAsset(shelfIndex,slotIndex){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return false;
  const progress=state.ingredientSelection,id=progress?.shelves?.[shelfIndex]?.[slotIndex];
  if(!id)return false;
  clearIngredientHintTimer();
  const selected=progress.selectedAsset;
  if(selected&&selected.shelf!==shelfIndex)return moveIngredientAsset(selected.shelf,selected.slot,shelfIndex);
  if(selected&&selected.shelf===shelfIndex&&selected.slot===slotIndex){
    progress.selectedAsset=null;progress.hintedMove=null;
    dom.ingredientSelectFeedback.textContent="선택을 취소했어요. 다른 재료를 잡아도 좋아요.";
  }else{
    progress.selectedAsset={shelf:shelfIndex,slot:slotIndex};progress.hintedMove=null;
    dom.ingredientSelectFeedback.textContent=`${ingredientInfo(id).label}을(를) 잡았어요. 옮길 냉장고 칸을 눌러주세요.`;
  }
  renderIngredientSelection();scheduleIngredientHint();
  return true;
}

function moveSelectedIngredientToShelf(toShelf){
  const selected=state.ingredientSelection?.selectedAsset;
  if(!selected){
    dom.ingredientSelectFeedback.textContent="먼저 옮길 재료 그림을 직접 골라주세요.";
    scheduleIngredientHint();
    return false;
  }
  return moveIngredientAsset(selected.shelf,selected.slot,toShelf);
}

function bindIngredientAssetMovement(){
  dom.ingredientGrid.querySelectorAll("[data-asset-shelf]").forEach(asset=>{
    asset.addEventListener("click",event=>{
      event.stopPropagation();
      selectIngredientAsset(Number(asset.dataset.assetShelf),Number(asset.dataset.assetSlot));
    });
    asset.addEventListener("dragstart",event=>{
      event.dataTransfer.effectAllowed="move";
      event.dataTransfer.setData("text/plain",`${asset.dataset.assetShelf}:${asset.dataset.assetSlot}`);
      asset.classList.add("dragging");
    });
    asset.addEventListener("dragend",()=>{
      asset.classList.remove("dragging");
      dom.ingredientGrid.querySelectorAll(".drag-over").forEach(shelf=>shelf.classList.remove("drag-over"));
    });
  });
  dom.ingredientGrid.querySelectorAll("[data-shelf-target]").forEach(shelf=>{
    const toShelf=Number(shelf.dataset.shelfTarget);
    shelf.addEventListener("click",()=>moveSelectedIngredientToShelf(toShelf));
    shelf.addEventListener("keydown",event=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      event.preventDefault();moveSelectedIngredientToShelf(toShelf);
    });
    shelf.addEventListener("dragover",event=>{event.preventDefault();event.dataTransfer.dropEffect="move";shelf.classList.add("drag-over");});
    shelf.addEventListener("dragleave",event=>{if(!shelf.contains(event.relatedTarget))shelf.classList.remove("drag-over");});
    shelf.addEventListener("drop",event=>{
      event.preventDefault();shelf.classList.remove("drag-over");
      const [fromShelf,fromSlot]=event.dataTransfer.getData("text/plain").split(":").map(Number);
      moveIngredientAsset(fromShelf,fromSlot,toShelf);
    });
  });
}

function undoIngredientMove(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||!e13Undo(state.ingredientSelection))return false;
  clearIngredientHintTimer();
  dom.ingredientSelectFeedback.textContent="바로 전 상태로 되돌렸어요.";
  renderIngredientSelection();saveGame();scheduleIngredientHint();
  return true;
}

function shuffleIngredientShelves(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||!e13Shuffle(state.ingredientSelection,allRequiredIngredientIds()))return false;
  clearIngredientHintTimer();
  dom.ingredientSelectFeedback.textContent="남은 재료를 다시 섞었어요. 천천히 이어가세요.";
  renderIngredientSelection();saveGame();scheduleIngredientHint();
  return true;
}

function hintIngredientMove(){
  if(state.phase!==GAME_PHASES.INGREDIENT_SELECT)return false;
  const move=e13FindHint(state.ingredientSelection);
  if(!move)return false;
  clearIngredientHintTimer();
  state.ingredientSelection.hintedMove=move;
  dom.ingredientSelectFeedback.textContent="반짝이는 재료를 표시된 칸으로 옮겨보세요.";
  renderIngredientSelection();scheduleIngredientHint();
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
  const signature=[
    state.day,
    state.selectedMenus.join(","),
    progress.picked.join(","),
    progress.shelves.map(shelf=>shelf.join(",")).join("/"),
    progress.selectedAsset?`${progress.selectedAsset.shelf}:${progress.selectedAsset.slot}`:"",
    progress.hintedMove?`${progress.hintedMove.fromShelf}:${progress.hintedMove.fromSlot}>${progress.hintedMove.toShelf}`:""
  ].join("|");
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
  dom.ingredientGrid.innerHTML=progress.shelves.map((shelf,index)=>{
    const hintedTo=progress.hintedMove?.toShelf===index;
    const slots=Array.from({length:E13_FRIDGE_SORT.matchSize},(_,slotIndex)=>{
      const id=shelf[slotIndex];
      if(!id)return `<span class="ingredient-shelf-slot empty" aria-hidden="true"></span>`;
      const item=ingredientInfo(id);
      const selected=progress.selectedAsset?.shelf===index&&progress.selectedAsset?.slot===slotIndex;
      const hintedFrom=progress.hintedMove?.fromShelf===index&&progress.hintedMove?.fromSlot===slotIndex;
      return `<button class="ingredient-shelf-slot ${selected?"selected":""} ${hintedFrom?"hint-from":""}" data-asset-shelf="${index}" data-asset-slot="${slotIndex}" type="button" draggable="true" aria-pressed="${selected}" aria-label="${item.label} 옮기기" title="${item.label}을(를) 잡아 옮기기"><i>${ingredientArt(item)}</i><small>${item.label}</small></button>`;
    }).join("");
    const names=shelf.map(id=>ingredientInfo(id).label).join(", ");
    const label=shelf.length?`${names} 재료가 있는 ${index+1}번 냉장고 칸`:`빈 ${index+1}번 냉장고 칸`;
    return `<div class="ingredient-shelf ${hintedTo?"hint-to":""}" data-shelf-target="${index}" role="button" tabindex="0" aria-label="${label}"><b>${index+1}</b><span class="ingredient-shelf-slots">${slots}</span></div>`;
  }).join("");
  bindIngredientAssetMovement();
  dom.ingredientBasket.innerHTML=pickedRequired.length?pickedRequired.map(id=>{
    const item=ingredientInfo(id);return `<span><i>${ingredientArt(item,"ingredient-basket-art")}</i>${item.label}</span>`;
  }).join(""):"<p>아직 담은 재료가 없어요.</p>";
  dom.ingredientTotalProgress.textContent=`전체 ${pickedRequired.length} / ${allRequired.length}`;
  const complete=currentIngredientRoundComplete();
  dom.ingredientUndo.disabled=!progress.history.length;
  dom.ingredientHint.disabled=complete;
  dom.ingredientShuffle.disabled=complete;
  dom.ingredientUndo.onclick=undoIngredientMove;
  dom.ingredientHint.onclick=hintIngredientMove;
  dom.ingredientShuffle.onclick=shuffleIngredientShelves;
  dom.ingredientSelectContinue.disabled=!complete;
  dom.ingredientSelectContinue.textContent="재료 준비 시작";
  if(complete)dom.ingredientSelectFeedback.textContent="오늘 메뉴에 필요한 냉장 재료를 모두 골랐어요!";
  dom.ingredientSelectOverlay.classList.add("open");
  if(!complete&&!ingredientHintTimer)scheduleIngredientHint();
}
