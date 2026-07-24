"use strict";

/* ------------------------------------------------------------
   game.js = 게임 규칙 · 미니게임 · UI · 세이브 연결 · Phaser 씬
   ------------------------------------------------------------
   좌표와 드로잉은 아래 파일들이 나눠 갖고 있습니다.
   화면에 무엇이 어디 있는지 고칠 일이면 game.js 가 아니라 그쪽입니다.

     stage.js      화면 크기 · 좌표 배율(toView/toLogic) · 레이어 · 배경 · 낮밤
     draw-utils.js 프레임 캔버스(ctx) · 공용 드로잉 헬퍼
     kitchen.js    주방 집기 9종
     counter.js    카운터 3종 · 의자 · 명패 · POS/철판 연출
     signage.js    영업중 간판
     player.js     요리사 위치 · 이동 범위 · 스프라이트
     customers.js  손님 좌석 · 말풍선
     prep.js       낮 준비물
     fx.js         파티클 · 팝업 · 안내 화살표

   game.js 에 남은 좌표는 draw() 의 그리기 순서(= 레이어 순서)뿐입니다.
   ------------------------------------------------------------ */
let phaserScene = null;

const dom = Object.fromEntries([
  "appRoot","titleScreen","gameScreen","gameApp","topHud","leftHud","rightHud","mobileControls","phaseName","dayText","timeLabel","timeText","satisfactionText","popularityText","moneyText",
  "settingsButton","menuCards","leftTitle","phaseBadge","inventoryList","phaseButton","objectiveTitle","objectiveBody",
  "relationshipList",
  "cleanlinessText","cleanlinessBar","cleaningText","stationPrompt","toast","startButton","continueButton","saveInfo","titleSettingsButton",
  "settingsOverlay","pauseMessage","masterVolume","masterVolumeValue","bgmVolume","bgmVolumeValue","sfxVolume","sfxVolumeValue",
  "resumeButton","returnTitleButton","miniOverlay","miniStation","miniTitle","miniTimer","miniClose","miniDescription","miniContent","miniFeedback",
  "resultOverlay","servedResult","satisfactionResult","fiveStarResult","popularityResult","wasteResult","revenueResult","resultComment","nextDayButton",
  "menuSelectOverlay","menuSelectTitle","menuSelectDescription","menuSelectGrid","menuSelectCount","menuSelectConfirm",
  "joystick","joystickKnob","actionButton"
].map(id => [id, document.getElementById(id)]));

const images = {};
function loadNativeImage(key,src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{images[key]=image;resolve(image);};
    image.onerror=()=>reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    image.src=src;
  });
}

const INGREDIENTS=Object.fromEntries(MENU_DATA.map(menu=>[menu.id,[...(menu.ingredients||[])]]));

// 기존 조리 코드는 DISHES 형식을 유지하고, 원본은 MENU_DATA 한곳에서 관리합니다.
const DISHES = MENU_DATA.map(menu=>({
  ...menu,
  name:menu.displayName,
  prepTasks:[...menu.requiredPrepTasks],
  prep:[...(menu.prep||[])],
  cook:[...(menu.cook||[])]
}));

// 집기 좌표는 kitchen.js(STATIONS) / counter.js(FRONT_STATIONS),
// 좌석은 customers.js, 이동 범위는 player.js 에 있습니다.
let nextOrderId = 1;
let toastTimer = 0;
let joystickPointer = null;
let bgmTimer = null;

const state = {
  screen:"title",
  phase:"title",
  paused:true,
  settingsFrom:"title",
  day:1,
  phaseTime:null,
  money:0,
  popularity:0,
  popularityBeforeResult:0,
  popularityDelta:0,
  dailyRevenue:0,
  wasteLoss:0,
  leftoverCount:0,
  discardedCount:0,
  discardLoss:0,
  nightCustomerTarget:0,
  spawnedCustomers:0,
  selectedDishId:"kimchi",
  selectedMenus:[],
  menuSelectionDraft:[],
  prepProgress:createDayPrepProgress(),
  kimchiPrep:{cuttingComplete:false,fryingComplete:false},
  selectedOrderId:null,
  inventory:Object.fromEntries(DISHES.map(d => [d.id,{count:0, quality:0}])),
  prepRun:null,
  orders:[],
  respawns:[],
  carrying:null,
  served:0,
  satisfactionTotal:0,
  fiveStar:0,
  cleanliness:100,
  dirtyDishes:0,
  trash:0,
  departures:[],
  mini:null,
  particles:[],
  popups:[],
  player:{ x:PLAYER_START.x, y:PLAYER_START.y, facing:PLAYER_START.facing, moving:false, speed:PLAYER_START.speed },
  story:createStoryState(),
  audio:{ master:.70, bgm:.45, sfx:.75 }
};

function dishById(id) { return DISHES.find(d => d.id === id); }
function stationById(id) { return STATIONS[id]||FRONT_STATIONS[id]||null; }
function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t) { return a+(b-a)*t; }
function distance(a,b,c,d) { return Math.hypot(a-c,b-d); }
function shuffle(arr) { return [...arr].sort(() => Math.random()-.5); }
function formatTime(sec) { sec=Math.max(0,Math.ceil(sec)); return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; }
function avgSatisfaction() { return state.served ? Math.round(state.satisfactionTotal/state.served) : 0; }

function syncAudioControls(){
  [[dom.masterVolume,"master",dom.masterVolumeValue],[dom.bgmVolume,"bgm",dom.bgmVolumeValue],[dom.sfxVolume,"sfx",dom.sfxVolumeValue]].forEach(([input,key,label])=>{
    const value=Math.round(state.audio[key]*100);input.value=value;label.textContent=`${value}%`;
  });
}

