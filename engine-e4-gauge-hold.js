"use strict";

/* ============================================================
   E4 움직이는 온도 구간 추적 — 어묵탕 · 떡볶이 공통 엔진

   스페이스바를 누르는 동안 온도 커서가 올라가고, 떼면 내려옵니다. 플레이어는
   방향과 속도를 불규칙하게 바꾸는 적정 온도 박스를 따라가며 5초를 채웁니다.
   박스는 [출발점 → 목적지] 한 구간씩 계획해서 움직입니다 — 매번 성격(느긋 ·
   보통 · 훅)을 새로 뽑고, 구간 안에서 스르르 출발해 스르르 멈추며, 몇 초에
   한 번은 폭까지 잠깐 좁아집니다. 아래 HEAT_FEEL_CONFIG · HEAT_TARGET_PACES 참고.
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
    Object.freeze({id:"tteok",label:"불린 떡",count:null,asset:"soakTteok"}),
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
    targetSize:.22,targetHold:7,targetSpeed:.13,timeLimit:22,
    initialValue:.26,initialTarget:.54,initialTargetDirection:1,
    riseSpeed:.58,fallSpeed:.46,riseResponse:7.2,fallResponse:5.2
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 끓이기",
    description:"스페이스바를 꾹 눌러 온도를 올리고, 떼서 내리며 적정 온도를 따라가세요.",
    visual:"tteokbokki",ingredients:HEAT_INGREDIENTS.tteokbokki,
    // 구간이 좁고(.19) 더 빨라서(.16) 어묵탕보다 어렵습니다 — 그만큼 시간을 더 줍니다.
    targetSize:.19,targetHold:7,targetSpeed:.16,timeLimit:25,
    initialValue:.28,initialTarget:.6,initialTargetDirection:-1,
    riseSpeed:.56,fallSpeed:.48,riseResponse:6.8,fallResponse:4.9
  }),
  // 어느 설정에도 없는 요리가 들어왔을 때 쓰는 안전망입니다.
  // 냄비 그림과 마찬가지로 재료 칸도 어묵탕 것을 그대로 씁니다.
  default:Object.freeze({
    title:"화력 조절",
    description:"스페이스바를 꾹 눌러 온도를 올리고, 떼서 내리며 적정 온도를 따라가세요.",
    visual:"oden",ingredients:HEAT_INGREDIENTS.oden,
    targetSize:.22,targetHold:7,targetSpeed:.13,timeLimit:22,
    initialValue:.26,initialTarget:.54,initialTargetDirection:1,
    riseSpeed:.58,fallSpeed:.46,riseResponse:7,fallResponse:5
  })
});

/* 화구 손잡이가 강불(화력 1)에서 시계방향으로 도는 각도입니다.
   손잡이 그림·자리·크기는 css/minigame-parts.css 의 .mg-burner-knob 이 갖고 있고,
   여기서는 "얼마나 도는지"만 정합니다. 0도가 화구 그림에 그려진 꺼진 자리입니다. */
const HEAT_KNOB_MAX_TURN=120;

const HEAT_FEEL_CONFIG=Object.freeze({
  exitGrace:0.3,
  warningDelay:0.65,
  progressDecayRate:.6,
  /* ── 적정 구간이 "한 번" 움직이는 방식 ──
     한 번의 이동은 [출발점 → 목적지] 한 구간이고, 걸리는 시간은 거리와
     아래 HEAT_TARGET_PACES 의 성격이 정합니다. 도착하면 잠깐 멈췄다가
     다음 이동을 새로 뽑습니다. */
  moveMinTravel:.16,        // 최소 이동 폭(전체 범위 대비). 이보다 짧으면 멈춘 것처럼 보입니다
  moveTravelSpread:.2,
  moveDurMin:.3,            // 아무리 짧은 이동도 이보다 빨리 끝나지 않습니다(순간이동 방지)
  moveDurMax:2.4,
  /* ── 구간이 잠깐 좁아지는 연출 ──
     좁아지는 동안에는 같은 자리에 있어도 밖으로 밀려납니다. 그게 노림수입니다. */
  pinchFirstDelay:2.4,      // 시작하자마자 좁히지는 않습니다(자리를 잡을 시간)
  pinchGapMin:3.6,
  pinchGapRange:3.2,
  pinchDurMin:1,
  pinchDurRange:.9,
  pinchDepthMin:.34,        // 폭이 줄어드는 비율. .34 면 가장 좁을 때 원래의 66%
  pinchDepthRange:.2
});

