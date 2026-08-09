"use strict";

/* ============================================================
   창밖 연출 = 낮에 가끔 지나가는 새 · 밤에 반짝이는 별
   ------------------------------------------------------------
   담당 범위: 창유리 안쪽에서만 도는 배경 애니메이션 두 종.
              assets/bg/fx_window_*.png 스프라이트 시트의
              규격 · 자리 · 등장 주기 한 벌.

   담당 범위가 아님: 게임 규칙, 집기, 손님, 미니게임
              → 그쪽은 game.js / kitchen.js / night.js

   [의존 방향] stage.js → window-fx.js 단방향.
   stage.js 가 부르는 함수는 셋뿐입니다.
     loadWindowFxAssets()        에셋 로딩 (Promise)
     createWindowFxLayer(scene)  컨테이너 하나를 만들어 돌려줍니다
     setWindowFxTimeOfDay(mode)  낮/밤 전환
   index.html 에서 stage.js 보다 먼저 로드되어야 합니다.

   [별이 두 벌인 이유] stage.js 의 STAR_FIELD 는 밤하늘에 깔린
   작은 점 18 개입니다(원 도형). 그건 "늘 켜져 있는 별밭"이고,
   여기 별은 원화로 그린 큰 반짝임이라 가끔 터졌다 사라집니다.
   둘은 서로 다른 층이니 한쪽만 끄고 켜도 됩니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 창문 실측값
   ------------------------------------------------------------
   전부 VIEW(1920x1080) 좌표입니다. stage.js BACKGROUND_LAYERS 가
   bg_window / bg_window_view_* 를 (464, 130) 에 올려 두므로
   "원본 픽셀 + (464, 130)" 이 그대로 화면 좌표가 됩니다.

   [유리 구멍] bg_window.png 의 알파 0 영역을 실측한 값입니다.
   가로는 창살 때문에 네 칸으로 나뉘어 있지만, 창살은 창틀
   그림(depth 20)의 일부라 새보다 앞에 그려집니다. 그래서 여기서는
   칸을 나누지 않고 유리 전체를 하나의 사각형으로 봅니다.
     원본 x  31~930 · y  22~187
     화면 x 495~1394 · y 152~317

   [주간 지붕선] bg_window_view_day.png 에서 하늘이 아닌 첫 픽셀을
   세로로 훑어 유리 구멍 안(x 31~930)의 최솟값을 잰 값입니다.
     원본 y 56 (x 887, 오른쪽 끝 기와지붕 용마루) → 화면 y 186
   즉 "어느 x 에서나 하늘"인 띠는 화면 y 152~186, 겨우 34px 입니다.

   [야간 지붕선] 밤 그림은 실루엣이라 같은 방법으로 못 잽니다.
   눈으로 보면 지붕 꼭짓점이 원본 y 105 근처(화면 235)이고,
   stage.js STAR_FIELD 도 화면 y 232 까지만 씁니다. 별은 그보다
   안쪽인 화면 y 160~222 안에서만 터뜨립니다.

   ⚠️ 창문 에셋을 교체하면 이 표를 다시 재세요. 새/별 자리는 전부
      이 값에서 계산하므로, 여기만 고치면 나머지는 따라옵니다.
   ------------------------------------------------------------ */

const WINDOW_FX_ASSET_DIR = "assets/bg/";

// 창문 그림 전체(창틀 나무테 포함). 새가 이 밖으로 나가면 벽 위에 뜹니다.
const WINDOW_FRAME_RECT = { x:464, y:130, w:962, h:215 };

// 유리 구멍. 새·별은 이 안에서만 보입니다.
const WINDOW_GLASS_RECT = { x:495, y:152, w:900, h:166 };


/* ------------------------------------------------------------
   2. 스프라이트 시트 규격
   ------------------------------------------------------------
   trim = [x, y, w, h] : 칸 안에서 실제로 그림이 있는 영역.
   새는 프레임마다 날개 높이가 달라서 **여덟 칸을 합친** 경계입니다
   (f2 는 세로 20px, f0/f6 은 60px). 합쳐서 잡아야 어떤 프레임에서도
   날개 끝이 창틀 밖으로 안 나갑니다.

   크기는 drawW(그림 내용의 가로 폭, VIEW px) 하나로만 적습니다.
   세로와 여백은 원본 비율로 자동 계산합니다. — decoration.js 와 같은 규칙
   ------------------------------------------------------------ */

