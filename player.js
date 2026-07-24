"use strict";

/* ============================================================
   요리사(플레이어) 캐릭터
   ------------------------------------------------------------
   담당 범위: 시작 위치 · 이동 가능 범위 · 스프라이트 크기/기준점 ·
              걷기/작업 애니메이션 · 들고 있는 접시와 음식의 위치

   담당 범위가 아님: 무엇을 조리할지, 어떤 집기가 필요한지
              → game.js / day.js / night.js

   [좌표계] 논리 좌표 1280x720.
   요리사는 프레임 캔버스가 아니라 Phaser 스프라이트라서
   화면에 놓을 때만 toView() 로 1.5배 변환합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 배치·크기
   ------------------------------------------------------------ */

// 낮/밤이 시작될 때 서 있는 자리. day.js / night.js 도 이 값을 씁니다.
const PLAYER_START = { x:620, y:448, facing:"down", speed:205 };

// 요리사가 걸어다닐 수 있는 범위.
//   bottom 486 = 카운터 바 테이블 상판(논리 y 500)보다 위.
//                이 값을 키우면 요리사가 카운터를 뚫고 내려갑니다.
//   left   235 = 왼쪽 벽·냉장고 앞까지.
const WALK_BOUNDS = { left:235, right:1030, top:410, bottom:486 };

// 스프라이트. 원본 시트는 48x64 셀이고 화면에는 66x88 로 키워 씁니다.
// anchorY 73/88 = 발끝이 아니라 발목쯤이 기준점입니다.
const PLAYER_SPRITE = { frameW:48, frameH:64, w:66, h:88, anchorX:.5, anchorY:73/88 };

// 음식을 들었을 때 머리 위에 뜨는 접시·음식.
const PLAYER_CARRY = {
  plate: { dy:-85, w:56, h:18, color:0xeee6d5 },
  food:  { dy:-90, size:36 }
};

const PLAYER_ANIM = { walkFps:8, workFps:10, rows:["down","left","right","up"] };


/* ------------------------------------------------------------
   2. Phaser 오브젝트
   ------------------------------------------------------------ */

let playerSprite = null;
let carriedPlate = null;
let carriedFood = null;
let playerKeys = null;

function createPlayer(scene){
  const start=state.player;

  playerSprite=scene.add.sprite(toView(start.x),toView(start.y),"chef",0)
    .setOrigin(PLAYER_SPRITE.anchorX,PLAYER_SPRITE.anchorY)
    .setDisplaySize(toView(PLAYER_SPRITE.w),toView(PLAYER_SPRITE.h))
    .setDepth(STAGE_DEPTH.player);

  carriedPlate=scene.add.ellipse(
      toView(start.x),toView(start.y+PLAYER_CARRY.plate.dy),
      toView(PLAYER_CARRY.plate.w),toView(PLAYER_CARRY.plate.h),PLAYER_CARRY.plate.color)
    .setDepth(STAGE_DEPTH.plate).setVisible(false);

  carriedFood=scene.add.sprite(toView(start.x),toView(start.y+PLAYER_CARRY.food.dy),"food",0)
    .setDisplaySize(toView(PLAYER_CARRY.food.size),toView(PLAYER_CARRY.food.size))
    .setDepth(STAGE_DEPTH.food).setVisible(false);

  PLAYER_ANIM.rows.forEach((direction,row)=>{
    scene.anims.create({key:`chef-walk-${direction}`,frames:scene.anims.generateFrameNumbers("chef",{start:row*4,end:row*4+3}),frameRate:PLAYER_ANIM.walkFps,repeat:-1});
    scene.anims.create({key:`chef-work-${direction}`,frames:scene.anims.generateFrameNumbers("chef",{start:(row+4)*4,end:(row+4)*4+3}),frameRate:PLAYER_ANIM.workFps,repeat:-1});
  });

  playerKeys=scene.input.keyboard.addKeys({
    up:Phaser.Input.Keyboard.KeyCodes.UP,
    down:Phaser.Input.Keyboard.KeyCodes.DOWN,
    left:Phaser.Input.Keyboard.KeyCodes.LEFT,
    right:Phaser.Input.Keyboard.KeyCodes.RIGHT,
    w:Phaser.Input.Keyboard.KeyCodes.W,
    a:Phaser.Input.Keyboard.KeyCodes.A,
    s:Phaser.Input.Keyboard.KeyCodes.S,
    d:Phaser.Input.Keyboard.KeyCodes.D
  });
}


/* ------------------------------------------------------------
   3. 이동
   ------------------------------------------------------------ */

function updatePlayer(dt){
  const p=state.player;
  if(state.mini||!["day","night"].includes(state.phase)){p.moving=false;return;}
  let vx=0,vy=0;
  if(playerKeys?.up.isDown||playerKeys?.w.isDown)vy-=1;
  if(playerKeys?.down.isDown||playerKeys?.s.isDown)vy+=1;
  if(playerKeys?.left.isDown||playerKeys?.a.isDown)vx-=1;
  if(playerKeys?.right.isDown||playerKeys?.d.isDown)vx+=1;
  if(Math.abs(state.joyX||0)>.05||Math.abs(state.joyY||0)>.05){vx=state.joyX;vy=state.joyY;}
  if(vx||vy){const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;movePlayer(vx*p.speed*dt,vy*p.speed*dt);}
  else p.moving=false;
}

function movePlayer(dx,dy){
  const p=state.player;
  p.x=clamp(p.x+dx,WALK_BOUNDS.left,WALK_BOUNDS.right);
  p.y=clamp(p.y+dy,WALK_BOUNDS.top,WALK_BOUNDS.bottom);
  p.moving=true;
  if(Math.abs(dx)>Math.abs(dy))p.facing=dx>0?"right":"left";
  else p.facing=dy>0?"down":"up";
}

// 요리사를 시작 자리로 되돌립니다. day.js / night.js 가 단계 전환 때 씁니다.
function resetPlayerPosition(){
  const p=state.player;
  p.x=PLAYER_START.x;p.y=PLAYER_START.y;p.facing=PLAYER_START.facing;p.moving=false;
}


/* ------------------------------------------------------------
   4. 화면 반영
   ------------------------------------------------------------
   매 프레임 논리 좌표를 Phaser 오브젝트 위치로 옮깁니다.
   title.js 도 이어하기 직후에 한 번 호출합니다.
   ------------------------------------------------------------ */

function syncPhaserObjects(){
  if(!playerSprite)return;
  const p=state.player,dirs={down:0,left:1,right:2,up:3};
  playerSprite.setPosition(toView(p.x),toView(p.y));
  if(state.mini) playerSprite.play(`chef-work-${p.facing}`,true);
  else if(p.moving) playerSprite.play(`chef-walk-${p.facing}`,true);
  else { playerSprite.stop();playerSprite.setFrame(dirs[p.facing]*4); }

  const carrying=state.carrying;
  carriedPlate.setVisible(!!carrying).setPosition(toView(p.x),toView(p.y+PLAYER_CARRY.plate.dy));
  carriedFood.setVisible(!!carrying).setPosition(toView(p.x),toView(p.y+PLAYER_CARRY.food.dy));
  if(carrying) carriedFood.setFrame(dishById(carrying.dishId).icon);
}
