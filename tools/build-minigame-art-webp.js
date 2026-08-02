"use strict";

/* ============================================================
   미니게임 전용 그림(assets/minigame) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-minigame-art-webp.js
     node tools/build-minigame-art-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [tools/build-minigame-ui-webp.js 와 나눠 놓은 이유]
   저쪽은 assets/UI/Minigame — 11종이 공유하는 **패널 껍데기**입니다.
   여기는 assets/minigame — 게임 하나가 쓰는 **내용물 그림**(재료 조각·꼬챙이)과
   미니게임 공용 마우스 포인터입니다. 폴더가 다르고 배율 기준도 다릅니다.

   [배율 : 화면에 그려지는 CSS 크기의 2배]
   .game-frame 은 뷰포트를 꽉 채우므로 실제 렌더 크기가 화면마다 다릅니다.
   1920 프레임을 DPR 2 로 보거나 4K 프레임을 DPR 1 로 보면 딱 2배가 되고,
   그게 현실적인 최대치입니다. 그래서 아래 표의 크기는 전부
   "css/day-prep-minigames.css 가 정한 자리 x 2" 입니다.
   자리를 바꿨으면 표도 같이 고쳐야 합니다. 안 그러면 흐려지거나 용량만 먹습니다.

   ⚠️ 마우스 포인터만 예외로 128x128 입니다.
      CSS `cursor: url(...)` 은 크롬이 128x128 을 넘으면 **통째로 무시**합니다.
      더 크게 뽑으면 커서가 조용히 기본 화살표로 돌아갑니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART_DIR = path.join(__dirname, "..", "assets", "minigame");

/* [file]     ART_DIR 기준 상대 경로 (PNG 마스터)
   [size]     뽑아낼 WebP 크기 [가로, 세로]. `null` 이면 원본 크기 그대로 —
              납품본이 이미 2배율에 못 미쳐 줄일 것도 늘릴 것도 없을 때 씁니다.
   [css]      그 크기의 근거가 되는 화면 자리 (1920 프레임 기준 px). 주석용입니다.
   [lossless] 무손실로 뽑을 것 — 면적이 작아 q90 아티팩트가 바로 눈에 띄는 것만
   [quality]  기본 q90 대신 다른 품질을 쓸 것 — 장수가 많아 용량이 곱해지는 묶음용
   [out]      출력 이름을 따로 줄 것. 기본은 file 의 확장자만 .webp 로 바꾼 이름입니다.
              **한 마스터에서 여러 크기를 뽑을 때만** 씁니다 (E3 화살표 칩 참고).
   [stretch]  가로세로비가 원본과 달라도 경고하지 말 것 — 늘려 쓰는 것이 의도인
              UI 틀 그림 전용입니다. 음식 그림에는 절대 붙이지 마세요. */
