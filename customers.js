"use strict";

/* ============================================================
   손님 (카운터에 앉은 손님 · 주문 말풍선 · 대사 말풍선)
   ------------------------------------------------------------
   담당 범위: 좌석 위치 · 앉는 높이 · 스프라이트 크기 · 등장 연출 ·
              주문 아이콘/선택 표시/말풍선의 위치와 드로잉

   담당 범위가 아님: 손님 생성, 주문 내용, 만족도, 스토리 손님
              → night.js / story.js

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   [의자와의 관계] 좌석 x 는 counter.js 의 의자 5개 중심입니다.
   의자를 옮기면 여기 CUSTOMER_SEATS 도 같이 옮겨야 합니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 좌석
   ------------------------------------------------------------
   counter.js COUNTER_LAYOUT.chairs 의 VIEW x(726/924/1122/1320/1518) 에
   의자 폭 88 의 절반을 더한 중심을 논리 좌표로 옮긴 값입니다.
   ------------------------------------------------------------ */

// counter.js 가 계산해 준 의자 중심(VIEW)을 논리 좌표로 옮깁니다.
// 의자를 옮기거나 COUNTER_FIT.scale 을 바꾸면 손님도 자동으로 따라옵니다.
const CUSTOMER_SEATS = COUNTER_CHAIR_CENTERS.map(x=>Math.round(toLogic(x)));

// 요리사가 카운터를 사이에 두고 손님 쪽으로 최대한 붙어야 서빙할 수 있습니다.
// FRONT_STATIONS.counter.y 는 조리도구 쪽 뒷선이라 서빙 기준으로 쓰면 방향이
// 반대가 됩니다. 실제 이동 영역의 손님 쪽 하한선을 읽어 가장 가까운 자리를 씁니다.
const CUSTOMER_SERVICE_Y = toLogic(CHEF_WALK_AREA.bottomY);
// 손님 좌석 x와도 거의 일치해야 합니다. 자동 반경 8은 프레임당 이동량
// (약 5 논리 px)보다 커서 밀착했는데 판정을 건너뛰는 일은 없습니다.
const CUSTOMER_SERVE_REACH = 12;     // E 키 서빙 · 프롬프트 표시
const CUSTOMER_AUTO_SERVE_REACH = 8; // 완전히 붙으면 자동 서빙

// 앉았을 때의 기준 y. 머리·어깨가 의자 등받이(VIEW 878)보다 위로
// 올라오도록 맞췄습니다. 값을 키우면 손님이 의자 뒤로 가라앉습니다.
// 말풍선·주문 패널·강조 원이 전부 이 y 를 기준으로 붙어 있으므로
// 그림만 바꿀 때는 이 값이 아니라 아래 CUSTOMER_ART_BASE 를 만지세요.
const CUSTOMER_SEAT_Y = 607;

// 원본 시트는 44x60 셀에 4열 6행. 카운터 에셋에 비해 캐릭터가 작아서
// 키운 상태입니다(원래 54x74 → 83x113). 지금은 스토리 손님 전용입니다. (§1-2)
// cols/fps 는 일반 손님 모션(§1-2 motions)과 같은 뜻이고, 프레임 번호를
// 고르는 customerFrame() 이 두 경우를 같은 방식으로 다루기 위한 것입니다.
const CUSTOMER_SPRITE = { frameW:44, frameH:60, w:83, h:113, anchor:.838, cols:4, rows:6, fps:5 };


