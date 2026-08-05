"use strict";

/* ============================================================
   E5 양면 굽기 — 밤 조리 "twoSideCook"   ※ 마우스 전용입니다

   [예전 방식과 무엇이 다른가]
   예전에는 아래에 익힘 게이지 한 줄이 있고, 포인터가 초록/금색 구간에 들어올 때
   Space 를 눌렀습니다. 뒤집기도 김치전 ↑꾹→↓ · 닭꼬치 ←→ 연타였습니다.
   지금은 **게이지도 키보드도 없습니다.** 재료에 신호가 뜨고, 마우스로 답합니다.
     · 익힘 신호(노란 불빛)  → 재료를 **클릭**   → "치이익" 하고 그 면이 익습니다
     · 뒤집기 신호(흰 불빛)  → 재료를 **드래그** → 김치전은 위로 튕기듯, 닭꼬치는 옆으로
     · 양념 신호(붉은 불빛)  → 꼬치를 **클릭**   → 붓이 들어와 양념을 바릅니다 (닭꼬치만)

   [한 판의 구성]  **자루(unit)마다 자기 할 일 목록을 하나씩 소화합니다.**
     김치전 : 자루 1개(팬 위의 한 장) — 굽기 4번, 사이 사이에 뒤집기 3번
              cook → flip → cook → flip → cook → flip → cook
     닭꼬치 : 자루 3개 — 자루마다 cook → flip → cook → sauce
   신호를 놓치면 **건너뛰지 않고** 같은 일이 조금 뒤에 다시 옵니다.

   [닭꼬치는 내가 올리는 것부터 시작합니다]  처음에는 화로가 비어 있고, 왼쪽 재료
   칸의 꼬치 3자루를 **원할 때 하나씩 끌어다** 올립니다. 올린 자루부터 자기 신호가
   돌기 시작하므로, 세 자루가 동시에 익을 수도 있고 한 자루씩 차례로 구울 수도
   있습니다. 자루마다 신호 간격 배수(unit.speed)가 달라 **익는 속도도 서로 다릅니다.**
   제한시간 안에 끝낸 자루만 완성으로 셉니다 (멸치 손질과 같은 마감입니다).

   [익는 정도]  unit.cookStep 한 칸(0~4)이 그림 5장의 번호이고, **뒤로 안 갑니다.**
     0 안 익음   ← 시작
     1 살짝 익음 ← 익힘 신호가 뜨기 1.5초 전에 여기까지 (곧 신호가 온다는 예고입니다)
                   그리고 굽는 동안 내내 여기에 머뭅니다
     2 잘 익음   ← **그 자루의 마지막 굽기**에 제때 클릭
     3 살짝 탐   ← 그 마지막 굽기를 놓쳤을 때
     4 탐        ← 다시 온 마지막 굽기를 또 놓쳤을 때
   가만히 둔다고 저절로 타지 않고, 중간 신호를 놓쳐도 타지 않습니다.
   **마지막 단계에서 놓친 것만** 탑니다.

   [화면] 두 요리가 같은 3열 화면을 씁니다. 아래 "공통 화면 틀" 구역 참고.
   예전에 있던 하단 게이지 줄(게이지 + 문구 + Space 버튼)이 통째로 빠져서
   가운데 조리 칸이 457 → 615.6 으로 커졌고, 팬·화로도 그만큼 키웠습니다.

   쓰는 곳: 김치전 굽기 · 닭꼬치 굽기 (game-data.js 의 game:"twoSideCook")
   ============================================================ */

const TWO_SIDE_COOK_CONFIG=Object.freeze({
  pancake:Object.freeze({
    units:1,                 // 한 판에 굽는 개수 (김치전 1장)
    cyclesPerUnit:4,         // 개당 [굽기(+뒤집기)] 를 몇 번 되풀이하는가
    sauce:false,             // 마지막에 양념 바르기가 있는가
    flipAxis:"up",           // 뒤집는 드래그 방향 (up = 위로 튕기기)
    timeLimit:32
  }),
  skewer:Object.freeze({
    units:SKEWER_BATCH_SIZE, // 낮에 꽂아 둔 꼬치 3자루
    cyclesPerUnit:2,
    sauce:true,
    flipAxis:"side",         // side = 좌우 아무 쪽으로나 굴리기
    /* 45 → 58. 예전에는 3자루가 화로에 다 올라간 채로 한 줄로 진행했지만, 지금은
       **올리는 것부터 플레이어 몫**이고 자루마다 신호를 따로 기다립니다.
       세 자루를 겹쳐 구우면 넉넉하고, 한 자루씩 차례로 구우면 빠듯한 값입니다. */
    timeLimit:58
    // ⚠️ 예전에 있던 `foodAsset:"cookSkewerFood"`(꼬치 한 자루가 통째로 그려진 그림 한 장)은
    //    뺐습니다. 지금은 낮에 꽂은 배치대로 **조각을 한 개씩** 쌓습니다 — 아래 grillSkewerMarkup.
  })
});

/* ── 신호 타이밍 ─────────────────────────────────────────────
   난이도를 만지는 곳은 사실상 여기 한 표입니다.
     wait    신호가 뜨기까지 기다리는 시간 (최소~최대에서 매번 새로 뽑습니다)
     window  신호가 켜져 있는 시간. 이 안에 답해야 성공입니다
     preheat 익힘 신호 전에 "살짝 익은 그림"으로 미리 바뀌는 시각 (신호까지 남은 초)
     retryWait 놓쳤을 때 같은 신호가 다시 오기까지
   ⚠️ preheat(1.5) 는 cook 의 wait 최소값(1.4)보다 큽니다. 일부러 그렇습니다 —
      기다림이 짧게 뽑히면 예고 그림과 신호가 거의 붙어서 나옵니다(빠른 판). */
const TWO_SIDE_CUE=Object.freeze({
  cook: Object.freeze({wait:Object.freeze([1.4,2.6]), window:.9,  preheat:1.5}),
  flip: Object.freeze({wait:Object.freeze([.8,1.6]),  window:1.6, preheat:0}),
  sauce:Object.freeze({wait:Object.freeze([.8,1.6]),  window:1.4, preheat:0}),
  retryWait:Object.freeze([1,1.8])
});

/* ── "튕기듯" 을 재는 기준 ───────────────────────────────────
   그냥 끌면 안 뒤집히고, 짧은 시간에 확 그어야 뒤집힙니다.
     windowMs  이 시간 안에 아래 거리를 넘어야 한 번의 "튕김"입니다.
               넘겨서 계속 끌고 있으면 그 자리에서 다시 재기 시작합니다
               (천천히 가져가서 마지막에 확 긋는 것도 됩니다).
     distance  조리 칸(.ts-board) 크기 기준 비율입니다. px 로 박으면 창을 줄였을 때
               같은 손짓이 안 먹습니다.
   ⚠️ 김치전은 **위쪽으로만** 셉니다(팬을 들어 올려 뒤집는 손짓). 닭꼬치는 막대를
      굴리는 손짓이라 좌우 아무 쪽이나 됩니다. */
const TWO_SIDE_FLICK=Object.freeze({windowMs:320,pancakeDistance:.16,skewerDistance:.09});

/* ── 화로에 올라가는 꼬치 3개 ────────────────────────────────
   낮 '닭꼬치 꽂기'(engine-e8)에서 실제로 꽂은 배치를 그대로 굽습니다.
   조각·꼬챙이 그림도 그 게임과 **같은 파일**(assets/minigame/E8/)입니다 —
   day-prep-minigames.js 의 skewerChicken · skewerGreenOnion · skewerStick.
   그 조각이 여기서는 **안 익은 첫 장**이고, 익어 가는 넷은 따로 있습니다
   (assets/minigame/E5/yakitori/ · 아래 SKEWER_COOK_STEPS).

   배치는 state.skewerPrep.patterns (day.js) 에 낮이 남겨 둡니다.
   ⚠️ 꽂기를 건너뛰고 밤으로 오는 길이 있습니다(QA 모드가 준비를 완료로 찍는 경우).
      그때는 배치가 비어 있으므로 아래 기본 배치로 대신합니다. */
const SKEWER_COOK_FALLBACK=Object.freeze(["chicken","greenOnion","chicken","greenOnion","chicken"]);

function skewerCookPatterns(){
  const saved=Array.isArray(state.skewerPrep?.patterns)?state.skewerPrep.patterns:[];
  return Array.from({length:SKEWER_BATCH_SIZE},(_,index)=>{
    const pattern=saved[index];
    if(!Array.isArray(pattern)||!pattern.length)return [...SKEWER_COOK_FALLBACK];
    // 모르는 재료가 섞여 있어도(옛 세이브 등) 화면이 비지 않게 닭고기로 봅니다.
    return pattern.map(ingredient=>ingredient==="greenOnion"?"greenOnion":"chicken");
  });
}

/* ── 굽는 김치전 그림 5장 ────────────────────────────────────
   색을 CSS 필터로 만들지 않고 **그림을 갈아 끼웁니다**.
   ⚠️ 예전에는 여기 `until`(익힘 게이지 눈금)이 붙어 있었습니다. 게이지가 없어지면서
      **몇 번째 장인지를 data.cookStep 이 직접 들고 있습니다** — 순서가 곧 익는 순서라
      이 표는 이제 그림 목록일 뿐입니다. 어느 칸에서 어떻게 올라가는지는
      raiseTwoSideCookStep · burnTwoSideCookStep 두 함수에 다 모여 있습니다.
   ⚠️ 판정에는 전혀 관여하지 않습니다. 보이는 그림만 고릅니다. */
const PANCAKE_COOK_STEPS=Object.freeze([
  Object.freeze({key:"cookPancakeRaw"}),            // 0 반죽 그대로
  Object.freeze({key:"cookPancakeUndercooked"}),    // 1 살짝 익음
  Object.freeze({key:"cookPancakeCooked"}),         // 2 잘 익음
  Object.freeze({key:"cookPancakeSlightlyBurnt"}),  // 3 살짝 탐
  Object.freeze({key:"cookPancakeBurnt"})           // 4 탐
]);

/* ── 굽는 닭꼬치 조각 5단계 ──────────────────────────────────
   김치전과 같은 방식입니다 — 조각 하나에 다섯 장을 겹쳐 두고 갈아 끼웁니다.
   ⚠️ **raw 는 낮 '꽂기'와 같은 그림입니다**(SKEWER_ASSET_KEY). 그래서 첫 장만
      suffix 가 비어 있고, 나머지 넷이 assets/minigame/E5/yakitori/ 의 납품본입니다. */
const SKEWER_COOK_STEPS=Object.freeze([
  Object.freeze({suffix:""}),                // 0 낮에 꽂은 그대로
  Object.freeze({suffix:"SlightlyCooked"}),  // 1 살짝 익음
  Object.freeze({suffix:"WellCooked"}),      // 2 잘 익음
  Object.freeze({suffix:"SlightlyBurnt"}),   // 3 살짝 탐
  Object.freeze({suffix:"Burnt"})            // 4 탐
]);
const SKEWER_COOK_ASSET_PREFIX=Object.freeze({chicken:"cookSkewerChicken",greenOnion:"cookSkewerGreenOnion"});

function skewerCookAssetKey(ingredient,index){
  const suffix=SKEWER_COOK_STEPS[index].suffix;
  return suffix?`${SKEWER_COOK_ASSET_PREFIX[ingredient]}${suffix}`:SKEWER_ASSET_KEY[ingredient];
}

/* 익힘 그림 한 벌(2종 x 5장)이 다 있는지. 한 장이라도 빠지면 예전처럼 raw 한 장에
   CSS 필터로 색을 입힙니다 — 섞어 쓰면 어떤 조각은 그림으로, 어떤 조각은 필터로
   익어서 같은 꼬치 안에서 익힘이 달라 보입니다.
   ⚠️ 판마다 한 번만 재고 data 에 적어 둡니다(매 프레임 10칸을 훑지 않습니다).
      setup 이 아니라 여기서 재는 것은, 화면 점검용 하네스가 data 를 직접
      만들어 넘기는 길(tools/e5-skewer-cook-visual-smoke.html)도 있어서입니다. */
