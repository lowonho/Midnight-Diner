"use strict";

/* ============================================================
   대화씬 원화(assets/Conversation) PNG → WebP 변환
   ------------------------------------------------------------
   사용법:
     npm install sharp        (1회)
     npm run build:conversation
     npm run verify:conversation   변환 결과 품질만 재검사
     node tools/build-conversation-webp.js --box   공통 크롭 박스 다시 계산

   ------------------------------------------------------------
   [PNG 마스터는 저장소 밖에 있습니다]  ★ 먼저 읽으세요
   ------------------------------------------------------------
   원본 PNG 는 장당 6~8MB 라 열여덟 장이면 120MB 가 넘습니다. 저장소에 두면
   게임 실행에 필요도 없는 파일로 clone 이 무거워지므로 밖에 둡니다.

     기본 위치 : <저장소>/../Midnight-Diner-art-masters/Conversation/<복장>/
     바꾸려면  : MD_ART_MASTERS 환경변수에 Conversation 폴더 경로를 넣으세요

   저장소에는 이 스크립트가 만든 WebP 만 들어갑니다(.gitignore 가 png 를
   막아 둡니다). 그러니 마스터를 잃어버리면 다시 뽑을 수 없습니다.
   ⚠️ WebP → WebP 재인코딩 금지. 세대 손실이 누적됩니다. 항상 PNG 에서.

   ------------------------------------------------------------
   [공통 크롭 박스를 쓰는 이유]  ★ 여기가 이 파일의 핵심입니다
   ------------------------------------------------------------
   원본은 4096x6144 인데 캐릭터는 가운데 아래쪽에만 있고 나머지는 전부
   투명입니다. 그대로 뽑으면 실제 그림이 화면에서 절반 크기로 보입니다.

   그렇다고 장마다 따로 여백을 잘라내면(트림) 안 됩니다. 모션마다 팔을
   벌린 폭도, 반짝임·불꽃 이펙트가 차지하는 높이도 달라서, 잘린 결과의
   가로세로 비율이 제각각이 됩니다. 그 상태로 대사마다 그림을 바꾸면
   화자가 말할 때마다 키가 커졌다 작아졌다 하며 덜컹거립니다.

   그래서 모든 장의 알파 경계를 합친 박스 하나(BOX)로 전부 자릅니다.
   복장(chef/office)까지 함께 합친 하나의 박스를 씁니다. 복장이 갈릴 때도
   인물 크기와 발 높이가 그대로여야 하고, 상자 비율이 하나여야 css/story.css
   의 aspect-ratio 도 하나로 끝나기 때문입니다.

   ⚠️ 원화를 새로 받거나 이펙트가 더 큰 모션·복장이 추가되면 BOX 를 다시
      구해야 합니다. --box 로 다시 계산해서 아래 숫자를 갱신하고, css/story.css
      의 .story-portrait.art aspect-ratio 도 같은 값으로 고치세요.

   ------------------------------------------------------------
   [크기]
   ------------------------------------------------------------
   이 그림이 놓이는 자리는 css/story.css 의 .story-portrait.art 한 곳뿐입니다.
   무대(.story-stage)는 1920x1080 프레임에서 574px 인데, 원화는 허벅지 아래를
   대사창 뒤로 흘려보내며 그보다 크게 섭니다(주방 복장 기준 약 987px).

   1800 으로 뽑습니다. 게임 프레임은 창 너비에 맞춰 늘어나므로 넓은 모니터
   에서는 이 자리도 같이 커집니다. 1800 이면 2560 폭까지 원본보다 크게 그릴
   일이 없고, 4K 에서도 1.1배 확대라 셀 셰이딩 그림에서는 안 보입니다.

   ⚠️ 아래 CUT_BODY 를 더 올리거나(더 크게 잘라 보이기) --art-height 가
      커지면 여기 HEIGHT 도 같이 키워야 합니다. 안 그러면 확대되며 뭉갭니다.

   ------------------------------------------------------------
   [q88 인 이유]
   ------------------------------------------------------------
   셀 셰이딩 그림이라 넓은 단색 면과 또렷한 검은 선이 대부분입니다.
   품질을 올려도 오차가 안 줄어서 q88 이 그대로 최적입니다. 한 장으로 잰
   값(--verify 와 같은 기준):

     q88 149KB 평균오차 3.24 / q92 179KB 2.93 / q96 227KB 2.61

   용량은 52% 늘어나는데 오차는 20% 밖에 안 줄어드는 평평한 곡선입니다.
   남은 오차는 압축 때문이 아니라 얼굴·천의 부드러운 그라데이션을 8비트로
   재양자화하면서 생기는 것이라, 품질을 더 올려도 사라지지 않습니다.
   눈으로는 q88 과 q96 을 구분할 수 없습니다.

   가장자리가 배경 없이 바로 잘리는 그림이라 알파는 alphaQuality:100 으로
   손대지 않습니다. 여기서 알파가 뭉개지면 인물 윤곽에 검은 테가 낍니다.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REPO = path.join(__dirname, "..");
const MASTER_ROOT = process.env.MD_ART_MASTERS
  || path.join(REPO, "..", "Midnight-Diner-art-masters", "Conversation");
const OUT_ROOT = path.join(REPO, "assets", "Conversation");

/* 파일 이름 뒤 번호가 곧 모션 번호입니다. 두 복장이 같은 번호에 같은 감정을
   담고 있어서 story.js 는 모션 표 하나(STORY_PROTAGONIST_MOTIONS)만 씁니다.
   새 복장을 추가할 때도 이 순서를 지키세요. */
