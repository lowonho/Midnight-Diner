"use strict";

/* ============================================================
   프레임 캔버스와 공용 드로잉 헬퍼
   ------------------------------------------------------------
   담당 범위: 집기·손님·이펙트를 그리는 캔버스 한 장(ctx)의 생성/커밋 ·
              여러 요소가 같이 쓰는 드로잉 헬퍼

   담당 범위가 아님: 무엇을 어디에 그릴지
              → kitchen.js / counter.js / customers.js / prep.js / fx.js

   [좌표계] 이 캔버스는 stage.js 의 beginStageFrame() 이 배율 1.5 를
   걸어준 상태에서 그려집니다. 그래서 드로잉 코드는 전부
   논리 좌표(1280x720)를 씁니다. VIEW(1920x1080)가 아닙니다.

   index.html 에서 stage.js 다음, 나머지 요소 파일들보다 먼저 로드합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 프레임 캔버스
   ------------------------------------------------------------
   ctx 는 요소 파일들이 전부 참조하는 전역입니다.
   createFrameCanvas() 는 Phaser 씬이 만들어진 뒤 한 번만 호출됩니다.
   ------------------------------------------------------------ */

/* 캔버스는 요리사를 사이에 두고 두 장입니다.
     back  요리사 뒤 (주방 집기)
     front 요리사 앞 (손님·준비물·간판·이펙트)
   ctx 는 "지금 그리고 있는 쪽"을 가리킵니다. 요소 파일들은 ctx 만 쓰면 되고
   어느 층에 그릴지는 game.js 의 draw() 가 정합니다. */
let ctx = null;
let backTexture = null, frontTexture = null;
let backCtx = null, frontCtx = null;

function createFrameCanvas(scene){
  backTexture  = createStageFrameTexture(scene,"dinerFrameBack", STAGE_DEPTH.backOverlay);
  frontTexture = createStageFrameTexture(scene,"dinerFrameFront",STAGE_DEPTH.overlay);
  backCtx  = backTexture.getContext();
  frontCtx = frontTexture.getContext();
  ctx = frontCtx;
  return ctx;
}

// 층을 바꾸고 그 층을 지웁니다. 그린 순서가 곧 그 층 안에서의 앞뒤입니다.
function beginBackLayer(){  ctx=backCtx;  beginStageFrame(ctx); }
function beginFrontLayer(){ ctx=frontCtx; beginStageFrame(ctx); }

// 한 프레임 드로잉이 끝난 뒤 호출. 캔버스 내용을 텍스처에 반영합니다.
function commitFrame(){
  backTexture?.refresh();
  frontTexture?.refresh();
}


/* ------------------------------------------------------------
   2. 공용 드로잉 헬퍼
   ------------------------------------------------------------
   두 개 이상의 요소 파일이 같이 쓰는 것만 여기 둡니다.
   한 파일에서만 쓰는 헬퍼는 그 파일에 두세요.
   ------------------------------------------------------------ */

// 둥근 사각형. 거의 모든 패널·말풍선·라벨이 이걸 씁니다.
function roundRect(c,x,y,w,h,r,fill,stroke){
  r=Math.min(r,w/2,h/2);
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  if(fill)c.fill();
  if(stroke)c.stroke();
}

/* 이름표 둥실
   ------------------------------------------------------------
   주방 집기 이름표(kitchen.js)와 낮 준비물 이름표(prep.js)가 같이 씁니다.

   앞쪽 계산대·철판 명패는 counter.js 가 Phaser 컨테이너를 직접 흔들지만,
   이 둘은 프레임 캔버스에 매 프레임 다시 그리는 도형이라 같은 움직임을
   여기서 계산해서 넘겨받는 방식으로 만듭니다.

   [진폭이 counter.js 와 다른 이유] 저쪽은 VIEW(1920x1080) 좌표이고
   이 캔버스는 논리(1280x720) 좌표라, 화면에서 같은 크기로 보이려면
   1.5 로 나눠야 합니다. 2 → 1.3 / 7 → 4.7 이 그 값입니다.
   주기(freq)는 ms 당 라디안이라 좌표계와 무관하게 같습니다.
   연출을 바꿀 때는 counter.js 의 COUNTER_FLOAT 도 같이 고치세요.

   [강조 조건] "가까이 서 있는가"가 아니라 "지금 E 를 눌러 실제로
   쓸 수 있는가"입니다. 판정은 각 파일이 합니다.
     kitchen.js  stationUsable()
     prep.js     prepObjectUsable()
   ------------------------------------------------------------ */