const FILES = [
  { file:"ui_drag_hand_pointer_normal.png", size:[128,128], css:"CSS 커서 (크롬 상한 128)",       lossless:true },
  { file:"ui_drag_hand_pointer_click.png",  size:[128,128], css:"CSS 커서 (크롬 상한 128)",       lossless:true },
  { file:"E8/food_skewer_chicken_piece.png",     size:[240,210], css:".sk-slot .sk-piece 120x105" },
  { file:"E8/food_skewer_green_onion_piece.png", size:[240,210], css:".sk-slot .sk-piece 120x105" },
  { file:"E8/food_skewer_chicken_group.png",     size:[424,371], css:".sk-ing-art 210x210 안쪽"   },
  { file:"E8/food_skewer_green_onion_group.png", size:[424,371], css:".sk-ing-art 210x210 안쪽"   },
  { file:"E8/prop_skewer_stick.png",             size:[128,960], css:".sk-rod 64x463"             },
  /* E8 김치전 반죽 재료 넣기. 셋 다 원본이 정사각이라 목표도 정사각입니다.
     재료 카드 3장은 .bt-ing-asset 이 max-height 120 으로 잡아 주는 자리(가로는 214 까지
     쓸 수 있지만 정사각이라 세로가 먼저 막힙니다) 의 2배입니다. */
  { file:"E8/01_food_kimchi_chopped_panel.png",  size:[240,240], css:".bt-ing-asset 120x120" },
  { file:"E8/02_food_pancake_flour_panel.png",   size:[240,240], css:".bt-ing-asset 120x120" },
  { file:"E8/03_food_water_cup_panel.png",       size:[240,240], css:".bt-ing-asset 120x120" },
  /* 반죽 볼 9장. 넣은 재료 조합마다 한 장이고 전부 같은 자리에 겹칩니다.
     자리는 .batter-prep-scene 의 --bowl (400x400) 인데, 볼 둘레의 투명 여백을
     잘라낸 납품본이라 그림 비율이 1.163(가로가 김)입니다. 정사각 칸에
     object-fit:contain 으로 들어가면 **가로가 먼저 막혀** 400x344 로 그려집니다.
     그래서 2배율이 800x688 입니다.

     ⚠️ 9장을 **한 크기로 묶는 것이 중요합니다.** 마스터 PNG 는 장마다 자기
        경계에 맞춰 잘려 있어 2202~2214 x 1894~1902 로 조금씩 다릅니다(비율 차 0.23%).
        여기서 한 크기로 뽑아야 재료를 넣을 때 볼이 안 튑니다. 비율 차가
        checkAspect 한계(2%)의 1/10 이라 찌그러짐은 눈에 안 보입니다.
     오른쪽 '참고 모양' 칸(172)에도 같은 파일을 줄여 씁니다. */
  ...["04_food_kimchi_batter_bowl_empty","05_food_kimchi_batter_bowl_water",
      "06_food_kimchi_batter_bowl_flour","07_food_kimchi_batter_bowl_kimchi",
      "08_food_kimchi_batter_bowl_kimchi_flour","09_food_kimchi_batter_bowl_water_flour",
      "10_food_kimchi_batter_bowl_water_kimchi","11_food_kimchi_batter_bowl_flour_kimchi",
      "12_food_kimchi_batter_bowl_all_unmixed"]
    .map(name=>({ file:`E8/${name}.png`, size:[800,688], css:".bt-bowl 400x400 안에서 400x344" })),
  /* E9 김치전 반죽 젓기. 반죽 10장은 볼까지 통째로 그려진 **한 벌의 연속 그림**이라
     E8 처럼 `--bowl`(400x400) 자리에 통째로 깔립니다. 원본 비율이 0.992(세로가 김)이라
     정사각 칸에서는 세로가 먼저 막혀 397x400 으로 그려집니다 → 2배율 794x800.

     ⚠️ 10장을 **한 크기로 묶어야 합니다.** 마스터가 880~881 x 886~888 로 미세하게
        다른데, 여기서 한 크기로 뽑지 않으면 저을 때 볼이 1px 씩 들썩입니다.
        비율 차가 0.15% 라 checkAspect(2%) 에 걸리지 않습니다.
     ⚠️ 09 번은 **납품에 없습니다.** 번호가 아니라 이 배열 순서가 재생 순서이므로,
        나중에 09 가 오면 08 과 10 사이에 끼워 넣기만 하면 됩니다.
        (day-prep-minigames.js 의 E9_BATTER_MIX_FRAMES 도 같이 고쳐야 합니다) */
  ...["01_food_kimchi_batter_mix_stage1_unmixed","02_food_kimchi_batter_mix_stage2_b",
      "03_food_kimchi_batter_mix_stage2_c","04_food_kimchi_batter_mix_stage3_a",
      "05_food_kimchi_batter_mix_stage3_b","06_food_kimchi_batter_mix_stage3_c",
      "07_food_kimchi_batter_mix_stage4_a","08_food_kimchi_batter_mix_stage4_b",
      "10_food_kimchi_batter_mix_stage4_c","11_food_kimchi_batter_mix_stage5_complete"]
    .map(name=>({ file:`E9/${name}.png`, size:[794,800], css:".bt-bowl 400x400 안에서 397x400" })),
  /* 거품기 3종. 대각선으로 그려져 있어 원본이 거의 정사각입니다.
     .whisk-tool 자리가 240x243 이라 2배율이 480x486 입니다. */
  { file:"E9/12_prop_whisk_clean.png",         size:[480,486], css:".whisk-tool 240x243 (섞기 전)" },
  { file:"E9/13_prop_whisk_batter_light.png",  size:[480,486], css:".whisk-tool 240x243 (멈춤)"   },
  { file:"E9/14_prop_whisk_batter_medium.png", size:[480,486], css:".whisk-tool 240x243 (젓는 중)" },
  /* E10 멸치. 머리/몸통 4종은 도마 위에서 한 마리 길이 270(--a-len) 으로 그려지고,
     --size 로 최대 1.06배까지 커집니다. 그래서 "전체 길이 580 = 270 x 2배율에
     여유를 더한 값" 을 기준으로 각 조각의 몫만큼 나눠 가집니다.
     비율(머리 몫 / 몸통 몫)은 css/day-prep-minigames.css 의 --hd-w / --bd-w 와 같습니다. */
  { file:"E10/food_anchovy_whole_01_body.png", size:[484,129], css:".anchovy 270 중 83.5%" },
  { file:"E10/food_anchovy_whole_01_head.png", size:[158,105], css:".anchovy 270 중 27.3%" },
  { file:"E10/food_anchovy_whole_02_body.png", size:[483,129], css:".anchovy 270 중 83.2%" },
  { file:"E10/food_anchovy_whole_02_head.png", size:[163,106], css:".anchovy 270 중 28.1%" },
  { file:"E10/food_anchovy_whole_03_body.png", size:[526, 98], css:".anchovy 270 중 90.7%" },
  { file:"E10/food_anchovy_whole_03_head.png", size:[127, 78], css:".anchovy 270 중 21.9%" },
  { file:"E10/food_anchovy_whole_04_body.png", size:[475,143], css:".anchovy 270 중 82.0%" },
  { file:"E10/food_anchovy_whole_04_head.png", size:[174,114], css:".anchovy 270 중 29.9%" },
  // 멸치 똥 — 머리 폭의 0.62배 상자에 100% 100% 로 늘려 채웁니다 (약 46x11)
  { file:"E10/food_anchovy_innards.png",       size:[140, 46], css:".anchovy-innards 약 36x12" },
  // 손질 전 통멸치 묶음 — E10(머리 떼기)의 왼쪽 재료 카드
  { file:"E10/food_anchovy_whole_group_3.png", size:[560,134], css:"E10 재료 카드 약 210" },
  // 손질한 멸치 묶음 — 어묵탕에 넣기(E11 .os-art 최대 158)의 재료 카드·냄비
  { file:"E10/food_anchovy_cleaned_group.png", size:[560,191], css:"E11 재료 카드 · 냄비" },
  /* 나무 쟁반은 원본 크기 그대로 씁니다.
     플레이 칸이 824.2x613.2 라 2배율은 1648x1226 인데 납품본이 1580x1176 입니다.
     1.92배율이라 사실상 2배율이고, 늘리면 없던 화소를 지어내는 셈이라 그대로 둡니다.
     (가로세로비 1580/1176 = 1.3435 는 824.2/613.2 = 1.3441 과 0.04% 차이입니다) */
  { file:"ui_play_tray_wood.png",                size:[1580,1176], css:"플레이 칸 824.2x613.2 (원본 배율 유지)" },
  /* 나무 도마 — 쟁반과 같은 자리에 깔리는 또 하나의 바닥입니다. **세 게임이 함께 씁니다** —
     E1 썰기(.cut-board) · E2 채썰기(.fp-board:has(.md-scene)) · E2 새우튀김 준비(.fp-board:has(.fp-coat-row)).
     원래 E2/shrimp/ 안에 있었는데 새우 전용이 아니게 되어 공용 폴더인 여기로 올렸습니다.
     쟁반과 달리 그림에 액자가 없는 통 도마입니다.
     ⚠️ 납품본(1241x748)이 칸의 1.5 / 1.22 배라 2배율에 못 미칩니다. 늘리면 없던 화소를
        지어내는 셈이라 원본 배율 그대로 둡니다 (ui_play_tray_wood · E3 화구와 같은 판단입니다).
     ⚠️ 비율 1.659 가 칸(1.344)과 다릅니다. CSS 에서 100% 100% 로 늘려 채우는 것이
        의도입니다 — 나무결이라 늘려도 티가 안 납니다. */
  { file:"fix_tempura_prep_board.png",           size:null,        css:".cut-board / .fp-board 824.2x613.2 (원본 배율 유지)" },
  /* E3 김치 볶기 (낮 준비) · 볶음우동 (밤 조리). 두 게임이 같은 컨트롤러라 한 폴더에 있습니다.
     왼쪽 재료 카드 그림은 가로 210 까지 쓸 수 있는데 전부 그보다 좁아 **세로가 먼저 막습니다.**
       김치 볶기  .kf-ing-asset  max-height 104   (그림칸 158.6 이라 여유 있음)
       볶음우동   .yk-ing-asset  그림칸 86 을 그대로 (숫자를 박지 않습니다)
     ⚠️ 볶음우동은 원래 max-height 94 였는데 그림칸이 86 뿐이라 카드가 139.1 → 147 로
        부풀어 아래 화살표 칩 줄과 겹쳤습니다. css/minigames.css 의 .yk-ing-asset 주석 참고.
        아래 크기는 그 수정 뒤 실측한 표시 크기의 2배입니다. */
  { file:"E3/food_kimchi_sliced.png",      size:[259,208], css:".kf-ing-asset 129.5x104" },
  { file:"E3/food_sugar.png",              size:[257,208], css:".kf-ing-asset 128.5x104" },
  { file:"E3/food_udon_noodles.png",       size:[216,172], css:".yk-ing-asset 108x86" },
  { file:"E3/food_udon_sauce.png",         size:[ 81,172], css:".yk-ing-asset 40.7x86 (세로로 긴 병)" },
  { file:"E3/food_udon_vegetables.png",    size:[214,172], css:".yk-ing-asset 107.1x86" },
  /* 화살표 4종. **한 파일이 두 자리에 쓰입니다** — 아래 칩 안(약 46)과
     오른쪽 '다음 순서' 칸. 큰 쪽 기준으로 한 번만 뽑고 칩에서는 줄여 씁니다.
     납품본이 256 이라 '다음 순서' 자리를 그 절반인 128 로 잡았습니다. 자리를 더
     키우면 없던 화소를 지어내는 셈이라 흐려집니다 — 키우려면 마스터부터 다시 받으세요. */
  ...["left","up","right","down"].map(way=>({
    file:`E3/ui_arrow_${way}.png`, size:[256,256], css:".kf-next-arrow / .yk-next-arrow 128 (칩에서는 46)"
  })),
  /* 화살표 칩 나무틀. 다른 UI 틀과 같은 "크기별 통짜 그림"인데,
     **칸 수가 게임마다 달라서 가로가 두 가지**입니다 (칩 줄 안쪽 폭 1340.2 공통).
       김치 볶기  10칸 → (1340.2 − 8x9)  / 10 = 126.8
       볶음우동   12칸 → (1340.2 − 8x11) / 12 = 104.35
     세로는 둘 다 공용 띠 78 입니다. 한 마스터(1.368)에서 두 크기를 뽑으므로
     가로세로비가 원본과 달라집니다 — 나무틀이라 늘려도 티가 안 나서 stretch 로 넘깁니다. */
  { file:"E3/ui_arrow_chip.png", out:"E3/ui_arrow_chip_254x156.webp", size:[254,156], stretch:true, css:"김치 볶기 칩 126.8x78" },
  { file:"E3/ui_arrow_chip.png", out:"E3/ui_arrow_chip_209x156.webp", size:[209,156], stretch:true, css:"볶음우동 칩 104.35x78" },
  /* 화구 2종 x 3장. 조리기구(팬·철판)와 분리된 **바닥 레이어**입니다.
       gas      가스버너   → E3 김치 볶기 · E5 김치전 굽기
       griddle  철판 화구  → E3 볶음우동
     3장은 불이 흔들리는 애니메이션 프레임입니다. 번호 순서가 곧 재생 순서입니다.

     ⚠️ **원본 배율 그대로 씁니다.** 플레이 칸 가로 824.2 를 꽉 채우므로 2배율은
        1648 인데 납품본이 1423 / 1357 입니다. 늘리면 없던 화소를 지어내는 셈이라
        그대로 둡니다 (ui_play_tray_wood 와 같은 판단입니다).

     ⚠️ **여기서 크기를 건드리지 않습니다 (size:null).** 대신 PNG 마스터 쪽에서
        캔버스를 맞춰 뒀습니다. 가스버너 납품본은 1412x612 / 1412x616 / 1411x607 로
        장마다 캔버스가 달랐고, 02 장은 몸통이 캔버스 바닥에서 2px 떠 있어서
        화면에서 아래를 맞춰 깔아도(css/minigame-parts.css 의 .mg-burner-frame)
        화구가 초당 11번 1px 씩 들썩였습니다. 그래서 세 장 모두 **여백만 덧대어
        1412x616** 로 통일했습니다 — 잘라낸 화소가 없으니 무손실입니다.
        새 납품본을 받으면 세 장의 캔버스와 몸통 위치가 같은지 먼저 확인하고,
        다르면 같은 방식으로 여백을 덧대 맞춘 뒤 이 스크립트를 돌리세요.
        (철판 화구 3장은 원래부터 아래 여백 2 로 맞아 있어 손대지 않았습니다.) */
  ...["01","02","03"].flatMap(no=>[
    { file:`E3/fix_gas_burner_low_fire_${no}.png`, size:null, css:"가스버너 (원본 배율 유지)" },
    { file:`E3/fix_griddle_burner_fire_${no}.png`, size:null, css:"철판 화구 (원본 배율 유지)" }
  ]),
  /* E4 끓이기용 가스버너 3장 (냄비 화구). 위 두 화구와 같은 바닥 레이어이고
     쓰는 곳만 다릅니다 — E4 어묵탕 · 떡볶이 끓이기.
     ⚠️ 여기도 캔버스를 먼저 맞춰 뒀습니다. 납품본이 1431x663 / 1432x663 / 1432x663 으로
        01 장만 1px 좁았고 내용도 그만큼 왼쪽에 붙어 있어, 그대로 두면 초당 11번
        화구가 좌우로 1px 씩 떨렸습니다. 01 장 왼쪽에 투명 1px 을 덧대
        세 장 모두 1432x663 · 내용 x3~1428 로 통일했습니다(잘라낸 화소 없음).
     원본 배율 유지 이유는 위 E3 화구와 같습니다(플레이 칸 824.2 의 1.74배). */
  ...["01","02","03"].map(no=>(
    { file:`E4/fix_gas_burner_integrated_redraw_fire_${no}.png`, size:null, css:"끓이기 가스버너 (원본 배율 유지)" }
  )),
  /* E4 화구 손잡이 한 장. 위 화구 3장에 **이미 그려져 있는** 손잡이 자리에 그대로
     겹쳐 놓고, 불 세기에 따라 돌립니다 (css/minigame-parts.css 의 .mg-burner-knob).
     화면에서 106 남짓이라 원본 174 로도 1.6배뿐이지만, 화구 3장과 같은 배율이어야
     겹쳤을 때 결이 어긋나지 않으므로 여기도 원본 그대로 둡니다.
     ⚠️ 무손실입니다. 200px 도 안 되는 그림인 데다 **돌아가면서 다시 표본화**되어
        테두리 링잉이 그대로 드러납니다 — 그러면 아래 그림 쪽 손잡이와의 경계가
        눈에 띕니다. 원본이 64KB 라 무손실로 떠도 부담이 없습니다. */
  { file:"E4/fix_gas_burner_off.png", size:null, lossless:true, css:".mg-burner-knob 106x105 (원본 배율 유지)" },
  /* E4 냄비 — 메뉴 2종 x 끓는 세기 3단계 x 4장 = 24장.
     4장이 한 바퀴 도는 스프라이트이고, 세기(약·적정·강)는 온도 구간이 고릅니다.

     [크기] 화면 냄비 폭의 2배율입니다. 메뉴마다 냄비 크기와 원본 비율이 달라 따로입니다.
       어묵탕   화면 472 → 944 x 553  (원본 2405x1408)
       떡볶이   화면 505 → 1010 x 568 (원본 2536x1426)
     떡볶이가 큰 것은 같은 폭일 때 냄비가 더 작아 보여서입니다(원본이 가로로 넓음).
     ⚠️ 마스터가 4000px 에 가까운 큰 그림이라 여기서 크게 줄어듭니다. 화면 자리를
        바꾸면 이 크기도 같이 고쳐야 합니다(css/minigames.css 의 --heat-art-w).

     ⚠️ [12장을 한 크기로 묶는 것이 중요합니다]
     떡볶이 마스터는 2535~2537 x 1426~1427 로 장마다 캔버스가 미세하게 다릅니다.
     그림이 캔버스를 꽉 채우고 있어(투명 여백 0) 여백을 덧댈 수가 없으므로,
     E3 화구처럼 PNG 를 손보는 대신 **여기서 한 크기로 뽑아** 맞춥니다.
     비율 차가 0.1% 라 찌그러짐은 눈에 안 보이고, 이래야 4장이 넘어갈 때
     냄비가 1px 씩 들썩이지 않습니다.

     [q82] 다른 그림(q90)보다 낮춥니다. 24장이라 용량이 그대로 곱해지는데,
     국물처럼 부드러운 면이 대부분이라 82 에서도 눈에 띄는 손실이 없습니다. */
  ...[
    {dish:"eomuk_tang", size:[944,553],  css:"어묵탕 냄비 472x276.5"},
    {dish:"tteokbokki", size:[1010,568], css:"떡볶이 냄비 505x284"}
  ].flatMap(({dish,size,css})=>
    ["weak","medium","strong"].flatMap(level=>
      ["01","02","03","04"].map(no=>(
        { file:`E4/food_${dish}_boil_${level}_${no}.png`, size, quality:82, css }
      ))
    )
  ),
  /* E3 조리기구 2종. 화구와 달리 **4배율 마스터**라 절반으로 줄여 2배율을 만듭니다.
       팬    화면 640 x 278 — 손잡이까지 포함한 크기입니다. 몸통(타원)은 그중 79.7%
             뿐이고 나머지 오른쪽이 손잡이라, 자리를 잡을 때는 몸통 중심(그림 왼쪽에서
             39.9%)을 화구 불꽃 링에 맞춥니다. 손잡이는 플레이 칸 밖으로 나가
             .kf-board / .ts-board 의 overflow:hidden 에 잘립니다.
       철판  화면 760 x 321 */
  { file:"E3/fix_frying_pan_wide_inner_4x.png",             size:[1280,556], css:".frying-pan · .two-side-pan 640x278" },
  { file:"E3/fix_griddle_plate_wide_mild_trapezoid_4x.png", size:[1520,643], css:".yk-griddle 760x321" },
  /* E5 김치전 굽기의 왼쪽 재료 카드(반죽 그릇 한 장).
     그림칸이 210 x 225 인데 원본이 정사각이라 **가로 210 이 먼저 막습니다** → 2배율 420. */
  { file:"E5/food_kimchi_batter_bowl_mixed_oblique.png",    size:[420,420],  css:".ts-ing-asset 210x210" },
  /* ---- E2 채썰기 -------------------------------------------------
     나무 도마. **E2 채썰기와 E7 소스 제조 두 칸이 함께 씁니다** — 액자가 그림에
     그려져 있어 ui_play_tray_wood 와 같은 자리에 같은 방식으로 깔립니다.
     4배율 마스터(3297x2453)를 정확히 절반으로 줄여 2배율을 만듭니다.
     원본 비율 1.3441 이 플레이 칸(824.2 x 613.2 = 1.3441)과 같아 안 찌그러집니다.
     ⚠️ 이 칸은 .md-scene(788.2)이 아니라 **액자 바깥 상자(824.2)** 기준입니다. */
  { file:"E2/prop_cutting_board_fp_board_4x.png", size:[1648,1226], css:".fp-board / .sc-board 824.2x613.2" },
  /* [채칼 · 채반은 원본 배율 그대로]
     둘 다 납품본이 화면 크기의 1.9배 남짓이라 사실상 2배율입니다.
     2배로 늘리면 없던 화소를 지어내는 셈이라 그대로 둡니다
     (ui_play_tray_wood · E3 화구와 같은 판단입니다). */
  { file:"E2/prop_mandoline_empty.png",        size:null, css:".md-plate 524.1x409.5 (원본 1080x844)" },
  { file:"E2/prop_bamboo_colander_empty.png",  size:null, css:".md-basket 548.6x318.9 (원본 1089x633 = 1.99배)" },
  // 좌우 화살표 — 화면 500 x 64.6
  { file:"E2/ui_arrow_horizontal_both.png",    size:[1000,129], css:".md-hint 500x64.6" },
  /* 왼쪽 재료 카드 2장. 그림칸이 210 x 215.6 인데 원본이 세로로 길어(0.946)
     **세로 190 이 먼저 막습니다** → 2배율 380. */
  { file:"E2/food_cabbage_ingredient.png",     size:[360,380], css:".fp-ing-asset 180x190" },
  { file:"E2/food_carrot_ingredient.png",      size:[359,380], css:".fp-ing-asset 179.5x190" },
  /* ⚠️ 감자 재료 카드는 food_potato_ingredient.png 가 아니라 판 위 그림의
     첫 장(food_potato_whole_01)을 그대로 씁니다. 마스터 PNG 는 남겨 두되
     여기서 뽑지 않습니다 — 안 쓰는 WebP 를 만들지 않기 위해서입니다. */
  /* 채반에 쌓이는 채 9종(양배추 3 · 당근 3 · 감자 3).
     ⚠️ **아홉 장을 한 배율(0.0942)로 묶습니다.** 한 벌로 그려진 그림이라
        장마다 길이에 맞춰 키우면 굵기가 제각각이 되어 채가 아니라
        서로 다른 재료처럼 보입니다. 가장 긴 장(840)이 화면 79 가 되는 배율입니다.
     면적이 작아 q90 아티팩트가 바로 보이므로 전부 무손실입니다. */
  { file:"E2/food_cabbage_shredded_piece_01.png", size:[ 89, 66], lossless:true, css:".md-pile i 44.5x33" },
  { file:"E2/food_cabbage_shredded_piece_02.png", size:[ 25, 94], lossless:true, css:".md-pile i 12.5x47" },
  { file:"E2/food_cabbage_shredded_piece_03.png", size:[ 19,135], lossless:true, css:".md-pile i 9.5x67.5" },
  { file:"E2/food_carrot_shredded_piece_01.png",  size:[ 19,111], lossless:true, css:".md-pile i 9.5x55.5" },
  { file:"E2/food_carrot_shredded_piece_02.png",  size:[ 28, 94], lossless:true, css:".md-pile i 14x47" },
  { file:"E2/food_carrot_shredded_piece_03.png",  size:[ 24,139], lossless:true, css:".md-pile i 12x69.5" },
  { file:"E2/food_potato_shredded_piece_01.png",  size:[ 27, 99], lossless:true, css:".md-pile i 13.5x49.5" },
  { file:"E2/food_potato_shredded_piece_02.png",  size:[ 37, 97], lossless:true, css:".md-pile i 18.5x48.5" },
  { file:"E2/food_potato_shredded_piece_03.png",  size:[ 60,158], lossless:true, css:".md-pile i 30x79" },
  /* 판 위에서 썰리는 재료 8장씩. 01 이 안 썰린 모습이고 08 이 다 썬 모습입니다.
     ⚠️ **가로를 7장 모두 같은 값으로 못박습니다.** 마스터는 가로가 고정(755 / 896)이고
        세로만 줄어듭니다 — 아래쪽이 깎여 나가고 **위쪽 끝은 그대로**입니다.
        그래서 화면에서도 같은 가로로 깔고 위를 맞추면(css .md-ingredient-asset)
        재료가 제자리에서 아래부터 깎입니다. 여기서 세로까지 한 값으로 묶으면
        깎인 그림이 도로 늘어나 안 깎인 것처럼 보입니다.
     세로는 각 장의 원본 비율 그대로입니다 (가로 x 원본세로 / 원본가로). */
  ...[496,496,496,480,438,348,282,211].map((h,i)=>({
    file:`E2/food_cabbage_whole_0${i+1}.png`, size:[531,h], css:".md-ingredient 265.7 폭 고정" })),
  ...[442,442,442,442,436,382,287,206].map((h,i)=>({
    file:`E2/food_carrot_whole_0${i+1}.png`,  size:[588,h], css:".md-ingredient 294.0 폭 고정" })),
  ...[425,425,425,416,394,358,305,250].map((h,i)=>({
    file:`E2/food_potato_whole_0${i+1}.png`,  size:[560,h], css:".md-ingredient 273.7 폭 고정" })),
  /* ---- E2 새우튀김 준비 -------------------------------------------
     밀가루 → 계란물 → 빵가루 세 그릇을 삼각형으로 놓고 그 위에서 새우를 굴립니다.

     [도마] 이 표에 없습니다 — E1 썰기 · E2 채썰기와 같은 그림을 쓰게 되어
     공용 폴더의 `fix_tempura_prep_board.png` 한 장으로 합쳤습니다 (위 나무 쟁반 옆).

     [그릇 3장] .fp-vessel 336x268 자리에 object-fit:contain 입니다.
     셋 다 가로로 넓어(1.10 · 1.25 · 1.25) **세로 268 이 먼저 막히고**
     가로만 295.3 / 333.9 / 335.6 으로 서로 다릅니다. */
  /* [화살표] 그릇 사이의 진행 방향 표시입니다. **한 장을 두 자리에 씁니다** —
     밀가루 → 계란물 은 그대로, 계란물 → 빵가루 는 CSS 에서 135도 돌려 ↙ 로 씁니다.
     그래서 아래 방향 그림을 따로 받지 않아도 됩니다. */
  { file:"E2/shrimp/ui_arrow_right_01.png",         size:[105, 73], css:".fp-coat-arrow-asset 52x36.2" },
  { file:"E2/shrimp/food_tempura_flour_bowl.png",   size:[591,536], css:".fp-vessel 295.3x268" },
  { file:"E2/shrimp/food_egg_wash_bowl.png",        size:[668,536], css:".fp-vessel 333.9x268" },
  { file:"E2/shrimp/food_wet_breadcrumbs_bowl.png", size:[671,536], css:".fp-vessel 335.6x268" },
  /* [새우 10장] 생새우 → 밀가루/계란물/빵가루 각 3단계. 한 자리에서 갈아 끼우는
     **한 벌의 연속 그림**이라 열 장을 한 크기로 묶습니다.
     ⚠️ 납품본은 캔버스가 674x624 ~ 1672x941 로 제각각이었고 새우가 놓인 자리도
        장마다 최대 5px 어긋나 있었습니다. 그대로 두면 옷이 바뀔 때마다 새우가
        튑니다. PNG 마스터 쪽에서 투명 여백만 덧대고 잘라 **열 장 모두
        680x639 · 새우 위치 동일**로 맞춰 뒀습니다 — 잘라낸 화소가 없으니
        무손실입니다 (E3 화구 · E4 냄비와 같은 방식입니다).
        새 납품본을 받으면 캔버스와 새우 위치가 같은지 먼저 확인하고,
        다르면 같은 방식으로 맞춘 뒤 이 스크립트를 돌리세요.
     .fp-shrimp.has-asset 186x175 자리에서 가로가 먼저 막혀 186x174.8 → 2배율 372. */
  ...["raw","flour_light","flour_medium","flour_full","egg_light","egg_medium","egg_full",
      "breadcrumb_light","breadcrumb_medium","breadcrumb_full"]
    .map(name=>({ file:`E2/shrimp/food_shrimp_${name}.png`, size:[372,350], css:".fp-shrimp 186x174.8" })),
  /* [재료 카드 4장] 넷 다 거의 정사각이라 **세로가 먼저 막힙니다** → 2배율 136.
     ⚠️ 이 화면의 .fp-ing-asset 은 공용 86 이 아니라 **68** 입니다. 재료가 4줄이라
        카드가 140 뿐인데, 여백 없이 꽉 찬 납품 그림에 86(그림칸 높이와 같은 값)을
        주면 그림이 카드 테두리에 그대로 닿습니다. 자리를 다시 키우려면 여기 크기도
        같이 고치세요 (css/day-prep-minigames.css 의 `:has(.fp-coat-row)` 규칙).
     ⚠️ 생새우 카드는 판 위 그림(food_shrimp_raw)이 아니라 카드용으로 따로 온
        _panel 장입니다. 같은 새우지만 색과 대비가 카드 쪽에 맞춰져 있습니다. */
  { file:"E2/shrimp/food_shrimp_raw_panel.png",      size:[147,136], css:".fp-ing-asset 73.4x68" },
  { file:"E2/shrimp/food_tempura_flour_panel.png",   size:[143,136], css:".fp-ing-asset 71.5x68" },
  { file:"E2/shrimp/food_egg_wash_panel.png",        size:[139,136], css:".fp-ing-asset 69.6x68" },
  { file:"E2/shrimp/food_wet_breadcrumbs_panel.png", size:[137,136], css:".fp-ing-asset 68.4x68" }
];

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// 여기가 갈라지면 축소 오차까지 손실로 잡혀서 수치가 의미 없어집니다.
function resized(src, w, h){
  return sharp(src).resize(w, h, { kernel: "lanczos3", fit: "fill" });
}