const MOTIONS = [
  { index:"01", motion:"calm",    why:"손 모으고 잔잔한 미소 · 기본값" },
  { index:"02", motion:"soft",    why:"머리카락 넘기며 미소 · 다정하게 건네는 말" },
  { index:"03", motion:"think",   why:"검지를 턱에 대고 골똘 · 질문과 고민" },
  { index:"04", motion:"sad",     why:"고개 숙이고 눈 내리깔기 · 지치고 가라앉음" },
  { index:"05", motion:"cook",    why:"팬을 들고 요리 · 조리와 영업 이야기" },
  { index:"06", motion:"resolve", why:"두 주먹 쥐고 불꽃 · 각오와 의욕" },
  { index:"07", motion:"happy",   why:"두 손 들고 반짝 웃음 · 기쁨과 감탄" },
  { index:"08", motion:"cry",     why:"눈물 훔치기 · 깊은 슬픔" },
  { index:"09", motion:"angry",   why:"주먹 들고 화남 · 분노와 항의" }
];

/* 복장. stem 은 파일 이름 앞부분입니다(뒤에 _motion_NN 이 붙습니다).
   story.js 의 STORY_PROTAGONIST_COSTUMES 와 짝을 맞춰 두세요. */
const COSTUMES = [
  { dir:"char_cust_kim_daeun_chef",   stem:"char_cust_kim_daeun",        why:"달빛식탁 주방 복장 · 가게에 들어온 뒤 전부" },
  { dir:"char_cust_kim_daeun_office", stem:"char_cust_kim_daeun_office", why:"회사원 복장 · 퇴근길(가게 들어가기 전)" }
];

/* ------------------------------------------------------------
   [복장마다 CSS 값이 다른 이유]
   ------------------------------------------------------------
   공통 크롭 박스는 '상자'를 맞출 뿐, 상자 안에서 인물이 차지하는 높이까지
   같게 만들지는 못합니다. 회사원 복장은 치마가 길어서 같은 캔버스에 더 크게
   그려져 있습니다(상자 높이의 99.7% vs 주방 복장 89.7%).

   그대로 두면 프롤로그의 회사원 김다은이 주방 김다은보다 11% 크고 발끝도
   더 아래에 섭니다. 그래서 복장마다 상자 크기(--art-height)와 내림폭
   (--art-drop)을 따로 줘서 '인물 키'와 '발끝 높이'를 맞춥니다.

   맞추는 기준은 아래 세 값입니다. 이 값만 지키면 어느 복장이든 화면에서 같은
   크기로 서고, 같은 몸 지점에서 대사창에 걸립니다.
     --css 로 복장별 CSS 값을 다시 뽑을 수 있습니다:
       node tools/build-conversation-webp.js --css

   [화면을 키우고 싶으면 CUT_BODY 만 만지세요]
   인물을 더 크게 보이게 하는 건 '어디서 자르느냐'와 같은 말입니다. 잘리는
   지점을 위로 올리면(값을 줄이면) 남은 부분이 무대를 채우느라 인물이 커집니다.

     0.78 무릎컷 · 0.65 허벅지컷(지금) · 0.55 허리 위 · 0.40 상반신컷

   나머지 두 값은 이 자리의 붙박이 치수라 건드릴 일이 없습니다. 대사창을
   키우거나 무대 높이를 바꿨을 때만 다시 재세요.
   ------------------------------------------------------------ */
const CUT_BODY = 0.65;      // 인물 키의 몇 %에서 대사창에 가리는지(머리끝부터)
const HEAD_ABOVE = 0.9564;  // 머리끝이 무대 바닥보다 얼마나 위인지 ÷ 무대 높이
const CUT_BELOW = 0.047;    // 대사창 윗변이 무대 바닥보다 얼마나 아래인지 ÷ 무대 높이

