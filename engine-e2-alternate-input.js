"use strict";

/* ============================================================
   E2 번갈아 입력 — 게임 5개

     양배추 채썰기 · 당근 채썰기   ← → 를 번갈아
     감자 채썰기                   ↑ ↓ 를 번갈아
     감자 전분 털기                무작위 알파벳 두 개를 번갈아
     새우 튀김옷                   무작위 알파벳 두 개를 번갈아

   두 입력을 교대로 눌러 횟수를 채웁니다. 같은 입력을 두 번 하거나
   차례가 아닌 입력은 무시되고, 실패로 되돌아가지는 않습니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례인가 / 다음 차례로 넘긴다" 판정은 아래 도우미 두 개로 합쳤습니다.
     방향형(expected 에 방향 문자열)과 키형(keys 배열 + expectedIndex) 두 가지
     데이터 모양을 모두 다룹니다.
   · 화면 마크업은 게임별로 그대로 두었습니다. 채칼·바구니·튀김옷 작업대가
     서로 완전히 다른 그림이고, 이쪽은 에셋 작업 영역입니다.

   [새우 튀김옷]
   밀가루 · 계란물 · 빵가루가 각각 별도의 준비 작업입니다.
   한 단계를 끝내면 화면이 닫히고, 다음 재료대로 걸어가 다시 시작합니다.
   단계 정보는 day4-prep-data.js 의 SHRIMP_COAT_STEPS 에 있습니다.
   ============================================================ */

registerDayPrepSetup("mandoline",taskId=>setupMandoline(taskId));
registerDayPrepSetup("potatoMandoline",()=>setupPotatoMandoline());
registerDayPrepSetup("potatoStarch",()=>setupPotatoStarchShake());
registerDayPrepSetup("shrimpCoat",taskId=>setupShrimpCoat(taskId));

/* ---- 공통 판정 규칙 ----------------------------------------
   데이터 모양이 두 가지입니다.
     방향형 : data.expected("left") + data.directions(["left","right"])
     키형   : data.keys(["a","d"])  + data.expectedIndex(0 또는 1)
   두 모양 다 아래 두 함수로 판정하고 넘깁니다. */

// 지금 눌러야 할 차례의 입력인가
function isAlternateTurn(data,input){
  if(data.keys)return String(input).toLowerCase()===data.keys[data.expectedIndex];
  return input===data.expected;
}

// 다음 차례를 반대쪽으로 넘깁니다
function advanceAlternateTurn(data,input){
  if(data.keys){data.expectedIndex=data.expectedIndex===0?1:0;return;}
  data.expected=data.directions.find(item=>item!==input)||data.directions[0];
}

/* ============================================================
   1. 채칼 — 방향키를 번갈아
   ============================================================ */

registerDayPrepEngine("day3Mandoline",{
  key(m,k){
    if(k==="arrowleft"||k==="arrowright"){mandolineInput(k.replace("arrow",""));return true;}
    return false;
  }
});

registerDayPrepEngine("day4Mandoline",{
  key(m,k){
    if(k==="arrowup"||k==="arrowdown"){mandolineInput(k.replace("arrow",""));return true;}
    return false;
  }
});

function setupMandoline(taskId){
  const config=DAY3_MANDOLINE_CONFIG[taskId];
  if(Number(state.day)!==3||!config)return;
  setDayPrepData({mode:"day3Mandoline",taskId,ingredient:config.ingredient,label:config.label,cycles:config.cycles,directions:["left","right"],successInputs:0,totalInputs:config.cycles*2,expected:"left"});
  dom.miniTitle.textContent=`볶음우동 · ${config.label} 채썰기`;
  dom.miniDescription.textContent=`←와 →를 번갈아 입력해 ${config.label}를 채칼에 왕복 ${config.cycles}회 움직이세요.`;
  renderMandoline();
}

