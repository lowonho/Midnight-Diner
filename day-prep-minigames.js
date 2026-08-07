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
  // E1은 칼날이 실제 절단선을 지나는 속도로 박자를 만듭니다.
  // travelSpeed는 재료 그림 너비 대비 초당 이동 퍼센트입니다.
  cutRadish:{title:"어묵탕 · 무 썰기",total:7,hitTolerance:CUT_HIT_TOLERANCE.radish,travelSpeed:22},
  cutFishCake:{title:"어묵탕 · 어묵 썰기",total:4,hitTolerance:CUT_HIT_TOLERANCE.fishCake,horizontalHitTolerance:CUT_HORIZONTAL_HIT_TOLERANCE.fishCake,travelSpeed:16,horizontalLastCut:true},
  cutTofuKimchi:{title:"두부김치 · 김치 썰기",ingredient:"kimchi",total:9,hitTolerance:CUT_HIT_TOLERANCE.kimchi,travelSpeed:17},
  cutPancakeKimchi:{title:"김치전 · 김치 썰기",ingredient:"kimchi",total:9,hitTolerance:CUT_HIT_TOLERANCE.kimchi,travelSpeed:17},
  cutSkewerChicken:{title:"닭꼬치 · 닭 썰기",ingredient:"chicken",total:11,hitTolerance:CUT_HIT_TOLERANCE.chicken,travelSpeed:15,requiresDoubleTap:true},
  cutSkewerGreenOnion:{title:"닭꼬치 · 대파 썰기",ingredient:"greenOnion",total:7,hitTolerance:CUT_HIT_TOLERANCE.greenOnion,travelSpeed:19},
  cutTofuBlock:{title:"두부김치 · 두부 썰기",ingredient:"tofu",total:6,hitTolerance:CUT_HIT_TOLERANCE.tofu,travelSpeed:12},
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
  radish0:"assets/minigame/E1/radish-0.png",
  radish1:"assets/minigame/E1/radish-1.png",
  radish2:"assets/minigame/E1/radish-2.png",
  radish3:"assets/minigame/E1/radish-3.png",
  radish4:"assets/minigame/E1/radish-4.png",
  radish5:"assets/minigame/E1/radish-5.png",
  radish6:"assets/minigame/E1/radish-6.png",
  radish7:"assets/minigame/E1/radish-7.png",
  fishCake0:"assets/minigame/E1/fish-cake-0.png",
  fishCake1:"assets/minigame/E1/fish-cake-1.png",
  fishCake2:"assets/minigame/E1/fish-cake-2.png",
  fishCake3:"assets/minigame/E1/fish-cake-3.png",
  fishCake4:"assets/minigame/E1/fish-cake-4.png",
  kimchiCut0:"assets/minigame/E1/kimchi-0.png",
  kimchiCut1:"assets/minigame/E1/kimchi-1.png",
  kimchiCut2:"assets/minigame/E1/kimchi-2.png",
  kimchiCut3:"assets/minigame/E1/kimchi-3.png",
  kimchiCut4:"assets/minigame/E1/kimchi-4.png",
  kimchiCut5:"assets/minigame/E1/kimchi-5.png",
  kimchiCut6:"assets/minigame/E1/kimchi-6.png",
  kimchiCut7:"assets/minigame/E1/kimchi-7.png",
  kimchiCut8:"assets/minigame/E1/kimchi-8.png",
  kimchiCut9:"assets/minigame/E1/kimchi-9.png",
  chicken0:"assets/minigame/E1/chicken-0.png",
  chicken1:"assets/minigame/E1/chicken-1.png",
  chicken2:"assets/minigame/E1/chicken-2.png",
  chicken3:"assets/minigame/E1/chicken-3.png",
  chicken4:"assets/minigame/E1/chicken-4.png",
  chicken5:"assets/minigame/E1/chicken-5.png",
  chicken6:"assets/minigame/E1/chicken-6.png",
  chicken7:"assets/minigame/E1/chicken-7.png",
  chicken8:"assets/minigame/E1/chicken-8.png",
  chicken9:"assets/minigame/E1/chicken-9.png",
  chicken10:"assets/minigame/E1/chicken-10.png",
  chicken11:"assets/minigame/E1/chicken-11.png",
  greenOnion0:"assets/minigame/E1/green-onion-0.png",
  greenOnion1:"assets/minigame/E1/green-onion-1.png",
  greenOnion2:"assets/minigame/E1/green-onion-2.png",
  greenOnion3:"assets/minigame/E1/green-onion-3.png",
  greenOnion4:"assets/minigame/E1/green-onion-4.png",
  greenOnion5:"assets/minigame/E1/green-onion-5.png",
  greenOnion6:"assets/minigame/E1/green-onion-6.png",
  greenOnion7:"assets/minigame/E1/green-onion-7.png",
  tofu0:"assets/minigame/E1/tofu-0.png",
  tofu1:"assets/minigame/E1/tofu-1.png",
  tofu2:"assets/minigame/E1/tofu-2.png",
  tofu3:"assets/minigame/E1/tofu-3.png",
  tofu4:"assets/minigame/E1/tofu-4.png",
  tofu5:"assets/minigame/E1/tofu-5.png",
  tofu6:"assets/minigame/E1/tofu-6.png",
  // 멸치 손질 (engine-e10). assets/minigame/E10/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  //   whole 4종  도마 위 멸치. 머리와 몸통이 따로라 붙여 놓는 좌표는
  //              css/day-prep-minigames.css 의 .anchovy.v01~v04 변수가 갖고 있습니다.
  //   innards    머리를 뜯을 때 딸려 나오는 멸치 똥
  //   wholeGroup 손질 **전** 통멸치 묶음 → E10(머리 떼기)의 재료 카드
  //   group      손질 **후** 멸치 묶음   → E10 완료 연출
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
  // 양념장 제조 게임은 제거됐지만, 완성 양념장 그림은 밤 떡볶이 조리에 사용합니다.
  sauceBowlTteokbokki3:"assets/minigame/E7/04_food_tteokbokki_sauce_bowl_final.webp",
  // 김치 볶기 (engine-e3). 화구는 아래 burnerGas1~3 레이어입니다.
  // ⚠️ fryingPan 은 **E5 김치전 굽기와 공용**입니다 (같은 후라이팬).
  //    손잡이까지 들어 있는 그림이라 몸통은 전체 폭의 79.7% 뿐입니다.
  //    자리 잡는 방법은 css/day-prep-minigames.css 의 .frying-pan 주석 참고.
  fryingPan:"assets/minigame/E3/fix_frying_pan_wide_inner_4x.webp",
  /* 팬 안의 김치 5장. base 가 평소 모습이고 나머지 넷은 **그 방향으로 뒤집은 한 순간**
     입니다 — 다섯 장을 한 자리에 겹쳐 두고, 저을 때 그 방향 장을 240ms 만 켰다가
     base 로 돌아옵니다 (css/minigame/e3-kimchi-fry.css 의 .frying-kimchi-asset).
     키 뒷자리는 engine-e3-direction-seq.js 의 방향 문자열(left/up/right/down)에서
     fryKimchiStirAssetKey() 가 그대로 만들어 냅니다 — 한쪽만 고치면 그림이 사라집니다. */
  fryKimchiBase:"assets/minigame/E3/Kimchi/food_stirfried_kimchi_base.webp",
  ...Object.fromEntries(["left","up","right","down"].map(way=>
    [`fryKimchiStir${way[0].toUpperCase()}${way.slice(1)}`,
     `assets/minigame/E3/Kimchi/food_stirfried_kimchi_stir_${way}.webp`])),
  /* 나무 주걱(토끼 손잡이) 3장. 젓는 손놀림에 따라 갈아 끼웁니다
     (engine-e3-direction-seq.js 의 kimchiSpatulaState).
       Clean     한 번도 안 저은 깨끗한 주걱
       Stirring  젓는 중 — 김치가 많이 묻은 주걱
       Rested    한 번 젓고 손을 뗀 상태 — 김치가 살짝 남은 주걱
     ⚠️ 그림이 **이미 18도 기울여 그려져 있습니다.** 임시 도형 시절의
        `rotate(-18deg)` 를 그대로 두면 두 번 기울어 도로 세워집니다
        (css 의 --kf-spatula-tilt 참고). */
  frySpatulaClean:"assets/minigame/E3/Kimchi/prop_spatula_rabbit.webp",
  frySpatulaStirring:"assets/minigame/E3/Kimchi/prop_spatula_rabbit_kimchi_light.webp",
  frySpatulaRested:"assets/minigame/E3/Kimchi/prop_spatula_rabbit_kimchi_very_light.webp",
  // 왼쪽 재료 카드 2장 — assets/minigame/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  // ⚠️ 썬 김치 그림만 E5 폴더에 있습니다 (E5 김치전과 같은 재료라 그쪽으로 옮겼습니다).
  fryIngKimchi:"assets/minigame/E5/food_kimchi_sliced.webp",
  fryIngSugar:"assets/minigame/E3/food_sugar.webp",
  // 볶음우동 철판 볶기 (engine-e3 · 밤 조리).
  // ⚠️ stirGriddle 은 이제 **불이 빠진 철판 한 장**입니다. 불은 따로 깔리는
  //    화구 레이어(burnerGriddle1~3)가 그립니다.
  stirGriddle:"assets/minigame/E3/fix_griddle_plate_wide_mild_trapezoid_4x.webp",
  /* 철판 위의 볶음우동 5장. **김치 볶기와 같은 규칙입니다** — base 가 평소 모습이고
     나머지 넷은 그 방향으로 뒤집은 한 순간입니다. 다섯 장을 한 자리에 겹쳐 두고,
     저을 때 그 방향 장을 240ms 만 켰다가 base 로 돌아옵니다
     (css/minigame/e3-stir-wok.css 의 .yk-food-asset).
     키 뒷자리는 engine-e3-direction-seq.js 의 방향 문자열(left/up/right/down)에서
     stirUdonPoseAssetKey() 가 그대로 만들어 냅니다 — 한쪽만 고치면 그림이 사라집니다.
     ⚠️ 김치와 달리 **다섯 장의 캔버스가 2200x803 으로 똑같습니다.** 그래서 세로도
        한 값으로 묶습니다 (tools/build-minigame-art-webp.js 참고). */
  stirUdonBase:"assets/minigame/E3/food_stirfried_udon_base.webp",
  ...Object.fromEntries(["left","up","right","down"].map(way=>
    [`stirUdon${way[0].toUpperCase()}${way.slice(1)}`,
     `assets/minigame/E3/food_stirfried_udon_stir_${way}.webp`])),
  /* 철판 뒤집개(너구리 손잡이) 3장. 김치 볶기의 나무 주걱과 같은 세 상태입니다
     (engine-e3-direction-seq.js 의 stirSpatulaState).
       Clean     한 번도 안 볶은 깨끗한 뒤집개
       Stirring  볶는 중 — 면이 많이 묻은 뒤집개 (udon_heavy)
       Rested    한 번 볶고 손을 뗀 상태 — 면이 살짝 남은 뒤집개 (udon_light)
     ⚠️ **한 장을 두 자루가 나눠 씁니다.** 그림이 이미 16.2도 기울여 그려져 있어
        (손잡이 위 오른쪽 · 날 아래 왼쪽) 그대로가 오른쪽 뒤집개이고, 왼쪽 뒤집개는
        같은 그림을 좌우로 뒤집어 씁니다 (css 의 .spatula-left .yk-spatula-asset).
        임시 도형 시절의 rotate(±17deg) 를 그대로 두면 두 번 기울어집니다
        — css 의 --yk-spatula-tilt 참고. */
  stirSpatulaClean:"assets/minigame/E3/prop_spatula_tanuki.webp",
  stirSpatulaStirring:"assets/minigame/E3/prop_spatula_tanuki_udon_heavy.webp",
  stirSpatulaRested:"assets/minigame/E3/prop_spatula_tanuki_udon_light.webp",
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
  /* 채칼 (engine-e12, 에셋 폴더명은 기존 E2 유지). PNG 가 마스터이고 여기서 쓰는 WebP 는
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
  /* E1 칼질 소품 — 납품 파일명을 그대로 씁니다. 자리마다 그림이 다릅니다.
       knife            세로 썰기 : 손잡이가 아래, 칼끝이 위, 날이 왼쪽입니다.
       knifeHorizontal  두부 마지막 가로 썰기 : 눕힌 그림이 따로 와서 회전을 안 씁니다.
       cutImpactFx1~3   썰릴 때 도마에 터지는 3장짜리 연속 이펙트 (1 → 2 → 3 순서).
     ⚠️ 납품본은 1024x1535 · 1536x1024 · 887x1774 캔버스에 여백이 크게 남아 있었습니다.
        여기 있는 파일은 알파 여백만 잘라낸 것이라 "CSS 상자 = 보이는 그림"입니다.
        이펙트 3장만은 낱장으로 자르면 안 됩니다 — 세 장의 알파 영역을 합친
        공통 캔버스(424x1642, 세로 68.8% 지점이 도마에 닿는 자리)로 잘라야
        1 → 2 → 3 이 같은 자리에서 번집니다. 낱장 트리밍은 프레임이 어긋납니다. */
  knife:"assets/minigame/E1/prop_knife_chop_vertical_ready_v4.png",
  knifeHorizontal:"assets/minigame/E1/prop_knife_chop_horizontal_ready_v2.png",
  ...Object.fromEntries(["01","02","03"].map((no,index)=>
    [`cutImpactFx${index+1}`,`assets/minigame/E1/fx_knife_board_impact_vertical_${no}.png`])),
  ...Object.fromEntries(TTEOKBOKKI_CUT_SEQUENCE.flatMap(item=>item.progressSprites.map((src,index)=>[`${item.assetPrefix}${index}`,src]))),
  /* 감자튀김 준비(봉투 흔들기) — assets/minigame/E2/fries/ 의 납품 에셋입니다.
     PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.

     [봉투 9장] 그림 한 장에 봉투·감자채·튀김가루가 함께 있습니다. 1 이 가루가
     아직 바닥에 깔린 처음이고 9 가 골고루 다 묻은 모습이라, 흔든 횟수에 맞춰
     갈아 끼우면 진행도가 그림으로 보입니다. 어느 장을 언제 쓰는지는
     engine-e2-alternate-input.js 의 friesBagFrameIndex 가 정합니다.
     ⚠️ 흔드는 횟수(day4-prep-data.js 의 requiredPresses)와 장수는 일부러
        안 맞춰 놓았습니다 — 14번 흔드는 동안 9장을 고르게 나눠 씁니다.
     [이펙트 3장] 흔들 때 봉투 좌우에 뜨는 물결입니다. **한 장에 좌우가 다 들어
     있고 가운데는 비어 있어서** 봉투 뒤에 한 장만 깔면 양쪽이 동시에 뜹니다.
     한 번 흔들 때 1 → 2 → 3 이 차례로 켜집니다 (css 의 .fp-shake-fx).
     파일이 없으면 예전처럼 CSS 임시 봉투와 활 도형을 씁니다. */
  ...Object.fromEntries(Array.from({length:9},(_,index)=>[
    `friesShakeBag${index+1}`,`assets/minigame/E2/fries/food_fries_coating_bag_0${index+1}.webp`])),
  ...Object.fromEntries(Array.from({length:3},(_,index)=>[
    `friesShakeFx${index+1}`,`assets/minigame/E2/fries/fx_bag_shake_0${index+1}.webp`])),
  // 왼쪽 재료 카드 2장 (봉투 안에 든 것 그대로 — 감자채 · 튀김가루)
  friesPotatoStrips:"assets/minigame/E2/fries/food_potato_matchsticks_panel.webp",
  friesFryingPowder:"assets/minigame/E2/fries/food_frying_powder_panel.webp",
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
  /* 밀가루·계란물·빵가루 트레이. 새우를 **좌우로 굴리는** 놀이라 위에서 내려다본
     둥근 볼이 아니라 옆으로 긴 트레이를 씁니다. 셋 다 1624x566 한 규격입니다.
     ⚠️ 예전 둥근 볼 3장(food_tempura_flour_bowl · food_egg_wash_bowl ·
        food_wet_breadcrumbs_bowl)은 세 그릇을 한꺼번에 늘어놓던 화면(.fp-vessel)
        것이라 지금은 안 쓰입니다. 파일은 남아 있습니다 — 되돌리려면 여기 세 줄만
        그 이름으로 되돌리고 CSS 의 .fp-roll-vessel 크기를 볼 비율로 되돌리세요. */
  shrimpVesselFlour:"assets/minigame/E2/shrimp/food_shrimp_tempura_flour_tray_wide_75deg.webp",
  shrimpVesselEgg:"assets/minigame/E2/shrimp/food_shrimp_tempura_egg_tray_wide_75deg.webp",
  shrimpVesselBreadcrumbs:"assets/minigame/E2/shrimp/food_shrimp_tempura_breadcrumb_tray_wide_75deg.webp",
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
  /* 단발 액션 (engine-e11 · 두부김치 자유 플레이팅). 여섯 장이 자리마다 나뉩니다.
       osTofuSlices · osFriedKimchi   왼쪽 재료 카드 (더미로 그린 그림)
       osTofuPiece · osKimchiPiece    접시에 한 조각씩 얹히는 낱개 그림
       osPlate                        가운데 빈 접시
       osPlateDone                    오른쪽 '참고 모양' — 다 담은 모습 한 장
     카드와 낱개가 다른 파일인 것이 중요합니다. 카드는 더미, 접시 위는 낱개입니다.
     PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
     ⚠️ 빈 접시 마스터는 1254 정사각 캔버스에 접시(1025x720)만 그려져 있습니다.
        빌드에서 그 여백을 잘라내(crop) 참고 모양 그림과 같은 크기로 맞췄습니다 —
        안 자르면 contain 이 여백까지 맞추느라 접시가 작게 그려집니다.
     (어묵탕 냄비 그림 osRadish/osFishCake/osAnchovy/osBroth/osPot/osPotDone 은
      "냄비에 넣기"·"육수 넣기" 를 없애면서 함께 뺐습니다) */
  osTofuSlices:"assets/minigame/E11/food_tofu_kimchi_ingredient_tofu.webp",
  osFriedKimchi:"assets/minigame/E11/food_tofu_kimchi_ingredient_kimchi.webp",
  osTofuPiece:"assets/minigame/E11/food_tofu_kimchi_tofu_piece.webp",
  osKimchiPiece:"assets/minigame/E11/food_tofu_kimchi_kimchi_piece.webp",
  osPlate:"assets/minigame/E11/food_tofu_kimchi_plate_empty.webp",
  osPlateDone:"assets/minigame/E11/food_tofu_kimchi_reference_complete.webp",
  // 김치전 굽기 · 닭꼬치 굽기 (engine-e5 · 밤 조리)의 왼쪽 재료 카드.
  // 파일을 넣기 전에는 CSS 임시 도형으로 그립니다.
  // 김치전 반죽 그릇 — assets/minigame/E5/ 의 납품 에셋입니다.
  // PNG 가 마스터이고 여기서 쓰는 WebP 는 tools/build-minigame-art-webp.js 산출물입니다.
  cookPancakeBatter:"assets/minigame/E5/food_kimchi_batter_bowl_mixed_oblique.webp",
  cookSkewerRaw:"assets/prep/two-side/skewer-raw.png",
  /* ⚠️ 여기 있던 `cookSkewerFood`(화로 위 꼬치 한 자루가 통째로 그려진 그림 한 장)는
     뺐습니다. 밤 굽기는 낮에 꽂은 배치 그대로 구워야 해서, 한 장짜리 그림 대신
     위 E8 조각(skewerChicken · skewerGreenOnion)과 꼬챙이(skewerStick)를
     한 개씩 쌓습니다 — engine-e5-two-side-cook.js 의 grillSkewerMarkup. */
  /* 숯불 화로 5장 — 화로 몸통 · 벌건 숯 · 석쇠 살이 **한 장에 다 그려져 있습니다**.
     숯이 달아올랐다 사그라드는 연속 그림이라 한 자리에 겹쳐 두고 CSS 가 차례로 켭니다
     (engine-e5-two-side-cook.js 의 CHARCOAL_GRILL_KEYS).
     ⚠️ 다섯 장이 다 있어야 씁니다. 하나라도 빠지면 예전 CSS 화로(숯덩이 126개 +
        석쇠 살 + 열기 두 겹)가 그대로 나옵니다.
     ⚠️ E3·E4 의 화구(burnerGas 등)와 **다른 계통입니다.** 저쪽은 조리기구와 분리된
        바닥 레이어라 minigameBurnerMarkup 이 공용으로 그리는데, 숯불 화로는 화로가
        곧 조리기구여서 E5 닭꼬치 화면만 씁니다. */
  ...Object.fromEntries(["01","02","03","04","05"].map((no,index)=>[
    `cookCharcoalGrill${index+1}`,`assets/minigame/E5/yakitori/fix_charcoal_grill_fire_${no}.webp`
  ])),
  /* 굽는 닭꼬치 조각 8장 — **재료 2종 x 익힘 4단계**입니다. 김치전과 같은 방식으로
     색을 CSS 필터로 만들지 않고 그림을 갈아 끼웁니다
     (engine-e5-two-side-cook.js 의 SKEWER_COOK_STEPS).
     ⚠️ **raw(안 익은) 장은 여기 없습니다.** 낮 '닭꼬치 꽂기'에 쓴 위쪽 E8 조각
        (skewerChicken · skewerGreenOnion)이 그대로 첫 장입니다 — 실제로 같은 그림을
        익힘만 다르게 다시 그린 한 벌이라, 캔버스도 그 장에 맞춰 뽑아 두었습니다
        (tools/build-minigame-art-webp.js 의 pad). 그래서 다섯 장이 한 자리에 겹칩니다.
     키 뒷자리가 곧 익는 순서입니다 — SlightlyCooked → WellCooked → SlightlyBurnt → Burnt. */
  ...Object.fromEntries([["Chicken","chicken"],["GreenOnion","green_onion"]].flatMap(([key,file])=>
    [["SlightlyCooked","slightly_cooked"],["WellCooked","well_cooked"],
     ["SlightlyBurnt","slightly_burnt"],["Burnt","burnt"]].map(([step,name])=>[
      `cookSkewer${key}${step}`,`assets/minigame/E5/yakitori/food_skewer_${file}_piece_${name}.webp`
    ]))),
  /* 굽는 김치전 5장 — **익힘 단계마다 한 장**입니다. 색을 CSS 필터로 만들지 않고
     그림을 갈아 끼웁니다 (engine-e5-two-side-cook.js 의 PANCAKE_COOK_STEPS).
     키 순서가 곧 익는 순서라 코드가 이 표를 순서대로 훑습니다. */
  cookPancakeRaw:"assets/minigame/E5/food_kimchi_pancake_raw.webp",
  cookPancakeUndercooked:"assets/minigame/E5/food_kimchi_pancake_undercooked.webp",
  cookPancakeCooked:"assets/minigame/E5/food_kimchi_pancake_cooked.webp",
  cookPancakeSlightlyBurnt:"assets/minigame/E5/food_kimchi_pancake_slightly_burnt.webp",
  cookPancakeBurnt:"assets/minigame/E5/food_kimchi_pancake_burnt.webp",
  // 김치전 위로 피어오르는 연기 5장. 01 → 05 가 한 바퀴 도는 연속 그림입니다.
  ...Object.fromEntries(["01","02","03","04","05"].map(no=>[
    `cookSmoke${no}`,`assets/minigame/E5/fx_cooking_smoke_${no}.webp`
  ])),
  // 김치전 굽기 화면 전용 마우스 포인터(고양이 발 뒤집개). 파일이 없으면 기본 포인터입니다.
  cookSpatulaCursor:"assets/minigame/E5/prop_spatula_cat.webp",
  /* 닭꼬치 데리야끼 양념 붓. 60도로 누인 한 장이고, 양념 신호에 답하면 자루 위를
     한 번 쓸고 사라집니다 (engine-e5-two-side-cook.js 의 sauceBrushMarkup ·
     css 의 .ts-sauce-brush). 파일이 없으면 예전 임시 CSS 도형(나무 손잡이 + 검은 솔)이
     대신 나옵니다. */
  cookSauceBrush:"assets/minigame/E5/yakitori/prop_teriyaki_basting_brush_pitched_60deg.webp",
  /* 데리야끼 윤기 2종. 양념을 바른 뒤 **조각 그림 위에 반투명으로 덮는 한 겹**입니다
     (css 의 .grill-skewer.sauced .gs-piece-glaze). 익힘 단계 그림을 갈아 끼우는 것과
     달리 겹치기만 하므로, 어느 단계에서 발라도 그 위에 윤기만 얹힙니다.
     ⚠️ 캔버스가 익힘 장과 같아야 조각에 1:1 로 겹칩니다 — 빌드에서 pad 로 맞춥니다. */
  cookGlazeChicken:"assets/minigame/E5/yakitori/fx_teriyaki_glaze_chicken_piece_overlay.webp",
  cookGlazeGreenOnion:"assets/minigame/E5/yakitori/fx_teriyaki_glaze_green_onion_piece_overlay.webp",
  /* 조작 방향 화살표 3장. 신호가 켜져 있는 동안 조리물 위에 겹쳐 뜹니다
     (engine-e5-two-side-cook.js 의 twoSideDragArrowMarkup · css 의 .ts-drag-arrow).
     ⚠️ 방향이 그림에 이미 그려져 있어 **세 장을 따로** 씁니다 — CSS 로 돌리면
        빛·그림자 방향까지 같이 돌아갑니다. 파일이 없으면 임시 CSS 화살표가 나옵니다. */
  cookArrowSkewerFlip:"assets/minigame/E5/ui_drag_arrow_skewer_flip_horizontal.webp",
  cookArrowSkewerSauce:"assets/minigame/E5/ui_drag_arrow_skewer_sauce_vertical.webp",
  cookArrowPancakeFlip:"assets/minigame/E5/ui_drag_arrow_kimchi_pancake_flip_up.webp",
  /* 굽기 신호 때 조리물 위에 겹치는 **누르는 손**. 닭꼬치(한 번 클릭)와 김치전(꾹 누르기)이
     같은 그림을 씁니다. 파일이 없으면 css 의 임시 손 모양(인라인 SVG)이 나옵니다. */
  cookGesturePress:"assets/minigame/E5/ui_gesture_press_hold_no_pressure_lines.webp",
  // 불리기 게임은 제거됐지만, 떡 재료 그림은 밤 떡볶이 조리에 사용합니다.
  soakTteok:"assets/minigame/E8/Soaking/food_soak_tteok_ingredient_bowl.webp"
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

