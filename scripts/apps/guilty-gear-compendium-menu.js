import { MODULE_ID } from "../constants.js";
import { createOrUpdateGuiltyGearCompendium } from "../lib/guilty-gear-compendium.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// 길티기어/스트라이브 액션 컴펜디엄을 만들거나 갱신하는 도구창(실행 버튼만 있음).
// ApplicationV2(12+)로 만들었다 — 옛 FormApplication은 16에서 없어진다.
export class GuiltyGearCompendiumMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "nomals-dw-homebrew-guilty-gear-compendium",
    window: { title: "NOMALS_DW_HOMEBREW.GuiltyGearCompendium.Title" },
    position: { width: 480 },
    actions: {
      "run-create": GuiltyGearCompendiumMenu.#onRunCreate,
      "close-menu": GuiltyGearCompendiumMenu.#onCloseMenu
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/guilty-gear-compendium.html` }
  };

  async _prepareContext() {
    return { hint: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGearCompendium.Hint") };
  }

  static async #onRunCreate(event, button) {
    event.preventDefault();
    button.disabled = true;
    try {
      const { created, skipped } = await createOrUpdateGuiltyGearCompendium();
      ui.notifications.info(game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGearCompendium.Done", { created, skipped }));
    } finally {
      button.disabled = false;
    }
  }

  static #onCloseMenu(event) {
    event.preventDefault();
    this.close();
  }
}
