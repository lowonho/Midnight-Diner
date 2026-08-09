"use strict";

/* ============================================================
   E4 움직이는 온도 구간 추적 — 어묵탕 · 떡볶이 공통 엔진

   스페이스바를 누르는 동안 온도 커서가 올라가고, 떼면 내려옵니다. 플레이어는
   위아래 끝을 일정한 속도로 왕복하는 적정 온도 박스를 따라가며 5초를 채웁니다.
   플레이어 커서는 상승·하강 모두 0.48, 적정 온도 박스는 위·아래 모두
   0.40의 일정한 속도로 움직입니다. 몇 초에 한 번은 박스 폭이 잠깐 좁아집니다.
   냄비 그림만 메뉴별 설정으로 바꾸고, 추적 물리·유지 판정·완료는 한
   컨트롤러가 담당합니다.

   [화면 구성] 다른 12화면과 같은 3열입니다 (E10 멸치 손질과 같은 틀).
     [재료 카드 3장]  [불 위의 냄비]  [진행도 카드 · 조작 카드]
                      냄비 오른쪽에 세로 추적 게이지
   원래 E4 만 3열을 쓰지 않고 폭 1360.2 를 통으로 쓰는 예외였습니다.
   좌·우 칸이 생기면서 가운데 냄비 칸이 824.2 로 좁아졌고, 예전에 냄비
   아래에 있던 유지 바·진행 문구는 우측 진행도 카드로 옮겼습니다.
   하단 띠에는 핵심 조작을 다시 한번 짧게 안내합니다.

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
    Object.freeze({id:"tteok",label:"떡",count:null,asset:"soakTteok"}),
    Object.freeze({id:"fishCake",label:"썬 어묵",count:TTEOKBOKKI_CUT_SEQUENCE.find(item=>item.ingredientId==="fishCake")?.requiredPieces??null,asset:"fishCake4"}),
    // 양념장 섞기(E7)에서 마지막에 완성된 그 볼 그림입니다 — 낮에 만든 것을
    // 그대로 냄비에 넣는 흐름이라 두 화면이 같은 장을 써야 이어져 보입니다.
    Object.freeze({id:"sauce",label:"양념장",count:null,asset:"sauceBowlTteokbokki3"})
  ])
});

const HEAT_CONFIG=Object.freeze({
  oden:Object.freeze({
    title:"어묵탕 끓이기",
    description:"스페이스바를 꾹 눌러 온도를 올리고, 떼서 내리며 적정 온도를 따라가세요.",
    visual:"oden",ingredients:HEAT_INGREDIENTS.oden,
    targetSize:.22,targetHold:5,targetSpeed:.40,
    initialValue:.26,initialTarget:.54,initialTargetDirection:1,
    riseSpeed:.48,fallSpeed:.48,riseResponse:60,fallResponse:60
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 끓이기",
    description:"스페이스바를 꾹 눌러 온도를 올리고, 떼서 내리며 적정 온도를 따라가세요.",
    visual:"tteokbokki",ingredients:HEAT_INGREDIENTS.tteokbokki,
    // 구간 폭만 어묵탕보다 좁고, 이동 속도는 두 요리가 같습니다.
    targetSize:.19,targetHold:5,targetSpeed:.40,
    initialValue:.28,initialTarget:.6,initialTargetDirection:-1,
    riseSpeed:.48,fallSpeed:.48,riseResponse:60,fallResponse:60
  }),
  // 어느 설정에도 없는 요리가 들어왔을 때 쓰는 안전망입니다.
  // 냄비 그림과 마찬가지로 재료 칸도 어묵탕 것을 그대로 씁니다.
  default:Object.freeze({
    title:"화력 조절",
    description:"스페이스바를 꾹 눌러 온도를 올리고, 떼서 내리며 적정 온도를 따라가세요.",
    visual:"oden",ingredients:HEAT_INGREDIENTS.oden,
    targetSize:.22,targetHold:5,targetSpeed:.40,
    initialValue:.26,initialTarget:.54,initialTargetDirection:1,
    riseSpeed:.48,fallSpeed:.48,riseResponse:60,fallResponse:60
  })
});

/* 화구 손잡이가 강불(화력 1)에서 시계방향으로 도는 각도입니다.
   손잡이 그림·자리·크기는 css/minigame-parts.css 의 .mg-burner-knob 이 갖고 있고,
   여기서는 "얼마나 도는지"만 정합니다. 0도가 화구 그림에 그려진 꺼진 자리입니다. */
