"use strict";

const W = 1280;
const H = 720;
let ctx = null;
let phaserScene = null;
let frameTexture = null;
let playerSprite = null;
let carriedPlate = null;
let carriedFood = null;

const dom = Object.fromEntries([
  "appRoot","titleScreen","gameScreen","gameApp","topHud","leftHud","rightHud","mobileControls","phaseName","dayText","timeLabel","timeText","satisfactionText","popularityText","moneyText",
  "settingsButton","menuCards","leftTitle","phaseBadge","inventoryList","phaseButton","objectiveTitle","objectiveBody",
  "cleanlinessText","cleanlinessBar","cleaningText","stationPrompt","toast","startButton","titleSettingsButton",
  "settingsOverlay","pauseMessage","masterVolume","masterVolumeValue","bgmVolume","bgmVolumeValue","sfxVolume","sfxVolumeValue",
  "resumeButton","returnTitleButton","miniOverlay","miniStation","miniTitle","miniTimer","miniDescription","miniContent","miniFeedback",
  "resultOverlay","servedResult","satisfactionResult","fiveStarResult","popularityResult","wasteResult","revenueResult","resultComment","nextDayButton",
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

dom.startButton.disabled=true;
dom.startButton.textContent="게임 불러오는 중…";

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
  fridge: { id:"fridge", label:"냉장고", x:250, y:210, w:82, h:190, ix:350, iy:390, facing:"left" },
  sink: { id:"sink", label:"싱크대", x:350, y:300, w:100, h:64, ix:400, iy:390, facing:"up" },
  board: { id:"board", label:"도마", x:458, y:300, w:96, h:64, ix:506, iy:390, facing:"up" },
  gas: { id:"gas", label:"가스레인지", x:562, y:300, w:104, h:66, ix:614, iy:390, facing:"up" },
  grill: { id:"grill", label:"직화구이", x:674, y:300, w:112, h:66, ix:730, iy:390, facing:"up" },
  fryer: { id:"fryer", label:"튀김기", x:794, y:300, w:86, h:66, ix:837, iy:390, facing:"up" },
  dishwasher: { id:"dishwasher", label:"식기세척기", x:888, y:300, w:82, h:66, ix:929, iy:390, facing:"up" },
  trash: { id:"trash", label:"쓰레기통", x:978, y:300, w:66, h:66, ix:1011, iy:390, facing:"up" }
};

const CUSTOMER_SEATS = [455, 620, 785, 950];
const CUSTOMER_SERVICE_Y = 475;
const WALK_BOUNDS = { left:270, right:1020, top:365, bottom:465 };
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
  popularity:50,
  popularityDelta:0,
  dailyRevenue:0,
  wasteLoss:0,
  leftoverCount:0,
  nightCustomerTarget:0,
  spawnedCustomers:0,
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
  player:{ x:620, y:430, facing:"down", moving:false, speed:205 },
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
  state.day=1; state.money=0; state.popularity=50; resetDay(true);
  dom.titleScreen.classList.remove("active");
  dom.gameScreen.classList.add("active");
  requestAnimationFrame(()=>phaserScene?.scale.refresh());
  showGameHud(true); audio.startBgm(); audio.success();
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
  state.player.facing=station.facing;
  if(station.id==="dishwasher") { if(state.dirtyDishes<=0){showToast("씻을 그릇이 없습니다.");return;} startMini("dishwasher",station.id,{utility:true}); return; }
  if(station.id==="trash") { if(state.trash<=0){showToast("버릴 쓰레기가 없습니다.");return;} startMini("trash",station.id,{utility:true}); return; }
  const required=currentRequirement();
  if(station.id!==required){ showToast(`지금은 ${required?STATIONS[required].label:"주문 선택"} 단계입니다.`,true); return; }
  if(state.phase==="day") startPrepMini(station.id); else startCookMini(station.id);
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

function update(dt) {
  if(state.paused)return;
  if(state.phase==="night"){
    state.phaseTime-=dt;
    if(state.phaseTime<=0){state.phaseTime=0;endNight();return;}
    state.orders.forEach(order=>order.entered=clamp(order.entered+dt*2.1,0,1));
    state.respawns.forEach(r=>r.time-=dt);const ready=state.respawns.filter(r=>r.time<=0);state.respawns=state.respawns.filter(r=>r.time>0);ready.forEach(r=>spawnOrder(r.slot));
    if(state.trash>=4)state.cleanliness=clamp(state.cleanliness-dt*.45,0,100);
    const noActiveOrders=state.orders.length===0&&!state.carrying&&state.respawns.length===0;
    if(noActiveOrders&&(state.spawnedCustomers>=state.nightCustomerTarget||!hasOrderableStock())){endNight();return;}
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
  const move=phaserScene?.moveKeys;
  if(move?.up.isDown||move?.w.isDown)vy-=1;if(move?.down.isDown||move?.s.isDown)vy+=1;if(move?.left.isDown||move?.a.isDown)vx-=1;if(move?.right.isDown||move?.d.isDown)vx+=1;
  if(Math.abs(state.joyX||0)>.05||Math.abs(state.joyY||0)>.05){vx=state.joyX;vy=state.joyY;}
  if(vx||vy){const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;movePlayer(vx*p.speed*dt,vy*p.speed*dt);}
  else p.moving=false;
}
function movePlayer(dx,dy) {
  const p=state.player;p.x=clamp(p.x+dx,WALK_BOUNDS.left,WALK_BOUNDS.right);p.y=clamp(p.y+dy,WALK_BOUNDS.top,WALK_BOUNDS.bottom);p.moving=true;
  if(Math.abs(dx)>Math.abs(dy))p.facing=dx>0?"right":"left";else p.facing=dy>0?"down":"up";
}
function updateParticles(dt) {
  state.particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=20*dt;});state.particles=state.particles.filter(p=>p.life>0);
  state.popups.forEach(p=>{p.life-=dt;p.y-=25*dt;});state.popups=state.popups.filter(p=>p.life>0);
}
function spawnPopup(x,y,text){state.popups.push({x,y,text,life:1.25});for(let i=0;i<9;i++)state.particles.push({x,y,vx:(Math.random()-.5)*100,vy:-40-Math.random()*80,life:.7,size:3+Math.random()*4,color:["#ffe08c","#d49a4b","#9ebc6b"][i%3]});}
function showToast(text,bad=false){dom.toast.textContent=text;dom.toast.classList.toggle("bad",bad);dom.toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>dom.toast.classList.remove("show"),1800);}