/* ---- 조리 연기 fx (팬·철판 위로 피어오르는 연기) ---------------
   김치전(E5) · 김치 볶기 · 볶음우동이 같은 그림 5장을 나눠 씁니다.
   01 작은 김 → 03 길게 오른 기둥 → 05 흩어지는 조각. **한 번 피어올랐다
   사라지는 한 모금**이 그려져 있어서, 다섯 장을 같은 자리에 겹쳐 두고 CSS 가
   차례로 한 장씩 켠 뒤 잠깐 쉽니다 (css/minigame-parts.css 의 @keyframes
   mg-smoke-puff — 자바스크립트가 프레임을 돌리지 않습니다).

   [자리는 무작위입니다] 기둥은 정해진 자리에 박혀 있지 않습니다. 한 모금이
   사그라들 때마다 **다음 모금을 어디에서 피울지 새로 뽑습니다** — 그래서 조리물
   위 여기저기에서 계속 올라옵니다. 뽑는 순간은 아래 mountMinigameSmoke 참고.

   `count` 는 기둥 몇 개를 동시에 굴릴지입니다. 기둥마다 시작 박자를 어긋나게
   두어 한꺼번에 피었다 한꺼번에 꺼지지 않습니다.
   ⚠️ 그림이 한 장이라도 없으면 빈 문자열을 돌려줍니다 — 부르는 쪽에서
      예전 CSS 김(.kf-steam · .yk-steam · .cook-steam)으로 넘어가라는 뜻입니다.
   ⚠️ 마크업만으로는 기둥이 화면에 안 나옵니다. 그린 뒤 **반드시**
      mountMinigameSmoke(뿌리) 를 불러야 첫 자리가 잡힙니다. */
