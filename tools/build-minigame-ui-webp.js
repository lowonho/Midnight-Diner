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

const UI_DIR = path.join(__dirname, "..", "assets", "UI", "Minigame");

/* [폴더마다 배율이 다릅니다 — 여기가 이 스크립트의 핵심입니다]

   common/  공용 프레임(뒤 패널·타이틀·플레이 보드·TIP 줄·버튼)
            납품 PNG 가 CSS 크기의 **4배율**이라 절반으로 줄여 2배율로 뽑습니다.
            (4배율 그대로면 뒤 패널 한 장이 15MB 라 전체 용량을 혼자 다 먹습니다)

   A1 A2 B C  미니게임-패널-에셋-발주서 대로 받은 칸 패널·재료 카드·진행도 카드.
            발주서가 **처음부터 2배 픽셀로 크기를 지정**했고 납품본도 그 크기라
            줄이지 않고 그대로 인코딩합니다. 여기서 또 줄이면 1배율이 되어
            높은 DPI 화면에서 흐려집니다.

   ⚠️ 새 폴더를 추가할 때 배율을 잘못 적으면 조용히 흐려지거나 용량만 먹습니다.
      아래 표가 유일한 기준이니 폴더를 늘리면 여기부터 고치세요. */
const GROUPS = [
  { dir:"common", scale:0.5, label:"공용 프레임 (4배율 → 2배율)" },
  { dir:"A1",     scale:1,   label:"A1 좌 재료 패널 (2배율 그대로)" },
  { dir:"A2",     scale:1,   label:"A2 우 아래 패널 (2배율 그대로)" },
  { dir:"B",      scale:1,   label:"B 재료 카드 (2배율 그대로)" },
  { dir:"C",      scale:1,   label:"C 진행도 카드 (2배율 그대로)" }
];

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

/* ============================================================
   파생 패널 — 납품본을 세로로 잘라 만드는 크기
   ------------------------------------------------------------
   A2 우 아래 패널은 "크기별 통짜 그림"이라 자리마다 파일이 따로 있어야 합니다.
   그런데 진행도 카드가 초 있는 버전(198.1)이 되면서 503.2 칸(E3 볶음우동)의
   아래 패널이 293.1 이 되었고, 그 크기의 납품본이 없습니다.

   이 패널은 **나무판 + 사방 금테 + 네 모서리 장식**뿐이라, 세로 가운데의
   나무결만 덜어내면 모서리와 금테가 그대로 남습니다. 그래서 위 절반과 아래
   절반을 잘라 붙여 새 높이를 만듭니다. 늘리거나 줄이지 않으므로 금테 굵기와
   모서리 장식이 원본 그대로입니다.

   ⚠️ PNG 는 만들지 않고 **WebP 만** 뽑습니다. PNG 폴더는 납품 마스터 자리라
      파생본을 섞어 두면 다음 사람이 어느 것이 원본인지 알 수 없습니다.
   ⚠️ 아래 --verify 는 이 파생본을 건너뜁니다(비교할 PNG 가 없습니다).
   ⚠️ 정말 이 크기의 납품본을 받게 되면, 여기 한 줄을 지우고 PNG 를 A2/ 에
      넣기만 하면 됩니다 — CSS(--mg-art-a2-293)는 그대로 둡니다. */
const DERIVED = [
  { group:"A2", from:"mg-panel-500x701.png", out:"mg-panel-500x586.webp", height:586 }
];

// 세로 가운데를 덜어내고 위·아래를 붙입니다.
async function buildDerived(){
  for(const d of DERIVED){
    const src = path.join(UI_DIR, d.group, d.from);
    if(!fs.existsSync(src)){ console.warn(`  ! ${d.group}/${d.from} 이 없어 ${d.out} 을 못 만듭니다`); continue; }
    const out = path.join(UI_DIR, d.group, d.out);
    const meta = await sharp(src).metadata();
    if(meta.height <= d.height){
      console.warn(`  ! ${d.from}(${meta.height}) 이 목표 ${d.height} 보다 낮습니다 — 잘라 만들 수 없습니다`);
      continue;
    }
    // 위 top / 아래 bottom 으로 나눕니다. 홀수면 위쪽이 1 더 갖습니다.
    const top = Math.ceil(d.height/2), bottom = d.height - top;
    const [topBuf, bottomBuf] = await Promise.all([
      sharp(src).extract({ left:0, top:0, width:meta.width, height:top }).png().toBuffer(),
      sharp(src).extract({ left:0, top:meta.height-bottom, width:meta.width, height:bottom }).png().toBuffer()
    ]);
    await sharp({ create:{ width:meta.width, height:d.height, channels:4, background:{r:0,g:0,b:0,alpha:0} } })
      .composite([{ input:topBuf, top:0, left:0 }, { input:bottomBuf, top:top, left:0 }])
      .webp({ quality:QUALITY, effort:EFFORT, alphaQuality:100 })
      .toFile(out);
    console.log(`${d.group}/${d.out}`.padEnd(40), `${meta.width}x${meta.height}`.padStart(11),
      `${meta.width}x${d.height}`.padStart(11), "".padStart(8), `${kb(fs.statSync(out).size)}KB`.padStart(8),
      "".padStart(7), `  ${d.from} 세로 잘라 붙임`);
  }
}

