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
  "appRoot","titleScreen","gameScreen","gameApp","topHud","leftHud","rightHud","mobileControls","phaseName","dayText","timeLabel","timeText","satisfactionLabel","satisfactionText","popularityText","moneyText",
  "settingsButton","codexButton","menuCards","leftTitle","phaseBadge","inventoryList","phaseButton","objectiveTitle","objectiveBody",
  "relationshipList",
  "stationPrompt","stationPromptLabel","toast","startButton","continueButton","saveInfo","titleSettingsButton",
  "settingsOverlay","pauseMessage",
  "masterVolumeRow","masterVolume","masterVolumeValue","masterAudioToggle",
  "bgmVolumeRow","bgmVolume","bgmVolumeValue","bgmAudioToggle",
  "sfxVolumeRow","sfxVolume","sfxVolumeValue","sfxAudioToggle",
  "saveLoadActions","manualSaveButton","loadGameButton","resumeButton","returnTitleButton","settingsCloseButton",
  "miniOverlay","miniStation","miniTitle","miniTimer","miniClose","miniPause","miniDescription","miniContent","miniFeedback",
  "resultOverlay","servedResult","satisfactionResult","fiveStarResult","popularityResult","wasteResult","revenueResult","resultComment","nextDayButton",
  "menuSelectOverlay","menuSelectTitle","menuSelectDescription","menuSelectGrid","menuSelectCount","menuSelectConfirm",
  "ingredientSelectOverlay","ingredientSelectTitle","ingredientDishGallery","ingredientChecklist","ingredientGrid","fridgeColdAir","ingredientSelectFeedback","ingredientTotalProgress","ingredientPause",
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
// 한글 IME 조합 중에는 KeyboardEvent.key/keyCode가 한글 문자나 229가 될 수
// 있습니다. 이동은 물리 키 위치인 event.code로도 별도 추적합니다.
const physicalMoveKeys={w:false,a:false,s:false,d:false};
window.physicalMoveKeys=physicalMoveKeys;

function setPhysicalMoveKey(event,isDown){
  const direction={KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d"}[event.code];
  if(!direction)return false;
  physicalMoveKeys[direction]=!!isDown;
  return true;
}

function clearPhysicalMoveKeys(){
  Object.keys(physicalMoveKeys).forEach(key=>{physicalMoveKeys[key]=false;});
}
window.clearPhysicalMoveKeys=clearPhysicalMoveKeys;

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
  ingredientSelection:null,
  prepProgress:createDayPrepProgress(),
  // 낮 준비 작업별 결과. 메뉴별 준비 완성도로 남기되 손님의 최종 평가는
  // night.js에서 밤 조리 점수만 사용합니다.
  prepTaskScores:{},
  kimchiPrep:{cuttingComplete:false,fryingComplete:false},
  skewerPrep:createSkewerPrepProgress(),   // 낮에 꽂은 꼬치 배치 → 밤 굽기가 그대로 씁니다 (day.js)
  selectedOrderId:null,
  inventory:Object.fromEntries(DISHES.map(d => [d.id,{count:0,quality:0,prepared:false}])),
  prepRun:null,
  orders:[],
  respawns:[],
  carrying:null,
  served:0,
  generalServed:0,
  generalSpawnedCustomers:0,
  satisfactionTotal:0,
  fiveStar:0,
  departures:[],
  mini:null,
  particles:[],
  popups:[],
  player:{ x:PLAYER_START.x, y:PLAYER_START.y, facing:PLAYER_START.facing, moving:false, speed:PLAYER_START.speed },
  story:createStoryState(),
  audio:readAudioSettings()
};

function hideRetiredEconomyUi(){
  [dom.popularityText,dom.moneyText,dom.popularityResult,dom.wasteResult,dom.revenueResult]
    .forEach(element=>{if(element?.parentElement)element.parentElement.hidden=true;});
}

function dishById(id) { return DISHES.find(d => d.id === id); }
function stationById(id) { return STATIONS[id]||FRONT_STATIONS[id]||null; }
function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t) { return a+(b-a)*t; }
function distance(a,b,c,d) { return Math.hypot(a-c,b-d); }
function shuffle(arr) { return [...arr].sort(() => Math.random()-.5); }
function formatTime(sec) { sec=Math.max(0,Math.ceil(sec)); return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; }
function avgSatisfaction() { return state.served ? Math.round(state.satisfactionTotal/state.served) : 0; }

function audioIsEnabled(){return state.audio?.enabled!==false;}
function audioSettingIsEnabled(key){return state.audio?.[key]!==false;}
function bgmAudioIsEnabled(){return audioIsEnabled()&&audioSettingIsEnabled("bgmEnabled");}
function sfxAudioIsEnabled(){return audioIsEnabled()&&audioSettingIsEnabled("sfxEnabled");}
function audioMasterGain(){return audioIsEnabled()?state.audio.master:0;}
function persistAudioSettings(){state.audio=writeAudioSettings(state.audio);}

function syncAudioToggle(button,enabled,label){
  button.textContent=enabled?"ON":"OFF";
  button.classList.toggle("is-off",!enabled);
  button.setAttribute("aria-pressed",String(enabled));
  button.setAttribute("aria-label",enabled
    ?`${label} 켜짐. 누르면 끄기`
    :`${label} 꺼짐. 누르면 켜기`);
}

function syncAudioControls(){
  [[dom.masterVolume,"master",dom.masterVolumeValue],[dom.bgmVolume,"bgm",dom.bgmVolumeValue],[dom.sfxVolume,"sfx",dom.sfxVolumeValue]].forEach(([input,key,label])=>{
    const value=Math.round(state.audio[key]*100);input.value=value;label.textContent=`${value}%`;
  });
  const masterEnabled=audioIsEnabled();
  const bgmEnabled=audioSettingIsEnabled("bgmEnabled");
  const sfxEnabled=audioSettingIsEnabled("sfxEnabled");
  syncAudioToggle(dom.masterAudioToggle,masterEnabled,"전체 음향");
  syncAudioToggle(dom.bgmAudioToggle,bgmEnabled,"배경음악");
  syncAudioToggle(dom.sfxAudioToggle,sfxEnabled,"효과음");
  dom.settingsOverlay.classList.toggle("audio-muted",!masterEnabled);
  dom.bgmVolumeRow.classList.toggle("is-muted",!bgmEnabled);
  dom.sfxVolumeRow.classList.toggle("is-muted",!sfxEnabled);
}

