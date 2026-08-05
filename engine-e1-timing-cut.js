"use strict";

/* ============================================================
   E1 타이밍 칼질 — 게임 7개

     무 썰기 · 어묵 썰기 · 김치 썰기(두부용/전용) · 대파 썰기
     닭 썰기(2연타) · 두부 썰기 · 떡볶이 재료 썰기

   [현재 사용하는 조작]
   모든 날짜의 준비 칼질은 같은 타이밍 판정을 사용합니다.

     timing    하단 조준선이 초록 판정 구간에 들어올 때 Space.
               낮 준비의 모든 칼질. 닭고기만 절단선에서 빠르게 2연타.
     chop      밤 조리용. 두부는 timing 과 같은 초록 구간 방식이고,
               "정밀 손질"은 노란 중심에 가까울수록 점수가 높은 방식입니다.

   [합쳐진 것 / 안 합쳐진 것]
   · 낮 준비 판정은 칼의 실제 이동 좌표와 다음 절단선 사이 거리로 계산합니다.
     여기 숫자를 바꾸면 7개 게임에 동시에 반영됩니다.
   · 화면 마크업은 게임별로 그대로 두었습니다. 재료 그림·절단선·칼 연출이
     서로 다르고, 이쪽은 에셋 작업 영역이라 함부로 통일하지 않았습니다.
   ============================================================ */

registerDayPrepSetup("cut",taskId=>setupTimingCut(taskId));
registerDayPrepSetup("tteokbokkiCut",taskId=>setupTteokbokkiCut(taskId));

const CUT_FEEL_CONFIG=Object.freeze({
  perfectZoneRatio:.38,
  doubleTapWindow:.35,
  pathLeadInFallback:12,
  /* 칼이 설 수 있는 가장 오른쪽(재료 그림 폭의 %). 첫 박자를 이후 박자와 같은
     길이로 만들려면 첫 절단선보다 한 칸 오른쪽에서 출발해야 하는데, 그 자리가
     그림 밖일 수 있어서 상한을 둡니다.
     ⚠️ 원래 96 이었습니다. 여백 없는 새 에셋에서는 첫 절단선이 그림의 90% 근처라
        96 에 걸려 첫 박자만 반 박자로 짧아졌습니다(양배추는 0.16초). 101 이면
        7종 모두 안 걸립니다. 이 값을 올리면 칼이 재료 오른쪽 끝 밖에 서므로,
        도마 안에 칼이 다 들어오도록 css 의 --cut-obj-w 도 같이 봐야 합니다. */
  startXCeiling:101,
  // 가로 썰기(두부·어묵 마지막 한 번)에서 칼이 내려오기 시작하는 높이(%)
  horizontalStartY:12,
  /* 하단 타이밍 바 양 끝 여유(재료 좌표 %). 칼이 실제로 지나는 구간을 바
     전체로 펼 때, 초록 구간이 바 끝에 딱 붙지 않도록 조금 남깁니다. */
  barEdgeMargin:1.5,
  /* 한 번 썬 뒤 칼이 멈춰 있는 시간(ms). 이 시간이 지나면 화면을 다시 그리고
     다음 박자로 넘어갑니다.
     ⚠️ 원래 115 였습니다. 칼이 제자리에서 눌리기만 하던 시절엔 그걸로 충분했는데,
        칼 크기를 7종 공통으로 고정하면서 "날보다 큰 재료는 획이 크게 지나가며
        덮는" 방식이 됐습니다. 그 획(css 의 cut-knife-chop-asset, 0.28초 ·
        PERFECT 는 0.32초)이 잘리면 칼이 중간에 순간이동합니다.
        획 + 여운이 다 나오도록 잡은 값입니다. 더 줄이려면 CSS 쪽 획 길이도
        같이 줄여야 합니다. */
  pathRecoveryMs:340,
  completeDelayMs:620,
  startCountdownSeconds:3,
  startSignalMs:450
});

/* ---- 공통 판정 규칙 ----------------------------------------
   초록 구간 방식(낮 칼질 · 밤 두부)이 함께 쓰는 계산입니다. */

// 지금 포인터가 초록 구간 안에 있는가
function isInsideCutZone(marker,zoneStart,zoneWidth){
  return marker>=zoneStart&&marker<=zoneStart+zoneWidth;
}

// 구간 한가운데에 얼마나 가까운지로 70~100점
function cutZoneScore(marker,zoneStart,zoneWidth){
  const center=zoneStart+zoneWidth/2;
  return Math.round(clamp(100-Math.abs(marker-center)*300,70,100));
}

function cutTimingGrade(marker,zoneStart,zoneWidth){
  if(!isInsideCutZone(marker,zoneStart,zoneWidth))return "miss";
  const center=zoneStart+zoneWidth/2;
  const perfectHalf=zoneWidth*CUT_FEEL_CONFIG.perfectZoneRatio/2;
  return Math.abs(marker-center)<=perfectHalf?"perfect":"good";
}

/* ---- 공통 화면 틀 (컨셉 이미지 3열 구성) --------------------
   [재료 카드] [도마] [완성 개수 · 완성 예시]
   멸치(E10)·단발 액션(E11)이 쓰는 것과 같은 틀입니다.
   공용 프레임(ui-mini-frame.js · css/minigame-frame.css)은 건드리지 않고
   #miniContent 안에서만 그립니다. 판정·조작 규칙은 위아래 그대로입니다.
   timing 방식이 가운데 도마 안쪽을 채웁니다.

   그림은 전부 임시 CSS 도형입니다. day-prep-minigames.js 의
   DAY_PREP_ASSET_PATHS 경로에 파일을 넣으면 .has-prep-asset 이 붙어
   도형이 꺼지고 <img> 가 대신 보입니다. */

