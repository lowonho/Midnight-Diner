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
  // 바 테이블 이미지의 왼쪽 끝(논리 411)은 철판(논리 194~421)에 가려져 있어서,
  // 거기서부터 놓으면 첫 준비물이 철판 위로 올라갑니다. (실측 8px 겹침)
  // 그래서 왼쪽 시작을 철판 오른쪽 끝에서 다시 잡습니다.
  griddleGap: 14,  // 철판 오른쪽 끝에서 준비물 상자까지 띄우는 거리
  // 오른쪽 한계. 더 오른쪽으로 가면 우측 HUD 패널 아래에 깔립니다.
  rightLimit: 990,
  reach: 62,       // 이 거리 안에 들어와야 손질을 시작할 수 있습니다
  labelDy: -26,    // 이름표는 준비물 위쪽. 아래에 두면 카운터 앞 의자에 가립니다
  boxW: 72, boxH: 42
};


/* ------------------------------------------------------------
   2. 배치 계산 · 상호작용 판정
   ------------------------------------------------------------ */

function prepObjectLayout(){
  const tasks=selectedPrepTasks(),count=tasks.length;
  if(!count)return [];
  const L=PREP_LAYOUT;
  const counter=FRONT_STATIONS.counter,griddle=FRONT_STATIONS.griddle;
  // 바 상판 위이면서, 철판 오른쪽 끝을 넘어선 지점부터 놓습니다.
  const griddleRight=griddle.x+griddle.w;
  const left=Math.max(counter.x+L.marginLeft, griddleRight+L.boxW/2+L.griddleGap);
  const right=Math.min(counter.x+counter.w-L.marginRight, L.rightLimit);
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
    const closestX=clamp(state.player.x,item.x-PREP_LAYOUT.boxW/2,item.x+PREP_LAYOUT.boxW/2);
    // 준비 카운터 쪽으로 기준점을 지나 끝까지 붙어도 같은 접근으로 봅니다.
    const yDistance=state.player.y>=item.iy?0:item.iy-state.player.y;
    const itemDistance=Math.hypot(state.player.x-closestX,yDistance);
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
    }else if(item.task.objectKind==="shrimpCoat"){
      ctx.fillStyle="#e69a78";ctx.beginPath();ctx.arc(item.x-4,item.y-8,20,.3,Math.PI*1.75);ctx.lineWidth=7;ctx.strokeStyle="#f1b18c";ctx.stroke();
    }else if(item.task.objectKind==="breadcrumbs"){
      ctx.fillStyle="#d8ad61";roundRect(ctx,item.x-27,item.y-20,54,27,7,true,false);ctx.fillStyle="#f2d791";for(let n=0;n<7;n++)ctx.fillRect(item.x-20+(n%4)*12,item.y-15+Math.floor(n/4)*9,4,3);
    }else if(item.task.objectKind==="tteokBowl"){
      ctx.fillStyle="#bfc9cc";ctx.beginPath();ctx.ellipse(item.x,item.y-7,29,16,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=done?"#8bc4d4":"#5d6b6e";ctx.beginPath();ctx.ellipse(item.x,item.y-10,23,10,0,0,Math.PI*2);ctx.fill();
      if(done){ctx.fillStyle="#f2e5c5";for(let n=0;n<5;n++){ctx.save();ctx.translate(item.x-14+n*7,item.y-11+(n%2)*4);ctx.rotate(-.3+n*.12);roundRect(ctx,-5,-2,10,5,3,true,false);ctx.restore();}}
    }else if(item.task.objectKind==="tteokCut"){
      ctx.fillStyle="#91ad57";ctx.beginPath();ctx.arc(item.x-18,item.y-9,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e0a457";roundRect(ctx,item.x-3,item.y-18,29,18,4,true,false);ctx.fillStyle="#d9e3bd";ctx.fillRect(item.x-25,item.y+2,48,6);
    }else if(item.task.objectKind==="potato"){
      ctx.fillStyle="#b88a4d";ctx.beginPath();ctx.ellipse(item.x,item.y-10,27,17,-.12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#d8dadd";ctx.fillRect(item.x-30,item.y+5,60,5);
    }else if(item.task.objectKind==="potatoBasket"){
      ctx.strokeStyle="#c38b43";ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(item.x,item.y-7,29,16,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#e8c56e";for(let n=0;n<5;n++)ctx.fillRect(item.x-21+n*9,item.y-12+(n%2)*5,5,17);
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
