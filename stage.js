"use strict";

/* ============================================================
   스테이지 = 게임 화면 영역 정의
   ------------------------------------------------------------
   담당 범위: 해상도 · 좌표 배율 · 레이어(depth) 순서 ·
              배경 에셋 배치 · 낮/밤 전환 · 화면 연출(fx, 앰비언트)

   담당 범위가 아님: 게임 규칙, 미니게임, 스토리, 집기 동작
              → 그쪽은 game.js / day.js / night.js / story.js

   [의존 방향] game.js → stage.js 단방향.
   이 파일은 game.js 의 state / images / phaserScene 을 참조하지 않습니다.
   그래서 배경·화면 크기 작업을 할 때 game.js 를 열 필요가 없고,
   반대로 기능 개발이 이 파일을 건드릴 일도 없습니다.
   index.html 에서 game.js 보다 먼저 로드되어야 합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 좌표계와 해상도
   ------------------------------------------------------------ */

// 게임 로직과 캔버스 드로잉이 사용하는 논리 좌표계.
// 기존 코드가 전부 이 좌표를 쓰므로 값을 바꾸지 마세요.
const W = 1280;
const H = 720;

// 실제 렌더 해상도. 배경 에셋 원본 크기 기준 (16:9).
const VIEW_W = 1920;
const VIEW_H = 1080;

// 논리 좌표 → 화면 좌표 배율. 1920/1280 = 1080/720 = 정확히 1.5 이므로 왜곡 없음.
const VIEW_SCALE = VIEW_W / W;
const toView = value => value * VIEW_SCALE;

// 화면 좌표 → 논리 좌표. 에셋 스펙(1920x1080)으로 받은 값을
// 게임 판정 좌표로 옮길 때 씁니다. 배율 계산은 이 두 줄이 전부입니다.
const toLogic = value => value / VIEW_SCALE;


/* ------------------------------------------------------------
   2. 레이어 순서
   ------------------------------------------------------------ */

/* 요리사는 카운터 "뒤"에 서 있어야 합니다.
   그래서 프레임 캔버스를 앞뒤 두 장으로 나눴습니다.

     backOverlay 20 : 요리사보다 뒤 — 주방 집기
     player      25 : 요리사
     (31~36)        : 카운터 3종·POS·김  → counter.js COUNTER_DEPTH
     overlay     40 : 요리사보다 앞 — 손님·준비물·간판·이펙트
     (42~44)        : 의자·명패          → counter.js COUNTER_DEPTH

   요리사가 카운터(31~36)보다 아래라서, 카운터 앞변까지 내려가면
   허리 아래가 카운터에 가려집니다. 손님(40)은 카운터보다 앞이라
   그대로 보입니다. */
const STAGE_DEPTH = {
  background:  0,   // 배경 컨테이너. 내부 순서는 BACKGROUND_LAYERS 참고
  backOverlay:20,   // 요리사 뒤에 그리는 프레임 캔버스
  player:     25,
  plate:      26,
  food:       27,
  overlay:    40,   // 요리사 앞에 그리는 프레임 캔버스
  ambient:    60    // 야간 톤 오버레이 (화면 전체를 덮음)
};


/* ------------------------------------------------------------
   3. 배경 레이어 배치표
   ------------------------------------------------------------
   key = 텍스처 키 = 파일명(assets/bg/<key>.png).
   좌표·크기는 전달받은 배경 스펙 그대로이며 스케일은 항상 1.0 입니다.
   에셋을 교체하거나 추가할 때는 이 표만 고치면 됩니다.

   [depth 주의] 스펙 문서는 창밖 풍경을 depth 0(화면벽 뒤)에 두라고 되어 있지만,
   실제 bg_wall_back.png 에는 창문 구멍이 뚫려 있지 않고 전 영역이 불투명합니다.
   풍경을 벽 뒤에 두면 완전히 가려지므로 벽(10/11)과 창틀(20) 사이인 15에 둡니다.
   창밖 풍경이 901x155 → 962x215 로 확장된 이유("창틀 안쪽으로 벽이 비쳐 보이는
   문제 방지")도 풍경이 벽 위에 올라가는 구성을 전제로 하며,
   확장분은 창틀 테두리 뒤에 정확히 숨습니다.
   ------------------------------------------------------------ */

