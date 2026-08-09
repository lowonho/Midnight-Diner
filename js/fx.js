"use strict";

/* ============================================================
   화면 이펙트 (파티클 · 점수 팝업 · 목표 집기 발광)
   ------------------------------------------------------------
   담당 범위: 어디에 무엇이 튀어오르고 몇 초 뒤 사라지는지 · 드로잉

   담당 범위가 아님: 언제 터뜨릴지 (조리 완료·서빙·폐기 등)
              → game.js / night.js 가 spawnPopup() 을 부릅니다

   [좌표계] 논리 좌표 1280x720. 프레임 캔버스(draw-utils.js)에 그립니다.
   ============================================================ */


/* ------------------------------------------------------------
   1. 설정값
   ------------------------------------------------------------ */

const FX_POPUP = { life:1.25, riseSpeed:25, font:"bold 21px Malgun Gothic", fill:"#ffe08c", stroke:"#4b2514", strokeWidth:4 };

const FX_PARTICLE = {
  count:9, life:.7, gravity:20,
  spreadX:100, riseMin:40, riseMax:80,
  sizeMin:3, sizeMax:4,
  colors:["#ffe08c","#d49a4b","#9ebc6b"]
};

/* "지금 이것" 을 알리는 빛. 대상 테두리에 흰빛이 돕니다.
   ------------------------------------------------------------
   지금 이 빛이 붙는 곳은 두 군데입니다.
     집기 이름표 명판   다음에 갈 조리대 (kitchen.js labelStation)
     손님 그림          지금 음식을 갖다 줄 손님 (customers.js)

   halo / body 는 발광 캔버스를 구울 때 한 번만 쓰는 값이고,
   breathMin~breathMax 는 매 프레임 거기에 곱하는 숨입니다.
   숨을 끄고 싶으면 breathMin 을 breathMax 와 같게 두면 됩니다.

   [body 가 0 인 이유] 대상 안쪽까지 빛을 얹으면 그림이 통째로 허옇게
   떠서, 원화의 색과 결이 다 죽습니다. 빛은 실루엣 **바깥**에만 두고
   안쪽은 원화 그대로 둡니다. 그래서 "빛나는 물건"이 아니라 "빛이
   둘러싼 물건"으로 보입니다. 안쪽에도 살짝 얹고 싶으면 이 값만 올리면
   됩니다 (.1 정도면 은은합니다).

   [거리와 무관합니다] 요리사가 멀리 있든 코앞에 있든 세기가 같습니다.
   거리에 따라 세기를 바꾸면 걸어가는 동안 밝기가 계속 흔들려서,
   빛이 "여기다" 라고 말하는 게 아니라 제 혼자 요동치는 것처럼 보입니다.
   ------------------------------------------------------------ */
const FX_GUIDE_GLOW = {
  color: "#ffffff",     // 흰빛
  blur:   7,            // 후광이 번져 나가는 거리 (논리 px)
  spread: 22,           // 발광 캔버스 여백. blur 보다 넉넉해야 후광이 잘리지 않습니다
  /* 한 번 얹은 세기(halo)를 passes 번 겹칩니다.
     한 장만 얹으면 번진 빛이 넓고 옅게 퍼져서, 밝은 타일 벽 앞에서는
     아예 안 보입니다. 겹치면 윤곽에 가까울수록 빠르게 진해져서
     테두리는 또렷하고 바깥으로는 부드럽게 사라집니다. */
  halo:   .8, haloPasses: 4,
  body:   0,            // 대상 안쪽에 스미는 빛 세기 (0 = 원화 그대로)
  noBlurBody: .2,       // ctx.filter 를 못 쓰는 브라우저에서만 쓰는 예비값
  /* 숨. 어두워지는 쪽(breathMin)을 너무 내리면 밝은 타일 벽 앞에서
     주기의 절반 동안 빛이 안 보여 깜빡이는 것처럼 읽힙니다. */
  breathMin: .72, breathMax: 1, breathPeriod: 2.4,   // 한 번 밝아졌다 어두워지는 데 2.4초

  plateRadius: 5,       // 판 그림을 못 받았을 때 쓰는 예비 명판의 모서리
  boxRadius:  10        // 명패 자리를 못 읽었을 때 쓰는 몸통 사각형의 모서리
};


/* ------------------------------------------------------------
   2. 파티클 · 팝업
   ------------------------------------------------------------ */

function spawnPopup(x,y,text){
  state.popups.push({x,y,text,life:FX_POPUP.life});
  const P=FX_PARTICLE;
  for(let i=0;i<P.count;i++)state.particles.push({
    x,y,
    vx:(Math.random()-.5)*P.spreadX,
    vy:-P.riseMin-Math.random()*P.riseMax,
    life:P.life,
    size:P.sizeMin+Math.random()*P.sizeMax,
    color:P.colors[i%P.colors.length]
  });
}

