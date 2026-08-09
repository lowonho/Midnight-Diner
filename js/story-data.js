"use strict";

// 달빛식탁은 7일 단위로 반복되는 판타지 요리 이야기입니다.
// 이 파일은 플레이어에게 보이는 대사·내레이션과 장면 분기 계약만 담당합니다.
// 조리 미니게임의 구성과 메뉴 ID는 game-data.js의 기존 정의를 그대로 사용합니다.
const STORY_CHARACTERS = {
  protagonist: { name: "김다은", role: "주인공", portraitRow: null, alwaysKnown: true },
  recalledBoss: { name: "상사", role: "김다은이 다니는 회사의 상사", portraitRow: null, alwaysKnown: true },
  journal: { name: "영업일지", role: "달빛식탁의 장부", portraitRow: null, alwaysKnown: true },
  moonlightTable: { name: "달빛식탁", role: "달빛식탁의 목소리", portraitRow: null, alwaysKnown: true },
  rainyChild: { name: "비에 젖은 아이", role: "첫째 날 특별 손님", portraitRow: 0, alwaysKnown: true },
  lanternGuest: { name: "등불 손님", role: "둘째 날 특별 손님", portraitRow: 1, alwaysKnown: true },
  leftShadow: { name: "왼쪽 그림자", role: "셋째 날 특별 손님", portraitRow: 2, alwaysKnown: true },
  rightShadow: { name: "오른쪽 그림자", role: "셋째 날 특별 손님", portraitRow: 2, alwaysKnown: true },
  twinShadows: { name: "두 그림자", role: "셋째 날 특별 손님", portraitRow: 2, alwaysKnown: true },
  crowCourier: { name: "까마귀 배달부", role: "넷째 날 특별 손님", portraitRow: 3, alwaysKnown: true },
  starBeast: { name: "작은 짐승", role: "다섯째 날 특별 손님", portraitRow: 4, alwaysKnown: true },
  seawaterGuest: { name: "바닷물 손님", role: "여섯째 날 특별 손님", portraitRow: 5, alwaysKnown: true },
  schoolDoll: { name: "교복 인형", role: "일곱째 날 특별 손님", portraitRow: 6, alwaysKnown: true },
  facelessDaeun: { name: "얼굴 없는 손님", role: "마지막 예약 손님", portraitRow: 7, alwaysKnown: true },
  anotherDaeun: { name: "또 다른 김다은", role: "김다은이 포기한 내일", portraitRow: 7, alwaysKnown: true },
  letter: { name: "편지", role: "김다은이 남긴 편지", portraitRow: null, alwaysKnown: true },
  menuBack: { name: "메뉴판 뒷면", role: "에필로그 문구", portraitRow: null, alwaysKnown: true }
};

// 일반 손님은 확대 대화 없이 기존 말풍선 시스템으로만 반응합니다.
const GENERAL_GUEST_BUBBLES = {
  arrival: [
    "[음식명] 하나 부탁드릴게요.",
    "오늘은 [음식명][이/가] 먹고 싶네요.",
    "좋은 냄새가 나네요. [음식명] 하나 주세요."
  ],
  waiting: [],
  great: ["정말 맛있어요.", "잘 먹었습니다. 또 올게요."],
  warm: ["잘 먹었습니다.", "따뜻하게 잘 먹고 갑니다."],
  soft: ["조금 아쉽지만 잘 먹었습니다.", "정성이 느껴져서 좋았어요."],
  departure: ["잘 먹었습니다.", "다음에 또 올게요."]
};

// 특별 손님이 완전한 달빛 조각을 건넬 때 중앙 연출에 사용하는 실제 에셋입니다.
// 조각 ID와 파일을 한곳에서 연결해 이후 에셋을 교체해도 대본은 건드리지 않습니다.
const STORY_FRAGMENT_ASSETS = Object.freeze({
  first_raindrop: "assets/customer/Special/MoonPiece/01_raindrop_glass_keepsake.webp",
  remaining_warmth: "assets/customer/Special/MoonPiece/02_miniature_lantern.webp",
  two_half_names: "assets/customer/Special/MoonPiece/03_two_shadows_ornament.webp",
  undelivered_letter: "assets/customer/Special/MoonPiece/04_letter_and_crow_feather.webp",
  golden_salt: "assets/customer/Special/MoonPiece/05_constellation_pendant.webp",
  eastern_scale: "assets/customer/Special/MoonPiece/06_wave_and_fish_frame.webp",
  stopped_minute_hand: "assets/customer/Special/MoonPiece/07_stopped_pocket_watch.webp",
  daeuns_tomorrow: "assets/customer/Special/MoonPiece/08_faceless_daeun_ribbon.webp"
});

// "맛있다"에서 받는 부분 달빛 조각입니다. 최종 손님은 맛있다 결과로 조각을
// 주지 않으므로 G1~G7만 연결합니다. 완전한 조각과 섞이지 않도록 별도 맵으로
// 관리하며, 파일명의 g1~g7은 특별 손님 등장 순서와 같습니다.
const STORY_PARTIAL_FRAGMENT_ASSETS = Object.freeze({
  first_raindrop: "assets/customer/Special/MoonPiece/g1_rain_drop_fragment.png",
  remaining_warmth: "assets/customer/Special/MoonPiece/g2_lantern_flame_fragment.png",
  two_half_names: "assets/customer/Special/MoonPiece/g3_joined_shadows_fragment.png",
  undelivered_letter: "assets/customer/Special/MoonPiece/g4_sealed_letter_fragment.png",
  golden_salt: "assets/customer/Special/MoonPiece/g5_constellation_fragment.png",
  eastern_scale: "assets/customer/Special/MoonPiece/g6_wave_fish_fragment.png",
  stopped_minute_hand: "assets/customer/Special/MoonPiece/g7_stopped_clock_fragment.png"
});

// 1~7일차 특별 손님이 처음 모습을 드러낼 때만 재생하는 등장 효과음입니다.
// 주문 결과 장면에서는 반복하지 않고, 조리로 넘어갈 때 story.js가 자연스럽게 줄입니다.
const SPECIAL_GUEST_ARRIVAL_AUDIO = Object.freeze({
  1:Object.freeze({name:"story_guest_d1_arrival",gain:.65}),
  2:Object.freeze({name:"story_guest_d2_arrival",gain:.65}),
  3:Object.freeze({name:"story_guest_d3_arrival",gain:.65}),
  4:Object.freeze({name:"story_guest_d4_arrival",gain:.65}),
  5:Object.freeze({name:"story_guest_d5_arrival",gain:.65}),
  6:Object.freeze({name:"story_guest_d6_arrival",gain:.65}),
  7:Object.freeze({name:"story_guest_d7_arrival",gain:.65})
});

const REGULAR_GUEST_BUBBLES = {};

// 특별 손님이 이번 진행에서 처음 등장할 때 사용하는 짧은 말풍선입니다.
// 재방문 말풍선과 분리해 첫 만남에서 "오늘도" 같은 표현이 나오지 않게 합니다.
const FIRST_SPECIAL_GUEST_BUBBLES = Object.freeze({
  rainyChild: "여기서 잠깐 비를 피해도 돼요?",
  lanternGuest: "이곳에는 아직 온기가 남아 있군요.",
  twinShadows: "여기가 우리가 찾던 식탁일까?",
  crowCourier: "잠시 쉬어 가도 되겠습니까?",
  starBeast: "여긴 너무 밝지 않지?",
  seawaterGuest: "육지의 식탁은 오랜만입니다.",
  schoolDoll: "여기 시계는 아직 움직이나요?",
  facelessDaeun: "내 자리도 아직 남아 있네."
});

const STORY_MENU_RULES = Object.freeze({
  dishIds: Object.freeze(["oden", "tofu", "kimchi", "skewer", "yakisoba", "shrimpTempura", "tteokbokki", "fries"]),
  selectCount: 5,
  requiredMenus: Object.freeze([]),
  allMenusAvailableFromDayOne: true
});

// 진행용 영업일지에서 보여 주는 조리 기록입니다. 손님의 정답 음식과는 연결하지
// 않고, 현재 구현된 낮 준비와 밤 조리 순서만 플레이어가 다시 찾아볼 수 있게 적습니다.
const STORY_JOURNAL_RECIPES = Object.freeze([
  {
    dishId: "oden",
    ingredients: ["어묵", "무", "대파", "멸치"],
    prepSteps: ["무 썰기", "어묵 썰기", "멸치 손질"],
    cookSteps: ["냄비에서 적정 화력을 유지하며 끓이기"]
  },
  {
    dishId: "tofu",
    ingredients: ["두부", "김치", "설탕"],
    prepSteps: ["김치 썰기", "김치와 설탕 볶기"],
    cookSteps: ["두부를 일정한 크기로 썰기", "두부와 볶은 김치를 접시에 담기"]
  },
  {
    dishId: "kimchi",
    ingredients: ["부침가루", "물", "김치"],
    prepSteps: ["김치 썰기", "부침가루 → 물 → 김치 순서로 넣어 반죽 섞기"],
    cookSteps: ["후라이팬에서 앞뒤로 굽기"]
  },
  {
    dishId: "skewer",
    ingredients: ["닭고기", "대파", "양념"],
    prepSteps: ["닭고기 썰기", "대파 썰기", "닭고기와 대파를 순서에 맞춰 꼬치에 꽂기"],
    cookSteps: ["직화구이에서 굽고 뒤집은 뒤 양념 바르기"]
  },
  {
    dishId: "yakisoba",
    ingredients: ["우동면", "양배추", "당근", "간장", "굴소스", "고추기름"],
    prepSteps: ["우동면 불리기", "양배추와 당근 채썰기", "간장 200g → 굴소스 100g → 고추기름 30g 순서로 소스 만들기"],
    cookSteps: ["철판에서 골고루 볶기"]
  },
  {
    dishId: "shrimpTempura",
    ingredients: ["새우", "밀가루", "계란물", "빵가루"],
    prepSteps: ["새우에 밀가루 → 계란물 → 빵가루 순서로 튀김옷 입히기"],
    cookSteps: ["튀김기에서 알맞게 튀긴 뒤 건져 담기"]
  },
  {
    dishId: "tteokbokki",
    ingredients: ["떡", "양배추", "대파", "어묵", "고추장", "올리고당", "간장"],
    prepSteps: ["떡 불리기", "양배추 → 대파 → 어묵 순서로 썰기", "고추장 120g → 올리고당 60g → 간장 30g 순서로 양념장 만들기"],
    cookSteps: ["냄비에서 적정 화력을 유지하며 끓이기"]
  },
  {
    dishId: "fries",
    ingredients: ["감자", "튀김가루", "식용유"],
    prepSteps: ["감자 채썰기", "봉투를 흔들어 튀김가루 골고루 묻히기"],
    cookSteps: ["튀김기에서 알맞게 튀긴 뒤 건져 담기"]
  }
].map(recipe=>Object.freeze({
  ...recipe,
  ingredients:Object.freeze(recipe.ingredients),
  prepSteps:Object.freeze(recipe.prepSteps),
  cookSteps:Object.freeze(recipe.cookSteps)
})));

