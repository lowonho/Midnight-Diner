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
  /* 실제로 상단 타이틀 판에 찍히는 줄입니다. 단계 이름만으로는 며칠째인지가
     안 보여서 앞에 "n일차"를 붙입니다 — 예) 「1일차 메뉴 선택」.
     ⚠️ 위 phaseName 을 직접 읽지 말고 이 함수를 쓰세요(game.js updateUI).
     타이틀 판 안쪽 폭이 275 라 13px 글자로 약 20자까지 한 줄에 들어갑니다. */
  phaseNameWithDay: (day,phase) => `${day}일차 ${UI_TEXT.phaseName[phase]||UI_TEXT.phaseNameFallback}`,

  // 낮에도 밤과 같은 칸이 뜨지만, 낮에는 아직 아무도 오지 않았으므로
  // 오늘 밤 받을 손님 수를 미리 알려 줍니다(밤이 되면 남은 수로 줄어듭니다).
  timeLabelPrep: "방문 예정 손님",
  // 밤에는 시간이 아니라 남은 손님 수로 마감을 셉니다. 그래서 같은 칸의
  // 이름과 값이 밤에만 손님 수로 바뀝니다.
  timeLabelOpen: "남은 손님",
  timeLabelOther: "남은 시간",
  guestsLeft: count => `${count}명`,
  blank: "-",

  money: value => `${value.toLocaleString()}원`,
  // 낮에는 같은 칸이 그날의 특별 손님 이름표가 됩니다. 처음 가는 날짜의
  // 이름은 미리 알려 주지 않습니다(hud-special-guest.js 가 판정합니다).
  satisfactionLabelPrep: "오늘의 특별 손님",
  satisfactionLabelOther: "손님 반응",
  specialGuestUnknown: "???",
  // 내부 점수는 조리 판정에 그대로 쓰되 HUD에서는 손님의 표정처럼
  // 정성적인 반응만 보여 줍니다.
  guestResponse: value => cookingScoreMessage(value),
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
  // 상단 타이틀 판이 "1일차 낮 재료 준비", 우측이 "현재 목표"를 맡으므로
  // 좌측 제목은 이 판이 무엇인지(=목록)만 말합니다.
  leftTitlePrep: "준비 목록",
  leftTitleOther: "현재 주문",

  phaseButton: "영업 시작",

  /* ── 설정 / 일시정지 ──────────────────────────────── */
  // 소리 3줄 아래에 마우스 포인터 설정이 붙어서 "소리 설정" 만으로는 맞지 않습니다.
  pauseFromTitle: "소리와 마우스 포인터를 설정할 수 있습니다.",
  pauseFromGame: "게임이 일시정지되었습니다.",
  // 미니게임·이야기 조리 중에는 저장과 타이틀 이동을 막습니다.
  pauseSaveBlocked: "진행 중인 미니게임을 마치면 저장과 타이틀 이동을 사용할 수 있습니다.",
  resumeFromTitle: "설정 닫기",
  resumeFromGame: "게임으로 돌아가기",

  /* ── 미니게임 ─────────────────────────────────────── */
  miniTitleSpecial: title => `특별 조리 · ${title}`,
  miniDescSpecial: desc => `${desc} 평소보다 조금 더 섬세한 조리가 필요합니다.`,
  // 스토리 튜토리얼 조리 (사장이 옆에서 알려주는 단계)
  miniTitleTutorial: title => `조리 안내 · ${title}`,
  miniDescTutorial: desc => `${desc} 사장의 안내에 따라 천천히 조리해 보세요.`,
  miniScore: score => cookingScoreMessage(score),

  /* ── 토스트 ───────────────────────────────────────── */
  toast: Object.freeze({
    prepTooFar: "앞 테이블의 준비 재료 가까이 이동하세요.",
    stationTooFar: "사용할 집기 가까이 이동하세요.",
    wrongStep: label => `지금은 ${label} 단계입니다.`,
    orderSelect: "다음 손님 대기",
    prepDone: name => `${name} 준비 완료!`,
    prepNext: label => `다음 단계: ${label}`,
    cookDone: name => `${name} 완성! 주문한 손님에게 가져다주세요.`,
    cookNext: label => `다음 조리: ${label}`,
    discardDone: name => `완성한 음식을 폐기했습니다. ${name} 조리를 처음부터 다시 시작하세요.`,
    codexSoon: "도감은 준비 중입니다."
  }),

  /* ── 상호작용 프롬프트 ────────────────────────────
     기본 동작은 키캡 'E'만 보이고 아래 문구는 스크린리더가 읽습니다.
     완성 음식을 잃는 폐기 동작만 실수를 막기 위해 행동명도 표시합니다. */
  prompt: Object.freeze({
    serve: seat => `E · ${seat}번 손님에게 서빙`,
    discard: name => `E · ${name} 폐기`,
    discardVisible: "폐기",
    // 낮 준비물은 이름을 붙이지 않습니다 — 바로 위에 이름표(prep.js)가 이미 떠 있어서
    // 같은 글자가 두 줄로 겹쳐 보였습니다. 여기는 "누를 수 있다"만 알려 줍니다.
    prepObject: () => "E",
    station: label => `E · ${label} 사용`
  }),

  /* ── 화면에 튀어오르는 글자 (fx.js spawnPopup) ────── */
  popup: Object.freeze({
    prepGain: name => `${name} 준비 완료`,
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
