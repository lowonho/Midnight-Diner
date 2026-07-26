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
   [단위] 이 표만 VIEW 좌표(1920x1080)입니다.
   에셋 스펙(asset_regions_detail v4 · 본체 9종)이 VIEW 로 들어오기 때문에
   받은 숫자를 그대로 옮겨 적고, 게임이 쓰는 논리 좌표(1280x720)는
   아래에서 toLogic() 으로 한 번에 만듭니다. (chef-walk-area.js 와 같은 방식)

   box   [x, y, w, h]  집기 몸통 사각형 — 스펙값 그대로
   stand [x, y]        요리사가 서는 상호작용 지점 (발끝 기준)
   facing              그 자리에서 요리사가 바라보는 방향

   [stand y 640] 뒤쪽 조리대는 전부 같은 줄에 섭니다.
   요리사 이동 영역 상한이 y=614(chef-walk-area.js) 라서 조리대 접지선
   바로 아래인 640 이 "붙어 서는" 자리입니다. 더 올리면 클램프에 걸려
   집기에 닿지 못하고, 더 내리면 집기에서 떨어져 보입니다.

   [쓰레기통] 뒤쪽 조리대 줄에서 빠져나와 오른쪽 앞 바닥에 놓입니다.
   (레퍼런스 이미지 배치) 그래서 stand 도 뒤쪽 줄이 아니라 쓰레기통
   왼쪽 옆(1575,730)이고, 바라보는 방향만 오른쪽입니다.
   앞뒤 겹침 처리는 §3 의 trashInFront() 를 보세요.
   ------------------------------------------------------------ */

const STATION_SPEC = {
  fridge:     {label:"냉장고",    box:[ 229,233,231,393], stand:[ 344,640], facing:"up"},
  sink:       {label:"싱크대",    box:[ 439,374,219,231], stand:[ 548,640], facing:"up"},
  board:      {label:"도마",      box:[ 655,392,185,225], stand:[ 747,640], facing:"up"},
  pot:        {label:"냄비",      box:[ 824,405,142,208], stand:[ 895,640], facing:"up"},
  pan:        {label:"후라이팬",  box:[ 971,405,133,208], stand:[1037,640], facing:"up"},
  grill:      {label:"직화구이",  box:[1098,405,192,208], stand:[1194,640], facing:"up"},
  fryer:      {label:"튀김기",    box:[1294,405,123,208], stand:[1355,640], facing:"up"},
  dishwasher: {label:"식기세척기",box:[1420,374,119,234], stand:[1479,640], facing:"up"},
  trash:      {label:"쓰레기통",  box:[1660,611,117,175], stand:[1575,730], facing:"right"}
};

// 게임 로직·드로잉이 쓰는 논리 좌표(1280x720) 사본.
// 좌표를 고칠 일이 있으면 위 STATION_SPEC 만 고치면 됩니다.
const STATIONS = Object.fromEntries(Object.entries(STATION_SPEC).map(([id,spec])=>[id,{
  id, label:spec.label, facing:spec.facing,
  x:toLogic(spec.box[0]), y:toLogic(spec.box[1]),
  w:toLogic(spec.box[2]), h:toLogic(spec.box[3]),
  ix:toLogic(spec.stand[0]), iy:toLogic(spec.stand[1])
}]));

/* 이 거리(논리 좌표) 안에 들어와야 집기를 쓸 수 있습니다.
   40 → 55. 에셋 스펙대로 집기가 커지면서(냉장고 78→154 폭) 40 으로는
   집기 앞에 서 있는데도 손이 닿지 않는 자리가 생겼습니다.
   상호작용 지점 간격이 가장 좁은 곳이 83(튀김기↔식기세척기)이라
   55 까지는 겹쳐도 nearestStation() 이 더 가까운 쪽을 고릅니다. */
const STATION_REACH = 55;