// 위 세 값에서 바로 나옵니다. 직접 고치지 마세요.
const FIGURE_HEIGHT = (CUT_BELOW + HEAD_ABOVE) / CUT_BODY;  // 인물 키 ÷ 무대 높이
const FEET_BELOW = FIGURE_HEIGHT - HEAD_ABOVE;              // 발끝이 무대 바닥보다 아래인 정도

// 두 복장 열여덟 장의 알파 경계를 모두 합친 공통 크롭 박스(원본 4096x6144 기준).
// --box 로 다시 계산할 수 있습니다. 위 [공통 크롭 박스] 설명을 먼저 읽으세요.
// ⚠️ 이 비율은 css/story.css 의 .story-portrait.art aspect-ratio 와 같아야 합니다.
const BOX = { left: 582, top: 285, width: 2862, height: 5598 };

const HEIGHT = 1800;                                            // 위 [크기] 참고
const WIDTH = Math.round(BOX.width * HEIGHT / BOX.height);      // 비율은 원본 그대로
const QUALITY = 88;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

const srcPath = (costume, m) => path.join(MASTER_ROOT, costume.dir, `${costume.stem}_motion_${m.index}.png`);
const outPath = (costume, m) => path.join(OUT_ROOT, costume.dir, `${costume.stem}_motion_${m.index}.webp`);

function kb(bytes){ return Math.round(bytes/1024); }

// 크롭 + 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
function resized(src){
  return sharp(src)
    .extract(BOX)
    .resize(WIDTH, HEIGHT, { kernel:"lanczos3", fit:"fill" });
}

function requireMasters(){
  if(fs.existsSync(MASTER_ROOT))return;
  throw new Error(
    `PNG 마스터 폴더가 없습니다: ${MASTER_ROOT}\n`
    + "  원본은 저장소에 없습니다(용량 때문에 밖에 둡니다).\n"
    + "  다른 위치에 두었다면 MD_ART_MASTERS 환경변수로 알려 주세요.");
}

// 그림이 공통 박스 밖으로 삐져나가면 팔이나 이펙트가 잘립니다. 조용히
// 잘려 나가는 게 제일 찾기 어려우므로 변환할 때마다 확인합니다.
async function checkFits(label, src){
  const meta = await sharp(src).metadata();
  if(BOX.left + BOX.width > meta.width || BOX.top + BOX.height > meta.height){
    throw new Error(`${label} : 공통 크롭 박스가 원본(${meta.width}x${meta.height}) 밖으로 나갑니다. --box 로 다시 구하세요.`);
  }
  const { info } = await sharp(src).trim({ threshold:1 }).toBuffer({ resolveWithObject:true });
  const left = -(info.trimOffsetLeft || 0);
  const top = -(info.trimOffsetTop || 0);
  const out = left < BOX.left || top < BOX.top
    || left + info.width > BOX.left + BOX.width
    || top + info.height > BOX.top + BOX.height;
  if(out){
    console.warn(`  ! ${label} : 그림(${left},${top} ${info.width}x${info.height})이 공통 박스 밖으로 나갑니다. `
      + "가장자리가 잘립니다. --box 로 다시 구하세요.");
  }
}

// 두 복장 전체의 알파 경계를 합쳐 공통 크롭 박스를 다시 구합니다(--box).
async function computeBox(){
  requireMasters();
  let l=Infinity, t=Infinity, r=0, b=0;
  for(const costume of COSTUMES){
    for(const m of MOTIONS){
      const src = srcPath(costume, m);
      const { info } = await sharp(src).trim({ threshold:1 }).toBuffer({ resolveWithObject:true });
      const x = -(info.trimOffsetLeft || 0), y = -(info.trimOffsetTop || 0);
      console.log(`${path.basename(src).padEnd(40)} x=${x} y=${y} ${info.width}x${info.height}`);
      l=Math.min(l,x); t=Math.min(t,y); r=Math.max(r,x+info.width); b=Math.max(b,y+info.height);
    }
  }
  const width = r-l, height = b-t;
  console.log("\n아래 줄을 이 파일의 BOX 에 그대로 붙여 넣으세요:");
  console.log(`const BOX = { left: ${l}, top: ${t}, width: ${width}, height: ${height} };`);
  console.log(`css/story.css 의 .story-portrait.art aspect-ratio 도 ${width} / ${height} 로 고치세요.`);
}

