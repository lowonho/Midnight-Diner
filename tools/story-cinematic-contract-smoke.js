"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const cinematicSource = fs.readFileSync(path.join(root, "story-cinematic.js"), "utf8");
const chefTableSource = fs.readFileSync(path.join(root, "chef-anim-table.js"), "utf8");
const storySource = fs.readFileSync(path.join(root, "story.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(chefTableSource.includes('key:"walk_carry"'),
  "김다은의 상자 운반용 걷기 시트가 플레이어 애니메이션 표에 있어야 합니다.");
assert(fs.existsSync(path.join(root, "assets", "character", "sprites", "char_chef_walk_carry.webp")),
  "프롤로그가 사용할 김다은 걷기 에셋이 있어야 합니다.");
assert(/function resetStoryStage\(\)\s*\{\s*clearStoryCinematic\(\)/.test(storySource),
  "실제 스토리 장면 전환에서 프롤로그 연출을 정리해야 합니다.");

const overlayClasses = new Set(["story-cinematic-active"]);
const context = {
  console,
  document: {
    getElementById(id) {
      if (id !== "storyOverlay") return null;
      return {
        classList: {
          add(name) { overlayClasses.add(name); },
          remove(name) { overlayClasses.delete(name); }
        }
      };
    }
  }
};

const tests = `
const assertRuntime=(condition,message)=>{if(!condition)throw new Error(message);};

assertRuntime(STORY_CINEMATIC_WALK_TEXTURE==="chef_walk_carry",
  "프롤로그는 기존 임시 chef 시트가 아니라 김다은 carry 텍스처를 사용해야 합니다.");
assertRuntime(STORY_CINEMATIC_WALK_ANIM==="chef_walk_carry_side",
  "프롤로그는 김다은의 측면 걷기 애니메이션을 사용해야 합니다.");

let moveStops=0;
let rainStops=0;
let destroys=0;
const currentRuntime={
  moveTween:{stop(){moveStops++;}},
  rainTween:{stop(){rainStops++;}},
  root:{destroy(includeChildren){if(includeChildren)destroys++;}}
};
storyCinematicRuntime=currentRuntime;

assertRuntime(applyStoryCinematic({kind:"caption",speakerLabel:"김다은(속말)"})===true,
  "새 beat가 없는 속말에서도 현재 프롤로그 연출을 유지해야 합니다.");
assertRuntime(storyCinematicRuntime===currentRuntime,
  "같은 장면의 일반 대사가 프롤로그 연출 런타임을 제거하면 안 됩니다.");
assertRuntime(moveStops===0&&rainStops===0&&destroys===0,
  "같은 장면의 일반 대사가 이동·비·배경 연출을 중지하면 안 됩니다.");

clearStoryCinematic();
assertRuntime(storyCinematicRuntime===null,
  "실제 장면 전환에서 연출 런타임을 정리할 수 있어야 합니다.");
assertRuntime(moveStops===1&&rainStops===1&&destroys===1,
  "장면 전환 정리는 tween과 컨테이너를 한 번씩 제거해야 합니다.");
`;

vm.runInNewContext(`${cinematicSource}\n${tests}`, context, {
  filename: "story-cinematic-contract-smoke.vm.js"
});

assert(!overlayClasses.has("story-cinematic-active"),
  "장면 전환 뒤에는 시네마틱 표시 클래스가 제거되어야 합니다.");

console.log("story cinematic contract smoke passed");
