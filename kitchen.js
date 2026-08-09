"use strict";

/* ============================================================
   주방 집기 9종 (냉장고 · 싱크대 · 도마 · 냄비 · 후라이팬 ·
                  직화구이 · 튀김기 · 식기세척기 · 쓰레기통)
   ------------------------------------------------------------
   담당 범위: 집기 배치 좌표 · 상호작용 지점 · 집기 드로잉

   담당 범위가 아님: 조리 규칙, 미니게임, 어떤 집기를 써야 하는지
              → game.js / day.js / night.js

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   [현재 상태] 9종 전부 그림 에셋입니다. (§1-1)
              에셋을 못 불러왔을 때만 §3 의 캔버스 도형으로 대신 그립니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 배치표
   ------------------------------------------------------------
   [단위] 이 절은 전부 VIEW 좌표(1920x1080)입니다.
   에셋 스펙과 실측값이 VIEW 로 들어오기 때문에 받은 숫자를 그대로 적고,
   게임이 쓰는 논리 좌표(1280x720)는 아래에서 toLogic() 으로 한 번에
   만듭니다. (chef-walk-area.js 와 같은 방식)

   stand [x, y]        요리사가 서는 상호작용 지점 (발끝 기준)
   facing              그 자리에서 요리사가 바라보는 방향

   집기 몸통 사각형은 손으로 적지 않습니다. §1-1 STATION_ART 의 배치값
   (가로 중심·폭·접지선)에서 계산합니다. 그림과 판정 사각형이 따로 놀면
   이름표가 집기에서 떠 보이기 때문에 한 곳에서만 정합니다.

   [stand x] 뒤쪽 8종은 집기 가로 중심(STATION_ART 의 cx)과 같은 값입니다.
   집기를 옮기면 서는 자리도 같이 옮겨야 "집기 앞에 섰는데 다른 집기가
   잡히는" 일이 없습니다.

   [stand y 640] 뒤쪽 조리대는 전부 같은 줄에 섭니다.
   요리사 이동 영역 상한이 y=614(chef-walk-area.js) 라서 조리대 접지선
   바로 아래인 640 이 "붙어 서는" 자리입니다. 더 올리면 클램프에 걸려
   집기에 닿지 못하고, 더 내리면 집기에서 떨어져 보입니다.

   [쓰레기통] 뒤쪽 조리대 줄에서 빠져나와 오른쪽 앞 바닥에 놓입니다.
   (레퍼런스 이미지 배치) 그래서 stand 도 뒤쪽 줄이 아니라 쓰레기통
   왼쪽 옆(1591,730)이고, 바라보는 방향만 오른쪽입니다.
   앞뒤 겹침 처리는 §3 의 trashInFront() 를 보세요.
   ------------------------------------------------------------ */

/* [hideLabel] 몸통 위에 뜨는 이름표만 안 그립니다. label 값 자체는 지우면
   안 됩니다 — 안내 토스트("먼저 싱크대에서…")·현재 목표 칸·상호작용 프롬프트가
   전부 이 글자를 씁니다 (game.js · night.js · story.js). 이름표를 다시 켜려면
   그 줄만 지우면 됩니다. */
const STATION_SPEC = {
  fridge:     {label:"냉장고",    stand:[ 435,640], facing:"up"},
  sink:       {label:"싱크대",    stand:[ 646,640], facing:"up", hideLabel:true},
  board:      {label:"도마",      stand:[ 830,640], facing:"up"},
  pot:        {label:"냄비",      stand:[ 982,640], facing:"up"},
  pan:        {label:"후라이팬",  stand:[1114,640], facing:"up"},
  grill:      {label:"직화구이",  stand:[1264,640], facing:"up"},
  fryer:      {label:"튀김기",    stand:[1415,640], facing:"up"},
  dishwasher: {label:"식기세척기",stand:[1536,640], facing:"up", hideLabel:true},
  // labelDy = 이름표를 내릴 거리(VIEW). 다른 집기는 몸통 위에 떠 있지만
  //           쓰레기통은 키가 작아 그러면 허공에 뜬 것처럼 보입니다.
  //           앞쪽 계산대·철판 명패(counter.js)처럼 몸통에 걸치게 내립니다.
  //           22 = 이름표 아랫변이 몸통 윗변보다 19 아래. 열린 뚜껑은
  //           이름표 뒤로 24 솟아 올라와 열린 게 그대로 보입니다.
  trash:      {label:"쓰레기통",  stand:[1591,730], facing:"right", labelDy:22}
};


