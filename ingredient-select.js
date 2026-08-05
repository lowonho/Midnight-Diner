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

   [그림]
   이제 전부 원화가 있습니다. 요리에 쓰는 재료는 각 조리 미니게임의 원화를
   그대로 빌려 쓰고, 냉장고에서만 보이는 재료 13종은 assets/minigame/E13 의
   전용 원화입니다. (원화가 없던 시절 쓰던 임시 CSS 도형은 걷어냈습니다 —
   그림도 도형도 없는 항목이 생기면 아래 ingredientArt 가 이모지로 버팁니다)

   [고르는 기준 두 가지]
   1. **손질 전 모습만 씁니다.** 냉장고는 요리를 시작하기 전이라, 우리 조리
      과정에서 이미 썰린 그림(E11 두부 5쪽 · E11 썬 김치 · E8 깍둑 닭 정육 ·
      E3 썬 모둠채소)은 넣지 않습니다. 통두부(E1) · 통김치(E1)처럼 통짜 그림이
      있으면 그쪽을 씁니다.
   2. **길쭉한 원화는 비스듬히 눕힙니다.** 가로:세로가 2 이상이면 `long:true` 를
      주어 45도쯤 기울여 놓습니다(css 의 .fridge-art.laid).
      좁은 칸(76 x 110)에 그대로 눕히면 손톱만 해지고, 90도로 세우면
      김치와 생선이 차렷 자세로 서 있어 우스꽝스럽습니다. 칸막이가 없는
      냉장고라 옆 재료와 조금 겹쳐도 괜찮습니다 — 오히려 아무렇게나
      넣어 둔 것처럼 보입니다. 두부는 판이라 눕힌 그대로 둡니다.

   [크기 — `size`]
   칸을 똑같이 나눠 쓰면 배추 한 통과 양파 한 알이 같은 크기로 보입니다.
   그래서 재료마다 **실물 크기 비**를 배율로 갖습니다(1 = 두부 한 모쯤).
     1.35 배추                       1.20 양배추
     1.15 오징어 · 고등어 · 단호박   1.05 옥수수 · 대파 다발
     1.00 두부 · 다시마 · 소고기 · 무
     0.95 어묵 · 당근 · 청경채 · 느타리 · 통김치
     0.90 우동면 · 떡 · 팽이         0.85 계란 · 닭고기 · 새우
     0.80 양파 · 소시지 · 계란물     0.75 감자
     0.62 멸치
   ⚠️ 눕히는 재료(`long`)는 같은 배율이라도 **더 커 보입니다** — 칸 폭이 아니라
      칸 높이를 기준으로 크기를 잡기 때문입니다(css 의 .laid 는 105cqh).
      무·대파·통김치가 처음에 1.3~1.35 였는데 혼자 튀어서 1 언저리로 내렸습니다.
   칸보다 커지는 재료는 옆·위로 넘칩니다. 칸막이가 없어 자연스럽고,
   넘친 부분도 자기 그림 위를 누르면 자기가 잡힙니다.
   ============================================================ */

