"use strict";

/* ============================================================
   손님 (카운터에 앉은 손님 · 주문 말풍선 · 대사 말풍선)
   ------------------------------------------------------------
   담당 범위: 좌석 위치 · 앉는 높이 · 스프라이트 크기 ·
              주문 아이콘/선택 표시/말풍선의 위치와 드로잉

   담당 범위가 아님: 손님 생성, 주문 내용, 만족도, 스토리 손님
              → night.js / story.js

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   [의자와의 관계] 좌석 x 는 counter.js 의 의자 5개 중 앞 4개의 중심입니다.
   의자를 옮기면 여기 CUSTOMER_SEATS 도 같이 옮겨야 합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 좌석
   ------------------------------------------------------------
   counter.js COUNTER_LAYOUT.chairs 의 VIEW x(726/924/1122/1320) 에
   의자 폭 88 의 절반을 더한 중심을 논리 좌표로 옮긴 값입니다.
   5번 의자(논리 1041)는 빈자리로 남겨 둡니다.
   ------------------------------------------------------------ */

// counter.js 가 계산해 준 의자 중심(VIEW)을 논리 좌표로 옮깁니다.
// 의자를 옮기거나 COUNTER_FIT.scale 을 바꾸면 손님도 자동으로 따라옵니다.
// 앞 4자리만 쓰고 5번 의자는 빈자리로 남겨 둡니다.
const CUSTOMER_SEATS = COUNTER_CHAIR_CENTERS.slice(0,4).map(x=>Math.round(toLogic(x)));

// 요리사가 이 지점 가까이 와야 서빙할 수 있습니다. 손님이 그려지는
// 위치가 아니라 "카운터 너머로 접시를 건네는 자리"입니다.
const CUSTOMER_SERVICE_Y = 475;
const CUSTOMER_SERVE_REACH = 82;      // E 키 서빙
const CUSTOMER_AUTO_SERVE_REACH = 64; // 가까이 가면 자동 서빙

// 앉았을 때의 기준 y. 머리·어깨가 의자 등받이(VIEW 878)보다 위로
// 올라오도록 맞췄습니다. 값을 키우면 손님이 의자 뒤로 가라앉습니다.
const CUSTOMER_SEAT_Y = 607;
const CUSTOMER_ENTER_Y = 700;   // 화면 아래에서 걸어 들어오는 시작 높이

// 원본 시트는 44x60 셀. 카운터 에셋에 비해 캐릭터가 작아서 키운 상태입니다.
// (원래 54x74 → 83x113). 캐릭터 에셋이 새로 들어오면 다시 맞춰야 합니다.
const CUSTOMER_SPRITE = { frameW:44, frameH:60, w:83, h:113, anchor:.838 };

// 손님 머리 위에 뜨는 것들의 y 오프셋(손님 기준 y 로부터).
const CUSTOMER_HUD = {
  bubbleY:-145, bubbleW:76, bubbleH:55,   // 주문 아이콘 패널
  iconY:-140, iconSize:38,
  tailY:-90,                              // 패널 꼬리
  ringY:-52, ringR:46,                    // 선택된 손님 강조 원
  labelY:-152,                            // 번호 / 이름
  speechY:-175,                           // 대사 말풍선
  departSpeechY:-135
};

const CUSTOMER_SPEECH = { maxWidth:142, maxLines:2, minW:92, maxW:158, lineH:17, pad:22, margin:180 };


/* ------------------------------------------------------------
   2. 드로잉
   ------------------------------------------------------------ */

function drawCustomers(){
  if(state.phase!=="night"&&state.phase!=="result")return;
  const t=performance.now()/1000;

  state.orders.forEach(order=>{
    const x=CUSTOMER_SEATS[order.slot];
    const entered=1-Math.pow(1-order.entered,3);
    const y=lerp(CUSTOMER_ENTER_Y,CUSTOMER_SEAT_Y,entered);
    drawCustomerSprite(order.variant,x,y,Math.floor(t*2+order.id)%4,1);

    const selected=state.selectedOrderId===order.id;
    const H=CUSTOMER_HUD;
    ctx.fillStyle=selected?"#fff0bd":"#efd9ae";
    roundRect(ctx,x-H.bubbleW/2,y+H.bubbleY,H.bubbleW,H.bubbleH,9,true,false);
    ctx.strokeStyle=selected?"#f5bd50":"#5a3724";ctx.lineWidth=selected?4:2;
    roundRect(ctx,x-H.bubbleW/2,y+H.bubbleY,H.bubbleW,H.bubbleH,9,false,true);
    drawFoodIcon(dishById(order.dishId).icon,x-H.iconSize/2,y+H.iconY,H.iconSize);
    ctx.fillStyle="#3b2518";ctx.beginPath();
    ctx.moveTo(x-5,y+H.tailY);ctx.lineTo(x+6,y+H.tailY+10);ctx.lineTo(x+10,y+H.tailY);ctx.fill();

    if(selected){
      ctx.strokeStyle="#ffd776";ctx.lineWidth=3;ctx.beginPath();
      ctx.arc(x,y+H.ringY,H.ringR+Math.sin(t*5)*2,0,Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle="#ffe1a0";ctx.font="bold 12px Malgun Gothic";ctx.textAlign="center";
    ctx.fillText(order.guestId?storyOrderLabel(order):`${order.slot+1}`,x,y+H.labelY);
    ctx.textAlign="left";

    if(order.bubble&&order.bubbleTime>0&&entered>.85)drawCustomerSpeech(order.bubble,x,y+H.speechY);
  });

  state.departures.forEach((item,index)=>{
    const x=CUSTOMER_SEATS[item.slot];
    const alpha=clamp(item.life/3.2,0,1);
    const y=CUSTOMER_SEAT_Y-Math.min(16,(3.2-item.life)*5);
    drawCustomerSprite(item.variant,x,y,(Math.floor(t*2)+index)%4,alpha);
    drawCustomerSpeech(item.bubble,x,y+CUSTOMER_HUD.departSpeechY,alpha);
  });
}

function drawCustomerSprite(variant,x,y,frame,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;
  const S=CUSTOMER_SPRITE;
  if(images.customers)
    ctx.drawImage(images.customers,frame*S.frameW,variant*S.frameH,S.frameW,S.frameH,
      x-S.w/2,y-S.h*S.anchor,S.w,S.h);
  else{ctx.fillStyle="#48352b";ctx.fillRect(x-S.w*.37,y-S.h*.75,S.w*.74,S.h*.75);}
  ctx.restore();
}

function drawCustomerSpeech(text,x,bottomY,alpha=1){
  if(!text)return;
  const S=CUSTOMER_SPEECH;
  ctx.save();ctx.globalAlpha=alpha;
  ctx.font="bold 12px Malgun Gothic";
  const lines=wrapCanvasText(text,S.maxWidth,S.maxLines);
  const width=Math.min(S.maxW,Math.max(S.minW,...lines.map(line=>ctx.measureText(line).width+S.pad)));
  const height=lines.length*S.lineH+15;
  const left=clamp(x-width/2,S.margin,W-S.margin-width),top=bottomY-height;
  ctx.fillStyle="rgba(35,20,13,.95)";ctx.strokeStyle="#d0a05b";ctx.lineWidth=2;
  roundRect(ctx,left,top,width,height,8,true,true);
  ctx.fillStyle="#f8dfae";ctx.textAlign="center";
  lines.forEach((line,i)=>ctx.fillText(line,left+width/2,top+20+i*S.lineH));
  ctx.textAlign="left";
  ctx.restore();
}
