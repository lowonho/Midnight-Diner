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
   0. 요리사 전용 파일 로드
   ------------------------------------------------------------
   index.html 을 수정하지 않기로 해서 <script> 태그를 여기서 넣습니다.
   document.write 는 문서 파싱 중에만 순서가 보장되므로 이 파일 최상단에
   있어야 하고, 여기 적힌 순서대로 실행됩니다.
   (표 → 등록 → 임시 carry 순. 뒤 파일이 앞 파일의 상수를 씁니다)

   index.html 을 고칠 수 있게 되면 이 블록을 지우고
   <script> 3줄을 player.js 앞에 넣으면 됩니다.
   ------------------------------------------------------------ */

if(document.readyState==="loading"){
  ["chef-anim-table.js","chef-anims.js","chef-carry-temp.js"]
    .forEach(src=>document.write(`<script src="${src}"><\/script>`));
}else{
  console.error("player.js 가 파싱 단계 밖에서 실행됐습니다. 요리사 스프라이트 파일을 주입하지 못했습니다.");
}


/* ------------------------------------------------------------
   1. 배치·크기
   ------------------------------------------------------------ */

// 낮/밤이 시작될 때 서 있는 자리. day.js / night.js 도 이 값을 씁니다.
//
// speed = 논리 좌표 기준 초당 이동 거리. 205 → 280 → 360 → 306 으로 조정했습니다.
// (360 이 조금 빨라서 15% 줄인 값입니다)
// 주방을 가로지르는 데 약 2.6초 걸립니다.
// [주의] 이 값만 바꾸면 걷기 모션이 그대로라 발이 미끄러져 보입니다.
//        chef-anim-table.js 의 walk / walk_carry fps 를 같은 비율로 맞춰 두세요.
//        비율은 fps = speed × 0.0583 입니다. (지금은 speed 306 ↔ fps 18 조합)
const PLAYER_START = { x:620, y:448, facing:"down", speed:306 };

// 요리사가 걸어다닐 수 있는 범위.
//   bottom 486 = 카운터 바 테이블 상판(논리 y 500)보다 위.
//                이 값을 키우면 요리사가 카운터를 뚫고 내려갑니다.
//   left   235 = 왼쪽 벽·냉장고 앞까지.
const WALK_BOUNDS = { left:235, right:1030, top:410, bottom:486 };

// 스프라이트. 규격·배율·프레임 구성은 chef-anim-table.js 에 있습니다.
// 아래 값은 참고용이고 실제 크기는 CHEF_SCALE 로만 조절합니다.
// (setDisplaySize 로 가로세로를 따로 주면 비율이 깨집니다)
//   frameW/H = 1× 셀 크기 · w/h = 화면에 보이는 캐릭터 크기(배율 1.0 기준)
//   anchorY 1 = 발바닥. 발끝이 state.player.y 에 정확히 놓입니다.
//   h 233 = CHEF_TARGET_H. 시트·방향마다 233~269.5 로 제각각인 걸 가장 작은
//           걷기 뒷모습에 맞춘 값입니다. 배율 계산은 chef-anims.js 가 합니다.
const PLAYER_SPRITE = { frameW:192, frameH:320, w:87, h:233, anchorX:.5, anchorY:1 };

// 음식을 들었을 때 손에 들리는 접시·음식.
// 화면상 위치는 chef-carry-temp.js 의 CHEF_HAND_ANCHOR 가 덮어씁니다.
// dy 는 그 파일을 지웠을 때 쓰이는 기본값입니다.
const PLAYER_CARRY = {
  plate: { dy:-85, w:56, h:18, color:0xeee6d5 },
  food:  { dy:-90, size:36 }
};

// 재생 속도·프레임 구성은 chef-anim-table.js 로 옮겼습니다.
// mini = 미니게임(조리) 중에 쓸 모션. 전용 작업 시트(cook1/cook2)가 아직
// 없어서 평소 정지 모션으로 대신합니다. 시트가 나오면 이 값만 바꾸면 됩니다.
// (조리 중에는 눈 깜빡임을 섞지 않습니다 — 화면 앞에 미니게임 UI 가 덮여 있습니다)
//
// [주의] 여기서 CHEF_IDLE.main 을 쓰면 안 됩니다. chef-anim-table.js 는 이 파일이
//        document.write 로 주입하는 거라 player.js 최상단이 실행될 때는 아직 없습니다.
//        표의 key 를 문자열로 적고, 표를 고치면 여기도 같이 고치세요.
const PLAYER_ANIM = { mini:"idle2" };


