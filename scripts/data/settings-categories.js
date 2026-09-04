import { SETTINGS } from "../constants.js";

// 설정 창 상단 탭(lib/settings-tabs.js)이 각 설정/메뉴 행을 어느 탭에 넣을지
// 결정하는 표. 순수 표시 전용이라 여기 없는 키는 그냥 탭 없이(첫 번째 탭
// 자리에, 원래 순서 그대로) 보인다 — 자동화 동작에는 전혀 영향이 없다.
// dw-automation의 data/settings-categories.js와 같은 관례 — 새 커스텀
// 액션을 추가할 때마다 이 표에 카테고리 하나씩(또는 기존 카테고리에)
// 추가해서 설정 화면이 계속 한눈에 들어오게 유지한다.
export const CATEGORY_ORDER = ["general", "guiltyGear", "strive"];

export const CATEGORY_LABELS = {
  general: "NOMALS_DW_HOMEBREW.SettingsTabs.General",
  guiltyGear: "NOMALS_DW_HOMEBREW.SettingsTabs.GuiltyGear",
  strive: "NOMALS_DW_HOMEBREW.SettingsTabs.Strive"
};

// registerMenu의 두 번째 인자는 SETTINGS 상수를 그대로 쓰므로(settings.js
// 참고) 여기서도 SETTINGS.GUILTY_GEAR_COMPENDIUM_MENU를 그대로 키로 쓴다.
export const SETTING_CATEGORIES = {
  [SETTINGS.ENABLE_GUILTY_GEAR_ASSISTANT]: "general",
  [SETTINGS.GUILTY_GEAR_COMPENDIUM_MENU]: "general",

  [SETTINGS.GUILTY_GEAR_MOVE_NAMES]: "guiltyGear",
  [SETTINGS.GUILTY_GEAR_MELEE_MOVE_NAMES]: "guiltyGear",
  [SETTINGS.GUILTY_GEAR_DEFEND_MOVE_NAMES]: "guiltyGear",
  [SETTINGS.GAUGE_GAIN_MELEE_THRESHOLD]: "guiltyGear",

  [SETTINGS.STRIVE_MOVE_NAMES]: "strive",
  [SETTINGS.STRIVE_REQUIRED_LEVEL]: "strive",
  [SETTINGS.DRAGON_INSTALL_HP_PERCENT]: "strive"
};