/* ------------------------------------------------------------
   1-2. 일반 손님 원화 (뒷모습으로 앉은 8종)
   ------------------------------------------------------------
   assets/customer/Common/ 의 원화를 tools/build-customer-sprites.js 가
   모션마다 시트 한 장으로 묶어 줍니다. 가로 = 프레임, 세로 = 캐릭터 8명.

     idle  Common/       3프레임   앉아서 기다리는 중
     eat   Common/eat/   6프레임   젓가락질. 다 먹고 떠날 때 (§2)

     원화 교체·추가 → 그 폴더에 넣고 npm run build:customer

   두 시트는 셀 크기와 행 순서가 같습니다. 발바닥은 셀 아래변에, 몸의
   세로축은 셀 한가운데에 맞춰져 있습니다. 그래서 프레임이 넘어가도,
   모션이 바뀌어도 손님이 제자리에 있습니다.

   [원본은 격자에 안 맞습니다] 원화의 캐릭터 간격은 장마다 245~292 로
   제각각입니다. 빌드 스크립트가 캐릭터를 한 명씩 떼어 셀 한가운데로
   다시 놓아 주기 때문에 여기서는 신경 쓰지 않아도 됩니다. 다만
   시트를 손으로 만들어 끼우면 손님이 옆으로 미끄러집니다.

   [특별 손님도 같은 구조입니다] 세트만 special 로 갈립니다.
   행 번호가 story-data.js 의 portraitRow 이고, 파일 번호에서 1 을 뺀 값입니다.

     0 비에 젖은 아이   1 등불 손님     2 두 그림자   3 까마귀 배달부
     4 작은 짐승        5 바닷물 손님   6 교복 인형   7 얼굴 없는 손님

   4번(작은 짐승)은 동물이라 사람처럼 다리가 보이지 않습니다. 정상입니다.
   그림을 고르는 판정은 §2 의 customerArtSet() 한 곳에만 있습니다.

   [여기 그림은 자리에 앉은 손님 전용입니다] 대화씬 초상화는 css/story.css
   의 별도 시트를, 영업일지는 글자만 씁니다. 둘 다 이 파일과 무관하므로
   여기에 시트를 추가해도 그쪽에 새어 나가지 않습니다.

   [세로 위치는 footY 하나로 정합니다] 셀 아래변이 발바닥이라 "발이 어디에
   닿는가"로 잡습니다. 말풍선 묶음은 §1-2-1 이 잰 머리 높이를 따라오므로
   footY 만 고치면 그림과 말풍선이 같이 움직입니다. 따로 맞출 것이 없습니다.

   [왜 의자 바닥선(695)이 아닌가]
   원화 속 인물이 앉아 있는 의자가 게임 의자보다 낮습니다.
   원화의 엉덩이~발바닥은 논리 45 인데, 게임 의자는 앉는 면(논리 630.6)에서
   바닥(695)까지 64 입니다. 그래서 "발을 바닥에 붙이기"와 "엉덩이를 앉는 면에
   올리기"를 동시에 만족시킬 수 없습니다.

   둘 중 엉덩이를 택했습니다. 발을 바닥에 붙이면 남자 손님은 상의 밑단이
   논리 640 까지 내려와서, 등받이 틈(610.2~615.4 / 625.4~630.6)과 앉는 면
   윗변(630.6) 사이에 바지가 한 줄도 안 보입니다. 앉아 있다기보다 의자
   뒤에 서 있는 것처럼 읽힙니다.

   발은 의자 앉는 면·가로대와 카운터 앞면이 가려 주므로 조금 떠도 티가
   안 나지만, 너무 올리면 신발이 카운터 앞면(논리 660 위쪽) 위로 떠오릅니다.
   그 선이 footY 의 하한입니다.

   [크기는 h 하나입니다] 가로는 시트의 셀 비율에서 계산합니다.
   빌드 쪽에서 셀 폭이 바뀌어도(젓가락 여유를 늘리는 등) 캐릭터가
   홀쭉해지거나 뚱뚱해지지 않습니다. 셀 여백은 투명이라 남아도 그만입니다.
   ------------------------------------------------------------ */

/* 두 세트가 공유하는 값. 크기와 앉는 높이는 세트를 가리지 않습니다.
     h          화면에 그릴 셀 높이(논리 좌표). 가로는 셀 비율에서 나옵니다
     footY      발바닥이 오는 논리 y. 세로 위치는 이 값 하나로 정합니다
     headWidth  실루엣 가로폭이 이 값(셀 높이 대비)에 처음 닿는 줄이 머리끝
     headBand   머리를 찾을 범위. 셀 위쪽 이 비율까지만 봅니다
     hudGap     잰 머리끝과 주문 패널 아랫변 사이에 둘 간격(논리 px)

   headWidth / headBand 가 셀 "폭"이 아니라 "높이" 기준인 이유: 셀 폭에는
   젓가락·두 그림자용 여백이 들어 있고 그 여백이 세트마다 달라서, 폭을
   기준으로 삼으면 세트가 바뀔 때 판정선이 같이 움직입니다. */
const CUSTOMER_ART_BASE = { h:170, footY:670, headWidth:.16, headBand:.35, hudGap:7 };

/* 그림 세트. rows 는 시트의 행 수(= 캐릭터 수),
   cols 는 시트의 열 수, fps 는 재생 속도입니다.
   빌드 스크립트가 마지막에 cols 값을 찍어 주므로 그대로 옮겨 적으세요.
   불러올 때 파일 크기와 대조해서 어긋나면 경고합니다. */
