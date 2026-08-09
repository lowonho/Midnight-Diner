"use strict";

/* ============================================================
   장식 소품 = 서비스 벨 · 메뉴 양옆 전등 · 정면 벽 장식 · 좌측벽 화분/게시판
                · 조리대 위 소품 · 밤에만 켜지는 조리 연출(김치전 · 연기)
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

/* tools/build-decoration-webp.js 가 만드는 WebP 를 씁니다 (4924KB → 624KB).
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
  prop_left_wall_planter_board:{ trim:[210, 69, 581,1363] },
  prop_fridge_top_decor:       { trim:[ 40, 40,1408, 641] },
  prop_sink_plant:             { trim:[ 40, 40, 505, 588] },
  prop_dishwasher_cat_ears:    { trim:[ 40, 40,1576, 253] },
  food_kimchi_pancake_pan:     { trim:[ 40, 40,1175, 492] }
};

/* 연기만 스프라이트 시트라 위 표에 넣지 않습니다. trim 으로 한 장을
   앉히는 방식이 아니라 프레임을 잘라 돌려야 해서, 로딩·배치를 §3-7 에서
   따로 다룹니다. 여기에 넣으면 placeDecoration 이 시트 전체를 한 장으로
   깔아 버립니다. */
const DECORATION_SHEETS = ["fx_cooking_steam_6f"];


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
     station          22   조리대 위에 올리는 소품 · 밤 조리 연출
                           → 집기 그림(20)보다 앞이라야 상판에 얹혀 보이고,
                             요리사(25)보다 뒤라야 요리사가 앞을 지나갑니다.
                             집기 이름표는 앞층 캔버스(40)라 항상 이 위입니다.
     요리사            25   (stage.js player)
     계산대 32 · POS 35     (counter.js)
     counterTop       38   계산대 상판에 올리는 소품(서비스 벨)
                           → POS(35)보다 앞, 손님 캔버스(40)보다 뒤
     야간 톤          60   화면 전체를 덮으므로 소품도 같이 어두워집니다
   ------------------------------------------------------------ */

const DECORATION_DEPTH = { wall:12, lamp:18, station:22, counterTop:38 };


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

   [가로 위치] 창 중심(x 945) 기준으로 558 씩 벌렸습니다.
   한계는 정면 벽(x 302~1610)입니다. 폭의 절반이 27 이라 등롱은
   x 360~414 / 1476~1530 을 차지합니다.
   417/1473 → 357/1533 까지 벌렸다가 30 씩 되돌린 값입니다.

   [HUD 와 겹치는 것은 허용] 상단 HUD 는 캔버스 밖 DOM 이라 항상 등 위에
   옵니다. 오른쪽 등은 우상단 스탯 칸(x 1503~)에, 왼쪽 등은 메뉴 카드가
   5장(x 392~1432)일 때 첫 장에 조금 물립니다. */
