"use strict";

// 날짜/메뉴 확장의 기준 데이터입니다. 새 메뉴와 날짜 규칙은 이 파일에 등록합니다.
const GAME_PHASES=Object.freeze({
  MENU_SELECT:"menuSelect",
  PREP:"day",
  OPEN:"night",
  RESULT:"result"
});

const SKEWER_BATCH_SIZE=3;

const PREP_TASKS=Object.freeze({
  cutRadish:{id:"cutRadish",menuId:"oden",label:"무 썰기",objectLabel:"무 바구니",objectKind:"radish",miniGame:"cut",prepOrder:1,isImplemented:true},
  cutFishCake:{id:"cutFishCake",menuId:"oden",label:"어묵 썰기",objectLabel:"어묵 바구니",objectKind:"fishCake",miniGame:"cut",prepOrder:2,isImplemented:true},
  cleanAnchovy:{id:"cleanAnchovy",menuId:"oden",label:"멸치 손질",objectLabel:"멸치 바구니",objectKind:"anchovy",miniGame:"anchovy",prepOrder:3,isImplemented:true},
  cutTofuKimchi:{id:"cutTofuKimchi",menuId:"tofu",label:"두부김치용 김치 썰기",objectLabel:"두부김치용 김치",objectKind:"kimchi",miniGame:"cut",prepOrder:10,isImplemented:true},
  cutPancakeKimchi:{id:"cutPancakeKimchi",menuId:"kimchi",label:"김치전용 김치 썰기",objectLabel:"김치전용 김치",objectKind:"kimchi",miniGame:"cut",prepOrder:20,isImplemented:true},
  cutSkewerChicken:{id:"cutSkewerChicken",menuId:"skewer",label:"닭 썰기",objectLabel:"닭고기",objectKind:"chicken",miniGame:"cut",prepOrder:30,isImplemented:true},
  cutSkewerGreenOnion:{id:"cutSkewerGreenOnion",menuId:"skewer",label:"대파 썰기",objectLabel:"대파",objectKind:"greenOnion",miniGame:"cut",dependsOn:["cutSkewerChicken"],prepOrder:40,isImplemented:true},
  fryTofuKimchi:{id:"fryTofuKimchi",menuId:"tofu",label:"두부김치용 김치 볶기",objectLabel:"김치 볶기 팬",objectKind:"pan",miniGame:"kimchiFry",dependsOn:["cutTofuKimchi"],prepOrder:50,isImplemented:true},
  mixKimchiBatter:{id:"mixKimchiBatter",menuId:"kimchi",label:"김치전 반죽 만들기",objectLabel:"김치전 믹스볼",objectKind:"batter",miniGame:"batter",dependsOn:["cutPancakeKimchi"],prepOrder:60,isImplemented:true},
  assembleChickenSkewer:{id:"assembleChickenSkewer",menuId:"skewer",label:"닭꼬치 꽂기",objectLabel:"꼬치 조립대",objectKind:"skewer",miniGame:"skewer",dependsOn:["cutSkewerChicken","cutSkewerGreenOnion"],prepOrder:70,isImplemented:true},
  sliceYakisobaCabbage:{id:"sliceYakisobaCabbage",menuId:"yakisoba",label:"양배추 채썰기",objectLabel:"양배추와 채칼",objectKind:"cabbage",miniGame:"mandoline",prepOrder:80,isImplemented:true,dayOnly:3},
  sliceYakisobaCarrot:{id:"sliceYakisobaCarrot",menuId:"yakisoba",label:"당근 채썰기",objectLabel:"당근과 채칼",objectKind:"carrot",miniGame:"mandoline",dependsOn:["sliceYakisobaCabbage"],prepOrder:90,isImplemented:true,dayOnly:3},
  mixYakisobaSauce:{id:"mixYakisobaSauce",menuId:"yakisoba",label:"소스 제조",objectLabel:"볶음우동 소스볼",objectKind:"sauceBowl",miniGame:"yakisobaSauce",dependsOn:["sliceYakisobaCarrot"],prepOrder:100,isImplemented:true,dayOnly:3},
  coatShrimpBatter:{id:"coatShrimpBatter",menuId:"shrimpTempura",label:"튀김옷 입히기",objectLabel:"새우 튀김옷 재료",objectKind:"shrimpCoat",miniGame:"shrimpCoat",dependsOn:["mixYakisobaSauce"],prepOrder:110,isImplemented:true,dayOnly:3},
  coatShrimpBreadcrumbs:{id:"coatShrimpBreadcrumbs",menuId:"shrimpTempura",label:"빵가루 코팅",objectLabel:"빵가루 코팅대",objectKind:"breadcrumbs",miniGame:"breadcrumbCoat",dependsOn:["coatShrimpBatter"],prepOrder:120,isImplemented:true,dayOnly:3},
  soakTteok:{id:"soakTteok",menuId:"tteokbokki",label:"떡 불려두기",objectLabel:"떡과 물",objectKind:"tteokBowl",miniGame:"tteokSoak",prepOrder:121,day4Order:1,isImplemented:true,dayOnly:4},
  cutTteokbokkiIngredients:{id:"cutTteokbokkiIngredients",menuId:"tteokbokki",label:"양배추 · 대파 · 어묵 칼질",objectLabel:"떡볶이 칼질 재료",objectKind:"tteokCut",miniGame:"rapidCutSequence",dependsOn:["soakTteok"],prepOrder:122,day4Order:2,isImplemented:true,dayOnly:4},
  mixTteokbokkiSauce:{id:"mixTteokbokkiSauce",menuId:"tteokbokki",label:"떡볶이 양념장 계량",objectLabel:"떡볶이 양념장 볼",objectKind:"sauceBowl",miniGame:"tteokbokkiSauce",dependsOn:["cutTteokbokkiIngredients"],prepOrder:123,day4Order:3,isImplemented:true,dayOnly:4},
  sliceFriesPotato:{id:"sliceFriesPotato",menuId:"fries",label:"채칼로 감자 썰기",objectLabel:"감자와 채칼",objectKind:"potato",miniGame:"potatoMandoline",dependsOn:["mixTteokbokkiSauce"],prepOrder:124,day4Order:4,isImplemented:true,dayOnly:4},
  shakeFriesStarch:{id:"shakeFriesStarch",menuId:"fries",label:"감자 전분 털기",objectLabel:"감자 바구니",objectKind:"potatoBasket",miniGame:"potatoStarch",dependsOn:["sliceFriesPotato"],prepOrder:125,day4Order:5,isImplemented:true,dayOnly:4}
});