const MINIGAME_SMOKE_KEYS=Object.freeze(["01","02","03","04","05"].map(no=>`cookSmoke${no}`));

function hasMinigameSmokeArt(){
  return MINIGAME_SMOKE_KEYS.every(hasDayPrepAsset);
}

function minigameSmokeMarkup(count=3){
  if(!hasMinigameSmokeArt())return "";
  const frames=MINIGAME_SMOKE_KEYS.map((key,index)=>dayPrepAssetMarkup(key,`mg-smoke-frame frame-${index+1}`)).join("");
  /* 시작 박자는 한 바퀴를 기둥 수로 나눠 갖되 칸 안에서 조금씩 흔듭니다.
     고르게만 두면 "탁 · 탁 · 탁" 하고 박자가 들립니다. */
  return Array.from({length:count},(_,index)=>{
    const offset=((index+Math.random()*.7)/count).toFixed(3);
    return `<span class="mg-smoke" style="--mg-smoke-offset:${offset}" aria-hidden="true">${frames}</span>`;
  }).join("");
}

/* 한 기둥이 돌아다닐 수 있는 범위. 조리기구 상자 기준 % 이고, 공용 기본값은
   css/minigame-parts.css 의 .mg-smoke 에, 화면마다 다른 것만 게임별 css 에
   있습니다 (`--mg-smoke-zone-x: 20 80` 처럼 최소·최대 두 값).
   ⚠️ x 는 상자 왼쪽이 아니라 **연기 뿌리(상자 아래 가운데)** 자리입니다.
   여기 적힌 값은 css 를 아예 못 읽었을 때의 최후의 값입니다 — 실제로 쓰이는
   값이 아니니 화면을 조정할 때 여기를 고치지 마세요. */