/* 복장별로 '상자 안에서 인물이 어디부터 어디까지인지'를 재서 css/story.css 에
   넣을 --art-height / --art-drop 을 계산합니다(--css).

   기준 자세(01 calm)의 알파 경계를 씁니다. 이펙트가 붙은 모션(불꽃·반짝임)은
   그림 밖으로 더 튀어나와서 인물 키를 재는 자로 쓸 수 없습니다. */
async function computeCss(){
  requireMasters();
  console.log("복장별 CSS 값 (css/story.css 의 .story-portrait.art 쪽에 반영하세요)");
  console.log(`기준: 인물 키의 ${(CUT_BODY*100).toFixed(0)}% 지점에서 대사창에 가림`
    + ` → 인물 키 = 무대 높이 x ${FIGURE_HEIGHT.toFixed(4)}`
    + ` · 발끝 = 무대 바닥보다 ${FEET_BELOW.toFixed(4)} 아래\n`);
  for(const costume of COSTUMES){
    const base = MOTIONS[0];
    const { data, info } = await resized(srcPath(costume, base))
      .ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    let top = null, bottom = null;
    for(let y = 0; y < info.height; y++){
      let filled = false;
      for(let x = 0; x < info.width; x++){ if(data[(y*info.width+x)*4+3] > 16){ filled = true; break; } }
      if(filled){ if(top === null) top = y; bottom = y; }
    }
    // 상자 높이 대비 머리끝 / 발끝 위치
    const head = top / info.height;
    const feet = (bottom + 1) / info.height;
    const figure = feet - head;
    const height = FIGURE_HEIGHT / figure;            // 상자 높이 ÷ 무대 높이
    const drop = FEET_BELOW + (1 - feet) * height;    // 상자 바닥을 무대 바닥보다 얼마나 내릴지
    console.log(`  ${costume.dir}`);
    console.log(`    상자 안 인물: 머리끝 ${(head*100).toFixed(1)}% · 발끝 ${(feet*100).toFixed(1)}% · 키 ${(figure*100).toFixed(1)}%`);
    console.log(`    --art-height: ${(height*100).toFixed(0)}%;  --art-drop: ${(-drop*100).toFixed(1)}%;\n`);
  }
}

async function convert(){
  requireMasters();
  let pngTotal=0, webpTotal=0;
  console.log(`공통 크롭 ${BOX.width}x${BOX.height} @(${BOX.left},${BOX.top}) → 출력 ${WIDTH}x${HEIGHT}`);
  console.log(`마스터 ${MASTER_ROOT}\n`);
  for(const costume of COSTUMES){
    fs.mkdirSync(path.join(OUT_ROOT, costume.dir), { recursive:true });
    console.log(`[${costume.dir}] ${costume.why}`);
    for(const m of MOTIONS){
      const src = srcPath(costume, m);
      const out = outPath(costume, m);
      if(!fs.existsSync(src)){
        throw new Error(`원본이 없습니다: ${src}\n  (${costume.dir} 의 ${m.motion} 모션)`);
      }
      await checkFits(path.basename(src), src);
      await resized(src).webp({quality:QUALITY, effort:EFFORT, alphaQuality:100}).toFile(out);
      const a=fs.statSync(src).size, b=fs.statSync(out).size;
      pngTotal+=a; webpTotal+=b;
      console.log("  " + path.basename(out).padEnd(44), m.motion.padEnd(9),
        `${kb(a)}KB`.padStart(8), `${kb(b)}KB`.padStart(8),
        `${Math.round((1-b/a)*100)}%`.padStart(7));
    }
  }
  console.log("-".repeat(84));
  console.log("합계".padEnd(54), `${kb(pngTotal)}KB`.padStart(8), `${kb(webpTotal)}KB`.padStart(8),
    `${Math.round((1-webpTotal/pngTotal)*100)}%`.padStart(7));
}

// 같은 크기로 줄인 무손실 기준본과 WebP 를 픽셀 단위로 비교합니다.
async function verify(){
  requireMasters();
  console.log("\n품질 검증 (같은 크기로 자르고 줄인 무손실 기준본 대비)");
  console.log("파일".padEnd(46), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const costume of COSTUMES){
    for(const m of MOTIONS){
      const src = srcPath(costume, m);
      const out = outPath(costume, m);
      if(!fs.existsSync(out) || !fs.existsSync(src))continue;
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
      console.log(path.basename(out).padEnd(46), String(alphaMax).padStart(12),
        (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
    }
  }
}

(async()=>{
  if(process.argv.includes("--box")){ await computeBox(); return; }
  if(process.argv.includes("--css")){ await computeCss(); return; }
  if(!process.argv.includes("--verify")) await convert();
  await verify();
})().catch(error=>{ console.error(String(error.message||error)); process.exit(1); });
