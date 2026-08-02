"use strict";

/* ============================================================
   낮 준비 미니게임 — 공용 부분

   게임 로직은 전부 engine-e1~e11 파일로 나갔습니다.
   여기 남은 것은 모든 낮 준비 게임이 함께 쓰는 것들뿐입니다.
     · 재료별 칼질 설정값 · 에셋 경로와 로더
     · 준비 미니게임을 열고 닫는 공통 절차
     · 엔진/시작함수 등록 창구

   [낮 준비가 밤 조리와 다른 점]
   밤 조리는 게임 하나가 끝날 때까지 종류가 그대로지만,
   낮 준비는 도중에 종류가 바뀝니다(반죽 재료 넣기 → 거품기 젓기).
   그래서 setDayPrepData 로 data 를 갈아끼울 때 엔진 이름도 함께 바꿉니다.
   엔진 이름은 data.mode 문자열을 그대로 씁니다.
   ============================================================ */

// 날짜별 준비 미니게임 모듈. 메뉴 Task ID별 진행 상태를 서로 분리합니다.
const DAY_PREP_MINI_CONFIG = {
  cutRadish:{title:"어묵탕 · 무 썰기",total:4,zoneWidth:.12,zoneStarts:[.14,.55,.29,.67],speed:.78},
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:4,zoneWidth:.14,zoneStarts:[.2,.58,.32,.68],speed:.8,horizontalLastCut:true},
  cutTofuKimchi:{title:"두부김치 · 김치 썰기",ingredient:"kimchi",total:5,zoneWidth:.16,zoneStarts:[.51,.18,.62,.34,.7],speed:.74},
  cutPancakeKimchi:{title:"김치전 · 김치 썰기",ingredient:"kimchi",total:5,zoneWidth:.16,zoneStarts:[.22,.58,.39,.68,.14],speed:.78},
  cutSkewerChicken:{title:"닭꼬치 · 닭 썰기",ingredient:"chicken",total:5,zoneWidth:.14,zoneStarts:[.18,.55,.31,.68,.42],speed:.8,requiresDoubleTap:true},
  cutSkewerGreenOnion:{title:"닭꼬치 · 대파 썰기",ingredient:"greenOnion",total:4,zoneWidth:.14,zoneStarts:[.56,.2,.65,.36],speed:.82},
  cutTofuBlock:{title:"두부김치 · 두부 썰기",ingredient:"tofu",total:6,zoneWidth:.14,zoneStarts:[.18,.56,.3,.67,.42,.22],speed:.78},
  cleanAnchovy:{title:"어묵탕 · 멸치 머리 떼기",total:7,timeLimit:25,requiredShakes:3,swingDistance:18}
};

// cycles 한 번 = ← → 두 번 (썰기 횟수 = cycles * 2)
const DAY3_MANDOLINE_CONFIG=Object.freeze({
  sliceYakisobaCabbage:{ingredient:"cabbage",label:"양배추",cycles:12},
  sliceYakisobaCarrot:{ingredient:"carrot",label:"당근",cycles:10}
});
const BREADCRUMB_KEY_PAIRS=Object.freeze([["a","d"],["q","e"],["f","j"],["z","c"],["j","l"]]);

