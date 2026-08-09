"use strict";

/* ============================================================
   요리사 발밑 그림자
   ------------------------------------------------------------
   담당 범위: 요리사 발밑에 깔리는 타원 그림자의 크기·진하기·위치와
              걸을 때의 미세한 맥동

   담당 범위가 아님: 이동 · 애니메이션 선택 · 원근 배율 자체
              → player.js / chef-anims.js

   [지우는 법]
   이 파일을 삭제하면 끝입니다. player.js 의 호출부 두 줄은 typeof 로
   감싸 놨기 때문에 파일만 없어지면 그림자 없는 예전 화면으로 돌아갑니다.

   [좌표계] 이 파일의 값은 전부 VIEW 좌표(1920x1080)입니다.
   요리사 스프라이트가 이미 VIEW 좌표에 놓여 있어서 거기서 그대로 끌어옵니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 설정  ← 조정할 값은 여기 하나뿐입니다
   ------------------------------------------------------------
   width/ratio/dy/alpha 는 매 프레임 읽으므로 콘솔에서
   CHEF_SHADOW.alpha = 0.5 처럼 바로 바꿔 보면서 맞출 수 있습니다.
   (color/softness 만 예외입니다 — 그림 텍스처에 구워져서 새로고침해야 반영됩니다)

   width 96   요리사 키(CHEF_TARGET_H 233)의 약 0.41 배. 서 있는 사람의
              발밑 그림자는 어깨 폭보다 조금 넓을 때 가장 자연스럽습니다.
              120 을 넘기면 발밑이 아니라 웅덩이처럼 보입니다.
   ratio 0.3  세로/가로. 이 방은 위에서 내려다보는 각도가 얕아서
              납작할수록 바닥에 붙어 보입니다. 0.5 를 넘기면 공처럼 뜹니다.
   dy 3       발바닥선에서 그림자 중심까지. 발끝이 그림자 위쪽 절반에
              걸치게 해서 "발이 그림자를 밟고 있는" 그림을 만듭니다.
   alpha .42  낮 바닥에서 잡은 값입니다. 밤에는 화면 전체에 야간 톤(60)이
              덮이므로 이 값 그대로도 밤에 과하지 않습니다.
              0.3 으로 두면 밝은 낮 바닥에서는 있는지 없는지 모를 정도입니다.
   softness   그라데이션이 진한 채로 유지되는 반지름 비율. 낮을수록
              가장자리가 넓게 퍼져서 흐릿한 그림자가 됩니다.

   [걸을 때] 발이 땅에 닿는 순간 그림자가 좁고 진해지고, 몸이 떠오르는
   중간 프레임에서 넓고 옅어집니다. 값이 작아 보여도 캐릭터가 작아서
   0.1 만 넘어가면 그림자가 출렁이는 게 눈에 띕니다.
     grow  걸음 한 번에 넓어지는 비율
     fade  넓어질 때 같이 옅어지는 비율
     steps 애니메이션 한 사이클에 들어 있는 걸음 수 (walk 8프레임 = 2걸음)
     fadeMs 걷기 시작/멈춤에서 맥동이 들고 나는 시간(ms). 0 이면 즉시.

   [depth 19] 배경(0)보다 앞이라 바닥 위에 얹히고, 주방 집기 캔버스(20)
   보다 뒤라서 쓰레기통 같은 바닥 물건 앞에 서면 그림자가 그 뒤로 들어갑니다.
   요리사(25)보다는 당연히 뒤입니다. (레이어 표는 stage.js STAGE_DEPTH)
   ------------------------------------------------------------ */

const CHEF_SHADOW = {
  on:       true,
  depth:    19,
  width:    96,
  ratio:    0.30,
  dy:       3,
  alpha:    0.42,
  color:    "18,10,6",   // rgb. 순수 검정보다 살짝 붉은 쪽이 나무 바닥에 얹힙니다
  softness: 0.55,
  walk:     { grow:0.09, fade:0.14, steps:2, fadeMs:140 }
};

const CHEF_SHADOW_TEXTURE = "chefFootShadow";


/* ------------------------------------------------------------
   2. 그림 만들기
   ------------------------------------------------------------
   Phaser Graphics 로 타원을 그리면 테두리가 딱 떨어져서 스티커처럼
   보입니다. 방사형 그라데이션은 캔버스로만 만들 수 있어서 텍스처를
   한 장 구워 두고 매 프레임 크기만 바꿔 씁니다. (그리는 비용도 이쪽이 쌉니다)

   정사각형으로 굽고 setDisplaySize 로 납작하게 눌러 씁니다.
   원본이 원이라 눌러도 가장자리 흐림이 같은 비율로 따라옵니다.
   ------------------------------------------------------------ */

