"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

const dom = Object.fromEntries([
  "appRoot","titleScreen","gameScreen","gameApp","topHud","leftHud","rightHud","mobileControls","phaseName","dayText","timeText","satisfactionText","moneyText",
  "settingsButton","menuCards","leftTitle","phaseBadge","inventoryList","phaseButton","objectiveTitle","objectiveBody",
  "cleanlinessText","cleanlinessBar","cleaningText","stationPrompt","toast","startButton","titleSettingsButton",
  "settingsOverlay","pauseMessage","masterVolume","masterVolumeValue","bgmVolume","bgmVolumeValue","sfxVolume","sfxVolumeValue",
  "resumeButton","returnTitleButton","miniOverlay","miniStation","miniTitle","miniTimer","miniDescription","miniContent","miniFeedback",
  "resultOverlay","servedResult","satisfactionResult","fiveStarResult","revenueResult","resultComment","nextDayButton",
  "joystick","joystickKnob","actionButton"
].map(id => [id, document.getElementById(id)]));

const images = {};
function loadImage(key, src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { images[key] = img; resolve(); };
    img.onerror = () => { images[key] = null; resolve(); };
    img.src = src;
  });
}
Promise.all([
  loadImage("chef", "assets/chef_sheet.png"),
  loadImage("customers", "assets/customer_sheet.png"),
  loadImage("food", "assets/food_sheet.png")
]).then(() => requestAnimationFrame(loop));

const INGREDIENTS = {
  kimchi: ["김치", "부침가루", "대파"],
  skewer: ["닭고기", "대파", "파프리카"],
  yakisoba: ["면", "양배추", "당근"],
  tofu: ["두부", "김치", "돼지고기"],
  oden: ["어묵", "무", "대파"],
  teriyaki: ["닭고기", "전분", "데리야끼 소스"]
};

const DISHES = [
  { id:"kimchi", name:"김치전", icon:0, prep:["fridge","sink","board"], cook:[{station:"gas", game:"flip"}], price:6200 },
  { id:"skewer", name:"닭꼬치", icon:1, prep:["fridge","sink","board"], cook:[{station:"grill", game:"grill"}], price:7200 },
  { id:"yakisoba", name:"야끼소바", icon:2, prep:["fridge","sink","board"], cook:[{station:"gas", game:"stir"}], price:8200 },
  { id:"tofu", name:"두부김치", icon:3, prep:["fridge","sink","board"], cook:[{station:"gas", game:"heat"}], price:8800 },
  { id:"oden", name:"오뎅탕", icon:4, prep:["fridge","sink","board","gas"], cook:[{station:"gas", game:"heat"}], price:7800 },
  { id:"teriyaki", name:"데리야끼", icon:5, prep:["fridge","sink","board"], cook:[{station:"fryer", game:"fry"},{station:"grill", game:"grill"}], price:9500 }
];

const STATIONS = {
  // 냉장고는 예시 화면처럼 왼쪽 벽에 세로로 배치
  fridge: { id:"fridge", label:"냉장고", x:195, y:205, w:105, h:230, ix:335, iy:405, facing:"left" },
  // 나머지 집기는 모두 12시 방향 벽을 따라 일렬 배치
  sink: { id:"sink", label:"싱크대", x:330, y:205, w:115, h:82, ix:388, iy:338, facing:"up" },
  board: { id:"board", label:"도마", x:455, y:205, w:110, h:82, ix:510, iy:338, facing:"up" },
  gas: { id:"gas", label:"가스버너", x:575, y:200, w:115, h:88, ix:633, iy:338, facing:"up" },
  grill: { id:"grill", label:"직화구이", x:700, y:200, w:125, h:88, ix:763, iy:338, facing:"up" },
  fryer: { id:"fryer", label:"튀김기", x:835, y:200, w:95, h:88, ix:883, iy:338, facing:"up" },
  dishwasher: { id:"dishwasher", label:"식기세척기", x:940, y:200, w:80, h:88, ix:980, iy:338, facing:"up" },
  trash: { id:"trash", label:"쓰레기통", x:1030, y:205, w:60, h:83, ix:1060, iy:338, facing:"up" }
};

const CUSTOMER_SEATS = [455, 620, 785, 950];
const WALK_BOUNDS = { left:315, right:1090, top:325, bottom:610 };
const keys = new Set();
let lastTime = performance.now();
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
  phaseTime:120,
  money:0,
  selectedDishId:"kimchi",
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
  mini:null,
  particles:[],
  popups:[],
  autoInteractStation:null,
  player:{ x:620, y:500, targetX:null, targetY:null, facing:"down", moving:false, frame:0, frameClock:0, speed:205 },
  audio:{ master:.70, bgm:.45, sfx:.75 }
};

function dishById(id) { return DISHES.find(d => d.id === id); }
function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t) { return a+(b-a)*t; }
function distance(a,b,c,d) { return Math.hypot(a-c,b-d); }
function shuffle(arr) { return [...arr].sort(() => Math.random()-.5); }
function formatTime(sec) { sec=Math.max(0,Math.ceil(sec)); return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; }
function avgSatisfaction() { return state.served ? Math.round(state.satisfactionTotal/state.served) : 0; }

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

function startGame() {
  audio.init(); if(audio.ctx?.state==="suspended") audio.ctx.resume();
  state.screen="game"; state.phase="day"; state.paused=false; state.settingsFrom="game";
  state.day=1; state.money=0; resetDay(true);
  dom.titleScreen.classList.remove("active");
  dom.gameScreen.classList.add("active");
  showGameHud(true); audio.startBgm(); audio.success();
}

function resetDay(first=false) {
  state.phase="day"; state.phaseTime=120; state.selectedDishId="kimchi"; state.selectedOrderId=null;
  state.inventory=Object.fromEntries(DISHES.map(d => [d.id,{count:0,quality:0}]));
  state.prepRun=null; state.orders=[]; state.respawns=[]; state.carrying=null;
  state.served=0; state.satisfactionTotal=0; state.fiveStar=0; state.cleanliness=100; state.dirtyDishes=0; state.trash=0;
  state.mini=null; state.player.x=620; state.player.y=500; state.player.targetX=null; state.player.targetY=null;
  dom.resultOverlay.classList.remove("open"); dom.miniOverlay.classList.remove("open");
  if(!first) showToast(`${state.day}일차 낮 준비를 시작합니다.`);
  buildMenuCards(); updateUI(true);
}

