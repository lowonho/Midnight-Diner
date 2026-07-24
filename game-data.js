"use strict";

// 날짜/메뉴 확장의 기준 데이터입니다. 새 메뉴와 날짜 규칙은 이 파일에 등록합니다.
const GAME_PHASES=Object.freeze({
  MENU_SELECT:"menuSelect",
  PREP:"day",
  OPEN:"night",
  RESULT:"result"
});

const PREP_TASKS=Object.freeze({
  cutRadish:{id:"cutRadish",menuId:"oden",label:"무 썰기",objectLabel:"무 바구니",objectKind:"radish",isImplemented:true},
  cutFishCake:{id:"cutFishCake",menuId:"oden",label:"어묵 썰기",objectLabel:"어묵 바구니",objectKind:"fishCake",isImplemented:true},
  cleanAnchovy:{id:"cleanAnchovy",menuId:"oden",label:"멸치 손질",objectLabel:"멸치 바구니",objectKind:"anchovy",isImplemented:true},
  prepareKimchi:{id:"prepareKimchi",menuId:"tofu",label:"김치 준비하기",objectLabel:"김치통",objectKind:"kimchi",isImplemented:true},
  prepareKimchiPancake:{id:"prepareKimchiPancake",menuId:"kimchi",label:"김치전 재료 준비 (미구현)",isImplemented:false},
  prepareSkewer:{id:"prepareSkewer",menuId:"skewer",label:"닭꼬치 재료 준비 (미구현)",isImplemented:false},
  prepareYakisoba:{id:"prepareYakisoba",menuId:"yakisoba",label:"볶음우동 재료 준비 (미구현)",isImplemented:false},
  prepareShrimpTempura:{id:"prepareShrimpTempura",menuId:"shrimpTempura",label:"새우튀김 재료 준비 (미구현)",isImplemented:false},
  prepareTteokbokki:{id:"prepareTteokbokki",menuId:"tteokbokki",label:"떡볶이 재료 준비 (미구현)",isImplemented:false},
  prepareFries:{id:"prepareFries",menuId:"fries",label:"감자튀김 재료 준비 (미구현)",isImplemented:false}
});

const MENU_DATA=Object.freeze([
  {id:"oden",displayName:"어묵탕",unlockDay:1,requiredPrepTasks:["cutRadish","cutFishCake","cleanAnchovy"],cookware:["pot"],isImplemented:true,icon:4,ingredients:["어묵","무","대파"],prep:["fridge","sink","board","pot"],openFlow:["fridge","pot","counter"],cook:[{station:"pot",game:"heat"}],price:7800},
  {id:"tofu",displayName:"두부김치",unlockDay:1,requiredPrepTasks:["prepareKimchi"],cookware:["fridge","board"],isImplemented:true,icon:3,ingredients:["두부","김치","돼지고기"],prep:["fridge","sink","board"],openFlow:["fridge","board","counter"],cook:[{station:"fridge",game:"plateKimchi"},{station:"board",game:"chop"}],price:8800},
  {id:"kimchi",displayName:"김치전",unlockDay:2,requiredPrepTasks:["prepareKimchiPancake"],cookware:["pan"],isImplemented:false,icon:0,ingredients:["김치","부침가루","대파"],prep:["fridge","sink","board"],cook:[{station:"pan",game:"flip"}],price:6200},
  {id:"skewer",displayName:"닭꼬치",unlockDay:2,requiredPrepTasks:["prepareSkewer"],cookware:["grill"],isImplemented:false,icon:1,ingredients:["닭고기","대파","파프리카"],prep:["fridge","sink","board"],cook:[{station:"grill",game:"grill"}],price:7200},
  {id:"yakisoba",displayName:"볶음우동",unlockDay:3,requiredPrepTasks:["prepareYakisoba"],cookware:["pan"],isImplemented:false,icon:2,ingredients:["우동면","양배추","당근"],prep:["fridge","sink","board"],cook:[{station:"pan",game:"stir"}],price:8200},
  {id:"shrimpTempura",displayName:"새우튀김",unlockDay:3,requiredPrepTasks:["prepareShrimpTempura"],cookware:["fryer"],isImplemented:false,icon:null,ingredients:["새우","튀김가루"],prep:[],cook:[],price:0},
  {id:"tteokbokki",displayName:"떡볶이",unlockDay:4,requiredPrepTasks:["prepareTteokbokki"],cookware:["pot"],isImplemented:false,icon:null,ingredients:["떡","고추장","어묵"],prep:[],cook:[],price:0},
  {id:"fries",displayName:"감자튀김",unlockDay:4,requiredPrepTasks:["prepareFries"],cookware:["fryer"],isImplemented:false,icon:null,ingredients:["감자","식용유"],prep:[],cook:[],price:0}
]);

const DAY_DATA=Object.freeze({
  1:{day:1,requiredMenus:["oden","tofu"],optionalMenus:[],minSelectedMenus:2,maxSelectedMenus:2,specialMenu:null,isSpecialDay:false,skipMenuSelect:true},
  2:{day:2,requiredMenus:["kimchi","skewer"],optionalMenus:["oden","tofu"],minSelectedMenus:2,maxSelectedMenus:3,specialMenu:null,isSpecialDay:false},
  3:{day:3,requiredMenus:["yakisoba","shrimpTempura"],optionalMenus:["oden","kimchi","tofu","skewer"],minSelectedMenus:2,maxSelectedMenus:4,specialMenu:null,isSpecialDay:false},
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