// 아래 경로에 파일을 추가하면 CSS 프로토타입 대신 자동으로 이미지가 사용됩니다.
// 누락된 선택 에셋은 로딩 실패로 취급하지 않고 기존 CSS 도형으로 대체합니다.
const DAY_PREP_ASSET_PATHS = Object.freeze({
  radish0:"assets/prep/cutting/radish/radish-0.png",
  radish1:"assets/prep/cutting/radish/radish-1.png",
  radish2:"assets/prep/cutting/radish/radish-2.png",
  radish3:"assets/prep/cutting/radish/radish-3.png",
  radish4:"assets/prep/cutting/radish/radish-4.png",
  fishCake0:"assets/prep/cutting/fish-cake/fish-cake-0.png",
  fishCake1:"assets/prep/cutting/fish-cake/fish-cake-1.png",
  fishCake2:"assets/prep/cutting/fish-cake/fish-cake-2.png",
  fishCake3:"assets/prep/cutting/fish-cake/fish-cake-3.png",
  fishCake4:"assets/prep/cutting/fish-cake/fish-cake-4.png",
  kimchiCut0:"assets/prep/cutting/kimchi/kimchi-0.png",
  kimchiCut1:"assets/prep/cutting/kimchi/kimchi-1.png",
  kimchiCut2:"assets/prep/cutting/kimchi/kimchi-2.png",
  kimchiCut3:"assets/prep/cutting/kimchi/kimchi-3.png",
  kimchiCut4:"assets/prep/cutting/kimchi/kimchi-4.png",
  kimchiCut5:"assets/prep/cutting/kimchi/kimchi-5.png",
  chicken0:"assets/prep/cutting/chicken/chicken-0.png",
  chicken1:"assets/prep/cutting/chicken/chicken-1.png",
  chicken2:"assets/prep/cutting/chicken/chicken-2.png",
  chicken3:"assets/prep/cutting/chicken/chicken-3.png",
  chicken4:"assets/prep/cutting/chicken/chicken-4.png",
  chicken5:"assets/prep/cutting/chicken/chicken-5.png",
  greenOnion0:"assets/prep/cutting/green-onion/green-onion-0.png",
  greenOnion1:"assets/prep/cutting/green-onion/green-onion-1.png",
  greenOnion2:"assets/prep/cutting/green-onion/green-onion-2.png",
  greenOnion3:"assets/prep/cutting/green-onion/green-onion-3.png",
  greenOnion4:"assets/prep/cutting/green-onion/green-onion-4.png",
  tofu0:"assets/prep/cutting/tofu/tofu-0.png",
  tofu1:"assets/prep/cutting/tofu/tofu-1.png",
  tofu2:"assets/prep/cutting/tofu/tofu-2.png",
  tofu3:"assets/prep/cutting/tofu/tofu-3.png",
  tofu4:"assets/prep/cutting/tofu/tofu-4.png",
  tofu5:"assets/prep/cutting/tofu/tofu-5.png",
  tofu6:"assets/prep/cutting/tofu/tofu-6.png",
  // 멸치 손질 (engine-e10). assets/minigame/E10/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //   whole 4종  도마 위 멸치. 머리와 몸통이 따로라 붙여 놓는 좌표는
  //              css/day-prep-minigames.css 의 .anchovy.v01~v04 변수가 갖고 있습니다.
  //   innards    머리를 뜯을 때 딸려 나오는 멸치 똥
  //   wholeGroup 손질 **전** 통멸치 묶음 → E10(머리 떼기)의 재료 카드
  //   group      손질 **후** 멸치 묶음   → E11(어묵탕에 넣기)의 재료 카드·냄비(osAnchovy)
  //              두 그림이 섞이면 "머리를 떼기 전인데 이미 손질된 멸치" 가 보입니다.
  ...Object.fromEntries(["01","02","03","04"].flatMap(no=>[
    [`anchovyBody${no}`,`assets/minigame/E10/food_anchovy_whole_${no}_body.webp`],
    [`anchovyHead${no}`,`assets/minigame/E10/food_anchovy_whole_${no}_head.webp`]
  ])),
  anchovyInnards:"assets/minigame/E10/food_anchovy_innards.webp",
  anchovyWholeGroup:"assets/minigame/E10/food_anchovy_whole_group_3.webp",
  anchovyGroup:"assets/minigame/E10/food_anchovy_cleaned_group.webp",
  // 닭꼬치 꽂기 (engine-e8). assets/minigame/E8/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //   piece  꼬치에 꽂히는 조각 한 개 (512x448 캔버스 한가운데)
  //   group  좌측 재료 카드에 놓는 묶음 그림
  skewerChicken:"assets/minigame/E8/food_skewer_chicken_piece.webp",
  skewerGreenOnion:"assets/minigame/E8/food_skewer_green_onion_piece.webp",
  skewerChickenGroup:"assets/minigame/E8/food_skewer_chicken_group.webp",
  skewerGreenOnionGroup:"assets/minigame/E8/food_skewer_green_onion_group.webp",
  skewerStick:"assets/minigame/E8/prop_skewer_stick.webp",
  // 김치전 반죽 재료 넣기 (engine-e8). assets/minigame/E8/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //   재료 3장   왼쪽 재료 카드에 놓는 그림 (부침가루 · 물컵 · 썰어 둔 김치)
  //   볼 9장     **넣은 재료 조합마다 한 장**입니다. 어느 장을 쓸지는
  //              engine-e8-order-place.js 의 BATTER_BOWL_ASSETS 가 고릅니다.
  //              08(kimchi_flour) 과 11(flour_kimchi) 은 재료가 같고 넣은 순서만
  //              다른 두 장이라, 그 순서 그대로 키를 나눠 두 장 다 씁니다.
  batterFlour:"assets/minigame/E8/02_food_pancake_flour_panel.webp",
  batterWater:"assets/minigame/E8/03_food_water_cup_panel.webp",
  batterKimchi:"assets/minigame/E8/01_food_kimchi_chopped_panel.webp",
  batterBowlEmpty:"assets/minigame/E8/04_food_kimchi_batter_bowl_empty.webp",
  batterBowlWater:"assets/minigame/E8/05_food_kimchi_batter_bowl_water.webp",
  batterBowlFlour:"assets/minigame/E8/06_food_kimchi_batter_bowl_flour.webp",
  batterBowlKimchi:"assets/minigame/E8/07_food_kimchi_batter_bowl_kimchi.webp",
  batterBowlKimchiFlour:"assets/minigame/E8/08_food_kimchi_batter_bowl_kimchi_flour.webp",
  batterBowlWaterFlour:"assets/minigame/E8/09_food_kimchi_batter_bowl_water_flour.webp",
  batterBowlWaterKimchi:"assets/minigame/E8/10_food_kimchi_batter_bowl_water_kimchi.webp",
  batterBowlFlourKimchi:"assets/minigame/E8/11_food_kimchi_batter_bowl_flour_kimchi.webp",
  batterBowlAll:"assets/minigame/E8/12_food_kimchi_batter_bowl_all_unmixed.webp",
  // 젓기(engine-e9)가 쓰는 빈 볼. 반죽 그림이 볼까지 통째로 그려 주므로 실제로는 안 쓰입니다.
  // (파일이 없어 hasDayPrepAsset 이 false 이고, .has-mix-art 가 CSS 임시 볼도 끕니다)
  batterBowl:"assets/prep/batter/bowl.png",
  // 김치전 반죽 젓기 (engine-e9). assets/minigame/E9/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //
  //   batterMix0~9  저을수록 이어 붙는 **연속 그림 10장**입니다. 0 = 안 섞인 재료,
  //                 9 = 완성. 진행도(0~100%)를 10칸으로 나눠 한 장씩 겹쳐 넘깁니다.
  //   ⚠️ 배열 순서가 곧 재생 순서입니다. 파일 번호가 아닙니다 — 납품에 09 가 빠져 있어
  //      08 다음이 10 입니다. 나중에 09 가 오면 여기와 tools/build-minigame-art-webp.js
  //      두 곳의 배열에 같은 자리로 끼워 넣으면 됩니다.
  //   ⚠️ E8 의 볼 9장과 섞지 마세요. E8 은 위에서 비스듬히 본 볼이고,
  //      E9 는 원을 그리는 조작에 맞춘 **정면에서 내려다본** 볼입니다.
  ...Object.fromEntries([
    "01_food_kimchi_batter_mix_stage1_unmixed","02_food_kimchi_batter_mix_stage2_b",
    "03_food_kimchi_batter_mix_stage2_c","04_food_kimchi_batter_mix_stage3_a",
    "05_food_kimchi_batter_mix_stage3_b","06_food_kimchi_batter_mix_stage3_c",
    "07_food_kimchi_batter_mix_stage4_a","08_food_kimchi_batter_mix_stage4_b",
    "10_food_kimchi_batter_mix_stage4_c","11_food_kimchi_batter_mix_stage5_complete"
  ].map((name,index)=>[`batterMix${index}`,`assets/minigame/E9/${name}.webp`])),
  //   거품기 3종 — 반죽이 얼마나 묻었는지로 나뉩니다. 어느 것을 쓸지는
  //   engine-e9-whisk.js 의 WHISK_CONFIG.whiskAssets 가 정합니다.
  whiskClean:"assets/minigame/E9/12_prop_whisk_clean.webp",         // 아직 안 저었을 때
  whiskLight:"assets/minigame/E9/13_prop_whisk_batter_light.webp",  // 젓다가 손을 뗐을 때
  whiskMedium:"assets/minigame/E9/14_prop_whisk_batter_medium.webp",// 젓는 중
  // 오른쪽 '참고 모양'(고르게 섞인 반죽)은 마지막 장과 같은 그림입니다.
  batterDone:"assets/minigame/E9/11_food_kimchi_batter_mix_stage5_complete.webp",
  // 소스 제조 (engine-e7). assets/minigame/E7/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //
  //   소스볼 4장 x 2레시피 — **넣은 재료 개수**가 곧 장 번호입니다 (0 빈 볼 → 3 완성).
  //   ⚠️ 파일 이름은 레시피 순서대로 재료가 쌓인 모습이지만, 실제로는 어떤 순서로
  //      부어도 개수만 보고 고릅니다. 넣을 때마다 색이 짙어지는 연출이 목적이라
  //      순서까지 맞춘 조합 그림(E8 반죽 9장 꼴)은 받지 않았습니다.
  //      순서별 그림을 쓰려면 조합마다 한 장씩(2^3) 더 받아야 합니다.
  sauceBowlTteokbokki0:"assets/minigame/E7/01_food_tteokbokki_sauce_bowl_empty.webp",
  sauceBowlTteokbokki1:"assets/minigame/E7/02_food_tteokbokki_sauce_bowl_gochujang.webp",
  sauceBowlTteokbokki2:"assets/minigame/E7/03_food_tteokbokki_sauce_bowl_gochujang_oligosaccharide.webp",
  sauceBowlTteokbokki3:"assets/minigame/E7/04_food_tteokbokki_sauce_bowl_final.webp",
  sauceBowlYakisoba0:"assets/minigame/E7/01_food_yakisoba_sauce_bowl_empty.webp",
  sauceBowlYakisoba1:"assets/minigame/E7/02_food_yakisoba_sauce_bowl_soy.webp",
  sauceBowlYakisoba2:"assets/minigame/E7/03_food_yakisoba_sauce_bowl_soy_oyster.webp",
  sauceBowlYakisoba3:"assets/minigame/E7/04_food_yakisoba_sauce_bowl_complete.webp",
  //   소스통 3장 x 2레시피 — 조리대 위 소스통과 왼쪽 재료 카드가 **같은 장**을 씁니다.
  //   ⚠️ 간장은 두 레시피에 다 나오지만 납품 그림이 서로 달라 키를 나눕니다.
  //      그래서 키가 재료 id 하나가 아니라 `레시피 + 재료` 입니다
  //      (engine-e7-measure.js 의 SAUCE_ASSET_KEY).
  sauceBottleTteokbokkiGochujang:"assets/minigame/E7/food_tteokbokki_sauce_play_gochujang.webp",
  sauceBottleTteokbokkiOligosaccharide:"assets/minigame/E7/food_tteokbokki_sauce_play_oligosaccharide.webp",
  sauceBottleTteokbokkiSoy:"assets/minigame/E7/food_tteokbokki_sauce_play_soy_sauce.webp",
  sauceBottleYakisobaSoy:"assets/minigame/E7/food_yakisoba_soy_sauce_play_labeled.webp",
  sauceBottleYakisobaOyster:"assets/minigame/E7/food_yakisoba_oyster_sauce_play_labeled.webp",
  sauceBottleYakisobaChili:"assets/minigame/E7/food_yakisoba_chili_oil_play_labeled.webp",
  //   뚜껑 연 소스통 3장 x 2레시피 — 병을 눌러 들어 올리는 동안만 이 그림으로 바뀝니다.
  //   키는 위 닫힌 병 키에 Open 을 붙인 이름입니다 (engine-e7-measure.js 의 sauceBottleOpenAssetKey).
  //   ⚠️ 닫힌 병과 **캔버스가 다릅니다** — 뚜껑을 뺀 만큼 짧은 것도 있고, 고추기름은
  //      젖힌 뚜껑이 위로 삐져나와 오히려 큽니다. 그래서 같은 상자에 contain 으로
  //      넣으면 안 되고, 닫힌 병과 같은 배율로 겹쳐야 합니다. 계산은 두 곳에
  //      나뉘어 있습니다 — 크기는 tools/build-minigame-art-webp.js,
  //      화면에 앉히는 자리는 engine-e7-measure.js 의 sauceOpenBottleStyle.
  sauceBottleTteokbokkiGochujangOpen:"assets/minigame/E7/food_tteokbokki_gochujang_play_open.webp",
  sauceBottleTteokbokkiOligosaccharideOpen:"assets/minigame/E7/food_tteokbokki_oligosaccharide_play_open.webp",
  sauceBottleTteokbokkiSoyOpen:"assets/minigame/E7/food_tteokbokki_soy_sauce_play_open.webp",
  sauceBottleYakisobaSoyOpen:"assets/minigame/E7/food_yakisoba_soy_sauce_play_open.webp",
  sauceBottleYakisobaOysterOpen:"assets/minigame/E7/food_yakisoba_oyster_sauce_play_open.webp",
  sauceBottleYakisobaChiliOpen:"assets/minigame/E7/food_yakisoba_chili_oil_play_open.webp",
  //   소스통 → 볼 화살표. **아래 E2 새우와 같은 파일**입니다 (납품본이 바이트까지
  //   같아 공용 폴더 한 장으로 합쳤습니다). E7 은 이 한 장을 CSS 에서 돌려 →·←·↓ 로 씁니다.
  sauceArrow:"assets/minigame/ui_arrow_right_01.webp",
  // 부어지는 줄기는 아직 CSS 도형입니다. 흰색 실루엣 마스크 3장을 아래 경로에
  // 넣으면 재료 색은 E7 설정값(SAUCE_RECIPES 의 color)으로 입혀집니다.
  sauceFlowThin:"assets/prep/sauce/flow-thin.png",
  sauceFlowSyrup:"assets/prep/sauce/flow-syrup.png",
  sauceFlowThick:"assets/prep/sauce/flow-thick.png",
  // 김치 볶기 (engine-e3). 화구는 아래 burnerGas1~3 레이어입니다.
  // ⚠️ fryingPan 은 **E5 김치전 굽기와 공용**입니다 (같은 후라이팬).
  //    손잡이까지 들어 있는 그림이라 몸통은 전체 폭의 79.7% 뿐입니다.
  //    자리 잡는 방법은 css/day-prep-minigames.css 의 .frying-pan 주석 참고.
  fryingPan:"assets/minigame/E3/fix_frying_pan_wide_inner_4x.webp",
  fryingKimchi:"assets/prep/kimchi/frying-kimchi.png",
  fryWoodenSpatula:"assets/prep/kimchi/wooden-spatula.png",
  // 왼쪽 재료 카드 2장 — assets/minigame/E3/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  fryIngKimchi:"assets/minigame/E3/food_kimchi_sliced.webp",
  fryIngSugar:"assets/minigame/E3/food_sugar.webp",
  // 볶음우동 철판 볶기 (engine-e3 · 밤 조리). 볶이는 면은 아직 CSS 임시 도형입니다.
  // ⚠️ stirGriddle 은 이제 **불이 빠진 철판 한 장**입니다. 불은 따로 깔리는
  //    화구 레이어(burnerGriddle1~3)가 그립니다.
  stirGriddle:"assets/minigame/E3/fix_griddle_plate_wide_mild_trapezoid_4x.webp",
  stirNoodles:"assets/prep/yakisoba/noodles.png",
  stirTeppanSpatula:"assets/prep/yakisoba/teppan-spatula.png",
  // 왼쪽 재료 카드 3장 — assets/minigame/E3/ 의 납품 에셋입니다.
  stirIngUdon:"assets/minigame/E3/food_udon_noodles.webp",
  stirIngSauce:"assets/minigame/E3/food_udon_sauce.webp",
  stirIngVeggie:"assets/minigame/E3/food_udon_vegetables.webp",
  // 방향 화살표 4종 — 김치 볶기와 볶음우동이 **함께** 씁니다 (같은 컨트롤러).
  // 아래 화살표 칩 안과 오른쪽 '다음 순서' 칸 두 자리에 같은 파일이 들어갑니다.
  // 키 이름은 engine-e3-direction-seq.js 의 방향 문자열(left/up/right/down)에서
  // directionArrowAssetKey() 가 그대로 만들어 냅니다 — 한쪽만 고치면 그림이 사라집니다.
  // ⚠️ 칩의 나무틀은 여기 없습니다. 다른 UI 틀과 같은 배경 그림이라
  //    css/day-prep-minigames.css(.kf-chip) · css/minigames.css(.yk-chip) 가 직접 씁니다.
  ...Object.fromEntries(["left","up","right","down"].map(way=>
    [`arrow${way[0].toUpperCase()}${way.slice(1)}`,`assets/minigame/E3/ui_arrow_${way}.webp`])),
  // 화구 2종 x 3장 — 조리기구(팬·철판)와 분리된 바닥 레이어입니다.
  //   gas      가스버너   → E3 김치 볶기(engine-e3) · E5 김치전 굽기(engine-e5)
  //   griddle  철판 화구  → E3 볶음우동(engine-e3)
  // 3장은 불이 흔들리는 애니메이션 프레임이고, 번호 순서가 곧 재생 순서입니다.
  // ⚠️ 가스버너 납품본은 세로가 612/616/607 로 장마다 달랐고 02 장은 몸통이 바닥에서
  //    2px 떠 있어 화구가 들썩였습니다. 지금은 여백만 덧대 세 장 모두 1412x616 입니다.
  //    새 납품본을 넣을 때도 세 장의 캔버스를 맞춰 주세요.
  //    (css/minigame-parts.css 의 .mg-burner-frame · tools/build-minigame-art-webp.js)
  ...Object.fromEntries(["01","02","03"].flatMap((no,index)=>[
    [`burnerGas${index+1}`,`assets/minigame/E3/fix_gas_burner_low_fire_${no}.webp`],
    [`burnerGriddle${index+1}`,`assets/minigame/E3/fix_griddle_burner_fire_${no}.webp`]
  ])),
  // 냄비 화구 (E4 끓이기). 위 두 화구와 같은 방식의 3장짜리 바닥 레이어입니다.
  // 불꽃이 그림에 함께 그려져 있어 E4 의 CSS 불꽃 도형을 대신합니다.
  ...Object.fromEntries(["01","02","03"].map((no,index)=>
    [`burnerPot${index+1}`,`assets/minigame/E4/fix_gas_burner_integrated_redraw_fire_${no}.webp`])),
  // 그 화구의 손잡이 한 장. 위 3장에 **이미 그려져 있는** 손잡이 자리에 그대로 겹쳐
  // 놓고 불 세기에 따라 돌립니다(그림 쪽 손잡이는 늘 꺼진 자리에 멈춰 있습니다).
  // 자리·크기는 css/minigame-parts.css 의 .mg-burner-knob 이 갖고 있습니다.
  burnerPotKnob:"assets/minigame/E4/fix_gas_burner_off.webp",
  /* 끓는 냄비 (engine-e4) — 메뉴 2종 x 끓는 세기 3단계 x 4장.
     4장이 한 바퀴 도는 스프라이트이고, 세기는 온도 구간이 고릅니다.
       weak   온도 낮음   medium 적정 온도   strong 과열
     키 이름은 boil{Oden|Tteokbokki}{Weak|Medium|Strong}1~4 입니다 —
     engine-e4-gauge-hold.js 의 heatBoilAssetKey 가 같은 규칙으로 만들어 씁니다. */
  ...Object.fromEntries([["Oden","eomuk_tang"],["Tteokbokki","tteokbokki"]].flatMap(([dishKey,dishFile])=>
    [["Weak","weak"],["Medium","medium"],["Strong","strong"]].flatMap(([levelKey,levelFile])=>
      ["01","02","03","04"].map((no,index)=>
        [`boil${dishKey}${levelKey}${index+1}`,`assets/minigame/E4/food_${dishFile}_boil_${levelFile}_${no}.webp`])))),
  /* 채칼 (engine-e2). PNG 가 마스터이고 여기서 쓰는 WebP 는
     tools/build-minigame-art-webp.js 산출물입니다.

     [채칼 · 채반은 낱장이지만 한 덩어리로 놓입니다]
     납품에 함께 온 합본(prop_mandoline_basket_empty)에서 두 낱장의 배율과
     자리를 역산해 css/day-prep-minigames.css 의 --md-rig-* 로 옮겼습니다.
     둘 중 하나만 크기를 바꾸면 합본 모양이 깨집니다.

     [판 위에서 썰리는 재료 — whole 01~08]
     01 이 안 썰린 모습이고 08 이 다 썬 모습입니다. 진행도에 맞춰 갈아 끼웁니다.
     ⚠️ 재료 카드용 그림(mandolineCard*)과 키를 일부러 나눠 두었습니다 —
        같은 키를 쓰면 카드에도 깎이는 그림이 들어갑니다.

     도마는 <img> 가 아니라 칸 배경으로 깝니다 —
     css/day-prep-minigames.css 의 "나무 도마" 구역
     (assets/minigame/fix_tempura_prep_board · E1 썰기 · 새우튀김 준비와 공용) */
  mandolinePlate:"assets/minigame/E2/prop_mandoline_empty.webp",
  mandolineColander:"assets/minigame/E2/prop_bamboo_colander_empty.webp",
  mandolineArrow:"assets/minigame/E2/ui_arrow_horizontal_both.webp",
  mandolineCardCabbage:"assets/minigame/E2/food_cabbage_ingredient.webp",
  mandolineCardCarrot:"assets/minigame/E2/food_carrot_ingredient.webp",
  // 감자 카드만 판 위 그림의 첫 장(안 썰린 모습)을 그대로 씁니다.
  // 카드 자리(210 x 159.4)가 그림(560x425)의 2.7분의 1이라 따로 뽑을 필요가 없습니다.
  mandolineCardPotato:"assets/minigame/E2/food_potato_whole_01.webp",
  ...Object.fromEntries(["cabbage","carrot","potato"].flatMap(veg=>Array.from({length:8},(_,index)=>[
    `mandoline${veg.charAt(0).toUpperCase()}${veg.slice(1)}Whole${index+1}`,
    `assets/minigame/E2/food_${veg}_whole_0${index+1}.webp`
  ]))),
  knife:"assets/prep/effects/knife.png",
  ...Object.fromEntries(TTEOKBOKKI_CUT_SEQUENCE.flatMap(item=>item.progressSprites.map((src,index)=>[`${item.assetPrefix}${index}`,src]))),
  // 감자튀김 준비(봉투 흔들기). 봉투 그림 한 장에 감자채와 튀김가루가 함께 있고,
  // 숫자는 가루가 묻은 정도(%)입니다. 파일이 없으면 CSS 임시 봉투를 씁니다.
  friesShakeBag0:"assets/prep/day4/fries/shake-bag-0.png",
  friesShakeBag35:"assets/prep/day4/fries/shake-bag-35.png",
  friesShakeBag70:"assets/prep/day4/fries/shake-bag-70.png",
  friesShakeBag100:"assets/prep/day4/fries/shake-bag-100.png",
  friesPotatoStrips:"assets/prep/day4/fries/potato-strips.png",
  /* 새우튀김 준비 — assets/minigame/E2/shrimp/ 의 납품 에셋입니다.
     PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
     한 재료가 자리마다 다른 장을 씁니다 — 왼쪽 카드는 Ing(어두운 나무 그릇),
     가운데 판은 Vessel(위에서 내려다본 큰 그릇)입니다.
     도마(assets/minigame/fix_tempura_prep_board)는 CSS 배경이라 여기 없습니다
     (ui_play_tray_wood 와 같습니다). E1 썰기·E2 채썰기와 같은 장을 씁니다. */
  /* 그릇 사이 진행 화살표. 한 장을 두 자리에 씁니다(둘째는 CSS 에서 135도 회전).
     ⚠️ E7 소스 제조와 **같은 파일**이라 공용 폴더(assets/minigame/)에 있습니다.
        위 sauceArrow 와 같은 장이니 어느 한쪽만 갈아 끼울 수 없습니다. */
  shrimpArrow:"assets/minigame/ui_arrow_right_01.webp",
  shrimpVesselFlour:"assets/minigame/E2/shrimp/food_tempura_flour_bowl.webp",
  shrimpVesselEgg:"assets/minigame/E2/shrimp/food_egg_wash_bowl.webp",
  shrimpVesselBreadcrumbs:"assets/minigame/E2/shrimp/food_wet_breadcrumbs_bowl.webp",
  /* 새우 10장. 생새우 한 장에 옷 3종 x 묻은 정도 3단계입니다.
     어느 장을 언제 쓰는지는 engine-e2-alternate-input.js 의 SHRIMP_STATE_KEYS 참고. */
  shrimpStateRaw:"assets/minigame/E2/shrimp/food_shrimp_raw.webp",
  shrimpStateFlour1:"assets/minigame/E2/shrimp/food_shrimp_flour_light.webp",
  shrimpStateFlour2:"assets/minigame/E2/shrimp/food_shrimp_flour_medium.webp",
  shrimpStateFlour3:"assets/minigame/E2/shrimp/food_shrimp_flour_full.webp",
  shrimpStateEgg1:"assets/minigame/E2/shrimp/food_shrimp_egg_light.webp",
  shrimpStateEgg2:"assets/minigame/E2/shrimp/food_shrimp_egg_medium.webp",
  shrimpStateEgg3:"assets/minigame/E2/shrimp/food_shrimp_egg_full.webp",
  shrimpStateCrumbs1:"assets/minigame/E2/shrimp/food_shrimp_breadcrumb_light.webp",
  shrimpStateCrumbs2:"assets/minigame/E2/shrimp/food_shrimp_breadcrumb_medium.webp",
  shrimpStateCrumbs3:"assets/minigame/E2/shrimp/food_shrimp_breadcrumb_full.webp",
  // 왼쪽 재료 카드 4장
  shrimpIngRaw:"assets/minigame/E2/shrimp/food_shrimp_raw_panel.webp",
  shrimpIngFlour:"assets/minigame/E2/shrimp/food_tempura_flour_panel.webp",
  shrimpIngEgg:"assets/minigame/E2/shrimp/food_egg_wash_panel.webp",
  shrimpIngCrumbs:"assets/minigame/E2/shrimp/food_wet_breadcrumbs_panel.webp",
  // 단발 액션 (engine-e11 · 플레이팅 / 냄비에 넣기 / 육수 넣기).
  // 재료 그림은 카드·그릇·참고 모양에 같은 파일이 쓰입니다.
  // 그릇은 빈 그릇(osPlate/osPot)과 완성 참고용(osPlateDone/osPotDone) 두 장입니다.
  osTofuSlices:"assets/prep/one-shot/tofu-slices.png",
  osFriedKimchi:"assets/prep/one-shot/fried-kimchi.png",
  osRadish:"assets/prep/one-shot/radish.png",
  osFishCake:"assets/prep/one-shot/fish-cake.png",
  osAnchovy:"assets/minigame/E10/food_anchovy_cleaned_group.webp",   // 손질한 멸치 묶음 (E10 과 공용)
  osBroth:"assets/prep/one-shot/broth.png",
  osPlate:"assets/prep/one-shot/plate.png",
  osPlateDone:"assets/prep/one-shot/plate-done.png",
  osPot:"assets/prep/one-shot/pot.png",
  osPotDone:"assets/prep/one-shot/pot-done.png",
  // 김치전 굽기 · 닭꼬치 굽기 (engine-e5 · 밤 조리)의 왼쪽 재료 카드.
  // 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  // 김치전 반죽 그릇 — assets/minigame/E5/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  cookPancakeBatter:"assets/minigame/E5/food_kimchi_batter_bowl_mixed_oblique.webp",
  cookSkewerRaw:"assets/prep/two-side/skewer-raw.png",
  // 실제 조리 음식은 메뉴별 1장만 있으면 익힘 단계의 색·기포·그을음을 CSS로 합성합니다.
  cookPancakeFood:"assets/prep/two-side/pancake.png",
  cookSkewerFood:"assets/prep/two-side/skewer.png",
  /* E8 떡 · 우동면 불려두기.
     PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.

     ⚠️ 볼 그림은 **물이 찬 정도까지 한 장에 그려져 있습니다**(SOAK_WATER_STEPS).
        예전에는 빈 볼 한 장 위에 재료 조각과 물 높이를 CSS 로 얹었는데,
        지금은 아래 11장을 겹쳐 두고 갈아 끼웁니다 (engine-e8-order-place.js).
     ⚠️ 물병(soakWater)과 물방울(soakDrop)은 **한 장이 두 자리에 쓰입니다** —
        물병은 판 위 + 왼쪽 물 카드, 물방울은 오른쪽 목표 + 진행도 게이지입니다. */
  soakBowl:"assets/minigame/E8/Soaking/food_soak_bowl_empty.webp",
  soakWater:"assets/minigame/E8/Soaking/prop_soak_water_pitcher.webp",
  /* 붓는 자세 2장(25도 · 45도). 세워 둔 장을 CSS 로 돌리는 것이 아니라 갈아 끼웁니다 —
     돌리면 병 안의 물 면까지 같이 기울어 물이 한쪽 벽에 붙어 보입니다. */
  soakWaterTilt1:"assets/minigame/E8/Soaking/prop_soak_water_pitcher_tilt_01.webp",
  soakWaterTilt2:"assets/minigame/E8/Soaking/prop_soak_water_pitcher_tilt_02.webp",
  soakDrop:"assets/minigame/E8/Soaking/food_soak_water_ingredient.webp",
  // 왼쪽 재료 카드 (담기 전의 마른 떡·우동면). 떡은 E4 '불린 떡' 카드와 공용입니다.
  soakTteok:"assets/minigame/E8/Soaking/food_soak_tteok_ingredient_bowl.webp",
  soakUdon:"assets/minigame/E8/Soaking/food_soak_udon_ingredient_bowl.webp",
  // 물이 찬 정도 5단계 x 2종. 키 뒷자리(00~100)가 곧 진행도 % 입니다.
  ...Object.fromEntries(["tteok","udon"].flatMap(kind=>["00","25","50","75","100"].map(step=>[
    `soak${kind==="tteok"?"Tteok":"Udon"}Water${step}`,
    `assets/minigame/E8/Soaking/food_soak_${kind}_water_${step}.webp`
  ])))
});
const dayPrepAssets={};

