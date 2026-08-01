"use strict";

/* ============================================================
   낮 준비 미니게임 — 공용 부분

   게임 로직은 전부 engine-e1~e11 파일로 나갔습니다.
   여기 남은 것은 모든 낮 준비 게임이 함께 쓰는 것들뿐입니다.
     · 재료별 칼질 설정값 · 에셋 경로와 로더
     · 준비 미니게임을 열고 닫는 공통 절차
     · 엔진/시작함수 등록 창구

   [낮 준비가 밤 조리와 다른 점]
   밤 조리는 게임 하나가 끝날 때까지 종류가 그대로지만,
   낮 준비는 도중에 종류가 바뀝니다(반죽 재료 넣기 → 거품기 젓기).
   그래서 setDayPrepData 로 data 를 갈아끼울 때 엔진 이름도 함께 바꿉니다.
   엔진 이름은 data.mode 문자열을 그대로 씁니다.
   ============================================================ */

// 날짜별 준비 미니게임 모듈. 메뉴 Task ID별 진행 상태를 서로 분리합니다.
const DAY_PREP_MINI_CONFIG = {
  cutRadish:{title:"어묵탕 · 무 썰기",total:4,zoneWidth:.12,zoneStarts:[.14,.55,.29,.67],speed:.78},
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:4,zoneWidth:.14,zoneStarts:[.2,.58,.32,.68],speed:.8,horizontalLastCut:true},
  cutTofuKimchi:{title:"두부김치 · 김치 썰기",ingredient:"kimchi",total:5,zoneWidth:.16,zoneStarts:[.51,.18,.62,.34,.7],speed:.74},
  cutPancakeKimchi:{title:"김치전 · 김치 썰기",ingredient:"kimchi",total:5,zoneWidth:.16,zoneStarts:[.22,.58,.39,.68,.14],speed:.78},
  cutSkewerChicken:{title:"닭꼬치 · 닭 썰기",ingredient:"chicken",total:5,zoneWidth:.14,zoneStarts:[.18,.55,.31,.68,.42],speed:.8,requiresDoubleTap:true},
  cutSkewerGreenOnion:{title:"닭꼬치 · 대파 썰기",ingredient:"greenOnion",total:4,zoneWidth:.14,zoneStarts:[.56,.2,.65,.36],speed:.82},
  cutTofuBlock:{title:"두부김치 · 두부 썰기",ingredient:"tofu",total:6,zoneWidth:.14,zoneStarts:[.18,.56,.3,.67,.42,.22],speed:.78},
  cleanAnchovy:{title:"어묵탕 · 멸치 머리 떼기",total:7,timeLimit:25,requiredShakes:3,swingDistance:18}
};

const DAY3_MANDOLINE_CONFIG=Object.freeze({
  sliceYakisobaCabbage:{ingredient:"cabbage",label:"양배추",cycles:6},
  sliceYakisobaCarrot:{ingredient:"carrot",label:"당근",cycles:5}
});
const BREADCRUMB_KEY_PAIRS=Object.freeze([["a","d"],["q","e"],["f","j"],["z","c"],["j","l"]]);

