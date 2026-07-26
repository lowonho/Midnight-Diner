"use strict";

/* ============================================================
   주방 집기 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:utensils
     npm run verify:utensils  변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [대상] assets/utensils 아래 모든 PNG (하위 폴더 포함)
   집기 프랍은 전부 축소해서만 쓰므로(쓰레기통 320x560 → 화면 123x175)
   손실 q90 으로 충분합니다. 축소되면서 압축 아티팩트도 같이 줄어듭니다.

   캔버스 크기는 건드리지 않습니다. 닫힘/열림처럼 상태가 여러 장인 프랍은
   같은 캔버스 위에 그려져 있어야 겹쳐 놓았을 때 밑동이 어긋나지 않습니다.
   (그 검사를 아래 verify 가 같이 합니다)
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..", "assets", "utensils");

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

function kb(bytes){ return Math.round(bytes/1024); }

// assets/utensils 아래 모든 PNG (하위 폴더 포함).
function allTargets(dir=ROOT){
  const list=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) list.push(...allTargets(full));
    else if(entry.name.endsWith(".png")) list.push(full);
  }
  return list.sort();
}

const label = src => path.relative(ROOT,src).replace(/\\/g,"/");

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(34), "크기".padStart(10), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7));
  for(const src of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    const meta=await sharp(src).metadata();
    await sharp(src).webp({quality:QUALITY,effort:EFFORT,alphaQuality:100}).toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(label(src).padEnd(34), `${meta.width}x${meta.height}`.padStart(10),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8), `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("-".repeat(72));
  console.log("합계".padEnd(34), "".padStart(10), `${kb(pngTotal)}KB`.padStart(8),
    `${kb(webpTotal)}KB`.padStart(8), `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 원본 PNG 와 변환된 WebP 를 픽셀 단위로 비교하고, 불투명 영역 위치도 같이 찍습니다.
// (게임 쪽 배치값이 이 불투명 영역 기준이라 에셋을 다시 받을 때 확인용입니다)
async function verify(){
  console.log("\n품질 검증 (원본 PNG 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8), "  불투명 영역");
  for(const src of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const [a,b]=await Promise.all([
      sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(label(src),"크기 불일치!"); continue; }

    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    let x0=Infinity,y0=Infinity,x1=-1,y1=-1;
    const {width}=a.info;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      const p=i/4,x=p%width,y=(p-x)/width;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(label(src).padEnd(34), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8),
      `  ${x0},${y0} ~ ${x1},${y1}  (${x1-x0+1}x${y1-y0+1})`);
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
