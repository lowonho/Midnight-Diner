"use strict";

/* ============================================================
   스토리 자동 이동 연출
   ------------------------------------------------------------
   정식 배경 에셋이 없어도 Phaser 위에서 캐릭터 동선부터 확인할 수 있게
   만든 임시 연출입니다. 배경 에셋이 준비되면
   STORY_CINEMATIC_BACKGROUND_TEXTURES의 텍스처 키만 등록해 교체합니다.
   ============================================================ */

const STORY_CINEMATIC_IDS=Object.freeze({
  prologueExterior:"pr01Exterior"
});
const STORY_CINEMATIC_BACKGROUND_TEXTURES=Object.freeze({
  [STORY_CINEMATIC_IDS.prologueExterior]:"story_pr01_exterior_bg"
});
const STORY_CINEMATIC_BEATS=Object.freeze({
  exit:Object.freeze({from:.08,to:.28,duration:2400,rain:false,fade:false}),
  pause:Object.freeze({at:.28,rain:false}),
  rainRun:Object.freeze({from:.28,to:.78,duration:3200,rain:true,fade:false}),
  enter:Object.freeze({from:.78,to:.90,duration:1100,rain:true,fade:true})
});
const STORY_CINEMATIC_WALK_ANIM="story-pr01-walk-right";
let storyCinematicRuntime=null;

function storyCinematicConfig(line){
  const config=line?.cinematic;
  if(!config||typeof config!=="object")return null;
  if(config.id!==STORY_CINEMATIC_IDS.prologueExterior)return null;
  if(!["exit","pause","rainRun","enter"].includes(config.beat))return null;
  return config;
}

function storyCinematicBeatPlan(lineOrBeat){
  const beat=typeof lineOrBeat==="string"?lineOrBeat:storyCinematicConfig(lineOrBeat)?.beat;
  return beat&&STORY_CINEMATIC_BEATS[beat]?STORY_CINEMATIC_BEATS[beat]:null;
}

function storyCinematicScene(){
  if(typeof phaserScene==="undefined"||!phaserScene?.add||!phaserScene?.tweens)return null;
  return phaserScene;
}

function storyCinematicSize(scene){
  const width=typeof VIEW_W==="number"?VIEW_W:Number(scene.scale?.width)||1920;
  const height=typeof VIEW_H==="number"?VIEW_H:Number(scene.scale?.height)||1080;
  return {width,height};
}

function addStoryCinematicPlaceholder(scene,root,width,height){
  // 배경 에셋이 들어오기 전까지만 보이는 중립적인 빈 레이어입니다.
  // 임시 건물 그림을 만들지 않아 정식 배경 작업과 시각적으로 충돌하지 않습니다.
  root.add(scene.add.rectangle(width/2,height/2,width,height,0x0c1422));
  root.add(scene.add.rectangle(width/2,height*.79,width,height*.42,0x111821));
}

function createStoryCinematicRain(scene,root,width,height){
  const rain=scene.add.graphics();
  rain.lineStyle(Math.max(2,width*.0011),0x9bc5e5,.62);
  for(let index=0;index<72;index++){
    const x=Math.random()*width;
    const y=Math.random()*height;
    const length=height*(.025+Math.random()*.035);
    rain.lineBetween(x,y,x-width*.008,y+length);
  }
  rain.setVisible(false);
  root.add(rain);
  const tween=scene.tweens.add({
    targets:rain,
    y:height*.09,
    duration:420,
    repeat:-1,
    paused:true,
    onRepeat:()=>{rain.y=0;}
  });
  return {rain,tween};
}

function ensureStoryCinematicWalkAnimation(scene){
  if(scene.anims.exists(STORY_CINEMATIC_WALK_ANIM))return;
  scene.anims.create({
    key:STORY_CINEMATIC_WALK_ANIM,
    frames:scene.anims.generateFrameNumbers("chef",{start:8,end:11}),
    frameRate:7,
    repeat:-1
  });
}