function chefShadowEnsureTexture(scene){
  if(scene.textures.exists(CHEF_SHADOW_TEXTURE))return CHEF_SHADOW_TEXTURE;

  const size=128, r=size/2;
  const texture=scene.textures.createCanvas(CHEF_SHADOW_TEXTURE,size,size);
  if(!texture)return CHEF_SHADOW_TEXTURE;

  const ctx=texture.getContext();
  const gradient=ctx.createRadialGradient(r,r,0,r,r,r);
  gradient.addColorStop(0,`rgba(${CHEF_SHADOW.color},1)`);
  gradient.addColorStop(CHEF_SHADOW.softness,`rgba(${CHEF_SHADOW.color},.85)`);
  gradient.addColorStop(1,`rgba(${CHEF_SHADOW.color},0)`);
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,size,size);
  texture.refresh();

  return CHEF_SHADOW_TEXTURE;
}


/* ------------------------------------------------------------
   3. 생성 · 매 프레임 갱신
   ------------------------------------------------------------
   player.js 의 createPlayer() / syncPhaserObjects() 가 한 줄씩 부릅니다.
   ------------------------------------------------------------ */

let chefShadowSprite = null;
let chefShadowPulse  = 0;   // 0 정지 ~ 1 걷는 중. 끊기지 않게 서서히 오갑니다
let chefShadowStep   = 0;   // -1 ~ 1. 걸음 위상 (마지막 값을 붙들고 함께 잦아듭니다)
let chefShadowLastMs = 0;

function createChefShadow(scene){
  chefShadowSprite=scene.add.image(0,0,chefShadowEnsureTexture(scene))
    .setOrigin(.5,.5)
    .setDepth(CHEF_SHADOW.depth)
    .setVisible(false);
  chefShadowPulse=0;
  chefShadowStep=0;
  chefShadowLastMs=performance.now();
}

/* 요리사 스프라이트에 그림자를 맞춥니다.
   위치·크기를 전부 스프라이트에서 끌어오므로 원근 보정과 이동이 자동으로 따라옵니다.

   [크기를 sprite.displayWidth 로 잡으면 안 됩니다]
   시트마다 캐릭터 키가 달라서 chefAnimScale 이 방향·모션별로 다른 배율을 겁니다.
   셀 폭은 192 로 같으니 displayWidth 는 모션이 바뀔 때마다 15% 씩 튑니다.
   화면상 캐릭터 키는 늘 CHEF_TARGET_H 로 고정이므로, 그 키를 기준으로 잡은
   상수(width)에 원근만 곱하는 게 맞습니다. */
function syncChefShadow(sprite){
  if(!chefShadowSprite||!sprite)return;
  if(!CHEF_SHADOW.on){chefShadowSprite.setVisible(false);return;}

  const now=performance.now();
  const dt=Math.min(.1,(now-chefShadowLastMs)/1000);   // 탭이 쉬었다 돌아와도 튀지 않게 자릅니다
  chefShadowLastMs=now;

  // 걷는 중인지는 재생 중인 애니메이션 키로 판단합니다.
  // walk / walk_carry 둘 다 잡히고, 표에 dash 가 추가돼도 아래 walk.steps 만 맞으면 됩니다.
  const animKey=sprite.anims?.currentAnim?.key||"";
  const walking=animKey.includes("walk");
  const rate=CHEF_SHADOW.walk.fadeMs>0?dt*1000/CHEF_SHADOW.walk.fadeMs:1;
  chefShadowPulse=clamp(chefShadowPulse+(walking?rate:-rate),0,1);

  // 걸음 위상은 시트 프레임에서 그대로 읽습니다. fps 를 바꿔도 저절로 맞습니다.
  // 멈춘 뒤에는 정지 시트 프레임이 들어오므로 갱신하지 않고 마지막 값을 붙듭니다.
  // (pulse 가 0 으로 내려가면서 같이 사라집니다)
  if(walking){
    const frames=sprite.anims?.currentAnim?.frames?.length||1;
    const index=(sprite.anims?.currentFrame?.index||1)-1;
    chefShadowStep=Math.sin(index/frames*Math.PI*2*CHEF_SHADOW.walk.steps);
  }
  const step=chefShadowStep*chefShadowPulse;

  const perspective=(typeof chefPerspectiveScale==="function")?chefPerspectiveScale(sprite.y):1;
  const scale=(typeof CHEF_SCALE==="number"?CHEF_SCALE:1)*perspective;
  const width=CHEF_SHADOW.width*scale*(1+CHEF_SHADOW.walk.grow*step);

  chefShadowSprite
    .setVisible(sprite.visible)
    .setPosition(sprite.x,sprite.y+CHEF_SHADOW.dy*scale)
    .setDisplaySize(width,width*CHEF_SHADOW.ratio)
    .setAlpha(CHEF_SHADOW.alpha*(1-CHEF_SHADOW.walk.fade*step))
    .setDepth(CHEF_SHADOW.depth);
}

window.CHEF_SHADOW=CHEF_SHADOW;