// 아래 경로에 파일을 추가하면 CSS 프로토타입 대신 자동으로 이미지가 사용됩니다.
// 누락된 선택 에셋은 로딩 실패로 취급하지 않고 기존 CSS 도형으로 대체합니다.
const DAY_PREP_ASSET_PATHS = Object.freeze({
  radish0:"assets/prep/cutting/radish/radish-0.png",
  radish1:"assets/prep/cutting/radish/radish-1.png",
  radish2:"assets/prep/cutting/radish/radish-2.png",
  radish3:"assets/prep/cutting/radish/radish-3.png",
  radish4:"assets/prep/cutting/radish/radish-4.png",
  fishCake0:"assets/prep/cutting/fish-cake/fish-cake-0.png",
  fishCake1:"assets/prep/cutting/fish-cake/fish-cake-1.png",
  fishCake2:"assets/prep/cutting/fish-cake/fish-cake-2.png",
  fishCake3:"assets/prep/cutting/fish-cake/fish-cake-3.png",
  fishCake4:"assets/prep/cutting/fish-cake/fish-cake-4.png",
  kimchiCut0:"assets/prep/cutting/kimchi/kimchi-0.png",
  kimchiCut1:"assets/prep/cutting/kimchi/kimchi-1.png",
  kimchiCut2:"assets/prep/cutting/kimchi/kimchi-2.png",
  kimchiCut3:"assets/prep/cutting/kimchi/kimchi-3.png",
  kimchiCut4:"assets/prep/cutting/kimchi/kimchi-4.png",
  kimchiCut5:"assets/prep/cutting/kimchi/kimchi-5.png",
  chicken0:"assets/prep/cutting/chicken/chicken-0.png",
  chicken1:"assets/prep/cutting/chicken/chicken-1.png",
  chicken2:"assets/prep/cutting/chicken/chicken-2.png",
  chicken3:"assets/prep/cutting/chicken/chicken-3.png",
  chicken4:"assets/prep/cutting/chicken/chicken-4.png",
  chicken5:"assets/prep/cutting/chicken/chicken-5.png",
  greenOnion0:"assets/prep/cutting/green-onion/green-onion-0.png",
  greenOnion1:"assets/prep/cutting/green-onion/green-onion-1.png",
  greenOnion2:"assets/prep/cutting/green-onion/green-onion-2.png",
  greenOnion3:"assets/prep/cutting/green-onion/green-onion-3.png",
  greenOnion4:"assets/prep/cutting/green-onion/green-onion-4.png",
  tofu0:"assets/prep/cutting/tofu/tofu-0.png",
  tofu1:"assets/prep/cutting/tofu/tofu-1.png",
  tofu2:"assets/prep/cutting/tofu/tofu-2.png",
  tofu3:"assets/prep/cutting/tofu/tofu-3.png",
  tofu4:"assets/prep/cutting/tofu/tofu-4.png",
  tofu5:"assets/prep/cutting/tofu/tofu-5.png",
  tofu6:"assets/prep/cutting/tofu/tofu-6.png",
  anchovyBody:"assets/prep/anchovy/anchovy-body.png",
  anchovyHead:"assets/prep/anchovy/anchovy-head.png",
  // 닭꼬치 꽂기 (engine-e8). assets/minigame/E8/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //   piece  꼬치에 꽂히는 조각 한 개 (512x448 캔버스 한가운데)
  //   group  좌측 재료 카드에 놓는 묶음 그림
  skewerChicken:"assets/minigame/E8/food_skewer_chicken_piece.webp",
  skewerGreenOnion:"assets/minigame/E8/food_skewer_green_onion_piece.webp",
  skewerChickenGroup:"assets/minigame/E8/food_skewer_chicken_group.webp",
  skewerGreenOnionGroup:"assets/minigame/E8/food_skewer_green_onion_group.webp",
  skewerStick:"assets/minigame/E8/prop_skewer_stick.webp",
  // 김치전 반죽 (engine-e8 → e9). 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  batterFlour:"assets/prep/batter/flour.png",
  batterWater:"assets/prep/batter/water.png",
  batterKimchi:"assets/prep/batter/kimchi.png",
  batterBowl:"assets/prep/batter/bowl.png",
  batterDone:"assets/prep/batter/batter-done.png",
  // E9는 단계별 반죽과 거품기를 선택 에셋으로 교체할 수 있습니다. 파일이 없으면 CSS 도형을 씁니다.
  batterMix0:"assets/prep/batter/mix-0.png",
  batterMix1:"assets/prep/batter/mix-1.png",
  batterMix2:"assets/prep/batter/mix-2.png",
  batterMix3:"assets/prep/batter/mix-3.png",
  batterMix4:"assets/prep/batter/mix-4.png",
  batterWhisk:"assets/prep/batter/whisk.png",
  // 소스 제조 (engine-e7). 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  sauceBottleSoy:"assets/prep/sauce/bottle-soy.png",
  sauceBottleOyster:"assets/prep/sauce/bottle-oyster.png",
  sauceBottleChili:"assets/prep/sauce/bottle-chili.png",
  sauceBottleGochujang:"assets/prep/sauce/bottle-gochujang.png",
  sauceBottleOligosaccharide:"assets/prep/sauce/bottle-oligosaccharide.png",
  sauceBowl:"assets/prep/sauce/bowl.png",
  // 흰색 실루엣 마스크 3장만 준비하면 재료 색은 E7 설정값으로 입힙니다.
  sauceFlowThin:"assets/prep/sauce/flow-thin.png",
  sauceFlowSyrup:"assets/prep/sauce/flow-syrup.png",
  sauceFlowThick:"assets/prep/sauce/flow-thick.png",
  // 김치 볶기 (engine-e3). 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  fryingPan:"assets/prep/kimchi/frying-pan.png",
  fryingKimchi:"assets/prep/kimchi/frying-kimchi.png",
  fryStove:"assets/prep/kimchi/stove.png",
  fryWoodenSpatula:"assets/prep/kimchi/wooden-spatula.png",
  fryIngKimchi:"assets/prep/kimchi/fry-ing-kimchi.png",
  fryIngSugar:"assets/prep/kimchi/fry-ing-sugar.png",
  // 볶음우동 철판 볶기 (engine-e3 · 밤 조리). 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  // stirGriddle 은 불까지 함께 그려진 철판 한 장이고, stirNoodles 는 그 위에 올라갑니다.
  stirGriddle:"assets/prep/yakisoba/griddle.png",
  stirNoodles:"assets/prep/yakisoba/noodles.png",
  stirTeppanSpatula:"assets/prep/yakisoba/teppan-spatula.png",
  stirIngUdon:"assets/prep/yakisoba/ing-udon.png",
  stirIngSauce:"assets/prep/yakisoba/ing-sauce.png",
  stirIngVeggie:"assets/prep/yakisoba/ing-veggie.png",
  // 화력 유지 (engine-e4). 불꽃·증기·거품은 CSS이며 완성 냄비 그림만 메뉴별 한 장입니다.
  heatOdenPot:"assets/prep/heat/oden-pot.png",
  heatTteokbokkiPot:"assets/prep/heat/tteokbokki-pot.png",
  // 채칼 (engine-e2). 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  // 감자는 손질 단계별 그림 11장을 따로 씁니다 (아래 potatoMandoline0~10)
  mandolinePlate:"assets/prep/mandoline/plate.png",
  mandolineCabbage:"assets/prep/mandoline/cabbage.png",
  mandolineCarrot:"assets/prep/mandoline/carrot.png",
  knife:"assets/prep/effects/knife.png",
  ...Object.fromEntries(TTEOKBOKKI_CUT_SEQUENCE.flatMap(item=>item.progressSprites.map((src,index)=>[`${item.assetPrefix}${index}`,src]))),
  ...Object.fromEntries(Array.from({length:11},(_,index)=>[`potatoMandoline${index}`,`assets/prep/day4/fries/potato-${index}.png`])),
  // 감자튀김 준비(봉투 흔들기). 봉투 그림 한 장에 감자채와 튀김가루가 함께 있고,
  // 숫자는 가루가 묻은 정도(%)입니다. 파일이 없으면 CSS 임시 봉투를 씁니다.
  friesShakeBag0:"assets/prep/day4/fries/shake-bag-0.png",
  friesShakeBag35:"assets/prep/day4/fries/shake-bag-35.png",
  friesShakeBag70:"assets/prep/day4/fries/shake-bag-70.png",
  friesShakeBag100:"assets/prep/day4/fries/shake-bag-100.png",
  friesPotatoStrips:"assets/prep/day4/fries/potato-strips.png",
  // 새우튀김 준비. 그릇 3개와 새우의 옷 입은 상태 4장입니다.
  shrimpVesselFlour:"assets/prep/day3/shrimp/vessel-flour.png",
  shrimpVesselEgg:"assets/prep/day3/shrimp/vessel-egg.png",
  shrimpVesselBreadcrumbs:"assets/prep/day3/shrimp/vessel-breadcrumbs.png",
  shrimpStateRaw:"assets/prep/day3/shrimp/shrimp-raw.png",
  shrimpStateFlour:"assets/prep/day3/shrimp/shrimp-flour.png",
  shrimpStateEgg:"assets/prep/day3/shrimp/shrimp-egg.png",
  shrimpStateBreadcrumbs:"assets/prep/day3/shrimp/shrimp-breadcrumbs.png",
  shrimpIngFlour:"assets/prep/day3/shrimp/ing-flour.png",
  shrimpIngEgg:"assets/prep/day3/shrimp/ing-egg.png",
  shrimpIngCrumbs:"assets/prep/day3/shrimp/ing-breadcrumbs.png",
  // 단발 액션 (engine-e11 · 플레이팅 / 냄비에 넣기 / 육수 넣기).
  // 재료 그림은 카드·그릇·참고 모양에 같은 파일이 쓰입니다.
  // 그릇은 빈 그릇(osPlate/osPot)과 완성 참고용(osPlateDone/osPotDone) 두 장입니다.
  osTofuSlices:"assets/prep/one-shot/tofu-slices.png",
  osFriedKimchi:"assets/prep/one-shot/fried-kimchi.png",
  osRadish:"assets/prep/one-shot/radish.png",
  osFishCake:"assets/prep/one-shot/fish-cake.png",
  osAnchovy:"assets/prep/one-shot/anchovy.png",
  osBroth:"assets/prep/one-shot/broth.png",
  osPlate:"assets/prep/one-shot/plate.png",
  osPlateDone:"assets/prep/one-shot/plate-done.png",
  osPot:"assets/prep/one-shot/pot.png",
  osPotDone:"assets/prep/one-shot/pot-done.png",
  // 김치전 굽기 · 닭꼬치 굽기 (engine-e5 · 밤 조리)의 왼쪽 재료 카드.
  // 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  cookPancakeBatter:"assets/prep/two-side/pancake-batter.png",
  cookSkewerRaw:"assets/prep/two-side/skewer-raw.png",
  // 실제 조리 음식은 메뉴별 1장만 있으면 익힘 단계의 색·기포·그을음을 CSS로 합성합니다.
  cookPancakeFood:"assets/prep/two-side/pancake.png",
  cookSkewerFood:"assets/prep/two-side/skewer.png",
  // E8 불리기. 볼·물통은 공용이고 떡/우동 한 장을 반복 배치합니다.
  soakBowl:"assets/prep/soak/bowl.png",
  soakWater:"assets/prep/soak/water-pitcher.png",
  soakTteok:"assets/prep/soak/tteok.png",
  soakUdon:"assets/prep/soak/udon.png"
});
const dayPrepAssets={};