const audio = {
  ctx:null, master:null, bgm:null, sfx:null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.bgm = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.bgm.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
    this.apply();
  },
  apply() {
    if (!this.ctx) return;
    this.master.gain.value = state.audio.master;
    this.bgm.gain.value = state.audio.bgm * .18;
    this.sfx.gain.value = state.audio.sfx * .35;
  },
  tone(freq=440,duration=.09,type="square",gain=.12,when=0,target="sfx") {
    if (!this.ctx) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=gain;
    o.connect(g); g.connect(this[target]);
    const t=this.ctx.currentTime+when; o.start(t); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.001,t+duration); o.stop(t+duration+.02);
  },
  click(){ this.tone(520,.05,"square",.08); },
  success(){ this.tone(660,.09,"triangle",.12); this.tone(880,.12,"triangle",.1,.07); },
  bad(){ this.tone(160,.18,"sawtooth",.1); },
  serve(){ this.tone(523,.08,"triangle",.12); this.tone(659,.08,"triangle",.1,.08); this.tone(784,.13,"triangle",.09,.16); },
  startBgm(){
    if (!this.ctx || bgmTimer) return;
    const notesDay=[261.6,329.6,392,329.6], notesNight=[220,277.2,329.6,392];
    let i=0;
    bgmTimer=setInterval(()=>{
      if (state.paused || state.screen==="title") return;
      const notes=state.phase==="night"?notesNight:notesDay;
      this.tone(notes[i%notes.length],.55,"sine",.045,0,"bgm");
      this.tone(notes[(i+2)%notes.length]/2,.7,"triangle",.025,.02,"bgm");
      i++;
    },720);
  },
  stopBgm(){ if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null;} }
};

function showGameHud(show) {
  [dom.topHud,dom.leftHud,dom.rightHud,dom.mobileControls].forEach(el => el.classList.toggle("hidden-hud",!show));
}

function openSettings(from=state.screen) {
  if(from==="game")saveGame();
  state.settingsFrom=from; state.paused=true; dom.pauseMessage.textContent=from==="title"?"소리 설정을 변경할 수 있습니다.":"게임이 일시정지되었습니다.";
  dom.returnTitleButton.style.display=from==="title"||storyIsActive()?"none":"block";
  dom.resumeButton.textContent=from==="title"?"설정 닫기":"게임으로 돌아가기";
  dom.settingsOverlay.classList.add("open"); audio.click();
}
function closeSettings() {
  dom.settingsOverlay.classList.remove("open");
  state.paused=state.settingsFrom==="title" || state.phase==="result";
  audio.click();
}

function buildMenuCards() {
  dom.menuCards.innerHTML="";
  selectedDishes().forEach(dish=>{
    const b=document.createElement("button"); b.type="button"; b.className="menu-card"; b.dataset.id=dish.id;
    const orderCount=state.phase==="night"?state.orders.filter(order=>order.dishId===dish.id).length:0;
    const required=getCurrentDayData().requiredMenus.includes(dish.id);
    const icon=dish.icon==null?'<span class="food-icon menu-icon-placeholder">🍽</span>':`<span class="food-icon" style="background-position:${dish.icon*20}% 0"></span>`;
    b.innerHTML=`<strong>${dish.name}</strong>${icon}${required?'<small class="menu-tag">필수</small>':""}${orderCount?`<span class="order-count">주문 ${orderCount}</span>`:""}`;
    b.disabled=true;
    dom.menuCards.appendChild(b);
  });
}

function currentRequirement() {
  if(state.phase==="day") {
    return null;
  }
  if(state.phase==="night") {
    if(state.carrying) return null;
    const order=currentOrder(); if(!order) return null;
    return dishById(order.dishId).cook[order.cookStep]?.station || null;
  }
  return null;
}

// nearestStation()  → kitchen.js
// prepObjectLayout(), nearestPrepObject() → prep.js

function interact() {
  if(storyDialogueIsActive() || state.paused || state.mini || !["day","night"].includes(state.phase)) return;
  if(state.phase==="day"){
    const prepObject=nearestPrepObject();
    if(!prepObject){showToast("앞 테이블의 준비 재료 가까이 이동하세요.",true);return;}
    state.player.facing="down";
    startPrepTask(prepObject.task.id);
    return;
  }
  const station=nearestStation();
  if(state.phase==="night" && state.carrying) {
    if(station?.id==="trash"){
      state.player.facing=station.facing;
      discardCarriedDish();
      return;
    }
    tryDeliver();
    return;
  }
  if(!station){ showToast("사용할 집기 가까이 이동하세요.",true); return; }
  state.player.facing=station.facing;
  if(station.id==="dishwasher") { if(state.dirtyDishes<=0){showToast("씻을 그릇이 없습니다.");return;} startMini("dishwasher",station.id,{utility:true}); return; }
  if(station.id==="trash") { if(state.trash<=0){showToast("버릴 쓰레기가 없습니다.");return;} startMini("trash",station.id,{utility:true}); return; }
  const required=currentRequirement();
  if(station.id!==required){ showToast(`지금은 ${required?stationById(required).label:"주문 선택"} 단계입니다.`,true); return; }
  startCookMini(station.id);
}

function startMini(type,stationId,context) {
  state.mini={type,stationId,context:context||{},time:8,score:0,data:{},complete:false};
  dom.miniStation.textContent=STATIONS[stationId].label;
  dom.miniFeedback.textContent=""; dom.miniContent.innerHTML=""; dom.miniOverlay.classList.add("open");
  dom.miniClose.hidden=true;
  setupMini(); audio.click();
}