function setupPotatoMandoline(){
  const config=DAY4_PREP_CONFIG.potatoMandoline;if(Number(state.day)!==4||!state.mini)return;
  setDayPrepData({mode:"day4Mandoline",taskId:config.taskId,ingredient:config.ingredient,label:config.label,directions:[...config.directions],successInputs:0,totalInputs:config.totalInputs,expected:config.directions[0]});
  dom.miniTitle.textContent="감자튀김 · 감자 채칼";
  dom.miniDescription.textContent="↑와 ↓를 번갈아 입력해 감자를 써세요. 같은 방향 연속 입력과 다른 키는 무시됩니다.";
  renderMandoline();
}

function renderMandoline(){
  const data=state.mini.data,isPotato=data.mode==="day4Mandoline",completedCycles=Math.floor(data.successInputs/2);
  dom.miniTimer.textContent=isPotato?`${data.successInputs} / ${data.totalInputs}`:`왕복 ${completedCycles} / ${data.cycles}`;
  const arrows={left:"←",right:"→",up:"↑",down:"↓"},shorten=Math.max(.34,1-data.successInputs/data.totalInputs*.62);
  dom.miniContent.innerHTML=`
    ${isPotato?day4PrepFlowMarkup("fries",0):""}
    <div class="mandoline-scene ${data.ingredient}" id="mandolineScene">
      <div class="mandoline-board"><i class="mandoline-blade"></i></div>
      <div class="mandoline-ingredient ${data.ingredient}" id="mandolineIngredient" style="--ingredient-shorten:${shorten}">${isPotato?dayPrepAssetMarkup(`potatoMandoline${data.successInputs}`,"mandoline-potato-asset",`감자 손질 ${data.successInputs}단계`):"<i></i>"}</div>
      <div class="shredded-pile ${data.ingredient}" aria-label="채 썬 ${data.label}">${Array.from({length:data.successInputs},(_,index)=>`<i style="--shred-x:${14+(index%7)*11}%;--shred-y:${(index%3)*7}px;--shred-turn:${-18+(index%5)*9}deg"></i>`).join("")}</div>
    </div>
    <div class="mandoline-key-guide">${data.directions.map((direction,index)=>`${index?"<span>번갈아</span>":""}<button type="button" data-mandoline-direction="${direction}" class="${data.expected===direction?"expected":""}">${arrows[direction]}</button>`).join("")}</div>
    <div class="cut-count" id="mandolineProgress">${data.label} · ${isPotato?`${data.successInputs} / ${data.totalInputs}`:`왕복 ${completedCycles} / ${data.cycles}`}</div>`;
  dom.miniContent.querySelectorAll("[data-mandoline-direction]").forEach(button=>button.addEventListener("click",()=>mandolineInput(button.dataset.mandolineDirection)));
}

function mandolineInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||!["day3Mandoline","day4Mandoline"].includes(m.data.mode))return false;
  const data=m.data;
  if(!isAlternateTurn(data,direction))return false;
  data.successInputs++;advanceAlternateTurn(data,direction);audio.click();
  const ingredient=dom.miniContent.querySelector("#mandolineIngredient");
  ingredient?.classList.remove("move-left","move-right","move-up","move-down");if(ingredient){void ingredient.offsetWidth;ingredient.classList.add(`move-${direction}`);}
  if(data.successInputs>=data.totalInputs){
    if(data.mode==="day4Mandoline"){
      finishDayPrepTask("sliceFriesPotato","감자 채칼 손질 10회 완료");
    }else if(data.taskId==="sliceYakisobaCabbage"){
      // 양배추가 끝나면 같은 화면에서 당근으로 이어집니다.
      completeDayPrepTask("sliceYakisobaCabbage");
      dom.miniTimer.textContent="완료";dom.miniFeedback.textContent="양배추 채썰기 완료 · 당근으로 전환합니다.";
      dom.miniContent.classList.add("prep-complete-flash");
      setTimeout(()=>{if(state.mini===m&&!m.complete){dom.miniContent.classList.remove("prep-complete-flash");setupMandoline("sliceYakisobaCarrot");}},420);
    }else finishDayPrepTask("sliceYakisobaCarrot","볶음우동 채소 손질 완료");
    return true;
  }
  setTimeout(()=>{if(state.mini===m&&!m.complete&&m.data===data)renderMandoline();},110);
  return true;
}