function updateUI(force=false) {
  if(state.screen!=="game")return;
  dom.phaseName.textContent=state.phase==="day"?"낮 재료 준비":state.phase==="night"?"밤 영업":"영업 종료";
  dom.dayText.textContent=state.day;dom.timeLabel.textContent=state.phase==="day"?"준비":"남은 시간";dom.timeText.textContent=state.phase==="day"?"제한 없음":formatTime(state.phaseTime);dom.moneyText.textContent=`${state.money.toLocaleString()}원`;dom.popularityText.textContent=state.popularity;dom.satisfactionText.textContent=state.served?`${avgSatisfaction()}점`:"-";
  dom.phaseBadge.textContent=state.phase==="day"?"낮":"밤";dom.leftTitle.textContent=state.phase==="day"?"준비된 재료":"남은 준비 재료";
  dom.phaseButton.style.display=state.phase==="day"?"block":"none";dom.phaseButton.textContent="영업준비 완료";dom.phaseButton.disabled=state.phase==="day"&&(Object.values(state.inventory).every(item=>item.count===0)||!!state.prepRun||!!state.mini);
  dom.cleanlinessText.textContent=Math.round(state.cleanliness);dom.cleanlinessBar.style.width=`${state.cleanliness}%`;dom.cleaningText.textContent=`설거지 ${state.dirtyDishes} · 쓰레기 ${state.trash}`;
  [...dom.menuCards.children].forEach((card,i)=>{const d=DISHES[i],inv=state.inventory[d.id];card.classList.toggle("selected",state.phase==="day"&&state.selectedDishId===d.id);card.querySelector(".stock").textContent=inv.count;});
  dom.inventoryList.innerHTML=DISHES.map(d=>{const inv=state.inventory[d.id];return `<div class="inventory-row ${inv.count?"ready":""}"><i class="dot"></i><span>${d.name}<small>${inv.count?` · 품질 ${inv.quality}`:""}</small></span><strong>${inv.count}</strong></div>`;}).join("");
  if(state.phase==="day")updateDayObjective();else if(state.phase==="night")updateNightObjective();
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
    if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],CUSTOMER_SERVICE_Y)<=82){
      text=`SPACE · ${order.slot+1}번 손님에게 서빙`;
      x=CUSTOMER_SEATS[order.slot];y=520;
    }
  }else{
    const station=nearestStation();
    if(station){
      const required=currentRequirement();
      if(station.id==="dishwasher"&&state.dirtyDishes>0)text="SPACE · 설거지하기";
      else if(station.id==="trash"&&state.trash>0)text="SPACE · 쓰레기 정리";
      else if(station.id===required)text=`SPACE · ${station.label} 사용`;
      if(text){x=station.ix;y=station.y+station.h+60;}
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
  ctx.clearRect(0,0,W,H);drawKitchen();drawStations();drawCustomers();drawGuidance();drawParticles();
  frameTexture?.refresh();
}

function syncPhaserObjects(){
  if(!playerSprite)return;
  const p=state.player,dirs={down:0,left:1,right:2,up:3};
  playerSprite.setPosition(p.x,p.y);
  if(state.mini) playerSprite.play(`chef-work-${p.facing}`,true);
  else if(p.moving) playerSprite.play(`chef-walk-${p.facing}`,true);
  else { playerSprite.stop();playerSprite.setFrame(dirs[p.facing]*4); }
  const carrying=state.carrying;
  carriedPlate.setVisible(!!carrying).setPosition(p.x,p.y-85);
  carriedFood.setVisible(!!carrying).setPosition(p.x,p.y-90);
  if(carrying) carriedFood.setFrame(dishById(carrying.dishId).icon);
}

function drawKitchen(){
  const night=state.phase==="night"||state.phase==="result";
  const background=night?images.kitchenNight:images.kitchenDay;
  if(background) ctx.drawImage(background,0,0,W,H);
  else { ctx.fillStyle=night?"#17151a":"#b99e78";ctx.fillRect(0,0,W,H); }
}

function drawStations(){Object.values(STATIONS).forEach(drawStation);}
function labelStation(s){ctx.fillStyle="#1a0e09";roundRect(ctx,s.x+8,s.y-25,s.w-16,23,5,true,false);ctx.strokeStyle="#9a6235";ctx.lineWidth=2;roundRect(ctx,s.x+8,s.y-25,s.w-16,23,5,false,true);ctx.fillStyle="#f0c87b";ctx.font="bold 13px Malgun Gothic";ctx.textAlign="center";ctx.fillText(s.label,s.x+s.w/2,s.y-9);ctx.textAlign="left";}
function drawStation(s){
  const working=state.mini?.stationId===s.id,t=performance.now()/1000;labelStation(s);
  ctx.fillStyle="#332117";ctx.fillRect(s.x,s.y,s.w,s.h);ctx.strokeStyle="#7f5130";ctx.lineWidth=4;ctx.strokeRect(s.x,s.y,s.w,s.h);
  if(s.id==="fridge"){
    ctx.fillStyle="#7c8b82";ctx.fillRect(s.x+8,s.y+7,s.w-16,s.h-14);ctx.fillStyle="#b7c2b8";ctx.fillRect(s.x+14,s.y+18,s.w-28,64);ctx.fillRect(s.x+14,s.y+94,s.w-28,76);ctx.strokeStyle="#46554e";ctx.strokeRect(s.x+14,s.y+18,s.w-28,64);ctx.strokeRect(s.x+14,s.y+94,s.w-28,76);ctx.fillStyle="#2e3c37";ctx.fillRect(s.x+s.w-18,s.y+44,5,22);ctx.fillRect(s.x+s.w-18,s.y+124,5,22);
  } else if(s.id==="sink"){
    ctx.fillStyle="#a8a497";ctx.fillRect(s.x+8,s.y+10,s.w-16,48);ctx.fillStyle="#4e5b5b";ctx.beginPath();ctx.ellipse(s.x+s.w/2,s.y+32,42,18,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#c9c6b9";ctx.lineWidth=5;ctx.beginPath();ctx.arc(s.x+70,s.y+10,18,Math.PI,0);ctx.stroke();if(working){ctx.fillStyle="#b9e7ed";for(let i=0;i<7;i++)ctx.beginPath(),ctx.arc(s.x+30+i*12,s.y+35+Math.sin(t*8+i)*7,4,0,Math.PI*2),ctx.fill();}
  } else if(s.id==="board"){
    ctx.fillStyle="#c99558";ctx.fillRect(s.x+15,s.y+14,s.w-30,46);ctx.strokeStyle="#6c3d20";ctx.strokeRect(s.x+15,s.y+14,s.w-30,46);ctx.save();ctx.translate(s.x+s.w*.62,s.y+35);ctx.rotate(working?Math.sin(t*14)*.35:-.5);ctx.fillStyle="#cdd0cc";ctx.fillRect(-3,-28,7,44);ctx.fillStyle="#5f321e";ctx.fillRect(-4,16,9,18);ctx.restore();
  } else if(s.id==="gas"){
    ctx.fillStyle="#69645c";ctx.fillRect(s.x+8,s.y+10,s.w-16,52);ctx.fillStyle="#171717";ctx.beginPath();ctx.arc(s.x+s.w/2,s.y+36,26,0,Math.PI*2);ctx.fill();ctx.fillStyle=working?"#dd7433":"#41413d";ctx.beginPath();ctx.arc(s.x+s.w/2,s.y+36,17,0,Math.PI*2);ctx.fill();ctx.fillStyle="#97918a";ctx.beginPath();ctx.ellipse(s.x+s.w/2,s.y+22,36,12,0,0,Math.PI*2);ctx.fill();if(working)drawSteam(s.x+s.w/2,s.y+5,4);
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

function drawCustomers(){if(state.phase!=="night"&&state.phase!=="result")return;const t=performance.now()/1000;state.orders.forEach(order=>{const x=CUSTOMER_SEATS[order.slot],entered=1-Math.pow(1-order.entered,3),y=lerp(700,603,entered),frame=Math.floor(t*2+order.id)%4;if(images.customers)ctx.drawImage(images.customers,frame*44,order.variant*60,44,60,x-27,y-62,54,74);else{ctx.fillStyle="#48352b";ctx.fillRect(x-20,y-55,40,55);}const selected=state.selectedOrderId===order.id;ctx.fillStyle=selected?"#fff0bd":"#efd9ae";roundRect(ctx,x-38,y-115,76,55,9,true,false);ctx.strokeStyle=selected?"#f5bd50":"#5a3724";ctx.lineWidth=selected?4:2;roundRect(ctx,x-38,y-115,76,55,9,false,true);drawFoodIcon(dishById(order.dishId).icon,x-19,y-110,38);ctx.fillStyle="#3b2518";ctx.beginPath();ctx.moveTo(x-5,y-60);ctx.lineTo(x+6,y-50);ctx.lineTo(x+10,y-60);ctx.fill();if(selected){ctx.strokeStyle="#ffd776";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-29,37+Math.sin(t*5)*2,0,Math.PI*2);ctx.stroke();}ctx.fillStyle="#ffe1a0";ctx.font="bold 12px Malgun Gothic";ctx.textAlign="center";ctx.fillText(`${order.slot+1}`,x,y-122);ctx.textAlign="left";});}
function drawGuidance(){const req=currentRequirement();if(!req||state.paused||state.mini)return;const s=STATIONS[req],t=performance.now()/1000,pulse=15+Math.sin(t*5)*5;ctx.strokeStyle="rgba(255,220,125,.92)";ctx.lineWidth=4;ctx.beginPath();ctx.arc(s.ix,s.iy-10,pulse,0,Math.PI*2);ctx.stroke();ctx.fillStyle="rgba(255,220,125,.92)";ctx.beginPath();ctx.moveTo(s.ix,s.iy-57-Math.sin(t*6)*5);ctx.lineTo(s.ix-10,s.iy-74-Math.sin(t*6)*5);ctx.lineTo(s.ix+10,s.iy-74-Math.sin(t*6)*5);ctx.fill();}
function drawParticles(){state.particles.forEach(p=>{ctx.globalAlpha=clamp(p.life/.7,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);});ctx.globalAlpha=1;state.popups.forEach(p=>{ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#ffe08c";ctx.strokeStyle="#4b2514";ctx.lineWidth=4;ctx.font="bold 21px Malgun Gothic";ctx.textAlign="center";ctx.strokeText(p.text,p.x,p.y);ctx.fillText(p.text,p.x,p.y);});ctx.textAlign="left";ctx.globalAlpha=1;}
function drawFoodIcon(index,x,y,size){if(images.food)ctx.drawImage(images.food,index*64,0,64,64,x,y,size,size);else{ctx.fillStyle="#d69c4b";ctx.beginPath();ctx.arc(x+size/2,y+size/2,size*.35,0,Math.PI*2);ctx.fill();}}
function roundRect(c,x,y,w,h,r,fill,stroke){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);if(fill)c.fill();if(stroke)c.stroke();}

dom.startButton.addEventListener("click",startGame);
dom.titleSettingsButton.addEventListener("click",()=>openSettings("title"));
dom.settingsButton.addEventListener("click",()=>openSettings("game"));
dom.resumeButton.addEventListener("click",closeSettings);
dom.returnTitleButton.addEventListener("click",returnTitle);
dom.phaseButton.addEventListener("click",beginNight);
dom.nextDayButton.addEventListener("click",()=>{state.day++;state.paused=false;resetDay(false);});
dom.actionButton.addEventListener("click",()=>{if(state.mini)miniAction();else interact();});
dom.stationPrompt.addEventListener("click",interact);

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

    frameTexture=this.textures.createCanvas("dinerFrame",W,H);
    ctx=frameTexture.getContext();
    ctx.imageSmoothingEnabled=false;
    this.add.image(0,0,"dinerFrame").setOrigin(0).setDepth(0);

    playerSprite=this.add.sprite(state.player.x,state.player.y,"chef",0)
      .setOrigin(.5,73/88).setDisplaySize(66,88).setDepth(10);
    carriedPlate=this.add.ellipse(state.player.x,state.player.y-85,56,18,0xeee6d5)
      .setDepth(11).setVisible(false);
    carriedFood=this.add.sprite(state.player.x,state.player.y-90,"food",0)
      .setDisplaySize(36,36).setDepth(12).setVisible(false);

    const directions=["down","left","right","up"];
    directions.forEach((direction,row)=>{
      this.anims.create({key:`chef-walk-${direction}`,frames:this.anims.generateFrameNumbers("chef",{start:row*4,end:row*4+3}),frameRate:8,repeat:-1});
      this.anims.create({key:`chef-work-${direction}`,frames:this.anims.generateFrameNumbers("chef",{start:(row+4)*4,end:(row+4)*4+3}),frameRate:10,repeat:-1});
    });

    this.moveKeys=this.input.keyboard.addKeys({
      up:Phaser.Input.Keyboard.KeyCodes.UP,
      down:Phaser.Input.Keyboard.KeyCodes.DOWN,
      left:Phaser.Input.Keyboard.KeyCodes.LEFT,
      right:Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w:Phaser.Input.Keyboard.KeyCodes.W,
      a:Phaser.Input.Keyboard.KeyCodes.A,
      s:Phaser.Input.Keyboard.KeyCodes.S,
      d:Phaser.Input.Keyboard.KeyCodes.D
    });

    dom.startButton.disabled=false;dom.startButton.textContent="게임 시작";
    buildMenuCards();showGameHud(false);dom.titleScreen.classList.add("active");dom.gameScreen.classList.remove("active");updateUI(true);draw();syncPhaserObjects();
  }

  update(_time,delta){
    update(Math.min(.033,delta/1000));
    draw();
    syncPhaserObjects();
  }
}

function bootPhaser(){
  return new Phaser.Game({
    type:Phaser.CANVAS,
    width:W,
    height:H,
    parent:"gameCanvas",
    backgroundColor:"#17100d",
    pixelArt:true,
    antialias:false,
    roundPixels:false,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
    scene:DinerScene
  });
}

Promise.all([
  loadNativeImage("chef","assets/chef_sheet.png"),
  loadNativeImage("customers","assets/customer_sheet.png"),
  loadNativeImage("food","assets/food_sheet.png"),
  loadNativeImage("kitchenDay","assets/kitchen-background-day.png"),
  loadNativeImage("kitchenNight","assets/kitchen-background-night.png")
]).then(bootPhaser).catch(error=>{
  console.error(error);
  dom.startButton.textContent="에셋 로딩 실패";
  dom.pauseMessage.textContent="게임 이미지를 불러오지 못했습니다. 파일 위치를 확인해 주세요.";
});