/* ------------------------------------------------------------
   1-1. 집기 에셋 9종
   ------------------------------------------------------------
   [파일] assets/utensils/counter/<이름>.webp
   PNG 가 원본이고 WebP 는 빌드 산출물입니다. (npm run build:utensils)
   WebP 를 못 읽는 브라우저면 자동으로 같은 이름의 PNG 로 되돌립니다.
   WebP 는 화면에서 쓰는 크기에 맞춰 줄여서 굽습니다. 아래 값은 전부
   원본 PNG 좌표라서 어느 쪽을 불러도 배치는 똑같습니다.

   canvas [w, h]        원본 캔버스 크기 (에셋 px)
   body   [x, y, w, h]  캔버스 안에서 집기가 실제로 그려진 영역 (에셋 px)
                        npm run verify:utensils 가 "불투명 영역" 으로 찍어 줍니다.
   cx                   몸통을 놓을 가로 중심 (VIEW)
   w                    몸통을 그릴 폭 (VIEW)
   ground               밑동이 바닥에 닿는 선 (VIEW). 생략하면 뒤쪽 조리대 줄.

   [들뜸 방지] 뒤쪽 8종은 ground 를 적지 않습니다. 전부 STATION_GROUND_Y
   한 줄에 발을 딛기 때문에, 이 값 하나만 움직이면 줄 전체가 같이 움직입니다.
   에셋마다 캔버스 여백이 다르지만 body 밑변을 기준으로 맞추므로
   여백 차이가 높이 차이로 새지 않습니다.

   [각도 유지] 배율은 w/body.w 하나뿐이고 세로도 같은 배율을 씁니다.
   가로세로를 따로 맞추면 그림이 눌리거나 늘어나서 원근이 틀어집니다.
   그래서 몸통 높이는 배치값이 아니라 에셋 비율이 정합니다.

   [폭을 정한 기준] 조리대 6종(싱크대~튀김기)은 조작 손잡이 띠가 한 줄에
   오도록 맞췄습니다. 이 띠가 곧 상판 높이라, 여기가 어긋나면 같은 줄에
   선 집기들이 저마다 다른 높이의 가구처럼 보입니다.

   [cx 를 정한 기준] 8종을 옆으로 붙인 뒤 줄 전체를 화면 중앙(x 960)에
   맞춘 결과입니다. HUD 좌우 패널이 대칭(각 1.35% 여백 + 15.2% 폭)이라
   화면 중앙이 곧 HUD 사이 빈 칸의 중앙입니다.

   붙이는 계산은 사각형이 아니라 실루엣으로 합니다. 3/4 시점이라 집기마다
   옆면이 기울어 있어서, 사각형만 맞대면 위아래에 벽이 그대로 보입니다.
   이웃한 두 실루엣이 가장 가까워지는 높이에서 8px 겹치게 두면 옆면끼리
   맞물려 한 줄로 이어져 보입니다. 더 겹치면 상판이 서로를 잘라먹습니다.

   결과 줄 폭은 322~1598 로 뒤쪽 벽(302~1610) 안에 들어옵니다.
   벽을 넘기면 집기 옆구리가 좌우 벽 속으로 파고듭니다.

   [상태] active = 그 집기를 쓰는 중일 때 갈아 끼우는 그림.
   없는 집기는 idle 한 장으로 버팁니다. 두 장은 같은 캔버스에 그려져
   있어야 몸통이 제자리에 있고 문·물줄기만 바뀝니다.
   ------------------------------------------------------------ */

