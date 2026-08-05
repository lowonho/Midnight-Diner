"use strict";

/* ============================================================
   화면에 보이는 글자 + HUD 마크업

   [왜 따로 모으나]
   문구를 고치려고 game.js(게임 규칙)를 열지 않아도 되게 하려는 것입니다.
   마크업도 마찬가지입니다. 카드 모양을 바꾸는 일과 주문을 세는 일은
   서로 다른 작업인데, 원래는 buildMenuCards 한 함수 안에 섞여 있었습니다.

   [값을 받는 문구는 함수입니다]
   값이 끼는 문구는 함수로 두었습니다.
   game.js 는 숫자만 넘기고 문장은 여기서 만듭니다.

   [로드 순서]
   ui-class-names.js 다음, game.js 보다 먼저 로드해야 합니다.
   ============================================================ */

const UI_TEXT = Object.freeze({

  /* ── 상단 HUD ─────────────────────────────────────── */
  /* 단계 이름. key 는 GAME_PHASES 값("menuSelect"·"day"·"night"·"result")입니다.
     문자열을 직접 쓰지 않고 상수로 키를 만들어야 game-data.js 에서 값을
     바꿔도 같이 따라갑니다. 목록에 없는 단계는 phaseNameFallback. */
  phaseName: Object.freeze({
    [GAME_PHASES.MENU_SELECT]:"메뉴 선택",
    [GAME_PHASES.INGREDIENT_SELECT]:"냉장고 재료 고르기",
    [GAME_PHASES.PREP]:"낮 재료 준비",
    [GAME_PHASES.OPEN]:"밤 영업",
    [GAME_PHASES.RESULT]:"영업 종료"
  }),
  phaseNameFallback: "영업 준비",

  timeLabelPrep: "준비",
  timeLabelOpen: "영업",
  timeLabelOther: "남은 시간",
  timeNoLimit: "제한 없음",
  blank: "-",

  money: value => `${value.toLocaleString()}원`,
  score: value => `${value}점`,
  percent: value => `${value}%`,

  /* ── 좌측 HUD ─────────────────────────────────────── */
  // 목록에 없는 단계는 result("마감")로 떨어집니다.
  phaseBadge: Object.freeze({
    [GAME_PHASES.MENU_SELECT]:"선택",
    [GAME_PHASES.INGREDIENT_SELECT]:"재료",
    [GAME_PHASES.PREP]:"준비",
    [GAME_PHASES.OPEN]:"영업 중",
    [GAME_PHASES.RESULT]:"마감"
  }),
  leftTitlePrep: "오늘의 준비",
  leftTitleOther: "현재 주문",

  phaseButton: "영업 시작",

  /* ── 설정 / 일시정지 ──────────────────────────────── */
  pauseFromTitle: "소리 설정을 변경할 수 있습니다.",
  pauseFromGame: "게임이 일시정지되었습니다.",
  // 미니게임·이야기 조리 중에는 저장과 타이틀 이동을 막습니다.
  pauseSaveBlocked: "진행 중인 조리를 마치면 저장과 타이틀 이동을 사용할 수 있습니다.",
  resumeFromTitle: "설정 닫기",
  resumeFromGame: "게임으로 돌아가기",

  /* ── 미니게임 ─────────────────────────────────────── */
  miniTitleSpecial: title => `특별 조리 · ${title}`,
  miniDescSpecial: desc => `${desc} 평소보다 조금 더 섬세한 조리가 필요합니다.`,
  // 스토리 튜토리얼 조리 (사장이 옆에서 알려주는 단계)
  miniTitleTutorial: title => `조리 안내 · ${title}`,
  miniDescTutorial: desc => `${desc} 사장의 안내에 따라 천천히 조리해 보세요.`,
  miniScore: score => score>=90?`완벽해요! ${score}점`:score>=70?`좋아요! ${score}점`:`조금 아쉬워요. ${score}점`,

  /* ── 토스트 ───────────────────────────────────────── */
  toast: Object.freeze({
    prepTooFar: "앞 테이블의 준비 재료 가까이 이동하세요.",
    stationTooFar: "사용할 집기 가까이 이동하세요.",
    wrongStep: label => `지금은 ${label} 단계입니다.`,
    orderSelect: "주문 선택",
    prepDone: name => `${name} 준비 완료!`,
    prepNext: label => `다음 단계: ${label}`,
    cookDone: name => `${name} 완성! 주문한 손님에게 가져다주세요.`,
    cookNext: label => `다음 조리: ${label}`,
    codexSoon: "도감은 준비 중입니다."
  }),

  /* ── 상호작용 프롬프트 ────────────────────────────
     화면에는 키캡 'E' 만 보입니다. 아래 문구는 aria-label 로만 들어가서
     스크린리더가 읽습니다. (css/interaction.css 가 글자를 그리지 않습니다) */
  prompt: Object.freeze({
    serve: seat => `E · ${seat}번 손님에게 서빙`,
    prepObject: label => `E · ${label}`,
    station: label => `E · ${label} 사용`
  }),

  /* ── 화면에 튀어오르는 글자 (fx.js spawnPopup) ────── */
  popup: Object.freeze({
    prepGain: (name,quality) => `${name} 준비 완료 · 품질 ${quality}`,
    cookDone: "완성!"
  })
});

/* ============================================================
   메뉴 카드 마크업

   원래 game.js 의 buildMenuCards 가 createElement + innerHTML 로
   직접 조립했습니다. 그림 모양을 바꾸려면 게임 규칙 파일을 열어야 했습니다.

   game.js 는 이제 "무엇을 그릴지"(이름·개수·필수 여부)만 넘기고,
   "어떻게 생겼는지"는 여기서만 정합니다.
   ============================================================ */

// card = {id, name, iconUrl, required, orderCount}
function menuCardElement(card){
  const button=document.createElement("button");
  button.type="button";
  button.className=UI_CLASS.menuCard;
  button.dataset.id=card.id;
  button.disabled=true;   // 표시 전용입니다. 선택은 메뉴 선택 화면(day.js)에서 합니다.

  // 음식 그림은 food-props.js 가 메뉴 id 로 찾아 줍니다. (표에 없는 메뉴만 자리표시)
  // 특별음식 반짝임은 메뉴판에서 뺐습니다 — 요리사가 들고 있을 때만 나옵니다. (player.js)
  const icon=card.iconUrl
    ? `<span class="${UI_CLASS.menuCardIcon}" style="background-image:url('${card.iconUrl}')"></span>`
    : `<span class="${UI_CLASS.menuCardIcon} ${UI_CLASS.menuCardIconEmpty}">🍽</span>`;
  const tag=card.required?`<small class="${UI_CLASS.menuCardTag}">필수</small>`:"";
  const orders=card.orderCount?`<span class="${UI_CLASS.menuCardOrderCount}">주문 ${card.orderCount}</span>`:"";

  button.innerHTML=`<strong>${card.name}</strong>${icon}${tag}${orders}`;
  return button;
}

// 카드 목록을 통째로 다시 그립니다.
function renderMenuCards(container,cards){
  container.innerHTML="";
  cards.forEach(card=>container.appendChild(menuCardElement(card)));
}