const HEAT_KNOB_MAX_TURN=120;

const HEAT_FEEL_CONFIG=Object.freeze({
  warningDelay:0.65,
  /* ── 구간이 잠깐 좁아지는 연출 ──
     좁아지는 동안에는 같은 자리에 있어도 밖으로 밀려납니다. 그게 노림수입니다. */
  pinchFirstDelay:2.4,      // 시작하자마자 좁히지는 않습니다(자리를 잡을 시간)
  pinchGapMin:3.6,
  pinchGapRange:3.2,
  pinchDurMin:1,
  pinchDurRange:.9,
  pinchDepthMin:.4,         // 가장 좁을 때 원래 폭의 40~60%가 남습니다
  pinchDepthRange:.2
});

function heatConfigId(m){return HEAT_CONFIG[m.context?.dishId]?m.context.dishId:"default";}

/* 지금 이 순간의 구간 폭. 좁아지는 연출(pinch) 때문에 매 프레임 달라집니다.
   ⚠️ 판정(heatZoneState)·화면(updateHeatVisual) 둘 다 반드시 이 값을 써야 합니다.
      한쪽만 config.targetSize 를 쓰면 보이는 초록 띠와 실제 판정이 어긋납니다. */
function heatZoneSize(data,config){return config.targetSize*(data.sizeScale??1);}

function heatTargetBounds(data,config){
  const half=heatZoneSize(data,config)/2;
  return {start:data.target-half,end:data.target+half};
}

function heatZoneState(value,data,config){
  const target=heatTargetBounds(data,config);
  if(value<target.start)return "low";
  if(value>target.end)return "high";
  return "ideal";
}

function heatScore(data){return clamp(100-(data?.warnings??0)*10,0,100);}

function heatCompletionGrade(data){
  const score=heatScore(data);
  return score===100?"perfect":score>70?"good":"miss";
}

/* 구간 폭을 잠깐 좁혔다가 되돌립니다. 반 바퀴 사인이라 경계가 튀지 않고
   스르르 조였다 스르르 풀립니다 — 좁아지는 것도 페이드 인 · 아웃입니다. */
function updateHeatPinch(data,dt,random=Math.random){
  if(data.pinchTime<data.pinchDur){
    data.pinchTime+=dt;
    data.sizeScale=1-data.pinchDepth*Math.sin(Math.PI*Math.min(1,data.pinchTime/data.pinchDur));
    if(data.pinchTime>=data.pinchDur){
      data.sizeScale=1;
      data.pinchIn=HEAT_FEEL_CONFIG.pinchGapMin+random()*HEAT_FEEL_CONFIG.pinchGapRange;
    }
    return;
  }
  data.sizeScale=1;
  data.pinchIn-=dt;
  if(data.pinchIn>0)return;
  data.pinchTime=0;
  data.pinchDur=HEAT_FEEL_CONFIG.pinchDurMin+random()*HEAT_FEEL_CONFIG.pinchDurRange;
  data.pinchDepth=HEAT_FEEL_CONFIG.pinchDepthMin+random()*HEAT_FEEL_CONFIG.pinchDepthRange;
}

function heatTargetPhase(target,direction,config){
  const half=config.targetSize/2,span=1-config.targetSize,offset=clamp(target,half,1-half)-half;
  return direction>=0?offset:span*2-offset;
}

