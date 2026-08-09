"use strict";

/* ============================================================
   음식 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:food
     node tools/build-food-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [대상]
     assets/food/prop/*.png   메뉴 그림 (그림에 딱 맞게 잘린 낱장)
     assets/food/*.png        연출 스프라이트시트 (김·반짝임)

   캔버스 크기는 건드리지 않습니다. 리사이즈·크롭이 들어가면
   js/food-props.js 의 규격/프레임 계산과 어긋납니다.

   ⚠️ 2026-08-06 메뉴 그림 24장의 **투명 여백을 잘라냈습니다**(원래 전부 264x152).
      이제 장마다 크기가 다릅니다(129x136 ~ 244x136). 화면에 그리는 크기는
      js/food-props.js 가 **옛 캔버스 264x152 를 자(尺)로 삼아** 계산하므로 그대로입니다
      — 그쪽 FOOD_PROP_SIZE 주석을 함께 보세요.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const FOOD_DIR = path.join(__dirname, "..", "assets", "food");
const PROP_DIR = path.join(FOOD_DIR, "prop");

const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

/* 메뉴 그림은 항상 축소해서만 쓰므로(최대 폭 76px) 손실 q90 으로 충분합니다.
   반짝임 시트는 투명 배경 위 고대비 별이라 손실 압축이 별 주변에 링잉을 남깁니다.
   원본이 24KB뿐이라 무손실로 뽑아도 부담이 없어 그렇게 합니다.
   김 시트는 부드러운 그라데이션이라 손실이 잘 먹습니다. */
const JOBS = [
  // 메뉴 그림은 여백을 잘라내 장마다 크기가 다릅니다. 대신 옛 캔버스(264x152)를
  // 넘지는 않아야 합니다 — 넘으면 화면에서 다른 그림보다 커집니다.
  { dir:PROP_DIR, expectMax:{width:264,height:152},           quality:90                 },
  { dir:FOOD_DIR, file:"fx_steam_loop.png",      frames:8,    quality:90                 },
  { dir:FOOD_DIR, file:"fx_perfect_sparkle.png", frames:6,    lossless:true              }
];

function kb(bytes){ return Math.round(bytes/1024); }

// job 하나가 처리할 파일 목록. file 이 지정되면 그 한 장, 아니면 폴더 전체(하위 폴더 제외).
function filesOf(job){
  if(job.file) return [job.file];
  return fs.readdirSync(job.dir)
    .filter(name => name.endsWith(".png") && fs.statSync(path.join(job.dir,name)).isFile())
    .sort();
}

function allTargets(){
  const list=[];
  JOBS.forEach(job => filesOf(job).forEach(name => list.push({job,name,src:path.join(job.dir,name)})));
  return list;
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(30), "크기".padStart(10), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const {job,name,src} of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    const meta=await sharp(src).metadata();
    await sharp(src)
      .webp(job.lossless?{lossless:true,effort:EFFORT}:{quality:job.quality,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;

    // 규격 확인. 낱장은 캔버스 크기, 시트는 프레임 나누어떨어짐을 봅니다.
    let warn="";
    if(job.expect&&(meta.width!==job.expect.width||meta.height!==job.expect.height))warn="  ← 규격 다름";
    if(job.expectMax&&(meta.width>job.expectMax.width||meta.height>job.expectMax.height))warn=`  ← 기준 캔버스(${job.expectMax.width}x${job.expectMax.height})보다 큽니다`;
    if(job.frames&&meta.width%job.frames!==0)warn=`  ← ${job.frames}프레임으로 나누어떨어지지 않음`;

    console.log(name.padEnd(30), `${meta.width}x${meta.height}`.padStart(10),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8), `${Math.round((1-b/a)*100)}%`.padStart(7),
      "  "+(job.lossless?"무손실":`q${job.quality}`)+(job.frames?` · ${job.frames}프레임 ${meta.width/job.frames}x${meta.height}`:"")+warn);
  }
  console.log("-".repeat(84));
  console.log("합계".padEnd(30), "".padStart(10), `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 원본 PNG 와 변환된 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (원본 PNG 대비)");
  console.log("파일".padEnd(30), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const {src} of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const [a,b]=await Promise.all([
      sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    const name=path.basename(src);
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
    console.log(name.padEnd(30), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
