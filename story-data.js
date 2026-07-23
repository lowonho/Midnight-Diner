const STORY_CHARACTERS = {
  protagonist: { name: '주인공', role: '식당 주인', portraitRow: null, alwaysKnown: true },
  owner: { name: '전 주인', role: '이전 식당 주인', portraitRow: null, alwaysKnown: true },
  manager: { name: '전 팀장', role: '식품회사 전 팀장', portraitRow: null, alwaysKnown: true },
  gicheol: { name: '박기철', role: '야간 택시 기사', portraitRow: 0, alwaysKnown: false },
  seoyoon: { name: '한서윤', role: '응급실 간호사', portraitRow: 1, alwaysKnown: false },
  narae: { name: '최나래', role: '미술 입시를 준비하는 고3', portraitRow: 2, alwaysKnown: false },
  doyoon: { name: '이도윤', role: '소극장 매표원·배우 지망생', portraitRow: 3, alwaysKnown: false },
  miran: { name: '정미란', role: '동네 꽃집 주인', portraitRow: 4, alwaysKnown: false },
  hyejin: { name: '문혜진', role: '학교 급식 조리사', portraitRow: 5, alwaysKnown: false },
  sujin: { name: '박수진', role: '박기철의 딸', portraitRow: 0, alwaysKnown: false }
};

const GENERAL_GUEST_BUBBLES = {
  arrival: [
    '혼자예요.',
    '오늘은 따뜻한 게 먹고 싶네요.',
    '냄새를 따라 들어왔어요.',
    '늦게까지 열어 주셔서 다행이에요.'
  ],
  waiting: [
    '천천히 해 주세요.',
    '기다릴게요.',
    '오늘 가능한 걸로 부탁해요.',
    '좋은 냄새가 나네요.'
  ],
  great: [
    '첫입부터 좋네요.',
    '이거 먹으러 다시 와도 되죠?',
    '오늘 제대로 먹은 기분이에요.',
    '누군가 정성껏 차려 준 맛이에요.'
  ],
  warm: [
    '속이 따뜻해졌어요.',
    '서두르지 않아도 되는 맛이네요.',
    '오늘 하루가 조금 풀리는 것 같아요.',
    '편안한 한 끼였어요.'
  ],
  soft: [
    '잘 먹었습니다.',
    '오늘은 조금 아쉽지만 괜찮아요.',
    '다음에는 다른 것도 먹어 볼게요.',
    '간이 조금 센 것 같아요. 다음엔 더 맛있겠죠.'
  ],
  departure: [
    '다음에 또 올게요.',
    '오늘도 잘 먹었습니다.',
    '조심히 들어가세요, 사장님.',
    '덕분에 든든하게 갑니다.'
  ]
};

const REGULAR_GUEST_BUBBLES = {
  gicheol: '오늘도 미지근한 물부터 부탁합니다.',
  seoyoon: '오늘은 시간을 재지 않고 먹어 볼게요.',
  narae: '오늘 그림은 밥을 먹고 나서 보여 줄게요.',
  doyoon: '공연 끝나고 바로 왔어요. 오늘도 한 자리 있죠?',
  miran: '오늘의 꽃은 두고 왔고, 오늘 먹고 싶은 건 말해 볼게요.',
  hyejin: '오늘 역할은 손님. 잊지 않고 왔습니다.'
};