/* ============================================================
   2. 감자 전분 털기 — 알파벳 두 개를 번갈아
   ============================================================ */

registerDayPrepEngine("potatoStarch",{
  key(m,k,e){
    if(/^[a-z]$/.test(k)){potatoStarchInput(k,e.repeat);return true;}
    return false;
  }
});

function setupPotatoStarchShake(){
  const config=DAY4_PREP_CONFIG.potatoStarch;if(Number(state.day)!==4||!state.mini)return;
  const pair=BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)];
  setDayPrepData({mode:"potatoStarch",taskId:config.taskId,keys:[...pair],expectedIndex:0,presses:0,total:config.requiredPresses});
  dom.miniTitle.textContent="감자튀김 · 전분 털기";
  dom.miniDescription.textContent="화면에 표시된 두 랜덤 키를 번갈아 눌러 감자의 전분을 털어주세요!";
  renderPotatoStarchShake();
}

function potatoStarchInput(key,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="potatoStarch"||repeat)return false;
  const data=m.data;
  if(!isAlternateTurn(data,key)){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.presses++;advanceAlternateTurn(data,key);audio.click();
  const basket=dom.miniContent.querySelector("#potatoStarchBasket");basket?.classList.remove("basket-shake");if(basket){void basket.offsetWidth;basket.classList.add("basket-shake");}
  if(data.presses>=data.total){finishDayPrepTask(data.taskId,"감자 전분 털기 완료");return true;}
  setTimeout(()=>{if(state.mini===m&&!m.complete)renderPotatoStarchShake();},105);return true;
}

function renderPotatoStarchShake(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="potatoStarch")return;
  const data=m.data,progress=Math.round(data.presses/data.total*100),stage=DAY4_PREP_CONFIG.potatoStarch.stages.reduce((active,threshold)=>progress>=threshold?threshold:active,0);
  dom.miniTimer.textContent=`${data.presses} / ${data.total}`;
  dom.miniContent.innerHTML=`
    ${day4PrepFlowMarkup("fries",1)}
    <div class="breadcrumb-key-pair potato-key-pair">${data.keys.map((key,index)=>`<button type="button" data-potato-starch-key="${key}" class="${index===data.expectedIndex?"expected":""}">${key.toUpperCase()}</button>`).join("<span>↔</span>")}</div>
    <div class="potato-starch-scene stage-${stage}" id="potatoStarchBasket">
      <div class="potato-basket"><i></i>${dayPrepAssetMarkup(`potatoStarch${stage}`,"potato-starch-asset",`전분 털기 ${stage}%`)}${Array.from({length:9},()=>"<b></b>").join("")}</div>
      <div class="starch-cloud">${Array.from({length:Math.max(0,12-Math.floor(progress/8))},()=>"<i></i>").join("")}</div>
    </div>
    <div class="breadcrumb-progress"><i style="width:${progress}%"></i></div>
    <div class="cut-count">전분 털기 ${progress}% · ${data.presses} / ${data.total}</div>`;
  dom.miniContent.querySelectorAll("[data-potato-starch-key]").forEach(button=>button.addEventListener("click",()=>potatoStarchInput(button.dataset.potatoStarchKey,false)));
}

/* ============================================================
   3. 새우 튀김옷 — 밀가루 → 계란물 → 빵가루, 각 12회
   ============================================================ */

registerDayPrepEngine("shrimpCoat",{
  key(m,k){
    if(/^[a-z]$/.test(k)){shrimpCoatInput(k);return true;}
    return false;
  }
});

