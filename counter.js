"use strict";

/* ============================================================
   카운터 영역 = 계산대(POS) · 철판 · 바 테이블 · 의자 · 명패
   ------------------------------------------------------------
   담당 범위: 카운터 에셋 배치(VIEW 1920x1080 좌표) ·
              POS 깜빡임 / 철판 조리 / 김 / 명패 둥실 연출 ·
              철판·계산대 상호작용 판정 영역

   담당 범위가 아님: 게임 규칙, 손님, 미니게임, 배경
              → 그쪽은 game.js / night.js / stage.js

   [의존 방향] game.js → counter.js 단방향.
   이 파일은 game.js 의 state 를 참조하지 않습니다.
   게임 쪽에서는 아래 4개만 호출합니다.
     loadCounterAssets()                      에셋 로딩 (Promise)
     createCounter(scene)                     오브젝트 생성
     updateCounter(time, delta, playerView)   매 프레임 갱신
     counterPlayPosPulse(times)               결제 연출 수동 재생

   index.html 에서 game.js 보다 먼저 로드되어야 합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 에셋
   ------------------------------------------------------------
   좌표계는 stage.js 의 VIEW 좌표(1920x1080)를 그대로 씁니다.
   게임 로직 좌표(1280x720)와는 toView() 배율 1.5 만큼 차이가 납니다.
   ------------------------------------------------------------ */

const COUNTER_ASSET_DIR = "assets/counter/";

// tools/build-counter-webp.js 가 만드는 WebP 를 씁니다.
// 문제가 생기면 ".png" 로만 되돌리면 원본 마스터로 돌아갑니다.
const COUNTER_EXT = ".webp";

// key = Phaser 텍스처 키, file = 확장자 뺀 파일명.
// sheet 가 있으면 스프라이트시트로 등록합니다.
const COUNTER_ASSETS = [
  { key:"counter_bar_table",       file:"counter_bar_table" },
  { key:"counter_register",        file:"counter_register_body" },
  { key:"counter_griddle_front",   file:"counter_griddle_front" },
  { key:"counter_chair",           file:"prop_chair" },
  { key:"counter_nameplate",       file:"ui_nameplate" },
  { key:"counter_griddle_surface", file:"counter_griddle_surface_cook", sheet:{ frameWidth:256, frameHeight:263 }, frames:8 },
  { key:"counter_pos_set",         file:"fix_pos_set",                  sheet:{ frameWidth:382, frameHeight:446 }, frames:6 },
  { key:"counter_steam",           file:"fx_griddle_cook",              sheet:{ frameWidth:620, frameHeight:280 }, frames:8 }
];

// counter_griddle_body.png 은 front + surface 를 합친 통합본이라 사용하지 않습니다. (§1-2)


/* ------------------------------------------------------------
   2. 배치표 (VIEW 좌표 · origin(0,1) = 좌하단 기준)
   ------------------------------------------------------------
   바닥선을 맞춰야 하므로 전부 좌하단 기준으로 놓습니다.
   에셋마다 아래쪽 투명 여백이 달라서 y 값이 조금씩 다릅니다.
   ------------------------------------------------------------ */

const COUNTER_GROUND_Y = 1012;   // 카운터 3종이 바닥에 닿는 선

/* 카운터 전체 크기 조절 (한 값으로 통째로)
   ------------------------------------------------------------
   아래 COUNTER_LAYOUT 은 에셋 스펙 그대로의 "설계값"입니다.
   그 값대로 놓으면 화면 좌우 끝에 바닥이 몇 px 보여서 카운터가
   떠 있는 것처럼 보입니다. 그래서 그룹 전체를 살짝 키웁니다.

     scale   1.04  좌우 끝이 화면 밖으로 나가 잘립니다
     anchorX 960   화면 가로 중앙 기준으로 좌우로 벌어집니다
     groundY 1012  바닥선 고정. 위로만 커집니다

   [측정] scale 1.0 일 때
     계산대 왼쪽 끝   VIEW    3.5  → 화면 왼쪽에 4px 바닥이 보임
     바 테이블 오른쪽 VIEW 1912.5 → 화면 오른쪽에 8px (상판은 35px) 바닥
   scale 1.04 면 -34.8 / 1950.6 이 되어 확실히 잘려 나갑니다.

   크기를 더 키우거나 줄이려면 scale 만 만지세요.
   단, FRONT_STATIONS(논리 좌표 사본)는 이 값을 따라가야 합니다.
   customers.js 의 좌석과 상호작용 판정은 자동으로 따라옵니다.
   ------------------------------------------------------------ */