/* 목표 구간은 같은 속도로 위아래 끝을 계속 왕복합니다. 무작위 목적지나 dash가
   없어서 갑자기 빨라지지 않으며, 끝에서는 위치가 끊기지 않고 방향만 바뀝니다. */
function updateHeatTarget(data,config,dt,random=Math.random){
  updateHeatPinch(data,dt,random);
  const half=config.targetSize/2,span=1-config.targetSize,period=span*2;
  data.targetPhase=(data.targetPhase+config.targetSpeed*dt)%period;
  if(data.targetPhase<=span){
    data.target=half+data.targetPhase;
    data.targetDirection=1;
  }else{
    data.target=1-half-(data.targetPhase-span);
    data.targetDirection=-1;
  }
}

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

/* 버너 손잡이 위에 얹는 "여기 눌러도 됩니다" 유인 효과.
   손잡이가 그림 한 장(<img>)이라 ::before/::after 를 못 답니다. 그래서 같은 자리에
   빈 상자를 한 겹 더 올리고, 그 안에서 링 2개와 반짝임 4개가 돕니다.
   자리·크기·꺼지는 조건은 전부 css/minigame/e4-gauge-hold.css 의 .heat-knob-hint 입니다.
   ⚠️ 손잡이 그림이 없으면(에셋 누락) 허공에서 반짝이게 되는데, 그 경우는 CSS 가
      :not(:has(.mg-burner-knob)) 로 통째로 숨깁니다 — 여기서 따로 거르지 않습니다. */
function heatKnobHintMarkup(){
  return `<span class="heat-knob-hint" aria-hidden="true">
      <b class="heat-knob-ring"></b><b class="heat-knob-ring"></b>
      <i class="heat-knob-spark"></i><i class="heat-knob-spark"></i><i class="heat-knob-spark"></i><i class="heat-knob-spark"></i>
    </span>`;
}

