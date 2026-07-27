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
   ============================================================ */

const MINI_FRAME_HTML = `
          <section id="miniOverlay" class="overlay mini-overlay" role="dialog" aria-modal="true" aria-labelledby="miniTitle">
            <!-- 1. 뒤에 깔리는 가장 큰 패널 -->
            <div class="mini-window wood-panel" aria-hidden="true"></div>

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
              <span class="mini-esc-hint"><kbd>ESC</kbd> 나가기</span>
            </div>

            <!-- 2. 미니게임 타이틀 패널 -->
            <div class="mini-title-panel wood-panel">
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

mountMiniFrame();