// 뒤쪽 조리대 8종이 바닥에 닿는 선(VIEW).
// 614 = 요리사 이동 영역 상한(chef-walk-area.js topY)과 같은 값입니다.
// 요리사가 더 뒤로 못 가는 선 = 조리대 앞면이 바닥에 닿는 선이라야
// 요리사가 집기 속으로 파고들어 보이지 않습니다.
const STATION_GROUND_Y = 614;

const STATION_ART_DIR = "assets/utensils/counter/";

const STATION_ART = {
  fridge:     {state:{idle:"fix_fridge_closed", active:"fix_fridge_open"},
               canvas:[982,1283], body:[112,32,758,1219], cx: 435, w:226},
  sink:       {state:{idle:"fix_sink_dry", active:"fix_sink_water"},
               canvas:[810, 869], body:[ 32,33,746, 804], cx: 646, w:212},
  board:      {state:{idle:"fix_prep_table"},
               canvas:[745, 843], body:[ 32,32,681, 779], cx: 830, w:174},
  pot:        {state:{idle:"fix_stove_module_a"},
               canvas:[846,1106], body:[ 32,32,782,1042], cx: 982, w:146},
  pan:        {state:{idle:"fix_stove_module_b"},
               canvas:[760,1200], body:[ 32,32,696,1136], cx:1114, w:134},
  grill:      {state:{idle:"fix_grill_counter"},
               canvas:[937,1015], body:[ 32,32,873, 951], cx:1264, w:184},
  fryer:      {state:{idle:"fix_fryer_counter_no_basket"},
               canvas:[534, 768], body:[ 32,32,470, 704], cx:1415, w:134},
  // 캔버스에 여백이 없어 body 가 캔버스와 같습니다. 고양이 귀가 위쪽 끝에
  // 닿아 있어서, 다른 집기처럼 여백을 뺀 몸통만 잡으면 귀가 잘립니다.
  // run 캔버스가 1px 더 깁니다(1506). 빈 줄이라 그림은 같은 자리에 오지만,
  // 다시 뽑을 일이 있으면 두 장을 같은 캔버스로 맞추는 편이 깔끔합니다.
  dishwasher: {state:{idle:"dish_washer_idle", active:"dish_washer_run"},
               canvas:[808,1505], body:[  0, 1,808,1504], cx:1536, w:124},
  // 쓰레기통만 뒤쪽 줄이 아니라 오른쪽 앞 바닥에 서 있어 ground 를 따로 줍니다.
  // cx 1735 = 오른쪽 벽에 딱 붙인 자리입니다. 밑동 높이(y 786)에서 바닥이
  // 끝나는 지점이 x 1797 이고(bg_floor 실측 = 걷기영역 벽 사선과 일치),
  // 거기서 폭의 절반(62)을 뺀 값입니다. 더 밀면 밑동이 벽 속으로 들어갑니다.
  // ground 도 더 못 내립니다 — 바 테이블 상판 뒷변이 y 780 이라 이미 6 걸쳐 있습니다.
  trash:      {state:{idle:"prop_trash_closed", active:"prop_trash_open"},
               canvas:[320, 560], body:[ 28,167,264, 374], cx:1735, w:124, ground:786}
};

/* 배치값 → 화면 사각형(논리 좌표).
   body  집기 몸통. 판정·이름표가 쓰는 사각형입니다.
   canvas 그림 한 장을 통째로 얹을 자리. 몸통보다 큽니다(냉장고 위 소품,
          쓰레기통 열린 뚜껑, 수도꼭지 …). 이 여백까지 같이 확대해야
          몸통이 제자리에 있으면서 위로 삐져나온 부분이 살아납니다.
   VIEW 픽셀에 딱 떨어지게 반올림합니다 — 미리 줄여 둔 캔버스와 1:1 로
   맞아야 그릴 때 다시 확대/축소가 걸리지 않습니다. */
