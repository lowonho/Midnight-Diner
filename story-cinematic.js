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
  })
});

let storyCinematicRuntime=null;
let storyCutscenesPreloaded=false;

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

/* 프롤로그는 세 컷이 연달아 나옵니다. 첫 컷이 뜨는 순간 나머지도 같이 받아
   두면 컷이 바뀌는 순간 빈 화면이 스치지 않습니다(장당 150~380KB).
   저장 불러오기로 프롤로그를 건너뛴 사람은 이 경로를 아예 안 지납니다. */
function preloadStoryCutscenes(){
  if(storyCutscenesPreloaded||typeof Image!=="function")return;
  storyCutscenesPreloaded=true;
  for(const art of Object.values(STORY_CUTSCENES)){
    const image=new Image();
    image.src=art;
  }
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
  preloadStoryCutscenes();
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
  const config=storyCinematicConfig(line);
  // 대사에 새 컷이 없다는 것은 컷씬이 끝났다는 뜻이 아닙니다. 같은 장면의
  // 대사 동안 지금 컷을 그대로 유지하고, 실제 장면 전환 때
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