const COUNTER_FIT = { scale:1.04, anchorX:960, groundY:COUNTER_GROUND_Y };

const fitX    = x => COUNTER_FIT.anchorX + (x-COUNTER_FIT.anchorX)*COUNTER_FIT.scale;
const fitY    = y => COUNTER_FIT.groundY + (y-COUNTER_FIT.groundY)*COUNTER_FIT.scale;
const fitSize = v => v*COUNTER_FIT.scale;

const COUNTER_LAYOUT = {
  // 계산대 본체 (화면 왼쪽 밖으로 잘려 나감 — 의도됨 §2-4)
  register: { x:0,   y:1013, w:363,  h:222 },

  // 철판. surface(애니메이션)와 front(정지)는 반드시 같은 값을 써야 합니다. (§1-3)
  //
  // x 는 스펙값 336 이 아니라 317 입니다.
  // 336 으로 놓으면 계산대 앞면 오른쪽 끝(VIEW 321.5)과 15px 벌어져
  // 사이에 바닥이 보입니다. 19 만큼 왼쪽으로 당겨 붙였습니다.
  // (계산대 상판과는 겹치지만 §2-4 대로 의도된 겹침입니다)
  griddle:  { x:317, y:1017, w:327,  h:336 },

  // 바 테이블 (화면 오른쪽 끝까지)
  barTable: { x:630, y:1012, w:1290, h:262 },

  // 계산대 위 POS 세트.
  // 스펙값(191x223)은 카운터에 비해 너무 커서 0.75 배로 줄였습니다.
  // 줄인 만큼 왼쪽에 여백이 생겨 x 도 14 → 52 로 옮겼습니다.
  pos:      { x:52,  y:884,  w:143,  h:167 },

  // 철판 김. 알파가 매우 낮아 ADD 블렌드가 필요합니다. (§3-2)
  //
  // 스펙값 (340, 882) 은 김이 음식과 같은 높이에 깔려서 음식 사이사이에
  // 파묻혀 보였습니다. y 를 59 올려 김이 음식 위로 피어오르게 했습니다.
  //   김   화면 y 705 ~ 815  (음식 봉우리보다 76px 위까지)
  //   음식 화면 y 781 ~ 855
  // 김의 아랫단을 음식 봉우리 아래에 걸쳐 두어야 음식에서 나는 것처럼 보입니다.
  // 너무 올리면 허공에 뜬 것처럼 끊겨 보입니다.
  // x 329 는 김의 중심(464.7)을 음식 중심(464.7)에 맞춘 값입니다.
  steam:    { x:329, y:823,  w:310,  h:140 },

  // 의자 5개 — 같은 에셋 재사용. 바닥선 1042 로 카운터(1012)보다 앞쪽입니다.
  chairSize: { w:88, h:172, y:1042 },
  chairs: [
    { id:"chair_1", x:726,  flipX:false },
    { id:"chair_2", x:924,  flipX:true  },
    { id:"chair_3", x:1122, flipX:false },
    { id:"chair_4", x:1320, flipX:true  },
    { id:"chair_5", x:1518, flipX:false }   // 빈자리
  ],

  // 명패 2개 — 같은 에셋 재사용. 글자는 이미지가 아니라 런타임 텍스트입니다. (§2-6)
  plateSize: { w:94, h:46 },
  plates: [
    { id:"plate_register", x:88,  y:890, text:"계산대", zone:"register" },
    // 철판을 19 왼쪽으로 당긴 만큼 같이 옮겼습니다. (스펙값 434)
    { id:"plate_griddle",  x:415, y:937, text:"철판",   zone:"griddle"  }
  ]
};

