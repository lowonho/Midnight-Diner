"use strict";

/* ============================================================
   장식 소품 = 서비스 벨 · 메뉴 양옆 전등 · 정면 벽 장식 · 좌측벽 화분/게시판
   ------------------------------------------------------------
   담당 범위: assets/bg/decoration/ 에 들어오는 "게임 규칙과 무관한"
              배경 소품의 배치값 한 벌.

   담당 범위가 아님: 게임 규칙, 집기 동작, 손님, 미니게임
              → 그쪽은 game.js / kitchen.js / counter.js

   [의존 방향] stage.js → decoration.js 단방향.
   stage.js 의 loadStageAssets() / createStage() 끝에서 두 함수만 부릅니다.
     loadDecorationAssets()     에셋 로딩 (Promise)
     createDecoration(scene)    오브젝트 생성
   game.js 를 비롯한 기능 파일은 이 파일을 몰라도 됩니다.
   index.html 에서 stage.js 보다 먼저 로드되어야 합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 좌표를 "그림 내용" 기준으로 적는 이유
   ------------------------------------------------------------
   납품 PNG 는 전부 가장자리에 투명 여백이 있습니다(대개 16~32px).
   캔버스 왼쪽 위를 기준으로 좌표를 적으면 여백 두께가 다른 소품끼리
   높이·중심이 안 맞아서, 벽에 붙일 때마다 눈으로 다시 맞춰야 합니다.

   그래서 배치표는 **불투명 영역(trim)** 기준으로 적습니다.
     cx  내용의 가로 중심,  top 내용의 윗변,  h 내용의 높이(VIEW px)
   폭은 원본 비율로 자동 계산합니다.

   trim 값은 알파 > 16 인 픽셀의 경계 상자를 실측한 것입니다.
   에셋을 다시 받아 여백이 바뀌면 이 표의 trim 만 다시 재면 됩니다.
     npm run build:decoration      맨 아래에 실측값을 같이 찍어 줍니다
   ------------------------------------------------------------ */

const DECORATION_ASSET_DIR = "assets/bg/decoration/";

/* tools/build-decoration-webp.js 가 만드는 WebP 를 씁니다 (1688KB → 330KB).
   PNG 가 마스터이므로, 뭔가 이상하면 이 한 줄만 ".png" 로 되돌리면
   원본으로 돌아갑니다. 에셋을 새로 받으면 npm run build:decoration 을
   다시 돌리세요 — 안 돌리면 옛 WebP 가 그대로 화면에 남습니다. */
const DECORATION_EXT = ".webp";

// key = 파일명(확장자 제외) = Phaser 텍스처 키
// trim = [x, y, w, h] 원본 픽셀 기준 불투명 영역
const DECORATION_ART = {
  prop_counter_service_bell:   { trim:[ 16, 16, 200, 199] },
  prop_menu_lamp_left:         { trim:[ 32, 32, 228, 640] },
  prop_menu_lamp_right:        { trim:[ 32, 32, 232, 640] },
  prop_wall_decor_cat_face:    { trim:[ 24, 24, 400, 340] },
  prop_wall_decor_chef_cat:    { trim:[ 24, 24, 420, 357] },
  prop_wall_decor_flower:      { trim:[ 16, 16, 160, 160] },
  prop_wall_decor_heart:       { trim:[ 16, 16, 200, 178] },
  prop_wall_decor_paw:         { trim:[ 16, 16, 200, 177] },
  prop_left_wall_planter_board:{ trim:[210, 69, 581,1363] }
};


/* ------------------------------------------------------------
   2. 레이어 순서
   ------------------------------------------------------------
   stage.js STAGE_DEPTH 와 counter.js COUNTER_DEPTH 사이에 끼웁니다.

     배경 컨테이너      0   벽 · 창 · 바닥 (stage.js)
     wall             12   정면 벽 장식 · 좌측벽 화분/게시판
                           → 바닥보다 앞, 집기·계산대보다 뒤라서
                             화분 밑동이 계산대 뒤로 자연스럽게 들어갑니다
     lamp             18   천장 전등. 벽보다 앞, 집기(20)보다 뒤
     주방 집기 캔버스   20   (stage.js backOverlay)
     계산대 32 · POS 35     (counter.js)
     counterTop       38   계산대 상판에 올리는 소품(서비스 벨)
                           → POS(35)보다 앞, 손님 캔버스(40)보다 뒤
     야간 톤          60   화면 전체를 덮으므로 소품도 같이 어두워집니다
   ------------------------------------------------------------ */

const DECORATION_DEPTH = { wall:12, lamp:18, counterTop:38 };