const STORY_GENERAL_ORDERS_BY_DAY = Object.freeze({
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 4,
  6: 7,
  7: 5
});

// 공용 음식 평가를 이야기의 아쉽다/맛있다/완벽 세 단계로 변환합니다.
const STORY_SCORE_THRESHOLDS = Object.freeze({
  warm: COOKING_SCORE_RULE.tastyMin,
  great: COOKING_SCORE_RULE.perfect
});

// 특별 손님을 실제로 만난 뒤 날짜별 기록을 채울 때와 타이틀 영구
// 컬렉션을 만들 때 쓰는 메타데이터입니다. 진행 영업일지의 미래 목차로는
// 직접 노출하지 않습니다.
const GAMEPLAY_JOURNAL_PAGE_DEFS = Object.freeze([
  {
    guestId: "rainyChild", title: "1일차 — 비에 젖은 아이", dayLabel: "1일차",
    appearanceCondition: "1일차 밤 · 일반 손님 1명 응대 후", displayName: "비에 젖은 아이",
    portraitRow: 0, trace: "젖은 우비와 창가 자리에 남은 빗물",
    dishId: "kimchi", dishName: "김치전",
    clue: "비 오는 날 팬 위에서 둥글게 부쳐 먹던 붉은 음식. 빗소리보다 먼저 지글거렸다.",
    preferredStyle: "빗소리가 묻힐 만큼 고르게 익힌 따뜻한 김치전",
    storyByLevel: {
      1: "찾던 음식이 김치전이라는 사실을 확인했지만 기억은 아직 열리지 않았다.",
      2: "누군가와 비를 기다리며 김치전을 나누었고, 비가 그치면 그 사람도 떠날까 두려워했다.",
      3: "모두가 떠날까 두려워 달빛 한 조각을 빗속에 붙잡아 두었다."
    },
    completedStory: "모두가 떠날까 두려워 달빛 한 조각을 빗속에 붙잡아 두었다.",
    shardId: "first_raindrop", shardName: "첫 빗방울",
    epilogue: "비가 그친 뒤에도 함께 먹었던 기억을 품고 자기 아침으로 걸어갔다."
  },
  {
    guestId: "lanternGuest", title: "2일차 — 등불을 머리에 인 손님", dayLabel: "2일차",
    appearanceCondition: "2일차 밤 · 영업 시작 직후", displayName: "등불을 머리에 인 손님",
    portraitRow: 1, trace: "머리 대신 달린 낡은 종이등과 테이블에 남은 온기",
    dishId: "oden", dishName: "어묵탕",
    clue: "나무꼬치에 꿰인 긴 재료가 따뜻한 국물에 잠긴 음식.",
    preferredStyle: "두 손으로 그릇을 감싸면 손끝까지 따뜻해지는 어묵탕",
    storyByLevel: {
      1: "찾던 음식이 어묵탕이라는 사실을 확인했지만 기억의 온기에는 닿지 못했다.",
      2: "밤길의 사람들을 집으로 돌려보내던 존재였지만 자신의 귀환지는 기억하지 못했다.",
      3: "모두를 보내고 혼자 남는 것이 두려워 등불 안에 달빛 조각을 붙잡았다."
    },
    completedStory: "모두를 보내고 혼자 남는 것이 두려워 등불 안에 달빛 조각을 붙잡았다.",
    shardId: "remaining_warmth", shardName: "남은 온기",
    epilogue: "남의 길만 비추던 등불은 이제 자신의 돌아갈 곳을 찾아 걷기 시작했다."
  },
  {
    guestId: "twinShadows", title: "3일차 — 둘이 붙은 그림자", dayLabel: "3일차",
    appearanceCondition: "3일차 밤 · 일반 손님 2명 응대 후", displayName: "둘이 붙은 그림자",
    portraitRow: 2, trace: "한 사람처럼 붙은 모습과 바닥에 따로 드리운 두 그림자",
    dishId: "tofu", dishName: "두부김치",
    clue: "부드러운 흰 음식과 뜨거운 붉은 음식이 한 접시에 함께 놓인 메뉴.",
    preferredStyle: "흰 두부와 뜨거운 김치가 한 접시에서 선명하게 어우러진 두부김치",
    storyByLevel: {
      1: "둘이 찾던 음식이 같은 두부김치라는 사실을 확인했다.",
      2: "한 사람의 서로 다른 선택으로, 하나는 떠나고 다른 하나는 남고 싶어 했다.",
      3: "선택하지 않은 가능성도 자신의 일부임을 받아들였다."
    },
    completedStory: "떠남과 남음이라는 서로 다른 선택을 모두 자신의 일부로 받아들였다.",
    shardId: "two_half_names", shardName: "반쪽 이름 두 개",
    epilogue: "두 그림자는 어느 쪽도 지우지 않은 채 같은 방향으로 첫걸음을 내디뎠다."
  },
  {
    guestId: "crowCourier", title: "4일차 — 까마귀 우편배달부", dayLabel: "4일차",
    appearanceCondition: "4일차 밤 · 일반 손님 3명 응대 후", displayName: "까마귀 우편배달부",
    portraitRow: 3, trace: "검은 외투와 가방 속에 남은 배달되지 않은 편지",
    dishId: "skewer", dishName: "닭꼬치",
    clue: "불에 구운 작은 조각들이 꼬치에 차례로 꿰인 음식.",
    preferredStyle: "한 손에 들고 걸으면서 먹을 수 있도록 불향을 입힌 닭꼬치",
    storyByLevel: {
      1: "찾던 음식이 닭꼬치라는 사실을 확인했지만 편지를 놓지 못했다.",
      2: "편지를 전하면 누군가 떠날까 두려워 마지막 배달을 계속 미뤘다.",
      3: "배달을 미룬 일이 상대의 내일까지 멈추게 했음을 인정했다."
    },
    completedStory: "이별이 두려워 마지막 편지를 미뤘고, 그것이 상대의 내일까지 멈추게 했음을 인정했다.",
    shardId: "undelivered_letter", shardName: "배달되지 못한 편지",
    epilogue: "오래 품고 있던 편지를 마침내 받을 사람에게 전하러 떠났다."
  },
  {
    guestId: "starBeast", title: "5일차 — 별을 먹는 작은 짐승", dayLabel: "5일차",
    appearanceCondition: "5일차 밤 · 일반 손님 3명 응대 후", displayName: "별을 먹는 작은 짐승",
    portraitRow: 4, trace: "작은 몸 안에서 움직이는 삼킨 별빛",
    dishId: "fries", dishName: "감자튀김",
    clue: "손으로 집어 먹는 길고 노란 음식. 먹고 나면 손끝에 소금이 반짝였다.",
    preferredStyle: "금빛으로 바삭하고 손끝에 소금이 살짝 남는 감자튀김",
    storyByLevel: {
      1: "찾던 음식이 감자튀김이라는 사실을 확인했지만 몸속 별빛은 그대로였다.",
      2: "밝아지면 모두가 자신을 볼까 두려워 새벽을 알리는 가장 밝은 별을 삼켰다.",
      3: "두려웠던 것은 아침이 아니라 빛 속의 시선이었음을 인정하고 별을 돌려주었다."
    },
    completedStory: "빛 속의 시선이 두려워 가장 밝은 별을 삼켰지만, 자신을 숨기지 않고 별을 돌려주었다.",
    shardId: "golden_salt", shardName: "금빛 소금",
    epilogue: "별을 하늘에 돌려준 뒤에도 밝은 곳에서 사라지지 않는 법을 배워 갔다."
  },
  {
    guestId: "seawaterGuest", title: "6일차 — 바닷물로 된 손님", dayLabel: "6일차",
    appearanceCondition: "6일차 밤 · 일반 손님 7명 응대 후", displayName: "바닷물로 된 손님",
    portraitRow: 5, trace: "사람 형태의 몸 안에서 움직이는 작은 파도와 물고기",
    dishId: "shrimpTempura", dishName: "새우튀김",
    clue: "뜨거운 기름을 지나 겉은 바삭해지고 속에서는 바다 냄새가 나는 음식.",
    preferredStyle: "겉은 바삭하고 속의 새우는 촉촉하게 남은 새우튀김",
    storyByLevel: {
      1: "찾던 음식이 새우튀김이라는 사실을 확인했지만 자신의 이름은 떠올리지 못했다.",
      2: "동쪽 바다로 돌아가면 육지에서 불리던 이름을 잃을까 두려워했다.",
      3: "멈춘 이름을 남기는 대신 변해 가는 자신으로 돌아가기로 했다."
    },
    completedStory: "이름이 달라질까 두려워했지만, 멈춰 있기보다 변해 가는 자신으로 동쪽 바다에 돌아가기로 했다.",
    shardId: "eastern_scale", shardName: "동쪽의 비늘",
    epilogue: "동쪽 바다로 돌아가 이름이 달라져도 달빛식탁의 기억을 간직했다."
  },
  {
    guestId: "schoolDoll", title: "7일차 — 멈춰버린 교복 인형", dayLabel: "7일차",
    appearanceCondition: "7일차 밤 · 영업 시작 직후", displayName: "멈춰버린 교복 인형",
    portraitRow: 6, trace: "나무와 천으로 된 피부, 4시 44분에 멈춘 벽시계",
    dishId: "tteokbokki", dishName: "떡볶이",
    clue: "방과 후 종이컵에 담아 먹던 붉고 맵고 말랑한 음식.",
    preferredStyle: "종이컵의 방과 후를 떠올릴 만큼 맵고 말랑한 떡볶이",
    storyByLevel: {
      1: "찾던 음식이 떡볶이라는 사실을 확인했지만 시계는 움직이지 않았다.",
      2: "졸업 뒤 무엇을 해야 할지 몰라 가장 행복했던 방과 후에 자신을 멈췄다.",
      3: "틀리지 않으려고 멈추면 맞을 기회도 없다는 사실을 받아들였다."
    },
    completedStory: "졸업 뒤의 선택이 두려워 방과 후에 멈췄지만, 틀릴 가능성까지 품고 다음으로 가기로 했다.",
    shardId: "stopped_minute_hand", shardName: "멈춘 분침",
    epilogue: "4시 44분에 멈췄던 분침과 함께 자신의 시간도 다시 움직이기 시작했다."
  },
  {
    guestId: "facelessDaeun", title: "마지막 예약 — 얼굴 없는 김다은", dayLabel: "마지막 예약",
    appearanceCondition: "7일차 폐점 후 · 현재 회차 기본 손님 7명의 완전한 달빛 조각을 모두 획득", displayName: "얼굴 없는 김다은",
    portraitRow: 7, trace: "김다은과 같은 옷, 비어 있는 얼굴과 장부에 남은 자신의 필체",
    dishId: "yakisoba", dishName: "볶음우동",
    clue: "야근 중 팬 하나에 급히 볶아 동료들과 나누어 먹던 굵은 면 요리.",
    preferredStyle: "팬에서 고르게 볶아 동료들과 나누던 때의 온기가 남은 볶음우동",
    storyByLevel: {
      1: "찾던 음식이 볶음우동이라는 사실을 확인했지만 얼굴은 생기지 않았다.",
      2: "입사 첫해 동료들과 볶음우동을 나누며 먹는 사람의 표정을 직접 보았던 기억을 되찾았다.",
      3: "자신이 김다은이 포기한 내일이며, 새벽으로 가는 길을 닫은 것은 다은의 소원이었음을 밝혔다."
    },
    completedStory: "김다은이 포기한 내일이었다. 다은은 자신이 닫은 내일로 가는 문을 알아보고, 이 밤을 어떻게 끝낼지 스스로 선택하기로 했다.",
    shardId: "daeuns_tomorrow", shardName: "김다은의 내일",
    epilogue: "다은은 아직 정하지 못한 내일도 없애지 않고 현실의 아침에서 다시 생각하기로 했다."
  }
].map(page=>Object.freeze({...page,storyByLevel:Object.freeze({...page.storyByLevel})})));

