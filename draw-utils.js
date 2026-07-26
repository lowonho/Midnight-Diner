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


/* 집기·준비물 이름표. (x, y) 는 글자 baseline 기준입니다.
   폭은 고정값이 아니라 글자 실측 폭 + 좌우 여백입니다.
   "두부김치용 김치" 처럼 긴 이름이 명판을 뚫고 나가지 않게 하려는 것이고,
   짧은 이름은 minW 아래로는 줄어들지 않아 명판 크기가 들쭉날쭉해지지 않습니다. */
const FIXTURE_LABEL = { minW:70, padX:11, h:24, radius:5, font:"bold 12px Malgun Gothic", bg:"#1b100b", line:"#9a6235", text:"#f0c87b" };

// 이름표 폭. 글자 폭 측정에 ctx.font 를 쓰므로 원래 font 는 되돌려 놓습니다.
function fixtureLabelWidth(text){
  const L=FIXTURE_LABEL,previousFont=ctx.font;
  ctx.font=L.font;
  const width=Math.max(L.minW,Math.ceil(ctx.measureText(String(text)).width)+L.padX*2);
  ctx.font=previousFont;
  return width;
}

// float 은 labelFloatStep() 의 반환값입니다. 안 넘기면 예전처럼 가만히 있습니다.
function drawFixtureLabel(text,x,y,float){
  const L=FIXTURE_LABEL,w=fixtureLabelWidth(text);
  const boxY=y-17+(float?.dy||0);
  ctx.save();
  applyLabelScale(float?.scale,x,boxY+L.h/2);
  ctx.fillStyle=L.bg;
  roundRect(ctx,x-w/2,boxY,w,L.h,L.radius,true,false);
  ctx.strokeStyle=float?.active?LABEL_FLOAT.activeLine:L.line;ctx.lineWidth=2;
  roundRect(ctx,x-w/2,boxY,w,L.h,L.radius,false,true);
  ctx.fillStyle=float?.active?LABEL_FLOAT.activeText:L.text;ctx.font=L.font;ctx.textAlign="center";
  ctx.fillText(text,x,boxY+17);
  ctx.textAlign="left";
  ctx.restore();
}

// 음식 그림은 food-props.js 로 옮겼습니다. 캔버스에 그리는 함수는
// 그 파일의 drawFoodProp(dishId, centerX, centerY, maxW, maxH, perfect) 입니다.
// (예전 drawFoodIcon(index, ...) 은 스프라이트시트 인덱스를 받았습니다)

// 캔버스 텍스트 줄바꿈. 호출 전에 ctx.font 를 먼저 설정해야 합니다.
function wrapCanvasText(text,maxWidth,maxLines){
  const lines=[];let line="";
  for(const char of text){
    const next=line+char;
    if(line&&ctx.measureText(next).width>maxWidth){lines.push(line.trim());line=char;if(lines.length===maxLines)break;}
    else line=next;
  }
  if(lines.length<maxLines&&line.trim())lines.push(line.trim());
  if(lines.length===maxLines&&lines.join("").length<text.replace(/\s/g,"").length)lines[maxLines-1]=`${lines[maxLines-1].replace(/[.…]*$/g,"")}…`;
  return lines;
}