function loadDayPrepAssets(){
  return Promise.all(Object.entries(DAY_PREP_ASSET_PATHS).map(([key,src])=>new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{dayPrepAssets[key]={src,image};resolve(image);};
    image.onerror=()=>resolve(null);
    image.src=src;
  }))).then(()=>dayPrepAssets);
}

function hasDayPrepAsset(key){
  return !!dayPrepAssets[key];
}

function dayPrepAssetMarkup(key,className,alt=""){
  if(!hasDayPrepAsset(key))return "";
  return `<img class="prep-asset ${className}" src="${dayPrepAssets[key].src}" alt="${alt}" draggable="false" />`;
}

function timingAssetKey(ingredient,successes,assetPrefix=""){
  if(assetPrefix)return `${assetPrefix}${successes}`;
  if(ingredient==="radish")return `radish${successes}`;
  if(ingredient==="kimchi")return `kimchiCut${successes}`;
  return `${ingredient}${successes}`;
}

function isDayPrepMini(mini=state.mini){
  return mini?.context?.mode==="dayPrep";
}

// Day4 준비 진행 표시줄. 떡볶이 칼질이 재료별 3개로 나뉘어 칸도 3개입니다.
// 칸 번호는 day4-prep-data.js 의 TTEOKBOKKI_CUT_SEQUENCE flowIndex 와 맞춰야 합니다.
function day4PrepFlowMarkup(menuId,currentIndex){
  const steps=menuId==="tteokbokki"?["떡 불리기","양배추","대파","어묵","양념장"]:["감자 채칼","튀김가루 묻히기"];
  return `<div class="shrimp-coat-order day4-prep-flow">${steps.map((label,index)=>`<span class="${index<currentIndex?"done":index===currentIndex?"current":""}">${index<currentIndex?"✓ ":""}${label}</span>`).join("<b>→</b>")}</div>`;
}

