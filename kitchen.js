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

   standY              요리사가 서는 자리의 y (발끝 기준). x 는 §1-1 이 정합니다.
   stand [x, y]        줄 밖에 있는 집기(쓰레기통)만 x 까지 직접 적습니다.
   facing              그 자리에서 요리사가 바라보는 방향

   집기 몸통 사각형은 손으로 적지 않습니다. §1-1 STATION_SLICES 의 조각 폭과
   불투명 범위에서 계산합니다. 그림과 판정 사각형이 따로 놀면 이름표가
   집기에서 떠 보이기 때문에 한 곳에서만 정합니다.

   [stand x] 뒤쪽 8종은 집기 가로 중심과 같은 값이라 §1-1 에서 만듭니다.
   여기 또 적어 두면 집기를 옮겼을 때 한쪽만 고쳐서 "집기 앞에 섰는데
   다른 집기가 잡히는" 일이 생깁니다.

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

/* [stand x 가 없는 이유] 뒤쪽 8종은 서는 자리 x 를 여기 적지 않습니다.
   §1-1 의 줄 배치에서 집기 가로 중심을 그대로 가져다 씁니다. 두 곳에 적으면
   집기를 옮겼을 때 한쪽만 고쳐서 "집기 앞에 섰는데 다른 집기가 잡히는" 일이
   생깁니다. 쓰레기통만 줄 밖에 있어서 stand 를 직접 적습니다. */