const WINDOW_FX_BIRD = {
  key:"fx_window_bird_fly",
  frameW:128, frameH:96, frames:8,
  trim:[37, 3, 62, 84],   // 8칸 합집합. 시트 원본 1024x96
  frameRate:16,           // 8프레임 = 초당 두 번 날갯짓
  drawW:[24, 38]          // 내용 가로 폭을 이 범위에서 매번 다시 뽑습니다 (§3 크기)
};

const WINDOW_FX_STAR = {
  key:"fx_window_star_twinkle",
  frameW:128, frameH:128, frames:6,
  trim:[36, 37, 55, 55],  // 가장 큰 프레임(f3) 기준. 시트 원본 768x128
  frameRate:9,            // 6프레임 한 번 = 약 0.67초짜리 반짝임
  drawW:22
};

const WINDOW_FX_SHEETS = [WINDOW_FX_BIRD, WINDOW_FX_STAR];


/* ------------------------------------------------------------
   3. 새 — 가끔 창을 가로지릅니다
   ------------------------------------------------------------
   [한 무리 규칙] 한 번에 한 마리, 또는 BIRD_PAIR_CHANCE 확률로 두 마리가
   앞뒤로 붙어서 지나갑니다. 무리가 다 지나가기 전에는 다음 예약을
   잡지 않으므로, 서로 다른 무리가 화면에서 겹치는 일은 없습니다.

   [두 마리를 "붙여서" 만드는 법] 뒷새는 자리를 뒤로 옮기는 게 아니라
   **같은 길을 조금 늦게 출발**합니다(tween delay). 속도가 같으니 간격이
   끝까지 유지되고, 출발 대기 중에도 창밖에 있어서 마스크가 가려 줍니다.
   자리로 밀어내면 큰 새일수록 창 밖으로 더 튀어나가서 계산이 지저분해집니다.

   [창문 모양 마스크] 새가 창문 사각형 밖에서 들어오고 나갑니다.
   예전에는 마스크 없이 출발점을 창틀 나무테(폭 31) 뒤에 숨겼는데,
   새를 키우고 나니 내용 폭(최대 38)이 나무테보다 넓어져서 벽 위로
   삐져나옵니다. 그래서 창문 사각형으로 잘라내고(§6), 출발/도착점은
   아예 창 밖(BIRD_ENTRY_MARGIN)에 둡니다. 크기를 더 키워도 안 깨집니다.

   [크기] 매번 다시 뽑습니다(WINDOW_FX_BIRD.drawW 범위).
   큰 새는 band 계산에 걸려 저절로 낮게 날고, 작은 새는 높이 뜰 수
   있습니다 — 가까운 새가 낮게 지나가는 것처럼 읽힙니다.

   [고도] 위 한계는 유리 윗변(152), 아래 한계는 BIRD_FLOOR 입니다.
   지붕선(186)보다 한참 아래라서 건물·나무 앞을 가로지르기도 합니다.
   (창밖 풍경이 한 장짜리 그림이라 "건물 뒤"로는 못 보냅니다 —
    풍경 위에 그리는 것 말고는 방법이 없습니다.)

   [상하 흔들림] 가로는 등속, 세로만 사인으로 흔듭니다. 진폭을
   band 계산에 미리 빼 두어서, 흔들려도 유리 밖으로 안 나갑니다.
   ------------------------------------------------------------ */

const BIRD_COUNT_MAX    = 2;     // 스프라이트를 이만큼 만들어 둡니다
const BIRD_PAIR_CHANCE  = 0.45;  // 이 확률로 두 마리가 붙어서
const BIRD_PAIR_DELAY   = [240, 620];   // 뒷새가 늦게 출발하는 시간(ms) = 앞뒤 간격
const BIRD_PAIR_DY      = [  6,  18];   // 뒷새의 위아래 어긋남
const BIRD_PAIR_SIZE    = [0.78, 0.96]; // 뒷새 크기 = 앞새 x 이 배수