// 산출물 경로. out 을 준 항목만 이름이 따로 가고, 나머지는 마스터와 같은 이름입니다.
function outFile(entry){
  return entry.out || entry.file.replace(/\.png$/, ".webp");
}

// 표에 적은 크기가 원본과 같은 비율인지 봅니다.
// 어긋나면 fit:"fill" 이 그림을 찌그러뜨리므로 조용히 넘어가면 안 됩니다.
// (stretch 항목은 늘려 쓰는 것이 의도라 건너뜁니다 — 위 [stretch] 설명 참고)
function checkAspect(entry, meta){
  if(entry.stretch||!entry.size)return;      // 원본 크기 그대로면 비율이 어긋날 수가 없습니다
  const src = meta.width / meta.height, out = entry.size[0] / entry.size[1];
  if(Math.abs(src - out) / src > 0.02){
    console.warn(`  ! ${entry.file} : 원본 ${meta.width}x${meta.height} 와 목표 ` +
      `${entry.size[0]}x${entry.size[1]} 의 가로세로비가 다릅니다 (찌그러집니다)`);
  }
}

const present = FILES.filter(f => {
  if(fs.existsSync(path.join(ART_DIR, f.file))) return true;
  console.warn(`  ! ${f.file} 이 없습니다 — 건너뜁니다`);
  return false;
});

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(44), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const entry of present){
    const src = path.join(ART_DIR, entry.file);
    const out = path.join(ART_DIR, outFile(entry));
    const meta = await sharp(src).metadata();
    checkAspect(entry, meta);
    const [w,h] = entry.size || [meta.width, meta.height];
    await resized(src, w, h)
      .webp(entry.lossless ? {lossless:true, effort:EFFORT}
                           : {quality:entry.quality||QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size;
    pngTotal += a; webpTotal += b;
    console.log(outFile(entry).padEnd(44), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(entry.lossless?"무손실":`q${entry.quality||QUALITY}`));
  }
  console.log("-".repeat(96));
  console.log("합계".padEnd(36), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
// (원본 크기와 직접 비교하면 크기가 달라 비교 자체가 불가능합니다)
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(44), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const entry of present){
    const src = path.join(ART_DIR, entry.file);
    const out = path.join(ART_DIR, outFile(entry));
    if(!fs.existsSync(out))continue;
    const meta = await sharp(src).metadata();
    const [w,h] = entry.size || [meta.width, meta.height];
    const [a,b] = await Promise.all([
      resized(src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(outFile(entry),"크기 불일치!"); continue; }
    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(outFile(entry).padEnd(44), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
