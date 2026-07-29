"use strict";

/* ============================================================
   E1 타이밍 칼질 — 게임 7개

     무 썰기 · 어묵 썰기 · 김치 썰기(두부용/전용) · 대파 썰기
     닭 썰기(2연타) · 두부 썰기 · 떡볶이 재료 썰기

   [현재 사용하는 조작]
   모든 날짜의 준비 칼질은 같은 타이밍 판정을 사용합니다.

     timing    왕복하는 포인터가 초록 구간에 있을 때 Space.
               낮 준비의 모든 칼질. 닭고기만 초록 구간에서 빠르게 2연타.
     chop      밤 조리용. 두부는 timing 과 같은 초록 구간 방식이고,
               "정밀 손질"은 노란 중심에 가까울수록 점수가 높은 방식입니다.

   [합쳐진 것 / 안 합쳐진 것]
   · 판정 규칙(초록 구간 안인지, 포인터 왕복)은 아래 도우미로 합쳤습니다.
     여기 숫자를 바꾸면 7개 게임에 동시에 반영됩니다.
   · 화면 마크업은 게임별로 그대로 두었습니다. 재료 그림·절단선·칼 연출이
     서로 다르고, 이쪽은 에셋 작업 영역이라 함부로 통일하지 않았습니다.
   ============================================================ */

registerDayPrepSetup("cut",taskId=>setupTimingCut(taskId));
registerDayPrepSetup("tteokbokkiCut",taskId=>setupTteokbokkiCut(taskId));

const CUT_FEEL_CONFIG=Object.freeze({
  perfectZoneRatio:.38,
  doubleTapWindow:.35,
  missLockMs:150,
  goodRecoveryMs:205,
  perfectRecoveryMs:235,
  recoveryRampMs:65,
  completeDelayMs:620
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

function cutRecoveryDelay(data,grade){
  const progress=data.total>1?(data.successes-1)/(data.total-1):1;
  const base=grade==="perfect"?CUT_FEEL_CONFIG.perfectRecoveryMs:CUT_FEEL_CONFIG.goodRecoveryMs;
  return Math.max(130,Math.round(base-progress*CUT_FEEL_CONFIG.recoveryRampMs));
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
  const key=timingAssetKey(data.ingredient,total,data.assetPrefix);
  if(hasDayPrepAsset(key))return `<i class="cut-sample has-prep-asset">${dayPrepAssetMarkup(key,"cut-sample-asset","")}</i>`;
  return `<div class="cut-done-bowl">${cutPiecesMarkup(data.ingredient,5)}</div>`;
}

// board : 도마 안쪽 마크업 / footer : 도마 아래 줄(조작 버튼 등)
function cutScreenMarkup(data,{board,done,total,footer=""}){
  return `<div class="cut-screen">
      <aside class="cut-card cut-ing-card">
        <h3 class="cut-card-title starred">재료</h3>
        <div class="cut-card-figure">${cutSampleMarkup(data,0)}</div>
        <p class="cut-card-caption">${cutIngredientLabel(data)} <b>×${data.ingredientCount||1}</b></p>
      </aside>
      <div class="cut-main">
        <div class="cut-board">${board}</div>
        ${footer?`<div class="cut-footer">${footer}</div>`:""}
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
    </div>`;
}

// 오른쪽 '완성 개수' 카드 갱신. 공용 진행 카드(#miniTimer)는 이 화면에서
// 카드와 겹치므로 CSS 가 숨기지만, 값은 그대로 채워 둡니다.
function updateCutCountCard(done,total){
  const card=dom.miniContent.querySelector("#cutCountValue");
  if(card)card.innerHTML=`<b>${done}</b> / ${total}`;
}

// 도마 아래 타이밍 바. 삼각 표시가 바 위아래로 튀어나와야 해서
// 바(넘침 잘라냄) 와 표시를 형제로 두고 바깥 상자에 얹습니다.
function cutTimingBarMarkup(zoneLeft,zoneWidth,marker){
  const perfectWidth=zoneWidth*CUT_FEEL_CONFIG.perfectZoneRatio;
  const perfectLeft=zoneLeft+(zoneWidth-perfectWidth)/2;
  return `<div class="cut-timing">
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
    if(data.inputLocked||data.phase==="complete")return;
    // 닭고기 2연타: 첫 입력 뒤 0.35초 안에 두 번째가 없으면 현재 조각부터 재시도
    if(data.requiresDoubleTap&&data.tapStep===1){
      data.tapWindow-=dt;
      if(data.tapWindow<=0){
        data.tapStep=0;data.tapWindow=0;data.pendingGrade=null;
        dom.miniContent.querySelector("#prepWorkObject")?.classList.remove("tough-first-hit");
        dom.miniContent.querySelector(".cut-board")?.classList.remove("cut-embedded");
        dom.miniContent.querySelector("#toughCutHint")?.classList.remove("first-done");
        const action=dom.miniContent.querySelector("#dayPrepAction");if(action)action.textContent="Space · 빠르게 2번";
        dom.miniFeedback.textContent="두 번째 입력이 늦었어요. 초록 구간에서 다시 두 번!";audio.bad();
      }
      return;
    }
    advanceBounceMarker(m,dt,{dirKey:"direction",selector:"#dayPrepMarker"});
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
    hitZoneWidth:config.zoneWidth,
    speed:config.speed,
    zoneStarts:config.zoneStarts,
    requiresDoubleTap:!!config.requiresDoubleTap,
    horizontalLastCut:!!config.horizontalLastCut,
    title:config.title,
    onComplete:taskId==="cutRadish"||taskId==="cutFishCake"
      ?()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료")
      :()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`),
    description:config.requiresDoubleTap
      ?"포인터가 초록 구간에 들어왔을 때 Space를 빠르게 두 번 눌러 질긴 고기를 써세요."
      :config.horizontalLastCut
      ?"포인터가 초록 구간에 들어왔을 때 Space를 누르세요. 세로 5번을 썬 뒤 마지막에 가로로 1번 썹니다."
      :taskId==="cutRadish"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 누르세요. 총 4번 썹니다."
      :taskId==="cutFishCake"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 눌러 어묵을 5조각으로 써세요."
      :`포인터가 초록 구간에 들어왔을 때 Space를 누르세요. ${PREP_TASKS[taskId].label} 작업입니다.`
  });
}

