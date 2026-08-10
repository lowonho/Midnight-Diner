"use strict";

/* ============================================================
   첫날 안내 짚어 주기 (#tutorialSpotlight)
   ------------------------------------------------------------
   담당 범위: 첫 회차 첫째 날 안내 대사가 끝난 뒤, 지금 손댈 대상만
              남기고 화면을 잠깐 어둡게 덮는 연출 · 대상 좌표

   담당 범위가 아님: 언제 켤지 (어느 대사 뒤인지)
              → js/story-data.js 의 장면에 spotlight:"이름" 으로 적고
                js/story.js finishStorySession 이 여기를 부릅니다

   [왜 SVG 마스크인가]
   ------------------------------------------------------------
   "가운데만 밝은 사각형"은 CSS box-shadow 한 줄이면 되지만, 짚어야 할
   곳이 둘 이상인 경우가 있습니다 — 준비물은 메뉴마다 한 자리씩 흩어져
   있고, 조리 집기도 주방 뒤쪽 줄과 앞쪽 철판으로 갈립니다. 그런
   구멍을 box-shadow 로 여러 장 겹치면 겹친 자리만 두 배로 어두워져서
   얼룩이 생깁니다. 마스크는 몇 개를 뚫든 어둠이 한 겹입니다.

   viewBox 를 논리 좌표(1280x720) 그대로 두고 preserveAspectRatio="none"
   으로 프레임에 늘려 두었기 때문에, 게임 쪽 좌표를 변환 없이 그대로
   씁니다. 창 크기가 바뀌어도 따라옵니다.

   [게임 루프와 무관합니다] 시간은 CSS 트랜지션과 setTimeout 이 셉니다.
   대화가 끝난 직후는 state.paused 가 막 풀리는 자리라, 프레임 갱신에
   기대면 일시정지·미니게임 진입에서 연출이 멈춰 버립니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 설정값
   ------------------------------------------------------------ */

const TUTORIAL_SPOTLIGHT = {
  /* 구멍 밖을 덮는 어둠. 짚어 주는 동안에는 발도 묶이므로(아래 §3),
     "지금은 이것만 보라"가 분명히 읽히도록 꽤 진하게 갑니다. HUD 까지
     같이 덮이는 값이라(아래 z-index 설명) 더 올리면 좌측 준비 목록 글자가
     읽히지 않습니다. 실측: .5 는 바깥이 약 46% 어두워지고, .68 은 약 65% 입니다. */
  dim: .68,
  blur: 13,      // 구멍 가장자리가 번지는 거리 (논리 px)
  pad: 16,       // 대상 사각형 바깥으로 넓히는 여백 (논리 px)
  radius: 20,    // 구멍 모서리 굴림 (논리 px)
  /* 머무는 시간. 눈이 한 번 가서 무엇인지 알아볼 만큼만입니다.
     들고 나는 시간은 css/tutorial-spotlight.css 의 transition 과 같아야
     합니다 — 한쪽만 고치면 다 밝아지기 전에 타이머가 끝나거나,
     다 어두워진 화면이 잠깐 그대로 남습니다.
     ⚠️ fadeInMs + holdMs 가 곧 "어두운 시간"이자 발이 묶이는 시간입니다.
        2440 → 1710(약 70%)으로 줄인 자리입니다. 짚어 주는 대상이 셋뿐이라
        1.7초면 눈이 한 번 가고, 그 이상은 붙잡혀 있다는 느낌이 먼저 옵니다.
        밝아지는 fadeOutMs 는 그대로 둡니다 — 걷히는 동안은 이미 움직일 수
        있어서 답답함과 무관하고, 짧게 하면 뚝 끊겨 보입니다. */
  fadeInMs: 340,
  holdMs: 1370,
  fadeOutMs: 620
};

/* 짚을 대상 이름 → 논리 좌표 사각형들.
   여기서 좌표를 새로 적지 않고 실제 배치를 그대로 읽습니다. 집기나
   준비물을 옮기면 짚는 자리도 따라옵니다. */
