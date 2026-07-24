"use strict";

// Day 1 준비 미니게임 전용 모듈. 기존 영업 중 조리 미니게임과 상태를 분리합니다.
const DAY_PREP_MINI_CONFIG = {
  cutRadish:{title:"어묵탕 · 무 썰기",total:4,zoneWidth:.12,zoneStarts:[.14,.55,.29,.67],speed:.78},
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:5,zoneWidth:.14,zoneStarts:[.2,.58,.32,.68,.43],speed:.8},
  prepareKimchi:{title:"두부김치 · 김치 준비하기",total:3,zoneWidth:.16,zoneStarts:[.51,.18,.62],speed:.74},
  fryKimchi:{total:11,allowedDirections:["left","right"]},
  cleanAnchovy:{title:"어묵탕 · 멸치 머리 떼기",total:5}
};

// 아래 경로에 파일을 추가하면 CSS 프로토타입 대신 자동으로 이미지가 사용됩니다.
// 누락된 선택 에셋은 로딩 실패로 취급하지 않고 기존 CSS 도형으로 대체합니다.
const DAY_PREP_ASSET_PATHS = Object.freeze({
  radish0:"assets/prep/radish/radish-0.png",
  radish1:"assets/prep/radish/radish-1.png",
  radish2:"assets/prep/radish/radish-2.png",
  radish3:"assets/prep/radish/radish-3.png",
  radish4:"assets/prep/radish/radish-4.png",
  kimchiCut0:"assets/prep/kimchi/kimchi-cut-0.png",
  kimchiCut1:"assets/prep/kimchi/kimchi-cut-1.png",
  kimchiCut2:"assets/prep/kimchi/kimchi-cut-2.png",
  kimchiCut3:"assets/prep/kimchi/kimchi-cut-3.png",
  anchovyBody:"assets/prep/anchovy/anchovy-body.png",
  anchovyHead:"assets/prep/anchovy/anchovy-head.png",
  fryingPan:"assets/prep/kimchi/frying-pan.png",
  fryingKimchi:"assets/prep/kimchi/frying-kimchi.png",
  knife:"assets/prep/effects/knife.png"
});
const dayPrepAssets={};

function loadDayPrepAssets(){
  return Promise.all(Object.entries(DAY_PREP_ASSET_PATHS).map(([key,src])=>new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{dayPrepAssets[key]={src,image};resolve(image);};
    image.onerror=()=>resolve(null);
    image.src=src;
  }))).then(()=>dayPrepAssets);
}

function hasDayPrepAsset(key){
  return !!dayPrepAssets[key];
}

function dayPrepAssetMarkup(key,className,alt=""){
  if(!hasDayPrepAsset(key))return "";
  return `<img class="prep-asset ${className}" src="${dayPrepAssets[key].src}" alt="${alt}" draggable="false" />`;
}

function timingAssetKey(ingredient,successes){
  if(ingredient==="radish")return `radish${successes}`;
  if(ingredient==="kimchi")return `kimchiCut${successes}`;
  return `${ingredient}${successes}`;
}

function isDayPrepMini(mini=state.mini){
  return mini?.context?.mode==="dayPrep";
}

function startDayPrepMini(task){
  state.mini={
    type:`day-prep-${task.id}`,
    stationId:"prepTable",
    context:{mode:"dayPrep",taskId:task.id},
    complete:false,
    data:{}
  };
  dom.miniStation.textContent=`준비 테이블 · ${task.objectLabel}`;
  dom.miniFeedback.textContent="";
  dom.miniContent.innerHTML="";
  dom.miniClose.hidden=false;
  dom.miniOverlay.classList.add("open");

  if(task.id==="cutRadish")setupDayPrepTiming("cutRadish");
  else if(task.id==="cutFishCake")setupDayPrepTiming("cutFishCake");
  else if(task.id==="cleanAnchovy")setupAnchovyPrep();
  else if(state.kimchiPrep.cuttingComplete)setupKimchiFry();
  else setupDayPrepTiming("prepareKimchi");
}

