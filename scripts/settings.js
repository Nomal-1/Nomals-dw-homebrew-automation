import { MODULE_ID, SETTINGS } from "./constants.js";

// dw-automation과 같은 관례: 모든 game.settings.register/registerMenu 호출을
// 여기 한 곳에 모은다.
export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.ENABLE_GUILTY_GEAR_ASSISTANT, {
    name: "NOMALS_DW_HOMEBREW.Settings.EnableGuiltyGear.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.EnableGuiltyGear.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.GUILTY_GEAR_MOVE_NAMES, {
    name: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearMoveNames.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "길티기어"
  });

  game.settings.register(MODULE_ID, SETTINGS.STRIVE_MOVE_NAMES, {
    name: "NOMALS_DW_HOMEBREW.Settings.StriveMoveNames.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.StriveMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "스트라이브"
  });

  game.settings.register(MODULE_ID, SETTINGS.STRIVE_REQUIRED_LEVEL, {
    name: "NOMALS_DW_HOMEBREW.Settings.StriveRequiredLevel.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.StriveRequiredLevel.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 6
  });

  // 기본값을 비워둔다 — 접근전으로 칠 무브 이름은 캠페인마다 실제로 쓰는
  // 기본 액션 이름(예: "백병전")이 다를 수 있어서 GM이 직접 채워야 한다.
  game.settings.register(MODULE_ID, SETTINGS.GUILTY_GEAR_MELEE_MOVE_NAMES, {
    name: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearMeleeMoveNames.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearMeleeMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, SETTINGS.GUILTY_GEAR_DEFEND_MOVE_NAMES, {
    name: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearDefendMoveNames.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearDefendMoveNames.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "방어"
  });

  game.settings.register(MODULE_ID, SETTINGS.GAUGE_GAIN_MELEE_THRESHOLD, {
    name: "NOMALS_DW_HOMEBREW.Settings.GaugeGainMeleeThreshold.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.GaugeGainMeleeThreshold.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 7
  });

  game.settings.register(MODULE_ID, SETTINGS.DRAGON_INSTALL_HP_PERCENT, {
    name: "NOMALS_DW_HOMEBREW.Settings.DragonInstallHpPercent.Name",
    hint: "NOMALS_DW_HOMEBREW.Settings.DragonInstallHpPercent.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 30
  });
}
