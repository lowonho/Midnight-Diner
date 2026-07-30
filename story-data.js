"use strict";

// 제1장 제작 범위는 프롤로그와 Day 1~7입니다.
// 고유 인물은 김다은, 사장, 박기철, 팀장만 사용합니다.
// TODO(audio-assets): kind가 "sound"인 줄은 임시 화면용 음향 지시문입니다.
// 대응하는 사운드 에셋을 연결할 때 해당 지시문이 대화로 출력되지 않도록 제거합니다.
const STORY_CHARACTERS = {
  protagonist: { name: "김다은", role: "식당 운영자", portraitRow: null, alwaysKnown: true },
  owner: { name: "사장", role: "기존 식당 사장", portraitRow: null, alwaysKnown: true },
  manager: { name: "팀장", role: "식품회사 팀장", portraitRow: null, alwaysKnown: true },
  gicheol: { name: "박기철", role: "택시 기사", portraitRow: 0, alwaysKnown: false }
};

// 첫 주 일반 손님 말풍선 풀. 고유 이름이나 확대 대화 화면 없이 사용합니다.
const GENERAL_GUEST_BUBBLES = {
  arrival: [
    "아직 하세요?",
    "혼자인데 조용한 자리 있을까요?",
    "오늘 가능한 것 중 따뜻한 걸로 주세요.",
    "많이 맵지 않게 해주실 수 있어요?",
    "급하지 않아요. 천천히 주세요.",
    "추천보다 오늘 자신 있는 걸로 주세요."
  ],
  waiting: [
    "급하지 않아요. 천천히 주세요."
  ],
  great: [
    "잘 먹었습니다.",
    "별점 5개 남길게요~",
    "맛있었습니다.",
    "다음에는 다른 것도 먹어볼게요.",
    "또 올게요."
  ],
  warm: [
    "잘 먹었습니다.",
    "맛있었습니다.",
    "다음에는 다른 것도 먹어볼게요.",
    "또 올게요."
  ],
  soft: [
    "맛이 좀 아쉽네요.",
    "별점 2개짜리 음식이었어요.",
    "만족스럽지는 않네요."
  ],
  departure: [
    "잘 먹었습니다.",
    "별점 5개 남길게요~",
    "맛있었습니다.",
    "다음에는 다른 것도 먹어볼게요.",
    "또 올게요."
  ]
};

const REGULAR_GUEST_BUBBLES = {};