function beginNight() {
  const total=Object.values(state.inventory).reduce((s,v)=>s+v.count,0);
  if(total===0){ showToast("먼저 한 가지 이상의 메뉴를 준비하세요.",true); return; }
  state.phase="night"; state.phaseTime=150; state.prepRun=null; state.selectedOrderId=null; state.carrying=null;
  state.player.x=620; state.player.y=460; state.orders=[]; state.respawns=[];
  for(let i=0;i<4;i++) spawnOrder(i);
  showToast("밤 영업 시작! 맛있는 한 접시를 완성하세요."); audio.success(); updateUI(true);
}

function endNight() {
  state.phase="result"; state.paused=true; state.mini=null; dom.miniOverlay.classList.remove("open");
  dom.servedResult.textContent=state.served;
  dom.satisfactionResult.textContent=`${avgSatisfaction()}점`;
  dom.fiveStarResult.textContent=state.fiveStar;
  dom.revenueResult.textContent=`${state.money.toLocaleString()}원`;
  const avg=avgSatisfaction();
  dom.resultComment.textContent=avg>=90?"손님들이 오늘의 안주를 오래 기억할 것 같습니다.":avg>=75?"정성스러운 한 접시가 손님들에게 잘 전해졌습니다.":"재료 준비와 조리 타이밍을 조금 더 다듬어 보세요.";
  dom.resultOverlay.classList.add("open"); audio.serve(); updateUI(true);
}

function returnTitle() {
  state.screen="title"; state.phase="title"; state.paused=true; state.mini=null; state.orders=[]; state.carrying=null;
  dom.settingsOverlay.classList.remove("open"); dom.resultOverlay.classList.remove("open"); dom.miniOverlay.classList.remove("open");
  dom.gameScreen.classList.remove("active");
  dom.titleScreen.classList.add("active");
  showGameHud(false); audio.stopBgm();
}

function openSettings(from=state.screen) {
  state.settingsFrom=from; state.paused=true; dom.pauseMessage.textContent=from==="title"?"소리 설정을 변경할 수 있습니다.":"게임이 일시정지되었습니다.";
  dom.returnTitleButton.style.display=from==="title"?"none":"block";
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
  DISHES.forEach(dish=>{
    const b=document.createElement("button"); b.type="button"; b.className="menu-card"; b.dataset.id=dish.id;
    b.innerHTML=`<strong>${dish.name}</strong><span class="food-icon" style="background-position:${dish.icon*20}% 0"></span><span class="stock">0</span>`;
    b.addEventListener("click",()=>{
      if(state.phase!=="day" || state.paused || state.mini) return;
      state.selectedDishId=dish.id; state.prepRun=null; audio.click(); updateUI(true);
    });
    dom.menuCards.appendChild(b);
  });
}

function spawnOrder(slot) {
  const available=DISHES.filter(d=>state.inventory[d.id].count>0);
  if(!available.length) return;
  const dish=available[Math.floor(Math.random()*available.length)];
  state.orders.push({ id:nextOrderId++, slot, dishId:dish.id, variant:Math.floor(Math.random()*6), entered:0, cookStep:0, cookScores:[] });
  if(state.selectedOrderId==null) state.selectedOrderId=state.orders[state.orders.length-1].id;
}

function selectOrder(id) {
  if(state.carrying){ showToast("먼저 들고 있는 음식을 주문한 손님에게 가져다주세요.",true); return; }
  const order=state.orders.find(o=>o.id===id); if(!order) return;
  state.selectedOrderId=id; audio.click(); updateUI(true);
}

function currentOrder() { return state.orders.find(o=>o.id===state.selectedOrderId) || null; }
function currentRequirement() {
  if(state.phase==="day") {
    const dish=dishById(state.selectedDishId);
    if(!state.prepRun || state.prepRun.dishId!==dish.id) return dish.prep[0];
    return dish.prep[state.prepRun.stepIndex] || null;
  }
  if(state.phase==="night") {
    if(state.carrying) return null;
    const order=currentOrder(); if(!order) return null;
    return dishById(order.dishId).cook[order.cookStep]?.station || null;
  }
  return null;
}

function nearStation(station) { return distance(state.player.x,state.player.y,station.ix,station.iy)<58; }
function nearestStation() {
  let best=null, bestD=999;
  Object.values(STATIONS).forEach(s=>{ const d=distance(state.player.x,state.player.y,s.ix,s.iy); if(d<bestD){best=s;bestD=d;} });
  return bestD<64?best:null;
}

function interact() {
  if(state.paused || state.mini || !["day","night"].includes(state.phase)) return;
  if(state.phase==="night" && state.carrying) { tryDeliver(); return; }
  const station=nearestStation();
  if(!station){ showToast("사용할 집기 가까이 이동하세요.",true); return; }
  if(station.id==="dishwasher") { if(state.dirtyDishes<=0){showToast("씻을 그릇이 없습니다.");return;} startMini("dishwasher",station.id,{utility:true}); return; }
  if(station.id==="trash") { if(state.trash<=0){showToast("버릴 쓰레기가 없습니다.");return;} startMini("trash",station.id,{utility:true}); return; }
  const required=currentRequirement();
  if(station.id!==required){ showToast(`지금은 ${required?STATIONS[required].label:"주문 선택"} 단계입니다.`,true); return; }
  if(state.phase==="day") startPrepMini(station.id); else startCookMini(station.id);
}

function startPrepMini(stationId) {
  const dish=dishById(state.selectedDishId);
  if(!state.prepRun || state.prepRun.dishId!==dish.id) state.prepRun={dishId:dish.id,stepIndex:0,scores:[]};
  const game={fridge:"collect",sink:"wash",board:"chop",gas:"heat"}[stationId];
  startMini(game,stationId,{mode:"prep",dishId:dish.id});
}
function startCookMini(stationId) {
  const order=currentOrder(); if(!order) return;
  const dish=dishById(order.dishId);
  if(state.inventory[dish.id].count<=0){ showToast(`${dish.name} 준비 재료가 모두 소진되었습니다.`,true); return; }
  const step=dish.cook[order.cookStep];
  startMini(step.game,stationId,{mode:"cook",orderId:order.id,dishId:dish.id});
}

