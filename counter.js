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

const COUNTER_LAYOUT = {
  // 계산대 본체 (화면 왼쪽 밖으로 잘려 나감 — 의도됨 §2-4)
  register: { x:0,   y:1013, w:363,  h:222 },

  // 철판. surface(애니메이션)와 front(정지)는 반드시 같은 값을 써야 합니다. (§1-3)
  griddle:  { x:336, y:1017, w:327,  h:336 },

  // 바 테이블 (화면 오른쪽 끝까지)
  barTable: { x:630, y:1012, w:1290, h:262 },

  // 계산대 위 POS 세트
  pos:      { x:14,  y:888,  w:191,  h:223 },

  // 철판 김. 알파가 매우 낮아 ADD 블렌드가 필요합니다. (§3-2)
  steam:    { x:340, y:882,  w:310,  h:140 },

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
    { id:"plate_griddle",  x:434, y:937, text:"철판",   zone:"griddle"  }
  ]
};

/* ------------------------------------------------------------
   2-1. 게임 판정용 논리 좌표
   ------------------------------------------------------------
   위 COUNTER_LAYOUT 은 에셋 배치용 VIEW(1920x1080) 좌표입니다.
   게임 규칙(state.player, 준비물 배치, 프롬프트 위치)은 논리(1280x720)
   좌표를 쓰므로 같은 카운터를 논리 좌표로도 한 벌 적어 둡니다.

     register  VIEW x   0~363 , 바닥선 1013 → 논리 x   0~242 , y 500~675
     griddle   VIEW x 336~663 , 바닥선 1017 → 논리 x 224~442 , y 454~678
     bar_table VIEW x 630~1920, 바닥선 1012 → 논리 x 420~1280, y 500~675

   ix / iy 는 요리사가 서는 자리(카운터 위쪽 = 주방측)이며 손으로 맞춘 값입니다.
   카운터를 옮기면 COUNTER_LAYOUT 과 이 표를 같이 고쳐야 합니다.
   (toLogic() 로 자동 파생시키는 건 다음 단계 과제입니다)
   ------------------------------------------------------------ */

const FRONT_STATIONS = {
  register:{id:"register",label:"계산대",x:0,  y:500,w:242,h:175,ix:245,iy:470,facing:"down"},
  griddle: {id:"griddle", label:"철판",  x:224,y:454,w:218,h:224,ix:333,iy:470,facing:"down"},
  counter: {id:"counter", label:"카운터",x:420,y:500,w:860,h:175,ix:700,iy:470,facing:"down"}
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
const GRIDDLE_COOK_FPS   = 9;
const STEAM_FPS          = 10;
const STEAM_FADE_MS      = 200;    // 김이 켜지고 꺼지는 시간
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

/* 상호작용 판정 영역 (VIEW 좌표).
   요리사는 카운터 위쪽(주방측)에서 접근합니다. 아래쪽이 아닙니다. (§4-2)
   요리사 이동 범위는 game.js WALK_BOUNDS = 논리 235~1030 / 410~486
   → VIEW 로는 x 352~1545, y 615~729 입니다. 그 아래쪽 띠만 잡습니다.

   요리사가 갈 수 있는 왼쪽 끝이 VIEW x 352 라, 계산대(0~363)와 철판(336~663)은
   서 있을 자리가 거의 붙어 있습니다. 두 영역이 겹치면 계산대 앞에서도 철판이
   달아오르므로 x 412 를 경계로 딱 나눠 둡니다. */
const COUNTER_ZONES = {
  register: { x:338, y:655, w:74,  h:95 },
  griddle:  { x:412, y:655, w:278, h:95 }
};


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

  counter.steam=placeCounterSprite(scene,"counter_steam",L.steam,COUNTER_DEPTH.steam);
  counter.steam.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);

  counter.chairs=L.chairs.map(data=>{
    const image=scene.add.image(data.x,L.chairSize.y,"counter_chair")
      .setOrigin(0,1)
      .setDisplaySize(L.chairSize.w,L.chairSize.h)
      .setDepth(COUNTER_DEPTH.chair)
      .setFlipX(!!data.flipX);
    return { id:data.id, image, groundY:L.chairSize.y };
  });

  counter.plates=L.plates.map(data=>createCounterPlate(scene,data));

  counter.debugGraphics=scene.add.graphics().setDepth(COUNTER_DEPTH.debug).setVisible(false);

  scheduleCounterPosBlink();
  bindCounterKeys(scene);

  counter.ready=true;
}