const TITLE_JOURNAL_GUEST_DEFS = GAMEPLAY_JOURNAL_PAGE_DEFS;
const TITLE_JOURNAL_ENDING_DEFS = Object.freeze([
  {id:"loop_return",number:1,title:"다시 첫째 날",summary:"달빛 조각이 네 개에 닿지 못해 내일로 가는 문이 열리지 않고 시간이 첫째 날로 돌아갔다.",lastLine:"이번에는 손님의 마음을 얻어보도록 노력하자."},
  {id:"alone_morning",number:2,title:"혼자 맞은 아침",summary:"다은만 현실의 아침으로 돌아가고 달빛을 돌려받지 못한 손님들은 식당에 남았다.",lastLine:"나는 나왔지만… 그 밤은 아직 끝나지 않았어."},
  {id:"guests_dawn",number:3,title:"손님들의 새벽",summary:"달빛을 손님들에게 돌려보내 각자의 아침으로 보내고 다은은 식당에 남았다.",lastLine:"남은 손님들이 자기 길을 찾을 때까지, 나는 여기 있을게."},
  {id:"open_forever",number:4,title:"영원히 영업 중",summary:"다은은 달빛을 식탁에 붙잡아 두고 달빛식탁의 새 주인이 되었다.",lastLine:"오늘도 새벽은 오지 않습니다."},
  {id:"morning_together",number:5,title:"함께 오는 아침",summary:"여덟 달빛 조각을 모두의 길로 이어 다은과 손님들이 함께 현실의 아침을 맞았다.",lastLine:"오늘의 메뉴는 내일 정합니다."}
].map(ending=>Object.freeze(ending)));

const storyNarration = text => ({ kind: "direction", text });
const storyLine = (speaker, text, extra = {}) => ({ speaker, text, ...extra });
const storyCaption = (speakerLabel, text, extra = {}) => ({ speakerLabel, text, ...extra });

function createSpecialGuestArc(config) {
  const prefix = `SCN-G${config.number}`;
  const resultIds = Object.freeze({
    soft: `${prefix}-아쉽다`,
    warm: `${prefix}-맛있다`,
    great: `${prefix}-완벽`
  });
  const arrivalId = `${prefix}-A`;
  const missingId = `${prefix}-B`;
  const arrivalAudio = SPECIAL_GUEST_ARRIVAL_AUDIO[config.number]||null;
  const common = {
    day: config.day,
    timeOfDay: "night",
    character: config.character,
    dishId: config.dishId,
    shardId: config.shardId,
    shardName: config.shardName,
    repeatEachLoop: true,
    // 특별 손님은 밤 영업 BGM을 기본으로 사용하고 필요한 손님만 전용곡으로 바꿉니다.
    storyBgm:config.storyBgm||"night",
    ...(config.storyBgmCrossfade?{storyBgmCrossfade:config.storyBgmCrossfade}:{}),
    ...(config.storyBgmHoldAfterFinish?{storyBgmHoldAfterFinish:true}:{})
  };
  const resultScene = (tier, label, lines) => {
    const fragmentState = tier === "great"
      ? "full"
      : tier === "warm" && !config.finalShard ? "partial" : "none";
    const fragmentHandoffLines = fragmentState === "none" ? [] : [{
      ...storyNarration(fragmentState === "full"
        ? "손님은 떠나기 전, 환하게 빛나는 달빛 조각을 다은에게 건넨다."
        : "손님은 떠나기 전, 희미하게 빛나는 달빛 조각을 다은에게 건넨다."),
      /* [완전한 조각을 건네는 마지막 대사에서만 컷씬을 깝니다]
         이 줄은 결과 장면의 마지막 대사입니다. 여기서 손님이 조각을 건네는
         원화 한 장이 화면을 채우고, 그 위에 기존 조각 오버레이가 그대로
         뜹니다(컷씬 z-index 1 < 오버레이 3).

         "맛있다"(partial)에는 이 컷을 깔지 않고, 부분 조각 전용 에셋만
         기존 중앙 전달 레이어에 띄웁니다.

         컷 이름은 story-cinematic.js 의 STORY_CUTSCENES 키와 같은 규칙으로
         조각 id 에서 만듭니다. 손으로 짝지으면 여덟 군데에서 어긋날 수
         있고, 이름이 틀려도 컷만 조용히 안 뜹니다. */
      /* hold — 대사창과 조각 오버레이를 올리기 전에 그림만 보여 주고 입력을
         기다립니다. 손님이 조각을 건네는 그 손이 이 장면의 절정이라, 한 번
         누를 때까지 그것만 보게 둡니다. */
      ...(fragmentState === "full"
        ? { cinematic: { cut: `shard_${config.shardId}`, hold: true } }
        : {}),
      fragmentHandoff: {
        shardId: config.shardId,
        shardName: config.shardName,
        state: fragmentState,
        asset: fragmentState === "full"
          ? STORY_FRAGMENT_ASSETS[config.shardId] || null
          : STORY_PARTIAL_FRAGMENT_ASSETS[config.shardId] || null
      }
    }];
    return {
      id: resultIds[tier],
      title: `${config.title} · ${label}`,
      moment: "specialGuestResult",
      sceneType: "specialGuestResult",
      sourceSceneId: arrivalId,
      resultTier: tier,
      preservesUnlockedMemory: true,
      grantsShard: tier === "great",
      uniqueShard: tier === "great",
      finalShard: tier === "great" && !!config.finalShard,
      ...common,
      character: tier === "great" && config.greatCharacter
        ? config.greatCharacter
        : config.character,
      lines: [...lines, ...fragmentHandoffLines]
    };
  };

  return {
    [arrivalId]: {
      id: arrivalId,
      title: `${config.title} · 등장`,
      moment: "specialGuest",
      sceneType: "specialGuestArrival",
      specialGuest: true,
      guestOrder: true,
      specialCook: true,
      requiresDishChoice: true,
      deferUntilArrival: true,
      arrival: config.arrival,
      triggerTiming: config.triggerTiming,
      triggerAfterGeneral: config.triggerAfterGeneral,
      triggerOnNightEnd: !!config.triggerOnNightEnd,
      requiredBaseShards: config.requiredBaseShards || 0,
      missingMenuSceneId: missingId,
      wrongDishSceneId: missingId,
      resultSceneIds: resultIds,
      thresholds: STORY_SCORE_THRESHOLDS,
      ...common,
      ...(arrivalAudio?{
        storyEntrySfx:{name:arrivalAudio.name,gain:arrivalAudio.gain,fadeOut:1200}
      }:{}),
      lines: config.arrivalLines
    },
    [missingId]: {
      id: missingId,
      title: `${config.title} · 다른 음식`,
      moment: "specialGuestMissing",
      sceneType: "specialGuestMissing",
      sourceSceneId: arrivalId,
      missingMenu: true,
      wrongDish: true,
      journalClue: config.journalClue,
      ...common,
      lines: config.missingLines
    },
    [resultIds.soft]: resultScene("soft", "아쉽다", config.softLines),
    [resultIds.warm]: resultScene("warm", "맛있다", config.warmLines),
    [resultIds.great]: resultScene("great", "완벽", config.greatLines)
  };
}

