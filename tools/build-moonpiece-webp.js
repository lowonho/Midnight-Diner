"use strict";

/* ============================================================
   달빛 조각 그림(assets/customer/Special/MoonPiece) PNG → WebP 변환
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-moonpiece-webp.js
     node tools/build-moonpiece-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [크기 = CSS 크기 x2]
   ------------------------------------------------------------
   tools/build-ui-save-webp.js 와 같은 기준입니다. 이 그림이 놓이는 자리는
   css/settings.css 의

     .journal-page-relic { --journal-relic-size: 118upx }

   한 곳뿐입니다(--upx = 1920x1080 프레임에서 1px). x2 는 236 인데, 나중에
   조금 키울 여지를 남겨 300x300 으로 뽑습니다. 줄여 그리는 쪽은 안전하고
   늘려 그리는 쪽만 뭉갭니다. 원본이 1254x1254 정사각이라 비율은 그대로입니다.

   ⚠️ --journal-relic-size 를 150upx 보다 키우면 여기 SIZE 도 같이 키워야
      합니다. 안 그러면 확대되면서 뭉갭니다.

   ------------------------------------------------------------
   [q92 인 이유]
   ------------------------------------------------------------
   여덟 장 모두 금속·유리·천의 부드러운 명암이라 q92 에서 열화가 안 보입니다.
   무손실로 뽑으면 300x300 한 장이 100KB 를 넘어 여덟 장 합계가 1MB 에
   가까워지는데, q92 는 합쳐 200KB 아래입니다. 대신 가장자리가 배경 없이
   바로 잘리는 그림이라 알파는 alphaQuality:100 으로 손대지 않습니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ART_DIR = path.join(__dirname, "..", "assets", "customer", "Special", "MoonPiece");

// 파일 이름 앞 번호가 곧 손님 등장 일차입니다. 영업일지 쪽 짝짓기는
// title.js 의 JOURNAL_MOON_PIECE_ART 가 shardId 로 따로 적어 둡니다.
const FILES = [
  { file:"01_raindrop_glass_keepsake.png", why:"1일차 비에 젖은 아이 · 첫 빗방울" },
  { file:"02_miniature_lantern.png",       why:"2일차 등불을 머리에 인 손님 · 남은 온기" },
  { file:"03_two_shadows_ornament.png",    why:"3일차 둘이 붙은 그림자 · 반쪽 이름 두 개" },
  { file:"04_letter_and_crow_feather.png", why:"4일차 까마귀 우편배달부 · 배달되지 못한 편지" },
  { file:"05_constellation_pendant.png",   why:"5일차 별을 먹는 작은 짐승 · 금빛 소금" },
  { file:"06_wave_and_fish_frame.png",     why:"6일차 바닷물로 된 손님 · 동쪽의 비늘" },
  { file:"07_stopped_pocket_watch.png",    why:"7일차 멈춰버린 교복 인형 · 멈춘 분침" },
  { file:"08_faceless_daeun_ribbon.png",   why:"마지막 예약 얼굴 없는 김다은 · 김다은의 내일" }
];

const SIZE = 300;     // 영업일지 달빛 조각 자리 150upx x2
const QUALITY = 92;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

function outPath(f){
  return path.join(ART_DIR, f.file.replace(/\.png$/, ".webp"));
}

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
function resized(src){
  return sharp(src).resize(SIZE, SIZE, { kernel:"lanczos3", fit:"fill" });
}

function checkSource(f, meta){
  if(meta.width !== meta.height){
    console.warn(`  ! ${f.file} : 정사각이 아닙니다 (${meta.width}x${meta.height}). ` +
      `${SIZE}x${SIZE} 로 맞추면 찌그러집니다.`);
  }
  if(SIZE > meta.width){
    console.warn(`  ! ${f.file} : 원본(${meta.width})보다 크게 뽑고 있습니다. 확대는 화질에 도움이 안 됩니다.`);
  }
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(34), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7));
  for(const f of FILES){
    const src = path.join(ART_DIR, f.file);
    const out = outPath(f);
    const meta = await sharp(src).metadata();
    checkSource(f, meta);
    await resized(src)
      .webp({quality:QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(34), `${meta.width}x${meta.height}`.padStart(11),
      `${SIZE}x${SIZE}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
  console.log("-".repeat(84));
  console.log("합계".padEnd(26), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(ART_DIR, f.file);
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
    console.log(path.basename(out).padEnd(34), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