const MINIGAME_SMOKE_ZONE_FALLBACK=Object.freeze({x:[16,62],y:[34,54],w:[20,28],top:102});

function minigameSmokeZone(column){
  const style=getComputedStyle(column);
  const numbers=name=>style.getPropertyValue(name).trim().split(/\s+/)
    .filter(Boolean).map(Number).filter(Number.isFinite);
  const range=(name,fallback)=>{const parts=numbers(name);return parts.length===2?parts:fallback;};
  const single=(name,fallback)=>{const parts=numbers(name);return parts.length===1?parts[0]:fallback;};
  /* 상자는 정사각이라 "폭 1%" 가 세로로는 몇 % 인지 알아야 윗변을 계산할 수
     있습니다. 조리기구 상자(팬·철판)는 가로로 길어서 이 값이 2 를 넘습니다. */
  const host=column.parentElement?.getBoundingClientRect();
  return {
    x:range("--mg-smoke-zone-x",MINIGAME_SMOKE_ZONE_FALLBACK.x),
    y:range("--mg-smoke-zone-y",MINIGAME_SMOKE_ZONE_FALLBACK.y),
    w:range("--mg-smoke-zone-w",MINIGAME_SMOKE_ZONE_FALLBACK.w),
    top:single("--mg-smoke-zone-top",MINIGAME_SMOKE_ZONE_FALLBACK.top),
    aspect:host&&host.height>0?host.width/host.height:2.3
  };
}

