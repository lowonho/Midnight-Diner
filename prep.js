"use strict";

/* ============================================================
   낮 준비물 (카운터 위에 올려두는 무 · 어묵 · 멸치 · 김치통)
   ------------------------------------------------------------
   담당 범위: 준비물이 바 테이블 위 어디에 놓이는지 · 상호작용 판정 ·
              준비물 드로잉과 완료 표시

   담당 범위가 아님: 어떤 준비 작업이 필요한지, 손질 미니게임
              → day.js / day-prep-minigames.js

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   [카운터와의 관계] 배치 기준선이 counter.js 의 바 테이블입니다.
   바 테이블을 옮기면 FRONT_STATIONS.counter 를 통해 자동으로 따라옵니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 배치
   ------------------------------------------------------------ */

const PREP_LAYOUT = {
  y: 540,          // 준비물이 놓이는 높이. 바 상판(논리 y 500~522) 위입니다.
  iy: 482,         // 요리사가 서는 높이 (카운터 위쪽 = 주방측)
  marginLeft: 50,  // 바 테이블 왼쪽 끝에서 띄우는 거리 (의자 기준을 못 쓸 때의 대비값)
  // 바 테이블 이미지의 왼쪽 끝(논리 411)은 철판(논리 194~421)에 가려져 있어서,
  // 거기서부터 놓으면 첫 준비물이 철판 위로 올라갑니다. (실측 8px 겹침)
  // 그래서 왼쪽 시작을 철판 오른쪽 끝에서 다시 잡습니다.
  griddleGap: 14,  // 철판 오른쪽 끝에서 준비물 상자까지 띄우는 거리
  // 왼쪽 시작은 1번 의자보다 이만큼 왼쪽입니다.
  // (의자 중심 = counter.js COUNTER_CHAIR_CENTERS. VIEW 좌표라 toLogic 으로 옮깁니다)
  chairLeadIn: 30,
  // 오른쪽 끝은 간판(signage.js OPEN_SIGN, 논리 x 1105~) 앞까지 씁니다.
  // 간판은 논리 y 588 부터라 준비물 상자(530~572)와 세로로 겹치지 않아서
  // 살짝 걸쳐도 됩니다. signOverlap 이 그 걸치는 정도입니다.
  signOverlap: 10,
  rightLimitFallback: 1090,  // 간판이 없을 때의 오른쪽 한계
  // 개수가 적을 때 화면 끝까지 억지로 벌리지 않도록 간격 상한을 둡니다.
  // 남는 폭은 좌우로 나눠 가운데 정렬합니다.
  maxStep: 172,
  // 상호작용 판정 범위. 원이 아니라 세로로 긴 영역입니다. (→ nearestPrepObject 주석)
  reach: 62,       // 준비물 좌우로 이만큼 안에 서야 손질을 시작할 수 있습니다
  reachBack: 62,   // 서는 자리(iy)보다 뒤(주방 쪽)로 이만큼까지
  reachFrontFallback: 130,  // 바 테이블 쪽 한계. 이동 영역을 못 읽을 때의 대비값
  labelDy: -26,    // 이름표는 준비물 위쪽. 아래에 두면 카운터 앞 의자에 가립니다
  boxW: 72, boxH: 42
};


/* ------------------------------------------------------------
   2. 배치 계산 · 상호작용 판정
   ------------------------------------------------------------ */

// 준비물을 놓을 수 있는 좌우 한계(상자 중심 기준).
function prepObjectRange(){
  const L=PREP_LAYOUT;
  const counter=FRONT_STATIONS.counter,griddle=FRONT_STATIONS.griddle;
  // 왼쪽: 1번 의자보다 약간 왼쪽. 단 철판 위로는 절대 올라가지 않습니다.
  const chairLead=(typeof COUNTER_CHAIR_CENTERS!=="undefined"&&COUNTER_CHAIR_CENTERS.length)
    ? toLogic(COUNTER_CHAIR_CENTERS[0])-L.chairLeadIn
    : counter.x+L.marginLeft;
  const left=Math.max(chairLead, griddle.x+griddle.w+L.boxW/2+L.griddleGap);
  // 오른쪽: 간판 앞. 바 테이블 오른쪽 끝은 넘지 않습니다.
  const signLimit=(typeof OPEN_SIGN!=="undefined")
    ? OPEN_SIGN.x+L.signOverlap
    : L.rightLimitFallback;
  const right=Math.min(counter.x+counter.w-L.boxW/2, signLimit);
  return { left, right:Math.max(left,right) };
}

