"use strict";

/* ============================================================
   주방 집기 9종 (냉장고 · 싱크대 · 도마 · 냄비 · 후라이팬 ·
                  직화구이 · 튀김기 · 식기세척기 · 쓰레기통)
   ------------------------------------------------------------
   담당 범위: 집기 배치 좌표 · 상호작용 지점 · 집기 드로잉

   담당 범위가 아님: 조리 규칙, 미니게임, 어떤 집기를 써야 하는지
              → game.js / day.js / night.js

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   [현재 상태] 에셋이 아직 없어 전부 캔버스 도형으로 그린 플레이스홀더입니다.
              에셋이 들어오면 counter.js 처럼 Phaser 이미지로 교체하면 됩니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 배치표
   ------------------------------------------------------------
   x, y, w, h  집기 몸통 사각형
   ix, iy      요리사가 서는 상호작용 지점
   facing      그 자리에서 요리사가 바라보는 방향
   ------------------------------------------------------------ */

const STATIONS = {
  fridge:     {id:"fridge",    label:"냉장고",    x:220,y:205,w:78,h:194,ix:259,iy:420,facing:"up"},
  sink:       {id:"sink",      label:"싱크대",    x:306,y:300,w:88,h:68, ix:350,iy:420,facing:"up"},
  board:      {id:"board",     label:"도마",      x:402,y:300,w:88,h:68, ix:446,iy:420,facing:"up"},
  pot:        {id:"pot",       label:"냄비",      x:498,y:300,w:88,h:68, ix:542,iy:420,facing:"up"},
  pan:        {id:"pan",       label:"후라이팬",  x:594,y:300,w:88,h:68, ix:638,iy:420,facing:"up"},
  grill:      {id:"grill",     label:"직화구이",  x:690,y:300,w:96,h:68, ix:738,iy:420,facing:"up"},
  fryer:      {id:"fryer",     label:"튀김기",    x:794,y:300,w:82,h:68, ix:835,iy:420,facing:"up"},
  dishwasher: {id:"dishwasher",label:"식기세척기",x:884,y:300,w:82,h:68, ix:925,iy:420,facing:"up"},
  trash:      {id:"trash",     label:"쓰레기통",  x:974,y:300,w:68,h:68, ix:1008,iy:420,facing:"up"}
};

// 이 거리 안에 들어와야 집기를 쓸 수 있습니다.
const STATION_REACH = 40;


/* 이름표 둥실 (counter.js 의 COUNTER_FLOAT 과 같은 연출)
   ------------------------------------------------------------
   앞쪽 계산대·철판 명패는 counter.js 가 Phaser 컨테이너를 흔들지만,
   주방 이름표는 프레임 캔버스에 매 프레임 다시 그리는 도형이라
   같은 움직임을 여기서 직접 계산합니다.

   [진폭이 counter.js 와 다른 이유] 저쪽은 VIEW(1920x1080) 좌표,
   여기는 논리(1280x720) 좌표라서 같은 크기로 보이려면 1.5 로 나눠야
   합니다. 2 → 1.3 / 7 → 4.7 이 그 값입니다.
   주기(freq)는 ms 당 라디안이라 좌표계와 무관하게 같습니다.
   연출을 바꿀 때는 두 파일을 같이 고치세요.
   ------------------------------------------------------------ */
const STATION_FLOAT = {
  idle:   { amp:1.3, freq:0.0018 },   // 약 1.3px / 3.5초
  active: { amp:4.7, freq:0.0040 },   // 약 4.7px / 1.6초
  lerp:   0.05,                       // 진폭·주기·배율 보간 계수
  activeScale: 1.03,
  idleText:   "#f0c87b", activeText:  "#fff2d2",
  idleLine:   "#9a6235", activeLine:  "#d69a52"
};

// 이름표별 둥실 상태. 위상은 누적시켜서 진폭이 바뀌어도 튀지 않습니다.
// 시작 위상을 흩어 놓아야 9개가 한 몸처럼 오르내리지 않습니다.
const stationFloats = {};
let stationFloatLast = 0;

function stationFloatState(id){
  return stationFloats[id] || (stationFloats[id] = {
    phase:Math.random()*Math.PI*2,
    amp:STATION_FLOAT.idle.amp,
    freq:STATION_FLOAT.idle.freq,
    scale:1
  });
}


/* ------------------------------------------------------------
   2. 상호작용 판정
   ------------------------------------------------------------ */

function nearestStation(){
  let best=null, bestD=999;
  Object.values(STATIONS).forEach(s=>{
    const d=distance(state.player.x,state.player.y,s.ix,s.iy);
    if(d<bestD){best=s;bestD=d;}
  });
  return bestD<STATION_REACH?best:null;
}


/* ------------------------------------------------------------
   3. 드로잉
   ------------------------------------------------------------
   game.js 의 draw() 가 레이어 순서에 맞춰 drawStations() 를 부릅니다.
   ------------------------------------------------------------ */