const audio = {
  ctx:null, master:null, bgm:null, sfx:null,
  bgmFiles:Object.freeze({
    day:"assets/bgm/bgm_day.mp3",
    night:"assets/bgm/bgm_night.mp3",
    storyCompany:"assets/bgm/story/bgm_company_story.mp3",
    storySikdang:"assets/bgm/story/bgm_in_first_sikdang.mp3",
    storyFacelessDaeun:"assets/bgm/story/bgm_story_faceless_daeun.MP3",
    endingLoopReturn:"assets/bgm/story/ending/bgm_ending_loop_return.MP3",
    endingAloneMorning:"assets/bgm/story/ending/bgm_ending_alone_morning.MP3",
    endingGuestsDawn:"assets/bgm/story/ending/bgm_ending_guests_dawn.MP3",
    endingOpenForever:"assets/bgm/story/ending/bgm_ending_open_forever.MP3",
    endingMorningTogether:"assets/bgm/story/ending/bgm_ending_morning_together.MP3"
  }),
  // 400ms 단위의 스테레오 RMS를 측정해 낮 BGM(-24.65dBFS)에 맞춘 값입니다.
  // 원본 파일을 다시 인코딩하지 않고 트랙 GainNode에서만 보정합니다.
  bgmTrackGains:Object.freeze({
    day:1,
    night:3.685,
    storyCompany:.95,
    storySikdang:.571,
    storyFacelessDaeun:.3433,
    endingLoopReturn:.7233,
    endingAloneMorning:.3972,
    endingGuestsDawn:.394,
    endingOpenForever:.6087,
    endingMorningTogether:.4126
  }),
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
    plate_set:["assets/sfx/sfx_plate_tofu_place.MP3"],
    charcoal_grill:["assets/sfx/sfx_charcoal_grill_loop.MP3"],
    whisk_mix:["assets/sfx/sfx_whisk_mix_loop1.MP3","assets/sfx/sfx_whisk_mix_loop2.MP3"],
    input_wrong:["assets/sfx/sfx_input_wrong.MP3"],
    result_perfect:["assets/sfx/sfx_result_perfect.MP3"],
    result_good:["assets/sfx/sfx_result_good.MP3"],
    timer_warning:["assets/sfx/sfx_timer_warning.MP3"],
    ui_click:["assets/sfx/sfx_ui_click.MP3"],
    journal_page_turn:["assets/sfx/ui/sfx_next_book.MP3"],
    food_serve:["assets/sfx/sfx_food_serve.MP3"],
    pour_thin:["assets/sfx/sfx_pour_thin.MP3"],
    pour_thick:["assets/sfx/sfx_pour_thick.MP3"],
    pour_syrup:["assets/sfx/sfx_pour_syrup.MP3"],
    pour_water:["assets/sfx/sfx_pour_water.MP3"],
    pour_pancake_flour:["assets/sfx/sfx_pour_pancake_flour.MP3"],
    drop_pancake_kimchi:["assets/sfx/sfx_drop_pancake_kimchi.MP3"],
    fries_starch_bag_shake:["assets/sfx/sfx_fries_starch_bag_shake1.MP3","assets/sfx/sfx_fries_starch_bag_shake2.MP3"],
    soak_ingredient_drop:["assets/sfx/sfx_soak_ingredient_drop.MP3"],
    shrimp_flour_coat:["assets/sfx/sfx_shrimp_flour_coat.MP3"],
    shrimp_egg_coat:["assets/sfx/sfx_shrimp_egg_coat.MP3"],
    shrimp_crumb_coat:["assets/sfx/sfx_shrimp_crumb_coat.MP3"],
    skewer_turn:["assets/sfx/sfx_skewer_turn.MP3"],
    skewer_pierce:["assets/sfx/sfx_skewer_pierce.MP3"],
    anchovy_tension:["assets/sfx/sfx_anchovy_tension1.MP3","assets/sfx/sfx_anchovy_tension2.MP3"],
    anchovy_finish:["assets/sfx/sfx_anchovy_finish.MP3"],
    story_rain:["assets/sfx/story/sfx_rain.MP3"],
    story_open_door:["assets/sfx/story/sfx_open_door.MP3"],
    story_guest_d1_arrival:["assets/sfx/story/guests/sfx_story_d1_raindrop_arrival.MP3"],
    story_guest_d2_arrival:["assets/sfx/story/guests/sfx_story_d2_lantern_arrival.MP3"],
    story_guest_d3_arrival:["assets/sfx/story/guests/sfx_story_d3_twin_shadow_arrival.MP3"],
    story_guest_d4_arrival:["assets/sfx/story/guests/sfx_story_d4_crow_letter_arrival.MP3"],
    story_guest_d5_arrival:["assets/sfx/story/guests/sfx_story_d5_star_beast_arrival.MP3"],
    story_guest_d6_arrival:["assets/sfx/story/guests/sfx_story_d6_seawater_arrival.MP3"],
    story_guest_d7_arrival:["assets/sfx/story/guests/sfx_story_d7_clock_444_arrival.MP3"],
    fragment_full_d1:["assets/sfx/story/fragments/sfx_d1_finish.MP3"],
    fragment_full_d2:["assets/sfx/story/fragments/sfx_d2_finish.MP3"],
    fragment_full_d3:["assets/sfx/story/fragments/sfx_d3_finish.MP3"],
    fragment_full_d4:["assets/sfx/story/fragments/sfx_d4_finish.MP3"],
    fragment_full_d5:["assets/sfx/story/fragments/sfx_d5_finish.MP3"],
    fragment_full_d6:["assets/sfx/story/fragments/sfx_d6_finish.MP3"],
    fragment_full_d7:["assets/sfx/story/fragments/sfx_d7_finish.MP3"],
    daeun_ribbon_handoff:["assets/sfx/story/fragments/sfx_story_daeun_ribbon_handoff.MP3"]
  }),
  /* 브라우저에서 스테레오 활성 RMS/피크를 전수 측정한 파일별 보정값입니다.
     썰기 6종 중앙값 -25.8dBFS를 기준으로 단발 조리음은 -25.8,
     UI·결과·스토리 큐는 -27.5, 조리 루프는 -31.8,
     대사 아래의 스토리 앰비언스는 -33.8dBFS에 맞췄습니다. */
  sfxFileGains:Object.freeze({
    "assets/sfx/sfx_anchovy_finish.MP3":.5623,
    "assets/sfx/sfx_anchovy_tension1.MP3":2.3388,
    "assets/sfx/sfx_anchovy_tension2.MP3":2.1727,
    "assets/sfx/sfx_charcoal_grill_loop.MP3":5.8412,
    "assets/sfx/sfx_clear_simmer_loop.MP3":.3784,
    "assets/sfx/sfx_cut_crisp.MP3":1.1682,
    "assets/sfx/sfx_cut_meat1.MP3":.639,
    "assets/sfx/sfx_cut_meat2.MP3":.9311,
    "assets/sfx/sfx_cut_soft.MP3":1.2023,
    "assets/sfx/sfx_cut_wet.MP3":1.0678,
    "assets/sfx/sfx_deep_fry_loop.MP3":.366,
    "assets/sfx/sfx_drop_pancake_kimchi.MP3":.7337,
    "assets/sfx/sfx_food_serve.MP3":1.0678,
    "assets/sfx/sfx_fries_starch_bag_shake1.MP3":1.3599,
    "assets/sfx/sfx_fries_starch_bag_shake2.MP3":1.3677,
    "assets/sfx/sfx_fry_basket_lift.MP3":.9194,
    "assets/sfx/sfx_fry_basket_shake.MP3":.7998,
    "assets/sfx/sfx_gas_flame_loop.MP3":.6769,
    "assets/sfx/sfx_griddle_sizzle_loop.MP3":.537,
    "assets/sfx/sfx_input_wrong.MP3":.8861,
    "assets/sfx/sfx_knife_daikon.MP3":.7736,
    "assets/sfx/sfx_mandoline_slide1.MP3":.881,
    "assets/sfx/sfx_mandoline_slide2.MP3":1.0116,
    "assets/sfx/sfx_metal_scrape1.MP3":1.3351,
    "assets/sfx/sfx_metal_scrape2.MP3":1.3459,
    "assets/sfx/sfx_pan_sizzle_loop.MP3":1.4538,
    "assets/sfx/sfx_pancake_flip.MP3":.6012,
    "assets/sfx/sfx_plate_tofu_place.MP3":10.9018,
    "assets/sfx/sfx_pour_pancake_flour.MP3":4.1305,
    "assets/sfx/sfx_pour_syrup.MP3":4.9831,
    "assets/sfx/sfx_pour_thick.MP3":4.9831,
    "assets/sfx/sfx_pour_thin.MP3":4.1687,
    "assets/sfx/sfx_pour_water.MP3":.8222,
    "assets/sfx/sfx_result_good.MP3":.4406,
    "assets/sfx/sfx_result_perfect.MP3":.6531,
    "assets/sfx/sfx_shrimp_crumb_coat.MP3":4.1831,
    "assets/sfx/sfx_shrimp_egg_coat.MP3":5.2845,
    "assets/sfx/sfx_shrimp_flour_coat.MP3":2.2568,
    "assets/sfx/sfx_skewer_pierce.MP3":.2858,
    "assets/sfx/sfx_skewer_turn.MP3":1.6501,
    "assets/sfx/sfx_soak_ingredient_drop.MP3":.7925,
    "assets/sfx/sfx_thick_boil_loop.MP3":.3544,
    "assets/sfx/sfx_timer_warning.MP3":4.672,
    "assets/sfx/sfx_ui_click.MP3":1.4158,
    "assets/sfx/sfx_whisk_mix_loop1.MP3":.4083,
    "assets/sfx/sfx_whisk_mix_loop2.MP3":.4232,
    "assets/sfx/sfx_wood_stir1.MP3":1.9747,
    "assets/sfx/sfx_wood_stir2.MP3":1.8072,
    "assets/sfx/story/fragments/sfx_d1_finish.MP3":.3789,
    "assets/sfx/story/fragments/sfx_d2_finish.MP3":.4534,
    "assets/sfx/story/fragments/sfx_d3_finish.MP3":.2944,
    "assets/sfx/story/fragments/sfx_d4_finish.MP3":.4188,
    "assets/sfx/story/fragments/sfx_d5_finish.MP3":.4926,
    "assets/sfx/story/fragments/sfx_d6_finish.MP3":.5248,
    "assets/sfx/story/fragments/sfx_d7_finish.MP3":.399,
    "assets/sfx/story/fragments/sfx_story_daeun_ribbon_handoff.MP3":.3475,
    "assets/sfx/story/guests/sfx_story_d1_raindrop_arrival.MP3":1.9033,
    "assets/sfx/story/guests/sfx_story_d2_lantern_arrival.MP3":1.0605,
    "assets/sfx/story/guests/sfx_story_d3_twin_shadow_arrival.MP3":.2891,
    "assets/sfx/story/guests/sfx_story_d4_crow_letter_arrival.MP3":.7971,
    "assets/sfx/story/guests/sfx_story_d5_star_beast_arrival.MP3":.756,
    "assets/sfx/story/guests/sfx_story_d6_seawater_arrival.MP3":1.2779,
    "assets/sfx/story/guests/sfx_story_d7_clock_444_arrival.MP3":.663,
    "assets/sfx/story/sfx_open_door.MP3":1.0292,
    "assets/sfx/story/sfx_rain.MP3":.6281,
    "assets/sfx/ui/sfx_next_book.MP3":1.194
  }),
  preloaded:new Map(), activeFiles:new Set(), ownerFiles:new Map(), loopFiles:new Map(), variantCursor:{},
  bgmElements:new Map(),bgmSources:new Map(),bgmGainNodes:new Map(),bgmWebAudio:false,bgmElement:null,bgmOutgoingElement:null,bgmTrack:null,storyBgmTrack:null,bgmStarted:false,bgmPlayPending:false,bgmFadeStart:0,bgmFadeDuration:1200,bgmFadeFrame:null,
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
  fileGain(entry){return sfxAudioIsEnabled()
    ?entry.webAudio?1:clamp(audioMasterGain()*state.audio.sfx*.72*(entry.normalization??1)*(entry.gain??1),0,1)
    :0;},
  usesDirectMediaPlayback(){
    // 이 프로젝트는 빌드 없이 index.html(file://)로도 실행합니다. Chrome은 이때
    // MediaElementSource의 로컬 MP3 출력을 무음 처리하므로 HTML 오디오로 재생합니다.
    return typeof location!=="undefined"&&location.protocol==="file:";
  },
  bgmFileGain(){return bgmAudioIsEnabled()
    ?this.bgmWebAudio?1:clamp(audioMasterGain()*state.audio.bgm*.65*(this.bgmTrackGains[this.bgmTrack]??1),0,1)
    :0;},
  connectBgmElements(){
    this.bgmWebAudio=false;
    if(!this.ctx||!this.bgm||this.usesDirectMediaPlayback())return false;
    this.bgmElements.forEach((element,track)=>{
      if(this.bgmSources.has(track))return;
      const source=this.ctx.createMediaElementSource(element);
      const gain=this.ctx.createGain();
      gain.gain.value=this.bgmTrackGains[track]??1;
      source.connect(gain);gain.connect(this.bgm);
      this.bgmSources.set(track,source);this.bgmGainNodes.set(track,gain);
    });
    this.bgmWebAudio=true;
    return true;
  },
  connectSfxEntry(entry){
    if(!this.ctx||!this.sfx||!entry?.element||this.usesDirectMediaPlayback())return false;
    try{
      entry.sourceNode=this.ctx.createMediaElementSource(entry.element);
      entry.gainNode=this.ctx.createGain();
      entry.gainNode.gain.value=entry.normalization*(entry.gain??1);
      entry.sourceNode.connect(entry.gainNode);entry.gainNode.connect(this.sfx);
      entry.webAudio=true;
      return true;
    }catch(error){
      console.warn("효과음 Web Audio 연결에 실패해 직접 재생합니다.",entry.src,error);
      entry.sourceNode=null;entry.gainNode=null;entry.webAudio=false;
      return false;
    }
  },
  pickFile(name,random=false){
    const variants=this.files[name];if(!variants?.length)return null;
    if(random)return variants[Math.floor(Math.random()*variants.length)];
    const index=this.variantCursor[name]||0;this.variantCursor[name]=(index+1)%variants.length;
    return variants[index%variants.length];
  },
  play(name,{loop=false,owner=null,gain=1,random=false}={}){
    const src=this.pickFile(name,random);if(!src)return null;
    if(loop&&owner){
      const current=this.loopFiles.get(owner)?.get(name);
      if(current&&!current.element.ended)return current;
    }
    const element=this.preloaded.get(src)?.cloneNode(true)||new Audio(src);
    const entry={
      name,src,element,owner,gain,loop,
      normalization:this.sfxFileGains[src]??1,
      sourceNode:null,gainNode:null,webAudio:false,
      pausedBySettings:false,fadingOut:false,fadeFrame:null
    };
    this.connectSfxEntry(entry);
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
    // Callers that must synchronize UI with a one-shot sound can observe a
    // rejected play() without replacing the audio manager's cleanup path.
    entry.playbackPromise=started||null;
    if(started?.catch)started.catch(()=>cleanup());
    return entry;
  },
  loop(name,owner,gain=1){return this.play(name,{loop:true,owner,gain});},
  releaseFile(entry){
    if(entry?.fadeFrame!=null){cancelAnimationFrame(entry.fadeFrame);entry.fadeFrame=null;}
    if(entry){
      entry.fadingOut=false;
      try{entry.sourceNode?.disconnect();entry.gainNode?.disconnect();}catch{}
      entry.sourceNode=null;entry.gainNode=null;entry.webAudio=false;
    }
    this.activeFiles.delete(entry);
    if(entry.owner){
      const owned=this.ownerFiles.get(entry.owner);owned?.delete(entry);if(owned&&!owned.size)this.ownerFiles.delete(entry.owner);
      const loops=this.loopFiles.get(entry.owner);if(loops?.get(entry.name)===entry)loops.delete(entry.name);if(loops&&!loops.size)this.loopFiles.delete(entry.owner);
    }
  },
  /* ⚠️ 한 항목이 말썽을 부려도 **나머지는 반드시 끕니다.** 아직 다 안 읽힌 파일에
     currentTime 을 넣으면 브라우저가 튕겨 낼 때가 있는데, 예전에는 그 한 번이
     stopOwner 의 반복을 통째로 끊어서 뒤에 있던 지글지글이 계속 울었습니다. */
  stopFile(entry){
    if(!entry)return;
    if(entry.fadeFrame!=null){cancelAnimationFrame(entry.fadeFrame);entry.fadeFrame=null;}
    entry.fadingOut=false;
    try{entry.element.pause();entry.element.currentTime=0;}catch{}
    this.releaseFile(entry);
  },
  fadeOutFile(entry,duration=1200){
    if(!entry||!this.activeFiles.has(entry))return false;
    const fadeDuration=Math.max(0,Number(duration)||0);
    if(fadeDuration<=0){this.stopFile(entry);return true;}
    if(entry.fadeFrame!=null)cancelAnimationFrame(entry.fadeFrame);
    const startedAt=performance.now();
    const useNode=!!entry.gainNode;
    const startVolume=Math.max(0,Number(useNode?entry.gainNode.gain.value:entry.element.volume)||0);
    entry.fadingOut=true;
    const step=now=>{
      if(!this.activeFiles.has(entry))return;
      const progress=clamp((now-startedAt)/fadeDuration,0,1);
      if(useNode)entry.gainNode.gain.value=startVolume*(1-progress);
      else entry.element.volume=startVolume*(1-progress);
      if(progress>=1){entry.fadeFrame=null;this.stopFile(entry);return;}
      entry.fadeFrame=requestAnimationFrame(step);
    };
    entry.fadeFrame=requestAnimationFrame(step);
    return true;
  },
  stop(name,owner){const entry=this.loopFiles.get(owner)?.get(name);if(entry)this.stopFile(entry);},
  stopOwner(owner){[...(this.ownerFiles.get(owner)||[])].forEach(entry=>this.stopFile(entry));},
  /* 반복 소리를 주인과 상관없이 전부 끕니다.
     반복으로 까는 소리는 **미니게임의 조리 소리뿐**이라(지글지글·기름·불꽃·젓기),
     미니게임 화면이 사라지면 남아 있을 이유가 하나도 없습니다. 배경음은 여기 없고
     bgmElement 가 따로 들고 있으므로 영향을 받지 않습니다.
     ⚠️ 주인(owner)으로 지우는 stopOwner 와 **겹쳐서** 씁니다. 주인 표가 한 군데라도
        어긋나면 소리만 살아남는데, 그 경우를 사람이 미리 다 찾을 수 없어서
        "화면이 닫히면 반복 소리는 무조건 없다"는 쪽으로 못을 박습니다. */
  stopLoops(){[...this.activeFiles].filter(entry=>entry.loop).forEach(entry=>this.stopFile(entry));},
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
    this.connectBgmElements();
    this.apply();
  },
  apply() {
    if(this.ctx){
      this.master.gain.value = audioMasterGain();
      // 기존에 가장 크게 들리던 스토리 곡 기준 약 1.3dB 올린 전체 레벨입니다.
      this.bgm.gain.value = bgmAudioIsEnabled()?state.audio.bgm * .65:0;
      this.sfx.gain.value = sfxAudioIsEnabled()?state.audio.sfx * .72:0;
    }
    this.activeFiles.forEach(entry=>{if(!entry.fadingOut)entry.element.volume=this.fileGain(entry);});
    if(!bgmAudioIsEnabled())this.bgmElements.forEach(element=>{element.volume=0;});
    else if(this.bgmElement&&!this.bgmFadeStart)this.bgmElement.volume=this.bgmFileGain();
  },
  tone(freq=440,duration=.09,type="square",gain=.12,when=0,target="sfx") {
    if (!this.ctx) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    // 파일 SFX를 .72 버스로 옮겨도 기존 합성음 체감(.35 버스)은 유지합니다.
    const routedGain=target==="sfx"?gain*(.35/.72):gain;
    o.type=type; o.frequency.value=freq; g.gain.value=routedGain;
    o.connect(g); g.connect(this[target]);
    const t=this.ctx.currentTime+when; o.start(t); g.gain.setValueAtTime(routedGain,t); g.gain.exponentialRampToValueAtTime(.001,t+duration); o.stop(t+duration+.02);
  },
  click(){ this.tone(520,.05,"square",.08); },
  uiClick(){ this.play("ui_click"); },
  success(){ this.tone(660,.09,"triangle",.12); this.tone(880,.12,"triangle",.1,.07); },
  bad(){ this.play("input_wrong",{gain:.9}); },
  result(scoreOrGrade){
    const numeric=Number(scoreOrGrade);
    const perfect=scoreOrGrade==="perfect"||(Number.isFinite(numeric)&&cookingScoreTier(numeric)==="perfect");
    const good=scoreOrGrade==="good"||(Number.isFinite(numeric)&&cookingScoreTier(numeric)==="tasty");
    if(perfect)this.play("result_perfect",{gain:.8});else if(good)this.play("result_good",{gain:.8});else this.bad();
  },
  serve(){ this.play("food_serve",{gain:.9}); },
  startBgm(){
    if(!this.ctx)return;
    this.bgmStarted=true;this.syncBgm(true);
  },
  setStoryBgm(track=null,{crossfadeDuration=this.bgmFadeDuration}={}){
    const defaultTrack=state.phase==="night"?"night":"day";
    const previousEffective=this.storyBgmTrack||defaultTrack;
    const next=track&&Object.prototype.hasOwnProperty.call(this.bgmFiles,track)?track:null;
    if(next===this.storyBgmTrack)return false;
    this.storyBgmTrack=next;
    const nextEffective=this.storyBgmTrack||defaultTrack;
    if(this.bgmStarted&&nextEffective!==previousEffective){
      if(Number(crossfadeDuration)>0)this.crossfadeBgm(nextEffective,Number(crossfadeDuration));
      else this.syncBgm(true);
    }else if(this.bgmStarted)this.syncBgm(false);
    return true;
  },
  cancelBgmFade(){
    if(this.bgmFadeFrame!=null)cancelAnimationFrame(this.bgmFadeFrame);
    const outgoing=this.bgmOutgoingElement;
    if(outgoing&&outgoing!==this.bgmElement){
      try{outgoing.pause();outgoing.currentTime=0;outgoing.volume=0;}catch{}
    }
    this.bgmOutgoingElement=null;
    this.bgmFadeFrame=null;this.bgmFadeStart=0;
  },
  startBgmFade(element){
    this.cancelBgmFade();
    this.bgmFadeStart=performance.now();
    const step=now=>{
      if(element!==this.bgmElement||element.paused){this.cancelBgmFade();return;}
      const progress=clamp((now-this.bgmFadeStart)/this.bgmFadeDuration,0,1);
      element.volume=this.bgmFileGain()*progress;
      if(progress>=1){this.bgmFadeFrame=null;this.bgmFadeStart=0;return;}
      this.bgmFadeFrame=requestAnimationFrame(step);
    };
    this.bgmFadeFrame=requestAnimationFrame(step);
  },
  crossfadeBgm(track,duration=this.bgmFadeDuration){
    const incoming=this.bgmElements.get(track)||null;
    const outgoing=this.bgmElement;
    // 결과 화면 자체의 기본 BGM은 멈추되, 엔딩처럼 장면 전용곡이 지정된
    // 스토리는 RESULT 단계에서도 계속 재생합니다.
    const shouldPlay=state.screen==="game"
      &&(state.phase!=="result"||!!this.storyBgmTrack)
      &&(!state.paused||!!this.storyBgmTrack);
    if(!incoming||!outgoing||incoming===outgoing||!shouldPlay){this.syncBgm(true);return false;}
    this.cancelBgmFade();
    const outgoingVolume=outgoing.paused?0:outgoing.volume;
    this.bgmOutgoingElement=outgoing;
    this.bgmTrack=track;this.bgmElement=incoming;this.bgmPlayPending=true;
    try{incoming.pause();incoming.currentTime=0;}catch{}
    incoming.volume=0;
    const begin=()=>{
      if(incoming!==this.bgmElement)return;
      this.bgmPlayPending=false;
      this.bgmFadeStart=performance.now();
      const step=now=>{
        if(incoming!==this.bgmElement||incoming.paused){this.cancelBgmFade();return;}
        const progress=clamp((now-this.bgmFadeStart)/Math.max(1,duration),0,1);
        const curve=progress*Math.PI*.5;
        incoming.volume=this.bgmFileGain()*Math.sin(curve);
        if(this.bgmOutgoingElement&&!this.bgmOutgoingElement.paused){
          this.bgmOutgoingElement.volume=bgmAudioIsEnabled()?outgoingVolume*Math.cos(curve):0;
        }
        if(progress>=1){
          const finishedOutgoing=this.bgmOutgoingElement;
          if(finishedOutgoing&&finishedOutgoing!==incoming){
            try{finishedOutgoing.pause();finishedOutgoing.currentTime=0;finishedOutgoing.volume=0;}catch{}
          }
          this.bgmOutgoingElement=null;this.bgmFadeFrame=null;this.bgmFadeStart=0;
          return;
        }
        this.bgmFadeFrame=requestAnimationFrame(step);
      };
      this.bgmFadeFrame=requestAnimationFrame(step);
    };
    const started=incoming.play();
    if(started?.then)started.then(begin).catch(()=>{this.bgmPlayPending=false;this.cancelBgmFade();});
    else begin();
    return true;
  },
  syncBgm(force=false){
    if(!this.bgmStarted)return;
    const track=this.storyBgmTrack||(state.phase==="night"?"night":"day");
    const shouldPlay=state.screen==="game"
      &&(state.phase!=="result"||!!this.storyBgmTrack)
      &&(!state.paused||!!this.storyBgmTrack);
    // 낮/밤처럼 스토리 밖에서 BGM 대상이 달라지는 경우에도 현재 곡을
    // 먼저 끊지 않고 동일한 크로스페이드 규칙으로 넘깁니다.
    if(
      !force
      &&track!==this.bgmTrack
      &&this.bgmElement
      &&!this.bgmElement.paused
      &&shouldPlay
    ){
      this.crossfadeBgm(track,this.bgmFadeDuration);
      return;
    }
    if(force||track!==this.bgmTrack){
      this.cancelBgmFade();
      if(this.bgmElement){this.bgmElement.pause();this.bgmElement.currentTime=0;}
      this.bgmTrack=track;this.bgmElement=this.bgmElements.get(track)||null;
      this.bgmPlayPending=false;this.bgmFadeStart=0;
    }
    if(!shouldPlay){
      if(this.bgmElement&&!this.bgmElement.paused)this.bgmElement.pause();
      this.bgmPlayPending=false;this.cancelBgmFade();return;
    }
    const element=this.bgmElement;if(!element)return;
    const now=performance.now();
    if(element.paused&&!this.bgmPlayPending){
      element.volume=0;this.bgmFadeStart=now;this.bgmPlayPending=true;
      const started=element.play();
      if(started?.then)started.then(()=>{
        this.bgmPlayPending=false;
        if(element===this.bgmElement)this.startBgmFade(element);
      }).catch(()=>{this.bgmPlayPending=false;this.cancelBgmFade();});
      else{this.bgmPlayPending=false;this.startBgmFade(element);}
    }
    if(!element.paused&&this.bgmFadeStart&&this.bgmFadeFrame==null){
      const progress=clamp((now-this.bgmFadeStart)/this.bgmFadeDuration,0,1);
      element.volume=this.bgmFileGain()*progress;
      if(progress>=1)this.bgmFadeStart=0;
    }else if(!element.paused&&!this.bgmFadeStart)element.volume=this.bgmFileGain();
  },
  stopBgm(){
    this.cancelBgmFade();
    this.bgmStarted=false;this.bgmPlayPending=false;this.bgmTrack=null;this.storyBgmTrack=null;
    this.bgmElements.forEach(element=>{element.pause();element.currentTime=0;element.volume=0;});
    this.bgmElement=null;this.bgmOutgoingElement=null;
  }
};
audio.preload();