// 의자 5개의 최종 중심 x (COUNTER_FIT 적용 후 VIEW 좌표).
// customers.js 의 좌석이 이 값에서 파생됩니다. 의자를 옮기거나
// COUNTER_FIT.scale 을 바꾸면 손님도 자동으로 따라옵니다.
const COUNTER_CHAIR_CENTERS = COUNTER_LAYOUT.chairs.map(
  chair => fitX(chair.x) + fitSize(COUNTER_LAYOUT.chairSize.w)/2
);

/* ------------------------------------------------------------
   2-1. 게임 판정용 논리 좌표
   ------------------------------------------------------------
   위 COUNTER_LAYOUT 은 에셋 배치용 VIEW(1920x1080) 좌표입니다.
   게임 규칙(state.player, 준비물 배치, 프롬프트 위치)은 논리(1280x720)
   좌표를 쓰므로 같은 카운터를 논리 좌표로도 한 벌 적어 둡니다.

   COUNTER_FIT(1.04) 적용 후의 실제 화면 위치를 논리 좌표로 옮긴 값입니다.

     register  VIEW x  -38~327 , 상단 782 → 논리 x  -25~218 , y 521~675
     griddle   VIEW x  291~631 , 상단 668 → 논리 x  194~421 , y 445~678
     bar_table VIEW x  617~1958, 상단 740 → 논리 x  411~1305, y 493~675

   ix / iy 는 요리사가 서는 자리(카운터 위쪽 = 주방측)이며 손으로 맞춘 값입니다.
   COUNTER_FIT.scale 이나 COUNTER_LAYOUT 을 바꾸면 이 표도 같이 고쳐야 합니다.
   (toLogic() 로 자동 파생시키는 건 다음 단계 과제입니다)
   ------------------------------------------------------------ */

const FRONT_STATIONS = {
  register:{id:"register",label:"계산대",x:0,  y:521,w:218,h:154,ix:245,iy:470,facing:"down"},
  griddle: {id:"griddle", label:"철판",  x:194,y:445,w:227,h:233,ix:320,iy:470,facing:"down"},
  counter: {id:"counter", label:"카운터",x:411,y:493,w:869,h:182,ix:700,iy:470,facing:"down"}
};

// 명패 글자. 다국어 대응을 위해 이미지 합성이 아니라 텍스트로 올립니다.
const COUNTER_LABEL_STYLE = {
  fontFamily:'"Malgun Gothic","Apple SD Gothic Neo",sans-serif',
  fontSize:"21px",
  fontStyle:"bold",
  color:"#f4dcab",
  stroke:"#1d1108",
  strokeThickness:4
};


/* ------------------------------------------------------------
   3. 레이어 순서
   ------------------------------------------------------------
   stage.js 의 STAGE_DEPTH 가 이미 자리를 잡고 있어서 10 단위를
   그대로 쓸 수는 없습니다. 특히 40 은 집기·손님·이펙트를 그리는
   프레임 캔버스 한 장이 통째로 차지합니다.

     STAGE_DEPTH.overlay 40 : 주방 집기 · 손님 · 파티클 (캔버스 1장)
     STAGE_DEPTH.player  50 : 요리사

   손님은 캔버스(40)에 그려지므로,
     카운터 본체는 40 아래  → 손님이 카운터 앞에 앉은 것처럼 보이고
     의자는     40 위       → 등받이가 손님 몸을 가려 앉은 느낌이 납니다.
   의자 바닥선(1042)이 카운터 바닥선(1012)보다 아래 = 카메라에 더 가까우므로
   의자가 카운터보다 앞이 맞습니다. (원본 스펙 §2-7 의 30/40 과는 반대)
   ------------------------------------------------------------ */