function setupMini() {
  const m=state.mini; if(!m) return;
  const dish=dishById(m.context.dishId || state.selectedDishId);
  const difficulty=cookingDifficultyMultiplier(m.context);
  const set=(title,desc,time)=>{
    const special=m.context.special;
    dom.miniTitle.textContent=special?`특별 조리 · ${title}`:title;
    dom.miniDescription.textContent=special?`${desc} 평소보다 조금 더 섬세한 조리가 필요합니다.`:desc;
    m.time=special?Math.max(5.5,time/difficulty):time;
    dom.miniTimer.textContent=m.time.toFixed(1);
  };
  if(m.type==="collect") {
    set("재료 꺼내기","잠깐 보여주는 재료 순서를 기억한 뒤 같은 순서로 선택하세요.",10);
    const target=shuffle(INGREDIENTS[dish.id]).slice(0,3); m.data={target,input:[],errors:0,showing:true};
    dom.miniContent.innerHTML=`<div class="sequence-view">${target.map(x=>`<span class="sequence-chip">${x}</span>`).join("")}</div><div class="choice-grid" id="ingredientChoices"></div>`;
    setTimeout(()=>{ if(state.mini===m){m.data.showing=false; dom.miniContent.querySelector(".sequence-view").innerHTML="<span class='sequence-chip'>순서를 입력하세요</span>"; renderIngredientChoices();}},1400);
  } else if(m.type==="wash") {
    set("재료 씻기","떠오르는 물방울을 모두 눌러 재료를 깨끗하게 씻으세요.",8);
    m.data={remaining:12}; renderBubbleGrid();
  } else if(m.type==="plateKimchi") {
    set("볶음김치 담기","영업 준비 때 볶아 둔 김치를 냉장고에서 꺼내 접시에 담으세요.",8);
    m.data={};
    dom.miniContent.innerHTML=`<div class="kimchi-plating"><span aria-hidden="true">🥬</span><strong>준비된 볶음김치</strong></div><button class="mini-action" id="miniAction" type="button">접시에 담기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",()=>finishMini(100));
  } else if(m.type==="chop") {
    const isTofu=m.context.mode==="cook"&&m.context.dishId==="tofu";
    set(isTofu?"두부 썰기":"정밀 손질",isTofu?"무와 김치를 썰 때처럼 포인터가 초록 구간에 들어왔을 때 누르세요. 세로 5번, 마지막에 가로 1번 썹니다.":"움직이는 칼 표시가 노란 중심에 들어왔을 때 SPACE 또는 썰기 버튼을 누르세요.",10);
    m.data=isTofu
      ?{marker:0,dir:1,speed:.78,hits:[],cuts:0,total:6,tofuStyle:true,zoneWidth:.14,zoneStarts:[.18,.56,.3,.67,.42,.22]}
      :{marker:0,dir:1,speed:.92,hits:[],cuts:0};
    if(isTofu)dom.miniTimer.textContent="0 / 6";
    dom.miniContent.innerHTML=isTofu
      ?`<div class="prep-work-object tofu-shape tofu-cook-object" id="tofuCookObject" aria-label="두부">${Array.from({length:5},(_,index)=>`<i class="cut-line" data-tofu-cut="${index}" style="left:${(index+1)/6*100}%"></i>`).join("")}<i class="cut-line tofu-horizontal-line" data-tofu-cut="5"></i><i class="knife-effect"></i></div><div class="prep-timing-bar"><i class="prep-success-zone" id="tofuSuccessZone" style="left:${m.data.zoneStarts[0]*100}%;width:${m.data.zoneWidth*100}%"></i><i id="miniMarker" class="prep-timing-marker"></i></div><div class="cut-count">세로 썰기 · 0 / 6</div><button class="mini-action" id="miniAction" type="button">두부 썰기</button>`
      :`<div class="progress-track"><i class="progress-zone" style="left:38%;width:24%"></i><i class="progress-perfect" style="left:47%;width:6%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">0 / 5회</div><button class="mini-action" id="miniAction" type="button">썰기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
  } else if(m.type==="heat") {
    const isOden=m.context.mode==="cook"&&m.context.dishId==="oden";
    set(m.context.mode==="prep"?"육수 온도 맞추기":isOden?"어묵탕 끓이기":"화력 조절",isOden?"작은 냄비의 어묵탕이 맛있게 끓도록 약불과 강불을 조절하세요.":"약불과 강불을 조절해 온도를 적정 구간에 오래 유지하세요.",8);
    m.data={value:.25,velocity:.08,inZone:0,total:0};
    dom.miniContent.innerHTML=`${isOden?`<div class="serving-oden-pot" aria-label="작은 냄비에서 끓고 있는 어묵탕"><i class="oden-steam steam-one"></i><i class="oden-steam steam-two"></i><div class="serving-oden-broth"><i class="serving-radish"></i><i class="serving-fishcake fishcake-one"></i><i class="serving-fishcake fishcake-two"></i><i class="serving-green-onion"></i></div><i class="serving-pot-handle left"></i><i class="serving-pot-handle right"></i></div>`:""}<div class="heat-wrap"><button id="heatDown" class="heat-button" type="button">−</button><div class="heat-gauge"><i class="heat-target"></i><i id="heatNeedle" class="heat-needle"></i></div><button id="heatUp" class="heat-button" type="button">＋</button></div><div class="cut-count">적정 온도 유지: <span id="zoneTime">0.0</span>초</div>`;
    dom.miniContent.querySelector("#heatDown").addEventListener("click",()=>{m.data.velocity-=.16;audio.click();});
    dom.miniContent.querySelector("#heatUp").addEventListener("click",()=>{m.data.velocity+=.16;audio.click();});
  } else if(m.type==="flip") {
    set("김치전 뒤집기","두 번의 타이밍을 정확히 맞추세요. 첫 번째는 반죽 펼치기, 두 번째는 뒤집기입니다.",9);
    m.data={marker:0,dir:1,speed:.78,round:0,hits:[]};
    dom.miniContent.innerHTML=`<div class="progress-track"><i class="progress-zone" style="left:35%;width:30%"></i><i class="progress-perfect" style="left:47%;width:6%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count" id="flipLabel">1단계 · 반죽 펼치기</div><button class="mini-action" id="miniAction" type="button">지금!</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
  } else if(m.type==="stir") {
    set("철판 볶기","표시된 방향 순서를 빠르게 입력해 면과 채소를 골고루 볶으세요.",10);
    const arrows=Array.from({length:8},()=>["←","↑","→","↓"][Math.floor(Math.random()*4)]); m.data={arrows,index:0,errors:0};
    renderArrowGame();
  } else if(m.type==="grill") {
    set("직화구이와 소스 바르기","먼저 굽기 타이밍을 맞춘 뒤 1→2→3 순서로 소스를 발라주세요.",11);
    m.data={phase:"timing",marker:0,dir:1,speed:.72,timingScore:0,sauceIndex:0}; renderGrillGame();
  } else if(m.type==="fry") {
    set("튀김기 건지기","색이 황금빛 구간에 들어왔을 때 바스켓을 들어 올리세요.",9);
    m.data={marker:0,dir:1,speed:.34};
    dom.miniContent.innerHTML=`<div class="progress-track"><i class="progress-zone" style="left:62%;width:25%"></i><i class="progress-perfect" style="left:70%;width:8%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">연한색 → 황금빛 → 탄색</div><button class="mini-action" id="miniAction" type="button">바스켓 들기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
  } else if(m.type==="dishwasher") {
    set("설거지","각 접시를 두 번 눌러 깨끗하게 닦으세요.",10);
    m.data={plates:Array(6).fill(0)}; renderPlates();
  } else if(m.type==="trash") {
    set("쓰레기 분리","표시된 쓰레기를 음식물 또는 일반 쓰레기로 분류하세요.",9);
    m.data={items:shuffle([{n:"채소 자투리",b:"food"},{n:"기름 묻은 종이",b:"normal"},{n:"생선 가시",b:"food"},{n:"비닐 포장",b:"normal"}]),index:0,correct:0}; renderTrash();
  }
  if(m.context.special&&Number.isFinite(m.data.speed))m.data.speed*=difficulty;
}

