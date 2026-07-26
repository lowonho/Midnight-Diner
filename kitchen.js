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
  // 폭 117 → 124. 에셋(prop_trash_closed)의 몸통 비율 264:374 에 맞춘 값입니다.
  // 스펙 박스 그대로 두면 그림이 가로로 눌립니다. 세로·밑동·중심은 스펙 그대로입니다.
  // labelDy = 이름표를 내릴 거리(VIEW). 다른 집기는 몸통 위에 떠 있지만
  //           쓰레기통은 키가 작아 그러면 허공에 뜬 것처럼 보입니다.
  //           앞쪽 계산대·철판 명패(counter.js)처럼 몸통에 걸치게 내립니다.
  //           22 = 이름표 아랫변이 몸통 윗변보다 19 아래. 열린 뚜껑은
  //           이름표 뒤로 24 솟아 올라와 열린 게 그대로 보입니다.
  // x 1673 = 오른쪽 벽에 딱 붙인 자리입니다. 밑동 높이(y 786)에서 바닥이
  // 끝나는 지점이 x 1797 이고(bg_floor 실측 = 걷기영역 벽 사선과 일치),
  // 거기서 폭 124 를 뺀 값입니다. 더 밀면 밑동이 벽 속으로 들어갑니다.
  // 아래로도 못 내립니다 — 바 테이블 상판 뒷변이 y 780 이라 이미 6 걸쳐 있습니다.
  trash:      {label:"쓰레기통",  box:[1673,611,124,175], stand:[1591,730], facing:"right", labelDy:22}
};

