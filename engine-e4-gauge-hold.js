"use strict";

/* ============================================================
   E4 게이지 유지 — 어묵탕 · 떡볶이 공통 엔진

   메뉴별 제목·설명·난이도는 HEAT_CONFIG에 두고, 입력·물리·판정·완료는
   하나의 컨트롤러가 담당합니다. 녹색 구간 체류 시간은 누적되며 5초가
   되면 제한시간을 기다리지 않고 즉시 성공합니다.
   ============================================================ */

const HEAT_CONFIG=Object.freeze({
  oden:Object.freeze({
    title:"어묵탕 끓이기",
    description:"작은 냄비의 어묵탕이 맛있게 끓도록 약불과 강불을 조절하세요.",
    visual:"oden",
    time:8,
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.25,initialVelocity:.08,drift:.035,damping:.985,impulse:.16
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 끓이기",
    description:"약불과 강불을 조절해 떡볶이 온도를 적정 구간에 유지하세요.",
    visual:"default",
    time:8,
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.25,initialVelocity:.08,drift:.035,damping:.985,impulse:.16
  }),
  default:Object.freeze({
    title:"화력 조절",
    description:"약불과 강불을 조절해 온도를 적정 구간에 유지하세요.",
    visual:"default",
    time:8,
    targetStart:.43,targetEnd:.63,targetHold:5,
    initialValue:.25,initialVelocity:.08,drift:.035,damping:.985,impulse:.16
  })
});

function heatConfigId(m){
  return HEAT_CONFIG[m.context?.dishId]?m.context.dishId:"default";
}

function adjustHeat(m,amount){
  if(!m||m.complete)return;
  m.data.velocity+=amount;audio.click();
}

registerMiniEngine("heat",{
  setup(m,{set}){
    const configId=heatConfigId(m),config=HEAT_CONFIG[configId];
    set(config.title,config.description,config.time);
    m.data={configId,value:config.initialValue,velocity:config.initialVelocity,inZone:0,total:0};
    const odenMarkup=config.visual==="oden"?`<div class="serving-oden-pot" aria-label="작은 냄비에서 끓고 있는 어묵탕"><i class="oden-steam steam-one"></i><i class="oden-steam steam-two"></i><div class="serving-oden-broth"><i class="serving-radish"></i><i class="serving-fishcake fishcake-one"></i><i class="serving-fishcake fishcake-two"></i><i class="serving-green-onion"></i></div><i class="serving-pot-handle left"></i><i class="serving-pot-handle right"></i></div>`:"";
    dom.miniContent.innerHTML=`${odenMarkup}<div class="heat-wrap"><button id="heatDown" class="heat-button" type="button">−</button><div class="heat-gauge"><i class="heat-target" style="left:${config.targetStart*100}%;width:${(config.targetEnd-config.targetStart)*100}%"></i><i id="heatNeedle" class="heat-needle"></i></div><button id="heatUp" class="heat-button" type="button">＋</button></div><div class="cut-count">적정 온도 유지: <span id="zoneTime">0.0</span>초</div>`;
    dom.miniContent.querySelector("#heatDown").addEventListener("click",()=>adjustHeat(m,-config.impulse));
    dom.miniContent.querySelector("#heatUp").addEventListener("click",()=>adjustHeat(m,config.impulse));
  },

  update(m,dt){
    const data=m.data,config=HEAT_CONFIG[data.configId];
    data.total+=dt;
    data.velocity+=config.drift*dt;
    data.velocity*=config.damping;
    data.value=clamp(data.value+data.velocity*dt,0,1);
    if(data.value===0||data.value===1)data.velocity*=-.45;
    if(data.value>=config.targetStart&&data.value<=config.targetEnd)data.inZone=Math.min(config.targetHold,data.inZone+dt);
    const needle=dom.miniContent.querySelector("#heatNeedle");if(needle)needle.style.left=`${data.value*100}%`;
    const zone=dom.miniContent.querySelector("#zoneTime");if(zone)zone.textContent=data.inZone.toFixed(1);
    if(data.inZone>=config.targetHold)finishMini(100);
  },

  key(m,key){
    const config=HEAT_CONFIG[m.data.configId];
    if(["arrowleft","a","-","_"].includes(key)){adjustHeat(m,-config.impulse);return true;}
    if(["arrowright","d","+","="].includes(key)){adjustHeat(m,config.impulse);return true;}
    return false;
  },

  timeout(m){
    const config=HEAT_CONFIG[m.data.configId];
    finishMini(Math.round(clamp(m.data.inZone/config.targetHold*100,25,100)));
  }
});
