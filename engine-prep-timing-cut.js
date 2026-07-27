"use strict";

/* ============================================================
   E1 타이밍 칼질 (낮 준비)

   같은 "칼질"인데 Day 에 따라 방식이 두 가지입니다.

   · timing   (Day1~3) 왕복하는 포인터가 초록 구간에 있을 때 Space.
              닭고기만 초록 구간에서 Space 를 빠르게 2번(requiresDoubleTap).
   · rapidCut (Day4~)  구간을 맞출 필요 없이 Space 연타. 실패·시간제한 없음.
              닭고기는 0.5초 꾹 눌렀다 떼고 한 번 더(ToughMeat).
              어느 쪽으로 갈지는 setupDayPrepTiming 이 Day 로 판단합니다.

   쓰는 곳: 무·어묵·김치(두부용/전용)·닭·대파 썰기 + 떡볶이 3재료 연속 칼질

   ⚠️ 밤 조리의 두부 썰기(engine-timing-cut.js)도 같은 E1 입니다.
   2단계에서 이 파일과 합칠지 결정하세요. 지금은 두 벌 그대로입니다.
   ============================================================ */

registerDayPrepSetup("cut",taskId=>setupDayPrepTiming(taskId));
registerDayPrepSetup("rapidCutSequence",()=>setupTteokbokkiRapidCut());

/* ---- timing : 초록 구간 맞춰 썰기 -------------------------- */
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
    data.marker+=data.direction*data.speed*dt;
    if(data.marker>=1){data.marker=1;data.direction=-1;}
    if(data.marker<=0){data.marker=0;data.direction=1;}
    const marker=dom.miniContent.querySelector("#dayPrepMarker");
    if(marker)marker.style.left=`${data.marker*100}%`;
  },
  action(){dayPrepPrimaryAction();},
  key(m,k,e){
    if(e.code==="Space"){
      // 꾹 누르고 있는 것으로 2연타가 되면 안 됩니다
      if(e.repeat&&m.data.requiresDoubleTap)return true;
      dayPrepPrimaryAction();return true;
    }
    return false;
  }
});

/* ---- rapidCut : Space 연타로 썰기 -------------------------- */
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
  action(){dayPrepPrimaryAction();},
  key(m,k,e){
    if(e.code==="Space"){rapidCutKeyDown(e.repeat);return true;}
    return false;
  },
  keyup(m,k,e){
    if(e.code==="Space")rapidCutKeyUp();
  }
});

/* ---- 시작 ------------------------------------------------- */

