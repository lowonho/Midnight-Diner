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
  ["js/chef-anim-table.js","js/chef-anims.js","js/chef-carry-temp.js"]
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

// 음식을 들었을 때 손에 들리는 음식 그림.
// 접시는 따로 그리지 않습니다 — 음식 에셋에 그릇이 함께 그려져 있습니다.
// 화면상 위치는 chef-carry-temp.js 의 CHEF_HAND_ANCHOR 가 덮어씁니다.
//
//   w      음식 그림의 가로 폭(논리 좌표). 세로는 그림 비율(264:152)에서
//          자동으로 나옵니다 — 72 → 약 41.
//   hand   손 앵커(CHEF_HAND_ANCHOR)에서 음식 그림 중심까지의 보정.
//          실측값인 앵커 표는 건드리지 않고 여기서만 맞춥니다. 단위는 앵커와
//          같은 1× 셀 픽셀이고, 요리사 배율이 곱해집니다.
//          x 는 side 에서만 씁니다. 음수 = 요리사가 보는 방향(앞).
//          좌우 반전은 앵커와 함께 자동 처리됩니다.
//
//          down  y +14  그림 캔버스 아래쪽 여백(16/152) 때문에 앵커에 그대로
//                       두면 떠 보입니다. 14 면 손바닥이 그릇 아래 테두리에
//                       걸립니다. 20 을 넘으면 음식이 얼굴을 가립니다.
//          up    y -22  뒷모습은 음식이 몸에 가려지는데(아래 depth 참고) 앵커
//                       표의 up 이 down 보다 12px 낮아서 그대로 두면 손보다
//                       아래로 내려가 어색합니다. 반대로 올려 손 위에 얹습니다.
//          side  x -29  앵커 표의 side x(-25.5)는 실제 측면 carry 포즈의 손보다
//                       29px 뒤라서, 그대로 두면 음식이 어깨·가슴에 겹칩니다.
//                       앞으로 밀어 뻗은 손 위에 오게 합니다.
//                y   9  측면 포즈는 손이 앞으로 뻗어 있어 down 과 같은 14 를 주면
//                       음식이 손보다 조금 내려앉아 보입니다. 5px 만 올립니다.
//   dy     chef-carry-temp.js 를 지웠을 때 쓰이는 기본 높이(발바닥 기준).
//
// steam/sparkle = 음식 위에 겹치는 연출(food-props.js FOOD_FX).
//   음식 크기에 대한 비율로 적어서 원근 보정이 음식과 함께 걸립니다.
//   steam.w   음식 폭 대비 김 스프라이트 폭. 0.55 면 김 꼭대기가 턱 바로 아래에서
//             멈춥니다. 0.7 을 넘기면 얼굴을 가려서 지저분해 보입니다.
//   steam.dy  음식 세로 크기 대비 김 밑동 위치 (0 = 음식 중심, 양수 = 아래쪽).
//             0.05 = 그릇 안에서 피어오르는 높이.
//   sparkle.w   음식 폭 대비 반짝임 폭. 예전에는 음식과 같은 사각형(1.0)이었는데
//               시트의 별이 작아서 접시에 파묻혀 잘 안 보였습니다. 1.3 이면
//               별 하나하나가 눈에 들어옵니다. 1.5 를 넘기면 접시보다 별이
//               더 커 보입니다. 세로는 시트 비율(프랍과 같음)로 따라옵니다.
//   sparkle.dy  음식 세로 크기 대비 반짝임 중심 (0 = 음식 중심, 음수 = 위쪽).
//               -0.45 면 별 무리가 접시 윗면과 그 위쪽에 걸칩니다. -0.6 을 넘겨
//               올리면 별이 요리사 얼굴을 덮습니다.
const PLAYER_CARRY = {
  food: {
    dy:-80, w:72,
    hand:{ down:{x:0,y:14}, up:{x:0,y:-22}, side:{x:-29,y:9} },
    steam:{ w:0.55, dy:0.05 },
    sparkle:{ w:1.3, dy:-0.45 }
  }
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
let carriedFood = null;
let carriedSteam = null;
let carriedSparkle = null;
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

  // 음식 그림은 메뉴별 단일 텍스처입니다. (food-props.js)
  // 크기는 syncPhaserObjects 가 매 프레임 원근 보정과 함께 다시 잡습니다.
  // 그림 10종이 모두 같은 원본 크기라서 텍스처만 갈아끼우면 됩니다.
  carriedFood=scene.add.sprite(toView(start.x),toView(start.y+PLAYER_CARRY.food.dy),
      foodPropTextureKey(FOOD_PROPS[0].id))
    .setDepth(STAGE_DEPTH.food).setVisible(false);
  sizeFoodPropSprite(carriedFood,carriedFoodViewWidth(start.y));

  // 김·반짝임은 만들자마자 반복 재생을 걸어 두고 보이기만 껐다 켭니다.
  // 위치·크기·깊이는 매 프레임 syncCarriedFoodFx() 가 음식에 맞춥니다.
  carriedSteam=createFoodFxSprite(scene,"steam",STAGE_DEPTH.food);       // food-props.js
  carriedSparkle=createFoodFxSprite(scene,"sparkle",STAGE_DEPTH.food);
  // 김은 밑동 기준이라야 "음식 표면에서 피어오른다"가 됩니다. 반짝임은 음식과 같은 중심.
  carriedSteam?.setOrigin(.5,1);

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
  // 메뉴 선택도 주방 안에서 냉장고까지 직접 걸어가는 단계입니다.
  if(state.mini||!["menuSelect","day","night"].includes(state.phase)){p.moving=false;return;}
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
  blockPlayerAtStations(p); // kitchen.js       — 쓰레기통은 통과하지 못합니다
  p.moving=true;
  if(Math.abs(dx)>Math.abs(dy))p.facing=dx>0?"right":"left";
  else p.facing=dy>0?"down":"up";
}