/* 이동 성격 세 가지. speed 는 메뉴 설정의 targetSpeed 에 곱하는 배수입니다.
   느긋 · 보통 · 훅 이 섞여야 "다음에 어떻게 움직일지" 예측이 안 됩니다 —
   전부 cruise 뿐이면 예전처럼 정직하게 흐르는 그 움직임이 됩니다.
   hold 는 도착한 뒤 숨 고르는 시간이라 빠른 이동일수록 짧습니다.

   ⚠️ dash 를 더 키우지 마세요. 아래 heatMoveEase 의 최고 기울기가 평균의 1.5배라
      dash 의 순간 속도는 targetSpeed x speed x 1.5 = 초당 약 0.68 입니다.
      온도 커서가 올라가는 속도(riseSpeed 0.58)와 비슷한 선이라, 훅 지나갈 때
      바짝 따라붙으면 놓치지 않을 수 있습니다. 여기서 더 키우면 커서가
      아예 못 따라가서 쫄리는 게 아니라 운으로 바뀝니다.
   ⚠️ 전체 속도는 여기가 아니라 메뉴 설정의 targetSpeed 로 조절하세요.
      세 성격의 **비율**은 그대로 두고 다 같이 느려집니다. */
const HEAT_TARGET_PACES=Object.freeze([
  Object.freeze({id:"drift", speed:.9,  holdMin:.28,holdRange:.34,weight:3}),
  Object.freeze({id:"cruise",speed:2,   holdMin:.1, holdRange:.24,weight:4}),
  Object.freeze({id:"dash",  speed:3.5, holdMin:0,  holdRange:.2, weight:3})
]);
const HEAT_PACE_WEIGHT_TOTAL=HEAT_TARGET_PACES.reduce((sum,pace)=>sum+pace.weight,0);

function pickHeatPace(random){
  let roll=random()*HEAT_PACE_WEIGHT_TOTAL;
  for(const pace of HEAT_TARGET_PACES){if((roll-=pace.weight)<0)return pace;}
  return HEAT_TARGET_PACES[HEAT_TARGET_PACES.length-1];
}

/* 0 → 1 을 잇는 곡선입니다(smoothstep). 양 끝의 기울기가 0 이라 스르르 출발해
   스르르 멈춥니다 — 이게 속도의 페이드 인 · 페이드 아웃입니다. 등속으로 밀면
   출발과 정지가 딱딱 끊겨서 기계가 움직이는 것처럼 보입니다.
   ⚠️ 4t³ 짜리 cubic ease-in-out 으로 바꾸지 마세요. 가운데 기울기가 평균의
      3배까지 치솟아서, 같은 pace 값이어도 순간 속도가 두 배가 됩니다. */
function heatMoveEase(t){return t*t*(3-2*t);}

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

function heatCompletionGrade(data){return data.warnings===0?"perfect":"good";}

/* 다음 이동 한 번을 통째로 계획합니다 — 어디로 · 얼마나 오래 · 도착 후 얼마나 쉴지.
   목적지만 정하고 매 프레임 쫓아가게 하면(예전 방식) 결국 늘 비슷한 속도가 나옵니다.
   이동을 한 구간으로 잡아 두어야 그 안에서 가속·감속을 마음대로 그릴 수 있습니다.
   random 인자를 열어 둔 것은 테스트에서 같은 움직임을 재현할 수 있게 하기 위해서입니다. */
