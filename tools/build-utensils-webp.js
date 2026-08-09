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

   가로세로 비율은 건드리지 않습니다. 닫힘/열림처럼 상태가 여러 장인 프랍은
   같은 캔버스에 그려져 있어야 겹쳐 놓았을 때 밑동이 어긋나지 않습니다.
   긴 변 축소는 원본 캔버스가 같으면 결과 캔버스도 같으므로 정렬이 유지됩니다.
   (그 검사를 아래 verify 가 같이 합니다)
   ============================================================ */

/* [긴 변 상한] 원본이 화면에서 쓰이는 크기보다 3~5배 큽니다.
   (예: 냉장고 982x1283 → 화면 293x383, 식기세척기 702x1129 → 136x226)
   그대로 두면 브라우저가 받아만 놓고 버리는 픽셀이 대부분입니다.

   640 = 이 씬에서 가장 큰 집기(냉장고)의 화면 높이 383 의 1.67배.
   나머지 집기는 2.5~3배가 남습니다. 창을 4K 로 키워도(Scale.FIT) 원본을
   확대할 일이 없는 여유값입니다.

   [주의] 집기를 지금보다 크게 그리도록 js/kitchen.js STATION_ART 의 w 를
   많이 올렸다면 이 값도 같이 올려야 합니다. 화면 크기보다 작아지면
   그때부터 흐려집니다. verify 가 각 파일의 최종 크기를 찍어 줍니다. */
const MAX_EDGE = 640;

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

// 긴 변을 MAX_EDGE 로 맞춘 목표 크기. 이미 작으면 원본 그대로 둡니다.
function targetSize(width,height){
  const longest=Math.max(width,height);
  if(longest<=MAX_EDGE) return {width,height};
  const ratio=MAX_EDGE/longest;
  return {width:Math.round(width*ratio), height:Math.round(height*ratio)};
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(34), "원본".padStart(10), "WebP 크기".padStart(11), "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7));
  for(const src of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    const meta=await sharp(src).metadata();
    const size=targetSize(meta.width,meta.height);
    await sharp(src)
      .resize(size.width,size.height,{kernel:"lanczos3"})     // 원본 = 그대로 통과
      .webp({quality:QUALITY,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(label(src).padEnd(34), `${meta.width}x${meta.height}`.padStart(10),
      `${size.width}x${size.height}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8), `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("-".repeat(85));
  console.log("합계".padEnd(34), "".padStart(10), "".padStart(11), `${kb(pngTotal)}KB`.padStart(8),
    `${kb(webpTotal)}KB`.padStart(8), `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

/* WebP 가 인코딩 때문에 망가지지 않았는지 확인하고, 불투명 영역 위치도 같이 찍습니다.
   (게임 쪽 배치값이 이 불투명 영역 기준이라 에셋을 다시 받을 때 확인용입니다)

   [비교 기준] 축소는 의도한 변환이므로 오차로 세지 않습니다. 원본 PNG 를
   WebP 와 같은 크기로 같은 커널로 줄인 뒤 비교해서, 순수하게 WebP 인코딩이
   더한 오차만 봅니다.
   [불투명 영역] 원본 PNG 좌표로 찍습니다. js/kitchen.js STATION_ART 의 body 가
   원본 좌표라서 그대로 옮겨 적을 수 있어야 합니다. */
async function verify(){
  console.log("\n품질 검증 (같은 크기로 줄인 PNG 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8), "  불투명 영역 (원본 좌표)");
  for(const src of allTargets()){
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const meta=await sharp(out).metadata();
    const [a,b,full]=await Promise.all([
      sharp(src).resize(meta.width,meta.height,{kernel:"lanczos3"}).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(label(src),"크기 불일치!"); continue; }

    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }

    let x0=Infinity,y0=Infinity,x1=-1,y1=-1;
    const width=full.info.width;
    for(let i=0;i<full.data.length;i+=4){
      if(full.data[i+3]<8)continue;
      const p=i/4,x=p%width,y=(p-x)/width;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
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
