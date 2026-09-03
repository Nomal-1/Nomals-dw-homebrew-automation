import { registerSettings } from "./settings.js";

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
});

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
});
