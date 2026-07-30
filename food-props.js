"use strict";

/* ============================================================
   음식 프롭 이미지 (메뉴 8종 x 조리 등급 3단계)
   ------------------------------------------------------------
   담당 범위: 음식 그림 파일과 메뉴 id 의 연결 · 로딩 · 텍스처 등록 ·
              캔버스/Phaser/HTML 세 군데에 같은 그림을 내주는 헬퍼

   담당 범위가 아님: 어디에 얼마나 크게 그릴지
              → customers.js(주문 말풍선) / player.js(들고 있는 접시) /
                css/hud.css(메뉴 카드)

   [예전 방식] 64x64 x6 스프라이트시트(삭제됨) 를 MENU_DATA 의 icon
   인덱스로 잘라 썼습니다. 이제 메뉴별 파일이라 인덱스가 필요 없어
   MENU_DATA 의 icon 필드도 지웠습니다. 메뉴를 추가할 때는 아래 표에
   한 줄만 넣으면 됩니다.

   [파일] assets/food/prop/<file>_<등급>.webp
   등급은 rough / normal / perfect 셋이고 메뉴 8종 모두 세 장이 다 있습니다.
   PNG 가 마스터이고 WebP 는 tools/build-food-webp.js 산출물입니다.
   문제가 생기면 FOOD_PROP_EXT 를 ".png" 로 되돌리면 원본으로 돌아갑니다.

   index.html 에서 draw-utils.js 다음, customers.js / player.js /
   game.js 보다 먼저 로드합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 메뉴 ↔ 그림 파일 표  ← 에셋을 교체·추가할 때 고칠 곳
   ------------------------------------------------------------
   id   = MENU_DATA 의 메뉴 id (game-data.js)
   file = 확장자·등급 접미사를 뺀 파일명. 실제 파일은 <file>_<등급> 입니다.
   ------------------------------------------------------------ */

const FOOD_PROPS = [
  { id:"oden",          file:"food_eomuk_tang"  },  // 어묵탕
  { id:"tofu",          file:"food_dubu_kimchi" },  // 두부김치
  { id:"kimchi",        file:"food_kimchijeon"  },  // 김치전
  { id:"skewer",        file:"food_dak_kkochi"  },  // 닭꼬치
  { id:"yakisoba",      file:"food_bokkeum_udon"},  // 볶음우동
  { id:"shrimpTempura", file:"food_saeu_twigim" },  // 새우튀김
  { id:"tteokbokki",    file:"food_tteokbokki"  },  // 떡볶이
  { id:"fries",         file:"food_gamja_twigim"}   // 감자튀김
];

const FOOD_PROP_DIR = "assets/food/prop/";
const FOOD_PROP_EXT = ".webp";

// 원본 캔버스 규격. 24개 파일 전부 같은 크기라서 그림을 바꿔도 크기가 튀지 않습니다.
// 가로형(1.74:1)이므로 예전 64x64 정사각 아이콘 자리에 그대로 넣으면 안 됩니다.
const FOOD_PROP_SIZE = { w:264, h:152 };
const FOOD_PROP_ASPECT = FOOD_PROP_SIZE.w / FOOD_PROP_SIZE.h;

/* 조리 등급 — 그림이 세 장으로 갈리는 기준입니다.
     rough    60점 이하        못 만든 요리
     normal   60점 초과 80점 이하   평범한 요리
     perfect  80점 초과        잘 만든 요리
   점수가 없는 자리(메뉴판 카드·손님 주문 말풍선)는 아직 조리 전이라
   FOOD_GRADE_DEFAULT 를 씁니다. */
const FOOD_GRADES = ["rough","normal","perfect"];
const FOOD_GRADE_MAX = { rough:60, normal:80 };   // 이 점수까지가 그 등급
const FOOD_GRADE_DEFAULT = "normal";

// Phaser 텍스처 키 접두사. 다른 에셋 키와 겹치지 않게만 하면 됩니다.
const FOOD_PROP_TEXTURE_PREFIX = "foodProp_";


/* ------------------------------------------------------------
   2. 조회
   ------------------------------------------------------------ */

const foodPropImages = {};   // 텍스처 키 → HTMLImageElement

function foodPropEntry(dishId){
  return FOOD_PROPS.find(prop=>prop.id===dishId)||null;
}

// 조리 점수 → 등급. 점수가 없으면(주문 표시 등) 기본 등급입니다.
function foodPropGrade(score){
  if(!Number.isFinite(score))return FOOD_GRADE_DEFAULT;
  if(score<=FOOD_GRADE_MAX.rough)return "rough";
  if(score<=FOOD_GRADE_MAX.normal)return "normal";
  return "perfect";
}

