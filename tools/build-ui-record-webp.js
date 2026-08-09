"use strict";

/* ============================================================
   오늘의 영업 기록 창 UI 에셋(assets/UI/Record) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-ui-record-webp.js
     node tools/build-ui-record-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   tools/build-ui-menuselect-webp.js · tools/build-ui-save-webp.js 와 같은 규칙입니다.

   ------------------------------------------------------------
   [배율 기준 = "CSS 레이아웃 크기의 2배"]
   ------------------------------------------------------------
   이 창도 DOM 이고 크기는 css/results.css 가 --upx(1920x1080 프레임에서 1px)
   배수로 정합니다. 그래서 목표 크기는 전부 실측한 CSS 크기 x2 입니다.
   줄여 그리는 쪽은 안전하고 늘려 그리는 쪽만 뭉갭니다.

   실측값(tools/result-visual-smoke.html, 2026-08-09 · 에셋 적용 후):
     창 480x329.5 · 기록 칸 135.3x83 · 다음 날 준비 버튼 426x45

   창 세로가 예전 334.8 이 아닌 것은, 버튼 높이를 그림 비율(9.47:1)에 맡기면서
   50.3 → 45 로 5.3 줄었기 때문입니다. 폭 480 과 칸 크기는 예전 그대로입니다
   (.wood-panel 의 2px 테두리를 걷어낸 만큼 여백을 25→27 로 되돌렸습니다).

   ⚠️ css/results.css 에서 창 폭(480)이나 칸 높이(83)를 고치면 아래 size 도
      같이 고쳐야 합니다 (checkAspect 가 경고합니다).

   ------------------------------------------------------------
   [창만 stretch 인 이유]
   ------------------------------------------------------------
   납품된 원화의 가로세로비와 화면에서 쓰는 자리의 비를 나란히 놓으면

     창   1920x1284 (1.495) → 480x329.5 (1.457)   2.6% 차이
     칸    541x332  (1.630) → 135.3x83  (1.630)   0.0% 차이  ← 칸은 아귀가 맞습니다
     버튼 1704x180  (9.467) → 426x45    (9.467)   0.0% 차이  ← aspect-ratio 로 맞췄습니다

   칸과 버튼은 화면 쪽을 그림에 맞춰 두었기 때문에 눌리는 곳이 없습니다.
   창만 2.6% 세로로 늘어납니다 — 나뭇결이라 늘어나도 티가 안 나지만, 안쪽
   금선이 그만큼 위아래로 벌어집니다. 이 정도는 눈에 띄지 않는 선입니다.
   비율은 **여기서(빌드 때) 맞춰 굽습니다.** 그러면 브라우저는 정확히 2:1
   축소만 하게 되어 가장 선명합니다.
   (CSS 에서 늘리면 브라우저가 비정수 배율로 다시 늘려 더 흐려집니다.)

   ------------------------------------------------------------
   [무손실 / q92 를 나눈 기준]
   ------------------------------------------------------------
   저장창·메뉴선택창과 같은 판단입니다. 창은 나뭇결이라 q92 에서 열화가 안
   보이고 무손실로 뽑으면 혼자 1MB 를 넘깁니다. 반대로 칸과 버튼은 무손실이어도
   합쳐 100KB 가 안 되는데, 면적이 작고 안이 거의 단색이라 q92 아티팩트가
   금테 가장자리에 바로 보입니다. 작은 것만 무손실입니다.

   창에 smartSubsample 을 켠 것도 같은 이유입니다 — WebP 손실 압축은 기본이
   4:2:0 이라 색을 가로세로 절반으로 줄여 저장하는데, 안쪽 금선처럼 채도가
   높고 1~2px 로 얇은 선은 화질(quality)을 올려도 그 단계에서 뭉갭니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Record");

/* [file]     UI_DIR 기준 파일 이름 (PNG 마스터)
   [size]     뽑아낼 WebP 크기 [가로, 세로] = CSS 크기 x2
   [stretch]  원본과 비율이 다른 것을 알고 있다는 표시 (경고를 설명으로 바꿉니다)
   [lossless] 무손실로 뽑을 것
   [why]      그 크기의 근거. 주석용입니다. */