const STATION_SPEC = {
  // labelDy -52 = 냉장고 위 소품(decoration.js §3-5 prop_fridge_top_decor)만큼
  //   이름표를 위로 비켜 놓은 값입니다. 소품이 상판 위 y 256~332 를 쓰는데
  //   이름표 기본 자리가 y 259~294 라 주전자 몸통을 가로질렀습니다.
  //   -52 면 이름표가 y 207~242 로 올라가 소품 위 타일 벽에 놓이고,
  //   둥실 진폭(±7)을 빼도 14 정도 여유가 남습니다.
  //   소품 높이를 바꾸면 이 값도 같이 봐야 합니다.
  fridge:     {label:"냉장고",    standY:640, facing:"up", labelDy:-52},
  sink:       {label:"싱크대",    standY:640, facing:"up", hideLabel:true},
  board:      {label:"도마",      standY:640, facing:"up"},
  pot:        {label:"냄비",      standY:640, facing:"up"},
  pan:        {label:"후라이팬",  standY:640, facing:"up"},
  grill:      {label:"직화구이",  standY:640, facing:"up"},
  fryer:      {label:"튀김기",    standY:640, facing:"up"},
  dishwasher: {label:"식기세척기",standY:640, facing:"up", hideLabel:true},
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
   [파일] assets/utensils/new/<이름>.webp
   PNG 가 원본이고 WebP 는 빌드 산출물입니다. (npm run build:utensils)
   WebP 를 못 읽는 브라우저면 자동으로 같은 이름의 PNG 로 되돌립니다.

   [줄로 놓는다] 뒤쪽 8종은 집기마다 폭을 따로 정하지 않습니다.
   받은 원화가 **한 장으로 그린 조리대 줄을 8조각으로 자른 것**이라,
   자른 순서대로 그냥 이어 붙이면 그린 그대로가 됩니다. 조각 폭을 다 더하면
   1757px 이고 조각끼리는 겹치지도 벌어지지도 않습니다 — 한 픽셀은 정확히
   한 조각에만 속합니다. 그래서 빈틈이 "거의" 없는 게 아니라 아예 없습니다.

   예전에는 집기마다 폭을 손으로 정하고 이웃과 8px 씩 겹쳐서 옆면을
   맞물리게 했습니다. 지금 원화는 옆면을 이웃과 나눠 쓰도록 그려져 있어서
   겹치면 오히려 그 부분이 두 번 그려집니다. 겹침은 그래서 없앴습니다.

   [세로 기준] 조각마다 그림이 아래로 내려온 정도가 조금씩 다릅니다
   (냉장고 452, 싱크대 444 …). 조각별 밑변을 각각 바닥선에 맞추면 원화에서
   의도한 앞뒤 원근이 무너집니다. 그래서 **줄 전체에서 가장 아래로 내려온
   픽셀**(=냉장고 452) 하나만 바닥선에 맞추고, 나머지는 원화의 높이차를
   그대로 둡니다. 조각들이 같은 480px 캔버스에 그려져 있어서 이렇게 하면
   원화 한 장을 통째로 놓은 것과 같아집니다.

   [각도 유지] 배율은 줄 전체에 하나뿐입니다(가로 폭에서 나옵니다). 세로도
   같은 배율을 쓰므로 그림이 눌리거나 늘어나지 않습니다.

   [줄 폭 1276 을 정한 기준] 줄을 화면 중앙(x 960)에 맞춰 322~1598 에
   놓입니다. 뒤쪽 벽이 302~1610 이라 양옆으로 16 씩 남습니다. 벽을 넘기면
   집기 옆구리가 좌우 벽 속으로 파고듭니다. HUD 좌우 패널이 대칭이라
   화면 중앙이 곧 HUD 사이 빈 칸의 중앙이기도 합니다.

   [낮 · 밤] 지금은 식기세척기 하나만 낮/밤 그림이 다릅니다.
   나머지 7종은 한 장으로 낮밤을 다 씁니다. night 를 안 적으면 낮 그림을
   그대로 쓰므로(§1-2 drawStationArt), 밤 그림이 생기면 그 줄에 night 만
   더하면 됩니다.

   조리 4종(냄비·후라이팬·직화구이·튀김기)은 한때 밤에 6칸 스프라이트
   시트를 돌렸습니다. 시트가 낮 조각과 규격이 안 맞아 밤에만 집기 사이가
   벌어져서 걷어냈고, 지금은 낮 그림 한 장으로 통일돼 있습니다.
   (시트를 돌리던 코드는 커밋 a3f42cd 에 있습니다)

   [주의 — 없어진 연출] 예전 에셋에 있던 "쓰는 중" 그림(냉장고 문 열림,
   싱크대 물줄기)은 새 원화에 짝이 없어 빠졌습니다. 다시 살리려면 같은
   조각 규격으로 그 상태 그림을 받아 day/night 옆에 붙이면 됩니다.
   ------------------------------------------------------------ */

// 뒤쪽 조리대 8종이 바닥에 닿는 선(VIEW).
// 614 = 요리사 이동 영역 상한(chef-walk-area.js topY)과 같은 값입니다.
// 요리사가 더 뒤로 못 가는 선 = 조리대 앞면이 바닥에 닿는 선이라야
// 요리사가 집기 속으로 파고들어 보이지 않습니다.
const STATION_GROUND_Y = 614;

const STATION_ART_DIR = "assets/utensils/new/";

/* 줄 전체 배치값. width·centerX 는 VIEW, 나머지는 에셋 px 입니다. */
const STATION_ROW = {
  width: 1276,          // 줄 전체를 그릴 폭 (VIEW)
  centerX: 960,         // 줄 가운데 (VIEW)
  canvasH: 480,         // 조각 한 장의 캔버스 높이 (에셋 px). 8조각 모두 같습니다.
  contentBottom: 452    // 줄에서 가장 아래로 내려온 픽셀 y (에셋 px). 이 선이 바닥선에 닿습니다.
};

/* 왼쪽부터 놓이는 순서 그대로입니다. 순서를 바꾸면 원화에서 이웃끼리
   나눠 그린 옆면이 어긋나므로, 순서는 원화가 정합니다.

   w          조각 폭 (에셋 px)
   top/bottom 조각 안에서 그림이 있는 세로 범위 (에셋 px)
              npm run verify:utensils 의 "불투명 영역" 이 찍어 줍니다.
              판정 사각형과 이름표 높이가 이 값에서 나옵니다.
   day/night  그림 파일. night 를 적지 않으면 낮 그림을 밤에도 씁니다.

   [밤 그림을 더할 때] 낮 조각과 **같은 크롭·배율**로 받아야 합니다.
   폭 w, 높이 480 의 같은 캔버스에 그려져 있으면 여기 night 만 적으면 끝이고,
   집기가 낮↔밤에 한 픽셀도 움직이지 않습니다. 규격이 다른 그림을 넣으면
   그 집기만 자리가 틀어지거나 이웃과 벌어집니다. */
const STATION_SLICES = [
  {id:"fridge",     w:277, top: 16, bottom:452, day:"fix_fridge_active"},
  {id:"sink",       w:227, top: 16, bottom:444, day:"fix_sink_active"},
  {id:"board",      w:245, top:125, bottom:446, day:"fix_cutting_board_active"},
  {id:"pot",        w:197, top:111, bottom:449, day:"fix_pot_active"},
  {id:"pan",        w:192, top:152, bottom:449, day:"fix_frying_pan_active"},
  {id:"grill",      w:237, top:123, bottom:449, day:"fix_open_flame_grill_active"},
  {id:"fryer",      w:193, top:120, bottom:447, day:"fix_fryer_active"},
  {id:"dishwasher", w:189, top:116, bottom:449, day:"fix_dishwasher_day",
   night:"fix_dishwasher_active"}
];

const STATION_ROW_TOTAL = STATION_SLICES.reduce((sum,slice)=>sum+slice.w,0);   // 1757
const STATION_ROW_SCALE = STATION_ROW.width/STATION_ROW_TOTAL;                 // VIEW px / 에셋 px

/* 조각 좌표(에셋 px) → 화면 좌표(VIEW).
   x 는 줄 왼쪽 끝에서, y 는 "바닥에 닿는 선"에서 잽니다. */
const STATION_ROW_LEFT = STATION_ROW.centerX-STATION_ROW.width/2;
const rowX = assetX => STATION_ROW_LEFT+assetX*STATION_ROW_SCALE;
const rowY = assetY => STATION_GROUND_Y-(STATION_ROW.contentBottom-assetY)*STATION_ROW_SCALE;

/* 배치값 → 화면 사각형(논리 좌표).
   body   집기 몸통. 판정·이름표가 쓰는 사각형입니다.
   canvas 그림 한 장을 통째로 얹을 자리. 몸통보다 큽니다(위쪽 여백).
          낮·밤 그림이 같은 캔버스에 그려져 있어서 자리도 하나면 됩니다.

   [폭이 아니라 양쪽 끝을 반올림합니다]
   VIEW 픽셀에 딱 떨어지게 맞춰야 합니다 — 미리 줄여 둔 캔버스와 1:1 로
   맞아야 그릴 때 다시 확대/축소가 걸리지 않습니다. 그런데 왼쪽 끝과 폭을
   따로 반올림하면 "왼쪽 끝 + 폭" 이 옆 조각의 왼쪽 끝과 어긋납니다.
   실제로 직화구이↔튀김기 사이가 그렇게 1px 벌어졌습니다.

   그래서 폭은 반올림하지 않고 **양쪽 끝을 각각 반올림한 뒤 빼서** 만듭니다.
   옆 조각의 왼쪽 끝은 이 조각의 오른쪽 끝과 같은 식에서 같은 값이 나오므로,
   배율이 얼마든 두 조각은 반드시 같은 픽셀에서 맞닿습니다. */
function stationRowLayout(slice,assetX){
  // 가로는 줄 좌표(rowX), 세로는 바닥선 기준(rowY) 으로 양 끝을 잡습니다.
  const span=(from,to,project)=>{
    const a=Math.round(project(from)), b=Math.round(project(to));
    return {at:toLogic(a), size:toLogic(b-a)};
  };
  const x=span(assetX,assetX+slice.w,rowX);
  const bodyY=span(slice.top,slice.bottom+1,rowY);
  const canvasY=span(0,STATION_ROW.canvasH,rowY);
  return {
    body:  {x:x.at, y:bodyY.at,   w:x.size, h:bodyY.size},
    canvas:{x:x.at, y:canvasY.at, w:x.size, h:canvasY.size}
  };
}

/* 쓰레기통만 줄 밖입니다. 오른쪽 앞 바닥에 혼자 서 있어서 배치값을 직접 적습니다.
   cx 1735 = 오른쪽 벽에 딱 붙인 자리입니다. 밑동 높이(y 786)에서 바닥이
   끝나는 지점이 x 1797 이고(bg_floor 실측 = 걷기영역 벽 사선과 일치),
   거기서 폭의 절반(62)을 뺀 값입니다. 더 밀면 밑동이 벽 속으로 들어갑니다.
   ground 도 더 못 내립니다 — 바 테이블 상판 뒷변이 y 780 이라 이미 6 걸쳐 있습니다.
   [파일] 이 한 종만 예전 폴더(assets/utensils/counter/)에 남아 있습니다. */
const TRASH_ART = {day:"prop_trash_closed", active:"prop_trash_open",
                   dir:"assets/utensils/counter/",
                   canvas:[320,560], body:[28,167,264,374], cx:1735, w:124, ground:786};

function trashLayout(){
  const [canvasW,canvasH]=TRASH_ART.canvas, [bodyX,bodyY,bodyW,bodyH]=TRASH_ART.body;
  const scale=TRASH_ART.w/bodyW, snap=value=>toLogic(Math.round(value));
  return {
    body:  {x:snap(TRASH_ART.cx-TRASH_ART.w/2),               y:snap(TRASH_ART.ground-bodyH*scale),
            w:snap(TRASH_ART.w),                              h:snap(bodyH*scale)},
    canvas:{x:snap(TRASH_ART.cx-(bodyX+bodyW/2)*scale),       y:snap(TRASH_ART.ground-(bodyY+bodyH)*scale),
            w:snap(canvasW*scale),                            h:snap(canvasH*scale)}
  };
}

// 게임 로직·드로잉이 쓰는 논리 좌표(1280x720) 사본.
// 좌표를 고칠 일이 있으면 위 STATION_ROW / STATION_SLICES 만 고치면 됩니다.
const STATION_LAYOUT = (()=>{
  const layout={}; let assetX=0;
  STATION_SLICES.forEach(slice=>{ layout[slice.id]=stationRowLayout(slice,assetX); assetX+=slice.w; });
  layout.trash=trashLayout();
  return layout;
})();

/* [단위 주의] STATION_SPEC 의 stand/standY 는 VIEW 라서 toLogic 을 거칩니다.
   반면 STATION_LAYOUT 의 body 는 이미 논리 좌표입니다(§1-1 의 snap).
   서는 자리 x 를 몸통 중심에서 뽑을 때는 그래서 변환하지 않습니다 —
   여기에 toLogic 을 한 번 더 걸면 집기가 화면 왼쪽 위로 쏠립니다. */
const STATIONS = Object.fromEntries(Object.entries(STATION_SPEC).map(([id,spec])=>{
  const body=STATION_LAYOUT[id].body;
  return [id,{
    id, label:spec.label, facing:spec.facing,
    x:body.x, y:body.y, w:body.w, h:body.h,
    ix:spec.stand?toLogic(spec.stand[0]):body.x+body.w/2,   // 줄 안이면 몸통 가로 중심
    iy:toLogic(spec.stand?spec.stand[1]:spec.standY),
    labelDy:toLogic(spec.labelDy||0),
    hideLabel:!!spec.hideLabel
  }];
}));

/* 이 거리(논리 좌표) 안에 들어와야 집기를 쓸 수 있습니다.
   40 → 55. 에셋 스펙대로 집기가 커지면서(냉장고 78→154 폭) 40 으로는
   집기 앞에 서 있는데도 손이 닿지 않는 자리가 생겼습니다.
   서는 자리 간격이 가장 좁은 곳이 92(튀김기↔식기세척기)라 55 면 옆
   집기와 닿는 범위가 겹치는데, nearestStation() 이 그중 더 가까운 쪽을
   고르므로 문제가 되지 않습니다. (조각 원화로 바꾸기 전에는 54였습니다) */
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

   [2026-08-08] 프레임 캔버스도 보간을 켰습니다(stage.js). 그래서 이제는
   매 프레임 축소해도 화질은 같습니다 — 이 미리 줄여 두기는 순수하게
   **비용을 아끼려고** 남겨 둔 것입니다. 원본 490x640 을 293x383 으로 줄이는
   일을 프레임마다 하지 않고 불러올 때 한 번만 합니다. 계산 결과가 정수
   픽셀(toView 가 정수로 떨어짐)이라 이후 복사는 리샘플링 없이 지나갑니다.
   ------------------------------------------------------------ */

const stationArt = {};   // "<집기id>_<상태>" → 미리 줄여 둔 캔버스

/* 그림 한 장을 화면에서 쓸 크기로 줄여 캔버스에 담습니다.
   rect 는 그 그림을 얹을 자리(논리 좌표)입니다. */
function prerenderStationArt(rect,image){
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(toView(rect.w));
  canvas.height=Math.round(toView(rect.h));
  const g=canvas.getContext("2d");
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
  g.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
}

function loadStationArt(id,stateKey,file,options={},ext=".webp"){
  const dir=options.dir??STATION_ART_DIR;
  const image=new Image();
  image.onload=()=>{stationArt[`${id}_${stateKey}`]=prerenderStationArt(STATION_LAYOUT[id].canvas,image);};
  image.onerror=()=>{
    if(ext===".webp"){loadStationArt(id,stateKey,file,options,".png");return;}   // WebP 미지원 브라우저
    console.warn(`집기 에셋을 불러오지 못했습니다: ${file} (도형 플레이스홀더로 그립니다)`);
  };
  image.src=`${dir}${file}${ext}`;
}

STATION_SLICES.forEach(slice=>{
  loadStationArt(slice.id,"day",slice.day);
  // night 를 안 적은 집기는 밤에도 낮 그림을 씁니다 (아래 drawStationArt 가 되돌립니다).
  if(slice.night) loadStationArt(slice.id,"night",slice.night);
});
loadStationArt("trash","day",TRASH_ART.day,{dir:TRASH_ART.dir});
loadStationArt("trash","active",TRASH_ART.active,{dir:TRASH_ART.dir});


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

/* 그리는 순서 = 왼쪽부터.
   ------------------------------------------------------------
   예전에는 순서가 중요했습니다. 집기마다 폭을 따로 정하고 이웃과 8px 씩
   겹쳐 놨기 때문에, 어느 쪽을 위에 얹느냐에 따라 옆면이 잘려 보였습니다.

   지금은 겹치는 부분이 없습니다. 8종이 원화 한 장을 자른 조각이라
   한 픽셀은 정확히 한 조각에만 속합니다. (§1-1) 그래서 순서를 바꿔도
   결과가 같고, 읽기 쉬우라고 원화에 그려진 순서 그대로 둡니다.

   규격이 다른 그림을 섞어서 자리가 서로 물리게 되면 그때는 순서가
   다시 중요해집니다. 왼쪽부터 그리면 오른쪽 집기가 위에 오는데,
   원화가 왼쪽 옆면을 보여 주는 3/4 시점이라 그 방향이 맞습니다.
   ------------------------------------------------------------ */
const STATION_DRAW_ORDER = STATION_SLICES.map(slice=>slice.id);   // 쓰레기통은 아래에서 따로

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

/* 이름표 글자 좌우 여백. 명판 길이를 조절하려면 이 값만 만지면 됩니다.

   [17 인 이유] 판이 나무판 그림(draw-utils.js NAMEPLATE_ART)으로 바뀌면서
   좌우 끝을 금장 장식이 차지합니다. 예전 도형 명판 기준이던 12 로는
   글자가 그 장식에 바짝 붙었습니다. 앞쪽 철판 명패와 같은 비율로
   맞춘 값입니다 — 저쪽은 14px 글자에 여백 18.6 이라, 13px 글자면 17 입니다.
   글자 크기는 그대로 두고 여백만 키운 것이라 판만 넉넉해집니다. */
const LABEL_PAD_X = 17;

const STATION_LABEL_FONT = "bold 13px Malgun Gothic";

/* 명판 폭 — 글자 수가 같으면 폭도 같습니다
   ------------------------------------------------------------
   예전에는 이름마다 "글자 폭 + 여백"으로 따로 계산했습니다. 맑은 고딕은
   한글도 글자마다 폭이 조금씩 달라서, 같은 4글자인 '후라이팬'과
   '직화구이'의 명판 길이가 몇 px 씩 어긋나 줄이 지저분해 보였습니다.

   그래서 **글자 수별로 한 폭씩** 정합니다. 그 글자 수 중 가장 긴 이름에
   맞추므로, 어떤 이름도 판을 뚫고 나가지 않으면서 같은 글자 수끼리는
   판 길이가 딱 맞습니다.
     2글자  도마 · 냄비
     3글자  냉장고 · 튀김기
     4글자  후라이팬 · 직화구이 · 쓰레기통

   [숨긴 이름표는 안 셉니다] '식기세척기'(5글자)·'싱크대'는 hideLabel
   이라 화면에 없습니다. 이걸 세면 보이지도 않는 이름 때문에 같은 글자
   수의 판이 다 같이 길어집니다.

   [한 번만 재는 이유] 이름과 글꼴이 고정이라 값이 변하지 않습니다.
   맑은 고딕은 윈도우 기본 글꼴이라 첫 프레임에도 이미 준비돼 있어서
   웹폰트처럼 나중에 폭이 바뀔 일이 없습니다. */
function labelPlateWidthFor(text){
  return Math.round(ctx.measureText(text).width)+LABEL_PAD_X*2;
}

const stationLabelPlateWidths = {};   // 글자 수 → 폭
function stationLabelPlateWidth(label){
  const chars=label.length;
  if(stationLabelPlateWidths[chars]) return stationLabelPlateWidths[chars];
  const previousFont=ctx.font;
  ctx.font=STATION_LABEL_FONT;
  // 자기 자신을 초깃값으로 둡니다 — 숨긴 이름표가 물어봐도 답이 나옵니다.
  stationLabelPlateWidths[chars]=Object.values(STATIONS)
    .filter(s=>!s.hideLabel&&s.label.length===chars)
    .reduce((max,s)=>Math.max(max,labelPlateWidthFor(s.label)),labelPlateWidthFor(label));
  ctx.font=previousFont;
  return stationLabelPlateWidths[chars];
}


/* 이름표 판 그림 — 앞쪽 철판 명패와 같은 에셋
   ------------------------------------------------------------
   판을 만드는 코드는 draw-utils.js 의 nameplateCanvas() 에 있습니다.
   낮 준비물 이름표(prep.js)도 같은 판을 쓰게 되면서 공용 파일로 옮겼습니다.
   에셋·3분할 규칙은 그쪽 § NAMEPLATE_ART 주석을 보세요.

   ⚠️ counter.js 가 아직 안 받았거나 받기에 실패하면 그림이 없습니다.
      그때는 예전 도형 명판으로 되돌아갑니다. (labelStation 아래쪽)

   글자 색도 철판 명패와 같습니다(draw-utils.js NAMEPLATE_TEXT). 외곽선
   굵기만 글자 크기에 맞춰 줄인 값입니다 (철판 21px 에 4 → 여기 13px 에 2.5). */
const STATION_LABEL_TEXT = { ...NAMEPLATE_TEXT, strokeWidth:2.5 };

/* 이름표 판의 크기와 높이(논리 좌표).
   game.js 의 E 키캡도 같은 값을 봐야 둘이 어긋나지 않으므로 상수로 뺐습니다.
   여기만 고치면 이름표와 키캡이 같이 따라옵니다.

   ⚠️ [둘은 같이 움직여야 합니다] 판 아랫변은 집기 윗변보다 2 위
      (= RISE - H = 2) 여야 합니다. 높이만 키우면 판이 집기 속으로
      파고들고, 올림만 키우면 판이 허공에 뜹니다.
      2026-08-09 에 여백을 키우면서 23/25 → 29/31 로 같이 올렸습니다
      (판 그림의 금장 테두리가 세로도 먹어서, 23 으로는 글자가 위아래
       테두리에 닿았습니다. 앞쪽 철판 명패와 같은 비율입니다). */
const STATION_LABEL_H    = 29;   // 판 높이
const STATION_LABEL_RISE = 31;   // 집기 윗변에서 판 윗변까지 (위로)

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

  /* 이름표 폭은 글자 수가 정합니다(stationLabelPlateWidth).
     집기 폭을 따라가지 않는 이유는, 냉장고(201)·싱크대(165) 같은 큰
     집기에서 명판만 길쭉해지기 때문입니다. */
  ctx.font=STATION_LABEL_FONT;
  const h=STATION_LABEL_H,cx=s.x+s.w/2;
  const w=stationLabelPlateWidth(s.label);
  // 기준 위치는 stationLabelTop() 이 갖고 있습니다 (E 키캡과 공유).
  // 여기서 더하는 f.dy 는 둥실 흔들림뿐입니다.
  const x=cx-w/2,y=stationLabelTop(s)+f.dy;

  ctx.save();
  applyLabelScale(f.scale,cx,y+h/2);

  /* 판. 철판 명패와 같은 나무판 그림입니다.
     [강조 표현이 다릅니다] 예전 도형 명판은 강조될 때 테두리 색을
     바꿨는데, 그림 판에는 바꿀 테두리가 없습니다. 대신 글자 색과
     크기(applyLabelScale)로만 강조합니다 — 앞쪽 철판 명패가 쓰는
     방식과 같습니다. (counter.js COUNTER_FLOAT) */
  const plate=nameplateCanvas(w,h);
  if(plate){
    ctx.drawImage(plate,x,y,w,h);
  }else{
    // 그림을 아직 못 받았을 때의 예비 도형 (예전 명판)
    ctx.fillStyle="#1a0e09";roundRect(ctx,x,y,w,h,5,true,false);
    ctx.strokeStyle=active?LABEL_FLOAT.activeLine:FIXTURE_LABEL.line;
    ctx.lineWidth=2;roundRect(ctx,x,y,w,h,5,false,true);
  }

  /* 글자는 판 한가운데. textBaseline="middle" 을 쓰면 판 높이를 바꿔도
     baseline 보정값을 다시 잡을 필요가 없습니다. */
  const T=STATION_LABEL_TEXT,textY=y+h/2;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.lineJoin="round";                         // 획 모서리에 뿔이 서지 않게
  ctx.strokeStyle=T.stroke;ctx.lineWidth=T.strokeWidth;
  ctx.strokeText(s.label,cx,textY);
  ctx.fillStyle=active?T.activeFill:T.fill;
  ctx.fillText(s.label,cx,textY);
  ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.lineJoin="miter";
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
   뒤쪽 8종은 낮/밤으로 갈립니다. 쓰레기통만 뚜껑 열림이 따로 있습니다. */
function stationArtState(id){
  if(id==="trash")return trashIsOpen()?"active":"day";
  return state.phase==="night"?"night":"day";
}

/* 집기 그림 한 장. 그렸으면 true, 아직 못 불러왔으면 false 를 돌려주고
   도형 플레이스홀더로 넘깁니다. (§1-2)
   미리 축소해 둔 캔버스를 같은 크기로 얹기만 하므로 배율 계산이 없습니다. */
function drawStationArt(s){
  // 그 상태 그림이 없으면(밤 그림이 없는 7종) 낮 그림으로 되돌립니다.
  const art=stationArt[`${s.id}_${stationArtState(s.id)}`]??stationArt[`${s.id}_day`];
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