const STORY_SCENES = {
  "SCN-P01": {
    id: "SCN-P01",
    title: "지친 밤 - 퇴근길",
    day: 1,
    moment: "newGame",
    sceneType: "prologue",
    timeOfDay: "night",
    character: "protagonist",
    storyBgm: "storyCompany",
    /* 프롤로그 네 장면(P01~P04)은 아직 회사원 복장입니다. 첫 영업을 시작하겠다고
       마음먹는 SCN-P04 의 마지막 대사까지가 회사원이고, 그 뒤로는 전부 주방
       복장입니다. 주방 복장 원화 대신 회사원 원화를 씁니다
       (story.js STORY_PROTAGONIST_COSTUMES). */
    protagonistCostume: "office",
    nextSceneId: "SCN-P02",
    lines: [
      {
        ...storyNarration("몇 달째 줄어든 인원으로 신제품 일정을 버티던 김다은은 두 사람 몫의 일정과 보고서를 떠안았다.\n퇴근 직전의 수정 지시와 주말 연락이 반복되었고, 원가를 맞추면 상품성이 없다는 평가가, 맛을 살리면 원가가 높다는 지적이 돌아왔다.\n마지막 메뉴도 수차례 수정 끝에 처음 의도와 전혀 다른 상품이 되었다. 다은은 늦은 밤이 되어서야 회사 건물을 나선다."),
        /* [컷씬은 대사 한 줄이 아니라 여기서부터 다음 컷 전까지의 '구간'입니다]
           cinematic 이 없는 대사는 직전 컷을 그대로 이어받습니다. 그래서 컷이
           바뀌는 첫 줄에만 적습니다. 자세한 것은 story-cinematic.js 참고.

           여기부터 "맛은 나쁘지 않아…" 까지 — 야근 중인 사무실. */
        cinematic: { cut: "prologueOffice", hold: true }
      },
      storyLine("recalledBoss", "맛은 나쁘지 않아. 그런데 이걸 사람들이 사서 먹을까?"),
      // 여기부터 장면 끝까지 — 회사를 나와 혼자 걷는 밤 퇴근길.
      { ...storyLine("protagonist", "또 처음부터 바꾸라고 하겠지.", { motion: "sad" }), cinematic: { cut: "prologueCommute", hold: true } },
      storyLine("protagonist", "더 버티면 내가 좋아했던 음식까지 싫어하게 될 것 같아.", { motion: "sad" }),
      storyLine("protagonist", "오늘도 겨우 퇴근이네.", { motion: "sad" }),
      storyLine("protagonist", "그냥 내일이 오지 않았으면 좋겠다.", { motion: "sad" })
    ]
  },

  "SCN-P02": {
    id: "SCN-P02",
    title: "비가 내리는 퇴근길",
    day: 1,
    moment: "newGame",
    sceneType: "prologue",
    timeOfDay: "night",
    character: "protagonist",
    storyBgm: "storyCompany",
    storyAmbient: { name: "story_rain", gain: .42 },
    protagonistCostume: "office",   // SCN-P01 주석 참고
    nextSceneId: "SCN-P03",
    interactionTarget: "restaurantDoor",
    lines: [
      {
        ...storyNarration("다은은 평소처럼 익숙한 퇴근길을 걷는다.\n비 예보는 없었지만 굵은 빗방울이 하나둘 떨어지더니 순식간에 거센 비가 쏟아진다.\n다은은 비를 피할 곳을 찾아 늘 지나던 골목 안쪽으로 뛰어간다."),
        // 여기부터 "갑자기 무슨 비야… 우산도 없는데." 까지 — 비 쏟아지는 골목.
        cinematic: { cut: "prologueRainAlley", hold: true }
      },
      storyLine("protagonist", "갑자기 무슨 비야… 우산도 없는데.", { motion: "angry" }),
      // 여기부터 장면 끝까지 — 달빛식탁을 발견하고 문을 여는 장면.
      { ...storyNarration("고개를 들자 골목 끝에 작은 식당 하나가 보인다.\n매일 지나던 퇴근길인데도 한 번도 본 적 없는 식당이다."), cinematic: { cut: "prologueRainEntry", hold: true } },
      storyLine("protagonist", "저런 식당이 여기 있었나? 일단 비부터 피하자.", { motion: "think" })
    ]
  },

  "SCN-P03": {
    id: "SCN-P03",
    title: "달빛식탁에 갇히다",
    day: 1,
    moment: "newGame",
    sceneType: "prologueInteraction",
    timeOfDay: "night",
    character: "protagonist",
    storyBgm: "storySikdang",
    storyEntrySfx: { name: "story_open_door", gain: .9, delayBgmUntilComplete: true },
    protagonistCostume: "office",   // SCN-P01 주석 참고
    interactionTarget: "journal",
    nextSceneId: "SCN-P04",
    lines: [
      {
        ...storyNarration("식당 안은 따뜻하고 아늑했지만 주인은 보이지 않았다.\n카운터 위에는 「영업일지」라고 적힌 낡은 장부 한 권만 놓여 있었다."),
        /* 이 장면은 처음부터 끝까지 한 컷입니다. 나갔다 다시 들어오는 뒤쪽
           대사도 같은 가게 안이라 컷이 바뀌지 않습니다. hold 라서 그림이 먼저
           한 번 뜨고, 스페이스바나 클릭 한 번에 대사창이 올라옵니다. */
        cinematic: { cut: "prologueEmptyRestaurant", hold: true }
      },
      storyLine("protagonist", "아무도 없나…?", { motion: "think" }),
      storyNarration("다은은 들어왔던 문을 다시 열고 빗속으로 발을 내딛는다.\n그러나 다음 발을 딛는 순간, 다은은 다시 식당 안에 서 있다."),
      storyLine("protagonist", "분명 밖으로 나갔는데 왜 다시 안으로 들어온 거야?", { motion: "think" }),
      storyLine("protagonist", "나 여기 갇힌건가??", { motion: "sad", repeatInteraction: "exitDoor" })
    ]
  },

  "SCN-P04": {
    id: "SCN-P04",
    title: "영업일지의 규칙",
    day: 1,
    moment: "newGame",
    sceneType: "prologueInteraction",
    timeOfDay: "night",
    character: "protagonist",
    storyBgm: "storySikdang",
    // 회사원 복장의 마지막 장면입니다. SCN-P01 주석 참고
    protagonistCostume: "office",
    completesPrologue: true,
    lines: [
      {
        ...storyNarration("다은은 다른 출구를 찾기 위해 식당을 둘러본다.\n그때 카운터 위에 있던 영업일지가 눈에 들어와 펼쳐본다."),
        /* 자막보다 먼저 영업일지 한 권이 흰빛과 함께 떠오릅니다. "눈에 들어와"
           가 성립하려면 그림을 보고 나서 그 문장을 읽어야 합니다.
           소품과 빛 색은 story-prop-reveal.js 의 STORY_PROPS 에 있습니다.
           ⚠️ 영업일지 UI(openJournalOnAdvance)를 여는 것과는 다른 일입니다.
              이건 그림 한 장이고, 책은 이 자막을 다 읽고 눌러야 펼쳐집니다. */
        propReveal: { prop: "businessJournalClosed" },
        openJournalOnAdvance: true,
        /* 첫 회차에서 처음 펼치는 장부입니다. 규칙을 모르는 채로 덮어 버리면
           바로 다음 대사("첫 장은 주의사항이고…")가 읽지도 않은 이야기를 하게
           되므로, 주의사항 구역을 다 펼치기 전에는 닫기 버튼을 딤드로 잠급니다.
           (레시피·일기 장은 잠금에 넣지 않습니다 — title.js 참고)
           2회차부터는 이미 아는 규칙이라 잠그지 않습니다. */
        journalRequiredReading: true
      },
      storyLine("protagonist", "앞에 두 장은 주의사항이고, 다음 여덟 장은 요리 레시피… 나머지 일곱 장은 빈 종이네?", { motion: "think" }),
      storyLine("protagonist", "여기서 나가려면 달빛 조각을 모아 내일로 가는 문을 열어야 한다는 거네.", { motion: "sad" }),
      storyLine("protagonist", "누가 올지도, 무슨 음식을 찾을지도 알 수 없어. 그래도 가만히 갇혀 있을 수는 없지.", { motion: "resolve" }),
      { ...storyNarration("영업일지를 덮는 순간 책장 사이로 새하얀 달빛이 번진다.\n창밖의 빗소리가 멎는다. 햇빛이 들어찬다."), timeOfDay: "day" },
      { ...storyLine("protagonist", "방금까지 한밤중이었는데… 갑자기 낮이 됐어?", { motion: "think" }), timeOfDay: "day" },
      /* 회사원 김다은은 아직 지쳐 있는 인물이라 resolve(주먹+불꽃)처럼 밝은 동작은
         쓰지 않습니다. 마지못한 결심이라 담담한 calm 으로 둡니다. */
      { ...storyLine("protagonist", "우선 다섯 가지를 골라서 첫 영업을 시작해 보자.", { motion: "calm" }), timeOfDay: "day" }
    ]
  },

  "SCN-P05": {
    id: "SCN-P05",
    title: "영업 준비",
    day: 1,
    moment: "dayStart",
    sceneType: "phaseTransition",
    transitionOnly: true,
    storyBgm: "day",
    storyBgmCrossfade: 1700,
    lines: []
  },

  "SCN-L01": {
    id: "SCN-L01",
    title: "회귀 후 첫째 날 - 영업일지 확인",
    day: 1,
    moment: "dayStart",
    sceneType: "loopJournal",
    timeOfDay: "day",
    character: "protagonist",
    minLoop: 2,
    repeatEachLoop: true,
    lines: [
      storyNarration("시간은 첫째 날 낮으로 돌아왔지만 다은은 반복이 일어났다는 사실을 기억한다.\n지난 일곱 밤의 구체적인 장면은 흐릿해졌지만, 확인한 기록은 영업일지에 남아 있다."),
      storyLine("protagonist", "달빛 조각은 사라졌지만 기록은 남아 있어.", { motion: "sad" }),
      storyLine("protagonist", "이번에도 같은 손님들이 같은 날 찾아온다면 다시 모을 수 있을 거야.", { motion: "resolve" }),
      storyLine("protagonist", "손님들은 나를 기억하지 못하겠지? 나만 돌아왔으니까.", { motion: "think" }),
      storyLine("protagonist", "누가 어떤 음식을 찾았는지는 이 장부를 보면 돼.", { motion: "calm", openJournalOnAdvance: true, journalPageId: "gameplay-day-1" })
    ]
  },

  "SCN-L02": {
    id: "SCN-L02",
    title: "메뉴 선택 전 영업일지 참고",
    day: null,
    moment: "dayStart",
    sceneType: "dynamicJournalHint",
    timeOfDay: "day",
    character: "protagonist",
    minLoop: 2,
    repeatEachLoop: true,
    dynamicJournalHint: true,
    journalVariants: {
      clue: [storyLine("protagonist", "이 날에는 손님이 원했던 음식에 대한 단서가 있어. 그 말에 맞는 음식을 준비해 보자.", { motion: "think" })],
      confirmed: [storyLine("protagonist", "지난번엔 음식은 맞았지만 달빛 조각을 얻지 못했어 이번엔 완벽하게 조리해서 조각을 얻어야겠다.", { motion: "resolve" })],
      shard: [storyLine("protagonist", "지난번에 조각을 얻었으니 똑같이 해서 다시 조각을 얻자!", { motion: "resolve" })]
    },
    lines: [storyNarration("다은은 기록이 남아있는지 영업일지를 확인한다.")]
  },

  "SCN-D01": {
    id: "SCN-D01",
    title: "밤 영업 시작",
    day: null,
    moment: "nightStart",
    sceneType: "dailyOpening",
    timeOfDay: "night",
    character: "protagonist",
    repeatEachDay: true,
    lines: [
      storyNarration("간판이 켜지고 달빛식탁의 밤 영업이 시작된다."),
      storyLine("protagonist", "준비는 끝났어. 오늘 영업을 시작하자.", { motion: "cook" })
    ]
  },

  ...createSpecialGuestArc({
    number: 1,
    day: 1,
    title: "비에 젖은 아이",
    character: "rainyChild",
    dishId: "kimchi",
    shardId: "first_raindrop",
    shardName: "첫 빗방울",
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    journalClue: "첫째 날의 아이는 비 오는 날 팬 위에서 둥글게 부쳐 먹던 붉은 음식을 찾았다.",
    arrivalLines: [
      storyNarration("마지막 일반 손님이 식사를 마치고 자리에서 사라진다.\n문이 다시 열리고 젖은 우비의 아이가 오늘의 마지막 손님으로 들어와 다은을 바라본다."),
      storyLine("rainyChild", "비 오는 날 먹는 거 있어요?", { motion: "calm" }),
      storyLine("protagonist", "어떤 음식인데?", { motion: "think" }),
      storyLine("rainyChild", "빗소리보다 먼저 지글거리고, 빨갛고 둥근 거요.", { motion: "think" })
    ],
    missingLines: [
      storyNarration("아이는 다은이 내어 준 음식을 한입 먹고 조용히 고개를 젓는다."),
      storyLine("rainyChild", "이 음식이 아니에요, 그래도 생각해 주셔서 감사합니다.", { motion: "sad" }),
      storyLine("rainyChild", "제가 먹고싶은 음식은 팬 위에서 둥글게 퍼지고, 빗소리처럼 지글거리는 음식이에요", { motion: "think" }),
      storyLine("protagonist", "알겠어. 다음에는 그 소리가 기억나게 하는 음식을 준비해 볼게", { motion: "think" }),
      { kind: "journal", text: "첫째 날의 아이는 비 오는 날 팬 위에서 둥글게 부쳐 먹던 붉은 음식을 찾았다." }
    ],
    softLines: [
      storyNarration("아이는 뜨거운 한입을 조심스럽게 베어 물고 잠시 미소 짓는다.\n곧 지글거리던 소리를 떠올리려는 듯 고개를 기울인다."),
      storyLine("rainyChild", "이 음식은 맞는 것 같은데… 비 오는 날 들었던 소리와는 조금 달라요.", { motion: "cook" }),
      storyLine("protagonist", "김치전은 맞는 거네. 다음에 다시 오면 더 잘 만들어 볼게.", { motion: "cook" }),
      storyLine("protagonist", "'나가기 위해 시작한 영업인데, 저 아이가 웃는 걸 보니 조금 안심된다.'", { motion: "soft" })
    ],
    warmLines: [
      storyNarration("바삭한 가장자리가 부서지는 소리에 아이의 어깨가 가볍게 들썩인다.\n아이는 빗소리를 잊은 듯 따뜻한 김치전을 연달아 먹는다."),
      storyLine("rainyChild", "맞아요. 비 오는 날 누군가랑 같이 먹었어요. 그런데 비가 그치면 그 사람도 떠날 것 같았어요.", { motion: "sad" }),
      storyLine("protagonist", "비가 그쳐도 같이 먹었던 일까지 없어지는 건 아니잖아.", { motion: "soft" }),
      storyLine("protagonist", "'나가기 위해 시작한 영업인데, 저 아이가 웃는 걸 보니 조금 안심된다.'", { motion: "soft" })
    ],
    greatLines: [
      storyNarration("노릇한 가장자리와 촉촉한 속을 번갈아 맛본 아이가 환하게 웃는다.\n빈 접시를 내려놓는 손끝에서 빗물이 맑은 빛으로 반짝인다."),
      storyLine("rainyChild", "이 맛이에요. 비가 그치면 모두 날 두고 갈까 봐 달빛을 빗속에 숨겼어요.", { motion: "happy" }),
      storyLine("protagonist", "그 빛은 이제 식탁에 두자. 비가 그쳐도 네 기억은 남아.", { motion: "soft" }),
      storyLine("protagonist", "'나가기 위해 시작한 영업인데, 저 아이가 웃는 걸 보니 조금 안심된다.'", { motion: "soft" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 2,
    day: 2,
    title: "등불을 머리에 인 손님",
    character: "lanternGuest",
    dishId: "oden",
    shardId: "remaining_warmth",
    shardName: "남은 온기",
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    journalClue: "둘째 날의 등불 손님은 나무꼬치에 꿰인 긴 재료가 따뜻한 국물에 잠긴 음식을 찾았다.",
    arrivalLines: [
      storyNarration("마지막 일반 손님이 나가자 식당 바닥에 길쭉한 불빛이 번진다.\n빛이 모인 자리에는 머리 대신 낡은 종이등을 단 오늘의 마지막 손님이 나타나 있다."),
      storyLine("lanternGuest", "손끝이 따뜻해지는 국물이 있습니까?", { motion: "calm" }),
      storyLine("protagonist", "무슨 국물인지 기억나요?", { motion: "think" }),
      storyLine("lanternGuest", "긴 것들이 국물 안에 잠겨 있었습니다. 길을 떠나기 전에 두 손으로 그릇을 감쌌지요.", { motion: "think" })
    ],
    missingLines: [
      storyNarration("손님은 다은이 내어 준 음식을 천천히 맛보지만 종이등의 불빛은 가늘어진다."),
      storyLine("lanternGuest", "정성은 따뜻하지만, 제가 기억하는 그릇은 아니군요.", { motion: "sad" }),
      storyLine("lanternGuest", "나무꼬치에 꿰인 긴 것들이 따뜻한 국물에 잠겨 있었습니다.", { motion: "think" }),
      storyLine("protagonist", "알겠어요. 다음에는 나무꼬치에 꿰인 긴 재료를 따뜻한 국물에 담은 음식을 준비해 볼게요.", { motion: "think" }),
      { kind: "journal", text: "둘째 날의 등불 손님은 나무꼬치에 꿰인 긴 재료가 따뜻한 국물에 잠긴 음식을 찾았다." }
    ],
    softLines: [
      storyNarration("손님은 그릇을 두 손으로 감싸고 국물을 천천히 삼킨다.\n종이등 안의 불꽃이 잠깐 포근한 빛을 내다가 다시 가늘어진다."),
      storyLine("lanternGuest", "따뜻하군요. 하지만 길을 떠나기 전 받았던 온기에는 아직 닿지 못했습니다.", { motion: "cook" }),
      storyLine("protagonist", "찾던 음식은 맞네요. 다음에 다시 만들어 드릴게요.", { motion: "cook" }),
      storyLine("protagonist", "'손님이 온기를 되찾는 동안, 굳어 있던 내 어깨도 조금 풀린 것 같다.'", { motion: "soft" })
    ],
    warmLines: [
      storyNarration("따뜻한 국물이 목을 타고 내려가자 종이등의 빛이 식탁을 부드럽게 물들인다.\n손님은 그릇을 놓지 않은 채 오래도록 남은 온기를 즐긴다."),
      storyLine("lanternGuest", "이 국물로 많은 사람을 돌려보냈습니다. 그런데 제 길만 기억나지 않는군요.", { motion: "sad" }),
      storyLine("protagonist", "계속 남의 길만 비추느라 자기 길은 못 찾았던 거군요.", { motion: "sad" }),
      storyLine("protagonist", "'손님이 온기를 되찾는 동안, 굳어 있던 내 어깨도 조금 풀린 것 같다.'", { motion: "soft" })
    ],
    greatLines: [
      storyNarration("손님이 어묵과 국물을 남김없이 비우자 종이등이 환하게 밝아진다.\n그 빛은 눈부시기보다 오래 기다린 집의 불빛처럼 따뜻하다."),
      storyLine("lanternGuest", "모두에게 돌아갈 곳이 있었는데, 나만 없었습니다. 그래서 이 빛을 놓지 못했지요.", { motion: "cry" }),
      storyLine("protagonist", "돌아갈 곳이 정해져 있지 않아도, 이제부터 찾을 수 있어요.", { motion: "soft" }),
      storyLine("protagonist", "'손님이 온기를 되찾는 동안, 굳어 있던 내 어깨도 조금 풀린 것 같다.'", { motion: "soft" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 3,
    day: 3,
    title: "둘이 붙은 그림자",
    character: "twinShadows",
    dishId: "tofu",
    shardId: "two_half_names",
    shardName: "반쪽 이름 두 개",
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    journalClue: "셋째 날의 두 그림자는 부드러운 흰 음식과 뜨거운 붉은 음식이 한 접시에 함께 놓인 메뉴를 찾았다.",
    arrivalLines: [
      storyNarration("마지막 일반 손님이 식사를 마치고 자리를 떠난다.\n뒤이어 오늘의 마지막 손님이 들어와 다은을 바라본다. 한 사람처럼 보이지만 바닥에는 그림자가 두 개다."),
      storyLine("leftShadow", "흰 것이 먼저였어.", { motion: "think" }),
      storyLine("rightShadow", "아니야. 붉은 것이 옆에 있었어.", { motion: "angry" }),
      storyLine("twinShadows", "둘이 한 접시에 있던 음식을 주세요.", { motion: "calm" })
    ],
    missingLines: [
      storyNarration("두 그림자는 다은이 내어 준 음식을 번갈아 맛보고 동시에 고개를 젓는다."),
      storyLine("leftShadow", "흰 것이 빠졌어.", { motion: "sad" }),
      storyLine("rightShadow", "붉은 것도 함께 있어야 했어.", { motion: "sad" }),
      storyLine("twinShadows", "흰 것과 붉은 것이 떨어지지 않고 한 접시에 있었어.", { motion: "think" }),
      storyLine("protagonist", "알겠어. 다음에는 흰 것과 붉은 것이 한 접시에 함께 있는 음식을 준비해 볼게.", { motion: "think" }),
      { kind: "journal", text: "셋째 날의 두 그림자는 부드러운 흰 음식과 뜨거운 붉은 음식이 한 접시에 함께 놓인 메뉴를 찾았다." }
    ],
    softLines: [
      storyNarration("두 그림자는 흰 음식과 붉은 음식을 번갈아 한입씩 맛본다.\n잠시 말다툼을 멈추지만 서로 붙은 경계는 그대로다."),
      storyLine("leftShadow", "둘이 함께 있는 음식은 맞아.", { motion: "cook" }),
      storyLine("rightShadow", "하지만 아직 우리를 하나로 떠올리게 하진 못해.", { motion: "sad" }),
      storyLine("protagonist", "둘 다 같은 음식을 기억하는 건 맞네. 다음에 다시 해 볼게.", { motion: "cook" }),
      storyLine("protagonist", "'나도 도망치고 싶은 마음과 그대로 버티려는 마음을 한꺼번에 품고 있었구나.'", { motion: "think" })
    ],
    warmLines: [
      storyNarration("부드러운 흰 음식과 매콤한 붉은 음식이 한입에서 어우러지자 두 그림자가 동시에 웃는다.\n둘의 목소리는 처음으로 다투지 않고 같은 높이로 겹친다."),
      storyLine("leftShadow", "나는 떠나고 싶었어.", { motion: "sad" }),
      storyLine("rightShadow", "나는 남고 싶었어.", { motion: "soft" }),
      storyLine("protagonist", "떠나고 싶은 마음도, 남고 싶은 마음도 둘 다 네 마음이잖아.", { motion: "soft" }),
      storyLine("protagonist", "'나도 도망치고 싶은 마음과 그대로 버티려는 마음을 한꺼번에 품고 있었구나.'", { motion: "think" })
    ],
    greatLines: [
      storyNarration("두 그림자는 서로 다른 순서로 두부김치를 먹다가 마지막 한입을 함께 나눈다.\n접시가 비자 바닥의 두 그림자가 가볍고 선명하게 흔들린다."),
      storyLine("twinShadows", "선택하지 않은 우리도 사라지는 건 아니었어.", { motion: "happy" }),
      storyLine("protagonist", "하나를 고른다고 다른 쪽이 없던 일이 되는 건 아니야.", { motion: "soft" }),
      storyLine("protagonist", "'나도 도망치고 싶은 마음과 그대로 버티려는 마음을 한꺼번에 품고 있었구나.'", { motion: "think" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 4,
    day: 4,
    title: "까마귀 우편배달부",
    character: "crowCourier",
    dishId: "skewer",
    shardId: "undelivered_letter",
    shardName: "배달되지 못한 편지",
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    journalClue: "넷째 날의 배달부는 불에 구운 작은 조각들이 꼬치에 차례로 꿰인 음식을 찾았다.",
    arrivalLines: [
      storyNarration("마지막 일반 손님이 식사를 마치자 검은 외투의 배달부가 오늘의 마지막 손님으로 빈 테이블 곁에 나타나 가방을 고쳐 멘다.\n가방 안에는 배달되지 않은 편지 한 통이 있다."),
      storyLine("crowCourier", "걸으면서 한 손으로 먹을 수 있는 음식이 필요합니다.", { motion: "calm" }),
      storyLine("protagonist", "어떤 모양이었죠?", { motion: "think" }),
      storyLine("crowCourier", "불 냄새가 났고, 작은 조각들이 꼬치에 차례로 꿰여 있었습니다.", { motion: "think" })
    ],
    missingLines: [
      storyNarration("배달부는 다은이 내어 준 음식을 살펴본 뒤 가방을 다시 고쳐 멘다."),
      storyLine("crowCourier", "이 음식으로는 멈춘 발걸음이 떠오르지 않는군요.", { motion: "sad" }),
      storyLine("crowCourier", "불에 그을린 꼬치만 보면 기억날 것 같습니다.", { motion: "think" }),
      storyLine("protagonist", "알겠어요. 다음에는 불에 구운 작은 조각을 꼬치에 꿴 음식을 준비해 볼게요.", { motion: "think" }),
      { kind: "journal", text: "넷째 날의 배달부는 불에 구운 작은 조각들이 꼬치에 차례로 꿰인 음식을 찾았다." }
    ],
    softLines: [
      storyNarration("배달부는 꼬치를 한 손에 들고 급하게 몇 점을 먹는다.\n불향에 굳었던 날개가 잠시 느슨해지지만 편지를 쥔 손에는 힘이 남아 있다."),
      storyLine("crowCourier", "음식은 맞습니다. 하지만 아직 발걸음을 떼기엔 부족하군요.", { motion: "cook" }),
      storyLine("protagonist", "찾던 음식은 맞네요. 그래도 아직 편지를 놓기는 어려운가 봐요.", { motion: "sad" }),
      storyLine("protagonist", "'미뤄 둔 말은 기다리는 사람까지 그 자리에 세워 둘 수 있겠구나.'", { motion: "think" })
    ],
    warmLines: [
      storyNarration("불향 밴 조각을 씹을 때마다 배달부의 검은 깃털이 차분히 가라앉는다.\n그는 오랜 이동 끝에 처음 쉬는 사람처럼 천천히 꼬치를 비운다."),
      storyLine("crowCourier", "이 편지를 전하면 누군가 떠날 것 같았습니다. 그래서 계속 미뤘지요.", { motion: "sad" }),
      storyLine("protagonist", "전하지 않으면 기다리는 사람도 계속 그 자리에 있어요.", { motion: "soft" }),
      storyLine("protagonist", "'미뤄 둔 말은 기다리는 사람까지 그 자리에 세워 둘 수 있겠구나.'", { motion: "think" })
    ],
    greatLines: [
      storyNarration("배달부는 마지막 불향까지 음미하고 만족스러운 듯 부리를 가볍게 다문다.\n빈 꼬치를 내려놓자 편지를 누르던 손끝에서도 힘이 빠진다."),
      storyLine("crowCourier", "제가 미룬 건 배달이 아니라 그 사람의 내일이었습니다.", { motion: "cry" }),
      storyLine("protagonist", "이제는 그 사람이 직접 다음을 정할 수 있게 전해 주세요.", { motion: "soft" }),
      storyLine("protagonist", "'미뤄 둔 말은 기다리는 사람까지 그 자리에 세워 둘 수 있겠구나.'", { motion: "think" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 5,
    day: 5,
    title: "별을 먹는 작은 짐승",
    character: "starBeast",
    dishId: "fries",
    shardId: "golden_salt",
    shardName: "금빛 소금",
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    journalClue: "다섯째 날의 작은 짐승은 손으로 집어 먹는 길고 노란 음식과 손끝에 남는 소금을 기억했다.",
    arrivalLines: [
      storyNarration("마지막 일반 손님이 식사를 마치자 작은 짐승이 오늘의 마지막 손님으로 들어와 가장 그늘진 자리에 웅크린다.\n몸 안에는 삼킨 별빛이 움직인다."),
      storyLine("starBeast", "손으로 집어 먹는 노란 거 있어?", { motion: "calm" }),
      storyLine("protagonist", "더 기억나는 건?", { motion: "think" }),
      storyLine("starBeast", "길쭉했고, 먹고 나면 손끝에 소금이 반짝였어.", { motion: "think" })
    ],
    missingLines: [
      storyNarration("작은 짐승은 다은이 내어 준 음식을 냄새 맡고 한입 베어 물지만 귀를 축 늘어뜨린다.\n몸 안의 별빛도 여전히 웅크려 있다."),
      storyLine("starBeast", "이것도 맛은 있는데, 내가 찾던 건 아니야.", { motion: "sad" }),
      storyLine("starBeast", "길고 노란 조각이 잔뜩 쌓여 있었는데.", { motion: "think" }),
      storyLine("protagonist", "알겠어. 다음에는 손끝에 소금이 남는 길고 노란 음식을 준비해 볼게.", { motion: "think" }),
      { kind: "journal", text: "다섯째 날의 작은 짐승은 손으로 집어 먹는 길고 노란 음식과 손끝에 남는 소금을 기억했다." }
    ],
    softLines: [
      storyNarration("작은 짐승은 노란 조각을 앞발로 집어 바삭 소리가 나게 깨문다.\n귀가 잠시 쫑긋 서지만 몸 안의 별빛은 여전히 웅크려 있다."),
      storyLine("starBeast", "노란 건 맞아. 그런데 내 안의 별은 아직 나오기 싫대.", { motion: "cook" }),
      storyLine("protagonist", "찾던 음식은 맞구나. 다음에 다시 와도 돼.", { motion: "soft" }),
      storyLine("protagonist", "'밝은 곳에서 평가받는 게 두려워 숨고 싶은 마음이라면, 나도 조금은 알아.'", { motion: "soft" })
    ],
    warmLines: [
      storyNarration("소금이 반짝이는 감자튀김을 와삭 깨물자 작은 짐승의 꼬리가 절로 흔들린다.\n몸속 별빛도 기분 좋은 박자에 맞춰 천천히 움직인다."),
      storyLine("starBeast", "밝아지면 모두가 날 볼까 봐 가장 밝은 별을 먹었어.", { motion: "sad" }),
      storyLine("protagonist", "보이는 게 무서워서 숨고 싶었던 거구나.", { motion: "sad" }),
      storyLine("protagonist", "'밝은 곳에서 평가받는 게 두려워 숨고 싶은 마음이라면, 나도 조금은 알아.'", { motion: "soft" })
    ],
    greatLines: [
      storyNarration("작은 짐승은 바삭한 조각을 신나게 먹고 손끝의 소금까지 핥는다.\n배부른 듯 몸을 둥글게 말자 안에 갇혀 있던 별빛이 환하게 번진다."),
      storyLine("starBeast", "무서웠던 건 아침이 아니라 빛 속의 눈들이었어. 이제 별을 돌려줄게.", { motion: "happy" }),
      storyLine("protagonist", "별을 돌려줘도 괜찮아. 밝은 곳에 있어도 네가 사라지는 건 아니야.", { motion: "soft" }),
      storyLine("protagonist", "'밝은 곳에서 평가받는 게 두려워 숨고 싶은 마음이라면, 나도 조금은 알아.'", { motion: "soft" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 6,
    day: 6,
    title: "바닷물로 된 손님",
    character: "seawaterGuest",
    dishId: "shrimpTempura",
    shardId: "eastern_scale",
    shardName: "동쪽의 비늘",
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    journalClue: "여섯째 날의 손님은 뜨거운 기름을 지나 겉은 바삭해지고 속에서는 바다 냄새가 나는 음식을 찾았다.",
    arrivalLines: [
      storyNarration("마지막 일반 손님이 나가자 문 아래로 얕은 물결이 밀려 들어온다.\n사람 형태의 손님 몸 안에서는 작은 파도와 물고기가 움직인다."),
      storyLine("seawaterGuest", "바다에서 온 음식이 있습니까?", { motion: "calm" }),
      storyLine("protagonist", "국물 요리인가요?", { motion: "think" }),
      storyLine("seawaterGuest", "아닙니다. 뜨거운 기름을 지나왔습니다. 겉은 바삭하고 속은 바다 냄새가 나지요.", { motion: "think" })
    ],
    missingLines: [
      storyNarration("손님은 다은이 내어 준 음식을 맛보지만 몸 안의 물결은 방향을 찾지 못한다."),
      storyLine("seawaterGuest", "정성은 느껴집니다만, 이 음식에서는 제 바다가 보이지 않는군요.", { motion: "sad" }),
      storyLine("seawaterGuest", "바삭한 겉과 그 안에 남은 바다 냄새만 기억합니다.", { motion: "think" }),
      storyLine("protagonist", "알겠어요. 다음에는 겉은 바삭하고 속에는 바다 냄새가 남은 음식을 준비해 볼게요.", { motion: "think" }),
      { kind: "journal", text: "여섯째 날의 손님은 뜨거운 기름을 지나 겉은 바삭해지고 속에서는 바다 냄새가 나는 음식을 찾았다." }
    ],
    softLines: [
      storyNarration("손님은 바삭한 튀김옷을 조심스럽게 깨물고 안쪽의 향을 오래 음미한다.\n몸 안의 물결이 잠시 잔잔해지지만 이내 다시 방향을 잃는다."),
      storyLine("seawaterGuest", "찾던 음식은 맞습니다. 하지만 제 이름은 아직 떠오르지 않는군요.", { motion: "cook" }),
      storyLine("protagonist", "다음에 다시 오면 조금 더 기억날지도 몰라요.", { motion: "soft" }),
      storyLine("protagonist", "'어디로 돌아가든 이 식탁에서 나눈 순간까지 없어지는 건 아니겠지.'", { motion: "think" })
    ],
    warmLines: [
      storyNarration("바삭한 소리 뒤로 촉촉한 바다 향이 퍼지자 손님 몸속의 물고기들이 힘차게 헤엄친다.\n손님은 고향의 파도를 만난 듯 편안한 표정으로 접시를 바라본다."),
      storyLine("seawaterGuest", "동쪽으로 돌아가면 이곳에서 불리던 이름을 잃을까 두렵습니다.", { motion: "sad" }),
      storyLine("protagonist", "돌아간다고 여기서 있었던 일까지 없어지지는 않아요.", { motion: "soft" }),
      storyLine("protagonist", "'어디로 돌아가든 이 식탁에서 나눈 순간까지 없어지는 건 아니겠지.'", { motion: "think" })
    ],
    greatLines: [
      storyNarration("손님은 바삭한 튀김과 그 안의 바다 향을 남김없이 즐긴다.\n접시가 비자 몸속에 작은 파도가 일고 물고기들이 반짝이는 비늘을 남긴다."),
      storyLine("seawaterGuest", "멈춘 이름을 남기는 대신, 변해 가는 나로 돌아가겠습니다.", { motion: "resolve" }),
      storyLine("protagonist", "내가 기억할게요. 이름이 달라져도 여기 왔던 당신을요.", { motion: "calm" }),
      storyLine("protagonist", "'어디로 돌아가든 이 식탁에서 나눈 순간까지 없어지는 건 아니겠지.'", { motion: "think" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 7,
    day: 7,
    title: "멈춰버린 교복 인형",
    character: "schoolDoll",
    dishId: "tteokbokki",
    shardId: "stopped_minute_hand",
    shardName: "멈춘 분침",
    arrival: "early",
    triggerTiming: "before",
    triggerAfterGeneral: 0,
    journalClue: "일곱째 날의 교복 인형은 방과 후 종이컵에 담아 먹던 붉고 맵고 말랑한 음식을 찾았다.",
    arrivalLines: [
      storyNarration("영업 준비 완료를 누르는 순간 벽시계가 4시 44분에서 멈추고 멀리서 학교 종소리가 울린다.\n문 앞에는 교복을 입은 소녀가 서 있다. 가까이 보면 피부는 나무와 천으로 만들어져 있다."),
      storyLine("schoolDoll", "학교 끝나고 먹던 게 있어요?", { motion: "calm" }),
      storyLine("protagonist", "무슨 음식인데?", { motion: "think" }),
      storyLine("schoolDoll", "종이컵에 담겨 있었고 빨갛고 매웠어요. 씹으면 말랑했고요.", { motion: "think" })
    ],
    missingLines: [
      storyNarration("인형은 다은이 내어 준 음식을 조심스럽게 맛보지만 벽시계는 움직이지 않는다."),
      storyLine("schoolDoll", "오늘도 4시 44분에 끝나겠네요.", { motion: "sad" }),
      storyLine("schoolDoll", "종이컵 안에서 빨간 소스와 말랑한 조각이 함께 흔들렸어요. 학교가 끝난 뒤에만 먹을 수 있었죠.", { motion: "think" }),
      storyLine("protagonist", "알겠어. 다음에는 빨간 소스와 말랑한 조각이 함께 든 음식을 준비해 볼게.", { motion: "think" }),
      { kind: "journal", text: "일곱째 날의 교복 인형은 방과 후 종이컵에 담아 먹던 붉고 맵고 말랑한 음식을 찾았다." }
    ],
    softLines: [
      storyNarration("인형은 붉은 소스가 묻은 한입을 천천히 씹는다.\n말랑한 식감에 입가가 살짝 올라가지만 벽시계의 초침은 움직이지 않는다."),
      storyLine("schoolDoll", "그때 먹던 음식은 맞는데… 시계가 움직이지 않아요.", { motion: "cook" }),
      storyLine("protagonist", "음식은 찾았는데, 아직 다음으로 갈 마음은 안 난 거구나.", { motion: "sad" }),
      storyLine("protagonist", "'손님들의 시간이 움직이는 걸 보면서도, 나는 이 밤에 계속 머물고 싶어질까?'", { motion: "think" })
    ],
    warmLines: [
      storyNarration("매콤한 소스와 말랑한 떡을 맛본 인형의 뺨에 옅은 온기가 돈다.\n종이컵을 두 손으로 감싸자 멈춘 초침이 작게 떨린다."),
      storyLine("schoolDoll", "졸업하면 뭘 해야 할지 몰랐어요. 그래서 방과 후를 멈췄어요.", { motion: "sad" }),
      storyLine("protagonist", "모르는 채로 가도 돼. 나도 아직 뭘 할지 모르니까.", { motion: "soft" }),
      storyLine("protagonist", "'손님들의 시간이 움직이는 걸 보면서도, 나는 이 밤에 계속 머물고 싶어질까?'", { motion: "think" })
    ],
    greatLines: [
      storyNarration("인형은 방과 후의 맛을 되찾은 듯 떡볶이를 즐겁게 비운다.\n마지막 한입을 삼키는 순간 벽시계가 째깍 소리를 내며 4시 45분으로 넘어간다."),
      storyLine("schoolDoll", "틀리지 않으려고 멈추면, 맞을 기회도 없었네요.", { motion: "soft" }),
      storyLine("protagonist", "맞아. 멈춰 있으면 다음 선택은 생기지 않아. 우리 둘 다 가 보자.", { motion: "resolve" }),
      storyLine("protagonist", "'손님들의 시간이 움직이는 걸 보면서도, 나는 이 밤에 계속 머물고 싶어질까?'", { motion: "think" })
    ]
  }),

  ...createSpecialGuestArc({
    number: 8,
    day: 7,
    title: "최종 예약 손님 - 얼굴 없는 김다은",
    storyBgm: "storyFacelessDaeun",
    storyBgmCrossfade: 1000,
    storyBgmHoldAfterFinish: true,
    character: "facelessDaeun",
    greatCharacter: "anotherDaeun",
    dishId: "yakisoba",
    shardId: "daeuns_tomorrow",
    shardName: "김다은의 내일",
    finalShard: true,
    arrival: "last",
    triggerTiming: "after",
    triggerAfterGeneral: 6,
    triggerOnNightEnd: true,
    requiredBaseShards: 7,
    journalClue: "일곱째 날 폐점 뒤, 다은과 같은 옷을 입은 손님이 야근 중 팬에 볶아 나누어 먹던 굵은 면 요리를 찾았다.",
    arrivalLines: [
      storyNarration("식당의 모든 조명이 꺼진 뒤 주방 위 조명 하나만 다시 켜진다.\n카운터에는 김다은과 같은 옷을 입었지만 얼굴이 없는 손님이 앉아 있다. 장부의 일곱째 날 기록 맨 아래에 「마지막 손님」이라는 문구가 그제야 나타난다."),
      storyLine("facelessDaeun", "굵은 면을 팬 하나에 넣고 급히 볶아 나누어 먹던 음식이 있었지.", { motion: "calm" }),
      storyNarration("그 말을 듣는 순간 오래전 냄새가 스친다.\n입사 첫해 상품 테스트가 끝난 늦은 밤, 남은 우동면을 팬에 볶아 동료들과 나누었던 기억이다."),
      storyLine("facelessDaeun", "그때는 잘 팔릴 음식보다, 앞에 앉은 사람들이 맛있게 먹는지가 더 중요했지.", { motion: "soft" }),
      storyLine("protagonist", "당신은 누구야?", { motion: "think" }),
      storyLine("facelessDaeun", "네가 오지 않기를 바랐던 내일에서 왔어.", { motion: "sad" }),
      storyLine("protagonist", "내가 바라지 않았던 내일에서…?", { motion: "sad" })
    ],
    missingLines: [
      storyNarration("얼굴 없는 손님은 다은이 내어 준 음식을 한입 먹고 접시를 조용히 밀어 놓는다."),
      storyLine("facelessDaeun", "이건 그날 우리가 나눠 먹던 음식이 아니야.", { motion: "sad" }),
      storyLine("facelessDaeun", "굵은 면을 팬 하나에 넣고 급히 볶았어. 이름도 없이 다 같이 나눠 먹던 음식이었지.", { motion: "think" }),
      storyLine("protagonist", "알겠어. 다음에는 굵은 면을 팬에 볶아 함께 나눠 먹던 음식을 준비해 볼게.", { motion: "think" }),
      { kind: "journal", text: "일곱째 날 폐점 뒤, 다은과 같은 옷을 입은 손님이 야근 중 팬에 볶아 나누어 먹던 굵은 면 요리를 찾았다." }
    ],
    softLines: [
      storyNarration("얼굴 없는 손님은 볶음우동을 한 젓가락 먹고 익숙한 향을 확인하듯 잠시 멈춘다.\n따뜻한 면을 삼켜도 비어 있는 얼굴에는 아직 아무 표정도 생기지 않는다."),
      storyLine("facelessDaeun", "이 음식은 맞아. 그런데 아직 네가 만들었던 맛은 아니야.", { motion: "cook" }),
      storyLine("protagonist", "이 음식이 맞다는 건 기억나. 다시 만들어 볼게.", { motion: "cook" }),
      storyLine("protagonist", "'탈출하려고 손님을 받기 시작했는데, 어느새 누군가가 맛있게 먹는 모습을 기다리고 있었어.'", { motion: "soft" })
    ],
    warmLines: [
      storyNarration("볶은 면의 고소한 향이 퍼지자 얼굴 없는 손님의 입가에 희미한 미소가 그려진다.\n손님은 예전의 늦은 밤을 천천히 되짚듯 면을 한 젓가락씩 음미한다."),
      storyLine("facelessDaeun", "입사한 첫해, 이걸 동료들과 나눠 먹었어. 그때는 누가 맛있어하는지 직접 보고 있었지.", { motion: "soft" }),
      storyLine("protagonist", "그때의 나는 결과보다 먹는 사람을 먼저 보고 있었네.", { motion: "sad" }),
      storyLine("protagonist", "'탈출하려고 손님을 받기 시작했는데, 어느새 누군가가 맛있게 먹는 모습을 기다리고 있었어.'", { motion: "soft" })
    ],
    greatLines: [
      storyNarration("얼굴 없는 손님은 윤기 나는 면을 맛있게 먹고 빈 접시를 오래 바라본다.\n다은이 기억하던 동료들의 웃음과 따뜻한 팬의 온기가 식탁 위로 되살아난다."),
      storyLine("facelessDaeun", "나는 김다은. 네가 포기한 내일이야.", { motion: "calm" }),
      storyNarration("그 말을 마치자 비어 있던 얼굴 위로 김다은과 같은 눈과 입이 천천히 나타난다."),
      storyLine("anotherDaeun", "우리가 붙잡은 달빛과 네 소원이 이 밤을 만들었어.", { motion: "soft" }),
      storyLine("protagonist", "내가 닫은 문이라면, 이제 이 밤을 어떻게 끝낼지도 내가 정할게.", { motion: "resolve" }),
      storyLine("anotherDaeun", "아직 무엇을 할지 몰라도, 내일은 올 수 있어.", { motion: "happy" }),
      storyLine("protagonist", "'탈출하려고 손님을 받기 시작했는데, 어느새 누군가가 맛있게 먹는 모습을 기다리고 있었어.'", { motion: "soft" }),
      storyLine("protagonist", "'내일이 두려워 오늘을 반복할지, 그래도 아침을 열지. 이제 선택은 내 몫이다.'", { motion: "resolve" })
    ]
  }),

  "SCN-J01": {
    id: "SCN-J01",
    title: "달빛 조각 0~3개 - 자동 회귀",
    day: 7,
    moment: "nightJudgement",
    sceneType: "endingJudgement",
    timeOfDay: "night",
    character: "protagonist",
    shardRange: [0, 3],
    storyBgm: "endingLoopReturn",
    storyBgmCrossfade: 1500,
    storyBgmHoldAfterFinish: true,
    endingBackground: "assets/story/bg/01_loop_daeun_reenters_restaurant_entrance_v3.png",
    autoLoop: true,
    nextSceneId: "SCN-L01",
    lines: [
      storyNarration("모인 달빛은 식탁 가장자리에서 끊기고 내일로 가는 문까지 닿지 못한다."),
      storyNarration("영업일지에 글이 나타난다.\n「당신은 하나의 길도 만들지 못했습니다. 손님의 마음을 얻어 길을 만드십시오.」"),
      storyLine("protagonist", "이번에는 손님의 마음을 얻어보도록 노력하자.", { motion: "sad" })
    ]
  },

  "SCN-J02": {
    id: "SCN-J02",
    title: "달빛 조각 4~7개 - 둘 중 하나의 길",
    day: 7,
    moment: "nightJudgement",
    sceneType: "endingJudgement",
    timeOfDay: "night",
    character: "protagonist",
    shardRange: [4, 7],
    storyBgm: "storyFacelessDaeun",
    storyBgmCrossfade: 1000,
    lines: [
      storyNarration("모인 달빛은 서로 다른 두 길 중 하나만 밝힐 수 있다.\n한쪽은 다은 한 사람을 현실로 돌려보내는 문이고, 다른 쪽은 특별 손님들을 각자의 새벽으로 돌려보내는 길이다."),
      storyNarration("영업일지 위에 글씨가 드러난다.\n「두 길을 함께 밝힐 수는 없습니다. 어느 쪽에 달빛을 건네시겠습니까?」"),
      storyLine("protagonist", "내일로 가는 문과 손님들이 돌아갈 길… 지금은 둘 중 하나만 선택할 수 있어.", { motion: "think" }),
      {
        prompt: "어느 쪽에 달빛을 건넬까?",
        choices: [
          { text: "내 문을 밝힌다", nextSceneId: "END-01" },
          { text: "손님들의 길을 밝힌다", nextSceneId: "END-02" }
        ]
      }
    ]
  },

  "SCN-J03": {
    id: "SCN-J03",
    title: "달빛 조각 8개 - 완성된 달빛식탁",
    day: 7,
    moment: "nightJudgement",
    sceneType: "endingJudgement",
    timeOfDay: "night",
    character: "protagonist",
    shardRange: [8, 8],
    storyBgm: "storyFacelessDaeun",
    storyBgmCrossfade: 1000,
    lines: [
      storyNarration("여덟 조각이 식탁 위에서 하나의 달빛 길로 이어진다.\n기억을 되찾은 손님들이 각자의 자리에 나타나 마지막 선택을 기다린다."),
      storyNarration("영업일지 위에 글씨가 드러난다.\n「여덟 개의 달빛이 모두 모였습니다. 이 빛을 식탁에 붙잡아 두시겠습니까, 아니면 모두의 길을 하나로 잇겠습니까?」"),
      storyLine("protagonist", "이제 내가 어떤 밤을 남길지 결정해야 해.", { motion: "think" }),
      {
        prompt: "어떤 밤을 남길까?",
        choices: [
          { text: "이 밤을 그대로 붙잡는다", nextSceneId: "END-03" },
          { text: "내일을 모두에게 돌려준다", nextSceneId: "END-04" }
        ]
      }
    ]
  },

  "END-01": {
    id: "END-01",
    title: "엔딩 - 혼자 맞은 아침",
    day: 7,
    moment: "ending",
    sceneType: "ending",
    timeOfDay: "night",
    character: "protagonist",
    ending: true,
    endingId: "alone_morning",
    endingTitle: "혼자 맞은 아침",
    storyBgm: "endingAloneMorning",
    storyBgmCrossfade: 1500,
    storyBgmHoldAfterFinish: true,
    endingBackground: "assets/story/bg/02_morning_alone_loop_restaurant_unified_v7.png",
    continuePolicy: "nextLoop",
    lines: [
      storyNarration("다은은 모은 달빛으로 한 사람이 지나갈 수 있는 내일로 가는 문을 만들고 혼자 현실로 돌아간다.\n조각을 돌려받지 못한 손님들은 식당에 남는다."),
      storyLine("protagonist", "나는 나왔지만… 그 밤은 아직 끝나지 않았어.", { motion: "cry" })
    ]
  },

  "END-02": {
    id: "END-02",
    title: "엔딩 - 손님들의 새벽",
    day: 7,
    moment: "ending",
    sceneType: "ending",
    timeOfDay: "night",
    character: "protagonist",
    ending: true,
    endingId: "guests_dawn",
    endingTitle: "손님들의 새벽",
    storyBgm: "endingGuestsDawn",
    storyBgmCrossfade: 1500,
    storyBgmHoldAfterFinish: true,
    endingBackground: "assets/story/bg/03_guests_dawn_loop_restaurant_unified_v2.png",
    continuePolicy: "nextLoop",
    lines: [
      storyNarration("다은은 달빛 조각을 이용해 손님들이 나아갈 수 있는 길을 밝혀준다.\n손님들은 그 길을 따라 기억을 되찾아 각자의 아침으로 떠나지만 다은은 떠나지 못하고 식당에 남게된다."),
      storyLine("protagonist", "오늘의 식사는 여기까지입니다. 이제 돌아가세요.", { motion: "soft" }),
      storyLine("protagonist", "남은 손님들이 자기 길을 찾을 때까지, 나는 여기 있을게.", { motion: "resolve" })
    ]
  },

  "END-03": {
    id: "END-03",
    title: "엔딩 - 영원히 영업 중",
    day: 7,
    moment: "ending",
    sceneType: "ending",
    timeOfDay: "night",
    character: "protagonist",
    ending: true,
    endingId: "open_forever",
    endingTitle: "영원히 영업 중",
    storyBgm: "endingOpenForever",
    storyBgmCrossfade: 1500,
    storyBgmHoldAfterFinish: true,
    endingBackground: "assets/story/bg/04_eternally_open_trapped_balanced_texture_v9.png",
    continuePolicy: "nextLoop",
    lines: [
      storyNarration("다은은 달빛을 식당에 붙잡아둔다.\n손님들의 기억은 다시 흐려지고 다은은 달빛식탁의 새 주인이 된다."),
      storyLine("protagonist", "어서 오세요.", { motion: "calm" }),
      storyLine("protagonist", "오늘도 새벽은 오지 않습니다.", { motion: "sad" })
    ]
  },

  "END-04": {
    id: "END-04",
    title: "진엔딩 - 함께 오는 아침",
    day: 7,
    moment: "ending",
    sceneType: "ending",
    timeOfDay: "night",
    character: "moonlightTable",
    ending: true,
    trueEnding: true,
    endingId: "morning_together",
    endingTitle: "함께 오는 아침",
    storyBgm: "endingMorningTogether",
    storyBgmCrossfade: 1500,
    storyBgmHoldAfterFinish: true,
    endingBackground: "assets/story/bg/05_morning_together_restaurant_unified_v2.png",
    continuePolicy: "clearRunKeepMeta",
    retryJudgementSceneId: "SCN-J03",
    nextSceneId: "SCN-EPI01",
    lines: [
      storyNarration("다은은 달빛을 독점하거나 포기하지 않고 식탁 위에 돌려놓는다.\n손님들도 붙잡았던 밤을 스스로 놓는다. 여덟 조각은 모두의 길을 잇는 내일로 가는 문이 된다."),
      storyLine("moonlightTable", "내일 무엇을 할지 정했습니까?"),
      storyLine("protagonist", "아니요. 아직 뭘 할지는 모르겠어요.", { motion: "soft" }),
      storyLine("protagonist", "그래도 내일 가서 생각할게요.", { motion: "happy" })
    ]
  },

  "SCN-EPI01": {
    id: "SCN-EPI01",
    title: "비가 그친 아침",
    day: 7,
    moment: "epilogue",
    sceneType: "epilogue",
    timeOfDay: "day",
    character: "protagonist",
    ending: true,
    trueEndingEpilogue: true,
    endingSceneId: "END-04",
    storyBgm: "endingMorningTogether",
    storyBgmHoldAfterFinish: true,
    endingStill: "morningAlley",
    disableContinue: true,
    clearProgressSaves: true,
    keepTitleJournal: true,
    lines: [
      storyNarration("다은이 내일로 가는 문을 통과하면 비가 그친 현실의 아침 골목으로 이어진다.\n휴대전화에는 출근 시간을 알리는 알람과 회사에서 온 메시지가 남아 있다.\n다은이 돌아가야 할 일상은 그대로지만, 내일을 없애고 싶었던 마음까지 그대로인 것은 아니다."),
      storyCaption("김다은(메시지)", "걱정해 줘서 고마워요. 오늘 출근해서 이야기할게요."),
      storyLine("protagonist", "당장 모든 게 달라지지는 않겠지.", { motion: "think" }),
      storyLine("protagonist", "그래도 내일을 없애지는 말자. 바꿀 수 있는 것부터 오늘 생각하면 돼.", { motion: "resolve" }),
      storyLine("menuBack", "오늘의 메뉴는 내일 정합니다.")
    ]
  }
};

// 정적 진입 장면만 이 일정에 둡니다. 특별 손님과 결과·엔딩 장면은
// 아래 STORY_SPECIAL_GUEST_BY_DAY 및 각 장면의 분기 메타데이터로 실행합니다.
const STORY_EVENT_SCHEDULE = {
  newGame: {
    1: ["SCN-P01", "SCN-P02", "SCN-P03", "SCN-P04", "SCN-P05"]
  },
  dayStart: {
    1: ["SCN-L01", "SCN-L02"],
    2: ["SCN-L02"],
    3: ["SCN-L02"],
    4: ["SCN-L02"],
    5: ["SCN-L02"],
    6: ["SCN-L02"],
    7: ["SCN-L02"]
  },
  nightStart: {
    1: ["SCN-D01"],
    2: ["SCN-D01"],
    3: ["SCN-D01"],
    4: ["SCN-D01"],
    5: ["SCN-D01"],
    6: ["SCN-D01"],
    7: ["SCN-D01"]
  },
  nightEnd: {}
};

const STORY_SPECIAL_GUEST_BY_DAY = Object.freeze({
  1: Object.freeze(["SCN-G1-A"]),
  2: Object.freeze(["SCN-G2-A"]),
  3: Object.freeze(["SCN-G3-A"]),
  4: Object.freeze(["SCN-G4-A"]),
  5: Object.freeze(["SCN-G5-A"]),
  6: Object.freeze(["SCN-G6-A"]),
  7: Object.freeze(["SCN-G7-A", "SCN-G8-A"])
});

const STORY_ENDING_RULES = Object.freeze({
  low: Object.freeze({ minShards: 0, maxShards: 3, judgementSceneId: "SCN-J01" }),
  middle: Object.freeze({ minShards: 4, maxShards: 7, judgementSceneId: "SCN-J02" }),
  complete: Object.freeze({ minShards: 8, maxShards: 8, judgementSceneId: "SCN-J03" })
});