function setupDayPrepTiming(taskId){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG[taskId];
  startCuttingMinigame({
    taskId,
    ingredient:taskId==="cutRadish"?"radish":taskId==="cutFishCake"?"fishCake":"kimchi",
    requiredHits:config.total,
    hitZoneWidth:config.zoneWidth,
    speed:config.speed,
    zoneStarts:config.zoneStarts,
    title:config.title,
    onComplete:taskId==="prepareKimchi"
      ?()=>{state.kimchiPrep.cuttingComplete=true;setTimeout(()=>{if(state.mini===m&&!m.complete)setupKimchiFry();},320);}
      :()=>showOdenIngredientDrop(taskId,taskId==="cutFishCake"?"fishCake":"radish",taskId==="cutFishCake"?"어묵 썰기 완료":"무 썰기 완료"),
    description:taskId==="cutRadish"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 누르세요. 총 4번 썹니다."
      :taskId==="cutFishCake"
      ?"포인터가 초록 구간에 들어왔을 때 Space를 눌러 어묵을 5조각으로 써세요."
      :"[1/2] 포인터가 초록 구간에 들어왔을 때 Space를 누르세요. 총 3번 썹니다."
  });
}

// 두부 썰기 등 후속 조리는 같은 함수에 설정만 전달해 연결할 수 있습니다.
function startCuttingMinigame(options){
  const m=state.mini;
  const width={wide:.24,normal:.18,narrow:.14}[options.hitZoneWidth]??options.hitZoneWidth??.18;
  const speed={slow:.55,normal:.7,fast:.9}[options.speed]??options.speed??.7;
  const defaults=[.18,.56,.32,.66,.42];
  const zoneStarts=options.zoneStarts?.length?[...options.zoneStarts]:Array.from({length:options.requiredHits},(_,index)=>defaults[index%defaults.length]);
  m.data={mode:"timing",marker:0,direction:1,successes:0,taskId:options.taskId,ingredient:options.ingredient,total:options.requiredHits,zoneWidth:width,speed,zoneStarts,onComplete:options.onComplete};
  dom.miniTitle.textContent=options.title;
  dom.miniDescription.textContent=options.description;
  renderDayPrepTiming();
}

function renderDayPrepTiming(){
  const m=state.mini,data=m.data,isRadish=data.ingredient==="radish";
  const zoneLeft=data.zoneStarts[data.successes];
  const objectAssetKey=timingAssetKey(data.ingredient,data.successes);
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="prep-work-object ${data.ingredient}-shape ${hasDayPrepAsset(objectAssetKey)?"has-prep-asset":""}" id="prepWorkObject" aria-label="${data.ingredient}">
      ${dayPrepAssetMarkup(objectAssetKey,"prep-object-asset",isRadish?"손질 단계별 무":"손질 단계별 재료")}
      ${Array.from({length:data.total},(_,index)=>`<i class="cut-line ${data.ingredient==="fishCake"?`fishcake-diagonal ${index%2?"slash-back":"slash-forward"}`:""} ${index<data.successes?"done":""}" style="left:${(index+1)/(data.total+1)*100}%"></i>`).join("")}
      <i class="knife-effect ${hasDayPrepAsset("knife")?"has-prep-asset":""}">${dayPrepAssetMarkup("knife","knife-asset","")}</i>
    </div>
    <div class="prep-timing-bar">
      <i class="prep-success-zone" style="left:${zoneLeft*100}%;width:${data.zoneWidth*100}%"></i>
      <i id="dayPrepMarker" class="prep-timing-marker" style="left:${data.marker*100}%"></i>
    </div>
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <button class="mini-action" id="dayPrepAction" type="button">Space · 썰기</button>`;
  dom.miniContent.querySelector("#dayPrepAction").addEventListener("click",dayPrepPrimaryAction);
}

function setupAnchovyPrep(){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG.cleanAnchovy;
  const slots=shuffle(Array.from({length:10},(_,index)=>index)).slice(0,config.total);
  m.data={mode:"anchovy",cleaned:0,total:config.total,items:slots.map((slot,index)=>({
    id:index,cleaned:false,x:8+(slot%5)*18+Math.random()*4,y:10+Math.floor(slot/5)*48+Math.random()*5,
    rotation:-22+Math.random()*44,scale:.82+Math.random()*.3,flip:Math.random()>.5?-1:1
  }))};
  dom.miniTitle.textContent=config.title;
  dom.miniDescription.textContent="멸치의 작은 원형 머리를 클릭하세요. 몸통을 누르면 같은 멸치를 다시 시도합니다.";
  renderAnchovyPrep();
}

function showOdenIngredientDrop(taskId,ingredient,message){
  const m=state.mini;
  const ingredientOrder=["radish","fishCake","anchovy"];
  const completedIngredients=ingredientOrder.filter(item=>item===ingredient||(
    item==="radish"&&state.prepProgress.cutRadish||
    item==="fishCake"&&state.prepProgress.cutFishCake||
    item==="anchovy"&&state.prepProgress.cleanAnchovy
  ));
  m.data={mode:"potDrop",taskId,ingredient,message};
  dom.miniTitle.textContent="어묵탕 · 냄비에 넣기";
  dom.miniDescription.textContent=`손질을 마친 ${ingredient==="radish"?"무":ingredient==="fishCake"?"어묵":"멸치"}를 육수 냄비에 넣습니다.`;
  dom.miniTimer.textContent="냄비";
  dom.miniContent.innerHTML=`
    <div class="oden-pot-scene">
      <div class="oden-pot-ingredients"><i class="pot-ingredient ${ingredient} dropping"></i></div>
      <div class="oden-broth">${completedIngredients.map(item=>`<i class="broth-piece ${item} ${item===ingredient?"just-added":""}"></i>`).join("")}</div>
      <div class="oden-pot"><i class="pot-rim"></i></div>
    </div>
    <div class="cut-count">손질한 재료를 냄비에 넣는 중</div>`;
  setTimeout(()=>{if(state.mini===m&&!m.complete)finishDayPrepTask(taskId,message);},650);
}

function renderAnchovyPrep(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.cleaned} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="anchovy-work-area" id="anchovyWorkArea">
      ${data.items.map(item=>`<div class="anchovy ${item.cleaned?"cleaned":""}" data-id="${item.id}" style="left:${item.x}%;top:${item.y}%;--turn:${item.rotation}deg;--size:${item.scale};--flip:${item.flip}">
        <button class="anchovy-body ${hasDayPrepAsset("anchovyBody")?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 몸통">${dayPrepAssetMarkup("anchovyBody","anchovy-body-asset","")}</button>
        <button class="anchovy-head ${hasDayPrepAsset("anchovyHead")?"has-prep-asset":""}" type="button" aria-label="${item.id+1}번 멸치 머리">${dayPrepAssetMarkup("anchovyHead","anchovy-head-asset","")}</button>
      </div>`).join("")}
    </div>
    <div class="cut-count">진행 ${data.cleaned} / ${data.total}</div>`;
  dom.miniContent.querySelectorAll(".anchovy-body").forEach(button=>button.addEventListener("click",()=>{
    dom.miniFeedback.textContent="몸통이 아니라 머리를 클릭하세요.";
  }));
  dom.miniContent.querySelectorAll(".anchovy-head").forEach(button=>button.addEventListener("click",()=>cleanAnchovyHead(button)));
}

