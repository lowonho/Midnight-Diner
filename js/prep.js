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
  // 오른쪽 끝은 간판(signage.js OPEN_SIGN, 논리 x 1104~) 앞까지 씁니다.
  // 간판은 논리 y 588 부터라 준비물 상자(530~572)와 세로로 겹치지 않아서
  // 살짝 걸쳐도 됩니다. signOverlap 이 그 걸치는 정도입니다.
  signOverlap: 10,
  rightLimitFallback: 1090,  // 간판이 없을 때의 오른쪽 한계
  // 개수가 적을 때 화면 끝까지 억지로 벌리지 않도록 간격 상한을 둡니다.
  // 남는 폭은 좌우로 나눠 가운데 정렬합니다.
  maxStep: 172,
  /* 자리 간격을 이 배율만큼 좁힙니다. 좁아진 만큼 줄 전체가 오른쪽으로 붙습니다
     — 오른쪽 끝 자리는 제자리에 두고 왼쪽만 당겨 오기 때문입니다(prepObjectLayout).
     왼쪽(철판 쪽)에 빈 자리가 너무 많이 남아서 넣은 값입니다.
     0.92 면 다섯 자리 기준 간격 159 → 146, 맨 왼쪽 자리가 51 오른쪽으로 옵니다.
     (0.86 까지 좁혀 봤더니 준비물끼리 답답해 보여서 되돌린 값입니다)
     ⚠️ 더 줄이려면 이름표 폭을 보세요 — '새우튀김 준비' 명판이 112 라
     간격이 그 아래로 내려가면 옆 이름표와 붙습니다. */
  stepScale: 0.92,
  // 상호작용 판정 범위. 원이 아니라 세로로 긴 영역입니다. (→ nearestPrepObject 주석)
  reach: 62,       // 준비물 좌우로 이만큼 안에 서야 손질을 시작할 수 있습니다
  reachBack: 62,   // 서는 자리(iy)보다 뒤(주방 쪽)로 이만큼까지
  reachFrontFallback: 130,  // 바 테이블 쪽 한계. 이동 영역을 못 읽을 때의 대비값
  // 이름표는 준비물 위쪽. 아래에 두면 카운터 앞 의자에 가립니다.
  // 재료 바구니 원화(artH 56)가 예비 도형보다 위로 더 올라와서 -26 → -32 로 띄웠습니다.
  labelDy: -32,
  boxW: 72, boxH: 42,       // 원화가 없을 때 그리는 예비 나무 상자
  /* 재료 바구니 원화를 넣을 칸. 실제 그림은 이 칸 안에 비율을 지켜 들어갑니다
     (food-props.js drawFoodPrepProp — 배율 기준은 그림 크기가 아니라 기준 캔버스).
     폭 96 은 준비물이 여섯 자리까지 늘어나도 옆자리와 붙지 않는 값입니다
     (자리 간격 최소 = (1115-471)/5 ≈ 129). */
  artW: 96, artH: 56, artDy: 2
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

// 준비 작업 수만큼 상자를 늘어놓지 않고 메뉴 하나당 한 자리만 씁니다.
// 각 자리의 그림과 상호작용 대상은 그 메뉴에서 다음으로 해야 할 작업으로 바뀝니다.
function prepDishGroups(){
  const sharedTasks=new Set();
  return selectedDishes().map(dish=>{
    const dishTasks=prepTasksForDish(dish.id);
    if(!dishTasks.length)return null;
    const task=nextPrepTaskForDish(dish.id)||dishTasks[dishTasks.length-1];
    /* 같은 재료를 함께 손질하더라도 준비물은 메뉴마다 따로 보여 줍니다.
       예를 들어 두부김치와 김치전의 김치 썰기는 완료·점수를 공유하지만,
       바 테이블에는 「두부김치 준비」와 「김치전 준비」가 처음부터 각각
       있어야 플레이어가 오늘 준비할 두 메뉴를 모두 알아볼 수 있습니다. */
    if(!prepTaskCompleted(task)&&task.sharedPrepKey&&!task.showSharedPrepPerMenu){
      if(sharedTasks.has(task.sharedPrepKey))return null;
      sharedTasks.add(task.sharedPrepKey);
    }
    return {dish,tasks:dishTasks,task};
  }).filter(Boolean);
}