function startMini(type,stationId,context) {
  state.mini={type,stationId,context,time:8,score:0,data:{},complete:false};
  dom.miniStation.textContent=STATIONS[stationId].label;
  dom.miniFeedback.textContent=""; dom.miniContent.innerHTML=""; dom.miniOverlay.classList.add("open");
  setupMini(); audio.click();
}

function setupMini() {
  const m=state.mini; if(!m) return;
  const dish=dishById(m.context.dishId || state.selectedDishId);
  const set=(title,desc,time)=>{dom.miniTitle.textContent=title;dom.miniDescription.textContent=desc;m.time=time;dom.miniTimer.textContent=time.toFixed(1);};
  if(m.type==="collect") {
    set("재료 꺼내기","잠깐 보여주는 재료 순서를 기억한 뒤 같은 순서로 선택하세요.",10);
    const target=shuffle(INGREDIENTS[dish.id]).slice(0,3); m.data={target,input:[],errors:0,showing:true};
    dom.miniContent.innerHTML=`<div class="sequence-view">${target.map(x=>`<span class="sequence-chip">${x}</span>`).join("")}</div><div class="choice-grid" id="ingredientChoices"></div>`;
    setTimeout(()=>{ if(state.mini===m){m.data.showing=false; dom.miniContent.querySelector(".sequence-view").innerHTML="<span class='sequence-chip'>순서를 입력하세요</span>"; renderIngredientChoices();}},1400);
  } else if(m.type==="wash") {
    set("재료 씻기","떠오르는 물방울을 모두 눌러 재료를 깨끗하게 씻으세요.",8);
    m.data={remaining:12}; renderBubbleGrid();
  } else if(m.type==="chop") {
    set("정밀 손질","움직이는 칼 표시가 노란 중심에 들어왔을 때 SPACE 또는 썰기 버튼을 누르세요.",10);
    m.data={marker:0,dir:1,speed:.92,hits:[],cuts:0};
    dom.miniContent.innerHTML=`<div class="progress-track"><i class="progress-zone" style="left:38%;width:24%"></i><i class="progress-perfect" style="left:47%;width:6%"></i><i id="miniMarker" class="progress-marker"></i></div><div class="cut-count">0 / 5회</div><button class="mini-action" id="miniAction" type="button">썰기</button>`;
    dom.miniContent.querySelector("#miniAction").addEventListener("click",miniAction);
  } else if(m.type==="heat") {
    set(m.context.mode==="prep"?"육수 온도 맞추기":"화력 조절","약불과 강불을 조절해 온도를 적정 구간에 오래 유지하세요.",8);
    m.data={value:.25,velocity:.08,inZone:0,total:0};
    dom.miniContent.innerHTML=`<div class="heat-wrap"><button id="heatDown" class="heat-button" type="button">−</button><div class="heat-gauge"><i class="heat-target"></i><i id="heatNeedle" class="heat-needle"></i></div><button id="heatUp" class="heat-button" type="button">＋</button></div><div class="cut-count">적정 온도 유지: <span id="zoneTime">0.0</span>초</div>`;
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
}

function renderIngredientChoices() {
  const m=state.mini; if(!m||m.type!=="collect"||m.data.showing) return;
  const pool=shuffle([...new Set([...m.data.target,"달걀","양파","버섯","소금"])]).slice(0,6);
  const wrap=dom.miniContent.querySelector("#ingredientChoices"); wrap.innerHTML="";
  pool.forEach(name=>{ const b=document.createElement("button");b.type="button";b.className="choice-button";b.textContent=name;b.addEventListener("click",()=>{
    const expected=m.data.target[m.data.input.length];
    if(name===expected){m.data.input.push(name);b.classList.add("correct");b.disabled=true;audio.click();dom.miniFeedback.textContent=`${m.data.input.length} / ${m.data.target.length}`;if(m.data.input.length===m.data.target.length) finishMini(Math.max(70,100-m.data.errors*15));}
    else {m.data.errors++;b.classList.add("wrong");setTimeout(()=>b.classList.remove("wrong"),250);audio.bad();dom.miniFeedback.textContent="순서가 달라요!";}
  });wrap.appendChild(b);});
}

function renderBubbleGrid() {
  const m=state.mini; if(!m) return;
  dom.miniContent.innerHTML=`<div class="bubble-grid" id="bubbleGrid"></div><div class="cut-count">남은 물방울 <span>${m.data.remaining}</span></div>`;
  const grid=dom.miniContent.querySelector("#bubbleGrid");
  for(let i=0;i<12;i++){const b=document.createElement("button");b.type="button";b.className="bubble-button";b.textContent="●";b.addEventListener("click",()=>{if(b.classList.contains("popped"))return;b.classList.add("popped");m.data.remaining--;audio.click();dom.miniContent.querySelector(".cut-count span").textContent=m.data.remaining;if(m.data.remaining<=0)finishMini(100);});grid.appendChild(b);}
}

function renderArrowGame() {
  const m=state.mini; if(!m) return;
  dom.miniContent.innerHTML=`<div class="sequence-view" id="arrowSequence">${m.data.arrows.map((a,i)=>`<span class="sequence-chip" data-i="${i}">${a}</span>`).join("")}</div><div class="arrow-grid" id="arrowGrid"></div>`;
  const grid=dom.miniContent.querySelector("#arrowGrid");
  ["←","↑","→","↓"].forEach(a=>{const b=document.createElement("button");b.type="button";b.className="arrow-button";b.textContent=a;b.addEventListener("click",()=>arrowInput(a));grid.appendChild(b);});
}
function arrowInput(a) {
  const m=state.mini; if(!m||m.type!=="stir")return;
  const expected=m.data.arrows[m.data.index];
  if(a===expected){dom.miniContent.querySelector(`[data-i="${m.data.index}"]`).classList.add("correct");m.data.index++;audio.click();if(m.data.index===m.data.arrows.length)finishMini(Math.max(70,100-m.data.errors*12));}
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
    const target=m.type==="fry"?.74:.5;
    const dist=Math.abs(m.data.marker-target);
    const score=Math.round(clamp(100-dist*260,25,100));
    if(m.type==="chop"){
      m.data.hits.push(score);m.data.cuts++;audio.click();dom.miniContent.querySelector(".cut-count").textContent=`${m.data.cuts} / 5회`;
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

function finishMini(score) {
  const m=state.mini;if(!m||m.complete)return;m.complete=true;score=Math.round(clamp(score,0,100));m.score=score;
  dom.miniFeedback.textContent=score>=90?`완벽해요! ${score}점`:score>=70?`좋아요! ${score}점`:`조금 아쉬워요. ${score}점`;
  score>=70?audio.success():audio.bad();
  setTimeout(()=>{if(state.mini===m)completeMiniContext(m,score);},650);
}
function completeMiniContext(m,score) {
  state.mini=null;dom.miniOverlay.classList.remove("open");
  if(m.context.utility){
    if(m.type==="dishwasher"){state.dirtyDishes=0;state.cleanliness=clamp(state.cleanliness+12,0,100);showToast("식기가 깨끗해졌습니다.");}
    else{state.trash=0;state.cleanliness=clamp(state.cleanliness+8,0,100);showToast("쓰레기를 정리했습니다.");}
    updateUI(true);return;
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
  updateUI(true);
}

function tryDeliver() {
  if(!state.carrying)return;
  const order=state.orders.find(o=>o.id===state.carrying.orderId);if(!order)return;
  const x=CUSTOMER_SEATS[order.slot], y=585;
  if(distance(state.player.x,state.player.y,x,y)>82){showToast("주문한 손님 앞까지 음식을 가져가세요.",true);return;}
  serveOrder(order);
}
function serveOrder(order) {
  const dish=dishById(order.dishId);const inv=state.inventory[dish.id];
  const satisfaction=Math.round(clamp(inv.quality*.55+state.carrying.cookScore*.40+state.cleanliness*.05,0,100));
  const stars=clamp(Math.ceil(satisfaction/20),1,5);const earned=Math.round(dish.price*(.75+satisfaction/200)/100)*100;
  state.money+=earned;state.served++;state.satisfactionTotal+=satisfaction;if(stars===5)state.fiveStar++;
  state.dirtyDishes=Math.min(6,state.dirtyDishes+1);state.cleanliness=clamp(state.cleanliness-2.5-state.trash*.4,0,100);
  state.orders=state.orders.filter(o=>o.id!==order.id);state.respawns.push({slot:order.slot,time:2.2});state.carrying=null;state.selectedOrderId=state.orders[0]?.id||null;
  spawnPopup(CUSTOMER_SEATS[order.slot],500,`${"★".repeat(stars)} ${satisfaction}점`);showToast(`${dish.name} 제공 · 만족도 ${satisfaction}점`);audio.serve();updateUI(true);
}

function update(dt) {
  if(state.paused)return;
  if(["day","night"].includes(state.phase)){
    state.phaseTime-=dt;
    if(state.phaseTime<=0){state.phaseTime=0;if(state.phase==="day")beginNight();else endNight();}
  }
  if(state.phase==="night"){
    state.respawns.forEach(r=>r.time-=dt);const ready=state.respawns.filter(r=>r.time<=0);state.respawns=state.respawns.filter(r=>r.time>0);ready.forEach(r=>spawnOrder(r.slot));
    if(state.trash>=4)state.cleanliness=clamp(state.cleanliness-dt*.45,0,100);
  }
  updateMini(dt);updatePlayer(dt);updateParticles(dt);autoDelivery();updateUI(false);
}

function updateMini(dt) {
  const m=state.mini;if(!m||m.complete)return;m.time-=dt;dom.miniTimer.textContent=Math.max(0,m.time).toFixed(1);
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

function updatePlayer(dt) {
  const p=state.player;if(state.mini||!["day","night"].includes(state.phase)){p.moving=false;return;}
  let vx=0,vy=0;
  if(keys.has("w")||keys.has("arrowup"))vy-=1;if(keys.has("s")||keys.has("arrowdown"))vy+=1;if(keys.has("a")||keys.has("arrowleft"))vx-=1;if(keys.has("d")||keys.has("arrowright"))vx+=1;
  if(Math.abs(state.joyX||0)>.05||Math.abs(state.joyY||0)>.05){vx=state.joyX;vy=state.joyY;}
  if(vx||vy){p.targetX=null;p.targetY=null;state.autoInteractStation=null;const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;movePlayer(vx*p.speed*dt,vy*p.speed*dt);}
  else if(p.targetX!=null){const dx=p.targetX-p.x,dy=p.targetY-p.y,d=Math.hypot(dx,dy);if(d<5){p.targetX=null;p.targetY=null;p.moving=false;if(state.autoInteractStation){const id=state.autoInteractStation;state.autoInteractStation=null;if(nearStation(STATIONS[id]))interact();}}else movePlayer(dx/d*p.speed*dt,dy/d*p.speed*dt);}
  else p.moving=false;
  if(p.moving){p.frameClock+=dt;if(p.frameClock>.13){p.frame=(p.frame+1)%4;p.frameClock=0;}}else p.frame=0;
}
function movePlayer(dx,dy) {
  const p=state.player;p.x=clamp(p.x+dx,WALK_BOUNDS.left,WALK_BOUNDS.right);p.y=clamp(p.y+dy,WALK_BOUNDS.top,WALK_BOUNDS.bottom);p.moving=true;
  if(Math.abs(dx)>Math.abs(dy))p.facing=dx>0?"right":"left";else p.facing=dy>0?"down":"up";
}
function autoDelivery(){if(state.phase!=="night"||!state.carrying||state.mini)return;const order=state.orders.find(o=>o.id===state.carrying.orderId);if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],585)<64)serveOrder(order);}

function updateParticles(dt) {
  state.particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=20*dt;});state.particles=state.particles.filter(p=>p.life>0);
  state.popups.forEach(p=>{p.life-=dt;p.y-=25*dt;});state.popups=state.popups.filter(p=>p.life>0);
}
function spawnPopup(x,y,text){state.popups.push({x,y,text,life:1.25});for(let i=0;i<9;i++)state.particles.push({x,y,vx:(Math.random()-.5)*100,vy:-40-Math.random()*80,life:.7,size:3+Math.random()*4,color:["#ffe08c","#d49a4b","#9ebc6b"][i%3]});}
function showToast(text,bad=false){dom.toast.textContent=text;dom.toast.classList.toggle("bad",bad);dom.toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>dom.toast.classList.remove("show"),1800);}

