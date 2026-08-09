"use strict";

/* ============================================================
   메뉴 선택창 UI 에셋(assets/UI/MenuSelect) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-ui-menuselect-webp.js
     node tools/build-ui-menuselect-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   tools/build-ui-save-webp.js 와 같은 규칙입니다.

   ------------------------------------------------------------
   [배율 기준 = "CSS 레이아웃 크기의 2배"]
   ------------------------------------------------------------
   이 창도 DOM 이고 크기는 css/menu-select.css 가 --upx(1920x1080 프레임에서
   1px) 배수로 정합니다. 그래서 목표 크기는 전부 실측한 CSS 크기 x2 입니다.
   줄여 그리는 쪽은 안전하고 늘려 그리는 쪽만 뭉갭니다.

   실측값(달빛식탁_메뉴선택_규격.md, 2026-08-09 · 에셋 적용 후):
     창 720x430 · 메뉴 칸 160.5x108 · 선택 완료 버튼 141.6x41

   창 세로가 예전 443 이 아닌 것은, 그림 안에 있는 테두리를 CSS 에서 걷어내면서
   .wood-panel 의 2px 테두리(위아래 4)와 버튼의 위 여백(9)이 같이 빠졌기
   때문입니다. 칸 폭이 159.5 → 160.5 인 것도 같은 이유(창 안쪽이 4 넓어짐)입니다.

   ⚠️ css/menu-select.css 에서 창 폭(720)이나 칸 높이(108), 버튼 여백을
      키우면 아래 size 도 같이 키워야 합니다 (checkAspect 가 경고합니다).

   ------------------------------------------------------------
   [칸·버튼만 stretch 인 이유]
   ------------------------------------------------------------
   납품된 원화의 가로세로비가 화면에서 쓰는 자리의 비와 조금씩 다릅니다.

     창   2792x1672 (1.670) → 720x430   (1.674)   0.3% 차이
     칸    630x401  (1.571) → 160.5x108 (1.486)   5.4% 차이
     버튼  560x156  (3.590) → 141.6x41  (3.454)   3.8% 차이

   창은 0.3% 라 사실상 같습니다. 칸과 버튼은 그라디언트 + 얇은 테두리라,
   이 정도로 눌러도 눈에 띄는 것은 모서리 둥근 정도뿐입니다. 그래서
   **비율을 여기서(빌드 때) 맞춰 굽습니다.** 그러면 브라우저는 정확히 2:1
   축소만 하게 되어 가장 선명합니다.
   (CSS 에서 늘리면 브라우저가 비정수 배율로 다시 늘려 더 흐려집니다.)

   ------------------------------------------------------------
   [무손실 / q92 를 나눈 기준]
   ------------------------------------------------------------
   저장창과 같은 판단입니다. 창은 나뭇결이라 q92 에서 열화가 안 보이고,
   무손실로 뽑으면 혼자 1MB 를 넘깁니다. 반대로 칸과 버튼은 무손실이어도
   합쳐 100KB 가 안 되는데, 면적이 작고 안이 거의 단색이라 q92 아티팩트가
   금테 가장자리에 바로 보입니다. 작은 것만 무손실입니다.

   ------------------------------------------------------------
   [창에 smartSubsample 을 켠 이유]
   ------------------------------------------------------------
   WebP 손실 압축은 기본이 4:2:0 이라 **색을 가로세로 절반으로 줄여** 저장합니다.
   이 창의 금테(255,222,2)처럼 채도가 높고 1~2px 로 얇은 선은 그 단계에서
   뭉개지는데, 이건 화질(quality)을 올려도 그대로입니다. 실제로 측정하면

     q92 → q98 로 올려도 오차 20 넘는 픽셀 0.19% 그대로 (파일만 116→228KB)
     q92 + smartSubsample                   0.19% → 0.04%  (116→148KB)

   그래서 화질을 올리는 대신 이걸 켰습니다. 32KB 로 금테가 5배 깨끗해집니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "MenuSelect");

/* ── [톤] 창 나뭇결을 어둡고 무채색 쪽으로 ────────────────────────
   납품된 원화 그대로는 창이 밝아서, 위에 얹히는 크림빛 메뉴 칸과 명도가
   가까워 칸이 판에서 잘 안 떠 보였습니다. 여기서 눌러 굽습니다.

     brightness  1 이 원본. 낮출수록 어두워집니다.
     saturation  1 이 원본. 낮출수록 무채색(흑백)에 가까워집니다.
                 0 으로 두면 완전한 흑백이라 갈색이 사라집니다.

   ⚠️ CSS filter 가 아니라 **구울 때** 먹이는 이유
      .menu-select-window 에 filter 를 걸면 배경뿐 아니라 그 안의 글자와
      메뉴 칸까지 같이 어두워집니다. 그림에만 먹이려면 여기가 맞습니다.
      PNG 마스터는 그대로라, 되돌리려면 이 두 숫자만 1 로 놓고 다시 구우면 됩니다.

   ⚠️ 금테도 같이 눌립니다
      테두리의 금색(255,222,2)도 이 값을 그대로 받습니다. 더 내리면 판은
      더 어두워지지만 금테가 먼저 흐려져 창의 윤곽이 약해집니다.
      아래 값은 "금테가 아직 금색으로 읽히는" 선에서 잡은 것입니다. */
