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
  "settingsButton","codexButton","menuCards","leftTitle","phaseBadge","inventoryList","phaseButton","objectiveTitle","objectiveBody",
  "relationshipList",
  "cleanlinessText","cleanlinessBar","cleaningText","stationPrompt","toast","startButton","continueButton","saveInfo","titleSettingsButton",
  "settingsOverlay","pauseMessage","masterVolume","masterVolumeValue","bgmVolume","bgmVolumeValue","sfxVolume","sfxVolumeValue",
  "resumeButton","returnTitleButton","miniOverlay","miniStation","miniTitle","miniTimer","miniClose","miniPause","miniDescription","miniContent","miniFeedback",
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
  bgmFiles:Object.freeze({day:"assets/bgm/bgm_day.mp3",night:"assets/bgm/bgm_night.mp3"}),
  // 파일이 둘인 효과음은 호출할 때마다 1 → 2 → 1 순서로 골라 반복감을 줄입니다.
  // 논리 이름과 실제 파일명을 여기 한곳에서만 연결해 엔진 쪽에는 경로를 흩뿌리지 않습니다.
  files:Object.freeze({
    pan_sizzle:["assets/sfx/sfx_pan_sizzle_loop.MP3"],
    deep_fry:["assets/sfx/sfx_deep_fry_loop.MP3"],
    griddle_sizzle:["assets/sfx/sfx_griddle_sizzle_loop.MP3"],
    gas_flame:["assets/sfx/sfx_gas_flame_loop.MP3"],
    clear_simmer:["assets/sfx/sfx_clear_simmer_loop.MP3"],
    thick_boil:["assets/sfx/sfx_thick_boil_loop.MP3"],
    knife_daikon:["assets/sfx/sfx_knife_daikon.MP3"],
    cut_crisp:["assets/sfx/sfx_cut_crisp.MP3"],
    cut_soft:["assets/sfx/sfx_cut_soft.MP3"],
    cut_wet:["assets/sfx/sfx_cut_wet.MP3"],
    cut_meat1:["assets/sfx/sfx_cut_meat1.MP3"],
    cut_meat2:["assets/sfx/sfx_cut_meat2.MP3"],
    metal_scrape:["assets/sfx/sfx_metal_scrape1.MP3","assets/sfx/sfx_metal_scrape2.MP3"],
    wood_stir:["assets/sfx/sfx_wood_stir1.MP3","assets/sfx/sfx_wood_stir2.MP3"],
    mandoline_slide:["assets/sfx/sfx_mandoline_slide1.MP3","assets/sfx/sfx_mandoline_slide2.MP3"],
    fry_basket_lift:["assets/sfx/sfx_fry_basket_lift.MP3"],
    fry_basket_shake:["assets/sfx/sfx_fry_basket_shake.MP3"],
    pancake_flip:["assets/sfx/sfx_pancake_flip.MP3"],
    charcoal_grill:["assets/sfx/sfx_charcoal_grill_loop.MP3"],
    whisk_mix:["assets/sfx/sfx_whisk_mix_loop1.MP3","assets/sfx/sfx_whisk_mix_loop2.MP3"],
    input_wrong:["assets/sfx/sfx_input_wrong.MP3"],
    result_perfect:["assets/sfx/sfx_result_perfect.MP3"],
    result_good:["assets/sfx/sfx_result_good.MP3"],
    timer_warning:["assets/sfx/sfx_timer_warning.MP3"],
    ui_click:["assets/sfx/sfx_ui_click.MP3"]
  }),
  preloaded:new Map(), activeFiles:new Set(), ownerFiles:new Map(), loopFiles:new Map(), variantCursor:{},
  bgmElements:new Map(),bgmElement:null,bgmTrack:null,bgmStarted:false,bgmPlayPending:false,bgmFadeStart:0,bgmFadeDuration:1200,
  preload(){
    Object.values(this.files).flat().forEach(src=>{
      if(this.preloaded.has(src))return;
      const element=new Audio();element.preload="auto";element.src=src;this.preloaded.set(src,element);element.load();
    });
    Object.entries(this.bgmFiles).forEach(([track,src])=>{
      if(this.bgmElements.has(track))return;
      const element=new Audio();element.preload="auto";element.src=src;element.loop=true;
      this.bgmElements.set(track,element);element.load();
    });
  },
  fileGain(entry){return clamp(state.audio.master*state.audio.sfx*.72*(entry.gain??1),0,1);},
  bgmFileGain(){return clamp(state.audio.master*state.audio.bgm*.32,0,1);},
  pickFile(name){
    const variants=this.files[name];if(!variants?.length)return null;
    const index=this.variantCursor[name]||0;this.variantCursor[name]=(index+1)%variants.length;
    return variants[index%variants.length];
  },
  play(name,{loop=false,owner=null,gain=1}={}){
    const src=this.pickFile(name);if(!src)return null;
    if(loop&&owner){
      const current=this.loopFiles.get(owner)?.get(name);
      if(current&&!current.element.ended)return current;
    }
    const element=this.preloaded.get(src)?.cloneNode(true)||new Audio(src);
    const entry={name,element,owner,gain,loop,pausedBySettings:false};
    element.loop=loop;element.preload="auto";element.volume=this.fileGain(entry);
    const cleanup=()=>this.releaseFile(entry);
    element.addEventListener("ended",cleanup,{once:true});element.addEventListener("error",cleanup,{once:true});
    this.activeFiles.add(entry);
    if(owner){
      if(!this.ownerFiles.has(owner))this.ownerFiles.set(owner,new Set());
      this.ownerFiles.get(owner).add(entry);
    }
    if(loop&&owner){
      if(!this.loopFiles.has(owner))this.loopFiles.set(owner,new Map());
      this.loopFiles.get(owner).set(name,entry);
    }
    const started=element.play();
    if(started?.catch)started.catch(()=>cleanup());
    return entry;
  },
  loop(name,owner,gain=1){return this.play(name,{loop:true,owner,gain});},
  releaseFile(entry){
    this.activeFiles.delete(entry);
    if(entry.owner){
      const owned=this.ownerFiles.get(entry.owner);owned?.delete(entry);if(owned&&!owned.size)this.ownerFiles.delete(entry.owner);
      const loops=this.loopFiles.get(entry.owner);if(loops?.get(entry.name)===entry)loops.delete(entry.name);if(loops&&!loops.size)this.loopFiles.delete(entry.owner);
    }
  },
  stopFile(entry){if(!entry)return;entry.element.pause();entry.element.currentTime=0;this.releaseFile(entry);},
  stop(name,owner){const entry=this.loopFiles.get(owner)?.get(name);if(entry)this.stopFile(entry);},
  stopOwner(owner){[...(this.ownerFiles.get(owner)||[])].forEach(entry=>this.stopFile(entry));},
  stopAllFiles(exceptName=null){[...this.activeFiles].filter(entry=>entry.name!==exceptName).forEach(entry=>this.stopFile(entry));},
  pauseLoops(){this.activeFiles.forEach(entry=>{if(entry.loop&&!entry.element.paused){entry.pausedBySettings=true;entry.element.pause();}});},
  resumeLoops(){this.activeFiles.forEach(entry=>{if(entry.loop&&entry.pausedBySettings){entry.pausedBySettings=false;entry.element.play().catch(()=>this.stopFile(entry));}});},
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
    if(this.ctx){
      this.master.gain.value = state.audio.master;
      this.bgm.gain.value = state.audio.bgm * .18;
      this.sfx.gain.value = state.audio.sfx * .35;
    }
    this.activeFiles.forEach(entry=>entry.element.volume=this.fileGain(entry));
    if(this.bgmElement&&!this.bgmFadeStart)this.bgmElement.volume=this.bgmFileGain();
  },
  tone(freq=440,duration=.09,type="square",gain=.12,when=0,target="sfx") {
    if (!this.ctx) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=gain;
    o.connect(g); g.connect(this[target]);
    const t=this.ctx.currentTime+when; o.start(t); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.001,t+duration); o.stop(t+duration+.02);
  },
  click(){ this.tone(520,.05,"square",.08); },
  uiClick(){ this.play("ui_click",{gain:1.35}); },
  success(){ this.tone(660,.09,"triangle",.12); this.tone(880,.12,"triangle",.1,.07); },
  bad(){ this.play("input_wrong",{gain:.9}); },
  result(scoreOrGrade){
    const perfect=scoreOrGrade==="perfect"||Number(scoreOrGrade)>=90;
    const good=scoreOrGrade==="good"||(Number(scoreOrGrade)>=70&&Number(scoreOrGrade)<90);
    if(perfect)this.play("result_perfect",{gain:.38});else if(good)this.play("result_good",{gain:.38});else this.bad();
  },
  serve(){ this.tone(523,.08,"triangle",.12); this.tone(659,.08,"triangle",.1,.08); this.tone(784,.13,"triangle",.09,.16); },
  startBgm(){
    if(!this.ctx)return;
    this.bgmStarted=true;this.syncBgm(true);
  },
  syncBgm(force=false){
    if(!this.bgmStarted)return;
    const track=state.phase==="night"?"night":"day";
    if(force||track!==this.bgmTrack){
      if(this.bgmElement){this.bgmElement.pause();this.bgmElement.currentTime=0;}
      this.bgmTrack=track;this.bgmElement=this.bgmElements.get(track)||null;
      this.bgmPlayPending=false;this.bgmFadeStart=0;
    }
    const shouldPlay=state.screen==="game"&&state.phase!=="result"&&!state.paused;
    if(!shouldPlay){
      if(this.bgmElement&&!this.bgmElement.paused)this.bgmElement.pause();
      this.bgmPlayPending=false;this.bgmFadeStart=0;return;
    }
    const element=this.bgmElement;if(!element)return;
    const now=performance.now();
    if(element.paused&&!this.bgmPlayPending){
      element.volume=0;this.bgmFadeStart=now;this.bgmPlayPending=true;
      const started=element.play();
      if(started?.then)started.then(()=>{this.bgmPlayPending=false;}).catch(()=>{this.bgmPlayPending=false;});
      else this.bgmPlayPending=false;
    }
    if(!element.paused&&this.bgmFadeStart){
      const progress=clamp((now-this.bgmFadeStart)/this.bgmFadeDuration,0,1);
      element.volume=this.bgmFileGain()*progress;
      if(progress>=1)this.bgmFadeStart=0;
    }else if(!element.paused&&!this.bgmFadeStart)element.volume=this.bgmFileGain();
  },
  stopBgm(){
    this.bgmStarted=false;this.bgmPlayPending=false;this.bgmFadeStart=0;this.bgmTrack=null;
    this.bgmElements.forEach(element=>{element.pause();element.currentTime=0;element.volume=0;});
    this.bgmElement=null;
  }
};
audio.preload();