const COUNTER_DEPTH = {
  barTable:       31,
  register:       32,
  griddleSurface: 33,
  griddleFront:   34,   // surface 와 겹치는 픽셀이 0 이라 순서는 결과에 영향 없음
  pos:            35,
  steam:          36,
  chair:          42,   // 프레임 캔버스(40) 위 = 손님 앞
  nameplate:      44,
  debug:          58    // 앰비언트(60) 아래
};


/* ------------------------------------------------------------
   4. 연출 설정값 (전부 조정용 상수)
   ------------------------------------------------------------ */

const GRIDDLE_IDLE_FRAME = 0;      // §3-1 빈 철판 프레임이 없어 0번을 정지 상태로 씁니다.

/* 조리 루프에 쓸 프레임
   ------------------------------------------------------------
   8프레임 중 2 / 3 / 6 번은 뒤집기라 음식이 철판 밖으로 크게 솟구칩니다.
   (프레임 안 음식 윗선: 0=85, 1=85, 2=60, 3=6, 4=84, 5=84, 6=55, 7=84)
   전부 이어 붙이면 상판 위 음식 덩어리가 통째로 오르내려서 산만합니다.

   그래서 평상시 루프는 음식 높이가 84~85 로 거의 같은 프레임만 씁니다.
   → 지글거리는 느낌만 남고 덩어리가 튀지 않습니다.

   뒤집기는 따로 빼 뒀습니다. 나중에 실제 조리 이벤트가 붙으면
   counterPlayGriddleToss() 로 한 번씩 섞어 주세요.
   ------------------------------------------------------------ */
const GRIDDLE_COOK_FRAMES = [0,1,4,5,7];
const GRIDDLE_TOSS_FRAMES = [2,6,3,6,2];
const GRIDDLE_COOK_FPS   = 7;
const GRIDDLE_TOSS_FPS   = 12;

const STEAM_FPS          = 10;
const STEAM_FADE_MS      = 200;
// 김은 항상 나옵니다. 조리 중일 때만 조금 진해집니다.
const STEAM_ALPHA_IDLE   = 0.70;
const STEAM_ALPHA_COOK   = 1.00;
const COOK_SWITCH_HOLD   = 0.20;   // 경계에서 깜빡이지 않도록 0.2초 완충 (§4-2)

const POS_PULSE_FPS      = 10;
const POS_BLINK_MIN      = 4000;   // 다음 깜빡임까지 최소 간격(ms)
const POS_BLINK_MAX      = 9000;
const POS_PULSE_GAP      = 90;     // 연속 재생 시 펄스 사이 간격(ms)

// 명패 둥실 (§4-3)
const COUNTER_FLOAT = {
  idle:   { amp:2, freq:0.0018 },   // 약 2px / 3.5초
  active: { amp:7, freq:0.0040 },   // 약 7px / 1.6초
  lerp:   0.05,
  activeTint:  0xfff2d2,
  activeScale: 1.03
};

/* 상호작용 판정
   ------------------------------------------------------------
   처음에는 넓은 사각형이었는데, 카운터 앞을 지나가기만 해도 철판이
   달아올라 산만했습니다. 그래서 주방 집기와 같은 방식으로 바꿨습니다.

     주방 집기(kitchen.js) : ix / iy 에서 STATION_REACH(논리 40) 안
     카운터              : ix / iy 에서 COUNTER_REACH(VIEW 55) 안

   ix / iy 는 FRONT_STATIONS 에 있는 "요리사가 서는 자리"입니다.
   즉 E 를 누를 수 있는 위치에 실제로 섰을 때만 켜집니다.

   [반경 55 인 이유] 계산대 ix VIEW 367.5, 철판 ix VIEW 480 으로 112 밖에
   안 떨어져 있습니다. 60 을 넘기면 두 판정이 겹쳐서 계산대 앞에서도
   철판이 달아오릅니다.
   ------------------------------------------------------------ */
