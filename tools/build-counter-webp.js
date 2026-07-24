"use strict";

/* ============================================================
   카운터 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-counter-webp.js
     node tools/build-counter-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   캔버스 크기·프레임 규격은 건드리지 않습니다. 리사이즈·크롭·패딩이
   들어가면 스프라이트시트 프레임이 어긋납니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "counter");

// 철판 2종은 게임에서 1.28배 확대해 쓰므로 압축 아티팩트도 같이 확대됩니다.
// 그래서 이 둘만 무손실로 뽑고, 나머지는 q90 입니다. (§7-4)
// 두 파일은 반드시 같은 방식으로 변환해야 이음새에서 색이 어긋나지 않습니다.
const LOSSLESS = new Set([
  "counter_griddle_front.png",
  "counter_griddle_surface_cook.png"
]);

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png"));

function kb(bytes){ return Math.round(bytes/1024); }

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(38), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const name of files){
    const src=path.join(SRC_DIR,name);
    const out=src.replace(/\.png$/,".webp");
    const lossless=LOSSLESS.has(name);
    await sharp(src)
      .webp(lossless?{lossless:true,effort:EFFORT}:{quality:QUALITY,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(name.padEnd(38), `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(lossless?"무손실":`q${QUALITY}`));
  }
  console.log("-".repeat(72));
  console.log("합계".padEnd(38), `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 원본 PNG 와 변환된 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (원본 PNG 대비)");
  console.log("파일".padEnd(38), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const name of files){
    const src=path.join(SRC_DIR,name);
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const [a,b]=await Promise.all([
      sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(name,"크기 불일치!"); continue; }
    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(name.padEnd(38), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