function updateUI(force=false) {
  if(state.screen!=="game")return;
  dom.phaseName.textContent=state.phase==="day"?"낮 재료 준비":state.phase==="night"?"밤 영업":"영업 종료";
  dom.dayText.textContent=state.day;dom.timeText.textContent=formatTime(state.phaseTime);dom.moneyText.textContent=`${state.money.toLocaleString()}원`;dom.satisfactionText.textContent=state.served?`${avgSatisfaction()}점`:"-";
  dom.phaseBadge.textContent=state.phase==="day"?"낮":"밤";dom.leftTitle.textContent=state.phase==="day"?"준비된 재료":"남은 준비 재료";
  dom.phaseButton.style.display=state.phase==="day"?"block":"none";
  dom.cleanlinessText.textContent=Math.round(state.cleanliness);dom.cleanlinessBar.style.width=`${state.cleanliness}%`;dom.cleaningText.textContent=`설거지 ${state.dirtyDishes} · 쓰레기 ${state.trash}`;
  [...dom.menuCards.children].forEach((card,i)=>{const d=DISHES[i],inv=state.inventory[d.id];card.classList.toggle("selected",state.phase==="day"&&state.selectedDishId===d.id);card.querySelector(".stock").textContent=inv.count;});
  dom.inventoryList.innerHTML=DISHES.map(d=>{const inv=state.inventory[d.id];return `<div class="inventory-row ${inv.count?"ready":""}"><i class="dot"></i><span>${d.name}<small>${inv.count?` · 품질 ${inv.quality}`:""}</small></span><strong>${inv.count}</strong></div>`;}).join("");
  if(state.phase==="day")updateDayObjective();else if(state.phase==="night")updateNightObjective();
  updatePrompt();
}
function updateDayObjective(){
  const dish=dishById(state.selectedDishId);const run=state.prepRun&&state.prepRun.dishId===dish.id?state.prepRun:{stepIndex:0};const req=dish.prep[run.stepIndex];
  dom.objectiveTitle.textContent="낮 준비";
  dom.objectiveBody.innerHTML=`<div><strong>${dish.name}</strong> 3인분을 준비합니다.</div><div>${STATIONS[req].label} 앞으로 이동해 상호작용하세요.</div><div class="recipe-steps">${dish.prep.map((s,i)=>`<div class="recipe-step ${i<run.stepIndex?"done":i===run.stepIndex?"current":""}"><span>${i+1}</span><span>${STATIONS[s].label}</span></div>`).join("")}</div>`;
}
function updateNightObjective(){
  const order=currentOrder();dom.objectiveTitle.textContent="손님 주문";
  if(state.carrying){const o=state.orders.find(x=>x.id===state.carrying.orderId),d=dishById(state.carrying.dishId);dom.objectiveBody.innerHTML=`<div><strong>${d.name}</strong> 완성!</div><div>${o?o.slot+1:"?"}번 손님 앞으로 직접 가져가면 자동으로 서빙됩니다.</div>`;return;}
  if(!order){dom.objectiveBody.innerHTML="손님을 선택하세요.";return;}
  const d=dishById(order.dishId),step=d.cook[order.cookStep];dom.objectiveBody.innerHTML=`<div><strong>${order.slot+1}번 손님 · ${d.name}</strong></div><div>낮에 준비한 재료로 <strong>${STATIONS[step.station].label}</strong>에서 바로 조리하세요.</div><div class="recipe-steps">${d.cook.map((s,i)=>`<div class="recipe-step ${i<order.cookStep?"done":i===order.cookStep?"current":""}"><span>${i+1}</span><span>${STATIONS[s.station].label}</span></div>`).join("")}</div>`;
}
function updatePrompt(){
  if(state.paused||state.mini||!["day","night"].includes(state.phase)){dom.stationPrompt.classList.remove("show");return;}
  let text="";
  if(state.phase==="night"&&state.carrying){const order=state.orders.find(o=>o.id===state.carrying.orderId);if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],585)<95)text=`${order.slot+1}번 손님에게 ${dishById(state.carrying.dishId).name} 서빙`;}
  const s=nearestStation();if(s){if(s.id==="dishwasher")text=state.dirtyDishes?"SPACE · 설거지하기":"씻을 그릇 없음";else if(s.id==="trash")text=state.trash?"SPACE · 쓰레기 정리":"쓰레기 없음";else text=`SPACE · ${s.label} 사용`;}
  dom.stationPrompt.textContent=text;dom.stationPrompt.classList.toggle("show",!!text);
}