function createPrologueExteriorCinematic(scene){
  const {width,height}=storyCinematicSize(scene);
  const depth=(typeof STAGE_DEPTH==="object"&&Number.isFinite(STAGE_DEPTH.ambient))
    ?STAGE_DEPTH.ambient+30
    :90;
  const root=scene.add.container(0,0).setDepth(depth);
  const backgroundKey=STORY_CINEMATIC_BACKGROUND_TEXTURES[STORY_CINEMATIC_IDS.prologueExterior];
  if(scene.textures.exists(backgroundKey)){
    root.add(scene.add.image(width/2,height/2,backgroundKey).setDisplaySize(width,height));
  }else{
    addStoryCinematicPlaceholder(scene,root,width,height);
  }

  const rain=createStoryCinematicRain(scene,root,width,height);
  ensureStoryCinematicWalkAnimation(scene);
  const sprite=scene.add.sprite(0,0,"chef",8)
    .setOrigin(.5,1)
    .setScale(4)
    .setFlipX(true);
  const box=scene.add.rectangle(50,-105,72,55,0xb67b48)
    .setStrokeStyle(5,0x694326,1);
  const boxTape=scene.add.rectangle(50,-105,9,55,0xd8b17c,.9);
  const character=scene.add.container(width*.08,height*.70,[sprite,box,boxTape]);
  root.add(character);

  storyCinematicRuntime={
    id:STORY_CINEMATIC_IDS.prologueExterior,
    scene,root,width,height,character,sprite,
    rain:rain.rain,rainTween:rain.tween,
    moveTween:null
  };
  return storyCinematicRuntime;
}

function setStoryCinematicWalking(runtime,moving){
  if(moving)runtime.sprite.play(STORY_CINEMATIC_WALK_ANIM,true);
  else{
    runtime.sprite.stop();
    runtime.sprite.setFrame(8);
  }
}

function setStoryCinematicRain(runtime,visible){
  runtime.rain.setVisible(visible);
  if(visible)runtime.rainTween.resume();
  else{
    runtime.rainTween.pause();
    runtime.rain.y=0;
  }
}

function moveStoryCinematicCharacter(runtime,fromX,toX,duration,{rain=false,fade=false}={}){
  runtime.moveTween?.stop();
  runtime.character.setPosition(runtime.width*fromX,runtime.height*.70);
  runtime.character.setAlpha(1);
  setStoryCinematicRain(runtime,rain);
  setStoryCinematicWalking(runtime,true);
  runtime.moveTween=runtime.scene.tweens.add({
    targets:runtime.character,
    x:runtime.width*toX,
    alpha:fade?0:1,
    duration,
    ease:"Sine.easeInOut",
    onComplete:()=>setStoryCinematicWalking(runtime,false)
  });
}

function applyStoryCinematic(line){
  const config=storyCinematicConfig(line);
  if(!config){clearStoryCinematic();return false;}
  const scene=storyCinematicScene();
  if(!scene)return false;
  const runtime=storyCinematicRuntime?.scene===scene
    ?storyCinematicRuntime
    :createPrologueExteriorCinematic(scene);
  document.getElementById("storyOverlay")?.classList.add("story-cinematic-active");
  const plan=storyCinematicBeatPlan(config.beat);
  if(Number.isFinite(plan.at)){
    runtime.moveTween?.stop();
    runtime.character.setPosition(runtime.width*plan.at,runtime.height*.70).setAlpha(1);
    setStoryCinematicRain(runtime,plan.rain);
    setStoryCinematicWalking(runtime,false);
  }else if(config.beat==="rainRun"){
    moveStoryCinematicCharacter(runtime,plan.from,plan.to,plan.duration,{rain:plan.rain,fade:plan.fade});
  }else{
    moveStoryCinematicCharacter(runtime,plan.from,plan.to,plan.duration,{rain:plan.rain,fade:plan.fade});
  }
  return true;
}

function clearStoryCinematic(){
  document.getElementById("storyOverlay")?.classList.remove("story-cinematic-active");
  if(!storyCinematicRuntime)return;
  storyCinematicRuntime.moveTween?.stop();
  storyCinematicRuntime.rainTween?.stop();
  storyCinematicRuntime.root?.destroy(true);
  storyCinematicRuntime=null;
}
