"use strict";

/* ============================================================
   이야기 소품(js/story-prop-reveal.js) PNG → WebP 변환
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:story-prop
     npm run verify:story-prop   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [컷씬(build-cutscene-webp.js)과 따로 있는 이유]
   ------------------------------------------------------------
   같은 assets/Cutscene 아래 있지만 성격이 정반대입니다.

     컷씬  화면 전체를 채우는 배경. 16:9 로 고정(fit:fill), 알파 없음.
     소품  화면 가운데에 물건 하나만 떠오름. 비율은 원본 그대로,
           가장자리가 투명해야 빛무리 위에 떠 보입니다.

   컷씬 스크립트에 넣으면 945x1059 짜리 영업일지가 1920x1080 으로 늘어나
   납작해지고, removeAlpha 로 검증하느라 투명도 손상도 못 잡습니다.

   ------------------------------------------------------------
   [크기 = CSS 크기 x2]
   ------------------------------------------------------------
   소품이 놓이는 자리는 css/story.css 의 .story-prop-art 한 곳뿐입니다.

     width  min(30vw,300upx)   height min(34vw,340upx)

   (--upx = 1920x1080 프레임에서 1px) 세로가 더 긴 자리라 긴 쪽 340 의 x2 인
   680 을 한 변으로 하는 상자에 비율 그대로(fit:inside) 담습니다. 줄여 그리는
   쪽은 안전하고 늘려 그리는 쪽만 뭉갭니다.

   ------------------------------------------------------------
   [q92 · alphaQuality 100]
   ------------------------------------------------------------
   tools/build-moonpiece-webp.js 와 같은 판단입니다. 가죽·종이의 부드러운
   명암이라 q92 에서 열화가 안 보이고, 배경 없이 가장자리가 바로 잘리는
   그림이라 알파는 손대지 않습니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REPO = path.join(__dirname, "..");
const CUTSCENE_DIR = path.join(REPO, "assets", "Cutscene");

/* PNG 마스터는 저장소 밖에 두어도 됩니다 — build-cutscene-webp.js 와 같은
   규칙이라 마스터 폴더도 같은 곳을 봅니다. */
const MASTER_ROOT = process.env.MD_ART_MASTERS
  ? path.join(process.env.MD_ART_MASTERS, "..", "Cutscene")
  : path.join(REPO, "..", "Midnight-Diner-art-masters", "Cutscene");

/* [file] CUTSCENE_DIR 기준 경로 (PNG 마스터)
   [why]  그 소품이 어디서 뜨는지. js/story-prop-reveal.js 의 STORY_PROPS 와 짝입니다. */
const FILES = [
  { file:"prologue/prop_business_journal_closed_moonlight_table_v2.png",
    why:"SCN-P04 첫 내레이션 · 카운터 위에서 발견하는 달빛식탁 영업일지" }
];

const BOX = 680;      // .story-prop-art 의 긴 쪽 340upx x2
const QUALITY = 92;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

function srcPath(f){
  const outside = path.join(MASTER_ROOT, f.file);
  return fs.existsSync(outside) ? outside : path.join(CUTSCENE_DIR, f.file);
}
function outPath(f){ return path.join(CUTSCENE_DIR, f.file.replace(/\.png$/, ".webp")); }
function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// fit:inside 라 비율이 그대로 유지됩니다 — 소품은 늘어나면 바로 티가 납니다.
function resized(src){
  return sharp(src).resize(BOX, BOX, { kernel:"lanczos3", fit:"inside", withoutEnlargement:true });
}

function checkSource(f, meta){
  if(!meta.hasAlpha){
    console.warn(`  ! ${f.file} : 알파가 없습니다. 가장자리가 검은 네모로 떠오릅니다.`);
  }
  if(BOX > Math.max(meta.width, meta.height)){
    console.warn(`  ! ${f.file} : 원본(${meta.width}x${meta.height})보다 크게 뽑으려 합니다. ` +
      `withoutEnlargement 로 원본 크기에 머뭅니다.`);
  }
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(52), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(9), "WebP".padStart(8), "절감".padStart(7));
  for(const f of FILES){
    const src = srcPath(f);
    const out = outPath(f);
    if(!fs.existsSync(src)) throw new Error(
      `원본이 없습니다: ${src}\n  (${f.why})\n`
      + `  마스터 폴더도 확인했습니다: ${path.join(MASTER_ROOT, f.file)}`);
    const meta = await sharp(src).metadata();
    checkSource(f, meta);
    fs.mkdirSync(path.dirname(out), {recursive:true});
    await resized(src)
      .webp({quality:QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const outMeta = await sharp(out).metadata();
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(52), `${meta.width}x${meta.height}`.padStart(11),
      `${outMeta.width}x${outMeta.height}`.padStart(11),
      `${kb(a)}KB`.padStart(9), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("-".repeat(104));
  console.log("합계".padEnd(44), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(9), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(52), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = srcPath(f);
    const out = outPath(f);
    if(!fs.existsSync(out))continue;
    const [a,b] = await Promise.all([
      resized(src).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
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
    console.log(path.basename(out).padEnd(52), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(String(error.message||error)); process.exit(1); });