const BIRD_ENTRY_MARGIN = 8;     // 창문 사각형 **바깥**으로 이만큼에서 출발/도착
const BIRD_FLOOR        = 245;   // 새가 내려갈 수 있는 화면 y 하한 (건물 중턱)
const BIRD_BOB_AMPLITUDE= 4;     // 상하 흔들림 반진폭
const BIRD_BOB_MS       = 780;   // 한 번 오르내리는 데 걸리는 시간

/* 무리와 무리 사이 = 건너는 시간(4.3~6.5초) + BIRD_GAP 입니다.
   GAP 은 마지막 새가 사라진 뒤부터 재기 때문에, 체감 주기는 9~17초입니다. */
const BIRD_SPEED_MIN    = 150;   // px/초. 창 폭을 약 6.5초에 건넙니다
const BIRD_SPEED_MAX    = 230;   // 약 4.3초

const BIRD_FIRST_DELAY  = [2000,  5000];  // 낮이 시작되고 첫 무리까지
const BIRD_GAP          = [5000, 11000];  // 지나간 뒤 다음 무리까지


/* ------------------------------------------------------------
   4. 별 — 밤하늘 아무 데서나 반짝입니다
   ------------------------------------------------------------
   [새보다 잦게] 0.3~1.0초마다 한 번 터뜨리고, 그때마다 1~3개가
   같이 뜹니다(STAR_BURST_CHANCE 를 두 번 굴립니다). 한 번이 0.67초라
   보통 두세 개가 겹쳐 보입니다 — 새(10여 초에 한 무리)와 확실히 다른 리듬입니다.

   [자리] 유리 안 · 지붕선 위. STAR_FIELD(stage.js) 와 같은 하늘이지만
   반짝임은 원화가 커서(내용 14px) 위아래로 조금 좁혀 두었습니다.

   [달 피하기] 야경 그림의 달이 화면 (746, 214) 반지름 14 에 있습니다.
   그 위에 반짝임이 겹치면 달이 터진 것처럼 보여서, 중심끼리
   STAR_MOON_KEEPOUT 보다 가까우면 자리를 다시 뽑습니다.

   [스프라이트 재활용] 매번 add.sprite 하면 밤새 수백 개가 쌓입니다.
   STAR_POOL_SIZE 개를 미리 만들어 두고 쉬는 놈을 꺼내 씁니다.
   전부 사용 중이면 그 판은 그냥 거릅니다(다음 주기에 또 옵니다).
   ------------------------------------------------------------ */

/* 반짝임 중심이 놓일 범위. 별이 커져서(내용 최대 29) 위아래를 좁혔습니다 —
   중심 y 168 이면 윗변이 153.5 로 유리 윗변(152) 바로 아래입니다. */
const STAR_SPARK_FIELD   = { x:510, y:168, w:870, h:52 };
const STAR_MOON          = { x:746, y:214 };
const STAR_MOON_KEEPOUT  = 34;            // 별이 커진 만큼 달도 더 넓게 피합니다

const STAR_SPAWN_GAP     = [300, 1000];   // 다음 반짝임까지 (ms)
const STAR_BURST_CHANCE  = 0.55;          // 두 번 굴려서 한 번에 1~3개
const STAR_POOL_SIZE     = 12;            // 동시에 이 이상은 안 뜹니다

const STAR_SCALE_JITTER  = [0.75, 1.30];  // drawW 배수
const STAR_ALPHA_JITTER  = [0.70, 1.00];


/* ------------------------------------------------------------
   5. 에셋 로딩
   ------------------------------------------------------------ */

const windowFxImages = {};

function loadWindowFxImage(key){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{windowFxImages[key]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`창밖 연출 이미지를 불러오지 못했습니다: ${key}`));
    image.src=`${WINDOW_FX_ASSET_DIR}${key}.png`;
  });
}

// stage.js loadStageAssets() 에서 부릅니다.
function loadWindowFxAssets(){
  return Promise.all(WINDOW_FX_SHEETS.map(sheet=>loadWindowFxImage(sheet.key)));
}