// 게임 로직·드로잉이 쓰는 논리 좌표(1280x720) 사본.
// 좌표를 고칠 일이 있으면 위 STATION_SPEC 만 고치면 됩니다.
const STATIONS = Object.fromEntries(Object.entries(STATION_SPEC).map(([id,spec])=>[id,{
  id, label:spec.label, facing:spec.facing,
  x:toLogic(spec.box[0]), y:toLogic(spec.box[1]),
  w:toLogic(spec.box[2]), h:toLogic(spec.box[3]),
  ix:toLogic(spec.stand[0]), iy:toLogic(spec.stand[1]),
  labelDy:toLogic(spec.labelDy||0)
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
   1-1. 쓰레기통 에셋 (9종 중 유일하게 그림입니다)
   ------------------------------------------------------------
   나머지 8종은 아직 캔버스 도형 플레이스홀더입니다. (§3)
   에셋이 더 들어오면 이 블록과 같은 방식으로 하나씩 옮기면 됩니다.

   [파일] assets/utensils/counter/prop_trash_{closed,open}.webp
   PNG 가 원본이고 WebP 는 빌드 산출물입니다. (npm run build:utensils)
   WebP 를 못 읽는 브라우저면 자동으로 같은 이름의 PNG 로 되돌립니다.

   [정렬] 두 장 다 320x560 같은 캔버스에, 밑동(y 540)과 좌우(x 28~291)가
   똑같이 맞춰져 있습니다. 그래서 한 번 구한 사각형에 두 장을 그대로
   갈아 끼우면 몸통은 제자리에 있고 뚜껑만 위로 열립니다.
   body = 닫힘 상태의 불투명 영역. npm run verify:utensils 가 찍어 줍니다.

   [배율] 집기 몸통(STATIONS.trash) 높이에 body 높이를 맞춥니다.
   가로는 중심 정렬. 세로 기준으로 잡아야 바닥에 닿는 선이 어긋나지 않습니다.
   ------------------------------------------------------------ */

const TRASH_ART = {
  dir:"assets/utensils/counter/",
  file:{closed:"prop_trash_closed", open:"prop_trash_open"},
  canvas:{w:320,h:560},
  body:{x:28,y:167,w:264,h:374}
};

// 뚜껑이 열려 있는 시간. 음식을 폐기하는 순간 이 시간만큼 열렸다 닫힙니다.
const TRASH_OPEN_MS = 420;

/* 화면에 그릴 사각형(논리 좌표)을 한 번만 계산해 둡니다.
   VIEW 픽셀에 딱 떨어지게 반올림합니다 — 아래 미리 그려 둔 캔버스와
   1:1 로 맞아야 확대/축소 없이 그려집니다. */
const TRASH_RECT = (()=>{
  const s=STATIONS.trash,A=TRASH_ART;
  const scale=s.h/A.body.h;                                   // 논리 px / 에셋 px
  const snap=value=>toLogic(Math.round(toView(value)));
  return {
    x:snap(s.x+s.w/2-(A.body.x+A.body.w/2)*scale),            // 가로 중심 맞춤
    y:snap(s.y+s.h-(A.body.y+A.body.h)*scale),                // 밑동 맞춤
    w:snap(A.canvas.w*scale), h:snap(A.canvas.h*scale)
  };
})();

// 상태별로 "화면에 나올 크기 그대로" 미리 축소해 둔 캔버스.
// 매 프레임 320x560 원본을 축소하면 프레임마다 리샘플링이 돌아갑니다.
// 한 번만 줄여 두고 이후에는 1:1 복사만 합니다.
const trashArt = {};

function prerenderTrashArt(image){
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(toView(TRASH_RECT.w));
  canvas.height=Math.round(toView(TRASH_RECT.h));
  const g=canvas.getContext("2d");
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
  g.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}

function loadTrashArt(key,file,ext=".webp"){
  const image=new Image();
  image.onload=()=>{trashArt[key]=prerenderTrashArt(image);};
  image.onerror=()=>{
    if(ext===".webp"){loadTrashArt(key,file,".png");return;}   // WebP 미지원 브라우저
    console.warn(`쓰레기통 에셋을 불러오지 못했습니다: ${file} (도형 플레이스홀더로 그립니다)`);
  };
  image.src=`${TRASH_ART.dir}${file}${ext}`;
}
Object.entries(TRASH_ART.file).forEach(([key,file])=>loadTrashArt(key,file));

/* ------------------------------------------------------------
   1-2. 쓰레기통 통과 막기
   ------------------------------------------------------------
   요리사가 뒤에서 앞으로 쓰레기통을 뚫고 지나가지 못하게 합니다.
   뒤쪽 조리대 8종은 이동 영역 상한(chef-walk-area.js topY)이 이미 막고
   있어서 따로 필요 없습니다. 쓰레기통만 영역 한가운데에 서 있습니다.

   막는 범위는 "바닥에 닿는 자리"입니다. 그림 전체가 아니라 밑동에서
   TRASH_FOOT_DEPTH 만큼만 잡습니다. 그림 높이 전체를 막으면 통 뒤쪽
   먼 바닥까지 못 지나가서 벽이 두꺼워진 것처럼 느껴집니다.

   호출은 player.js movePlayer() 가 이동 직후에 한 번 합니다.
   ------------------------------------------------------------ */

const TRASH_FOOT_DEPTH = 46;   // VIEW. 통이 바닥에서 차지하는 앞뒤 두께

const TRASH_FOOT = (()=>{
  const s=STATIONS.trash,depth=toLogic(TRASH_FOOT_DEPTH);
  return {left:s.x, right:s.x+s.w, top:s.y+s.h-depth, bottom:s.y+s.h};
})();

/* 요리사를 쓰레기통 밖으로 밀어냅니다. 이동을 막는 게 아니라 위치만
   가장 가까운 변으로 되돌리므로, 통에 붙어서 좌우로 미끄러집니다.

   [오른쪽 변은 제외] 통이 오른쪽 벽에 붙어 있어 그쪽으로 밀면 걷기 영역
   밖(벽 속)으로 나갑니다. 들어올 수 있는 곳도 왼쪽·위·아래뿐입니다. */
function blockPlayerAtStations(player){
  const F=TRASH_FOOT;
  if(player.x<=F.left||player.x>=F.right||player.y<=F.top||player.y>=F.bottom)return player;

  const toLeft=player.x-F.left, toTop=player.y-F.top, toBottom=F.bottom-player.y;
  const nearest=Math.min(toLeft,toTop,toBottom);
  if(nearest===toTop)         player.y=F.top;
  else if(nearest===toBottom) player.y=F.bottom;
  else                        player.x=F.left;
  return player;
}


/* 지금 뚜껑이 열려 있는가.
   - 쓰레기 정리 미니게임 중에는 계속 열어 둡니다.
   - 음식을 폐기하면(night.js 가 state.discardedCount 를 올립니다)
     TRASH_OPEN_MS 동안 열렸다 닫힙니다.
   폐기 시점을 night.js 에서 알려 주는 대신 카운터 변화를 여기서 읽습니다.
   게임 로직 파일을 건드리지 않고 연출만 이 파일 안에서 끝내려는 것입니다. */
let trashOpenUntil = 0;
let trashDiscardSeen = null;

function trashIsOpen(){
  const discarded=state.discardedCount||0;
  // 첫 프레임(null)은 기준만 잡습니다. 이어하기로 값을 불러온 직후에
  // 열림 연출이 한 번 튀는 것을 막습니다.
  if(trashDiscardSeen!==null&&discarded>trashDiscardSeen) trashOpenUntil=performance.now()+TRASH_OPEN_MS;
  trashDiscardSeen=discarded;
  if(state.mini?.stationId==="trash")return true;
  return performance.now()<trashOpenUntil;
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
  // labelDy = 기본 위치에서 더 내릴 거리. 키 작은 집기가 이름표만 허공에
  // 띄우지 않도록 몸통 쪽으로 당길 때 씁니다. (§1 쓰레기통)
  const x=cx-w/2,y=s.y-25+(s.labelDy||0)+f.dy;

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
  if(s.id==="trash"&&drawTrashArt())return;   // 에셋이 준비됐으면 도형 대신 그림 한 장

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

/* 쓰레기통 그림 한 장. 그렸으면 true, 아직 못 불러왔으면 false 를 돌려주고
   도형 플레이스홀더로 넘깁니다. (§1-1)
   미리 축소해 둔 캔버스를 같은 크기로 얹기만 하므로 배율 계산이 없습니다. */
function drawTrashArt(){
  const art=trashArt[trashIsOpen()?"open":"closed"];
  if(!art)return false;
  ctx.drawImage(art,TRASH_RECT.x,TRASH_RECT.y,TRASH_RECT.w,TRASH_RECT.h);
  return true;
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
