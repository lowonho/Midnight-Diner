"use strict";

/* ============================================================
   대화창 UI 에셋(assets/UI/Story) PNG → WebP 변환 빌드 스크립트
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:ui-story
     npm run verify:ui-story        변환 결과 품질만 재검사
     node tools/build-ui-story-webp.js --compare   밝기 후보를 나란히 뽑아 보기

   PNG 가 원본(마스터)입니다. 절대 지우지 마세요.
   WebP 는 빌드 산출물이므로 항상 PNG 에서 다시 만듭니다.
   (WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다.)

   tools/build-ui-record-webp.js · tools/build-ui-save-webp.js 와 같은 규칙입니다.

   ⚠️ assets/Conversation 이 아니라 assets/UI/Story 입니다.
      .gitignore 가 assets/Conversation 아래 PNG 를 통째로 막고 있어서
      (인물 원화 아흔 장이 660MB 라 마스터를 저장소 밖에 둡니다) 대화창 판을
      거기 두면 마스터가 커밋되지 않고 조용히 사라집니다. 이 판은 인물 원화가
      아니라 다른 UI 판들과 같은 성격이므로 assets/UI 아래에 둡니다.

   ------------------------------------------------------------
   [원본이 90도 누워 있습니다]  ★ 먼저 읽으세요
   ------------------------------------------------------------
   납품본은 1029x6974 세로입니다. 대사창은 가로로 긴 판이므로 그대로 쓰면
   안 됩니다. 여기서 반시계로 90도 돌려 6974x1029 로 눕힌 뒤 굽습니다.
   판이 위아래로 거의 대칭이라(밝기 차 24.2 / 25.8 / 24.5) 어느 쪽으로 돌리든
   화면에서는 같습니다. 새 납품본이 처음부터 가로로 오면 ROTATE 를 0 으로 두세요.

   ------------------------------------------------------------
   [크기 = CSS 크기의 2배]
   ------------------------------------------------------------
   대사창(.story-dialogue-box)은 대사 길이·이름 유무와 상관없이 크기가 고정된
   자리입니다. 바탕화면 `달빛식탁_대화창_규격` 의 실측값이 **1744 x 258** 이고
   (--upx 기준 px 이라 1920x1080 프레임에서 1:1), 그 2배인 3488x516 으로 뽑습니다.

   4배(6976x1032)로 뽑지 않는 이유: 프레임은 창 너비를 꽉 채우므로 4K(3840)
   에서 이 자리가 정확히 3488px 입니다. 2배면 4K 까지 축소만 하게 되고,
   4배는 8K 를 넘겨야 쓸모가 생기는데 파일만 네 배가 됩니다.

   ⚠️ css/story.css 에서 대사창 크기를 바꾸면 아래 SIZE 도 같이 고치세요.

   ------------------------------------------------------------
   [일부러 어둡게 굽습니다]  ★ 값을 만질 곳
   ------------------------------------------------------------
   납품본 그대로는 화면에서 너무 밝습니다. 이 판 위에는 크림색 대사 글자
   (#f1e0c2)가 얹히고, 뒤 화면을 눌러 두는 어둠막(.story-overlay 배경) 위에
   놓이기 때문에, 판이 밝으면 판만 붕 떠 보이고 글자 대비도 떨어집니다.

   그렇다고 전체를 똑같이 곱하면 안쪽 금선까지 같이 죽어서 테두리가 사라집니다.
   그래서 **밝기에 따라 다른 배율**을 씁니다 — 어두운 나뭇결은 WOOD 로 많이
   낮추고, 밝은 금선은 GOLD 로 거의 그대로 둡니다. 둘 사이는 SOFT 구간에서
   부드럽게 이어지므로 금선 가장자리에 계단이 생기지 않습니다.

   나뭇결 밝기는 20~70, 금선 심지는 255 근처라 두 무리가 확실히 갈립니다.
   후보를 눈으로 비교하려면 --compare 로 한 장에 쌓아 뽑으세요.

   CSS filter 로 어둡게 하지 않는 이유: 그 자리는 판이 배경이고 글자가
   자식이라, filter 를 걸면 대사 글자까지 같이 어두워집니다. 판만 따로
   덮개를 얹으려면 DOM 이 한 겹 더 필요합니다. 구울 때 해결하는 편이
   싸고, 이 저장소의 다른 에셋들과도 같은 방식입니다.

   ------------------------------------------------------------
   [q92 · smartSubsample 인 이유]
   ------------------------------------------------------------
   면적 대부분이 나뭇결이라 q92 에서 열화가 안 보이고, 무손실로 뽑으면
   혼자 2MB 를 넘깁니다. 다만 안쪽 금선은 채도가 높고 2배 기준 6px 로 얇아서
   WebP 기본 4:2:0 색 서브샘플링에 뭉갭니다 — 영업기록 창과 같은 판단으로
   smartSubsample 을 켭니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Story");
const OUT_DIR = UI_DIR;

const ROTATE = -90;                 // 위 [원본이 90도 누워 있습니다] 참고
const SIZE = [3488, 516];           // 대사창 1744x258 x2

// 위 [일부러 어둡게 굽습니다] 참고. 1 이면 손대지 않은 원본입니다.
const WOOD = 0.38;                  // 나뭇결 밝기 배율
const GOLD = 0.90;                  // 금선 밝기 배율
const SOFT = [90, 175];             // 이 밝기 구간에서 두 배율이 이어집니다

const QUALITY = 92;
const EFFORT = 6;                   // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

const FILES = [
  { file:"ui_story_dialogue_box_gold_outward_4x.png",
    out:"ui_story_dialogue_box.webp",
    why:"대사창 판 1744x258 x2 · 원본은 세로로 누워 있어 눕혀 굽습니다" }
];

function kb(bytes){ return Math.round(bytes/1024); }

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* 밝은 화소(금선)는 덜, 어두운 화소(나뭇결)는 많이 낮춥니다.
   기준은 세 채널의 최댓값입니다 — 금색은 R·G 가 함께 높고 나뭇결은 R 만
   조금 높은데, 평균을 쓰면 붉은 나뭇결이 금선 쪽으로 끌려 올라갑니다. */