// 재료·횟수·속도만 바꿔 어떤 칼질이든 만들 수 있습니다.
function startCuttingMinigame(options){
  const width={wide:.24,normal:.18,narrow:.14}[options.hitZoneWidth]??options.hitZoneWidth??.18;
  const speed={slow:.55,normal:.7,fast:.9}[options.speed]??options.speed??.7;
  const defaults=[.18,.56,.32,.66,.42];
  const zoneStarts=options.zoneStarts?.length?[...options.zoneStarts]:Array.from({length:options.requiredHits},(_,index)=>defaults[index%defaults.length]);
  setDayPrepData({mode:"timing",phase:"ready",marker:0,direction:1,successes:0,taskId:options.taskId,ingredient:options.ingredient,assetPrefix:options.assetPrefix||"",total:options.requiredHits,zoneWidth:width,speed,zoneStarts,onComplete:options.onComplete,requiresDoubleTap:!!options.requiresDoubleTap,tapStep:0,tapWindow:0,pendingGrade:null,inputLocked:false,
    // 왼쪽 재료 카드에 쓰는 이름·개수 (없으면 재료 id 로 찾고 ×1 로 씁니다)
    ingredientLabel:options.ingredientLabel||"",
    ingredientCount:options.ingredientCount||1,
    // 두부처럼 마지막 한 번을 가로로 써는 재료
    horizontalLastCut:!!options.horizontalLastCut,
    // Day4 떡볶이 진행 표시줄에서 몇 번째 칸인지 (해당 없으면 null)
    tteokbokkiFlowIndex:Number.isFinite(options.tteokbokkiFlowIndex)?options.tteokbokkiFlowIndex:null});
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent=options.description;
  renderTimingCut();
}