function loadDayPrepAssets(){
  return Promise.all(Object.entries(DAY_PREP_ASSET_PATHS).map(([key,src])=>new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{dayPrepAssets[key]={src,image};resolve(image);};
    image.onerror=()=>resolve(null);
    image.src=src;
  }))).then(()=>dayPrepAssets);
}

function hasDayPrepAsset(key){
  return !!dayPrepAssets[key];
}

function dayPrepAssetMarkup(key,className,alt=""){
  if(!hasDayPrepAsset(key))return "";
  return `<img class="prep-asset ${className}" src="${dayPrepAssets[key].src}" alt="${alt}" draggable="false" />`;
}

/* ---- 화구 (가스버너 · 철판 화구) ---------------------------
   조리기구(팬·철판)와 **분리된 바닥 레이어**입니다. 원래는 팬/철판 그림 안에
   불이 함께 그려져 있어서 조리기구를 옮기면 불도 따라다녔습니다. 이제 화구는
   플레이 칸 바닥에 깔리고, 조리기구가 그 위에 얹힙니다.

   네 화면이 함께 씁니다.
     gas      E3 김치 볶기 · E3 볶음우동(철판은 griddle) · E5 김치전 굽기
     griddle  E3 볶음우동
     pot      E4 어묵탕 · 떡볶이 끓이기
   (E5 닭꼬치는 가스불이 아니라 숯불 화로라 여기 해당 없습니다)

   그림 3장을 겹쳐 두고 CSS 가 번갈아 켜서 불이 흔들리는 것처럼 보입니다.
   재생은 전부 css/minigame-parts.css 의 .mg-burner 가 합니다 — 자바스크립트
   타이머가 없으므로 미니게임이 닫혀도 뒷정리할 것이 없습니다. */