const DECORATION_LAMPS = [
  { key:"prop_menu_lamp_left",  cx: 387, top:0, h:150 },
  { key:"prop_menu_lamp_right", cx:1503, top:0, h:150 }
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
   그 사이 x 165~285 가 비어 있습니다.

   [가로] POS 옆에 12px 띄워 놓습니다. 폭이 h 를 따라가므로(36 일 때 36.2)
   cx = 158 + 12 + 폭/2 = 188 입니다. 크기(h)를 바꾸면
   cx 도 170 + 200*(h/199)/2 로 다시 잡으세요. (붙이려면 176)

   [세로] 상판 한가운데입니다. 이 자리(x 188)에서 상판 뒷변이 y 785,
   앞변이 872 라 중앙이 828 입니다. 밑동을 828 에 두었습니다.
   크기(h)를 바꿀 때는 top 을 828-h 로 같이 고쳐야 중앙이 유지됩니다.
   (예전에는 밑동 860 = 앞변 바로 앞이었습니다) */
const DECORATION_COUNTER_TOP = [
  { key:"prop_counter_service_bell", cx:188, top:792, h:36 }
];

/* 3-4. 좌측벽 화분 + 게시판 (한 장짜리 에셋)
   ------------------------------------------------------------
   게시판과 화분이 한 파일에 같이 그려져 있어서 통째로 한 번만 놓습니다.

   [기울기가 맞는 이유] 에셋의 게시판 아랫변 기울기(-0.78)가 좌측벽
   허리 몰딩 기울기(-0.785)와 거의 같습니다. 좌측벽 전용으로 그린
   그림이라 가로/세로 비율만 지키면 벽면에 그대로 눕습니다.

   [세로 위치] 좌측벽 바닥선(파란 징두리가 바닥과 만나는 선)은 실측하면
   화면 (302,600) → (128,772) 로 기울기 -0.99 입니다. 화분 상자의
   앞아래 모서리(내용 기준 가로 12% · 세로 97% 지점)가 그 선에 닿아야
   상자가 바닥에 놓인 것으로 보입니다.

   [크기를 바꿀 때] 밑변(top+h)을 855 에 두면 됩니다. 소품이 작아지면
   폭도 같이 줄어서 앞아래 모서리가 오른쪽(=바닥선이 낮은 쪽)으로
   이동하는데, 밑변을 855 로 고정하면 그 이동분까지 저절로 맞습니다.
     h 500 → top 355   (예전 값)
     h 375 → top 480   (지금 값. 모서리 (54,844) · 바닥선 845)
   밑동은 어차피 계산대(상판 뒷변 y 785)에 가려집니다.

   [게시판이 징두리를 걸치는 것] 게시판과 화분은 한 파일이라 사이 간격을
   못 바꿉니다. 화분을 바닥에 맞추면 게시판은 크림/파랑 경계선
   (y = 594 - 0.804x)에 걸칩니다. 게시판만 위로 올리고 싶으면 h 를
   키우고 top 을 855-h 로 같이 고치세요 — 화분 바닥이 고정된 채
   게시판이 따라 올라갑니다.

   [가려짐 허용] 좌측 HUD(x 28~319 · y 21~777)가 이 소품을 거의 다
   덮습니다. HUD 를 감추는 연출(컷씬·미니게임)에서 보이는 소품입니다.
   밑동은 계산대(depth 32)가 가리도록 depth 12 에 둡니다. */
const DECORATION_LEFT_WALL = [
  { key:"prop_left_wall_planter_board", cx:115, top:480, h:375 }
];

/* 3-5. 조리대 위 소품 (냉장고 위 · 싱크대 위 · 식기세척기 위)
   ------------------------------------------------------------
   여기 세 점만 top 이 아니라 **bottom**(내용 밑변)으로 적습니다.
   상판에 "놓인" 소품이라 크기를 바꿔도 밑동이 상판에 붙어 있어야
   합니다. top 으로 적으면 h 를 고칠 때마다 top 도 같이 고쳐야 하고,
   한쪽만 고치면 소품이 상판 위로 떠오르거나 상판을 뚫고 내려갑니다.
   (placeDecoration 이 bottom → top 으로 환산합니다. §5)

   [상판 실측] kitchen.js STATION_SLICES 가 만드는 줄 배치에서 뽑은 값입니다.
   집기 조각을 바꾸면 이 표도 같이 다시 재야 합니다.
     냉장고     x  322~523  상판 뒷변 y 300 · 앞변 y 334
     싱크대     x  523~688  상판 뒷변 y 399 · 개수통 뒷변 y 412
     식기세척기 x 1461~1598 상판 뒷변 y 372 · 앞변 y 399

   [냉장고 위] 고양이·주전자 둘·화분이 한 파일에 같이 그려져 있어서
   통째로 한 번만 놓습니다. 폭 167 은 냉장고(201)보다 좁아서 양옆으로
   17 씩 남습니다 — 원화가 3/4 시점이라 소품이 냉장고 폭을 꽉 채우면
   왼쪽 옆면 위로 삐져나온 것처럼 보입니다.
   ⚠️ 이 소품이 '냉장고' 이름표 자리(원래 y 259~294)와 겹칩니다.
      그래서 kitchen.js STATION_SPEC.fridge 에 labelDy 를 넣어 이름표를
      소품 위로 올려 두었습니다. 높이(h)를 키우면 그쪽도 같이 내려야 합니다.

   [싱크대 위] 개수통 두 개가 상판을 거의 다 차지해서, 남은 자리는
   상판 뒷변(399)과 개수통 뒷변(412) 사이 13px 짜리 띠뿐입니다.
   화분 밑동을 그 띠에 얹고 몸통은 뒤쪽 타일 벽을 배경으로 세웁니다.
   x 572 는 왼쪽 개수통 왼끝(556)과 첫 번째 수도꼭지(596) 사이입니다 —
   더 오른쪽으로 가면 수도꼭지를 가립니다.

   [식기세척기 위] 귀 두 짝이 한 파일 양 끝에 그려져 있어서 폭을
   식기세척기 폭(137)에 맞추면 두 귀가 알아서 좌우 모서리에 섭니다.
   밑변 384 는 상판 한가운데라 귀 밑동 가로대가 상판에 놓여 보입니다. */
const DECORATION_STATION_TOP = [
  { key:"prop_fridge_top_decor",    cx: 428, bottom:327, h: 76 },
  { key:"prop_sink_plant",          cx: 572, bottom:410, h: 46 },
  { key:"prop_dishwasher_cat_ears", cx:1529, bottom:384, h: 22 }
];

/* 3-6. 밤에만 켜지는 조리 연출 — 후라이팬 위 김치전
   ------------------------------------------------------------
   낮에는 알파 0 이고 밤(=stage.js setTimeOfDay('night'))에 떠오릅니다.
   조리 규칙과는 무관한 배경 연출입니다 — 실제 조리는 미니게임 패널에서
   하고, 여기 김치전은 영업 중인 가게처럼 보이게 하는 소품입니다.

   [자리] 후라이팬 안쪽 면 실측이 x 1037~1123 · y 406~447 입니다.
   김치전 폭 81 이면 안쪽 면(86) 안에 좌우 2~3 씩 남아, 팬 테두리가
   김치전에 먹히지 않고 한 바퀴 다 보입니다. 팬을 꽉 채우면(88) 앞쪽
   테두리 위로 반죽이 걸쳐 보였습니다.
   밑변 443 은 팬 안쪽 앞변(447)보다 4 위입니다. */
const DECORATION_NIGHT_PROPS = [
  { key:"food_kimchi_pancake_pan", cx:1080, bottom:443, h:34 }
];

/* 3-7. 밤에만 켜지는 조리 연기 (6프레임 스프라이트 시트)
   ------------------------------------------------------------
   후라이팬 · 직화구이 · 튀김기 세 곳에서 피어오릅니다.

   [시트 규격] 1962x800 을 가로로 6등분 = 한 칸 327x800.
   여섯 칸 모두 연기 밑동이 칸 안 (168, 729) 근처에 있고 위로만
   자랍니다. 그래서 밑동을 원점(origin)으로 잡아 두면 프레임이 바뀌어도
   발원점이 제자리에 있고 연기만 자랐다 줄었다 합니다.

   [크기] 가장 큰 프레임의 연기 높이가 시트 픽셀로 593 입니다.
   drawH 137 로 그리면 화면에서 약 102px 까지 올라갑니다(창문 아래를
   지나 창유리 앞까지). 더 키우면 상단 메뉴 카드 HUD 에 닿습니다.
   가로세로는 327:800 비율 그대로라야 연기가 눌리지 않습니다.

   [발원점] 음식 윗면 바로 위입니다. 실측한 자리는
     후라이팬 김치전 윗면 (1080, 415)
     직화구이 꼬치 불꽃 위 (1240, 395)
     튀김기   기름 표면   (1388, 405)

   [세 줄기를 어긋나게] 같은 애니메이션을 같은 속도로 돌리면 셋이
   한 몸처럼 부풀었다 꺼집니다. 시작 프레임과 재생 속도를 따로 줘서
   서로 어긋나게 했습니다. */
const DECORATION_STEAM_ANIM = "fx_cooking_steam";

const DECORATION_STEAM = {
  key:"fx_cooking_steam_6f",
  frameW:327, frameH:800, frames:6, frameRate:8,
  drawW:56, drawH:137,              // 327:800 비율 유지
  originX:168/327, originY:729/800, // 칸 안에서 연기 밑동의 위치
  sources:[
    { cx:1080, cy:415, startFrame:0, timeScale:1.00 },   // 후라이팬
    { cx:1240, cy:395, startFrame:2, timeScale:0.85 },   // 직화구이
    { cx:1388, cy:405, startFrame:4, timeScale:1.15 }    // 튀김기
  ]
};

// 낮↔밤 알파 전환은 stage.js 가 시간(ms)을 넘겨 줍니다. (§6)
const DECORATION_NIGHT_ALPHA = 1;


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
  return Promise.all([...Object.keys(DECORATION_ART),...DECORATION_SHEETS].map(loadDecorationImage));
}


