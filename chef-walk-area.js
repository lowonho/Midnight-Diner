"use strict";

/* ============================================================
   요리사 이동 가능 영역 (Walkable Area)
   ------------------------------------------------------------
   담당 범위: 요리사가 걸어다닐 수 있는 사다리꼴 영역 정의와 위치 클램프

   담당 범위가 아님: 이동 속도 · 입력 처리 · 애니메이션 · 개별 오브젝트 충돌 ·
                    y축 깊이 정렬 · 카운터/집기 배치
              → player.js / counter.js / kitchen.js

   [좌표계] 이 파일의 값은 전부 VIEW 좌표(1920x1080)입니다.
   실측 스펙이 VIEW 기준으로 들어오기 때문입니다.
   state.player 는 논리 좌표(1280x720)라 클램프할 때만 변환합니다.

   [연결] 기존 파일에서 부르는 곳은 두 군데뿐입니다.
     player.js  movePlayer()      이동 직후 클램프
     save.js    restoreGameState  불러온 위치 보정
   ============================================================ */


/* ------------------------------------------------------------
   1. 영역 정의 — 값을 바꾸려면 여기만 고치면 됩니다
   ------------------------------------------------------------
   사다리꼴입니다. 좌우 한계는 꼭짓점을 손으로 적지 않고
   벽 사선 기울기로 런타임에 계산합니다.
   topY / bottomY 만 바꿔도 좌우가 알아서 따라옵니다.

   실측 기준 (1920x1080)
     상한 y=614   뒤쪽 조리대 접지선. 세면대~식기세척기 구간 609~617 의 평균
     하한 y=899   카운터 상판 앞변. 여기 서면 요리사 허리 아래가 카운터에 가림
     기울기       바닥 다각형을 1920x1080 으로 환산한 좌우 벽 사선

   꼭짓점 (위 값으로 계산되는 결과, 참고용)
     좌상 (249, 614)   우상 (1663, 614)
     좌하 ( 28, 899)   우하 (1884, 899)
   ------------------------------------------------------------ */

const CHEF_WALK_AREA = {
  topY:       614,      // 뒤쪽 조리대 접지선
  bottomY:    899,      // 카운터 상판 앞변
  refY:       545,      // 벽/바닥 경계 (기울기 기준선)
  leftRefX:   302,      // refY 에서의 좌측 벽 x
  rightRefX:  1610,     // refY 에서의 우측 벽 x
  leftSlope:  -0.7744,  // dx/dy
  rightSlope:  0.7731,  // dx/dy
  padding:     0        // 벽에서 띄울 여백. 0 = 벽에 딱 붙음
};


/* ------------------------------------------------------------
   2. 판정
   ------------------------------------------------------------ */

// 주어진 화면 y 에서의 좌/우 한계 x (VIEW 좌표)
function chefWalkLimitsAt(viewY){
  const A=CHEF_WALK_AREA;
  return {
    left:  A.leftRefX  + (viewY-A.refY)*A.leftSlope  + A.padding,
    right: A.rightRefX + (viewY-A.refY)*A.rightSlope - A.padding
  };
}

/* 요리사 접지점을 영역 안으로 끌어당깁니다.
   - 기준점은 발바닥(state.player.x, y). 스프라이트 중심이 아닙니다.
   - 속도나 입력은 건드리지 않고 위치만 자릅니다.
     (속도를 0 으로 만들면 벽에 붙었을 때 다른 축 이동까지 막힙니다)
   - x 와 y 를 따로 자릅니다. 벽에 붙어도 위아래로는 계속 움직입니다.
   - y 를 먼저 자른 뒤 "그 y 기준"으로 x 한계를 구합니다. 순서가 중요합니다. */
function clampChefToWalkArea(player){
  const A=CHEF_WALK_AREA;
  const viewY=clamp(toView(player.y),A.topY,A.bottomY);
  const limit=chefWalkLimitsAt(viewY);
  const viewX=clamp(toView(player.x),limit.left,limit.right);
  player.x=toLogic(viewX);
  player.y=toLogic(viewY);
  return player;
}


/* ============================================================
   여기부터 디버그 전용. 릴리즈에서는 이 블록만 지우면 됩니다.
   (위쪽 코드는 이 블록에 의존하지 않습니다)
   ------------------------------------------------------------
   F1        영역 표시 on/off
   [ / ]     상한 y  -1 / +1
   ; / '     하한 y  -1 / +1
   \         현재 설정값을 콘솔에 복사 가능한 형태로 출력
   ============================================================ */

const CHEF_WALK_DEBUG = {
  on:false, graphics:null, text:null, depth:59,
  fill:0x33ff99, fillAlpha:0.22, line:0x33ff99
};

function chefWalkDebugToggle(on){
  CHEF_WALK_DEBUG.on = on===undefined ? !CHEF_WALK_DEBUG.on : !!on;
  if(CHEF_WALK_DEBUG.on) chefWalkDebugEnsure();
  CHEF_WALK_DEBUG.graphics?.setVisible(CHEF_WALK_DEBUG.on);
  CHEF_WALK_DEBUG.text?.setVisible(CHEF_WALK_DEBUG.on);
  if(!CHEF_WALK_DEBUG.on) CHEF_WALK_DEBUG.graphics?.clear();
  return CHEF_WALK_DEBUG.on;
}

