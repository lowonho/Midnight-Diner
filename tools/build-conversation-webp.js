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
   원본 PNG 는 장당 6~8MB 라 열 인물 아흔 장이면 660MB 가 넘습니다. 저장소에 두면
   게임 실행에 필요도 없는 파일로 clone 이 무거워지므로 밖에 둡니다.

     기본 위치 : <저장소>/../Midnight-Diner-art-masters/Conversation/<인물 폴더>/
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

   그래서 모든 장의 알파 경계를 합친 박스 하나(BOX)로 전부 자릅니다. 인물
   열 명을 전부 합친 하나의 박스입니다. 상자 비율이 하나여야 css/story.css 의
   aspect-ratio 도 하나로 끝나기 때문입니다. 인물마다 다른 크기·높이는 상자가
   아니라 --art-height / --art-drop 이 맞춥니다(--css 로 뽑습니다).

   ⚠️ 원화를 새로 받거나 이펙트가 더 큰 모션·인물이 추가되면 BOX 를 다시
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

/* 파일 이름 뒤 번호가 곧 모션 번호입니다. 열 인물이 모두 같은 번호에 같은
   감정을 담고 있어서 js/story.js 는 모션 표 하나(STORY_PROTAGONIST_MOTIONS)만
   씁니다. 05 만 인물마다 다릅니다 — 김다은은 팬을 들고, 손님은 자기 음식을
   받아 든 모습입니다. 새 인물을 추가할 때도 이 순서를 지키세요. */
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

/* 등장인물별 원화 폴더. stem 은 파일 이름 앞부분입니다(뒤에 _motion_NN 이 붙습니다).
   js/story.js 의 STORY_PORTRAIT_ART 와 key 로 짝을 맞춰 두세요.

   [flip] 특별 손님은 좌우를 뒤집어 뽑습니다. 원화가 모두 같은 쪽을 보고 그려져
   있는데 손님은 무대 오른쪽에 서기 때문에, 그대로 두면 김다은과 등을 지고
   말하게 됩니다. 김다은은 왼쪽에 서므로 뒤집지 않습니다.

   [scale] 화면에서의 키. 1 이면 김다은과 같은 크기로 섭니다(기본값).

   캔버스에 그려진 크기를 그대로 쓰지 않는 이유가 있습니다. 원화마다 인물이
   캔버스를 채운 정도가 제각각이라(작은 짐승은 절반, 등불 손님은 꽉) 그대로
   두면 아이가 어른만 해지고, 웅크린 짐승은 대사창 아래로 내려가 귀만 보입니다.
   그래서 머리 높이를 맞추고 키를 정규화한 뒤, 일부러 작게/크게 세우고 싶은
   인물만 이 값으로 조절합니다.

   ⚠️ 0.7 아래로 내리면 몸이 대사창 윗변에 못 닿아 공중에 뜬 것처럼 보입니다.
      단 anchor:"feet" 인 인물은 예외입니다(아래 참고).

   [anchor] 어디를 기준으로 세울지.
     "head"(기본) — 머리끝을 무대 위쪽에 맞춥니다. 서 있는 인물용입니다.
     "feet"        — 가장 아래 잉크를 대사창 윗변에 얹습니다. 웅크린 짐승처럼
                     납작한 그림은 키를 맞추면 폭이 감당이 안 되게 커집니다.
                     작게 두면서 공중에 뜨지 않게 하려면 이쪽이 맞습니다. */
const PORTRAITS = [
  { key:"protagonistChef",   dir:"char_cust_kim_daeun_chef",      stem:"char_cust_kim_daeun",           flip:false, why:"김다은 · 주방 복장(가게에 들어온 뒤 전부)" },
  { key:"protagonistOffice", dir:"char_cust_kim_daeun_office",    stem:"char_cust_kim_daeun_office",    flip:false, why:"김다은 · 회사원 복장(프롤로그)" },
  { key:"rainyChild",        dir:"char_cust_rain_child",          stem:"char_cust_rain_child",          flip:true,  why:"1일차 · 비에 젖은 아이" },
  { key:"lanternGuest",      dir:"char_cust_lantern_head",        stem:"char_cust_lantern_head",        flip:true,  why:"2일차 · 등불을 머리에 인 손님" },
  { key:"twinShadows",       dir:"char_cust_joined_shadows",      stem:"char_cust_joined_shadows",      flip:true,  why:"3일차 · 둘이 붙은 그림자" },
  { key:"crowCourier",       dir:"char_cust_crow_postman",        stem:"char_cust_crow_postman",        flip:true,  why:"4일차 · 까마귀 우편배달부" },
  /* '작은 짐승'이라 작게 세웁니다. 납작하게 웅크린 그림이라 키를 남들과 맞추면
     폭이 화면 절반을 먹습니다. 그래서 대사창 턱에 걸터앉히고 크기를 낮춥니다. */
  { key:"starBeast",         dir:"char_cust_star_eating_beast",   stem:"char_cust_star_eating_beast",   flip:true,  scale:0.62, anchor:"feet", why:"5일차 · 별을 먹는 작은 짐승" },
  { key:"seawaterGuest",     dir:"char_cust_seawater_guest",      stem:"char_cust_seawater_guest",      flip:true,  why:"6일차 · 바닷물로 된 손님" },
  { key:"schoolDoll",        dir:"char_cust_stopped_school_doll", stem:"char_cust_stopped_school_doll", flip:true,  why:"7일차 · 멈춰버린 교복 인형" },
  { key:"facelessDaeun",     dir:"char_cust_faceless_kim_daeun",  stem:"char_cust_faceless_kim_daeun",  flip:true,  why:"마지막 예약 · 얼굴 없는 김다은" }
];

