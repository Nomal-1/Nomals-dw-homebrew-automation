import { registerSettings } from "./settings.js";
import { registerGuiltyGearCore } from "./features/guilty-gear-core.js";
import { registerGuiltyGearAttacks, registerGuiltyGearRollGate } from "./features/guilty-gear-attacks.js";
import { registerGuiltyGearDefense } from "./features/guilty-gear-defense.js";
import { registerParalysisStatusEffect } from "./lib/status-effects.js";

// dw-automation이 ready 훅에서 게임.modules.get("dw-automation").api에 공용
// 유틸(무브 카드 파싱, 선택지 다이얼로그, 채팅 알림 등)을 노출해준다. 이
// 모듈의 features 파일들은 dw-automation의 scripts/lib/*.js를 직접 import하지
// 않고 이 API를 통해서만 접근한다(ARCHITECTURE.md 9번 항목 참고) — 내부 파일
// 구조가 바뀌어도 이 모듈이 조용히 깨지지 않게 하기 위함이다.
let dwAutomationApi = null;

export function getDwAutomationApi() {
  return dwAutomationApi;
}

Hooks.once("init", () => {
  registerSettings();
  registerParalysisStatusEffect();
});

// game.dungeonworld.ItemDw(및 다른 시스템/모듈이 등록해두는 전역들)가 전부
// 준비된 뒤에 감싸야 안전하므로, libWrapper로 판정 자체를 가로채는 등록은
// dw-automation과 같은 이유로 ready에서 한다(features/guilty-gear-attacks.js의
// registerGuiltyGearRollGate 참고).
Hooks.once("ready", () => {
  const dwAutomation = game.modules.get("dw-automation");
  if (!dwAutomation?.active) {
    ui.notifications.error(
      game.i18n.localize("NOMALS_DW_HOMEBREW.MissingDependencyWarning")
    );
    return;
  }
  if (!dwAutomation.api) {
    console.warn(
      "nomals-dw-homebrew-automation | dw-automation is active but hasn't exposed its API yet (버전이 API 노출 이전 버전일 수 있습니다)."
    );
    return;
  }
  dwAutomationApi = dwAutomation.api;

  registerGuiltyGearRollGate();
});

// dw-automation의 main.js와 같은 관례: game.dungeonworld가 꼭 필요한 것만
// ready에서 등록하고, 나머지(훅 리스너 등록 자체)는 파일 하단에 flat하게
// 나열한다 — 실제 콜백 실행은 어차피 ready 이후 실제 플레이 중에나
// 일어나므로 등록 자체를 미룰 이유가 없다.
registerGuiltyGearCore();
registerGuiltyGearAttacks();
registerGuiltyGearDefense();