// 요리사를 시작 자리로 되돌립니다. day.js / night.js 가 단계 전환 때 씁니다.
/* 손에 든 음식의 화면 폭(VIEW). 원근 보정은 요리사와 같은 함수를 씁니다.
   (chefAnimScale 은 시트마다 다른 캐릭터 키를 맞추는 값이라 곱하지 않습니다 —
    그걸 곱하면 모션이 바뀔 때마다 음식 크기가 같이 튑니다) */
function carriedFoodViewWidth(logicY){
  const perspective=(typeof chefPerspectiveScale==="function")?chefPerspectiveScale(toView(logicY)):1;
  return toView(PLAYER_CARRY.food.w)*perspective;
}

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
  carriedFood.setVisible(!!held).setPosition(toView(p.x),toView(p.y+PLAYER_CARRY.food.dy));
  if(held){
    // 조리 점수에 따라 rough / normal / perfect 세 그림 중 하나로 바뀝니다.
    setFoodPropTexture(carriedFood,held.dishId,foodPropGrade(held.cookScore));
    // 음식도 요리사와 같은 원근 배율을 받아야 합니다. 안 걸면 앞으로 걸어나올 때
    // 요리사만 커져서 손에 든 음식이 상대적으로 작아집니다.
    sizeFoodPropSprite(carriedFood,carriedFoodViewWidth(p.y));
  }

  // 손 위치·앞뒤 관계는 임시 파일이 덮어씁니다. 파일을 지우면 위 기본값으로 돌아갑니다.
  if(typeof syncChefCarry==="function") syncChefCarry(playerSprite,carriedFood,facing);

  // 연출은 음식이 최종 위치로 옮겨진 뒤에 맞춥니다. 그래야 손 위치를 누가 정하든 따라갑니다.
  syncCarriedFoodFx(held);
}


/* 음식 위에 겹치는 김·반짝임을 음식 스프라이트에 맞춥니다.
   음식의 화면 크기·위치·깊이에서 전부 끌어오므로 원근 보정과 앞뒤 관계
   (뒷모습일 때 몸 뒤로 가는 것 포함)가 자동으로 따라옵니다.

   [깊이] 음식과 "같은" depth 를 씁니다. 더 크게 주면 뒷모습일 때 음식만
   몸 뒤로 가고 연출은 몸 앞에 남아 등에서 김이 나는 그림이 됩니다.
   같은 depth 안에서는 만든 순서(음식 → 김 → 반짝임)대로 겹칩니다. */
function syncCarriedFoodFx(held){
  const visible=!!held&&carriedFood.visible;
  const foodW=carriedFood.displayWidth,foodH=carriedFood.displayHeight;

  if(carriedSteam){
    const S=PLAYER_CARRY.food.steam;
    const width=foodW*S.w;
    carriedSteam.setVisible(visible)
      .setPosition(carriedFood.x,carriedFood.y+foodH*S.dy)
      .setDisplaySize(width,width*(carriedSteam.height/carriedSteam.width))
      .setDepth(carriedFood.depth);
  }

  if(carriedSparkle){
    // 음식 폭의 일부만 써서 접시 가운데 위쪽에 띄웁니다. (PLAYER_CARRY.food.sparkle)
    // 시트 비율이 프랍과 같아서 폭만 정하면 세로는 따라옵니다.
    const K=PLAYER_CARRY.food.sparkle;
    const special=(typeof isSpecialFood==="function")&&isSpecialFood(held?.dishId,carriedOrder(held));
    const width=foodW*K.w;
    carriedSparkle.setVisible(visible&&!!special)
      .setPosition(carriedFood.x,carriedFood.y+foodH*K.dy)
      .setDisplaySize(width,width*(carriedSparkle.height/carriedSparkle.width))
      .setDepth(carriedFood.depth);
  }
}

// 들고 있는 접시의 주문. 이야기 손님의 특별 조리 여부를 보려고 찾습니다.
function carriedOrder(held){
  return held?state.orders.find(order=>order.id===held.orderId)||null:null;
}