/* 자리 계산
   ------------------------------------------------------------
   [오른쪽 끝을 기준으로 잡습니다] 먼저 예전처럼 좌우 한계에 꽉 채워
   가운데 정렬한 자리를 구하고(fullStep), 그 **맨 오른쪽 자리만 그대로
   둔 채** 간격을 stepScale 만큼 좁힙니다. 그래서 줄 전체가 오른쪽으로
   붙고, 오른쪽 끝 준비물(간판 앞)은 개수가 몇 개든 늘 같은 자리입니다.
   자리가 하나뿐이면 fullStep 이 0 이라 예전처럼 가운데 그대로입니다. */
function prepObjectLayout(){
  const groups=prepDishGroups(),count=groups.length;
  if(!count)return [];
  const L=PREP_LAYOUT;
  const {left,right}=prepObjectRange();
  const fullStep=count===1?0:Math.min((right-left)/(count-1), L.maxStep);
  const lastX=left+(right-left-fullStep*(count-1))/2+fullStep*(count-1);
  const step=fullStep*L.stepScale;
  return groups.map((group,index)=>{
    const x=lastX-step*(count-1-index);
    return { ...group, x, y:PREP_LAYOUT.y, ix:x, iy:PREP_LAYOUT.iy };
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
  if(state.phase!=="day"||state.story?.activeStoryCook)return null;
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
  if(state.story?.activeStoryCook||state.paused||near?.task.id!==item.task.id)return false;
  if(prepTaskCompleted(item.task))return false;
  return !(item.task.dependsOn||[]).some(id=>PREP_TASKS[id]&&!prepTaskCompleted(id));
}


/* ------------------------------------------------------------
   3. 드로잉
   ------------------------------------------------------------ */

/* 준비물 자리에 놓이는 재료 바구니 원화.
   ------------------------------------------------------------
   그림은 **메뉴당 한 장**입니다(assets/food/prop_ready). 준비 작업마다
   따로 있지 않아서, 떡볶이 자리는 양배추를 썰 차례든 어묵을 썰 차례든
   같은 바구니를 보여 줍니다. 지금 무슨 차례인지는 이름표와 아래 진행
   숫자가 알려 주므로 그림까지 바뀔 필요는 없다고 봤습니다.

   원화 자체가 바구니라 예비 도형의 나무 상자는 그리지 않습니다. 대신
   바 상판에 얹힌 느낌이 나도록 밑에 그림자 타원만 깔아 줍니다.
   그린 폭을 돌려주는 이유는 완료 도장(✓)을 그림 오른쪽 끝에 붙이기
   위해서입니다 — 그림 폭이 메뉴마다 73~90 으로 달라서 고정값을 쓰면
   감자튀김 자리만 도장이 허공에 뜹니다. */
function drawPrepArt(item){
  const L=PREP_LAYOUT,cy=item.y+L.artDy;
  const size=typeof foodPrepSize==="function"?foodPrepSize(item.dish.id,L.artW,L.artH):null;
  if(!size)return null;
  const alpha=ctx.globalAlpha;
  ctx.globalAlpha=alpha*0.28;
  ctx.fillStyle="#1b0f07";ctx.beginPath();ctx.ellipse(item.x,cy+size.h/2-3,size.w*0.44,5,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=alpha;
  return drawFoodPrepProp(item.dish.id,item.x,cy,L.artW,L.artH);
}

// 원화가 아직 안 실렸을 때만 쓰는 예비 도형입니다. 원화가 붙기 전
// 준비 작업별로 손으로 그려 두었던 것이라 objectKind 단위로 갈립니다.
function drawPrepFallbackObject(item,done){
  const L=PREP_LAYOUT;
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
  }else if(item.task.objectKind==="cabbage"){
    ctx.fillStyle="#8eae58";ctx.beginPath();ctx.arc(item.x,item.y-8,23,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#d9e6a7";ctx.lineWidth=2;ctx.beginPath();ctx.arc(item.x-5,item.y-10,13,0,Math.PI*2);ctx.stroke();
  }else if(item.task.objectKind==="carrot"){
    ctx.fillStyle="#e98535";ctx.beginPath();ctx.moveTo(item.x-27,item.y-16);ctx.lineTo(item.x+27,item.y-6);ctx.lineTo(item.x-24,item.y+5);ctx.closePath();ctx.fill();
  }else if(item.task.objectKind==="sauceBowl"){
    ctx.fillStyle="#d7c6a2";ctx.beginPath();ctx.ellipse(item.x,item.y-5,27,15,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#72351f";ctx.beginPath();ctx.ellipse(item.x,item.y-9,21,8,0,0,Math.PI*2);ctx.fill();
  }else if(item.task.objectKind==="tofu"){
    ctx.fillStyle="#fff6e2";roundRect(ctx,item.x-26,item.y-20,52,26,5,true,false);
    ctx.strokeStyle="#c8b98f";ctx.lineWidth=2;roundRect(ctx,item.x-26,item.y-20,52,26,5,false,true);
  }else if(item.task.objectKind==="shrimpEgg"){
    ctx.fillStyle="#e4e0d2";ctx.beginPath();ctx.ellipse(item.x,item.y-6,27,15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f0c04a";ctx.beginPath();ctx.ellipse(item.x,item.y-9,20,9,0,0,Math.PI*2);ctx.fill();
  }else if(item.task.objectKind==="shrimpCoat"){
    ctx.fillStyle="#e69a78";ctx.beginPath();ctx.arc(item.x-4,item.y-8,20,.3,Math.PI*1.75);ctx.lineWidth=7;ctx.strokeStyle="#f1b18c";ctx.stroke();
  }else if(item.task.objectKind==="breadcrumbs"){
    ctx.fillStyle="#d8ad61";roundRect(ctx,item.x-27,item.y-20,54,27,7,true,false);ctx.fillStyle="#f2d791";for(let n=0;n<7;n++)ctx.fillRect(item.x-20+(n%4)*12,item.y-15+Math.floor(n/4)*9,4,3);
  }else if(item.task.objectKind==="tteokBowl"||item.task.objectKind==="udonBowl"){
    const isUdon=item.task.objectKind==="udonBowl";
    ctx.fillStyle="#bfc9cc";ctx.beginPath();ctx.ellipse(item.x,item.y-7,29,16,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=done?"#8bc4d4":"#5d6b6e";ctx.beginPath();ctx.ellipse(item.x,item.y-10,23,10,0,0,Math.PI*2);ctx.fill();
    if(done){ctx.fillStyle="#f2e5c5";for(let n=0;n<5;n++){ctx.save();ctx.translate(item.x-14+n*7,item.y-11+(n%2)*4);ctx.rotate(-.3+n*.12);if(isUdon){ctx.strokeStyle="#f2e5c5";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*1.6);ctx.stroke();}else roundRect(ctx,-5,-2,10,5,3,true,false);ctx.restore();}}
  }else if(item.task.objectKind==="tteokCut"){
    ctx.fillStyle="#91ad57";ctx.beginPath();ctx.arc(item.x-18,item.y-9,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e0a457";roundRect(ctx,item.x-3,item.y-18,29,18,4,true,false);ctx.fillStyle="#d9e3bd";ctx.fillRect(item.x-25,item.y+2,48,6);
  }else if(item.task.objectKind==="potato"){
    ctx.fillStyle="#b88a4d";ctx.beginPath();ctx.ellipse(item.x,item.y-10,27,17,-.12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#d8dadd";ctx.fillRect(item.x-30,item.y+5,60,5);
  }else if(item.task.objectKind==="potatoBasket"){
    ctx.strokeStyle="#c38b43";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(item.x,item.y-7,29,16,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#e8c56e";for(let n=0;n<5;n++)ctx.fillRect(item.x-21+n*9,item.y-12+(n%2)*5,5,17);
  }else{
    ctx.fillStyle="#a7432d";roundRect(ctx,item.x-30,item.y-22,60,25,7,true,false);ctx.fillStyle="#83964d";ctx.fillRect(item.x-24,item.y-18,48,4);
  }
}

/* 진행 숫자 · "준비 완료" 글자.
   ------------------------------------------------------------
   예전 나무 상자는 어두워서 밝은 글자만으로 읽혔지만, 재료 바구니
   원화는 밝은 나무색이라 같은 색으로 얹으면 글자가 사라집니다.
   그래서 이름표(FIXTURE_LABEL)와 같은 어두운 색으로 테두리를 두릅니다. */
function drawPrepStatusText(text,x,y,color){
  ctx.font="bold 11px Malgun Gothic";ctx.textAlign="center";
  ctx.strokeStyle="#1b100b";ctx.lineWidth=3;ctx.lineJoin="round";ctx.strokeText(text,x,y);
  ctx.fillStyle=color;ctx.fillText(text,x,y);
  ctx.textAlign="left";
}

function drawPrepObjects(){
  if(state.phase!=="day"||state.story?.activeStoryCook)return;
  const L=PREP_LAYOUT;
  // 가장 가까운 준비물은 전부가 공유하므로 여기서 한 번만 구합니다.
  const near=nearestPrepObject();
  prepObjectLayout().forEach(item=>{
    const completed=item.tasks.filter(prepTaskCompleted).length;
    const done=completed===item.tasks.length;
    ctx.save();ctx.globalAlpha=done?0.48:1;

    const art=drawPrepArt(item);
    if(!art)drawPrepFallbackObject(item,done);

    ctx.globalAlpha=1;
    // 이름표 둥실. 주방 집기 이름표와 같은 규칙입니다. (draw-utils.js labelFloatStep)
    // 준비물은 메뉴당 하나라 이름표도 "메뉴 이름 + 준비" 한 가지로 씁니다.
    // 지금 어떤 작업 차례인지는 아래 진행 숫자가 알려 줍니다.
    drawFixtureLabel(`${item.dish.name} 준비`,item.x,item.y+L.labelDy,
      labelFloatStep(`prep_${item.task.id}`,prepObjectUsable(item,near)));

    // 진행 글자는 그림 아래로 내려서 재료를 가리지 않게 합니다.
    const textY=item.y+(art?art.h/2+L.artDy+11:18);
    if(done){
      /* 완료 도장은 그림 오른쪽 모서리에 걸칩니다.
         가로는 그림 폭 기준입니다 — 메뉴마다 73~90 으로 달라서 고정값을 쓰면
         좁은 그림(감자튀김) 옆에서만 도장이 허공에 뜹니다.
         세로는 그림 한가운데 높이입니다. 예전처럼 위쪽(y-18)에 두면
         이름표를 -32 로 올린 지금은 명판 오른쪽 아래 모서리를 파고듭니다. */
      const badgeX=item.x+(art?art.w/2-8:34),badgeY=item.y+(art?L.artDy:-18);
      ctx.fillStyle="#91b961";ctx.beginPath();ctx.arc(badgeX,badgeY,15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#17200e";ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.fillText("✓",badgeX,badgeY+6);
      ctx.textAlign="left";
      drawPrepStatusText("준비 완료",item.x,textY,"#d9e8b5");
    }else{
      // 메뉴 이름은 바로 위 이름표("두부김치 준비")에 이미 있어서 숫자만 씁니다.
      drawPrepStatusText(`${completed}/${item.tasks.length}`,item.x,textY,"#ead8b8");
    }
    ctx.restore();
  });
}