const CUT_INGREDIENT_LABEL=Object.freeze({radish:"무",fishCake:"어묵",kimchi:"김치",chicken:"닭고기",greenOnion:"대파",tofu:"두부",cabbage:"양배추"});
/* 절단선 X 좌표(%) — 재료 그림 상자의 왼쪽 끝이 0, 오른쪽 끝이 100 입니다.
   그림은 늘 상자 폭을 꽉 채우므로 이 값은 곧 "그림 파일 가로의 몇 %" 입니다.
   ⚠️ 납품 에셋의 여백이 잘리면 같은 칼자국이 다른 % 로 옮겨갑니다.
      2026-08 무·대파·양배추·닭·김치 5종이 1536x1024 여백 캔버스에서
      알파 영역만 남기고 잘려서, 아래 값도 새 캔버스 기준으로 다시 쟀습니다.
      (두부·어묵은 그때 캔버스가 그대로라 값도 그대로입니다) */
const CUT_POSITION_PERCENTAGES=Object.freeze({
  radish:Object.freeze([89.8,79,67.8,56.5,45.7,34.1,22.3]),
  fishCake:Object.freeze([74.3,51.3,26.7]),
  cabbage:Object.freeze([92.5,84.4,76.1,68.4,61.1,53.6,45.8,37.9,30.4,22.1,15,7.5]),
  chicken:Object.freeze([91.4,83.4,75,65.8,55.9,46.7,38.3,30,21.4,13.1,6.5]),
  greenOnion:Object.freeze([87.7,76.3,63.8,52.6,39,26.6,15.2]),
  kimchi:Object.freeze([89.6,79.9,70.3,60.8,51.7,42.2,32.7,22.9,14.3]),
  tofu:Object.freeze([85.2,71.3,57.5,43.6,29.7,15.5])
});

// 새 절단 횟수가 기존 진행 스프라이트보다 많아도 그림이 중간에 끊기지 않게
// 완료 비율을 현재 보유한 마지막 스프라이트 단계에 비례시킵니다.
const CUT_ASSET_STAGE_MAX=Object.freeze({radish:7,fishCake:4,cabbage:12,chicken:11,greenOnion:7,kimchi:9,tofu:6});

function cutAssetStage(data,completed=data.successes||0){
  const max=data.assetStageMax??CUT_ASSET_STAGE_MAX[data.ingredient]??data.total;
  return Math.min(max,Math.round(completed/Math.max(1,data.total)*max));
}

function suppliedCutPosition(ingredient,index,total){
  const positions=CUT_POSITION_PERCENTAGES[ingredient];
  return positions
    ?positions[index]??positions.at(-1)
    :(index+1)/(total+1)*100;
}

function cutIngredientSfx(ingredient){
  if(ingredient==="radish")return "knife_daikon";
  if(ingredient==="tofu"||ingredient==="fishCake")return "cut_soft";
  if(ingredient==="kimchi")return "cut_wet";
  return "cut_crisp"; // 양배추 · 대파처럼 아삭한 채소
}

function playCutIngredientSfx(data,tapStep=0){
  const name=data.ingredient==="chicken"
    ?tapStep===1?"cut_meat1":"cut_meat2"
    :cutIngredientSfx(data.ingredient);
  audio.play?.(name,{owner:state.mini});
}

function timingCutAverageScore(data){
  const scores=data.cutScores||[];
  return scores.length
    ?Math.round(scores.reduce((sum,score)=>sum+score,0)/scores.length)
    :100;
}

function cutIngredientLabel(data){
  return data.ingredientLabel||CUT_INGREDIENT_LABEL[data.ingredient]||"재료";
}

// 카드 안 견본 재료. stage 는 손질 단계(0 = 손대기 전)입니다.
function cutSampleMarkup(data,stage){
  const key=timingAssetKey(data.ingredient,stage,data.assetPrefix);
  return `<i class="cut-sample ${data.ingredient}-shape ${hasDayPrepAsset(key)?"has-prep-asset":""}">${dayPrepAssetMarkup(key,"cut-sample-asset","")}</i>`;
}

// 썰어 놓은 조각. 도마 오른쪽 더미와 '완성 예시' 그릇이 같은 조각을 씁니다.
// 3개씩 줄을 바꾸고 index 로 위치·각도를 조금씩 흔들어 흩어 놓습니다.
function cutPiecesMarkup(ingredient,count,newestIndex=-1){
  return Array.from({length:count},(_,index)=>{
    const column=index%3,row=Math.floor(index/3)%3;
    const shiftX=index*37%13-6,shiftY=index*23%11-5;
    return `<i class="cut-piece ${ingredient} ${index===newestIndex?"fresh":""}" style="left:calc(${column*33}% + ${shiftX} * var(--upx));top:calc(${row*30}% + ${shiftY} * var(--upx));transform:rotate(${-18+index%5*9}deg)"></i>`;
  }).join("");
}

// 완성 예시 : 마지막 손질 단계 그림이 있으면 그걸, 없으면 그릇에 담긴 조각들.
function cutDoneSampleMarkup(data,total){
  const key=timingAssetKey(data.ingredient,data.assetStageMax??CUT_ASSET_STAGE_MAX[data.ingredient]??total,data.assetPrefix);
  if(hasDayPrepAsset(key))return `<i class="cut-sample ${data.ingredient}-shape has-prep-asset">${dayPrepAssetMarkup(key,"cut-sample-asset","")}</i>`;
  return `<div class="cut-done-bowl">${cutPiecesMarkup(data.ingredient,5)}</div>`;
}