const FILES = [
  /* ── 창 전체 판 ────────────────────────────────────────────
     세로 329.5 는 "머리글 + 칸 한 줄 + 총평 + 버튼"이 쌓인 높이입니다.
     총평이 세 줄이 되거나 칸 값이 길어지면 창이 길어지면서 이 그림이
     세로로 더 늘어납니다. 나뭇결이라 늘어나도 티가 안 나지만, 안쪽
     금선이 가장자리에서 그만큼 멀어집니다.

     ⚠️ 같은 자리에 쓸 수 있는 원화가 두 장 들어와 있습니다.
        ui_business_record_window_inset_gold        안쪽에 금선이 있는 판 ← 지금 쓰는 것
        ui_business_record_window_no_outer_frame    금선 없는 민 나뭇결 판
        바꾸려면 여기와 css/results.css 의 --rec-window 를 같이 고치세요. */
  { file:"ui_business_record_window_inset_gold.png", size:[960,659], stretch:true, why:"창 480x329.5 x2" },

  /* ── 기록 칸 (3개가 같은 그림) ─────────────────────────────
     창 안쪽 426 을 3등분한 135.3 이 폭입니다. 원화 비율과 정확히 맞아
     늘리거나 줄이는 곳이 없습니다. */
  { file:"ui_business_record_cell.png", size:[271,166], lossless:true, why:"기록 칸 135.3x83 x2" },

  /* ── 다음 날 준비 버튼 ─────────────────────────────────────
     폭은 창 안쪽을 꽉 채우는 426(.gold-button 이 width:100%)이고,
     높이는 css/results.css 의 aspect-ratio 가 그림 비율대로 따라옵니다. */
  { file:"ui_next_day_button.png", size:[852,90], lossless:true, why:"다음 날 준비 버튼 426x45 x2" }
];

const QUALITY = 92;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function outPath(f){
  return path.join(UI_DIR, f.out || f.file.replace(/\.png$/, ".webp"));
}

function kb(bytes){ return Math.round(bytes/1024); }

/* 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다. */
function resized(f, src, w, h){
  const pipe = sharp(src).resize(w, h, { kernel:"lanczos3", fit:"fill" });
  return f.tone ? pipe.modulate(f.tone) : pipe;
}

function checkAspect(f, meta){
  const source = meta.width / meta.height;
  const target = f.size[0] / f.size[1];
  const drift = Math.abs(target - source) / source;
  if(f.stretch){
    console.log(`  · ${f.file} : 의도적으로 비율을 바꿉니다 ` +
      `(${meta.width}x${meta.height} → ${f.size[0]}x${f.size[1]}, 비율 ${(drift*100).toFixed(1)}% 차이)`);
  }else if(drift > ASPECT_TOLERANCE){
    console.warn(`  ! ${f.file} : 가로세로비가 ${(drift*100).toFixed(1)}% 다릅니다. ` +
      `원본 ${meta.width}x${meta.height}(${source.toFixed(3)}) → ${f.size[0]}x${f.size[1]}(${target.toFixed(3)})`);
  }
  if(f.size[0] > meta.width){
    console.warn(`  ! ${f.file} : 원본(${meta.width})보다 크게 뽑고 있습니다. 확대는 화질에 도움이 안 됩니다.`);
  }
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(42), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    const meta = await sharp(src).metadata();
    checkAspect(f, meta);
    const [w,h] = f.size;
    await resized(f, src, w, h)
      .webp(f.lossless ? {lossless:true, effort:EFFORT}
                       : {quality:QUALITY, effort:EFFORT, alphaQuality:100, smartSubsample:true})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(42), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(f.lossless?"무손실":`q${QUALITY}`));
  }
  console.log("-".repeat(100));
  console.log("합계".padEnd(34), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(42), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    if(!fs.existsSync(out))continue;
    const [w,h] = f.size;
    const [a,b] = await Promise.all([
      resized(f,src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
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
    console.log(path.basename(out).padEnd(42), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