// 확장자 뺀 파일명. 모르는 등급이 들어오면 조용히 기본 등급으로 떨어집니다.
function foodPropFile(dishId,grade=FOOD_GRADE_DEFAULT){
  const entry=foodPropEntry(dishId);
  if(!entry)return null;
  return `${entry.file}_${FOOD_GRADES.includes(grade)?grade:FOOD_GRADE_DEFAULT}`;
}

function foodPropTextureKey(dishId,grade=FOOD_GRADE_DEFAULT){
  const file=foodPropFile(dishId,grade);
  return file?FOOD_PROP_TEXTURE_PREFIX+file:null;
}

function foodPropImage(dishId,grade=FOOD_GRADE_DEFAULT){
  const key=foodPropTextureKey(dishId,grade);
  return key?foodPropImages[key]||null:null;
}

// HTML/CSS 에서 쓸 경로. 메뉴 카드(game.js buildMenuCards)가 씁니다.
function foodPropUrl(dishId,grade=FOOD_GRADE_DEFAULT){
  const file=foodPropFile(dishId,grade);
  return file?`${FOOD_PROP_DIR}${file}${FOOD_PROP_EXT}`:null;
}


/* ------------------------------------------------------------
   3. 로딩 · 텍스처 등록
   ------------------------------------------------------------ */

// 메뉴 8종 x 등급 3장 = 24장을 전부 펼친 목록.
function foodPropVariants(){
  return FOOD_PROPS.flatMap(entry=>FOOD_GRADES.map(grade=>`${entry.file}_${grade}`));
}

function loadFoodPropImage(file){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{foodPropImages[FOOD_PROP_TEXTURE_PREFIX+file]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`음식 이미지를 불러오지 못했습니다: ${file}${FOOD_PROP_EXT}`));
    image.src=`${FOOD_PROP_DIR}${file}${FOOD_PROP_EXT}`;
  });
}

// game.js 의 에셋 로딩 Promise.all 에 넣어서 씁니다. 연출 시트도 같이 받습니다.
function loadFoodPropAssets(){
  return Promise.all([
    ...foodPropVariants().map(loadFoodPropImage),
    ...Object.keys(FOOD_FX).map(loadFoodFxImage)
  ]);
}

// Phaser 씬 생성 시 한 번. 요리사가 들고 있는 음식 스프라이트가 이 텍스처를 씁니다.
function registerFoodPropTextures(scene){
  Object.entries(foodPropImages).forEach(([key,image])=>{
    if(!scene.textures.exists(key))scene.textures.addImage(key,image);
  });
  registerFoodFxTextures(scene);
}


/* ------------------------------------------------------------
   4. 그리기 헬퍼
   ------------------------------------------------------------ */

/* 프레임 캔버스용. (centerX, centerY) 를 중심으로 maxW x maxH 안에
   비율을 유지한 채 최대 크기로 넣습니다. 그림이 가로형이라
   보통 maxW 가 먼저 꽉 찹니다. 좌표는 논리 좌표(1280x720)입니다. */
function drawFoodProp(dishId,centerX,centerY,maxW,maxH,grade=FOOD_GRADE_DEFAULT){
  const image=foodPropImage(dishId,grade);
  if(!image){
    // 아직 로딩 전이거나 표에 없는 메뉴. 예전 아이콘과 같은 자리표시 원입니다.
    const r=Math.min(maxW,maxH)*.35;
    ctx.fillStyle="#d69c4b";ctx.beginPath();ctx.arc(centerX,centerY,r,0,Math.PI*2);ctx.fill();
    return;
  }
  const scale=Math.min(maxW/image.width,maxH/image.height);
  const w=image.width*scale,h=image.height*scale;
  ctx.drawImage(image,centerX-w/2,centerY-h/2,w,h);
}

/* Phaser 스프라이트용. 텍스처만 바꿉니다. 변형 24종이 모두 같은 원본
   크기라서 setDisplaySize 로 한 번 잡아둔 크기는 그대로 유지됩니다.
   (크기는 player.js 의 PLAYER_CARRY.food 가 정합니다) */
function setFoodPropTexture(sprite,dishId,grade=FOOD_GRADE_DEFAULT){
  if(!sprite)return sprite;
  const key=foodPropTextureKey(dishId,grade);
  if(key&&sprite.texture?.key!==key&&sprite.scene?.textures.exists(key))sprite.setTexture(key);
  return sprite;
}

// 가로 폭만 주면 비율에 맞는 세로를 계산해 크기를 잡습니다.
function sizeFoodPropSprite(sprite,width){
  return sprite?sprite.setDisplaySize(width,width/FOOD_PROP_ASPECT):sprite;
}


