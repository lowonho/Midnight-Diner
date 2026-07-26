"use strict";

// Day 4 준비 밸런스 데이터. 미니게임 코드는 이 값을 읽기만 합니다.
const RapidCutType=Object.freeze({
  Normal:"Normal",
  ToughMeat:"ToughMeat"
});

const RAPID_CUT_INPUT=Object.freeze({
  minimumInterval:0.10,
  toughHoldTime:0.50,
  toughHoldThreshold:0.42
});

const RAPID_CUT_DATA=Object.freeze({
  cutRadish:{ingredientId:"radish",displayName:"무",requiredPieces:4,cutType:RapidCutType.Normal,progressSprites:[],cutSound:null},
  cutFishCake:{ingredientId:"fishCake",displayName:"어묵",requiredPieces:5,cutType:RapidCutType.Normal,progressSprites:[],cutSound:null},
  cutTofuKimchi:{ingredientId:"kimchi",displayName:"김치",requiredPieces:3,cutType:RapidCutType.Normal,progressSprites:[],cutSound:null},
  cutPancakeKimchi:{ingredientId:"kimchi",displayName:"김치",requiredPieces:3,cutType:RapidCutType.Normal,progressSprites:[],cutSound:null},
  cutSkewerChicken:{ingredientId:"chicken",displayName:"닭고기",requiredPieces:5,cutType:RapidCutType.ToughMeat,requiredHoldTime:RAPID_CUT_INPUT.toughHoldTime,progressSprites:[],cutSound:null},
  cutSkewerGreenOnion:{ingredientId:"greenOnion",displayName:"대파",requiredPieces:4,cutType:RapidCutType.Normal,progressSprites:[],cutSound:null}
});

const DAY4_RAPID_CUT_SEQUENCE=Object.freeze([
  Object.freeze({ingredientId:"cabbage",assetPrefix:"tteokCabbage",displayName:"양배추",requiredPieces:8,cutType:RapidCutType.Normal,progressSprites:Object.freeze(Array.from({length:9},(_,index)=>`assets/prep/day4/tteokbokki/cabbage-${index}.png`)),cutSound:null}),
  Object.freeze({ingredientId:"greenOnion",assetPrefix:"tteokGreenOnion",displayName:"대파",requiredPieces:7,cutType:RapidCutType.Normal,progressSprites:Object.freeze(Array.from({length:8},(_,index)=>`assets/prep/day4/tteokbokki/green-onion-${index}.png`)),cutSound:null}),
  Object.freeze({ingredientId:"fishCake",assetPrefix:"tteokFishCake",displayName:"어묵",requiredPieces:6,cutType:RapidCutType.Normal,progressSprites:Object.freeze(Array.from({length:7},(_,index)=>`assets/prep/day4/tteokbokki/fish-cake-${index}.png`)),cutSound:null})
]);

const SAUCE_RECIPES=Object.freeze({
  yakisoba:Object.freeze({
    title:"볶음우동 소스 레시피",
    taskId:"mixYakisobaSauce",
    completionMessage:"볶음우동 소스 제조 완료",
    ingredients:Object.freeze([
      Object.freeze({id:"soy",label:"간장",target:200,step:50}),
      Object.freeze({id:"oyster",label:"굴소스",target:100,step:25}),
      Object.freeze({id:"chili",label:"고추기름",target:30,step:10})
    ])
  }),
  tteokbokki:Object.freeze({
    title:"떡볶이 양념장 레시피",
    taskId:"mixTteokbokkiSauce",
    completionMessage:"떡볶이 양념장 계량 완료",
    ingredients:Object.freeze([
      Object.freeze({id:"gochujang",label:"고추장",target:120,step:30}),
      Object.freeze({id:"oligosaccharide",label:"올리고당",target:60,step:20}),
      Object.freeze({id:"soy",label:"간장",target:30,step:10})
    ])
  })
});

const DAY4_PREP_CONFIG=Object.freeze({
  soak:{taskId:"soakTteok",required:["tteok","water"]},
  potatoMandoline:{taskId:"sliceFriesPotato",ingredient:"potato",label:"감자",directions:["up","down"],totalInputs:10},
  potatoStarch:{taskId:"shakeFriesStarch",requiredPresses:12,stages:[0,35,70,100]}
});