const FRIDGE_INGREDIENTS=Object.freeze({
  fishCake:{id:"fishCake",label:"어묵",icon:"🍢",asset:"assets/minigame/E1/fish-cake-0.png",size:.95},
  radish:{id:"radish",label:"무",icon:"🥕",asset:"assets/minigame/E1/radish-0.png",long:true,lean:1,drop:11,size:1},
  greenOnion:{id:"greenOnion",label:"대파",icon:"🌿",asset:"assets/minigame/E1/green-onion-0.png",long:true,lean:1,drop:0,size:1.05},
  anchovy:{id:"anchovy",label:"멸치",icon:"🐟",asset:"assets/minigame/E10/food_anchovy_whole_group_3.webp",long:true,lean:1,drop:18,size:.62},
  // 두부·김치는 E11(두부김치) 그림이 이미 썰린 모습이라 E1 썰기 게임의 통짜 그림을 씁니다.
  tofu:{id:"tofu",label:"두부",icon:"⬜",asset:"assets/minigame/E1/tofu-0.png",size:1},
  kimchi:{id:"kimchi",label:"김치",icon:"🥬",asset:"assets/minigame/E1/kimchi-0.png",long:true,lean:-1,drop:12,size:.95},
  flour:{id:"flour",label:"밀가루",icon:"🌾",asset:"assets/minigame/E8/02_food_pancake_flour_panel.webp"},
  water:{id:"water",label:"물",icon:"💧",asset:"assets/minigame/E8/03_food_water_cup_panel.webp"},
  chicken:{id:"chicken",label:"닭고기",icon:"🍗",asset:"assets/minigame/E1/chicken-0.png",long:true,lean:-1,drop:13,size:.85},
  udon:{id:"udon",label:"우동면",icon:"🍜",asset:"assets/minigame/E3/food_udon_noodles.webp",size:.9},
  cabbage:{id:"cabbage",label:"양배추",icon:"🥬",asset:"assets/minigame/E2/food_cabbage_ingredient.webp",size:1.2},
  carrot:{id:"carrot",label:"당근",icon:"🥕",asset:"assets/minigame/E2/food_carrot_ingredient.webp",size:.95},
  yakisobaSauce:{id:"yakisobaSauce",label:"볶음우동 소스",icon:"🫙",asset:"assets/minigame/E3/food_udon_sauce.webp"},
  shrimp:{id:"shrimp",label:"새우",icon:"🍤",asset:"assets/minigame/E2/shrimp/food_shrimp_raw.webp",size:.85},
  egg:{id:"egg",label:"계란물",icon:"🥚",asset:"assets/minigame/E2/shrimp/food_egg_wash_panel.webp",size:.8},
  breadcrumbs:{id:"breadcrumbs",label:"빵가루",icon:"🍞",asset:"assets/minigame/E2/shrimp/food_wet_breadcrumbs_panel.webp"},
  tteok:{id:"tteok",label:"떡",icon:"🍚",asset:"assets/minigame/E8/Soaking/food_soak_tteok_ingredient_bowl.webp",size:.9},
  gochujang:{id:"gochujang",label:"고추장",icon:"🌶️",asset:"assets/minigame/E7/food_tteokbokki_gochujang_play_open.webp"},
  potato:{id:"potato",label:"감자",icon:"🥔",asset:"assets/minigame/E2/food_potato_ingredient.png"},
  oil:{id:"oil",label:"식용유",icon:"🫗",asset:"assets/minigame/E7/food_yakisoba_chili_oil_play_labeled.webp"},
  starch:{id:"starch",label:"전분",icon:"🥣",asset:"assets/minigame/E2/fries/food_frying_powder_panel.webp"}
});

/* 냉장고를 채우는 용도로만 쓰는 재료입니다(목표가 되지 않습니다).
   ⚠️ 여기 id 를 레시피(FRIDGE_RECIPES)에 쓰면 안 됩니다 — 목표로 잡히지 않습니다.
      요리에 쓰게 되면 위 FRIDGE_INGREDIENTS 로 옮기세요.
   ⚠️ **위 표에 있는 재료와 같은 것을 또 넣지 마세요.** 당근·양배추를 여기에도
      두었더니 한 냉장고에 그림이 다른 당근이 두 개 들어가 있었습니다(둘 다 진짜
      당근인데 하나만 정답이라 더 나쁩니다). 위 표에 없는 재료만 넣습니다 —
      감자·멸치는 상온 재료라 목표가 되지 않아서 여기 있어도 겹치지 않습니다. */