function updateParticles(dt){
  state.particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=FX_PARTICLE.gravity*dt;});
  state.particles=state.particles.filter(p=>p.life>0);
  state.popups.forEach(p=>{p.life-=dt;p.y-=FX_POPUP.riseSpeed*dt;});
  state.popups=state.popups.filter(p=>p.life>0);
}

function drawParticles(){
  state.particles.forEach(p=>{
    ctx.globalAlpha=clamp(p.life/FX_PARTICLE.life,0,1);
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  });
  ctx.globalAlpha=1;
  state.popups.forEach(p=>{
    ctx.globalAlpha=clamp(p.life,0,1);
    ctx.fillStyle=FX_POPUP.fill;ctx.strokeStyle=FX_POPUP.stroke;ctx.lineWidth=FX_POPUP.strokeWidth;
    ctx.font=FX_POPUP.font;ctx.textAlign="center";
    ctx.strokeText(p.text,p.x,p.y);ctx.fillText(p.text,p.x,p.y);
  });
  ctx.textAlign="left";ctx.globalAlpha=1;
}


/* ------------------------------------------------------------
   3. 목표 안내 — 대상 테두리에 빛을 두릅니다
   ------------------------------------------------------------
   밤 영업과 프롤로그 조리에서 "지금 이것" 을 알립니다.
     조리할 차례      → 그 집기의 이름표 명판이 빛납니다
     음식을 들었을 때 → 갖다 줄 손님이 빛납니다

   [화살표에서 발광으로 바뀐 이유] 예전에는 대상의 상호작용 지점(ix/iy)에
   노란 원과 삼각형을 그렸습니다. 손으로 그린 배경 위에 재질 없는 벡터
   도형 둘이 얹혀서 게임 오브젝트가 아니라 디버그 표시로 읽혔고, 원이
   집기가 아니라 그 앞 빈 바닥에 놓여서 정작 집기를 강조하지도 못했습니다.
   지금은 화면에 이미 있는 것(명판·손님)에 빛만 두릅니다. 새 도형이
   없으니 이물감이 없고, 빛나는 것이 곧 가야 할 곳입니다.

   [집기 몸통이 아니라 명판인 이유] 몸통에 두르면 빛이 옆 집기까지
   덮습니다 — 뒤쪽 9종이 빈틈 없이 붙어 있어서, 냄비를 두르면 도마와
   후라이팬 옆구리까지 같이 밝아집니다. 명판은 벽을 등지고 혼자 떠
   있어서 무엇을 가리키는지가 한눈에 읽힙니다.

   [세 신호의 역할 분담]
     명판 발광   어디로 → 이 파일
     명판 둥실   닿았나 → kitchen.js (E 를 누를 수 있으면 크게 둥실)
     키캡        어떻게 → css/interaction.css (닿으면 E)

   [일반 낮 준비에는 안 그립니다] 낮 준비는 순서가 정해져 있지 않아서
   (선행 작업이 걸린 두부김치류만 예외) "다음 하나"를 가리킬 근거가
   없습니다. 예전에는 아직 안 한 것 중 첫 번째를 가리켰는데,
   아무 준비물이나 먼저 해도 되는 규칙과 어긋나 오해를 줬습니다.
   지금은 어떤 준비물이든 앞에 서면 이름표가 크게 둥실대므로
   (prep.js prepObjectUsable) 따로 가리키지 않아도 알 수 있습니다.

   반대로 메뉴 선택·밤 조리·프롤로그 조리는 currentRequirement() 가
   단계를 강제하므로 가리킬 곳이 실제로 하나뿐이고, 그래서 남겨 둡니다.
   ------------------------------------------------------------ */

// 안내를 띄워도 되는 국면인가. 일시정지·미니게임 중에는 전부 끕니다.
function guidanceActive(){
  const storyCook=!!state.story?.activeStoryCook;
  const choosingMenu=state.phase==="menuSelect";
  return !state.paused&&!state.mini&&(state.phase==="night"||storyCook||choosingMenu);
}

// 지금 이름표가 빛나야 할 집기. 없으면 null.
function guidanceTarget(){
  if(!guidanceActive())return null;
  const requirement=currentRequirement();
  return requirement?stationById(requirement):null;
}

/* 지금 빛나야 할 손님의 주문 id. 없으면 null.
   음식을 손에 든 순간부터 그 주문의 손님이 빛납니다 — 이때는
   currentRequirement() 가 null 이라 집기 쪽 안내가 통째로 꺼지는
   구간이고, 정작 "이 중 누구에게" 가 제일 헷갈리는 구간입니다. */
function guidanceCustomerOrderId(){
  if(!guidanceActive()||state.phase!=="night")return null;
  return state.carrying?.orderId??null;
}

