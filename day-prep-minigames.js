"use strict";

// 날짜별 준비 미니게임 모듈. 메뉴 Task ID별 진행 상태를 서로 분리합니다.
const DAY_PREP_MINI_CONFIG = {
  cutRadish:{title:"어묵탕 · 무 썰기",total:4,zoneWidth:.12,zoneStarts:[.14,.55,.29,.67],speed:.78},
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:5,zoneWidth:.14,zoneStarts:[.2,.58,.32,.68,.43],speed:.8},
  cutTofuKimchi:{title:"두부김치 · 김치 썰기",ingredient:"kimchi",total:3,zoneWidth:.16,zoneStarts:[.51,.18,.62],speed:.74},
  cutPancakeKimchi:{title:"김치전 · 김치 썰기",ingredient:"kimchi",total:3,zoneWidth:.16,zoneStarts:[.22,.58,.39],speed:.78},
  cutSkewerChicken:{title:"닭꼬치 · 닭 썰기",ingredient:"chicken",total:4,zoneWidth:.14,zoneStarts:[.18,.55,.31,.68],speed:.8,requiresDoubleTap:true},
  cutSkewerGreenOnion:{title:"닭꼬치 · 대파 썰기",ingredient:"greenOnion",total:4,zoneWidth:.14,zoneStarts:[.56,.2,.65,.36],speed:.82},
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
  chicken0:"assets/prep/chicken/chicken-0.png",
  chicken1:"assets/prep/chicken/chicken-1.png",
  chicken2:"assets/prep/chicken/chicken-2.png",
  chicken3:"assets/prep/chicken/chicken-3.png",
  chicken4:"assets/prep/chicken/chicken-4.png",
  greenOnion0:"assets/prep/green-onion/green-onion-0.png",
  greenOnion1:"assets/prep/green-onion/green-onion-1.png",
  greenOnion2:"assets/prep/green-onion/green-onion-2.png",
  greenOnion3:"assets/prep/green-onion/green-onion-3.png",
  greenOnion4:"assets/prep/green-onion/green-onion-4.png",
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

  if(task.miniGame==="cut")setupDayPrepTiming(task.id);
  else if(task.miniGame==="anchovy")setupAnchovyPrep();
  else if(task.miniGame==="kimchiFry")setupKimchiFry(task.id);
  else if(task.miniGame==="batter")setupKimchiBatter();
  else if(task.miniGame==="skewer")setupChickenSkewer();
}