function stationArtLayout(art){
  const [canvasW,canvasH]=art.canvas, [bodyX,bodyY,bodyW,bodyH]=art.body;
  const scale=art.w/bodyW;                                    // VIEW px / 에셋 px
  const ground=art.ground??STATION_GROUND_Y;
  const snap=value=>toLogic(Math.round(value));
  return {
    body:  {x:snap(art.cx-art.w/2),                 y:snap(ground-bodyH*scale),
            w:snap(art.w),                          h:snap(bodyH*scale)},
    canvas:{x:snap(art.cx-(bodyX+bodyW/2)*scale),   y:snap(ground-(bodyY+bodyH)*scale),
            w:snap(canvasW*scale),                  h:snap(canvasH*scale)}
  };
}

// 게임 로직·드로잉이 쓰는 논리 좌표(1280x720) 사본.
// 좌표를 고칠 일이 있으면 위 STATION_SPEC / STATION_ART 만 고치면 됩니다.
const STATION_LAYOUT = Object.fromEntries(
  Object.entries(STATION_ART).map(([id,art])=>[id,stationArtLayout(art)]));

const STATIONS = Object.fromEntries(Object.entries(STATION_SPEC).map(([id,spec])=>[id,{
  id, label:spec.label, facing:spec.facing,
  x:STATION_LAYOUT[id].body.x, y:STATION_LAYOUT[id].body.y,
  w:STATION_LAYOUT[id].body.w, h:STATION_LAYOUT[id].body.h,
  ix:toLogic(spec.stand[0]), iy:toLogic(spec.stand[1]),
  labelDy:toLogic(spec.labelDy||0),
  hideLabel:!!spec.hideLabel
}]));

/* 이 거리(논리 좌표) 안에 들어와야 집기를 쓸 수 있습니다.
   40 → 55. 에셋 스펙대로 집기가 커지면서(냉장고 78→154 폭) 40 으로는
   집기 앞에 서 있는데도 손이 닿지 않는 자리가 생겼습니다.
   상호작용 지점 간격이 가장 좁은 곳이 81(튀김기↔식기세척기)이라
   55 까지는 겹쳐도 nearestStation() 이 더 가까운 쪽을 고릅니다. */
const STATION_REACH = 55;


// 이름표 둥실 값(진폭·주기·강조색)은 낮 준비물과 공유합니다.
// → draw-utils.js 의 LABEL_FLOAT / labelFloatStep()


/* ------------------------------------------------------------
   1-2. 에셋 불러오기 · 미리 줄여 두기
   ------------------------------------------------------------
   "화면에 나올 크기 그대로" 한 번만 줄여서 캔버스에 담아 둡니다.
   매 프레임 원본을 축소하면 프레임마다 리샘플링이 돌아갑니다.
   한 번 줄여 두면 이후에는 1:1 복사만 하면 됩니다.

   drawImage 가 원본 크기를 알아서 맞춰 주므로, WebP(줄여 구운 것)를
   불러왔든 PNG(원본)로 되돌아갔든 결과는 같습니다.
   ------------------------------------------------------------ */

const stationArt = {};   // "<집기id>_<상태>" → 미리 줄여 둔 캔버스

function prerenderStationArt(id,image){
  const rect=STATION_LAYOUT[id].canvas;
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(toView(rect.w));
  canvas.height=Math.round(toView(rect.h));
  const g=canvas.getContext("2d");
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
  g.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}

function loadStationArt(id,stateKey,file,ext=".webp"){
  const image=new Image();
  image.onload=()=>{stationArt[`${id}_${stateKey}`]=prerenderStationArt(id,image);};
  image.onerror=()=>{
    if(ext===".webp"){loadStationArt(id,stateKey,file,".png");return;}   // WebP 미지원 브라우저
    console.warn(`집기 에셋을 불러오지 못했습니다: ${file} (도형 플레이스홀더로 그립니다)`);
  };
  image.src=`${STATION_ART_DIR}${file}${ext}`;
}

Object.entries(STATION_ART).forEach(([id,art])=>
  Object.entries(art.state).forEach(([stateKey,file])=>loadStationArt(id,stateKey,file)));