function placeCounterImage(scene,key,box,depth){
  return scene.add.image(box.x,box.y,key)
    .setOrigin(0,1).setDisplaySize(box.w,box.h).setDepth(depth);
}
function placeCounterSprite(scene,key,box,depth){
  return scene.add.sprite(box.x,box.y,key)
    .setOrigin(0,1).setDisplaySize(box.w,box.h).setDepth(depth);
}

function createCounterPlate(scene,data){
  const size=COUNTER_LAYOUT.plateSize;
  const plate=scene.add.image(0,0,"counter_nameplate").setOrigin(0,1).setDisplaySize(size.w,size.h);
  const label=scene.add.text(size.w/2,-size.h/2,data.text,COUNTER_LABEL_STYLE).setOrigin(.5,.5);
  // 글자가 명패와 같이 움직여야 하므로 컨테이너로 묶습니다. (§4-3)
  const container=scene.add.container(data.x,data.y,[plate,label]).setDepth(COUNTER_DEPTH.nameplate);
  return {
    id:data.id, container, plate, label, zone:data.zone,
    baseY:data.y, phase:Math.random()*Math.PI*2,
    amp:COUNTER_FLOAT.idle.amp, freq:COUNTER_FLOAT.idle.freq,
    active:false
  };
}

function createCounterAnimations(scene){
  if(!scene.anims.exists("counter_griddle_cooking")){
    scene.anims.create({
      key:"counter_griddle_cooking",
      frames:scene.anims.generateFrameNumbers("counter_griddle_surface",{start:0,end:7}),
      frameRate:GRIDDLE_COOK_FPS, repeat:-1
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

let counterCookingTest = playerView =>
  !!playerView && rectContains(COUNTER_ZONES.griddle,playerView.x,playerView.y);

function counterSetCookingTest(fn){ counterCookingTest=fn; }

function rectContains(rect,x,y){
  return x>=rect.x && x<=rect.x+rect.w && y>=rect.y && y<=rect.y+rect.h;
}

function setCounterCooking(on){
  if(counter.cooking===on)return;
  counter.cooking=on;
  const scene=counter.scene;
  scene.tweens.killTweensOf(counter.steam);
  if(on){
    counter.griddleSurface.play("counter_griddle_cooking");
    counter.steam.setVisible(true).play("counter_steam_loop");
    scene.tweens.add({targets:counter.steam,alpha:1,duration:STEAM_FADE_MS,ease:"Sine.easeOut"});
  }else{
    counter.griddleSurface.stop();
    counter.griddleSurface.setFrame(GRIDDLE_IDLE_FRAME);
    scene.tweens.add({
      targets:counter.steam,alpha:0,duration:STEAM_FADE_MS,ease:"Sine.easeIn",
      onComplete:()=>{ counter.steam.stop(); counter.steam.setVisible(false); }
    });
  }
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

  counter.nearRegister=!!playerView && rectContains(COUNTER_ZONES.register,playerView.x,playerView.y);

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
  const box=(rect,color)=>{g.lineStyle(2,color,.9);g.strokeRect(rect.x,rect.y-rect.h,rect.w,rect.h);};
  box(L.register,0xff8844); box(L.griddle,0xff4466); box(L.barTable,0xffcc44);
  box(L.pos,0x8888ff); box(L.steam,0x66ddff);
  L.chairs.forEach(c=>box({x:c.x,y:L.chairSize.y,w:L.chairSize.w,h:L.chairSize.h},0x66ff88));
  L.plates.forEach(p=>box({x:p.x,y:p.y,w:L.plateSize.w,h:L.plateSize.h},0xffffff));

  g.lineStyle(3,0x00ff00,.95);
  g.strokeRect(COUNTER_ZONES.griddle.x,COUNTER_ZONES.griddle.y,COUNTER_ZONES.griddle.w,COUNTER_ZONES.griddle.h);
  g.lineStyle(3,0x00aaff,.95);
  g.strokeRect(COUNTER_ZONES.register.x,COUNTER_ZONES.register.y,COUNTER_ZONES.register.w,COUNTER_ZONES.register.h);

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
window.COUNTER_LAYOUT=COUNTER_LAYOUT;
window.COUNTER_ZONES=COUNTER_ZONES;