/* ---- 엔진 등록 창구 ----------------------------------------
   engine-e*.js 파일들이 로드되면서 아래 두 함수를 호출해
   자기 자리를 채웁니다. 이 파일은 무엇이 등록되는지 알 필요가 없습니다. */

// task.miniGame 값 → 그 게임을 시작하는 함수
const DAY_PREP_SETUPS={};

function registerDayPrepSetup(miniGameKey,setupFn){
  if(DAY_PREP_SETUPS[miniGameKey])console.warn(`낮 준비 시작함수가 중복됩니다: ${miniGameKey}`);
  DAY_PREP_SETUPS[miniGameKey]=setupFn;
}

// 낮 준비 엔진을 등록합니다. modes 는 문자열 하나 또는 배열.
// 어느 게임이든 ESC 로 닫히는 것과 제한시간이 없다는 점은 공통이라 여기서 붙여 줍니다.
function registerDayPrepEngine(modes,engine){
  const wrapped={
    timerRuns(){return false;},                 // 낮 준비에는 제한시간이 없습니다
    update:engine.update,
    action:engine.action,
    keyup:engine.keyup,
    key(m,k,e){
      if(k==="escape"){closeDayPrepMini();return true;}
      return engine.key?engine.key(m,k,e):false;
    }
  };
  for(const mode of [].concat(modes))registerMiniEngine(mode,wrapped);
}