/* ------------------------------------------------------------
   1-3. 쓰레기통 통과 막기
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


let trashOpenUntil=0;
function playTrashDiscardAnimation(durationMs=700){
  trashOpenUntil=Math.max(trashOpenUntil,Date.now()+Math.max(0,durationMs));
}
function trashIsOpen(){
  if(state.mini?.stationId==="trash")return true;
  return Date.now()<trashOpenUntil;
}


/* ------------------------------------------------------------
   2. 상호작용 판정
   ------------------------------------------------------------ */

function stationApproachDistance(station){
  const player=state.player;
  const closestX=clamp(player.x,station.x,station.x+station.w);
  let yDistance=Math.abs(player.y-station.iy);
  // 집기가 바라보는 쪽으로 기준점을 지나 더 밀착한 위치도 접근 영역입니다.
  if(station.facing==="up"&&player.y<=station.iy)yDistance=0;
  // 일반 영업의 기존 넓은 철판 판정은 유지하되, 프롤로그에서는 실제로
  // 철판 가까이 걸어가야 하므로 세로 거리까지 확인합니다.
  if(station.facing==="down"&&player.y>=station.iy&&!state.story?.activeStoryCook)yDistance=0;
  return Math.hypot(player.x-closestX,yDistance);
}

function nearestStation(preferredId=null){
  let best=null, bestD=999;
  const counterStations=typeof FRONT_STATIONS!=="undefined"&&FRONT_STATIONS.griddle?[FRONT_STATIONS.griddle]:[];
  const stations=[...Object.values(STATIONS),...counterStations];
  const preferred=preferredId?stations.find(station=>station.id===preferredId):null;
  if(preferred&&stationApproachDistance(preferred)<STATION_REACH)return preferred;
  stations.forEach(s=>{
    const d=stationApproachDistance(s);
    if(d<bestD){best=s;bestD=d;}
  });
  return bestD<STATION_REACH?best:null;
}

/* "지금 이 집기에 E 를 누를 수 있는가"
   ------------------------------------------------------------
   가까이 서 있는 것만으로는 부족합니다. game.js 의 updatePrompt() 가
   실제로 "E · …" 프롬프트를 띄우는 조건과 같아야, 이름표가 크게
   둥실대는 순간 = 정말 쓸 수 있는 순간이 됩니다.

     메뉴 선택    냉장고에서 오늘의 메뉴를 정합니다
     낮          주방 집기는 쓰지 않습니다 (앞 테이블 준비물만 만집니다)
     프롤로그 조리 사장이 지정한 현재 조리 단계 집기만
     밤 · 들고 감  쓰레기통에서 완성 음식을 폐기
     밤          현재 조리 단계 집기만
     미니게임 중   그 집기만 (프롬프트는 숨지만 사용 중이므로 계속 강조)

   [주의] 판정 규칙 자체는 game.js 가 주인입니다. 그쪽 조건이 바뀌면
   여기도 같이 고쳐야 이름표와 프롬프트가 어긋나지 않습니다.
   ------------------------------------------------------------ */