/* ------------------------------------------------------------
   3. 배치표 (VIEW 1920x1080 · 내용 기준)
   ------------------------------------------------------------
   [벽 실측] 정면 벽은 x 302~1610 이고 창문이 x 464~1426 · y 130~345 를
   차지합니다. 천장 몰딩이 y 0~25, 허리 몰딩이 y 324~345 입니다.
   그래서 장식을 붙일 수 있는 "빈 벽"은 사실상 네 군데뿐입니다.

     창 왼쪽   x 307~463 , y  25~210   (아래는 냉장고 이름표 · 냉장고 위 소품)
     창 오른쪽 x 1435~1605, y  25~320   (아래는 허리 몰딩 · 식기세척기)
     창 위     x 464~1426, y  25~128
     창 아래   x 464~1426, y 348~383   (집기 윗변이 386, 이름표가 374~405)

   창 위/아래는 상단 HUD 메뉴 카드(x 336~1489 · y 37~157)와 집기 이름표가
   지나가는 자리라 큰 장식은 못 놓습니다. 그래서 큰 장식 두 점은 창 좌우
   기둥에 세우고, 작은 것 두 점만 창 위 양 끝(카드 4장일 때 x 497~1327 은
   비어 있음)에 붙였습니다.
   ------------------------------------------------------------ */

/* 3-1. 메뉴 양옆 전등
   ------------------------------------------------------------
   천장(y 0)에서 사슬로 내려옵니다. 정확히 창 중심(x 945) 기준 좌우 대칭입니다.

   [길이 150 인 이유] 더 늘리면 왼쪽 등이 '냉장고' 이름표(y 210~)와
   냉장고 위 주전자(y 241~)에 닿습니다. 두 등의 길이는 같아야 하므로
   짧은 쪽(왼쪽)에 맞췄습니다.

   [가로 위치] 우상단 스탯 칸이 x 1503 에서 시작합니다. 오른쪽 등을
   그보다 오른쪽에 두면 등롱 몸통 오른쪽이 판에 잘려서 반쪽만 보입니다
   (1505 로 놓았다가 되돌린 값입니다). 폭의 절반이 27 이므로 오른쪽
   한계가 1473 이고, 창 중심(x 945) 대칭이라 왼쪽은 417 입니다.

   [가려짐 허용] 상단 HUD 는 캔버스 밖 DOM 이라 항상 등 위에 옵니다.
   메뉴 카드가 5장(x 392~1432)까지 늘면 왼쪽 등이 카드 뒤로 들어갑니다.
   4장 이하면 카드가 x 497~1327 이라 양쪽 다 그대로 보입니다. */
const DECORATION_LAMPS = [
  { key:"prop_menu_lamp_left",  cx: 417, top:0, h:150 },
  { key:"prop_menu_lamp_right", cx:1473, top:0, h:150 }
];

/* 3-2. 정면 벽 장식 (좌우 벽에는 붙이지 않습니다)
   ------------------------------------------------------------
   창 좌우 기둥은 폭이 156 / 170 밖에 안 돼서 전등 아래로 쌓아 올립니다.
   창 위 두 점은 창틀 양 끝에 맞춰 좌우 대칭(x 490 / 1400)입니다. */
const DECORATION_WALL = [
  // 창 왼쪽 기둥 — 전등(~150) 아래. x 393 부터 '냉장고' 이름표가 있어 왼쪽으로 붙였습니다.
  { key:"prop_wall_decor_cat_face", cx: 360, top:168, h: 42 },

  // 창 오른쪽 기둥 — 전등 아래로 두 점. 허리 몰딩(y 324)을 넘지 않게 잡았습니다.
  { key:"prop_wall_decor_chef_cat", cx:1505, top:180, h: 76 },
  { key:"prop_wall_decor_heart",    cx:1505, top:268, h: 31 },

  // 창 위 — 창틀 양 끝. 메뉴 카드 4장(x 497~1327)일 때 양옆으로 비어 있는 자리입니다.
  { key:"prop_wall_decor_paw",      cx: 490, top: 58, h: 34 },
  { key:"prop_wall_decor_flower",   cx:1400, top: 58, h: 33 }
];

/* 3-3. 계산대 옆 서비스 벨
   ------------------------------------------------------------
   계산대 나무 상판 실측: x 0~320 · y 785~872 (앞쪽으로 기운 사다리꼴).
   POS 세트가 x 24~158 을 쓰고, x 291 부터 철판이 시작합니다.
   그 사이 x 165~285 가 비어 있어서 앞쪽 모서리에 살짝 붙여 놓습니다.

   [세로] 밑동을 y 860 에 고정해 놓았습니다. 상판 앞변이 이 자리에서
   872 라 12px 여유가 남습니다. 크기(h)를 바꿀 때는 top 을 860-h 로
   같이 고쳐야 벨이 상판에서 뜨거나 앞변을 넘지 않습니다. */
