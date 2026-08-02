# Midnight Diner 효과음 제작 체크리스트

배경음악과 청소 미니게임은 제외한다. 요리 소리를 중심으로 총 38개를 제작하며, 반복 변형은 별도 파일을 늘리지 않고 게임에서 재생 속도와 좌우 위치를 조금씩 바꾸는 방식으로 처리한다.

## 전체 수량

| 제작 단계 | 기준 | 개수 |
|---|---|---:|
| 1차 · 필수 | 조리 상태를 들려주는 루프와 핵심 손맛 | 20 |
| 2차 · 재료 디테일 | 코팅·붓기·배치·멸치 손질 | 13 |
| 3차 · 최소 시스템음 | 오답·결과·타이머·서빙·UI | 5 |
| 합계 | 청소 효과음 제외 | **38** |

## 1차 · 필수 제작 20개

이 단계만 완성해도 썰고, 볶고, 끓이고, 굽고, 튀기는 느낌이 대부분 전달된다.

| 순위 | 엔진 | 파일명 | 설명 | 검색어 | 규격 | 완료 |
|---:|---|---|---|---|---|:---:|
| 1 | E3·E5 | `sfx_pan_sizzle_loop` | 김치볶기와 김치전 굽기에 공통으로 깔리는 팬 지글거림 | `food sizzling in frying pan loop` | 3~6초 무봉제 루프 | ☐ |
| 2 | E6 | `sfx_deep_fry_loop` | 새우와 감자가 기름에서 튀겨지는 강한 지속음 | `deep fryer bubbling loop` | 3~6초 무봉제 루프 | ☐ |
| 3 | E3 | `sfx_griddle_sizzle_loop` | 볶음우동 철판의 넓고 강한 지글거림 | `teppanyaki griddle sizzling loop` | 3~6초 무봉제 루프 | ☐ |
| 4 | E4 | `sfx_gas_flame_loop` | 어묵탕과 떡볶이 냄비 아래의 가스불 | `gas stove flame loop` | 3~6초 무봉제 루프 | ☐ |
| 5 | E4 | `sfx_clear_simmer_loop` | 어묵탕처럼 맑은 국물이 잔잔하게 끓는 소리 | `soup simmering pot loop` | 3~6초 무봉제 루프 | ☐ |
| 6 | E4 | `sfx_thick_boil_loop` | 떡볶이처럼 걸쭉한 소스가 큰 기포로 끓는 소리 | `thick sauce bubbling loop` | 3~6초 무봉제 루프 | ☐ |
| 7 | E1 | `sfx_knife_swing` | 모든 칼질에서 칼이 빠르게 내려오는 공기 가르기 | `kitchen knife chop whoosh` | 0.08~0.2초 | ☐ |
| 8 | E1 | `sfx_cut_crisp` | 무·양배추·대파처럼 아삭한 채소 절단 | `crispy vegetable chopping sound` | 0.1~0.25초 | ☐ |
| 9 | E1 | `sfx_cut_soft` | 두부·어묵처럼 부드럽고 촉촉한 재료 절단 | `soft food cutting sound` | 0.1~0.25초 | ☐ |
| 10 | E1 | `sfx_cut_wet` | 김치처럼 젖은 채소를 자르는 소리 | `wet vegetable chop sound` | 0.1~0.3초 | ☐ |
| 11 | E1 | `sfx_cut_meat` | 닭고기를 묵직하게 절단하는 소리 | `raw chicken chopping sound` | 0.15~0.3초 | ☐ |
| 12 | E3 | `sfx_metal_scrape` | 철판 뒤집개로 철판과 우동면을 미는 소리 | `metal spatula griddle scrape` | 0.15~0.4초 | ☐ |
| 13 | E3 | `sfx_wood_stir` | 나무 주걱으로 김치를 팬에서 미는 소리 | `wooden spatula stirring pan sound` | 0.15~0.35초 | ☐ |
| 14 | E12 | `sfx_mandoline_slide` | 채칼 위로 양배추·당근·감자를 빠르게 미는 소리 | `mandoline slicer vegetable sound` | 0.1~0.25초 | ☐ |
| 15 | E6 | `sfx_fry_basket_lift` | 금속 바스켓을 기름 위로 들어 올리는 소리 | `deep fryer basket lift sound` | 0.3~0.6초 | ☐ |
| 16 | E6 | `sfx_fry_basket_shake` | 바스켓을 탁 움직여 기름을 터는 소리 | `fryer basket shake metal sound` | 0.12~0.3초 | ☐ |
| 17 | E5 | `sfx_pancake_flip` | 김치전이 떠올라 뒤집힌 뒤 팬에 착지하는 전체 동작 | `pancake flip pan landing sound` | 0.4~0.8초 | ☐ |
| 18 | E5 | `sfx_charcoal_grill_loop` | 닭꼬치 아래 숯불과 떨어지는 기름의 지속음 | `charcoal grill sizzling loop` | 3~6초 무봉제 루프 | ☐ |
| 19 | E9 | `sfx_whisk_mix_loop` | 거품기로 걸쭉한 김치전 반죽을 계속 젓는 소리 | `whisking thick batter loop` | 2~4초 무봉제 루프 | ☐ |
| 20 | 공통 | `sfx_input_wrong` | 잘못된 방향·순서·타이밍을 알리는 낮고 짧은 둔탁음 | `soft game wrong input sound` | 0.15~0.3초 | ☐ |

