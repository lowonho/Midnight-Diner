"use strict";

/* ============================================================
   손님 (카운터에 앉은 손님 · 주문 말풍선 · 대사 말풍선)
   ------------------------------------------------------------
   담당 범위: 좌석 위치 · 앉는 높이 · 스프라이트 크기 · 등장 연출 ·
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
// 말풍선·주문 패널·강조 원이 전부 이 y 를 기준으로 붙어 있으므로
// 그림만 바꿀 때는 이 값이 아니라 아래 CUSTOMER_COMMON 을 만지세요.
const CUSTOMER_SEAT_Y = 607;

// 원본 시트는 44x60 셀. 카운터 에셋에 비해 캐릭터가 작아서 키운 상태입니다.
// (원래 54x74 → 83x113). 지금은 스토리 손님 전용입니다. (§1-2)
const CUSTOMER_SPRITE = { frameW:44, frameH:60, w:83, h:113, anchor:.838 };


/* ------------------------------------------------------------
   1-2. 일반 손님 원화 (뒷모습으로 앉은 8종)
   ------------------------------------------------------------
   assets/customer/Common/ 의 원화 8장을 tools/build-customer-sprites.js 가
   시트 한 장으로 묶어 줍니다. 4열(정지 애니메이션) x 8행(캐릭터).

     원화 교체·추가 → 그 폴더에 넣고 node tools/build-customer-sprites.js

   [스토리 손님은 쓰지 않습니다] 특별 손님은 캐릭터마다 얼굴이 정해져
   있어서(story.js portraitRow) 예전 시트를 그대로 씁니다. 그림을 고르는
   판정은 §2 의 usesCommonArt() 한 곳에만 있습니다.

   [크기 기준] 셀 아래변이 발바닥입니다. 그래서 세로 위치는 "발이 어디에
   닿는가"로 잡습니다. 의자 바닥선(counter.js chairSize.y 1042 → 논리 695)에서
   8 올린 687 입니다. 카운터 앞변 아래로 신발이 보이면서, 머리끝이 바 상판
   윗변(VIEW 782)보다 확실히 올라와 눈높이가 잘 보입니다.

   [footY 를 687 보다 더 줄이지 마세요] 주문 패널 아랫변이 논리 517 이고
   지금 머리끝이 정확히 517 입니다. 여기서 더 올리면 머리가 패널을 파고듭니다.
   더 올리려면 CUSTOMER_HUD 의 bubbleY / iconY / tailY / labelY / speechY 를
   같은 값만큼 같이 올려야 하는데, 그러면 예전 시트를 쓰는 특별 손님의
   말풍선이 머리에서 떨어집니다.

   손님을 키우거나 줄일 때는 h 만 고치세요. w 는 셀 비율(144:282)을
   유지해야 캐릭터가 홀쭉해지거나 뚱뚱해지지 않습니다.
   ------------------------------------------------------------ */

const CUSTOMER_COMMON = {
  file: "assets/customer/customer_common_sheet.webp",
  cols: 4,      // 프레임 수 (가로)
  rows: 8,      // 캐릭터 수 (세로)
  w: 87,        // 화면에 그릴 셀 크기(논리 좌표). 셀 원본은 144x282
  h: 170,
  footY: 687    // 발바닥이 닿는 논리 y (의자 바닥선 695 에서 8 위)
};

// 일반 손님 variant 의 범위. night.js 가 이 값으로 뽑습니다.
// 원화를 늘리면 시트 행 수와 여기가 같이 늘어납니다.
const CUSTOMER_VARIANT_COUNT = CUSTOMER_COMMON.rows;

// 손님 기준 y 로부터 발바닥까지의 거리. 기준 y 는 그대로 두고
// 그림만 발 기준으로 놓기 위한 보정값입니다.
const CUSTOMER_COMMON_FOOT_OFFSET = CUSTOMER_COMMON.footY - CUSTOMER_SEAT_Y;

// 정지 애니메이션 재생 속도(프레임/초). 손님마다 위상을 어긋나게 해서
// 네 명이 한 몸처럼 같이 숨쉬지 않게 합니다.
const CUSTOMER_IDLE_FPS = 5;

let customerCommonSheet = null;

/* game.js 의 에셋 로딩 Promise.all 에 stage.js loadStageAssets() 를 거쳐
   들어갑니다. (요리사 시트와 같은 경로 — stage.js §5 주석 참고)

   시트가 없어도 게임은 돌아가야 하므로 실패해도 reject 하지 않습니다.
   그때는 예전 스프라이트시트로 물러섭니다. */