/* ------------------------------------------------------------
   6. 레이어 만들기
   ------------------------------------------------------------
   stage.js 가 이 컨테이너를 창밖 풍경과 창틀 **사이**에 끼워 넣습니다.
   컨테이너 안은 depth 가 아니라 추가 순서가 곧 그리기 순서입니다.

   [마스크] 컨테이너를 창문 사각형으로 잘라 둡니다. 새가 창 밖에서
   들어오고 나가는데(§3), 창틀 나무테는 새보다 앞이긴 해도 폭이 31 뿐이라
   큰 새를 다 못 가립니다. 마스크가 없으면 벽 위에 새가 떠 있습니다.
   ------------------------------------------------------------ */

let windowFxScene   = null;
let windowFxLayer   = null;
let windowFxMode    = "day";

let birdSprites     = [];
let birdTimer       = null;   // 다음 무리 예약
let birdInFlight    = 0;      // 지금 날고 있는 마리 수

let starSprites     = [];
let starTimer       = null;

const WINDOW_FX_BIRD_ANIM = "fx_window_bird";
const WINDOW_FX_STAR_ANIM = "fx_window_star";

const randRange  = (min,max)=>min+Math.random()*(max-min);
const randPair   = pair=>randRange(pair[0],pair[1]);

// 시트를 프레임으로 자르고 애니메이션을 등록합니다.
function registerWindowFxSheet(scene,sheet,animKey,repeat){
  const image=windowFxImages[sheet.key];
  if(!image)return false;
  if(!scene.textures.exists(sheet.key))
    scene.textures.addSpriteSheet(sheet.key,image,{frameWidth:sheet.frameW,frameHeight:sheet.frameH});
  if(!scene.anims.exists(animKey))
    scene.anims.create({
      key:animKey,
      frames:scene.anims.generateFrameNumbers(sheet.key,{start:0,end:sheet.frames-1}),
      frameRate:sheet.frameRate, repeat
    });
  return true;
}

// stage.js createStage() 에서 부릅니다. 컨테이너 하나를 돌려줍니다.
function createWindowFxLayer(scene){
  windowFxScene=scene;
  windowFxLayer=scene.add.container(0,0);

  // 창문 사각형 밖은 잘라냅니다. add:false 라 이 도형 자체는 안 그려집니다.
  const maskShape=scene.make.graphics({},false);
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(WINDOW_FRAME_RECT.x,WINDOW_FRAME_RECT.y,WINDOW_FRAME_RECT.w,WINDOW_FRAME_RECT.h);
  windowFxLayer.setMask(maskShape.createGeometryMask());

  if(registerWindowFxSheet(scene,WINDOW_FX_BIRD,WINDOW_FX_BIRD_ANIM,-1)){
    birdSprites=[];
    for(let i=0;i<BIRD_COUNT_MAX;i++){
      const sprite=scene.add.sprite(0,0,WINDOW_FX_BIRD.key).setVisible(false);
      birdSprites.push(sprite);
      windowFxLayer.add(sprite);
    }
  }

  if(registerWindowFxSheet(scene,WINDOW_FX_STAR,WINDOW_FX_STAR_ANIM,0)){
    starSprites=[];
    for(let i=0;i<STAR_POOL_SIZE;i++){
      const sprite=scene.add.sprite(0,0,WINDOW_FX_STAR.key).setVisible(false);
      // 한 번 다 돌면 스스로 숨습니다(repeat 0). 그래야 다시 꺼내 쓸 수 있습니다.
      sprite.on("animationcomplete",()=>sprite.setVisible(false));
      starSprites.push(sprite);
      windowFxLayer.add(sprite);
    }
  }

  return windowFxLayer;
}


/* ------------------------------------------------------------
   7. 새 비행
   ------------------------------------------------------------ */

/* 이 크기로 날 때의 고도 한계.
   프레임 한가운데가 스프라이트 중심이므로, 중심에서 날개 끝까지의
   거리는 trim 을 프레임 중심 기준으로 환산한 값입니다.
   큰 새일수록 top 이 내려가고 bottom 이 올라가서 저절로 낮게 납니다. */
