"use strict";

/* ============================================================
   E4 게이지 유지 — 어묵탕 · 떡볶이 공통 엔진

   냄비 그림만 메뉴별 설정으로 바꾸고, 불 조절·온도 물리·유지 판정·완료는
   한 컨트롤러가 담당합니다. 버너·불꽃·증기·거품은 CSS 도형이라 실제
   에셋은 완성 냄비 이미지 두 장만 선택적으로 사용합니다.

   [화면 구성] 다른 12화면과 같은 3열입니다 (E10 멸치 손질과 같은 틀).
     [재료 카드 3장]  [불 위의 냄비]  [진행도 카드 · 조작 카드]
                      아래 공용 띠에 화력 게이지 한 줄
   원래 E4 만 3열을 쓰지 않고 폭 1360.2 를 통으로 쓰는 예외였습니다.
   좌·우 칸이 생기면서 가운데 냄비 칸이 824.2 로 좁아졌고, 예전에 냄비
   아래에 있던 유지 바·진행 문구는 우측 진행도 카드로 옮겼습니다.
   화력 게이지는 그대로 하단 띠에 있고, ± 버튼만 우측 조작 카드로
   올라갔습니다(E5 가 조작 버튼 줄을 조작 카드로 옮긴 것과 같습니다).
   판정·물리·완료 규칙은 하나도 바뀌지 않았고 놓이는 자리만 달라졌습니다.

   칸 크기는 css/minigame-parts.css 의 공용 --mg-* 가 정합니다.
   이 화면의 겉모습은 css/minigames.css 의 "E4 화력 유지" 구역입니다.
   ============================================================ */

/* ---- 좌측 재료 칸 -------------------------------------------
   냄비에 이미 들어가 있는 재료를 보여 주기만 합니다(조작 대상이 아닙니다).
   개수는 낮 준비에서 실제로 손질한 수와 같아야 해서 값을 두 벌 두지 않고
   준비 설정에서 그대로 읽어 옵니다.
     무 · 어묵 · 멸치   DAY_PREP_MINI_CONFIG   (day-prep-minigames.js)
     떡볶이 어묵        TTEOKBOKKI_CUT_SEQUENCE (day4-prep-data.js)
   count 가 null 이면 "×N" 없이 이름만 나옵니다(불린 떡 · 양념장처럼
   낱개로 세지 않는 재료입니다).
   그림은 파일이 있으면 <img>, 없으면 냄비 안 재료와 같은 CSS 도형입니다. */
const HEAT_INGREDIENTS=Object.freeze({
  oden:Object.freeze([
    Object.freeze({id:"radish",label:"썬 무",count:DAY_PREP_MINI_CONFIG.cutRadish.total,asset:"radish4"}),
    Object.freeze({id:"fishCake",label:"썬 어묵",count:DAY_PREP_MINI_CONFIG.cutFishCake.total,asset:"fishCake4"}),
    Object.freeze({id:"anchovy",label:"손질한 멸치",count:DAY_PREP_MINI_CONFIG.cleanAnchovy.total,asset:"anchovyGroup"})
  ]),
  tteokbokki:Object.freeze([
    Object.freeze({id:"tteok",label:"불린 떡",count:null,asset:"soakTteok"}),
    Object.freeze({id:"fishCake",label:"썬 어묵",count:TTEOKBOKKI_CUT_SEQUENCE.find(item=>item.ingredientId==="fishCake")?.requiredPieces??null,asset:"fishCake4"}),
    Object.freeze({id:"sauce",label:"양념장",count:null,asset:"sauceBowl"})
  ])
});

const HEAT_CONFIG=Object.freeze({
  oden:Object.freeze({
    title:"어묵탕 끓이기",
    description:"불을 조절해 맑은 어묵탕을 적정 온도에서 5초 동안 끓여주세요.",
    visual:"oden",ingredients:HEAT_INGREDIENTS.oden,
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.24,initialPower:.31,heatFloor:.07,heatRange:.92,
    response:1.25,powerChangeRate:.52,tapStep:.055
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 끓이기",
    description:"불을 조절해 걸쭉한 떡볶이를 적정 온도에서 5초 동안 끓여주세요.",
    visual:"tteokbokki",ingredients:HEAT_INGREDIENTS.tteokbokki,
    targetStart:.48,targetEnd:.68,targetHold:5,
    initialValue:.26,initialPower:.34,heatFloor:.08,heatRange:.94,
    response:.82,powerChangeRate:.48,tapStep:.05
  }),
  // 어느 설정에도 없는 요리가 들어왔을 때 쓰는 안전망입니다.
  // 냄비 그림과 마찬가지로 재료 칸도 어묵탕 것을 그대로 씁니다.
  default:Object.freeze({
    title:"화력 조절",
    description:"불을 조절해 적정 온도를 5초 동안 유지하세요.",
    visual:"oden",ingredients:HEAT_INGREDIENTS.oden,
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.24,initialPower:.31,heatFloor:.07,heatRange:.92,
    response:1.1,powerChangeRate:.5,tapStep:.05
  })
});