const LABEL_FLOAT = {
  idle:   { amp:1.3, freq:0.0018 },   // 약 1.3px / 3.5초
  active: { amp:4.7, freq:0.0040 },   // 약 4.7px / 1.6초
  lerp:   0.05,                       // 진폭·주기·배율 보간 계수
  activeScale: 1.03,
  activeText:  "#fff2d2",
  activeLine:  "#d69a52"
};

// 이름표별 둥실 상태. 위상을 누적시켜야 진폭이 바뀌어도 튀지 않고,
// 시작 위상을 흩어 놓아야 여러 개가 한 몸처럼 오르내리지 않습니다.
const labelFloats = {};

/* id 별 상태를 한 프레임 진행시키고 { dy, scale, active } 를 돌려줍니다.
   delta 를 상태마다 따로 재는 이유는, 한 프레임에 여러 파일이 이 함수를
   부르기 때문입니다. 전역 타임스탬프 한 개로는 두 번째 호출이 delta 0 을
   받습니다. 상한 50ms 는 탭 복귀 직후 위상이 크게 튀는 것을 막습니다. */
function labelFloatStep(id,active){
  const now=performance.now();
  const f=labelFloats[id]||(labelFloats[id]={
    phase:Math.random()*Math.PI*2,
    amp:LABEL_FLOAT.idle.amp, freq:LABEL_FLOAT.idle.freq, scale:1, last:now
  });
  const delta=Math.min(50,now-f.last);
  f.last=now;

  const target=active?LABEL_FLOAT.active:LABEL_FLOAT.idle,k=LABEL_FLOAT.lerp;
  f.amp  +=(target.amp -f.amp )*k;
  f.freq +=(target.freq-f.freq)*k;
  f.scale+=((active?LABEL_FLOAT.activeScale:1)-f.scale)*k;
  f.phase+=f.freq*delta;

  return { dy:Math.sin(f.phase)*f.amp, scale:f.scale, active };
}

// 이름표가 커질 때 제자리에서 커지도록 중심 기준으로 배율을 겁니다.
// 부르는 쪽에서 ctx.save() / ctx.restore() 로 감싸세요.
function applyLabelScale(scale,cx,cy){
  if(!scale||scale===1)return;
  ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.translate(-cx,-cy);
}


/* 명판 그림 — 앞쪽 철판·계산대 명패와 같은 에셋
   ------------------------------------------------------------
   assets/counter/ui_nameplate (188x92, 나무판 + 금장 테두리).
   counter.js 가 철판·계산대 명패로 이미 받아 둔 그림을 그대로 씁니다.
   (같은 파일을 여기서 또 받으면 다운로드가 두 번 일어납니다)

   주방 집기 이름표(kitchen.js)와 낮 준비물 이름표(prep.js)가 같이 씁니다.
   원래 kitchen.js 안에 있던 것을, 준비물 이름표도 같은 판을 쓰게 되면서
   이 공용 파일로 옮겼습니다.

   ⚠️ counter.js 가 아직 안 받았거나 받기에 실패하면 null 입니다.
      부르는 쪽은 예전 도형 명판으로 되돌아가야 합니다.

   [3분할로 늘립니다] 네 귀퉁이에 금장 장식이 박혀 있어서 통째로 늘이면
   장식만 옆으로 눌립니다. 좌우 끝(cap)은 세로와 같은 배율로 그대로 두고
   가운데만 늘입니다. 가운데는 가로결 나뭇결이라 가로로 늘어나도
   눈에 띄지 않습니다.

   [미리 그려 두는 이유] 폭 종류가 이름 가짓수만큼뿐입니다. 폭마다 한 번만
   그려 캔버스에 담아 두고 이후에는 1:1 복사만 합니다. VIEW 픽셀로 만들어
   두어야 프레임 캔버스(x1.5)에서 흐려지지 않습니다.
   ------------------------------------------------------------ */
const NAMEPLATE_ART = {
  key:"counter_nameplate",
  srcY:4, srcH:84,   // 원본 위 4px 은 투명 여백이라 뺍니다
  cap:30             // 좌우 끝 금장 장식 폭 (원본 px)
};