// board : 도마 안쪽 마크업 / footer : 하단 공용 띠에 들어갈 것(조작 버튼 등)
//
// footer 는 원래 도마 바로 아래(.cut-main 안)에 있었습니다. 통합 규격에서
// 3열을 관통하는 하단 공용 띠(.mg-strip)로 내렸습니다. 폭이 824.2 → 1360.2 로
// 넓어지고, 아래쪽 줄의 높이가 다른 미니게임과 같아집니다.
// 비어 있으면 .mg-strip:empty 가 접어서 3열이 613.2 를 그대로 씁니다.
function cutScreenMarkup(data,{board,done,total,footer=""}){
  return `<div class="cut-screen">
      <aside class="cut-col">
        <div class="cut-card cut-ing-panel">
          <h3 class="cut-card-title starred">재료</h3>
          <div class="cut-ing-list">
            <div class="cut-ing-card">
              <div class="cut-card-figure">${cutSampleMarkup(data,0)}</div>
              <p class="cut-card-caption">${cutIngredientLabel(data)} <b>×${data.ingredientCount||1}</b></p>
            </div>
          </div>
        </div>
      </aside>
      <div class="cut-main">
        <div class="cut-board">${board}</div>
      </div>
      <aside class="cut-side">
        <div class="cut-card cut-count-card">
          <h3 class="cut-card-title">완성 개수</h3>
          <p class="cut-count-value" id="cutCountValue"><b>${done}</b> / ${total}</p>
        </div>
        <div class="cut-card cut-ref-card">
          <h3 class="cut-card-title">완성 예시</h3>
          <div class="cut-card-figure">${cutDoneSampleMarkup(data,total)}</div>
        </div>
      </aside>
      <div class="mg-strip">${footer?`<div class="cut-footer">${footer}</div>`:""}</div>
    </div>`;
}

// 오른쪽 '완성 개수' 카드 갱신. 공용 진행 카드(#miniTimer)는 이 화면에서
// 카드와 겹치므로 CSS 가 숨기지만, 값은 그대로 채워 둡니다.
function updateCutCountCard(done,total){
  const card=dom.miniContent.querySelector("#cutCountValue");
  if(card)card.innerHTML=`<b>${done}</b> / ${total}`;
}

/* 칼 · 썰리는 순간의 이펙트 ---------------------------------
   칼은 세로용·가로용 그림이 따로 옵니다. 가로 썰기(두부 마지막 한 번)일 때
   세로 그림을 -90도 돌려 쓰던 것을 눕힌 그림으로 바꿉니다 — 돌리면 손잡이
   나뭇결과 빛 방향이 같이 누워서 어색했습니다.
   이펙트는 3장이 겹쳐 깔려 있다가 썰릴 때 차례로 켜집니다(자리·크기는 CSS). */
function cutKnifeMarkup(horizontal=false){
  const key=horizontal&&hasDayPrepAsset("knifeHorizontal")?"knifeHorizontal":"knife";
  return `<i class="knife-effect ${hasDayPrepAsset(key)?"has-prep-asset":""}">${dayPrepAssetMarkup(key,"knife-asset","")}</i>`;
}

function cutImpactFxMarkup(){
  if(!hasDayPrepAsset("cutImpactFx1"))return "";
  return `<i class="cut-impact-fx">${[1,2,3].map(no=>dayPrepAssetMarkup(`cutImpactFx${no}`,`cut-impact-frame cut-impact-${no}`,"")).join("")}</i>`;
}

// 도마 아래 타이밍 바. 삼각 표시가 바 위아래로 튀어나와야 해서
// 바(넘침 잘라냄) 와 표시를 형제로 두고 바깥 상자에 얹습니다.
function cutTimingBarMarkup(zoneLeft,zoneWidth,marker,extraClass=""){
  const perfectWidth=zoneWidth*CUT_FEEL_CONFIG.perfectZoneRatio;
  const perfectLeft=zoneLeft+(zoneWidth-perfectWidth)/2;
  return `<div class="cut-timing${extraClass?` ${extraClass}`:""}">
      <div class="prep-timing-bar"><i class="prep-success-zone" style="left:${zoneLeft*100}%;width:${zoneWidth*100}%"></i><i class="prep-perfect-zone" style="left:${perfectLeft*100}%;width:${perfectWidth*100}%"></i></div>
      <i id="dayPrepMarker" class="prep-timing-marker" style="left:${marker*100}%"></i>
    </div>`;
}

/* ============================================================
   1. timing — 낮 준비 칼질 (Day1~3)
   ============================================================ */

registerDayPrepEngine("timing",{
  update(m,dt){
    const data=m.data;
    if(data.phase==="countdown"){
      advanceTimingCutCountdown(m,dt);
      return;
    }
    if(data.inputLocked||data.phase==="complete")return;
    // 닭고기 2연타: 첫 입력 뒤 0.35초 안에 두 번째가 없으면 현재 조각부터 재시도
    if(data.requiresDoubleTap&&data.tapStep===1){
      data.tapWindow-=dt;
      if(data.tapWindow<=0){
        data.tapStep=0;data.tapWindow=0;data.pendingGrade=null;
        completeTimingCut(m,"miss","두 번째 입력이 늦었어요");
      }
      return;
    }
    advanceTimingKnife(m,dt);
  },
  action(){timingCutAction();},
  key(m,k,e){
    if(e.code==="Space"){
      // 키를 누르고 있는 브라우저 자동 반복은 칼질 횟수로 세지 않습니다.
      if(e.repeat)return true;
      timingCutAction();return true;
    }
    return false;
  }
});

