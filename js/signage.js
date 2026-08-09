"use strict";

/* ============================================================
   간판 (영업 상태 입간판)
   ------------------------------------------------------------
   담당 범위: 플레이 화면 오른쪽 아래에 서 있는 영업 상태 간판

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   game.js 의 draw() 가 앞층(요리사·카운터보다 앞)에서 부릅니다.

   [상태 2종] 낮(day)에는 '영업 전', 밤(night)에는 '영업 중' 입니다.
   그 외 페이즈(타이틀·결과 등)에서는 간판을 아예 숨깁니다.

   [에셋]
     assets/UI/Common/ui_shop_status_before.webp   낮 · 영업 전
     assets/UI/Common/ui_shop_status_open.webp     밤 · 영업 중
   PNG 마스터에서 tools/build-ui-common-webp.js 가 만듭니다.

   ⚠️ 아래 OPEN_SIGN.w / h 를 고치면 빌드 스크립트의 목표 크기도 같이
      고쳐야 합니다. 이유는 §1 의 [1:1 로 그리는 이유] 를 보세요.
   ============================================================ */


/* ------------------------------------------------------------
   1. 자리와 크기
   ------------------------------------------------------------
   [x 를 1105 로 고정해 둔 이유]
   prep.js 가 이 값을 읽어서 낮 준비물을 늘어놓을 오른쪽 한계를 정합니다
   (prepObjectRange 의 signLimit). 간판 왼쪽 끝이 곧 준비물의 오른쪽 벽입니다.
   x 를 옮기면 준비물 배치가 통째로 따라 움직이니 주의하세요.

   [세로 588~698]
   위쪽(588)은 준비물 상자 아래(논리 530~572)라 준비물과 겹치지 않습니다.
   그래서 prep.js 가 signOverlap 만큼 살짝 걸쳐 놓을 수 있습니다.
   아래쪽(698)은 의자 접지선(논리 695) 바로 앞입니다. 간판 발이 의자보다
   카메라 쪽에 놓여, 가게 앞에 내놓은 입간판처럼 읽힙니다.

   [152x110]
   그림 원본 비율 1078/780 = 1.382 를 그대로 지킨 크기입니다(152/110 = 1.382).
   비율을 흐트러뜨리면 고양이 얼굴이 눌려 보입니다.

   [1:1 로 그리는 이유]
   프레임 캔버스는 화면 크기와 무관하게 항상 1920x1080 이고
   `imageSmoothingEnabled=false` 가 걸려 있습니다 (stage.js).
   그래서 그림을 화면에 그려지는 픽셀 수(152x110 x1.5 = 228x165)로 미리
   뽑아 두고 여기서는 확대도 축소도 하지 않습니다. 다른 크기로 뽑으면
   최근접 이웃으로 리샘플링되어 금테와 글자에 계단이 집니다.
   ------------------------------------------------------------ */

const OPEN_SIGN = {
  x:1105, y:588, w:152, h:110,

  // 페이즈 → 에셋 키. 여기 없는 페이즈에서는 간판을 그리지 않습니다.
  states:{ day:"before", night:"open" },

  /* 에셋이 아직 없을 때만 쓰는 예비 그림입니다.
     정식 그림이 로드되면 이 값들은 쓰이지 않습니다. (§3) */
  fallback:{
    radius:7,
    line:"#c18a3f",
    font:"bold 22px Malgun Gothic",
    textDy:44,
    day:  { bg:"#361a15", text:"#e2553c", label:"영업전" },
    night:{ bg:"#263619", text:"#b8d86d", label:"영업중" }
  }
};


/* ------------------------------------------------------------
   2. 에셋 로딩
   ------------------------------------------------------------
   game.js 의 에셋 로딩 Promise.all 에 넣어서 씁니다.

   [실패해도 통과시키는 이유] 간판 두 장 때문에 게임 전체가 로딩 실패로
   빠지면 안 됩니다. 못 읽으면 그 상태로 두고, 그리는 쪽에서 §3 의 예비
   도형으로 알아서 되돌아갑니다.
   ------------------------------------------------------------ */

const SIGNAGE_ASSET_DIR = "assets/UI/Common/";

/* ⚠️ 여기를 ".png" 로 바꿔서 마스터로 되돌릴 수는 없습니다.
   마스터 파일 이름이 `ui_shop_status_<상태>_4x.png` 라 아래 조합과 어긋나고,
   4312x3120 이라 1:1 도 아니어서 §1 대로 계단이 집니다.
   그림에 문제가 생기면 마스터를 고치고 tools/build-ui-common-webp.js 를 다시 돌리세요. */
const SIGNAGE_EXT = ".webp";

const signageImages = {};

function loadSignageImage(key){
  return new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{signageImages[key]=image;resolve(key);};
    image.onerror=()=>{console.warn(`간판 그림을 불러오지 못했습니다: ${key}`);resolve(null);};
    image.src=`${SIGNAGE_ASSET_DIR}ui_shop_status_${key}${SIGNAGE_EXT}`;
  });
}

function loadSignageAssets(){
  const keys=[...new Set(Object.values(OPEN_SIGN.states))];
  return Promise.all(keys.map(loadSignageImage));
}


/* ------------------------------------------------------------
   3. 그리기
   ------------------------------------------------------------ */

function drawSignage(){
  const S=OPEN_SIGN,key=S.states[state.phase];
  if(!key)return;

  const image=signageImages[key];
  if(image){ ctx.drawImage(image,S.x,S.y,S.w,S.h); return; }

  // 예비 도형. 그림을 못 읽었을 때만 여기까지 내려옵니다.
  drawSignageFallback(S.fallback[state.phase]);
}

function drawSignageFallback(mode){
  const S=OPEN_SIGN,F=S.fallback;
  if(!mode)return;
  ctx.fillStyle=mode.bg;roundRect(ctx,S.x,S.y,S.w,S.h,F.radius,true,false);
  ctx.strokeStyle=F.line;ctx.lineWidth=4;roundRect(ctx,S.x,S.y,S.w,S.h,F.radius,false,true);
  ctx.fillStyle=mode.text;ctx.font=F.font;ctx.textAlign="center";
  ctx.fillText(mode.label,S.x+S.w/2,S.y+F.textDy);
  ctx.textAlign="left";
}