/* ------------------------------------------------------------
   [인물마다 상자 치수가 다른 이유]
   ------------------------------------------------------------
   공통 크롭 박스는 '상자'를 맞출 뿐, 상자 안에서 인물이 차지하는 높이까지
   같게 만들지는 못합니다. 원화마다 캔버스를 채운 정도가 제각각입니다
   (작은 짐승 51% · 주방 김다은 85% · 회사원 김다은 95%).

   그대로 두면 아이가 어른만 해지고, 옷만 갈아입은 김다은의 키가 11% 자라고,
   웅크린 짐승은 대사창 아래로 내려가 귀만 보입니다. 그래서 인물마다 상자
   크기(--art-height)와 내림폭(--art-drop)을 따로 계산해 넣습니다.

   맞추는 기준은 아래 세 값입니다. 이 값만 지키면 누가 서든 머리 높이가 같고,
   같은 몸 지점에서 대사창에 걸립니다.
     --css 로 인물별 값을 다시 뽑을 수 있습니다:
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

/* 화면 배율의 기준이 되는 인물입니다. 이 사람이 위 FIGURE_HEIGHT 대로 서고,
   나머지는 '캔버스에 그려진 크기 비율' 그대로 따라옵니다. 손님이 김다은보다
   크거나 작게 보이는 건 원화가 그렇게 그려져 있기 때문입니다. */
const REFERENCE_KEY = "protagonistChef";

// 열 인물 아흔 장의 알파 경계를 모두 합친 공통 크롭 박스(원본 4096x6144 기준).
// --box 로 다시 계산할 수 있습니다. 위 [공통 크롭 박스] 설명을 먼저 읽으세요.
// ⚠️ 이 비율은 css/story.css 의 .story-portrait.art aspect-ratio 와 같아야 합니다.
const BOX = { left: 0, top: 159, width: 4096, height: 5898 };

const HEIGHT = 1800;                                            // 위 [크기] 참고
const WIDTH = Math.round(BOX.width * HEIGHT / BOX.height);      // 비율은 원본 그대로
const QUALITY = 88;
const EFFORT = 6;     // cwebp 의 -m 6 에 해당. 느리지만 파일이 더 작아집니다.

const srcPath = (costume, m) => path.join(MASTER_ROOT, costume.dir, `${costume.stem}_motion_${m.index}.png`);
const outPath = (costume, m) => path.join(OUT_ROOT, costume.dir, `${costume.stem}_motion_${m.index}.webp`);

function kb(bytes){ return Math.round(bytes/1024); }