/* 화구 손잡이가 강불(화력 1)에서 시계방향으로 도는 각도입니다.
   손잡이 그림·자리·크기는 css/minigame-parts.css 의 .mg-burner-knob 이 갖고 있고,
   여기서는 "얼마나 도는지"만 정합니다. 0도가 화구 그림에 그려진 꺼진 자리입니다. */
const HEAT_KNOB_MAX_TURN=120;

const HEAT_FEEL_CONFIG=Object.freeze({
  exitGrace:0.3,
  warningDelay:0.65,
  progressDecayRate:.6
});

function heatConfigId(m){return HEAT_CONFIG[m.context?.dishId]?m.context.dishId:"default";}

function heatZoneState(value,config){
  if(value<config.targetStart)return "low";
  if(value>config.targetEnd)return "high";
  return "ideal";
}

function heatCompletionGrade(data){return data.warnings===0?"perfect":"good";}

function heatFallbackMarkup(visual){
  if(visual==="tteokbokki")return `<span class="heat-pot-surface tteokbokki">
    <i class="heat-tteok tteok-one"></i><i class="heat-tteok tteok-two"></i><i class="heat-tteok tteok-three"></i><i class="heat-tteok tteok-four"></i>
    <i class="heat-fishcake fishcake-one"></i><i class="heat-fishcake fishcake-two"></i><i class="heat-cabbage"></i>
  </span>`;
  return `<span class="heat-pot-surface oden">
    <i class="heat-radish"></i><i class="heat-fishcake fishcake-one"></i><i class="heat-fishcake fishcake-two"></i><i class="heat-green-onion"></i>
  </span>`;
}

/* ---- 끓는 냄비 스프라이트 ------------------------------------
   메뉴 2종 x 끓는 세기 3단계 x 4장입니다. 파일 목록은
   day-prep-minigames.js 의 DAY_PREP_ASSET_PATHS 에 있고 키 규칙은 아래와 같습니다.
     boil{Oden|Tteokbokki}{Weak|Medium|Strong}{1~4}

   세기는 **온도 구간**(heatZoneState)이 고릅니다 — 화면의 '온도 낮음 / 적정 온도 /
   과열 주의' 와 늘 같은 것을 보여주려는 것입니다. 불(화력)은 온도를 밀어 올리는
   입력일 뿐이고 판정도 온도로 하므로, 그림이 라벨과 어긋나지 않는 쪽을 택했습니다.
   (화력에 맞추고 싶으면 css/minigames.css 의 heat- 를 fire- 로 바꾸면 됩니다) */
const HEAT_BOIL_LEVELS=Object.freeze({low:"Weak",ideal:"Medium",high:"Strong"});
const HEAT_BOIL_FRAMES=4;

function heatBoilAssetKey(visual,zone,frame){
  const dish=visual==="tteokbokki"?"Tteokbokki":"Oden";
  return `boil${dish}${HEAT_BOIL_LEVELS[zone]}${frame}`;
}

// 4장 한 벌. 어느 벌을 보여줄지는 CSS 가 온도 구간 클래스로 고릅니다.
function heatBoilSetMarkup(config,zone){
  const frames=Array.from({length:HEAT_BOIL_FRAMES},(_,index)=>
    dayPrepAssetMarkup(heatBoilAssetKey(config.visual,zone,index+1),"heat-boil-frame",index?"":config.title)).join("");
  return `<div class="heat-boil-set ${zone}">${frames}</div>`;
}

function hasHeatBoilArt(config){
  return ["low","ideal","high"].every(zone=>
    Array.from({length:HEAT_BOIL_FRAMES},(_,index)=>heatBoilAssetKey(config.visual,zone,index+1)).every(hasDayPrepAsset));
}