function prepObjectLayout(){
  const tasks=selectedPrepTasks(),count=tasks.length;
  if(!count)return [];
  const L=PREP_LAYOUT;
  const {left,right}=prepObjectRange();
  const step=count===1?0:Math.min((right-left)/(count-1), L.maxStep);
  const start=left+(right-left-step*(count-1))/2;
  return tasks.map((task,index)=>{
    const x=start+step*index;
    return { task, x, y:PREP_LAYOUT.y, ix:x, iy:PREP_LAYOUT.iy };
  });
}

/* 바 테이블 쪽 판정 한계 (iy 에서 아래로 몇 논리 px 까지 인정할지).
   ------------------------------------------------------------
   요리사가 바 테이블에 딱 붙어 설 수 있는 자리까지 전부 포함시킵니다.
   이동 영역 하한(chef-walk-area.js bottomY)이 곧 "가장 가까이 붙은 자리"라
   그 값에서 구합니다. 하한을 옮기면 판정도 알아서 따라옵니다. */
function prepReachFront(){
  const L=PREP_LAYOUT;
  if(typeof CHEF_WALK_AREA==="undefined")return L.reachFrontFallback;
  return Math.max(L.reach, toLogic(CHEF_WALK_AREA.bottomY)-L.iy);
}

/* 상호작용 판정
   ------------------------------------------------------------
   원(iy 중심 반경 62)이었는데, 바 테이블에 완전히 붙으면 오히려
   상호작용이 끊겼습니다. 서는 자리 iy(논리 482)와 이동 영역 하한
   (VIEW 899 = 논리 599)이 117 이나 떨어져 있어서, 가장 가까이 다가간
   자리가 반경 62 밖으로 나가 버렸기 때문입니다.

   그래서 세로로 긴 영역으로 바꿨습니다.
     가로  준비물 중심에서 ±reach.        (원일 때의 최대 폭과 같습니다)
     세로  iy 뒤로 reachBack ~ 바 테이블까지 전부.

   준비물은 바 테이블 위에 가로 한 줄로 놓이므로, 어느 것을 고를지는
   가로 거리만으로 정합니다. 세로 위치로는 구분되지 않습니다.
   ------------------------------------------------------------ */
function nearestPrepObject(){
  if(state.phase!=="day")return null;
  const L=PREP_LAYOUT,front=prepReachFront();
  let best=null,bestDx=Infinity;
  prepObjectLayout().forEach(item=>{
    const dy=state.player.y-item.iy;     // 양수 = 요리사가 바 테이블 쪽
    if(dy<-L.reachBack||dy>front)return;
    const dx=Math.abs(state.player.x-item.ix);
    if(dx<L.reach&&dx<bestDx){best=item;bestDx=dx;}
  });
  return best;
}

/* "지금 이 준비물에 E 를 누를 수 있는가" — 이름표 둥실 강조 조건입니다.
   ------------------------------------------------------------
   가까이 서 있는 것만으로는 부족합니다. E 를 눌러 실제로 손질이
   시작되는 조건, 즉 day.js 의 startPrepTask() 가 통과시키는 조건과
   같아야 합니다.

     이미 손질함    "이미 준비한 재료입니다" 로 막힙니다
     선행 작업 남음  "먼저 … 작업을 완료하세요" 로 막힙니다
                   (예: 두부김치는 자르기 → 볶기 순서)
     미니게임 중     그 준비물만 (프롬프트는 숨지만 손질 중이므로 계속 강조)

   이름표 강조뿐 아니라 game.js 의 E 프롬프트도 이 함수를 씁니다.
   둘이 같은 함수를 봐야 "E 는 뜨는데 명판은 잠잠한" 상태가 안 생깁니다.
   (김치 볶기 팬처럼 dependsOn 이 걸린 준비물에서 실제로 그랬습니다)

   [주의] 판정 규칙 자체는 day.js 가 주인입니다. startPrepTask() 의
   조건이 바뀌면 여기도 같이 고쳐야 이름표와 실제 동작이 어긋나지 않습니다.
   주방 집기 쪽 같은 역할은 kitchen.js 의 stationUsable() 입니다.
   ------------------------------------------------------------ */
