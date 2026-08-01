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
   [size]     뽑아낼 WebP 크기 [가로, 세로]
   [css]      그 크기의 근거가 되는 화면 자리 (1920 프레임 기준 px). 주석용입니다.
   [lossless] 무손실로 뽑을 것 — 면적이 작아 q90 아티팩트가 바로 눈에 띄는 것만 */
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
     자리는 .batter-prep-scene 의 --bowl (400) 이라 2배율이 800 입니다.
     오른쪽 '참고 모양' 칸(172)에도 같은 파일을 줄여 씁니다. */
  ...["04_food_kimchi_batter_bowl_empty","05_food_kimchi_batter_bowl_water",
      "06_food_kimchi_batter_bowl_flour","07_food_kimchi_batter_bowl_kimchi",
      "08_food_kimchi_batter_bowl_kimchi_flour","09_food_kimchi_batter_bowl_water_flour",
      "10_food_kimchi_batter_bowl_water_kimchi","11_food_kimchi_batter_bowl_flour_kimchi",
      "12_food_kimchi_batter_bowl_all_unmixed"]
    .map(name=>({ file:`E8/${name}.png`, size:[800,800], css:".bt-bowl 400x400 (--bowl)" })),
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
  { file:"ui_play_tray_wood.png",                size:[1580,1176], css:"플레이 칸 824.2x613.2 (원본 배율 유지)" }
];

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// 여기가 갈라지면 축소 오차까지 손실로 잡혀서 수치가 의미 없어집니다.
function resized(src, w, h){
  return sharp(src).resize(w, h, { kernel: "lanczos3", fit: "fill" });
}

// 표에 적은 크기가 원본과 같은 비율인지 봅니다.
// 어긋나면 fit:"fill" 이 그림을 찌그러뜨리므로 조용히 넘어가면 안 됩니다.
function checkAspect(entry, meta){
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
    const out = src.replace(/\.png$/, ".webp");
    const meta = await sharp(src).metadata();
    checkAspect(entry, meta);
    const [w,h] = entry.size;
    await resized(src, w, h)
      .webp(entry.lossless ? {lossless:true, effort:EFFORT}
                           : {quality:QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size;
    pngTotal += a; webpTotal += b;
    console.log(entry.file.padEnd(44), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
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
    const out = src.replace(/\.png$/, ".webp");
    if(!fs.existsSync(out))continue;
    const [w,h] = entry.size;
    const [a,b] = await Promise.all([
      resized(src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(entry.file,"크기 불일치!"); continue; }
    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(entry.file.padEnd(44), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
