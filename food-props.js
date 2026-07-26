"use strict";

/* ============================================================
   음식 프롭 이미지 (메뉴 8종 + 완벽 조리 변형)
   ------------------------------------------------------------
   담당 범위: 음식 그림 파일과 메뉴 id 의 연결 · 로딩 · 텍스처 등록 ·
              캔버스/Phaser/HTML 세 군데에 같은 그림을 내주는 헬퍼

   담당 범위가 아님: 어디에 얼마나 크게 그릴지
              → customers.js(주문 말풍선) / player.js(들고 있는 접시) /
                css/hud.css(메뉴 카드)

   [예전 방식] assets/food_sheet.png (64x64 x6 스프라이트시트) 를
   MENU_DATA 의 icon 인덱스로 잘라 썼습니다. 이제 메뉴별 단일 파일이라
   icon 인덱스는 쓰지 않습니다. (MENU_DATA 의 icon 필드는 남아 있지만
   참조하는 곳이 없습니다. 새 코드에서 쓰지 마세요)

   [파일] assets/food/prop/<file>.webp
   PNG 가 마스터이고 WebP 는 tools/build-food-webp.js 산출물입니다.
   문제가 생기면 FOOD_PROP_EXT 를 ".png" 로 되돌리면 원본으로 돌아갑니다.

   index.html 에서 draw-utils.js 다음, customers.js / player.js /
   game.js 보다 먼저 로드합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 메뉴 ↔ 그림 파일 표  ← 에셋을 교체·추가할 때 고칠 곳
   ------------------------------------------------------------
   id      = MENU_DATA 의 메뉴 id (game-data.js)
   file    = 확장자 뺀 파일명
   perfect = <file>_perfect 파일이 같이 있는 메뉴. 조리 점수가
             FOOD_PERFECT_SCORE 이상일 때 그 그림으로 바뀝니다.
             파일이 없는 메뉴는 점수와 무관하게 기본 그림을 씁니다.
   ------------------------------------------------------------ */

const FOOD_PROPS = [
  { id:"oden",          file:"food_eomuk_tang"                 },  // 어묵탕
  { id:"tofu",          file:"food_dubu_kimchi"                },  // 두부김치
  { id:"kimchi",        file:"food_kimchijeon"                 },  // 김치전
  { id:"skewer",        file:"food_dak_kkochi"                 },  // 닭꼬치
  { id:"yakisoba",      file:"food_bokkeum_udon", perfect:true },  // 볶음우동
  { id:"shrimpTempura", file:"food_saeu_twigim"                },  // 새우튀김
  { id:"tteokbokki",    file:"food_tteokbokki",   perfect:true },  // 떡볶이
  { id:"fries",         file:"food_gamja_twigim"               }   // 감자튀김
];

const FOOD_PROP_DIR = "assets/food/prop/";
const FOOD_PROP_EXT = ".webp";

// 원본 캔버스 규격. 10개 파일 전부 같은 크기라서 그림을 바꿔도 크기가 튀지 않습니다.
// 가로형(1.74:1)이므로 예전 64x64 정사각 아이콘 자리에 그대로 넣으면 안 됩니다.
const FOOD_PROP_SIZE = { w:264, h:152 };
const FOOD_PROP_ASPECT = FOOD_PROP_SIZE.w / FOOD_PROP_SIZE.h;

// 완벽 조리 그림으로 바뀌는 점수. game.js finishMini() 의 "완벽해요!" 기준과 같은 값입니다.
const FOOD_PERFECT_SCORE = 90;

// Phaser 텍스처 키 접두사. 다른 에셋 키와 겹치지 않게만 하면 됩니다.
const FOOD_PROP_TEXTURE_PREFIX = "foodProp_";


/* ------------------------------------------------------------
   2. 조회
   ------------------------------------------------------------ */

const foodPropImages = {};   // 텍스처 키 → HTMLImageElement

function foodPropEntry(dishId){
  return FOOD_PROPS.find(prop=>prop.id===dishId)||null;
}

