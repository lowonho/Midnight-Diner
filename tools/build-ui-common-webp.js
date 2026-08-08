"use strict";

/* ============================================================
   공용 UI 에셋(assets/UI/Common) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-ui-common-webp.js
     node tools/build-ui-common-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   [build-minigame-ui-webp.js 와 나눠 놓은 이유]
   저쪽은 assets/UI/Minigame — 미니게임 오버레이 안에서만 쓰는 패널 껍데기라
   배율 기준이 "CSS 레이아웃 크기의 2배" 하나로 통일됩니다.
   여기는 assets/UI/Common — **미니게임 밖 전 화면**이 쓰는 것들이고,
   두 종류가 배율 기준부터 완전히 다릅니다. 한 스크립트에 섞으면
   아래 두 문단의 서로 다른 상한을 한 표로 설명할 수 없습니다.

   ------------------------------------------------------------
   [1] 마우스 포인터 — 48x48 입니다
   ------------------------------------------------------------
   [상한은 128] CSS `cursor: url(...)` 은 크롬이 128x128 을 넘으면 그림을
   **통째로 무시**하고 뒤에 적은 fallback 키워드로 조용히 되돌아갑니다.
   그러니 어떤 경우에도 128 을 넘겨서는 안 됩니다.

   [그런데 48 인 이유] 상한인 128 은 화면에서 너무 컸습니다. 커서 그림이
   "화살표 + 그걸 들고 있는 고양이 얼굴" 이라 실제 차지하는 면적이 보통
   커서의 서너 배라서, 128 이면 가리키는 대상을 고양이가 덮습니다.
   64 로 줄이고 다시 보고 48 로 한 번 더 줄인 값입니다.
   (미니게임 안쪽 손 포인터는 그림이 손 하나뿐이라 128 을 그대로 씁니다 —
    tools/build-minigame-art-webp.js 의 ui_drag_hand_pointer_* 참고)

   납품본이 222x222 이라 48 로 **줄이는** 변환입니다. 파일 이름의 `_256` 은
   발주 당시 이름이고 실제 캔버스와는 다릅니다. 출력 이름은 실제 크기를 따라
   `_48` 로 바꿔서 내보냅니다 (아래 out).

   ⚠️ 크기를 바꾸면 css/cursor.css 의 기준점(hotspot)도 같이 고쳐야 합니다.
      기준점은 픽셀 단위라 그림만 줄이면 화살표 끝에서 어긋납니다.

   [무손실인 이유] 네 장 합쳐도 무손실로 16KB 남짓입니다. 반면 커서는
   화면에서 가장 오래 보는 그림이고 면적이 작아 q90 아티팩트가 테두리에
   바로 보입니다. 미니게임 UI 의 버튼 2종을 무손실로 뽑은 것과 같은 판단입니다.

   ------------------------------------------------------------
   [2] 영업 상태 간판 — 화면에 그려지는 크기 그대로입니다
   ------------------------------------------------------------
   이 간판은 DOM 이 아니라 **프레임 캔버스**에 그립니다 (signage.js).
   그 캔버스는 화면 크기와 무관하게 항상 1920x1080 짜리 CanvasTexture 입니다
   (stage.js createStageFrameTexture).

   여기서 다른 에셋들처럼 2배율로 뽑을 이유가 없습니다. 캔버스 해상도가
   고정이라 2배율로 뽑아 봐야 그릴 때 도로 줄어들 뿐입니다.

   그래서 목표 크기는 딱 하나, **캔버스에 그려지는 픽셀 수 그대로**입니다.
     signage.js OPEN_SIGN 의 논리 크기(1280x720 기준) x VIEW_SCALE(1.5)
     = 152 x 110 x 1.5 = 228 x 165
   1:1 로 그려지므로 축소도 확대도 일어나지 않습니다 — 리샘플링을 아예 안
   거치는 것이 금테와 글자에 가장 좋습니다.

   ⚠️ 1:1 이 성립하려면 그리는 **위치**도 정수여야 합니다. 2026-08-08 에
      프레임 캔버스 보간을 켜면서, 반픽셀에 놓인 그림은 좌우로 흐려지게
      됐습니다. signage.js OPEN_SIGN.x 주석을 함께 보세요.

   ⚠️ signage.js 의 OPEN_SIGN.w / h 를 고치면 아래 표도 같이 고쳐야 합니다.
      안 고치면 캔버스가 1:1 이 아니게 되어 그 순간 계단이 집니다.

   [4x 마스터를 쓰는 이유 — 해상도가 아니라 그림이 바뀐 것입니다]
   처음 납품본(1078x780)으로 뽑았더니 글자와 금테가 뭉개져 보였습니다.
   화면에 그려지는 자리가 228x165 로 고정이라 **마스터를 키운다고 화면
   픽셀이 늘지는 않습니다.** 게임 전체가 1920x1080 으로 렌더돼서
   이 크기가 상한입니다.

   그래서 새 마스터(`_4x`, 4312x3120)는 단순 확대본이 아니라 **획을 굵게
   다시 그린 그림**입니다. 작은 크기에서 살아남도록 고양이도 크고 글자
   획도 두껍습니다. 뭉개짐이 풀린 건 해상도가 아니라 이 재작업 덕입니다.
   (1078 판은 이제 안 씁니다)

   ⚠️ 축소 뒤 sharpen() 을 걸어 보고 뺐습니다. 획은 또렷해지는데 금테
      가장자리에 링잉(밝은 테두리)이 생깁니다. lanczos3 한 번이 제일 깨끗합니다.
   ⚠️ 두 장을 **같은 228x165 로 강제**하는 것이 중요합니다. 납품본이
      4312x3120 과 4316x3116 으로 0.24% 다른데, 그대로 두면 낮↔밤이
      바뀔 때 간판이 미세하게 들썩입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Common");

/* [file]     UI_DIR 기준 파일 이름 (PNG 마스터)
   [size]     뽑아낼 WebP 크기 [가로, 세로]
   [out]      출력 이름을 따로 줄 것. 기본은 확장자만 .webp 로 바꾼 이름입니다.
   [lossless] 무손실로 뽑을 것
   [why]      그 크기의 근거. 주석용입니다. */
