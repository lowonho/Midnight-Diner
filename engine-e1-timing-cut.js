"use strict";

/* ============================================================
   E1 타이밍 칼질 — 게임 7개

     무 썰기 · 어묵 썰기 · 김치 썰기(두부용/전용) · 대파 썰기
     닭 썰기(2연타) · 두부 썰기 · 떡볶이 재료 썰기

   [조작 갈래 3가지]
   같은 "칼질"인데 방식이 셋입니다. 셋 다 이 파일 안에 있습니다.

     timing    왕복하는 포인터가 초록 구간에 있을 때 Space.
               낮 준비 Day1~3 의 모든 칼질. 닭고기만 초록 구간에서 2연타.
     chop      밤 조리용. 두부는 timing 과 같은 초록 구간 방식이고,
               "정밀 손질"은 노란 중심에 가까울수록 점수가 높은 방식입니다.
     rapidCut  Day4~ 의 빠른 칼질. 구간을 맞출 필요 없이 Space 연타.
               닭고기는 0.5초 꾹 눌렀다 떼고 한 번 더. 실패·시간제한 없음.
               timing 대신 쓸지는 setupTimingCut 이 Day 로 판단합니다.

   [합쳐진 것 / 안 합쳐진 것]
   · 판정 규칙(초록 구간 안인지, 포인터 왕복)은 아래 도우미로 합쳤습니다.
     여기 숫자를 바꾸면 7개 게임에 동시에 반영됩니다.
   · 화면 마크업은 게임별로 그대로 두었습니다. 재료 그림·절단선·칼 연출이
     서로 다르고, 이쪽은 에셋 작업 영역이라 함부로 통일하지 않았습니다.
   ============================================================ */

registerDayPrepSetup("cut",taskId=>setupTimingCut(taskId));
registerDayPrepSetup("tteokbokkiCut",taskId=>setupTteokbokkiCut(taskId));

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

/* ---- 공통 화면 틀 (컨셉 이미지 3열 구성) --------------------
   [재료 카드] [도마] [완성 개수 · 완성 예시]
   멸치(E10)·단발 액션(E11)이 쓰는 것과 같은 틀입니다.
   공용 프레임(ui-mini-frame.js · css/minigame-frame.css)은 건드리지 않고
   #miniContent 안에서만 그립니다. 판정·조작 규칙은 위아래 그대로입니다.
   timing / rapidCut 두 방식이 가운데 도마 안쪽만 다르게 채웁니다.

   그림은 전부 임시 CSS 도형입니다. day-prep-minigames.js 의
   DAY_PREP_ASSET_PATHS 경로에 파일을 넣으면 .has-prep-asset 이 붙어
   도형이 꺼지고 <img> 가 대신 보입니다. */

