"use strict";

/* ============================================================
   스토리 컷씬 배경
   ------------------------------------------------------------
   프롤로그처럼 "가게 밖"에서 벌어지는 장면은 배우(원화)를 세우는 대신
   컷씬 원화 한 장을 화면 전체에 깔고 그 위에 대사만 얹습니다.
   원화 안에 이미 김다은이 그려져 있어서 배우를 같이 세우면 둘이 됩니다.
   그래서 css/story.css 가 컷씬 중에는 .story-stage 를 통째로 감춥니다.

   ------------------------------------------------------------
   [대사 한 줄이 아니라 '구간'에 걸립니다]  ★ 여기가 핵심입니다
   ------------------------------------------------------------
   story-data.js 는 컷이 **바뀌는 첫 대사에만** cinematic 을 적습니다.

     SCN-P01  1번 대사 → prologueOffice      "맛은 나쁘지 않아…" 까지
              3번 대사 → prologueCommute     "그냥 내일이 오지 않았으면 좋겠다." 까지
     SCN-P02  1번 대사 → prologueRainAlley   "갑자기 무슨 비야… 우산도 없는데." 까지
              3번 대사 → prologueRainEntry   "저런 식당이 여기 있었나…" 까지

   중간 대사에는 아무것도 안 적습니다. cinematic 이 없는 대사는 "컷씬이
   끝났다"가 아니라 "직전 컷을 그대로 둔다"는 뜻이기 때문입니다(아래
   applyStoryCinematic 참고). 실제 정리는 장면이 바뀔 때 story.js 의
   resetStoryStage() 가 clearStoryCinematic() 을 불러서 합니다.

   ------------------------------------------------------------
   [Phaser 가 아니라 DOM 인 이유]
   ------------------------------------------------------------
   컷씬은 대사 오버레이(#storyOverlay) 안의 레이어 두 장으로 그립니다.
   Phaser 쪽에 그리면 텍스처를 미리 로드해 두어야 하고, 장면 전환·저장
   복원처럼 씬이 새로 만들어지는 길목마다 수명을 따로 챙겨야 합니다.
   배경 한 장을 겹쳐 넘기는 데 그만한 배선이 필요하지 않습니다.

   레이어가 두 장인 것은 교차 페이드 때문입니다. background-image 는
   전환(transition)이 안 걸려서, 한 장에서 그림만 갈아끼우면 툭 바뀝니다.
   쓰지 않는 쪽에 다음 그림을 깔아 두고 두 장의 opacity 를 맞바꿉니다.

   ⚠️ 경로는 문서(index.html) 기준입니다. css/ 안에서 url() 로 적으면
      스타일시트 기준이 되어 404 가 납니다. 그래서 그림 경로는 CSS 가 아니라
      여기서 인라인 style 로 넣습니다.
   ============================================================ */

/* 컷 이름 → 원화. 원본 PNG 에서 tools/build-cutscene-webp.js 가 뽑습니다.
   새 컷을 추가하면 그 스크립트의 FILES 에도 같이 넣으세요.

   [protagonist]
   그 컷 안에 김다은이 이미 그려져 있는지입니다. 그려져 있으면 대화용 원화를
   같이 세우지 않습니다 — 같은 사람이 화면에 둘이 됩니다.
   (story.js 의 updateStoryCinematicSpeaking 이 이 값을 보고 정합니다) */