function loadCommonCustomerSheet(){
  return new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{
      if(image.width%CUSTOMER_COMMON.cols||image.height%CUSTOMER_COMMON.rows)
        console.warn(`[customers] 손님 시트 격자 불일치: ${image.width}x${image.height} / ${CUSTOMER_COMMON.cols}열 ${CUSTOMER_COMMON.rows}행`);
      customerCommonSheet=image;
      resolve(image);
    };
    image.onerror=()=>{
      console.warn(`[customers] 일반 손님 시트를 불러오지 못했습니다: ${CUSTOMER_COMMON.file}`);
      resolve(null);
    };
    image.src=CUSTOMER_COMMON.file;
  });
}


/* ------------------------------------------------------------
   1-3. 등장 연출 — 위에서 내려와 앉기
   ------------------------------------------------------------
   예전에는 화면 아래(논리 700)에서 좌석(607)으로 올라왔습니다.
   원화가 "앉아 있는 뒷모습"으로 바뀌면서, 걸어 들어오는 것처럼 밑에서
   솟아오르면 다리가 카운터를 뚫고 올라오는 것처럼 보입니다.

   그래서 좌석 위에서 내려앉는 쪽으로 뒤집었습니다.
   의자(counter.js COUNTER_DEPTH.chair 42)가 손님(프레임 캔버스 40)보다
   앞이라, 내려오는 동안 몸이 등받이 뒤로 미끄러져 들어가면서 가려집니다.
   그게 "앉았다"는 느낌을 만드는 실제 장치입니다.

   진행도(order.entered)는 night.js 가 초당 2.1 로 올립니다. 약 0.48초에
   끝나므로 아래 값들도 그 길이 안에서 읽히도록 잡았습니다.

     rise    시작 높이. 키우면 더 높은 데서 떨어집니다
     landAt  엉덩이가 의자에 닿는 진행도. 뒤로 미루면 낙하가 길어집니다
     sink    닿는 순간 눌렸다가 되돌아오는 깊이. 0 이면 딱 멈춥니다
     fadeIn  이 진행도까지 서서히 나타납니다 (허공에서 튀어나오지 않게)

   [rise 를 더 키우지 마세요] 64 면 시작할 때 발이 의자 앉는 면 높이입니다.
   여기서 더 올리면 머리가 카운터를 넘어 주방 바닥까지 올라가서, 앉는 게
   아니라 위에서 떨어지는 것처럼 보입니다. fadeIn 은 낙하 구간의 8할쯤에
   맞춰 두어야 제일 높은 지점이 거의 안 보입니다.
   ------------------------------------------------------------ */

const CUSTOMER_ENTER = { rise:64, landAt:.66, sink:6, fadeIn:.55 };

// 특별 손님은 예전처럼 등장 내내 서서히 나타납니다. 낙하 폭도 조금 작습니다.
const CUSTOMER_ENTER_STORY = { rise:46, landAt:.74, sink:4, fadeIn:1 };

/* 진행도 0~1 → 좌석 기준 세로 오프셋(+가 아래). 좌석에 앉으면 0 입니다.

   낙하 구간은 (1 - p²) 이라 뒤로 갈수록 빨라집니다. 등속으로 내리면
   엘리베이터처럼 보이고, 가속이 붙어야 "앉는다"로 읽힙니다.
   착석 구간은 반 주기 사인이라 시작과 끝이 정확히 0 입니다. */
function customerEnterOffset(progress,setting){
  if(progress<setting.landAt){
    const p=progress/setting.landAt;
    return -setting.rise*(1-p*p);
  }
  const q=(progress-setting.landAt)/(1-setting.landAt||1);
  return setting.sink*Math.sin(Math.PI*q)*(1-q*.5);
}

