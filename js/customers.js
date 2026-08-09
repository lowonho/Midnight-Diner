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
// 반경 기준점은 (좌석 x, CUSTOMER_SERVICE_Y) 입니다. 12 였을 때는 손님
// 정면 한 점에 딱 맞춰 서야만 E 가 떠서 서빙이 너무 까다로웠습니다.
// 좌석 간격이 논리 132(VIEW 198), 이동 영역 깊이가 논리 190 이므로
// 42 는 좌우로 좌석 간격의 3분의 1, 앞뒤로 카운터에서 한 걸음 정도까지
// 인정하는 값입니다. 옆자리 손님과 겹치지 않는 선에서 최대한 넓혔습니다.
// (판정은 들고 있는 주문의 좌석 하나만 보므로 겹쳐도 오배달은 없습니다.)
const CUSTOMER_SERVE_REACH = 42;     // E 키 서빙 · 프롬프트 표시
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
     hudGap     잰 머리끝과 주문 패널 아랫변 사이에 둘 간격(논리 px).
                말풍선 묶음을 통째로 올리고 내리는 값이 이것 하나입니다.
                CUSTOMER_HUD 의 오프셋들은 tailY 와의 차이로만 화면에 나타나서
                (labelY 등을 같이 옮기면 서로 상쇄됩니다) 높이는 여기서 잡습니다.

   headWidth / headBand 가 셀 "폭"이 아니라 "높이" 기준인 이유: 셀 폭에는
   젓가락·두 그림자용 여백이 들어 있고 그 여백이 세트마다 달라서, 폭을
   기준으로 삼으면 세트가 바뀔 때 판정선이 같이 움직입니다. */