function skewerCookArtOn(data){
  if(data.skewerCookArt===undefined){
    data.skewerCookArt=["chicken","greenOnion"].every(ingredient=>
      SKEWER_COOK_STEPS.every((_,index)=>hasDayPrepAsset(skewerCookAssetKey(ingredient,index))));
  }
  return data.skewerCookArt;
}

/* ── 자루 하나 = 따로 도는 게임 하나 ─────────────────────────
   닭꼬치 3자루는 **서로 독립입니다.** 자루마다 자기 할 일 목록 · 자기 신호 타이머 ·
   자기 익힘 단계를 들고 있어서, 1번을 굽는 동안 2번은 아직 안 올라와 있을 수도
   있고 3번은 벌써 다 익었을 수도 있습니다.
   김치전도 **자루가 하나뿐인 같은 구조**입니다(팬 위에 처음부터 올라가 있습니다).
   그래야 두 요리가 아래 신호 흐름을 통째로 함께 쓸 수 있습니다.

     placed  화로(팬) 위에 올라와 있는가 — 김치전은 처음부터 true
     done    자기 할 일을 다 마쳤는가
     phase   idle(아직 안 올림) · wait(신호 기다리는 중) · cue(신호 켜짐)
     speed   신호 간격 배수. **자루마다 다릅니다** — 그래서 3자루가 서로 다른
             속도로 익습니다. 작을수록 신호가 빨리 옵니다.
   ------------------------------------------------------------ */
const TWO_SIDE_UNIT_SPEEDS=Object.freeze([.74,1,1.3]);

function buildTwoSideUnitSteps(dishStyle){
  const config=TWO_SIDE_COOK_CONFIG[dishStyle],steps=[];
  for(let cycle=0;cycle<config.cyclesPerUnit;cycle++){
    steps.push({kind:"cook"});
    if(cycle<config.cyclesPerUnit-1)steps.push({kind:"flip"});
    else if(config.sauce)steps.push({kind:"sauce"});
  }
  return steps;
}

/* 자루별 속도를 섞어 나눠 줍니다.
   ⚠️ 전역 shuffle() 을 안 쓰고 여기서 섞습니다 — 검사 하네스가 그 자리를
      "그대로 돌려주는" 가짜로 바꿔 놓아, 쓰면 늘 같은 순서가 나옵니다
      (engine-e8-order-place.js 의 createSkewerPattern 과 같은 까닭입니다). */
function drawTwoSideSpeeds(count){
  const speeds=Array.from({length:count},(_,index)=>TWO_SIDE_UNIT_SPEEDS[index%TWO_SIDE_UNIT_SPEEDS.length]);
  for(let index=speeds.length-1;index>0;index--){
    const pick=Math.floor(Math.random()*(index+1));
    [speeds[index],speeds[pick]]=[speeds[pick],speeds[index]];
  }
  return speeds;
}

function createTwoSideUnits(dishStyle){
  const config=TWO_SIDE_COOK_CONFIG[dishStyle],speeds=drawTwoSideSpeeds(config.units),onPan=dishStyle!=="skewer";
  /* slot : 화로의 **몇 번째 자리**에 놓였는가. 자루 번호(index)와 **다릅니다** —
     번호는 낮에 꽂은 그 꼬치가 누구인지(배치·그림)이고, 자리는 화면 어디에 놓였는지입니다.
     둘을 묶어 두면 3번 꼬치를 왼쪽에 놓아도 오른쪽 끝으로 날아갑니다. */
  /* served : 다 구운 뒤 **완성 칸(접시)으로 옮겼는가**. 튀김처럼 마지막에 옮겨야 한 개입니다.
     김치전은 옮기는 단계가 없어서 처음부터 true 로 둡니다 (판정이 두 요리를 함께 봅니다). */
  return Array.from({length:config.units},(_,index)=>({
    index, placed:onPan, slot:onPan?index:null, done:false, served:onPan,
    steps:buildTwoSideUnitSteps(dishStyle), stepIndex:0,
    phase:onPan?"wait":"idle", cueTimer:0, preheated:false,
    cookStep:0, renderedCookStep:-1, flips:0, speed:speeds[index]
  }));
}

function twoSideUnits(data){return data.units||[];}
function twoSideUnit(data,index){return data.units?.[index]||null;}
function twoSideStep(unit){return unit?.steps?.[unit.stepIndex]||null;}

/* 이 차례 뒤로 굽기가 더 남아 있는가. **탈지 말지를 가르는 한 줄입니다** —
   남아 있으면 아직 마지막 단계가 아니라서, 놓쳐도 타지 않고 점수만 깎입니다. */
function hasLaterCook(unit){
  return unit.steps.slice(unit.stepIndex+1).some(step=>step.kind==="cook");
}

/* 지금 보여 줄 그림 번호. 자루가 들고 있는 cookStep 을 그대로 쓰되 장수를 넘지 않게만 자릅니다. */
function cookArtStep(unit,steps){
  return clamp(Math.round(unit?.cookStep||0),0,steps.length-1);
}

/* 익힘을 **올리기만** 합니다 (한 번 익은 김치전이 다시 반죽이 되지는 않습니다).
     raise : 신호에 제때 답했을 때
     burn  : **마지막 굽기**를 놓쳤을 때 — 한 칸씩, 마지막 장(탐)에서 멈춥니다

   [예전과 무엇이 다른가]  예전에는 굽기에 한 번만 성공해도 곧바로 2(잘 익음)로
   뛰었고, 굽기든 뒤집기든 **아무 신호나** 놓칠 때마다 탔습니다. 그래서 첫 굽기부터
   다 익은 것처럼 보이고 두 번만 놓치면 새까매졌습니다. 지금은
     · 굽는 동안에는 1(살짝 익음)에 머물고, **그 자루의 마지막 굽기**에서 2(잘 익음)
     · 타는 것은 그 마지막 굽기를 놓쳤을 때뿐입니다 (뒤집기·양념은 안 태웁니다)
   그래서 "끝까지 잘 하다 마지막에 놓치면 탄다" 가 됩니다. */
function raiseTwoSideCookStep(data,unit,step){
  if(!unit)return;
  unit.cookStep=Math.max(unit.cookStep||0,step);
  updateTwoSideCookVisual(data,unit);
}

function burnTwoSideCookStep(data,unit){
  if(!unit)return;
  unit.cookStep=Math.min(PANCAKE_COOK_STEPS.length-1,(unit.cookStep||0)+1);
  updateTwoSideCookVisual(data,unit);
}

/* 익힘 단계 → 조리기구에 거는 분위기 클래스.
   ⚠️ `cook-golden` 은 지금 안 씁니다. 예전 게이지 시절 다섯 구간(raw/setting/golden/
      ready/over)에 맞춰 만든 것이라, 단계가 5장으로 정리된 뒤로는 갈 자리가 없습니다.
      css 쪽 규칙은 남겨 두었으니 쓰고 싶으면 여기 표에 끼우면 됩니다. */
const TWO_SIDE_COOK_STAGE=Object.freeze(["raw","setting","ready","over","over"]);

/* 조리기구(팬·화로)에 거는 분위기는 **한 벌뿐**입니다. 자루가 여럿이면
   가장 많이 익은 자루를 따릅니다 — 한 자루라도 타면 화로가 벌겋게 달아오릅니다. */
function twoSideCookLevel(data){
  return twoSideUnits(data).reduce((top,unit)=>Math.max(top,cookArtStep(unit,PANCAKE_COOK_STEPS)),0);
}

function twoSideCookVisualStage(data){
  return TWO_SIDE_COOK_STAGE[twoSideCookLevel(data)];
}

// unit 을 주면 그 자루의 그림만 갈아 끼웁니다. 없으면 올라와 있는 자루를 전부 훑습니다.
function updateTwoSideCookVisual(data,unit=null){
  const level=twoSideCookLevel(data);
  const pan=dom.miniContent?.querySelector(".two-side-pan");
  if(pan){
    // 임시 도형의 익힘 색·연기 진하기가 기대는 값입니다 (0~1). 그림을 쓸 때는 연기만 탑니다.
    pan.style.setProperty("--cook-progress",(level/(PANCAKE_COOK_STEPS.length-1)).toFixed(3));
    pan.classList.remove("cook-raw","cook-setting","cook-golden","cook-ready","cook-over");
    pan.classList.add(`cook-${TWO_SIDE_COOK_STAGE[level]}`);
  }
  const targets=unit?[unit]:twoSideUnits(data).filter(one=>one.placed);
  if(data.dishStyle==="pancake")targets.forEach(updatePancakeCookArt);
  else if(skewerCookArtOn(data))targets.forEach(updateSkewerCookArt);
}

/* 익힘 단계가 넘어갈 때만 그림을 켭니다 (매 프레임 DOM 을 훑지 않습니다).
   ⚠️ 다섯 장을 겹쳐 두고 **지금 단계까지를 다 켜 둡니다.** 위 장이 아래 장을
      완전히 덮으므로, 새 장이 서서히 나타나는 동안에도 팬 바닥이 비치지
      않습니다. 한 장만 두고 src 를 바꾸면 넘어가는 순간이 뚝 끊깁니다.
      (E8 불리기 볼 soakBowlFramesMarkup 과 같은 방식입니다) */
function updatePancakeCookArt(unit){
  const step=cookArtStep(unit,PANCAKE_COOK_STEPS);
  if(unit.renderedCookStep===step)return;
  const frames=dom.miniContent.querySelectorAll(".pancake-food-asset");
  if(!frames.length)return;
  frames.forEach((frame,index)=>frame.classList.toggle("on",index<=step));
  unit.renderedCookStep=step;
}

/* 꼬치 **한 자루만** 갈아 끼웁니다. 3자루가 따로 익으므로 화로를 통째로 훑으면
   안 됩니다 — 예전에는 그래서 한 자루를 구우면 세 자루가 다 익어 보였습니다.
   조각 5장을 겹쳐 켜는 규칙 자체는 김치전과 같습니다. */
function updateSkewerCookArt(unit){
  const step=cookArtStep(unit,SKEWER_COOK_STEPS);
  if(unit.renderedCookStep===step)return;
  const pieces=dom.miniContent?.querySelectorAll(`.grill-skewer.skewer-${unit.index+1} .gs-piece.has-cook-art`);
  if(!pieces?.length)return;
  pieces.forEach(piece=>piece.querySelectorAll(".gs-piece-asset")
    .forEach((frame,index)=>frame.classList.toggle("on",index<=step)));
  unit.renderedCookStep=step;
}

// 지금 진행 중인 이 게임. 끝났거나 다른 게임이면 null 이라, 조작 쪽에서 한 줄로 걸러집니다.
function twoSideMini(){
  const m=state.mini;
  return m&&m.engine==="twoSideCook"&&!m.complete?m:null;
}

/* 진행도. 김치전은 "몇 번 구웠나", 닭꼬치는 **"몇 자루를 완성 칸에 담았나"** 입니다.
   ⚠️ 다 구운 것(done)이 아니라 옮긴 것(served)을 셉니다 — 튀김처럼 담아야 한 개입니다. */
function twoSideDone(data){
  if(data.dishStyle!=="skewer")return data.cooked||0;
  return twoSideUnits(data).filter(unit=>unit.served).length;
}

// 화로에 아직 안 올린 꼬치 (재료 카드에 남아 있는 자루)
function twoSideWaitingUnits(data){
  return twoSideUnits(data).filter(unit=>!unit.placed);
}

// 다 구웠지만 아직 완성 칸으로 안 옮긴 자루 (화로 위에서 끌어가기를 기다립니다)
function twoSideServableUnits(data){
  return twoSideUnits(data).filter(unit=>unit.done&&!unit.served);
}

function twoSideAllDone(data){
  return twoSideUnits(data).every(unit=>unit.done&&unit.served);
}