// 실제 메뉴·설정 버튼 클릭을 한곳에서 받아 누락과 이중 재생을 막습니다.
// 미니게임 조작 버튼은 조리 효과음 영역이므로 이 목록에 넣지 않습니다.
const UI_CLICK_SELECTOR=[
  "#startButton","#continueButton","#titleSettingsButton",
  "#settingsButton","#codexButton","#resumeButton","#settingsCloseButton","#returnTitleButton",
  // 냉장고 칸(.fridge-slot)은 넣지 않습니다 — 찾았을 때/아닐 때 소리를 게임이 직접 냅니다.
  "#menuSelectConfirm",".menu-select-option",
  "#phaseButton","#nextDayButton","#miniClose","#miniPause","#ingredientPause"
].join(",");
document.addEventListener("click",event=>{
  const control=event.target.closest?.(UI_CLICK_SELECTOR);
  if(!control||control.disabled||control.getAttribute("aria-disabled")==="true")return;
  audio.uiClick();
},true);

function showGameHud(show) {
  [dom.topHud,dom.leftHud,dom.rightHud,dom.mobileControls].forEach(el => el.classList.toggle(UI_CLASS.hudHidden,!show));
}

let settingsReturnFocus=null;
// 설정과 영업일지가 겹쳐 열리는 예외 경로에서도 한쪽을 닫았다는 이유로
// 뒤쪽 화면의 inert가 먼저 풀리지 않도록 오버레이별 잠금 소유자를 셉니다.
const modalBackgroundInertOwners=new Set();
const SETTINGS_FOCUSABLE_SELECTOR=[
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function settingsFocusableElements(){
  return [...dom.settingsOverlay.querySelectorAll(SETTINGS_FOCUSABLE_SELECTOR)]
    .filter(element=>!element.hidden&&element.getClientRects().length>0);
}

function setModalBackgroundInert(owner,inert){
  if(inert)modalBackgroundInertOwners.add(owner);
  else modalBackgroundInertOwners.delete(owner);
  const shouldBeInert=modalBackgroundInertOwners.size>0;
  // 공용 오버레이는 appRoot 안에서 게임·타이틀 화면과 나란히 있으므로
  // appRoot 자체가 아니라 실제 배경 두 화면만 잠급니다.
  [dom.titleScreen,dom.gameScreen].forEach(screen=>{
    if(!screen)return;
    if(shouldBeInert)screen.setAttribute("inert","");
    else screen.removeAttribute("inert");
  });
}

function setSettingsBackgroundInert(inert){
  setModalBackgroundInert("settings",inert);
}
window.setModalBackgroundInert=setModalBackgroundInert;

function focusFirstSettingsControl(){
  const preferred=dom.resumeButton&&!dom.resumeButton.disabled&&!dom.resumeButton.hidden
    ?dom.resumeButton
    :settingsFocusableElements()[0];
  preferred?.focus?.({preventScroll:true});
}

function openSettings(from=state.screen) {
  if(settingsOverlayIsOpen())return;
  const fromTitle=from==="title";
  // 공용 조리 미니게임뿐 아니라 독립 오버레이로 도는 냉장고 재료 찾기도
  // 진행 중 저장·타이틀 이동을 막습니다. 특히 완료 직후의 냉장고 상태를 저장하면
  // 다음 화면으로 넘기는 지연 콜백은 세이브에 담기지 않아 불러오기에서 멈출 수 있습니다.
  const saveBlocked=!!state.mini
    ||!!state.story?.activeStoryCook
    ||state.phase===GAME_PHASES.INGREDIENT_SELECT;
  if(from==="game"&&!saveBlocked)saveGame(true);
  state.settingsFrom=from; state.paused=true;
  if(typeof resetPlayerKeyboardInput==="function")resetPlayerKeyboardInput();
  else clearPhysicalMoveKeys();
  pauseMiniAsyncTasks();
  dom.pauseMessage.textContent=fromTitle?UI_TEXT.pauseFromTitle
    :saveBlocked?UI_TEXT.pauseSaveBlocked:UI_TEXT.pauseFromGame;
  dom.saveLoadActions.hidden=from!=="game";
  dom.manualSaveButton.disabled=saveBlocked;
  dom.loadGameButton.disabled=from!=="game"||!hasAnySaveData();
  dom.returnTitleButton.classList.toggle(UI_CLASS.hidden,fromTitle||saveBlocked);
  dom.resumeButton.textContent=fromTitle?UI_TEXT.resumeFromTitle:UI_TEXT.resumeFromGame;
  // 설정창 그림이 두 벌입니다(assets/UI/Setting 의 ingame · lobby).
  // 판 그림·판 크기·기본 버튼 그림의 차이는 전부 css/settings.css 가 맡고,
  // 여기서는 어느 쪽인지만 알려 줍니다.
  dom.settingsOverlay.classList.toggle("is-lobby",fromTitle);
  syncAudioControls();
  settingsReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setSettingsBackgroundInert(true);
  dom.settingsOverlay.classList.add(UI_CLASS.overlayOpen);
  dom.settingsOverlay.setAttribute("aria-hidden","false");
  focusFirstSettingsControl();
  audio.pauseLoops();
}
function closeSettings() {
  // 저장 슬롯 창이 떠 있으면 그것만 닫고 설정창은 남깁니다.
  if(typeof isSaveSlotDialogOpen==="function"&&isSaveSlotDialogOpen()){closeSaveSlotDialog();return;}
  dom.settingsOverlay.classList.remove(UI_CLASS.overlayOpen);
  setSettingsBackgroundInert(false);
  resumeMiniAsyncTasks();
  state.paused=state.settingsFrom==="title"||state.phase==="result"||storyDialogueIsActive()
    ||(typeof journalOverlayIsOpen==="function"&&journalOverlayIsOpen());
  if(state.settingsFrom!=="title"&&!state.paused)audio.resumeLoops();
  const focusTarget=settingsReturnFocus;
  settingsReturnFocus=null;
  if(focusTarget?.isConnected&&!focusTarget.hidden&&!focusTarget.closest?.("[inert]")){
    focusTarget.focus?.({preventScroll:true});
  }else if(dom.settingsOverlay.contains(document.activeElement)){
    document.activeElement?.blur?.();
  }
  dom.settingsOverlay.setAttribute("aria-hidden","true");
}

function settingsOverlayIsOpen(){
  return dom.settingsOverlay.classList.contains(UI_CLASS.overlayOpen);
}

function settingsAllowsEventTarget(target){
  if(dom.settingsOverlay.contains(target))return true;
  const saveOverlay=document.getElementById("saveSlotOverlay");
  return !!(typeof isSaveSlotDialogOpen==="function"&&isSaveSlotDialogOpen()&&saveOverlay?.contains(target));
}

// inert 를 지원하지 않는 오래된 브라우저에서도 배경 버튼이 작동하지 않도록
// 실제 활성화 이벤트를 한 번 더 막습니다. 저장 슬롯은 설정창 위에 여는
// 자식 대화상자이므로 예외로 두어 기존 저장/불러오기 흐름을 유지합니다.
document.addEventListener("click",event=>{
  if(!settingsOverlayIsOpen()||settingsAllowsEventTarget(event.target))return;
  event.preventDefault();
  event.stopImmediatePropagation();
},true);

window.addEventListener("keydown",event=>{
  if(!settingsOverlayIsOpen())return;
  if(typeof isSaveSlotDialogOpen==="function"&&isSaveSlotDialogOpen())return;

  if(event.key==="Tab"){
    const focusable=settingsFocusableElements();
    if(!focusable.length){event.preventDefault();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(!dom.settingsOverlay.contains(document.activeElement)){
      event.preventDefault();
      (event.shiftKey?last:first).focus();
    }else if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
    return;
  }

  // 어떤 이유로 포커스가 뒤쪽 화면에 남아 있더라도 Enter/Space 등의 기본
  // 버튼 동작이 실행되지 않게 하고 설정창 안으로 되돌립니다.
  if(!dom.settingsOverlay.contains(event.target)){
    event.preventDefault();
    event.stopImmediatePropagation();
    focusFirstSettingsControl();
  }
},true);

document.addEventListener("focusin",event=>{
  if(!settingsOverlayIsOpen())return;
  if(typeof isSaveSlotDialogOpen==="function"&&isSaveSlotDialogOpen())return;
  if(!dom.settingsOverlay.contains(event.target))focusFirstSettingsControl();
},true);

// 불러오기·타이틀 복귀 코드는 화면 전환과 함께 설정창 클래스를 직접
// 걷습니다. 그 경로에서도 inert 가 남아 새 화면을 조작할 수 없게 되는 일이
// 없도록, 실제로 창이 사라졌는지를 기준으로 마지막 안전 해제를 합니다.
new MutationObserver(()=>{
  if(settingsOverlayIsOpen())return;
  if(dom.settingsOverlay.contains(document.activeElement))document.activeElement?.blur?.();
  dom.settingsOverlay.setAttribute("aria-hidden","true");
  setSettingsBackgroundInert(false);
  resumeMiniAsyncTasks();
  settingsReturnFocus=null;
}).observe(dom.settingsOverlay,{attributes:true,attributeFilter:["class"]});

/* 반짝임(fx_perfect_sparkle)을 달 음식인지. 요리사가 손에 들고 있을 때만
   씁니다 (player.js syncCarriedFoodFx). 메뉴판 카드·손님 말풍선에서는 뺐습니다.
     · 그날의 특별음식 (DAY_DATA.specialMenu — day.js 메뉴 선택 화면의 "특별음식")
     · 이야기 손님의 특별 조리 주문 (order.specialRecipe)
   조리 점수와는 무관합니다. 점수로 그림이 바뀌는 건 프랍 등급(food-props.js) 쪽입니다. */
function isSpecialFood(dishId,order=null){
  if(order?.specialRecipe) return true;
  return !!dishId && getCurrentDayData()?.specialMenu===dishId;
}

// 무엇을 그릴지만 정하고, 어떻게 생겼는지는 ui-hud.js 가 정합니다.
function buildMenuCards() {
  renderMenuCards(dom.menuCards,selectedDishes().map(dish=>({
    id:dish.id,
    name:dish.name,
    iconUrl:foodPropUrl(dish.id),
    required:getCurrentDayData().requiredMenus.includes(dish.id),
    orderCount:state.phase==="night"?state.orders.filter(order=>isCookableOrder(order)&&order.dishId===dish.id).length:0
  })));
}

function currentRequirement() {
  const storyStep=activeStoryCookStep();
  if(storyStep) return storyStep.station||null;
  if(state.phase===GAME_PHASES.MENU_SELECT)return "fridge";
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

function nearestStoryCookStation(requiredId){
  const required=stationById(requiredId);
  // 철판만 VIEW 좌표 판정을 쓰므로 같은 반경을 논리 좌표로 환산해
  // 프롤로그의 E 프롬프트와 철판 명패·조리 연출이 동시에 켜지게 합니다.
  const reach=requiredId==="griddle"?toLogic(COUNTER_REACH):STATION_REACH;
  if(required&&stationApproachDistance(required)<reach)return required;
  const nearby=nearestStation();
  return nearby?.id===requiredId?null:nearby;
}

function interact() {
  if(storyDialogueIsActive() || state.paused || state.mini
    ||dom.menuSelectOverlay.classList.contains(UI_CLASS.overlayOpen)
    ||![GAME_PHASES.MENU_SELECT,"day","night"].includes(state.phase)) return;
  const storyStep=activeStoryCookStep();
  if(storyStep){
    const required=storyStep.station;
    const station=nearestStoryCookStation(required);
    if(!station){showToast(UI_TEXT.toast.stationTooFar,true);return;}
    state.player.facing=station.facing;
    if(station.id!==required){
      showToast(UI_TEXT.toast.wrongStep(stationById(required)?.label||required),true);
      return;
    }
    launchStoryCookStep(station.id);
    return;
  }
  if(state.phase===GAME_PHASES.MENU_SELECT){
    const station=nearestStation("fridge");
    if(!station||station.id!=="fridge"){showToast("냉장고 가까이 이동해 오늘의 메뉴를 정하세요.",true);return;}
    state.player.facing=station.facing;
    openMenuSelectionAtFridge();
    return;
  }
  if(state.phase==="day"){
    const prepObject=nearestPrepObject();
    if(!prepObject){showToast(UI_TEXT.toast.prepTooFar,true);return;}
    state.player.facing="down";
    startPrepTask(prepObject.task.id);
    return;
  }
  const required=currentRequirement();
  const station=nearestStation(state.phase==="night"&&state.carrying?"trash":required);
  if(state.phase==="night" && state.carrying) {
    if(station?.id==="trash"){
      state.player.facing=station.facing;
      discardCarriedDish();
      return;
    }
    tryDeliver();
    return;
  }
  if(!station){ showToast(UI_TEXT.toast.stationTooFar,true); return; }
  state.player.facing=station.facing;
  if(station.id!==required){ showToast(UI_TEXT.toast.wrongStep(required?stationById(required).label:UI_TEXT.toast.orderSelect),true); return; }
  startCookMini(station.id);
}

function startMini(type,stationId,context) {
  // engine 은 mini-engine.js 의 등록소에서 찾을 이름입니다.
  // 밤 조리는 type 이 곧 엔진 이름이고, 낮 준비는 startDayPrepMini 가 "dayPrep" 을 넣습니다.
  state.mini={type,engine:type,stationId,context:context||{},time:8,score:0,data:{},complete:false};
  setMiniSubtitle(type);   // 타이틀 아래 부제 (ui-mini-frame.js 의 MINI_SUBTITLE)
  dom.miniFeedback.textContent=""; dom.miniContent.innerHTML=""; dom.miniOverlay.classList.add(UI_CLASS.overlayOpen);
  setMiniTipHint("");   // TIP 조작 칩은 매번 비웁니다. 필요한 게임만 setup 에서 다시 넣습니다.
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
    const tutorial=m.context.tutorial;   // 스토리 튜토리얼 조리 (사장의 안내)
    dom.miniTitle.textContent=special?UI_TEXT.miniTitleSpecial(title)
      :tutorial?UI_TEXT.miniTitleTutorial(title):title;
    dom.miniDescription.textContent=special?UI_TEXT.miniDescSpecial(desc)
      :tutorial?UI_TEXT.miniDescTutorial(desc):desc;
    m.time=(special||tutorial)?Math.max(5.5,time/difficulty):time;
    dom.miniTimer.textContent=m.time.toFixed(1);
  };
  engine.setup?.(m,{dish,set,difficulty});
  if((m.context.special||m.context.tutorial)&&Number.isFinite(m.data.speed))m.data.speed*=difficulty;
  updateMiniScore(m);
}

// Space · ACTION 버튼 · 미니게임 안 조작 버튼이 모두 여기로 들어옵니다.
function miniAction() {
  // 설정창은 미니게임 위에 열릴 수 있습니다. 뒤쪽 ACTION 버튼이나 키 입력이
  // 전달되면 일시정지 중에도 결과가 바뀌므로 설정을 닫을 때까지 받지 않습니다.
  if(settingsOverlayIsOpen())return;
  const m=state.mini; if(!m)return;
  miniEngine(m)?.action?.(m);
}

function finishMini(score) {
  const m=state.mini;if(!m||m.complete)return;m.complete=true;score=Math.round(clamp(score,0,100));m.score=score;
  updateMiniScore(m,score);
  audio.stopOwner(m);audio.stopLoops();
  dom.miniFeedback.textContent=UI_TEXT.miniScore(score);
  audio.result(score);
  miniSetTimeout(()=>{if(state.mini===m)completeMiniContext(m,score);},650);
}
function completeMiniContext(m,score) {
  state.mini=null;dom.miniOverlay.classList.remove(UI_CLASS.overlayOpen);
  // 화면이 실제로 사라지는 곳. 굽는 소리가 여기까지 살아 있으면 낮/밤 화면으로 새어 나갑니다.
  audio.stopOwner(m);audio.stopLoops();
  // 끌고 가던 그림(.order-drag-ghost)도 여기서 걷어냅니다 — 미니게임 화면이 아니라
  // document.body 에 붙어 있어서, 창을 닫아도 저 혼자 남습니다.
  if(typeof clearOrderDragGhosts==="function")clearOrderDragGhosts();
  if(m.context.mode==="story"){
    completeStoryCookStep(score);
    updateUI(true);
    return;
  }
  if(m.context.mode==="prep"){
    const run=state.prepRun; if(!run)return;run.scores.push(score);run.stepIndex++;
    const dish=dishById(run.dishId);
    if(run.stepIndex>=dish.prep.length){
      const q=Math.round(run.scores.reduce((a,b)=>a+b,0)/run.scores.length);const inv=state.inventory[dish.id];
      inv.quality=q;inv.count=1;inv.prepared=true;state.prepRun=null;
      spawnPopup(state.player.x,state.player.y-70,UI_TEXT.popup.prepGain(dish.name,q));showToast(UI_TEXT.toast.prepDone(dish.name));
    }else showToast(UI_TEXT.toast.prepNext(STATIONS[dish.prep[run.stepIndex]].label));
  }else if(m.context.mode==="cook"){
    const order=state.orders.find(o=>o.id===m.context.orderId);if(!order)return;order.cookScores.push(score);order.cookStep++;
    const dish=dishById(order.dishId);
    if(order.cookStep>=dish.cook.length){
      state.carrying={orderId:order.id,dishId:dish.id,cookScore:Math.round(order.cookScores.reduce((a,b)=>a+b,0)/order.cookScores.length)};
      showToast(UI_TEXT.toast.cookDone(dish.name));spawnPopup(state.player.x,state.player.y-75,UI_TEXT.popup.cookDone);
    }else showToast(UI_TEXT.toast.cookNext(stationById(dish.cook[order.cookStep].station)?.label||dish.cook[order.cookStep].station));
  }
  updateUI(true);saveGame(storyCookingIsActive());
}

function update(dt) {
  audio.syncBgm?.();
  if(state.paused){
    const settingsOpen=settingsOverlayIsOpen();
    const storyDialogueOpen=storyDialogueIsActive();
    // 이야기 화면이 미니게임을 가린 상태에서 제한시간과 판정이 흐르지 않게
    // 합니다. 정상 흐름에서는 대화 자체도 안전한 차례까지 열리지 않습니다.
    if(state.mini&&!settingsOpen&&!storyDialogueOpen){updateMini(dt);updateUI(false);}
    // 대화 연출·설정 창처럼 멈춰 있는 동안에도 상호작용 표시(키캡 E)는
    // 갱신되어야 합니다. 안 부르면 멈추기 직전 상태로 계속 떠 있습니다.
    // updatePrompt() 안에서 state.paused 를 보고 스스로 숨습니다.
    else{
      if(state.phase==="night"&&!settingsOpen)updateNightOrderEntrances(dt,true);
      updatePrompt();
    }
    if(state.screen==="game"&&storyDialogueIsActive())updateAutosave(dt);
    return;
  }
  const pauseNightCustomerPresentation=state.phase==="night"&&!!state.mini;
  if(state.phase==="night"){
    // 조리판 뒤에서 일반 손님의 등장·대기·식사·퇴장이 지나가 버리면
    // 미니게임을 닫았을 때 반응을 볼 수 없습니다. 특별 손님의 페이드만
    // 기존 안전 차례 규칙을 유지하고, 일반 손님 연출과 재등장은 그대로 둡니다.
    updateNightOrderEntrances(dt,pauseNightCustomerPresentation);
    if(!pauseNightCustomerPresentation){
      state.respawns.forEach(r=>r.time-=dt);
      const ready=state.respawns.filter(r=>r.time<=0);
      state.respawns=state.respawns.filter(r=>r.time>0);
      ready.forEach(processOrderRespawn);
    }
    if(typeof processStoryNightTrigger==="function")processStoryNightTrigger();
    if(!pauseNightCustomerPresentation)ensureNightOrders();
    const noActiveOrders=state.orders.length===0&&!state.carrying&&state.respawns.length===0;
    if(!pauseNightCustomerPresentation&&noActiveOrders&&state.generalServed>=nightGeneralOrderTarget()){
      if(tryEndNight("complete"))return;
    }
  }
  state.orders.forEach(order=>{
    if(order.customerType==="story"){
      // 특별 손님의 기다림은 대화 장면에서만 표현합니다. 조리 중 시간이
      // 오래 걸려도 일반 손님용 대기 문구를 가져다 쓰지 않습니다. 단,
      // 특별 손님 전용 등장 말풍선이 있다면 원래 표시 시간만큼 유지합니다.
      const hadGeneralWaitingBubble=order.waitingBubbleShown===true;
      order.waitingTime=0;order.waitingBubbleShown=false;
      if(hadGeneralWaitingBubble){order.bubble="";order.bubbleTime=0;}
      else if(order.bubbleTime>0)order.bubbleTime=Math.max(0,order.bubbleTime-dt);
      return;
    }
    if(pauseNightCustomerPresentation&&order.customerType!=="story")return;
    order.waitingTime=(order.waitingTime||0)+dt;
    if(order.bubbleTime>0)order.bubbleTime=Math.max(0,order.bubbleTime-dt);
    else if(!order.waitingBubbleShown&&!order.waitingBubbleDisabled&&order.waitingTime>=12){
      // 대기 문구 목록을 비워 둔 기획에서는 빈 항목을 "undefined" 말풍선으로
      // 만들지 않습니다. 목록이 다시 생겼을 때만 기존 12초 안내를 사용합니다.
      const hasWaitingBubble=Array.isArray(GENERAL_GUEST_BUBBLES.waiting)&&GENERAL_GUEST_BUBBLES.waiting.length>0;
      if(hasWaitingBubble){
        order.waitingBubbleShown=true;order.bubble=pickGeneralGuestBubble("waiting");order.bubbleTime=4;
      }else order.waitingBubbleDisabled=true;
    }
  });
  state.departures.forEach(item=>{
    if(pauseNightCustomerPresentation&&!item.guestId)return;
    item.life-=dt;
  });
  state.departures=state.departures.filter(item=>item.life>0);
  updateMini(dt);updatePlayer(dt);updateParticles(dt);updateUI(false);
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
  updateMiniScore(m);
  if(Number.isFinite(m.time)&&m.time<=0){
    if(engine.timeout)engine.timeout(m);
    else finishMini(m.score||35);
  }
}

// updatePlayer(), movePlayer()          → player.js
// updateParticles(), spawnPopup()        → fx.js

function showToast(text,bad=false){dom.toast.textContent=text;dom.toast.classList.toggle(UI_CLASS.toastBad,bad);dom.toast.classList.add(UI_CLASS.toastShow);clearTimeout(toastTimer);toastTimer=setTimeout(()=>dom.toast.classList.remove(UI_CLASS.toastShow),1800);}

function updateUI(force=false) {
  if(state.screen!=="game")return;
  const isMenuSelect=state.phase===GAME_PHASES.MENU_SELECT;
  const isPrep=state.phase===GAME_PHASES.PREP, isIngredientSelect=state.phase===GAME_PHASES.INGREDIENT_SELECT, isOpen=state.phase===GAME_PHASES.OPEN;
  const isDayPreparation=isMenuSelect||isPrep||isIngredientSelect;
  dom.gameApp.classList.toggle(UI_CLASS.phasePrep,isDayPreparation);
  dom.gameApp.classList.toggle(UI_CLASS.phaseOpen,isOpen);
  dom.phaseName.textContent=UI_TEXT.phaseNameWithDay(state.day,state.phase);
  dom.dayText.textContent=state.day;
  dom.timeLabel.textContent=isDayPreparation?UI_TEXT.timeLabelPrep:isOpen?UI_TEXT.timeLabelOpen:UI_TEXT.timeLabelOther;
  // 낮에도 밤과 같은 두 칸을 띄웁니다. 낮은 아직 손님이 오기 전이라
  // 오늘 밤 받을 손님 수와 그날의 특별 손님을 미리 보여 줍니다.
  dom.timeText.textContent=isOpen?UI_TEXT.guestsLeft(nightGuestsRemaining()):isDayPreparation?UI_TEXT.guestsLeft(nightGeneralOrderTarget(state.day)):UI_TEXT.blank;
  dom.satisfactionLabel.textContent=isDayPreparation?UI_TEXT.satisfactionLabelPrep:UI_TEXT.satisfactionLabelOther;
  dom.satisfactionText.textContent=isDayPreparation
    ?hudSpecialGuestLabel(state.day)
    :state.served?UI_TEXT.guestResponse(avgSatisfaction()):UI_TEXT.blank;
  dom.phaseBadge.textContent=UI_TEXT.phaseBadge[state.phase]||UI_TEXT.phaseBadge[GAME_PHASES.RESULT];dom.leftTitle.textContent=isDayPreparation?UI_TEXT.leftTitlePrep:UI_TEXT.leftTitleOther;
  dom.phaseButton.classList.toggle(UI_CLASS.hidden,!isPrep);dom.phaseButton.textContent=UI_TEXT.phaseButton;dom.phaseButton.disabled=isPrep&&(!prepComplete()||!!state.mini);
  const menuSignature=selectedDishes().map(dish=>dish.id).join("|");
  const renderedMenuSignature=[...dom.menuCards.children].map(card=>card.dataset.id).join("|");
  if(force||menuSignature!==renderedMenuSignature)buildMenuCards();
  if(isMenuSelect){
    updateMenuSelectionObjective();
    if(dom.menuSelectOverlay.classList.contains(UI_CLASS.overlayOpen))renderMenuSelection();
  }
  else if(state.phase===GAME_PHASES.INGREDIENT_SELECT)renderIngredientSelection();
  else if(state.phase===GAME_PHASES.PREP){renderPrepChecklist();updateDayObjective();}
  else if(state.phase===GAME_PHASES.OPEN){renderNightOrderList();updateNightObjective();}
  updateRelationshipUI();
  updatePrompt();
}
/* E 키캡을 앉힐 y. 세 군데(이야기 조리 · 냉장고 · 밤 영업)가 같은 규칙을 써야
   화면을 옮겨 다녀도 키캡 높이가 안 튑니다.

   철판만 다릅니다 — 앞쪽 카운터라 요리사가 뒤(위)에 서고, 이름표도 kitchen.js
   가 아니라 counter.js 가 Phaser 로 따로 그립니다. 그래서 요리사 서는 자리
   기준(iy-58)을 그대로 둡니다.
   뒤쪽 조리대는 kitchen.js stationPromptY() 가 이름표 윗변에서 계산합니다. */
function promptYFor(station){
  return station.id==="griddle" ? station.iy-58 : stationPromptY(station);
}
function updatePrompt(){
  const prompt=dom.stationPrompt;
  const hide=(mobileAction=false)=>{
    prompt.classList.remove(UI_CLASS.promptShow);prompt.disabled=true;
    dom.stationPromptLabel.textContent="";
    dom.actionButton.classList.toggle(UI_CLASS.actionAvailable,mobileAction);
  };
  if(state.paused||![GAME_PHASES.MENU_SELECT,"day","night"].includes(state.phase)){hide();return;}
  if(state.mini){hide(true);return;}
  let text="",visibleText="",x=0,y=0;
  const storyStep=activeStoryCookStep();
  if(storyStep){
    const required=storyStep.station;
    const station=nearestStoryCookStation(required);
    if(station?.id===required){
      text=UI_TEXT.prompt.station(station.label);
      x=station.ix;y=promptYFor(station);
    }
  }else if(state.phase==="night"&&state.carrying){
    const order=state.orders.find(o=>o.id===state.carrying.orderId);
    const trash=nearestStation("trash");
    const dish=dishById(state.carrying.dishId);
    if(trash?.id==="trash"&&dish){
      text=UI_TEXT.prompt.discard(dish.name);
      visibleText=UI_TEXT.prompt.discardVisible;
      x=trash.ix;y=promptYFor(trash);
    }else if(order&&distance(state.player.x,state.player.y,CUSTOMER_SEATS[order.slot],CUSTOMER_SERVICE_Y)<=CUSTOMER_SERVE_REACH){
      text=UI_TEXT.prompt.serve(order.slot+1);
      x=CUSTOMER_SEATS[order.slot];y=470;
    }
  }else{
    if(state.phase===GAME_PHASES.MENU_SELECT){
      const station=nearestStation("fridge");
      if(station?.id==="fridge"){
        text=UI_TEXT.prompt.station(station.label);
        x=station.ix;y=promptYFor(station);
      }
    }else if(state.phase==="day"){
      // 선행 작업이 남았거나 이미 끝낸 준비물에는 띄우지 않습니다.
      // 판정은 prep.js 가 이름표 강조에 쓰는 것과 같은 함수입니다.
      const prepObject=nearestPrepObject();
      if(prepObject&&prepObjectUsable(prepObject,prepObject)){text=UI_TEXT.prompt.prepObject();x=prepObject.x;y=prepObject.y-58;}
    }else{
      const required=currentRequirement();
      const station=nearestStation(required);
      if(station){
      if(station.id===required)text=UI_TEXT.prompt.station(station.label);
      if(text){x=station.ix;y=promptYFor(station);}
      }
    }
  }
  if(!text){hide();return;}
  // 기본 상호작용은 키캡만 표시하고, 실수로 누르면 음식을 잃는 폐기
  // 상호작용만 행동명을 함께 표시합니다.
  prompt.setAttribute("aria-label",text);prompt.disabled=false;
  dom.stationPromptLabel.textContent=visibleText;
  // 좌표만 넘기고, 그 값으로 어디에 앉힐지는 CSS 가 정합니다. (css/interaction.css)
  prompt.style.setProperty(UI_VAR.promptX,`${x/W*100}%`);
  prompt.style.setProperty(UI_VAR.promptY,`${y/H*100}%`);
  prompt.classList.add(UI_CLASS.promptShow);
  dom.actionButton.classList.add(UI_CLASS.actionAvailable);
}

function draw(){
  if(!ctx)return;
  const storyTime=storyTimeOfDayOverride();
  if(storyTime)setTimeOfDay(storyTime);
  else syncStageTimeOfDay(state.phase);

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
dom.resumeButton.addEventListener("click",closeSettings);
// 오른쪽 위 × 는 "게임으로 돌아가기"와 같은 동작입니다.
dom.settingsCloseButton?.addEventListener("click",closeSettings);
dom.phaseButton.addEventListener("click",()=>{
  if(settingsOverlayIsOpen())return;
  beginNight();
});
dom.nextDayButton.addEventListener("click",advanceToNextDay);
dom.menuSelectConfirm.addEventListener("click",confirmMenuSelection);
dom.actionButton.addEventListener("click",()=>{if(state.mini)miniAction();else interact();});
dom.miniClose.addEventListener("click",closeDayPrepMini);
// 공용 미니게임과 별도 냉장고 미니게임 모두 같은 설정창으로 일시정지합니다.
dom.miniPause.addEventListener("click",()=>openSettings("game"));
dom.ingredientPause.addEventListener("click",()=>openSettings("game"));
dom.stationPrompt.addEventListener("click",interact);
dom.masterAudioToggle.addEventListener("click",()=>{
  state.audio.enabled=!audioIsEnabled();
  persistAudioSettings();
  audio.apply();
  syncAudioControls();
  if(audioIsEnabled())audio.uiClick();
});
dom.bgmAudioToggle.addEventListener("click",()=>{
  state.audio.bgmEnabled=!audioSettingIsEnabled("bgmEnabled");
  persistAudioSettings();
  audio.apply();
  syncAudioControls();
  if(audioIsEnabled()&&sfxAudioIsEnabled())audio.uiClick();
});
dom.sfxAudioToggle.addEventListener("click",()=>{
  state.audio.sfxEnabled=!audioSettingIsEnabled("sfxEnabled");
  persistAudioSettings();
  audio.apply();
  syncAudioControls();
  if(sfxAudioIsEnabled())audio.uiClick();
});

[[dom.masterVolume,"master",dom.masterVolumeValue],[dom.bgmVolume,"bgm",dom.bgmVolumeValue],[dom.sfxVolume,"sfx",dom.sfxVolumeValue]].forEach(([input,key,label])=>input.addEventListener("input",()=>{state.audio[key]=Number(input.value)/100;label.textContent=`${input.value}%`;persistAudioSettings();audio.apply();}));

window.addEventListener("keydown",e=>{
  const k=gameInputKey(e);
  if(k==="escape"){
    // 엔딩 결론은 반드시 두 선택지 중 하나로만 닫습니다. 다른 오버레이보다
    // 먼저 확인해야 뒤쪽 설정창이 열리거나 닫히는 일도 없습니다.
    if(typeof endingRetryMenuIsOpen==="function"&&endingRetryMenuIsOpen())return;
    if(typeof isSaveSlotDialogOpen==="function"&&isSaveSlotDialogOpen())closeSaveSlotDialog();
    else if(dom.settingsOverlay.classList.contains(UI_CLASS.overlayOpen))closeSettings();
    else if(state.screen==="game")openSettings("game");
    return;
  }
  // 설정창 뒤에서 미니게임 키 입력은 막되, 설정 안의 슬라이더 방향키와
  // 버튼 Space 같은 브라우저 기본 조작은 그대로 쓸 수 있어야 합니다.
  if(settingsOverlayIsOpen())return;
  // 영업일지는 자체 키보드 탐색만 허용합니다. 뒤쪽 이야기 진행·상호작용·
  // 미니게임으로 같은 키가 전달되지 않게 전역 게임 입력을 여기서 끝냅니다.
  if(typeof journalOverlayIsOpen==="function"&&journalOverlayIsOpen())return;
  if(dom.menuSelectOverlay.classList.contains(UI_CLASS.overlayOpen))return;
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)||e.code==="Space")e.preventDefault();
  // 화면 위에 보이는 대화가 뒤쪽 미니게임보다 항상 입력 우선권을 가집니다.
  if(storyDialogueIsActive()){
    if(k==="e"||e.code==="Space")storyAdvance();
    return;
  }
  if(state.mini){
    // 어떤 키를 어떻게 처리할지는 각 엔진이 압니다(mini-engine.js 등록소 참고).
    // key 가 true 를 반환하면 그 엔진이 처리했다는 뜻이라 여기서 끝냅니다.
    const engine=miniEngine(state.mini);
    // noKeyboard : 마우스 전용 게임입니다. 엔진 key 도, Space 기본 동작(miniAction)도
    // 부르지 않습니다 — 화면에 키 안내가 없는데 키가 먹으면 숨은 조작이 됩니다.
    if(engine?.noKeyboard)return;
    if(!engine?.key?.(state.mini,k,e)&&e.code==="Space")miniAction();
    return;
  }
  if(state.paused)return;
  setPhysicalMoveKey(e,true);
  if(k==="e"){interact();return;}
});
window.addEventListener("keyup",e=>{
  // 오버레이 안에서 키를 놓아도 눌림 상태부터 반드시 해제해야 닫은 직후
  // 캐릭터가 혼자 걷지 않습니다.
  setPhysicalMoveKey(e,false);
  if(settingsOverlayIsOpen()||storyDialogueIsActive()
    ||(typeof journalOverlayIsOpen==="function"&&journalOverlayIsOpen()))return;
  if(!state.mini)return;
  const engine=miniEngine(state.mini);
  if(engine?.noKeyboard)return;                 // 마우스 전용 게임 (위 keydown 과 같은 이유)
  engine?.keyup?.(state.mini,gameInputKey(e),e);
});
window.addEventListener("blur",clearPhysicalMoveKeys);
function gameInputKey(event){
  const physical={KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",KeyE:"e",Space:" "};
  return physical[event.code]||String(event.key||"").toLowerCase();
}
function cancelJoystickInput(){
  if(joystickPointer!==null&&dom.joystick.hasPointerCapture?.(joystickPointer)){
    dom.joystick.releasePointerCapture(joystickPointer);
  }
  joystickPointer=null;state.joyX=0;state.joyY=0;
  dom.joystickKnob.style.removeProperty(UI_VAR.knobX);
  dom.joystickKnob.style.removeProperty(UI_VAR.knobY);
}
function beginJoystick(e){
  if(state.paused||dom.menuSelectOverlay.classList.contains(UI_CLASS.overlayOpen))return;
  joystickPointer=e.pointerId;dom.joystick.setPointerCapture(e.pointerId);moveJoystick(e);
}
function moveJoystick(e){if(e.pointerId!==joystickPointer||dom.menuSelectOverlay.classList.contains(UI_CLASS.overlayOpen))return;const r=dom.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.31,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len),px=dx*scale,py=dy*scale;dom.joystickKnob.style.setProperty(UI_VAR.knobX,`${px}px`);dom.joystickKnob.style.setProperty(UI_VAR.knobY,`${py}px`);state.joyX=clamp(dx/max,-1,1);state.joyY=clamp(dy/max,-1,1);}
function endJoystick(e){if(e.pointerId!==joystickPointer)return;cancelJoystickInput();}
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
    buildMenuCards();showGameHud(false);dom.titleScreen.classList.add(UI_CLASS.screenActive);dom.gameScreen.classList.remove(UI_CLASS.screenActive);updateUI(true);draw();syncPhaserObjects();
    setTimeout(runStoryQaFromQuery,0);
  }

  update(time,delta){
    update(Math.min(.033,delta/1000));
    draw();
    syncPhaserObjects();
    // 카운터 연출은 VIEW 좌표를 쓰므로 플레이어 위치를 변환해서 넘깁니다.
    // 마지막 인자는 영업 중 여부. 준비 시간에는 수저통을 치웁니다.
    const storyStep=activeStoryCookStep();
    const storyGriddleReady=storyStep?.station==="griddle"
      &&nearestStoryCookStation("griddle")?.id==="griddle";
    const counterPlayer=state.story?.activeStoryCook&&!storyGriddleReady
      ?null
      :{x:toView(state.player.x),y:toView(state.player.y)};
    updateCounter(time,delta,counterPlayer,
      state.phase==="night"||state.phase==="result"||storyTimeOfDayOverride()==="night");
  }
}

function bootPhaser(){
  // 화면 크기·렌더 품질 설정은 stage.js 의 stageGameConfig() 에 있습니다.
  return new Phaser.Game(stageGameConfig(DinerScene));
}

hideRetiredEconomyUi();
initializeStoryUI();
initializeSaveSystem();
initializeTitleScreen();

Promise.all([
  loadNativeImage("chef","assets/chef_sheet.png"),
  loadNativeImage("customers","assets/customer_sheet.png"),
  loadFoodPropAssets(),
  loadStageAssets(),
  loadCounterAssets(),
  loadSignageAssets(),
  loadDayPrepAssets()
]).then(bootPhaser).catch(error=>{
  console.error(error);
  markTitleLoadFailed();
});