function setupTimingCut(taskId){
  const config=DAY_PREP_MINI_CONFIG[taskId];
  const ingredient=config.ingredient||(taskId==="cutRadish"?"radish":"fishCake");
  startCuttingMinigame({
    taskId,
    ingredient,
    requiredHits:config.total,
    hitTolerance:config.hitTolerance,
    travelSpeed:config.travelSpeed,
    requiresDoubleTap:!!config.requiresDoubleTap,
    horizontalLastCut:!!config.horizontalLastCut,
    title:config.title,
    onComplete:()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`),
    description:config.requiresDoubleTap
      ?"하단 조준선이 초록 판정 구간에 들어올 때 Space를 빠르게 두 번 눌러 질긴 고기를 써세요."
      :config.horizontalLastCut
      ?`하단 조준선이 초록 판정 구간에 들어올 때 Space를 누르세요. 세로 ${config.total-1}번을 썬 뒤 마지막에 가로로 1번 썹니다.`
      :`하단 조준선이 초록 판정 구간에 들어올 때 Space를 누르세요. 총 ${config.total}번 썹니다.`
  });
}

// 재료·횟수·속도만 바꿔 어떤 칼질이든 만들 수 있습니다.
function startCuttingMinigame(options){
  const hitTolerance=options.hitTolerance??2.8;
  const travelSpeed=options.travelSpeed??16;
  const verticalCount=options.horizontalLastCut?options.requiredHits-1:options.requiredHits;
  const firstCutX=suppliedCutPosition(options.ingredient,0,verticalCount);
  // 첫 박자도 이후 박자와 같은 길이가 되도록 첫째-둘째 절단선 간격 앞에서 출발합니다.
  const firstBeatDistance=verticalCount>1
    ?Math.abs(firstCutX-suppliedCutPosition(options.ingredient,1,verticalCount))
    :CUT_FEEL_CONFIG.pathLeadInFallback;
  const startKnifeX=Math.min(CUT_FEEL_CONFIG.startXCeiling,firstCutX+firstBeatDistance);
  setDayPrepData({mode:"timing",phase:"countdown",successes:0,taskId:options.taskId,ingredient:options.ingredient,assetPrefix:options.assetPrefix||"",total:options.requiredHits,hitTolerance,travelSpeed,knifeX:startKnifeX,startKnifeX,knifeY:CUT_FEEL_CONFIG.horizontalStartY,onComplete:options.onComplete,requiresDoubleTap:!!options.requiresDoubleTap,tapStep:0,tapWindow:0,pendingGrade:null,inputLocked:true,mistakes:0,cutScores:[],countdownRemaining:CUT_FEEL_CONFIG.startCountdownSeconds,countdownStep:CUT_FEEL_CONFIG.startCountdownSeconds,
    // 왼쪽 재료 카드에 쓰는 이름·개수 (없으면 재료 id 로 찾고 ×1 로 씁니다)
    ingredientLabel:options.ingredientLabel||"",
    ingredientCount:options.ingredientCount||1,
    // 두부처럼 마지막 한 번을 가로로 써는 재료
    horizontalLastCut:!!options.horizontalLastCut,
    assetStageMax:options.assetStageMax??CUT_ASSET_STAGE_MAX[options.ingredient]??options.requiredHits});
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent=options.description;
  renderTimingCut();
}

function renderTimingCut(){
  const m=state.mini,data=m.data,isRadish=data.ingredient==="radish";
  const countdownActive=data.phase==="countdown";
  const objectAssetKey=timingAssetKey(data.ingredient,cutAssetStage(data),data.assetPrefix);
  // 두부는 마지막 한 번이 가로 썰기라 세로선 간격 계산에서 빼야 합니다.
  const verticalCount=data.horizontalLastCut?data.total-1:data.total;
  const horizontalReady=data.horizontalLastCut&&data.successes>=verticalCount;
  // 제공된 단계 에셋의 실제 틈과 칼 안내선이 겹치도록 재료별 좌표를 사용합니다.
  // 무·어묵·닭·대파·김치·두부 모두 오른쪽부터 왼쪽으로 절단이 진행됩니다.
  const cutPosition=index=>suppliedCutPosition(data.ingredient,index,verticalCount);
  // 다음에 썰 자리(%). 칼과 점선 안내가 여기에 섭니다. 가로 썰기 차례면
  // 칼 위치를 CSS 가 따로 잡으므로 값은 그대로 두어도 됩니다.
  const cutX=cutPosition(Math.min(data.successes,verticalCount-1));
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const visualStage=Math.min(3,Math.floor(data.successes/Math.max(1,data.total)*4));
  const board=`
      <div class="prep-work-object cut-path-mode ${data.ingredient}-shape cut-visual-stage-${visualStage} ${data.horizontalLastCut?"tofu-cook-object":""} ${horizontalReady?"horizontal-cut":""} ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="prepWorkObject" style="--cut-x:${cutX}%;--knife-x:${data.knifeX}%;--knife-y:${data.knifeY}%;--cut-progress:${data.successes/data.total}" aria-label="${data.ingredient}">
        ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",isRadish?"손질 단계별 무":"손질 단계별 재료")}
        ${Array.from({length:data.total},(_,index)=>{
          if(index<data.successes)return "";
          const active=index===data.successes?"active":"";
          if(data.horizontalLastCut&&index===data.total-1)return `<i class="cut-line tofu-horizontal-line ${active}" data-cut-index="${index}"></i>`;
          return `<i class="cut-line ${active}" data-cut-index="${index}" style="left:${cutPosition(index)}%"></i>`;
        }).join("")}
        <i class="cut-guide ${horizontalReady?"horizontal":""}"></i>
        ${cutKnifeMarkup(horizontalReady)}
        <i class="cut-spark"></i>
        ${cutImpactFxMarkup()}
      </div>
      <div class="cut-footer">${data.requiresDoubleTap?'<div class="tough-cut-hint" id="toughCutHint"><span>SPACE 1</span><span>SPACE 2</span></div>':""}
        <button class="mini-action cut-action" id="dayPrepAction" type="button" ${countdownActive?"disabled":""}>Space · ${data.requiresDoubleTap?"빠르게 2번":"썰기"}</button></div>
      <span class="cut-judgement" id="cutJudgement" aria-live="polite"></span>
      ${countdownActive?`<div class="cut-start-countdown" id="cutStartCountdown" aria-live="assertive"><strong>${data.countdownStep}</strong></div>`:""}`;
  // 하단 바의 초록 구간과 조준선을 실제 판정 좌표에 맞춥니다.
  const footer=cutTimingBarMarkup(0,0,0,"cut-path-timing");
  dom.miniContent.innerHTML=cutScreenMarkup(data,{board,done:data.successes,total:data.total,footer});
  dom.miniContent.querySelector("#dayPrepAction").addEventListener("click",timingCutAction);
  syncTimingKnife(data);
}

function advanceTimingCutCountdown(m,dt){
  const data=m.data;
  if(data.phase!=="countdown")return false;
  data.countdownRemaining=Math.max(0,data.countdownRemaining-dt);
  const nextStep=Math.ceil(data.countdownRemaining);
  const overlay=dom.miniContent.querySelector("#cutStartCountdown");
  const label=overlay?.querySelector("strong");
  if(nextStep>0){
    if(nextStep!==data.countdownStep){
      data.countdownStep=nextStep;
      if(label){label.textContent=String(nextStep);label.classList.remove("tick");void label.offsetWidth;label.classList.add("tick");}
    }
    return true;
  }
  data.countdownStep=0;
  data.countdownRemaining=0;
  data.phase="ready";
  data.inputLocked=false;
  const action=dom.miniContent.querySelector("#dayPrepAction");
  if(action)action.disabled=false;
  if(label)label.textContent="시작!";
  overlay?.classList.add("go");
  setTimeout(()=>{
    if(state.mini===m&&!m.complete)dom.miniContent.querySelector("#cutStartCountdown")?.remove();
  },CUT_FEEL_CONFIG.startSignalMs);
  return true;
}

function timingCutVerticalCount(data){
  return data.horizontalLastCut?data.total-1:data.total;
}

function isHorizontalTimingCut(data){
  return data.horizontalLastCut&&data.successes>=timingCutVerticalCount(data);
}

function timingCutTarget(data){
  if(isHorizontalTimingCut(data))return {axis:"y",value:50,current:data.knifeY,direction:1};
  return {
    axis:"x",
    value:suppliedCutPosition(data.ingredient,data.successes,timingCutVerticalCount(data)),
    current:data.knifeX,
    direction:-1
  };
}

function syncTimingKnife(data){
  const work=dom.miniContent.querySelector("#prepWorkObject");
  // knifeX/knifeY are the moving timing playhead. The knife artwork waits on
  // the next cut line while only the marker in the bottom bar travels.
  const target=timingCutTarget(data);
  if(target.axis==="x")work?.style.setProperty("--knife-x",`${target.value}%`);
  else work?.style.setProperty("--knife-y",`${target.value}%`);
  syncCutPathTimingBar(data);
}

/* 하단 바가 보여줄 좌표 구간(재료 좌표 %).
   조준선이 실제로 지나는 곳만 잡습니다 — 세로 썰기는 출발 자리부터 마지막
   절단선 판정 끝까지, 가로 썰기는 내려오기 시작하는 높이부터 판정 끝까지.
   이 구간을 바 전체로 펴는 것이 syncCutPathTimingBar 의 project 입니다. */
function cutBarRange(data){
  const margin=CUT_FEEL_CONFIG.barEdgeMargin;
  if(isHorizontalTimingCut(data)){
    return {min:CUT_FEEL_CONFIG.horizontalStartY-margin,max:50+data.hitTolerance+margin};
  }
  const verticalCount=timingCutVerticalCount(data);
  const lastCut=suppliedCutPosition(data.ingredient,verticalCount-1,verticalCount);
  return {min:lastCut-data.hitTolerance-margin,max:(data.startKnifeX??CUT_FEEL_CONFIG.startXCeiling)+margin};
}

/* 재료 좌표를 하단 바 좌표로 폅니다.
   ⚠️ 원래는 재료 그림의 **화면 좌표**를 그대로 바에 투영했습니다. 그러면 바 위의
      자리와 도마 위의 자리가 세로로 딱 맞아떨어지긴 하는데, 재료가 도마 가운데
      절반쯤만 차지하다 보니 바도 그만큼만 쓰였습니다. 포인터가 좁은 구간을
      천천히 지나 속도감이 없고, 초록 구간도 바늘처럼 얇았습니다.
      이제 "조준선이 지나는 구간(cutBarRange)"을 바 0~100 으로 폅니다. 같은 배율이
      초록 구간에도 걸리므로 구간 폭도 같이 넓어집니다.
   판정은 재료 좌표(cutPathGrade)로 그대로 하므로 절단선 위치·타이밍은
   하나도 바뀌지 않습니다. 바는 보여주기만 합니다. */
function syncCutPathTimingBar(data){
  const work=dom.miniContent.querySelector("#prepWorkObject");
  const timing=dom.miniContent.querySelector(".cut-path-timing");
  const success=timing?.querySelector(".prep-success-zone");
  const perfect=timing?.querySelector(".prep-perfect-zone");
  const marker=timing?.querySelector("#dayPrepMarker");
  if(!work||!timing||!success||!perfect||!marker)return;

  const target=timingCutTarget(data);
  const tolerance=data.hitTolerance;
  const perfectTolerance=tolerance*CUT_FEEL_CONFIG.perfectZoneRatio;
  const range=cutBarRange(data);
  const span=Math.max(1,range.max-range.min);
  const project=value=>(value-range.min)/span*100;

  const clamp=value=>Math.max(0,Math.min(100,value));
  const successLeft=clamp(project(target.value-tolerance));
  const successRight=clamp(project(target.value+tolerance));
  const perfectLeft=clamp(project(target.value-perfectTolerance));
  const perfectRight=clamp(project(target.value+perfectTolerance));
  success.style.left=`${successLeft}%`;
  success.style.width=`${Math.max(0,successRight-successLeft)}%`;
  perfect.style.left=`${perfectLeft}%`;
  perfect.style.width=`${Math.max(0,perfectRight-perfectLeft)}%`;
  marker.style.left=`${clamp(project(target.current))}%`;
}

function cutPathGrade(data){
  const target=timingCutTarget(data);
  const distance=Math.abs(target.current-target.value);
  if(distance>data.hitTolerance)return "miss";
  return distance<=data.hitTolerance*CUT_FEEL_CONFIG.perfectZoneRatio?"perfect":"good";
}

function timingKnifeIsEarly(data){
  const target=timingCutTarget(data);
  return target.direction<0
    ?target.current>target.value+data.hitTolerance
    :target.current<target.value-data.hitTolerance;
}

function snapTimingKnifeToTarget(data){
  const target=timingCutTarget(data);
  if(target.axis==="x")data.knifeX=target.value;
  else data.knifeY=target.value;
}

// The timing playhead advances once from the previous cut to the next. The
// knife artwork itself stays on timingCutTarget(data) until the impact.
function advanceTimingKnife(m,dt){
  const data=m.data,target=timingCutTarget(data);
  const step=data.travelSpeed*dt;
  if(target.axis==="x"){
    data.knifeX-=step;
    if(data.knifeX<target.value-data.hitTolerance){
      data.knifeX=target.value-data.hitTolerance;
      syncTimingKnife(data);
      completeTimingCut(m,"miss","절단선을 놓쳤어요. 다음 박자로 넘어갑니다.");
      return;
    }
  }else{
    data.knifeY+=step;
    if(data.knifeY>target.value+data.hitTolerance){
      data.knifeY=target.value+data.hitTolerance;
      syncTimingKnife(data);
      completeTimingCut(m,"miss","절단선을 놓쳤어요. 다음 박자로 넘어갑니다.");
      return;
    }
  }
  syncTimingKnife(data);
}

// Space / ACTION 버튼 / 화면 안 썰기 버튼이 모두 여기로 들어옵니다.
function timingCutAction(){
  const m=state.mini;if(!m||m.complete)return;
  if(m.data.mode!=="timing")return;
  const data=m.data;
  if(data.inputLocked||data.phase==="complete")return;
  if(data.requiresDoubleTap&&data.tapStep===1){
    const grade=data.pendingGrade||"good";
    data.tapStep=0;data.tapWindow=0;data.pendingGrade=null;
    completeTimingCut(m,grade);return;
  }
  const grade=cutPathGrade(data);
  if(grade==="miss"){
    if(timingKnifeIsEarly(data)){
      const earlyJudgement=dom.miniContent.querySelector("#cutJudgement");
      if(earlyJudgement){earlyJudgement.textContent="EARLY";earlyJudgement.className="cut-judgement show miss";}
      dom.miniFeedback.textContent="하단 조준선이 아직 초록 판정 구간에 닿지 않았어요.";
      audio.bad();
      setTimeout(()=>{
        if(state.mini!==m||m.complete)return;
        const current=dom.miniContent.querySelector("#cutJudgement");
        if(current?.textContent==="EARLY"){current.textContent="";current.className="cut-judgement";}
      },180);
      return;
    }
    completeTimingCut(m,"miss","절단선을 놓쳤어요. 다음 박자로 넘어갑니다.");
    return;
  }
  if(data.requiresDoubleTap){
    data.tapStep=1;data.tapWindow=CUT_FEEL_CONFIG.doubleTapWindow;data.pendingGrade=grade;
    playCutIngredientSfx(data,1);
    /* 첫 타도 두 번째 타처럼 절단선 위에서 긋도록 칼을 선에 붙입니다.
       판정은 위에서 이미 pendingGrade 로 잡아 두었고 두 번째 타는 그 값을 쓰므로,
       여기서 칼을 옮겨도 점수·타이밍은 그대로입니다. 안 붙이면 두 획이 서로 다른
       X 에서 시작해 칼이 옆으로 미끄러지는 것처럼 보입니다. */
    snapTimingKnifeToTarget(data);
    syncTimingKnife(data);
    const work=dom.miniContent.querySelector("#prepWorkObject");
    work?.classList.add("tough-first-hit");
    dom.miniContent.querySelector(".cut-board")?.classList.add("cut-embedded");
    dom.miniContent.querySelector("#toughCutHint")?.classList.add("first-done");
    const action=dom.miniContent.querySelector("#dayPrepAction");if(action)action.textContent="Space · 한 번 더!";
    dom.miniFeedback.textContent="칼이 걸렸어요 · 빠르게 Space 한 번 더!";
    return;
  }
  completeTimingCut(m,grade);
}

function completeTimingCut(m,grade="good",missMessage=""){
  const data=m.data;
  data.inputLocked=true;data.phase="impact";
  const cutIndex=data.successes;
  snapTimingKnifeToTarget(data);
  syncTimingKnife(data);
  if(grade==="miss"){
    data.mistakes=(data.mistakes||0)+1;
    audio.bad();
  }else playCutIngredientSfx(data,data.requiresDoubleTap?2:0);
  data.cutScores?.push(grade==="perfect"?100:grade==="good"?85:45);
  data.successes++;
  const board=dom.miniContent.querySelector(".cut-board"),work=dom.miniContent.querySelector("#prepWorkObject"),judgement=dom.miniContent.querySelector("#cutJudgement");
  work?.classList.remove("tough-first-hit");
  board?.classList.remove("cut-embedded");board?.classList.add(grade==="miss"?"cut-miss":grade==="perfect"?"cut-perfect":"cut-good");
  work?.classList.add(grade==="miss"?"slice-miss":"slice-hit",grade==="miss"?"slice-missed":grade==="perfect"?"slice-perfect":"slice-good");
  if(judgement){judgement.textContent=grade==="miss"?"MISS":grade==="perfect"?"PERFECT":"GOOD";judgement.className=`cut-judgement show ${grade}`;}
  const completedLine=dom.miniContent.querySelector(`.cut-line[data-cut-index="${cutIndex}"]`);
  completedLine?.remove();
  const nextAssetKey=timingAssetKey(data.ingredient,cutAssetStage(data,data.successes),data.assetPrefix);
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  // 방금 썬 조각을 오른쪽 더미에 바로 얹습니다. (다시 그릴 때 정식으로 다시 깔립니다)
  updateCutCountCard(data.successes,data.total);
  dom.miniFeedback.textContent=data.requiresDoubleTap?"질긴 고기 절단 성공!":grade==="perfect"?"완벽한 타이밍!":"절단 성공";
  if(grade==="miss")dom.miniFeedback.textContent=missMessage||"엇박! 다음 절단선으로 넘어갑니다.";
  if(data.successes>=data.total){
    data.phase="complete";board?.classList.add("cut-complete");
    const action=dom.miniContent.querySelector("#dayPrepAction");if(action){action.disabled=true;action.textContent="손질 완료";}
    dom.miniFeedback.textContent=`${cutIngredientLabel(data)} 손질 완료!`;
    setTimeout(()=>{
      if(state.mini===m&&!m.complete&&typeof data.onComplete==="function")data.onComplete();
    },CUT_FEEL_CONFIG.completeDelayMs);
    return;
  }
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    if(isHorizontalTimingCut(data))data.knifeY=CUT_FEEL_CONFIG.horizontalStartY;
    data.inputLocked=false;data.phase="ready";renderTimingCut();
  },CUT_FEEL_CONFIG.pathRecoveryMs);
}

// 떡볶이 재료 칼질. 양배추 · 대파 · 어묵이 각각 별도의 준비 작업입니다.
// 재료별 횟수와 스프라이트는 day4-prep-data.js 의 TTEOKBOKKI_CUT_SEQUENCE 에 있습니다.
function setupTteokbokkiCut(taskId){
  const item=TTEOKBOKKI_CUT_SEQUENCE.find(entry=>entry.taskId===taskId);
  if(!item)return;
  startCuttingMinigame({
    taskId,
    ingredient:item.ingredientId,
    ingredientLabel:item.displayName,
    assetPrefix:item.assetPrefix,
    requiredHits:item.requiredPieces,
    hitTolerance:item.hitTolerance,
    travelSpeed:item.travelSpeed,
    assetStageMax:item.progressSprites.length-1,
    horizontalLastCut:!!item.horizontalLastCut,
    title:`떡볶이 · ${item.displayName} 썰기`,
    description:`하단 조준선이 초록 판정 구간에 들어올 때 Space를 눌러 ${item.displayName}를 써세요.`,
    onComplete:()=>finishDayPrepTask(taskId,`떡볶이용 ${item.displayName} 손질 완료`)
  });
}

/* ============================================================
   2. chop — 밤 조리 칼질

   · 두부 썰기 : 위 timing 과 같은 초록 구간 방식. 오른쪽부터 세로 6회.
   · 정밀 손질 : 노란 중심(50%)에 가까울수록 고득점. 초록 구간 방식이 아닙니다.
     스토리 PR-02 튜토리얼에서만 불립니다. (story.js)
   ============================================================ */

function chopCutX(data){
  return suppliedCutPosition(data.ingredient,Math.min(data.cuts,data.total-1),data.total);
}

function renderNightChop(m){
  const data=m.data;
  const objectId=data.tofuStyle?"tofuCookObject":"storyChopObject";
  const objectAssetKey=timingAssetKey(data.ingredient,data.cuts,data.assetPrefix||"");
  // 단계 문구는 board 안(도마 아래 줄)에서 쓰므로 board 보다 먼저 만듭니다.
  const label=data.tofuStyle
    ?data.cuts<data.total?`세로 썰기 · ${data.cuts} / ${data.total}`:`완료 · ${data.cuts} / ${data.total}`
    :`${data.cuts} / ${data.total}`;
  const board=`
    <div class="prep-work-object ${data.ingredient}-shape ${data.tofuStyle?"tofu-cook-object":""} ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="${objectId}" style="--cut-x:${chopCutX(data)}%" aria-label="${cutIngredientLabel(data)}">
      ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",cutIngredientLabel(data))}
      ${Array.from({length:data.total},(_,index)=>{
        if(index<data.cuts)return "";
        return `<i class="cut-line" data-cut-index="${index}" ${data.tofuStyle?`data-tofu-cut="${index}"`:""} style="left:${suppliedCutPosition(data.ingredient,index,data.total)}%"></i>`;
      }).join("")}
      <i class="cut-guide"></i>
      ${cutKnifeMarkup()}
      <i class="cut-spark"></i>
      ${cutImpactFxMarkup()}
    </div>
    <div class="cut-footer"><span class="cut-step-note" id="nightCutStep">${label}</span><button class="mini-action cut-action" id="miniAction" type="button">${data.tofuStyle?"두부 썰기":"썰기"}</button></div>
    <span class="cut-judgement" id="cutJudgement" aria-live="polite"></span>`;
  // 두꺼운 바는 하단 공용 띠에 모읍니다 (낮 준비 경로와 같은 처리).
  const footer=cutTimingBarMarkup(data.zoneStarts[data.cuts]??data.zoneStarts[data.zoneStarts.length-1],data.zoneWidth,data.marker);
  dom.miniContent.innerHTML=cutScreenMarkup(data,{board,done:data.cuts,total:data.total,footer});
  dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
}

function showNightChopImpact(m,cutIndex,grade){
  const data=m.data;
  const work=dom.miniContent.querySelector(data.tofuStyle?"#tofuCookObject":"#storyChopObject");
  const board=dom.miniContent.querySelector(".cut-board");
  const judgement=dom.miniContent.querySelector("#cutJudgement");
  work?.querySelector(`[data-cut-index="${cutIndex}"]`)?.remove();
  const nextAssetKey=timingAssetKey(data.ingredient,data.cuts,data.assetPrefix||"");
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  work?.classList.remove("slice-hit","slice-good","slice-perfect");
  board?.classList.remove("cut-good","cut-perfect");
  if(work){void work.offsetWidth;work.classList.add("slice-hit",grade==="perfect"?"slice-perfect":"slice-good");}
  board?.classList.add(grade==="perfect"?"cut-perfect":"cut-good");
  if(judgement){judgement.textContent=grade==="perfect"?"PERFECT":"GOOD";judgement.className=`cut-judgement show ${grade}`;}
  updateCutCountCard(data.cuts,data.total);
  setTimeout(()=>{
    if(state.mini!==m)return;
    work?.classList.remove("slice-hit","slice-good","slice-perfect");
    board?.classList.remove("cut-good","cut-perfect");
  },240);
}

function moveNightChopTarget(m){
  const data=m.data,work=dom.miniContent.querySelector(data.tofuStyle?"#tofuCookObject":"#storyChopObject");
  work?.style.setProperty("--cut-x",`${chopCutX(data)}%`);
  const zoneStart=data.zoneStarts[data.cuts]??data.zoneStarts[data.zoneStarts.length-1];
  const success=dom.miniContent.querySelector(".cut-timing .prep-success-zone");
  const perfect=dom.miniContent.querySelector(".cut-timing .prep-perfect-zone");
  const perfectWidth=data.zoneWidth*CUT_FEEL_CONFIG.perfectZoneRatio;
  if(success){success.style.left=`${zoneStart*100}%`;success.style.width=`${data.zoneWidth*100}%`;}
  if(perfect){perfect.style.left=`${(zoneStart+(data.zoneWidth-perfectWidth)/2)*100}%`;perfect.style.width=`${perfectWidth*100}%`;}
  const marker=dom.miniContent.querySelector("#dayPrepMarker");if(marker)marker.style.left="0%";
  const label=dom.miniContent.querySelector("#nightCutStep");
  if(label)label.textContent=data.tofuStyle
    ?`세로 썰기 · ${data.cuts} / ${data.total}`
    :`${data.cuts} / ${data.total}`;
}

registerMiniEngine("chop",{
  setup(m,{set,difficulty=1}){
    const isTofu=m.context.dishId==="tofu"&&(m.context.mode==="cook"||m.context.mode==="story");
    if(isTofu){
      set("두부 썰기","움직이는 칼날의 왼쪽 끝이 점선에 닿을 때 Space를 눌러 두부를 6번 썰어주세요.",10);
      startCuttingMinigame({
        taskId:"cookTofuBlock",
        ingredient:"tofu",
        ingredientLabel:"두부",
        ingredientCount:1,
        requiredHits:6,
        hitTolerance:DAY_PREP_MINI_CONFIG.cutTofuBlock.hitTolerance,
        travelSpeed:DAY_PREP_MINI_CONFIG.cutTofuBlock.travelSpeed*difficulty,
        title:"두부 썰기",
        description:"칼날의 왼쪽 끝이 점선에 닿을 때 Space를 눌러주세요. 총 6번 썹니다.",
        onComplete:()=>finishMini(timingCutAverageScore(m.data))
      });
      return;
    }
    set(
      isTofu?"두부 썰기":"정밀 손질",
      isTofu
        ?"무와 김치를 썰 때처럼 포인터가 초록 구간에 들어왔을 때 누르세요. 오른쪽부터 세로로 6번 썹니다."
        :"움직이는 칼 표시가 노란 중심에 들어왔을 때 SPACE 또는 썰기 버튼을 누르세요.",
      10
    );
    m.data=isTofu
      ?{marker:0,dir:1,speed:.78,hits:[],cuts:0,total:6,tofuStyle:true,ingredient:"tofu",ingredientLabel:"두부",ingredientCount:1,assetPrefix:"",zoneWidth:.14,zoneStarts:[.18,.56,.3,.67,.42,.22]}
      :{marker:0,dir:1,speed:.92,hits:[],cuts:0,total:5,tofuStyle:false,ingredient:"radish",ingredientLabel:"절임무",ingredientCount:1,assetPrefix:"",zoneWidth:.24,zoneStarts:[.38,.38,.38,.38,.38]};
    if(isTofu)dom.miniTimer.textContent="0 / 6";
    renderNightChop(m);
  },

  // 두부 썰기는 타이머 자리에 "3 / 6" 처럼 횟수를 쓰므로 시간이 흐르지 않습니다.
  timerRuns(m){
    return !m.data.tofuStyle;
  },

  update(m,dt){
    if(m.data.finishing)return;
    advanceBounceMarker(m,dt,{selector:"#dayPrepMarker"});
  },

  action(m){
    if(m.data.tofuStyle){tofuChopAction(m);return;}
    if(m.data.finishing)return;
    const data=m.data,cutIndex=data.cuts;
    const score=markerScore(m,.5),grade=cutTimingGrade(data.marker,data.zoneStarts[cutIndex],data.zoneWidth)==="perfect"?"perfect":"good";
    data.hits.push(score);data.cuts++;playCutIngredientSfx(data);
    showNightChopImpact(m,cutIndex,grade);
    data.marker=0;data.dir=1;data.speed+=.08;
    if(data.cuts>=data.total){
      data.finishing=true;dom.miniContent.querySelector(".cut-board")?.classList.add("cut-complete");
      setTimeout(()=>{if(state.mini===m&&!m.complete)finishMini(Math.round(data.hits.reduce((a,b)=>a+b,0)/data.hits.length));},320);
      return;
    }
    moveNightChopTarget(m);
  }
});

function tofuChopAction(m){
  const data=m.data;if(data.finishing)return;
  const cutIndex=data.cuts,zoneStart=data.zoneStarts[cutIndex];
  if(!isInsideCutZone(data.marker,zoneStart,data.zoneWidth)){
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 초록 구간에서 다시 썰어주세요.";audio.bad();return;
  }
  const grade=cutTimingGrade(data.marker,zoneStart,data.zoneWidth);
  data.hits.push(cutZoneScore(data.marker,zoneStart,data.zoneWidth));
  data.cuts++;playCutIngredientSfx(data);
  showNightChopImpact(m,cutIndex,grade);
  dom.miniTimer.textContent=`${data.cuts} / ${data.total}`;
  if(data.cuts>=data.total){
    data.finishing=true;dom.miniContent.querySelector(".cut-board")?.classList.add("cut-complete");
    dom.miniFeedback.textContent="두부 썰기 완료!";
    setTimeout(()=>{if(state.mini===m&&!m.complete)finishMini(Math.round(data.hits.reduce((sum,score)=>sum+score,0)/data.hits.length));},320);
    return;
  }
  data.marker=0;data.dir=1;data.speed+=.05;moveNightChopTarget(m);
  dom.miniFeedback.textContent=grade==="perfect"?"완벽한 절단!":"절단 성공";
}