registerMiniEngine("twoSideCook", {
  // 이 화면에는 키 안내가 하나도 없습니다 — 키도 받지 않습니다 (mini-engine.js 참고)
  noKeyboard:true,

  setup(m, { set, dish }) {
    const isSkewer = dish.id === "skewer";
    const dishStyle=isSkewer?"skewer":"pancake",config=TWO_SIDE_COOK_CONFIG[dishStyle];
    set(
      isSkewer ? "닭꼬치 굽기" : "김치전 굽기",
      isSkewer ? "불빛이 켜지면 그 꼬치를 클릭하고, 뒤집기 신호에는 옆으로 굴리듯 드래그하세요."
               : "불빛이 켜지면 김치전을 클릭하고, 뒤집기 신호에는 위로 튕기듯 드래그하세요.",
      config.timeLimit
    );
    // skewerPatterns : 낮에 꽂아 둔 꼬치 3개의 배치. 한 판 동안 바뀌지 않으므로
    //                  여기서 한 번만 읽어 둡니다 (매 렌더마다 다시 읽으면 낭비입니다).
    m.data = createTwoSideData(dishStyle,{timeLimit:m.time});
    /* 굽는 소리는 **올린 것이 있을 때만** 깝니다. 김치전은 처음부터 팬 위에 있지만,
       닭꼬치는 화로가 비어 있는 채로 시작하므로 첫 자루를 올릴 때 켭니다
       (placeTwoSideUnit). 빈 화로에서 고기 굽는 소리가 나던 것을 고친 것입니다. */
    if(!isSkewer)audio.loop?.("pan_sizzle",m,.6);
    // 타이틀 아래 부제. 공용 패널 마크업은 그대로 두고 내용만 채웁니다.
    dom.miniStation.textContent = TWO_SIDE_VIEW[m.data.dishStyle].subtitle;
    setMiniTipHint?.(isSkewer?"드래그 : 꼬치 올리기 · 클릭 : 굽기·양념 · 드래그 : 굴려 뒤집기":"클릭 : 굽기 · 드래그 : 위로 튕겨 뒤집기");
    renderTwoSideCook();
    // 팬 위에 이미 올라가 있는 자루(= 김치전)만 바로 첫 신호를 겁니다.
    twoSideUnits(m.data).forEach(unit=>{if(unit.placed)armTwoSideCue(m,unit);});
  },

  update(m, dt) {
    updateTwoSideTime(m);
    twoSideUnits(m.data).forEach(unit=>tickTwoSideUnit(m,unit,dt));
  },

  /* 제한시간이 끝났습니다. 멸치 손질(engine-e10)과 같은 마감입니다 —
     그때까지 끝낸 만큼으로 셈하고 TIME OVER 를 잠깐 보여 준 뒤 마칩니다.
     ⚠️ 이게 없으면 game.js 가 finishMini(35) 로 뚝 끊습니다. 꼬치를 원할 때
        올리는 방식이 되면서 시간이 모자라는 판이 실제로 생겨 필요해졌습니다. */
  timeout(m){ timeoutTwoSideCook(m); },

  // ACTION 버튼(휴대용 화면의 큰 버튼)으로도 클릭 신호에 답할 수 있게 열어 둡니다.
  // 키보드는 위 noKeyboard 가 막으므로 이 길로는 마우스·터치만 들어옵니다.
  action(m) {
    // 신호가 켜진 자루 가운데 클릭으로 답하는 것(굽기·양념) 하나를 골라 줍니다.
    const unit=twoSideUnits(m.data).find(one=>one.phase==="cue"&&twoSideStep(one)?.kind!=="flip");
    if(unit)pressTwoSideCue(m,unit.index);
  }
});

/* 한 판의 상태 한 벌. setup 과 점검용 하네스(tools/e5-*-visual-smoke.html)가
   **같은 함수**로 만듭니다 — 하네스가 손으로 베껴 적으면 진짜 판과 어긋납니다. */
function createTwoSideData(dishStyle,{timeLimit=TWO_SIDE_COOK_CONFIG[dishStyle].timeLimit}={}){
  return {
    dishStyle, units:createTwoSideUnits(dishStyle),
    cooked:0, hits:[], flipErrors:0, cookErrors:0, timeLimit, timedOut:false,
    skewerPatterns: dishStyle==="skewer" ? skewerCookPatterns() : null
  };
}

/* 남은 시간 표시. 진행도 카드 아래 가는 띠와, 멸치 손질과 같은 "남은 시간 N초" 줄입니다.
   ⚠️ 시간을 여기서 깎지 않습니다 — game.js 의 updateMini 가 m.time 을 세고 있습니다. */
const TWO_SIDE_TIME_WARNING=7;

function updateTwoSideTime(m){
  const data=m.data;
  const bar=dom.miniContent?.querySelector("#tsTimeBar");
  if(bar&&data.timeLimit)bar.style.width=`${clamp(m.time/data.timeLimit,0,1)*100}%`;
  const timer=dom.miniContent?.querySelector("#tsTime");
  if(!timer)return;
  timer.classList.toggle("warning",m.time<=TWO_SIDE_TIME_WARNING);
  const value=timer.querySelector("b");
  if(value)value.textContent=`${Math.max(0,m.time).toFixed(1)}초`;
}

/* 자루 하나의 시계. 올라와 있고 아직 안 끝난 자루만 돕니다 —
   재료 카드에서 기다리는 꼬치는 시간이 흘러도 익지 않습니다. */
function tickTwoSideUnit(m,unit,dt){
  const data=m.data;
  if(data.timedOut||!unit.placed||unit.done)return;
  if(unit.phase==="wait"){
    unit.cueTimer-=dt;
    const step=twoSideStep(unit);
    // 신호 1.5초 전 : "곧 온다"를 그림으로 미리 알려 줍니다 (살짝 익은 모습)
    if(step?.kind==="cook"&&!unit.preheated&&unit.cueTimer<=TWO_SIDE_CUE.cook.preheat){
      unit.preheated=true;
      raiseTwoSideCookStep(data,unit,1);
      twoSideTargetElement(data,unit)?.classList.add("cue-preheat");
    }
    if(unit.cueTimer<=0)openTwoSideCue(m,unit);
    return;
  }
  if(unit.phase==="cue"){
    unit.cueTimer-=dt;
    // 신호가 사그라드는 정도를 CSS 에 넘겨 줍니다 (테두리 빛이 옅어집니다)
    const target=twoSideTargetElement(data,unit),step=twoSideStep(unit);
    if(target&&step)target.style.setProperty("--cue-left",clamp(unit.cueTimer/TWO_SIDE_CUE[step.kind].window,0,1).toFixed(3));
    if(unit.cueTimer<=0)missTwoSideCue(m,unit);
  }
}

/* ============================================================
   신호 — 뜨고, 답하고, 놓치고

   흐름은 한 줄이고, **자루마다 따로** 돕니다.
     armTwoSideCue(기다림 시작) → openTwoSideCue(신호 켬)
        → pressTwoSideCue / flickTwoSideCue(답함) → advanceTwoSideStep(다음 할 일)
        → 답 못 하면 missTwoSideCue → 다시 armTwoSideCue(같은 할 일)
   ⚠️ 아래 함수들은 전부 **자루 하나(unit)** 를 받습니다. 예전에는 판 전체가
      한 줄로 진행해서 인자가 없었습니다.
   ============================================================ */

function armTwoSideCue(m,unit,retry=false){
  const data=m.data,step=twoSideStep(unit);
  if(!step){finishTwoSideUnit(m,unit);return;}
  const range=retry?TWO_SIDE_CUE.retryWait:TWO_SIDE_CUE[step.kind].wait;
  unit.phase="wait";
  // 자루마다 다른 speed 를 곱합니다 — 3자루가 같은 박자로 재촉하지 않게 하는 곳입니다.
  unit.cueTimer=(range[0]+Math.random()*(range[1]-range[0]))*(unit.speed||1);
  unit.preheated=false;
  clearTwoSideCue(data,unit);
  updateTwoSideHint(data);
}

function openTwoSideCue(m,unit){
  const data=m.data,step=twoSideStep(unit);
  if(!step)return;
  unit.phase="cue";
  unit.cueTimer=TWO_SIDE_CUE[step.kind].window;
  clearTwoSideCue(data,unit);
  const target=twoSideTargetElement(data,unit);
  if(target){
    target.style.setProperty("--cue-left","1");
    target.classList.add("cue-on",`cue-${step.kind}`);
  }
  updateTwoSideHint(data);
  audio.play?.("ui_click",{owner:m,gain:.5});
}

/* 신호창 안에서 얼마나 빨리 답했는가 → 72~100점.
   창의 앞쪽 40% 께가 가장 좋고(사람이 신호를 보고 반응하는 데 걸리는 만큼 여유를
   둔 자리입니다), 거기서 멀어질수록 떨어집니다. 94점 위가 PERFECT 판정선입니다. */
function twoSideCueScore(unit,kind){
  const window=TWO_SIDE_CUE[kind].window;
  const passed=clamp((window-Math.max(0,unit.cueTimer))/window,0,1);
  const off=Math.abs(passed-.4);
  if(off<=.22)return Math.round(100-off/.22*4);        // 96 ~ 100
  return Math.round(clamp(94-(off-.22)/.38*20,74,94));
}

function pressTwoSideCue(m,unitIndex){
  if(!m)return false;
  const data=m.data,unit=twoSideUnit(data,unitIndex);
  if(!unit||data.timedOut)return false;
  if(!unit.placed){
    dom.miniFeedback.textContent="꼬치를 화로 위로 끌어다 올려주세요.";
    return false;
  }
  const step=twoSideStep(unit);
  if(!step||unit.done)return false;
  if(step.kind==="flip"){
    // 뒤집기는 클릭이 아니라 드래그입니다. 답을 몰라 클릭한 것이므로 벌점은 없습니다.
    if(unit.phase==="cue")dom.miniFeedback.textContent=data.dishStyle==="skewer"?"꼬치를 옆으로 굴리듯 드래그하세요!":"김치전을 위로 튕기듯 드래그하세요!";
    return false;
  }
  if(unit.phase!=="cue"){
    dom.miniFeedback.textContent="아직이에요. 불빛이 켜질 때 누르세요.";
    return false;
  }
  data.hits.push(twoSideCueScore(unit,step.kind));
  if(step.kind==="cook"){
    // 굽는 동안에는 '살짝 익음'에 머물고, **마지막 굽기**에서만 '잘 익음'이 됩니다.
    raiseTwoSideCookStep(data,unit,hasLaterCook(unit)?1:2);
    data.cooked=(data.cooked||0)+1;
    playTwoSideSizzle(m);
    dom.miniFeedback.textContent="치이익—  노릇하게 익었습니다!";
  }else{
    applyTwoSideSauce(m,unit.index);
  }
  advanceTwoSideStep(m,unit);
  return true;
}

function flickTwoSideCue(m,unitIndex){
  if(!m)return false;
  const data=m.data,unit=twoSideUnit(data,unitIndex);
  if(!unit||data.timedOut||!unit.placed||unit.done)return false;
  const step=twoSideStep(unit);
  if(!step||step.kind!=="flip"||unit.phase!=="cue")return false;
  data.hits.push(twoSideCueScore(unit,"flip"));
  performTwoSideFlip(m,unit);
  advanceTwoSideStep(m,unit);
  return true;
}

/* 놓쳤습니다. **마지막 굽기를 놓친 것만** 탑니다 (raiseTwoSideCookStep 주석 참고).
   그 앞의 굽기·뒤집기·양념은 점수만 깎이고 같은 일이 조금 뒤에 다시 옵니다. */