const FRIDGE_EXTRAS=Object.freeze({
  potatoRaw:{id:"potatoRaw",label:"감자",asset:"assets/minigame/E2/food_potato_whole_01.webp",size:.75},
  anchovyBox:{id:"anchovyBox",label:"멸치",asset:"assets/minigame/E10/food_anchovy_whole_group_3.webp",long:true,lean:1,drop:18,size:.62},
  // ⚠️ E3 모둠채소(썬 것) · E8 닭 정육(깍둑 썬 것)은 손질 뒤 그림이라 뺐습니다.
  // 아래 13종은 냉장고 전용 원화입니다(assets/minigame/E13). 전부 손질 전 통짜이고
  // 가로:세로가 0.84~1.39 라 눕힐 것이 없습니다.
  onion:{id:"onion",label:"양파",asset:"assets/minigame/E13/food_onion_ingredient.png",size:.8},
  eggBasket:{id:"eggBasket",label:"계란",asset:"assets/minigame/E13/food_egg_ingredient.png",size:.85},
  sausage:{id:"sausage",label:"소시지",asset:"assets/minigame/E13/food_sausage_ingredient.png",size:.8},
  squid:{id:"squid",label:"오징어",asset:"assets/minigame/E13/food_squid_ingredient.png",size:1.15},
  kelp:{id:"kelp",label:"다시마",asset:"assets/minigame/E13/food_kelp_ingredient.png",size:1},
  mackerel:{id:"mackerel",label:"고등어",asset:"assets/minigame/E13/food_mackerel_ingredient.png",size:1.15},
  corn:{id:"corn",label:"옥수수",asset:"assets/minigame/E13/food_corn_ingredient.png",size:1.05},
  beef:{id:"beef",label:"소고기",asset:"assets/minigame/E13/food_beef_ingredient.png",size:1},
  bokchoy:{id:"bokchoy",label:"청경채",asset:"assets/minigame/E13/food_bok_choy_ingredient.png",size:.95},
  napa:{id:"napa",label:"배추",asset:"assets/minigame/E13/food_napa_cabbage_ingredient.png",size:1.35},
  mushroom:{id:"mushroom",label:"느타리버섯",asset:"assets/minigame/E13/food_oyster_mushroom_ingredient.png",size:.95},
  enoki:{id:"enoki",label:"팽이버섯",asset:"assets/minigame/E13/food_enoki_ingredient.png",size:.9},
  pumpkin:{id:"pumpkin",label:"단호박",asset:"assets/minigame/E13/food_kabocha_ingredient.png",size:1.15}
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
let ingredientColdAirId=null;

/* ---- 냉기 ------------------------------------------------------
   냉장고 안에 2~3덩이가 아무 데나 떠서 천천히 흐릅니다. 그림은 5장 연속입니다
   (assets/minigame/E13/fx_cold_air_anim_01~05).
   ⚠️ 다섯 장의 캔버스 크기가 다릅니다(351x178 ~ 559x429). 한 상자에 꽉 채워
      깔면 장마다 다르게 늘어나 덩이가 들썩입니다. 가장 큰 04 를 기준으로 각
      장의 상대 크기를 css 가 갖고 있고(.fridge-cold-frame.frame-*), 여기서는
      자리·크기·시작 박자만 정합니다. */
const FRIDGE_COLD_AIR_FRAMES=5;
const FRIDGE_COLD_AIR_CYCLE=1.3;           // 그림 5장이 한 바퀴 도는 시간(초) — css 의 --cold-cycle 과 같아야 합니다
const FRIDGE_COLD_AIR_LIFE=3.4;            // 한 덩이가 떴다가 사라지기까지(초) — css 의 --cold-life 와 같아야 합니다
const FRIDGE_COLD_AIR_STAGGER=1.5;         // 덩이마다 뜨는 시각을 어긋내는 최대 폭(초)
const FRIDGE_COLD_AIR_REST=1.2;            // 다 사라진 뒤 다음 무리가 뜨기까지(초)

/* 냉기가 뜨는 구역. 플레이 칸을 3 x 2 로 나눠 **서로 다른 구역**에 하나씩 놓습니다.
   그냥 무작위로 뽑으면 두세 덩이가 한쪽에 뭉쳐 나오는 판이 자주 나옵니다.
   각 값은 [왼쪽 최소, 최대, 위 최소, 최대] (%) 입니다. */
const FRIDGE_COLD_AIR_ZONES=Object.freeze([
  [4,26,6,34],[34,52,6,34],[60,84,6,34],
  [4,26,40,72],[34,52,40,72],[60,84,40,72]
]);

function fridgeColdAirMarkup(){
  const frames=Array.from({length:FRIDGE_COLD_AIR_FRAMES},(_,index)=>{
    const file=`assets/minigame/E13/fx_cold_air_anim_0${index+1}.png`;
    return `<img class="fridge-cold-frame frame-${index+1}" src="${new URL(file,INGREDIENT_ASSET_BASE).href}" alt="" />`;
  }).join("");
  const count=2+Math.floor(Math.random()*2);                 // 2~3덩이 (무리마다 다시 뽑습니다)
  return shuffle(FRIDGE_COLD_AIR_ZONES).slice(0,count).map(([x0,x1,y0,y1])=>{
    const left=x0+Math.random()*(x1-x0),top=y0+Math.random()*(y1-y0);
    const size=9+Math.random()*7;                             // 칸 폭의 9~16%
    const delay=-(Math.random()*FRIDGE_COLD_AIR_CYCLE);       // 덩이마다 다른 장에서 시작
    const life=Math.random()*FRIDGE_COLD_AIR_STAGGER;         // 뜨는 시각도 덩이마다 어긋냅니다
    return `<span class="fridge-cold-puff" style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%;width:${size.toFixed(1)}%;--cold-delay:${delay.toFixed(2)}s;--cold-life-delay:${life.toFixed(2)}s;--cold-flip:${Math.random()>.5?-1:1}">${frames}</span>`;
  }).join("");
}

/* 한 무리(2~3덩이)가 떴다가 사라지면 **자리와 개수를 다시 뽑아** 다음 무리를 띄웁니다.
   한 번 뿌리고 두면 같은 자리에서만 계속 김이 나 스티커처럼 보입니다.
   ⚠️ renderIngredientSelection 에서 부르면 안 됩니다 — 재료를 하나 찾을 때마다
      무리가 초기화되어 냉기가 순간이동합니다. 시작할 때 한 번 걸고 두면 됩니다. */
function stopFridgeColdAir(){
  clearInterval(ingredientColdAirId);ingredientColdAirId=null;
}

function startFridgeColdAir(){
  if(!dom.fridgeColdAir)return;
  stopFridgeColdAir();
  dom.fridgeColdAir.innerHTML=fridgeColdAirMarkup();
  ingredientColdAirId=setInterval(()=>{
    if(state.phase!==GAME_PHASES.INGREDIENT_SELECT||!dom.fridgeColdAir){stopFridgeColdAir();return;}
    dom.fridgeColdAir.innerHTML=fridgeColdAirMarkup();
  },(FRIDGE_COLD_AIR_LIFE+FRIDGE_COLD_AIR_STAGGER+FRIDGE_COLD_AIR_REST)*1000);
}

function ingredientRecipe(menuId){return FRIDGE_RECIPES[menuId]||[];}
function ingredientInfo(id){return FRIDGE_INGREDIENTS[id]||FRIDGE_EXTRAS[id]||{id,label:id,icon:"·"};}

/* 재료 한 칸의 그림. 원화가 없으면 이모지로 버팁니다.
   `laid`(길쭉한 재료 눕히기)는 냉장고 칸(.fridge-art)에서만 먹습니다 —
   오른쪽 '찾아야 할 재료' 목록은 className 이 달라 그림 방향 그대로 나옵니다(css 참고). */
function ingredientArt(item,className="fridge-art"){
  const laid=item.long?" laid":"";
  if(item.asset)return `<img class="${className}${laid}" src="${new URL(item.asset,INGREDIENT_ASSET_BASE).href}" alt="" draggable="false" />`;
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
  stopFridgeColdAir();
}

function startIngredientTimer(){
  // ⚠️ 여기서 stopIngredientTimer() 를 부르면 안 됩니다 — 그 함수는 냉기 무리까지
  //    같이 끕니다. 냉기는 판이 열릴 때 한 번 걸리는데, 이 함수가 그 뒤에 불려서
  //    조용히 꺼져 버렸습니다(냉기가 첫 무리에서 멈춰 있던 원인). 시계만 갈아 끕니다.
  clearInterval(ingredientTimerId);
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
  startFridgeColdAir();                      // 냉기는 여기서만 겁니다(무리마다 자리·개수를 다시 뽑습니다)
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
  const {result,id,complete,penalty}=e13Pick(progress,slotIndex);
  const item=ingredientInfo(id);
  if(result==="empty")return false;
  if(result==="wrong"){
    // 벌칙은 걸린 시간 +3초뿐입니다(engine 이 이미 더했습니다). 숫자를 바로 갱신해
    // "왜 시간이 뛰었지?" 하지 않게 카드도 잠깐 빨갛게 깜빡입니다.
    dom.ingredientSelectFeedback.textContent=`${item.label}은(는) 오늘 쓰지 않아요. (+${penalty}초)`;
    audio.bad?.();
    updateIngredientTimeText();
    showFridgePenalty(penalty);
    flashIngredientSlot(slotIndex,"wrong");
    dom.ingredientTimer?.classList.remove("penalty");
    void dom.ingredientTimer?.offsetWidth;
    dom.ingredientTimer?.classList.add("penalty");
    saveGame();
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

/* 벌칙 안내. 냉장고 한가운데에 "+3초"가 떠올랐다 사라집니다.
   우측 카드의 숫자만 바꾸면 시계를 안 보고 있던 사람은 뭐가 벌어졌는지 모릅니다.
   한 장을 만들어 두고 누를 때마다 애니메이션만 되감습니다(계속 쌓이지 않게). */
function showFridgePenalty(seconds){
  const cabinet=dom.ingredientGrid?.closest(".fridge-cabinet");
  if(!cabinet)return;
  let tag=cabinet.querySelector(".fridge-penalty");
  if(!tag){
    tag=document.createElement("span");
    tag.className="fridge-penalty";
    tag.setAttribute("aria-hidden","true");
    cabinet.appendChild(tag);
  }
  tag.textContent=`+${seconds}초`;
  tag.classList.remove("show");void tag.offsetWidth;tag.classList.add("show");
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
/* 칸마다 조금씩 다르게 앉히기.
   ⚠️ **기울이는 것은 길쭉한 재료뿐입니다.** 두부·양파·계란처럼 정면으로 놓여야
      할 재료를 조금이라도 돌리면 삐뚤어져 보입니다 — 나머지는 좌우 위치만 흔듭니다.
   기우는 방향은 재료가 정합니다(`lean`). 무·대파·멸치는 잎과 머리가 위로 가야 하고
   (원화 왼쪽이 위 = +1), 김치는 밑동이 아래로 가야 합니다(-1).
   안 정해 두면 칸 번호에서 아무 방향이나 뽑습니다. */
/* 냉장고 벽·가운데 기둥에 붙은 열(1 · 4 · 6 · 9)은 재료를 안쪽으로 밀어 넣습니다.
   재료가 칸보다 크게 그려지는데(실물 크기 비 · 45도 눕히기), 바깥 열에서는 그 넘치는
   만큼이 **벽 밖으로** 나가 문짝 위에 떠 보입니다. 값은 칸 폭의 %입니다. */
const FRIDGE_EDGE_NUDGE=Object.freeze({1:16,4:-16,6:16,9:-16});

function ingredientSlotPose(slotIndex,id="",item={},column=0){
  const seed=(slotIndex*7919+[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)*131)%1000;
  const direction=item.lean||(seed%2?1:-1);
  const nudge=FRIDGE_EDGE_NUDGE[column];
  if(nudge!==undefined)return {
    lean:item.long?(38+(seed%15))*direction:0,
    drop:item.long?(item.drop??11):0,
    shift:nudge,
    scale:.9+((seed>>6)%13)/100
  };
  return {
    lean:item.long?(38+(seed%15))*direction:0,   // 38~52도 (정면 재료는 0)
    drop:item.long?(item.drop??11):0,            // 눕힌 재료를 선반 쪽으로 더 내리는 양(칸 높이 %)
    shift:((seed>>3)%9)-4,                       // 좌우 -4 ~ 4%
    scale:.9+((seed>>6)%13)/100                  // 0.90 ~ 1.02배
  };
}

function ingredientSlotMarkup(id,index){
  const {row,column,side}=e13SlotCell(index);
  const place=`grid-row:${row};grid-column:${column}`;
  if(!id)return `<span class="fridge-slot empty" style="${place}" data-slot="${index}" aria-hidden="true"></span>`;
  const item=ingredientInfo(id),pose=ingredientSlotPose(index,id,item,column);
  return `<button class="fridge-slot" style="${place};--slot-shift:${pose.shift}%;--slot-scale:${pose.scale};--art-turn:${pose.lean}deg;--art-drop:${pose.drop}%;--art-size:${item.size||1}" data-slot="${index}" data-side="${side}" type="button" aria-label="${item.label}">
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

  // 좌 : 오늘의 요리 — 그림만 놓습니다(이름은 aria-label 로만 남깁니다)
  dom.ingredientDishGallery.innerHTML=dishes.map(dish=>
    `<div class="fridge-dish" role="img" aria-label="${dish.name}" title="${dish.name}"><img src="${foodPropUrl(dish.id)||""}" alt="" /></div>`
  ).join("");

  // 중 : 냉장고 24칸 (+ 이어서 뜨는 냉기. 이미 떠 있으면 그대로 둡니다)
  dom.ingredientGrid.innerHTML=progress.slots.map(ingredientSlotMarkup).join("");
  bindIngredientSlots();
  if(!ingredientColdAirId)startFridgeColdAir();   // 세이브에서 바로 들어온 경우를 위한 보험

  // 우 위 : 완료 개수 · 걸린 시간
  dom.ingredientTotalProgress.innerHTML=`<b>${progress.found.length}</b> / ${required.length}`;
  updateIngredientTimeText();

  // 우 아래 : 찾아야 할 재료 — 여기도 그림만 놓습니다.
  // 7가지가 넘어가면 3열로 나눕니다. 2열로 두면 칸이 납작해져 아이콘이 손톱만 해집니다.
  dom.ingredientChecklist.style.setProperty("--goal-columns",required.length>6?3:2);
  dom.ingredientChecklist.innerHTML=required.map(id=>{
    const item=ingredientInfo(id),done=found.has(id);
    // 재료 이름에서 뽑은 -6~6도. 값이 고정이라 하나 찾을 때마다 아이콘이 튀지 않습니다.
    // ⚠️ 더 기울이면 회전한 그림의 상자가 커져서 가장자리 아이콘이 목록 밖으로 잘립니다.
    const turn=([...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%13)-6;
    // 길쭉한 재료는 여기서도 냉장고처럼 45도로 눕힙니다(방향은 냉장고와 같은 lean).
    const lean=item.long?45*(item.lean||1):0;
    return `<div class="fridge-goal ${done?"done":""}" style="--goal-turn:${turn}deg;--goal-lean:${lean}deg" role="img" aria-label="${item.label}${done?" (찾음)":""}" title="${item.label}">${ingredientArt(item,"fridge-goal-art")}</div>`;
  }).join("");

  // (좌 패널 아래에 있던 '냉장고 밖에 준비됨' 줄은 뺐습니다 — 플레이에 쓸 일이 없는 정보입니다.
  //  상온 재료 목록이 다시 필요하면 pantryIngredientIdsForMenus 로 뽑을 수 있습니다.)

  dom.ingredientSelectOverlay.classList.add("open");
  if(!e13Complete(progress)&&!ingredientTimerId)startIngredientTimer();
}