const CUT_INGREDIENT_LABEL=Object.freeze({radish:"무",fishCake:"어묵",kimchi:"김치",chicken:"닭고기",greenOnion:"대파",tofu:"두부",cabbage:"양배추"});

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
function cutPiecesMarkup(ingredient,count){
  return Array.from({length:count},(_,index)=>{
    const column=index%3,row=Math.floor(index/3)%3;
    const shiftX=index*37%13-6,shiftY=index*23%11-5;
    return `<i class="cut-piece ${ingredient}" style="left:calc(${column*33}% + ${shiftX} * var(--upx));top:calc(${row*30}% + ${shiftY} * var(--upx));transform:rotate(${-18+index%5*9}deg)"></i>`;
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
  return `<div class="cut-timing">
      <div class="prep-timing-bar"><i class="prep-success-zone" style="left:${zoneLeft*100}%;width:${zoneWidth*100}%"></i></div>
      <i id="dayPrepMarker" class="prep-timing-marker" style="left:${marker*100}%"></i>
    </div>`;
}

/* ============================================================
   1. timing — 낮 준비 칼질 (Day1~3)
   ============================================================ */

registerDayPrepEngine("timing",{
  update(m,dt){
    const data=m.data;
    // 닭고기 2연타: 첫 입력 뒤 0.42초 안에 두 번째가 없으면 처음부터
    if(data.requiresDoubleTap&&data.tapStep===1){
      data.tapWindow-=dt;
      if(data.tapWindow<=0){
        data.tapStep=0;data.tapWindow=0;
        dom.miniContent.querySelector("#prepWorkObject")?.classList.remove("tough-first-hit");
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
      // 꾹 누르고 있는 것으로 2연타가 되면 안 됩니다
      if(e.repeat&&m.data.requiresDoubleTap)return true;
      timingCutAction();return true;
    }
    return false;
  }
});

function setupTimingCut(taskId){
  const config=DAY_PREP_MINI_CONFIG[taskId];
  if(Number(state.day)>=4&&RAPID_CUT_DATA[taskId]){setupRapidCutTask(taskId);return;}
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
  setDayPrepData({mode:"timing",marker:0,direction:1,successes:0,taskId:options.taskId,ingredient:options.ingredient,assetPrefix:options.assetPrefix||"",total:options.requiredHits,zoneWidth:width,speed,zoneStarts,onComplete:options.onComplete,requiresDoubleTap:!!options.requiresDoubleTap,tapStep:0,tapWindow:0,
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
  const board=`
      <div class="prep-work-object ${data.ingredient}-shape ${slashNow} ${data.horizontalLastCut?"tofu-cook-object":""} ${horizontalReady?"horizontal-cut":""} ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="prepWorkObject" style="--cut-x:${cutX}%" aria-label="${data.ingredient}">
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
      <div class="cut-pile" aria-label="썰어 놓은 ${cutIngredientLabel(data)}">${cutPiecesMarkup(data.ingredient,data.successes)}</div>
      ${cutTimingBarMarkup(zoneLeft,data.zoneWidth,data.marker)}`;
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
  if(m.data.mode==="rapidCut"){rapidCutKeyDown(false);return;}
  if(m.data.mode!=="timing")return;
  const data=m.data,zoneStart=data.zoneStarts[data.successes];
  if(data.requiresDoubleTap&&data.tapStep===1){
    data.tapStep=0;data.tapWindow=0;
    completeTimingCut(m);return;
  }
  if(!isInsideCutZone(data.marker,zoneStart,data.zoneWidth)){
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 현재 단계에서 다시 시도하세요.";
    audio.bad();
    return;
  }
  if(data.requiresDoubleTap){
    data.tapStep=1;data.tapWindow=.42;
    const work=dom.miniContent.querySelector("#prepWorkObject");
    work?.classList.add("tough-first-hit");
    dom.miniContent.querySelector("#toughCutHint")?.classList.add("first-done");
    const action=dom.miniContent.querySelector("#dayPrepAction");if(action)action.textContent="Space · 한 번 더!";
    dom.miniFeedback.textContent="칼이 걸렸어요 · 빠르게 Space 한 번 더!";audio.click();
    return;
  }
  completeTimingCut(m);
}

function completeTimingCut(m){
  const data=m.data;
  data.successes++;
  const work=dom.miniContent.querySelector("#prepWorkObject");
  work?.classList.remove("tough-first-hit");
  work?.classList.add("slice-hit");
  const nextAssetKey=timingAssetKey(data.ingredient,data.successes,data.assetPrefix);
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  dom.miniContent.querySelector(`.cut-line[data-cut-index="${data.successes-1}"]`)?.classList.add("done");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  // 방금 썬 조각을 오른쪽 더미에 바로 얹습니다. (다시 그릴 때 정식으로 다시 깔립니다)
  const pile=dom.miniContent.querySelector(".cut-pile");
  if(pile)pile.innerHTML=cutPiecesMarkup(data.ingredient,data.successes);
  updateCutCountCard(data.successes,data.total);
  dom.miniFeedback.textContent=data.requiresDoubleTap?"질긴 고기 절단 성공!":"절단 성공";audio.success();
  if(data.successes>=data.total){
    if(typeof data.onComplete==="function")data.onComplete();
    return;
  }
  setTimeout(()=>{if(state.mini===m&&!m.complete)renderTimingCut();},180);
}

/* ============================================================
   2. rapidCut — Day4 빠른 칼질
   ============================================================ */

registerDayPrepEngine("rapidCut",{
  update(m){
    const data=m.data,item=currentRapidCutIngredient(data);
    if(item?.cutType===RapidCutType.ToughMeat&&(data.phase==="holding"||data.phase==="embedded")){
      data.holdElapsed=performance.now()/1000-data.holdStart;
      const ratio=Math.min(1,data.holdElapsed/(item.requiredHoldTime||RAPID_CUT_INPUT.toughHoldTime));
      const meter=dom.miniContent.querySelector(".rapid-hold-meter i");if(meter)meter.style.width=`${ratio*100}%`;
      if(data.phase==="holding"&&data.holdElapsed>=RAPID_CUT_INPUT.toughHoldThreshold){data.phase="embedded";dom.miniContent.querySelector("#rapidCutStage")?.classList.add("knife-embedded");dom.miniFeedback.textContent="성공! Space에서 손을 떼세요.";}
    }
  },
  action(){timingCutAction();},
  key(m,k,e){
    if(e.code==="Space"){rapidCutKeyDown(e.repeat);return true;}
    return false;
  },
  keyup(m,k,e){
    if(e.code==="Space")rapidCutKeyUp();
  }
});

function setupRapidCutTask(taskId){
  const config=RAPID_CUT_DATA[taskId];if(!config)return;
  const onComplete=taskId==="cutRadish"||taskId==="cutFishCake"
    ?()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료")
    :()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`);
  setupRapidCutMinigame({taskId,title:`${PREP_TASKS[taskId].label} · 빠른 칼질`,sequence:[config],onComplete});
}

// 떡볶이 재료 칼질. 양배추 · 대파 · 어묵이 각각 별도의 준비 작업입니다.
// 재료별 횟수와 스프라이트는 day4-prep-data.js 의 DAY4_RAPID_CUT_SEQUENCE 에 있습니다.
function setupTteokbokkiCut(taskId){
  const item=DAY4_RAPID_CUT_SEQUENCE.find(entry=>entry.taskId===taskId);
  if(Number(state.day)!==4||!item)return;
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

function setupRapidCutMinigame(options){
  setDayPrepData({mode:"rapidCut",taskId:options.taskId,sequence:options.sequence.map(item=>({...item})),ingredientIndex:0,pieces:0,phase:"ready",holdStart:0,holdElapsed:0,lastInputAt:-Infinity,transitioning:false,onComplete:options.onComplete});
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent="Space 키다운 1회당 한 번 썹니다. 누르고 있어도 반복되지 않으며 실패나 시간제한은 없습니다.";
  renderRapidCut();
}

function currentRapidCutIngredient(data=state.mini?.data){return data?.sequence?.[data.ingredientIndex]||null;}

function renderRapidCut(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="rapidCut")return;
  const data=m.data,item=currentRapidCutIngredient(data);if(!item)return;
  const tough=item.cutType===RapidCutType.ToughMeat,progress=Math.round(data.pieces/item.requiredPieces*100);
  dom.miniTimer.textContent=tough?`닭고기 ${data.pieces} / ${item.requiredPieces}`:`${data.pieces} / ${item.requiredPieces}`;
  dom.miniDescription.textContent=tough
    ?"Space를 약 0.5초 누른 뒤 떼고, 다시 한 번 눌러 닭고기 한 조각을 자르세요."
    :"스페이스바를 연속으로 눌러 빠르게 손질하세요. 키를 누른 채 유지해도 반복 입력되지 않습니다.";
  // 재료 카드·완성 예시가 쓸 재료 정보. 빠른 칼질은 data 가 sequence 로 들고
  // 있어서 timing 과 모양이 달라, 카드에 넘겨줄 몫만 여기서 맞춰 줍니다.
  const view={ingredient:item.ingredientId,ingredientLabel:item.displayName,assetPrefix:item.assetPrefix||"",ingredientCount:1};
  const board=`
      <div class="rapid-cut-stage ${item.ingredientId} ${tough?"tough-meat":""} ${data.phase==="embedded"||data.phase==="awaitSecond"?"knife-embedded":""}" id="rapidCutStage">
        <div class="rapid-ingredient ${item.ingredientId}" style="--rapid-progress:${progress}%;width:${Math.max(80,180-progress)}px">${dayPrepAssetMarkup(`${item.assetPrefix||item.ingredientId}${data.pieces}`,"rapid-progress-asset",item.displayName)}</div>
        <i class="rapid-knife">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
        <div class="rapid-piece-pile ${item.ingredientId}" aria-label="손질된 ${item.displayName}">${Array.from({length:data.pieces},(_,index)=>`<i style="left:${(index%7)*17}px;bottom:${(index%3)*8}px;transform:rotate(${-18+(index%5)*9}deg)"></i>`).join("")}</div>
        ${tough?'<i class="tough-cut-line"></i>':""}
      </div>`;
  const footer=`<div class="rapid-hold-meter ${tough?"":"hidden"}"><i style="width:${Math.min(100,data.holdElapsed/(item.requiredHoldTime||RAPID_CUT_INPUT.toughHoldTime)*100)}%"></i></div>
      <button class="mini-action cut-action" id="rapidCutAction" type="button">${tough?(data.phase==="awaitSecond"?"Space · 한 번 더 눌러 절단":"Space · 0.5초 누르기"):"Space · 빠르게 썰기"}</button>
      ${data.sequence.length>1?`<span class="cut-step-note">재료 ${data.ingredientIndex+1} / ${data.sequence.length}</span>`:""}`;
  dom.miniContent.innerHTML=`
    ${data.tteokbokkiFlowIndex!=null?day4PrepFlowMarkup("tteokbokki",data.tteokbokkiFlowIndex):""}
    ${cutScreenMarkup(view,{board,done:data.pieces,total:item.requiredPieces,footer})}`;
  const button=dom.miniContent.querySelector("#rapidCutAction");
  if(tough){
    button.addEventListener("pointerdown",event=>{event.preventDefault();rapidCutKeyDown(false);});
    ["pointerup","pointercancel","pointerleave"].forEach(type=>button.addEventListener(type,rapidCutKeyUp));
  }else button.addEventListener("click",()=>rapidCutKeyDown(false));
}

function rapidCutKeyDown(repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="rapidCut"||m.data.transitioning||repeat)return false;
  const data=m.data,item=currentRapidCutIngredient(data),now=performance.now()/1000;
  if(!item||now-data.lastInputAt<RAPID_CUT_INPUT.minimumInterval)return false;
  data.lastInputAt=now;
  if(item.cutType!==RapidCutType.ToughMeat){completeRapidCutPiece(m);return true;}
  if(data.phase==="awaitSecond"){
    completeRapidCutPiece(m);return true;
  }
  if(data.phase!=="ready")return false;
  data.phase="holding";data.holdStart=now;data.holdElapsed=0;
  dom.miniFeedback.textContent="Space를 누르고 있습니다…";
  return true;
}

function rapidCutKeyUp(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="rapidCut")return false;
  const data=m.data,item=currentRapidCutIngredient(data);
  if(!item||item.cutType!==RapidCutType.ToughMeat||data.phase!=="holding"&&data.phase!=="embedded")return false;
  data.holdElapsed=Math.max(data.holdElapsed,performance.now()/1000-data.holdStart);
  if(data.holdElapsed>=RAPID_CUT_INPUT.toughHoldThreshold){
    data.phase="awaitSecond";dom.miniFeedback.textContent="칼이 박혔습니다. Space를 한 번 더 누르세요.";audio.click();
  }else{
    data.phase="ready";data.holdElapsed=0;dom.miniFeedback.textContent="조금 더 길게 눌러주세요. 바로 다시 시도할 수 있습니다.";
  }
  renderRapidCut();return true;
}

function completeRapidCutPiece(m){
  const data=m.data,item=currentRapidCutIngredient(data);if(!item)return;
  data.pieces++;data.phase="ready";data.holdElapsed=0;
  const stage=dom.miniContent.querySelector("#rapidCutStage");
  stage?.classList.remove("rapid-cut-hit");if(stage){void stage.offsetWidth;stage.classList.add("rapid-cut-hit");}
  audio.click();dom.miniFeedback.textContent=`${item.displayName} 손질 ${data.pieces} / ${item.requiredPieces}`;
  updateCutCountCard(data.pieces,item.requiredPieces);
  if(data.pieces<item.requiredPieces){setTimeout(()=>{if(state.mini===m&&!m.complete)renderRapidCut();},105);return;}
  if(data.ingredientIndex<data.sequence.length-1){
    data.transitioning=true;dom.miniTimer.textContent="교체";dom.miniFeedback.textContent=`${item.displayName} 완료 · 다음 재료로 전환합니다.`;audio.success();
    setTimeout(()=>{if(state.mini!==m||m.complete)return;data.ingredientIndex++;data.pieces=0;data.transitioning=false;data.lastInputAt=-Infinity;renderRapidCut();},420);
    return;
  }
  if(typeof data.onComplete==="function")data.onComplete();
}

/* ============================================================
   3. chop — 밤 조리 칼질

   · 두부 썰기 : 위 timing 과 같은 초록 구간 방식. 세로 5 + 가로 1 = 6회.
     ♻️ 지금은 호출되는 곳이 없습니다. 조건이 mode==="cook" && dishId==="tofu"
        인데 두부김치의 조리 단계가 plateKimchi 라서 만족되지 않습니다.
        3단계에서 game-data.js 의 cook 배열에 단계를 추가해 되살립니다.
   · 정밀 손질 : 노란 중심(50%)에 가까울수록 고득점. 초록 구간 방식이 아닙니다.
     스토리 PR-02 튜토리얼에서만 불립니다. (story.js)
   ============================================================ */

registerMiniEngine("chop",{
  setup(m,{set}){
    const isTofu=m.context.mode==="cook"&&m.context.dishId==="tofu";
    set(
      isTofu?"두부 썰기":"정밀 손질",
      isTofu
        ?"무와 김치를 썰 때처럼 포인터가 초록 구간에 들어왔을 때 누르세요. 세로 5번, 마지막에 가로 1번 썹니다."
        :"움직이는 칼 표시가 노란 중심에 들어왔을 때 SPACE 또는 썰기 버튼을 누르세요.",
      10
    );
    m.data=isTofu
      ?{marker:0,dir:1,speed:.78,hits:[],cuts:0,total:6,tofuStyle:true,zoneWidth:.14,zoneStarts:[.18,.56,.3,.67,.42,.22]}
      :{marker:0,dir:1,speed:.92,hits:[],cuts:0};
    if(isTofu)dom.miniTimer.textContent="0 / 6";
    dom.miniContent.innerHTML=isTofu
      ?`<div class="prep-work-object tofu-shape tofu-cook-object" id="tofuCookObject" aria-label="두부">${Array.from({length:5},(_,index)=>`<i class="cut-line" data-tofu-cut="${index}" style="left:${(index+1)/6*100}%"></i>`).join("")}<i class="cut-line tofu-horizontal-line" data-tofu-cut="5"></i><i class="knife-effect"></i></div><div class="prep-timing-bar"><i class="prep-success-zone" id="tofuSuccessZone" style="left:${m.data.zoneStarts[0]*100}%;width:${m.data.zoneWidth*100}%"></i><i id="miniMarker" class="prep-timing-marker"></i></div><div class="cut-count">세로 썰기 · 0 / 6</div><button class="mini-action" id="miniAction" type="button">두부 썰기</button>`
      :`<div class="progress-track"><i class="progress-zone" style="left:38%;width:24%"></i><i class="progress-perfect" style="left:47%;width:6%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">0 / 5회</div><button class="mini-action" id="miniAction" type="button">썰기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
  },

  // 두부 썰기는 타이머 자리에 "3 / 6" 처럼 횟수를 쓰므로 시간이 흐르지 않습니다.
  timerRuns(m){
    return !m.data.tofuStyle;
  },

  update(m,dt){
    advanceBounceMarker(m,dt);
  },

  action(m){
    if(m.data.tofuStyle){tofuChopAction(m);return;}
    const score=markerScore(m,.5);
    m.data.hits.push(score);m.data.cuts++;audio.click();
    dom.miniContent.querySelector(".cut-count").textContent=`${m.data.cuts} / 5회`;
    m.data.marker=0;m.data.dir=1;m.data.speed+=.08;
    if(m.data.cuts>=5)finishMini(Math.round(m.data.hits.reduce((a,b)=>a+b,0)/m.data.hits.length));
  }
});

function tofuChopAction(m){
  const data=m.data,zoneStart=data.zoneStarts[data.cuts];
  if(!isInsideCutZone(data.marker,zoneStart,data.zoneWidth)){
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 초록 구간에서 다시 썰어주세요.";audio.bad();return;
  }
  data.hits.push(cutZoneScore(data.marker,zoneStart,data.zoneWidth));
  const tofuObject=dom.miniContent.querySelector("#tofuCookObject");
  tofuObject?.querySelector(`[data-tofu-cut="${data.cuts}"]`)?.classList.add("done");
  tofuObject?.classList.remove("slice-hit");if(tofuObject){void tofuObject.offsetWidth;tofuObject.classList.add("slice-hit");}
  data.cuts++;audio.click();
  dom.miniTimer.textContent=`${data.cuts} / ${data.total}`;
  dom.miniContent.querySelector(".cut-count").textContent=data.cuts<5?`세로 썰기 · ${data.cuts} / ${data.total}`:data.cuts===5?`다음은 가로 썰기 · ${data.cuts} / ${data.total}`:`완료 · ${data.cuts} / ${data.total}`;
  if(data.cuts>=data.total){finishMini(Math.round(data.hits.reduce((sum,score)=>sum+score,0)/data.hits.length));return;}
  if(data.cuts===5)tofuObject?.classList.add("horizontal-cut");
  const successZone=dom.miniContent.querySelector("#tofuSuccessZone");
  if(successZone)successZone.style.left=`${data.zoneStarts[data.cuts]*100}%`;
  data.marker=0;data.dir=1;data.speed+=.05;dom.miniFeedback.textContent="절단 성공";
}
