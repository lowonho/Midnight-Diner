# 미니게임 CSS — 어느 파일을 고쳐야 하나

미니게임 CSS 는 원래 두 덩어리였습니다.

| 예전 | 줄 수 |
| --- | --- |
| `css/day-prep-minigames.css` | 4981 |
| `css/minigames.css` | 1778 |

미니게임을 여러 개 동시에 고칠 때 서로 같은 파일을 건드려서
충돌이 났기 때문에, **게임 하나에 파일 하나**로 갈랐습니다.

위 두 파일은 그대로 남아 있지만 이제 `@import` **목록만** 담습니다.
`index.html` 과 `tools/*-visual-smoke.html` 은 계속 그 두 파일만 가리키므로
쪼개면서 한 줄도 안 고쳤습니다.

---

## 낮 준비 (`css/day-prep-minigames.css` 가 읽습니다)

| 파일 | 미니게임 | 엔진 |
| --- | --- | --- |
| `_prep-common.css` | 여러 게임이 함께 쓰는 것만 (드래그 그림 · 완료 반짝임 · 공용 keyframes) | — |
| `e1-cut.css` | 썰기 (타이밍 칼질 · 빠른 칼질) | `engine-e1-timing-cut.js` |
| `e10-anchovy.css` | 멸치 머리 떼기 | `engine-e10-target-click.js` |
| `e11-one-shot.css` | 단발 액션 (플레이팅 · 냄비에 넣기 · 육수) | `engine-e11-one-shot.js` |
| `e3-kimchi-fry.css` | 김치 볶기 | `engine-e3-direction-seq.js` |
| `e8-batter.css` | 김치전 반죽 (넣기 → 젓기) | `engine-e8-order-place.js` + `engine-e9-whisk.js` |
| `e8-skewer.css` | 닭꼬치 꽂기 | `engine-e8-order-place.js` |
| `e12-mandoline.css` | 채칼 (양배추 · 당근 · 감자) | `engine-e12-grab-shake.js` |
| `e7-sauce.css` | 소스 제조 | `engine-e7-measure.js` |
| `e2-fry-prep.css` | 튀김 준비 (감자 · 새우) | `engine-e2-alternate-input.js` |
| `e8-soak.css` | 떡 · 우동면 불리기 | `engine-e8-order-place.js` |
| `_prep-boards.css` | 여러 칸이 함께 쓰는 나무 쟁반 · 도마 그림 | — |

## 밤 조리 (`css/minigames.css` 가 읽습니다)

| 파일 | 미니게임 | 엔진 |
| --- | --- | --- |
| `_night-common.css` | 공용 버튼 · 게이지 + 옛 미니게임 잔재 | `engine-legacy-night.js` |
| `e6-deep-fry.css` | 튀기기 | `engine-e6-deep-fry.js` |
| `e4-gauge-hold.css` | 화력 유지 (어묵탕 · 떡볶이) | `engine-e4-gauge-hold.js` |
| `e3-stir-wok.css` | 볶음우동 조리 · 철판 볶기 | `engine-e3-direction-seq.js` |
| `e5-two-side-cook.css` | 김치전 · 닭꼬치 굽기 | `engine-e5-two-side-cook.js` |

> 두부김치 플레이팅(밤 조리)은 낮 준비와 같은 화면을 씁니다 → `e11-one-shot.css`

## 여기 없는 것 (예전 그대로입니다)

| 파일 | 무엇 |
| --- | --- |
| `css/minigame-frame.css` | 미니게임 공용 패널 규격 (창 · 타이틀 · 플레이 판 · 닫기 버튼) |
| `css/minigame-parts.css` | 3열 격자와 카드 껍데기 · `.mg-burner` 같은 공용 조각 |

---

## 고칠 때 주의할 점

1. **경로는 `../../assets/` 입니다.** 한 칸 깊어졌습니다.
   `../assets/` 로 적으면 `css/assets/...` 를 찾다가 그림이 사라집니다.
2. **읽는 차례가 곧 우선순위입니다.**
   `_prep-common` 은 맨 앞, `_prep-boards` 는 맨 뒤여야 합니다.
   가운데 게임 파일끼리는 겹치는 셀렉터가 없어 차례를 바꿔도 그림이 같습니다.
3. **`@import` 는 파일 맨 위에 모여 있어야 합니다.** 중간에 두면 무시됩니다.
4. **한 게임만 쓰는 규칙을 `_` 파일에 적지 마세요.** 그러면 다시 겹칩니다.
5. 새 미니게임을 만들면 여기 파일 하나를 더 만들고,
   `css/day-prep-minigames.css` 또는 `css/minigames.css` 에 `@import` 한 줄만 넣습니다.

## 쪼갠 뒤 확인한 것

`tools/*-visual-smoke.html` 13개를 헤드리스 크롬으로 열어
모든 요소의 **계산된 스타일과 자리**를 쪼개기 전/후로 비교했고,
11개가 완전히 같았습니다. 남은 2개는 CSS 가 아니라 게임 쪽 무작위였습니다.

- `e4-tracking` : 계속 움직이는 게이지 바늘
- `e8-skewer` : `Math.random()` 으로 매번 섞이는 꼬치 순서
