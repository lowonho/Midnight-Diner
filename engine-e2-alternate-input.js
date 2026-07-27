"use strict";

/* ============================================================
   E2 번갈아 입력 — 게임 5개

     양배추 채썰기 · 당근 채썰기   ← → 를 번갈아
     감자 채썰기                   ↑ ↓ 를 번갈아
     감자튀김 준비 (봉투 흔들기)   무작위 알파벳 두 개를 번갈아
     새우튀김 준비 (튀김옷)        무작위 알파벳 두 개를 번갈아

   두 입력을 교대로 눌러 횟수를 채웁니다. 같은 입력을 두 번 하거나
   차례가 아닌 입력은 무시되고, 실패로 되돌아가지는 않습니다.

   [합쳐진 것 / 안 합쳐진 것]
   · "지금 차례인가 / 다음 차례로 넘긴다" 판정은 아래 도우미 두 개로 합쳤습니다.
     방향형(expected 에 방향 문자열)과 키형(keys 배열 + expectedIndex) 두 가지
     데이터 모양을 모두 다룹니다.
   · 감자튀김 준비 · 새우튀김 준비는 화면 틀(재료 / 플레이 / 진행도·조작 3열)이
     같아서 fryPrepScreenMarkup 하나로 합쳤습니다. 가운데 플레이 그림만
     게임별로 따로 그립니다 — 봉투 흔들기와 튀김옷 묻히기는 그림이 완전히 다릅니다.
   · 채칼은 화면 구성이 달라 합치지 않았습니다.

   [새우튀김 준비]
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
   튀김 준비 공용 화면 — 감자튀김 준비 · 새우튀김 준비

   컨셉 이미지와 같은 3열 구성입니다.
     [재료 카드]  [플레이 영역]  [진행도 카드 · 조작 카드]

   두 게임은 이 틀과 조작(랜덤키 두 개 연타)이 같고, 가운데 그림만 다릅니다.
   그래서 틀은 여기서 한 번만 그리고, 가운데는 각 게임이 문자열로 넘깁니다.

   [공용 프레임과의 관계]  멸치·닭꼬치·김치 볶기와 같습니다.
   ui-mini-frame.js 와 css/minigame-frame.css 는 건드리지 않습니다.
   css/day-prep-minigames.css 에서 .fp-scene 이 떠 있을 때만
     · .mini-content 의 가운데 열 제한(922px)을 풀어 좌우 칸 자리를 만들고
     · 오른쪽 진행도 카드와 겹치는 공용 타이머 카드(#miniTimer)를 숨기고
     · 타이틀 패널 윗줄(#miniStation)을 타이틀 아래 부제 자리로 내립니다.
   전부 이 화면 한정이라 다른 미니게임은 그대로입니다.
   ============================================================ */

// 재료 카드 한 장. 그림은 에셋이 들어오기 전까지 CSS 임시 도형입니다.
function fryPrepIngredientMarkup(item){
  const asset=item.asset?dayPrepAssetMarkup(item.asset,"fp-ing-asset",item.label):"";
  return `<div class="fp-ing-card ${item.id} ${item.active?"active":""}">
    <div class="fp-ing-art ${asset?"has-asset":""}"><i></i>${asset}</div>
    <p class="fp-ing-name">${item.label} <b>x${item.count}</b></p>
  </div>`;
}

// view = { ingredients, stage(가운데 마크업), done, total, percent,
//          keys, expectedIndex, keyLink, controlDesc }
// onKey 는 화면 안 키 버튼을 눌렀을 때 호출할 입력 함수입니다.
function renderFryPrepScreen(view,onKey){
  dom.miniContent.innerHTML=`
    <div class="fp-scene">
      <div class="fp-col">
        <h3 class="fp-col-title starred">재료</h3>
        <div class="fp-panel fp-ing-panel">
          <div class="fp-ing-list">${view.ingredients.map(fryPrepIngredientMarkup).join("")}</div>
        </div>
      </div>
      <div class="fp-board">${view.stage}</div>
      <div class="fp-col">
        <h3 class="fp-col-title">진행도</h3>
        <div class="fp-panel fp-count">
          <strong><b>${view.done}</b> / ${view.total}</strong>
          <div class="fp-bar"><i style="width:${view.percent}%"></i></div>
        </div>
        <h3 class="fp-col-title">조작</h3>
        <div class="fp-panel fp-control">
          <div class="fp-keys">${view.keys.map((key,index)=>`<button type="button" class="fp-key ${index===view.expectedIndex?"expected":""}" data-fry-prep-key="${key}">${key.toUpperCase()}</button>`).join(`<span class="fp-key-link" aria-hidden="true">${view.keyLink}</span>`)}</div>
          <p class="fp-control-name">랜덤키 연타</p>
          <p class="fp-control-desc">${view.controlDesc}</p>
        </div>
      </div>
    </div>`;
  dom.miniContent.querySelectorAll("[data-fry-prep-key]").forEach(button=>button.addEventListener("click",()=>onKey(button.dataset.fryPrepKey)));
}