/* 다음 모금을 피울 자리·크기를 뽑습니다.

   ⚠️ 높이(y)와 크기(w)를 **따로** 뽑으면 안 됩니다. 둘 다 큰 값이 걸리는 날에는
      상자 윗변이 플레이 칸 위로 나가 잘립니다. 그래서 크기를 먼저 뽑고, 그 크기로
      갈 수 있는 데까지만 높이를 뽑습니다 (--mg-smoke-zone-top 이 그 천장이고,
      상자 윗변 = 높이 + 크기 x aspect 입니다).
      예전처럼 기둥이 한두 개로 고정이면 값을 넣을 때마다 사람이 이 셈을 하면
      됐지만, 자리를 계속 새로 뽑는 지금은 코드가 지켜야 합니다.
   ⚠️ 바로 앞 모금과 너무 가까우면 다시 뽑습니다. 안 그러면 같은 자리에서 두세 번
      이어 피어올라 "고정된 기둥" 처럼 보이는 때가 생각보다 잦습니다(무작위라
      한 곳에 몰리는 것은 정상입니다). 몇 번 뽑아도 안 벌어지면 그냥 씁니다 —
      범위가 좁은 화면에서 무한히 도는 것보다 낫습니다. */
function placeMinigameSmoke(column,zone){
  const pick=(low,high)=>low+Math.random()*Math.max(0,high-low);
  const gap=(zone.x[1]-zone.x[0])*.35;
  const last=Number(column.dataset.smokeRoot);
  let root=pick(zone.x[0],zone.x[1]);
  for(let tries=0;tries<4&&Number.isFinite(last)&&Math.abs(root-last)<gap;tries++)root=pick(zone.x[0],zone.x[1]);
  const width=pick(zone.w[0],zone.w[1]);
  const ceiling=zone.top-width*zone.aspect;      // 이 크기로 올라갈 수 있는 맨 위
  const bottom=pick(zone.y[0],Math.min(zone.y[1],ceiling));
  column.dataset.smokeRoot=root.toFixed(2);
  column.style.width=`${width.toFixed(2)}%`;
  column.style.left=`${(root-width/2).toFixed(2)}%`;
  column.style.bottom=`${bottom.toFixed(2)}%`;
}

