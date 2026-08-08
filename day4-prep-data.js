"use strict";

// Day 4 준비 밸런스 데이터. 미니게임 코드는 이 값을 읽기만 합니다.
// 떡볶이 재료 칼질. 예전에는 셋을 한 화면에서 이어서 썰었지만
// 지금은 재료마다 별도의 준비 작업이라 taskId 로 찾아 씁니다.
const TTEOKBOKKI_CUT_SEQUENCE=Object.freeze([
  Object.freeze({taskId:"cutTteokbokkiCabbage",ingredientId:"cabbage",assetPrefix:"tteokCabbage",displayName:"양배추",requiredPieces:12,hitTolerance:CUT_HIT_TOLERANCE.cabbage,travelSpeed:16,progressSprites:Object.freeze(Array.from({length:13},(_,index)=>`assets/minigame/E1/cabbage-${index}.png`))}),
  Object.freeze({taskId:"cutTteokbokkiGreenOnion",ingredientId:"greenOnion",assetPrefix:"tteokGreenOnion",displayName:"대파",requiredPieces:7,hitTolerance:CUT_HIT_TOLERANCE.greenOnion,travelSpeed:19,progressSprites:Object.freeze(Array.from({length:8},(_,index)=>`assets/minigame/E1/green-onion-${index}.png`))}),
  Object.freeze({taskId:"cutTteokbokkiFishCake",ingredientId:"fishCake",assetPrefix:"tteokFishCake",displayName:"어묵",requiredPieces:4,hitTolerance:CUT_HIT_TOLERANCE.fishCake,horizontalHitTolerance:CUT_HORIZONTAL_HIT_TOLERANCE.fishCake,travelSpeed:22,horizontalLastCut:true,progressSprites:Object.freeze(Array.from({length:5},(_,index)=>`assets/minigame/E1/fish-cake-${index}.png`))})
]);

// 새우 튀김옷은 하나의 준비 작업 안에서 세 단계가 연속으로 이어집니다.
// 각 단계마다 새우 세 마리를 마우스로 굴려 재료를 묻힙니다.
const SHRIMP_COAT_TASK_ID="coatShrimp";
const SHRIMP_COAT_STEPS=Object.freeze([
  Object.freeze({step:0,id:"flour",label:"밀가루",shrimpCount:3}),
  Object.freeze({step:1,id:"egg",label:"계란물",shrimpCount:3}),
  Object.freeze({step:2,id:"breadcrumbs",label:"빵가루",shrimpCount:3})
]);

const DAY4_PREP_CONFIG=Object.freeze({
  potatoMandoline:{taskId:"sliceFriesPotato",ingredient:"potato",label:"감자",directions:["left","right"],totalInputs:20},
  potatoStarch:{taskId:"shakeFriesStarch",requiredPresses:14,stages:[0,35,70,100]}
});