// 진행 중인 게임의 데이터를 갈아끼웁니다. 엔진 이름(m.engine)도 함께 바뀝니다.
// 낮 준비는 도중에 게임 종류가 바뀌므로(반죽 → 거품기) 반드시 이 함수를 쓰세요.
function setDayPrepData(data){
  const m=state.mini;if(!m)return null;
  m.data=data;
  m.engine=data.mode;
  return m;
}

/* ---- 열기 · 닫기 ------------------------------------------ */

function startDayPrepMini(task){
  if(task.minDay&&Number(state.day)<Number(task.minDay)){showToast(`이 준비 작업은 Day ${task.minDay}부터 이용할 수 있습니다.`,true);return;}
  state.mini={
    type:`day-prep-${task.id}`,
    engine:"dayPrep",          // 각 setup 이 setDayPrepData 로 실제 엔진 이름을 채웁니다
    stationId:"prepTable",
    context:{mode:"dayPrep",taskId:task.id,menuId:task.menuId},
    complete:false,
    data:{}
  };
  // 타이틀 아래 부제 (ui-mini-frame.js 의 MINI_SUBTITLE).
  // 더 정확한 문장을 만들 수 있는 게임은 각자 setup 에서 덮어씁니다.
  setMiniSubtitle(task.miniGame);
  dom.miniFeedback.textContent="";
  dom.miniContent.innerHTML="";
  // TIP 조작 칩은 매번 비웁니다. 필요한 게임만 setup 에서 다시 넣습니다.
  // ⚠️ 이 함수는 startMini 를 거치지 않는 별도 진입로라, 거기와 따로 비워야 합니다.
  //    안 비우면 앞 게임 칩(예: "드래그 : 육수 붓기")이 다음 준비 게임에 남습니다.
  setMiniTipHint("");
  dom.miniClose.hidden=false;
  dom.miniOverlay.classList.add("open");

  const setup=DAY_PREP_SETUPS[task.miniGame];
  if(setup)setup(task.id);
  else{closeDayPrepMini(true);showToast("준비 미니게임 설정을 찾지 못했습니다.",true);}
}

// setup 이 도중에 멈춘 경우에도 ESC 로는 빠져나올 수 있도록 하는 대기용 엔진입니다.
registerDayPrepEngine("dayPrep",{});

function finishDayPrepTask(taskId,message){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  m.complete=true;
  audio.stopOwner?.(m);
  completeDayPrepTask(taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=message;
  dom.miniContent.classList.add("prep-complete-flash");
  const grade=m.data.completionGrade||((m.data.mistakes||m.data.errors||m.data.warnings||m.data.timedOut)?"good":"perfect");
  audio.result?.(grade);
  setTimeout(()=>advanceDayPrepDish(m,taskId),520);
}

function advanceDayPrepDish(m,taskId){
  if(state.mini!==m)return false;
  const task=PREP_TASKS[taskId],nextTask=task&&nextPrepTaskForDish(task.menuId);
  const blocked=nextTask&&(nextTask.dependsOn||[]).some(id=>PREP_TASKS[id]&&!state.prepProgress?.[id]);
  if(nextTask&&!blocked){
    dom.miniContent.classList.remove("prep-complete-flash");
    startDayPrepMini(nextTask);
    return true;
  }
  closeDayPrepMini(true);
  return false;
}

function closeDayPrepMini(completed=false){
  if(!isDayPrepMini())return;
  audio.stopOwner?.(state.mini);
  state.mini=null;
  state.joyX=0;state.joyY=0;state.player.moving=false;
  dom.miniOverlay.classList.remove("open");
  dom.miniClose.hidden=true;
  dom.miniContent.classList.remove("prep-complete-flash");
  dom.miniContent.innerHTML="";
  updateUI(true);
  saveGame();
  if(completed!==true)showToast("준비 작업을 닫았습니다. 다시 상호작용해 이어갈 수 있습니다.");
}