// 이름표 둥실 값(진폭·주기·강조색)은 낮 준비물과 공유합니다.
// → draw-utils.js 의 LABEL_FLOAT / labelFloatStep()


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

/* "지금 이 집기에 E 를 누를 수 있는가"
   ------------------------------------------------------------
   가까이 서 있는 것만으로는 부족합니다. game.js 의 updatePrompt() 가
   실제로 "E · …" 프롬프트를 띄우는 조건과 같아야, 이름표가 크게
   둥실대는 순간 = 정말 쓸 수 있는 순간이 됩니다.

     낮          주방 집기는 쓰지 않습니다 (앞 테이블 준비물만 만집니다)
     밤 · 들고 감  쓰레기통에 폐기할 때만
     밤          설거지·쓰레기 정리는 쌓였을 때, 나머지는 현재 조리 단계 집기만
     미니게임 중   그 집기만 (프롬프트는 숨지만 사용 중이므로 계속 강조)

   [주의] 판정 규칙 자체는 game.js 가 주인입니다. 그쪽 조건이 바뀌면
   여기도 같이 고쳐야 이름표와 프롬프트가 어긋나지 않습니다.
   ------------------------------------------------------------ */
function stationUsable(s,near){
  if(state.mini)return state.mini.stationId===s.id;
  if(state.paused||near?.id!==s.id||state.phase!=="night")return false;
  if(state.carrying){
    if(s.id!=="trash")return false;
    const dish=dishById(state.carrying.dishId);
    return !!dish&&state.inventory[dish.id]?.count>0;
  }
  if(s.id==="dishwasher")return state.dirtyDishes>0;
  if(s.id==="trash")     return state.trash>0;
  return s.id===currentRequirement();
}


/* ------------------------------------------------------------
   3. 드로잉
   ------------------------------------------------------------
   game.js 의 draw() 가 레이어 순서에 맞춰 drawStations() 를 부릅니다.
   ------------------------------------------------------------ */

// 집기 몸통은 요리사 뒤(back 층), 이름표는 요리사 앞(front 층)에 그립니다.
// 이름표까지 뒤로 보내면 집기 앞에 선 요리사가 이름표를 가려서 안 보입니다.
//
// 예외가 쓰레기통 하나입니다. 뒤쪽 조리대와 달리 앞쪽 바닥에 서 있어서
// 요리사가 그 뒤로 돌아갈 수 있고, 그때는 쓰레기통이 요리사를 가려야 합니다.
// 그래서 접지선(몸통 아랫변) 기준으로 앞뒤를 갈라 그립니다. (trashInFront)
function drawStations(){
  const trashFront=trashInFront();
  Object.values(STATIONS).forEach(s=>{
    if(s.id==="trash"&&trashFront)return;   // 앞 층에서 그립니다
    drawStation(s);
  });
}

// "가장 가까운 집기"는 9개가 공유하므로 여기서 한 번만 구해서 넘깁니다.
// (nearestStation 을 9번 돌 필요가 없습니다)
function drawStationLabels(){
  if(trashInFront()) drawStation(STATIONS.trash);
  const near=nearestStation();
  Object.values(STATIONS).forEach(s=>labelStation(s,near));
}

// 요리사 발끝이 쓰레기통 접지선보다 위 = 요리사가 더 뒤 = 쓰레기통이 앞.
function trashInFront(){
  const s=STATIONS.trash;
  return (state?.player?.y ?? 0) < s.y+s.h;
}

// 이름표 글자 좌우 여백. 명판 길이를 조절하려면 이 값만 만지면 됩니다.
// (12 → 3글자 이름표가 약 63px. 예전 88폭 집기의 명판 72px 과 비슷합니다)
const LABEL_PAD_X = 12;

/* 이름표 한 장.
   E 를 눌러 실제로 쓸 수 있을 때만 크게·밝게 둥실댑니다.
   앞에 서 있기만 해서는 강조되지 않습니다. (stationUsable 참고)
   둥실 계산은 낮 준비물과 공유합니다. (draw-utils.js labelFloatStep) */