const COUNTER_REACH = 55;

// FRONT_STATIONS 의 상호작용 지점을 VIEW 좌표로. (판정은 VIEW 로 합니다)
function counterStandPoint(station){
  return { x:toView(station.ix), y:toView(station.iy) };
}
function withinCounterReach(playerView,station){
  if(!playerView)return false;
  const p=counterStandPoint(station);
  return Math.hypot(playerView.x-p.x,playerView.y-p.y)<=COUNTER_REACH;
}


/* ------------------------------------------------------------
   5. 에셋 로딩
   ------------------------------------------------------------ */

const counterImages = {};

function loadCounterImage(asset){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{counterImages[asset.key]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`카운터 이미지를 불러오지 못했습니다: ${asset.file}`));
    image.src=`${COUNTER_ASSET_DIR}${asset.file}${COUNTER_EXT}`;
  });
}

// game.js 의 에셋 로딩 Promise.all 에 넣어서 사용합니다.
function loadCounterAssets(){
  return Promise.all(COUNTER_ASSETS.map(loadCounterImage));
}


/* ------------------------------------------------------------
   6. 생성
   ------------------------------------------------------------ */

const counter = {
  scene:null,
  ready:false,
  barTable:null, register:null, griddleSurface:null, griddleFront:null,
  pos:null, steam:null,
  chairs:[],      // { id, image, groundY } — 나중에 y 기준 깊이 정렬용
  plates:[],      // { id, container, plate, label, baseY, phase, amp, freq, active, zone }
  cooking:false,
  forceCook:false,        // G 키 강제 조리 (플레이어 판정과 OR)
  pendingCook:null,
  pendingCookTime:0,
  nearRegister:false,
  debugGraphics:null,
  debugOn:false
};

function createCounter(scene){
  counter.scene=scene;

  COUNTER_ASSETS.forEach(asset=>{
    if(scene.textures.exists(asset.key))return;
    if(asset.sheet) scene.textures.addSpriteSheet(asset.key,counterImages[asset.key],asset.sheet);
    else scene.textures.addImage(asset.key,counterImages[asset.key]);
  });

  createCounterAnimations(scene);

  const L=COUNTER_LAYOUT;

  counter.barTable=placeCounterImage(scene,"counter_bar_table",L.barTable,COUNTER_DEPTH.barTable);
  counter.register=placeCounterImage(scene,"counter_register",L.register,COUNTER_DEPTH.register);

  // 철판 위/아래는 같은 좌표·같은 배율이어야 이음새가 보이지 않습니다. (§1-3)
  counter.griddleSurface=placeCounterSprite(scene,"counter_griddle_surface",L.griddle,COUNTER_DEPTH.griddleSurface);
  counter.griddleSurface.setFrame(GRIDDLE_IDLE_FRAME);
  counter.griddleFront=placeCounterImage(scene,"counter_griddle_front",L.griddle,COUNTER_DEPTH.griddleFront);

  counter.pos=placeCounterSprite(scene,"counter_pos_set",L.pos,COUNTER_DEPTH.pos);
  counter.pos.setFrame(0);

  // 김은 처음부터 계속 돕니다. 조리 중일 때만 진해집니다.
  counter.steam=placeCounterSprite(scene,"counter_steam",L.steam,COUNTER_DEPTH.steam);
  counter.steam.setBlendMode(Phaser.BlendModes.ADD).setAlpha(STEAM_ALPHA_IDLE);
  counter.steam.play("counter_steam_loop");

  counter.chairs=L.chairs.map(data=>{
    const image=scene.add.image(fitX(data.x),fitY(L.chairSize.y),"counter_chair")
      .setOrigin(0,1)
      .setDisplaySize(fitSize(L.chairSize.w),fitSize(L.chairSize.h))
      .setDepth(COUNTER_DEPTH.chair)
      .setFlipX(!!data.flipX);
    return { id:data.id, image, groundY:fitY(L.chairSize.y) };
  });

  counter.plates=L.plates.map(data=>createCounterPlate(scene,data));

  counter.debugGraphics=scene.add.graphics().setDepth(COUNTER_DEPTH.debug).setVisible(false);

  scheduleCounterPosBlink();
  bindCounterKeys(scene);

  counter.ready=true;
}

