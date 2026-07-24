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
  marginLeft: 50,  // 바 테이블 왼쪽 끝에서 띄우는 거리
  marginRight: 140,
  reach: 62,       // 이 거리 안에 들어와야 손질을 시작할 수 있습니다
  labelDy: -26,    // 이름표는 준비물 위쪽. 아래에 두면 카운터 앞 의자에 가립니다
  boxW: 96, boxH: 42
};


/* ------------------------------------------------------------
   2. 배치 계산 · 상호작용 판정
   ------------------------------------------------------------ */

function prepObjectLayout(){
  const tasks=selectedPrepTasks(),count=tasks.length;
  if(!count)return [];
  const counter=FRONT_STATIONS.counter;
  const left=counter.x+PREP_LAYOUT.marginLeft;
  // 오른쪽 끝은 요리사 이동 한계를 넘지 않게 잘라 둡니다. 넘으면 닿을 수 없습니다.
  const right=Math.min(counter.x+counter.w-PREP_LAYOUT.marginRight,WALK_BOUNDS.right-40);
  const step=count===1?0:(right-left)/(count-1);
  return tasks.map((task,index)=>{
    const x=count===1?(left+right)/2:left+step*index;
    return { task, x, y:PREP_LAYOUT.y, ix:x, iy:PREP_LAYOUT.iy };
  });
}

function nearestPrepObject(){
  if(state.phase!=="day")return null;
  let best=null,bestDistance=Infinity;
  prepObjectLayout().forEach(item=>{
    const itemDistance=distance(state.player.x,state.player.y,item.ix,item.iy);
    if(itemDistance<bestDistance){best=item;bestDistance=itemDistance;}
  });
  return bestDistance<PREP_LAYOUT.reach?best:null;
}


/* ------------------------------------------------------------
   3. 드로잉
   ------------------------------------------------------------ */

function drawPrepObjects(){
  if(state.phase!=="day")return;
  const L=PREP_LAYOUT;
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
    }else{
      ctx.fillStyle="#a7432d";roundRect(ctx,item.x-30,item.y-22,60,25,7,true,false);ctx.fillStyle="#83964d";ctx.fillRect(item.x-24,item.y-18,48,4);
    }

    ctx.globalAlpha=1;
    drawFixtureLabel(item.task.objectLabel,item.x,item.y+L.labelDy);

    if(done){
      ctx.fillStyle="#91b961";ctx.beginPath();ctx.arc(item.x+34,item.y-18,15,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#17200e";ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.fillText("✓",item.x+34,item.y-12);
      ctx.fillStyle="#d9e8b5";ctx.font="bold 11px Malgun Gothic";ctx.fillText("준비 완료",item.x,item.y+18);
      ctx.textAlign="left";
    }
    ctx.restore();
  });
}