function setupShrimpCoat(taskId){
  const item=SHRIMP_COAT_STEPS.find(entry=>entry.taskId===taskId);
  if(Number(state.day)!==3||!item)return;
  const pair=BREADCRUMB_KEY_PAIRS[Math.floor(Math.random()*BREADCRUMB_KEY_PAIRS.length)];
  setDayPrepData({mode:"shrimpCoat",taskId,step:item.step,sequence:SHRIMP_COAT_STEPS,keys:[...pair],expectedIndex:0,successes:0,total:item.presses});
  dom.miniTitle.textContent=`새우튀김 · ${item.label} 입히기`;
  dom.miniDescription.textContent=`표시된 두 키를 번갈아 눌러 ${item.label}를 입히세요. 끝나면 다음 재료대로 이동합니다.`;
  renderShrimpCoat();
}

function renderShrimpCoat(){
  const data=state.mini.data,current=data.sequence[data.step],progress=Math.round(data.successes/data.total*100),stage=progress>=100?3:progress>=70?2:progress>=35?1:0;
  dom.miniTimer.textContent=`${progress}%`;
  dom.miniContent.innerHTML=`
    <div class="shrimp-coat-order">${data.sequence.map((item,index)=>`<span class="${index<data.step?"done":index===data.step?"current":""}">${index<data.step?"✓ ":""}${item.label}</span>`).join("<b>→</b>")}</div>
    <div class="shrimp-coat-screen">
      <div class="shrimp-coat-workbench">
        ${data.sequence.map((item,index)=>{
          const status=index<data.step?"done":index===data.step?"current":"pending",visible=index<=data.step;
          const itemStage=index<data.step?3:index===data.step?stage:0;
          const crumbs=item.id==="breadcrumbs"&&visible?Array.from({length:index<data.step?14:Math.ceil(progress/7)},(_,crumbIndex)=>`<b style="--crumb-x:${23+(crumbIndex%7)*15}px;--crumb-y:${14+(crumbIndex%4)*11}px;--crumb-turn:${crumbIndex*19}deg"></b>`).join(""):"";
          return `<div class="shrimp-coat-station ${item.id} ${status}">
            <strong>${index+1}. ${item.label}</strong>
            <div class="coat-bowl ${item.id}">${visible?`<div class="breadcrumb-shrimp coating-${item.id} stage-${itemStage}"><i></i>${crumbs}</div>`:"<span>다음 단계</span>"}</div>
            <small>${index<data.step?"완료 ✓":index===data.step?`${progress}% 진행 중`:"대기"}</small>
          </div>${index<data.sequence.length-1?'<i class="coat-flow-arrow">→</i>':""}`;
        }).join("")}
      </div>
      <aside class="shrimp-coat-controls">
        <strong>${current.label} 조작</strong>
        <div class="breadcrumb-key-pair">${data.keys.map((key,index)=>`<button type="button" data-breadcrumb-key="${key}" class="${index===data.expectedIndex?"expected":""}">${key.toUpperCase()}</button>`).join("<span>↔</span>")}</div>
        <small>두 키를 번갈아 빠르게 누르세요</small>
        <div class="breadcrumb-progress"><i style="width:${progress}%"></i></div>
        <b>${data.successes} / ${data.total}</b>
      </aside>
    </div>
    <div class="cut-count">현재 단계 · ${current.label} 입히기 ${progress}%</div>`;
  dom.miniContent.querySelectorAll("[data-breadcrumb-key]").forEach(button=>button.addEventListener("click",()=>shrimpCoatInput(button.dataset.breadcrumbKey)));
}

function shrimpCoatInput(key){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="shrimpCoat")return false;
  const data=m.data;
  if(!isAlternateTurn(data,key)){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.successes++;advanceAlternateTurn(data,key);audio.click();
  if(data.successes>=data.total){
    const completed=data.sequence[data.step];
    finishDayPrepTask(data.taskId,`새우튀김 ${completed.label} 입히기 완료`);return true;
  }
  dom.miniFeedback.textContent="좋아요! 반대쪽 키를 누르세요.";renderShrimpCoat();return true;
}