// 배치는 전부 COUNTER_FIT 을 통과시킵니다. 설계값을 그대로 쓰지 마세요.
function placeCounterImage(scene,key,box,depth){
  return scene.add.image(fitX(box.x),fitY(box.y),key)
    .setOrigin(0,1).setDisplaySize(fitSize(box.w),fitSize(box.h)).setDepth(depth);
}
function placeCounterSprite(scene,key,box,depth){
  return scene.add.sprite(fitX(box.x),fitY(box.y),key)
    .setOrigin(0,1).setDisplaySize(fitSize(box.w),fitSize(box.h)).setDepth(depth);
}

function createCounterPlate(scene,data){
  const w=fitSize(COUNTER_LAYOUT.plateSize.w),h=fitSize(COUNTER_LAYOUT.plateSize.h);
  const baseY=fitY(data.y);
  const plate=scene.add.image(0,0,"counter_nameplate").setOrigin(0,1).setDisplaySize(w,h);
  const label=scene.add.text(w/2,-h/2,data.text,COUNTER_LABEL_STYLE).setOrigin(.5,.5);
  // 글자가 명패와 같이 움직여야 하므로 컨테이너로 묶습니다. (§4-3)
  const container=scene.add.container(fitX(data.x),baseY,[plate,label]).setDepth(COUNTER_DEPTH.nameplate);
  return {
    id:data.id, container, plate, label, zone:data.zone,
    baseY, phase:Math.random()*Math.PI*2,
    amp:COUNTER_FLOAT.idle.amp, freq:COUNTER_FLOAT.idle.freq,
    active:false
  };
}

function createCounterAnimations(scene){
  if(!scene.anims.exists("counter_griddle_cooking")){
    scene.anims.create({
      key:"counter_griddle_cooking",
      frames:scene.anims.generateFrameNumbers("counter_griddle_surface",{frames:GRIDDLE_COOK_FRAMES}),
      frameRate:GRIDDLE_COOK_FPS, repeat:-1
    });
  }
  // 뒤집기. 지금은 아무도 부르지 않고, 실제 조리 이벤트가 붙으면 씁니다.
  if(!scene.anims.exists("counter_griddle_toss")){
    scene.anims.create({
      key:"counter_griddle_toss",
      frames:scene.anims.generateFrameNumbers("counter_griddle_surface",{frames:GRIDDLE_TOSS_FRAMES}),
      frameRate:GRIDDLE_TOSS_FPS, repeat:0
    });
  }
  if(!scene.anims.exists("counter_steam_loop")){
    scene.anims.create({
      key:"counter_steam_loop",
      frames:scene.anims.generateFrameNumbers("counter_steam",{start:0,end:7}),
      frameRate:STEAM_FPS, repeat:-1
    });
  }
  if(!scene.anims.exists("counter_pos_pulse")){
    scene.anims.create({
      key:"counter_pos_pulse",
      frames:scene.anims.generateFrameNumbers("counter_pos_set",{start:0,end:5}),
      frameRate:POS_PULSE_FPS, repeat:0
    });
  }
}


/* ------------------------------------------------------------
   7. 계산대(POS) 깜빡임
   ------------------------------------------------------------
   평소에는 0번 프레임 정지. 가끔 한 번만 밝아졌다 돌아옵니다.
   나중에 실제 결제 이벤트가 붙으면 counterPlayPosPulse(2) 처럼
   연속 재생해서 구분할 수 있습니다.
   ------------------------------------------------------------ */

