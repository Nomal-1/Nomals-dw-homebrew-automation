import { registerSettings } from "./settings.js";
import { registerGuiltyGearCore } from "./features/guilty-gear-core.js";
import { registerGuiltyGearAttacks, registerGuiltyGearRollGate } from "./features/guilty-gear-attacks.js";
import { registerParalysisStatusEffect, registerParalysisTokenMagicSync } from "./lib/status-effects.js";
import { registerPendingDamageBonusConsumer } from "./lib/pending-damage-bonus.js";
import { registerSettingsTabs } from "./lib/settings-tabs.js";

Hooks.once("init", () => {
  registerSettings();
  registerParalysisStatusEffect();
  registerSettingsTabs();
});

// dw-automation이 활성화돼 있는지는 여기서 안내만 하고(사용자에게 켜져
// 있어야 한다고 알려주는 용도), 실제 API 접근은 lib/dw-api.js가 호출
// 시점마다 라이브로 game.modules.get("dw-automation").api를 조회한다 —
// 캐시해뒀다가 순서 문제로 영영 못 찾는 일이 없도록(자세한 이유는
// lib/dw-api.js 상단 주석 참고).
Hooks.once("ready", () => {
  const dwAutomation = game.modules.get("dw-automation");
  if (!dwAutomation?.active) {
    ui.notifications.error(
      game.i18n.localize("NOMALS_DW_HOMEBREW.MissingDependencyWarning")
    );
  } else if (!dwAutomation.api) {
    console.warn(
      "nomals-dw-homebrew-automation | dw-automation is active but hasn't exposed its API yet (버전이 API 노출 이전 버전일 수 있습니다)."
    );
  }

  // game.dungeonworld.ItemDw(및 다른 시스템/모듈이 등록해두는 전역들)가 전부
  // 준비된 뒤에 감싸야 안전하므로 ready에서 등록한다. dw-automation의 API
  // 노출 여부와는 무관한 별개 전역(game.dungeonworld, libWrapper)만 필요하므로
  // 위 분기와 상관없이 항상 등록한다.
  registerGuiltyGearRollGate();
});

// dw-automation의 main.js와 같은 관례: game.dungeonworld가 꼭 필요한 것만
// ready에서 등록하고, 나머지(훅 리스너 등록 자체)는 파일 하단에 flat하게
// 나열한다 — 실제 콜백 실행은 어차피 ready 이후 실제 플레이 중에나
// 일어나므로 등록 자체를 미룰 이유가 없다.
registerGuiltyGearCore();
registerGuiltyGearAttacks();
registerPendingDamageBonusConsumer();
registerParalysisTokenMagicSync();