function renderTimingCut(){
  const m=state.mini,data=m.data,isRadish=data.ingredient==="radish";
  const zoneLeft=data.zoneStarts[data.successes];
  const objectAssetKey=timingAssetKey(data.ingredient,data.successes,data.assetPrefix);
  // 두부는 마지막 한 번이 가로 썰기라 세로선 간격 계산에서 빼야 합니다.
  const verticalCount=data.horizontalLastCut?data.total-1:data.total;
  const horizontalReady=data.horizontalLastCut&&data.successes>=verticalCount;
  // 다음에 썰 자리(%). 칼과 점선 안내가 여기에 섭니다. 가로 썰기 차례면
  // 칼 위치를 CSS 가 따로 잡으므로 값은 그대로 두어도 됩니다.
  const cutX=(Math.min(data.successes,verticalCount-1)+1)/(verticalCount+1)*100;
  // 어묵은 한 번씩 방향을 바꿔 대각선으로 썰기 때문에 칼도 같이 기울입니다.
  const slashNow=data.ingredient==="fishCake"?(data.successes%2?"cut-slash-back":"cut-slash-forward"):"";
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const visualStage=Math.min(3,Math.floor(data.successes/Math.max(1,data.total)*4));
  const board=`
      <div class="prep-work-object ${data.ingredient}-shape cut-visual-stage-${visualStage} ${slashNow} ${data.horizontalLastCut?"tofu-cook-object":""} ${horizontalReady?"horizontal-cut":""} ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="prepWorkObject" style="--cut-x:${cutX}%;--cut-progress:${data.successes/data.total}" aria-label="${data.ingredient}">
        ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",isRadish?"손질 단계별 무":"손질 단계별 재료")}
        ${Array.from({length:data.total},(_,index)=>{
          const done=index<data.successes?"done":"";
          if(data.horizontalLastCut&&index===data.total-1)return `<i class="cut-line tofu-horizontal-line ${done}" data-cut-index="${index}"></i>`;
          const diagonal=data.ingredient==="fishCake"?`fishcake-diagonal ${index%2?"slash-back":"slash-forward"}`:"";
          return `<i class="cut-line ${diagonal} ${done}" data-cut-index="${index}" style="left:${(index+1)/(verticalCount+1)*100}%"></i>`;
        }).join("")}
        <i class="cut-guide ${horizontalReady?"horizontal":""}"></i>
        <i class="knife-effect ${hasDayPrepAsset("knife")?"has-prep-asset":""}">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
        <i class="cut-spark"></i>
      </div>
      ${cutTimingBarMarkup(zoneLeft,data.zoneWidth,data.marker)}
      <span class="cut-judgement" id="cutJudgement" aria-live="polite"></span>`;
  const footer=`${data.requiresDoubleTap?'<div class="tough-cut-hint" id="toughCutHint"><span>SPACE 1</span><span>SPACE 2</span></div>':""}
      <button class="mini-action cut-action" id="dayPrepAction" type="button">Space · ${data.requiresDoubleTap?"빠르게 2번":"썰기"}</button>`;
  dom.miniContent.innerHTML=`
    ${data.tteokbokkiFlowIndex!=null?day4PrepFlowMarkup("tteokbokki",data.tteokbokkiFlowIndex):""}
    ${cutScreenMarkup(data,{board,done:data.successes,total:data.total,footer})}`;
  dom.miniContent.querySelector("#dayPrepAction").addEventListener("click",timingCutAction);
}