function counterPlayPosPulse(times=1){
  if(!counter.pos)return;
  let left=Math.max(1,Math.round(times));
  const play=()=>{
    counter.pos.play("counter_pos_pulse");
    counter.pos.once("animationcomplete",()=>{
      counter.pos.setFrame(0);
      if(--left>0)counter.scene.time.delayedCall(POS_PULSE_GAP,play);
    });
  };
  play();
}

function scheduleCounterPosBlink(){
  counter.scene.time.delayedCall(
    Phaser.Math.Between(POS_BLINK_MIN,POS_BLINK_MAX),
    ()=>{ counterPlayPosPulse(1); scheduleCounterPosBlink(); }
  );
}


/* ------------------------------------------------------------
   8. 철판 조리 상태
   ------------------------------------------------------------
   재생 조건 판정과 재생 자체를 분리해 두었습니다.
   지금은 "플레이어가 판정 영역 안" 또는 "G 키 강제" 이고,
   조건을 바꾸고 싶으면 counterCookingTest 만 교체하면 됩니다.
   ------------------------------------------------------------ */

let counterCookingTest = playerView => withinCounterReach(playerView,FRONT_STATIONS.griddle);

function counterSetCookingTest(fn){ counterCookingTest=fn; }

function setCounterCooking(on){
  if(counter.cooking===on)return;
  counter.cooking=on;
  const scene=counter.scene;
  if(on) counter.griddleSurface.play("counter_griddle_cooking");
  else{
    counter.griddleSurface.stop();
    counter.griddleSurface.setFrame(GRIDDLE_IDLE_FRAME);
  }
  // 김은 끄지 않고 진하기만 바꿉니다.
  scene.tweens.killTweensOf(counter.steam);
  scene.tweens.add({
    targets:counter.steam,
    alpha:on?STEAM_ALPHA_COOK:STEAM_ALPHA_IDLE,
    duration:STEAM_FADE_MS, ease:"Sine.easeInOut"
  });
}

// 뒤집기 1회 재생 후 조리 루프(또는 정지)로 복귀. 실제 조리 이벤트용 훅입니다.
function counterPlayGriddleToss(){
  if(!counter.griddleSurface)return;
  counter.griddleSurface.play("counter_griddle_toss");
  counter.griddleSurface.once("animationcomplete",()=>{
    if(counter.cooking)counter.griddleSurface.play("counter_griddle_cooking");
    else counter.griddleSurface.setFrame(GRIDDLE_IDLE_FRAME);
  });
}


/* ------------------------------------------------------------
   9. 매 프레임 갱신
   ------------------------------------------------------------
   playerView = { x, y } VIEW 좌표. 플레이어가 없으면 null 을 주세요.
   ------------------------------------------------------------ */

function updateCounter(time,delta,playerView){
  if(!counter.ready)return;
  const dt=Math.min(.05,(delta||0)/1000);

  // 철판: 0.2초 완충을 두어 경계에서 톡톡 튀지 않게 합니다.
  const want=counter.forceCook || counterCookingTest(playerView);
  if(want===counter.cooking){ counter.pendingCook=null; counter.pendingCookTime=0; }
  else{
    if(counter.pendingCook!==want){ counter.pendingCook=want; counter.pendingCookTime=0; }
    counter.pendingCookTime+=dt;
    if(counter.pendingCookTime>=COOK_SWITCH_HOLD){ setCounterCooking(want); counter.pendingCook=null; }
  }

  counter.nearRegister=withinCounterReach(playerView,FRONT_STATIONS.register);

  // 명패 둥실. 진폭·주기를 부드럽게 보간하고, 위상은 누적해서 튀지 않게 합니다.
  counter.plates.forEach(p=>{
    p.active = p.zone==="griddle" ? counter.cooking : counter.nearRegister;
    const target=p.active?COUNTER_FLOAT.active:COUNTER_FLOAT.idle;
    p.amp =Phaser.Math.Linear(p.amp ,target.amp ,COUNTER_FLOAT.lerp);
    p.freq=Phaser.Math.Linear(p.freq,target.freq,COUNTER_FLOAT.lerp);
    p.phase+=p.freq*(delta||0);
    p.container.y=p.baseY+Math.sin(p.phase)*p.amp;

    const scale=Phaser.Math.Linear(p.container.scale,p.active?COUNTER_FLOAT.activeScale:1,COUNTER_FLOAT.lerp);
    p.container.setScale(scale);
    if(p.active)p.plate.setTint(COUNTER_FLOAT.activeTint); else p.plate.clearTint();
  });

  if(counter.debugOn)drawCounterDebug(playerView);
}


