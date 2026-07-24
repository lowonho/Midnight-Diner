"use strict";

/* ============================================================
   TEMPORARY — 실제 게임 로직 연결 시 이 파일 전체 삭제 예정
   ============================================================
   요리사가 들고 있는 물건의 "손 위치" 임시 구현 + 앵커 조정 도구

   [지우는 법]
   이 파일을 삭제하면 끝입니다. player.js 의 호출부는 전부
   typeof 검사로 감싸 놨기 때문에 파일만 없어지면 원래 동작
   (머리 위 고정 offset)으로 되돌아갑니다. player.js 를 고칠 필요 없습니다.

   [이 파일이 하는 일]
   · 방향별 손 앵커 좌표를 갖고, 접시·음식 스프라이트를 매 프레임 그 자리로 옮김
   · up(뒷모습)일 때만 물건을 요리사 뒤로 보냄
   · 좌우 반전 시 앵커 X 부호를 뒤집음
   · 눈으로 보면서 앵커를 맞추는 디버그 도구

   [이 파일이 하지 않는 일]
   · 픽업/드롭 판정 — state.carrying 이 이미 있어서 읽기만 합니다 (§6-2 분기 A)
   · 조리 시간·주문 매칭·손님 판정 같은 실제 게임 규칙
   ============================================================ */


/* ------------------------------------------------------------
   1. 손 앵커  ← 조정할 값은 여기 하나뿐입니다
   ------------------------------------------------------------
   요리사 origin(0.5, 1.0) = 발바닥 중앙에서의 오프셋. 1× 화면 픽셀 단위.
   side 는 왼쪽을 향한 값이고, 오른쪽을 볼 때는 x 부호가 자동으로 뒤집힙니다.

   [참고] 1× 셀 192×320 · 머리 최상단 y=52 · 벨트 y≈173 · 발바닥 y=320

   아래 값은 시트를 분석해 뽑은 추정치입니다.
   게임을 띄우고 IJKL 로 맞춘 뒤 O 키로 찍어서 이 표에 덮어쓰세요.
   ------------------------------------------------------------ */

const CHEF_HAND_ANCHOR = {
  down: { x:  0, y:-154 },
  up:   { x:  0, y:-154 },
  side: { x:-21, y:-154 }
};


/* ------------------------------------------------------------
   2. 디버그 키
   ------------------------------------------------------------
   C  강제 carry 켜기/끄기 (집기 근처가 아니어도 즉시 확인)
   V  들고 있는 음식 종류 순환
   I  앵커 위로     K  앵커 아래로
   J  앵커 왼쪽으로 L  앵커 오른쪽으로   (한 번 누를 때 1px)
   O  현재 앵커 4종을 콘솔에 복사 가능한 형태로 출력

   이동키(방향키/WASD)·상호작용키(E)·주문키(1~4)와 겹치지 않는 키만 골랐습니다.
   ------------------------------------------------------------ */

const chefCarryDebug = { forced:false, hud:false, foodFrame:0 };

let chefCarryKeys = null;
let chefCarryText = null;
let chefCarryFoodFrames = 1;


/* ------------------------------------------------------------
   3. 생성
   ------------------------------------------------------------ */

function createChefCarry(scene){
  chefCarryKeys=scene.input.keyboard.addKeys({
    c:Phaser.Input.Keyboard.KeyCodes.C,
    v:Phaser.Input.Keyboard.KeyCodes.V,
    i:Phaser.Input.Keyboard.KeyCodes.I,
    j:Phaser.Input.Keyboard.KeyCodes.J,
    k:Phaser.Input.Keyboard.KeyCodes.K,
    l:Phaser.Input.Keyboard.KeyCodes.L,
    o:Phaser.Input.Keyboard.KeyCodes.O
  });

  // 음식 시트가 몇 프레임인지 알아둡니다 (V 키 순환 범위)
  if(scene.textures.exists("food")) chefCarryFoodFrames=Math.max(1,scene.textures.get("food").frameTotal-1);

  chefCarryText=scene.add.text(16,16,"",{
    fontFamily:"monospace",fontSize:"22px",color:"#ffe9a8",
    backgroundColor:"#000000c0",padding:{x:10,y:8}
  }).setDepth(STAGE_DEPTH.ambient+10).setVisible(false);
}


/* ------------------------------------------------------------
   4. carry 여부
   ------------------------------------------------------------
   기존 시스템(state.carrying)을 읽기만 합니다. 새로 만들지 않습니다.
   ------------------------------------------------------------ */

function chefCarryActive(){
  return chefCarryDebug.forced || !!state.carrying;
}


