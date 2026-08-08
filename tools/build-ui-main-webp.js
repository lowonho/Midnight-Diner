"use strict";

/* ============================================================
   타이틀 화면 에셋(assets/UI/Main) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:ui-main
     npm run verify:ui-main   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   여기 있는 것은 **타이틀 화면 전용** 두 장입니다.
     · 거리 배경   bg_title_variant_04_modern_4x.png  (7680x4320)
     · 로고 글씨   ui_title_moonlight_table_variant_03_main.png  (1697x706)
   로고는 타이틀과 인게임 좌상단 HUD 두 곳에서 크기가 달라 두 벌 뽑습니다.

   ------------------------------------------------------------
   [1] 거리 배경 — 1920x1080, 손실 q88 입니다
   ------------------------------------------------------------
   타이틀 화면은 창 전체가 아니라 16:9 무대(.title-stage)에 깔립니다.
   그 무대의 최대 크기가 곧 --upx 의 기준인 1920x1080 이라 그보다 크게
   뽑을 이유가 없습니다. (2배율로 뽑아도 화면 픽셀은 안 늘고 파일만 4배)

   ⚠️ 이 배경 안의 '달빛식탁' 간판 자리는 QA 숨은 입구(css/qa-mode.css 의
      --qa-sign-*)와 픽셀이 맞아 있습니다. 배경 그림을 다른 구도로 교체하면
      그 좌표도 다시 재야 합니다.

   [무손실이 아닌 이유] 비 오는 밤거리 사진풍 그림이라 그라디언트와 노이즈가
   화면을 가득 채웁니다. 무손실은 7MB 가 넘고, q88 은 285KB 인데 눈으로
   구분이 안 됩니다. 알파도 없어서 테두리가 뭉갤 일이 없습니다.
   (q82 는 194KB 지만 젖은 바닥 반사에 블록이 보입니다)

   ------------------------------------------------------------
   [2] 로고 글씨 — 화면에 그려지는 크기의 2배입니다
   ------------------------------------------------------------
   CSS 레이아웃 크기(1920 프레임 기준 px) x2 로 잡았습니다.
   높이는 폭 ÷ 원본 비율(1697/706 = 2.404)이라 CSS 의 aspect-ratio 와 같습니다.
     타이틀 : --title-logo-w 500 x 208  → 1080x449 (2배보다 조금 큽니다.
              로고를 540 에서 500 으로 줄일 때 파일은 그대로 두었습니다 —
              더 큰 쪽으로 남는 것은 화질에 손해가 없어서입니다)
     HUD    : --hud-logo-w   240 x 100  →  480x200
   ⚠️ css/title.css 의 --title-logo-w · css/hud.css 의 --hud-logo-w 를
      고치면 아래 크기 표도 같이 고쳐야 합니다.
   ⚠️ 로고 원화를 다른 변형으로 갈아끼우면 비율이 달라집니다(variant_01 은
      2.767, variant_03 은 2.404). 두 CSS 의 aspect-ratio 도 같이 고치세요.

   [타이틀판이 near-lossless 인 이유] 금박 글씨에 결·별빛이 촘촘해서
   손실 압축이 잘 안 듣습니다. q92 로도 불투명 영역 RGB 평균 오차가 5 를
   넘는데(같은 판단으로 걷어낸 선례: tools/build-ui-common-webp.js 의
   영업 상태 간판), 무손실은 그 1.5배 용량입니다.
   near-lossless q60 이면 RGB 최대 오차가 2 — 무손실과 눈으로 같습니다.

   [HUD판이 무손실인 이유] 480x200 이라 무손실도 120KB 남짓입니다.
   이 크기에서는 손실로 아낄 이유가 없습니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Main");

/* [file]         UI_DIR 기준 파일 이름 (PNG 마스터)
   [size]         뽑아낼 WebP 크기 [가로, 세로]
   [out]          출력 이름. 기본은 확장자만 .webp 로 바꾼 이름입니다.
   [lossless]     무손실로 뽑을 것
   [nearLossless] near-lossless 로 뽑을 것 (quality 가 0~100 의 세기)
   [quality]      손실/near-lossless 의 품질. 없으면 QUALITY
   [why]          그 크기의 근거. 주석용입니다. */
const FILES = [
  { file:"bg_title_variant_04_modern_4x.png", out:"bg_title_modern.webp",
    size:[1920,1080], quality:88, why:"타이틀 16:9 무대(.title-stage) 최대 크기 = --upx 기준 1920x1080" },
  { file:"ui_title_moonlight_table_variant_03_main.png", out:"ui_title_logo_main.webp",
    size:[1080,449], nearLossless:true, quality:60, why:"타이틀 로고 --title-logo-w 500x208 의 2배 이상" },
  { file:"ui_title_moonlight_table_variant_03_main.png", out:"ui_title_logo_hud.webp",
    size:[480,200], lossless:true, why:"인게임 좌상단 로고 --hud-logo-w 240x100 x2" }
];

const QUALITY = 92;   // quality 를 따로 안 준 손실 항목의 기본값
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function outPath(f){
  return path.join(UI_DIR, f.out || f.file.replace(/\.png$/, ".webp"));
}

function webpOptions(f){
  if(f.lossless) return { lossless:true, effort:EFFORT };
  if(f.nearLossless) return { nearLossless:true, quality:f.quality ?? QUALITY, effort:EFFORT };
  return { quality:f.quality ?? QUALITY, effort:EFFORT, alphaQuality:100 };
}

function modeLabel(f){
  if(f.lossless) return "무손실";
  if(f.nearLossless) return `준무손실 q${f.quality ?? QUALITY}`;
  return `q${f.quality ?? QUALITY}`;
}

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// 여기가 갈라지면 축소 오차까지 손실로 잡혀서 수치가 의미 없어집니다.
function resized(src, w, h){
  return sharp(src).resize(w, h, { kernel:"lanczos3", fit:"fill" });
}

function checkAspect(f, meta){
  const source = meta.width / meta.height;
  const target = f.size[0] / f.size[1];
  const drift = Math.abs(target - source) / source;
  if(drift > ASPECT_TOLERANCE){
    console.warn(`  ! ${f.file} : 가로세로비가 ${(drift*100).toFixed(1)}% 다릅니다. ` +
      `원본 ${meta.width}x${meta.height}(${source.toFixed(3)}) → ${f.size[0]}x${f.size[1]}(${target.toFixed(3)})`);
  }
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(28), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(9), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    const meta = await sharp(src).metadata();
    checkAspect(f, meta);
    const [w,h] = f.size;
    await resized(src, w, h).webp(webpOptions(f)).toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(28), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(9), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+modeLabel(f));
  }
  console.log("-".repeat(96));
  console.log("합계".padEnd(20), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(9), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
// (원본 크기와 직접 비교하면 크기가 달라 비교 자체가 불가능합니다)
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(28), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    if(!fs.existsSync(out))continue;
    const [w,h] = f.size;
    const [a,b] = await Promise.all([
      resized(src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(path.basename(out),"크기 불일치!"); continue; }
    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(path.basename(out).padEnd(28), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