const CUSTOMER_ART_BASE = { h:170, footY:670, headWidth:.16, headBand:.35, hudGap:17 };

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
  // 머리 위 패널·말풍선 그림도 같이 받습니다. (§1-3-1 / §1-3-2)
  jobs.push(loadCustomerHudArt());
  return Promise.all(jobs).then(images=>{
    Object.keys(CUSTOMER_ART).forEach(checkHeadTops);
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

   [값은 표로 박아 둡니다 — 게임에서 재지 않습니다]
   예전에는 시트를 불러온 뒤 캔버스에 그려서 픽셀을 읽었습니다. 그런데
   getImageData 는 file:// 로 열면 텍스처 오염 때문에 SecurityError 로
   막힙니다. 이 파일은 그때 보정을 통째로 끄고 넘어갔기 때문에, 정적
   서버로 열면 말풍선이 머리를 따라오고 index.html 을 그냥 더블클릭해서
   열면 8명 전부 같은 높이에 서는 상태였습니다. 화면에는 에러가 안 뜨고
   콘솔 경고 한 줄만 남아서, 열어 본 방식에 따라 되기도 하고 안 되기도
   하는 것으로 보입니다. 실제로 이 증상으로 한 번 헤맸습니다.

   그래서 재는 일은 빌드 스크립트(tools/build-customer-sprites.js)로
   옮기고, 게임은 아래 표만 읽습니다. 어디서 열든 결과가 같습니다.
   원화를 갈아 끼웠으면 npm run build:customer 가 찍어 주는 표를
   그대로 옮겨 적으세요. (cols 값을 옮겨 적는 것과 같은 방식입니다)
   옮겨 적는 것을 잊어도 캔버스를 읽을 수 있는 환경에서는 아래
   checkHeadTops() 가 어긋난 행을 콘솔에 찍어 줍니다.
   ------------------------------------------------------------ */

/* 세트 이름 → 캐릭터별 머리끝 위치.
   단위는 논리 px 이고, 기준은 "그려진 캐릭터 그림의 위변"입니다.
   즉 그림 맨 위에서 이만큼 내려온 줄이 머리끝입니다.
   셀 해상도가 아니라 그리는 크기(CUSTOMER_ART_BASE.h) 기준이라
   시트를 더 큰 해상도로 다시 뽑아도 이 값은 그대로입니다.

   특별 손님 0번(비에 젖은 아이)과 4번(작은 짐승)이 유난히 큰 것은
   빌드 쪽 CHARACTER_SCALE 로 키를 줄여 놓아서, 줄어든 만큼 셀 위쪽에
   빈 자리가 생기기 때문입니다. 말풍선이 그만큼 내려와야 맞습니다. */
const CUSTOMER_HEAD_TOPS = {
  common:  [ 6.0,  6.6,  5.4,  6.6,  9.0,  8.4,  5.4,  6.6],
  special: [35.6,  9.0,  7.8, 10.2, 49.4, 11.5,  6.0, 11.5]
};

// 이 손님의 말풍선 묶음을 얼마나 내려야 하는지(논리 px).
// 머리끝이 "주문 패널 아랫변(tailY)에서 hudGap 만큼 위"에 오도록 맞춥니다.
// 표에 없는 행이거나 예전 시트로 물러선 손님은 보정하지 않습니다.
function customerHudDrop(customer,variant){
  const set=customerArtSet(customer);
  if(!set)return 0;
  const top=CUSTOMER_HEAD_TOPS[set]?.[variant%CUSTOMER_ART[set].rows];
  if(top===undefined)return 0;
  const B=CUSTOMER_ART_BASE;
  return (CUSTOMER_FOOT_OFFSET-B.h+top)-(CUSTOMER_HUD.tailY+B.hudGap);
}

/* 표가 지금 시트와 맞는지 확인만 합니다. 그림에는 영향이 없습니다.
   캔버스를 읽지 못하는 환경(file://)에서는 조용히 건너뜁니다 —
   확인을 못 할 뿐이고, 말풍선 위치는 표에서 나오므로 똑같이 동작합니다. */
function checkHeadTops(set){
  const art=CUSTOMER_ART[set];
  const image=customerSheets[sheetKey(set,CUSTOMER_BASE_MOTION)];
  const table=CUSTOMER_HEAD_TOPS[set];
  if(!image||!table)return;

  const B=CUSTOMER_ART_BASE;
  const cellW=Math.floor(image.width/art.motions[CUSTOMER_BASE_MOTION].cols);
  const cellH=Math.floor(image.height/art.rows);
  const band=Math.max(1,Math.round(cellH*B.headBand));
  const minRun=Math.max(1,Math.round(cellH*B.headWidth));
  const scale=B.h/cellH;

  try{
    const canvas=document.createElement("canvas");
    canvas.width=cellW;canvas.height=band;
    const cell=canvas.getContext("2d",{willReadFrequently:true});
    const off=[];
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
      const measured=top*scale;
      if(Math.abs(measured-(table[row]??NaN))>1)
        off.push(`${row}행 표 ${table[row]} / 실제 ${measured.toFixed(1)}`);
    }
    if(off.length)
      console.warn(`[customers] ${set} CUSTOMER_HEAD_TOPS 가 시트와 다릅니다 `
        +`(npm run build:customer 가 찍어 주는 표로 갱신하세요): ${off.join(" · ")}`);
  }catch{
    // file:// 등에서 픽셀을 못 읽는 경우. 확인만 건너뜁니다.
  }
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

/* 지금 고른 주문의 손님 표시 — 주문 말풍선이 부풀었다 줄었다 합니다.
   ------------------------------------------------------------
   예전에는 머리 둘레에 노란 원을 그렸습니다. 손으로 그린 손님 위에
   재질 없는 벡터 원 하나가 얹혀서 게임 화면이 아니라 표시선처럼
   보였고, 머리보다 원이 커서 무엇을 감싼 건지도 애매했습니다.
   지금은 화면에 이미 있는 말풍선을 크게 했다 작게 합니다. 새로 얹는
   도형이 없고, 커지는 것이 곧 "이 주문" 입니다.

   [축이 꼬리 끝인 이유] 말풍선 한가운데를 축으로 삼으면 머리를 가리키는
   꼬리 끝이 같이 오르내려서, 어느 손님 것인지가 흔들립니다. 꼬리 끝을
   붙박아 두면 가리키는 곳은 그대로고 풍선만 부풉니다.

   [max 를 더 못 올립니다] 특별 손님 이름표가 말풍선 바로 위(labelY -173)에
   붙습니다. 꼬리 끝(-83.8)에서 풍선 윗변(-164.7)까지가 80.9 라, 1.06 이면
   윗변이 -169.5 로 이름표 밑선까지 3.5px 만 남습니다. */
const CUSTOMER_SELECT_PULSE = { min:.96, max:1.06, period:1.1 };

// 손님 머리 위에 뜨는 것들의 y 오프셋(손님 기준 y 로부터).
const CUSTOMER_HUD = {
  /* 주문 패널(구름 말풍선)의 가로 크기입니다. 세로·꼬리 길이·음식 칸은
     전부 그림 비율에서 나오므로(ORDER_PANEL) 크기 조절은 이 숫자 하나입니다.
     좌석 간격이 논리 137 이라, 옆자리 패널과 31 을 띄우는 값입니다.
     ⚠️ 여기를 바꾸면 tools/build-ui-common-webp.js 의 320x244 도 같이. */
  panelW:106,
  /* 구름 몸통의 아랫변. 꼬리는 이 아래로 6px 더 내려옵니다.
     ⚠️ 머리 높이 보정(customerHudDrop)이 이 값을 기준선으로 씁니다 —
        머리끝은 언제나 tailY + hudGap = -73 입니다. 패널 그림이 바뀌어도
        이 값은 그대로 두어야 패널과 머리 사이가 벌어지지 않습니다. */
  tailY:-90,
  /* 특별 손님 이름 — 대사 말풍선 아랫변(-196)과 주문 패널 윗변(-164.7) 사이입니다.
     말풍선이 떠 있든 없든 자리가 바뀌지 않습니다. 말풍선이 뜰 때마다 이름이
     위로 뛰어오르면 같은 손님인데 이름이 옮겨 다니는 것처럼 보입니다. */
  labelY:-173,
  /* 주문 패널이 없는 손님(메뉴를 고민 중이거나 구경만 하는 특별 손님)은
     패널 자리가 통째로 비므로 이름을 머리 바로 위까지 내립니다.
     머리끝은 tailY+hudGap = -73 이라, 여기서 9px 위가 글자 밑선입니다. */
  labelHeadY:-82,
  /* 대사 말풍선 아랫변 — 이름표가 있는 특별 손님 기준입니다.
     패널 윗변(-164.7)까지 31 이 비어 있고, 그 31 을 이름 글자(높이 12)와
     위아래 여백이 채웁니다. */
  speechY:-196,
  /* 이름이 없는 일반 손님은 그 31 이 통째로 빈칸이 됩니다. 그래서 이름 자리
     (글자 12 + 이름~패널 사이 5)만큼 말풍선을 내려 패널에 붙입니다.
     남는 14 는 이름이 있을 때 말풍선~이름 사이와 같은 값입니다.
     ⚠️ 고른 주문이면 패널이 1.06 배로 부풀어 윗변이 -169.5 까지 올라옵니다.
        여기서 더 내리면 부푼 패널이 말풍선을 뚫습니다. */
  speechNoLabelY:-179,
  /* 주문 패널이 없으면 말풍선도 그만큼 내려옵니다. 패널이 빠진 자리를 그대로
     비워 두면 말풍선만 머리에서 한참 떠 있어서, 누가 하는 말인지 흐려집니다.
     떠나는 손님(§1-4)도 패널이 없으므로 같은 높이를 씁니다. */
  noPanelSpeechY:-135
};


/* ------------------------------------------------------------
   1-3-1. 주문 패널 그림 (구름 말풍선)
   ------------------------------------------------------------
   assets/UI/Common/ui_order_panel_cloud.webp
   (마스터는 같은 폴더의 ui_order_panel_cloud_selected_max_tail_right_curved_inward_4x.png,
    webp 는 tools/build-ui-common-webp.js 산출물입니다)

   예전에는 둥근 사각형 + 삼각형 꼬리를 그렸습니다. 손으로 그린 손님과
   카운터 위에 재질 없는 벡터 도형 하나만 얹혀 있어서, 게임 화면이 아니라
   표시선처럼 보였습니다.

   [꼬리 방향] 원본은 꼬리가 오른쪽 아래에 붙어 있습니다.
     1~3번 자리(slot 0~2)  좌우로 뒤집어 꼬리를 왼쪽에
     4~5번 자리(slot 3~4)  원본 그대로 꼬리를 오른쪽에
   뒤집기는 패널 그림 한 장에만 겁니다. 음식 그림까지 같이 뒤집히면
   글자·무늬가 있는 메뉴가 거울처럼 보입니다. (drawOrderPanelArt)

   [숫자는 원본 464x354 실측값입니다] 화면 크기가 아니라 **비율**로만 쓰므로
   webp 를 다른 크기로 다시 뽑아도 여기는 고칠 것이 없습니다.
     bodyBottom  구름 몸통의 아랫변. 이 아래 27px 이 꼬리입니다
     tailTipX    꼬리 끝의 x. 그림 한가운데(232)에서 61.5 오른쪽입니다
     inner*      크림색 안쪽에 **모서리까지** 들어가는 사각형(실측). 264x152 는
                 food-props.js FOOD_PROP_SIZE 와 같은 비율이라 음식 그림이
                 이 칸을 가로세로 모두 꽉 채웁니다.
                 세로 중심 171 이 그림 한가운데(163)보다 조금 아래인 것은,
                 구름 윗변의 뭉게뭉게가 아랫변보다 높이 솟아 있어서입니다
     iconScale   음식 칸을 이 배만큼 키웁니다

   [iconScale 이 1 보다 큰 이유] inner* 는 **네 모서리까지** 크림색 안에
   들어가는, 가장 빡빡하게 잡은 사각형입니다. 그런데 음식 그림은 접시·냄비라
   모서리가 비어 있고, 원화 자체도 기준 캔버스(264x152)보다 작습니다
   (가장 큰 것이 244x136 — food-props.js §1 참고). 그래서 칸을 그대로 쓰면
   음식이 구름 한가운데 조그맣게 얹힌 것처럼 보입니다.
   1.25 면 가장 큰 원화의 실제 그림 폭이 크림색 폭에 거의 닿습니다.
   더 올리면 넓적한 접시(볶음우동·떡볶이)가 구름 테두리를 뚫습니다.
   ------------------------------------------------------------ */
const ORDER_PANEL_ART = {
  file:"assets/UI/Common/ui_order_panel_cloud.webp",
  imgW:464, imgH:354,
  bodyBottom:327,
  tailTipX:293.5,
  innerW:264, innerH:152, innerCY:171, iconScale:1.25,
  leftTailSlots:3   // slot 이 이 값보다 작으면 꼬리를 왼쪽에 둡니다 (1~3번 자리)
};

/* 위 비율에 CUSTOMER_HUD.panelW 를 곱해 둔 논리 좌표 값들.
   매 프레임 다섯 번씩 다시 계산할 이유가 없어서 한 번만 구합니다. */
const ORDER_PANEL = (()=>{
  const A=ORDER_PANEL_ART, scale=CUSTOMER_HUD.panelW/A.imgW;
  return {
    w:CUSTOMER_HUD.panelW,
    h:A.imgH*scale,                        // 꼬리까지 포함한 그림 전체 높이 (80.9)
    bodyH:A.bodyBottom*scale,              // 구름 몸통만의 높이 (74.7)
    tipDx:(A.tailTipX-A.imgW/2)*scale,     // 그림 중심에서 꼬리 끝까지 (14.1)
    // 음식 칸 (75.4 x 43.4). 중심은 그대로 두고 크기만 iconScale 배입니다.
    iconW:A.innerW*scale*A.iconScale, iconH:A.innerH*scale*A.iconScale,
    iconDy:A.innerCY*scale                 // 그림 위변에서 음식 칸 중심까지 (39.1)
  };
})();

let orderPanelImage=null;


/* ------------------------------------------------------------
   1-3-2. 대사 말풍선 그림
   ------------------------------------------------------------
   assets/UI/Common/ui_dialogue_bubble_<가로>x<세로>.webp — 6장이 한 벌입니다.
   폭 3종(좁게·중간·넓게) x 줄 수 2종.

   늘려 쓰라고 만든 그림이 아니라 칸 크기마다 한 장씩 그린 것입니다.
   그래서 글자 폭을 잰 다음 **들어가는 것 중 가장 작은 칸**으로 올림합니다.
   (예전에는 글자 폭에 맞춰 도형을 그때그때 그렸습니다)

   파일 이름의 숫자는 **화면(VIEW) 픽셀**입니다. 논리 좌표는 1.5 로 나눈 값이고,
   그 값이 예전 도형의 크기와 정확히 같습니다 — 최소 폭 92, 최대 폭 158,
   한 줄 32(=17+15), 두 줄 49(=17x2+15). 즉 말풍선이 놓이는 자리와 글자
   위치는 그대로이고 껍데기만 그림으로 바뀝니다.
   ------------------------------------------------------------ */
const CUSTOMER_SPEECH_ART = {
  dir:"assets/UI/Common/",
  viewW:[138,188,237],      // 좁은 것부터. 논리로는 92 / 125.3 / 158
  viewH:{ 1:48, 2:73.5 }    // 줄 수 → 화면 세로. 논리로는 32 / 49
};

// 파일 이름 규칙. 73.5 처럼 소수점이 있는 값은 `p` 로 적습니다 (73p5).
const speechArtKey = (viewW,viewH) => `${viewW}x${String(viewH).replace(".","p")}`;

// speechArtKey → HTMLImageElement. 못 불러온 것은 키가 없습니다.
const speechBubbleImages = {};

/* 이 글자 폭·줄 수에 쓸 말풍선. 그림을 못 불러왔으면 image 만 없고
   크기는 그대로 나옵니다 — 부르는 쪽이 예전 도형으로 물러섭니다. */
function speechBubbleArt(needW,lineCount){
  const A=CUSTOMER_SPEECH_ART;
  const viewW=A.viewW.find(v=>toLogic(v)>=needW) ?? A.viewW[A.viewW.length-1];
  const viewH=A.viewH[lineCount] ?? A.viewH[2];
  return { w:toLogic(viewW), h:toLogic(viewH), image:speechBubbleImages[speechArtKey(viewW,viewH)] };
}

/* maxWidth 는 줄바꿈 기준이고, 실제 말풍선 폭은 위 세 칸 중에서 고릅니다.
   pad 는 글자 좌우에 두는 여백이라 "글자 폭 + pad" 로 칸을 고릅니다. */
const CUSTOMER_SPEECH = { maxWidth:142, maxLines:2, lineH:17, pad:22 };
const CUSTOMER_SPEECH_FONT = "bold 12px Malgun Gothic";


/* 패널·말풍선 그림 불러오기. 손님 시트와 같은 길로 들어갑니다(§1-2 아래
   loadCommonCustomerSheet). 그림이 없어도 게임은 돌아가야 하므로
   실패해도 reject 하지 않고, 그리는 쪽이 예전 도형으로 물러섭니다. */
function loadCustomerHudImage(src,onload){
  return new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{onload(image);resolve(image);};
    image.onerror=()=>{console.warn(`[customers] 말풍선 그림을 불러오지 못했습니다: ${src}`);resolve(null);};
    image.src=src;
  });
}