// 조리 점수 → 완벽 조리 그림을 쓸지. 점수가 없으면(주문 표시 등) false 입니다.
function foodPropIsPerfect(score){
  return Number.isFinite(score)&&score>=FOOD_PERFECT_SCORE;
}

// 확장자 뺀 파일명. perfect 파일이 없는 메뉴는 조용히 기본 그림으로 떨어집니다.
function foodPropFile(dishId,perfect=false){
  const entry=foodPropEntry(dishId);
  if(!entry)return null;
  return (perfect&&entry.perfect)?`${entry.file}_perfect`:entry.file;
}

function foodPropTextureKey(dishId,perfect=false){
  const file=foodPropFile(dishId,perfect);
  return file?FOOD_PROP_TEXTURE_PREFIX+file:null;
}

function foodPropImage(dishId,perfect=false){
  const key=foodPropTextureKey(dishId,perfect);
  return key?foodPropImages[key]||null:null;
}

// HTML/CSS 에서 쓸 경로. 메뉴 카드(game.js buildMenuCards)가 씁니다.
function foodPropUrl(dishId,perfect=false){
  const file=foodPropFile(dishId,perfect);
  return file?`${FOOD_PROP_DIR}${file}${FOOD_PROP_EXT}`:null;
}


/* ------------------------------------------------------------
   3. 로딩 · 텍스처 등록
   ------------------------------------------------------------ */

// 기본 그림 + perfect 그림을 전부 펼친 목록.
function foodPropVariants(){
  const list=[];
  FOOD_PROPS.forEach(entry=>{
    list.push(entry.file);
    if(entry.perfect)list.push(`${entry.file}_perfect`);
  });
  return list;
}

function loadFoodPropImage(file){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{foodPropImages[FOOD_PROP_TEXTURE_PREFIX+file]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`음식 이미지를 불러오지 못했습니다: ${file}${FOOD_PROP_EXT}`));
    image.src=`${FOOD_PROP_DIR}${file}${FOOD_PROP_EXT}`;
  });
}

// game.js 의 에셋 로딩 Promise.all 에 넣어서 씁니다.
function loadFoodPropAssets(){
  return Promise.all(foodPropVariants().map(loadFoodPropImage));
}

// Phaser 씬 생성 시 한 번. 요리사가 들고 있는 음식 스프라이트가 이 텍스처를 씁니다.
function registerFoodPropTextures(scene){
  Object.entries(foodPropImages).forEach(([key,image])=>{
    if(!scene.textures.exists(key))scene.textures.addImage(key,image);
  });
}


/* ------------------------------------------------------------
   4. 그리기 헬퍼
   ------------------------------------------------------------ */

/* 프레임 캔버스용. (centerX, centerY) 를 중심으로 maxW x maxH 안에
   비율을 유지한 채 최대 크기로 넣습니다. 그림이 가로형이라
   보통 maxW 가 먼저 꽉 찹니다. 좌표는 논리 좌표(1280x720)입니다. */
function drawFoodProp(dishId,centerX,centerY,maxW,maxH,perfect=false){
  const image=foodPropImage(dishId,perfect);
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

/* Phaser 스프라이트용. 텍스처만 바꿉니다. 변형 10종이 모두 같은 원본
   크기라서 setDisplaySize 로 한 번 잡아둔 크기는 그대로 유지됩니다.
   (크기는 player.js 의 PLAYER_CARRY.food 가 정합니다) */
function setFoodPropTexture(sprite,dishId,perfect=false){
  if(!sprite)return sprite;
  const key=foodPropTextureKey(dishId,perfect);
  if(key&&sprite.texture?.key!==key&&sprite.scene?.textures.exists(key))sprite.setTexture(key);
  return sprite;
}

// 가로 폭만 주면 비율에 맞는 세로를 계산해 크기를 잡습니다.
function sizeFoodPropSprite(sprite,width){
  return sprite?sprite.setDisplaySize(width,width/FOOD_PROP_ASPECT):sprite;
}
