"use strict";

/* ============================================================
   간판 (영업중 입간판)
   ------------------------------------------------------------
   담당 범위: 아직 에셋이 없어 캔버스 도형으로 그리는 간판류

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   [현재 상태] 카운터 오른쪽 끝, 5번 의자 바깥에 놓인 플레이스홀더입니다.
   간판 에셋이 들어오면 counter.js 처럼 Phaser 이미지로 바꾸고
   이 파일은 지우면 됩니다.
   ============================================================ */

const OPEN_SIGN = {
  x:1105, y:588, w:100, h:74, radius:7,
  bg:"#263619", line:"#c18a3f", text:"#b8d86d",
  font:"bold 22px Malgun Gothic", label:"영업중",
  textDy:44
};

function drawSignage(){
  if(state.phase!=="night")return;
  const S=OPEN_SIGN;
  ctx.fillStyle=S.bg;roundRect(ctx,S.x,S.y,S.w,S.h,S.radius,true,false);
  ctx.strokeStyle=S.line;ctx.lineWidth=4;roundRect(ctx,S.x,S.y,S.w,S.h,S.radius,false,true);
  ctx.fillStyle=S.text;ctx.font=S.font;ctx.textAlign="center";
  ctx.fillText(S.label,S.x+S.w/2,S.y+S.textDy);
  ctx.textAlign="left";
}