const CUSTOMER_ART = {
  common: { rows:8, motions:{
    idle:{ file:"assets/customer/customer_common_idle.webp", cols:3, fps:5 },
    // 젓가락이 올라갔다 내려오는 한 사이클이 6프레임입니다. 8fps 면
    // 0.75초에 한 입이라, 급하지도 굼뜨지도 않게 보입니다.
    eat: { file:"assets/customer/customer_common_eat.webp",  cols:6, fps:8 }
  }},
  special: { rows:8, motions:{
    idle:{ file:"assets/customer/customer_special_idle.webp", cols:3, fps:5 },
    eat: { file:"assets/customer/customer_special_eat.webp",  cols:6, fps:8 }
  }}
};

// 머리 높이를 재고, 시트가 없을 때 물러설 기준이 되는 모션.
const CUSTOMER_BASE_MOTION = "idle";

// 일반 손님 variant 의 범위. night.js 가 이 값으로 뽑습니다.
// 원화를 늘리면 시트 행 수와 여기가 같이 늘어납니다.
const CUSTOMER_VARIANT_COUNT = CUSTOMER_ART.common.rows;

// 손님 기준 y 로부터 발바닥까지의 거리. 기준 y 는 그대로 두고
// 그림만 발 기준으로 놓기 위한 보정값입니다.
const CUSTOMER_FOOT_OFFSET = CUSTOMER_ART_BASE.footY - CUSTOMER_SEAT_Y;

// "세트/모션" → HTMLImageElement. 못 불러온 것은 키가 없습니다.
const customerSheets = {};
const sheetKey = (set,motion) => `${set}/${motion}`;

/* game.js 의 에셋 로딩 Promise.all 에 stage.js loadStageAssets() 를 거쳐
   들어갑니다. (요리사 시트와 같은 경로 — stage.js §5 주석 참고)

   시트가 없어도 게임은 돌아가야 하므로 실패해도 reject 하지 않습니다.
   세트의 기준 모션이 없으면 예전 스프라이트시트로, 식사 시트만 없으면
   정지 모션으로 물러섭니다. */
function loadCommonCustomerSheet(){
  const jobs=[];
  Object.entries(CUSTOMER_ART).forEach(([set,art])=>{
    Object.entries(art.motions).forEach(([motion,spec])=>{
      jobs.push(new Promise(resolve=>{
        const key=sheetKey(set,motion);
        const image=new Image();
        image.onload=()=>{
          if(image.width%spec.cols||image.height%art.rows)
            console.warn(`[customers] ${key} 시트 격자 불일치: ${image.width}x${image.height} / ${spec.cols}열 ${art.rows}행`);
          customerSheets[key]=image;
          resolve(image);
        };
        image.onerror=()=>{
          console.warn(`[customers] ${key} 손님 시트를 불러오지 못했습니다: ${spec.file}`);
          resolve(null);
        };
        image.src=spec.file;
      }));
    });
  });
  return Promise.all(jobs).then(images=>{
    Object.keys(CUSTOMER_ART).forEach(measureHeadTops);
    checkSheetsMatch();
    return images;
  });
}

/* 같은 세트 안에서 모션끼리 셀 크기가 다르면 모션이 바뀌는 순간 손님이
   커지거나 위아래로 튑니다. 빌드 때도 검사하지만, 시트를 손으로 갈아
   끼우는 경우가 있어 불러온 뒤에도 한 번 더 봅니다.
   (세트끼리는 달라도 됩니다. 그리는 크기를 셀 비율에서 계산하므로
    특별 손님 셀이 더 넓어도 캐릭터는 같은 크기로 나옵니다) */
function checkSheetsMatch(){
  Object.entries(CUSTOMER_ART).forEach(([set,art])=>{
    const base=customerSheets[sheetKey(set,CUSTOMER_BASE_MOTION)];
    if(!base)return;
    const baseCell=base.width/art.motions[CUSTOMER_BASE_MOTION].cols;
    Object.keys(art.motions).forEach(motion=>{
      const image=customerSheets[sheetKey(set,motion)];
      if(!image)return;
      const cell=image.width/art.motions[motion].cols;
      if(cell!==baseCell||image.height!==base.height)
        console.warn(`[customers] ${set}/${motion} 셀 크기가 ${CUSTOMER_BASE_MOTION} 과 다릅니다: `
          +`${cell}x${image.height/art.rows} / ${baseCell}x${base.height/art.rows}`);
    });
  });
}