/* 가운데 : 화구 위의 냄비.
   화구(가스버너)와 냄비는 분리된 두 겹입니다 — E3 김치 볶기 · E5 김치전과 같은
   방식이고 그림만 다릅니다(day-prep-minigames.js 의 minigameBurnerMarkup).
   불꽃이 화구 그림 3장에 함께 그려져 있어 예전 CSS 불꽃 도형은 없앴습니다.

   냄비는 두 갈래입니다.
     그림이 있으면  .heat-pot-art  (끓는 스프라이트 3벌 x 4장)
     없으면        .heat-pot-stack (예전 CSS 도형 — 그대로 남겨 둡니다)
   자리는 css/minigames.css 의 --heat-art-w · --heat-art-drop (그림) ·
   --heat-pot-scale · --heat-pot-drop (도형) 이 정합니다. */
function heatPotMarkup(config){
  if(!hasHeatBoilArt(config))return `<div class="heat-pot-stack">
        <i class="heat-steam steam-one"></i><i class="heat-steam steam-two"></i><i class="heat-steam steam-three"></i>
        <div class="heat-pot ${config.visual}">
          <span class="heat-pot-fallback">${heatFallbackMarkup(config.visual)}<i class="heat-pot-handle left"></i><i class="heat-pot-handle right"></i></span>
          <span class="heat-boil-bubbles"><i></i><i></i><i></i><i></i><i></i></span>
        </div>
      </div>`;
  return `<div class="heat-pot-art ${config.visual}">
        ${["low","ideal","high"].map(zone=>heatBoilSetMarkup(config,zone)).join("")}
        <i class="heat-steam steam-one"></i><i class="heat-steam steam-two"></i><i class="heat-steam steam-three"></i>
      </div>`;
}

function heatSceneMarkup(config){
  return `<div class="heat-cook-scene heat-low fire-low" id="heatCookScene">
    <div class="heat-cooktop">
      ${minigameBurnerMarkup("pot")}
      ${heatPotMarkup(config)}
    </div>
    <strong class="heat-state-label" id="heatStateLabel">온도 낮음</strong>
    <span class="e4-result" id="e4Result" aria-live="polite"></span>
  </div>`;
}

/* 왼쪽 재료 카드 한 장. 그림 자리는 E5(.ts-ing-art)와 같은 구성입니다 —
   에셋이 있으면 <img> 가 보이고, 없으면 안쪽 <i> 의 CSS 도형이 대신 나옵니다. */
function heatIngredientMarkup(item){
  const asset=dayPrepAssetMarkup(item.asset,"heat-ing-asset",item.label);
  // ⚠️ 재료 이름표는 반드시 ing- 를 붙여 씁니다. 재료 id 를 그대로 클래스로 쓰면
  //    다른 게임의 같은 이름과 부딪힙니다 — 예: .anchovy(E10 도마 위 멸치)는
  //    absolute · 270x66 · 회전이라, 붙는 순간 카드가 그 크기로 찌그러집니다.
  return `<div class="heat-ing-card ing-${item.id}">
      <div class="heat-ing-art ${asset?"has-asset":""}"><i class="heat-ing-pile"><b></b><b></b><b></b></i>${asset}</div>
      <p class="heat-ing-name">${item.label}${item.count?` <b>×${item.count}</b>`:""}</p>
    </div>`;
}

/* 오른쪽 조작 카드. 키는 안내이면서 실제 버튼입니다(키보드·마우스 둘 다).
   ⚠️ id 는 예전 하단 띠의 ± 버튼에서 그대로 물려받았습니다.
      bindHeatButton 이 이 두 id 로 찾으므로 바꾸지 마세요. */
function heatControlMarkup(){
  // 메인 키는 A · D 입니다. 화살표(← →)와 ± 도 그대로 받지만 보조로만 적습니다.
  // 받는 키 목록은 아래 key/keyup 이 갖고 있습니다 — 함께 고쳐야 합니다.
  const keys=[
    {id:"heatDown",glyph:"A",name:"불 줄이기",hint:"또는 ← · −"},
    {id:"heatUp",glyph:"D",name:"불 키우기",hint:"또는 → · ＋"}
  ];
  return `<div class="heat-keys">${keys.map(key=>`<span class="heat-key-row">
      <button class="heat-key" id="${key.id}" type="button" aria-label="${key.name}">${key.glyph}</button>
      <span class="heat-key-text"><b>${key.name}</b><em>${key.hint}</em></span>
    </span>`).join("")}</div>
    <p class="heat-control-name">꾹 누르면 계속 조절됩니다</p>`;
}

