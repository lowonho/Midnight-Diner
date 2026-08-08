"use strict";

/* ============================================================
   엔딩 컷씬 원화(assets/story/bg) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:story-ending
     npm run verify:story-ending   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [720x405 로 뽑는 이유]
   ------------------------------------------------------------
   지금 이 그림이 나오는 자리는 로비 영업일지의 엔딩 장 하나뿐입니다.
   css/settings.css 의 `.journal-page.is-ending .journal-page-portrait` 가
   360 x 202.5 (16:9, --upx = 1920x1080 프레임에서 1px) 이라 그 두 배입니다.
   원본은 1920x1080 이고 컷씬 자리도 16:9 라 비율은 그대로입니다.

   ⚠️ 나중에 엔딩 컷씬을 화면 전체(.story-cutscene)에도 깔게 되면 그때는
      1920x1080 짜리가 따로 필요합니다. 프롤로그 컷씬이 그 경우이고
      tools/build-cutscene-webp.js 가 같은 그림을 1920x1080 으로 뽑습니다.
      이 파일을 1920 으로 키우지 말고, 그 스크립트에 컷을 추가하세요.
      (일지 자리에 1920 짜리를 쓰면 화면 픽셀은 안 늘고 파일만 커집니다)

   ------------------------------------------------------------
   [무손실이 아닌 이유 · q88]
   ------------------------------------------------------------
   프롤로그 컷씬(tools/build-cutscene-webp.js)과 같은 성격의 그림이라 같은
   판단을 그대로 씁니다 — 식당 내부·새벽 하늘의 그라디언트와 질감이 화면을
   가득 채워서 무손실은 장당 MB 단위인데 q88 은 수십 KB 이고 눈으로 구분이
   안 됩니다. 알파가 없어서 테두리가 뭉갤 일도 없습니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const STORY_BG_DIR = path.join(__dirname, "..", "assets", "story", "bg");

/* [file]  STORY_BG_DIR 기준 파일 이름 (PNG 마스터)
   [size]  뽑아낼 WebP 크기 [가로, 세로]
   [why]   어느 엔딩의 컷인지. story-data.js 의 TITLE_JOURNAL_ENDING_DEFS 와,
           title.js 의 JOURNAL_ENDING_ART 와 짝입니다. */
const FILES = [
  { file:"01_loop_daeun_reenters_restaurant_entrance_v3.png", size:[720,405],
    why:"엔딩 1 loop_return · 다시 첫째 날" },
  { file:"02_morning_alone_loop_restaurant_unified_v7.png", size:[720,405],
    why:"엔딩 2 alone_morning · 혼자 맞은 아침" },
  { file:"03_guests_dawn_loop_restaurant_unified_v2.png", size:[720,405],
    why:"엔딩 3 guests_dawn · 손님들의 새벽" },
  { file:"04_eternally_open_trapped_balanced_texture_v9.png", size:[720,405],
    why:"엔딩 4 open_forever · 영원히 영업 중" },
  { file:"05_morning_together_restaurant_unified_v2.png", size:[720,405],
    why:"엔딩 5 morning_together · 함께 오는 아침" }
];

const QUALITY = 88;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function srcPath(f){ return path.join(STORY_BG_DIR, f.file); }
function outPath(f){ return path.join(STORY_BG_DIR, f.file.replace(/\.png$/, ".webp")); }
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
  console.log("파일".padEnd(48), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(9), "WebP".padStart(8), "절감".padStart(7));
  for(const f of FILES){
    const src = srcPath(f);
    const out = outPath(f);
    if(!fs.existsSync(src)) throw new Error(`원본이 없습니다: ${src}\n  (${f.why})`);
    const meta = await sharp(src).metadata();
    checkAspect(f, meta);
    const [w,h] = f.size;
    await resized(src, w, h).webp({quality:QUALITY, effort:EFFORT}).toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(48), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(9), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("-".repeat(100));
  console.log("합계".padEnd(40), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(9), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
// (원본 크기와 직접 비교하면 크기가 달라 비교 자체가 불가능합니다)
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(48), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = srcPath(f);
    const out = outPath(f);
    if(!fs.existsSync(out))continue;
    const [w,h] = f.size;
    const [a,b] = await Promise.all([
      resized(src,w,h).removeAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).removeAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(path.basename(out),"크기 불일치!"); continue; }
    let sum=0,max=0;
    for(let i=0;i<a.data.length;i++){
      const d=Math.abs(a.data[i]-b.data[i]);
      sum+=d; max=Math.max(max,d);
    }
    console.log(path.basename(out).padEnd(48),
      (sum/a.data.length).toFixed(2).padStart(9), String(max).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(String(error.message||error)); process.exit(1); });