/* ------------------------------------------------------------
   5. 연출 스프라이트시트 (김 · 반짝임)
   ------------------------------------------------------------
   가로 한 줄 배열 시트입니다. 프레임 크기는 적지 않고 이미지 폭을
   frames 로 나눠 씁니다 — 에셋을 다른 해상도로 다시 뽑아도 그대로 됩니다.

     steam    8프레임  요리사가 음식을 들고 있는 동안 피어오릅니다.
     sparkle  6프레임  프랍 캔버스(264x152)와 규격이 같습니다. 예전에는 음식과
                       같은 사각형으로 덮었지만, 지금은 음식 위쪽 중앙에
                       작게 띄웁니다. (위치·크기는 player.js PLAYER_CARRY.food.sparkle)

   [반짝임을 쓰는 곳] 요리사 손 (player.js) 한 군데뿐입니다.
   메뉴판 카드와 손님 주문 말풍선에서는 빼서 화면이 덜 어지럽게 했습니다.
   ------------------------------------------------------------ */

const FOOD_FX_DIR = "assets/food/";

/* blend:"ADD" = 흰 김이 배경 위로 은은하게 빛나게. 그냥 겹치면 원본 알파가
   낮아서 축소했을 때 거의 안 보입니다. (Canvas 렌더러에서는 'lighter')
   반짝임은 별이 이미 불투명해서 기본 합성 그대로 씁니다. */
const FOOD_FX = {
  steam:   { file:"fx_steam_loop",      frames:8, fps:10, key:"foodFx_steam", blend:"ADD" },
  sparkle: { file:"fx_perfect_sparkle", frames:6, fps:8,  key:"foodFx_sparkle" }
};

const foodFxImages = {};   // 이름 → HTMLImageElement

function loadFoodFxImage(name){
  const fx=FOOD_FX[name];
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{foodFxImages[name]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`음식 연출 시트를 불러오지 못했습니다: ${fx.file}${FOOD_PROP_EXT}`));
    image.src=`${FOOD_FX_DIR}${fx.file}${FOOD_PROP_EXT}`;
  });
}

// HTML/CSS 에서 쓸 경로. 지금은 쓰는 곳이 없고, DOM 에 연출을 붙일 때를 위한 헬퍼입니다.
function foodFxUrl(name){
  const fx=FOOD_FX[name];
  return fx?`${FOOD_FX_DIR}${fx.file}${FOOD_PROP_EXT}`:null;
}

// 지금 시각의 프레임 번호. 어디서 그리든 같은 박자로 돕니다.
function foodFxFrame(name){
  const fx=FOOD_FX[name];
  return fx?Math.floor(performance.now()/1000*fx.fps)%fx.frames:0;
}

/* 프레임 캔버스용. drawFoodProp 과 같은 (centerX, centerY, maxW, maxH) 를 주면
   같은 자리에 겹칩니다. 반짝임 시트는 프랍과 비율이 같아 정확히 포개집니다. */
function drawFoodFx(name,centerX,centerY,maxW,maxH){
  const image=foodFxImages[name];
  const fx=FOOD_FX[name];
  if(!image||!fx)return;
  const fw=image.width/fx.frames,fh=image.height;
  const scale=Math.min(maxW/fw,maxH/fh);
  const w=fw*scale,h=fh*scale;
  ctx.drawImage(image,foodFxFrame(name)*fw,0,fw,fh,centerX-w/2,centerY-h/2,w,h);
}

// Phaser 스프라이트시트 + 반복 애니메이션 등록. registerFoodPropTextures 가 부릅니다.
function registerFoodFxTextures(scene){
  Object.entries(FOOD_FX).forEach(([name,fx])=>{
    const image=foodFxImages[name];
    if(!image)return;
    if(!scene.textures.exists(fx.key))
      scene.textures.addSpriteSheet(fx.key,image,{frameWidth:image.width/fx.frames,frameHeight:image.height});
    if(!scene.anims.exists(fx.key))
      scene.anims.create({
        key:fx.key,
        frames:scene.anims.generateFrameNumbers(fx.key,{start:0,end:fx.frames-1}),
        frameRate:fx.fps,
        repeat:-1
      });
  });
}

// 연출 스프라이트 하나를 만들어 재생까지 걸어 둡니다. (숨겨진 채로 계속 돕니다)
function createFoodFxSprite(scene,name,depth){
  const fx=FOOD_FX[name];
  if(!fx||!scene.textures.exists(fx.key))return null;
  const sprite=scene.add.sprite(0,0,fx.key,0).setDepth(depth).setVisible(false);
  if(fx.blend&&Phaser.BlendModes[fx.blend]!=null)sprite.setBlendMode(Phaser.BlendModes[fx.blend]);
  if(scene.anims.exists(fx.key))sprite.play(fx.key);
  return sprite;
}