/* 기둥을 화면에 붙이고, 모금이 바뀔 때마다 자리를 다시 뽑게 걸어 둡니다.

   [언제 옮기는가]  `animationiteration` 을 씁니다 — 자바스크립트 타이머가 아니라
   **CSS 애니메이션이 한 바퀴를 돈 그 순간**에 브라우저가 알려 주는 사건이라,
   그림이 넘어가는 박자와 어긋날 일이 없습니다. 첫 장(frame-1)의 한 바퀴가
   끝나는 시각은 다섯 장이 전부 꺼져 있는 쉬는 참이라(css 의 mg-smoke-puff 참고)
   그때 옮기면 연기가 순간이동하는 것처럼 보이지 않습니다.
   ⚠️ 다른 장(frame-2~5)은 지연이 걸려 있어 한 바퀴가 끝나는 시각이 제각각입니다.
      **반드시 frame-1 만** 봐야 합니다.

   [치우기]  없습니다. 기둥은 미니게임 화면 안에 있어서 화면이 지워지면 listener 도
   같이 사라집니다 (엔진에 teardown 이 없어도 새는 것이 없습니다).
   [움직임 최소화]  애니메이션이 꺼지면 사건도 안 옵니다 — 처음 뽑은 자리에
   가만히 있습니다. 그게 맞는 동작입니다. */