function loop(now){const dt=Math.min(.033,(now-lastTime)/1000);lastTime=now;update(dt);draw();requestAnimationFrame(loop);}
function draw(){ctx.clearRect(0,0,W,H);drawKitchen();drawStations();drawCustomers();drawGuidance();drawPlayer();drawParticles();drawLighting();}

function drawKitchen(){
  const night=state.phase==="night"||state.phase==="result";

  // 뒷벽과 바닥
  ctx.fillStyle=night?"#252328":"#d3c09e";ctx.fillRect(0,0,W,720);
  ctx.fillStyle=night?"#2c292a":"#dac8aa";ctx.fillRect(0,105,W,225);
  ctx.strokeStyle=night?"rgba(137,111,88,.18)":"rgba(111,81,56,.19)";ctx.lineWidth=1;
  for(let x=0;x<W;x+=42){ctx.beginPath();ctx.moveTo(x,105);ctx.lineTo(x,330);ctx.stroke();}
  for(let y=105;y<330;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // 12시 방향 전체 조리대: 모든 집기가 한 줄로 벽에 붙어 보이도록 연결
  ctx.fillStyle=night?"#4a3428":"#876143";ctx.fillRect(305,286,875,50);
  ctx.fillStyle="#291912";ctx.fillRect(305,332,875,18);
  for(let x=318;x<1170;x+=92){
    ctx.fillStyle=night?"#32231c":"#68472f";
    ctx.fillRect(x,288,78,43);
    ctx.strokeStyle="#2b190f";ctx.strokeRect(x,288,78,43);
    ctx.fillStyle="#b6814d";ctx.fillRect(x+37,307,5,3);
  }

  // 왼쪽 벽면과 냉장고 자리
  ctx.fillStyle=night?"#392b25":"#aa8c67";ctx.fillRect(145,160,166,315);
  ctx.strokeStyle=night?"#211815":"#765538";ctx.lineWidth=5;ctx.strokeRect(145,160,166,315);
  ctx.fillStyle=night?"#2b201b":"#8a6b4b";ctx.fillRect(155,172,38,290);
  for(let y=185;y<450;y+=44){ctx.strokeStyle="rgba(35,20,14,.35)";ctx.beginPath();ctx.moveTo(155,y);ctx.lineTo(193,y);ctx.stroke();}

  // 오른쪽 벽의 집기장. 인터페이스가 이 장 위에 겹쳐 표시된다.
  ctx.fillStyle=night?"#38251c":"#765033";ctx.fillRect(1080,145,184,350);
  ctx.strokeStyle="#2b180f";ctx.lineWidth=6;ctx.strokeRect(1080,145,184,350);
  ctx.fillStyle=night?"#281a14":"#55351f";ctx.fillRect(1092,160,160,92);
  ctx.fillRect(1092,264,160,98);ctx.fillRect(1092,374,160,105);
  ctx.strokeStyle="#a06e3b";ctx.lineWidth=2;
  [252,362].forEach(y=>{ctx.beginPath();ctx.moveTo(1090,y);ctx.lineTo(1254,y);ctx.stroke();});
  for(let i=0;i<5;i++){
    ctx.fillStyle=i%2?"#b77b40":"#7d5330";
    ctx.fillRect(1104+i*27,218-(i%2)*12,16,28+(i%2)*12);
  }
  ctx.fillStyle="#c08b50";ctx.fillRect(1130,414,7,5);ctx.fillRect(1207,414,7,5);

  // 이동 가능한 바닥
  ctx.fillStyle=night?"#3b302a":"#b99e78";ctx.fillRect(175,350,970,270);
  for(let y=350;y<620;y+=48){for(let x=175;x<1145;x+=48){ctx.strokeStyle=night?"rgba(0,0,0,.2)":"rgba(93,67,43,.18)";ctx.strokeRect(x,y,48,48);}}

  // 손님용 카운터와 의자
  ctx.fillStyle="#3b2115";ctx.fillRect(335,575,690,45);
  ctx.fillStyle="#74472a";ctx.fillRect(335,568,690,15);
  CUSTOMER_SEATS.forEach(x=>{ctx.fillStyle="#522d20";ctx.fillRect(x-23,620,46,18);ctx.fillStyle="#2e1b13";ctx.fillRect(x-18,638,8,48);ctx.fillRect(x+10,638,8,48);});

  // 중앙 창문
  ctx.fillStyle=night?"#101723":"#8dc0d1";ctx.fillRect(500,125,330,64);
  ctx.strokeStyle="#5b3b25";ctx.lineWidth=8;ctx.strokeRect(500,125,330,64);
  ctx.beginPath();ctx.moveTo(665,125);ctx.lineTo(665,189);ctx.stroke();
  if(night){ctx.fillStyle="#efd37c";for(let i=0;i<22;i++)ctx.fillRect(515+(i*47)%300,138+(i*23)%38,2,2);}else{ctx.fillStyle="rgba(255,243,183,.25)";ctx.fillRect(510,135,310,45);}

  // 천장 조명
  [385,665,945].forEach(x=>{ctx.strokeStyle="#4b3020";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,105);ctx.lineTo(x,148);ctx.stroke();ctx.fillStyle=night?"#e29a45":"#b77b3d";ctx.beginPath();ctx.ellipse(x,156,20,13,0,0,Math.PI*2);ctx.fill();if(night){const g=ctx.createRadialGradient(x,168,10,x,198,95);g.addColorStop(0,"rgba(255,179,78,.18)");g.addColorStop(1,"rgba(255,179,78,0)");ctx.fillStyle=g;ctx.fillRect(x-100,148,200,170);}});
}