function computeBirdBand(scale){
  const B=WINDOW_FX_BIRD;
  const halfUp  =(B.frameH/2-B.trim[1])*scale;                 // 중심 → 위쪽 날개 끝
  const halfDown=(B.trim[1]+B.trim[3]-B.frameH/2)*scale;       // 중심 → 아래쪽 날개 끝
  const top   =WINDOW_GLASS_RECT.y+halfUp+BIRD_BOB_AMPLITUDE;  // 유리 윗변에 안 닿는 최고 고도
  const bottom=BIRD_FLOOR-halfDown-BIRD_BOB_AMPLITUDE;
  return { top, bottom:Math.max(top,bottom) };
}

/* 한 마리를 날립니다. 무리의 두 마리는 방향·속도·거리가 같고
   출발 시각(delay) · 고도 · 크기만 다릅니다. */
function launchBird(sprite,flight,drawW,centerY,delay){
  const scene=windowFxScene;
  const B=WINDOW_FX_BIRD;
  const scale=drawW/B.trim[2];

  sprite
    .setOrigin(0.5,0.5)
    .setDisplaySize(B.frameW*scale,B.frameH*scale)
    .setFlipX(!flight.toRight)
    .setPosition(flight.fromX,centerY)
    .setVisible(true);
  sprite.play({key:WINDOW_FX_BIRD_ANIM,startFrame:Math.floor(Math.random()*B.frames)});
  sprite.anims.timeScale=randRange(0.9,1.15);   // 두 마리가 한 몸처럼 안 움직이게

  birdInFlight++;
  scene.tweens.killTweensOf(sprite);
  scene.tweens.add({
    targets:sprite,x:flight.toX,duration:flight.duration,delay,ease:"Linear",
    onComplete:()=>{
      hideBird(sprite);
      birdInFlight=Math.max(0,birdInFlight-1);
      if(!birdInFlight) scheduleBird(randPair(BIRD_GAP));   // 무리가 다 지나가야 다음 예약
    }
  });
  scene.tweens.add({
    targets:sprite,
    y:{from:centerY-BIRD_BOB_AMPLITUDE,to:centerY+BIRD_BOB_AMPLITUDE},
    duration:BIRD_BOB_MS,yoyo:true,repeat:-1,ease:"Sine.easeInOut"
  });
}

function flyBird(){
  const scene=windowFxScene;
  if(!scene||!birdSprites.length||birdInFlight||windowFxMode!=="day")return;

  // 원화가 오른쪽을 보고 있습니다. 왼쪽으로 갈 때만 뒤집습니다.
  const toRight=Math.random()<0.5;
  const outer=WINDOW_FRAME_RECT.x-BIRD_ENTRY_MARGIN-maxBirdHalfWidth();
  const inner=WINDOW_FRAME_RECT.x+WINDOW_FRAME_RECT.w+BIRD_ENTRY_MARGIN+maxBirdHalfWidth();
  const fromX=toRight?outer:inner;
  const toX  =toRight?inner:outer;
  const flight={ toRight,fromX,toX,
    duration:Math.abs(toX-fromX)/randRange(BIRD_SPEED_MIN,BIRD_SPEED_MAX)*1000 };

  const leadW=randPair(WINDOW_FX_BIRD.drawW);
  const leadBand=computeBirdBand(leadW/WINDOW_FX_BIRD.trim[2]);
  const leadY=randRange(leadBand.top,leadBand.bottom);
  launchBird(birdSprites[0],flight,leadW,leadY,0);

  if(birdSprites.length<2||Math.random()>=BIRD_PAIR_CHANCE)return;

  // 뒷새. 위아래로 조금 어긋나되 자기 크기의 band 를 벗어나지 않게 가둡니다.
  const followW=leadW*randPair(BIRD_PAIR_SIZE);
  const followBand=computeBirdBand(followW/WINDOW_FX_BIRD.trim[2]);
  const followY=Math.min(followBand.bottom,Math.max(followBand.top,
    leadY+randPair(BIRD_PAIR_DY)*(Math.random()<0.5?-1:1)));
  launchBird(birdSprites[1],flight,followW,followY,randPair(BIRD_PAIR_DELAY));
}