/* ------------------------------------------------------------
   1-2-1. 캐릭터별 머리 높이 재기
   ------------------------------------------------------------
   말풍선·주문 패널은 손님 기준 y 에 고정 오프셋으로 붙어 있습니다.
   그런데 8종의 머리 모양이 제각각이라 고정값으로 두면 사람마다
   머리와 말풍선 사이가 벌어졌다 붙었다 합니다.

   특히 쪽머리(6번)는 위로 가늘게 솟은 부분만 높고 머리 덩어리는 한참
   아래라, 꼬리가 허공에 뜬 것처럼 보입니다. 반대로 짧은 머리(5번)는
   꼬리가 머리카락에 파묻힙니다.

   그래서 "제일 위 픽셀"이 아니라 "실루엣이 눈에 띄게 넓어지는 줄"을
   머리끝으로 봅니다. 가는 머리끝은 무시하고 사람이 실제로 머리라고
   읽는 지점을 잡기 위해서입니다. 기준은 CUSTOMER_ART_BASE.headWidth.

   특별 손님은 후드·등불·동물처럼 머리 모양 차이가 더 크기 때문에
   이 보정이 일반 손님보다 오히려 더 필요합니다. 세트마다 따로 잽니다.

   재는 건 0번 프레임 한 장뿐입니다. 프레임마다 다시 재면 숨쉬는 동안
   말풍선이 1~2px 씩 떨리기 때문입니다.

   결과는 CUSTOMER_HUD 오프셋에 더할 값(논리 px)입니다. 잰 머리끝이
   "주문 패널 아랫변(tailY) 에서 hudGap 만큼 위"에 오도록 맞춥니다.
   footY 를 고치면 머리끝도 같이 움직이므로 말풍선이 저절로 따라옵니다.
   ------------------------------------------------------------ */

// 세트 이름 → 캐릭터별 보정값(논리 px) 배열
const customerHeadDrops = {};

function measureHeadTops(set){
  const art=CUSTOMER_ART[set];
  const image=customerSheets[sheetKey(set,CUSTOMER_BASE_MOTION)];
  customerHeadDrops[set]=[];
  if(!image)return;

  const B=CUSTOMER_ART_BASE;
  const cellW=Math.floor(image.width/art.motions[CUSTOMER_BASE_MOTION].cols);
  const cellH=Math.floor(image.height/art.rows);
  const band=Math.max(1,Math.round(cellH*B.headBand));
  const minRun=Math.max(1,Math.round(cellH*B.headWidth));

  let tops;
  try{
    const canvas=document.createElement("canvas");
    canvas.width=cellW;canvas.height=band;
    const cell=canvas.getContext("2d",{willReadFrequently:true});
    tops=[];
    for(let row=0;row<art.rows;row++){
      cell.clearRect(0,0,cellW,band);
      cell.drawImage(image,0,row*cellH,cellW,band,0,0,cellW,band);
      const pixels=cell.getImageData(0,0,cellW,band).data;
      let top=0;
      for(let y=0;y<band;y++){
        let solid=0;
        for(let x=0;x<cellW;x++) if(pixels[(y*cellW+x)*4+3]>128) solid++;
        if(solid>=minRun){top=y;break;}
      }
      tops.push(top);
    }
  }catch(error){
    // 캔버스를 읽지 못하면(예: file:// 로 열어 텍스처가 오염된 경우)
    // 보정 없이 예전처럼 전부 같은 높이로 둡니다.
    console.warn("[customers] 머리 높이를 재지 못해 말풍선 보정을 끕니다.",error);
    return;
  }

  // 손님 기준 y 로부터 머리끝까지의 거리(위가 음수) → 말풍선이 있어야 할 자리와의 차이.
  // 머리끝은 패널 아랫변(tailY)보다 hudGap 만큼 아래에 있는 것이 기준입니다.
  const scale=B.h/cellH;
  const wanted=CUSTOMER_HUD.tailY+B.hudGap;
  customerHeadDrops[set]=tops.map(top=>
    (CUSTOMER_FOOT_OFFSET-B.h+top*scale)-wanted);
}

