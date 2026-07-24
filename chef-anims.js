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
const chefAnimScales = {};               // 애니메이션 키 → 크기 보정 계수 (1.0 = 보정 없음)


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

   동시에 표의 heights 로 애니메이션마다 크기 보정 계수를 미리 계산해 둡니다.
   시트마다 캐릭터 키가 달라서 방향을 바꿀 때 크기가 튀는 걸 막습니다.
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

      // 실측 키가 없으면 보정하지 않습니다. 확대는 흐려지므로 축소만 합니다.
      const measured=entry.heights?.[dir];
      chefAnimScales[animKey]=measured?Math.min(1,CHEF_TARGET_H/measured):1;
    });
  });
}


/* ------------------------------------------------------------
   3-1. 애니메이션별 최종 배율
   ------------------------------------------------------------
   원본 시트의 방향별 크기 차이를 지운 뒤 CHEF_SCALE 을 곱합니다.
   그래서 CHEF_SCALE 은 "캐릭터를 얼마나 키울까"만 뜻하게 됩니다.

   요리사 origin 이 (0.5, 1.0) = 발바닥이라 배율을 바꿔도 발이 제자리에
   붙어 있습니다. 위치 보정이 따로 필요 없습니다.
   ------------------------------------------------------------ */

function chefAnimScale(animKey){
  return CHEF_SCALE*(chefAnimScales[animKey]??1);
}


/* ------------------------------------------------------------
   3-2. 원근 보정 배율
   ------------------------------------------------------------
   화면 y(발밑)를 받아서 "앞으로 나올수록 크게" 배율을 돌려줍니다.
   설정은 chef-anim-table.js 의 CHEF_PERSPECTIVE 하나뿐입니다.

   기준 비율은 chef-walk-area.js 사다리꼴의 앞변/뒷변 폭에서 뽑습니다.
   매 프레임 다시 재기 때문에 F1 디버그로 영역을 조정하면 즉시 따라옵니다.

   t-pivot 승을 쓰는 이유: 원근은 덧셈이 아니라 곱셈이라 등비로 벌어져야
   자연스럽고, 이렇게 하면 t=pivot 인 지점이 정확히 1.0 이 됩니다.
   pivot 을 앞으로 당기면 뒤쪽은 그대로 두고 앞쪽만 더 키울 수 있습니다.

   chef-walk-area.js 를 지워도 그냥 1.0(보정 없음)로 떨어지고 죽지 않습니다.
   ------------------------------------------------------------ */

function chefPerspectiveScale(viewY){
  if(!CHEF_PERSPECTIVE.amount) return 1;
  if(typeof CHEF_WALK_AREA==="undefined"||typeof chefWalkLimitsAt!=="function") return 1;

  const span=CHEF_WALK_AREA.bottomY-CHEF_WALK_AREA.topY;
  if(!(span>0)) return 1;

  const far=chefWalkLimitsAt(CHEF_WALK_AREA.topY);      // 뒤쪽 = 좁음
  const near=chefWalkLimitsAt(CHEF_WALK_AREA.bottomY);  // 앞쪽 = 넓음
  const farW=far.right-far.left, nearW=near.right-near.left;
  if(!(farW>0)||!(nearW>0)) return 1;

  const t=Math.min(1,Math.max(0,(viewY-CHEF_WALK_AREA.topY)/span));   // 0 뒤 ~ 1 앞
  const ratio=1+(nearW/farW-1)*CHEF_PERSPECTIVE.amount;
  return Math.pow(ratio,t-(CHEF_PERSPECTIVE.pivot??0.5));
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

/* ------------------------------------------------------------
   4-1. 정지 중 눈 깜빡임 타이밍
   ------------------------------------------------------------
   player.js 가 "지금 정지 상태"일 때 chefIdleAction() 을 불러서
   idle2(평소) 인지 idle1(깜빡임) 인지 받아 갑니다.

   Phaser 의 애니메이션 완료 이벤트를 쓰지 않고 시간으로만 판단합니다.
   방향이 바뀌면 애니메이션 키가 갈아끼워져서 완료 이벤트가 씹히는데,
   시간 기준이면 그런 경우에도 깜빡임 길이가 그대로 유지됩니다.

   걷다가 멈춘 직후에는 바로 깜빡이지 않게 간격을 다시 잽니다.
   (멈추자마자 눈을 감으면 걸음이 끊긴 것처럼 보입니다)
   ------------------------------------------------------------ */

const chefIdleState = { idling:false, accentUntil:0, nextAccentAt:0 };

// 깜빡임 한 번의 길이(ms). 표의 프레임 수 ÷ fps 라서 시트가 바뀌면 같이 따라갑니다.
function chefIdleAccentMs(){
  const entry=CHEF_ANIM_TABLE.find(row=>row.key===CHEF_IDLE.accent);
  return entry?entry.cols/entry.fps*1000:1000;
}

function chefIdleGapMs(){
  return CHEF_IDLE.minGapMs+Math.random()*(CHEF_IDLE.maxGapMs-CHEF_IDLE.minGapMs);
}

function chefIdleAction(nowMs){
  const now=nowMs??performance.now();

  // 정지 상태로 막 들어옴 → 첫 깜빡임까지 간격을 새로 잡습니다
  if(!chefIdleState.idling){
    chefIdleState.idling=true;
    chefIdleState.accentUntil=0;
    chefIdleState.nextAccentAt=now+chefIdleGapMs();
  }

  if(now<chefIdleState.accentUntil) return CHEF_IDLE.accent;   // 깜빡이는 중

  if(now>=chefIdleState.nextAccentAt){                          // 깜빡일 차례
    chefIdleState.accentUntil=now+chefIdleAccentMs();
    chefIdleState.nextAccentAt=chefIdleState.accentUntil+chefIdleGapMs();
    return CHEF_IDLE.accent;
  }

  return CHEF_IDLE.main;
}

// 움직이거나 미니게임에 들어가면 player.js 가 불러 줍니다.
function chefIdleLeave(){ chefIdleState.idling=false; }


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