function loadCustomerHudArt(){
  const A=CUSTOMER_SPEECH_ART;
  const jobs=[loadCustomerHudImage(ORDER_PANEL_ART.file,image=>{orderPanelImage=image;})];
  A.viewW.forEach(viewW=>Object.values(A.viewH).forEach(viewH=>{
    const key=speechArtKey(viewW,viewH);
    jobs.push(loadCustomerHudImage(`${A.dir}ui_dialogue_bubble_${key}.webp`,
      image=>{speechBubbleImages[key]=image;}));
  }));
  return Promise.all(jobs);
}


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
      const P=ORDER_PANEL;
      // 꼬리는 1~3번 자리면 왼쪽, 4~5번 자리면 오른쪽입니다. (§1-3-1)
      const tailLeft=order.slot<ORDER_PANEL_ART.leftTailSlots;
      // 구름 몸통의 아랫변(tailY)을 기준으로 그림 위변을 잡습니다.
      const top=hy+H.tailY-P.bodyH;
      ctx.save();
      /* 고른 주문이면 꼬리 끝을 축으로 풍선 전체를 부풀립니다.
         꼬리까지 이 안에서 그려야 풍선과 한 몸으로 움직입니다. */
      if(selected){
        const S=CUSTOMER_SELECT_PULSE;
        const scale=S.min+(S.max-S.min)*(.5+.5*Math.sin(t*Math.PI*2/S.period));
        const pivotX=x+(tailLeft?-P.tipDx:P.tipDx),pivotY=top+P.h;
        ctx.translate(pivotX,pivotY);ctx.scale(scale,scale);ctx.translate(-pivotX,-pivotY);
      }
      drawOrderPanelArt(x,top,tailLeft,selected);
      // 주문 표시라 아직 조리 전입니다. 등급은 기본(normal) 그림을 씁니다.
      // 반짝임은 요리사가 손에 들었을 때만 나옵니다. (player.js syncCarriedFoodFx)
      drawFoodProp(order.dishId,x,top+P.iconDy,P.iconW,P.iconH);
      ctx.restore();
    }
    /* 머리 위 이름표는 특별 손님만 답니다. 일반 손님에게 붙던 자리 번호는
       뺐습니다 — 좌측 「현재 주문」 목록과 우측 패널이 이미 몇 번 손님인지
       적어 주고, 머리 위 숫자는 주문 패널과 겹쳐 어수선하기만 했습니다.

       쌓는 순서는 주문 패널이 있든 없든 「말풍선 - 이름 - 패널(또는 머리)」로
       같고, 패널이 없으면 묶음이 통째로 한 단 내려올 뿐입니다.
         패널 있음   말풍선 -196 / 이름 -173 / 패널 윗변 -164.7
         패널 없음   말풍선 -135 / 이름  -82 / 머리끝    -73 */
    if(order.guestId){
      ctx.fillStyle="#ffe1a0";ctx.font="bold 12px Malgun Gothic";ctx.textAlign="center";
      ctx.fillText(storyOrderLabel(order),x,hy+(visitorOnly?H.labelHeadY:H.labelY));
      ctx.textAlign="left";
    }

    ctx.restore();
    /* 말풍선 아랫변은 바로 아래에 무엇이 있느냐로 정합니다.
         패널 + 이름  -196   패널만 -179   패널 없음 -135 */
    if(order.bubble&&order.bubbleTime>0&&progress>.85){
      const bottom=visitorOnly?H.noPanelSpeechY
        :order.guestId?H.speechY
        :H.speechNoLabelY;
      drawCustomerSpeech(order.bubble,x,hy+bottom,entryAlpha);
    }
  });

  /* 떠나는 손님 — 자리에 앉은 채로 마저 먹다가 사라집니다. (§1-4)
     life 는 game.js 가 매 프레임 줄이고 0 이 되면 목록에서 빠집니다. */
  state.departures.forEach((item,index)=>{
    const x=CUSTOMER_SEATS[item.slot],y=CUSTOMER_SEAT_Y;
    const alpha=clamp(Math.max(0,item.life)/CUSTOMER_DEPART.fade,0,1);
    const motion=customerMotionOf(customerArtSet(item),"eat");
    drawCustomerSprite(item.variant,x,y,customerFrame(item,motion,t,index),alpha,item,motion);
    // 떠나는 손님은 주문 패널이 없으므로 앉아 있는 손님의 「패널 없음」 높이와 같습니다.
    drawCustomerSpeech(item.bubble,x,
      y+customerHudDrop(item,item.variant)+CUSTOMER_HUD.noPanelSpeechY,alpha);
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
    const sx=(frame%cols)*cellW,sy=(variant%art.rows)*cellH;
    const dx=x-drawW/2,dy=y+CUSTOMER_FOOT_OFFSET-B.h;
    // 지금 음식을 갖다 줄 손님이면 몸 뒤에 빛을 깝니다. (fx.js §3 drawCustomerGlow)
    drawCustomerGlow(customer,sheet,`${set}_${motion}_${variant}_${frame%cols}`,
                     sx,sy,cellW,cellH,dx,dy,drawW,B.h);
    ctx.drawImage(sheet,sx,sy,cellW,cellH,dx,dy,drawW,B.h);
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

/* 주문 패널 한 장. x 는 가로 중심, top 은 그림 위변입니다.
   뒤집기를 이 함수 안에 가둬 둡니다 — 부르는 쪽에서 뒤집으면 음식 그림까지
   같이 뒤집혀서, 글자나 무늬가 있는 메뉴가 거울처럼 보입니다. */
function drawOrderPanelArt(x,top,tailLeft,selected){
  const P=ORDER_PANEL;
  if(!orderPanelImage){ drawOrderPanelFallback(x,top,tailLeft,selected); return; }
  ctx.save();
  /* 고른 주문 표시. 그림 한 장이라 예전처럼 테두리 색과 굵기를 바꿀 수
     없어서, 구름 모양을 그대로 따라가는 금빛 번짐으로 대신합니다.
     부풀기(CUSTOMER_SELECT_PULSE)만으로는 작아진 순간에 티가 안 납니다. */
  if(selected){ ctx.shadowColor="rgba(255,196,92,.9)";ctx.shadowBlur=9; }
  // 원본 꼬리는 오른쪽입니다. 왼쪽 꼬리는 가로 중심(x)을 축으로 뒤집습니다.
  if(tailLeft){ ctx.translate(x*2,0);ctx.scale(-1,1); }
  ctx.drawImage(orderPanelImage,x-P.w/2,top,P.w,P.h);
  ctx.restore();
}

/* 그림을 못 읽었을 때만 씁니다. 자리와 크기는 그림과 같으므로 이쪽으로
   물러서도 음식 그림이나 이름표가 어긋나지 않습니다. */
function drawOrderPanelFallback(x,top,tailLeft,selected){
  const P=ORDER_PANEL,left=x-P.w/2,bottom=top+P.bodyH;
  const tipX=x+(tailLeft?-P.tipDx:P.tipDx),dir=tailLeft?-1:1;
  ctx.fillStyle=selected?"#fff0bd":"#efd9ae";
  roundRect(ctx,left,top,P.w,P.bodyH,14,true,false);
  ctx.strokeStyle=selected?"#f5bd50":"#5a3724";ctx.lineWidth=selected?4:2;
  roundRect(ctx,left,top,P.w,P.bodyH,14,false,true);
  ctx.fillStyle=selected?"#f5bd50":"#5a3724";ctx.beginPath();
  ctx.moveTo(tipX-7*dir,bottom-2);ctx.lineTo(tipX,top+P.h);ctx.lineTo(tipX+5*dir,bottom-2);
  ctx.fill();
}

/* 대사 말풍선. bottomY 는 아랫변이고 상자는 위로 자랍니다 — 줄 수가 늘어도
   가리키는 손님 쪽 끝이 움직이지 않습니다.

   [폭은 세 칸 중에서 고릅니다] 껍데기가 그림이라 아무 폭으로나 늘일 수
   없습니다. 글자 폭 + 좌우 여백이 들어가는 것 중 가장 작은 칸을 씁니다.
   (§1-3-2 speechBubbleArt)

   [화면 안으로 밀지 않습니다] 예전에는 좌우 margin 안으로 clamp 했습니다.
   그래서 5번(오른쪽 끝) 자리 손님만 말풍선이 왼쪽으로 비켜서, 누가 하는
   말인지 알아보기 어려웠습니다. 우측 패널에 조금 잘리더라도 말하는 손님
   머리 한가운데에 뜨는 쪽이 낫습니다. */
function drawCustomerSpeech(text,x,bottomY,alpha=1){
  if(!text)return;
  const S=CUSTOMER_SPEECH;
  ctx.save();ctx.globalAlpha=alpha;
  ctx.font=CUSTOMER_SPEECH_FONT;
  const lines=wrapCanvasText(text,S.maxWidth,S.maxLines);
  const art=speechBubbleArt(Math.max(...lines.map(line=>ctx.measureText(line).width))+S.pad,lines.length);
  const left=x-art.w/2,top=bottomY-art.h;
  if(art.image) ctx.drawImage(art.image,left,top,art.w,art.h);
  else{
    // 예비 도형. 그림 6장을 못 읽었을 때만 여기까지 내려옵니다.
    ctx.fillStyle="rgba(35,20,13,.95)";ctx.strokeStyle="#d0a05b";ctx.lineWidth=2;
    roundRect(ctx,left,top,art.w,art.h,8,true,true);
  }
  ctx.fillStyle="#f8dfae";ctx.textAlign="center";
  lines.forEach((line,i)=>ctx.fillText(line,x,top+20+i*S.lineH));
  ctx.textAlign="left";
  ctx.restore();
}
