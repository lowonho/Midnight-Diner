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

     ⚠️ **세로를 억지로 맞추지 않습니다.** 가스버너는 612 / 616 / 607 로 장마다
        다른데, 불꽃이 더 높이 솟은 장이 그만큼 캔버스가 큰 것입니다. 내용 폭(1411)과
        아래 여백은 세 장이 같으므로, 화면에서 같은 폭으로 깔고 아래를 맞추면
        (css/minigame-parts.css 의 .mg-burner-frame) 화구 몸통은 고정된 채
        불꽃만 위로 늘었다 줄었다 합니다. 여기서 한 크기로 묶으면 오히려
        몸통이 늘었다 줄었다 하며 들썩입니다. */
  ...["01","02","03"].flatMap(no=>[
    { file:`E3/fix_gas_burner_low_fire_${no}.png`, size:null, css:"가스버너 (원본 배율 유지)" },
    { file:`E3/fix_griddle_burner_fire_${no}.png`, size:null, css:"철판 화구 (원본 배율 유지)" }
  ]),
  /* E3 조리기구 2종. 화구와 달리 **4배율 마스터**라 절반으로 줄여 2배율을 만듭니다.
       팬    화면 640 x 278 — 손잡이까지 포함한 크기입니다. 몸통(타원)은 그중 79.7%
             뿐이고 나머지 오른쪽이 손잡이라, 자리를 잡을 때는 몸통 중심(그림 왼쪽에서
             39.9%)을 화구 불꽃 링에 맞춥니다. 손잡이는 플레이 칸 밖으로 나가
             .kf-board / .ts-board 의 overflow:hidden 에 잘립니다.
       철판  화면 760 x 321 */
  { file:"E3/fix_frying_pan_wide_inner_4x.png",             size:[1280,556], css:".frying-pan · .two-side-pan 640x278" },
  { file:"E3/fix_griddle_plate_wide_mild_trapezoid_4x.png", size:[1520,643], css:".yk-griddle 760x321" }
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
                           : {quality:QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size;
    pngTotal += a; webpTotal += b;
    console.log(outFile(entry).padEnd(44), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(entry.lossless?"무손실":`q${QUALITY}`));
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