function cleanAnchovyHead(button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="anchovy")return;
  const wrapper=button.closest(".anchovy"),item=m.data.items.find(entry=>entry.id===Number(wrapper.dataset.id));
  if(!item||item.cleaned)return;
  item.cleaned=true;m.data.cleaned++;
  wrapper.classList.add("cleaned");button.disabled=true;
  dom.miniTimer.textContent=`${m.data.cleaned} / ${m.data.total}`;
  dom.miniContent.querySelector(".cut-count").textContent=`진행 ${m.data.cleaned} / ${m.data.total}`;
  dom.miniFeedback.textContent="머리 손질 성공";
  if(m.data.cleaned===m.data.total)showOdenIngredientDrop("cleanAnchovy","anchovy","멸치 손질 완료");
}

function setupKimchiFry(){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG.fryKimchi;
  const sequence=Array.from({length:config.total},()=>config.allowedDirections[Math.floor(Math.random()*config.allowedDirections.length)]);
  m.data={mode:"direction",successes:0,total:config.total,allowedDirections:[...config.allowedDirections],sequence};
  dom.miniTitle.textContent="두부김치 · 김치 준비하기";
  dom.miniDescription.textContent="[2/2] 팬 아래에 표시된 방향을 왼쪽부터 순서대로 누르세요. 맞게 누른 화살표는 검게 변합니다.";
  renderKimchiFry();
}

function renderKimchiFry(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  dom.miniContent.innerHTML=`
    <div class="fry-work-area" id="fryWorkArea">
      <div class="frying-pan ${hasDayPrepAsset("fryingPan")?"has-prep-asset":""}">
        ${dayPrepAssetMarkup("fryingPan","frying-pan-asset","후라이팬")}
        <i class="frying-kimchi ${hasDayPrepAsset("fryingKimchi")?"has-prep-asset":""}">${dayPrepAssetMarkup("fryingKimchi","frying-kimchi-asset","볶는 김치")}</i>
      </div>
    </div>
    <div class="kimchi-direction-sequence" aria-label="볶기 방향 순서">
      ${data.sequence.map((direction,index)=>`<span class="kimchi-direction-chip ${index<data.successes?"done":index===data.successes?"current":""}" data-sequence-index="${index}">${direction==="left"?"←":"→"}</span>`).join("")}
    </div>
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <div class="prep-direction-buttons">
      ${data.allowedDirections.map(direction=>`<button type="button" data-direction="${direction}">${direction==="left"?"←":"→"}</button>`).join("")}
    </div>`;
  dom.miniContent.querySelectorAll("[data-direction]").forEach(button=>button.addEventListener("click",()=>dayPrepDirectionInput(button.dataset.direction)));
}