function missTwoSideCue(m,unit){
  const data=m.data,step=twoSideStep(unit);
  if(!step)return;
  if(step.kind==="cook"){
    data.cookErrors=(data.cookErrors||0)+1;
    if(hasLaterCook(unit))dom.miniFeedback.textContent="불빛을 놓쳤어요. 곧 다시 신호가 옵니다.";
    else{burnTwoSideCookStep(data,unit);dom.miniFeedback.textContent="마지막 불빛을 놓쳤어요. 탔습니다!";}
  }else if(step.kind==="flip"){
    data.flipErrors=(data.flipErrors||0)+1;
    dom.miniFeedback.textContent="뒤집을 때를 놓쳤어요. 곧 다시 신호가 옵니다.";
  }else{
    data.flipErrors=(data.flipErrors||0)+1;
    dom.miniFeedback.textContent="양념 바를 때를 놓쳤어요. 곧 다시 신호가 옵니다.";
  }
  audio.bad();
  armTwoSideCue(m,unit,true);
}

function advanceTwoSideStep(m,unit){
  const data=m.data;
  unit.stepIndex++;
  clearTwoSideCue(data,unit);
  updateTwoSideProgress(data);
  if(unit.stepIndex>=unit.steps.length){finishTwoSideUnit(m,unit);return;}
  armTwoSideCue(m,unit);
}

/* 자루 하나를 다 구웠습니다. 마지막 연출(뒤집기·양념)이 보이도록 조금 두었다가
   완성 표시를 붙입니다.
   닭꼬치는 여기서 끝이 아니라 **완성 칸으로 옮겨야** 한 개입니다(튀김과 같습니다) —
   그래서 자루를 끌 수 있게 만들어 두고, 판을 마치는 것은 다 옮겼을 때입니다. */
function finishTwoSideUnit(m,unit){
  const data=m.data;
  if(unit.done)return;
  unit.done=true;unit.phase="done";
  clearTwoSideCue(data,unit);
  updateTwoSideProgress(data);
  updateTwoSideHint(data);
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    const element=twoSideTargetElement(data,unit);
    element?.classList.add("unit-done");
    if(data.dishStyle==="skewer"&&!unit.served){
      // 이제부터 이 자루는 완성 칸으로 끌어다 놓을 수 있습니다
      element?.classList.add("ready-to-serve");
      element?.setAttribute("data-ts-serve",String(unit.index));
      bindTwoSideServePointers();
      audio.play?.("ui_click",{owner:m,gain:.6});
      dom.miniFeedback.textContent=`${unit.index+1}번 꼬치 완성! 완성 칸으로 옮겨주세요.`;
      updateTwoSideHint(data);
    }
    if(twoSideAllDone(data))finishTwoSideCook(m);
  },520);
}

/* 다 구운 자루를 오른쪽 완성 칸(접시)으로 옮깁니다.
   재료 카드 → 화로 와 **같은 창구**(bindOrderPlacementPointers)를 씁니다.
   ⚠️ 화면을 다시 그릴 때마다 다시 겁니다 — 자루가 하나씩 완성될 때마다 끌 수 있는
      대상이 늘어나기 때문입니다. 이미 걸린 것에 또 걸어도 같은 동작이라 괜찮습니다. */
function bindTwoSideServePointers(){
  const sources=dom.miniContent?.querySelectorAll("[data-ts-serve]");
  if(!sources?.length||typeof bindOrderPlacementPointers!=="function")return;
  bindOrderPlacementPointers({
    sources,
    targetSelector:'[data-order-target="serve"]',
    itemFromSource:source=>source.dataset.tsServe,
    ghostSelector:".gs-pieces",
    dragOnly:true,
    onPlace:item=>serveTwoSideUnit(twoSideMini(),Number(item)),
    onMiss:()=>{dom.miniFeedback.textContent="다 구운 꼬치는 오른쪽 완성 칸에 담아주세요.";}
  });
}

function serveTwoSideUnit(m,index){
  if(!m)return;
  const data=m.data,unit=twoSideUnit(data,index);
  if(!unit||!unit.done||unit.served||data.timedOut)return;
  unit.served=true;
  // 화로의 그 자리를 다시 비웁니다 (아직 안 올린 꼬치가 있으면 그 자리에 올릴 수 있습니다)
  const slot=dom.miniContent?.querySelector(`.gs-slot.slot-${unit.slot+1}`);
  if(slot){
    slot.classList.add("empty");
    slot.innerHTML=`<i class="gs-slot-mark" aria-hidden="true"></i>`;
  }
  unit.slot=null;
  // 완성 칸에 한 자루 쌓습니다
  const stack=dom.miniContent?.querySelector(".ts-serve-stack");
  if(stack){
    stack.insertAdjacentHTML("beforeend",twoSideServedSkewerMarkup(data,unit));
    stack.querySelector(".ts-served:last-child")?.classList.add("landing");
  }
  dom.miniContent?.querySelector(".ts-serve-plate")?.classList.add("filled");
  audio.play?.("plate_set",{owner:m,gain:.9})||audio.play?.("ui_click",{owner:m,gain:.7});
  dom.miniFeedback.textContent=`${index+1}번 꼬치를 담았습니다!`;
  updateTwoSideProgress(data);
  updateTwoSideHint(data);
  if(twoSideAllDone(data))setTimeout(()=>{if(state.mini===m&&!m.complete)finishTwoSideCook(m);},420);
}

/* "치이익" — 굽는 소리를 한 모금만 크게 겹칩니다.
   ⚠️ 배경에 깔아 둔 같은 이름의 **반복 소리와 별개 재생**입니다(audio.play 는 새 항목을
      만들고, 반복 쪽은 audio.loop 가 따로 들고 있습니다). 그래서 여기서 꺼도 배경은
      계속 지글거립니다. 파일이 반복용이라 그냥 두면 통째로 재생되므로 0.7초에 끊습니다. */
function playTwoSideSizzle(m){
  const data=m.data;
  if(data.sizzleSfx)audio.stopFile?.(data.sizzleSfx);
  data.sizzleSfx=audio.play?.(data.dishStyle==="skewer"?"charcoal_grill":"pan_sizzle",{owner:m,gain:1.9})||null;
  setTimeout(()=>{
    if(data.sizzleSfx){audio.stopFile?.(data.sizzleSfx);data.sizzleSfx=null;}
  },700);
}

/* ── 뒤집기 연출 ─────────────────────────────────────────────
   그림이 한 벌뿐이라 좌우를 뒤집어(scaleX) 반대 면처럼 읽히게 합니다.
     김치전 : 팬 통째로 side-0 ↔ side-1
     닭꼬치 : 그 자루만 .flipped (0.3초 구르는 연출 뒤에 붙습니다) */
function performTwoSideFlip(m,unit){
  const data=m.data;
  unit.flips=(unit.flips||0)+1;
  if(data.dishStyle==="pancake"){
    const pan=dom.miniContent.querySelector("#tsPan");
    const side=unit.flips%2;
    audio.play?.("pancake_flip",{owner:m});
    if(pan){
      pan.classList.add("flipping");
      setTimeout(()=>pan?.classList.remove("flipping"),620);
      // 그림이 넘어가는 것은 연출 한가운데입니다 (팬이 가장 높이 떴을 때)
      setTimeout(()=>{pan?.classList.remove("side-0","side-1");pan?.classList.add(`side-${side}`);},300);
    }
    dom.miniFeedback.textContent="샥— 깔끔하게 뒤집었습니다!";
    return;
  }
  const skewer=dom.miniContent.querySelector(`.grill-skewer.skewer-${unit.index+1}`);
  audio.play?.("skewer_turn",{owner:m});
  skewer?.classList.add("turning");
  setTimeout(()=>{
    skewer?.classList.remove("turning");
    skewer?.classList.toggle("flipped",unit.flips%2===1);
  },300);
  dom.miniFeedback.textContent=`${unit.index+1}번 꼬치를 굴렸습니다!`;
}

/* ── 양념 바르기 (닭꼬치 전용) ───────────────────────────────
   붓이 화면 오른쪽 아래에서 들어와 그 자루를 위아래로 두 번 쓸고 빠집니다.
   붓은 **그 자루 안에** 붙입니다 — 자루가 어디에 있든 따라가고, 자루가 사라지면
   붓도 같이 사라져서 따로 치울 것이 없습니다.
   ⚠️ 붓 그림(cookSauceBrush)은 아직 원화가 없어 임시 CSS 도형이 나옵니다.
      파일만 넣으면 도형이 꺼집니다 (day-prep-minigames.js 의 경로표 참고). */
function sauceBrushMarkup(){
  const asset=dayPrepAssetMarkup("cookSauceBrush","ts-brush-asset","양념 붓");
  return `<i class="ts-sauce-brush ${asset?"has-asset":""}" aria-hidden="true">${asset}</i>`;
}

function applyTwoSideSauce(m,unit){
  const data=m.data;
  const skewer=dom.miniContent.querySelector(`.grill-skewer.skewer-${unit+1}`);
  audio.play?.("pour_thick",{owner:m,gain:.9});
  dom.miniFeedback.textContent=`${unit+1}번 꼬치에 양념을 발랐습니다!`;
  if(!skewer)return;
  skewer.insertAdjacentHTML("beforeend",sauceBrushMarkup());
  const brush=skewer.querySelector(".ts-sauce-brush");
  // 쓸고 지나간 뒤부터 윤기가 돕니다 (연출 한가운데)
  setTimeout(()=>{if(state.mini===m)skewer.classList.add("sauced");},340);
  setTimeout(()=>brush?.remove(),760);
}

/* ============================================================
   조작 — 클릭 한 번, 그리고 "샥" 하는 드래그

   조리 칸(.ts-board) 한 곳에서 다 받습니다. 포인터를 잡아 두므로(setPointerCapture)
   칸 밖으로 손이 나가도 한 번의 드래그로 이어집니다.
     · 움직이지 않고 뗐다 = 클릭  → 익힘·양념 신호에 답
     · 짧은 시간에 확 그었다 = 튕김 → 뒤집기 신호에 답 (TWO_SIDE_FLICK)
   ⚠️ 화면을 다시 그리지 않으므로 여기 붙인 것은 판이 끝날 때까지 그대로입니다.
      (화면을 다시 그리면 연기 기둥의 박자와 붓 연출이 끊깁니다 — renderTwoSideCook 주석)
   ============================================================ */

function twoSidePointerUnit(event){
  const skewer=event.target instanceof Element?event.target.closest(".grill-skewer"):null;
  const index=Number(skewer?.dataset.skewerIndex);
  return Number.isFinite(index)?index:0;
}

function twoSideFlickHits(data,board,dx,dy){
  const rect=board.getBoundingClientRect();
  if(!rect.width||!rect.height)return false;
  // 김치전은 위로만(팬을 들어 올리는 손짓), 닭꼬치는 좌우 아무 쪽이나(막대를 굴리는 손짓)
  if(data.dishStyle==="pancake")return -dy>=rect.height*TWO_SIDE_FLICK.pancakeDistance;
  return Math.abs(dx)>=rect.width*TWO_SIDE_FLICK.skewerDistance;
}

