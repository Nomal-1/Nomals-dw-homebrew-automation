export const MODULE_ID = "nomals-dw-homebrew-automation";

// dw-automation의 module id. flags.dw-automation.defendReserve처럼 그쪽이
// 관리하는 액터 데이터에 얹어야 하는 경우에만 참조한다(내부 스크립트 파일은
// 절대 import하지 않음 — README/module.json 설계 원칙 참고).
export const DW_AUTOMATION_MODULE_ID = "dw-automation";

// dw-automation과 같은 관례: 여기에 문자열 상수로 설정 키를 모아둔다.
// 실제 자동화가 하나씩 추가되면 그때마다 항목을 늘려간다.
export const SETTINGS = {
  ENABLE_GUILTY_GEAR_ASSISTANT: "enableGuiltyGearAssistant",
  GUILTY_GEAR_MOVE_NAMES: "guiltyGearMoveNames",
  STRIVE_MOVE_NAMES: "striveMoveNames",
  STRIVE_REQUIRED_LEVEL: "striveRequiredLevel",
  GUILTY_GEAR_MELEE_MOVE_NAMES: "guiltyGearMeleeMoveNames",
  GUILTY_GEAR_DEFEND_MOVE_NAMES: "guiltyGearDefendMoveNames",
  GAUGE_GAIN_MELEE_THRESHOLD: "gaugeGainMeleeThreshold",
  DRAGON_INSTALL_HP_PERCENT: "dragonInstallHpPercent"
};