// 실제 메뉴·설정 버튼 클릭을 한곳에서 받아 누락과 이중 재생을 막습니다.
// 미니게임 조작 버튼은 조리 효과음 영역이므로 이 목록에 넣지 않습니다.
const UI_CLICK_SELECTOR=[
  "#startButton","#continueButton","#titleSettingsButton",
  "#settingsButton","#codexButton","#resumeButton","#returnTitleButton",
  "#menuSelectConfirm",".menu-select-option",".order-row",
  "#phaseButton","#nextDayButton","#miniClose","#miniPause"
].join(",");
document.addEventListener("click",event=>{
  const control=event.target.closest?.(UI_CLICK_SELECTOR);
  if(!control||control.disabled||control.getAttribute("aria-disabled")==="true")return;
  audio.uiClick();
},true);

function showGameHud(show) {
  [dom.topHud,dom.leftHud,dom.rightHud,dom.mobileControls].forEach(el => el.classList.toggle("hidden-hud",!show));
}

function openSettings(from=state.screen) {
  if(from==="game")saveGame();
  state.settingsFrom=from; state.paused=true; dom.pauseMessage.textContent=from==="title"?"소리 설정을 변경할 수 있습니다.":"게임이 일시정지되었습니다.";
  dom.returnTitleButton.style.display=from==="title"||storyIsActive()?"none":"block";
  dom.resumeButton.textContent=from==="title"?"설정 닫기":"게임으로 돌아가기";
  dom.settingsOverlay.classList.add("open"); audio.pauseLoops();
}
function closeSettings() {
  dom.settingsOverlay.classList.remove("open");
  state.paused=state.settingsFrom==="title" || state.phase==="result";
  if(state.settingsFrom!=="title")audio.resumeLoops();
}