/* ------------------------------------------------------------
   5. 배치
   ------------------------------------------------------------ */

const decorationObjects = {};

/* 내용(trim) 기준 좌표 → 캔버스 좌상단 기준 좌표.
   여백까지 같은 비율로 키운 뒤, 여백 두께만큼 위/왼쪽으로 밀어 놓습니다.

   세로는 top(내용 윗변) 또는 bottom(내용 밑변) 중 적은 쪽으로 맞춥니다.
   상판에 놓이는 소품은 bottom 이라야 크기를 바꿔도 밑동이 안 뜹니다. (§3-5) */
function placeDecoration(scene,spec,depth){
  const art=DECORATION_ART[spec.key];
  const image=decorationImages[spec.key];
  if(!art||!image)return null;

  const [trimX,trimY,trimW,trimH]=art.trim;
  const scale=spec.h/trimH;
  const top=spec.top??(spec.bottom-spec.h);

  if(!scene.textures.exists(spec.key)) scene.textures.addImage(spec.key,image);
  const object=scene.add.image(
      spec.cx-(trimX+trimW/2)*scale,   // 내용 중심을 cx 에 맞춥니다
      top-trimY*scale,                 // 내용 윗변을 top 에 맞춥니다
      spec.key)
    .setOrigin(0,0)
    .setDisplaySize(image.width*scale,image.height*scale)
    .setDepth(depth);

  decorationObjects[spec.key]=object;
  return object;
}

