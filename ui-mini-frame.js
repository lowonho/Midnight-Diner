"use strict";

/* ============================================================
   미니게임 공용 프레임 마크업 (index.html 에서 분리)

   모든 미니게임이 이 4개 패널을 그대로 씁니다.
   크기·위치는 css/minigame-frame.css 상단 변수 한 곳에서 관리합니다.

   [왜 .html 조각이 아니라 .js 인가]
   이 게임은 빌드가 없고 index.html 을 file:// 로 바로 열 수 있어야 합니다.
   (README "실행 방법" 참고) fetch 로 .html 조각을 불러오면 file:// 에서
   CORS 에 막혀 게임이 아예 뜨지 않으므로, 마크업을 문자열로 들고 있다가
   부팅 시점에 끼워 넣는 방식을 씁니다.

   [로드 순서]
   game.js 보다 반드시 먼저 로드해야 합니다.
   game.js 의 dom 객체가 스크립트 로드 시점에 getElementById 로
   miniOverlay/miniContent/miniClose ... 를 한 번에 잡아가기 때문입니다.

   [건드릴 때 주의]
   1. 삽입 위치(index.html 의 #miniFrameMount)를 옮기지 마세요.
      오버레이는 전부 z-index:30 이라 DOM 순서가 곧 겹침 순서입니다.
      지금은 storyOverlay 다음 / resultOverlay 앞입니다.
   2. #miniClose 와 #miniPause 의 앞뒤 순서를 바꾸지 마세요.
      css/minigame-frame.css 의 `#miniClose[hidden] + #miniPause` 가
      인접 형제 선택자라, 순서가 바뀌면 일시정지 버튼이 사라집니다.
   3. id 를 바꾸면 game.js 의 dom 목록도 같이 고쳐야 합니다.
   4. .mini-window / .mini-title-panel 에 .wood-panel 을 다시 붙이지 마세요.
      두 패널은 나무판·금테가 그려진 UI 에셋을 배경으로 깝니다(css/minigame-frame.css).
      .wood-panel 의 border / box-shadow 가 그림 속 금테와 이중으로 겹칩니다.
   ============================================================ */

const MINI_FRAME_HTML = `
          <section id="miniOverlay" class="overlay mini-overlay" role="dialog" aria-modal="true" aria-labelledby="miniTitle">
            <!-- 1. 뒤에 깔리는 가장 큰 패널 -->
            <div class="mini-window" aria-hidden="true"></div>

            <!-- 3. 게임 메인 플레이 영역 -->
            <div class="mini-stage">
              <div id="miniContent" class="mini-content"></div>
              <div id="miniTimer" class="mini-timer">8.0</div>
            </div>

            <!-- 하단 TIP 줄. 미니게임 설명과 진행 피드백이 여기 모입니다. -->
            <div class="mini-tip">
              <span class="mini-tip-label" aria-hidden="true">TIP</span>
              <div class="mini-tip-body">
                <p id="miniDescription" class="mini-description"></p>
                <p id="miniFeedback" class="mini-feedback" aria-live="polite"></p>
              </div>
              <!-- 조작 안내 칩. 비어 있으면 CSS 가 숨깁니다(:empty).
                   글자는 setMiniTipHint() 로 넣습니다. 예) "드래그 : 육수 붓기" -->
              <span id="miniTipHint" class="mini-tip-hint"></span>
              <span class="mini-esc-hint"><kbd>ESC</kbd> 나가기</span>
            </div>

            <!-- 2. 미니게임 타이틀 패널 -->
            <div class="mini-title-panel">
              <p id="miniStation" class="eyebrow">조리대</p>
              <h2 id="miniTitle">미니게임</h2>
            </div>

            <!-- 4. 닫기 버튼 / 닫을 수 없는 미니게임이면 일시정지 버튼 -->
            <button id="miniClose" class="mini-icon-button mini-close" type="button" aria-label="미니게임 닫기" title="닫기 (ESC)" hidden>✕</button>
            <button id="miniPause" class="mini-icon-button mini-pause" type="button" aria-label="일시정지" title="일시정지">❚❚</button>
          </section>`;

// index.html 의 <div id="miniFrameMount"> 자리를 위 마크업으로 통째로 갈아끼웁니다.
// 이미 붙어 있으면(중복 로드) 아무것도 하지 않습니다.
function mountMiniFrame(){
  if(document.getElementById("miniOverlay"))return document.getElementById("miniOverlay");
  const anchor=document.getElementById("miniFrameMount");
  if(!anchor){
    console.error("미니게임 프레임을 붙일 자리(#miniFrameMount)를 index.html 에서 찾지 못했습니다.");
    return null;
  }
  anchor.outerHTML=MINI_FRAME_HTML;
  return document.getElementById("miniOverlay");
}