/* ------------------------------------------------------------
   2. Phaser 오브젝트
   ------------------------------------------------------------ */

let playerSprite = null;
let carriedPlate = null;
let carriedFood = null;
let playerKeys = null;

function createPlayer(scene){
  const start=state.player;

  registerChefTextures(scene);   // chef-anims.js
  registerChefAnims(scene);      // chef-anims.js

  // 배율은 방향마다 다릅니다. 첫 프레임부터 어긋나지 않게 시작 방향 기준으로 겁니다.
  // (이후 매 프레임 syncPhaserObjects 가 현재 모션에 맞춰 다시 겁니다)
  const startFacing=CHEF_FACING[start.facing]||CHEF_FACING.down;
  playerSprite=scene.add.sprite(toView(start.x),toView(start.y),CHEF_TEXTURE_PREFIX+CHEF_IDLE.main,0)
    .setOrigin(CHEF_ORIGIN.x,CHEF_ORIGIN.y)
    .setScale(chefAnimScale(chefAnimKey(CHEF_IDLE.main,startFacing.dir,false)))
    .setDepth(STAGE_DEPTH.player);

  carriedPlate=scene.add.ellipse(
      toView(start.x),toView(start.y+PLAYER_CARRY.plate.dy),
      toView(PLAYER_CARRY.plate.w),toView(PLAYER_CARRY.plate.h),PLAYER_CARRY.plate.color)
    .setDepth(STAGE_DEPTH.plate).setVisible(false);

  carriedFood=scene.add.sprite(toView(start.x),toView(start.y+PLAYER_CARRY.food.dy),"food",0)
    .setDisplaySize(toView(PLAYER_CARRY.food.size),toView(PLAYER_CARRY.food.size))
    .setDepth(STAGE_DEPTH.food).setVisible(false);

  if(typeof createChefCarry==="function") createChefCarry(scene);   // chef-carry-temp.js — 지우면 이 줄도 무시됨

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
  p.x+=dx; p.y+=dy;
  clampChefToWalkArea(p);   // chef-walk-area.js — 사다리꼴 영역으로 잘라냅니다
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
  const p=state.player;
  playerSprite.setPosition(toView(p.x),toView(p.y));

  // 4방향 facing 을 시트의 3방향(down/up/side)+좌우반전으로 옮깁니다.
  const facing=CHEF_FACING[p.facing]||CHEF_FACING.down;
  // 들고 있는지는 기존 state.carrying 을 읽습니다. (임시 파일이 강제 ON 을 얹을 수 있음)
  const carrying=(typeof chefCarryActive==="function")?chefCarryActive():!!state.carrying;
  // 정지→idle / 이동→walk. 정지해도 facing 은 그대로라 마지막 방향이 유지됩니다.
  // 정지 중에는 chefIdleAction() 이 평소 모션과 눈 깜빡임 모션을 번갈아 골라 줍니다.
  const idling=!state.mini&&!p.moving;
  const action=idling?chefIdleAction():(state.mini?PLAYER_ANIM.mini:"walk");
  if(!idling) chefIdleLeave();

  playerSprite.setFlipX(facing.flipX);
  // play(key, true) 는 같은 키가 이미 재생 중이면 무시합니다. 매 프레임 다시 걸리지 않습니다.
  const animKey=chefAnimKey(action,facing.dir,carrying);
  if(animKey) playerSprite.play(animKey,true);
  // 시트마다 캐릭터 키가 달라서 방향·모션별로 배율을 맞춰 줍니다. (chef-anims.js)
  // 이걸 빼면 걷다 멈출 때, 방향을 바꿀 때 캐릭터 크기가 튑니다.
  // 거기에 원근 보정을 곱합니다 — 앞으로 나올수록 커집니다.
  // origin 이 발바닥이라 배율이 변해도 발은 제자리에 붙어 있습니다.
  playerSprite.setScale(chefAnimScale(animKey)*chefPerspectiveScale(toView(p.y)));

  const held=state.carrying;
  carriedPlate.setVisible(!!held).setPosition(toView(p.x),toView(p.y+PLAYER_CARRY.plate.dy));
  carriedFood.setVisible(!!held).setPosition(toView(p.x),toView(p.y+PLAYER_CARRY.food.dy));
  if(held) carriedFood.setFrame(dishById(held.dishId).icon);

  // 손 위치·앞뒤 관계는 임시 파일이 덮어씁니다. 파일을 지우면 위 기본값으로 돌아갑니다.
  if(typeof syncChefCarry==="function") syncChefCarry(playerSprite,carriedPlate,carriedFood,facing);
}