function labelStation(s,near){
  const active=stationUsable(s,near);
  const f=labelFloatStep(`station_${s.id}`,active);

  /* 이름표 폭은 "글자 폭 + 좌우 여백"입니다. 집기 폭을 따라가면
     냉장고(154)·세면대(146) 같은 큰 집기에서 명판만 길쭉해집니다.
     집기가 커져도 명판은 글자 길이만큼만 커집니다. */
  ctx.font="bold 13px Malgun Gothic";
  const h=23,cx=s.x+s.w/2;
  const w=Math.round(ctx.measureText(s.label).width)+LABEL_PAD_X*2;
  const x=cx-w/2,y=s.y-25+f.dy;

  ctx.save();
  applyLabelScale(f.scale,cx,y+h/2);
  ctx.fillStyle="#1a0e09";roundRect(ctx,x,y,w,h,5,true,false);
  ctx.strokeStyle=active?LABEL_FLOAT.activeLine:FIXTURE_LABEL.line;
  ctx.lineWidth=2;roundRect(ctx,x,y,w,h,5,false,true);
  ctx.fillStyle=active?LABEL_FLOAT.activeText:FIXTURE_LABEL.text;
  ctx.textAlign="center";
  ctx.fillText(s.label,cx,y+16);ctx.textAlign="left";
  ctx.restore();
}

/* 집기 하나.
   ------------------------------------------------------------
   [비율로 그리는 이유] 에셋 스펙이 집기마다 가로세로를 다르게 줍니다.
   (냄비 95x139, 직화구이 128x139, 냉장고 154x262 …)
   그래서 픽셀 상수 대신 몸통 크기에 대한 비율로 그립니다.
   §1 의 box 값만 고쳐도 그림이 알아서 따라옵니다.

   조리대 6종(싱크대~튀김기)은 "상판 + 하부장" 두 단으로 나눕니다.
   상판 비율 STATION_TOP_RATIO 위쪽에 조리 도구를, 아래에 하부장을 그립니다. */

const STATION_TOP_RATIO = {sink:.46,board:.46,pot:.45,pan:.45,grill:.45,fryer:.45};

function drawStation(s){
  const working=state.mini?.stationId===s.id,t=performance.now()/1000;
  ctx.fillStyle="#332117";ctx.fillRect(s.x,s.y,s.w,s.h);ctx.strokeStyle="#7f5130";ctx.lineWidth=4;ctx.strokeRect(s.x,s.y,s.w,s.h);

  if(s.id==="fridge"){
    const pad=s.w*.07;
    ctx.fillStyle="#7c8b82";ctx.fillRect(s.x+pad,s.y+pad*.7,s.w-pad*2,s.h-pad*1.4);
    ctx.fillStyle="#b7c2b8";ctx.strokeStyle="#46554e";ctx.lineWidth=2;
    const doorX=s.x+s.w*.12,doorW=s.w*.76;
    [[.07,.33],[.47,.42]].forEach(([top,height])=>{           // 위·아래 문 두 짝
      ctx.fillRect(doorX,s.y+s.h*top,doorW,s.h*height);ctx.strokeRect(doorX,s.y+s.h*top,doorW,s.h*height);
    });
    ctx.fillStyle="#2e3c37";                                  // 손잡이
    ctx.fillRect(s.x+s.w-s.w*.17,s.y+s.h*.20,s.w*.04,s.h*.10);
    ctx.fillRect(s.x+s.w-s.w*.17,s.y+s.h*.60,s.w*.04,s.h*.10);
  } else if(s.id==="dishwasher"){
    ctx.fillStyle="#686b68";ctx.fillRect(s.x+8,s.y+8,s.w-16,s.h-16);
    const cx=s.x+s.w/2,cy=s.y+s.h*.34,r=Math.min(s.w*.30,s.h*.20);
    ctx.fillStyle="#242726";ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#9ca29e";ctx.lineWidth=5;ctx.stroke();
    ctx.fillStyle=state.dirtyDishes?"#d39147":"#86a164";ctx.fillRect(s.x+s.w-22,s.y+16,10,7);
    ctx.strokeStyle="#565a57";ctx.lineWidth=2;                // 아래쪽 조작 패널 선
    ctx.strokeRect(s.x+14,s.y+s.h*.60,s.w-28,s.h*.30);
  } else if(s.id==="trash"){
    const lidH=s.h*.12,bodyY=s.y+s.h*.16;
    ctx.fillStyle="#444946";ctx.fillRect(s.x+s.w*.13,bodyY,s.w*.74,s.y+s.h-bodyY-4);
    ctx.fillStyle="#555c57";ctx.fillRect(s.x+s.w*.07,s.y+s.h*.05,s.w*.86,lidH);
    ctx.fillStyle="#b5b9a9";ctx.font=`${Math.round(s.w*.34)}px sans-serif`;ctx.textAlign="center";
    ctx.fillText("♻",s.x+s.w/2,s.y+s.h*.62);ctx.textAlign="left";
  } else {
    const topH=s.h*(STATION_TOP_RATIO[s.id]||.45);
    drawStationCabinet(s,topH);
    drawStationTop(s,{x:s.x+8,y:s.y+8,w:s.w-16,h:topH-8},working,t);
  }
}