/* 발광 캔버스 굽기
   ------------------------------------------------------------
   모양의 **알파만** 빌려 실루엣을 뜬 뒤, 그것을 번지게 해서 바깥
   테두리 빛만 남긴 캔버스를 만들어 둡니다. 모양마다 한 번만 굽고
   이후에는 복사만 합니다.
     집기 이름표 → 명판 그림(draw-utils.js nameplateCanvas)이 모양
     손님        → 지금 프레임의 스프라이트 칸이 모양
     되돌림      → 모서리를 굴린 사각형

   ⚠️ 픽셀을 읽지 않습니다 (getImageData 없음). 이 게임은 file:// 로도
      열리는데, 그러면 그림을 얹은 캔버스가 오염돼 픽셀 읽기가 통째로
      막힙니다. drawImage 와 합성 연산만 쓰면 오염돼도 그대로 됩니다.

   [안쪽을 도려내는 이유] 번진 후광을 그대로 두면 대상까지 뿌옇게 덮어
   그림이 안개 낀 것처럼 흐려집니다. 안쪽은 실루엣으로 한 번 지워서
   원화를 그대로 두고, 빛은 바깥 테두리에만 남깁니다.
   도려내는 경계가 곧 그림의 윤곽이라 잘린 티가 나지 않습니다 —
   윤곽선 픽셀은 반투명이라 거기서 빛이 자연스럽게 옅어집니다.
   ------------------------------------------------------------ */
const glowCanvases = {};   // 모양 키 → 구워 둔 발광 캔버스

/* paintShape(g) 는 실루엣의 **모양만** 그립니다 (색은 아래에서 덮어씁니다).
   원점은 여백(pad) 안쪽 왼쪽 위이고, 크기는 shapeW x shapeH (VIEW px) 입니다. */
function bakeGlow(shapeW,shapeH,paintShape){
  const G=FX_GUIDE_GLOW,pad=Math.round(toView(G.spread));
  const w=shapeW+pad*2,h=shapeH+pad*2;

  // 1) 실루엣 — 모양의 알파만 남기고 통째로 빛 색으로 채웁니다.
  const solid=document.createElement("canvas");
  solid.width=w;solid.height=h;
  const s=solid.getContext("2d");
  s.translate(pad,pad);
  paintShape(s);
  s.setTransform(1,0,0,1,0,0);
  s.globalCompositeOperation="source-in";
  s.fillStyle=G.color;
  s.fillRect(0,0,w,h);

  // 2) 바깥 후광 + 안쪽에 스민 빛.
  const glow=document.createElement("canvas");
  glow.width=w;glow.height=h;
  const g=glow.getContext("2d");
  const canBlur="filter" in g;
  if(canBlur){
    g.filter=`blur(${Math.round(toView(G.blur))}px)`;
    g.globalAlpha=G.halo;
    for(let i=0;i<G.haloPasses;i++)g.drawImage(solid,0,0);
    g.filter="none";g.globalAlpha=1;
    g.globalCompositeOperation="destination-out";   // 대상 안쪽을 도려냅니다
    g.drawImage(solid,0,0);
    g.globalCompositeOperation="source-over";
  }
  /* 번지게 할 수 없는 브라우저(ctx.filter 미지원)에서는 테두리 빛을 못 만듭니다.
     아무것도 안 그리면 안내가 통째로 사라지므로, 그때만 안쪽에 옅게 얹습니다. */
  const body=canBlur?G.body:G.noBlurBody;
  if(body>0){g.globalAlpha=body;g.drawImage(solid,0,0);}
  return glow;
}

/* 구운 캔버스를 대상 사각형 한가운데에 맞춰 얹습니다.
   구운 캔버스는 여백(spread)만큼 크므로 중심을 맞추면 사방으로 똑같이
   삐져나옵니다. 그게 곧 테두리 빛입니다.

   ⚠️ 부르는 쪽이 이미 걸어 둔 globalAlpha(손님 등장 페이드 등)를
      곱합니다. 그냥 덮어쓰면 아직 안 나타난 손님만 빛이 먼저 뜹니다. */
function drawGuideGlow(glow,x,y,boxW,boxH){
  const G=FX_GUIDE_GLOW;
  const wave=.5+.5*Math.sin(performance.now()/1000*Math.PI*2/G.breathPeriod);
  const base=ctx.globalAlpha;
  const w=glow.width/VIEW_SCALE,h=glow.height/VIEW_SCALE;
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.globalAlpha=base*(G.breathMin+(G.breathMax-G.breathMin)*wave);
  ctx.drawImage(glow,x+(boxW-w)/2,y+(boxH-h)/2,w,h);
  ctx.restore();
}