const TUTORIAL_SPOTLIGHT_TARGETS = {
  // 오늘의 메뉴를 정하는 곳. 주방 줄 맨 왼쪽입니다. (kitchen.js STATIONS)
  fridge(){
    const fridge=typeof STATIONS!=="undefined"?STATIONS.fridge:null;
    return fridge?[{x:fridge.x,y:fridge.y,w:fridge.w,h:fridge.h}]:[];
  },

  /* 바 테이블 위 준비물. 메뉴 하나당 한 자리라 그 자리를 각각 뚫습니다
     (prep.js prepObjectLayout). 통째로 한 덩이로 묶으면 바 테이블 절반이
     밝아져서 무엇을 누르라는 것인지가 흐려집니다.
     세로 범위는 이름표 판 위(labelDy 기준)부터 진행 글자 아래까지입니다. */
  prepTable(){
    if(typeof prepObjectLayout!=="function"||typeof PREP_LAYOUT==="undefined")return [];
    const L=PREP_LAYOUT;
    return prepObjectLayout().map(item=>({
      x:item.x-L.artW/2,
      y:item.y+L.labelDy-16,
      w:L.artW,
      h:(L.artH/2+L.statusGap+10)-(L.labelDy-16)
    }));
  },

  /* 조리하는 곳. 뒤쪽 집기 줄(도마~튀김기)과 앞쪽 철판 두 군데입니다.
     철판만 카운터 앞에 따로 떨어져 있어서(counter.js FRONT_STATIONS),
     뒤쪽 줄만 짚으면 볶음우동을 시킨 날 엉뚱한 곳을 가리킵니다.
     싱크대·식기세척기·냉장고는 요리를 마무리하는 집기가 아니라서 뺍니다. */
  kitchen(){
    const rects=[];
    if(typeof STATIONS!=="undefined"){
      const row=["board","pot","pan","grill","fryer"].map(id=>STATIONS[id]).filter(Boolean);
      if(row.length){
        const left=Math.min(...row.map(s=>s.x));
        const right=Math.max(...row.map(s=>s.x+s.w));
        const top=Math.min(...row.map(s=>s.y));
        const bottom=Math.max(...row.map(s=>s.y+s.h));
        rects.push({x:left,y:top,w:right-left,h:bottom-top});
      }
    }
    const griddle=typeof FRONT_STATIONS!=="undefined"?FRONT_STATIONS.griddle:null;
    if(griddle)rects.push({x:griddle.x,y:griddle.y,w:griddle.w,h:griddle.h});
    return rects;
  }
};


/* ------------------------------------------------------------
   2. 켜고 끄기
   ------------------------------------------------------------ */

let tutorialSpotlightTimer=null;
/* 발을 묶어 두는 동안만 true 입니다. 어둠이 걷히기 시작하는 순간(hide)에
   풀리므로, 화면이 밝아지는 0.6초는 이미 걸어갈 수 있습니다.
   ⚠️ state.paused 를 쓰지 않는 이유 — 그건 화면 전체를 세우는 스위치라
      손님 등장·대기 시간까지 같이 멈추고, 짚어 주는 도중 설정창을 열었다
      닫으면 일시정지 상태가 서로 덮어써집니다. 여기서 막고 싶은 것은
      요리사의 걸음 하나뿐이라 player.js updatePlayer 에서만 봅니다. */
let tutorialSpotlightInputHold=false;

function tutorialSpotlightHoldsInput(){
  return tutorialSpotlightInputHold===true;
}

function tutorialSpotlightElements(){
  const layer=document.getElementById("tutorialSpotlight");
  return {
    layer,
    holes:layer?.querySelector("#tutorialSpotlightHoles")||null,
    veil:layer?.querySelector(".tutorial-spotlight-veil")||null,
    soften:layer?.querySelector("#tutorialSpotlightSoften feGaussianBlur")||null
  };
}