const MINIGAME_BURNER_FRAMES=3;

// 화구 종류 → 에셋 키 앞머리. 종류 이름은 클래스(.mg-burner-○)에도 그대로 쓰입니다.
const MINIGAME_BURNER_PREFIX=Object.freeze({gas:"burnerGas",griddle:"burnerGriddle",pot:"burnerPot"});

/* 돌아가는 손잡이를 얹을 화구 종류 → 그 손잡이 그림 키.
   여기 없는 종류(가스·철판)는 손잡이 레이어를 아예 만들지 않습니다.
   불 세기에 따라 손잡이를 돌리는 화면은 지금 E4(pot) 하나뿐입니다 —
   돌리는 각은 화면이 --mg-knob-turn 으로 줍니다(engine-e4-gauge-hold.js). */
const MINIGAME_BURNER_KNOB=Object.freeze({pot:"burnerPotKnob"});

function minigameBurnerMarkup(kind){
  const prefix=MINIGAME_BURNER_PREFIX[kind]||MINIGAME_BURNER_PREFIX.gas;
  const keys=Array.from({length:MINIGAME_BURNER_FRAMES},(_,index)=>`${prefix}${index+1}`);
  // 한 장이라도 빠지면 그 순번에서 불이 깜빡 꺼져 보입니다. 전부 있을 때만 씁니다.
  if(!keys.every(hasDayPrepAsset))return `<i class="mg-burner mg-burner-${kind} mg-burner-fallback" aria-hidden="true"></i>`;
  const frames=keys.map(key=>`<img class="mg-burner-frame" src="${dayPrepAssets[key].src}" alt="" draggable="false" />`).join("");
  const knobKey=MINIGAME_BURNER_KNOB[kind];
  const knob=knobKey&&hasDayPrepAsset(knobKey)
    ?`<img class="mg-burner-knob" src="${dayPrepAssets[knobKey].src}" alt="" draggable="false" />`:"";
  // ⚠️ 손잡이는 반드시 불꽃 3장 **뒤에** 붙습니다. 앞이나 사이에 끼우면
  //    css 의 .mg-burner-frame:nth-child(1~3) 가 한 칸씩 밀려 불이 어긋납니다.
  return `<div class="mg-burner mg-burner-${kind}" aria-hidden="true">${frames}${knob}</div>`;
}