const STORY_SCENES = {
  'PR-01': {
    id: 'PR-01', title: '비를 피한 곳', day: 1, moment: 'newGame', character: 'gicheol',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '회사를 그만둔 날, 주인공은 갑작스러운 비를 피해 불이 켜진 작은 식당으로 들어간다.' },
      { speaker: 'owner', text: '미안하지만 오늘이 마지막 영업이에요. 남은 재료만 정리하고 있었죠.' },
      { text: '문이 다시 열리고, 비에 젖은 택시 기사가 조심스레 안을 들여다본다.' },
      { speaker: 'gicheol', text: '저, 박기철이라고 합니다. 여기서 늘 늦은 저녁을 먹었는데… 정말 마지막입니까?', reveal: 'gicheol' },
      { speaker: 'owner', text: '마지막 손님이 왔네요. 그런데 내 손이 영 말을 안 들어서.' },
      { speaker: 'protagonist', text: '제가 할 수 있는 만큼이라도 도와볼게요.' }
    ]
  },
  'PR-02': {
    id: 'PR-02', title: '마지막 한 접시', day: 1, moment: 'newGame', character: 'gicheol',
    affinity: 1, regular: false, specialCook: true,
    lines: [
      { text: '전 주인이 곁에서 알려 주는 대로 주인공은 처음으로 불과 칼을 다룬다.' },
      { speaker: 'owner', text: '정답을 맞히려 하지 말고, 지금 먹을 사람을 보세요.' },
      { prompt: '기철의 지친 표정을 보고 마지막 손질을 고른다.', choices: [
        { text: '따뜻함을 오래 남긴다', reply: '오늘 제대로 먹은 건 이게 처음이네요.', speaker: 'gicheol', affinity: 1 },
        { text: '부담 없이 담백하게 마무리한다', reply: '늦은 밤에 먹기 딱 편하네요.', speaker: 'gicheol', affinity: 1 },
        { text: '전 주인에게 한 번 더 확인한다', reply: '묻는 것도 요리의 일부예요. 잘했어요.', speaker: 'owner' }
      ] },
      { speaker: 'gicheol', text: '이상하네요. 마지막이라고 생각하니 더 천천히 먹고 싶습니다.' },
      { speaker: 'protagonist', text: '저는 식당을 해 본 적도 없는데요.' },
      { speaker: 'owner', text: '오늘은 했잖아요.' }
    ]
  },
  'PR-03': {
    id: 'PR-03', title: '한 달만', day: 1, moment: 'newGame', character: 'owner',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '다음 날, 주인공은 임대 종료 안내문이 붙은 식당을 다시 찾는다.' },
      { speaker: 'owner', text: '가게를 바로 넘길 수는 없어요. 계약과 영업 신고, 위생 교육부터 제대로 해야죠.' },
      { speaker: 'protagonist', text: '절차를 마치고도 제가 겁이 나면요?' },
      { speaker: 'owner', text: '그럼 한 달만 해 봐요. 그 뒤에 계속할지는 당신이 정하고.' },
      { text: '며칠의 준비와 정식 계약 절차가 지나고, 주인공은 자신의 이름으로 가게 문을 연다.' },
      { speaker: 'protagonist', text: '한 달만. 그동안은 적어도 따뜻한 한 끼를 내자.' }
    ]
  },

  'M-01': {
    id: 'M-01', title: '첫날의 기준', day: 1, moment: 'dayStart', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '첫 영업을 앞두고 텅 빈 장부의 첫 장이 펼쳐진다.' },
      { speaker: 'protagonist', text: '잘하는 것보다 먼저, 어떤 가게가 될지 정해야 해.' },
      { prompt: '가게의 첫 운영 원칙을 적는다.', choices: [
        { text: '손님의 말을 먼저 듣는다', reply: '모르는 건 물어보고, 들은 건 기억하자.', speaker: 'protagonist' },
        { text: '기본 조리를 정확히 지킨다', reply: '편안함은 흔들리지 않는 기본에서 시작하자.', speaker: 'protagonist' },
        { text: '무리하지 않고 오래 간다', reply: '나도 손님도 지치지 않는 가게로 만들자.', speaker: 'protagonist' }
      ] },
      { text: '선택한 문장이 장부 첫 페이지에 적힌다. 다른 원칙도 앞으로의 경험으로 채울 수 있다.' }
    ]
  },
  'M-02': {
    id: 'M-02', title: '숫자로 남지 않는 것', day: 4, moment: 'nightEnd', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '마감 뒤 남은 음식은 위생 기준에 따라 폐기된다.' },
      { speaker: 'protagonist', text: '많이 준비하면 안심될 줄 알았는데, 버리는 것도 마음에 남네.' },
      { text: '식탁 아래에서 짧은 메모가 적힌 냅킨 한 장을 발견한다.' },
      { text: '“덕분에 오늘을 버틸 힘이 생겼어요.”' },
      { speaker: 'protagonist', text: '수량은 줄이되, 이 마음까지 손해로 세지는 말자.' }
    ]
  },
  'M-03': {
    id: 'M-03', title: '이름을 적는 칸', day: 7, moment: 'nightEnd', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '장부에 손님 기록을 위한 새 페이지가 생긴다.' },
      { speaker: 'protagonist', text: '좋아하는 맛만 적으면 사람을 다 안다고 착각할지도 몰라.' },
      { text: '주인공은 이름, 들은 이야기, 묻지 말아야 할 것, 다음에 확인할 것을 나눠 적는다.' },
      { speaker: 'protagonist', text: '첫 번째는 박기철 씨. “따뜻한 음식, 딸에게 먼저 연락하기.”' },
      { text: '손님 수첩 기능이 열린다. 이름은 손님이 직접 밝힌 뒤에만 기록된다.' }
    ]
  },
  'M-04': {
    id: 'M-04', title: '돌아갈 수 있는 자리', day: 10, moment: 'dayStart', character: 'manager',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '오전, 식품회사에서 함께 일했던 전 팀장이 가게를 찾아온다.' },
      { speaker: 'manager', text: '네가 그만둔 뒤 팀도 많이 바뀌었어. 조리 연구팀과 협업하는 새 상품 기획 자리가 생겼고.' },
      { speaker: 'manager', text: '돌아오라는 압박은 아니야. 조건을 제대로 보고 판단하라는 제안이야.' },
      { prompt: '전 팀장에게 지금 마음을 전한다.', choices: [
        { text: '고맙지만 아직 가게를 더 보고 싶어요', reply: '그래. 적어도 네가 선택할 시간을 갖는 건 중요하지.', speaker: 'manager' },
        { text: '구체적인 조건을 보내 주세요', reply: '업무 범위와 급여, 근무 조건까지 문서로 보낼게.', speaker: 'manager' },
        { text: '회사로 돌아갈 자신이 아직 없어요', reply: '자신감이 아니라 조건과 삶을 놓고 생각해 봐.', speaker: 'manager' }
      ] },
      { speaker: 'protagonist', text: '돌아갈 자리가 있다는 말이 왜 안심되면서도 답답할까.' }
    ]
  },
  'M-07': {
    id: 'M-07', title: '기본은 정확하게, 마지막은 다르게', day: 21, moment: 'dayStart', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '손님의 취향을 기억하는 일과 손님을 미리 단정하는 일의 차이가 마음에 걸린다.' },
      { speaker: 'protagonist', text: '기억은 질문을 덜 하기 위한 게 아니라, 더 잘 묻기 위한 것이어야 해.' },
      { text: '주인공은 모든 메뉴의 기본 조리 기준을 다시 정리한다.' },
      { speaker: 'protagonist', text: '기본은 누구에게나 정확하게. 마지막 선택은 오늘의 손님에게 물어보고.' },
      { text: '손님 수첩에 “아는 척하지 않기”라는 새 원칙이 추가된다.' }
    ]
  },
  'M-05': {
    id: 'M-05', title: '정식 제안', day: 17, moment: 'dayStart', character: 'manager',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '전 팀장이 약속한 정식 채용 제안서를 들고 찾아온다.' },
      { speaker: 'manager', text: '야근을 전제로 하지 않는 자리야. 네 현장 경험도 업무로 인정하겠다고 했고.' },
      { speaker: 'manager', text: '답은 29일까지 주면 돼. 거절해도 우리 사이가 나빠지는 일은 없어.' },
      { prompt: '제안서를 받아 들며 답한다.', choices: [
        { text: '진지하게 비교해 볼게요', reply: '그게 내가 바라는 전부야.', speaker: 'manager' },
        { text: '좋은 조건이라 더 고민되네요', reply: '좋은 선택지끼리의 고민은 오래 걸리는 법이지.', speaker: 'manager' },
        { text: '가게를 계속하고 싶은 마음이 커요', reply: '그 마음이 두려움 때문인지 바람 때문인지만 확인해 봐.', speaker: 'manager' }
      ] },
      { text: '제안서의 답변 기한과 가게의 한 달 계약 종료일이 장부에 함께 표시된다.' }
    ]
  },
  'M-06': {
    id: 'M-06', title: '가득 찬 밤', day: 20, moment: 'nightEnd', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '소문을 듣고 온 손님들로 자리가 가득 찬다. 주문은 밀리지만 실패 제한 시간은 없다.' },
      { speaker: 'protagonist', text: '모두에게 좋은 음식을 내고 싶지만, 혼자서 완벽하게 해내려 하면 더 늦어져.' },
      { prompt: '붐비는 가게의 운영 방식을 정한다.', choices: [
        { text: '기다리는 시간을 솔직히 알린다', reply: '기다려 주신 만큼 차분히 만들겠습니다.', speaker: 'protagonist' },
        { text: '오늘 가능한 메뉴를 줄인다', reply: '지금 가장 잘 낼 수 있는 음식부터 안내하자.', speaker: 'protagonist' },
        { text: '기본 조리는 묶고 마무리는 개별로 한다', reply: '속도와 정성을 함께 지킬 방법을 써 보자.', speaker: 'protagonist' }
      ] },
      { text: '손님들은 안내받은 시간을 알고 기다린다. 가게는 서두름보다 신뢰로 밤을 마친다.' }
    ]
  },
  'M-08': {
    id: 'M-08', title: '두 개의 기한', day: 24, moment: 'dayStart', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '식탁 위에 재계약 안내서와 회사 제안서가 나란히 놓인다.' },
      { speaker: 'protagonist', text: '안정적인 자리도 진짜고, 여기서 느낀 마음도 진짜야.' },
      { prompt: '결정을 앞두고 무엇을 먼저 살핀다.', choices: [
        { text: '내가 하루를 보내고 싶은 방식', reply: '어떤 아침과 어떤 밤을 반복하고 싶은지 적어 보자.', speaker: 'protagonist' },
        { text: '현실적인 비용과 생활', reply: '임대료와 재료비, 쉴 수 있는 날까지 계산해 보자.', speaker: 'protagonist' },
        { text: '두 선택에서 포기해야 하는 것', reply: '얻는 것만큼 감당할 것도 솔직히 적어 보자.', speaker: 'protagonist' }
      ] },
      { text: '선택은 즉시 확정되지 않는다. 주인공은 29일까지 자신의 답을 살아 보기로 한다.' }
    ]
  },
  'M-09': {
    id: 'M-09', title: '붙잡지 않는 손님들', day: 27, moment: 'dayStart', character: null,
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '재계약 고민을 알게 된, 가게와 인연을 맺은 손님들이 영업 전 잠시 모인다.' },
      { speaker: 'gicheol', text: '우리가 단골이라고 사장님 인생까지 예약할 수는 없죠.' },
      { speaker: 'narae', text: '저희 때문에 남는 건 싫어요. 사장님이 있고 싶어서 있는 거면 좋겠어요.' },
      { prompt: '손님들의 말에 답한다.', choices: [
        { text: '여러분을 만난 건 분명 제 마음의 일부예요', reply: '일부면 충분해요. 전부의 책임은 지우지 않을게요.', speaker: 'seoyoon' },
        { text: '저 자신이 원하는 답을 찾을게요', reply: '그게 제일 듣고 싶었던 말이에요.', speaker: 'doyoon' },
        { text: '어떤 선택을 해도 마지막 식사는 대접할게요', reply: '그럼 오늘도 손님답게 잘 먹고 갈게요.', speaker: 'hyejin' }
      ] },
      { text: '누구도 남아 달라고 말하지 않는다. 그래서 주인공은 처음으로 자신의 바람을 또렷이 듣는다.' }
    ]
  },
  'M-10': {
    id: 'M-10', title: '내가 고른 자리', day: 29, moment: 'dayStart', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '답변 기한의 아침. 주인공은 전 팀장에게 전화를 건다.' },
      { prompt: '주인공이 자신의 결정을 말한다.', choices: [
        { text: '가게를 계속하겠습니다', reply: '네가 도망친 게 아니라 고른 거라면, 응원할게.', speaker: 'manager' },
        { text: '이곳에서 더 배워 보고 싶어요', reply: '그 말이면 충분해. 다음에는 손님으로 갈게.', speaker: 'manager' },
        { text: '회사 제안은 감사하지만 거절할게요', reply: '알겠어. 네 결정을 존중하고 제안은 여기서 마무리할게.', speaker: 'manager' }
      ] },
      { text: '주인공은 전 주인에게도 연락해 장기 계약을 원한다고 말한다.' },
      { speaker: 'owner', text: '한 달을 버틴 사람이 아니라, 내일도 문을 열고 싶은 사람이 됐군요.' },
      { text: '주인공은 챙겨 두었던 이삿짐 상자를 다시 풀어 주방 선반을 채운다.' }
    ]
  },

  'G-02': {
    id: 'G-02', title: '하루 만에 승진한 사람', day: 2, moment: 'nightStart', character: 'gicheol',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '첫 정식 영업일, 기철이 어제와 같은 자리에 앉는다.' },
      { speaker: 'gicheol', text: '제가 새 사장님의 첫 재방문 손님이면, 하루 만에 단골 후보로 승진한 겁니까?' },
      { speaker: 'protagonist', text: '두 번으로 단골이면 기준이 너무 후하지 않나요?' },
      { speaker: 'gicheol', text: '밤일 하는 사람한테는 다시 올 곳 하나 생기는 게 큰 승진이죠.' },
      { speaker: 'protagonist', text: '그럼 오늘도 잘 부탁드립니다, 단골 후보님.' }
    ]
  },
  'G-03': {
    id: 'G-03', title: '보내지 못한 문자', day: 8, moment: 'nightStart', character: 'gicheol',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '기철은 택시 뒷좌석에서 발견한 아이 장난감을 만지작거린다.' },
      { speaker: 'gicheol', text: '딸한테 연락하려고 화면만 열었다 닫았다 했습니다. 무슨 말을 해야 할지 몰라서요.' },
      { prompt: '기철이 보낼 첫 문장을 함께 고른다.', choices: [
        { text: '잘 지내니?', reply: '짧으니 도망갈 핑계도 없네요. 보내겠습니다.', speaker: 'gicheol', affinity: 1 },
        { text: '오늘 네 생각이 났다', reply: '조금 쑥스럽지만… 사실이니까요.', speaker: 'gicheol', affinity: 1 },
        { text: '답은 천천히 해도 된다', reply: '그 말을 붙이면 저도 덜 겁날 것 같습니다.', speaker: 'gicheol', affinity: 1 }
      ] },
      { text: '기철은 장난감 사진과 짧은 문자를 보낸다.' },
      { speaker: 'gicheol', text: '운전은 길만 알면 되는데, 가족한테 가는 길은 왜 이렇게 어렵답니까.' }
    ]
  },
  'G-04': {
    id: 'G-04', title: '두 사람이 먹어야 완성되는 접시', day: 18, moment: 'nightStart', character: 'gicheol',
    affinity: 2, regular: false, specialCook: true,
    lines: [
      { speaker: 'gicheol', text: '딸이 어릴 때 좋아하던 맛과 지금 제가 좋아하는 맛은 꽤 다르더군요.' },
      { speaker: 'protagonist', text: '한 접시 안에 두 가지 식감을 담은 [기철 특별 메뉴 TBD]를 만들어 볼까요?' },
      { prompt: '평소보다 어려운 조리법의 마무리를 정한다.', choices: [
        { text: '두 식감의 대비를 또렷하게 살린다', reply: '사진만 봐도 딸이 어느 쪽을 고를지 알겠네요.', speaker: 'gicheol', affinity: 2 },
        { text: '두 맛이 자연스럽게 이어지게 한다', reply: '다른데도 한 접시에 있을 수 있군요.', speaker: 'gicheol', affinity: 2 },
        { text: '무리하지 않고 기본 조리를 지킨다', reply: '함께 먹을 날을 위해 오늘은 연습한 셈 치죠.', speaker: 'gicheol', affinity: 1 }
      ] },
      { text: '기철이 음식 사진을 보내자 곧 답장이 온다. “다음엔 나도 먹어 볼래.”' },
      { speaker: 'gicheol', text: '예약 하나 잡아도 되겠습니까? 이번에는 두 명입니다.' }
    ]
  },
  'G-05': {
    id: 'G-05', title: '예약 손님', day: 26, moment: 'nightStart', character: 'gicheol',
    affinity: 2, regular: true, specialCook: false,
    lines: [
      { text: '기철이 한 젊은 손님과 나란히 들어온다. 두 사람 모두 먼저 말을 꺼내지 못한다.' },
      { speaker: 'sujin', text: '안녕하세요. 박수진이에요. 아버지가 사진을 너무 자랑해서 확인하러 왔어요.', reveal: 'sujin' },
      { speaker: 'gicheol', text: '자랑은 아니고, 사실 전달을 조금 자주 했을 뿐이지.' },
      { speaker: 'sujin', text: '다시 연락한다고 예전 일이 없던 건 아니에요. 그래도 오늘은 같이 먹어 보려고요.' },
      { speaker: 'protagonist', text: '그럼 두 분이 각자 원하는 맛을 먼저 알려 주세요.' },
      { speaker: 'gicheol', text: '단골이 혼자 오는 사람이라는 규칙은 없겠죠? 다음 예약도 둘로 부탁합니다.' }
    ]
  },

  'SY-01': {
    id: 'SY-01', title: '열두 분짜리 저녁', day: 3, moment: 'nightStart', character: 'seoyoon',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '병원 근무복 차림의 손님이 시계를 확인하며 자리에 앉는다.' },
      { speaker: 'seoyoon', text: '한서윤입니다. 다시 병원에 들어가기까지 열두 분 있어요. 그 안에 먹을 수 있을까요?', reveal: 'seoyoon' },
      { speaker: 'protagonist', text: '가능한 메뉴와 걸리는 시간을 먼저 알려 드릴게요.' },
      { speaker: 'seoyoon', text: '좋네요. 의료진도 설명을 잘 들으면 덜 불안하거든요.' },
      { text: '주인공은 빨리 삼켜도 부담 없는 [따뜻한 한 접시 TBD]를 낸다.' },
      { speaker: 'seoyoon', text: '열두 분짜리 저녁치고는 꽤 사람답게 먹었네요.' }
    ]
  },
  'SY-02': {
    id: 'SY-02', title: '스물네 분과 작은 음료', day: 8, moment: 'nightStart', character: 'seoyoon',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { speaker: 'seoyoon', text: '오늘은 스물네 분입니다. 지난번보다 두 배나 여유로운 손님이죠.' },
      { text: '서윤이 편의점에서 산 작은 음료를 계산대에 올려놓는다.' },
      { speaker: 'seoyoon', text: '사장님 얼굴이 곧 쓰러질 사람 명단에 들어갈 것 같아서요. 이건 뇌물이 아니라 예방입니다.' },
      { speaker: 'protagonist', text: '간호사 선생님에게 경고받았으니 앉아서 마실게요.' },
      { speaker: 'seoyoon', text: '좋습니다. 남 돌보는 사람도 관찰 대상이라는 걸 잊지 마세요.' }
    ]
  },
  'SY-03': {
    id: 'SY-03', title: '기억하는 것과 안다고 생각하는 것', day: 11, moment: 'nightStart', character: 'seoyoon',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '며칠 만에 서윤이 근무복이 아닌 편한 옷차림으로 찾아온다.' },
      { speaker: 'protagonist', text: '오늘도 많이 지치셨죠? 늘 드시던 걸로 빨리 준비할게요.' },
      { speaker: 'seoyoon', text: '오늘은 쉬는 날이고, 별로 지치지도 않았어요. 제가 늘 피곤한 사람처럼 보이나요?' },
      { prompt: '성급히 짐작한 일을 사과한다.', choices: [
        { text: '기억하는 것과 단정하는 걸 헷갈렸어요', reply: '다음에는 먼저 물어봐 주세요. 그럼 괜찮아요.', speaker: 'seoyoon', affinity: 1 },
        { text: '오늘 먹고 싶은 걸 다시 여쭤봐도 될까요?', reply: '네. 오늘은 천천히 고르고 싶어요.', speaker: 'seoyoon', affinity: 1 },
        { text: '불편하게 해서 미안합니다', reply: '사과를 들었으니 오래 화내지는 않을게요.', speaker: 'seoyoon', affinity: 1 }
      ] },
      { speaker: 'protagonist', text: '기억은 답이 아니라 다음 질문의 시작으로 둘게요.' }
    ]
  },
  'SY-04': {
    id: 'SY-04', title: '시간을 재지 않는 식사', day: 22, moment: 'nightStart', character: 'seoyoon',
    affinity: 2, regular: false, specialCook: true,
    lines: [
      { speaker: 'seoyoon', text: '오늘은 호출도, 복귀 시간도 없어요. 그런데 뭘 주문해야 할지 모르겠네요.' },
      { speaker: 'protagonist', text: '그럼 서두르지 않아도 맛이 변하지 않는 [서윤 특별 메뉴 TBD]를 해 볼게요.' },
      { prompt: '천천히 먹는 한 접시의 온도와 식감을 맞춘다.', choices: [
        { text: '따뜻함이 오래가게 조리한다', reply: '시간을 확인하지 않고 먹어도 따뜻하네요.', speaker: 'seoyoon', affinity: 2 },
        { text: '한입마다 식감이 달라지게 만든다', reply: '천천히 먹을 이유가 생기는 음식이군요.', speaker: 'seoyoon', affinity: 2 },
        { text: '익숙하고 편안한 기본 맛을 지킨다', reply: '오늘은 이런 평범함이 필요했어요.', speaker: 'seoyoon', affinity: 1 }
      ] },
      { speaker: 'seoyoon', text: '사실은 많이 지쳤어요. 오늘은 제가 먼저 그렇게 말하고 싶었습니다.' },
      { speaker: 'protagonist', text: '말해 줘서 고마워요. 오늘은 다 먹고 나서 일어나세요.' }
    ]
  },
  'SY-05': {
    id: 'SY-05', title: '오늘은 두 명', day: 26, moment: 'nightStart', character: 'seoyoon',
    affinity: 2, regular: true, specialCook: false,
    lines: [
      { text: '서윤이 긴장한 표정의 후배 간호사와 함께 들어온다.' },
      { speaker: 'seoyoon', text: '오늘은 두 명이에요. 이 친구가 식사할 때도 계속 호출음을 듣는 표정을 해서요.' },
      { speaker: 'seoyoon', text: '여기는 천천히 먹어도 눈치 주는 사람이 없어요. 저도 여기서 배웠고요.' },
      { speaker: 'protagonist', text: '두 분 모두 오늘 원하는 속도부터 알려 주세요.' },
      { speaker: 'seoyoon', text: '저는 느리게요. 이제 여기서는 그렇게 말할 수 있어요.' },
      { text: '손님 수첩에 한서윤이 단골로 기록된다.' }
    ]
  },

  'NR-01': {
    id: 'NR-01', title: '물감을 먹는 가방', day: 4, moment: 'nightStart', character: 'narae',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '초저녁, 커다란 미술 가방을 멘 교복 차림의 손님이 조심스럽게 들어온다.' },
      { speaker: 'narae', text: '최나래예요. 미술학원 끝나고 왔어요. 학생도 식사만 하면 괜찮죠?', reveal: 'narae' },
      { speaker: 'protagonist', text: '물론이죠. 너무 늦기 전에 먹고 갈 수 있게 준비할게요.' },
      { speaker: 'narae', text: '가방이 자꾸 의자를 차지해서요. 얘는 물감만 먹고도 저보다 덩치가 커요.' },
      { text: '식사를 기다리던 나래는 냅킨에 주방의 작은 풍경을 빠르게 그린다.' },
      { speaker: 'narae', text: '그냥 낙서예요. 평가하시면 안 돼요.' }
    ]
  },
  'NR-02': {
    id: 'NR-02', title: '보여 주라고 둔 그림은 아니에요', day: 9, moment: 'nightStart', character: 'narae',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '주인공은 나래가 두고 간 냅킨 그림을 작은 액자에 넣어 벽에 걸어 둔다.' },
      { speaker: 'narae', text: '왜 제 그림이 저기 있어요? 보여 주라고 두고 간 게 아니에요.' },
      { speaker: 'protagonist', text: '좋은 그림이라서 기뻐할 줄 알았어. 먼저 물었어야 했는데 미안해.' },
      { speaker: 'narae', text: '좋다고 하면 다 공개해도 되는 건 아니잖아요.' },
      { text: '주인공은 바로 액자를 내리고 그림을 봉투에 담아 돌려준다.' },
      { speaker: 'narae', text: '오늘은 그냥 갈게요. 다음에 올지는… 제가 정할게요.' }
    ]
  },
  'NR-03': {
    id: 'NR-03', title: '평가하지 않는 감상', day: 12, moment: 'nightStart', character: 'narae',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '며칠 뒤 초저녁, 나래가 다시 문 앞에 선다. 주인공은 먼저 그림 이야기를 꺼내지 않는다.' },
      { speaker: 'narae', text: '이번에는 제가 보여 주려고 가져왔어요. 대신 평가 금지예요.' },
      { prompt: '나래의 새 그림을 보고 답한다.', choices: [
        { text: '어떤 마음으로 그렸는지 물어본다', reply: '그 질문은 좋아요. 정답을 말하라는 것 같지 않아서.', speaker: 'narae', affinity: 1 },
        { text: '보여 줘서 고맙다고 말한다', reply: '저도 허락부터 기다려 줘서 고마워요.', speaker: 'narae', affinity: 1 },
        { text: '좋아하는 부분을 말해도 되는지 묻는다', reply: '허락을 물었으니까… 한 부분만요.', speaker: 'narae', affinity: 1 }
      ] },
      { speaker: 'protagonist', text: '앞으로 네가 보여 주기로 한 것만 볼게.' },
      { speaker: 'narae', text: '그러면 다음 그림도 가져올 수 있을 것 같아요.' }
    ]
  },
  'NR-04': {
    id: 'NR-04', title: '정답 없는 접시', day: 23, moment: 'nightStart', character: 'narae',
    affinity: 2, regular: false, specialCook: true,
    lines: [
      { speaker: 'narae', text: '입시 그림은 정해진 답처럼 보여요. 제가 그리고 싶은 건 자꾸 뒤로 밀리고요.' },
      { speaker: 'protagonist', text: '조리는 정확하게 하고, 마지막 담기는 네가 정하는 [나래 특별 메뉴 TBD]를 해 보자.' },
      { text: '초저녁의 조용한 주방에서 나래가 색과 여백을 직접 고른다.' },
      { prompt: '접시의 마지막 구성을 나래에게 맡긴다.', choices: [
        { text: '대담한 색 대비를 제안한다', reply: '입시였으면 말렸을 텐데, 오늘은 해 볼래요.', speaker: 'narae', affinity: 2 },
        { text: '빈 공간을 남길지 묻는다', reply: '다 채우지 않아도 된다는 게 좋네요.', speaker: 'narae', affinity: 2 },
        { text: '아무 제안 없이 기다린다', reply: '제가 고를 때까지 기다려 주는 것도 도움이 돼요.', speaker: 'narae', affinity: 1 }
      ] },
      { speaker: 'narae', text: '처음으로 정답이 없어도 끝낼 수 있었어요. 제 그림도 그렇게 해 볼래요.' }
    ]
  },
  'NR-05': {
    id: 'NR-05', title: '제가 고른 그림', day: 26, moment: 'nightStart', character: 'narae',
    affinity: 2, regular: true, specialCook: false,
    lines: [
      { text: '나래가 수업이 일찍 끝난 초저녁에 액자 하나를 품고 찾아온다.' },
      { speaker: 'narae', text: '이건 입시 그림이 아니에요. 그냥 제가 그리고 싶어서 그린 거예요.' },
      { speaker: 'narae', text: '가게에 걸어도 돼요. 이번에는 제가 먼저 부탁하는 거예요.' },
      { speaker: 'protagonist', text: '어디에 걸지 같이 고를까?' },
      { speaker: 'narae', text: '네. 그리고 합격 여부랑 상관없이 다음 그림도 그릴 거예요.' },
      { text: '손님 수첩에 최나래가 단골로 기록된다.' }
    ]
  },

  'DY-01': {
    id: 'DY-01', title: '유리창 안쪽의 사람', day: 5, moment: 'nightStart', character: 'doyoon',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '소극장 마감 뒤, 표 봉투를 든 젊은 손님이 들어온다.' },
      { speaker: 'doyoon', text: '이도윤입니다. 근처 소극장에서 표를 팔고 객석 안내도 해요.', reveal: 'doyoon' },
      { speaker: 'protagonist', text: '연극을 자주 보겠네요.' },
      { speaker: 'doyoon', text: '대부분 문틈으로 목소리만 들어요. 언젠가는 저도 무대에 서고 싶지만요.' },
      { speaker: 'protagonist', text: '언젠가라는 말 뒤에 오늘 연습한 시간도 들어 있겠죠.' },
      { speaker: 'doyoon', text: '들키니까 조금 부끄럽네요. 그래도 그 말은 좋습니다.' }
    ]
  },
  'DY-02': {
    id: 'DY-02', title: '관객이 없는 연습', day: 9, moment: 'nightStart', character: 'doyoon',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '마감 직전, 가게 밖에서 도윤이 작은 목소리로 대사를 연습한다.' },
      { speaker: 'doyoon', text: '관객이 없을 때는 잘하면서, 오디션 공고만 보면 손이 멈춰요.' },
      { text: '도윤은 접어 둔 신인 배우 오디션 공고를 식탁 위에 편다.' },
      { prompt: '도윤의 연습을 들은 뒤 말한다.', choices: [
        { text: '방금 대사를 한 번 더 듣고 싶어요', reply: '한 명이라도 관객이 있으면 연습이 아니라 시작이겠죠.', speaker: 'doyoon', affinity: 1 },
        { text: '떨리는 채로 지원해도 돼요', reply: '안 떨릴 때까지 기다리면 계속 매표소 안이겠네요.', speaker: 'doyoon', affinity: 1 },
        { text: '지원 여부는 직접 정해요', reply: '네. 대신 오늘은 공고를 버리지 않겠습니다.', speaker: 'doyoon', affinity: 1 }
      ] },
      { text: '도윤은 공고를 다시 접지 않고 휴대전화로 접수 페이지를 연다.' }
    ]
  },
  'DY-03': {
    id: 'DY-03', title: '무대에 오르기 전 한 접시', day: 21, moment: 'nightStart', character: 'doyoon',
    affinity: 2, regular: false, specialCook: true,
    lines: [
      { speaker: 'doyoon', text: '내일 첫 오디션입니다. 입이 바짝 말라서 음식이 넘어갈지도 모르겠어요.' },
      { speaker: 'protagonist', text: '부담은 적고 향은 또렷한 [도윤 특별 메뉴 TBD]를 시도해 볼게요.' },
      { prompt: '긴장을 누그러뜨릴 조리 마무리를 고른다.', choices: [
        { text: '부드러운 식감을 정교하게 맞춘다', reply: '목소리도 이렇게 걸리지 않고 나오면 좋겠네요.', speaker: 'doyoon', affinity: 2 },
        { text: '익숙한 향을 선명하게 살린다', reply: '이 냄새를 기억하면 대기실에서도 숨을 쉴 수 있겠어요.', speaker: 'doyoon', affinity: 2 },
        { text: '실수하지 않을 기본 조리를 택한다', reply: '완벽보다 끝까지 하는 연습이라고 생각할게요.', speaker: 'doyoon', affinity: 1 }
      ] },
      { speaker: 'doyoon', text: '붙겠다고 약속은 못 해도, 안 도망가고 오겠다고는 약속할게요.' }
    ]
  },
  'DY-04': {
    id: 'DY-04', title: '불합격이라는 세 줄', day: 25, moment: 'nightStart', character: 'doyoon',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '도윤이 불합격 안내가 뜬 휴대전화를 뒤집어 놓는다.' },
      { speaker: 'doyoon', text: '결과는 세 줄인데, 그 세 줄 때문에 제가 한 연습까지 없어진 기분이에요.' },
      { speaker: 'protagonist', text: '괜찮다고 서둘러 말하지 않을게요. 속상한 건 속상한 채로 있어도 돼요.' },
      { speaker: 'doyoon', text: '그 말이 오히려 덜 외롭네요.' },
      { text: '잠시 뒤 도윤은 극장 게시판의 다음 낭독 오디션 공고를 사진으로 찍는다.' },
      { speaker: 'doyoon', text: '오늘은 떨어진 사람이고, 내일은 다시 지원할 사람으로 해 볼게요.' }
    ]
  },
  'DY-05': {
    id: 'DY-05', title: '이름이 적힌 표', day: 28, moment: 'nightStart', character: 'doyoon',
    affinity: 2, regular: true, specialCook: false,
    lines: [
      { text: '도윤이 공연표 한 장을 두 손으로 계산대 위에 올린다.' },
      { speaker: 'doyoon', text: '낭독 공연에서 한 장면을 맡았어요. 이번 표에는 제 이름도 있어요. 아주 작게 적혀 있지만요.' },
      { speaker: 'protagonist', text: '작아도 관객이 읽을 수 있는 이름이네요.' },
      { speaker: 'doyoon', text: '첫 무대가 끝나면 여기서 제일 늦은 저녁을 먹을게요.' },
      { speaker: 'protagonist', text: '그날은 배우 이도윤 씨 자리로 비워 둘게요.' },
      { text: '손님 수첩에 이도윤이 단골로 기록된다.' }
    ]
  },

  'MR-01': {
    id: 'MR-01', title: '주문서 없는 꽃', day: 6, moment: 'nightStart', character: 'miran',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '꽃향기가 밴 앞치마를 두른 손님이 남은 꽃 한 송이를 들고 들어온다.' },
      { speaker: 'miran', text: '정미란이에요. 골목에서 꽃집을 해요. 이건 개업 선물이라기엔 며칠 늦었지만.', reveal: 'miran' },
      { speaker: 'protagonist', text: '미란 씨가 좋아하는 꽃인가요?' },
      { speaker: 'miran', text: '손님 꽃은 잘 고르는데 내 취향은 모르겠어요. 늘 주문서부터 봐서.' },
      { speaker: 'protagonist', text: '그럼 음식은 주문서 없이 오늘 끌리는 것부터 골라 보세요.' },
      { speaker: 'miran', text: '내 걸 고르라니, 꽃 백 송이보다 어렵네.' }
    ]
  },
  'MR-02': {
    id: 'MR-02', title: '조금 휘어진 꽃', day: 10, moment: 'nightStart', character: 'miran',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '미란이 줄기가 살짝 휜 꽃을 작은 병에 꽂아 가져온다.' },
      { speaker: 'miran', text: '팔기 애매한 애라서 데려왔어요. 버리기는 아깝고.' },
      { speaker: 'protagonist', text: '왜 미란 씨 몫은 늘 팔고 남은 것이에요?' },
      { speaker: 'miran', text: '멀쩡한 건 돈이 되니까. 나한테 쓰면 괜히 아깝잖아요.' },
      { speaker: 'protagonist', text: '오늘 식사는 남은 것이 아니라 미란 씨가 먼저 고른 걸로 해요.' },
      { speaker: 'miran', text: '가끔은 내가 먼저여도 가게가 망하지는 않겠죠.' }
    ]
  },
  'MR-03': {
    id: 'MR-03', title: '오늘은 내가 고르는 맛', day: 24, moment: 'nightStart', character: 'miran',
    affinity: 2, regular: false, specialCook: true,
    lines: [
      { speaker: 'protagonist', text: '오늘은 다른 사람 생각 말고, 원하는 향과 식감을 하나씩 골라 주세요.' },
      { speaker: 'miran', text: '그럼 향은 산뜻하게, 식감은 조금 단단하게. 오늘의 나는 그게 좋네요.' },
      { speaker: 'protagonist', text: '그 선택으로 [미란 특별 메뉴 TBD]를 만들어 볼게요.' },
      { prompt: '미란이 고른 감각을 중심으로 마무리한다.', choices: [
        { text: '산뜻한 향을 길게 남긴다', reply: '남이 좋아할지가 아니라 제가 좋아서 웃는 거네요.', speaker: 'miran', affinity: 2 },
        { text: '씹는 식감을 또렷하게 살린다', reply: '내가 고른 것이 접시에 남으니 제법 든든해요.', speaker: 'miran', affinity: 2 },
        { text: '두 특징을 무리 없이 조화시킨다', reply: '오늘의 취향은 이 정도로도 충분히 내 것이네요.', speaker: 'miran', affinity: 1 }
      ] },
      { speaker: 'miran', text: '좋아하는 게 매일 달라도 괜찮다는 걸 이제 알겠어요.' }
    ]
  },
  'MR-04': {
    id: 'MR-04', title: '팔지 않을 한 송이', day: 25, moment: 'nightStart', character: 'miran',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '미란이 반듯하고 싱싱한 제철 꽃 한 송이를 들고 온다.' },
      { speaker: 'miran', text: '오늘 가게에서 제일 먼저 핀 꽃이에요. 값을 붙이기 전에 제 몫으로 뺐어요.' },
      { speaker: 'protagonist', text: '오늘 가장 좋아하는 꽃인가요?' },
      { speaker: 'miran', text: '오늘은요. 내일 바뀌면 또 내일 것을 고르면 되고.' },
      { speaker: 'protagonist', text: '그 꽃은 어디에 둘 거예요?' },
      { speaker: 'miran', text: '제 밥상 앞에요. 보면서 천천히 먹으려고요.' }
    ]
  },
  'MR-05': {
    id: 'MR-05', title: '오늘의 꽃', day: 28, moment: 'nightStart', character: 'miran',
    affinity: 2, regular: true, specialCook: false,
    lines: [
      { text: '미란이 작은 꽃병과 정식 거래 메모를 함께 내민다.' },
      { speaker: 'miran', text: '매주 한 번, 오늘의 꽃을 가져올게요. 선물이 아니라 제대로 값을 받는 일이에요.' },
      { speaker: 'protagonist', text: '가게의 꽃을 미란 씨에게 맡길 수 있어 기뻐요.' },
      { speaker: 'miran', text: '단골은 오늘 다른 걸 골라도 이상하게 안 보는 곳에 오는 사람이라면서요.' },
      { speaker: 'miran', text: '그럼 저도 매번 다른 음식을 골라도 계속 단골 할게요.' },
      { text: '손님 수첩에 정미란이 단골로 기록된다.' }
    ]
  },

  'HJ-01': {
    id: 'HJ-01', title: '오백 명분을 만드는 손', day: 7, moment: 'nightStart', character: 'hyejin',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '손님은 자리에 앉자마자 식기 배치와 주방 동선을 눈으로 훑는다.' },
      { speaker: 'hyejin', text: '문혜진입니다. 학교 급식실에서 일해요. 직업병이라 주방부터 보게 되네요.', reveal: 'hyejin' },
      { speaker: 'protagonist', text: '불편한 곳이 보이나요?' },
      { speaker: 'hyejin', text: '저 접시는 반대편에 쌓으면 손목이 덜 꺾여요. 아, 오늘은 참견 말고 먹으러 왔는데.' },
      { text: '혜진이 무심코 빈 그릇을 포개려 하자 주인공이 조용히 받아 든다.' },
      { speaker: 'protagonist', text: '오늘 역할은 손님이에요. 정리는 제가 할게요.' }
    ]
  },
  'HJ-02': {
    id: 'HJ-02', title: '같은 맛과 한 사람의 맛', day: 10, moment: 'nightStart', character: 'hyejin',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { speaker: 'hyejin', text: '급식은 오백 명에게 같은 맛을 내야 해요. 그건 개성이 없어서가 아니라 안전과 시간의 약속이죠.' },
      { speaker: 'protagonist', text: '그럼 혜진 씨 한 사람만을 위한 맛은 어떤 걸까요?' },
      { speaker: 'hyejin', text: '모르겠네요. 늘 학생들 잔반과 알레르기 표부터 생각해서.' },
      { speaker: 'protagonist', text: '오늘은 맵기와 양, 먹는 속도부터 혜진 씨 기준으로 물어볼게요.' },
      { speaker: 'hyejin', text: '한 사람분 질문이 이렇게 많았군요.' }
    ]
  },
  'HJ-03': {
    id: 'HJ-03', title: '한 사람의 속도', day: 20, moment: 'nightStart', character: 'hyejin',
    affinity: 2, regular: false, specialCook: true,
    lines: [
      { speaker: 'hyejin', text: '저는 늘 가장 늦게 먹어요. 배식 끝내고 나면 음식도 제 마음도 식어 있죠.' },
      { speaker: 'protagonist', text: '혜진 씨가 먹는 속도에 맞춰 완성되는 [혜진 특별 메뉴 TBD]를 준비할게요.' },
      { prompt: '한 사람의 식사 속도에 맞춘 조리를 선택한다.', choices: [
        { text: '마지막 한입까지 온도를 지킨다', reply: '누가 제 식사 시간을 계산해 준 건 처음이에요.', speaker: 'hyejin', affinity: 2 },
        { text: '중간에 쉬어도 식감이 무너지지 않게 한다', reply: '멈췄다가 먹어도 괜찮다는 게 참 편하네요.', speaker: 'hyejin', affinity: 2 },
        { text: '정확한 기본 조리로 편안하게 낸다', reply: '기본을 지켜 주는 것도 한 사람을 위한 배려죠.', speaker: 'hyejin', affinity: 1 }
      ] },
      { speaker: 'hyejin', text: '오늘은 제가 정말 손님이네요.' }
    ]
  },
  'HJ-04': {
    id: 'HJ-04', title: '점검표 맛이 나는 날', day: 23, moment: 'nightStart', character: 'hyejin',
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '혜진이 한입을 먹고는 잠시 수저를 내려놓는다.' },
      { speaker: 'hyejin', text: '오늘 음식은 틀린 데가 없는데, 점검표 맛이 나요. 사장님 마음이 안 보이네요.' },
      { speaker: 'protagonist', text: '결정을 앞두고 실수하지 않으려고 기준 뒤에 숨었나 봐요.' },
      { speaker: 'hyejin', text: '기준은 숨는 벽이 아니라 지켜야 할 약속이에요. 그 위에 사람 몫을 더하는 거고.' },
      { speaker: 'protagonist', text: '완벽하게 맞추는 것보다 왜 만드는지 다시 볼게요.' },
      { speaker: 'hyejin', text: '그럼 다음 한입은 조금 달라질 것 같네요.' }
    ]
  },
  'HJ-05': {
    id: 'HJ-05', title: '오늘의 역할은 손님', day: 27, moment: 'nightStart', character: 'hyejin',
    affinity: 2, regular: true, specialCook: false,
    lines: [
      { text: '혜진이 작은 별 모양 당근 틀을 주인공에게 건넨다.' },
      { speaker: 'hyejin', text: '급식실에서 오래 쓰던 것과 같은 모양이에요. 이건 새 걸로 샀으니 받아도 됩니다.' },
      { speaker: 'protagonist', text: '오늘도 정리를 도와주실 생각은 아니죠?' },
      { speaker: 'hyejin', text: '아뇨. 오늘 역할은 손님입니다. 그리고 제 취향부터 말할게요.' },
      { speaker: 'hyejin', text: '조금 바삭하고, 천천히 먹어도 맛있는 걸로 부탁해요.' },
      { text: '손님 수첩에 문혜진이 단골로 기록된다.' }
    ]
  },

  'CROSS-ND-01': {
    id: 'CROSS-ND-01', title: '서로의 첫 관객', day: 14, moment: 'nightStart', character: null,
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '초저녁, 나래가 그림을 정리하는 동안 도윤이 구석에서 오디션 대사를 연습한다.' },
      { speaker: 'narae', text: '방금 대사, 제가 그 장면 그려 봐도 돼요? 공개는 안 하고요.' },
      { speaker: 'doyoon', text: '그럼 저도 그림을 보고 떠오른 대사를 읽어 봐도 될까요?' },
      { speaker: 'narae', text: '평가 말고 감상만. 서로 허락받은 것만 보기예요.' },
      { speaker: 'doyoon', text: '좋아요. 저는 첫 관객이 생기고, 나래 씨는 첫 낭독자가 생기는 거네요.' },
      { text: '두 사람은 연애 감정 없이 서로의 창작을 응원하는 친구가 된다. 나래는 늦기 전에 먼저 귀가한다.' }
    ]
  },
  'CROSS-GS-01': {
    id: 'CROSS-GS-01', title: '비 오는 밤의 손님', day: 19, moment: 'nightStart', character: null,
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '폭우가 쏟아지는 밤, 병원에서 긴급 연락을 받은 서윤이 택시를 잡지 못한다.' },
      { speaker: 'gicheol', text: '마침 빈 차입니다. 손님, 병원까지는 제가 안전하게 모시죠.' },
      { speaker: 'seoyoon', text: '고맙습니다. 대신 과속은 안 돼요. 환자를 늘리러 가는 건 아니니까.' },
      { speaker: 'gicheol', text: '간호사 선생님도 끝나면 꼭 쉬십시오. 남한테만 쉬라 하면 벌금입니다.' },
      { speaker: 'seoyoon', text: '기사님도요. 운전석에서 끼니 때우면 제가 다음에 확인할 겁니다.' },
      { text: '두 사람은 서로의 일을 존중하며 가게 밖으로 나선다.' }
    ]
  },
  'CROSS-MDN-01': {
    id: 'CROSS-MDN-01', title: '작은 이름들이 만드는 무대', day: 27, moment: 'nightStart', character: null,
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '가게의 작은 낭독 밤을 위해 나래는 정식 의뢰비를 받고 포스터를 만들고, 미란은 대여료를 받고 꽃을 놓는다.' },
      { speaker: 'narae', text: '제 이름도 포스터 아래에 넣었어요. 숨기지 않기로 했거든요.' },
      { speaker: 'miran', text: '꽃도 공짜 호의가 아니라 내 일로 가져왔어요. 그래야 다음에도 당당히 하죠.' },
      { speaker: 'doyoon', text: '그럼 저도 연습이 아니라 공연으로 읽겠습니다. 관객이 작아도 무대는 무대니까.' },
      { speaker: 'protagonist', text: '각자의 이름과 일이 제값을 받는 밤으로 만들어요.' },
      { text: '작은 박수 속에서 세 사람은 서로의 첫 정식 관객이자 동료가 된다.' }
    ]
  },
  'CROSS-HR-01': {
    id: 'CROSS-HR-01', title: '오늘은 모두 손님', day: 28, moment: 'nightStart', character: null,
    affinity: 1, regular: false, specialCook: false,
    lines: [
      { text: '혜진이 습관처럼 빈 접시를 들자 단골들이 동시에 손을 내민다.' },
      { speaker: 'gicheol', text: '문혜진 손님, 오늘은 좌석에서 이탈하시면 안 됩니다.' },
      { speaker: 'seoyoon', text: '의학적으로도 휴식이 필요합니다. 제가 증언하죠.' },
      { speaker: 'miran', text: '이름표까지 만들어 왔어요. “오늘의 역할: 손님.”' },
      { speaker: 'hyejin', text: '다들 남 쉬게 하는 데는 아주 전문가들이네요. 알겠어요, 앉아 있을게요.' },
      { text: '누군가를 돌보던 사람들이 한 식탁에서 서로의 손님이 된다.' }
    ]
  },

  'ED-01': {
    id: 'ED-01', title: '오늘의 손님', day: 30, moment: 'nightStart', character: 'owner',
    affinity: 0, regular: false, specialCook: true,
    lines: [
      { text: '한 달째 밤, 전 주인이 조용히 문을 열고 처음으로 손님 자리에 앉는다.' },
      { speaker: 'owner', text: '한 달만 한다더니 오래도 했네요.' },
      { speaker: 'protagonist', text: '이제는 제가 계속하고 싶어요. 오늘은 제가 한 접시 대접할게요.' },
      { prompt: '배운 모든 것을 담아 [전 주인을 위한 메뉴 TBD]를 완성한다.', choices: [
        { text: '처음 배운 따뜻함을 담는다', reply: '첫날의 손은 떨렸는데, 이제는 사람을 보고 움직이네요.', speaker: 'owner' },
        { text: '정확한 기본 위에 오늘의 취향을 묻는다', reply: '내가 가르친 것보다 당신이 배운 것이 더 많군요.', speaker: 'owner' },
        { text: '지금 가장 자신 있는 한 접시를 낸다', reply: '이건 내 가게의 맛이 아니라 당신 가게의 맛이에요.', speaker: 'owner' }
      ] },
      { speaker: 'owner', text: '이제 이곳은 빌려 쓴 자리가 아니라 당신이 고른 자리예요.' },
      { speaker: 'protagonist', text: '내일도 불을 켤게요.' }
    ]
  },
  'ED-02': {
    id: 'ED-02', title: '오늘도 불을 켠다', day: 30, moment: 'nightEnd', character: 'protagonist',
    affinity: 0, regular: false, specialCook: false,
    lines: [
      { text: '영업이 끝난 뒤, 지금까지 인연을 맺은 손님들의 흔적이 가게 곳곳에 남아 있다.' },
      { text: '나래의 그림, 미란의 꽃, 도윤의 공연표, 혜진의 별 모양 틀, 서윤의 음료, 기철과 수진의 예약 메모.' },
      { speaker: 'protagonist', text: '모든 손님을 붙잡지는 못해도, 찾아온 한 사람에게 잘 차린 한 끼를 낼 수는 있어.' },
      { text: '남은 음식은 폐기하고 내일의 준비량을 조정한다. 매출보다 기억에 남은 한마디가 먼저 장부에 적힌다.' },
      { speaker: 'protagonist', text: '한 달만 켜 두려고 했던 불이었다. 오늘도 그 불을 켠다.' },
      { text: 'DAY 31. 이야기는 끝나지 않고, 단골과 새로운 손님이 찾아오는 일상 영업으로 이어진다.' }
    ]
  }
};

