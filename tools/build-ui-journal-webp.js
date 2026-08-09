"use strict";

/* ============================================================
   영업일지 UI 에셋(assets/UI/Journal) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     node tools/build-ui-journal-webp.js
     node tools/build-ui-journal-webp.js --verify   변환 결과 품질만 재검사

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   ------------------------------------------------------------
   [크기 = CSS 크기 x2, 비율은 원본 그대로]
   ------------------------------------------------------------
   tools/build-ui-save-webp.js 와 같은 기준입니다. 영업일지는 DOM 이고 크기는
   css/settings.css 가 --upx(1920x1080 프레임에서 1px) 배수로 정합니다.

   ⚠️ 그림을 늘려 쓰지 않으려고 **CSS 상자 크기를 원본 비율에 맞춰 놨습니다.**
      아래 표의 "CSS" 값을 바꾸려면 css/settings.css 의 짝이 되는 값도 같이
      바꿔야 합니다. (비율이 어긋나면 background-size:100% 100% 라 찌그러집니다)

     책          1046 x 544   .journal-page
     제목 판      880 x  92   .journal-heading
     닫기          34 x  32   .journal-close (여기만 일부러 가로로 늘려 씁니다)
     화살표        72 x  58   .journal-page-arrow
     견출지 3종    130 x 자동  .journal-section-tab (aspect-ratio 로 높이 결정)
     그림 자리     112 x 자동  .journal-page-portrait.has-frame

   ------------------------------------------------------------
   [무손실 / q92 를 나눈 기준]
   ------------------------------------------------------------
   저장창 문서와 같은 판단입니다. 넓은 면(책·제목 판)은 나뭇결·종이결이라
   q92 에서 열화가 안 보이고, 무손실로 뽑으면 책 한 장이 3MB 를 넘습니다.
   반대로 닫기·화살표는 작아서 무손실이어도 합쳐 30KB 가 안 되는데, 면적이
   작아 q92 아티팩트가 금테 가장자리에 바로 보입니다. 작은 것만 무손실입니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Journal");

/* [file]     UI_DIR 기준 파일 이름 (PNG 마스터)
   [out]      산출물 이름을 마스터와 다르게 할 때만 (기본은 .png → .webp)
   [size]     뽑아낼 WebP 크기 [가로, 세로] = CSS 크기 x2
   [crop]     원본에서 잘라 쓸 자리 [왼, 위, 가로, 세로]. 마스터 둘레에 투명
              여백이 남아 있는 그림 전용입니다. 여백째 넣으면 CSS 상자 안에서
              그림이 그만큼 작게 보입니다. 값은 알파 > 8 인 자리의 사각형입니다.
   [lossless] 무손실로 뽑을 것
   [why]      그 크기의 근거. 주석용입니다. */