// near 는 여러 개를 한 번에 그릴 때 재사용하려고 받습니다.
// 하나만 물어볼 때는 생략하면 알아서 구합니다.
function prepObjectUsable(item,near=nearestPrepObject()){
  if(state.mini)return state.mini.context?.taskId===item.task.id;
  if(state.paused||near?.task.id!==item.task.id)return false;
  if(state.prepProgress?.[item.task.id])return false;
  return !(item.task.dependsOn||[]).some(id=>PREP_TASKS[id]&&!state.prepProgress?.[id]);
}


/* ------------------------------------------------------------
   3. 드로잉
   ------------------------------------------------------------ */

function drawPrepObjects(){
  if(state.phase!=="day")return;
  const L=PREP_LAYOUT;
  // 가장 가까운 준비물은 전부가 공유하므로 여기서 한 번만 구합니다.
  const near=nearestPrepObject();
  prepObjectLayout().forEach(item=>{
    const done=!!state.prepProgress[item.task.id];
    ctx.save();ctx.globalAlpha=done?0.48:1;

    // 준비물을 담아 두는 나무 상자
    ctx.fillStyle="#6d4528";roundRect(ctx,item.x-L.boxW/2,item.y-10,L.boxW,L.boxH,8,true,false);
    ctx.strokeStyle="#b57a3e";ctx.lineWidth=3;roundRect(ctx,item.x-L.boxW/2,item.y-10,L.boxW,L.boxH,8,false,true);

    if(item.task.objectKind==="radish"){
      ctx.fillStyle="#e8e0c4";ctx.beginPath();ctx.ellipse(item.x,item.y-8,28,12,-.12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#769351";ctx.fillRect(item.x+20,item.y-21,12,15);
    }else if(item.task.objectKind==="fishCake"){
      ctx.fillStyle="#dba65d";ctx.save();ctx.translate(item.x,item.y-9);ctx.rotate(-.1);roundRect(ctx,-27,-10,54,20,4,true,false);ctx.restore();
    }else if(item.task.objectKind==="anchovy"){
      ctx.fillStyle="#9aa3a2";for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(item.x-19+i*18,item.y-8+(i%2)*5,17,5,.12,0,Math.PI*2);ctx.fill();}
    }else if(item.task.objectKind==="chicken"){
      ctx.fillStyle="#e6a68e";roundRect(ctx,item.x-25,item.y-20,50,24,9,true,false);
    }else if(item.task.objectKind==="greenOnion"){
      ctx.fillStyle="#6f9d4f";ctx.fillRect(item.x-28,item.y-16,56,9);ctx.fillStyle="#e9e1bd";ctx.fillRect(item.x-28,item.y-7,56,9);
    }else if(item.task.objectKind==="pan"){
      ctx.fillStyle="#45433f";ctx.beginPath();ctx.ellipse(item.x,item.y-8,28,14,0,0,Math.PI*2);ctx.fill();ctx.fillRect(item.x+24,item.y-12,22,7);
    }else if(item.task.objectKind==="batter"){
      ctx.fillStyle="#d7c6a2";ctx.beginPath();ctx.ellipse(item.x,item.y-7,29,17,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ead8a9";ctx.beginPath();ctx.ellipse(item.x,item.y-10,22,10,0,0,Math.PI*2);ctx.fill();
    }else if(item.task.objectKind==="skewer"){
      ctx.strokeStyle="#d8b274";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(item.x-30,item.y);ctx.lineTo(item.x+31,item.y-17);ctx.stroke();
    }else{
      ctx.fillStyle="#a7432d";roundRect(ctx,item.x-30,item.y-22,60,25,7,true,false);ctx.fillStyle="#83964d";ctx.fillRect(item.x-24,item.y-18,48,4);
    }

    ctx.globalAlpha=1;
    // 이름표 둥실. 주방 집기 이름표와 같은 규칙입니다. (draw-utils.js labelFloatStep)
    drawFixtureLabel(item.task.objectLabel,item.x,item.y+L.labelDy,
      labelFloatStep(`prep_${item.task.id}`,prepObjectUsable(item,near)));

    if(done){
      ctx.fillStyle="#91b961";ctx.beginPath();ctx.arc(item.x+34,item.y-18,15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#17200e";ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.fillText("✓",item.x+34,item.y-12);
      ctx.fillStyle="#d9e8b5";ctx.font="bold 11px Malgun Gothic";ctx.fillText("준비 완료",item.x,item.y+18);
      ctx.textAlign="left";
    }
    ctx.restore();
  });
}