/* 반짝임(fx_perfect_sparkle)을 달 음식인지. 메뉴 카드·손님 말풍선·요리사 손
   세 군데가 같은 기준을 씁니다.
     · 그날의 특별음식 (DAY_DATA.specialMenu — day.js 메뉴 선택 화면의 "특별음식")
     · 이야기 손님의 특별 조리 주문 (order.specialRecipe)
   조리 점수와는 무관합니다. 점수로 그림이 바뀌는 건 _perfect 프랍 쪽입니다. */
function isSpecialFood(dishId,order=null){
  if(order?.specialRecipe) return true;
  return !!dishId && getCurrentDayData()?.specialMenu===dishId;
}

function buildMenuCards() {
  dom.menuCards.innerHTML="";
  selectedDishes().forEach(dish=>{
    const b=document.createElement("button"); b.type="button"; b.className="menu-card"; b.dataset.id=dish.id;
    const orderCount=state.phase==="night"?state.orders.filter(order=>order.dishId===dish.id).length:0;
    const required=getCurrentDayData().requiredMenus.includes(dish.id);
    // 음식 그림은 food-props.js 가 메뉴 id 로 찾아 줍니다. (표에 없는 메뉴만 자리표시)
    // 특별음식이면 sparkle 클래스가 붙고 반짝임은 CSS 가 돌립니다. (css/hud.css)
    const iconUrl=foodPropUrl(dish.id);
    const sparkle=isSpecialFood(dish.id)?" sparkle":"";
    const icon=iconUrl?`<span class="food-icon${sparkle}" style="background-image:url('${iconUrl}')"></span>`:'<span class="food-icon menu-icon-placeholder">🍽</span>';
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
  const required=currentRequirement();
  const station=nearestStation(required);
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
  if(station.id!==required){ showToast(`지금은 ${required?stationById(required).label:"주문 선택"} 단계입니다.`,true); return; }
  startCookMini(station.id);
}

function startMini(type,stationId,context) {
  // engine 은 mini-engine.js 의 등록소에서 찾을 이름입니다.
  // 밤 조리는 type 이 곧 엔진 이름이고, 낮 준비는 startDayPrepMini 가 "dayPrep" 을 넣습니다.
  state.mini={type,engine:type,stationId,context:context||{},time:8,score:0,data:{},complete:false};
  dom.miniStation.textContent=stationById(stationId)?.label||stationId;
  dom.miniFeedback.textContent=""; dom.miniContent.innerHTML=""; dom.miniOverlay.classList.add("open");
  dom.miniClose.hidden=true;
  setupMini();
}

function setupMini() {
  const m=state.mini; if(!m) return;
  const engine=miniEngine(m);
  if(!engine){console.error(`미니게임 엔진을 찾지 못했습니다: ${m.engine}`);return;}
  const dish=dishById(m.context.dishId || state.selectedDishId);
  const difficulty=cookingDifficultyMultiplier(m.context);
  // 공용 패널(제목·설명·제한시간)을 채우는 도우미. 각 엔진의 setup 이 불러 씁니다.
  const set=(title,desc,time)=>{
    const special=m.context.special;
    dom.miniTitle.textContent=special?`특별 조리 · ${title}`:title;
    dom.miniDescription.textContent=special?`${desc} 평소보다 조금 더 섬세한 조리가 필요합니다.`:desc;
    m.time=special?Math.max(5.5,time/difficulty):time;
    dom.miniTimer.textContent=m.time.toFixed(1);
  };
  engine.setup?.(m,{dish,set,difficulty});
  if(m.context.special&&Number.isFinite(m.data.speed))m.data.speed*=difficulty;
}

// Space · ACTION 버튼 · 미니게임 안 조작 버튼이 모두 여기로 들어옵니다.
function miniAction() {
  const m=state.mini; if(!m)return;
  miniEngine(m)?.action?.(m);
}

function finishMini(score) {
  const m=state.mini;if(!m||m.complete)return;m.complete=true;score=Math.round(clamp(score,0,100));m.score=score;
  audio.stopOwner(m);
  dom.miniFeedback.textContent=score>=90?`완벽해요! ${score}점`:score>=70?`좋아요! ${score}점`:`조금 아쉬워요. ${score}점`;
  audio.result(score);
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
      spawnPopup(state.player.x,state.player.y-70,`${dish.name} +3 · 품질 ${q}`);showToast(`${dish.name} 3인분 준비 완료!`);
    }else showToast(`다음 단계: ${STATIONS[dish.prep[run.stepIndex]].label}`);
  }else if(m.context.mode==="cook"){
    const order=state.orders.find(o=>o.id===m.context.orderId);if(!order)return;order.cookScores.push(score);order.cookStep++;
    const dish=dishById(order.dishId);state.trash=Math.min(6,state.trash+(m.stationId==="fryer"?1:0));
    if(order.cookStep>=dish.cook.length){
      state.inventory[dish.id].count--;state.carrying={orderId:order.id,dishId:dish.id,cookScore:Math.round(order.cookScores.reduce((a,b)=>a+b,0)/order.cookScores.length)};
      showToast(`${dish.name} 완성! 주문한 손님에게 가져다주세요.`);spawnPopup(state.player.x,state.player.y-75,"완성!");
    }else showToast(`다음 조리: ${stationById(dish.cook[order.cookStep].station)?.label||dish.cook[order.cookStep].station}`);
  }
  updateUI(true);saveGame();
}