function timingAssetKey(ingredient,successes,assetPrefix=""){
  if(assetPrefix)return `${assetPrefix}${successes}`;
  if(ingredient==="radish")return `radish${successes}`;
  if(ingredient==="kimchi")return `kimchiCut${successes}`;
  return `${ingredient}${successes}`;
}

function isDayPrepMini(mini=state.mini){
  return mini?.context?.mode==="dayPrep";
}

/* ---- 엔진 등록 창구 ----------------------------------------
   engine-e*.js 파일들이 로드되면서 아래 두 함수를 호출해
   자기 자리를 채웁니다. 이 파일은 무엇이 등록되는지 알 필요가 없습니다. */

// task.miniGame 값 → 그 게임을 시작하는 함수
const DAY_PREP_SETUPS={};

function registerDayPrepSetup(miniGameKey,setupFn){
  if(DAY_PREP_SETUPS[miniGameKey])console.warn(`낮 준비 시작함수가 중복됩니다: ${miniGameKey}`);
  DAY_PREP_SETUPS[miniGameKey]=setupFn;
}

// 낮 준비 엔진을 등록합니다. modes 는 문자열 하나 또는 배열.
// 어느 게임이든 ESC 로 닫히는 것과 제한시간이 없다는 점은 공통이라 여기서 붙여 줍니다.
function registerDayPrepEngine(modes,engine){
  const wrapped={
    timerRuns(){return false;},                 // 낮 준비에는 제한시간이 없습니다
    update:engine.update,
    action:engine.action,
    keyup:engine.keyup,
    key(m,k,e){
      if(k==="escape"){closeDayPrepMini();return true;}
      return engine.key?engine.key(m,k,e):false;
    }
  };
  for(const mode of [].concat(modes))registerMiniEngine(mode,wrapped);
}

