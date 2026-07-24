"use strict";

/* ============================================================
   요리사 스프라이트시트 로딩 · 텍스처/애니메이션 등록
   ------------------------------------------------------------
   chef-anim-table.js 의 표를 순회해서 처리합니다.
   파일을 하나씩 손으로 load 하는 코드는 여기에 없어야 합니다.

   호출 지점 (전부 한 줄씩):
     loadChefSheets()          ← stage.js  loadStageAssets()
     registerChefTextures(s)   ← player.js createPlayer()
     registerChefAnims(s)      ← player.js createPlayer()

   game.js 는 Phaser 의 preload 를 쓰지 않고 네이티브 Image 로 받은 뒤
   create() 에서 addSpriteSheet 합니다. 그 방식을 그대로 따릅니다.
   ============================================================ */


const chefSheetImages = {};              // 표의 key → HTMLImageElement
const chefRegisteredAnims = new Set();   // 실제로 등록된 애니메이션 키


/* ------------------------------------------------------------
   1. 로딩
   ------------------------------------------------------------ */

function loadChefSheetImage(entry){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{chefSheetImages[entry.key]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`요리사 시트를 불러오지 못했습니다: ${entry.file}${CHEF_SHEET_EXT}`));
    image.src=`${CHEF_SHEET_DIR}${entry.file}${CHEF_SHEET_EXT}`;
  });
}

// game.js 의 에셋 로딩 Promise.all 에 들어갑니다. (stage.js 의 loadStageAssets 경유)
function loadChefSheets(){
  return Promise.all(CHEF_ANIM_TABLE.map(loadChefSheetImage));
}


/* ------------------------------------------------------------
   2. 텍스처 등록
   ------------------------------------------------------------ */

function registerChefTextures(scene){
  CHEF_ANIM_TABLE.forEach(entry=>{
    const image=chefSheetImages[entry.key];
    if(!image)return;

    // 표에 적은 격자와 실제 파일이 맞는지 확인합니다.
    // 새 시트를 추가했을 때 cols 를 잘못 적으면 여기서 바로 드러납니다.
    const expectedW=CHEF_FRAME.w*entry.cols;
    const expectedH=CHEF_FRAME.h*entry.dirs.length;
    if(image.width!==expectedW||image.height!==expectedH){
      console.warn(`[chef] ${entry.file} 격자 불일치: 실제 ${image.width}×${image.height} / 표 기준 ${expectedW}×${expectedH}`);
    }

    const textureKey=CHEF_TEXTURE_PREFIX+entry.key;
    if(!scene.textures.exists(textureKey)){
      scene.textures.addSpriteSheet(textureKey,image,{frameWidth:CHEF_FRAME.w,frameHeight:CHEF_FRAME.h});
    }
  });
}


/* ------------------------------------------------------------
   3. 애니메이션 등록
   ------------------------------------------------------------
   프레임 인덱스는 dirs 배열 순서와 cols 로 계산합니다.
   예) walk(cols 8, dirs down/up/side) → down 0~7 · up 8~15 · side 16~23
   ------------------------------------------------------------ */

function registerChefAnims(scene){
  CHEF_ANIM_TABLE.forEach(entry=>{
    const textureKey=CHEF_TEXTURE_PREFIX+entry.key;
    if(!scene.textures.exists(textureKey))return;

    entry.dirs.forEach((dir,row)=>{
      const animKey=`${CHEF_TEXTURE_PREFIX}${entry.key}_${dir}`;
      if(!scene.anims.exists(animKey)){
        scene.anims.create({
          key:animKey,
          frames:scene.anims.generateFrameNumbers(textureKey,{start:row*entry.cols,end:row*entry.cols+entry.cols-1}),
          frameRate:entry.fps,
          repeat:entry.repeat
        });
      }
      chefRegisteredAnims.add(animKey);
    });
  });
}


/* ------------------------------------------------------------
   4. 애니메이션 키 조립
   ------------------------------------------------------------
   carrying 여부로 if 를 12개 쓰지 않도록 베이스 키를 한 번만 조립합니다.
   chefAnimKey("walk","side",true) → "chef_walk_carry_side"

   없는 조합은 차례로 물러섭니다.
     carry 판 없음 → 맨손 판
     그 방향 없음 → 그 모션의 첫 방향
   덕분에 pay(down 전용) 처럼 단방향 모션을 표에 한 줄 추가해도
   호출부를 고칠 필요가 없습니다.
   ------------------------------------------------------------ */

function chefAnimKey(action,dir,carrying){
  const bases=carrying?[`${action}_carry`,action]:[action];
  for(const base of bases){
    const exact=`${CHEF_TEXTURE_PREFIX}${base}_${dir}`;
    if(chefRegisteredAnims.has(exact))return exact;

    const entry=CHEF_ANIM_TABLE.find(row=>row.key===base);
    if(entry){
      const fallback=`${CHEF_TEXTURE_PREFIX}${base}_${entry.dirs[0]}`;
      if(chefRegisteredAnims.has(fallback))return fallback;
    }
  }
  return null;
}