// 집기 몸통은 요리사 뒤(back 층), 이름표는 요리사 앞(front 층)에 그립니다.
// 이름표까지 뒤로 보내면 집기 앞에 선 요리사가 이름표를 가려서 안 보입니다.
function drawStations(){ Object.values(STATIONS).forEach(drawStation); }

// 둥실 계산에 필요한 delta 와 "지금 쓸 수 있는 집기"는 9개가 공유하므로
// 여기서 한 번만 구해서 넘깁니다. (nearestStation 을 9번 돌 필요가 없습니다)
function drawStationLabels(){
  const now=performance.now();
  // 첫 프레임과 탭 복귀 직후를 대비해 상한을 둡니다. 안 두면 위상이 크게 튑니다.
  const delta=stationFloatLast?Math.min(50,now-stationFloatLast):16;
  stationFloatLast=now;
  const near=nearestStation();
  Object.values(STATIONS).forEach(s=>labelStation(s,delta,near));
}

/* 이름표 한 장.
   앞쪽 명패와 같은 규칙으로, 요리사가 그 집기를 쓸 수 있는 자리에 섰거나
   실제로 사용 중일 때 크게·밝게 둥실댑니다. (counter.js §4-3 과 같은 조건) */
function labelStation(s,delta,near){
  const f=stationFloatState(s.id);
  const active=state.mini?.stationId===s.id||near?.id===s.id;
  const target=active?STATION_FLOAT.active:STATION_FLOAT.idle;
  const k=STATION_FLOAT.lerp;

  f.amp +=(target.amp -f.amp )*k;
  f.freq+=(target.freq-f.freq)*k;
  f.scale+=((active?STATION_FLOAT.activeScale:1)-f.scale)*k;
  f.phase+=f.freq*delta;

  const x=s.x+8,w=s.w-16,h=23;
  const y=s.y-25+Math.sin(f.phase)*f.amp;
  const cx=x+w/2,cy=y+h/2;

  ctx.save();
  // 명패가 커질 때 중심이 고정되도록 중심으로 옮겼다가 되돌립니다.
  ctx.translate(cx,cy);ctx.scale(f.scale,f.scale);ctx.translate(-cx,-cy);
  ctx.fillStyle="#1a0e09";roundRect(ctx,x,y,w,h,5,true,false);
  ctx.strokeStyle=active?STATION_FLOAT.activeLine:STATION_FLOAT.idleLine;
  ctx.lineWidth=2;roundRect(ctx,x,y,w,h,5,false,true);
  ctx.fillStyle=active?STATION_FLOAT.activeText:STATION_FLOAT.idleText;
  ctx.font="bold 13px Malgun Gothic";ctx.textAlign="center";
  ctx.fillText(s.label,cx,y+16);ctx.textAlign="left";
  ctx.restore();
}

