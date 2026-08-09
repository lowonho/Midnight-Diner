# Day 1 준비 미니게임 에셋 연결 규격

이 폴더 아래에 아래 이름의 투명 PNG 파일을 추가하면 별도 JavaScript 수정 없이 CSS 프로토타입 대신 자동으로 표시됩니다. 파일이 없거나 로드되지 않으면 기존 CSS 도형이 계속 사용됩니다.

## 파일 경로

```text
assets/prep/
├─ radish/
│  ├─ radish-0.png        # 썰기 전
│  ├─ radish-1.png        # 1회 성공
│  ├─ radish-2.png        # 2회 성공
│  ├─ radish-3.png        # 3회 성공
│  └─ radish-4.png        # 완료
├─ anchovy/
│  ├─ anchovy-body.png    # 머리와 분리된 몸통
│  └─ anchovy-head.png    # 클릭할 머리
├─ kimchi/
│  ├─ kimchi-cut-0.png    # 썰기 전
│  ├─ kimchi-cut-1.png    # 1회 성공
│  ├─ kimchi-cut-2.png    # 2회 성공
│  ├─ kimchi-cut-3.png    # 썰기 완료
│  ├─ frying-pan.png      # 손잡이를 포함한 팬 전체
│  └─ frying-kimchi.png   # 팬 위에 겹칠 김치
└─ effects/
   └─ knife.png           # 선택 사항인 칼질 순간 효과
```

## 제작 기준

- 모든 파일은 투명 배경 PNG를 권장합니다.
- 같은 작업의 단계별 이미지는 캔버스 크기와 중심 위치를 동일하게 맞춥니다.
- 무·김치 썰기 이미지는 가로형, 멸치는 머리와 몸통의 결합 위치가 자연스럽도록 제작합니다.
- 멸치 클릭 판정은 이미지의 불투명 영역이 아니라 기존 머리/몸통 버튼 영역을 사용하므로 에셋을 바꿔도 게임 판정은 유지됩니다.
- 팬 이미지는 손잡이를 포함하고, `frying-kimchi.png`는 팬 중앙에 겹쳐질 수 있도록 여백을 최소화합니다.
- 권장 작업 캔버스: 무·김치 640×200, 멸치 몸통 160×64, 멸치 머리 64×64, 팬 640×300, 볶는 김치 320×140, 칼 160×160.

경로를 변경해야 할 때만 `js/day-prep-minigames.js`의 `DAY_PREP_ASSET_PATHS`를 수정하면 됩니다.