function setupDayPrepTiming(taskId){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG[taskId];
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
  const m=state.mini;
  const width={wide:.24,normal:.18,narrow:.14}[options.hitZoneWidth]??options.hitZoneWidth??.18;
  const speed={slow:.55,normal:.7,fast:.9}[options.speed]??options.speed??.7;
  const defaults=[.18,.56,.32,.66,.42];
  const zoneStarts=options.zoneStarts?.length?[...options.zoneStarts]:Array.from({length:options.requiredHits},(_,index)=>defaults[index%defaults.length]);
  m.data={mode:"timing",marker:0,direction:1,successes:0,taskId:options.taskId,ingredient:options.ingredient,total:options.requiredHits,zoneWidth:width,speed,zoneStarts,onComplete:options.onComplete,requiresDoubleTap:!!options.requiresDoubleTap,tapStep:0,tapWindow:0};
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
    ${data.requiresDoubleTap?'<div class="tough-cut-hint" id="toughCutHint"><span>SPACE 1</span><span>SPACE 2</span></div>':""}
    <div class="cut-count">진행 ${data.successes} / ${data.total}</div>
    <button class="mini-action" id="dayPrepAction" type="button">Space · ${data.requiresDoubleTap?"빠르게 2번":"썰기"}</button>`;
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

function setupKimchiFry(taskId="fryTofuKimchi"){
  const m=state.mini,config=DAY_PREP_MINI_CONFIG.fryKimchi;
  const sequence=Array.from({length:config.total},()=>config.allowedDirections[Math.floor(Math.random()*config.allowedDirections.length)]);
  m.data={mode:"direction",taskId,successes:0,total:config.total,allowedDirections:[...config.allowedDirections],sequence};
  dom.miniTitle.textContent="두부김치 · 김치 볶기";
  dom.miniDescription.textContent="썰어 둔 두부김치용 김치를 팬에서 볶습니다. 표시된 방향을 왼쪽부터 순서대로 누르세요.";
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

function setupKimchiBatter(){
  state.mini.data={mode:"batterIngredients",step:0,ingredients:[
    {id:"flour",label:"밀가루 봉투"},{id:"water",label:"물"},{id:"kimchi",label:"썰어 둔 김치"}
  ]};
  dom.miniTitle.textContent="김치전 · 반죽 만들기";
  dom.miniDescription.textContent="밀가루 → 물 → 썰어 둔 김치 순서로 믹스볼에 넣으세요.";
  renderKimchiBatterIngredients();
}

function renderKimchiBatterIngredients(){
  const data=state.mini.data,current=data.ingredients[data.step];
  dom.miniTimer.textContent=`${data.step} / ${data.ingredients.length}`;
  dom.miniContent.innerHTML=`
    <div class="batter-prep-scene">
      <div class="batter-ingredients">${data.ingredients.map((item,index)=>`<button type="button" class="batter-ingredient ${item.id} ${index<data.step?"added":""}" data-batter-ingredient="${item.id}" ${index<data.step?"disabled":""}><i></i><span>${item.label}</span></button>`).join("")}</div>
      <div class="mixing-bowl ingredient-step-${data.step}"><i class="batter-fill"></i></div>
    </div>
    <div class="cut-count">다음 재료 · ${current?.label||"거품기"}</div>`;
  dom.miniContent.querySelectorAll("[data-batter-ingredient]").forEach(button=>button.addEventListener("click",()=>addBatterIngredient(button.dataset.batterIngredient,button)));
}

function addBatterIngredient(ingredientId,button){
  const m=state.mini;if(!isDayPrepMini(m)||m.data.mode!=="batterIngredients")return;
  const expected=m.data.ingredients[m.data.step];
  if(ingredientId!==expected.id){dom.miniFeedback.textContent=`먼저 ${expected.label}을 넣으세요.`;audio.bad();return;}
  button.classList.add("pouring");button.disabled=true;m.data.step++;audio.click();
  dom.miniFeedback.textContent=`${expected.label} 넣기 완료`;
  setTimeout(()=>{
    if(state.mini!==m||m.complete)return;
    if(m.data.step>=m.data.ingredients.length)setupWhiskBatter();
    else renderKimchiBatterIngredients();
  },420);
}

function setupWhiskBatter(){
  const m=state.mini;
  m.data={mode:"whisk",progress:0,pointerActive:false,lastAngle:null};
  dom.miniTitle.textContent="김치전 · 거품기로 섞기";
  dom.miniDescription.textContent="믹스볼 안에서 마우스를 누른 채 원을 그리세요. 거품기와 반죽이 움직이며 섞입니다.";
  dom.miniTimer.textContent="0%";
  dom.miniContent.innerHTML=`
    <div class="whisk-work-area" id="whiskWorkArea">
      <div class="whisk-bowl stage-0" id="whiskBowl"><i class="mixed-batter"></i><i class="whisk-tool" id="whiskTool"></i></div>
    </div>
    <div class="whisk-progress"><i id="whiskProgressBar"></i></div>
    <div class="cut-count" id="whiskProgressText">반죽 진행도 0%</div>`;
  const work=dom.miniContent.querySelector("#whiskWorkArea");
  work.addEventListener("pointerdown",event=>{m.data.pointerActive=true;m.data.lastAngle=null;work.setPointerCapture(event.pointerId);moveWhiskPointer(event);});
  work.addEventListener("pointermove",moveWhiskPointer);
  ["pointerup","pointercancel"].forEach(type=>work.addEventListener(type,()=>{m.data.pointerActive=false;m.data.lastAngle=null;}));
}

function moveWhiskPointer(event){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="whisk"||!m.data.pointerActive)return;
  const work=dom.miniContent.querySelector("#whiskWorkArea"),bowl=dom.miniContent.querySelector("#whiskBowl"),whisk=dom.miniContent.querySelector("#whiskTool");
  if(!work||!bowl||!whisk)return;
  const rect=work.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,cx=rect.width/2,cy=rect.height/2;
  const dx=x-cx,dy=y-cy,radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  whisk.style.left=`${clamp(x/rect.width*100,8,92)}%`;whisk.style.top=`${clamp(y/rect.height*100,8,92)}%`;
  bowl.style.setProperty("--batter-x",`${clamp(dx*.045,-7,7)}px`);bowl.style.setProperty("--batter-y",`${clamp(dy*.045,-6,6)}px`);
  if(m.data.lastAngle!=null&&radius>35&&radius<Math.min(rect.width,rect.height)*.48){
    const delta=Math.atan2(Math.sin(angle-m.data.lastAngle),Math.cos(angle-m.data.lastAngle));
    if(Math.abs(delta)<1.2)m.data.progress=clamp(m.data.progress+Math.abs(delta)*6,0,100);
  }
  m.data.lastAngle=angle;
  const progress=Math.round(m.data.progress),stage=Math.min(4,Math.floor(progress/25));
  bowl.className=`whisk-bowl stage-${stage}`;
  dom.miniContent.querySelector("#whiskProgressBar").style.width=`${progress}%`;
  dom.miniContent.querySelector("#whiskProgressText").textContent=`반죽 진행도 ${progress}%`;
  dom.miniTimer.textContent=`${progress}%`;
  if(progress>=100)finishDayPrepTask("mixKimchiBatter","김치전 반죽 완성");
}

function setupChickenSkewer(){
  state.mini.data={mode:"skewer",sequence:["chicken","greenOnion","chicken","greenOnion","chicken"],placed:[],used:[],selectedPiece:null,completedSkewers:0,totalSkewers:4};
  dom.miniTitle.textContent="닭꼬치 4개 조립";
  dom.miniDescription.textContent="닭 → 대파 → 닭 → 대파 → 닭 순서로 재료를 꽂아 숯불에 올릴 꼬치 4개를 만드세요.";
  renderChickenSkewer();
}

function renderChickenSkewer(){
  const data=state.mini.data;
  dom.miniTimer.textContent=`꼬치 ${data.completedSkewers+1} / ${data.totalSkewers} · ${data.placed.length} / ${data.sequence.length}`;
  dom.miniContent.innerHTML=`
    <div class="skewer-prep-scene">
      <div class="skewer-batch-progress" aria-label="완성된 닭꼬치 수">${Array.from({length:data.totalSkewers},(_,index)=>`<span class="batch-skewer ${index<data.completedSkewers?"done":index===data.completedSkewers?"current":""}"><i></i><b></b><em></em><b></b><em></em><b></b></span>`).join("")}</div>
      <div class="skewer-sources">${data.sequence.map((ingredient,index)=>`<button type="button" draggable="true" class="skewer-piece ${ingredient} ${data.used.includes(index)?"used":""}" data-piece-index="${index}" data-ingredient="${ingredient}" ${data.used.includes(index)?"disabled":""}>${ingredient==="chicken"?"닭":"대파"}</button>`).join("")}</div>
      <div class="skewer-stick"><i></i>${data.sequence.map((ingredient,index)=>`<button type="button" class="skewer-slot ${index<data.placed.length?ingredient:""} ${index===data.placed.length?"current":""}" data-slot-index="${index}">${index<data.placed.length?(ingredient==="chicken"?"닭":"대파"):index+1}</button>`).join("")}</div>
    </div>
    <div class="cut-count">순서 · 닭 → 대파 → 닭 → 대파 → 닭</div>`;
  dom.miniContent.querySelectorAll("[data-piece-index]").forEach(piece=>{
    piece.addEventListener("dragstart",event=>{event.dataTransfer.setData("text/plain",piece.dataset.pieceIndex);event.dataTransfer.effectAllowed="move";});
    piece.addEventListener("click",()=>{data.selectedPiece=Number(piece.dataset.pieceIndex);dom.miniContent.querySelectorAll(".skewer-piece").forEach(item=>item.classList.toggle("selected",item===piece));});
  });
  dom.miniContent.querySelectorAll("[data-slot-index]").forEach(slot=>{
    slot.addEventListener("dragover",event=>event.preventDefault());
    slot.addEventListener("drop",event=>{event.preventDefault();placeSkewerPiece(Number(event.dataTransfer.getData("text/plain")),Number(slot.dataset.slotIndex));});
    slot.addEventListener("click",()=>{if(data.selectedPiece!=null)placeSkewerPiece(data.selectedPiece,Number(slot.dataset.slotIndex));});
  });
}

function placeSkewerPiece(pieceIndex,slotIndex){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="skewer")return;
  const data=m.data,ingredient=data.sequence[pieceIndex],expected=data.sequence[data.placed.length];
  if(data.used.includes(pieceIndex))return;
  if(slotIndex!==data.placed.length||ingredient!==expected){dom.miniFeedback.textContent=`다음에는 ${expected==="chicken"?"닭":"대파"}을 ${data.placed.length+1}번 슬롯에 놓으세요.`;audio.bad();return;}
  data.used.push(pieceIndex);data.placed.push(ingredient);data.selectedPiece=null;audio.click();dom.miniFeedback.textContent="재료를 꼬치에 꽂았습니다.";
  if(data.placed.length>=data.sequence.length){
    data.completedSkewers++;
    if(data.completedSkewers>=data.totalSkewers){finishDayPrepTask("assembleChickenSkewer","닭꼬치 4개 조립 완료");return;}
    data.placed=[];data.used=[];data.selectedPiece=null;
    dom.miniFeedback.textContent=`${data.completedSkewers}개 완성! 다음 꼬치를 같은 순서로 꽂으세요.`;
  }
  renderChickenSkewer();
}

function dayPrepPrimaryAction(){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
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
  const nextAssetKey=timingAssetKey(data.ingredient,data.successes);
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
    finishDayPrepTask(data.taskId,"두부김치용 김치 볶기 완료");
    return;
  }
}

function updateDayPrepMini(dt){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete||m.data.mode!=="timing")return;
  const data=m.data;
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
