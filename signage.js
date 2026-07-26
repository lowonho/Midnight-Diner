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
  line:"#c18a3f",
  font:"bold 22px Malgun Gothic",
  textDy:44,
  // 낮(day)에는 빨간 '영업전', 밤(night)에는 초록 '영업중'. 그 외 페이즈는 간판을 숨깁니다.
  states:{
    day:{ bg:"#361a15", text:"#e2553c", label:"영업전" },
    night:{ bg:"#263619", text:"#b8d86d", label:"영업중" }
  }
};

function drawSignage(){
  const S=OPEN_SIGN,mode=S.states[state.phase];
  if(!mode)return;
  ctx.fillStyle=mode.bg;roundRect(ctx,S.x,S.y,S.w,S.h,S.radius,true,false);
  ctx.strokeStyle=S.line;ctx.lineWidth=4;roundRect(ctx,S.x,S.y,S.w,S.h,S.radius,false,true);
  ctx.fillStyle=mode.text;ctx.font=S.font;ctx.textAlign="center";
  ctx.fillText(mode.label,S.x+S.w/2,S.y+S.textDy);
  ctx.textAlign="left";
}
