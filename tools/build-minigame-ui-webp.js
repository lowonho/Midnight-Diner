"use strict";

/* ============================================================
   미니게임 공용 프레임 UI 에셋 PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-minigame-ui-webp.js
     node tools/build-minigame-ui-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [다른 build-*-webp.js 와 다른 점 : 여기는 축소가 들어갑니다]
   카운터·음식 에셋과 달리 이 UI 는 스프라이트시트가 아니라 한 장짜리 패널이고,
   납품된 PNG 가 CSS 레이아웃 크기의 4배율입니다. 4배율 그대로 두면 뒤 패널
   한 장이 15MB 라 게임 전체 에셋 용량을 혼자 다 먹습니다.
   그래서 WebP 는 2배율(= CSS 크기의 2배)로 뽑습니다.

   [왜 하필 2배율인가]
   .game-frame 은 max-width 없이 뷰포트를 꽉 채웁니다(css/app-shell.css).
   그래서 실제 렌더 크기는 화면에 따라 달라집니다.
     · 1920x1080 프레임          → 뒤 패널 1498 CSS px (1배율)
     · 위를 DPR 2 화면에서 보면  → 2996 물리 px      (2배율)
     · 4K 프레임을 DPR 1 로 보면 → 2996 물리 px      (2배율)
   즉 2배율이 현실적인 최대치입니다. 4배율은 어느 화면에서도 다 못 쓰고
   메모리만 4배로 먹습니다. (디코딩된 비트맵은 압축률과 무관하게 픽셀 수 만큼
   VRAM 을 차지합니다. 5992x3632 = 87MB, 2996x1816 = 22MB)

   [축소 커널]
   lanczos3 을 씁니다. 나무결·금테처럼 고주파가 많은 텍스처라 bilinear 로
   줄이면 결이 뭉개지고, nearest 로 줄이면 금테에 계단이 집니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "UI", "Minigame", "common");

// 납품 PNG 는 전부 CSS 레이아웃 크기의 4배율입니다. 산출물은 그 절반(2배율).
const SCALE = 0.5;

// 납품 원본이 정말 4배율인지 확인하는 표입니다. 여기 적힌 값은
// css/minigame-frame.css 의 1920x1080 기준 환산 주석과 같은 숫자입니다.
// 새 에셋을 받았는데 경고가 뜨면, 에셋과 CSS 변수 중 어느 쪽이 틀렸는지
// 먼저 확인하고 나서 이 표를 고치세요.
const EXPECTED_1X = {
  "ui_minigame_back_panel.png":   [1498, 908],   // .mini-window
  "ui_minigame_title_panel.png":  [ 692, 114],   // .mini-title-panel
  "ui_minigame_play_board.png":   [1440, 659],   // .mini-stage
  "ui_minigame_tip_bar.png":      [1440,  87],   // .mini-tip
  "ui_minigame_close_button.png": [  58,  58],   // #miniClose
  "ui_minigame_pause_button.png": [  58,  58]    // #miniPause
};

// 버튼 2종만 무손실입니다. 116x116 짜리라 무손실로 떠도 17KB 밖에 안 되는 반면,
// 넓은 나무 텍스처와 달리 아이콘은 면적이 작아 q90 아티팩트가 눈에 바로 띕니다.
// (검증 수치로도 버튼만 RGB 평균 오차가 패널의 2배 이상이었습니다)
const LOSSLESS = new Set([
  "ui_minigame_close_button.png",
  "ui_minigame_pause_button.png"
]);

const QUALITY = 90;
const EFFORT = 6;   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

const files = fs.readdirSync(SRC_DIR).filter(name => name.endsWith(".png"));

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// 여기가 갈라지면 축소 오차까지 손실로 잡혀서 수치가 의미 없어집니다.
function resized(src, w, h){
  return sharp(src).resize(w, h, { kernel: "lanczos3", fit: "fill" });
}

function targetSize(name, meta){
  const w = Math.round(meta.width * SCALE);
  const h = Math.round(meta.height * SCALE);
  const expected = EXPECTED_1X[name];
  if(expected && (w !== expected[0]*2 || h !== expected[1]*2)){
    console.warn(`  ! ${name} : 4배율 가정과 다릅니다. ` +
      `원본 ${meta.width}x${meta.height} → ${w}x${h} (예상 ${expected[0]*2}x${expected[1]*2})`);
  }
  return [w, h];
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(32), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const name of files){
    const src=path.join(SRC_DIR,name);
    const out=src.replace(/\.png$/,".webp");
    const meta=await sharp(src).metadata();
    const [w,h]=targetSize(name,meta);
    const lossless=LOSSLESS.has(name);
    await resized(src,w,h)
      .webp(lossless?{lossless:true,effort:EFFORT}:{quality:QUALITY,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(name.padEnd(32), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(lossless?"무손실":`q${QUALITY}`));
  }
  console.log("-".repeat(90));
  console.log("합계".padEnd(32), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
// (원본 4배율과 직접 비교하면 크기가 달라 비교 자체가 불가능합니다)
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(32), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const name of files){
    const src=path.join(SRC_DIR,name);
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const meta=await sharp(src).metadata();
    const [w,h]=targetSize(name,meta);
    const [a,b]=await Promise.all([
      resized(src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
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
    console.log(name.padEnd(32), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