const STORY_EVENT_SCHEDULE = {
  newGame: {
    1: ['PR-01', 'PR-02', 'PR-03']
  },
  dayStart: {
    1: ['M-01'],
    10: ['M-04'],
    17: ['M-05'],
    21: ['M-07'],
    24: ['M-08'],
    27: ['M-09'],
    29: ['M-10']
  },
  nightStart: {
    2: ['G-02'],
    3: ['SY-01'],
    4: ['NR-01'],
    5: ['DY-01'],
    6: ['MR-01'],
    7: ['HJ-01'],
    8: ['G-03', 'SY-02'],
    9: ['NR-02', 'DY-02'],
    10: ['MR-02', 'HJ-02'],
    11: ['SY-03'],
    12: ['NR-03'],
    14: ['CROSS-ND-01'],
    18: ['G-04'],
    19: ['CROSS-GS-01'],
    20: ['HJ-03'],
    21: ['DY-03'],
    22: ['SY-04'],
    23: ['NR-04', 'HJ-04'],
    24: ['MR-03'],
    25: ['DY-04', 'MR-04'],
    26: ['G-05', 'SY-05', 'NR-05'],
    27: ['HJ-05', 'CROSS-MDN-01'],
    28: ['DY-05', 'MR-05', 'CROSS-HR-01'],
    30: ['ED-01']
  },
  nightEnd: {
    4: ['M-02'],
    7: ['M-03'],
    20: ['M-06'],
    30: ['ED-02']
  }
};

const STORY_SPECIAL_GUEST_BY_DAY = {
  18: 'gicheol',
  20: 'hyejin',
  21: 'doyoon',
  22: 'seoyoon',
  23: 'narae',
  24: 'miran'
};