function renderIngredientChoices() {
  const m=state.mini; if(!m||m.type!=="collect"||m.data.showing) return;
  const pool=buildIngredientChoicePool(m.data.target);
  const wrap=dom.miniContent.querySelector("#ingredientChoices"); wrap.innerHTML="";
  pool.forEach(name=>{ const b=document.createElement("button");b.type="button";b.className="choice-button";b.textContent=name;b.addEventListener("click",()=>{
    const expected=m.data.target[m.data.input.length];
    if(name===expected){m.data.input.push(name);b.classList.add("correct");b.disabled=true;audio.click();dom.miniFeedback.textContent=`${m.data.input.length} / ${m.data.target.length}`;if(m.data.input.length===m.data.target.length) finishMini(Math.max(70,100-m.data.errors*15));}
    else {m.data.errors++;b.classList.add("wrong");setTimeout(()=>b.classList.remove("wrong"),250);audio.bad();dom.miniFeedback.textContent="순서가 달라요!";}
  });wrap.appendChild(b);});
}

function buildIngredientChoicePool(target,choiceCount=6){
  const required=[...new Set(target)];
  const allIngredients=[...new Set([
    ...Object.values(INGREDIENTS).flat(),
    "달걀","양파","버섯","소금"
  ])];
  const distractors=shuffle(allIngredients.filter(name=>!required.includes(name)))
    .slice(0,Math.max(0,choiceCount-required.length));
  return shuffle([...required,...distractors]);
}

function renderBubbleGrid() {
  const m=state.mini; if(!m) return;
  dom.miniContent.innerHTML=`<div class="bubble-grid" id="bubbleGrid"></div><div class="cut-count">남은 물방울 <span>${m.data.remaining}</span></div>`;
  const grid=dom.miniContent.querySelector("#bubbleGrid");
  for(let i=0;i<12;i++){const b=document.createElement("button");b.type="button";b.className="bubble-button";b.textContent="●";b.addEventListener("click",()=>{if(b.classList.contains("popped"))return;b.classList.add("popped");m.data.remaining--;audio.click();dom.miniContent.querySelector(".cut-count span").textContent=m.data.remaining;if(m.data.remaining<=0)finishMini(100);});grid.appendChild(b);}
}

function renderArrowGame() {
  const m=state.mini; if(!m) return;
  dom.miniContent.innerHTML=`<div class="sequence-view" id="arrowSequence">${m.data.arrows.map((a,i)=>`<span class="sequence-chip arrow-sequence-chip ${i===m.data.index?"current":""}" data-i="${i}">${a}</span>`).join("")}</div><div class="cut-count" id="arrowProgress">진행 ${m.data.index} / ${m.data.arrows.length}</div><div class="arrow-grid" id="arrowGrid"></div>`;
  const grid=dom.miniContent.querySelector("#arrowGrid");
  ["←","↑","→","↓"].forEach(a=>{const b=document.createElement("button");b.type="button";b.className="arrow-button";b.dataset.arrow=a;b.textContent=a;b.addEventListener("click",()=>arrowInput(a));grid.appendChild(b);});
}
function arrowInput(a) {
  const m=state.mini; if(!m||m.type!=="stir")return;
  const pressed=dom.miniContent.querySelector(`.arrow-button[data-arrow="${a}"]`);
  if(pressed){pressed.classList.remove("pressed");void pressed.offsetWidth;pressed.classList.add("pressed");setTimeout(()=>pressed.classList.remove("pressed"),150);}
  const expected=m.data.arrows[m.data.index];
  if(a===expected){
    const completed=dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);
    completed.classList.remove("current");completed.classList.add("correct");
    m.data.index++;
    const next=dom.miniContent.querySelector(`[data-i="${m.data.index}"]`);if(next)next.classList.add("current");
    const progress=dom.miniContent.querySelector("#arrowProgress");if(progress)progress.textContent=`진행 ${m.data.index} / ${m.data.arrows.length}`;
    audio.click();if(m.data.index===m.data.arrows.length)finishMini(Math.max(70,100-m.data.errors*12));
  }
  else{m.data.errors++;audio.bad();dom.miniFeedback.textContent="볶는 방향이 엇갈렸어요.";}
}