// 눌린 키 쪽으로 한 번 흔들립니다. 다시 그린 직후에 붙여야 애니메이션이 살아납니다.
function playFryPrepShake(selector,key,keys){
  const target=dom.miniContent.querySelector(selector);if(!target)return;
  const side=String(key).toLowerCase()===keys[0]?"left":"right";
  target.classList.remove("shake-left","shake-right");
  void target.offsetWidth;
  target.classList.add(`shake-${side}`);
}

/* ============================================================
   2. 감자튀김 준비 — 봉투를 흔들어 튀김가루 묻히기

   감자채가 담긴 봉투에 튀김가루를 넣고 랜덤키 두 개를 번갈아 연타해
   가루를 골고루 묻힙니다. 누를 때마다 봉투가 그 방향으로 흔들리고
   가루가 조금씩 더 붙습니다. 실패나 되돌아감은 없습니다.
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
  dom.miniTitle.textContent="감자튀김 준비";
  dom.miniStation.textContent="봉투를 흔들어 튀김가루를 골고루 묻혀주세요!";
  dom.miniDescription.textContent=`${pair[0].toUpperCase()} / ${pair[1].toUpperCase()}를 빠르게 눌러 봉투를 흔들어주세요!`;
  renderPotatoStarchShake();
}

function potatoStarchInput(key,repeat=false){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="potatoStarch"||repeat)return false;
  const data=m.data;
  if(!isAlternateTurn(data,key)){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.presses++;advanceAlternateTurn(data,key);audio.click();
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (100% 가 보이고 닫힙니다)
  renderPotatoStarchShake();
  playFryPrepShake("#friesBagScene",key,data.keys);
  if(data.presses>=data.total)finishDayPrepTask(data.taskId,"감자튀김 튀김가루 묻히기 완료");
  return true;
}

// 봉투 안 감자채는 매번 같은 자리에 있어야 하므로 index 로 자리를 계산합니다.
// (Math.random 을 쓰면 키를 누를 때마다 감자가 순간이동합니다)
function friesBagMarkup(percent,stage){
  const sticks=Array.from({length:24},(_,index)=>`<i style="--fp-x:${8+(index%6)*13}%;--fp-y:${10+Math.floor(index/6)*20}%;--fp-turn:${-52+(index*37)%104}deg"></i>`).join("");
  const flourCount=Math.round(percent/100*26);
  const flour=Array.from({length:flourCount},(_,index)=>`<b style="--fp-x:${7+(index*37)%86}%;--fp-y:${9+(index*53)%78}%;--fp-size:${4+index%3}"></b>`).join("");
  const asset=dayPrepAssetMarkup(`friesShakeBag${stage}`,"fp-bag-asset",`튀김가루 묻히기 ${stage}%`);
  return `<div class="fp-bag-scene" id="friesBagScene">
    <i class="fp-wave left" aria-hidden="true"><b style="--fp-i:0"></b><b style="--fp-i:1"></b><b style="--fp-i:2"></b></i>
    <div class="fp-bag stage-${stage} ${asset?"has-asset":""}">
      ${asset}
      <i class="fp-bag-zip" aria-hidden="true"></i>
      <div class="fp-bag-fill" aria-hidden="true">${sticks}${flour}</div>
    </div>
    <i class="fp-wave right" aria-hidden="true"><b style="--fp-i:0"></b><b style="--fp-i:1"></b><b style="--fp-i:2"></b></i>
  </div>`;
}

function renderPotatoStarchShake(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="potatoStarch")return;
  const data=m.data,percent=Math.round(data.presses/data.total*100);
  const stage=DAY4_PREP_CONFIG.potatoStarch.stages.reduce((active,threshold)=>percent>=threshold?threshold:active,0);
  // 공용 타이머 카드는 이 화면에서 숨기지만 내용은 계속 채워 둡니다.
  // (css/day-prep-minigames.css 의 숨김 한 줄만 지우면 그대로 다시 보입니다)
  dom.miniTimer.textContent=`${data.presses} / ${data.total}`;
  renderFryPrepScreen({
    ingredients:[{id:"potatoStrips",label:"감자채",count:1,asset:"friesPotatoStrips"}],
    stage:friesBagMarkup(percent,stage),
    done:data.presses>=data.total?1:0,
    total:1,
    percent,
    keys:data.keys,
    expectedIndex:data.expectedIndex,
    keyLink:"→",
    controlDesc:`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 빠르게<br />눌러 흔들기`
  },key=>potatoStarchInput(key,false));
}

/* ============================================================
   3. 새우튀김 준비 — 밀가루 → 계란물 → 빵가루, 각 12회

   화면에는 세 그릇이 순서대로 놓이고, 지금 차례인 그릇만 밝게 켜집니다.
   랜덤키 두 개를 번갈아 연타하면 새우가 그 안에서 굴러 옷이 입혀집니다.
   한 단계가 끝나면 화면이 닫히고 다음 재료대로 걸어가 다시 시작합니다.
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
  dom.miniTitle.textContent="새우튀김 준비";
  dom.miniStation.textContent="튀김가루, 계란물, 빵가루를 순서대로 묻혀주세요!";
  dom.miniDescription.textContent=`${pair[0].toUpperCase()} / ${pair[1].toUpperCase()}를 빠르게 눌러 ${item.label}를 묻혀주세요!`;
  renderShrimpCoat();
}

function shrimpCoatInput(key){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="shrimpCoat")return false;
  const data=m.data;
  if(!isAlternateTurn(data,key)){dom.miniFeedback.textContent=`${data.keys[data.expectedIndex].toUpperCase()} 차례입니다.`;return false;}
  data.successes++;advanceAlternateTurn(data,key);audio.click();
  // 마지막 한 번도 화면에 반영한 뒤에 완료 처리합니다 (다 입은 새우가 보이고 닫힙니다)
  renderShrimpCoat();
  playFryPrepShake("#shrimpCoatStation",key,data.keys);
  if(data.successes>=data.total)finishDayPrepTask(data.taskId,`새우튀김 ${data.sequence[data.step].label} 묻히기 완료`);
  return true;
}

// 새우 한 마리. coating 은 지금 입고 있는 옷, stage 는 0~3 (묻은 정도) 입니다.
function shrimpPieceMarkup(coating,stage){
  const assetKey={raw:"shrimpStateRaw",flour:"shrimpStateFlour",egg:"shrimpStateEgg",breadcrumbs:"shrimpStateBreadcrumbs"}[coating]||"shrimpStateRaw";
  const asset=dayPrepAssetMarkup(assetKey,"fp-shrimp-asset","새우");
  const crumbs=coating==="breadcrumbs"?Array.from({length:Math.ceil(stage/3*12)},(_,index)=>`<b style="--fp-x:${12+(index*29)%74}%;--fp-y:${16+(index*41)%62}%;--fp-turn:${index*23}deg"></b>`).join(""):"";
  return `<div class="fp-shrimp coating-${coating} stage-${stage} ${asset?"has-asset":""}">${asset}<i class="fp-shrimp-eye"></i>${crumbs}</div>`;
}

function shrimpCoatStageMarkup(data,percent){
  const stage=percent>=100?3:percent>=70?2:percent>=35?1:0;
  return `<div class="fp-coat-row">${data.sequence.map((item,index)=>{
    const status=index<data.step?"done":index===data.step?"current":"pending";
    const vesselAsset=dayPrepAssetMarkup(`shrimpVessel${item.id[0].toUpperCase()}${item.id.slice(1)}`,"fp-vessel-asset",item.label);
    // 지나온 그릇은 옷을 다 입은 새우, 지금 그릇은 진행 중, 다음 그릇은 비어 있습니다.
    const shrimp=index<data.step?shrimpPieceMarkup(item.id,3):index===data.step?shrimpPieceMarkup(item.id,stage):"";
    const sparks=status==="current"?`<div class="fp-sparks">${Array.from({length:10},(_,i)=>`<b style="--fp-turn:${i*36}deg;--fp-i:${i}"></b>`).join("")}</div>`:"";
    return `<div class="fp-coat-station ${item.id} ${status}" ${status==="current"?'id="shrimpCoatStation"':""} aria-label="${index+1}. ${item.label}">
      <div class="fp-vessel ${item.id} ${vesselAsset?"has-asset":""}">${vesselAsset}${shrimp}</div>
      ${sparks}
    </div>`;
  }).join('<i class="fp-coat-arrow" aria-hidden="true">→</i>')}</div>`;
}

function renderShrimpCoat(){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="shrimpCoat")return;
  const data=m.data,current=data.sequence[data.step],percent=Math.round(data.successes/data.total*100);
  dom.miniTimer.textContent=`${percent}%`;   // 화면에서는 숨겨 둔 공용 카드입니다
  renderFryPrepScreen({
    // 지금 단계의 재료 한 줄만 밝게 켭니다.
    ingredients:[
      {id:"shrimpRaw",label:"생새우",count:1,asset:"shrimpStateRaw"},
      {id:"flour",label:"튀김가루",count:1,asset:"shrimpIngFlour",active:current.id==="flour"},
      {id:"egg",label:"계란물",count:1,asset:"shrimpIngEgg",active:current.id==="egg"},
      {id:"breadcrumbs",label:"빵가루",count:1,asset:"shrimpIngCrumbs",active:current.id==="breadcrumbs"}
    ],
    stage:shrimpCoatStageMarkup(data,percent),
    done:data.successes>=data.total?1:0,
    total:1,
    percent,
    keys:data.keys,
    expectedIndex:data.expectedIndex,
    keyLink:"·",
    controlDesc:`${data.keys[0].toUpperCase()} / ${data.keys[1].toUpperCase()}를 랜덤하게<br />빠르게 눌러 새우를<br />굴려주세요!`
  },key=>shrimpCoatInput(key));
}