function setupDayPrepTiming(taskId){
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
    title:config.title,
    onComplete:taskId==="cutRadish"||taskId==="cutFishCake"
      ?()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료")
      :()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`),
    description:config.requiresDoubleTap
      ?"포인터가 초록 구간에 들어왔을 때 Space를 빠르게 두 번 눌러 질긴 고기를 써세요."
      :taskId==="cutRadish"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 누르세요. 총 4번 썹니다."
      :taskId==="cutFishCake"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 눌러 어묵을 5조각으로 써세요."
      :`포인터가 초록 구간에 들어왔을 때 Space를 누르세요. ${PREP_TASKS[taskId].label} 작업입니다.`
  });
}

// 두부 썰기 등 후속 조리는 같은 함수에 설정만 전달해 연결할 수 있습니다.
function startCuttingMinigame(options){
  const width={wide:.24,normal:.18,narrow:.14}[options.hitZoneWidth]??options.hitZoneWidth??.18;
  const speed={slow:.55,normal:.7,fast:.9}[options.speed]??options.speed??.7;
  const defaults=[.18,.56,.32,.66,.42];
  const zoneStarts=options.zoneStarts?.length?[...options.zoneStarts]:Array.from({length:options.requiredHits},(_,index)=>defaults[index%defaults.length]);
  setDayPrepData({mode:"timing",marker:0,direction:1,successes:0,taskId:options.taskId,ingredient:options.ingredient,assetPrefix:options.assetPrefix||"",total:options.requiredHits,zoneWidth:width,speed,zoneStarts,onComplete:options.onComplete,requiresDoubleTap:!!options.requiresDoubleTap,tapStep:0,tapWindow:0,showTteokbokkiFlow:!!options.showTteokbokkiFlow});
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent=options.description;
  renderDayPrepTiming();
}

function renderDayPrepTiming(){
  const m=state.mini,data=m.data,isRadish=data.ingredient==="radish";
  const zoneLeft=data.zoneStarts[data.successes];
  const objectAssetKey=timingAssetKey(data.ingredient,data.successes,data.assetPrefix);
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  dom.miniContent.innerHTML=`
    ${data.showTteokbokkiFlow?day4PrepFlowMarkup("tteokbokki",1):""}
    <div class="prep-work-object ${data.ingredient}-shape ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="prepWorkObject" aria-label="${data.ingredient}">
      ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",isRadish?"손질 단계별 무":"손질 단계별 재료")}
      ${Array.from({length:data.total},(_,index)=>`<i class="cut-line ${data.ingredient==="fishCake"?`fishcake-diagonal ${index%2?"slash-back":"slash-forward"}`:""} ${index<data.successes?"done":""}" style="left:${(index+1)/(data.total+1)*100}%"></i>`).join("")}
      <i class="knife-effect ${hasDayPrepAsset("knife")?"has-prep-asset":""}">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
    </div>
    <div class="prep-timing-bar">
      <i class="prep-success-zone" style="left:${zoneLeft*100}%;width:${data.zoneWidth*100}%"></i>
      <i id="dayPrepMarker" class="prep-timing-marker" style="left:${data.marker*100}%"></i>
    </div>
    ${data.requiresDoubleTap?'<div class="tough-cut-hint" id="toughCutHint"><span>SPACE 1</span><span>SPACE 2</span></div>':""}
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <button class="mini-action" id="dayPrepAction" type="button">Space · ${data.requiresDoubleTap?"빠르게 2번":"썰기"}</button>`;
  dom.miniContent.querySelector("#dayPrepAction").addEventListener("click",dayPrepPrimaryAction);
}

function setupRapidCutTask(taskId){
  const config=RAPID_CUT_DATA[taskId];if(!config)return;
  const onComplete=taskId==="cutRadish"||taskId==="cutFishCake"
    ?()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료")
    :()=>finishDayPrepTask(taskId,`${PREP_TASKS[taskId].label} 완료`);
  setupRapidCutMinigame({taskId,title:`${PREP_TASKS[taskId].label} · 빠른 칼질`,sequence:[config],onComplete});
}

// 떡볶이는 양배추 → 대파 → 어묵을 한 화면에서 이어서 썹니다.
// ⚠️ 표에서는 이 3개를 별도 태스크로 쪼개기로 되어 있습니다(3단계).
function setupTteokbokkiRapidCut(){
  if(Number(state.day)!==4)return;
  const sequence=DAY4_RAPID_CUT_SEQUENCE;
  const startIngredient=index=>{
    const item=sequence[index];
    startCuttingMinigame({
      taskId:"cutTteokbokkiIngredients",
      ingredient:item.ingredientId,
      assetPrefix:item.assetPrefix,
      requiredHits:item.requiredPieces,
      hitZoneWidth:.14,
      speed:.8,
      zoneStarts:Array.from({length:item.requiredPieces},(_,hitIndex)=>[.2,.58,.32,.68,.43,.14,.52,.27][hitIndex%8]),
      title:`떡볶이 · ${item.displayName} 썰기 (${index+1}/${sequence.length})`,
      description:`포인터가 초록 구간에 들어왔을 때 Space를 눌러 ${item.displayName}를 써세요.`,
      showTteokbokkiFlow:true,
      onComplete:()=>{
        if(index>=sequence.length-1){
          finishDayPrepTask("cutTteokbokkiIngredients","떡볶이 양배추 · 대파 · 어묵 손질 완료");
          return;
        }
        dom.miniFeedback.textContent=`${item.displayName} 손질 완료 · 다음 재료로 넘어갑니다.`;
        audio.success();
        const mini=state.mini;
        setTimeout(()=>{if(state.mini===mini&&!mini.complete)startIngredient(index+1);},420);
      }
    });
  };
  startIngredient(0);
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
  dom.miniContent.innerHTML=`
    ${data.taskId==="cutTteokbokkiIngredients"?day4PrepFlowMarkup("tteokbokki",1):""}
    <div class="rapid-cut-stage ${item.ingredientId} ${tough?"tough-meat":""} ${data.phase==="embedded"||data.phase==="awaitSecond"?"knife-embedded":""}" id="rapidCutStage">
      <div class="rapid-ingredient ${item.ingredientId}" style="--rapid-progress:${progress}%;width:${Math.max(80,180-progress)}px">${dayPrepAssetMarkup(`${item.assetPrefix||item.ingredientId}${data.pieces}`,"rapid-progress-asset",item.displayName)}</div>
      <i class="rapid-knife">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
      <div class="rapid-piece-pile ${item.ingredientId}" aria-label="손질된 ${item.displayName}">${Array.from({length:data.pieces},(_,index)=>`<i style="left:${(index%7)*17}px;bottom:${(index%3)*8}px;transform:rotate(${-18+(index%5)*9}deg)"></i>`).join("")}</div>
      ${tough?'<i class="tough-cut-line"></i>':""}
    </div>
    <div class="rapid-hold-meter ${tough?"":"hidden"}"><i style="width:${Math.min(100,data.holdElapsed/(item.requiredHoldTime||RAPID_CUT_INPUT.toughHoldTime)*100)}%"></i></div>
    <div class="cut-count">${item.displayName} ${data.pieces} / ${item.requiredPieces}${data.sequence.length>1?` · 재료 ${data.ingredientIndex+1}/${data.sequence.length}`:""}</div>
    <button class="mini-action" id="rapidCutAction" type="button">${tough?(data.phase==="awaitSecond"?"Space · 한 번 더 눌러 절단":"Space · 0.5초 누르기"):"Space · 빠르게 썰기"}</button>`;
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
  if(data.pieces<item.requiredPieces){setTimeout(()=>{if(state.mini===m&&!m.complete)renderRapidCut();},105);return;}
  if(data.ingredientIndex<data.sequence.length-1){
    data.transitioning=true;dom.miniTimer.textContent="교체";dom.miniFeedback.textContent=`${item.displayName} 완료 · 다음 재료로 전환합니다.`;audio.success();
    setTimeout(()=>{if(state.mini!==m||m.complete)return;data.ingredientIndex++;data.pieces=0;data.transitioning=false;data.lastInputAt=-Infinity;renderRapidCut();},420);
    return;
  }
  if(typeof data.onComplete==="function")data.onComplete();
}

// Space / ACTION 버튼 / 화면 안 썰기 버튼이 모두 여기로 들어옵니다.
function dayPrepPrimaryAction(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  if(m.data.mode==="rapidCut"){rapidCutKeyDown(false);return;}
  if(m.data.mode!=="timing")return;
  const data=m.data,zoneStart=data.zoneStarts[data.successes],zoneEnd=zoneStart+data.zoneWidth;
  if(data.requiresDoubleTap&&data.tapStep===1){
    data.tapStep=0;data.tapWindow=0;
    completeDayPrepCut(m);return;
  }
  if(data.marker<zoneStart||data.marker>zoneEnd){
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
  completeDayPrepCut(m);
}

function completeDayPrepCut(m){
  const data=m.data;
  data.successes++;
  const work=dom.miniContent.querySelector("#prepWorkObject");
  work?.classList.remove("tough-first-hit");
  work?.classList.add("slice-hit");
  const nextAssetKey=timingAssetKey(data.ingredient,data.successes,data.assetPrefix);
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  dom.miniContent.querySelector(`.cut-line:nth-child(${data.successes})`)?.classList.add("done");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const progress=dom.miniContent.querySelector(".cut-count");
  if(progress)progress.textContent=`진행 ${data.successes} / ${data.total}`;
  dom.miniFeedback.textContent=data.requiresDoubleTap?"질긴 고기 절단 성공!":"절단 성공";audio.success();
  if(data.successes>=data.total){
    if(typeof data.onComplete==="function")data.onComplete();
    return;
  }
  setTimeout(()=>{if(state.mini===m&&!m.complete)renderDayPrepTiming();},180);
}