const STORY_CUTSCENES=Object.freeze({
  prologueOffice:Object.freeze({
    art:"assets/Cutscene/prologue/cutscene_02_reprimand_variant.webp",
    protagonist:true,
    why:"SCN-P01 앞부분 · 야근 중 상사에게 지적받는 사무실"
  }),
  prologueCommute:Object.freeze({
    art:"assets/Cutscene/prologue/cutscene_01_commute_variant.webp",
    protagonist:true,
    why:"SCN-P01 뒷부분 · 회사를 나와 혼자 걷는 밤 퇴근길"
  }),
  prologueRainAlley:Object.freeze({
    art:"assets/Cutscene/prologue/rainy_alley_woman_high_angle_4k.webp",
    protagonist:true,
    why:"SCN-P02 앞부분 · 비 쏟아지는 골목에 선 김다은(부감)"
  }),
  prologueRainEntry:Object.freeze({
    art:"assets/Cutscene/prologue/cutscene_03_rain_entry.webp",
    protagonist:true,
    why:"SCN-P02 뒷부분 · 빗속에서 달빛식탁 문을 여는 장면"
  }),

  /* ── 완전한 달빛 조각을 건네받는 순간 ──────────────────────
     SCN-G*-완벽 의 **마지막 대사**(조각 전달 내레이션) 한 줄에만 걸립니다.
     그 줄에는 조각 오버레이(#storyFragmentHandoff, z-index 3)도 같이 뜨는데,
     컷씬 판은 z-index 1 이라 오버레이가 자연히 그림 위에 옵니다. 대신 오버레이
     기본 암전(rgba(5,4,10,.91))이 그림을 다 덮어서, css/story.css 가 컷씬이
     깔린 동안에는 그 막을 얇게 바꿉니다.

     [컷 이름이 shard_<shardId> 인 이유]
     story-data.js 는 손님 여덟을 createSpecialGuestArc() 하나로 찍어 냅니다.
     거기서 아는 것은 config.shardId 뿐이라, 컷 이름을 따로 적으면 여덟 군데를
     손으로 짝지어야 하고 오타가 나도 조용히 컷만 안 뜹니다. 조각 id 에서
     이름을 만들면 짝이 어긋날 수가 없습니다(검사는
     tools/story-cinematic-contract-smoke.js).

     여덟 장 모두 김다은이 손님과 마주 보고 그려져 있어서 protagonist:true 입니다. */
  shard_first_raindrop:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_01_rain_child_variant_b.webp",
    protagonist:true,
    why:"SCN-G1-완벽 · 비에 젖은 아이가 첫 빗방울을 건넨다"
  }),
  shard_remaining_warmth:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_02_lantern_head_variant_a.webp",
    protagonist:true,
    why:"SCN-G2-완벽 · 등불을 머리에 인 손님이 남은 온기를 건넨다"
  }),
  shard_two_half_names:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_03_joined_shadows_variant_b.webp",
    protagonist:true,
    why:"SCN-G3-완벽 · 둘이 붙은 그림자가 반쪽 이름 두 개를 건넨다"
  }),
  shard_undelivered_letter:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_04_crow_postman_variant_a.webp",
    protagonist:true,
    why:"SCN-G4-완벽 · 까마귀 우편배달부가 배달되지 못한 편지를 건넨다"
  }),
  shard_golden_salt:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_05_star_eater_variant_b.webp",
    protagonist:true,
    why:"SCN-G5-완벽 · 별을 먹는 작은 짐승이 금빛 소금을 건넨다"
  }),
  shard_eastern_scale:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_06_sea_guest_variant_b.webp",
    protagonist:true,
    why:"SCN-G6-완벽 · 바닷물로 된 손님이 동쪽의 비늘을 건넨다"
  }),
  shard_stopped_minute_hand:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_07_stopped_school_doll_variant_a.webp",
    protagonist:true,
    why:"SCN-G7-완벽 · 멈춰버린 교복 인형이 멈춘 분침을 건넨다"
  }),
  shard_daeuns_tomorrow:Object.freeze({
    art:"assets/Cutscene/Moonpiece/cutscene_special_08_faceless_daeun_variant_b.webp",
    protagonist:true,
    why:"SCN-G8-완벽 · 얼굴 없는 김다은이 김다은의 내일을 건넨다"
  })
});

let storyCinematicRuntime=null;

function storyCinematicConfig(line){
  const config=line?.cinematic;
  if(!config||typeof config!=="object")return null;
  if(!Object.prototype.hasOwnProperty.call(STORY_CUTSCENES,config.cut))return null;
  return config;
}

function storyCutsceneArt(cut){
  return Object.prototype.hasOwnProperty.call(STORY_CUTSCENES,cut)?STORY_CUTSCENES[cut].art:null;
}

/* 지금 깔린 컷 안에 김다은이 그려져 있는지. story.js 가 대화용 원화를 올릴지
   말지 여기에 물어봅니다. 컷씬이 없으면 false 라 평소 대화에는 영향이 없습니다. */
function storyCinematicDrawsProtagonist(){
  const cut=storyCinematicRuntime?.cut;
  return !!(cut&&STORY_CUTSCENES[cut]?.protagonist);
}

/* [미리 받아 두는 범위는 '지금 장면'까지입니다]
   컷이 바뀌는 순간 그림을 그때 요청하면 빈 화면이 한 번 스칩니다. 그래서
   미리 받아 두는데, 등록된 컷 전부를 받으면 프롤로그 두 장면을 보려고
   달빛 조각 컷 여덟 장(약 3MB)까지 같이 끌어옵니다. 그 여덟 장은 서로 다른
   회차·다른 손님에게 흩어져 있어서 한 판에 두 장 넘게 볼 일이 거의 없습니다.

   지금 진행 중인 장면의 대사만 훑어서 거기 적힌 컷만 받습니다. 프롤로그는
   한 장면에 두 컷이라 예전과 똑같이 동작하고, 달빛 조각은 그 손님의 한 장만
   받습니다. 조각 컷은 장면 마지막 대사에 걸리므로 앞 대사를 읽는 동안
   여유 있게 도착합니다.

   preloadedLines 는 배열 '참조'를 기억합니다. story.js 가 장면마다
   storyLinesForScene() 으로 새 배열을 만들기 때문에, 장면이 그대로면 같은
   배열이 와서 대사를 넘길 때마다 다시 훑지 않습니다.
   ⚠️ Image 객체는 일부러 안 붙잡습니다. 붙잡으면 1920x1080 디코딩 결과가
      장마다 메모리에 남습니다. 요청만 띄워 두면 브라우저 캐시가 받아 줍니다. */