function retargetHeatZone(data,config,random=Math.random){
  const half=config.targetSize/2,range=1-config.targetSize,pace=pickHeatPace(random);
  let goal=half+random()*range;
  // 지금 자리와 너무 가까우면 화면상 멈춘 것처럼 보이므로 최소 이동 폭을 줍니다.
  if(Math.abs(goal-data.target)<range*HEAT_FEEL_CONFIG.moveMinTravel){
    const direction=random()<.5?-1:1;
    goal=clamp(data.target+direction*range*(HEAT_FEEL_CONFIG.moveMinTravel+random()*HEAT_FEEL_CONFIG.moveTravelSpread),half,1-half);
  }
  data.targetFrom=data.target;
  data.targetGoal=goal;
  data.targetPace=pace.id;
  data.targetMoveTime=0;
  // 같은 거리라도 성격에 따라 걸리는 시간이 다릅니다 = 눈에 보이는 속도가 다릅니다.
  data.targetMoveDur=clamp(Math.abs(goal-data.targetFrom)/(config.targetSpeed*pace.speed),
    HEAT_FEEL_CONFIG.moveDurMin,HEAT_FEEL_CONFIG.moveDurMax);
  data.targetHoldIn=pace.holdMin+random()*pace.holdRange;
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

function updateHeatTarget(data,config,dt,random=Math.random){
  updateHeatPinch(data,dt,random);
  if(data.targetMoveTime>=data.targetMoveDur){
    // 도착했습니다. 잠깐 숨을 고른 뒤에야 다음 이동을 뽑습니다 —
    // 쉬지 않고 계속 흐르면 리듬이 안 보여서 오히려 밋밋해집니다.
    data.targetHoldIn-=dt;
    if(data.targetHoldIn>0)return;
    retargetHeatZone(data,config,random);
  }
  data.targetMoveTime=Math.min(data.targetMoveDur,data.targetMoveTime+dt);
  const half=config.targetSize/2,progress=heatMoveEase(data.targetMoveTime/data.targetMoveDur);
  data.target=clamp(data.targetFrom+(data.targetGoal-data.targetFrom)*progress,half,1-half);
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
        <div class="heat-panel heat-count">
          <h3 class="heat-col-title">진행도</h3>
          <p class="heat-count-value"><b id="heatHoldValue">0.0</b> / ${config.targetHold.toFixed(1)}</p>
          <div class="heat-hold" title="적정 온도 유지"><i id="heatHoldFill"></i></div>
          <p class="heat-time" id="heatTime"><span>남은 시간</span><b>${config.timeLimit.toFixed(1)}초</b></p>
        </div>
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

function updateHeatVisual(data,config,timeLeft){
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
  /* 우측 진행도 카드. E10 멸치 머리 떼기의 '완성 개수' 카드와 같은 구성입니다 —
     큰 숫자 + 남은 시간. E4 만 그 사이에 가는 띠가 하나 더 있는데, 여기 진행도는
     0.0~7.0 사이를 연속으로 오가는 값이라 숫자만으로는 늘고 주는 게 잘 안 보입니다.
     ⚠️ 숫자에 '초' 를 붙이지 마세요. 이 값은 "적정 온도를 지킨 시간"이 아니라
        **채워야 하는 점수**입니다. 밖으로 나가면 도로 줄어드는데 '초' 라고 적혀
        있으면 시간이 거꾸로 가는 것처럼 보입니다. 시간은 아래 남은 시간 줄입니다. */
  const holdValue=dom.miniContent.querySelector("#heatHoldValue");if(holdValue)holdValue.textContent=data.inZone.toFixed(1);
  const holdFill=dom.miniContent.querySelector("#heatHoldFill");if(holdFill)holdFill.style.width=`${data.inZone/config.targetHold*100}%`;
  updateHeatTimeLeft(timeLeft);
}

/* 남은 시간 줄. 공용 타이머 카드(#miniTimer)는 이 화면에서 숨겨져 있어서
   (css/minigame-parts.css) 카운트다운을 여기서 직접 그립니다 — E10 과 같은 방식입니다. */
function updateHeatTimeLeft(timeLeft){
  const timeRow=dom.miniContent.querySelector("#heatTime");
  if(!timeRow||!Number.isFinite(timeLeft))return;
  const left=Math.max(0,timeLeft);
  timeRow.classList.toggle("warning",left<=5);
  const value=timeRow.querySelector("b");
  if(value)value.textContent=`${left.toFixed(1)}초`;
}

/* 끝날 때 손을 떼고 조작 표시를 원래대로 돌립니다. 다 채웠을 때와 시간이 다
   됐을 때가 같은 뒷정리를 해야 해서 한 군데로 모았습니다. */
function settleHeatScene(m){
  m.data.phase="complete";m.data.holding=false;
  dom.miniContent.querySelector("#heatLift")?.classList.remove("pressed");
  dom.miniContent.querySelector(".heat-cooktop .mg-burner-knob")?.classList.remove("turning");
}

function completeHeatHold(m){
  const grade=heatCompletionGrade(m.data),result=dom.miniContent.querySelector("#e4Result");
  settleHeatScene(m);
  dom.miniContent.querySelector("#heatCookScene")?.classList.add("e4-complete");
  if(result){result.textContent=grade==="perfect"?"PERFECT":"GOOD";result.className=`e4-result show ${grade}`;}
  finishMini(grade==="perfect"?100:85);
}

/* 제한 시간 안에 7.0 을 못 채웠을 때. 아예 0점으로 끝내지는 않고 채운 만큼 줍니다 —
   여기서 막히면 그날 장사를 통째로 다시 해야 해서 벌이 너무 큽니다.
   (30 ~ 80점. 다 채웠을 때의 85 · 100 보다는 반드시 낮아야 합니다) */
function timeoutHeatHold(m){
  const config=HEAT_CONFIG[m.data.configId],result=dom.miniContent.querySelector("#e4Result");
  settleHeatScene(m);
  updateHeatTimeLeft(0);
  if(result){result.textContent="TIME OVER";result.className="e4-result show timeout";}
  finishMini(Math.round(30+50*clamp(m.data.inZone/config.targetHold,0,1)));
}

registerMiniEngine("heat",{
  setup(m,{set}){
    const configId=heatConfigId(m),config=HEAT_CONFIG[configId];
    // 세 번째 인자가 제한 시간입니다(m.time). 예전에는 여기에 targetHold(7)을 넣고
    // timerRuns 를 false 로 꺼 두어서 시간 제한이 아예 없었습니다.
    set(config.title,config.description,config.timeLimit);
    m.data={
      configId,value:config.initialValue,velocity:0,target:config.initialTarget,inZone:0,total:0,
      targetFrom:config.initialTarget,targetGoal:config.initialTarget,targetPace:"cruise",
      targetMoveTime:0,targetMoveDur:HEAT_FEEL_CONFIG.moveDurMin,targetHoldIn:0,
      sizeScale:1,pinchIn:HEAT_FEEL_CONFIG.pinchFirstDelay,pinchTime:0,pinchDur:0,pinchDepth:0,
      outsideTime:0,warnings:0,enteredZone:false,excursionWarned:false,
      holding:false,phase:"ready"
    };
    retargetHeatZone(m.data,config);
    // 첫 이동만 메뉴 설정의 방향을 따릅니다(어묵탕은 위로, 떡볶이는 아래로).
    // 거리는 그대로 두고 부호만 뒤집으므로 위에서 잡은 이동 시간이 그대로 맞습니다.
    if(Math.sign(m.data.targetGoal-m.data.target)!==config.initialTargetDirection){
      const half=config.targetSize/2;
      m.data.targetGoal=clamp(m.data.target+config.initialTargetDirection*Math.abs(m.data.targetGoal-m.data.target),half,1-half);
    }
    // 냄비의 끓는 루프만 비교 청음할 수 있도록 가스불 효과음은 잠시 제외합니다.
    if(configId==="oden")audio.loop?.("clear_simmer",m,.55);
    else if(configId==="tteokbokki")audio.loop?.("thick_boil",m,.55);
    // 3열 화면입니다. 칸 크기는 css/minigame-parts.css 의 공용 규격이 정하고,
    // 여기서는 어느 칸에 무엇을 넣을지만 정합니다.
    dom.miniContent.innerHTML=heatScreenMarkup(config);
    bindHeatKnobControl(m);
    updateHeatVisual(m.data,config,m.time);
  },

  // 제한 시간 안에 진행도 7.0 을 채우는 게임입니다. 카운트다운은 game.js 가 m.time 을
  // 깎으며 돌리고, 0 이 되면 아래 timeout 을 부릅니다.
  timerRuns(){return true;},

  timeout(m){timeoutHeatHold(m);},

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
      if(data.outsideTime>HEAT_FEEL_CONFIG.exitGrace)data.inZone=Math.max(0,data.inZone-dt*HEAT_FEEL_CONFIG.progressDecayRate);
      if(data.outsideTime>=HEAT_FEEL_CONFIG.warningDelay&&!data.excursionWarned){data.warnings++;data.excursionWarned=true;audio.bad();}
    }
    updateHeatVisual(data,config,m.time);
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