const BACKGROUND_LAYERS = [
  { key:"bg_wall_back",         x:302,  y:0,   depth:10 },  // 화면벽
  { key:"bg_wall_left",         x:0,    y:0,   depth:11 },  // 좌측벽
  { key:"bg_wall_right",        x:1610, y:0,   depth:11 },  // 우측벽
  { key:"bg_window_view_night", x:464,  y:130, depth:15 },  // 창밖 야경
  { key:"bg_window_view_day",   x:464,  y:130, depth:15 },  // 창밖 주간 (야경 위에 크로스페이드)
  { key:"bg_window",            x:464,  y:130, depth:20 },  // 창틀 (유리 부분 투명)
  { key:"bg_floor_night",       x:0,    y:545, depth:30 },  // 바닥 야간
  { key:"bg_floor_day",         x:0,    y:545, depth:30 }   // 바닥 주간 (야간 위에 크로스페이드)
];

// 낮에 alpha 1, 밤에 alpha 0 으로 크로스페이드하는 레이어들.
// 같은 자리에 밤 버전이 깔려 있어서, 낮 버전만 흐려지면 밤 그림이 드러납니다.
const DAY_FADE_LAYERS = ["bg_window_view_day","bg_floor_day"];

const BACKGROUND_ASSET_DIR = "assets/bg/";


/* ------------------------------------------------------------
   4. 야간 연출 설정
   ------------------------------------------------------------ */

// 별 반짝임 fx 를 뿌릴 범위. 창틀 유리 안쪽에서 건물 지붕선보다 위인 하늘 영역.
const STAR_FIELD = { x:500, y:160, w:900, h:72 };
const STAR_COUNT = 18;
const STAR_DEPTH = 16;                 // 창밖 풍경(15)과 창틀(20) 사이라야 창틀에 가려짐

const AMBIENT_COLOR = 0x2a1608;        // 주황빛 야간 톤
const AMBIENT_NIGHT_ALPHA = 0.22;      // 0 이면 효과 없음. 밤을 더 어둡게 하려면 올리세요.
const TIME_OF_DAY_FADE_MS = 900;       // 낮↔밤 크로스페이드 시간


/* ------------------------------------------------------------
   5. 배경 에셋 로딩
   ------------------------------------------------------------ */

const stageImages = {};

function loadStageImage(key){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{stageImages[key]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`배경 이미지를 불러오지 못했습니다: ${key}`));
    image.src=`${BACKGROUND_ASSET_DIR}${key}.png`;
  });
}

// game.js 의 에셋 로딩 Promise.all 에 넣어서 사용합니다.
// 요리사·손님 시트도 여기 묶습니다. game.js 를 수정하지 않기로 해서
// 로딩 단계에 끼어들 수 있는 지점이 이 함수뿐입니다.
// (구현은 chef-anims.js / customers.js — 이 파일은 호출만 합니다)
function loadStageAssets(){
  return Promise.all([
    ...BACKGROUND_LAYERS.map(layer=>loadStageImage(layer.key)),
    loadDecorationAssets(),
    loadChefSheets(),
    loadCommonCustomerSheet()
  ]);
}


/* ------------------------------------------------------------
   6. 스테이지 생성
   ------------------------------------------------------------ */

const stageLayers = {};
let stageContainer = null;
let stageStarLayer = null;
let stageAmbient = null;
let timeOfDay = null;