function tutorialSpotlightRects(kind){
  const resolve=TUTORIAL_SPOTLIGHT_TARGETS[kind];
  if(typeof resolve!=="function")return [];
  let rects=[];
  // 배치 계산은 게임 상태를 읽습니다. 아직 준비가 안 된 국면에서 불려도
  // 연출 하나 때문에 화면이 죽으면 안 되므로 조용히 넘어갑니다.
  try{rects=resolve()||[];}
  catch(_error){return [];}
  return rects.filter(rect=>
    rect&&Number.isFinite(rect.x)&&Number.isFinite(rect.y)
    &&Number(rect.w)>0&&Number(rect.h)>0
  );
}

function clearTutorialSpotlightTimer(){
  if(tutorialSpotlightTimer){clearTimeout(tutorialSpotlightTimer);tutorialSpotlightTimer=null;}
}

function hideTutorialSpotlight(){
  clearTutorialSpotlightTimer();
  tutorialSpotlightInputHold=false;
  const {layer}=tutorialSpotlightElements();
  layer?.classList?.remove?.("show");
  layer?.setAttribute?.("aria-hidden","true");
  return true;
}

/* 대상을 짚어 줍니다. 대상이 화면에 없으면(아직 안 놓인 준비물 등)
   아무것도 하지 않습니다 — 뚫을 곳 없이 켜면 화면만 통째로 어두워집니다. */
function showTutorialSpotlight(kind){
  const {layer,holes,veil,soften}=tutorialSpotlightElements();
  if(!layer||!holes)return false;
  const rects=tutorialSpotlightRects(kind);
  if(!rects.length){hideTutorialSpotlight();return false;}

  const S=TUTORIAL_SPOTLIGHT;
  // 어둠의 진하기와 번짐은 위 설정값 하나만 보고 갑니다. index.html 의
  // 초깃값을 여기서 덮어써서, 두 곳에 같은 숫자를 적어 두지 않습니다.
  veil?.setAttribute?.("fill-opacity",String(S.dim));
  soften?.setAttribute?.("stdDeviation",String(S.blur));
  holes.innerHTML=rects.map(rect=>{
    const x=rect.x-S.pad, y=rect.y-S.pad;
    const w=rect.w+S.pad*2, h=rect.h+S.pad*2;
    // 마스크 안에서 검정이 곧 구멍입니다(흰 바탕에서 파냅니다).
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"`
      +` rx="${S.radius}" ry="${S.radius}" fill="#000" />`;
  }).join("");

  clearTutorialSpotlightTimer();
  layer.dataset.target=kind;
  layer.setAttribute("aria-hidden","true");   // 장식입니다. 읽어 줄 내용이 없습니다.
  // 클래스를 붙이기 전에 한 프레임 흘려야 방금 바뀐 구멍 자리에서
  // 트랜지션이 시작됩니다(연달아 켤 때 앞 구멍에서 번지지 않게).
  layer.classList.remove("show");
  void layer.getBoundingClientRect();
  layer.classList.add("show");
  /* 어두워지기 시작하는 이 순간부터 걸음을 막습니다. 다 어두워진 뒤에
     막으면 그 0.34초 동안 걸어가 버려서, 정작 짚어 준 것을 보고 있을 때는
     엉뚱한 자리에 서 있게 됩니다.
     ⚠️ 여기서 눌린 키를 지우지는 않습니다(resetPlayerKeyboardInput).
        updatePlayer 가 이 깃발을 보고 어차피 걸음을 안 옮기고, 키를 지우면
        계속 누르고 있던 사람은 어둠이 걷힌 뒤 한 번 뗐다 눌러야 다시
        걷게 됩니다. 조이스틱 값은 updatePlayer 가 매 프레임 0으로 둡니다. */
  tutorialSpotlightInputHold=true;
  tutorialSpotlightTimer=setTimeout(hideTutorialSpotlight,S.fadeInMs+S.holdMs);
  return true;
}

/* 화면이 통째로 바뀌는 자리(타이틀로 나가기 · 저장 불러오기 등)에서
   부릅니다. 남아 있던 어둠이 다음 화면까지 따라가지 않게 합니다. */
function resetTutorialSpotlight(){
  hideTutorialSpotlight();
  const {holes}=tutorialSpotlightElements();
  if(holes)holes.innerHTML="";
}