// 진행 중인 게임의 데이터를 갈아끼웁니다. 엔진 이름(m.engine)도 함께 바뀝니다.
// 낮 준비는 도중에 게임 종류가 바뀌므로(반죽 → 거품기) 반드시 이 함수를 쓰세요.
function setDayPrepData(data){
  const m=state.mini;if(!m)return null;
  m.data=data;
  m.engine=data.mode;
  return m;
}

/* ---- 열기 · 닫기 ------------------------------------------ */

function startDayPrepMini(task){
  if(task.minDay&&Number(state.day)<Number(task.minDay)){showToast(`이 준비 작업은 Day ${task.minDay}부터 이용할 수 있습니다.`,true);return;}
  state.mini={
    type:`day-prep-${task.id}`,
    engine:"dayPrep",          // 각 setup 이 setDayPrepData 로 실제 엔진 이름을 채웁니다
    stationId:"prepTable",
    context:{mode:"dayPrep",taskId:task.id,menuId:task.menuId},
    complete:false,
    data:{}
  };
  // 타이틀 아래 부제 (ui-mini-frame.js 의 MINI_SUBTITLE).
  // 더 정확한 문장을 만들 수 있는 게임은 각자 setup 에서 덮어씁니다.
  setMiniSubtitle(task.miniGame);
  dom.miniFeedback.textContent="";
  dom.miniContent.innerHTML="";
  // TIP 조작 칩은 매번 비웁니다. 필요한 게임만 setup 에서 다시 넣습니다.
  // ⚠️ 이 함수는 startMini 를 거치지 않는 별도 진입로라, 거기와 따로 비워야 합니다.
  //    안 비우면 앞 게임 칩(예: "드래그 : 육수 붓기")이 다음 준비 게임에 남습니다.
  setMiniTipHint("");
  dom.miniClose.hidden=false;
  dom.miniOverlay.classList.add("open");

  const setup=DAY_PREP_SETUPS[task.miniGame];
  if(setup)setup(task.id);
  else{closeDayPrepMini(true);showToast("준비 미니게임 설정을 찾지 못했습니다.",true);}
}