const FILES = [
  /* ── 펼친 책 ───────────────────────────────────────────────
     가장 큰 그림입니다. 종이 결이 q92 로 충분히 남습니다. */
  { file:"ui_journal_book_open.png", size:[2092,1088], why:"책 1046x544 x2" },

  /* ── 제목 판 ───────────────────────────────────────────────
     가로로 아주 긴 나무 명패입니다. 2026-08-08 에 어두운 판 + 얇은 금테로
     교체했습니다(원본 3280x344). 이전 밝은 판 ui_journal_title_panel.png 는
     안 쓰지만 마스터라 지우지 않고 남겨 둡니다. */
  { file:"ui_business_journal_title_panel_dark_thin_gold_4x.png",
    out:"ui_journal_title_panel_dark.webp", size:[1760,184], why:"제목 판 880x92 x2" },

  /* ── 작은 버튼 3종 (작아서 무손실) ─────────────────────────
     금테 가장자리가 눈에 띄는 것들입니다. */
  { file:"ui_journal_close.png",      size:[96,102],  lossless:true, why:"닫기 48x51 x2" },
  { file:"ui_journal_arrow_prev.png", size:[144,116], lossless:true, why:"이전 화살표 72x58 x2" },
  { file:"ui_journal_arrow_next.png", size:[144,116], lossless:true, why:"다음 화살표 72x58 x2" },

  /* ── 견출지 3종 ────────────────────────────────────────────
     2026-08-09 에 금테 견출지에서 색종이 견출지로 교체했습니다. 세 장 모두
     같은 마스터 크기(367x188)에 같은 모양이라, 예전처럼 그림마다 금테
     윗변 높이를 따로 보정할 일이 없습니다(css/settings.css 참고).
     마스터 둘레에 2px 투명 여백이 있어 잘라 씁니다.
     이전 금테 판(ui_journal_tab_caution/cooking/diary.png)은 안 쓰지만
     마스터라 지우지 않고 남겨 둡니다. */
  { file:"ui_journal_tab_notice_paper_4x.png",  out:"ui_journal_tab_notice.webp",
    crop:[2,2,363,184], size:[260,132], why:"주의사항 견출지 130x66 x2" },
  { file:"ui_journal_tab_cooking_paper_4x.png", out:"ui_journal_tab_cooking.webp",
    crop:[2,2,363,184], size:[260,132], why:"요리 견출지 130x66 x2" },
  { file:"ui_journal_tab_diary_paper_4x.png",   out:"ui_journal_tab_diary.webp",
    crop:[2,2,363,184], size:[260,132], why:"일기 견출지 130x66 x2" },

  /* ── 인게임 그림 자리 3종 ──────────────────────────────────
     주의사항·요리·일기 장의 동그란 액자입니다. */
  { file:"ui_journal_picture_caution.png", size:[224,230], why:"주의사항 그림 자리 112x115 x2" },
  { file:"ui_journal_picture_cooking.png", size:[224,238], why:"요리 그림 자리 112x119 x2" },
  { file:"ui_journal_picture_diary.png",   size:[224,233], why:"일기 그림 자리 112x116.5 x2" },

  /* ── 주의사항 장 손글씨 ────────────────────────────────────
     2번 줄 아래 남는 종이를 채우는 그림입니다. CSS 는 background-size:contain
     이라 상자 비율이 조금 달라도 찌그러지지 않고, 이 그림이 종이 폭(319)을
     꽉 채웠을 때의 크기가 319x243 입니다. 넉넉하게 x2 로 뽑습니다.
     마스터 1403x1121 둘레에 투명 여백이 있어 잘라 씁니다. */
  { file:"journal_warning.png", crop:[80,104,1254,957], size:[668,510],
    why:"주의사항 손글씨 334x255 x2 (여백 잘라낸 1254x957 기준)" },

  /* ── 주의사항 다음 안내 장(양면 그림) ──────────────────────
     글 없이 원화 두 장만 놓는 장입니다. 두 면 다 본문 자리가 334x420 이고
     CSS 는 background-size:contain 이라 원본 비율 그대로 들어갑니다.
     그래서 세로는 상자(420)가 아니라 폭 334 에 맞췄을 때의 높이 x2 입니다.
       요리   1201x1419 → 334x394.6 → 668x789
       선택지 1224x1187 → 334x323.9 → 668x648
     둘 다 마스터 둘레에 1px 투명 줄이 있어 잘라 씁니다. */
  { file:"ui_log_story_guest_cooking_v01.png",  crop:[1,0,1201,1419], size:[668,789],
    why:"안내 장 왼쪽 면 그림 334x394.6 x2" },
  { file:"ui_log_story_choice_answer_v03.png",  crop:[0,1,1224,1187], size:[668,648],
    why:"안내 장 오른쪽 면 그림 334x323.9 x2" }
];

const QUALITY = 92;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

// 가로세로비가 원본과 크게 다르면 늘려 쓰고 있다는 뜻이라 미리 알려 줍니다.
const ASPECT_TOLERANCE = 0.02;

function outPath(f){
  return path.join(UI_DIR, f.out || f.file.replace(/\.png$/, ".webp"));
}

function kb(bytes){ return Math.round(bytes/1024); }

// 잘라 쓰는 자리. crop 이 없으면 원본 전체입니다.
function sourceBox(f, meta){
  if(!f.crop)return { left:0, top:0, width:meta.width, height:meta.height };
  const [left,top,width,height] = f.crop;
  return { left, top, width, height };
}

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
function resized(src, w, h, box){
  return sharp(src).extract(box).resize(w, h, { kernel:"lanczos3", fit:"fill" });
}

function checkAspect(f, box){
  const source = box.width / box.height;
  const target = f.size[0] / f.size[1];
  const drift = Math.abs(target - source) / source;
  if(drift > ASPECT_TOLERANCE){
    console.warn(`  ! ${f.file} : 가로세로비가 ${(drift*100).toFixed(1)}% 다릅니다. ` +
      `원본 ${box.width}x${box.height}(${source.toFixed(3)}) → ${f.size[0]}x${f.size[1]}(${target.toFixed(3)})`);
  }
  if(f.size[0] > box.width){
    console.warn(`  ! ${f.file} : 원본(${box.width})보다 크게 뽑고 있습니다. 확대는 화질에 도움이 안 됩니다.`);
  }
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(36), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    const meta = await sharp(src).metadata();
    const box = sourceBox(f, meta);
    checkAspect(f, box);
    const [w,h] = f.size;
    await resized(src, w, h, box)
      .webp(f.lossless ? {lossless:true, effort:EFFORT}
                       : {quality:QUALITY, effort:EFFORT, alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(path.basename(out).padEnd(36), `${meta.width}x${meta.height}`.padStart(11),
      `${w}x${h}`.padStart(11),
      `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
      `${Math.round((1-b/a)*100)}%`.padStart(7), "  "+(f.lossless?"무손실":`q${QUALITY}`));
  }
  console.log("-".repeat(96));
  console.log("합계".padEnd(28), "".padStart(11), "".padStart(11),
    `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소한 무손실 기준본 대비)");
  console.log("파일".padEnd(36), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = outPath(f);
    if(!fs.existsSync(out))continue;
    const [w,h] = f.size;
    const box = sourceBox(f, await sharp(src).metadata());
    const [a,b] = await Promise.all([
      resized(src,w,h,box).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
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
    console.log(path.basename(out).padEnd(36), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