const DECORATION_COUNTER_TOP = [
  { key:"prop_counter_service_bell", cx:228, top:824, h:36 }
];

/* 3-4. 좌측벽 화분 + 게시판 (한 장짜리 에셋)
   ------------------------------------------------------------
   게시판과 화분이 한 파일에 같이 그려져 있어서 통째로 한 번만 놓습니다.

   [기울기가 맞는 이유] 에셋의 게시판 아랫변 기울기(-0.78)가 좌측벽
   허리 몰딩 기울기(-0.785)와 거의 같습니다. 좌측벽 전용으로 그린
   그림이라 가로/세로 비율만 지키면 벽면에 그대로 눕습니다.

   [세로 위치] 좌측벽 바닥선(파란 징두리가 바닥과 만나는 선)은 실측하면
   화면 (302,600) → (128,772) 로 기울기 -0.94 입니다. 화분 상자의
   앞아래 모서리(내용 기준 가로 12% · 세로 97% 지점)가 그 선에 닿는
   자리는 top 400 인데, 거기서는 상자가 계산대 상판 뒷변(y 785)에
   통째로 먹혀 잎사귀만 남습니다. 45 올린 355 가 상자 윗단 40px 정도가
   계산대 위로 보이는 자리입니다. 밑동은 어차피 계산대에 가려지므로
   바닥선에 정확히 닿을 필요가 없습니다.

   [게시판이 징두리를 걸치는 것] 게시판과 화분은 한 파일이라 사이 간격을
   못 바꿉니다. 화분을 바닥에 맞추면 게시판은 크림/파랑 경계선
   (y = 594 - 0.804x)에 걸칩니다. 게시판만 위로 올리고 싶으면 h 를
   키우세요 — 화분 바닥이 고정된 채 게시판이 따라 올라갑니다.

   [가려짐 허용] 좌측 HUD(x 28~319 · y 21~777)가 이 소품을 거의 다
   덮습니다. HUD 를 감추는 연출(컷씬·미니게임)에서 보이는 소품입니다.
   밑동은 계산대(depth 32)가 가리도록 depth 12 에 둡니다. */
const DECORATION_LEFT_WALL = [
  { key:"prop_left_wall_planter_board", cx:115, top:355, h:500 }
];


/* ------------------------------------------------------------
   4. 에셋 로딩
   ------------------------------------------------------------ */

const decorationImages = {};

function loadDecorationImage(key){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{decorationImages[key]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`장식 이미지를 불러오지 못했습니다: ${key}`));
    image.src=`${DECORATION_ASSET_DIR}${key}${DECORATION_EXT}`;
  });
}

// stage.js loadStageAssets() 에서 부릅니다.
function loadDecorationAssets(){
  return Promise.all(Object.keys(DECORATION_ART).map(loadDecorationImage));
}


/* ------------------------------------------------------------
   5. 배치
   ------------------------------------------------------------ */

const decorationObjects = {};

/* 내용(trim) 기준 좌표 → 캔버스 좌상단 기준 좌표.
   여백까지 같은 비율로 키운 뒤, 여백 두께만큼 위/왼쪽으로 밀어 놓습니다. */
function placeDecoration(scene,spec,depth){
  const art=DECORATION_ART[spec.key];
  const image=decorationImages[spec.key];
  if(!art||!image)return null;

  const [trimX,trimY,trimW,trimH]=art.trim;
  const scale=spec.h/trimH;

  if(!scene.textures.exists(spec.key)) scene.textures.addImage(spec.key,image);
  const object=scene.add.image(
      spec.cx-(trimX+trimW/2)*scale,   // 내용 중심을 cx 에 맞춥니다
      spec.top-trimY*scale,            // 내용 윗변을 top 에 맞춥니다
      spec.key)
    .setOrigin(0,0)
    .setDisplaySize(image.width*scale,image.height*scale)
    .setDepth(depth);

  decorationObjects[spec.key]=object;
  return object;
}

// stage.js createStage() 끝에서 부릅니다.
function createDecoration(scene){
  DECORATION_LEFT_WALL.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.wall));
  DECORATION_WALL.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.wall));
  DECORATION_LAMPS.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.lamp));
  DECORATION_COUNTER_TOP.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.counterTop));
}