/* 하단 공용 띠 — 화력 게이지 한 줄.
   ± 버튼이 조작 카드로 올라가면서 양 끝 자리가 비어 약불/강불 표시가 들어갔습니다. */
function heatGaugeMarkup(config){
  return `<div class="heat-wrap">
      <span class="heat-wrap-label">약불</span>
      <div class="heat-gauge"><i class="heat-target" style="left:${config.targetStart*100}%;width:${(config.targetEnd-config.targetStart)*100}%"></i><i id="heatNeedle" class="heat-needle"></i></div>
      <span class="heat-wrap-label">강불</span>
    </div>`;
}

function heatScreenMarkup(config){
  return `<div class="heat-scene">
      <aside class="heat-col">
        <div class="heat-panel heat-ing-panel">
          <h3 class="heat-col-title starred">재료</h3>
          <div class="heat-ing-list">${config.ingredients.map(heatIngredientMarkup).join("")}</div>
        </div>
      </aside>
      <div class="heat-play">${heatSceneMarkup(config)}</div>
      <aside class="heat-col">
        <div class="heat-panel heat-count">
          <h3 class="heat-col-title">진행도</h3>
          <strong><b id="heatHoldValue">0.0</b> / ${config.targetHold.toFixed(1)}<em>초</em></strong>
          <div class="heat-hold" title="적정 온도 유지"><i id="heatHoldFill"></i></div>
        </div>
        <div class="heat-panel heat-control">
          <h3 class="heat-col-title">조작</h3>
          ${heatControlMarkup()}
        </div>
      </aside>
      <div class="mg-strip heat-strip">${heatGaugeMarkup(config)}</div>
    </div>`;
}

function setHeatControl(m,direction,active){
  // 조작 카드의 키캡은 마우스로 누를 때뿐 아니라 ← → 로 조절할 때도 같이 눌립니다.
  // (한 곳에서만 켜고 끄려고 여기 둡니다 — bindHeatButton 은 붙이기만 합니다)
  dom.miniContent.querySelector(direction<0?"#heatDown":"#heatUp")?.classList.toggle("pressed",active&&!m?.complete);
  if(!m||m.complete||m.data.phase==="complete")return false;
  const key=direction<0?"holdingDown":"holdingUp";
  if(active&&!m.data[key]){
    m.data.power=clamp(m.data.power+direction*HEAT_CONFIG[m.data.configId].tapStep,0,1);
  }
  m.data[key]=active;
  return true;
}

function bindHeatButton(m,selector,direction){
  const button=dom.miniContent.querySelector(selector);if(!button)return;
  button.addEventListener("pointerdown",event=>{
    if(m.complete)return;
    // ⚠️ 불 조절을 먼저 켜고 포인터를 잡습니다. setPointerCapture 는 잡을 수 없는
    //    포인터에서 예외를 던지는데(E10 과 같은 이유로 try 로 감쌉니다),
    //    순서가 반대면 그때 조작 자체가 통째로 막힙니다.
    setHeatControl(m,direction,true);
    try{button.setPointerCapture?.(event.pointerId);}catch{}
  });
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>button.addEventListener(type,()=>setHeatControl(m,direction,false)));
}

function updateHeatVisual(data,config){
  const scene=dom.miniContent.querySelector("#heatCookScene");if(!scene)return;
  const zone=heatZoneState(data.value,config);
  const fire=data.power<config.targetStart?"low":data.power>config.targetEnd?"high":"ideal";
  // fire-* 는 화구 그림 3장이 넘어가는 속도(불 세기)를, heat-* 는 냄비의 김·거품을 정합니다.
  scene.classList.remove("heat-low","heat-ideal","heat-high","fire-low","fire-ideal","fire-high");
  scene.classList.add(`heat-${zone}`,`fire-${fire}`);
  // 화구 손잡이는 세 단계가 아니라 화력을 그대로 따라 시계방향으로 돕니다
  // (약불 0도 → 강불 120도). 아래 .mg-burner-knob 이 이 값을 받아 돌아갑니다.
  scene.style.setProperty("--mg-knob-turn",`${(data.power*HEAT_KNOB_MAX_TURN).toFixed(1)}deg`);
  const label=scene.querySelector("#heatStateLabel");
  if(label)label.textContent=zone==="low"?"온도 낮음":zone==="high"?"과열 주의":"적정 온도";
  const needle=dom.miniContent.querySelector("#heatNeedle");if(needle)needle.style.left=`${data.value*100}%`;
  // 유지 시간은 우측 진행도 카드가 보여 줍니다(숫자 + 그 아래 가는 띠).
  const holdValue=dom.miniContent.querySelector("#heatHoldValue");if(holdValue)holdValue.textContent=data.inZone.toFixed(1);
  const holdFill=dom.miniContent.querySelector("#heatHoldFill");if(holdFill)holdFill.style.width=`${data.inZone/config.targetHold*100}%`;
  dom.miniTimer.textContent=`${data.inZone.toFixed(1)} / ${config.targetHold.toFixed(1)}`;
}

