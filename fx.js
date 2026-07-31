"use strict";

/* ============================================================
   화면 이펙트 (파티클 · 점수 팝업 · 목표 지점 안내 화살표)
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

// 다음에 갈 곳을 가리키는 원 + 화살표.
const FX_GUIDE = { radius:15, pulse:5, arrowDy:-32, arrowLen:17, arrowW:10, color:"rgba(255,220,125,.92)", width:4 };


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
   3. 목표 지점 안내
   ------------------------------------------------------------
   밤 조리 단계와 프롤로그 조리 단계를 가리킵니다.
   대상의 ix / iy (상호작용 지점)를 씁니다.

   [일반 낮 준비에는 안 그립니다] 낮 준비는 순서가 정해져 있지 않아서
   (선행 작업이 걸린 두부김치류만 예외) "다음 하나"를 가리킬 근거가
   없습니다. 예전에는 아직 안 한 것 중 첫 번째를 가리켰는데,
   아무 준비물이나 먼저 해도 되는 규칙과 어긋나 오해를 줬습니다.
   지금은 어떤 준비물이든 앞에 서면 이름표가 크게 둥실대므로
   (prep.js prepObjectUsable) 화살표 없이도 알 수 있습니다.

   반대로 밤 조리와 프롤로그 조리는 currentRequirement() 가 단계를 강제하므로
   가리킬 곳이 실제로 하나뿐이고, 그래서 화살표를 남겨 둡니다.
   ------------------------------------------------------------ */

function drawGuidance(){
  const storyCook=!!state.story?.activeStoryCook;
  if(state.paused||state.mini||(state.phase!=="night"&&!storyCook))return;
  const requirement=currentRequirement();
  const target=requirement?stationById(requirement):null;
  if(!target)return;

  const G=FX_GUIDE,t=performance.now()/1000;
  const pulse=G.radius+Math.sin(t*5)*G.pulse;
  const bob=Math.sin(t*6)*5;
  ctx.strokeStyle=G.color;ctx.lineWidth=G.width;
  ctx.beginPath();ctx.arc(target.ix,target.iy,pulse,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle=G.color;ctx.beginPath();
  ctx.moveTo(target.ix,target.iy+G.arrowDy-bob);
  ctx.lineTo(target.ix-G.arrowW,target.iy+G.arrowDy-G.arrowLen-bob);
  ctx.lineTo(target.ix+G.arrowW,target.iy+G.arrowDy-G.arrowLen-bob);
  ctx.fill();
}