/* 판 위 글자 색. 철판 명패와 같습니다 (counter.js COUNTER_LABEL_STYLE).
   나뭇결 위에 밝은 글자만 얹으면 획이 결에 묻혀서, 저쪽도 어두운 외곽선을
   두르고 있습니다. 외곽선 굵기는 글자 크기마다 달라서 부르는 쪽이 정합니다
   (철판 21px 에 4 → 집기 13px 에 2.5 → 준비물 12px 에 2.3). */
const NAMEPLATE_TEXT = { fill:"#f4dcab", activeFill:"#fff2d2", stroke:"#1d1108" };

const nameplateCanvases = {};

function nameplateCanvas(w,h){
  const cacheKey=`${w}x${h}`;
  if(cacheKey in nameplateCanvases) return nameplateCanvases[cacheKey];

  const image=typeof counterImages!=="undefined"?counterImages[NAMEPLATE_ART.key]:null;
  if(!image) return null;   // 아직 로딩 전. 캐시에 넣지 않아야 다음 프레임에 다시 봅니다.

  const A=NAMEPLATE_ART;
  const canvas=document.createElement("canvas");
  canvas.width =Math.round(toView(w));
  canvas.height=Math.round(toView(h));
  const g=canvas.getContext("2d");
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";

  const capW=Math.round(A.cap*(canvas.height/A.srcH));   // 세로와 같은 배율
  const midW=canvas.width-capW*2;
  if(midW>0){
    g.drawImage(image, 0,A.srcY, A.cap,A.srcH,                     0,0, capW,canvas.height);
    g.drawImage(image, A.cap,A.srcY, image.width-A.cap*2,A.srcH,   capW,0, midW,canvas.height);
    g.drawImage(image, image.width-A.cap,A.srcY, A.cap,A.srcH,     canvas.width-capW,0, capW,canvas.height);
  }else{
    // 장식 두 개도 못 들어갈 만큼 좁으면 그냥 통째로 줄입니다.
    g.drawImage(image, 0,A.srcY, image.width,A.srcH, 0,0, canvas.width,canvas.height);
  }

  nameplateCanvases[cacheKey]=canvas;
  return canvas;
}


/* 집기·준비물 이름표. (x, y) 는 글자 baseline 기준입니다.
   폭은 고정값이 아니라 글자 실측 폭 + 좌우 여백입니다.
   "두부김치용 김치 썰기" 처럼 긴 이름이 명판을 뚫고 나가지 않게 하려는 것이고,
   짧은 이름은 minW 아래로는 줄어들지 않아 명판 크기가 들쭉날쭉해지지 않습니다.

   [여백·높이가 커진 이유] 판이 도형에서 나무판 그림(NAMEPLATE_ART)으로
   바뀌면서 상하좌우 끝을 금장 테두리가 차지합니다. 예전 값(11 / 24)으로는
   글자가 테두리에 바짝 붙습니다. 집기 이름표와 같은 비율로 맞춘 값입니다
   — 저쪽은 13px 글자에 여백 17 · 높이 29 라, 12px 글자면 16 · 27 입니다.
   bg·line·text 는 그림을 못 받았을 때 쓰는 예비 도형 값입니다. */
const FIXTURE_LABEL = { minW:70, padX:16, h:27, radius:5, strokeWidth:2.3, font:"bold 12px Malgun Gothic", bg:"#1b100b", line:"#9a6235", text:"#f0c87b" };

// 이름표 폭. 글자 폭 측정에 ctx.font 를 쓰므로 원래 font 는 되돌려 놓습니다.
function fixtureLabelWidth(text){
  const L=FIXTURE_LABEL,previousFont=ctx.font;
  ctx.font=L.font;
  const width=Math.max(L.minW,Math.ceil(ctx.measureText(String(text)).width)+L.padX*2);
  ctx.font=previousFont;
  return width;
}

/* float 은 labelFloatStep() 의 반환값입니다. 안 넘기면 예전처럼 가만히 있습니다.
   glow 가 참이면 판 뒤에 안내 발광을 깝니다. (fx.js §3 drawPlateGlow)

   [판 한가운데를 기준으로 놓습니다] 판 높이가 바뀌어도 위아래로 똑같이
   늘어나게 하려는 것입니다. 예전 도형 명판의 한가운데(글자 baseline 위 5)를
   그대로 쓰므로, 판만 커지고 준비물·완료 도장과의 간격은 그대로입니다. */
