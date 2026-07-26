"use strict";

/* ============================================================
   음식 프롭 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:food
     node tools/build-food-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   음식 프롭은 264x152 원본을 게임에서 항상 축소해서 씁니다.
     · 손님 주문 말풍선  약 64px 폭
     · 요리사가 든 접시  약 62px 폭 (VIEW 93px)
     · 메뉴 카드 HUD     최대 64px 폭
   확대해서 쓰는 곳이 없으므로 전부 손실 q90 으로 뽑습니다.
   (카운터 철판처럼 확대되는 에셋만 무손실이 필요합니다)

   캔버스 크기는 건드리지 않습니다. 리사이즈·크롭이 들어가면
   food-props.js 의 FOOD_PROP_SIZE 비율과 어긋납니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "food", "prop");

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// food-props.js 가 기대하는 원본 캔버스 규격. 어긋나면 경고합니다.
const EXPECTED = { width:264, height:152 };

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png")).sort();

function kb(bytes){ return Math.round(bytes/1024); }

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(34), "크기".padStart(9), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7));
  for(const name of files){
    const src=path.join(SRC_DIR,name);
    const out=src.replace(/\.png$/,".webp");
    const meta=await sharp(src).metadata();
    await sharp(src)
      .webp({quality:QUALITY,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    const size=`${meta.width}x${meta.height}`;
    const warn=(meta.width!==EXPECTED.width||meta.height!==EXPECTED.height)?"  ← 규격 다름":"";
    console.log(name.padEnd(34), size.padStart(9), `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), warn);
  }
  console.log("-".repeat(72));
  console.log("합계".padEnd(34), "".padStart(9), `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 원본 PNG 와 변환된 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (원본 PNG 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
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
    console.log(name.padEnd(34), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