function createStage(scene){
  BACKGROUND_LAYERS.forEach(layer=>{
    if(!scene.textures.exists(layer.key)) scene.textures.addImage(layer.key,stageImages[layer.key]);
    stageLayers[layer.key]=scene.add.image(layer.x,layer.y,layer.key).setOrigin(0,0).setDepth(layer.depth);
  });

  stageStarLayer=createStarLayer(scene);

  // 야간 앰비언트. fillAlpha 는 1 로 두고 오브젝트 alpha 로만 세기를 조절합니다.
  // (둘은 곱해지므로 fillAlpha 를 0 으로 만들면 alpha 를 아무리 올려도 보이지 않습니다.)
  // depth 60 = 배경·집기·캐릭터보다 위. DOM HUD 는 캔버스 밖이라 영향받지 않습니다.
  stageAmbient=scene.add.rectangle(0,0,VIEW_W,VIEW_H,AMBIENT_COLOR,1)
    .setOrigin(0,0).setDepth(STAGE_DEPTH.ambient).setAlpha(0);

  // 배경 전체를 하나의 컨테이너로 관리. 컨테이너 내부는 추가 순서 = 그리기 순서.
  stageContainer=scene.add.container(0,0).setDepth(STAGE_DEPTH.background);
  stageContainer.add([
    stageLayers.bg_wall_back,
    stageLayers.bg_wall_left,
    stageLayers.bg_wall_right,
    stageLayers.bg_window_view_night,
    stageLayers.bg_window_view_day,
    stageStarLayer,
    stageLayers.bg_window,
    stageLayers.bg_floor_night,
    stageLayers.bg_floor_day
  ]);

  // 배경 소품(서비스 벨·전등·벽 장식·좌측벽 화분). 배치값은 decoration.js 한 곳에 모여 있습니다.
  createDecoration(scene);

  timeOfDay=timeOfDay||"day";
  applyTimeOfDay(timeOfDay,true);
}

function createStarLayer(scene){
  const layer=scene.add.container(0,0).setDepth(STAR_DEPTH);
  for(let i=0;i<STAR_COUNT;i++){
    const star=scene.add.circle(
      STAR_FIELD.x+Math.random()*STAR_FIELD.w,
      STAR_FIELD.y+Math.random()*STAR_FIELD.h,
      1+Math.random()*1.7,0xfff3cf,0
    );
    scene.tweens.add({
      targets:star,alpha:{from:0,to:.3+Math.random()*.45},
      duration:900+Math.random()*1300,delay:Math.random()*2600,
      hold:200+Math.random()*700,yoyo:true,repeat:-1,ease:"Sine.easeInOut"
    });
    layer.add(star);
  }
  return layer;
}

/* 집기·손님·이펙트를 그리는 프레임 캔버스. 1920x1080 으로 만들고
   드로잉 쪽은 beginStageFrame() 이 걸어주는 배율 위에서 논리 좌표를 씁니다.

   [보간을 켜 두는 이유]
   2026-08-08 이전에는 imageSmoothingEnabled=false (최근접 이웃) 였습니다.
   이 플래그는 **drawImage 에만** 걸립니다 — 도형·글자는 패스 래스터라이저가
   그리므로 켜든 끄든 똑같습니다. 그래서 실제로 영향받는 것은 이 캔버스에
   올라가는 그림 몇 장뿐입니다.

   끄면 축소할 때 평균을 내지 않고 픽셀 하나를 골라 씁니다. 원본이 그리는
   크기보다 클수록 버리는 비율이 커져서, 낮 준비물 바구니(4배 원화를 7.3배로
   축소)가 모래알처럼 부서졌습니다. 원화 해상도를 올릴수록 나빠지는 방식이라
   보간을 켜는 쪽으로 바꿨습니다.

   프로젝트의 다른 설정도 전부 같은 방향입니다 — Phaser pixelArt:false /
   antialias:true, css/app-shell.css image-rendering:auto. 픽셀아트가 아니라
   일러스트 톤이라, 혹시 원본보다 크게 그리게 되더라도 계단보다 흐림이
   덜 튑니다.

   ⚠️ 1:1 로 그리는 그림은 VIEW 좌표가 **정수**여야 합니다. 반픽셀에 걸치면
      예전에는 반올림돼 선명했지만 이제는 양쪽에 반씩 섞여 흐려집니다.
      (그래서 signage.js OPEN_SIGN.x 를 1105 → 1104 로 옮겼습니다) */
