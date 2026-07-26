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

function drawFixtureLabel(text,x,y){
  const L=FIXTURE_LABEL,w=fixtureLabelWidth(text);
  ctx.fillStyle=L.bg;
  roundRect(ctx,x-w/2,y-17,w,L.h,L.radius,true,false);
  ctx.strokeStyle=L.line;ctx.lineWidth=2;
  roundRect(ctx,x-w/2,y-17,w,L.h,L.radius,false,true);
  ctx.fillStyle=L.text;ctx.font=L.font;ctx.textAlign="center";
  ctx.fillText(text,x,y);
  ctx.textAlign="left";
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