function drawStations(){Object.values(STATIONS).forEach(drawStation);}
function labelStation(s){ctx.fillStyle="#1a0e09";roundRect(ctx,s.x+8,s.y-25,s.w-16,23,5,true,false);ctx.strokeStyle="#9a6235";ctx.lineWidth=2;roundRect(ctx,s.x+8,s.y-25,s.w-16,23,5,false,true);ctx.fillStyle="#f0c87b";ctx.font="bold 13px Malgun Gothic";ctx.textAlign="center";ctx.fillText(s.label,s.x+s.w/2,s.y-9);ctx.textAlign="left";}
function drawStation(s){
  const working=state.mini?.stationId===s.id,t=performance.now()/1000;labelStation(s);
  ctx.fillStyle="#332117";ctx.fillRect(s.x,s.y,s.w,s.h);ctx.strokeStyle="#7f5130";ctx.lineWidth=4;ctx.strokeRect(s.x,s.y,s.w,s.h);
  if(s.id==="fridge"){
    ctx.fillStyle="#7c8b82";ctx.fillRect(s.x+8,s.y+7,s.w-16,s.h-14);ctx.fillStyle="#b7c2b8";ctx.fillRect(s.x+16,s.y+18,s.w-32,70);ctx.fillRect(s.x+16,s.y+100,s.w-32,80);ctx.strokeStyle="#46554e";ctx.strokeRect(s.x+16,s.y+18,s.w-32,70);ctx.strokeRect(s.x+16,s.y+100,s.w-32,80);ctx.fillStyle="#2e3c37";ctx.fillRect(s.x+92,s.y+48,5,22);ctx.fillRect(s.x+92,s.y+132,5,22);
  } else if(s.id==="sink"){
    ctx.fillStyle="#a8a497";ctx.fillRect(s.x+8,s.y+10,s.w-16,48);ctx.fillStyle="#4e5b5b";ctx.beginPath();ctx.ellipse(s.x+s.w/2,s.y+32,42,18,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#c9c6b9";ctx.lineWidth=5;ctx.beginPath();ctx.arc(s.x+70,s.y+10,18,Math.PI,0);ctx.stroke();if(working){ctx.fillStyle="#b9e7ed";for(let i=0;i<7;i++)ctx.beginPath(),ctx.arc(s.x+30+i*12,s.y+35+Math.sin(t*8+i)*7,4,0,Math.PI*2),ctx.fill();}
  } else if(s.id==="board"){
    ctx.fillStyle="#c99558";ctx.fillRect(s.x+15,s.y+14,s.w-30,46);ctx.strokeStyle="#6c3d20";ctx.strokeRect(s.x+15,s.y+14,s.w-30,46);ctx.save();ctx.translate(s.x+70,s.y+35);ctx.rotate(working?Math.sin(t*14)*.35:-.5);ctx.fillStyle="#cdd0cc";ctx.fillRect(-3,-28,7,44);ctx.fillStyle="#5f321e";ctx.fillRect(-4,16,9,18);ctx.restore();
  } else if(s.id==="gas"){
    ctx.fillStyle="#69645c";ctx.fillRect(s.x+8,s.y+10,s.w-16,52);ctx.fillStyle="#171717";ctx.beginPath();ctx.arc(s.x+65,s.y+36,28,0,Math.PI*2);ctx.fill();ctx.fillStyle=working?"#dd7433":"#41413d";ctx.beginPath();ctx.arc(s.x+65,s.y+36,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#97918a";ctx.beginPath();ctx.ellipse(s.x+65,s.y+22,38,12,0,0,Math.PI*2);ctx.fill();if(working)drawSteam(s.x+65,s.y+5,4);
  } else if(s.id==="grill"){
    ctx.fillStyle="#24211e";ctx.fillRect(s.x+9,s.y+10,s.w-18,54);ctx.strokeStyle="#7f7369";ctx.lineWidth=2;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(s.x+18+i*16,s.y+14);ctx.lineTo(s.x+18+i*16,s.y+60);ctx.stroke();}for(let i=0;i<4;i++){ctx.strokeStyle="#a66d3d";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(s.x+24,s.y+25+i*10);ctx.lineTo(s.x+112,s.y+25+i*10+(working?Math.sin(t*10+i)*2:0));ctx.stroke();}if(working){ctx.fillStyle="#ef762f";for(let i=0;i<5;i++)ctx.fillRect(s.x+25+i*20,s.y+52+Math.sin(t*9+i)*4,6,10);}
  } else if(s.id==="fryer"){
    ctx.fillStyle="#817a6c";ctx.fillRect(s.x+8,s.y+8,s.w-16,57);ctx.fillStyle="#4f321f";ctx.fillRect(s.x+20,s.y+18,s.w-40,35);ctx.strokeStyle="#b6aa94";ctx.strokeRect(s.x+28,s.y+13,s.w-56,35);if(working){ctx.fillStyle="#e8b95f";for(let i=0;i<8;i++)ctx.beginPath(),ctx.arc(s.x+25+i*11,s.y+40+Math.sin(t*12+i)*7,3,0,Math.PI*2),ctx.fill();}
  } else if(s.id==="dishwasher"){
    ctx.fillStyle="#686b68";ctx.fillRect(s.x+8,s.y+8,s.w-16,s.h-16);ctx.fillStyle="#242726";ctx.beginPath();ctx.arc(s.x+s.w/2,s.y+38,Math.min(24,s.w*.30),0,Math.PI*2);ctx.fill();ctx.strokeStyle="#9ca29e";ctx.lineWidth=5;ctx.stroke();ctx.fillStyle=state.dirtyDishes?"#d39147":"#86a164";ctx.fillRect(s.x+s.w-20,s.y+14,10,7);
  } else if(s.id==="trash"){
    ctx.fillStyle="#444946";ctx.fillRect(s.x+12,s.y+18,s.w-24,s.h-14);ctx.fillStyle="#555c57";ctx.fillRect(s.x+7,s.y+11,s.w-14,12);ctx.fillStyle="#b5b9a9";ctx.font="18px sans-serif";ctx.fillText("♻",s.x+32,s.y+54);
  }
}
function drawSteam(x,y,count){const t=performance.now()/700;ctx.strokeStyle="rgba(246,239,218,.7)";ctx.lineWidth=3;for(let i=0;i<count;i++){const ox=(i-count/2)*10,rise=((t+i*.23)%1)*25;ctx.globalAlpha=1-rise/25;ctx.beginPath();ctx.moveTo(x+ox,y-rise);ctx.bezierCurveTo(x+ox-6,y-rise-6,x+ox+6,y-rise-13,x+ox,y-rise-19);ctx.stroke();}ctx.globalAlpha=1;}

function drawCustomers(){if(state.phase!=="night"&&state.phase!=="result")return;const t=performance.now()/1000;state.orders.forEach(order=>{order.entered=clamp(order.entered+.035,0,1);const x=CUSTOMER_SEATS[order.slot],y=lerp(700,603,order.entered),frame=Math.floor(t*2+order.id)%4;if(images.customers)ctx.drawImage(images.customers,frame*44,order.variant*60,44,60,x-27,y-62,54,74);else{ctx.fillStyle="#48352b";ctx.fillRect(x-20,y-55,40,55);}const selected=state.selectedOrderId===order.id;ctx.fillStyle=selected?"#fff0bd":"#efd9ae";roundRect(ctx,x-38,y-115,76,55,9,true,false);ctx.strokeStyle=selected?"#f5bd50":"#5a3724";ctx.lineWidth=selected?4:2;roundRect(ctx,x-38,y-115,76,55,9,false,true);drawFoodIcon(dishById(order.dishId).icon,x-19,y-110,38);ctx.fillStyle="#3b2518";ctx.beginPath();ctx.moveTo(x-5,y-60);ctx.lineTo(x+6,y-50);ctx.lineTo(x+10,y-60);ctx.fill();if(selected){ctx.strokeStyle="#ffd776";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-29,37+Math.sin(t*5)*2,0,Math.PI*2);ctx.stroke();}ctx.fillStyle="#ffe1a0";ctx.font="bold 12px Malgun Gothic";ctx.textAlign="center";ctx.fillText(`${order.slot+1}`,x,y-122);ctx.textAlign="left";});}
function drawGuidance(){const req=currentRequirement();if(!req||state.paused||state.mini)return;const s=STATIONS[req],t=performance.now()/1000,pulse=15+Math.sin(t*5)*5;ctx.strokeStyle="rgba(255,220,125,.92)";ctx.lineWidth=4;ctx.beginPath();ctx.arc(s.ix,s.iy-10,pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle="rgba(255,220,125,.92)";ctx.beginPath();ctx.moveTo(s.ix,s.iy-57-Math.sin(t*6)*5);ctx.lineTo(s.ix-10,s.iy-74-Math.sin(t*6)*5);ctx.lineTo(s.ix+10,s.iy-74-Math.sin(t*6)*5);ctx.fill();}
function drawPlayer(){const p=state.player,dirs={down:0,left:1,right:2,up:3},row=dirs[p.facing]+(state.mini?4:0),frame=state.mini?Math.floor(performance.now()/110)%4:p.frame;if(images.chef)ctx.drawImage(images.chef,frame*48,row*64,48,64,p.x-33,p.y-73,66,88);else{ctx.fillStyle="#a44f3f";ctx.fillRect(p.x-20,p.y-55,40,55);}if(state.carrying){const d=dishById(state.carrying.dishId);ctx.fillStyle="#eee6d5";ctx.beginPath();ctx.ellipse(p.x,p.y-85,28,9,0,0,Math.PI*2);ctx.fill();drawFoodIcon(d.icon,p.x-18,p.y-108,36);}}
function drawParticles(){state.particles.forEach(p=>{ctx.globalAlpha=clamp(p.life/.7,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);});ctx.globalAlpha=1;state.popups.forEach(p=>{ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#ffe08c";ctx.strokeStyle="#4b2514";ctx.lineWidth=4;ctx.font="bold 21px Malgun Gothic";ctx.textAlign="center";ctx.strokeText(p.text,p.x,p.y);ctx.fillText(p.text,p.x,p.y);});ctx.textAlign="left";ctx.globalAlpha=1;}
function drawLighting(){if(state.phase==="night"||state.phase==="result"){ctx.fillStyle="rgba(8,12,27,.28)";ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(720,360,70,720,360,390);g.addColorStop(0,"rgba(255,181,78,.11)");g.addColorStop(1,"rgba(255,181,78,0)");ctx.fillStyle=g;ctx.fillRect(250,120,950,560);}else if(state.phase==="title"){ctx.fillStyle="rgba(9,5,4,.42)";ctx.fillRect(0,0,W,H);}else{const g=ctx.createLinearGradient(350,160,900,520);g.addColorStop(0,"rgba(255,247,204,.12)");g.addColorStop(1,"rgba(255,247,204,0)");ctx.fillStyle=g;ctx.fillRect(180,100,970,520);}}
function drawFoodIcon(index,x,y,size){if(images.food)ctx.drawImage(images.food,index*64,0,64,64,x,y,size,size);else{ctx.fillStyle="#d69c4b";ctx.beginPath();ctx.arc(x+size/2,y+size/2,size*.35,0,Math.PI*2);ctx.fill();}}
function roundRect(c,x,y,w,h,r,fill,stroke){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);if(fill)c.fill();if(stroke)c.stroke();}

function pointerToCanvas(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function handleCanvasPointer(e){if(state.paused||state.mini||!["day","night"].includes(state.phase))return;const p=pointerToCanvas(e);
  if(state.phase==="night"){
    const clicked=state.orders.find(o=>Math.abs(p.x-CUSTOMER_SEATS[o.slot])<55&&p.y>490&&p.y<690);if(clicked){selectOrder(clicked.id);return;}
  }
  const station=Object.values(STATIONS).find(s=>p.x>=s.x-10&&p.x<=s.x+s.w+10&&p.y>=s.y-35&&p.y<=s.y+s.h+35);
  if(station){state.player.targetX=station.ix;state.player.targetY=station.iy;state.autoInteractStation=station.id;return;}
  if(p.x>=WALK_BOUNDS.left&&p.x<=WALK_BOUNDS.right&&p.y>=WALK_BOUNDS.top&&p.y<=WALK_BOUNDS.bottom){state.player.targetX=p.x;state.player.targetY=p.y;state.autoInteractStation=null;}
}

canvas.addEventListener("pointerdown",handleCanvasPointer);
dom.startButton.addEventListener("click",startGame);
dom.titleSettingsButton.addEventListener("click",()=>openSettings("title"));
dom.settingsButton.addEventListener("click",()=>openSettings("game"));
dom.resumeButton.addEventListener("click",closeSettings);
dom.returnTitleButton.addEventListener("click",returnTitle);
dom.phaseButton.addEventListener("click",beginNight);
dom.nextDayButton.addEventListener("click",()=>{state.day++;state.paused=false;resetDay(false);});
dom.actionButton.addEventListener("click",()=>{if(state.mini)miniAction();else interact();});

[[dom.masterVolume,"master",dom.masterVolumeValue],[dom.bgmVolume,"bgm",dom.bgmVolumeValue],[dom.sfxVolume,"sfx",dom.sfxVolumeValue]].forEach(([input,key,label])=>input.addEventListener("input",()=>{state.audio[key]=Number(input.value)/100;label.textContent=`${input.value}%`;audio.apply();}));

window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.code==="Space")e.preventDefault();
  if(k==="escape"){
    if(dom.settingsOverlay.classList.contains("open"))closeSettings();else if(state.screen==="game")openSettings("game");return;
  }
  if(state.mini){
    if(e.code==="Space")miniAction();
    if(state.mini?.type==="stir"){const map={arrowleft:"←",arrowup:"↑",arrowright:"→",arrowdown:"↓"};if(map[k])arrowInput(map[k]);}
    if(state.mini?.type==="heat"){if(k==="arrowleft"||k==="a")state.mini.data.velocity-=.16;if(k==="arrowright"||k==="d")state.mini.data.velocity+=.16;}
    return;
  }
  if(e.code==="Space"){interact();return;}
  if(state.phase==="night"&&["1","2","3","4"].includes(k)){const order=state.orders.find(o=>o.slot===Number(k)-1);if(order)selectOrder(order.id);return;}
  keys.add(k);
});
window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));

function beginJoystick(e){if(state.paused)return;joystickPointer=e.pointerId;dom.joystick.setPointerCapture(e.pointerId);moveJoystick(e);}
function moveJoystick(e){if(e.pointerId!==joystickPointer)return;const r=dom.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.31,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len),px=dx*scale,py=dy*scale;dom.joystickKnob.style.transform=`translate(${px}px,${py}px)`;state.joyX=clamp(dx/max,-1,1);state.joyY=clamp(dy/max,-1,1);}
function endJoystick(e){if(e.pointerId!==joystickPointer)return;joystickPointer=null;state.joyX=0;state.joyY=0;dom.joystickKnob.style.transform="translate(0,0)";}
dom.joystick.addEventListener("pointerdown",beginJoystick);dom.joystick.addEventListener("pointermove",moveJoystick);dom.joystick.addEventListener("pointerup",endJoystick);dom.joystick.addEventListener("pointercancel",endJoystick);

buildMenuCards();showGameHud(false);dom.titleScreen.classList.add("active");dom.gameScreen.classList.remove("active");updateUI(true);draw();