function darken(data, wood, gold){
  for(let i = 0; i < data.length; i += 4){
    if(data[i+3] === 0) continue;
    const level = Math.max(data[i], data[i+1], data[i+2]);
    const f = wood + (gold - wood) * smoothstep(SOFT[0], SOFT[1], level);
    for(let c = 0; c < 3; c++) data[i+c] = Math.min(255, Math.round(data[i+c] * f));
  }
  return data;
}

/* 크롭·축소·어둡게까지가 한 파이프라인입니다.
   검증(verify)도 이 함수를 써야 "인코딩 손실"만 측정됩니다. */
async function prepared(src, wood = WOOD, gold = GOLD){
  const { data, info } = await sharp(src)
    .rotate(ROTATE)
    .resize(SIZE[0], SIZE[1], { kernel:"lanczos3", fit:"fill" })
    .ensureAlpha()
    .raw().toBuffer({ resolveWithObject:true });
  return { data: darken(data, wood, gold), info };
}

function raw({ data, info }){
  return sharp(data, { raw:{ width:info.width, height:info.height, channels:info.channels } });
}

async function convert(){
  console.log(`회전 ${ROTATE}도 · 출력 ${SIZE[0]}x${SIZE[1]} · 밝기 나뭇결 x${WOOD} 금선 x${GOLD}\n`);
  console.log("파일".padEnd(34), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(9), "WebP".padStart(9), "절감".padStart(7));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = path.join(OUT_DIR, f.out);
    if(!fs.existsSync(src)) throw new Error(`원본이 없습니다: ${src}`);
    const meta = await sharp(src).metadata();
    await raw(await prepared(src))
      .webp({ quality:QUALITY, effort:EFFORT, alphaQuality:100, smartSubsample:true })
      .toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size;
    console.log(f.out.padEnd(34), `${meta.width}x${meta.height}`.padStart(11),
      `${SIZE[0]}x${SIZE[1]}`.padStart(11),
      `${kb(a)}KB`.padStart(9), `${kb(b)}KB`.padStart(9),
      `${Math.round((1-b/a)*100)}%`.padStart(7));
  }
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  console.log("\n품질 검증 (같은 크기로 축소·감광한 무손실 기준본 대비)");
  console.log("파일".padEnd(34), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of FILES){
    const src = path.join(UI_DIR, f.file);
    const out = path.join(OUT_DIR, f.out);
    if(!fs.existsSync(out) || !fs.existsSync(src)) continue;
    const a = await prepared(src);
    const b = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    if(a.data.length !== b.data.length){ console.log(f.out, "크기 불일치!"); continue; }
    let alphaMax=0, rgbSum=0, rgbMax=0, rgbCount=0;
    for(let i = 0; i < a.data.length; i += 4){
      alphaMax = Math.max(alphaMax, Math.abs(a.data[i+3] - b.data[i+3]));
      if(a.data[i+3] < 8) continue;              // 완전 투명 영역의 RGB 는 의미 없음
      for(let c = 0; c < 3; c++){
        const d = Math.abs(a.data[i+c] - b.data[i+c]);
        rgbSum += d; rgbMax = Math.max(rgbMax, d); rgbCount++;
      }
    }
    console.log(f.out.padEnd(34), String(alphaMax).padStart(12),
      (rgbCount ? (rgbSum/rgbCount).toFixed(2) : "-").padStart(9), String(rgbMax).padStart(8));
  }
}

/* 밝기 후보를 한 장에 쌓아 tools/.out 에 내놓습니다(눈으로 보고 버리는 그림).
   어둠막 위에 놓인 상태를 보려면 배경이 검은 편이 맞습니다 — 흰 바탕에서
   고르면 실제 화면보다 어두운 값을 고르게 됩니다. */
async function compare(){
  const CANDIDATES = [1, 0.7, 0.6, 0.5, 0.4];
  const src = path.join(UI_DIR, FILES[0].file);
  const W = SIZE[0] / 4, H = SIZE[1] / 4, GAP = 10;
  const shots = [];
  for(const wood of CANDIDATES){
    const { data, info } = await prepared(src, wood, Math.max(wood, GOLD));
    shots.push(await raw({ data, info }).resize(W, H).png().toBuffer());
  }
  const dir = path.join(__dirname, ".out");
  fs.mkdirSync(dir, { recursive:true });
  const out = path.join(dir, "dialogue-box-brightness.png");
  await sharp({ create:{ width:W, height:(H+GAP)*shots.length+GAP, channels:4,
      background:{ r:12, g:8, b:6, alpha:1 } } })
    .composite(shots.map((input, i) => ({ input, left:0, top:GAP + i*(H+GAP) })))
    .png().toFile(out);
  console.log(`위에서부터 나뭇결 x${CANDIDATES.join(" / x")}`);
  console.log(out);
}

(async()=>{
  if(process.argv.includes("--compare")){ await compare(); return; }
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