function bindTwoSideCookPointer(){
  const board=dom.miniContent.querySelector(".ts-board");
  if(!board||board.dataset.twoSideBound)return;
  board.dataset.twoSideBound="1";
  let drag=null;

  board.addEventListener("pointerdown",event=>{
    if(!twoSideMini())return;
    if(event.pointerType==="mouse"&&event.button!==0)return;
    /* ⚠️ **다 구워서 담을 수 있는 자루에서 시작한 드래그는 건드리지 않습니다.**
       도마는 여기서 포인터를 잡아채는데(setPointerCapture), 자루도 같은 눌림에서
       자기 포인터를 잡습니다. 도마 쪽이 나중에 잡아서 늘 이기는 바람에 자루의
       드래그가 통째로 죽고 **완성 칸으로 옮길 수가 없었습니다.** */
    if(event.target instanceof Element&&event.target.closest("[data-ts-serve]"))return;
    event.preventDefault();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),
          moved:false,spent:false,unit:twoSidePointerUnit(event)};
    try{board.setPointerCapture?.(event.pointerId);}catch{}
  });

  board.addEventListener("pointermove",event=>{
    const m=twoSideMini();
    if(!drag||drag.id!==event.pointerId||!m)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.hypot(dx,dy)>=6)drag.moved=true;
    if(drag.spent)return;                       // 이 드래그로는 이미 한 번 뒤집었습니다
    // 재는 창을 넘겼으면 지금 자리에서 다시 잽니다 —
    // 천천히 가져갔다가 마지막에 확 긋는 것도 "튕김"으로 봐 줍니다.
    if(performance.now()-drag.at>TWO_SIDE_FLICK.windowMs){
      drag.x=event.clientX;drag.y=event.clientY;drag.at=performance.now();return;
    }
    if(twoSideFlickHits(m.data,board,dx,dy)&&flickTwoSideCue(m,drag.unit))drag.spent=true;
  });

  const finish=event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const clicked=event.type==="pointerup"&&!drag.moved,unit=drag.unit;
    drag=null;
    try{if(board.hasPointerCapture?.(event.pointerId))board.releasePointerCapture?.(event.pointerId);}catch{}
    if(clicked)pressTwoSideCue(twoSideMini(),unit);
  };
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>board.addEventListener(type,finish));
  board.addEventListener("dragstart",event=>event.preventDefault());
}

/* ── 재료 카드 → 화로로 꼬치 올리기 (닭꼬치 전용) ─────────────
   낮 준비(김치전 반죽 넣기·두부김치 담기)와 **같은 창구**를 씁니다 —
   engine-e8-order-place.js 의 bindOrderPlacementPointers 입니다. 전역 스크립트라
   파일이 달라도 그대로 부를 수 있고, 마우스와 터치가 같은 흐름을 탑니다.
     dragOnly  눌러서 자동으로 올라가지 않습니다. 화로까지 끌어다 놓아야 합니다.

   ⚠️ 자루는 **자기 자리(빈 칸 N)** 로만 올라갑니다. 낮에 꽂은 1번 꼬치가 곧 화로의
      1번 자리라, 순서를 바꾸면 굽는 배치와 밤 완성 그림이 어긋납니다.
      화로 아무 데나 놓아도 되고, 어느 자루를 먼저 올릴지는 마음대로입니다.
   ------------------------------------------------------------ */
function bindTwoSidePlacementPointers(){
  const sources=dom.miniContent?.querySelectorAll("[data-ts-place]");
  if(!sources?.length)return;
  /* ⚠️ 조용히 지나가지 않고 알립니다. 이 창구가 없으면 꼬치를 올릴 수가 없어서
     **게임이 통째로 막힙니다** — 그런데 화면은 멀쩡해 보여서 원인 찾기가 오래 걸립니다.
     (실제로 점검 하네스가 engine-e8-order-place.js 를 안 읽어 이렇게 막혔습니다) */
  if(typeof bindOrderPlacementPointers!=="function"){
    console.error("[E5] bindOrderPlacementPointers 가 없습니다 — engine-e8-order-place.js 를 같이 읽어야 꼬치를 올릴 수 있습니다.");
    return;
  }
  /* 손을 뗀 **자리**를 기억해 둡니다. bindOrderPlacementPointers 는 놓은 상자만
     넘겨 주고 좌표는 안 넘겨 주는데, 어느 칸에 놓았는지는 좌표로만 알 수 있습니다.
     document 의 잡기 단계(capture)에 걸어 두면 소스의 pointerup 보다 **먼저** 돕니다. */
  if(!twoSidePlaceListening){
    twoSidePlaceListening=true;
    ["pointermove","pointerup"].forEach(type=>document.addEventListener(type,event=>{
      twoSideDropPoint={x:event.clientX,y:event.clientY};
    },true));
  }
  bindOrderPlacementPointers({
    sources,
    targetSelector:'[data-order-target="grill"]',
    itemFromSource:source=>source.dataset.tsPlace,
    ghostSelector:".grill-skewer",
    dragOnly:true,
    onPlace:(item)=>placeTwoSideUnit(twoSideMini(),Number(item),nearestEmptyTwoSideSlot()),
    onMiss:()=>{dom.miniFeedback.textContent="꼬치를 화로 위에 올려주세요.";}
  });
}

let twoSideDropPoint=null;          // 마지막 포인터 자리 (어느 칸에 놓았는지 가릅니다)
let twoSidePlaceListening=false;

/* 손을 뗀 자리에서 **가장 가까운 빈 칸**을 고릅니다. 칸 사이 틈이나 화로 가장자리에
   놓아도 눈에 보이는 그 자리로 올라가게 하려는 것입니다 (칸만 받으면 틈에서 놓쳤습니다). */
function nearestEmptyTwoSideSlot(){
  const slots=[...(dom.miniContent?.querySelectorAll(".gs-slot.empty")||[])];
  if(!slots.length)return null;
  const x=twoSideDropPoint?.x;
  if(!Number.isFinite(x))return Number(slots[0].dataset.orderSlot);
  const near=slots.reduce((best,slot)=>{
    const rect=slot.getBoundingClientRect(),gap=Math.abs(rect.left+rect.width/2-x);
    return !best||gap<best.gap?{slot,gap}:best;
  },null);
  return Number(near.slot.dataset.orderSlot);
}

/* 꼬치 한 자루를 화로의 slotIndex 자리에 올립니다.
   그 순간부터 **그 자루만** 자기 시계로 익습니다. */
function placeTwoSideUnit(m,index,slotIndex=null){
  if(!m)return;
  const data=m.data,unit=twoSideUnit(data,index);
  if(!unit||unit.placed||data.timedOut)return;
  const taken=new Set(twoSideUnits(data).filter(one=>one.placed).map(one=>one.slot));
  // 자리를 안 주거나 이미 찬 자리를 주면 남은 빈 자리 가운데 첫 칸으로 갑니다
  let seat=Number.isInteger(slotIndex)&&!taken.has(slotIndex)?slotIndex
    :twoSideUnits(data).map((_,position)=>position).find(position=>!taken.has(position));
  if(!Number.isInteger(seat))return;
  unit.placed=true;unit.slot=seat;
  const slot=dom.miniContent?.querySelector(`.gs-slot.slot-${seat+1}`);
  if(slot){
    slot.classList.remove("empty");
    slot.innerHTML=grillSkewerMarkup(data.skewerPatterns[index],index,data);
    slot.querySelector(".grill-skewer")?.classList.add("landing");
  }
  // 카드에서 그 자루를 덜어 냅니다 (남은 개수도 같이 줄입니다)
  dom.miniContent?.querySelector(`[data-ts-place="${index}"]`)?.remove();
  const left=twoSideWaitingUnits(data).length;
  const amount=dom.miniContent?.querySelector("#tsIngLeft");
  if(amount)amount.textContent=`×${left}`;
  dom.miniContent?.querySelector(".ts-ing-card.skewerRaw")?.classList.toggle("empty",!left);
  // 첫 자루가 올라간 순간부터 숯불 소리를 깝니다 (빈 화로에서는 안 납니다)
  if(twoSideUnits(data).filter(one=>one.placed).length===1)audio.loop?.("charcoal_grill",m,1.8);
  audio.play?.("skewer_pierce",{owner:m,gain:.8});
  dom.miniFeedback.textContent=`${index+1}번 꼬치를 화로에 올렸습니다!`;
  updateTwoSideCookVisual(data,unit);
  updateTwoSideHint(data);
  armTwoSideCue(m,unit);
}

/* ============================================================
   화면
   ============================================================ */

/* 그 자루의 신호가 걸리는 자리. 닭꼬치는 자루 하나, 김치전은 팬 통째입니다. */
function twoSideTargetElement(data,unit){
  if(!dom.miniContent)return null;
  if(data.dishStyle!=="skewer")return dom.miniContent.querySelector("#tsPan");
  return dom.miniContent.querySelector(`.grill-skewer.skewer-${(unit?.index??0)+1}`);
}

/* 그 자루의 신호 불빛만 끕니다. unit 을 안 주면 화면의 모든 불빛을 끕니다.
   ⚠️ 자루별로 신호가 따로 도는 지금은 **반드시 unit 을 주세요** — 안 주면
      1번 신호를 지우면서 2번에 켜져 있던 불빛까지 같이 꺼집니다. */
function clearTwoSideCue(data,unit=null){
  const scope=unit?twoSideTargetElement(data,unit):null;
  const list=scope?[scope]:[...(dom.miniContent?.querySelectorAll(".cue-on,.cue-preheat")||[])];
  list.forEach(element=>{
    element.classList.remove("cue-on","cue-preheat","cue-cook","cue-flip","cue-sauce");
    element.style.removeProperty("--cue-left");
  });
}

/* 오른쪽 카드 맨 아래 "지금 할 일" 한 줄. 화면을 다시 그리지 않고 글자만 바꿉니다.
   ⚠️ 닭꼬치는 자루 3개가 따로 도는지라 "지금 할 일"이 하나로 안 정해집니다.
      그래서 켜진 신호가 있으면 그 가운데 하나를, 없으면 남은 꼬치를 안내합니다. */
const TWO_SIDE_NOW_TEXT=Object.freeze({
  pancake:Object.freeze({
    waitCook:"불이 오르기를 기다리는 중…", cueCook:"지금! 김치전을 클릭",
    waitFlip:"곧 뒤집기 신호가 옵니다", cueFlip:"지금! 위로 튕기듯 드래그",
    done:"완성!"
  }),
  skewer:Object.freeze({
    waitCook:"숯불이 오르기를 기다리는 중…", cueCook:"지금! 불빛이 켜진 꼬치를 클릭",
    waitFlip:"곧 뒤집기 신호가 옵니다", cueFlip:"지금! 옆으로 굴리듯 드래그",
    waitSauce:"곧 양념 신호가 옵니다", cueSauce:"지금! 꼬치를 클릭해 양념 바르기",
    place:"재료 칸의 꼬치를 화로로 끌어다 올리세요",
    serve:"다 구운 꼬치를 완성 칸으로 옮기세요!", done:"완성!"
  })
});

function updateTwoSideHint(data){
  const now=dom.miniContent?.querySelector("#tsNow");
  if(!now)return;
  const text=TWO_SIDE_NOW_TEXT[data.dishStyle];
  if(twoSideAllDone(data)){now.textContent=text.done;now.className="ts-now done";return;}
  // 담을 것이 있으면 그것부터 알립니다 — 담아야 한 개로 세어집니다
  if(twoSideServableUnits(data).length){now.textContent=text.serve||"";now.className="ts-now on";return;}
  // 켜진 신호가 먼저입니다. 없으면 기다리는 자루, 그것도 없으면 "올려 주세요".
  const live=twoSideUnits(data).filter(unit=>unit.placed&&!unit.done);
  const unit=live.find(one=>one.phase==="cue")||live[0]||null;
  const step=twoSideStep(unit);
  if(!unit||!step){
    now.textContent=twoSideWaitingUnits(data).length?text.place||"":text.done;
    now.className="ts-now";
    return;
  }
  const key=`${unit.phase==="cue"?"cue":"wait"}${step.kind[0].toUpperCase()}${step.kind.slice(1)}`;
  now.textContent=text[key]||"";
  now.className=`ts-now ${unit.phase==="cue"?"on":""}`;
}

function updateTwoSideProgress(data){
  const done=dom.miniContent?.querySelector("#tsDone");
  if(done)done.textContent=twoSideDone(data);
}

/* 조각 한 개. E8 '꽂기'와 같은 그림을 씁니다.
   그림이 없으면 예전 임시 도형으로 되돌아갑니다 — 닭고기 <b> · 대파 <em> 이고,
   익힘 색은 css 의 .grill-skewer b/em 규칙이 --cook-progress 로 입힙니다.
   ⚠️ 두 종류가 다 있을 때만 그림을 씁니다(hasArt). 한쪽만 그림이면 크기·겹침
      규칙(.has-pieces)이 임시 도형에도 걸려 조각이 서로 파고듭니다.
   ⚠️ 여기 class 차림새("gs-piece has-cook-art 재료")는 계약 점검
      (tools/skewer-day-to-night-contract-smoke.js)이 정규식으로 읽습니다.
      클래스를 더 붙이지 마세요 — 자루 단위 표시(.sauced 등)는 .grill-skewer 쪽에 겁니다. */