let preloadedLines=null;
const preloadedCutsceneArts=new Set();

function preloadStoryCutscenesForScene(){
  if(typeof Image!=="function")return;
  const session=typeof storySession!=="undefined"?storySession:null;
  const lines=session?.lines;
  if(!Array.isArray(lines)||lines===preloadedLines)return;
  preloadedLines=lines;
  for(const line of lines){
    const art=storyCutsceneArt(storyCinematicConfig(line)?.cut);
    if(!art||preloadedCutsceneArts.has(art))continue;
    preloadedCutsceneArts.add(art);
    new Image().src=art;
  }
}

/* ── 컷씬을 잠깐 혼자 보여 주는 대기(hold) ──────────────────
   조각을 건네는 장면은 원화 한 장이 그 장면의 절정입니다. 대사창과 조각
   오버레이가 같은 순간에 뜨면, 그림이 나타날 때 이미 위가 덮여 있어서
   "무엇을 받았는지"는 보이는데 "누가 어떻게 건넸는지"는 안 보입니다.

   그래서 컷 지정에 hold(밀리초)가 적혀 있으면 그동안 그림만 두고, 대사와
   조각 오버레이는 그 뒤에 겹칩니다. 기다리기 싫으면 클릭 한 번으로 바로
   넘어옵니다 — story.js 의 storyAdvance 가 다른 처리보다 먼저
   releaseStoryCinematicHold() 를 봅니다.

   ⚠️ 그 "클릭 한 번"이 닿을 곳을 따로 만들어 두어야 합니다. 대사를 넘기는
      마우스 입력은 #storyText 와 #storyNextButton 두 곳에만 걸려 있는데,
      대기 중에는 대사창이 통째로 visibility:hidden 이라 두 곳 다 클릭
      대상이 아닙니다(감춰진 요소는 히트 테스트에서 빠집니다). 그래서 대기
      중에는 #storyOverlay 가 클릭을 대신 받습니다 — story.js 의
      initializeStoryUI() 를 보세요. 이게 없으면 마우스로는 대기를 풀 수 없어
      화면이 멈춘 것처럼 보이고, 키보드로 겨우 빠져나오다 뒤 대사를 놓칩니다.

   ⚠️ 조각 오버레이는 CSS 로 감췄다 보이면 안 됩니다. 감춰져 있는 동안
      등장 애니(storyFragmentReveal .58s)가 다 돌아 버려서, 1초 뒤에는
      조각이 떠오르지 않고 그냥 켜집니다. 그래서 감추는 게 아니라 .show 를
      붙이는 것 자체를 미룹니다(story.js 가 그동안 null 을 넘깁니다).
      대사창은 애니가 아니라 페이드라서 CSS 로 감춰도 됩니다. */
let storyCinematicHold=null;

/* hold 는 시간이 아니라 '입력을 기다린다'는 표시입니다(hold:true).
   예전에는 밀리초를 적어 그 시간이 지나면 저절로 넘어갔는데, 컷이 바뀌는 순간
   그림을 채 보기도 전에 대사창이 덮여 버렸습니다. 지금은 사람이 한 번 누를
   때까지 그림만 둡니다 — 급하면 바로 누르면 되니 기다릴 이유가 없습니다.
   (숫자를 적어 두어도 참으로 봅니다. 예전 값이 남아 있어도 동작은 같습니다) */
function storyCinematicHolds(line){
  return !!storyCinematicConfig(line)?.hold;
}

/* 이 대사가 컷씬을 먼저 혼자 보여 주는 줄인지. story.js 는 참이면 그동안
   조각 오버레이를 비워 두었다가 아래 scheduleStoryCinematicReveal 로 올립니다. */
function beginStoryCinematicHold(line){
  cancelStoryCinematicHold();
  if(!storyCinematicHolds(line))return false;
  storyCinematicHold={reveal:null};
  document.getElementById("storyOverlay")?.classList.add("story-cinematic-hold");
  return true;
}

/* 지금 컷씬만 보여 주며 입력을 기다리는 중인지. story.js 가 오버레이 클릭을
   받을지 말지 여기에 물어봅니다 — 아래 releaseStoryCinematicHold 설명 참고. */