// 손님 머리 위에 뜨는 것들의 y 오프셋(손님 기준 y 로부터).
const CUSTOMER_HUD = {
  bubbleY:-145, bubbleW:76, bubbleH:55,   // 주문 아이콘 패널
  // 음식 그림은 가로형(264x152)이라 패널 안쪽에 폭 기준으로 맞춥니다.
  // iconY 는 패널 세로 중앙(bubbleY + bubbleH/2).
  iconY:-117, iconW:66, iconH:44,
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

/* 이 손님을 새 원화(일반 손님 8종)로 그릴지 판정합니다.
   특별 손님은 얼굴이 정해져 있어서(story.js portraitRow) 예전 시트를 씁니다.
   state.departures 항목에는 customerType 이 없어서 guestId 로도 봅니다. */
function usesCommonArt(customer){
  return !!customerCommonSheet&&customer.customerType!=="story"&&!customer.guestId;
}

// 손님마다 위상을 어긋나게 한 정지 애니메이션 프레임 번호.
function customerIdleFrame(t,seed){
  return Math.floor(t*CUSTOMER_IDLE_FPS+seed)%CUSTOMER_COMMON.cols;
}

function drawCustomers(){
  if(state.phase!=="night"&&state.phase!=="result")return;
  const t=performance.now()/1000;

  state.orders.forEach(order=>{
    const x=CUSTOMER_SEATS[order.slot];
    const storyEntrance=order.customerType==="story";
    const enter=storyEntrance?CUSTOMER_ENTER_STORY:CUSTOMER_ENTER;
    const progress=clamp(order.entered,0,1);
    const y=CUSTOMER_SEAT_Y+customerEnterOffset(progress,enter);
    const entryAlpha=clamp(progress/enter.fadeIn,0,1);
    drawCustomerSprite(order.variant,x,y,customerIdleFrame(t,order.id),entryAlpha,order);

    ctx.save();ctx.globalAlpha=entryAlpha;
    const visitorOnly=storyEntrance&&order.guestOrder===false;
    const selected=!visitorOnly&&state.selectedOrderId===order.id;
    const H=CUSTOMER_HUD;
    if(!visitorOnly){
      ctx.fillStyle=selected?"#fff0bd":"#efd9ae";
      roundRect(ctx,x-H.bubbleW/2,y+H.bubbleY,H.bubbleW,H.bubbleH,9,true,false);
      ctx.strokeStyle=selected?"#f5bd50":"#5a3724";ctx.lineWidth=selected?4:2;
      roundRect(ctx,x-H.bubbleW/2,y+H.bubbleY,H.bubbleW,H.bubbleH,9,false,true);
      // 주문 표시라 아직 조리 전입니다. 등급은 기본(normal) 그림을 씁니다.
      // 반짝임은 요리사가 손에 들었을 때만 나옵니다. (player.js syncCarriedFoodFx)
      drawFoodProp(order.dishId,x,y+H.iconY,H.iconW,H.iconH);
      ctx.fillStyle="#3b2518";ctx.beginPath();
      ctx.moveTo(x-5,y+H.tailY);ctx.lineTo(x+6,y+H.tailY+10);ctx.lineTo(x+10,y+H.tailY);ctx.fill();
    }

    if(selected){
      ctx.strokeStyle="#ffd776";ctx.lineWidth=3;ctx.beginPath();
      ctx.arc(x,y+H.ringY,H.ringR+Math.sin(t*5)*2,0,Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle="#ffe1a0";ctx.font="bold 12px Malgun Gothic";ctx.textAlign="center";
    ctx.fillText(order.guestId?storyOrderLabel(order):`${order.slot+1}`,x,y+H.labelY);
    ctx.textAlign="left";

    ctx.restore();
    if(order.bubble&&order.bubbleTime>0&&progress>.85)drawCustomerSpeech(order.bubble,x,y+H.speechY,entryAlpha);
  });

  // 떠나는 손님은 일어서듯 살짝 뜨면서 사라집니다. (등장과 반대 방향)
  state.departures.forEach((item,index)=>{
    const x=CUSTOMER_SEATS[item.slot];
    const alpha=clamp(item.life/3.2,0,1);
    const y=CUSTOMER_SEAT_Y-Math.min(16,(3.2-item.life)*5);
    drawCustomerSprite(item.variant,x,y,customerIdleFrame(t,index),alpha,item);
    drawCustomerSpeech(item.bubble,x,y+CUSTOMER_HUD.departSpeechY,alpha);
  });
}

/* customer 는 state.orders 또는 state.departures 의 항목입니다.
   어떤 그림을 쓸지 판정하는 데만 씁니다. (usesCommonArt) */
function drawCustomerSprite(variant,x,y,frame,alpha=1,customer={}){
  ctx.save();ctx.globalAlpha=alpha;

  if(usesCommonArt(customer)){
    // 셀 크기는 파일에서 읽습니다. 시트를 다시 뽑아 해상도가 바뀌어도
    // 여기를 고칠 필요가 없습니다. 세로는 발바닥(셀 아래변) 기준입니다.
    const C=CUSTOMER_COMMON;
    const cellW=customerCommonSheet.width/C.cols,cellH=customerCommonSheet.height/C.rows;
    ctx.drawImage(customerCommonSheet,
      (frame%C.cols)*cellW,(variant%C.rows)*cellH,cellW,cellH,
      x-C.w/2,y+CUSTOMER_COMMON_FOOT_OFFSET-C.h,C.w,C.h);
    ctx.restore();
    return;
  }

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
