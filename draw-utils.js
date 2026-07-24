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

let ctx = null;
let frameTexture = null;

function createFrameCanvas(scene){
  frameTexture = createStageFrameTexture(scene,"dinerFrame");
  ctx = frameTexture.getContext();
  return ctx;
}

// 한 프레임 드로잉이 끝난 뒤 호출. 캔버스 내용을 텍스처에 반영합니다.
function commitFrame(){
  frameTexture?.refresh();
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

// 집기·준비물 이름표. (x, y) 는 글자 baseline 기준입니다.
const FIXTURE_LABEL = { w:70, h:24, radius:5, font:"bold 12px Malgun Gothic", bg:"#1b100b", line:"#9a6235", text:"#f0c87b" };

function drawFixtureLabel(text,x,y){
  ctx.fillStyle=FIXTURE_LABEL.bg;
  roundRect(ctx,x-FIXTURE_LABEL.w/2,y-17,FIXTURE_LABEL.w,FIXTURE_LABEL.h,FIXTURE_LABEL.radius,true,false);
  ctx.strokeStyle=FIXTURE_LABEL.line;ctx.lineWidth=2;
  roundRect(ctx,x-FIXTURE_LABEL.w/2,y-17,FIXTURE_LABEL.w,FIXTURE_LABEL.h,FIXTURE_LABEL.radius,false,true);
  ctx.fillStyle=FIXTURE_LABEL.text;ctx.font=FIXTURE_LABEL.font;ctx.textAlign="center";
  ctx.fillText(text,x,y);
  ctx.textAlign="left";
}

// 음식 아이콘 스프라이트시트(64x64 x 6). images.food 는 game.js 가 로드합니다.
const FOOD_ICON_FRAME = 64;

function drawFoodIcon(index,x,y,size){
  if(images.food)ctx.drawImage(images.food,index*FOOD_ICON_FRAME,0,FOOD_ICON_FRAME,FOOD_ICON_FRAME,x,y,size,size);
  else{ctx.fillStyle="#d69c4b";ctx.beginPath();ctx.arc(x+size/2,y+size/2,size*.35,0,Math.PI*2);ctx.fill();}
}

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