function grillSkewerPieceMarkup(ingredient, hasArt, cookArt, step) {
  if (!hasArt) return ingredient === "greenOnion" ? "<em></em>" : "<b></b>";
  if (!cookArt) return `<span class="gs-piece ${ingredient}">${dayPrepAssetMarkup(SKEWER_ASSET_KEY[ingredient], "gs-piece-asset", SKEWER_LABEL[ingredient])}</span>`;
  // step-N : 단계마다 손볼 자리를 css 에 열어 둡니다 (지금은 step-1 밝기 한 줄 —
  //          css 의 "납품본 밝기 보정" 참고). 몇 번째 장인지가 곧 익힘 단계입니다.
  const frames = SKEWER_COOK_STEPS.map((_, index) => dayPrepAssetMarkup(
    skewerCookAssetKey(ingredient, index), `gs-piece-asset step-${index}${index <= step ? " on" : ""}`,
    index === step ? SKEWER_LABEL[ingredient] : ""
  )).join("");
  return `<span class="gs-piece has-cook-art ${ingredient}">${frames}</span>`;
}

/* 꼬챙이. E8 과 같은 그림(skewerStick)이고, 손잡이까지 한 장에 들어 있어서
   그림이 있으면 css 임시 손잡이(.grill-skewer::after)는 끕니다. */
function grillSkewerRodMarkup() {
  const asset = dayPrepAssetMarkup("skewerStick", "gs-rod-asset");
  return asset ? `<i class="gs-rod" aria-hidden="true">${asset}</i>` : `<i class="skewer-rod" aria-hidden="true"></i>`;
}

/* 꼬치 한 자루 = 꼬챙이 + 낮에 꽂은 순서 그대로의 조각 5개.
   조각은 **아래에서 위로** 꽂았으므로 화면에는 뒤집어 쌓습니다 (E8 의 skewerRackMarkup 과 같습니다).
   ⚠️ data-skewer-index : 클릭·드래그가 "몇 번 자루인가"를 이 값으로 읽습니다
      (twoSidePointerUnit). 클래스 이름(skewer-N)에서 캐내지 않는 것은, 자루에
      붙는 클래스가 연출마다 늘고 줄어서입니다. */
function grillSkewerMarkup(pattern, index, data) {
  const hasArt = Object.values(SKEWER_ASSET_KEY).every(hasDayPrepAsset);
  const unit = twoSideUnit(data, index);
  // 익힘 단계는 화면을 만들 때 지금 단계부터 켜 둡니다 — 김치전의 pancakeCookFoodMarkup 과 같습니다.
  const cookArt = hasArt && !!data && skewerCookArtOn(data);
  const step = cookArt ? cookArtStep(unit, SKEWER_COOK_STEPS) : 0;
  if (cookArt && unit) unit.renderedCookStep = step;
  const pieces = [...pattern].reverse().map(ingredient => grillSkewerPieceMarkup(ingredient, hasArt, cookArt, step)).join("");
  const label = pattern.map(ingredient => SKEWER_LABEL[ingredient]).join(" · ");
  const flipped = (unit?.flips || 0) % 2 === 1;
  // .ts-cue-halo : 신호가 켜졌을 때 자루 뒤에 깔리는 빛무리 (css 의 "신호 표시등")
  return `<span class="grill-skewer skewer-${index + 1} ${hasArt ? "has-pieces" : ""} ${hasDayPrepAsset("skewerStick") ? "has-rod-art" : ""} ${flipped ? "flipped" : ""}" data-skewer-index="${index}" aria-label="${index + 1}번 꼬치 · ${label}">
      <i class="ts-cue-halo" aria-hidden="true"></i>${grillSkewerRodMarkup()}<span class="gs-pieces">${pieces}</span>
    </span>`;
}

/* 화로의 자리 세 칸. 아직 아무도 안 놓인 자리는 점선으로 "여기에 올려 주세요"만
   그립니다 (두부김치 플레이팅·김치전 반죽의 점선 안내와 같은 결).
   ⚠️ 칸은 처음부터 세 개 다 만들어 둡니다. 자루를 올릴 때 칸 안쪽만 갈아 끼우면
      되므로 화면을 통째로 다시 그리지 않아도 됩니다 (renderTwoSideCook 주석 참고).
   ⚠️ **자리 번호(slotIndex)와 자루 번호는 다릅니다.** 어느 자리에 무엇이 놓였는지는
      unit.slot 이 들고 있습니다 — 3번 꼬치를 왼쪽 자리에 놓을 수 있어야 해서입니다. */
function grillSlotMarkup(slotIndex, data) {
  const unit = twoSideUnits(data).find(one => one.slot === slotIndex);
  if (!unit) return `<span class="gs-slot slot-${slotIndex + 1} empty" data-order-slot="${slotIndex}" aria-label="${slotIndex + 1}번 자리 · 비어 있음"><i class="gs-slot-mark" aria-hidden="true"></i></span>`;
  const patterns = data?.skewerPatterns || skewerCookPatterns();
  return `<span class="gs-slot slot-${slotIndex + 1}" data-order-slot="${slotIndex}">${grillSkewerMarkup(patterns[unit.index], unit.index, data)}</span>`;
}

/* ── 숯불 화로 그림 5장 ──────────────────────────────────────
   화로 몸통 · 벌건 숯 · 석쇠 살까지 **한 장에 다 그려져 있습니다**. 다섯 장은
   숯이 달아올랐다 사그라드는 연속 그림이라 한 자리에 겹쳐 두고 CSS 가 차례로
   한 장씩 켭니다 (자바스크립트 타이머가 없으므로 미니게임이 닫혀도 뒷정리할
   것이 없습니다).
   ⚠️ 연기(.mg-smoke-frame)와 헷갈리기 쉬운데 **넘기는 방식이 반대**입니다.
      화로는 쉬지 않고 돌면서 딱 끊어 바꾸고(겹치면 화로가 껌뻑입니다),
      연기는 한 모금 피우고 쉬면서 겹쳐 넘깁니다(끊으면 연기가 툭툭 튑니다).
      까닭은 css/minigame/e5-two-side-cook.css 의 .cg-frame 구역에 적어 뒀습니다.

   그림이 다 있으면 예전 CSS 화로(.charcoal-bed 숯덩이 126개 · .grill-grate 살 ·
   .charcoal-flame 열기 두 겹)는 **통째로 끕니다** — 그림에 이미 다 들어 있어서
   겹치면 숯 위에 숯을 깔고 열기를 두 번 입히는 셈입니다.
   한 장이라도 빠지면 예전 화로가 그대로 나옵니다. */
const CHARCOAL_GRILL_KEYS=Object.freeze(Array.from({length:5},(_,index)=>`cookCharcoalGrill${index+1}`));

function hasCharcoalGrillArt(){
  return CHARCOAL_GRILL_KEYS.every(hasDayPrepAsset);
}

function charcoalGrillArtMarkup(){
  const frames=CHARCOAL_GRILL_KEYS.map((key,index)=>dayPrepAssetMarkup(key,`cg-frame frame-${index+1}`)).join("");
  return `<span class="charcoal-grill-art" aria-hidden="true">${frames}</span>`;
}

/* 예전 CSS 화로. 숯덩이는 화로 안쪽을 가득 채울 만큼 넉넉히 깔고 넘치는 만큼은
   .charcoal-bed 의 overflow:hidden 이 잘라 냅니다 (790 x 336 기준 126개). */
function charcoalBedShapeMarkup(){
  const coals=Array.from({length:126},()=>"<i></i>").join("");
  return `<span class="charcoal-bed" aria-hidden="true">${coals}</span><span class="grill-grate" aria-hidden="true"></span>`;
}

function charcoalSkewerMarkup(data) {
  const hasGrillArt = hasCharcoalGrillArt();
  const patterns = data?.skewerPatterns || skewerCookPatterns();
  const slots = patterns.map((_, slotIndex) => grillSlotMarkup(slotIndex, data)).join("");
  const bed = hasGrillArt ? charcoalGrillArtMarkup() : charcoalBedShapeMarkup();
  // 열기 두 겹도 그림에 들어 있습니다 (위 주석 참고)
  const flames = hasGrillArt ? "" : `<i class="charcoal-flame flame-one"></i><i class="charcoal-flame flame-two"></i>`;
  // data-order-target : 재료 카드에서 끌어온 꼬치를 받는 자리 (bindTwoSidePlacementPointers)
  return `${bed}<span class="cook-food" data-order-target="grill" aria-label="숯불에 굽는 닭꼬치 ${SKEWER_BATCH_SIZE}개">${slots}</span>${flames}`;
}

/* ============================================================
   공통 화면 틀 (컨셉 이미지 3열 구성)

     [재료 카드]  [불 위의 조리 도구]  [진행도 카드 · 조작 카드]

   김치전과 닭꼬치가 이 틀을 함께 씁니다. 채썰기·튀김 준비(engine-e2 의
   .fp-scene)와 같은 구성이고, 다른 것은 아래 TWO_SIDE_VIEW 표뿐입니다.
     · 왼쪽 재료 카드 목록
     · 진행도의 분모(김치전은 굽는 횟수 4 · 닭꼬치는 자루 3개)
     · 오른쪽 조작 카드에 놓을 안내 줄

   ⚠️ **가운데 아래 게이지 줄이 없습니다.** 예전에는 [조리 도구] 아래에 익힘 게이지 +
      문구 + Space 버튼이 한 줄 더 있었습니다(.ts-gauge-slot). 조작이 클릭·드래그로
      바뀌면서 통째로 뺐고, 그만큼 조리 칸이 457 → 615.6 으로 커졌습니다.
      되살리려면 아래 twoSideScreenMarkup 의 .ts-main 을 2줄 격자로 되돌리고
      css 의 `.ts-main { grid-template-rows }` 와 조리기구 크기를 함께 되돌리세요.
   ⚠️ **하단 공용 띠(.mg-strip)도 쓰지 않습니다** (E6 튀기기와 같습니다).

   [공용 프레임과의 관계]  채썰기·김치 볶기와 같습니다.
   ui-mini-frame.js 와 css/minigame-frame.css 는 건드리지 않고,
   이 화면이 떠 있을 때만 적용되는 규칙으로 덮어씁니다.
   ============================================================ */

const TWO_SIDE_VIEW = Object.freeze({
  pancake: Object.freeze({
    subtitle: "불빛 신호에 맞춰 김치전을 굽고 뒤집으세요!",
    ingredients: [{ id: "pancakeBatter", label: "김치전 반죽", count: 1, asset: "cookPancakeBatter" }],
    total: TWO_SIDE_COOK_CONFIG.pancake.cyclesPerUnit,   // 굽기 4번
    countLabel: "굽기",
    guide: [
      { icon: "click", name: "불빛이 켜지면 클릭", desc: "치이익 — 그 면이 익습니다" },
      { icon: "drag-up", name: "뒤집기 신호엔 드래그", desc: "위로 튕기듯 샥!" }
    ]
  }),
  skewer: Object.freeze({
    subtitle: "제한시간 안에 꼬치를 올리고, 불빛 신호에 맞춰 구워 주세요!",
    // art:"skewer" → 그림 한 장이 아니라 낮에 꽂아 둔 배치를 그대로 쌓습니다
    // (twoSideSkewerCardMarkup). cookSkewerRaw 는 그 그림들이 없을 때의 마지막 대비책입니다.
    ingredients: [{ id: "skewerRaw", label: "닭꼬치", count: SKEWER_BATCH_SIZE, asset: "cookSkewerRaw", art: "skewer" }],
    total: SKEWER_BATCH_SIZE,                            // 실제 준비 배치와 같은 꼬치 3개
    countLabel: "완성 개수",
    /* 오른쪽 칸은 [완성 개수 + 남은 시간] · [완성 담기] 두 장입니다.
       카드 크기와 '남은 시간' 줄은 멸치 손질(engine-e10)과 같은 규격이고,
       아래 칸은 튀김(engine-e6)처럼 **다 구운 꼬치를 담는 접시**입니다.
       김치전은 한 줄로 진행하므로 예전 [진행도 + 조작] 그대로입니다. */
    sidePanel: "count-serve",
    guide: [
      { icon: "drag-side", name: "꼬치를 화로로 드래그", desc: "올린 꼬치부터 익습니다" },
      { icon: "click", name: "불빛이 켜지면 클릭", desc: "치이익 — 그 꼬치가 익습니다" },
      { icon: "drag-side", name: "뒤집기 신호엔 드래그", desc: "옆으로 굴리듯 샥!" },
      { icon: "sauce", name: "양념 신호엔 클릭", desc: "붓으로 양념을 바릅니다" }
    ]
  })
});