function stationUsable(s,near){
  if(state.mini)return state.mini.stationId===s.id;
  if(state.paused||near?.id!==s.id)return false;
  if(state.story?.activeStoryCook)return s.id===currentRequirement();
  if(state.phase==="menuSelect")return s.id==="fridge";
  if(state.phase!=="night")return false;
  if(state.carrying)return s.id==="trash";
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

/* 그리는 순서 = 겹치는 순서. 나중에 그린 집기가 위에 옵니다.
   ------------------------------------------------------------
   집기들이 옆으로 붙어 있어 옆면이 서로 8px 겹칩니다. (§1-1)
   어느 쪽이 위로 와야 하는지는 그림이 어느 방향에서 본 것이냐가 정합니다.

     후라이팬 왼쪽   오른쪽 옆면이 보이게 그려져 있습니다
                    → 오른쪽 이웃이 위. 왼쪽부터 그립니다.
     후라이팬 오른쪽  왼쪽 옆면이 보이게 그려져 있습니다
                    → 왼쪽 이웃이 위. 오른쪽부터 그립니다.

   후라이팬이 그 경계라 양쪽에서 밀려 올라와 제일 위에 옵니다.
   반대로 깔면 이웃이 옆면을 잘라먹어서 집기가 벽 쪽으로 한 칸 들어간
   것처럼 보입니다.

   경계를 옮기려면 STATION_OVERLAP_TOP 만 바꾸면 됩니다. 목록은
   STATION_ART 에서 만들므로 집기를 추가해도 빠지지 않습니다.
   ------------------------------------------------------------ */
const STATION_OVERLAP_TOP = "pan";

const STATION_DRAW_ORDER = (()=>{
  const ids=Object.keys(STATION_ART).filter(id=>id!=="trash");   // 쓰레기통은 아래에서 따로
  const top=ids.indexOf(STATION_OVERLAP_TOP);
  return [...ids.slice(top+1).reverse(), ...ids.slice(0,top+1)];
})();

function drawStations(){
  // 쓰레기통은 뒤쪽 줄과 떨어져 있어 겹칠 일이 없습니다. 앞에 있으면 이름표 층에서 그립니다.
  if(!trashInFront()) drawStation(STATIONS.trash);
  STATION_DRAW_ORDER.forEach(id=>drawStation(STATIONS[id]));
}

// "가장 가까운 집기"는 9개가 공유하므로 여기서 한 번만 구해서 넘깁니다.
// (nearestStation 을 9번 돌 필요가 없습니다)
function drawStationLabels(){
  if(trashInFront()) drawStation(STATIONS.trash);
  const preferred=state.phase==="night"&&state.carrying?"trash":currentRequirement();
  const near=nearestStation(preferred);
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

/* 이름표 판의 크기와 높이(논리 좌표).
   game.js 의 E 키캡도 같은 값을 봐야 둘이 어긋나지 않으므로 상수로 뺐습니다.
   여기만 고치면 이름표와 키캡이 같이 따라옵니다. */
const STATION_LABEL_H    = 23;   // 판 높이
const STATION_LABEL_RISE = 25;   // 집기 윗변에서 판 윗변까지 (위로)

// 이름표 판의 윗변. 둥실 흔들림(labelFloatStep)은 뺀 기준 위치입니다.
function stationLabelTop(s){
  return s.y - STATION_LABEL_RISE + (s.labelDy||0);
}

/* 뒤쪽 집기의 E 키캡을 앉힐 y (논리 좌표).

   [왜 이름표 위인가] 원래는 집기 아랫변보다 60 아래(= y+h+60)였습니다.
   뒤쪽 조리대는 요리사가 그 앞에 서서 쓰는 자리라, 키캡이 아래에 뜨면
   요리사 몸 위에 겹쳐서 둘 다 알아보기 어려웠습니다. 이름표 위로 올리면
   "이름표(무엇을) + 키캡(어떻게)" 이 위아래 한 줄로 읽힙니다.

   키캡은 이 지점을 **바닥**으로 삼아 위로 그려집니다
   (css/interaction.css 의 translate(-50%,-100%)). 그래서 이름표 윗변보다
   조금 더 위를 돌려주면 키캡 전체가 이름표 위에 놓입니다.

   [18 인 이유] 둘 다 가만히 있지 않아서, 각자 제일 가까워지는 순간을 다 빼야
   합니다. 가만히 있을 때의 간격만 보고 잡으면 움직이다가 겹칩니다.
     이름표가 올라오는 쪽  4.7  둥실 진폭 (draw-utils.js LABEL_FLOAT.active.amp)
                          0.4  1.03 배로 커지면서 윗변이 더 올라오는 몫
     키캡이 내려가는 쪽    3.7  눌리는 연출 5upx (css/interaction.css keycap-press)
                          4.4  키 옆면 노릇을 하는 그림자 6upx — rect 에는
                               안 잡히지만 눈에는 키의 일부로 보입니다
   합이 약 13 이라 5 정도가 남습니다. (upx → 논리 환산은 창 크기에 따라
   조금씩 달라지므로 넉넉한 쪽으로 잡았습니다)

   이름표를 끈 집기(§1 hideLabel)도 같은 높이를 씁니다 — 뒤쪽 줄에서 키캡
   높이가 들쭉날쭉하면 오히려 더 어수선합니다. */
const STATION_PROMPT_GAP = 18;
function stationPromptY(s){
  return stationLabelTop(s) - STATION_PROMPT_GAP;
}

/* 이름표 한 장.
   E 를 눌러 실제로 쓸 수 있을 때만 크게·밝게 둥실댑니다.
   앞에 서 있기만 해서는 강조되지 않습니다. (stationUsable 참고)
   둥실 계산은 낮 준비물과 공유합니다. (draw-utils.js labelFloatStep) */
function labelStation(s,near){
  /* 이름표를 끈 집기(§1 hideLabel)는 여기서 바로 빠집니다.
     labelFloatStep 을 부르기 전에 빠져야 합니다 — 그 함수는 집기마다 둥실
     상태를 기억해 두는데, 안 그릴 것까지 부르면 쓰지도 않을 상태가 계속 쌓입니다. */
  if(s.hideLabel)return;
  const active=stationUsable(s,near);
  const f=labelFloatStep(`station_${s.id}`,active);

  /* 이름표 폭은 "글자 폭 + 좌우 여백"입니다. 집기 폭을 따라가면
     냉장고(154)·세면대(146) 같은 큰 집기에서 명판만 길쭉해집니다.
     집기가 커져도 명판은 글자 길이만큼만 커집니다. */
  ctx.font="bold 13px Malgun Gothic";
  const h=STATION_LABEL_H,cx=s.x+s.w/2;
  const w=Math.round(ctx.measureText(s.label).width)+LABEL_PAD_X*2;
  // 기준 위치는 stationLabelTop() 이 갖고 있습니다 (E 키캡과 공유).
  // 여기서 더하는 f.dy 는 둥실 흔들림뿐입니다.
  const x=cx-w/2,y=stationLabelTop(s)+f.dy;

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
   에셋을 불러왔으면 그림 한 장으로 끝나고, 아래 도형은 전부 예비용입니다.
   ------------------------------------------------------------
   [비율로 그리는 이유] 집기마다 가로세로가 다릅니다.
   (냄비 95x139, 직화구이 128x139, 냉장고 154x262 …)
   그래서 픽셀 상수 대신 몸통 크기에 대한 비율로 그립니다.
   §1-1 의 배치값만 고쳐도 도형이 알아서 따라옵니다.

   조리대 6종(싱크대~튀김기)은 "상판 + 하부장" 두 단으로 나눕니다.
   상판 비율 STATION_TOP_RATIO 위쪽에 조리 도구를, 아래에 하부장을 그립니다. */

const STATION_TOP_RATIO = {sink:.46,board:.46,pot:.45,pan:.45,grill:.45,fryer:.45};

function drawStation(s){
  if(drawStationArt(s))return;                // 에셋이 준비됐으면 도형 대신 그림 한 장

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
    ctx.fillStyle="#86a164";ctx.fillRect(s.x+s.w-22,s.y+16,10,7);   // 전원 표시등
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

/* 지금 이 집기를 그릴 상태.
   active = 쓰는 중일 때 갈아 끼우는 그림 (냉장고 문 열림 · 싱크대 물줄기 ·
   쓰레기통 뚜껑 열림). 그 그림이 없는 집기는 아래 drawStationArt 가
   idle 로 되돌립니다. */
function stationArtState(id){
  if(id==="trash")return trashIsOpen()?"active":"idle";
  return state.mini?.stationId===id?"active":"idle";
}

/* 집기 그림 한 장. 그렸으면 true, 아직 못 불러왔으면 false 를 돌려주고
   도형 플레이스홀더로 넘깁니다. (§1-2)
   미리 축소해 둔 캔버스를 같은 크기로 얹기만 하므로 배율 계산이 없습니다. */
function drawStationArt(s){
  const art=stationArt[`${s.id}_${stationArtState(s.id)}`]??stationArt[`${s.id}_idle`];
  if(!art)return false;
  const r=STATION_LAYOUT[s.id].canvas;
  ctx.drawImage(art,r.x,r.y,r.w,r.h);
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