/* TIP 줄 오른쪽 조작 안내 칩을 채웁니다. 빈 문자열이면 칩이 사라집니다.
   미니게임을 열 때마다 game.js 가 ""(빈 값)으로 되돌리므로,
   칩이 필요한 게임만 setup 에서 한 번 불러 주면 됩니다.
     예) setMiniTipHint("드래그 : 육수 붓기");
   ※ 칩이 떠 있는 동안 설명 폭이 약 848px 로 줄어듭니다(설명 40자 이내 권장). */
function setMiniTipHint(text){
  const hint=document.getElementById("miniTipHint");
  if(hint)hint.textContent=text||"";
}

/* ============================================================
   타이틀 아래 부제 한 줄

   원래 이 자리(#miniStation)에는 조리대 이름이 작게 올라가 있었습니다.
     준비 테이블 · 무 바구니
     어묵탕 · 무 썰기            ← 제목
   채썰기(E2)와 양면 굽기(E5) 두 게임만 그 자리를 "어떻게 하는 게임인지"
   한 줄 안내로 쓰고 있었는데, 그쪽이 훨씬 쓸모 있어서 전 게임 공통으로 바꿨습니다.
     양배추 채썰기               ← 제목
     좌우로 움직여 양배추를 채썰어주세요!

   [글이 두 군데인 이유]
   여기 부제는 "이 게임이 무엇인지" 한 줄로 고정입니다.
   아래 TIP 줄(#miniDescription)은 "지금 이 단계에서 뭘 눌러야 하는지"라
   진행에 따라 계속 바뀝니다. 둘은 역할이 다릅니다.

   [키] 낮 준비는 PREP_TASKS 의 miniGame, 밤 조리는 MENU_DATA 의 cook[].game 입니다.
        표에 없으면 부제 줄이 통째로 사라집니다(:empty 로 숨김).
        게임이 스스로 더 정확한 문장을 만들 수 있으면 setup 에서
        dom.miniStation.textContent 로 덮어쓰면 됩니다(E2 · E5 가 그렇게 합니다).
   ============================================================ */
const MINI_SUBTITLE = Object.freeze({
  // ---- 낮 준비 ----
  cut:              "칼이 초록 구간에 들어왔을 때 눌러 썰어주세요!",
  tteokbokkiCut:    "칼이 초록 구간에 들어왔을 때 눌러 썰어주세요!",
  anchovy:          "멸치 머리를 잡고 좌우로 흔들어 떼어주세요!",
  kimchiFry:        "화살표를 순서대로 눌러 김치를 볶아주세요!",
  batter:           "재료를 순서대로 볼에 넣고 저어주세요!",
  skewer:           "닭과 파를 번갈아 순서대로 꽂아주세요!",
  yakisobaSauce:    "재료를 정확한 양만큼 계량해 넣어주세요!",
  tteokbokkiSauce:  "재료를 정확한 양만큼 계량해 넣어주세요!",
  udonSoak:         "우동면을 담고 물병을 기울여 물을 채워주세요!",
  tteokSoak:        "떡을 담고 물병을 기울여 물을 채워주세요!",
  // mandoline · potatoMandoline · potatoStarch · shrimpCoat 는 engine-e2 가 직접 채웁니다

  // ---- 밤 조리 ----
  heat:             "불을 조절해 적정 온도를 유지해주세요!",
  stir:             "화살표를 순서대로 눌러 볶아주세요!",
  fry:              "황금빛 구간에서 건진 뒤 기름을 털어주세요!",
  chop:             "칼이 초록 구간에 들어왔을 때 눌러 썰어주세요!",
  plateKimchi:      "두부와 김치를 한 조각씩 접시에 담아주세요!"
  // twoSideCook 은 engine-e5 가 요리별로 직접 채웁니다
});

/* 부제를 채웁니다. 표에 없으면 빈 문자열이라 줄이 사라집니다. */
function setMiniSubtitle(key){
  const station=document.getElementById("miniStation");
  if(station)station.textContent=MINI_SUBTITLE[key]||"";
}

/* 하단 공용 띠(.mg-strip)를 만들어 돌려줍니다.
   3열을 관통하는 가로 1363.2 짜리 칸이고, 비어 있으면 CSS 가 접습니다.
   각 엔진이 화면 마크업을 만들 때 3열 다음에 이 조각을 넣으면 됩니다.
     예) `<div class="mg-strip">${버튼마크업}</div>` */
function miniStripMarkup(inner=""){
  return `<div class="mg-strip">${inner}</div>`;
}

mountMiniFrame();