/* ── 재료 카드에 올라가는 '낮에 꽂아 둔 닭꼬치' ─────────────────
   그림 한 장이 아니라 **화로 위 꼬치와 같은 방식으로 쌓아** 그립니다
   (grillSkewerMarkup 과 같은 조각·꼬챙이 그림 · 같은 겹침 규칙). 그래야
   재료 칸에 "내가 낮에 꽂은 그 배치"가 그대로 올라옵니다 — 닭 다섯 개를
   꽂았으면 카드에도 닭 다섯 개입니다.
   ⚠️ 익힘 단계는 올리지 않습니다(cookArt 자리에 false). 재료 칸은 "구우러 온
      재료"를 보여 주는 자리라, 굽는 동안에도 꽂아 둔 그대로여야 합니다.
   ⚠️ 조각 그림이 없어도 **빈 문자열을 돌려주지 않습니다.** 예전에는 그림이 없으면
      카드 그림 한 장(임시 도형)으로 떨어졌는데, 지금은 이 자루 하나하나가
      화로로 끌어다 놓는 손잡이라 없으면 **게임을 시작할 수가 없습니다.**
      그림이 없을 때는 조각만 임시 도형(<b>/<em>)으로 바뀝니다.
   ⚠️ 이름 앞에 twoSide 를 붙인 이유 : 이 게임들은 모듈이 아니라 **전역 스크립트**라
      파일이 달라도 같은 이름이면 나중에 읽는 파일이 앞의 것을 덮어씁니다.
      낮 '닭꼬치 꽂기'(engine-e8-order-place.js)에도 재료 카드 그림을 만드는
      skewerIngredientArtMarkup(ingredient) 이 있고, index.html 이 E5 → E8 순으로
      읽어서 이름이 겹치면 **여기 것이 조용히 사라집니다**(E8 함수가 ingredient 를
      undefined 로 받아 닭 조각 3개를 그립니다). 실제로 한 번 그랬습니다. */
function twoSideSkewerCardMarkup(data) {
  const hasArt = Object.values(SKEWER_ASSET_KEY).every(hasDayPrepAsset);
  const hasRodArt = hasDayPrepAsset("skewerStick");
  const patterns = data?.skewerPatterns || skewerCookPatterns();
  /* data-ts-place : 화로로 끌어다 올릴 때 "몇 번 자루인가" 를 이 값으로 읽습니다
     (bindTwoSidePlacementPointers). 이미 올린 자루는 카드에서 빠집니다. */
  const skewers = patterns.map((pattern, index) => {
    if (twoSideUnit(data, index)?.placed) return "";
    const pieces = [...pattern].reverse().map(ingredient => grillSkewerPieceMarkup(ingredient, hasArt, false, 0)).join("");
    const label = pattern.map(ingredient => SKEWER_LABEL[ingredient]).join(" · ");
    return `<button type="button" class="ts-ing-pick" data-ts-place="${index}" aria-label="${index + 1}번 꼬치 · ${label}">
        <span class="grill-skewer ${hasArt ? "has-pieces" : ""} ${hasRodArt ? "has-rod-art" : ""}">
          ${grillSkewerRodMarkup()}<span class="gs-pieces">${pieces}</span>
        </span>
      </button>`;
  }).join("");
  return `<span class="ts-ing-skewers ${hasArt ? "" : "no-art"}" aria-label="낮에 꽂아 둔 닭꼬치 ${SKEWER_BATCH_SIZE}개">${skewers}</span>`;
}

// 왼쪽 재료 카드 한 장. art:"skewer" 인 재료만 위 꼬치 쌓기를 쓰고, 나머지는 그림 한 장입니다.
function twoSideIngredientMarkup(item, data) {
  const isSkewer = item.art === "skewer";
  const asset = isSkewer ? twoSideSkewerCardMarkup(data)
    : dayPrepAssetMarkup(item.asset, "ts-ing-asset", item.label);
  // 닭꼬치는 올린 만큼 카드에서 줄어듭니다 (#tsIngLeft 는 placeTwoSideUnit 이 고쳐 씁니다)
  const left = isSkewer && data ? twoSideWaitingUnits(data).length : item.count;
  return `<div class="ts-ing-card ${item.id} ${isSkewer && !left ? "empty" : ""}">
      <div class="ts-ing-art ${asset ? "has-asset" : ""}"><i></i>${asset}</div>
      <p class="ts-ing-name">${item.label} <b id="${isSkewer ? "tsIngLeft" : ""}">×${left}</b></p>
    </div>`;
}

/* ── 오른쪽 '완성 담기' 칸 ───────────────────────────────────
   튀김(engine-e6)처럼 **다 구운 꼬치를 여기로 끌어다 담아야** 한 개로 셉니다.
   원래 이 자리는 '참고 모양'(잘 구워진 꼬치 견본)이었는데, 담는 자리가 필요해져
   통째로 바꿨습니다.
   ⚠️ 접시는 아직 원화가 없어 **임시 CSS 도형**입니다 (css 의 .ts-serve-plate).
      그림이 들어오면 거기에 .has-asset 갈래를 하나 만들면 됩니다 —
      담긴 꼬치(.ts-served)는 접시 그림과 무관하게 그대로 쓸 수 있습니다. */
function twoSideServeMarkup(data) {
  const served = twoSideUnits(data).filter(unit => unit.served);
  return `<div class="ts-serve-plate ${served.length ? "filled" : ""}" data-order-target="serve" aria-label="다 구운 꼬치를 담는 접시">
      <i class="ts-serve-dish" aria-hidden="true"></i>
      <span class="ts-serve-stack">${served.map(unit => twoSideServedSkewerMarkup(data, unit)).join("")}</span>
      <i class="ts-serve-mark" aria-hidden="true"></i>
    </div>`;
}

// 접시에 담긴 꼬치 한 자루. 화로 위와 같은 그림이고 크기만 접시에 맞춥니다.
function twoSideServedSkewerMarkup(data, unit) {
  const pattern = (data?.skewerPatterns || skewerCookPatterns())[unit.index] || SKEWER_COOK_FALLBACK;
  const hasArt = Object.values(SKEWER_ASSET_KEY).every(hasDayPrepAsset);
  const cookArt = hasArt && skewerCookArtOn(data);
  const step = cookArt ? cookArtStep(unit, SKEWER_COOK_STEPS) : 0;
  const pieces = [...pattern].reverse().map(ingredient => grillSkewerPieceMarkup(ingredient, hasArt, cookArt, step)).join("");
  return `<span class="ts-served" aria-label="${unit.index + 1}번 꼬치 완성">
      <span class="grill-skewer ${hasArt ? "has-pieces" : ""} ${hasDayPrepAsset("skewerStick") ? "has-rod-art" : ""} sauced">
        ${grillSkewerRodMarkup()}<span class="gs-pieces">${pieces}</span>
      </span>
    </span>`;
}

/* 오른쪽 조작 카드. **키 버튼이 없습니다** — 예전에는 여기에 실제로 누르는
   ↑↓ · ←→ 키캡이 있었고 키보드와 짝이었습니다(.ts-keys / #reboundUp / #skewerFlipLeft …).
   조작이 클릭·드래그로 바뀌면서 통째로 안내 줄로 갈았습니다.
   맨 아래 #tsNow 한 줄만 진행에 따라 글자가 바뀝니다 (updateTwoSideHint). */
function twoSideGuideMarkup(view) {
  const rows = view.guide.map(row => `<span class="ts-guide-row">
      <i class="ts-guide-icon ${row.icon}" aria-hidden="true"></i>
      <span class="ts-guide-text"><b>${row.name}</b><em>${row.desc}</em></span>
    </span>`).join("");
  return `<div class="ts-guide">${rows}</div><p class="ts-now" id="tsNow"></p>`;
}

/* 후라이팬 그림은 E3 김치 볶기와 **같은 파일**입니다 (DAY_PREP_ASSET_PATHS 의 fryingPan).
   손잡이까지 들어 있어서 자리 잡는 규칙도 같습니다 — css/minigames.css 의 .two-side-pan 참고. */
function pancakePanShell(inner, extraClass = "", id = "") {
  const asset = dayPrepAssetMarkup("fryingPan", "two-side-pan-asset", "후라이팬");
  // .ts-cue-halo : 신호가 켜졌을 때 김치전 뒤에 깔리는 빛무리 (css 의 "신호 표시등")
  return `<div class="two-side-pan pancake-cook ${asset ? "has-prep-asset" : ""} ${extraClass}"${id ? ` id="${id}"` : ""}><i class="ts-cue-halo" aria-hidden="true"></i>${asset}${inner}</div>`;
}

/* 굽는 김치전. 익힘 단계 5장을 같은 자리에 겹쳐 깔고 지금 단계까지를 켭니다
   (위 updatePancakeCookArt 참고). 한 장이라도 빠지면 예전처럼 CSS 도형으로 그립니다. */
function pancakeCookFoodMarkup(data){
  const hasArt=PANCAKE_COOK_STEPS.every(step=>hasDayPrepAsset(step.key)),unit=twoSideUnit(data,0);
  const step=hasArt?cookArtStep(unit,PANCAKE_COOK_STEPS):0;
  if(hasArt&&unit)unit.renderedCookStep=step;
  // 신호 빛무리는 팬(.pancake-cook)에 붙습니다 — 아래 pancakePanShell 이 넣어 줍니다
  const frames=hasArt?PANCAKE_COOK_STEPS.map((frame,index)=>dayPrepAssetMarkup(
    frame.key,`pancake-food-asset${index<=step?" on":""}`,index===step?"굽는 김치전":""
  )).join(""):"";
  return `<i class="cook-food ${hasArt?"has-asset":""}">${frames}<span class="cook-bubbles" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></span></i>`;
}

/* 김치전 위로 피어오르는 연기. 김치 볶기·볶음우동과 **같은 공용 조각**입니다
   (day-prep-minigames.js 의 minigameSmokeMarkup). 기둥 셋이 서로 다른 박자로
   한 모금씩 피우고, 자리는 모금마다 김치전 위에서 새로 뽑습니다.
   ⚠️ 그리고 나서 반드시 mountMinigameSmoke 를 불러야 첫 자리가 잡힙니다 —
      renderTwoSideCook 이 화면을 그린 직후에 한 번 부릅니다.
   그림이 없으면 예전 CSS 김(.cook-steam) 두 줄이 그대로 보입니다. */
function pancakeSmokeMarkup(){
  return minigameSmokeMarkup(3)||`<i class="cook-steam steam-one"></i><i class="cook-steam steam-two"></i>`;
}