function heatSceneMarkup(config){
  return `<div class="heat-cook-scene heat-low fire-low" id="heatCookScene">
    <div class="heat-cooktop">
      ${minigameBurnerMarkup("pot")}
      ${heatKnobHintMarkup()}
      ${heatPotMarkup(config)}
    </div>
    ${heatGaugeMarkup()}
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

/* 오른쪽 조작 카드. 누르고 있는 동안 온도가 올라갑니다.
   손은 두 갈래인데 들어가는 문은 하나입니다 — 둘 다 setHeatControl 을 부릅니다.
     스페이스바        아래 key / keyup
     버너 손잡이 클릭  bindHeatKnobControl (냄비 아래 가스버너 그림의 그 손잡이)
   ⚠️ 화면 글자는 "버너 손잡이" 입니다. 공용 부품 이름(.mg-burner-knob · 화구 손잡이)과
      다르지만, 플레이어에게는 그림에 보이는 대로 부르는 쪽이 맞습니다. */
function heatControlMarkup(){
  return `<div class="heat-keys"><span class="heat-key-row">
      <kbd class="heat-key heat-lift-key" id="heatLift">SPACE</kbd>
      <span class="heat-key-text"><b>꾹 눌러 올리기</b><em>버너 손잡이를 눌러도 됩니다</em></span>
    </span></div>
    <p class="heat-control-name">손을 떼면 온도가 내려갑니다</p>`;
}

/* 화구 손잡이를 마우스로 누르고 있는 동안에도 온도가 올라갑니다.
   ⚠️ 손잡이는 화구 그림(.mg-burner)의 자식이고 그 화구는 pointer-events:none 입니다
      (다른 화면에서 화구 위 드래그가 막히지 않게 한 공용 규칙). 그래서 손잡이만
      pointer-events:auto 로 되살려 둡니다 — css/minigame/e4-gauge-hold.css 참고.
   ⚠️ setPointerCapture 가 있어야 누른 채 손잡이 밖으로 끌고 나가도 계속 눌린
      상태가 유지됩니다. 없으면 조금만 흔들려도 불이 꺼집니다. */
function bindHeatKnobControl(m){
  const knob=dom.miniContent.querySelector(".heat-cooktop .mg-burner-knob");
  if(!knob)return;
  knob.addEventListener("pointerdown",event=>{
    event.preventDefault();
    try{knob.setPointerCapture(event.pointerId);}catch{}
    knob.classList.add("turning");
    setHeatControl(m,true);
  });
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>knob.addEventListener(type,()=>{
    knob.classList.remove("turning");
    setHeatControl(m,false);
  }));
  knob.addEventListener("dragstart",event=>event.preventDefault());
}

/* 냄비 옆 세로 추적 게이지. target 과 needle 모두 매 프레임 bottom 값이 바뀝니다. */
function heatGaugeMarkup(){
  return `<div class="heat-tracker" aria-label="움직이는 적정 온도 추적 게이지">
      <span class="heat-wrap-label">높음</span>
      <div class="heat-gauge"><i id="heatTarget" class="heat-target"></i><i id="heatNeedle" class="heat-needle"></i></div>
      <span class="heat-wrap-label">낮음</span>
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
        ${miniScorePanelMarkup("heat-panel heat-count","heat-col-title",state.mini,
          `<div class="heat-hold" title="적정 온도 유지 진행도"><i id="heatHoldFill"></i></div>`)}
        <div class="heat-panel heat-control">
          <h3 class="heat-col-title">조작</h3>
          ${heatControlMarkup()}
        </div>
      </aside>
    </div>`;
}

function setHeatControl(m,active){
  dom.miniContent.querySelector("#heatLift")?.classList.toggle("pressed",active&&!m?.complete);
  if(!m||m.complete||m.data.phase==="complete")return false;
  m.data.holding=active;
  return true;
}

function updateHeatVisual(data,config){
  const scene=dom.miniContent.querySelector("#heatCookScene");if(!scene)return;
  const zone=heatZoneState(data.value,data,config),target=heatTargetBounds(data,config);
  // 커서가 목표보다 낮은지·안인지·높은지에 맞춰 냄비와 불꽃의 세기도 함께 바뀝니다.
  scene.classList.remove("heat-low","heat-ideal","heat-high","fire-low","fire-ideal","fire-high");
  scene.classList.add(`heat-${zone}`,`fire-${zone}`);
  // 새 추적 방식에는 예전 power 값이 없으므로 현재 온도 커서를 손잡이 회전에 연결합니다.
  scene.style.setProperty("--mg-knob-turn",`${(data.value*HEAT_KNOB_MAX_TURN).toFixed(1)}deg`);
  const label=scene.querySelector("#heatStateLabel");
  if(label)label.textContent=zone==="low"?"온도 낮음":zone==="high"?"과열 주의":"적정 온도";
  const targetBox=dom.miniContent.querySelector("#heatTarget");
  if(targetBox){
    targetBox.style.bottom=`${target.start*100}%`;
    targetBox.style.height=`${heatZoneSize(data,config)*100}%`;
    // 좁아지는 중이라는 것을 띠 색으로도 알려 줍니다(폭 변화만으로는 잘 안 보입니다).
    targetBox.classList.toggle("pinching",data.sizeScale<.96);
  }
  const needle=dom.miniContent.querySelector("#heatNeedle");if(needle)needle.style.bottom=`${data.value*100}%`;
  /* 우측 점수 카드 아래의 초록 진행 바. 적정 온도 안에 머물면 차고, 벗어나면
     잠시 뒤 줄어듭니다. 제한시간은 없으므로 플레이어가 5.0을 채울 때까지 계속합니다. */
  const holdValue=dom.miniContent.querySelector("#heatHoldValue");if(holdValue)holdValue.textContent=data.inZone.toFixed(1);
  const holdFill=dom.miniContent.querySelector("#heatHoldFill");if(holdFill)holdFill.style.width=`${data.inZone/config.targetHold*100}%`;
}

/* 끝날 때 손을 떼고 조작 표시를 원래대로 돌립니다. */
function settleHeatScene(m){
  m.data.phase="complete";m.data.holding=false;
  dom.miniContent.querySelector("#heatLift")?.classList.remove("pressed");
  dom.miniContent.querySelector(".heat-cooktop .mg-burner-knob")?.classList.remove("turning");
}

function completeHeatHold(m){
  const grade=heatCompletionGrade(m.data),result=dom.miniContent.querySelector("#e4Result");
  const score=heatScore(m.data);
  settleHeatScene(m);
  dom.miniContent.querySelector("#heatCookScene")?.classList.add("e4-complete");
  if(result){result.textContent=cookingScoreMessage(score);result.className=`e4-result show ${grade}`;}
  finishMini(score);
}

registerMiniEngine("heat",{
  score(m){
    return heatScore(m?.data);
  },
  setup(m,{set}){
    const configId=heatConfigId(m),config=HEAT_CONFIG[configId];
    // 공용 setup 형식상 세 번째 값은 필요하지만, 이 게임은 제한시간이 없습니다.
    set(config.title,config.description,Number.POSITIVE_INFINITY);
    m.data={
      configId,value:config.initialValue,velocity:0,target:config.initialTarget,inZone:0,total:0,
      targetDirection:config.initialTargetDirection,
      targetPhase:heatTargetPhase(config.initialTarget,config.initialTargetDirection,config),
      sizeScale:1,pinchIn:HEAT_FEEL_CONFIG.pinchFirstDelay,pinchTime:0,pinchDur:0,pinchDepth:0,
      outsideTime:0,warnings:0,enteredZone:false,excursionWarned:false,
      holding:false,phase:"ready"
    };
    // 냄비의 끓는 루프만 비교 청음할 수 있도록 가스불 효과음은 잠시 제외합니다.
    if(configId==="oden")audio.loop?.("clear_simmer",m,.55);
    else if(configId==="tteokbokki")audio.loop?.("thick_boil",m,.55);
    // 3열 화면입니다. 칸 크기는 css/minigame-parts.css 의 공용 규격이 정하고,
    // 여기서는 어느 칸에 무엇을 넣을지만 정합니다.
    dom.miniContent.innerHTML=heatScreenMarkup(config);
    bindHeatKnobControl(m);
    updateHeatVisual(m.data,config);
  },

  // 적정 온도 진행도를 다 채울 때까지 계속합니다.
  timerRuns(){return false;},

  update(m,dt){
    const data=m.data,config=HEAT_CONFIG[data.configId];
    if(data.phase==="complete")return;
    data.total+=dt;
    const desiredVelocity=data.holding?config.riseSpeed:-config.fallSpeed;
    const response=data.holding?config.riseResponse:config.fallResponse;
    data.velocity+=(desiredVelocity-data.velocity)*Math.min(1,response*dt);
    data.value=clamp(data.value+data.velocity*dt,0,1);
    if((data.value===0&&data.velocity<0)||(data.value===1&&data.velocity>0))data.velocity=0;

    updateHeatTarget(data,config,dt);

    const zone=heatZoneState(data.value,data,config);
    if(zone==="ideal"){
      data.enteredZone=true;data.outsideTime=0;data.excursionWarned=false;
      data.inZone=Math.min(config.targetHold,data.inZone+dt);
    }else if(data.enteredZone){
      data.outsideTime+=dt;
      if(data.outsideTime>=HEAT_FEEL_CONFIG.warningDelay&&!data.excursionWarned){data.warnings++;data.excursionWarned=true;audio.bad();}
    }
    updateHeatVisual(data,config);
    if(data.inZone>=config.targetHold)completeHeatHold(m);
  },

  key(m,key,event){
    if(key===" "||event?.code==="Space"){if(!event?.repeat)setHeatControl(m,true);return true;}
    return false;
  },

  keyup(m,key,event){
    if(key===" "||event?.code==="Space"){setHeatControl(m,false);return true;}
    return false;
  }
});