/* 조리대 아래 하부장. 안쪽에 선반 두 칸을 그어 높이를 읽히게 합니다.
   (스펙이 조리면만이 아니라 하부장까지 포함한 높이를 주기 때문에
    이 칸을 비워 두면 집기가 통짜 상자로 보입니다) */
function drawStationCabinet(s,topH){
  const x=s.x+6,y=s.y+topH,w=s.w-12,h=s.h-topH-6;
  ctx.fillStyle="#2b1c14";ctx.fillRect(x,y,w,h);
  ctx.strokeStyle="#5d3a22";ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(x,y+h*i/3);ctx.lineTo(x+w,y+h*i/3);ctx.stroke();}
}

// 상판 위 조리 도구. T = 상판 사각형(집기 몸통 안쪽 윗단).
function drawStationTop(s,T,working,t){
  const cx=T.x+T.w/2;
  if(s.id==="sink"){
    ctx.fillStyle="#a8a497";ctx.fillRect(T.x,T.y,T.w,T.h);
    ctx.fillStyle="#4e5b5b";ctx.beginPath();ctx.ellipse(cx,T.y+T.h*.58,T.w*.40,T.h*.28,0,0,Math.PI*2);ctx.fill();
    // 수도꼭지. 호(弧)의 반지름만큼 위로 솟으므로 중심을 상판 안쪽에 둬야
    // 몸통 윗변 밖으로 삐져나오지 않습니다.
    ctx.strokeStyle="#c9c6b9";ctx.lineWidth=5;ctx.beginPath();ctx.arc(T.x+T.w*.78,T.y+T.h*.20,T.w*.13,Math.PI,0);ctx.stroke();
    if(working){ctx.fillStyle="#b9e7ed";for(let i=0;i<7;i++)ctx.beginPath(),ctx.arc(T.x+T.w*.18+i*T.w*.11,T.y+T.h*.6+Math.sin(t*8+i)*7,4,0,Math.PI*2),ctx.fill();}
  } else if(s.id==="board"){
    ctx.fillStyle="#c99558";ctx.fillRect(T.x+T.w*.08,T.y+T.h*.18,T.w*.84,T.h*.74);
    ctx.strokeStyle="#6c3d20";ctx.lineWidth=2;ctx.strokeRect(T.x+T.w*.08,T.y+T.h*.18,T.w*.84,T.h*.74);
    ctx.save();ctx.translate(T.x+T.w*.62,T.y+T.h*.5);ctx.rotate(working?Math.sin(t*14)*.35:-.5);
    ctx.fillStyle="#cdd0cc";ctx.fillRect(-3,-T.h*.5,7,T.h*.78);
    ctx.fillStyle="#5f321e";ctx.fillRect(-4,T.h*.28,9,T.h*.3);ctx.restore();
  } else if(s.id==="pot"){
    ctx.fillStyle="#69645c";ctx.fillRect(T.x,T.y+T.h*.16,T.w,T.h*.84);
    const py=T.y+T.h*.60,r=Math.min(T.w*.32,T.h*.42);
    ctx.fillStyle="#171717";ctx.beginPath();ctx.arc(cx,py,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=working?"#dd7433":"#41413d";ctx.beginPath();ctx.arc(cx,py,r*.65,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#97918a";ctx.beginPath();ctx.ellipse(cx,py-r*.55,r*1.35,r*.45,0,0,Math.PI*2);ctx.fill();
    if(working)drawStationSteam(cx,T.y-3,4);
  } else if(s.id==="pan"){
    ctx.fillStyle="#69645c";ctx.fillRect(T.x,T.y+T.h*.16,T.w,T.h*.84);
    const py=T.y+T.h*.58,rx=T.w*.32,ry=T.h*.30;
    ctx.fillStyle="#1b1918";ctx.beginPath();ctx.ellipse(cx-T.w*.06,py,rx,ry,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#8d867b";ctx.lineWidth=5;ctx.beginPath();
    ctx.moveTo(cx-T.w*.06+rx,py);ctx.lineTo(T.x+T.w-4,py-T.h*.22);ctx.stroke();
    if(working){ctx.fillStyle="#d05b31";for(let i=0;i<5;i++)ctx.fillRect(cx-rx+i*rx*.4,py-6+Math.sin(t*12+i)*4,7,5);}
  } else if(s.id==="grill"){
    ctx.fillStyle="#24211e";ctx.fillRect(T.x,T.y+T.h*.10,T.w,T.h*.90);
    ctx.strokeStyle="#7f7369";ctx.lineWidth=2;                       // 석쇠살
    for(let i=0;i<6;i++){const lineX=T.x+T.w*.08+i*T.w*.168;ctx.beginPath();ctx.moveTo(lineX,T.y+T.h*.16);ctx.lineTo(lineX,T.y+T.h*.94);ctx.stroke();}
    ctx.strokeStyle="#a66d3d";ctx.lineWidth=4;                       // 꼬치
    for(let i=0;i<4;i++){const skewerY=T.y+T.h*.3+i*T.h*.17;ctx.beginPath();ctx.moveTo(T.x+T.w*.08,skewerY);ctx.lineTo(T.x+T.w*.92,skewerY+(working?Math.sin(t*10+i)*2:0));ctx.stroke();}
    if(working){ctx.fillStyle="#ef762f";for(let i=0;i<4;i++)ctx.fillRect(T.x+T.w*.12+i*T.w*.22,T.y+T.h*.82+Math.sin(t*9+i)*4,6,10);}
  } else if(s.id==="fryer"){
    ctx.fillStyle="#817a6c";ctx.fillRect(T.x,T.y,T.w,T.h);
    ctx.fillStyle="#4f321f";ctx.fillRect(T.x+T.w*.15,T.y+T.h*.22,T.w*.70,T.h*.60);   // 기름
    ctx.strokeStyle="#b6aa94";ctx.lineWidth=2;ctx.strokeRect(T.x+T.w*.25,T.y+T.h*.12,T.w*.50,T.h*.62);  // 바스켓
    if(working){ctx.fillStyle="#e8b95f";for(let i=0;i<5;i++)ctx.beginPath(),ctx.arc(T.x+T.w*.22+i*T.w*.15,T.y+T.h*.55+Math.sin(t*12+i)*7,3,0,Math.PI*2),ctx.fill();}
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