function drawFixtureLabel(text,x,y,float,glow=false){
  const L=FIXTURE_LABEL,w=fixtureLabelWidth(text);
  const boxY=y-5-L.h/2+(float?.dy||0);
  ctx.save();
  applyLabelScale(float?.scale,x,boxY+L.h/2);

  // 판보다 먼저 그려야 판이 빛 위에 얹혀 안쪽이 깔끔합니다.
  if(glow)drawPlateGlow(x-w/2,boxY,w,L.h);

  /* 판. 철판 명패와 같은 나무판 그림입니다.
     [강조 표현] 그림 판에는 바꿀 테두리가 없어서, 글자 색과 크기
     (applyLabelScale)로만 강조합니다 — 집기 이름표(kitchen.js)와 같습니다. */
  const plate=nameplateCanvas(w,L.h);
  if(plate){
    ctx.drawImage(plate,x-w/2,boxY,w,L.h);
  }else{
    // 그림을 아직 못 받았을 때의 예비 도형 (예전 명판)
    ctx.fillStyle=L.bg;
    roundRect(ctx,x-w/2,boxY,w,L.h,L.radius,true,false);
    ctx.strokeStyle=float?.active?LABEL_FLOAT.activeLine:L.line;ctx.lineWidth=2;
    roundRect(ctx,x-w/2,boxY,w,L.h,L.radius,false,true);
  }

  /* 글자는 판 한가운데. textBaseline="middle" 을 쓰면 판 높이를 바꿔도
     baseline 보정값을 다시 잡을 필요가 없습니다. */
  const textY=boxY+L.h/2;
  ctx.font=L.font;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.lineJoin="round";                         // 획 모서리에 뿔이 서지 않게
  ctx.strokeStyle=NAMEPLATE_TEXT.stroke;ctx.lineWidth=L.strokeWidth;
  ctx.strokeText(text,x,textY);
  ctx.fillStyle=float?.active?NAMEPLATE_TEXT.activeFill:NAMEPLATE_TEXT.fill;
  ctx.fillText(text,x,textY);
  ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.lineJoin="miter";
  ctx.restore();
}

// 음식 그림은 food-props.js 로 옮겼습니다. 캔버스에 그리는 함수는
// 그 파일의 drawFoodProp(dishId, centerX, centerY, maxW, maxH, grade) 입니다.
// (예전 drawFoodIcon(index, ...) 은 스프라이트시트 인덱스를 받았습니다)

/* 캔버스 텍스트 줄바꿈. 호출 전에 ctx.font 를 먼저 설정해야 합니다.

   [띄어쓰기 단위로 끊습니다] 예전에는 글자 단위로 잘라서 "김치볶음밥 주
   세요" 처럼 낱말 한가운데가 갈라졌습니다. 짧은 손님 멘트에서는 이게
   눈에 띄게 읽기 나쁩니다. 지금은 어절을 통째로 다음 줄로 넘깁니다.

   [한 어절이 줄보다 길면] 그 어절만 예외로 글자 단위로 끊습니다.
   띄어쓰기가 없는 긴 문장이 통째로 상자 밖으로 삐져나가지 않게 하는
   최후의 수단입니다. */
function wrapCanvasText(text,maxWidth,maxLines){
  const lines=[];let line="";
  const source=String(text??"");
  // 줄을 확정하고, 더 담을 자리가 없으면 true.
  const push=()=>{lines.push(line.trim());line="";return lines.length>=maxLines;};

  for(const word of source.split(/\s+/).filter(Boolean)){
    const joined=line?`${line} ${word}`:word;
    if(!line||ctx.measureText(joined).width<=maxWidth)line=joined;
    else{if(push())break;line=word;}

    // 지금 줄이 어절 하나뿐인데도 넘치는 경우에만 글자 단위로 쪼갭니다.
    if(ctx.measureText(line).width<=maxWidth)continue;
    const long=line;let full=false;line="";
    for(const char of long){
      if(line&&ctx.measureText(line+char).width>maxWidth&&(full=push()))break;
      line+=char;
    }
    if(full)break;
  }

  if(lines.length<maxLines&&line.trim())lines.push(line.trim());
  // 담지 못한 글자가 남았으면 마지막 줄을 말줄임표로 마무리합니다.
  const dropped=lines.join("").replace(/\s/g,"").length<source.replace(/\s/g,"").length;
  if(lines.length===maxLines&&dropped)lines[maxLines-1]=`${lines[maxLines-1].replace(/[.…]*$/g,"")}…`;
  return lines;
}