// 크롭 + 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
function resized(src, flip){
  const pipe = sharp(src).extract(BOX).resize(WIDTH, HEIGHT, { kernel:"lanczos3", fit:"fill" });
  return flip ? pipe.flop() : pipe;
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
  for(const costume of PORTRAITS){
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
async function measureFigure(entry){
  const { data, info } = await resized(srcPath(entry, MOTIONS[0]), entry.flip)
    .ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  let top = null, bottom = null;
  for(let y = 0; y < info.height; y++){
    let filled = false;
    for(let x = 0; x < info.width; x++){ if(data[(y*info.width+x)*4+3] > 16){ filled = true; break; } }
    if(filled){ if(top === null) top = y; bottom = y; }
  }
  const head = top / info.height;            // 상자 높이 대비 머리끝
  const feet = (bottom + 1) / info.height;   // 상자 높이 대비 발끝(가장 아래 잉크)
  return { head, feet, figure: feet - head };
}

async function computeCss(){
  requireMasters();
  console.log("등장인물별 값 (js/story.js 의 STORY_PORTRAIT_ART 에 그대로 넣으세요)\n");
  console.log(`기준: 머리끝을 무대 바닥보다 ${HEAD_ABOVE.toFixed(4)} 위에 맞추고,`);
  console.log(`      키는 무대 높이 x ${FIGURE_HEIGHT.toFixed(4)} x scale 로 정규화합니다.\n`);

  /* [왜 머리를 맞추고 키를 정규화하나]
     원화마다 인물이 캔버스를 채운 정도가 달라서, 그려진 크기를 그대로 쓰면
     아이가 어른만 해지고 웅크린 짐승은 대사창 아래로 내려가 귀만 보입니다.
     보이는 구간은 '머리끝 ~ 대사창 윗변' 하나뿐이니, 그 창에 맞춰 세우는 게
     맞습니다. 일부러 작게 세울 인물만 scale 로 조절합니다. */
  const rows = [];
  for(const entry of PORTRAITS){
    const m = await measureFigure(entry);
    const scale = entry.scale ?? 1;
    const bodyOnStage = FIGURE_HEIGHT * scale;         // 화면에서의 키(무대 높이 배수)
    const height = bodyOnStage / m.figure;             // 상자 높이 ÷ 무대 높이
    // 머리 기준이면 머리끝을 HEAD_ABOVE 에, 발 기준이면 발끝을 대사창 윗변에 둡니다.
    const feetBelow = entry.anchor === "feet" ? CUT_BELOW : bodyOnStage - HEAD_ABOVE;
    const drop = feetBelow + (1 - m.feet) * height;    // 상자 바닥을 그만큼 더 내립니다
    rows.push({ entry, m, height, drop, bodyOnStage });
    console.log(`  ${entry.key.padEnd(18)} 상자 안: 머리 ${(m.head*100).toFixed(1)}% 발끝 ${(m.feet*100).toFixed(1)}%`
      + ` 키 ${(m.figure*100).toFixed(1)}%  →  화면 키 x${bodyOnStage.toFixed(2)}`
      + (scale !== 1 ? `  scale ${scale}` : "") + (entry.anchor ? `  anchor:${entry.anchor}` : ""));
    if(entry.anchor === "feet"){
      const headOnStage = feetBelow - bodyOnStage;     // 음수일수록 무대 바닥 위
      if(-headOnStage > HEAD_ABOVE){
        console.warn(`    ! ${entry.key} : 머리가 무대 위로 솟습니다. scale 을 낮추세요.`);
      }
    }else if(bodyOnStage - (HEAD_ABOVE + CUT_BELOW) <= 0.02){
      console.warn(`    ! ${entry.key} : 몸이 대사창 윗변에 못 미칩니다.`
        + ' 공중에 뜬 것처럼 보입니다. scale 을 올리거나 anchor:"feet" 로 두세요.');
    }
  }

  console.log("\n────────── js/story.js 붙여넣기 ──────────");
  for(const { entry, height, drop } of rows){
    console.log(`  ${entry.key}:{dir:"${entry.dir}",stem:"${entry.stem}",`
      + `height:${(height*100).toFixed(1)},drop:${(drop*100).toFixed(1)}},`
      + `   // ${entry.why}`);
  }
}

async function convert(){
  requireMasters();
  let pngTotal=0, webpTotal=0;
  console.log(`공통 크롭 ${BOX.width}x${BOX.height} @(${BOX.left},${BOX.top}) → 출력 ${WIDTH}x${HEIGHT}`);
  console.log(`마스터 ${MASTER_ROOT}\n`);
  for(const costume of PORTRAITS){
    fs.mkdirSync(path.join(OUT_ROOT, costume.dir), { recursive:true });
    console.log(`[${costume.dir}] ${costume.why}`);
    for(const m of MOTIONS){
      const src = srcPath(costume, m);
      const out = outPath(costume, m);
      if(!fs.existsSync(src)){
        throw new Error(`원본이 없습니다: ${src}\n  (${costume.dir} 의 ${m.motion} 모션)`);
      }
      await checkFits(path.basename(src), src);
      await resized(src, costume.flip).webp({quality:QUALITY, effort:EFFORT, alphaQuality:100}).toFile(out);
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
  for(const costume of PORTRAITS){
    for(const m of MOTIONS){
      const src = srcPath(costume, m);
      const out = outPath(costume, m);
      if(!fs.existsSync(out) || !fs.existsSync(src))continue;
      const [a,b] = await Promise.all([
        resized(src, costume.flip).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
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