// 가장 큰 새의 내용 반폭. 출발점을 창 밖 어디에 둘지 정하는 데 씁니다.
function maxBirdHalfWidth(){
  return WINDOW_FX_BIRD.drawW[1]/2;
}

function hideBird(sprite){
  windowFxScene?.tweens.killTweensOf(sprite);
  sprite.anims?.stop();
  sprite.setVisible(false);
}

function scheduleBird(delay){
  const scene=windowFxScene;
  if(!scene||!birdSprites.length||windowFxMode!=="day")return;
  birdTimer?.remove(false);
  birdTimer=scene.time.delayedCall(delay,flyBird);
}

// 밤으로 넘어갈 때 무리를 통째로 치웁니다.
function stopBird(){
  birdTimer?.remove(false);
  birdTimer=null;
  birdInFlight=0;
  birdSprites.forEach(hideBird);
}


/* ------------------------------------------------------------
   8. 별 반짝임
   ------------------------------------------------------------ */

function twinkleStar(){
  const scene=windowFxScene;
  if(!scene||windowFxMode!=="night")return;

  const sprite=starSprites.find(candidate=>!candidate.visible);
  if(!sprite)return;   // 풀이 다 나갔으면 이번 판은 거릅니다

  const S=WINDOW_FX_STAR;
  const scale=S.drawW/S.trim[2]*randPair(STAR_SCALE_JITTER);

  // 달과 겹치지 않는 자리를 찾습니다. 몇 번 실패해도 그냥 씁니다
  // (하늘이 넓어서 실제로는 거의 첫 판에 통과합니다).
  let x=0,y=0;
  for(let attempt=0;attempt<8;attempt++){
    x=STAR_SPARK_FIELD.x+Math.random()*STAR_SPARK_FIELD.w;
    y=STAR_SPARK_FIELD.y+Math.random()*STAR_SPARK_FIELD.h;
    if(Math.hypot(x-STAR_MOON.x,y-STAR_MOON.y)>=STAR_MOON_KEEPOUT)break;
  }

  sprite
    .setOrigin(0.5,0.5)
    .setDisplaySize(S.frameW*scale,S.frameH*scale)
    .setPosition(x,y)
    .setAngle(Math.random()*90)          // 네모난 별이라 90도면 한 바퀴입니다
    .setAlpha(randPair(STAR_ALPHA_JITTER))
    .setVisible(true);
  sprite.play({key:WINDOW_FX_STAR_ANIM,startFrame:0});
  sprite.anims.timeScale=randRange(0.85,1.25);
}

function scheduleStar(delay){
  const scene=windowFxScene;
  if(!scene||!starSprites.length||windowFxMode!=="night")return;
  starTimer?.remove(false);
  starTimer=scene.time.delayedCall(delay,()=>{
    // 두 번 굴려서 한 번에 1~3개. 두 번째 굴림까지 붙으면 확 터집니다.
    twinkleStar();
    if(Math.random()<STAR_BURST_CHANCE){
      twinkleStar();
      if(Math.random()<STAR_BURST_CHANCE) twinkleStar();
    }
    scheduleStar(randPair(STAR_SPAWN_GAP));
  });
}

function stopStars(){
  starTimer?.remove(false);
  starTimer=null;
  starSprites.forEach(sprite=>{
    sprite.anims?.stop();
    sprite.setVisible(false);
  });
}


/* ------------------------------------------------------------
   9. 낮 / 밤
   ------------------------------------------------------------
   stage.js applyTimeOfDay() 가 불러 줍니다. 배경 크로스페이드와 달리
   여기는 페이드가 없습니다 — 새는 창틀 뒤에서 들어오고 별은 스스로
   밝아졌다 꺼지므로, 시간대가 바뀌는 순간에 굳이 겹쳐 둘 필요가
   없습니다. 반대쪽 연출은 그 자리에서 멈추고 치웁니다.
   ------------------------------------------------------------ */

function setWindowFxTimeOfDay(mode){
  windowFxMode=mode;
  if(!windowFxScene)return;

  if(mode==="night"){
    stopBird();
    scheduleStar(randPair(STAR_SPAWN_GAP));
  }else{
    stopStars();
    scheduleBird(randPair(BIRD_FIRST_DELAY));
  }
}