function completeHeatHold(m){
  const grade=heatCompletionGrade(m.data),result=dom.miniContent.querySelector("#e4Result");
  m.data.phase="complete";m.data.holdingDown=false;m.data.holdingUp=false;
  dom.miniContent.querySelector("#heatCookScene")?.classList.add("e4-complete");
  if(result){result.textContent=grade==="perfect"?"PERFECT":"GOOD";result.className=`e4-result show ${grade}`;}
  finishMini(grade==="perfect"?100:85);
}

registerMiniEngine("heat",{
  setup(m,{set}){
    const configId=heatConfigId(m),config=HEAT_CONFIG[configId];
    set(config.title,config.description,config.targetHold);
    m.data={
      configId,value:config.initialValue,power:config.initialPower,inZone:0,total:0,
      outsideTime:0,warnings:0,enteredZone:false,excursionWarned:false,
      holdingDown:false,holdingUp:false,phase:"ready"
    };
    // 냄비의 끓는 루프만 비교 청음할 수 있도록 가스불 효과음은 잠시 제외합니다.
    if(configId==="oden")audio.loop?.("clear_simmer",m,.55);
    else if(configId==="tteokbokki")audio.loop?.("thick_boil",m,.55);
    // 3열 화면입니다. 칸 크기는 css/minigame-parts.css 의 공용 규격이 정하고,
    // 여기서는 어느 칸에 무엇을 넣을지만 정합니다.
    dom.miniContent.innerHTML=heatScreenMarkup(config);
    bindHeatButton(m,"#heatDown",-1);bindHeatButton(m,"#heatUp",1);
    updateHeatVisual(m.data,config);
  },

  timerRuns(){return false;},

  update(m,dt){
    const data=m.data,config=HEAT_CONFIG[data.configId];
    if(data.phase==="complete")return;
    data.total+=dt;
    const control=(data.holdingUp?1:0)-(data.holdingDown?1:0);
    data.power=clamp(data.power+control*config.powerChangeRate*dt,0,1);
    const target=config.heatFloor+data.power*config.heatRange;
    data.value=clamp(data.value+(target-data.value)*config.response*dt,0,1);
    const zone=heatZoneState(data.value,config);
    if(zone==="ideal"){
      data.enteredZone=true;data.outsideTime=0;data.excursionWarned=false;
      data.inZone=Math.min(config.targetHold,data.inZone+dt);
    }else if(data.enteredZone){
      data.outsideTime+=dt;
      if(data.outsideTime>HEAT_FEEL_CONFIG.exitGrace)data.inZone=Math.max(0,data.inZone-dt*HEAT_FEEL_CONFIG.progressDecayRate);
      if(data.outsideTime>=HEAT_FEEL_CONFIG.warningDelay&&!data.excursionWarned){data.warnings++;data.excursionWarned=true;audio.bad();}
    }
    updateHeatVisual(data,config);
    if(data.inZone>=config.targetHold)completeHeatHold(m);
  },

  key(m,key,event){
    if(["arrowleft","a","-","_"].includes(key)){if(!event?.repeat)setHeatControl(m,-1,true);return true;}
    if(["arrowright","d","+","="].includes(key)){if(!event?.repeat)setHeatControl(m,1,true);return true;}
    return false;
  },

  keyup(m,key){
    if(["arrowleft","a","-","_"].includes(key)){setHeatControl(m,-1,false);return true;}
    if(["arrowright","d","+","="].includes(key)){setHeatControl(m,1,false);return true;}
    return false;
  }
});