// 가운데 조리 도구. 김치전은 불 위의 팬, 닭꼬치는 숯불 화로입니다.
function twoSideStageMarkup(data, extraClass = "") {
  // has-grill-art : 화로 그림이 있으면 임시 도형의 몸통(테두리·배경·그림자)을 끕니다
  if (data.dishStyle === "skewer") return `<div class="two-side-pan skewer-cook ${hasCharcoalGrillArt() ? "has-grill-art" : ""} ${extraClass}" id="tsPan">${charcoalSkewerMarkup(data)}</div>`;
  // 화구(가스버너)와 팬은 분리된 두 겹입니다 — day-prep-minigames.js 의 minigameBurnerMarkup 참고
  // side-N : 지금 보이는 면. 뒤집을 때는 performTwoSideFlip 이 클래스만 갈아 끼우지만,
  //          화면을 처음 그릴 때(그리고 점검용 하네스)는 여기서 뒤집은 횟수로 정합니다.
  const side=(twoSideUnit(data,0)?.flips||0)%2;
  return `<div class="ts-cooktop">
      ${minigameBurnerMarkup("gas")}
      ${pancakePanShell(`${pancakeCookFoodMarkup(data)}${pancakeSmokeMarkup()}`,`${extraClass} side-${side}`,"tsPan")}
    </div>`;
}

/* 오른쪽 칸. 두 얼개가 있습니다.
     기본         [진행도 + 남은 시간 띠] · [조작 안내]        — 김치전
     count-serve  [완성 개수 + 남은 시간 초] · [완성 담기]     — 닭꼬치
                  (카드 크기·남은 시간 줄은 멸치 손질과 같은 규격입니다)
   닭꼬치는 자루 3개가 따로 도는지라 "지금 할 일" 한 줄로 안내가 안 됩니다.
   대신 남은 시간을 초로 크게 보여 주고, 조작은 아래 TIP 띠가 맡습니다. */
function twoSideSideMarkup(view, data, { done, total, timePercent }) {
  const time = `<p class="ts-time-left" id="tsTime"><span>남은 시간</span><b>${(data.timeLimit||0).toFixed(1)}초</b></p>`;
  if (view.sidePanel === "count-serve") {
    return `<div class="ts-panel ts-count ts-count-big">
          <h3 class="ts-col-title">${view.countLabel}</h3>
          <strong><b id="tsDone">${done}</b> / ${total}</strong>
          ${time}
        </div>
        <div class="ts-panel ts-serve">
          <h3 class="ts-col-title">완성 담기</h3>
          <div class="ts-serve-figure">${twoSideServeMarkup(data)}</div>
          <p class="ts-now" id="tsNow"></p>
        </div>`;
  }
  return `<div class="ts-panel ts-count">
          <h3 class="ts-col-title">${view.countLabel}</h3>
          <strong><b id="tsDone">${done}</b> / ${total}</strong>
          <div class="ts-time" title="남은 시간"><i id="tsTimeBar" style="width:${timePercent}%"></i></div>
        </div>
        <div class="ts-panel ts-control">
          <h3 class="ts-col-title">조작</h3>
          ${twoSideGuideMarkup(view)}
        </div>`;
}

function twoSideScreenMarkup(view, data, { board, done, total, timePercent, sceneClass = "" }) {
  return `<div class="ts-scene ${sceneClass}">
      <aside class="ts-col">
        <div class="ts-panel ts-ing-panel">
          <h3 class="ts-col-title starred">재료</h3>
          <div class="ts-ing-list">${view.ingredients.map(item=>twoSideIngredientMarkup(item,data)).join("")}</div>
        </div>
      </aside>
      <div class="ts-main">
        <div class="ts-board">
          ${board}
          <strong class="e5-result" id="e5Result" aria-live="polite"></strong>
        </div>
      </div>
      <aside class="ts-col">${twoSideSideMarkup(view,data,{done,total,timePercent})}</aside>
    </div>`;
}

/* 화면은 **판이 시작할 때 한 번만** 그립니다.
   ⚠️ 예전에는 단계가 바뀔 때마다 다시 그렸습니다(굽기 → 뒤집기 → 굽기). 지금은
      단계가 자주 바뀌는 데다(김치전 7번 · 닭꼬치 12번) 다시 그릴 때마다
        · 연기 기둥이 새로 만들어져 박자가 끊기고
        · 진행 중인 붓·뒤집기 연출이 지워지고
        · 포인터를 잡고 있던 드래그가 끊깁니다.
      그래서 바뀌는 것은 전부 **클래스와 글자만** 갈아 끼웁니다
      (clearTwoSideCue · updateTwoSideHint · updateTwoSideProgress · 익힘 그림 4함수). */
function renderTwoSideCook() {
  const m = state.mini; if (!m || m.engine !== "twoSideCook") return;
  const data = m.data, isSkewer = data.dishStyle === "skewer", view = TWO_SIDE_VIEW[data.dishStyle];
  // 뒤집개 커서는 김치전 화면에서만, 그림이 있을 때만 켭니다 (아래 mountTwoSideSpatula)
  const hasSpatula = !isSkewer && hasDayPrepAsset("cookSpatulaCursor");
  dom.miniContent.innerHTML = twoSideScreenMarkup(view, data, {
    board: twoSideStageMarkup(data),
    done: twoSideDone(data), total: view.total,
    timePercent: data.timeLimit ? clamp(m.time / data.timeLimit, 0, 1) * 100 : 100,
    sceneClass: hasSpatula ? "has-spatula" : ""
  });
  if (hasSpatula) mountTwoSideSpatula();
  /* 연기 기둥의 첫 자리를 잡습니다. 닭꼬치 화면에는 기둥이 없어서 그냥 지나갑니다. */
  mountMinigameSmoke(dom.miniContent);
  bindTwoSideCookPointer();
  bindTwoSidePlacementPointers();
  bindTwoSideServePointers();   // 이미 다 구운 자루가 있는 화면(하네스·다시 그리기)을 위해
  updateTwoSideCookVisual(data);
  updateTwoSideHint(data);
}

/* 다 익히고 뒤집고 발랐는가 + 한 번도 안 놓쳤는가.
   신호마다 매긴 점수(twoSideCueScore)가 전부 94 위여야 PERFECT 입니다.
   ⚠️ 시간이 끝나 못 마친 자루가 있으면 PERFECT 가 아닙니다. */
function twoSideCookGrade(data){
  return twoSideAllDone(data)&&!data.timedOut
    &&data.hits.every(score=>score>=94)&&!(data.flipErrors||0)&&!(data.cookErrors||0)?"perfect":"good";
}

function finishTwoSideCook(m){
  if(m.complete)return;
  const data=m.data;
  const grade=twoSideCookGrade(data);
  const average=Math.round(data.hits.reduce((sum,score)=>sum+score,0)/Math.max(1,data.hits.length));
  // 못 마친 자루가 있으면 그만큼 깎습니다 (시간 종료로 들어온 길)
  const missing=twoSideUnits(data).filter(unit=>!unit.done).length;
  const score=grade==="perfect"?100
    :Math.round(clamp(average-(data.flipErrors||0)*5-(data.cookErrors||0)*4-missing*12,40,95));
  const result=dom.miniContent.querySelector("#e5Result");
  dom.miniContent.querySelector(".ts-board")?.classList.add("e5-complete");
  if(result){result.textContent=grade==="perfect"?"PERFECT":"GOOD";result.classList.add(grade,"show");}
  dom.miniFeedback.textContent=grade==="perfect"?"양면을 완벽하게 익혔습니다!":"맛있게 구워냈습니다!";
  finishMini(score);
}

/* 제한시간 종료. 멸치 손질(engine-e10 의 timeoutAnchovy)과 같은 마감입니다 —
   돌던 신호를 전부 끄고 TIME OVER 를 잠깐 보여 준 뒤, 그때까지 끝낸 만큼으로 마칩니다. */
const TWO_SIDE_TIMEOUT_END_MS=1200;

function timeoutTwoSideCook(m){
  if(m.complete||m.data.timedOut)return;
  const data=m.data;
  data.timedOut=true;
  clearTwoSideCue(data);
  const board=dom.miniContent?.querySelector(".ts-board");
  if(board){
    board.classList.add("time-over");
    board.insertAdjacentHTML("beforeend",
      `<div class="ts-timeout"><strong>TIME OVER</strong><span>${twoSideDone(data)} / ${TWO_SIDE_VIEW[data.dishStyle].total} 완성</span></div>`);
  }
  dom.miniFeedback.textContent="시간이 끝났습니다. 여기까지 구운 것으로 마칩니다.";audio.bad();
  setTimeout(()=>{if(state.mini===m&&!m.complete)finishTwoSideCook(m);},TWO_SIDE_TIMEOUT_END_MS);
}

/* ============================================================
   고양이 발 뒤집개 커서 (김치전 굽기 전용)

   화구 위에 마우스를 올리면 포인터가 뒤집개로 바뀝니다. CSS `cursor: url()` 이
   아니라 **DOM 한 겹을 body 에 붙여 포인터를 따라다니게** 합니다 —
   크롬이 커서 그림을 128x128 로 제한해서 그 크기로는 뒤집개가 뭉개집니다.
   E6 튀기기의 집게 커서(mountFryCursor)와 같은 방식이고, 기본 포인터를 숨기는
   것은 css 의 `.ts-scene.has-spatula .ts-cooktop { cursor:none }` 입니다.

   [치우기] 미니게임 엔진에는 teardown 이 없습니다. 그래서 포인터가 움직일 때마다
   화면이 아직 있는지 보고, 없으면 그때 스스로 지웁니다.
   ============================================================ */

const TWO_SIDE_SPATULA_ZONE=".ts-cooktop";   // 화구 + 팬이 있는 칸
let twoSideSpatula=null;              // document.body 에 붙는 <img>
let twoSideSpatulaListening=false;

function mountTwoSideSpatula(){
  if(!twoSideSpatula){
    const image=document.createElement("img");
    image.className="ts-spatula-cursor";
    image.src=dayPrepAssets.cookSpatulaCursor.src;
    image.alt=""; image.draggable=false;
    image.setAttribute("aria-hidden","true");
    document.body.appendChild(image);
    twoSideSpatula=image;
  }
  if(twoSideSpatulaListening)return;
  twoSideSpatulaListening=true;
  // capture 로 받습니다 — 중간에서 이벤트를 막아도 커서는 따라가야 합니다.
  ["pointermove","pointerdown","pointerup","pointercancel"]
    .forEach(type=>document.addEventListener(type,trackTwoSideSpatula,true));
}

function removeTwoSideSpatula(){
  twoSideSpatula?.remove();
  twoSideSpatula=null;
  twoSideSpatulaListening=false;
  ["pointermove","pointerdown","pointerup","pointercancel"]
    .forEach(type=>document.removeEventListener(type,trackTwoSideSpatula,true));
}

function trackTwoSideSpatula(event){
  if(!twoSideSpatula)return;
  const scene=dom.miniContent?.querySelector(".ts-scene.has-spatula");
  if(!scene){removeTwoSideSpatula();return;}          // 미니게임이 끝났습니다
  /* 화구 위인지는 **자리로** 봅니다(elementFromPoint). event.target 으로 보면 안 됩니다 —
     누르는 순간 도마(.ts-board)가 포인터를 잡아채서(setPointerCapture) 그 뒤로는
     event.target 이 전부 도마가 되고, 도마는 화구(.ts-cooktop)의 **바깥 상자**라
     closest 가 빈손으로 돌아옵니다. 그래서 **클릭만 하면 뒤집개가 사라졌습니다.**
     (뒤집개 그림 자체는 pointer-events:none 이라 이 검사에 안 걸립니다) */
  const point=document.elementFromPoint(event.clientX,event.clientY);
  const over=point instanceof Element&&scene.contains(point)&&!!point.closest(TWO_SIDE_SPATULA_ZONE);
  twoSideSpatula.classList.toggle("show",over);
  if(!over)return;
  twoSideSpatula.style.left=`${event.clientX}px`;
  twoSideSpatula.style.top=`${event.clientY}px`;
  if(event.type==="pointerdown")twoSideSpatula.classList.add("pressed");
  if(event.type==="pointerup"||event.type==="pointercancel")twoSideSpatula.classList.remove("pressed");
}
