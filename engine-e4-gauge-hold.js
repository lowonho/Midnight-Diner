"use strict";

/* ============================================================
   E4 게이지 유지 — 어묵탕 · 떡볶이 공통 엔진

   냄비 그림만 메뉴별 설정으로 바꾸고, 불 조절·온도 물리·유지 판정·완료는
   한 컨트롤러가 담당합니다. 버너·불꽃·증기·거품은 CSS 도형이라 실제
   에셋은 완성 냄비 이미지 두 장만 선택적으로 사용합니다.
   ============================================================ */

const HEAT_CONFIG=Object.freeze({
  oden:Object.freeze({
    title:"어묵탕 끓이기",
    description:"불을 조절해 맑은 어묵탕을 적정 온도에서 5초 동안 끓여주세요.",
    visual:"oden",potAsset:"heatOdenPot",
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.24,initialPower:.31,heatFloor:.07,heatRange:.92,
    response:1.25,powerChangeRate:.52,tapStep:.055
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 끓이기",
    description:"불을 조절해 걸쭉한 떡볶이를 적정 온도에서 5초 동안 끓여주세요.",
    visual:"tteokbokki",potAsset:"heatTteokbokkiPot",
    targetStart:.48,targetEnd:.68,targetHold:5,
    initialValue:.26,initialPower:.34,heatFloor:.08,heatRange:.94,
    response:.82,powerChangeRate:.48,tapStep:.05
  }),
  default:Object.freeze({
    title:"화력 조절",
    description:"불을 조절해 적정 온도를 5초 동안 유지하세요.",
    visual:"oden",potAsset:"heatOdenPot",
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.24,initialPower:.31,heatFloor:.07,heatRange:.92,
    response:1.1,powerChangeRate:.5,tapStep:.05
  })
});

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

function heatSceneMarkup(config){
  const hasAsset=hasDayPrepAsset(config.potAsset);
  return `<div class="heat-cook-scene heat-low fire-low" id="heatCookScene" style="--flame-level:.45">
    <div class="heat-pot-stack">
      <i class="heat-steam steam-one"></i><i class="heat-steam steam-two"></i><i class="heat-steam steam-three"></i>
      <div class="heat-pot ${config.visual} ${hasAsset?"has-asset":""}">
        ${dayPrepAssetMarkup(config.potAsset,"heat-pot-asset",config.title)}
        <span class="heat-pot-fallback">${heatFallbackMarkup(config.visual)}<i class="heat-pot-handle left"></i><i class="heat-pot-handle right"></i></span>
        <span class="heat-boil-bubbles"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="heat-burner"><span class="heat-flames"><i></i><i></i><i></i><i></i><i></i></span></div>
    </div>
    <strong class="heat-state-label" id="heatStateLabel">온도 낮음</strong>
    <span class="e4-result" id="e4Result" aria-live="polite"></span>
  </div>`;
}

function setHeatControl(m,direction,active){
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
    button.setPointerCapture?.(event.pointerId);button.classList.add("pressed");
    setHeatControl(m,direction,true);
  });
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>button.addEventListener(type,()=>{
    button.classList.remove("pressed");setHeatControl(m,direction,false);
  }));
}

function updateHeatVisual(data,config){
  const scene=dom.miniContent.querySelector("#heatCookScene");if(!scene)return;
  const zone=heatZoneState(data.value,config);
  const fire=data.power<config.targetStart?"low":data.power>config.targetEnd?"high":"ideal";
  scene.classList.remove("heat-low","heat-ideal","heat-high","fire-low","fire-ideal","fire-high");
  scene.classList.add(`heat-${zone}`,`fire-${fire}`);
  scene.style.setProperty("--flame-level",(.42+data.power*1.1).toFixed(2));
  const label=scene.querySelector("#heatStateLabel");
  if(label)label.textContent=zone==="low"?"온도 낮음":zone==="high"?"과열 주의":"적정 온도";
  const needle=dom.miniContent.querySelector("#heatNeedle");if(needle)needle.style.left=`${data.value*100}%`;
  const zoneTime=dom.miniContent.querySelector("#zoneTime");if(zoneTime)zoneTime.textContent=data.inZone.toFixed(1);
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
    dom.miniContent.innerHTML=`${heatSceneMarkup(config)}
      <div class="heat-wrap"><button id="heatDown" class="heat-button" type="button" aria-label="불 줄이기">−</button><div class="heat-gauge"><i class="heat-target" style="left:${config.targetStart*100}%;width:${(config.targetEnd-config.targetStart)*100}%"></i><i id="heatNeedle" class="heat-needle"></i></div><button id="heatUp" class="heat-button" type="button" aria-label="불 키우기">＋</button></div>
      <div class="heat-hold"><i id="heatHoldFill"></i></div><div class="cut-count">적정 온도 유지: <span id="zoneTime">0.0</span> / ${config.targetHold.toFixed(1)}초</div>`;
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