// setup 이 도중에 멈춘 경우에도 ESC 로는 빠져나올 수 있도록 하는 대기용 엔진입니다.
registerDayPrepEngine("dayPrep",{});

function finishDayPrepTask(taskId,message){
  const m=state.mini;if(!isDayPrepMini(m)||m.complete)return;
  m.complete=true;
  audio.stopOwner?.(m);
  completeDayPrepTask(taskId);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=message;
  dom.miniContent.classList.add("prep-complete-flash");
  const grade=m.data.completionGrade||((m.data.mistakes||m.data.errors||m.data.warnings||m.data.timedOut)?"good":"perfect");
  audio.result?.(grade);
  setTimeout(()=>advanceDayPrepDish(m,taskId),520);
}

function advanceDayPrepDish(m,taskId){
  if(state.mini!==m)return false;
  const task=PREP_TASKS[taskId],nextTask=task&&nextPrepTaskForDish(task.menuId);
  const blocked=nextTask&&(nextTask.dependsOn||[]).some(id=>PREP_TASKS[id]&&!state.prepProgress?.[id]);
  if(nextTask&&!blocked){
    dom.miniContent.classList.remove("prep-complete-flash");
    startDayPrepMini(nextTask);
    return true;
  }
  closeDayPrepMini(true);
  return false;
}

function closeDayPrepMini(completed=false){
  if(!isDayPrepMini())return;
  audio.stopOwner?.(state.mini);
  state.mini=null;
  state.joyX=0;state.joyY=0;state.player.moving=false;
  dom.miniOverlay.classList.remove("open");
  dom.miniClose.hidden=true;
  dom.miniContent.classList.remove("prep-complete-flash");
  dom.miniContent.innerHTML="";
  updateUI(true);
  saveGame();
  if(completed!==true)showToast("준비 작업을 닫았습니다. 다시 상호작용해 이어갈 수 있습니다.");
}
