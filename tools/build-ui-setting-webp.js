"use strict";

/* ============================================================
   설정창 UI 에셋(assets/UI/Setting) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-ui-setting-webp.js
     node tools/build-ui-setting-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [배율 기준 = "CSS 레이아웃 크기의 2배"]
   ------------------------------------------------------------
   설정창은 미니게임 오버레이처럼 DOM 이고, 크기는 css/settings.css 가
   --upx(1920x1080 프레임에서 1px) 배수로 정합니다. 그래서 여기 목표 크기는
   전부 "css/settings.css 가 쓰는 CSS 크기 x2" 입니다.
   (assets/UI/Minigame 쪽 tools/build-minigame-ui-webp.js 와 같은 기준입니다)

   ⚠️ css/settings.css 의 --set-panel-w / --set-panel-h / --set-toggle-w 등을
      고치면 아래 표도 같이 고쳐야 합니다. 안 고치면 화면에서 확대되어 뭉갭니다.

   ------------------------------------------------------------
   [ingame / lobby 두 장인 이유]
   ------------------------------------------------------------
   같은 설정창인데 들어가는 칸 수가 다릅니다.
     · ingame (게임 중 일시정지) — 소리 3줄 + 포인터 + 저장/불러오기 +
       게임으로 돌아가기 + 타이틀 화면으로  →  세로로 긴 판 (1920x2459)
     · lobby  (타이틀 화면)      — 소리 3줄 + 포인터 + 설정 닫기
       →  거의 정사각 판 (1920x1922)
   납품 파일 이름에 ingame / lobby 가 박힌 것이 이 둘뿐이고, 나머지 버튼·토글·
   손잡이는 두 화면이 같이 씁니다.

   ------------------------------------------------------------
   [무손실 / q92 를 나눈 기준]
   ------------------------------------------------------------
   판 2장과 버튼 5종은 나뭇결 + 금테 그라디언트라 q92 에서 눈에 띄는 열화가
   없고, 무손실로 뽑으면 판 한 장이 2MB 를 넘깁니다.
   반대로 토글(144x84)과 손잡이(80x80)는 워낙 작아 무손실이어도 합쳐 10KB 가
   안 되는데, 화면에서는 계속 쳐다보는 조각이고 면적이 작아 q92 아티팩트가
   금테 가장자리에 바로 보입니다. 작은 것만 무손실입니다.
   (assets/UI/Common 의 커서 4장을 무손실로 뽑은 것과 같은 판단입니다)
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Setting");

/* [file]     UI_DIR 기준 파일 이름 (PNG 마스터)
   [size]     뽑아낼 WebP 크기 [가로, 세로] = CSS 크기 x2
   [lossless] 무손실로 뽑을 것
   [why]      그 크기의 근거. 주석용입니다. */
const FILES = [
  /* ── 배경 판 2종 ───────────────────────────────────────────
     CSS 크기는 --set-panel-w / --set-panel-h 입니다.
     ingame 812x1040, lobby 859x860 (둘 다 --upx 배수) */
  { file:"ui_settings_ingame.png", size:[1624,2080], why:"게임 중 설정판 812x1040 x2" },
  { file:"ui_settings_lobby.png",  size:[1718,1720], why:"타이틀 설정판 859x860 x2" },

  /* ── 가로 꽉 채우는 버튼 3종 ───────────────────────────────
     버튼 폭은 판의 안쪽 폭입니다. lobby 쪽(747)이 ingame(712)보다 넓으므로
     큰 쪽에 맞춥니다. 작은 화면에서 줄어드는 건 문제가 없습니다. */
  { file:"ui_button_game_return.png",    size:[1494,154], why:"게임으로 돌아가기 747 폭 x2 (ingame 기본 동작)" },
  { file:"ui_button_settings_close.png", size:[1494,154], why:"설정 닫기 747 폭 x2 (lobby 기본 동작)" },
  { file:"ui_button_title_screen.png",   size:[1494,106], why:"타이틀 화면으로 747 폭 x2 (원본이 더 얇은 판)" },

  /* ── 반씩 나눠 앉는 버튼 2종 ───────────────────────────────
     저장/불러오기는 한 줄에 둘이 들어갑니다. (747 - 사이 17) / 2 = 365 */
  { file:"ui_button_save.png", size:[730,155], why:"저장하기 365 폭 x2 (한 줄에 둘)" },
  { file:"ui_button_load.png", size:[730,155], why:"불러오기 365 폭 x2 (한 줄에 둘)" },

  /* ── 조작 조각 2종 (작아서 무손실) ─────────────────────────
     손잡이는 토글(36)과 슬라이더 엄지(30) 두 군데가 같이 씁니다.
     큰 쪽인 36 에 맞춰 뽑고, 슬라이더에서는 조금 줄어듭니다. */
  { file:"ui_toggle_on.png",   size:[144,84], lossless:true, why:"ON/OFF 토글 72x42 x2" },
  { file:"ui_slider_knob.png", size:[80,80],  lossless:true, why:"토글 손잡이 36 · 슬라이더 엄지 30 중 큰 쪽 x2 + 여유" }
];

const QUALITY = 92;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function outPath(f){
  return path.join(UI_DIR, f.out || f.file.replace(/\.png$/, ".webp"));
}

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
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
  if(f.size[0] > meta.width){
    console.warn(`  ! ${f.file} : 원본(${meta.width})보다 크게 뽑고 있습니다. 확대는 화질에 도움이 안 됩니다.`);
  }
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(34), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    const meta = await sharp(src).metadata();
    checkAspect(f, meta);
    const [w,h] = f.size;
    await resized(src, w, h)
      .webp(f.lossless ? {lossless:true, effort:EFFORT}
                       : {quality:QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(34), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(f.lossless?"무손실":`q${QUALITY}`));
  }
  console.log("-".repeat(92));
  console.log("합계".padEnd(26), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    if(!fs.existsSync(out))continue;
    const [w,h] = f.size;
    const [a,b] = await Promise.all([
      resized(src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
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