/* 집기 이름표 명판. kitchen.js labelStation() 이 판을 그리기 **직전**에
   부릅니다 (판이 빛 위에 얹혀야 안쪽이 깔끔합니다).
   x,y,w,h 는 그 프레임의 판 자리 — 둥실 흔들림까지 반영된 값입니다.

   판 그림을 아직 못 받았으면 같은 크기의 둥근 사각형으로 굽습니다.
   그림이 나중에 도착하면 키가 달라져서 저절로 그림 쪽으로 넘어갑니다. */
function drawStationLabelGlow(s,x,y,w,h){
  if(guidanceTarget()?.id!==s.id)return;
  const plate=nameplateCanvas(w,h);
  const key=plate?`plate_${w}x${h}`:`platebox_${w}x${h}`;
  if(!(key in glowCanvases)){
    const G=FX_GUIDE_GLOW,vw=Math.round(toView(w)),vh=Math.round(toView(h));
    glowCanvases[key]=bakeGlow(vw,vh,plate
      ? g=>g.drawImage(plate,0,0,vw,vh)
      : g=>{g.fillStyle="#fff";roundRect(g,0,0,vw,vh,toView(G.plateRadius),true,false);});
  }
  drawGuideGlow(glowCanvases[key],x,y,w,h);
}

/* 앞쪽 철판·계산대의 명패. game.js draw() 가 앞 층에서 한 번 부릅니다.
   저쪽 명패는 counter.js 가 Phaser 컨테이너로 그려서(깊이 44) 이 캔버스
   (깊이 40)보다 위에 있습니다. 그래서 여기에 그린 빛은 자연히 명패
   **뒤**로 깔리고, 삐져나온 테두리만 보입니다 — 뒤쪽 집기와 같은 모습입니다.

   명패 자리는 컨테이너에서 그때그때 읽습니다. 둥실 흔들림과 강조 확대가
   저쪽에서 매 프레임 걸리기 때문에, 배치 상수를 베껴 오면 빛만 제자리에
   남아 명패가 그 안에서 헤엄칩니다. */
function drawFrontPlateGlow(){
  const target=guidanceTarget();
  if(!target||STATIONS[target.id])return;          // 뒤쪽 집기는 명판 쪽에서 그립니다

  const plate=counter?.plates?.find(p=>p.zone===target.id&&p.container);
  if(plate){
    const scale=plate.container.scale;
    const w=toLogic(plate.plate.displayWidth*scale),h=toLogic(plate.plate.displayHeight*scale);
    // 명패는 원점이 왼쪽 아래(setOrigin(0,1))입니다.
    drawBoxGlow(`frontplate_${target.id}`,toLogic(plate.container.x),toLogic(plate.container.y)-h,w,h,
                FX_GUIDE_GLOW.plateRadius);
    return;
  }
  // 명패가 없거나(계산대는 hidden) 아직 안 만들어졌으면 몸통을 두릅니다.
  drawBoxGlow(`frontbody_${target.id}`,target.x,target.y,target.w,target.h,FX_GUIDE_GLOW.boxRadius);
}

// 모서리를 굴린 사각형 하나를 두릅니다. 크기가 변하지 않는 대상에만 쓰세요(키에 크기가 없습니다).
function drawBoxGlow(key,x,y,w,h,radius){
  if(!(key in glowCanvases)){
    const vw=Math.round(toView(w)),vh=Math.round(toView(h));
    glowCanvases[key]=bakeGlow(vw,vh,g=>{g.fillStyle="#fff";roundRect(g,0,0,vw,vh,toView(radius),true,false);});
  }
  drawGuideGlow(glowCanvases[key],x,y,w,h);
}

/* 손님 한 명. customers.js drawCustomerSprite() 가 손님을 그리기 **직전**에
   부릅니다. 지금 그 프레임의 스프라이트 칸에서 실루엣을 떠서, 걷거나
   먹는 동작 중에도 빛이 몸을 정확히 따라갑니다.

   [프레임마다 굽습니다] 한 칸에서 구워 돌려 쓰면 팔다리가 움직일 때
   빛만 제자리에 남습니다. 실제로 굽는 건 화면에 있는 손님이 쓰는
   칸뿐이라(많아야 예닐곱 장) 부담이 되지 않습니다. */
function drawCustomerGlow(customer,sheet,key,sx,sy,sw,sh,x,y,w,h){
  if(!sheet||customer?.id==null||customer.id!==guidanceCustomerOrderId())return;
  const cacheKey=`guest_${key}`;
  if(!(cacheKey in glowCanvases)){
    const vw=Math.round(toView(w)),vh=Math.round(toView(h));
    glowCanvases[cacheKey]=bakeGlow(vw,vh,g=>g.drawImage(sheet,sx,sy,sw,sh,0,0,vw,vh));
  }
  drawGuideGlow(glowCanvases[cacheKey],x,y,w,h);
}