const MENU_DATA=Object.freeze([
  {id:"oden",displayName:"어묵탕",unlockDay:1,requiredPrepTasks:["cutRadish","cutFishCake","cleanAnchovy"],cookware:["pot"],isImplemented:true,icon:4,ingredients:["어묵","무","대파"],prep:["fridge","sink","board","pot"],openFlow:["fridge","pot","counter"],cook:[{station:"pot",game:"heat"}],price:7800},
  {id:"tofu",displayName:"두부김치",unlockDay:1,requiredPrepTasks:["cutTofuKimchi","fryTofuKimchi"],cookware:["pan","fridge"],isImplemented:true,icon:3,ingredients:["두부","김치","돼지고기"],prep:["fridge","sink","board"],openFlow:["fridge","counter"],cook:[{station:"fridge",game:"plateKimchi"}],price:8800},
  {id:"kimchi",displayName:"김치전",unlockDay:2,requiredPrepTasks:["cutPancakeKimchi","mixKimchiBatter"],cookware:["board","mixingBowl","pan"],isImplemented:true,icon:0,ingredients:["김치","밀가루","물"],prep:["board","mixingBowl"],cook:[{station:"pan",game:"twoSideCook"}],price:6200},
  {id:"skewer",displayName:"닭꼬치",unlockDay:2,requiredPrepTasks:["cutSkewerChicken","cutSkewerGreenOnion","assembleChickenSkewer"],cookware:["board","skewerTable","grill"],isImplemented:true,prepYield:SKEWER_BATCH_SIZE,icon:1,ingredients:["닭고기","대파"],prep:["board","skewerTable"],cook:[{station:"grill",game:"twoSideCook"}],price:7200},
  {id:"yakisoba",displayName:"볶음우동",unlockDay:3,requiredPrepTasks:["sliceYakisobaCabbage","sliceYakisobaCarrot","mixYakisobaSauce"],cookware:["griddle"],isImplemented:true,icon:2,ingredients:["우동면","양배추","당근","볶음우동 소스"],prep:["board"],cook:[{station:"griddle",game:"stir"}],price:8200},
  {id:"shrimpTempura",displayName:"새우튀김",unlockDay:3,requiredPrepTasks:["coatShrimpBatter","coatShrimpBreadcrumbs"],cookware:["fryer"],isImplemented:true,icon:null,ingredients:["새우","밀가루","계란물","빵가루"],prep:["board"],cook:[{station:"fryer",game:"fry"}],price:8600},
  {id:"tteokbokki",displayName:"떡볶이",unlockDay:4,requiredPrepTasks:["soakTteok","cutTteokbokkiIngredients","mixTteokbokkiSauce"],cookware:["pot"],isImplemented:true,prepYield:3,icon:null,ingredients:["떡","고추장","어묵"],prep:[],cook:[{station:"pot",game:"heat"}],price:7900},
  {id:"fries",displayName:"감자튀김",unlockDay:4,requiredPrepTasks:["sliceFriesPotato","shakeFriesStarch"],cookware:["fryer"],isImplemented:true,prepYield:3,icon:null,ingredients:["감자","식용유"],prep:[],cook:[{station:"fryer",game:"fry"}],price:6500}
]);