function renderGrillGame() {
  const m=state.mini; if(!m)return;
  if(m.data.phase==="timing"){
    dom.miniContent.innerHTML=`<div class="progress-track"><i class="progress-zone" style="left:38%;width:26%"></i><i class="progress-perfect" style="left:47%;width:7%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">직화로 속까지 익히기</div><button class="mini-action" id="miniAction" type="button">뒤집기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
  }else{
    dom.miniDescription.textContent="구운 재료 위에 1→2→3 순서로 소스를 고르게 발라주세요.";
    dom.miniContent.innerHTML=`<div class="grill-targets">${[1,2,3].map(n=>`<button class="sauce-target" data-n="${n}" type="button">${n}</button>`).join("")}</div>`;
    dom.miniContent.querySelectorAll(".sauce-target").forEach(b=>b.addEventListener("click",()=>{
      const n=Number(b.dataset.n);if(n!==m.data.sauceIndex+1){audio.bad();dom.miniFeedback.textContent="붓질 순서를 지켜주세요.";return;}b.classList.add("done");m.data.sauceIndex++;audio.click();if(m.data.sauceIndex===3)finishMini(Math.round((m.data.timingScore+100)/2));
    }));
  }
}

function renderPlates() {
  const m=state.mini; if(!m)return;
  dom.miniContent.innerHTML=`<div class="plate-grid" id="plateGrid"></div><div class="cut-count">접시를 반짝이게 닦아주세요</div>`;
  const grid=dom.miniContent.querySelector("#plateGrid");
  m.data.plates.forEach((v,i)=>{const b=document.createElement("button");b.type="button";b.className="plate-button";b.textContent=v===0?"기름때":"한 번 더";b.addEventListener("click",()=>{m.data.plates[i]++;audio.click();if(m.data.plates[i]>=2){b.classList.add("clean");b.textContent="반짝";b.disabled=true;}else b.textContent="한 번 더";if(m.data.plates.every(x=>x>=2))finishMini(100);});grid.appendChild(b);});
}
function renderTrash() {
  const m=state.mini; if(!m)return;
  const item=m.data.items[m.data.index];
  if(!item){finishMini(Math.round(m.data.correct/m.data.items.length*100));return;}
  dom.miniContent.innerHTML=`<div class="sequence-chip">${item.n}</div><div class="sort-area"><button class="sort-button" data-bin="food" type="button">음식물</button><button class="sort-button" data-bin="normal" type="button">일반</button></div>`;
  dom.miniContent.querySelectorAll(".sort-button").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.bin===item.b){m.data.correct++;audio.click();}else audio.bad();m.data.index++;renderTrash();}));
}

function miniAction() {
  const m=state.mini; if(!m)return;
  if(["chop","flip","fry"].includes(m.type)){
    if(m.type==="chop"&&m.data.tofuStyle){tofuChopAction(m);return;}
    const target=m.type==="fry"?.74:.5;
    const dist=Math.abs(m.data.marker-target);
    const score=Math.round(clamp(100-dist*260,25,100));
    if(m.type==="chop"){
      m.data.hits.push(score);m.data.cuts++;audio.click();dom.miniContent.querySelector(".cut-count").textContent=`${m.data.cuts} / 5회`;
      const tofuObject=dom.miniContent.querySelector("#tofuCookObject");
      if(tofuObject){
        tofuObject.querySelector(`[data-tofu-cut="${m.data.cuts-1}"]`)?.classList.add("done");
        tofuObject.classList.remove("slice-hit");void tofuObject.offsetWidth;tofuObject.classList.add("slice-hit");
      }
      m.data.marker=0;m.data.dir=1;m.data.speed+=.08;
      if(m.data.cuts>=5)finishMini(Math.round(m.data.hits.reduce((a,b)=>a+b,0)/m.data.hits.length));
    }else if(m.type==="flip"){
      m.data.hits.push(score);m.data.round++;audio.click();
      if(m.data.round>=2)finishMini(Math.round(m.data.hits.reduce((a,b)=>a+b,0)/2));
      else{m.data.marker=0;m.data.dir=1;m.data.speed+=.15;dom.miniContent.querySelector("#flipLabel").textContent="2단계 · 전 뒤집기";}
    }else if(m.type==="fry") finishMini(score);
  }else if(m.type==="grill" && m.data.phase==="timing"){
    const dist=Math.abs(m.data.marker-.5);m.data.timingScore=Math.round(clamp(100-dist*260,25,100));m.data.phase="sauce";audio.click();renderGrillGame();
  }
}

function tofuChopAction(m){
  const data=m.data,zoneStart=data.zoneStarts[data.cuts],zoneEnd=zoneStart+data.zoneWidth;
  if(data.marker<zoneStart||data.marker>zoneEnd){
    dom.miniFeedback.textContent="절단선을 놓쳤습니다. 초록 구간에서 다시 썰어주세요.";audio.bad();return;
  }
  const center=zoneStart+data.zoneWidth/2;
  data.hits.push(Math.round(clamp(100-Math.abs(data.marker-center)*300,70,100)));
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

function finishMini(score) {
  const m=state.mini;if(!m||m.complete)return;m.complete=true;score=Math.round(clamp(score,0,100));m.score=score;
  dom.miniFeedback.textContent=score>=90?`완벽해요! ${score}점`:score>=70?`좋아요! ${score}점`:`조금 아쉬워요. ${score}점`;
  score>=70?audio.success():audio.bad();
  setTimeout(()=>{if(state.mini===m)completeMiniContext(m,score);},650);
}
function completeMiniContext(m,score) {
  state.mini=null;dom.miniOverlay.classList.remove("open");
  if(m.context.mode==="story"){
    completeStoryCookStep(score);
    updateUI(true);
    return;
  }
  if(m.context.utility){
    if(m.type==="dishwasher"){state.dirtyDishes=0;state.cleanliness=clamp(state.cleanliness+12,0,100);showToast("식기가 깨끗해졌습니다.");}
    else{state.trash=0;state.cleanliness=clamp(state.cleanliness+8,0,100);showToast("쓰레기를 정리했습니다.");}
    updateUI(true);saveGame();return;
  }
  if(m.context.mode==="prep"){
    const run=state.prepRun; if(!run)return;run.scores.push(score);run.stepIndex++;
    const dish=dishById(run.dishId);
    state.trash=Math.min(6,state.trash+(m.stationId==="board"?1:0));
    if(run.stepIndex>=dish.prep.length){
      const q=Math.round(run.scores.reduce((a,b)=>a+b,0)/run.scores.length);const inv=state.inventory[dish.id];
      const newCount=inv.count+3;inv.quality=Math.round((inv.quality*inv.count+q*3)/newCount);inv.count=newCount;state.prepRun=null;
      spawnPopup(state.player.x,state.player.y-70,`${dish.name} +3 · 품질 ${q}`);showToast(`${dish.name} 3인분 준비 완료!`);audio.success();
    }else showToast(`다음 단계: ${STATIONS[dish.prep[run.stepIndex]].label}`);
  }else if(m.context.mode==="cook"){
    const order=state.orders.find(o=>o.id===m.context.orderId);if(!order)return;order.cookScores.push(score);order.cookStep++;
    const dish=dishById(order.dishId);state.trash=Math.min(6,state.trash+(m.stationId==="fryer"?1:0));
    if(order.cookStep>=dish.cook.length){
      state.inventory[dish.id].count--;state.carrying={orderId:order.id,dishId:dish.id,cookScore:Math.round(order.cookScores.reduce((a,b)=>a+b,0)/order.cookScores.length)};
      showToast(`${dish.name} 완성! 주문한 손님에게 가져다주세요.`);spawnPopup(state.player.x,state.player.y-75,"완성!");
    }else showToast(`다음 조리: ${STATIONS[dish.cook[order.cookStep].station].label}`);
  }
  updateUI(true);saveGame();
}

function update(dt) {
  if(state.paused){
    if(state.mini){updateMini(dt);updateUI(false);}
    return;
  }
  if(state.phase==="night"){
    if(!storyCookingIsActive())state.phaseTime-=dt;
    if(state.phaseTime<=0){state.phaseTime=0;endNight();return;}
    state.orders.forEach(order=>order.entered=clamp(order.entered+dt*2.1,0,1));
    state.respawns.forEach(r=>r.time-=dt);const ready=state.respawns.filter(r=>r.time<=0);state.respawns=state.respawns.filter(r=>r.time>0);ready.forEach(r=>spawnOrder(r.slot));
    if(state.trash>=4)state.cleanliness=clamp(state.cleanliness-dt*.45,0,100);
    const noActiveOrders=state.orders.length===0&&!state.carrying&&state.respawns.length===0;
    if(noActiveOrders&&(state.spawnedCustomers>=state.nightCustomerTarget||!hasOrderableStock())){endNight();return;}
  }
  state.orders.forEach(order=>{
    order.waitingTime=(order.waitingTime||0)+dt;
    if(order.bubbleTime>0)order.bubbleTime=Math.max(0,order.bubbleTime-dt);
    else if(!order.waitingBubbleShown&&order.waitingTime>=12){order.waitingBubbleShown=true;order.bubble=pickGeneralGuestBubble("waiting");order.bubbleTime=4;}
  });
  state.departures.forEach(item=>item.life-=dt);state.departures=state.departures.filter(item=>item.life>0);
  updateMini(dt);updatePlayer(dt);updateParticles(dt);autoDelivery();updateUI(false);
  updateAutosave(dt);
}

function updateMini(dt) {
  const m=state.mini;if(!m||m.complete)return;
  if(isDayPrepMini(m)){updateDayPrepMini(dt);return;}
  if(!m.data.tofuStyle){m.time-=dt;dom.miniTimer.textContent=Math.max(0,m.time).toFixed(1);}
  if(m.type==="chop"||m.type==="flip"||m.type==="fry"||(m.type==="grill"&&m.data.phase==="timing")){
    m.data.marker+=m.data.dir*m.data.speed*dt;if(m.data.marker>=1){m.data.marker=1;m.data.dir=-1;}if(m.data.marker<=0){m.data.marker=0;m.data.dir=1;}
    const marker=dom.miniContent.querySelector("#miniMarker");if(marker)marker.style.left=`${m.data.marker*100}%`;
  }else if(m.type==="heat"){
    m.data.total+=dt;m.data.velocity+=.035*dt;m.data.velocity*=.985;m.data.value=clamp(m.data.value+m.data.velocity*dt,0,1);
    if(m.data.value===0||m.data.value===1)m.data.velocity*=-.45;
    if(m.data.value>=.43&&m.data.value<=.63)m.data.inZone+=dt;
    const needle=dom.miniContent.querySelector("#heatNeedle");if(needle)needle.style.left=`${m.data.value*100}%`;
    const zone=dom.miniContent.querySelector("#zoneTime");if(zone)zone.textContent=m.data.inZone.toFixed(1);
  }
  if(m.time<=0){
    if(m.type==="heat")finishMini(Math.round(clamp(m.data.inZone/5*100,25,100)));
    else if(m.type==="trash")finishMini(Math.round(m.data.correct/m.data.items.length*100));
    else if(m.type==="wash")finishMini(Math.round((12-m.data.remaining)/12*100));
    else if(m.type==="dishwasher")finishMini(Math.round(m.data.plates.reduce((a,b)=>a+Math.min(b,2),0)/12*100));
    else finishMini(m.score||35);
  }
}

// updatePlayer(), movePlayer()          → player.js
// updateParticles(), spawnPopup()        → fx.js

function showToast(text,bad=false){dom.toast.textContent=text;dom.toast.classList.toggle("bad",bad);dom.toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>dom.toast.classList.remove("show"),1800);}

function updateUI(force=false) {
  if(state.screen!=="game")return;
  dom.gameApp.classList.remove("phase-title");
  dom.gameApp.classList.toggle("phase-prep",state.phase===GAME_PHASES.PREP);
  dom.gameApp.classList.toggle("phase-open",state.phase===GAME_PHASES.OPEN);
  dom.gameApp.classList.toggle("phase-result",state.phase===GAME_PHASES.RESULT);
  const phaseLabels={[GAME_PHASES.MENU_SELECT]:"메뉴 선택",[GAME_PHASES.PREP]:"낮 재료 준비",[GAME_PHASES.OPEN]:"밤 영업",[GAME_PHASES.RESULT]:"영업 종료"};
  dom.phaseName.textContent=phaseLabels[state.phase]||"영업 준비";
  dom.dayText.textContent=state.day;dom.timeLabel.textContent=state.phase===GAME_PHASES.PREP?"준비":"남은 시간";dom.timeText.textContent=state.phase===GAME_PHASES.PREP?"제한 없음":state.phase===GAME_PHASES.OPEN?formatTime(state.phaseTime):"-";dom.moneyText.textContent=`${state.money.toLocaleString()}원`;dom.popularityText.textContent=state.popularity;dom.satisfactionText.textContent=state.served?`${avgSatisfaction()}점`:"-";
  dom.phaseBadge.textContent=state.phase===GAME_PHASES.PREP?"준비":state.phase===GAME_PHASES.OPEN?"영업 중":state.phase===GAME_PHASES.MENU_SELECT?"선택":"정산";dom.leftTitle.textContent=state.phase===GAME_PHASES.PREP?"오늘의 준비":"현재 주문";
  dom.phaseButton.style.display=state.phase===GAME_PHASES.PREP?"block":"none";dom.phaseButton.textContent="영업 시작";dom.phaseButton.disabled=state.phase===GAME_PHASES.PREP&&(!prepComplete()||!!state.mini);
  dom.cleanlinessText.textContent=Math.round(state.cleanliness);dom.cleanlinessBar.style.width=`${state.cleanliness}%`;dom.cleaningText.textContent=`설거지 ${state.dirtyDishes} · 쓰레기 ${state.trash}`;
  const menuSignature=selectedDishes().map(dish=>dish.id).join("|");
  const renderedMenuSignature=[...dom.menuCards.children].map(card=>card.dataset.id).join("|");
  if(force||menuSignature!==renderedMenuSignature)buildMenuCards();
  if(state.phase===GAME_PHASES.MENU_SELECT)renderMenuSelection();
  else if(state.phase===GAME_PHASES.PREP){renderPrepChecklist();updateDayObjective();}
  else if(state.phase===GAME_PHASES.OPEN){renderNightOrderList();updateNightObjective();}
  updateRelationshipUI();
  updatePrompt();
}
function updatePrompt(){
  const prompt=dom.stationPrompt;
  const hide=(mobileAction=false)=>{prompt.classList.remove("show");prompt.disabled=true;dom.actionButton.classList.toggle("available",mobileAction);};
  if(state.paused||!["day","night"].includes(state.phase)){hide();return;}
  if(state.mini){hide(true);return;}
  let text="",x=0,y=0;
  if(state.phase==="night"&&state.carrying){
    const order=state.orders.find(o=>o.id===state.carrying.orderId);
    const station=nearestStation();
    const dish=dishById(state.carrying.dishId);
    if(station?.id==="trash"&&dish&&state.inventory[dish.id]?.count>0){
      text=`E · ${dish.name} 폐기`;
      x=station.ix;y=station.y+station.h+60;
    }else if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],CUSTOMER_SERVICE_Y)<=82){
      text=`E · ${order.slot+1}번 손님에게 서빙`;
      x=CUSTOMER_SEATS[order.slot];y=470;
    }
  }else{
    if(state.phase==="day"){
      const prepObject=nearestPrepObject();
      if(prepObject){text=`E · ${prepObject.task.objectLabel}`;x=prepObject.x;y=prepObject.y-58;}
    }else{
      const station=nearestStation();
      if(station){
      const required=currentRequirement();
      if(station.id==="dishwasher"&&state.dirtyDishes>0)text="E · 설거지하기";
      else if(station.id==="trash"&&state.trash>0)text="E · 쓰레기 정리";
      else if(station.id===required)text=`E · ${station.label} 사용`;
      if(text){x=station.ix;y=station.y+station.h+60;}
      }
    }
  }
  if(!text){hide();return;}
  prompt.textContent=text;prompt.disabled=false;
  prompt.style.left=`${x/W*100}%`;prompt.style.top=`${y/H*100}%`;
  prompt.classList.add("show");
  dom.actionButton.classList.add("available");
}

function draw(){
  if(!ctx)return;
  syncStageTimeOfDay(state.phase);

  // 프레임 캔버스는 요리사를 사이에 두고 앞뒤 두 장입니다. (draw-utils.js)
  // 같은 층 안에서는 그리는 순서가 곧 앞뒤 관계입니다.

  beginBackLayer();      // ── 요리사(25)보다 뒤 ──────────────
  drawStations();        // kitchen.js   주방 집기 몸통

  beginFrontLayer();     // ── 요리사·카운터보다 앞 ───────────
  drawStationLabels();   // kitchen.js   집기 이름표 (요리사에 가리면 안 됨)
  drawSignage();         // signage.js   영업중 간판
  drawPrepObjects();     // prep.js      낮 준비물
  drawCustomers();       // customers.js 손님
  drawGuidance();        // fx.js        안내 화살표
  drawParticles();       // fx.js        파티클·팝업

  commitFrame();         // draw-utils.js
}

// syncPhaserObjects()  → player.js
// drawStations/drawStation/drawSteam → kitchen.js
// drawFrontFixtures → signage.js (drawSignage)
// drawPrepObjects → prep.js
// drawCustomers/Sprite/Speech → customers.js
// drawGuidance/drawParticles → fx.js
// drawFixtureLabel/drawFoodIcon/roundRect/wrapCanvasText → draw-utils.js

dom.settingsButton.addEventListener("click",()=>openSettings("game"));
dom.resumeButton.addEventListener("click",closeSettings);
dom.phaseButton.addEventListener("click",beginNight);
dom.nextDayButton.addEventListener("click",advanceToNextDay);
dom.menuSelectConfirm.addEventListener("click",confirmMenuSelection);
dom.actionButton.addEventListener("click",()=>{if(state.mini){if(isDayPrepMini(state.mini))dayPrepPrimaryAction();else miniAction();}else interact();});
dom.miniClose.addEventListener("click",closeDayPrepMini);
dom.stationPrompt.addEventListener("click",interact);

[[dom.masterVolume,"master",dom.masterVolumeValue],[dom.bgmVolume,"bgm",dom.bgmVolumeValue],[dom.sfxVolume,"sfx",dom.sfxVolumeValue]].forEach(([input,key,label])=>input.addEventListener("input",()=>{state.audio[key]=Number(input.value)/100;label.textContent=`${input.value}%`;audio.apply();}));

window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.code==="Space")e.preventDefault();
  if(state.mini){
    if(isDayPrepMini(state.mini)){
      if(k==="escape")closeDayPrepMini();
      else if(e.code==="Space")dayPrepPrimaryAction();
      else if(k==="arrowleft"||k==="arrowright")dayPrepDirectionInput(k.replace("arrow",""));
      return;
    }
    if(e.code==="Space")miniAction();
    if(state.mini?.type==="stir"){const map={arrowleft:"←",arrowup:"↑",arrowright:"→",arrowdown:"↓"};if(map[k])arrowInput(map[k]);}
    if(state.mini?.type==="heat"){if(k==="arrowleft"||k==="a")state.mini.data.velocity-=.16;if(k==="arrowright"||k==="d")state.mini.data.velocity+=.16;}
    return;
  }
  if(storyDialogueIsActive()){
    if(k==="e"||k==="enter")storyAdvance();
    return;
  }
  if(k==="escape"){
    if(dom.settingsOverlay.classList.contains("open"))closeSettings();else if(state.screen==="game")openSettings("game");return;
  }
  if(k==="e"){interact();return;}
  if(state.phase==="night"&&["1","2","3","4"].includes(k)){const order=state.orders.find(o=>o.slot===Number(k)-1);if(order)selectOrder(order.id);return;}
});
function beginJoystick(e){if(state.paused)return;joystickPointer=e.pointerId;dom.joystick.setPointerCapture(e.pointerId);moveJoystick(e);}
function moveJoystick(e){if(e.pointerId!==joystickPointer)return;const r=dom.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.31,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len),px=dx*scale,py=dy*scale;dom.joystickKnob.style.transform=`translate(${px}px,${py}px)`;state.joyX=clamp(dx/max,-1,1);state.joyY=clamp(dy/max,-1,1);}
function endJoystick(e){if(e.pointerId!==joystickPointer)return;joystickPointer=null;state.joyX=0;state.joyY=0;dom.joystickKnob.style.transform="translate(0,0)";}
dom.joystick.addEventListener("pointerdown",beginJoystick);dom.joystick.addEventListener("pointermove",moveJoystick);dom.joystick.addEventListener("pointerup",endJoystick);dom.joystick.addEventListener("pointercancel",endJoystick);

class DinerScene extends Phaser.Scene {
  constructor(){super("DinerScene");}

  create(){
    phaserScene=this;
    this.textures.addSpriteSheet("chef",images.chef,{frameWidth:48,frameHeight:64});
    this.textures.addSpriteSheet("customers",images.customers,{frameWidth:44,frameHeight:60});
    this.textures.addSpriteSheet("food",images.food,{frameWidth:64,frameHeight:64});

    // 배경 → 카운터 → 프레임 캔버스 → 요리사 순서로 만듭니다.
    createStage(this);        // stage.js
    createCounter(this);      // counter.js
    createFrameCanvas(this);  // draw-utils.js  (ctx 준비)
    createPlayer(this);       // player.js

    markTitleGameReady();
    buildMenuCards();showGameHud(false);dom.titleScreen.classList.add("active");dom.gameScreen.classList.remove("active");updateUI(true);draw();syncPhaserObjects();
    setTimeout(runStoryQaFromQuery,0);
  }

  update(time,delta){
    update(Math.min(.033,delta/1000));
    draw();
    syncPhaserObjects();
    // 카운터 연출은 VIEW 좌표를 쓰므로 플레이어 위치를 변환해서 넘깁니다.
    // 마지막 인자는 영업 중 여부. 준비 시간에는 수저통을 치웁니다.
    updateCounter(time,delta,{x:toView(state.player.x),y:toView(state.player.y)},
      state.phase==="night"||state.phase==="result");
  }
}

function bootPhaser(){
  // 화면 크기·렌더 품질 설정은 stage.js 의 stageGameConfig() 에 있습니다.
  return new Phaser.Game(stageGameConfig(DinerScene));
}

initializeStoryUI();
initializeSaveSystem();
initializeTitleScreen();

Promise.all([
  loadNativeImage("chef","assets/chef_sheet.png"),
  loadNativeImage("customers","assets/customer_sheet.png"),
  loadNativeImage("food","assets/food_sheet.png"),
  loadStageAssets(),
  loadCounterAssets(),
  loadDayPrepAssets()
]).then(bootPhaser).catch(error=>{
  console.error(error);
  markTitleLoadFailed();
});