// 폴더를 돌며 [원본 경로, 배율, 폴더이름] 목록을 만듭니다.
const files = GROUPS.flatMap(g => {
  const dir = path.join(UI_DIR, g.dir);
  if(!fs.existsSync(dir)){ console.warn(`  ! ${g.dir}/ 폴더가 없습니다 — 건너뜁니다`); return []; }
  return fs.readdirSync(dir).filter(n => n.endsWith(".png"))
    .map(name => ({ name, src: path.join(dir,name), scale: g.scale, group: g.dir }));
});

function kb(bytes){ return Math.round(bytes/1024); }

// 축소 파이프라인. 검증(verify)도 같은 함수를 써야 "인코딩 손실"만 측정됩니다.
// 여기가 갈라지면 축소 오차까지 손실로 잡혀서 수치가 의미 없어집니다.
function resized(src, w, h){
  return sharp(src).resize(w, h, { kernel: "lanczos3", fit: "fill" });
}

function targetSize(f, meta){
  const w = Math.round(meta.width * f.scale);
  const h = Math.round(meta.height * f.scale);

  // common/ : 표에 적어 둔 1배율 값의 4배로 왔는지 확인합니다.
  const expected = EXPECTED_1X[f.name];
  if(expected && (w !== expected[0]*2 || h !== expected[1]*2)){
    console.warn(`  ! ${f.name} : 4배율 가정과 다릅니다. ` +
      `원본 ${meta.width}x${meta.height} → ${w}x${h} (예상 ${expected[0]*2}x${expected[1]*2})`);
  }
  // A1 A2 B C : 파일 이름에 박힌 `500x1226` 이 곧 발주 크기입니다.
  // 이름과 실제가 다르면 발주서와 어긋난 것이므로 바로 알려 줍니다.
  const named = f.name.match(/(\d+)x(\d+)/);
  if(!expected && named && (meta.width !== +named[1] || meta.height !== +named[2])){
    console.warn(`  ! ${f.name} : 이름은 ${named[1]}x${named[2]} 인데 실제는 ${meta.width}x${meta.height} 입니다`);
  }
  return [w, h];
}

async function convert(){
  let pngTotal=0, webpTotal=0;
  console.log("파일".padEnd(40), "원본크기".padStart(11), "출력크기".padStart(11),
    "PNG".padStart(8), "WebP".padStart(8), "절감".padStart(7), "  모드");
  for(const f of files){
    const src=f.src;
    const out=src.replace(/\.png$/,".webp");
    const meta=await sharp(src).metadata();
    const [w,h]=targetSize(f,meta);
    const lossless=LOSSLESS.has(f.name);
    await resized(src,w,h)
      .webp(lossless?{lossless:true,effort:EFFORT}:{quality:QUALITY,effort:EFFORT,alphaQuality:100})
      .toFile(out);
    const a=fs.statSync(src).size, b=fs.statSync(out).size;
    pngTotal+=a; webpTotal+=b;
    console.log(`${f.group}/${f.name}`.padEnd(40), `${meta.width}x${meta.height}`.padStart(11), `${w}x${h}`.padStart(11),
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
  console.log("파일".padEnd(40), "알파최대오차".padStart(12), "RGB평균".padStart(9), "RGB최대".padStart(8));
  for(const f of files){
    const src=f.src;
    const out=src.replace(/\.png$/,".webp");
    if(!fs.existsSync(out))continue;
    const meta=await sharp(src).metadata();
    const [w,h]=targetSize(f,meta);
    const [a,b]=await Promise.all([
      resized(src,w,h).ensureAlpha().raw().toBuffer({resolveWithObject:true}),
      sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    ]);
    if(a.data.length!==b.data.length){ console.log(f.name,"크기 불일치!"); continue; }
    let alphaMax=0,rgbSum=0,rgbMax=0,rgbCount=0;
    for(let i=0;i<a.data.length;i+=4){
      alphaMax=Math.max(alphaMax,Math.abs(a.data[i+3]-b.data[i+3]));
      if(a.data[i+3]<8)continue;               // 완전 투명 영역의 RGB 는 의미 없음
      for(let c=0;c<3;c++){
        const d=Math.abs(a.data[i+c]-b.data[i+c]);
        rgbSum+=d; rgbMax=Math.max(rgbMax,d); rgbCount++;
      }
    }
    console.log(`${f.group}/${f.name}`.padEnd(40), String(alphaMax).padStart(12),
      (rgbCount?(rgbSum/rgbCount).toFixed(2):"-").padStart(9), String(rgbMax).padStart(8));
  }
}

(async()=>{
  if(!process.argv.includes("--verify")){
    await convert();
    await buildDerived();
  }
  await verify();
})().catch(error=>{ console.error(error); process.exit(1); });