const DAY_DATA=Object.freeze({
  1:{day:1,requiredMenus:["oden","tofu"],optionalMenus:[],minSelectedMenus:2,maxSelectedMenus:2,specialMenu:null,isSpecialDay:false,skipMenuSelect:true},
  2:{day:2,requiredMenus:["kimchi","skewer"],optionalMenus:["oden","tofu"],minSelectedMenus:2,maxSelectedMenus:3,specialMenu:null,isSpecialDay:false},
  3:{day:3,requiredMenus:["yakisoba","shrimpTempura"],optionalMenus:[],minSelectedMenus:2,maxSelectedMenus:2,specialMenu:null,isSpecialDay:false,skipMenuSelect:true},
  4:{day:4,requiredMenus:["tteokbokki","fries"],optionalMenus:["oden","kimchi","tofu","skewer","yakisoba","shrimpTempura"],minSelectedMenus:2,maxSelectedMenus:5,specialMenu:null,isSpecialDay:false},
  5:{day:5,requiredMenus:["kimchi"],optionalMenus:["oden","tofu","skewer","yakisoba","shrimpTempura","tteokbokki","fries"],minSelectedMenus:2,maxSelectedMenus:5,specialMenu:"kimchi",isSpecialDay:true},
  6:{day:6,requiredMenus:[],optionalMenus:["oden","tofu","kimchi","skewer","yakisoba","shrimpTempura","tteokbokki","fries"],minSelectedMenus:2,maxSelectedMenus:5,specialMenu:null,isSpecialDay:false},
  7:{day:7,requiredMenus:["yakisoba"],optionalMenus:["oden","tofu","kimchi","skewer","shrimpTempura","tteokbokki","fries"],minSelectedMenus:2,maxSelectedMenus:5,specialMenu:"yakisoba",isSpecialDay:true}
});

const DayManager={
  minDay:1,
  maxDay:7,
  currentDay:1,
  isSupported(day){return Number.isInteger(Number(day))&&Number(day)>=this.minDay&&Number(day)<=this.maxDay;},
  setDay(day){
    const parsed=Math.floor(Number(day));
    this.currentDay=this.isSupported(parsed)?parsed:Math.min(this.maxDay,Math.max(this.minDay,Number.isFinite(parsed)?parsed:this.minDay));
    return this.currentDay;
  },
  getDayData(day=this.currentDay){return DAY_DATA[this.isSupported(day)?Number(day):this.setDay(day)];},
  nextDay(){return this.setDay(this.currentDay+1);}
};

function menuDataById(id){return MENU_DATA.find(menu=>menu.id===id)||null;}