function storyCinematicHoldIsActive(){
  return !!storyCinematicHold;
}

// 대기 중이면 누를 때까지 붙잡아 두고, 아니면 지금 바로 reveal 을 부릅니다.
function scheduleStoryCinematicReveal(reveal){
  if(typeof reveal!=="function")return false;
  if(!storyCinematicHold){reveal();return false;}
  storyCinematicHold.reveal=reveal;
  return true;
}

// 대기를 끝내고 대사·조각을 올립니다. storyAdvance 가 다른 처리보다 먼저 부릅니다.
function releaseStoryCinematicHold(){
  const hold=storyCinematicHold;
  if(!hold)return false;
  storyCinematicHold=null;
  document.getElementById("storyOverlay")?.classList.remove("story-cinematic-hold");
  hold.reveal?.();
  return true;
}

/* 장면이 갈아엎힐 때. 여기서는 reveal 을 부르면 안 됩니다 — 이미 사라진
   대사의 조각 오버레이를 다음 장면 위에 올리게 됩니다. */
function cancelStoryCinematicHold(){
  storyCinematicHold=null;
  document.getElementById("storyOverlay")?.classList.remove("story-cinematic-hold");
}

function storyCutsceneElements(){
  const container=document.getElementById("storyCutscene");
  if(!container?.querySelectorAll)return null;
  const layers=Array.from(container.querySelectorAll(".story-cutscene-layer"));
  return layers.length>=2?{container,layers}:null;
}

function showStoryCutscene(cut){
  const art=storyCutsceneArt(cut);
  const elements=storyCutsceneElements();
  if(!art||!elements)return false;
  const {container,layers}=elements;
  document.getElementById("storyOverlay")?.classList.add("story-cinematic-active");
  container.hidden=false;
  // 이미 그 컷이면 다시 페이드하지 않습니다. 같은 그림이 한 번 흐려졌다
  // 돌아오면 깜빡인 것처럼 보입니다.
  if(storyCinematicRuntime?.cut===cut)return true;
  const next=(storyCinematicRuntime?.layer??1)===0?1:0;
  layers[next].style.backgroundImage=`url("${art}")`;
  layers[next].classList.add("is-active");
  layers[next===0?1:0].classList.remove("is-active");
  storyCinematicRuntime={cut,layer:next};
  return true;
}

/* 장면 중간부터 시작할 때(QA 대사 브라우저의 건너뛰기) 쓰는 되감기입니다.
   컷은 '구간'이라, 3번 대사부터 보여 달라고 하면 그 구간을 연 1번 대사의
   컷을 찾아 와야 합니다. 안 그러면 그림 없이 까만 화면에 대사만 뜹니다.
   순서대로 보고 있는 중에는(런타임이 살아 있으면) 호출되지 않습니다. */
function storyCinematicCutBefore(lineIndex){
  const session=typeof storySession!=="undefined"?storySession:null;
  const lines=session?.lines;
  if(!Array.isArray(lines))return null;
  for(let index=Math.min(lineIndex,lines.length-1);index>=0;index--){
    const config=storyCinematicConfig(lines[index]);
    if(config)return config.cut;
  }
  return null;
}

function applyStoryCinematic(line){
  // 장면의 첫 대사에서 한 번만 실제로 훑습니다(배열 참조 비교). 컷이 장면
  // 마지막 대사에 걸려 있어도 그때는 이미 받아 둔 상태가 됩니다.
  preloadStoryCutscenesForScene();
  const config=storyCinematicConfig(line);
  // 대사에 새 컷이 없다는 것은 컷씬이 끝났다는 뜻이 아닙니다. 같은 장면의
  // 속말·대사 동안 지금 컷을 그대로 유지하고, 실제 장면 전환 때
  // resetStoryStage() 가 clearStoryCinematic() 을 호출해 정리합니다.
  if(!config){
    if(storyCinematicRuntime)return true;
    const session=typeof storySession!=="undefined"?storySession:null;
    const cut=storyCinematicCutBefore(Number(session?.lineIndex)||0);
    return cut?showStoryCutscene(cut):false;
  }
  return showStoryCutscene(config.cut);
}

function clearStoryCinematic(){
  cancelStoryCinematicHold();
  document.getElementById("storyOverlay")?.classList.remove("story-cinematic-active");
  const elements=storyCutsceneElements();
  if(elements){
    elements.container.hidden=true;
    for(const layer of elements.layers){
      layer.classList.remove("is-active");
      // 다음 컷씬이 열릴 때 예전 그림이 한 프레임 비치지 않게 비워 둡니다.
      layer.style.backgroundImage="";
    }
  }
  storyCinematicRuntime=null;
}