/* ------------------------------------------------------------
   5. 매 프레임 동기화
   ------------------------------------------------------------
   player.js 의 syncPhaserObjects() 끝에서 호출합니다.
   접시·음식은 요리사의 자식이 아니라 별도 오브젝트입니다.
   (자식으로 붙이면 flipX 가 음식까지 뒤집습니다)
   ------------------------------------------------------------ */

function syncChefCarry(chefSprite,plate,food,facing){
  if(!chefSprite||!plate||!food)return;
  readChefCarryDebugKeys(facing);

  const carrying=chefCarryActive();
  plate.setVisible(!!carrying);
  food.setVisible(!!carrying);
  if(!carrying){ updateChefCarryText(facing); return; }   // destroy 대신 숨기기만

  const anchor=CHEF_HAND_ANCHOR[facing.dir]||CHEF_HAND_ANCHOR.down;
  const scale=chefSprite.scaleX||1;                       // 요리사 배율을 그대로 따라갑니다
  const x=chefSprite.x+(facing.flipX?-anchor.x:anchor.x)*scale;
  const y=chefSprite.y+anchor.y*scale;

  plate.setPosition(x,y);
  food.setPosition(x,y);

  // 뒷모습일 때만 몸 뒤로. 그 외에는 몸 앞.
  const behind=facing.dir==="up";
  plate.setDepth(behind?STAGE_DEPTH.player-2:STAGE_DEPTH.plate);
  food.setDepth(behind?STAGE_DEPTH.player-1:STAGE_DEPTH.food);

  // 강제 carry 중에는 실제 주문이 없으므로 디버그용 프레임을 씁니다.
  if(!state.carrying) food.setFrame(chefCarryDebug.foodFrame);

  updateChefCarryText(facing);
}


/* ------------------------------------------------------------
   6. 디버그 입력 · 화면 표시
   ------------------------------------------------------------ */

function readChefCarryDebugKeys(facing){
  if(!chefCarryKeys)return;
  const Just=Phaser.Input.Keyboard.JustDown;

  if(Just(chefCarryKeys.c)){ chefCarryDebug.forced=!chefCarryDebug.forced; chefCarryDebug.hud=true; }
  if(Just(chefCarryKeys.v)){ chefCarryDebug.foodFrame=(chefCarryDebug.foodFrame+1)%chefCarryFoodFrames; chefCarryDebug.hud=true; }

  const anchor=CHEF_HAND_ANCHOR[facing.dir];
  if(anchor){
    // 좌우 반전 상태에서도 화면에서 본 대로 움직이도록 부호를 맞춥니다
    const sign=facing.flipX?-1:1;
    if(Just(chefCarryKeys.i)){ anchor.y-=1; chefCarryDebug.hud=true; }
    if(Just(chefCarryKeys.k)){ anchor.y+=1; chefCarryDebug.hud=true; }
    if(Just(chefCarryKeys.j)){ anchor.x-=sign; chefCarryDebug.hud=true; }
    if(Just(chefCarryKeys.l)){ anchor.x+=sign; chefCarryDebug.hud=true; }
  }

  if(Just(chefCarryKeys.o)) dumpChefCarryAnchors();
}

function updateChefCarryText(facing){
  if(!chefCarryText)return;
  if(!chefCarryDebug.hud){ chefCarryText.setVisible(false); return; }

  const a=CHEF_HAND_ANCHOR[facing.dir]||{x:0,y:0};
  chefCarryText.setVisible(true).setText([
    "[임시] carry 디버그",
    `C 강제carry ${chefCarryDebug.forced?"ON":"OFF"}   V 음식 ${chefCarryDebug.foodFrame}`,
    `IJKL 앵커 1px 이동   O 콘솔 출력`,
    `${facing.dir}${facing.flipX?" (flipX)":""}   x ${a.x}   y ${a.y}`
  ].join("\n"));
}

function dumpChefCarryAnchors(){
  const row=(name)=>{
    const a=CHEF_HAND_ANCHOR[name];
    return `  ${(name+":").padEnd(6)}{ x:${String(a.x).padStart(3)}, y:${String(a.y).padStart(4)} }`;
  };
  console.log(
    "chef-carry-temp.js 의 CHEF_HAND_ANCHOR 에 덮어쓰세요:\n"+
    "const CHEF_HAND_ANCHOR = {\n"+
    ["down","up","side"].map(row).join(",\n")+"\n};\n"+
    `(오른쪽 향할 때는 side.x 부호가 자동으로 뒤집혀 x:${-CHEF_HAND_ANCHOR.side.x} 로 적용됩니다)`
  );
}
