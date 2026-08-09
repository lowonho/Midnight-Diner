"use strict";

/* ============================================================
   컷씬 원화(assets/Cutscene) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:cutscene
     npm run verify:cutscene   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [1920x1080 으로 뽑는 이유]
   ------------------------------------------------------------
   컷씬은 대화 오버레이 뒤 화면 전체(.story-cutscene)에 깔립니다. 그 자리는
   16:9 게임 프레임 그대로이고, 프레임의 기준 크기가 --upx 의 기준인
   1920x1080 입니다. 원화는 그 4배(7680x4320)라 그대로 두면 화면 픽셀은
   안 늘고 파일만 16배가 됩니다.

   ⚠️ 원화가 16:9 가 아니면 화면을 채우면서 좌우가 잘립니다
      (background-size:cover). 아래 checkAspect 가 미리 알려 줍니다.

   ------------------------------------------------------------
   [무손실이 아닌 이유 · q88]
   ------------------------------------------------------------
   밤거리·사무실·빗속 사진풍 그림이라 그라디언트와 노이즈가 화면을 가득
   채웁니다. 타이틀 배경(tools/build-ui-main-webp.js)과 같은 성격의 그림이고
   같은 판단을 그대로 씁니다 — 무손실은 7MB 가 넘는데 q88 은 300KB 남짓이고
   눈으로 구분이 안 됩니다. 알파가 없어서 테두리가 뭉갤 일도 없습니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const CUTSCENE_DIR = path.join(__dirname, "..", "assets", "Cutscene");

/* [file]  CUTSCENE_DIR 기준 경로 (PNG 마스터)
   [size]  뽑아낼 WebP 크기 [가로, 세로]
   [why]   그 컷이 어디에 쓰이는지. js/story-cinematic.js 의 STORY_CUTSCENES 와 짝입니다. */
const FILES = [
  { file:"prologue/cutscene_02_reprimand_variant.png", size:[1920,1080],
    why:"SCN-P01 앞부분 · 야근 중 상사에게 지적받는 사무실" },
  { file:"prologue/cutscene_01_commute_variant.png", size:[1920,1080],
    why:"SCN-P01 뒷부분 · 회사를 나와 혼자 걷는 밤 퇴근길" },
  { file:"prologue/rainy_alley_woman_high_angle_4k.png", size:[1920,1080],
    why:"SCN-P02 앞부분 · 비 쏟아지는 골목에 선 김다은(부감)" },
  { file:"prologue/cutscene_03_rain_entry.png", size:[1920,1080],
    why:"SCN-P02 뒷부분 · 빗속에서 달빛식탁 문을 여는 장면" }
];

const QUALITY = 88;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function srcPath(f){ return path.join(CUTSCENE_DIR, f.file); }
function outPath(f){ return path.join(CUTSCENE_DIR, f.file.replace(/\.png$/, ".webp")); }
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
  console.log("파일".padEnd(40), "원본크기".padStart(11), "출력크기".padStart(11),
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
    console.log(path.basename(out).padEnd(40), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(9), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("-".repeat(92));
  console.log("합계".padEnd(32), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(9), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
// (원본 크기와 직접 비교하면 크기가 달라 비교 자체가 불가능합니다)
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(40), "RGB평균".padStart(9), "RGB최대".padStart(8));
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
    console.log(path.basename(out).padEnd(40),
      (sum/a.data.length).toFixed(2).padStart(9), String(max).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(String(error.message||error)); process.exit(1); });