function createStageFrameTexture(scene,key,depth=STAGE_DEPTH.overlay){
  const texture=scene.textures.createCanvas(key,VIEW_W,VIEW_H);
  const context=texture.getContext();
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality="high";
  scene.add.image(0,0,key).setOrigin(0).setDepth(depth);
  return texture;
}

// 매 프레임 드로잉 시작 시 호출. 화면을 지우고 논리 좌표 배율을 겁니다.
function beginStageFrame(context){
  context.setTransform(1,0,0,1,0,0);
  context.clearRect(0,0,VIEW_W,VIEW_H);
  context.setTransform(VIEW_SCALE,0,0,VIEW_SCALE,0,0);
}


/* ------------------------------------------------------------
   7. 낮 / 밤 전환
   ------------------------------------------------------------ */

// 외부 공개 API. setTimeOfDay('day') / setTimeOfDay('night')
// instant 를 true 로 주면 크로스페이드 없이 즉시 전환합니다.
function setTimeOfDay(mode,instant=false){
  if(mode!=="day"&&mode!=="night")return;
  if(timeOfDay===mode)return;
  timeOfDay=mode;
  applyTimeOfDay(mode,instant);
}

function getTimeOfDay(){ return timeOfDay; }

// 게임 진행 단계(day / night / result …)를 낮밤에 매핑합니다.
// 시간대 전환 규칙을 바꾸고 싶으면 여기만 고치면 됩니다.
function syncStageTimeOfDay(phase){
  setTimeOfDay(phase==="night"||phase==="result"?"night":"day");
}

function applyTimeOfDay(mode,instant=false){
  const scene=stageContainer?.scene;
  const dayViews=DAY_FADE_LAYERS.map(key=>stageLayers[key]).filter(Boolean);
  if(!dayViews.length||!scene)return;

  const dayAlpha=mode==="day"?1:0;
  const ambientAlpha=mode==="day"?0:AMBIENT_NIGHT_ALPHA;

  dayViews.forEach(view=>scene.tweens.killTweensOf(view));
  scene.tweens.killTweensOf(stageAmbient);
  if(instant){
    dayViews.forEach(view=>view.setAlpha(dayAlpha));
    stageAmbient.setAlpha(ambientAlpha);
  }else{
    scene.tweens.add({targets:dayViews,alpha:dayAlpha,duration:TIME_OF_DAY_FADE_MS,ease:"Sine.easeInOut"});
    scene.tweens.add({targets:stageAmbient,alpha:ambientAlpha,duration:TIME_OF_DAY_FADE_MS,ease:"Sine.easeInOut"});
  }
  stageStarLayer.setVisible(mode==="night");
}

// 콘솔이나 다른 스크립트에서 수동 전환할 수 있도록 노출
window.setTimeOfDay=setTimeOfDay;
window.getTimeOfDay=getTimeOfDay;


/* ------------------------------------------------------------
   8. Phaser 게임 설정 (화면 크기 · 렌더 품질)
   ------------------------------------------------------------ */

function stageGameConfig(scene){
  return {
    type:Phaser.CANVAS,
    width:VIEW_W,
    height:VIEW_H,
    parent:"gameCanvas",
    backgroundColor:"#17100d",
    // 배경이 픽셀아트가 아닌 일러스트 톤이므로 스무딩을 유지합니다.
    pixelArt:false,
    antialias:true,
    roundPixels:true,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
    scene
  };
}