function update(dt) {
  audio.syncBgm?.();
  if(state.paused){
    if(state.mini){updateMini(dt);updateUI(false);}
    // 대화 연출·설정 창처럼 멈춰 있는 동안에도 상호작용 표시(키캡 E)는
    // 갱신되어야 합니다. 안 부르면 멈추기 직전 상태로 계속 떠 있습니다.
    // updatePrompt() 안에서 state.paused 를 보고 스스로 숨습니다.
    else updatePrompt();
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
  const engine=miniEngine(m);if(!engine)return;
  // 제한시간을 깎을지는 엔진이 정합니다(두부 썰기·기름 털기·낮 준비는 멈춰 있습니다).
  if(engine.timerRuns?engine.timerRuns(m):true){
    if(m.time>3)m.timerWarningPlayed=false;
    const previousTime=m.time;
    m.time-=dt;dom.miniTimer.textContent=Math.max(0,m.time).toFixed(1);
    if(previousTime>3&&m.time<=3&&!m.timerWarningPlayed){m.timerWarningPlayed=true;audio.play("timer_warning",{owner:m,gain:.85});}
  }
  engine.update?.(m,dt);
  if(Number.isFinite(m.time)&&m.time<=0){
    if(engine.timeout)engine.timeout(m);
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
  dom.phaseButton.style.display=state.phase===GAME_PHASES.PREP?"block":"none";dom.phaseButton.textContent=[3,4].includes(Number(state.day))&&prepComplete()?`Day ${state.day} 준비 완료 · 영업 시작`:"영업 시작";dom.phaseButton.disabled=state.phase===GAME_PHASES.PREP&&(!prepComplete()||!!state.mini);
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
      // 선행 작업이 남았거나 이미 끝낸 준비물에는 띄우지 않습니다.
      // 판정은 prep.js 가 이름표 강조에 쓰는 것과 같은 함수입니다.
      const prepObject=nearestPrepObject();
      if(prepObject&&prepObjectUsable(prepObject,prepObject)){text=`E · ${prepObject.task.objectLabel}`;x=prepObject.x;y=prepObject.y-58;}
    }else{
      const required=currentRequirement();
      const station=nearestStation(required);
      if(station){
      if(station.id==="dishwasher"&&state.dirtyDishes>0)text="E · 설거지하기";
      else if(station.id==="trash"&&state.trash>0)text="E · 쓰레기 정리";
      else if(station.id===required)text=`E · ${station.label} 사용`;
      if(text){x=station.ix;y=station.id==="griddle"?station.iy-58:station.y+station.h+60;}
      }
    }
  }
  if(!text){hide();return;}
  // 화면에는 키캡 'E' 만 보입니다. 설명 문구는 스크린리더용으로만 남깁니다.
  // (textContent 로 넣으면 index.html 의 키캡 span 이 지워집니다)
  prompt.setAttribute("aria-label",text);prompt.disabled=false;
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
// drawFixtureLabel/roundRect/wrapCanvasText → draw-utils.js
// drawFoodProp (음식 그림) → food-props.js

dom.settingsButton.addEventListener("click",()=>openSettings("game"));
// 도감은 아직 기능이 없어 안내 메시지만 띄웁니다.
dom.codexButton.addEventListener("click",()=>showToast("도감은 준비 중입니다."));
dom.resumeButton.addEventListener("click",closeSettings);
dom.phaseButton.addEventListener("click",beginNight);
dom.nextDayButton.addEventListener("click",advanceToNextDay);
dom.menuSelectConfirm.addEventListener("click",confirmMenuSelection);
dom.actionButton.addEventListener("click",()=>{if(state.mini)miniAction();else interact();});
dom.miniClose.addEventListener("click",closeDayPrepMini);
// 닫을 수 없는 미니게임(밤 조리)에서는 닫기 대신 일시정지 버튼이 뜹니다.
dom.miniPause.addEventListener("click",()=>openSettings("game"));
dom.stationPrompt.addEventListener("click",interact);

[[dom.masterVolume,"master",dom.masterVolumeValue],[dom.bgmVolume,"bgm",dom.bgmVolumeValue],[dom.sfxVolume,"sfx",dom.sfxVolumeValue]].forEach(([input,key,label])=>input.addEventListener("input",()=>{state.audio[key]=Number(input.value)/100;label.textContent=`${input.value}%`;audio.apply();}));

window.addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.code==="Space")e.preventDefault();
  if(state.mini){
    // 어떤 키를 어떻게 처리할지는 각 엔진이 압니다(mini-engine.js 등록소 참고).
    // key 가 true 를 반환하면 그 엔진이 처리했다는 뜻이라 여기서 끝냅니다.
    const engine=miniEngine(state.mini);
    if(!engine?.key?.(state.mini,k,e)&&e.code==="Space")miniAction();
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
window.addEventListener("keyup",e=>{
  if(state.mini)miniEngine(state.mini)?.keyup?.(state.mini,e.key.toLowerCase(),e);
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
    registerFoodPropTextures(this);   // food-props.js — 음식 그림 8종(+완벽 조리 변형)

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
  loadFoodPropAssets(),
  loadStageAssets(),
  loadCounterAssets(),
  loadDayPrepAssets()
]).then(bootPhaser).catch(error=>{
  console.error(error);
  markTitleLoadFailed();
});