const FILES = [
  { file:"ui_cursor_cat_default_256.png", out:"ui_cursor_cat_default_48.webp", size:[48,48], lossless:true, why:"CSS 커서 (상한은 128, 실제로는 48)" },
  { file:"ui_cursor_cat_click_256.png",   out:"ui_cursor_cat_click_48.webp",   size:[48,48], lossless:true, why:"CSS 커서 (상한은 128, 실제로는 48)" },
  { file:"ui_cursor_cat_drag_256.png",    out:"ui_cursor_cat_drag_48.webp",    size:[48,48], lossless:true, why:"CSS 커서 (상한은 128, 실제로는 48)" },
  { file:"ui_cursor_cat_text_256.png",    out:"ui_cursor_cat_text_48.webp",    size:[48,48], lossless:true, why:"CSS 커서 (상한은 128, 실제로는 48)" },
  /* 간판 마스터는 `_4x` 입니다. 출력 이름에는 `_4x` 를 빼서 내보냅니다 —
     signage.js 가 `ui_shop_status_<상태>.webp` 로 찾기 때문입니다. (아래 [4x 마스터] 참고) */
  { file:"ui_shop_status_before_4x.png", out:"ui_shop_status_before.webp", size:[228,165], lossless:true, why:"signage.js OPEN_SIGN 152x110 x1.5 (낮 · 영업 전)" },
  { file:"ui_shop_status_open_4x.png",   out:"ui_shop_status_open.webp",   size:[228,165], lossless:true, why:"signage.js OPEN_SIGN 152x110 x1.5 (밤 · 영업 중)" }
];

/* [간판도 무손실인 이유] 1078 → 228 로 크게 줄이는 그림이라 축소만으로도
   금테와 글자 획이 이미 한계까지 눌립니다. 거기에 q92 를 얹으면 RGB 평균
   오차가 4.6 까지 올라가고(커서 4장은 0.00) 글자 테두리에 얼룩이 남습니다.
   무손실이라도 228x165 라 두 장 합쳐 85KB 뿐이라, 이 크기에서는 손실 압축으로
   아낄 이유가 없습니다. 미니게임 UI 의 버튼 2종과 같은 판단입니다. */
const QUALITY = 92;   // 지금은 무손실만 있어 쓰이지 않습니다. 손실로 뽑을 것이 생기면 이 값입니다.
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function outPath(f){
  return path.join(UI_DIR, f.out || f.file.replace(/\.png$/, ".webp"));
}

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// 여기가 갈라지면 축소 오차까지 손실로 잡혀서 수치가 의미 없어집니다.
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
// (원본 크기와 직접 비교하면 크기가 달라 비교 자체가 불가능합니다)
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
