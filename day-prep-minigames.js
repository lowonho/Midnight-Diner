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
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:5,zoneWidth:.14,zoneStarts:[.2,.58,.32,.68,.43],speed:.8},
  cutTofuKimchi:{title:"두부김치 · 김치 썰기",ingredient:"kimchi",total:3,zoneWidth:.16,zoneStarts:[.51,.18,.62],speed:.74},
  cutPancakeKimchi:{title:"김치전 · 김치 썰기",ingredient:"kimchi",total:3,zoneWidth:.16,zoneStarts:[.22,.58,.39],speed:.78},
  cutSkewerChicken:{title:"닭꼬치 · 닭 썰기",ingredient:"chicken",total:4,zoneWidth:.14,zoneStarts:[.18,.55,.31,.68],speed:.8,requiresDoubleTap:true},
  cutSkewerGreenOnion:{title:"닭꼬치 · 대파 썰기",ingredient:"greenOnion",total:4,zoneWidth:.14,zoneStarts:[.56,.2,.65,.36],speed:.82},
  // 두부는 세로 5번 뒤 마지막 1번을 가로로 썹니다. (horizontalLastCut)
  cutTofuBlock:{title:"두부김치 · 두부 썰기",ingredient:"tofu",total:6,zoneWidth:.14,zoneStarts:[.18,.56,.3,.67,.42,.22],speed:.78,horizontalLastCut:true},
  fryKimchi:{total:11,allowedDirections:["left","right"]},
  cleanAnchovy:{title:"어묵탕 · 멸치 머리 떼기",total:5}
};

const DAY3_MANDOLINE_CONFIG=Object.freeze({
  sliceYakisobaCabbage:{ingredient:"cabbage",label:"양배추",cycles:6},
  sliceYakisobaCarrot:{ingredient:"carrot",label:"당근",cycles:5}
});
const BREADCRUMB_KEY_PAIRS=Object.freeze([["a","d"],["q","e"],["f","j"],["z","c"],["j","l"]]);

// 아래 경로에 파일을 추가하면 CSS 프로토타입 대신 자동으로 이미지가 사용됩니다.
// 누락된 선택 에셋은 로딩 실패로 취급하지 않고 기존 CSS 도형으로 대체합니다.
const DAY_PREP_ASSET_PATHS = Object.freeze({
  radish0:"assets/prep/radish/radish-0.png",
  radish1:"assets/prep/radish/radish-1.png",
  radish2:"assets/prep/radish/radish-2.png",
  radish3:"assets/prep/radish/radish-3.png",
  radish4:"assets/prep/radish/radish-4.png",
  kimchiCut0:"assets/prep/kimchi/kimchi-cut-0.png",
  kimchiCut1:"assets/prep/kimchi/kimchi-cut-1.png",
  kimchiCut2:"assets/prep/kimchi/kimchi-cut-2.png",
  kimchiCut3:"assets/prep/kimchi/kimchi-cut-3.png",
  chicken0:"assets/prep/chicken/chicken-0.png",
  chicken1:"assets/prep/chicken/chicken-1.png",
  chicken2:"assets/prep/chicken/chicken-2.png",
  chicken3:"assets/prep/chicken/chicken-3.png",
  chicken4:"assets/prep/chicken/chicken-4.png",
  greenOnion0:"assets/prep/green-onion/green-onion-0.png",
  greenOnion1:"assets/prep/green-onion/green-onion-1.png",
  greenOnion2:"assets/prep/green-onion/green-onion-2.png",
  greenOnion3:"assets/prep/green-onion/green-onion-3.png",
  greenOnion4:"assets/prep/green-onion/green-onion-4.png",
  anchovyBody:"assets/prep/anchovy/anchovy-body.png",
  anchovyHead:"assets/prep/anchovy/anchovy-head.png",
  fryingPan:"assets/prep/kimchi/frying-pan.png",
  fryingKimchi:"assets/prep/kimchi/frying-kimchi.png",
  knife:"assets/prep/effects/knife.png",
  ...Object.fromEntries(DAY4_RAPID_CUT_SEQUENCE.flatMap(item=>item.progressSprites.map((src,index)=>[`${item.assetPrefix}${index}`,src]))),
  ...Object.fromEntries(Array.from({length:11},(_,index)=>[`potatoMandoline${index}`,`assets/prep/day4/fries/potato-${index}.png`])),
  potatoStarch0:"assets/prep/day4/fries/starch-0.png",
  potatoStarch35:"assets/prep/day4/fries/starch-35.png",
  potatoStarch70:"assets/prep/day4/fries/starch-70.png",
  potatoStarch100:"assets/prep/day4/fries/starch-100.png",
  tteokSoakEmpty:"assets/prep/day4/tteokbokki/soak-empty.png",
  tteokSoakTteok:"assets/prep/day4/tteokbokki/soak-tteok.png",
  tteokSoakWater:"assets/prep/day4/tteokbokki/soak-water.png",
  tteokSoakComplete:"assets/prep/day4/tteokbokki/soak-complete.png"
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
// 칸 번호는 day4-prep-data.js 의 DAY4_RAPID_CUT_SEQUENCE flowIndex 와 맞춰야 합니다.
function day4PrepFlowMarkup(menuId,currentIndex){
  const steps=menuId==="tteokbokki"?["떡 불리기","양배추","대파","어묵","양념장"]:["감자 채칼","전분 털기"];
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
  if(task.dayOnly&&Number(state.day)!==Number(task.dayOnly)){showToast(`이 준비 작업은 Day ${task.dayOnly} 전용입니다.`,true);return;}
  state.mini={
    type:`day-prep-${task.id}`,
    engine:"dayPrep",          // 각 setup 이 setDayPrepData 로 실제 엔진 이름을 채웁니다
    stationId:"prepTable",
    context:{mode:"dayPrep",taskId:task.id},
    complete:false,
    data:{}
  };
  dom.miniStation.textContent=`준비 테이블 · ${task.objectLabel}`;
  dom.miniFeedback.textContent="";
  dom.miniContent.innerHTML="";
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
  completeDayPrepTask(taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=message;
  dom.miniContent.classList.add("prep-complete-flash");
  setTimeout(()=>{if(state.mini===m)closeDayPrepMini(true);},520);
}

function closeDayPrepMini(completed=false){
  if(!isDayPrepMini())return;
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