function drawStation(s){
  const working=state.mini?.stationId===s.id,t=performance.now()/1000;
  ctx.fillStyle="#332117";ctx.fillRect(s.x,s.y,s.w,s.h);ctx.strokeStyle="#7f5130";ctx.lineWidth=4;ctx.strokeRect(s.x,s.y,s.w,s.h);
  if(s.id==="fridge"){
    ctx.fillStyle="#7c8b82";ctx.fillRect(s.x+8,s.y+7,s.w-16,s.h-14);ctx.fillStyle="#b7c2b8";ctx.fillRect(s.x+14,s.y+18,s.w-28,64);ctx.fillRect(s.x+14,s.y+94,s.w-28,76);ctx.strokeStyle="#46554e";ctx.strokeRect(s.x+14,s.y+18,s.w-28,64);ctx.strokeRect(s.x+14,s.y+94,s.w-28,76);ctx.fillStyle="#2e3c37";ctx.fillRect(s.x+s.w-18,s.y+44,5,22);ctx.fillRect(s.x+s.w-18,s.y+124,5,22);
  } else if(s.id==="sink"){
    ctx.fillStyle="#a8a497";ctx.fillRect(s.x+8,s.y+10,s.w-16,48);ctx.fillStyle="#4e5b5b";ctx.beginPath();ctx.ellipse(s.x+s.w/2,s.y+32,42,18,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#c9c6b9";ctx.lineWidth=5;ctx.beginPath();ctx.arc(s.x+70,s.y+10,18,Math.PI,0);ctx.stroke();if(working){ctx.fillStyle="#b9e7ed";for(let i=0;i<7;i++)ctx.beginPath(),ctx.arc(s.x+30+i*12,s.y+35+Math.sin(t*8+i)*7,4,0,Math.PI*2),ctx.fill();}
  } else if(s.id==="board"){
    ctx.fillStyle="#c99558";ctx.fillRect(s.x+15,s.y+14,s.w-30,46);ctx.strokeStyle="#6c3d20";ctx.strokeRect(s.x+15,s.y+14,s.w-30,46);ctx.save();ctx.translate(s.x+s.w*.62,s.y+35);ctx.rotate(working?Math.sin(t*14)*.35:-.5);ctx.fillStyle="#cdd0cc";ctx.fillRect(-3,-28,7,44);ctx.fillStyle="#5f321e";ctx.fillRect(-4,16,9,18);ctx.restore();
  } else if(s.id==="pot"){
    ctx.fillStyle="#69645c";ctx.fillRect(s.x+8,s.y+10,s.w-16,52);ctx.fillStyle="#171717";ctx.beginPath();ctx.arc(s.x+s.w/2,s.y+36,26,0,Math.PI*2);ctx.fill();ctx.fillStyle=working?"#dd7433":"#41413d";ctx.beginPath();ctx.arc(s.x+s.w/2,s.y+36,17,0,Math.PI*2);ctx.fill();ctx.fillStyle="#97918a";ctx.beginPath();ctx.ellipse(s.x+s.w/2,s.y+22,36,12,0,0,Math.PI*2);ctx.fill();if(working)drawStationSteam(s.x+s.w/2,s.y+5,4);
  } else if(s.id==="pan"){
    ctx.fillStyle="#69645c";ctx.fillRect(s.x+8,s.y+10,s.w-16,52);ctx.fillStyle="#1b1918";ctx.beginPath();ctx.ellipse(s.x+s.w/2-5,s.y+34,27,19,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#8d867b";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(s.x+s.w/2+18,s.y+34);ctx.lineTo(s.x+s.w-5,s.y+20);ctx.stroke();if(working){ctx.fillStyle="#d05b31";for(let i=0;i<5;i++)ctx.fillRect(s.x+25+i*8,s.y+28+Math.sin(t*12+i)*4,7,5);}
  } else if(s.id==="grill"){
    ctx.fillStyle="#24211e";ctx.fillRect(s.x+9,s.y+10,s.w-18,54);ctx.strokeStyle="#7f7369";ctx.lineWidth=2;for(let i=0;i<6;i++){const lineX=s.x+17+i*(s.w-34)/5;ctx.beginPath();ctx.moveTo(lineX,s.y+14);ctx.lineTo(lineX,s.y+60);ctx.stroke();}for(let i=0;i<4;i++){ctx.strokeStyle="#a66d3d";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(s.x+18,s.y+25+i*10);ctx.lineTo(s.x+s.w-14,s.y+25+i*10+(working?Math.sin(t*10+i)*2:0));ctx.stroke();}if(working){ctx.fillStyle="#ef762f";for(let i=0;i<4;i++)ctx.fillRect(s.x+21+i*18,s.y+52+Math.sin(t*9+i)*4,6,10);}
  } else if(s.id==="fryer"){
    ctx.fillStyle="#817a6c";ctx.fillRect(s.x+8,s.y+8,s.w-16,57);ctx.fillStyle="#4f321f";ctx.fillRect(s.x+18,s.y+18,s.w-36,35);ctx.strokeStyle="#b6aa94";ctx.strokeRect(s.x+25,s.y+13,s.w-50,35);if(working){ctx.fillStyle="#e8b95f";for(let i=0;i<5;i++)ctx.beginPath(),ctx.arc(s.x+23+i*10,s.y+40+Math.sin(t*12+i)*7,3,0,Math.PI*2),ctx.fill();}
  } else if(s.id==="dishwasher"){
    ctx.fillStyle="#686b68";ctx.fillRect(s.x+8,s.y+8,s.w-16,s.h-16);ctx.fillStyle="#242726";ctx.beginPath();ctx.arc(s.x+s.w/2,s.y+38,Math.min(24,s.w*.30),0,Math.PI*2);ctx.fill();ctx.strokeStyle="#9ca29e";ctx.lineWidth=5;ctx.stroke();ctx.fillStyle=state.dirtyDishes?"#d39147":"#86a164";ctx.fillRect(s.x+s.w-20,s.y+14,10,7);
  } else if(s.id==="trash"){
    ctx.fillStyle="#444946";ctx.fillRect(s.x+12,s.y+18,s.w-24,s.h-14);ctx.fillStyle="#555c57";ctx.fillRect(s.x+7,s.y+11,s.w-14,12);ctx.fillStyle="#b5b9a9";ctx.font="18px sans-serif";ctx.fillText("♻",s.x+32,s.y+54);
  }
}

// 냄비에서 올라오는 김. 카운터 철판의 김(counter.js)과는 별개입니다.
function drawStationSteam(x,y,count){
  const t=performance.now()/700;
  ctx.strokeStyle="rgba(246,239,218,.7)";ctx.lineWidth=3;
  for(let i=0;i<count;i++){
    const ox=(i-count/2)*10,rise=((t+i*.23)%1)*25;
    ctx.globalAlpha=1-rise/25;
    ctx.beginPath();ctx.moveTo(x+ox,y-rise);
    ctx.bezierCurveTo(x+ox-6,y-rise-6,x+ox+6,y-rise-13,x+ox,y-rise-19);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}