function mountMinigameSmoke(root){
  root?.querySelectorAll(".mg-smoke").forEach(column=>{
    const zone=minigameSmokeZone(column);
    placeMinigameSmoke(column,zone);
    column.addEventListener("animationiteration",event=>{
      if(event.target.classList?.contains("frame-1"))placeMinigameSmoke(column,zone);
    });
  });
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

// 개별 엔진이 점수를 직접 정하면 그대로 사용하고, 아직 점수 체계가 없는 엔진은
// 공용 등급으로 환산합니다. 시간 종료는 실수 한 번보다 큰 감점으로 분리합니다.
function dayPrepCompletionScore(data={}){
  const rawScore=data?.completionScore;
  const explicit=Number(rawScore);
  if(rawScore!==null&&rawScore!==undefined&&rawScore!==""&&Number.isFinite(explicit)){
    return Math.round(Math.max(0,Math.min(100,explicit)));
  }
  if(data?.timedOut)return 50;
  const grade=data?.completionGrade
    ||(data?.mistakes||data?.errors||data?.warnings?"good":"perfect");
  return grade==="perfect"?100:grade==="good"?80:80;
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
    // 마우스 전용 표시는 그대로 넘겨야 합니다 — game.js 가 보는 것은 이 wrapped 쪽입니다
    // (여기서 빠뜨리면 엔진에 붙여 놔도 키가 그대로 먹습니다). mini-engine.js 참고.
    noKeyboard:engine.noKeyboard,
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
  //    안 비우면 앞 게임 칩(예: "드래그 : 담기")이 다음 준비 게임에 남습니다.
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
  const completionScore=dayPrepCompletionScore(m.data);
  completeDayPrepTask(taskId,completionScore);
  dom.miniTimer.textContent="완료";
  dom.miniFeedback.textContent=message;
  dom.miniContent.classList.add("prep-complete-flash");
  const grade=m.data.completionGrade||((m.data.mistakes||m.data.errors||m.data.warnings||m.data.timedOut)?"good":"perfect");
  audio.result?.(grade);
  miniSetTimeout(()=>advanceDayPrepDish(m,taskId),520);
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
  audio.stopOwner?.(state.mini);audio.stopLoops?.();
  state.mini=null;
  state.joyX=0;state.joyY=0;state.player.moving=false;
  dom.miniOverlay.classList.remove("open");
  dom.miniClose.hidden=true;
  dom.miniContent.classList.remove("prep-complete-flash");
  dom.miniContent.innerHTML="";
  updateUI(true);
  saveGame();
  if(completed!==true)showToast("준비 작업을 닫았습니다. 현재 작업은 초기화되어 다음에 처음부터 다시 해야 합니다.");
}