// 이 손님의 말풍선 묶음을 얼마나 내려야 하는지(논리 px).
// 예전 시트로 물러선 손님은 보정하지 않습니다.
function customerHudDrop(customer,variant){
  const set=customerArtSet(customer);
  if(!set)return 0;
  return customerHeadDrops[set]?.[variant%CUSTOMER_ART[set].rows]||0;
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

/* ------------------------------------------------------------
   1-4. 퇴장 연출 — 마저 먹고 일어서기
   ------------------------------------------------------------
   음식을 받은 손님은 state.departures 로 옮겨져서 인사말을 남기고
   사라집니다. 그 동안 식사 모션(eat)을 재생합니다. 방금 음식을 받아
   놓고 가만히 앉아만 있다가 없어지면 먹었다는 게 안 읽힙니다.

   item.life 는 night.js 가 3.2(특별 손님은 story.js 가 2.6)로 넣고
   game.js 가 매 프레임 줄입니다. 0 이 되면 목록에서 빠집니다.
   즉 남은 시간이 곧 "얼마나 더 있을 것인가"입니다.

   예전에는 알파를 life/3.2 로 계산해서 등장하자마자 흐려지기 시작했고,
   그래서 인사말이 절반쯤 투명한 채로 지나갔습니다. 지금은 마지막
   fade 초 동안에만 흐려집니다.
   (life 를 3.2 로 못 박지 않아서 2.6 인 특별 손님도 또렷하게 시작합니다)

   [위로 뜨지 않습니다] 예전에는 일어서는 느낌을 내려고 16px 떠올랐는데,
   앉은 자세 그대로 뜨면 의자에서 뽑혀 나가는 것처럼 보입니다.
   자리를 지킨 채 사라지기만 합니다.

     fade  마지막 이 초 동안 사라집니다. 식사 모션을 보여 줄 시간이기도 합니다
   ------------------------------------------------------------ */

const CUSTOMER_DEPART = { fade:1.2 };

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

/* 이 손님을 어느 그림 세트로 그릴지. 그림 선택은 여기 한 곳에서만 합니다.

   특별 손님인지 판정하는 기준이 둘인 이유: state.orders 항목에는
   customerType 이 있고, state.departures 항목에는 없어서 guestId 로 봅니다.

   해당 세트의 기준 시트를 못 불러왔으면 null 을 돌려주고,
   부르는 쪽은 예전 스프라이트시트로 물러섭니다. */
function customerArtSet(customer){
  const set=(customer.customerType==="story"||customer.guestId)?"special":"common";
  return customerSheets[sheetKey(set,CUSTOMER_BASE_MOTION)]?set:null;
}

/* 실제로 쓸 모션. 요청한 시트가 없으면 기준 모션으로 물러섭니다.
   (식사 시트만 빠져도 손님이 사라지지 않게) */
function customerMotionOf(set,name){
  return set&&customerSheets[sheetKey(set,name)]?name:CUSTOMER_BASE_MOTION;
}

/* 이 손님에게 쓸 프레임 번호. 시트마다 프레임 수와 속도가 달라서
   어떤 시트를 쓸지 정한 다음에 계산해야 합니다. 예전 시트(4프레임)로
   물러선 경우도 여기서 같이 처리합니다.

   seed 는 정수(손님 id 등)를 넣으세요. 프레임 단위로만 어긋나서
   재생이 끊기지 않으면서, 네 명이 한 몸처럼 같이 움직이지 않습니다. */
function customerFrame(customer,motion,t,seed){
  const set=customerArtSet(customer);
  const spec=set?CUSTOMER_ART[set].motions[motion]:CUSTOMER_SPRITE;
  return Math.floor(t*spec.fps+seed)%spec.cols;
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
    const motion=customerMotionOf(customerArtSet(order),"idle");
    drawCustomerSprite(order.variant,x,y,customerFrame(order,motion,t,order.id),entryAlpha,order,motion);

    // 말풍선 묶음은 몸이 아니라 머리 위에 붙어야 하므로, 캐릭터마다
    // 다른 머리 높이만큼 따로 내려서 그립니다. (§1-2-1)
    const hy=y+customerHudDrop(order,order.variant);

    ctx.save();ctx.globalAlpha=entryAlpha;
    const visitorOnly=storyEntrance&&order.guestOrder===false;
    const selected=!visitorOnly&&state.selectedOrderId===order.id;
    const H=CUSTOMER_HUD;
    if(!visitorOnly){
      ctx.fillStyle=selected?"#fff0bd":"#efd9ae";
      roundRect(ctx,x-H.bubbleW/2,hy+H.bubbleY,H.bubbleW,H.bubbleH,9,true,false);
      ctx.strokeStyle=selected?"#f5bd50":"#5a3724";ctx.lineWidth=selected?4:2;
      roundRect(ctx,x-H.bubbleW/2,hy+H.bubbleY,H.bubbleW,H.bubbleH,9,false,true);
      // 주문 표시라 아직 조리 전입니다. 등급은 기본(normal) 그림을 씁니다.
      // 반짝임은 요리사가 손에 들었을 때만 나옵니다. (player.js syncCarriedFoodFx)
      drawFoodProp(order.dishId,x,hy+H.iconY,H.iconW,H.iconH);
      ctx.fillStyle="#3b2518";ctx.beginPath();
      ctx.moveTo(x-5,hy+H.tailY);ctx.lineTo(x+6,hy+H.tailY+10);ctx.lineTo(x+10,hy+H.tailY);ctx.fill();
    }

    if(selected){
      ctx.strokeStyle="#ffd776";ctx.lineWidth=3;ctx.beginPath();
      ctx.arc(x,hy+H.ringY,H.ringR+Math.sin(t*5)*2,0,Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle="#ffe1a0";ctx.font="bold 12px Malgun Gothic";ctx.textAlign="center";
    ctx.fillText(order.guestId?storyOrderLabel(order):`${order.slot+1}`,x,hy+H.labelY);
    ctx.textAlign="left";

    ctx.restore();
    if(order.bubble&&order.bubbleTime>0&&progress>.85)drawCustomerSpeech(order.bubble,x,hy+H.speechY,entryAlpha);
  });

  /* 떠나는 손님 — 자리에 앉은 채로 마저 먹다가 사라집니다. (§1-4)
     life 는 game.js 가 매 프레임 줄이고 0 이 되면 목록에서 빠집니다. */
  state.departures.forEach((item,index)=>{
    const x=CUSTOMER_SEATS[item.slot],y=CUSTOMER_SEAT_Y;
    const alpha=clamp(Math.max(0,item.life)/CUSTOMER_DEPART.fade,0,1);
    const motion=customerMotionOf(customerArtSet(item),"eat");
    drawCustomerSprite(item.variant,x,y,customerFrame(item,motion,t,index),alpha,item,motion);
    drawCustomerSpeech(item.bubble,x,y+customerHudDrop(item,item.variant)+CUSTOMER_HUD.departSpeechY,alpha);
  });
}

/* customer 는 state.orders 또는 state.departures 의 항목입니다.
   어떤 그림 세트를 쓸지 판정하는 데만 씁니다. (customerArtSet)
   motion 은 CUSTOMER_ART[세트].motions 의 이름입니다. */
function drawCustomerSprite(variant,x,y,frame,alpha=1,customer={},motion=CUSTOMER_BASE_MOTION){
  ctx.save();ctx.globalAlpha=alpha;

  const set=customerArtSet(customer);
  const sheet=set&&customerSheets[sheetKey(set,motion)];
  if(sheet){
    /* 셀 크기는 파일에서 읽습니다. 시트를 다시 뽑아 해상도나 여백이
       바뀌어도, 세트마다 셀 폭이 달라도 여기를 고칠 필요가 없습니다.
         세로 — 발바닥이 셀 아래변, 캐릭터 키가 셀에 꽉 참
         가로 — 몸의 세로축이 셀 한가운데
       셋 다 빌드 스크립트가 맞춰 주고 검증합니다. 덕분에 그리는 크기를
       셀 비율로 계산해도 두 세트의 캐릭터가 같은 크기로 나옵니다. */
    const art=CUSTOMER_ART[set],B=CUSTOMER_ART_BASE;
    const cols=art.motions[motion].cols;
    const cellW=sheet.width/cols,cellH=sheet.height/art.rows;
    const drawW=B.h*cellW/cellH;
    ctx.drawImage(sheet,
      (frame%cols)*cellW,(variant%art.rows)*cellH,cellW,cellH,
      x-drawW/2,y+CUSTOMER_FOOT_OFFSET-B.h,drawW,B.h);
    ctx.restore();
    return;
  }

  // 물러선 경우. 예전 시트는 6행뿐이라 행 번호를 접어 넣습니다.
  // (특별 손님 variant 는 0~7 이라 그냥 쓰면 시트 밖을 읽어 아무것도 안 나옵니다)
  const S=CUSTOMER_SPRITE;
  if(images.customers)
    ctx.drawImage(images.customers,frame*S.frameW,(variant%S.rows)*S.frameH,S.frameW,S.frameH,
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