/* 밤에만 보이는 것들. §6 이 이 목록의 알파만 건드립니다. */
const decorationNightObjects = [];
let decorationScene = null;

/* 연기 세 줄기. 시트를 프레임으로 잘라 Phaser 애니메이션으로 돌립니다.
   원점을 연기 밑동에 두었으므로 sources 의 (cx, cy) 가 곧 발원점입니다. */
function createDecorationSteam(scene){
  const S=DECORATION_STEAM,image=decorationImages[S.key];
  if(!image)return;

  if(!scene.textures.exists(S.key))
    scene.textures.addSpriteSheet(S.key,image,{frameWidth:S.frameW,frameHeight:S.frameH});
  if(!scene.anims.exists(DECORATION_STEAM_ANIM))
    scene.anims.create({
      key:DECORATION_STEAM_ANIM,
      frames:scene.anims.generateFrameNumbers(S.key,{start:0,end:S.frames-1}),
      frameRate:S.frameRate, repeat:-1
    });

  S.sources.forEach(source=>{
    const sprite=scene.add.sprite(source.cx,source.cy,S.key)
      .setOrigin(S.originX,S.originY)
      .setDisplaySize(S.drawW,S.drawH)
      .setDepth(DECORATION_DEPTH.station)
      .setAlpha(0);
    sprite.play({key:DECORATION_STEAM_ANIM,startFrame:source.startFrame});
    sprite.anims.timeScale=source.timeScale;
    decorationNightObjects.push(sprite);
  });
}

// stage.js createStage() 끝에서 부릅니다.
function createDecoration(scene){
  decorationScene=scene;
  DECORATION_LEFT_WALL.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.wall));
  DECORATION_WALL.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.wall));
  DECORATION_LAMPS.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.lamp));
  DECORATION_STATION_TOP.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.station));
  DECORATION_COUNTER_TOP.forEach(spec=>placeDecoration(scene,spec,DECORATION_DEPTH.counterTop));

  DECORATION_NIGHT_PROPS.forEach(spec=>{
    const object=placeDecoration(scene,spec,DECORATION_DEPTH.station);
    if(object) decorationNightObjects.push(object.setAlpha(0));
  });
  createDecorationSteam(scene);
}


/* ------------------------------------------------------------
   6. 낮 / 밤
   ------------------------------------------------------------
   stage.js applyTimeOfDay() 가 배경 크로스페이드와 같은 시간으로
   불러 줍니다. 소품 쪽에서 낮밤을 판단하지 않는 이유는, 판단이 두
   군데로 갈리면 배경은 밤인데 연기만 낮인 상태가 생기기 때문입니다.

   fadeMs 0 이면 즉시 전환입니다(첫 프레임·QA 점프).
   ------------------------------------------------------------ */

function setDecorationTimeOfDay(mode,fadeMs=0){
  const alpha=mode==="night"?DECORATION_NIGHT_ALPHA:0;
  const scene=decorationScene;
  decorationNightObjects.forEach(object=>{
    scene?.tweens.killTweensOf(object);
    if(!scene||!fadeMs){ object.setAlpha(alpha); return; }
    scene.tweens.add({targets:object,alpha,duration:fadeMs,ease:"Sine.easeInOut"});
  });
}
