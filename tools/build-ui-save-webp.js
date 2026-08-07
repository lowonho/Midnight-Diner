"use strict";

/* ============================================================
   저장/불러오기 창 UI 에셋(assets/UI/Save) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-ui-save-webp.js
     node tools/build-ui-save-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [배율 기준 = "CSS 레이아웃 크기의 2배 이상"]
   ------------------------------------------------------------
   tools/build-ui-setting-webp.js 와 같은 기준입니다. 저장창도 DOM 이고,
   크기는 css/save-slots.css 가 --upx(1920x1080 프레임에서 1px) 배수로 정합니다.
   그래서 목표 크기는 전부 "css/save-slots.css 가 쓰는 CSS 크기 x2" 입니다.
   줄여 그리는 쪽은 안전하고 늘려 그리는 쪽만 뭉갭니다.

   ------------------------------------------------------------
   [CSS 크기가 전부 --sv-panel-h 하나에서 나오는 이유]
   ------------------------------------------------------------
   납품된 6장은 서로 아귀가 맞게 그려져 있습니다. 실측하면

     · 판 안쪽(금테 안) 가로            2648 = 카드(삭제 없을 때) 가로
     · 카드(삭제 있을 때) 2332 + 사이 36 + 삭제 버튼 280 = 2648
     · 카드 두 장과 삭제 버튼의 세로가 모두 448

   즉 "판 안쪽 폭"만 정하면 나머지 다섯 장의 크기가 전부 따라옵니다.
   css/save-slots.css 는 --sv-panel-h(판 세로) 하나만 두고 나머지를 계산합니다.
   여기 표도 그 계산 결과(2026-08-07 기준 --sv-panel-h: 860upx)의 2배입니다.

     판 948x860 · 판 안쪽 폭 872 · 카드 872x148 / 768x148 ·
     삭제 92x148 · 닫기 48x48 · 빈 칸 안내문 110x41

   ⚠️ css/save-slots.css 의 --sv-panel-h 를 키우면 아래 size 도 같이 키워야
      합니다. 안 그러면 확대되면서 뭉갭니다. (checkAspect 가 경고합니다)

   ------------------------------------------------------------
   [무손실 / q92 를 나눈 기준]
   ------------------------------------------------------------
   설정창과 같은 판단입니다. 판·카드·삭제 버튼은 나뭇결 + 금테 그라디언트라
   q92 에서 열화가 안 보이고, 무손실로 뽑으면 판 한 장이 2MB 를 넘깁니다.
   반대로 닫기(48upx 원)와 빈 칸 안내문(90x34)은 무손실이어도 합쳐 30KB 가
   안 되는데 면적이 작아 q92 아티팩트가 금테 가장자리에 바로 보입니다.
   작은 것만 무손실입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Save");

/* [file]     UI_DIR 기준 파일 이름 (PNG 마스터)
   [size]     뽑아낼 WebP 크기 [가로, 세로] = CSS 크기 x2
   [lossless] 무손실로 뽑을 것
   [why]      그 크기의 근거. 주석용입니다. */
const FILES = [
  /* ── 창 전체 판 ────────────────────────────────────────────
     CSS 세로는 --sv-panel-h, 가로는 aspect-ratio 가 정합니다 (2880x2612). */
  { file:"ui_save_panel.png", size:[1898,1722], why:"저장창 판 948x860 x2" },

  /* ── 슬롯 카드 2종 ─────────────────────────────────────────
     저장 데이터가 있는 줄은 옆에 삭제 버튼이 붙어 카드가 그만큼 좁습니다.
     둘 다 세로는 같으므로 한 줄 높이는 어느 쪽이든 141 로 같습니다. */
  { file:"ui_save_card_with_delete.png",    size:[1536,295], why:"삭제 버튼 있는 줄의 카드 768x148 x2" },
  { file:"ui_save_card_without_delete.png", size:[1744,295], why:"빈 슬롯 줄의 카드 872x148 x2 (판 안쪽 폭 전체)" },

  /* ── 카드 옆 삭제 버튼 ─────────────────────────────────────
     카드와 세로가 같아서 줄 높이에 그대로 맞물립니다. */
  { file:"ui_save_delete_button.png", size:[185,296], why:"삭제 버튼 92x148 x2" },

  /* ── 작은 조각 2종 (작아서 무손실) ─────────────────────────
     닫기는 판 오른쪽 위에 얹는 동그란 금장이라 가장자리가 눈에 띕니다.
     빈 칸 안내문은 빈 슬롯 카드 안에 들어가는 작은 나무 명패입니다. */
  { file:"ui_save_close_button.png", size:[112,112], lossless:true, why:"닫기 48x48 x2 + 여유" },
  { file:"ui_save_empty_notice.png", size:[224,84],  lossless:true, why:"빈 칸 안내문 110x41 x2" }
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