function dayPrepPrimaryAction(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  if(m.data.mode!=="timing")return;
  const data=m.data,zoneStart=data.zoneStarts[data.successes],zoneEnd=zoneStart+data.zoneWidth;
  if(data.marker<zoneStart||data.marker>zoneEnd){
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 현재 단계에서 다시 시도하세요.";
    return;
  }
  data.successes++;
  const work=dom.miniContent.querySelector("#prepWorkObject");
  work?.classList.add("slice-hit");
  const nextAssetKey=timingAssetKey(data.ingredient,data.successes);
  const objectImage=work?.querySelector(".prep-object-asset");
  if(objectImage&&hasDayPrepAsset(nextAssetKey))objectImage.src=dayPrepAssets[nextAssetKey].src;
  dom.miniContent.querySelector(`.cut-line:nth-child(${data.successes})`)?.classList.add("done");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const progress=dom.miniContent.querySelector(".cut-count");
  if(progress)progress.textContent=`진행 ${data.successes} / ${data.total}`;
  dom.miniFeedback.textContent="절단 성공";
  if(data.successes>=data.total){
    if(typeof data.onComplete==="function")data.onComplete();
    return;
  }
  setTimeout(()=>{if(state.mini===m&&!m.complete)renderDayPrepTiming();},180);
}

function dayPrepDirectionInput(direction){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="direction")return;
  const data=m.data;
  if(!data.allowedDirections.includes(direction))return;
  if(direction!==data.sequence[data.successes]){
    dom.miniFeedback.textContent="방향이 다릅니다. 검게 변하지 않은 첫 화살표부터 다시 확인하세요.";
    return;
  }
  const completed=dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`);
  completed?.classList.remove("current");completed?.classList.add("done");
  data.successes++;
  dom.miniFeedback.textContent="볶기 성공";
  dom.miniContent.querySelector(`[data-sequence-index="${data.successes}"]`)?.classList.add("current");
  dom.miniTimer.textContent=`${data.successes} / ${data.total}`;
  const progress=dom.miniContent.querySelector(".cut-count");
  if(progress)progress.textContent=`진행 ${data.successes} / ${data.total}`;
  const work=dom.miniContent.querySelector("#fryWorkArea");
  if(work){
    const tossClass=direction==="left"?"toss-left":"toss-right";
    work.classList.remove("toss-left","toss-right");void work.offsetWidth;work.classList.add(tossClass);
    setTimeout(()=>work.classList.remove(tossClass),170);
  }
  if(data.successes>=data.total){
    state.kimchiPrep.fryingComplete=true;
    finishDayPrepTask("prepareKimchi","김치 준비 완료");
    return;
  }
}

function updateDayPrepMini(dt){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="timing")return;
  const data=m.data;
  data.marker+=data.direction*data.speed*dt;
  if(data.marker>=1){data.marker=1;data.direction=-1;}
  if(data.marker<=0){data.marker=0;data.direction=1;}
  const marker=dom.miniContent.querySelector("#dayPrepMarker");
  if(marker)marker.style.left=`${data.marker*100}%`;
}

function finishDayPrepTask(taskId,message){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  m.complete=true;
  completeDayPrepTask(taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=message;
  dom.miniContent.classList.add("prep-complete-flash");
  setTimeout(()=>{if(state.mini===m)closeDayPrepMini(true);},520);
}

function closeDayPrepMini(completed=false){
  if(!isDayPrepMini())return;
  state.mini=null;
  state.joyX=0;state.joyY=0;state.player.moving=false;
  dom.miniOverlay.classList.remove("open");
  dom.miniClose.hidden=true;
  dom.miniContent.classList.remove("prep-complete-flash");
  dom.miniContent.innerHTML="";
  updateUI(true);
  saveGame();
  if(completed!==true)showToast("준비 작업을 닫았습니다. 다시 상호작용해 이어갈 수 있습니다.");
}