// Space / ACTION 버튼 / 화면 안 썰기 버튼이 모두 여기로 들어옵니다.
function timingCutAction(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  if(m.data.mode!=="timing")return;
  const data=m.data,zoneStart=data.zoneStarts[data.successes];
  if(data.inputLocked||data.phase==="complete")return;
  if(data.requiresDoubleTap&&data.tapStep===1){
    const grade=data.pendingGrade||"good";
    data.tapStep=0;data.tapWindow=0;data.pendingGrade=null;
    completeTimingCut(m,grade);return;
  }
  const grade=cutTimingGrade(data.marker,zoneStart,data.zoneWidth);
  if(grade==="miss"){
    data.mistakes=(data.mistakes||0)+1;
    data.inputLocked=true;
    const board=dom.miniContent.querySelector(".cut-board"),work=dom.miniContent.querySelector("#prepWorkObject"),judgement=dom.miniContent.querySelector("#cutJudgement");
    board?.classList.add("cut-miss");work?.classList.add("slice-miss");
    if(judgement){judgement.textContent="MISS";judgement.className="cut-judgement show miss";}
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 현재 단계에서 다시 시도하세요.";
    audio.bad();
    setTimeout(()=>{
      if(state.mini!==m||m.complete)return;
      data.inputLocked=false;board?.classList.remove("cut-miss");work?.classList.remove("slice-miss");
      if(judgement){judgement.textContent="";judgement.className="cut-judgement";}
    },CUT_FEEL_CONFIG.missLockMs);
    return;
  }
  if(data.requiresDoubleTap){
    data.tapStep=1;data.tapWindow=CUT_FEEL_CONFIG.doubleTapWindow;data.pendingGrade=grade;
    playCutIngredientSfx(data,1);
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

function completeTimingCut(m,grade="good"){
  const data=m.data;
  playCutIngredientSfx(data,data.requiresDoubleTap?2:0);
  data.inputLocked=true;data.phase="impact";
  data.successes++;
  const board=dom.miniContent.querySelector(".cut-board"),work=dom.miniContent.querySelector("#prepWorkObject"),judgement=dom.miniContent.querySelector("#cutJudgement");
  work?.classList.remove("tough-first-hit");
  board?.classList.remove("cut-embedded");board?.classList.add(grade==="perfect"?"cut-perfect":"cut-good");
  work?.classList.add("slice-hit",grade==="perfect"?"slice-perfect":"slice-good");
  if(judgement){judgement.textContent=grade==="perfect"?"PERFECT":"GOOD";judgement.className=`cut-judgement show ${grade}`;}
  const nextAssetKey=timingAssetKey(data.ingredient,data.successes,data.assetPrefix);
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  dom.miniContent.querySelector(`.cut-line[data-cut-index="${data.successes-1}"]`)?.classList.add("done","fresh-cut");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  // 방금 썬 조각을 오른쪽 더미에 바로 얹습니다. (다시 그릴 때 정식으로 다시 깔립니다)
  updateCutCountCard(data.successes,data.total);
  dom.miniFeedback.textContent=data.requiresDoubleTap?"질긴 고기 절단 성공!":grade==="perfect"?"완벽한 타이밍!":"절단 성공";
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
    data.inputLocked=false;data.phase="ready";renderTimingCut();
  },cutRecoveryDelay(data,grade));
}

// 떡볶이 재료 칼질. 양배추 · 대파 · 어묵이 각각 별도의 준비 작업입니다.
// 재료별 횟수와 스프라이트는 day4-prep-data.js 의 TTEOKBOKKI_CUT_SEQUENCE 에 있습니다.
function setupTteokbokkiCut(taskId){
  const item=TTEOKBOKKI_CUT_SEQUENCE.find(entry=>entry.taskId===taskId);
  if(Number(state.day)<4||!item)return;
  startCuttingMinigame({
    taskId,
    ingredient:item.ingredientId,
    ingredientLabel:item.displayName,
    assetPrefix:item.assetPrefix,
    requiredHits:item.requiredPieces,
    hitZoneWidth:.14,
    speed:.8,
    zoneStarts:Array.from({length:item.requiredPieces},(_,hitIndex)=>[.2,.58,.32,.68,.43,.14,.52,.27][hitIndex%8]),
    title:`떡볶이 · ${item.displayName} 썰기`,
    description:`포인터가 초록 구간에 들어왔을 때 Space를 눌러 ${item.displayName}를 써세요.`,
    tteokbokkiFlowIndex:item.flowIndex,
    onComplete:()=>finishDayPrepTask(taskId,`떡볶이용 ${item.displayName} 손질 완료`)
  });
}

/* ============================================================
   2. chop — 밤 조리 칼질

   · 두부 썰기 : 위 timing 과 같은 초록 구간 방식. 세로 5 + 가로 1 = 6회.
     ♻️ 지금은 호출되는 곳이 없습니다. 조건이 mode==="cook" && dishId==="tofu"
        인데 두부김치의 조리 단계가 plateKimchi 라서 만족되지 않습니다.
        3단계에서 game-data.js 의 cook 배열에 단계를 추가해 되살립니다.
   · 정밀 손질 : 노란 중심(50%)에 가까울수록 고득점. 초록 구간 방식이 아닙니다.
     스토리 PR-02 튜토리얼에서만 불립니다. (story.js)
   ============================================================ */

function chopCutX(data){
  const verticalCount=data.tofuStyle?data.total-1:data.total;
  return (Math.min(data.cuts,verticalCount-1)+1)/(verticalCount+1)*100;
}

