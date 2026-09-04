import { MODULE_ID, SETTINGS } from "./constants.js";
import { GuiltyGearCompendiumMenu } from "./apps/guilty-gear-compendium-menu.js";

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

  // 길티기어/스트라이브 액션을 담은 진짜 Foundry 컴펜디엄을 만드는 버튼.
  // 자세한 설계는 lib/guilty-gear-compendium.js 참고 — 자동으로 실행되지
  // 않고, GM이 이 버튼을 눌러야만 만들어지거나(이미 있으면) 빠진 항목만
  // 채워진다.
  game.settings.registerMenu(MODULE_ID, SETTINGS.GUILTY_GEAR_COMPENDIUM_MENU, {
    name: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearCompendiumMenu.Name",
    label: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearCompendiumMenu.Label",
    hint: "NOMALS_DW_HOMEBREW.Settings.GuiltyGearCompendiumMenu.Hint",
    icon: "fas fa-book",
    type: GuiltyGearCompendiumMenu,
    restricted: true
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