const WOOD_TONE = { brightness: 0.80, saturation: 0.62 };

/* [file]     UI_DIR 기준 파일 이름 (PNG 마스터)
   [size]     뽑아낼 WebP 크기 [가로, 세로] = CSS 크기 x2
   [stretch]  원본과 비율이 다른 것을 알고 있다는 표시 (경고를 설명으로 바꿉니다)
   [lossless] 무손실로 뽑을 것
   [tone]     {brightness, saturation} 을 구울 때 먹입니다 (아래 [톤] 참고)
   [why]      그 크기의 근거. 주석용입니다. */
const FILES = [
  /* ── 창 전체 판 ────────────────────────────────────────────
     세로 430 은 "4열 x 2줄 + 머리글 + 푸터"가 쌓인 높이입니다.
     좁은 화면(2열 4줄)에서는 창이 더 길어지면서 이 그림이 세로로 늘어납니다.
     나뭇결이라 늘어나도 티가 안 나지만, 금테 굵기는 그만큼 얇아집니다. */
  { file:"ui_menu_window_wood_v2.png", size:[1440,860], tone:WOOD_TONE, why:"창 720x430 x2" },

  /* ── 메뉴 칸 (8개가 같은 그림) ─────────────────────────────
     8칸이 전부 같은 그림 한 장이라, 이 한 장만 캐시에 올라갑니다. */
  { file:"ui_menu_cell.png", size:[321,216], stretch:true, lossless:true, why:"메뉴 칸 160.5x108 x2" },

  /* ── 선택 완료 버튼 ────────────────────────────────────────
     버튼 폭 141.6 은 글자(선택 완료) + 좌우 여백 34 에서 나온 값이라
     문구를 바꾸면 폭이 바뀝니다. 그림은 늘어나며 따라옵니다. */
  { file:"ui_menu_complete_button.png", size:[284,82], stretch:true, lossless:true, why:"선택 완료 버튼 141.6x41 x2" }
];

const QUALITY = 92;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function outPath(f){
  return path.join(UI_DIR, f.out || f.file.replace(/\.png$/, ".webp"));
}

function kb(bytes){ return Math.round(bytes/1024); }

/* 축소(+톤) 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
   톤을 여기 넣어야 기준본에도 똑같이 먹어서, 톤 자체가 오차로 잡히지 않습니다. */
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
  console.log("파일".padEnd(34), "원본크기".padStart(11), "출력크기".padStart(11),
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
    console.log(path.basename(out).padEnd(34), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(f.lossless?"무손실":`q${QUALITY}`)
      + (f.tone?`  톤 밝기${f.tone.brightness} 채도${f.tone.saturation}`:""));
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
    console.log(path.basename(out).padEnd(34), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