/* ------------------------------------------------------------
   10. 디버그
   ------------------------------------------------------------
   콘솔에서 counterDebug() 또는 F9 키로 판정 영역을 켜고 끕니다.
   ------------------------------------------------------------ */

function counterDebug(on){
  counter.debugOn = on===undefined ? !counter.debugOn : !!on;
  counter.debugGraphics?.setVisible(counter.debugOn).clear();
  return counter.debugOn;
}

function drawCounterDebug(playerView){
  const g=counter.debugGraphics; if(!g)return;
  g.clear();
  const L=COUNTER_LAYOUT;
  // 설계값이 아니라 COUNTER_FIT 을 통과한 실제 위치를 그립니다.
  const box=(rect,color)=>{
    g.lineStyle(2,color,.9);
    g.strokeRect(fitX(rect.x),fitY(rect.y)-fitSize(rect.h),fitSize(rect.w),fitSize(rect.h));
  };
  box(L.register,0xff8844); box(L.griddle,0xff4466); box(L.barTable,0xffcc44);
  box(L.pos,0x8888ff); box(L.steam,0x66ddff);
  L.chairs.forEach(c=>box({x:c.x,y:L.chairSize.y,w:L.chairSize.w,h:L.chairSize.h},0x66ff88));
  L.plates.forEach(p=>box({x:p.x,y:p.y,w:L.plateSize.w,h:L.plateSize.h},0xffffff));

  // 상호작용 판정: ix/iy 를 중심으로 한 반경 원
  const griddleStand=counterStandPoint(FRONT_STATIONS.griddle);
  const registerStand=counterStandPoint(FRONT_STATIONS.register);
  g.lineStyle(3,0x00ff00,.95); g.strokeCircle(griddleStand.x,griddleStand.y,COUNTER_REACH);
  g.lineStyle(3,0x00aaff,.95); g.strokeCircle(registerStand.x,registerStand.y,COUNTER_REACH);

  g.lineStyle(2,0xffffff,1);
  g.beginPath(); g.moveTo(0,COUNTER_GROUND_Y); g.lineTo(1920,COUNTER_GROUND_Y); g.strokePath();

  if(playerView){ g.fillStyle(0xff0000,1); g.fillCircle(playerView.x,playerView.y,6); }
}


/* ------------------------------------------------------------
   11. 키 바인딩
   ------------------------------------------------------------
   G  : 철판 강제 조리 on/off (플레이어 위치 판정과 OR)
   F9 : 판정 영역 표시
   ------------------------------------------------------------ */

function bindCounterKeys(scene){
  scene.input.keyboard.on("keydown-G",()=>{ counter.forceCook=!counter.forceCook; });
  scene.input.keyboard.on("keydown-F9",()=>{ counterDebug(); });
}

// 콘솔에서 만질 수 있도록 노출
window.counterDebug=counterDebug;
window.counterPlayPosPulse=counterPlayPosPulse;
window.counterSetCookingTest=counterSetCookingTest;
window.counterPlayGriddleToss=counterPlayGriddleToss;
window.COUNTER_LAYOUT=COUNTER_LAYOUT;
