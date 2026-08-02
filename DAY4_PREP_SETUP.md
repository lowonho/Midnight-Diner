# Day 4 준비 구현/에셋 연결

## 실행 순서

Day 4 필수 작업은 다음 순서로 잠깁니다.

1. 떡 불려두기
2. 양배추(8) → 대파(7) → 어묵(6) 빠른 칼질
3. 떡볶이 양념장 계량
4. 감자 채칼 10회
5. 새우튀김 빵가루 작업과 같은 랜덤 2키 교차 입력으로 감자 전분 털기 12회

다섯 작업이 모두 끝나야 `영업 시작` 버튼이 활성화됩니다. 떡볶이는 기존 냄비 화력 조절, 감자튀김은 기존 튀김 조리를 사용합니다.

## 인스펙터/참조

이 프로젝트는 Unity가 아니라 Phaser/DOM 웹게임이므로 인스펙터 연결은 없습니다. `index.html`이 `day4-prep-data.js`를 `day-prep-minigames.js`보다 먼저 로드하며, 선택 이미지가 아래 경로에 있으면 자동 사용합니다. 파일이 없으면 CSS 임시 그래픽으로 안전하게 대체됩니다.

## 선택 이미지 경로

- `assets/prep/day4/tteokbokki/soak-empty.png`
- `assets/prep/day4/tteokbokki/soak-tteok.png`
- `assets/prep/day4/tteokbokki/soak-water.png`
- `assets/prep/day4/tteokbokki/soak-complete.png`
- `assets/minigame/E1/cabbage-0.png` ~ `cabbage-12.png`
- `assets/minigame/E1/green-onion-0.png` ~ `green-onion-7.png`
- `assets/minigame/E1/fish-cake-0.png` ~ `fish-cake-4.png`
- `assets/prep/day4/fries/potato-0.png` ~ `potato-10.png`
- `assets/prep/day4/fries/starch-0.png`
- `assets/prep/day4/fries/starch-35.png`
- `assets/prep/day4/fries/starch-70.png`
- `assets/prep/day4/fries/starch-100.png`

권장 PNG 배경은 투명, 작업물 기준 크기는 512×256 또는 512×512입니다. E1 칼질 재료와 칼 이미지는 모두 `assets/minigame/E1/`에서 관리합니다.

## QA 테스트

1. Live Server로 `index.html?qa=1`을 엽니다.
2. 새 QA 세션을 시작하고 패널의 `D4` 또는 `Alt+4`를 누릅니다.
3. 필수 메뉴인 떡볶이와 감자튀김을 확정합니다.
4. 해금 안내가 한 번만 표시되는지 확인합니다.
5. 카운터의 준비물을 왼쪽부터 상호작용해 다섯 단계를 완료합니다. 전분 털기는 화면에 랜덤으로 선택된 두 알파벳 키를 번갈아 12회 누릅니다.
6. 각 단계 전에는 다음 단계 상호작용이 거부되고, 완료 후 체크 표시가 생기는지 확인합니다.
7. 영업 시작 버튼이 4/5까지 비활성, 5/5에서 활성인지 확인합니다.
8. 영업을 시작해 떡볶이 냄비 조리와 감자튀김 튀김 조리가 시작되는지 확인합니다.
9. D1~D3으로 이동해 기존 타이밍 칼질과 Day 3 채칼/소스/튀김옷 흐름이 유지되는지 확인합니다.
10. D4에서 닭꼬치를 추가 선택해 닭고기 0.42초 이상 홀드 → 해제 → Space 재입력으로 5조각이 잘리는지 확인합니다.

키 반복 방지는 브라우저 `keydown.repeat`를 무시해 처리하므로 WebGL 캔버스가 포커스를 가진 상태에서도 키 홀드가 연속 입력으로 계산되지 않습니다.