// 씬이 준비된 뒤에 만듭니다. game.js 를 건드리지 않으려고 지연 생성합니다.
function chefWalkDebugEnsure(){
  if(CHEF_WALK_DEBUG.graphics||!phaserScene)return;
  CHEF_WALK_DEBUG.graphics=phaserScene.add.graphics().setDepth(CHEF_WALK_DEBUG.depth);
  // 좌상단은 HUD 패널에 가려서 창문 아래 빈 벽 자리에 띄웁니다.
  CHEF_WALK_DEBUG.text=phaserScene.add.text(350,182,"",{
    fontFamily:'"Malgun Gothic",monospace', fontSize:"20px",
    color:"#b6ffd8", backgroundColor:"rgba(10,20,14,.72)", padding:{x:10,y:8}
  }).setDepth(CHEF_WALK_DEBUG.depth);
}

function chefWalkDebugDraw(){
  if(!CHEF_WALK_DEBUG.on)return;
  chefWalkDebugEnsure();
  const g=CHEF_WALK_DEBUG.graphics; if(!g)return;
  const A=CHEF_WALK_AREA;
  const top=chefWalkLimitsAt(A.topY), bottom=chefWalkLimitsAt(A.bottomY);
  const poly=[top.left,A.topY, top.right,A.topY, bottom.right,A.bottomY, bottom.left,A.bottomY];

  g.clear();
  g.fillStyle(CHEF_WALK_DEBUG.fill,CHEF_WALK_DEBUG.fillAlpha);
  g.fillPoints([
    new Phaser.Geom.Point(poly[0],poly[1]), new Phaser.Geom.Point(poly[2],poly[3]),
    new Phaser.Geom.Point(poly[4],poly[5]), new Phaser.Geom.Point(poly[6],poly[7])
  ],true);
  g.lineStyle(3,CHEF_WALK_DEBUG.line,.95);
  g.strokePoints([
    new Phaser.Geom.Point(poly[0],poly[1]), new Phaser.Geom.Point(poly[2],poly[3]),
    new Phaser.Geom.Point(poly[4],poly[5]), new Phaser.Geom.Point(poly[6],poly[7])
  ],true);

  const p=state.player, vx=toView(p.x), vy=toView(p.y);
  const now=chefWalkLimitsAt(vy);
  g.lineStyle(2,0xffe08c,.9);
  g.beginPath(); g.moveTo(now.left,vy); g.lineTo(now.right,vy); g.strokePath();
  g.fillStyle(0xff4444,1); g.fillCircle(vx,vy,7);

  CHEF_WALK_DEBUG.text.setText([
    `접지점  VIEW ${vx.toFixed(0)}, ${vy.toFixed(0)}   논리 ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`,
    `이 y 의 좌우 한계  ${now.left.toFixed(0)} ~ ${now.right.toFixed(0)}`,
    `상한 y ${A.topY}  [ ]    하한 y ${A.bottomY}  ; '    높이 ${A.bottomY-A.topY}`,
    `\\ = 설정값 출력   F1 = 끄기`
  ].join("\n"));
}

function chefWalkDebugLog(){
  const A=CHEF_WALK_AREA;
  console.log(
`CHEF_WALK_AREA = {
  topY:       ${A.topY},
  bottomY:    ${A.bottomY},
  refY:       ${A.refY},
  leftRefX:   ${A.leftRefX},
  rightRefX:  ${A.rightRefX},
  leftSlope:  ${A.leftSlope},
  rightSlope: ${A.rightSlope},
  padding:    ${A.padding}
};
// 꼭짓점  좌상 (${chefWalkLimitsAt(A.topY).left.toFixed(0)}, ${A.topY})  우상 (${chefWalkLimitsAt(A.topY).right.toFixed(0)}, ${A.topY})
//         좌하 (${chefWalkLimitsAt(A.bottomY).left.toFixed(0)}, ${A.bottomY})  우하 (${chefWalkLimitsAt(A.bottomY).right.toFixed(0)}, ${A.bottomY})`);
}

window.addEventListener("keydown",event=>{
  if(event.key==="F1"){ event.preventDefault(); chefWalkDebugToggle(); return; }
  if(!CHEF_WALK_DEBUG.on)return;
  const A=CHEF_WALK_AREA;
  if(event.key==="[")      A.topY-=1;
  else if(event.key==="]") A.topY+=1;
  else if(event.key===";") A.bottomY-=1;
  else if(event.key==="'") A.bottomY+=1;
  else if(event.key==="\\"){ chefWalkDebugLog(); return; }
  else return;
  event.preventDefault();
  A.topY=Math.min(A.topY,A.bottomY-10);
  A.bottomY=Math.max(A.bottomY,A.topY+10);
  clampChefToWalkArea(state.player);   // 조정 즉시 반영
});

// 디버그 표시는 매 프레임 갱신이 필요합니다. game.js 의 draw() 를 건드리지 않으려고
// 여기서 자체 루프를 돕니다. 꺼져 있으면 아무 것도 하지 않습니다.
(function chefWalkDebugLoop(){
  chefWalkDebugDraw();
  requestAnimationFrame(chefWalkDebugLoop);
})();

window.chefWalkDebug=chefWalkDebugToggle;
window.CHEF_WALK_AREA=CHEF_WALK_AREA;
