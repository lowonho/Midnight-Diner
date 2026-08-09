"use strict";

/* ============================================================
   배경 장식 소품 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   대상: assets/bg/decoration/  (서비스 벨 · 메뉴 양옆 전등 ·
         정면 벽 장식 · 좌측벽 화분/게시판)
   배치값은 decoration.js 한 곳에 있습니다.

   사용법:
     npm install sharp                       (1회)
     npm run build:decoration
     npm run verify:decoration               변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   캔버스 크기는 건드리지 않습니다. decoration.js 의 배치표가
   원본 픽셀 기준 trim(불투명 영역) 좌표를 들고 있어서, 리사이즈나
   크롭이 들어가면 벽에 붙는 자리가 통째로 어긋납니다.

   [q90 인 이유] 전부 게임에서 크게 축소해 씁니다
   (전등 704→150 = 0.21배, 화분/게시판 1536→528 = 0.34배).
   축소가 압축 아티팩트를 같이 뭉개 주므로 무손실이 필요 없습니다.
   반대로 확대해 쓰는 소품이 새로 들어오면 LOSSLESS 에 넣으세요.

   [더 낮은 품질을 쓰는 파일] 축소 배율이 유난히 큰 소품 몇 개는
   QUALITY_OVERRIDE 에서 따로 낮춥니다. 0.1배 아래로 줄여 그리는 그림은
   q90 으로 아무리 곱게 구워도 화면에 그 정보가 남지 않습니다 —
   파일만 커집니다. 판단 기준은 "게임에서 그리는 크기 ÷ 원본 크기" 입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "bg", "decoration");

// 게임에서 원본보다 크게 그리는 소품만 여기에 넣습니다. 지금은 없습니다.
const LOSSLESS = new Set([]);

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.
const ALPHA_QUALITY = 100;

/* 파일별 품질 예외. 옆의 배율은 "게임에서 그리는 크기 ÷ 원본 크기" 입니다.
   (배치값은 decoration.js §3-5 ~ §3-7 에 있습니다)

   [연기만 alpha 를 같이 낮추는 이유] 연기는 RGB 가 거의 단색 회색이고
   모양을 전부 알파가 들고 있습니다. 그래서 quality 만 낮추면 파일이
   307KB → 267KB 밖에 안 줄고, alphaQuality 를 70 으로 내리면 95KB 가
   됩니다. 0.17배로 줄여 그리는 반투명 연기라 알파 계단은 화면에서
   보이지 않습니다. */
const QUALITY_OVERRIDE = {
  "fx_cooking_steam_6f.png":       { quality:75, alphaQuality:70 },  // 한 칸 327 → 56  (0.17배)
  "food_kimchi_pancake_pan.png":   { quality:75 },                   // 1255 → 88  (0.07배)
  "prop_fridge_top_decor.png":     { quality:75 },                   // 1488 → 167 (0.11배)
  "prop_sink_plant.png":           { quality:75 },                   //  585 → 40  (0.07배)
  "prop_dishwasher_cat_ears.png":  { quality:75 }                    // 1657 → 137 (0.08배)
};

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png"));

function kb(bytes){ return Math.round(bytes/1024); }

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(38), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const name of files){
    const src=path.join(SRC_DIR,name);
    const out=src.replace(/\.png$/,".webp");
    const lossless=LOSSLESS.has(name);
    const override=QUALITY_OVERRIDE[name]||{};
    const quality=override.quality??QUALITY;
    const alphaQuality=override.alphaQuality??ALPHA_QUALITY;
    await sharp(src)
      .webp(lossless?{lossless:true,effort:EFFORT}:{quality,effort:EFFORT,alphaQuality})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    const mode=lossless?"무손실":`q${quality}`+(alphaQuality===ALPHA_QUALITY?"":`/a${alphaQuality}`);
    console.log(name.padEnd(38), `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+mode);
  }
  console.log("-".repeat(72));
  console.log("합계".padEnd(38), `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

/* 원본 PNG 와 변환된 WebP 를 픽셀 단위로 비교합니다.
   알파 최대 오차가 0 이 아니면 trim 경계가 밀렸을 수 있으니
   decoration.js 의 trim 값을 다시 재세요. */
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

/* decoration.js 의 trim 표가 아직 맞는지 확인합니다.
   에셋을 다시 받아 여백 두께가 바뀌면 배치가 통째로 밀리는데,
   화면을 보기 전에는 눈치채기 어려워서 여기서 같이 찍어 줍니다. */
async function printTrim(){
  console.log("\n불투명 영역 실측 (decoration.js DECORATION_ART.trim 과 같아야 합니다)");
  for(const name of files){
    const {data,info}=await sharp(path.join(SRC_DIR,name))
      .ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let x0=info.width,y0=info.height,x1=-1,y1=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      if(data[(y*info.width+x)*4+3]>16){
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      }
    }
    console.log(name.replace(/\.png$/,"").padEnd(34),
      `trim:[${x0},${y0},${x1-x0+1},${y1-y0+1}]`);
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
  await printTrim();
})().catch(error=>{ console.error(error); process.exit(1); });