const STORY_SCENES = {
  "PR-01": {
    id: "PR-01",
    title: "비를 피한 곳",
    day: 1,
    moment: "newGame",
    character: "gicheol",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    lines: [
      {
        kind: "direction",
        text: "늦게까지 업무를 정리한 김다은은 회사 출입증을 반납하고\n종이 상자 하나를 안은 채 건물을 나온다.",
        cinematic: { id: "pr01Exterior", beat: "exit" }
      },
      {
        speaker: "protagonist",
        text: "(한숨을 쉬며) 끝났네.",
        cinematic: { id: "pr01Exterior", beat: "pause" }
      },
      {
        kind: "direction",
        text: "굵은 비가 갑자기 떨어진다. 우산이 없는 다은은 골목의 작은 식당으로 뛰어든다.\n늦은 시간인데도 가게 안은 많은 손님으로 붐빈다.",
        cinematic: { id: "pr01Exterior", beat: "rainRun" }
      },
      {
        kind: "sound",
        text: "빗소리, 오래된 문종, 겹쳐 들리는 짧은 주문.",
        cinematic: { id: "pr01Exterior", beat: "enter" }
      },
      { kind: "direction", text: "바쁜 와중에 사장은 다은이 들어오는 것을 보고 말한다." },
      { speaker: "owner", text: "마지막 날이라서 그런지 손님이 많아…\n지금 주문하면 오래 걸리는데 괜찮나?" },
      { speaker: "protagonist", text: "아, 저는 잠깐 비만 피하려고..." },
      { speaker: "owner", text: "그럼 저기 빈자리에서 조금 쉬다 가게.\n혹시 주문하고 싶다면 주문하고." },
      { kind: "bubble", speakerLabel: "손님 1", text: "사장님! 여기 어묵탕 주세요." },
      { kind: "bubble", speakerLabel: "손님 2", text: "여기는 김치전 주세요!" },
      { kind: "direction", text: "식당 구석에 자리를 잡은 다은은 사장이 혼자 분주히 주문을 받고 손님과 안부를 나누며 음식을 준비하는 모습을 바라본다.\n식품 개발을 할 때 레시피를 적어 가며 대화 없이 조리만 하던 때와는 사뭇 다른 모습이다." },
      { speaker: "protagonist", text: "사장님 비를 피하게 해주셔서 감사한데\n혹시 도와드릴 게 있을까요?" },
      { speaker: "owner", text: "마음만은 고맙다고 하고 싶지만…" },
      { kind: "direction", text: "사장은 굳은 표정으로 잠시 고민하다 다은의 손을 본다.\n8년 동안 식품 개발을 하며 많은 요리를 해 온 손에는 굳은살이 이리저리 배어 있다." },
      { speaker: "owner", text: "손을 보니 요리 좀 해본 사람 같네. 맞나?" },
      { speaker: "protagonist", text: "식품 개발을 좀 해봤지만…\n가게 주방에서 조리해본 적은 없어요." },
      { speaker: "owner", text: "그럼 레시피를 알려주겠네.\n바쁜 건 맞지만 다치지 않도록 천천히 해.", showGameUI: true },
      { kind: "direction", text: "사장이 앞치마를 건네고 다은은 바로 앞치마를 맨다.", showGameUI: true },
      { kind: "gameplay", text: "주방 안을 직접 이동한다.\n기구에서 멀리 있을 때는 버튼을 숨기고, 가까이 가면 기구 이름과 상호작용 버튼을 표시한다.", showGameUI: true },
      { speaker: "owner", text: "두부김치는 두부를 일정한 크기로 썰고\n접시에 담으면 되네.", showGameUI: true, cook: { dishId: "tofu", tutorial: true, resultKey: "pr01_tofu" } },
      { speaker: "owner", text: "어묵탕은 국물이 맑게 우러나도록\n적당한 불로 끓이면 되네.", showGameUI: true, cook: { dishId: "oden", tutorial: true, resultKey: "pr01_oden" } },
      { speaker: "owner", text: "닭꼬치는 앞면이 노릇하게 익으면 꼬치를 하나씩 뒤집고\n뒷면도 타지 않게 구우면 되네.", showGameUI: true, cook: { dishId: "skewer", tutorial: true, resultKey: "pr01_skewer" } },
      { speaker: "owner", text: "새우튀김은 튀김옷이 노릇해졌을 때 건져서\n바스켓을 가볍게 털어 기름을 빼면 되네.", showGameUI: true, cook: { dishId: "shrimpTempura", tutorial: true, resultKey: "pr01_shrimp_tempura" } },
      { speaker: "owner", text: "볶음우동은 면과 채소, 소스를 철판에 올리고\n뒤집개로 골고루 볶으면 되네.", showGameUI: true, cook: { dishId: "yakisoba", tutorial: true, resultKey: "pr01_yakisoba" } },
      { kind: "direction", text: "한참 요리를 하다 보니 손님들도 대부분 식사를 마치고 사장에게 작별 인사를 하고 나간다.\n빗줄기가 서서히 잦아들 때 택시 기사 한 명이 문을 열고 들어온다." },
      { speaker: "gicheol", text: "사장님, 오늘 마지막 영업이라 하셔서. 늦었지만 왔습니다~" },
      { kind: "direction", text: "택시 기사는 주방에서 일하는 다은을 보고 놀라 사장에게 말을 건다." },
      { speaker: "gicheol", text: "어? 마지막 영업날이라는데 알바생을 들이셨네요??" },
      { speaker: "owner", text: "비 피하겠다고 들어온 손님인데 가게가 바쁜 걸 보고 도와주겠다고 해서…\n초면인데 큰 도움을 줬어." },
      { speaker: "gicheol", text: "어유 사장님이 도움이 됐다고 하실 정도면 꽤나 실력자신데요?\n저도 한 번 맛봐도 되겠습니까? 늘 먹던 김치전 주세요~" },
      { speaker: "owner", text: "김치전은 반죽을 팬에 고르게 펴고\n앞면이 노릇해지면 뒤집어 뒷면까지 익히면 되네.", showGameUI: true, cook: { dishId: "kimchi", tutorial: true, resultKey: "pr01_kimchi" } },
      { kind: "direction", text: "사장은 김치전을 부치는 다은을 말없이 바라본다.\n김치전이 완성되자 접시를 마지막 손님에게 내어 준다." },
      { speaker: "owner", text: "여기 주문한 김치전이네." },
      { kind: "direction", text: "김치전을 맛본 손님은 놀란 표정을 짓는다." },
      { speaker: "gicheol", text: "맛이 꽤나 좋은데요? 사장님 레시피대로 해도 이 맛을 내는 사람 없었는데?\n사장님이 요리하신 거 내준 거 아니죠?" },
      { speaker: "owner", text: "젊은 친구의 실력이 생각보다 대단해." },
      { speaker: "gicheol", text: "사장님! 이런 알바생 있으면 영업 더 하셔도 되는 거 아니에요?" },
      { speaker: "owner", text: "아가씨, 처음으로 주방에서 일해본 느낌이 어떤가?" },
      { kind: "direction", text: "다은은 조금 머뭇거리다 대답한다." },
      { speaker: "protagonist", text: "제가 만든 음식을 맛있게 드셔주시는 분들을 보는 게\n생각보다 즐겁네요." },
      { speaker: "owner", text: "그런가…" },
      { kind: "direction", text: "사장은 마음을 굳힌 듯 다은에게 말한다." }
    ]
  },

  "PR-02": {
    id: "PR-02",
    title: "손님의 마음",
    day: 1,
    moment: "newGame",
    character: "gicheol",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    completesPrologue: true,
    lines: [
      { speaker: "owner", text: "자네, 내 식당을 한 번 맡아주지 않겠나?" },
      { speaker: "protagonist", text: "저, 저는 음식점 운영을 해본 적이 없어요…" },
      { speaker: "owner", text: "실력은 충분하고, 임대료나 재료비는 내가 내주지. 나도 손님을 두고 떠나는 게 영 마음에 걸려서 말이야. 내가 지금 건강해 보여도 꽤나 몸이 상했거든. 의사가 최소 한 달은 쉬라고 해서 말이네." },
      { kind: "direction", text: "다은은 잠깐 고민한다." },
      { speaker: "protagonist", text: "해볼게요. 딱 한 달만 해보겠습니다." },
      { speaker: "owner", text: "좋아. 그렇다면 식당 운영에 대해서는 여기 가게 일지를 참고하게. 나도 가게를 운영하다 헷갈리면 이걸 찾아보거든. 자네도 여기에 이어서 써도 좋을 것 같네." },
      { kind: "direction", text: "다은은 손때 묻은 식당 일지를 넘겨받고 식당 운영에 대해 간단히 배운 뒤 집으로 돌아간다." }
    ]
  },

  "C1-01": {
    id: "C1-01",
    title: "1일차 · 첫날의 기준",
    day: 1,
    moment: "dayStart",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "day",
    lines: [
      { kind: "direction", text: "사장이 떠난 주방. 다은은 식당 일지를 천천히 살펴본다. 낮 준비 화면에는 시간 제한이 없다." },
      { speaker: "protagonist", text: "어젯밤 일이 꿈만 같네." },
      { speaker: "protagonist", text: "일단 여러 메뉴를 준비하는 건 어려울 것 같으니, 식당 일지에 있는 레시피 중 두 개씩 늘려보자." },
      { kind: "direction", text: "다은은 식당 일지를 편다." },
      { speaker: "protagonist", text: "일단 해볼게… 어묵탕과 두부김치. 어렵지 않은 메뉴네?" },
      { kind: "gameplay", text: "오늘 해금된 어묵탕과 두부김치를 모두 준비한다. 준비가 끝나면 ‘영업준비 완료’를 직접 눌러 밤 영업을 시작한다." },
      { kind: "system", text: "인기도 0 · 예상 손님 수 적음" }
    ]
  },

  "C1-01-JOURNAL": {
    id: "C1-01-JOURNAL",
    title: "1일차 · 마감 일지",
    day: 1,
    moment: "nightEnd",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    lines: [
      { kind: "journal", text: "0월 0일 토요일. 식당 운영 1일차. 어제 바빴던 것과는 다르게 손님은 많지 않아 실수 없이 식당을 운영할 수 있었다. 얼떨결에 이어받은 가게, 한 달 동안 내가 할 수 있을까…" },
      { kind: "journal", text: "일지 구석에 ‘손님에게 친절하게’라는 메모가 남겨져 있다." }
    ]
  },

  "G-02": {
    id: "G-02",
    title: "입담이 좋아도 자식과의 대화는 어려운 사람",
    day: 2,
    moment: "nightStart",
    character: "gicheol",
    affinity: 1,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    guestOrder: true,
    dishId: "kimchi",
    arrival: "late",
    deferUntilArrival: true,
    lines: [
      { kind: "direction", text: "장사가 거의 끝나갈 무렵 택시 기사가 문을 열고 들어오며 반갑게 인사한다." },
      { speaker: "gicheol", text: "장사 잘되나 감시하러 왔습니다." },
      { kind: "direction", text: "재치 있는 인사와 유일한 구면의 손님이라 다은도 반갑게 맞이한다." },
      { speaker: "protagonist", text: "하루 만에 단골 행세하시는 거예요?" },
      { speaker: "gicheol", text: "첫 손님이면 창립 멤버 아닙니까? 직급으로 치면 이사쯤 되겠네요." },
      { speaker: "protagonist", text: "이사님, 오늘은 뭘 드시겠어요?" },
      { speaker: "gicheol", text: "그 호칭은 부담스럽고요. 아! 저희 통성명도 하지 않았군요! 박기철이라고 합니다. 택시기사를 하고 있죠.", reveal: "gicheol" },
      { speaker: "protagonist", text: "그렇다면 박 기사님, 오늘의 식사는 어떻게 하실 건가요?" },
      { speaker: "gicheol", text: "오늘은… 오! 오늘도 김치전이 준비되어 있군요? 오늘도 김치전 주시죠!" },
      {
        kind: "gameplay",
        text: "김다은은 김치전을 조리한다. 완성도에 따라 박기철의 반응이 달라진다.",
        orderCook: {
          special: false,
          thresholds: { great: 80, warm: 60 },
          replies: {
            great: "전 사장님이 해주신 맛이랑 똑같네요 앞으로도 자주 오겠습니다!",
            warm: "맛이 조금 아쉽지만 잘 먹었습니다!",
            soft: "맛은 비슷하게 나네요 앞으로를 기대하겠습니다."
          }
        }
      },
      { kind: "direction", text: "식사가 끝나갈 무렵 기철이 휴대전화를 켠다. 화목해 보이는 가족 사진을 물끄러미 바라보다 메신저 창까지 열었던 기철은 한참 고민한 뒤 화면을 끈다." },
      { speaker: "protagonist", text: "연락할 일 있으신가요?" },
      { speaker: "gicheol", text: "꼭 해야 하는 일은 아닌데… 딸에게 연락하려고 했습니다… 사춘기 지나면서 사이가 서먹해져, 이제는 문자 하나 보내기 어렵네요." },
      { speaker: "protagonist", text: "무슨 말을 하고 싶으신데요?" },
      { speaker: "gicheol", text: "그냥 안부요. 그런데 딸과 무슨 얘기를 해야 할지 모르겠어서요. 평소 집에서도 얼굴 보기 힘든데 곧 생일이 가까워져서, 이번 기회에 선물을 하며 다시 친해져 보려는데 어떻게 말을 붙여야 할지 모르겠습니다." },
      {
        prompt: "기철이 딸에게 말을 붙일 방법을 함께 생각한다.",
        choices: [
          {
            text: "안부 한 줄을 먼저 보내 보세요. ‘요즘 잘 지내니’ 같은 말로요.",
            reply: "기철이 ‘잘 지내니. 오늘 네 생각이 났다.’라고 쓰고 전송 버튼을 누른다.",
            speaker: "gicheol",
            affinity: 1
          },
          {
            text: "아내분께 여쭤보는 게 어떠신가요?",
            reply: "기철이 아내에게 연락한다. “나름 잘 지내고 있답니다. 저한테 서운한 것도 없다네요. 이제 제가 직접 물어봐야겠죠.”",
            speaker: "gicheol",
            affinity: 1
          },
          {
            text: "용돈 앞에는 장사 없습니다.",
            reply: "기철이 잠깐 웃는다. “생각해보니 돈을 싫어할 일은 없겠네요. 갑자기 잘해준다고 이상하게 생각하지는 않겠죠?”",
            speaker: "gicheol",
            affinity: 1
          }
        ]
      },
      { speaker: "protagonist", text: "다음번에는 좋은 소식 들고 오세요~" },
      { speaker: "gicheol", text: "밥 먹으러 와서 숙제를 받아 가네요." },
      { speaker: "protagonist", text: "안 해도 혼내지는 않아요." },
      { speaker: "gicheol", text: "그게 더 무서운 선생님인데, 수요일에 검사받으러 오겠습니다 김치전은 덤이고요" },
      { kind: "direction", text: "기철은 계산대에서 자기 이름과 연락처를 영수증에 또박또박 쓴다." },
      { speaker: "gicheol", text: "혹시 택시 타실 일 있으면 연락주세요. 싸게 모시겠습니다." },
      { speaker: "protagonist", text: "조심히 들어가세요~" },
      { kind: "journal", text: "0월 0일 일요일. 식당 운영 2일차. 박기철. 택시 기사. 입담은 좋지만, 딸과의 대화는 어려워 고민하는 좋은 아빠다. 나도 아버지께 연락 한 번 해야겠다." }
    ]
  },

  "C1-D3-JOURNAL": {
    id: "C1-D3-JOURNAL",
    title: "3일차 · 마감 일지",
    day: 3,
    moment: "nightEnd",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    lines: [
      { kind: "journal", text: "0월 0일 월요일. 식당 운영 3일차. 손님들이 맛있게 먹고 가는 모습을 보니 힘이 난다. 문득 음식을 하면서 든 생각. 사장님은 어디서 요리를 하셨길래 이렇게 맛있는 레시피를 가지고 계셨을까? 사장님의 정체가 궁금해지는 하루였다." }
    ]
  },

  "C1-02": {
    id: "C1-02",
    title: "숫자로 남지 않는 것",
    day: 4,
    moment: "nightEnd",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    lines: [
      { kind: "direction", text: "3일차까지의 짧은 기억이 스쳐 지나간다. 4일차 마감 후 준비 음식 일부가 남고, 다은이 수량과 비용을 기록한 뒤 폐기한다." },
      { kind: "system", text: "오늘 남은 준비 음식은 마감 후 폐기했습니다. 폐기된 준비 음식은 재활용할 수 없습니다." },
      { speaker: "protagonist", text: "더 많이 준비하면 손님을 놓치지 않을 줄 알았는데." },
      { kind: "direction", text: "쓰레기통으로 향하던 중 식탁 아래에서 접힌 냅킨을 발견한다." },
      { kind: "system", text: "‘늦은 시간에 따뜻하게 먹었습니다. 다음에 또 올게요.’" },
      { speaker: "protagonist", text: "내일은 음식을 얼마나 준비해야 하려나…" },
      {
        prompt: "5일차 운영 방식을 정한다.",
        choices: [
          {
            text: "내일은 준비량을 조금 줄인다.",
            reply: "폐기 예상량이 줄고 품절 가능성이 조금 높아진다.",
            speaker: "protagonist",
            flag: "day5_reduce_portions",
            notice: "Day 5에는 각 메뉴를 2인분씩 준비합니다."
          },
          {
            text: "손님 수보다 메뉴 폭을 줄인다.",
            reply: "내일 선택할 수 있는 메뉴의 가짓수가 3개로 제한된다.",
            speaker: "protagonist",
            flag: "day5_limit_menus",
            notice: "Day 5에는 최대 3개 메뉴만 선택할 수 있습니다."
          }
        ]
      },
      { kind: "journal", text: "0월 0일 화요일. 식당 운영 4일차. 버린 음식은 분명 손해다. 그렇다고 오늘 남은 것이 손해뿐인 것은 아니었다." }
    ]
  },

  "G-03": {
    id: "G-03",
    title: "다음번이 있는 식사",
    day: 5,
    moment: "nightStart",
    character: "gicheol",
    affinity: 2,
    regular: true,
    specialCook: true,
    timeOfDay: "night",
    guestOrder: true,
    dishId: "kimchi",
    arrival: "early",
    lines: [
      { kind: "direction", text: "기철이 평소보다 일찍 들어와 휴대전화를 내민다. 딸과 나눈 간단한 안부 인사가 담겨 있다." },
      { speaker: "gicheol", text: "답은 왔는데 여기서 또 막혔습니다. 잘 지낸다는데, 이제 무슨 말을 하죠?" },
      { speaker: "protagonist", text: "같이 먹었던 것 중 기억나는 음식은 있어요?" },
      { speaker: "gicheol", text: "김치전을 늘상 같이 먹었는데 애는 바삭한 쪽, 저는 쫄깃한 쪽만 골랐어요. 서로 왜 그 부분을 먹는지 이해하지 못했죠." },
      { speaker: "protagonist", text: "그럼 오늘은 바삭한 김치전 만들어 드릴게요. 서로의 취향을 이해하면 조금 더 대화가 쉬워지지 않을까요?" },
      { kind: "system", text: "특별 조리 제안: 조금 더 어려운 방법을 시도할까요? 결과가 아쉬워도 이야기는 이어집니다." },
      {
        prompt: "박기철의 김치전을 어떻게 조리할까?",
        choices: [
          {
            text: "특별 조리를 준비한다.",
            notice: "불 조절과 두 가지 식감의 완성 타이밍을 따로 맞추는 상급 조리를 시작합니다.",
            orderCook: {
              special: true,
              thresholds: { great: 80 },
              replies: {
                great: "한쪽만 먹으면 아쉽고, 번갈아 먹으니 딱 맞네요. 우리 둘이 식탁에서 이걸로 얼마나 싸웠는지.",
                soft: "바삭한 쪽이 조금 더 갔네요. 그 애는 오히려 이쪽이 좋다고 했을 겁니다. 다음에 직접 물어보죠."
              }
            }
          },
          {
            text: "평소대로 조리한다.",
            notice: "평소 방식으로 김치전을 조리하고 대화를 이어갑니다.",
            orderCook: {
              special: false,
              thresholds: { great: 80 },
              replies: {
                great: "한쪽만 먹으면 아쉽고, 번갈아 먹으니 딱 맞네요. 우리 둘이 식탁에서 이걸로 얼마나 싸웠는지.",
                soft: "바삭한 쪽이 조금 더 갔네요. 그 애는 오히려 이쪽이 좋다고 했을 겁니다. 다음에 직접 물어보죠."
              }
            }
          }
        ]
      },
      { kind: "direction", text: "기철이 접시 사진을 찍고 ‘김치전 먹다 보니 네 생각이 났다. 이번 주말에 같이 밥 먹을래? 너도 성인이 됐으니 술 한잔하자.’라고 쓴다. 손가락이 전송 버튼 위에서 잠시 멈춘다." },
      { speaker: "protagonist", text: "오늘 안 보내도 돼요." },
      { speaker: "gicheol", text: "아니요. 밥은 식기 전에 먹어야 하고, 어떤 말은 더 식기 전에 보내야 합니다." },
      { kind: "sound", text: "메시지 전송음." },
      { kind: "direction", text: "잠시 뒤 답장이 도착한다. 이번 일요일 저녁에 가능하다는 내용이다. 기철이 화면을 두 번 확인하고 휴대전화를 가슴 쪽으로 당긴다." },
      { speaker: "gicheol", text: "다음번이 생겼네." },
      { speaker: "protagonist", text: "약속 장소는 미리 정하세요. 어디로 갈지 헤매지 마시고." },
      { speaker: "gicheol", text: "새 사장님 잔소리는 먼저 있던 사장님보다 많으시네요." },
      { kind: "system", text: "박기철이 첫 단골이 되었습니다." },
      { kind: "system", text: "손님 기록이 열렸습니다." },
      { kind: "journal", text: "0월 0일 수요일. 식당 운영 5일차. 화해는 끝난 장면이 아니라 다음 약속이었다. 기철 씨는 오늘 혼자 식사했지만, 나갈 때는 두 사람이 먹을 시간을 확인하고 있었다." }
    ]
  },

  "C1-03": {
    id: "C1-03",
    title: "익숙해진 손",
    day: 6,
    moment: "nightStart",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    lines: [
      { kind: "direction", text: "낮 준비를 마치고 ‘영업준비 완료’를 누르자, 다은은 자연스럽게 주방을 둘러본다." },
      { speaker: "protagonist", text: "생각보다 가게에 익숙해진 것 같네." },
      { kind: "gameplay", text: "일반 영업 한 차례를 진행한다. 새로운 시스템이나 고유 손님 이벤트는 열리지 않는다. 좋아하는 메뉴와 동선을 편하게 반복해 보는 숨 고르기 구간이다." }
    ]
  },

  "C1-03-JOURNAL": {
    id: "C1-03-JOURNAL",
    title: "6일차 · 마감 일지",
    day: 6,
    moment: "nightEnd",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    lines: [
      { kind: "journal", text: "0월 0일 목요일. 식당 운영 6일차. 손이 먼저 움직인 순간이 있었다. 아직 내 가게라고 부르지는 못했지만, 남의 주방처럼 느껴지지도 않았다." }
    ]
  },

  "C1-04A": {
    id: "C1-04A",
    title: "돌아갈 수 있는 자리 · 낮",
    day: 7,
    moment: "dayStart",
    character: "manager",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "day",
    lines: [
      { kind: "direction", text: "낮 준비 전 팀장에게 메시지가 온다." },
      { kind: "system", text: "‘다은 씨, 잠깐 보는 거 가능할까? 회사 관련해서 전달할 말이 있어. 가능하면 만나서 얘기하고 싶은데.’" },
      { kind: "direction", text: "다은은 잠시 망설이다 ‘팀장님, 제가 지금 식당을 하고 있어서요. 만나려면 찾아오셔야 할 것 같아요.’라고 답하고 식당 위치와 영업 시간을 보낸다." },
      { speaker: "protagonist", text: "갑자기 팀장님이 연락하시다니 무슨 일이지?" },
      { kind: "direction", text: "혼란스러워하던 다은은 이내 생각을 접고 다시 영업 준비를 시작한다." },
      { speaker: "protagonist", text: "에휴, 복잡하니까 오늘 메뉴에는 볶음우동을 넣어야겠다. 음식 볶으면서 복잡한 생각을 날려버려야겠어!" },
      { kind: "gameplay", text: "7일차 영업 준비 메뉴에는 볶음우동이 필수로 들어간다." }
    ]
  },

  "C1-04B": {
    id: "C1-04B",
    title: "돌아갈 수 있는 자리 · 마지막 손님",
    day: 7,
    moment: "nightStart",
    character: "manager",
    affinity: 0,
    regular: false,
    specialCook: true,
    timeOfDay: "night",
    guestOrder: true,
    dishId: "yakisoba",
    arrival: "last",
    deferUntilArrival: true,
    lines: [
      { kind: "sound", text: "마지막 일반 손님이 나간 뒤 문종이 울린다." },
      { kind: "direction", text: "마감 팻말을 뒤집으려던 순간 정장을 입은 팀장이 들어온다. 다은은 손에 든 행주를 내려놓지 못한 채 멈춘다." },
      { speaker: "protagonist", text: "팀장님?" },
      { speaker: "manager", text: "갑자기 연락하고 찾아와서 미안해. 네가 힘들어하던 것도 잘 알고 있었고." },
      { speaker: "protagonist", text: "아뇨. 팀장님은 잘해주셨잖아요. 그냥 제 능력 부족인 거죠." },
      { speaker: "manager", text: "다은 씨 능력은 충분해. 문제는 회사는 돈을 벌어야 하는 집단이라 그런 거지…" },
      { speaker: "manager", text: "그래서 이 식당은 다은 씨 거야?" },
      { speaker: "protagonist", text: "제 거라고 하기에는 애매해요. 한 달만 가게를 해보라고 빌려주신 거라서." },
      { speaker: "manager", text: "한 달 빌린 거라도 사장은 사장이지. 지금부터 팀장이 아니라 손님으로 있어도 될까?" },
      { speaker: "protagonist", text: "주문은 뭘로 하시겠습니까, 손님?" },
      { speaker: "manager", text: "식당하더니 능청스러워졌네. 메뉴가… 오? 볶음우동이 있네? 철판에서 맛있게 볶아줘." },
      {
        kind: "gameplay",
        text: "팀장의 주문은 7일차 마지막 조리다. 볶음우동 특별 난이도로 조리하며 완성도에 따라 팀장의 반응이 달라진다.",
        orderCook: {
          special: true,
          thresholds: { great: 60 },
          replies: {
            great: "괜찮네요. 잘 먹었어요.",
            soft: "맛은 그럭저럭이네요."
          }
        }
      },
      { kind: "direction", text: "팀장이 음식을 천천히 먹는 동안 다은은 가게를 정리하고 팀장의 맞은편에 앉는다." },
      { speaker: "manager", text: "좋은 대접도 받았으니 이제 할 일을 해야겠지…" },
      { speaker: "manager", text: "내가 굳이 얼굴을 보자고 한 이유는…" },
      { speaker: "manager", text: "네 사표 아직 수리 안 됐어. 이번 달 안이라면 복귀할 수 있는 거야. 한 달 쉬고 다시 복귀하는 거지." },
      { speaker: "protagonist", text: "제가 필요한가요?" },
      { speaker: "manager", text: "필요하지. 그렇지만 싫단 사람을 붙잡으러 온 건 아니야. 요리할 때 네 표정이 즐거워 보였거든." },
      {
        prompt: "팀장의 말을 들은 다은이 답한다.",
        choices: [
          {
            text: "돌아갈 수 있다는 말에 놀랐다고 솔직히 말한다.",
            reply: "너같이 능력 있는 사람 흔치 않아.",
            speaker: "manager"
          },
          {
            text: "가게가 생각보다 할 만했다고 말한다.",
            reply: "할 만한 일과 계속하고 싶은 일은 같을 때도, 다를 때도 있어.",
            speaker: "manager"
          },
          {
            text: "아직 아무것도 모르겠다고 말한다.",
            reply: "모르는 채로 일주일을 해낸 것도 정보야. 결론은 아니지만.",
            speaker: "manager"
          }
        ]
      },
      { speaker: "manager", text: "돌아오는 게 실패도 아니고, 남는 게 용기라는 뜻도 아니야. 네가 어디서 뭘 해보고 싶은지만 생각해." },
      { speaker: "protagonist", text: "언제까지 답을 드리면 돼요?" },
      { speaker: "manager", text: "이번 달 내로. 서두르라는 말은 하지 않을게." },
      { kind: "direction", text: "팀장이 계산을 마치고 인사한다." },
      { speaker: "manager", text: "다음에 오면 그때는 정말 손님으로 올게." },
      { speaker: "protagonist", text: "오늘도 손님 아니었어요?" },
      { speaker: "manager", text: "절반쯤은? 반쯤은 팀장으로서 얘기도 했으니까." },
      { kind: "direction", text: "팀장이 나간다. 문이 닫힌 뒤에도 다은은 한동안 멍하니 바라본다." }
    ]
  },

  "C1-END": {
    id: "C1-END",
    title: "식당 불은 아직 켜져 있다",
    day: 7,
    moment: "nightEnd",
    character: "protagonist",
    affinity: 0,
    regular: false,
    specialCook: false,
    timeOfDay: "night",
    ending: true,
    lines: [
      { kind: "direction", text: "다은이 마지막 그릇을 씻고 정산을 끝낸다." },
      { kind: "system", text: "DAY 7 · 영업 종료" },
      { speaker: "protagonist", text: "일주일. 나름 할 만했다." },
      { kind: "direction", text: "다은은 회사 상자를 본다. 아직 정리하지 않은 사원 수첩이 안에 있다. 시선을 돌리면 오늘 쓸 영업 일지가 보인다." },
      { speaker: "protagonist", text: "힘들기만 했다면 돌아갔을 텐데." },
      { speaker: "protagonist", text: "할 만하다는 것과 계속하고 싶다는 건 같은 말일까." },
      { speaker: "protagonist", text: "나는 돌아갈 곳이 있어서 흔들리는 걸까. 돌아오고 싶은 곳이 생겨서 흔들리는 걸까." },
      { kind: "direction", text: "다은은 출입문의 ‘영업 중’ 팻말은 뒤집지만 주방 불은 끄지 않는다. 빈 홀 뒤로 빗소리 없는 골목이 보인다." },
      { kind: "journal", text: "0월 0일 금요일. 식당 운영 7일차. 첫 주가 끝났다. 돌아갈 문이 아직 열려 있다는 말을 들었다. 그런데 오늘 처음으로, 내일도 이 문을 열고 싶은지 생각했다." },
      { kind: "system", text: "제1장 끝 · 식당 불은 아직 켜져 있다" },
      { kind: "system", text: "프롤로그 + 제1장 데모를 완료했습니다." }
    ]
  }
};

const STORY_EVENT_SCHEDULE = {
  newGame: {
    1: ["PR-01", "PR-02"]
  },
  dayStart: {
    1: ["C1-01"],
    7: ["C1-04A"]
  },
  nightStart: {
    2: ["G-02"],
    5: ["G-03"],
    6: ["C1-03"],
    7: ["C1-04B"]
  },
  nightEnd: {
    1: ["C1-01-JOURNAL"],
    3: ["C1-D3-JOURNAL"],
    4: ["C1-02"],
    6: ["C1-03-JOURNAL"],
    7: ["C1-END"]
  }
};

const STORY_SPECIAL_GUEST_BY_DAY = {};