function renderNightChop(m){
  const data=m.data;
  const horizontalReady=data.tofuStyle&&data.cuts>=data.total-1;
  const objectId=data.tofuStyle?"tofuCookObject":"storyChopObject";
  const objectAssetKey=timingAssetKey(data.ingredient,data.cuts,data.assetPrefix||"");
  const board=`
    <div class="prep-work-object ${data.ingredient}-shape ${data.tofuStyle?"tofu-cook-object":""} ${horizontalReady?"horizontal-cut":""} ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="${objectId}" style="--cut-x:${chopCutX(data)}%" aria-label="${cutIngredientLabel(data)}">
      ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",cutIngredientLabel(data))}
      ${Array.from({length:data.total},(_,index)=>{
        const done=index<data.cuts?"done":"";
        if(data.tofuStyle&&index===data.total-1)return `<i class="cut-line tofu-horizontal-line ${done}" data-cut-index="${index}" data-tofu-cut="${index}"></i>`;
        return `<i class="cut-line ${done}" data-cut-index="${index}" ${data.tofuStyle?`data-tofu-cut="${index}"`:""} style="left:${(index+1)/((data.tofuStyle?data.total-1:data.total)+1)*100}%"></i>`;
      }).join("")}
      <i class="cut-guide ${horizontalReady?"horizontal":""}"></i>
      <i class="knife-effect ${hasDayPrepAsset("knife")?"has-prep-asset":""}">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
      <i class="cut-spark"></i>
    </div>
    ${cutTimingBarMarkup(data.zoneStarts[data.cuts]??data.zoneStarts[data.zoneStarts.length-1],data.zoneWidth,data.marker)}
    <span class="cut-judgement" id="cutJudgement" aria-live="polite"></span>`;
  const label=data.tofuStyle
    ?data.cuts<data.total-1?`세로 썰기 · ${data.cuts} / ${data.total}`:data.cuts===data.total-1?`다음은 가로 썰기 · ${data.cuts} / ${data.total}`:`완료 · ${data.cuts} / ${data.total}`
    :`${data.cuts} / ${data.total}`;
  const footer=`<span class="cut-step-note" id="nightCutStep">${label}</span><button class="mini-action cut-action" id="miniAction" type="button">${data.tofuStyle?"두부 썰기":"썰기"}</button>`;
  dom.miniContent.innerHTML=cutScreenMarkup(data,{board,done:data.cuts,total:data.total,footer});
  dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
}

function showNightChopImpact(m,cutIndex,grade){
  const data=m.data;
  const work=dom.miniContent.querySelector(data.tofuStyle?"#tofuCookObject":"#storyChopObject");
  const board=dom.miniContent.querySelector(".cut-board");
  const judgement=dom.miniContent.querySelector("#cutJudgement");
  work?.querySelector(`[data-cut-index="${cutIndex}"]`)?.classList.add("done","fresh-cut");
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
  const horizontalReady=data.tofuStyle&&data.cuts>=data.total-1;
  work?.style.setProperty("--cut-x",`${chopCutX(data)}%`);
  work?.classList.toggle("horizontal-cut",horizontalReady);
  work?.querySelector(".cut-guide")?.classList.toggle("horizontal",horizontalReady);
  const zoneStart=data.zoneStarts[data.cuts]??data.zoneStarts[data.zoneStarts.length-1];
  const success=dom.miniContent.querySelector(".cut-timing .prep-success-zone");
  const perfect=dom.miniContent.querySelector(".cut-timing .prep-perfect-zone");
  const perfectWidth=data.zoneWidth*CUT_FEEL_CONFIG.perfectZoneRatio;
  if(success){success.style.left=`${zoneStart*100}%`;success.style.width=`${data.zoneWidth*100}%`;}
  if(perfect){perfect.style.left=`${(zoneStart+(data.zoneWidth-perfectWidth)/2)*100}%`;perfect.style.width=`${perfectWidth*100}%`;}
  const marker=dom.miniContent.querySelector("#dayPrepMarker");if(marker)marker.style.left="0%";
  const label=dom.miniContent.querySelector("#nightCutStep");
  if(label)label.textContent=data.tofuStyle
    ?data.cuts<data.total-1?`세로 썰기 · ${data.cuts} / ${data.total}`:`다음은 가로 썰기 · ${data.cuts} / ${data.total}`
    :`${data.cuts} / ${data.total}`;
}

registerMiniEngine("chop",{
  setup(m,{set}){
    const isTofu=m.context.dishId==="tofu"&&(m.context.mode==="cook"||m.context.mode==="story");
    set(
      isTofu?"두부 썰기":"정밀 손질",
      isTofu
        ?"무와 김치를 썰 때처럼 포인터가 초록 구간에 들어왔을 때 누르세요. 세로 5번, 마지막에 가로 1번 썹니다."
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