## 2차 · 재료 디테일 13개

| 순위 | 엔진 | 파일명 | 설명 | 검색어 | 규격 | 완료 |
|---:|---|---|---|---|---|:---:|
| 21 | E2 | `sfx_dry_shake` | 감자 전분 봉투와 새우 밀가루·빵가루를 흔드는 마른 소리 | `plastic bag powder shake sound` | 0.15~0.35초 | ☐ |
| 22 | E2 | `sfx_wet_coat` | 새우를 계란물 안에서 굴리는 끈적한 출렁임 | `egg wash slosh sound` | 0.15~0.35초 | ☐ |
| 23 | E5 | `sfx_skewer_turn` | 닭꼬치 한 개를 집어 반대쪽으로 돌리는 소리 | `wooden skewer turning grill sound` | 0.15~0.35초 | ☐ |
| 24 | E7·E8·E11 | `sfx_pour_thin` | 간장·고추기름·물·육수처럼 묽은 액체 흐름 | `thin liquid pouring into bowl` | 1~2초 | ☐ |
| 25 | E7 | `sfx_pour_syrup` | 올리고당처럼 점성이 있는 시럽 흐름 | `thick syrup pouring sound` | 1~2초 | ☐ |
| 26 | E7 | `sfx_pour_thick` | 고추장·굴소스처럼 걸쭉한 소스가 떨어지는 소리 | `thick sauce squeeze pour sound` | 1~2초 | ☐ |
| 27 | E8 | `sfx_ingredient_dry_dump` | 부침가루 같은 마른 가루를 볼에 붓는 소리 | `flour pouring into bowl sound` | 0.4~0.8초 | ☐ |
| 28 | E8·E11 | `sfx_ingredient_wet_drop` | 김치·떡·우동·무·어묵·멸치를 볼이나 냄비에 넣는 소리 | `food dropping into bowl sound` | 0.15~0.4초 | ☐ |
| 29 | E8 | `sfx_skewer_pierce` | 닭과 파를 나무 꼬치에 꽂는 작은 관통음 | `food piercing wooden skewer sound` | 0.1~0.25초 | ☐ |
| 30 | E10 | `sfx_anchovy_tension` | 멸치 머리를 좌우로 흔들 때 접합부가 당겨지는 소리 | `small fish bone tension sound` | 0.1~0.25초 | ☐ |
| 31 | E10 | `sfx_anchovy_tear` | 멸치 머리가 몸통에서 뜯어지는 순간 | `small fish tearing sound` | 0.15~0.35초 | ☐ |
| 32 | E10 | `sfx_anchovy_head_land` | 분리된 멸치 머리가 도마에 작게 떨어지는 소리 | `small object drop wooden board` | 0.08~0.2초 | ☐ |
| 33 | E11 | `sfx_plate_place` | 두부와 볶은 김치를 접시에 부드럽게 내려놓는 소리 | `soft food placed on ceramic plate` | 0.15~0.35초 | ☐ |

## 3차 · 최소 시스템음 5개

| 순위 | 구분 | 파일명 | 설명 | 검색어 | 규격 | 완료 |
|---:|---|---|---|---|---|:---:|
| 34 | 결과 | `sfx_result_perfect` | PERFECT 결과에만 사용하는 맑고 만족스러운 성공음 | `perfect result sparkle chime` | 0.6~1초 | ☐ |
| 35 | 결과 | `sfx_result_good` | GOOD 결과에 사용하는 짧고 따뜻한 2음 | `casual game good result chime` | 0.4~0.7초 | ☐ |
| 36 | 제한시간 | `sfx_timer_warning` | 중요한 제한시간이 얼마 남지 않았을 때의 시계 경고 | `kitchen timer warning tick` | 0.05~0.15초 | ☐ |
| 37 | 서빙 | `sfx_food_serve` | 완성 접시를 손님 앞에 내려놓는 소리 | `ceramic plate serve table sound` | 0.2~0.5초 | ☐ |
| 38 | UI | `sfx_ui_click` | 메뉴·설정에만 사용하는 작고 부드러운 클릭 | `soft wooden UI click sound` | 0.05~0.1초 | ☐ |

## 수집 기준

- 검색 결과에 음악이 섞이면 검색어 뒤에 `SFX`, `sound effect`, `isolated`를 붙인다.
- `loop` 8개는 처음과 끝이 티 나지 않게 이어지는 음원이어야 한다.
- 주방 전체 소음이 섞인 원거리 녹음보다 해당 조리 행동만 가까이 녹음된 파일을 우선한다.
- 상업적 사용 가능 여부와 출처 표시 조건을 반드시 확인한다.
- 원본은 가능하면 48kHz/24bit WAV로 보관한다.
- 처음에는 항목당 한 파일만 준비한다. 반복감은 재생 속도 ±3%, 볼륨, 좌우 위치 변화로 줄인다.
