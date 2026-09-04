import { MODULE_ID } from "../constants.js";
import { createOrUpdateGuiltyGearCompendium } from "../lib/guilty-gear-compendium.js";

export class GuiltyGearCompendiumMenu extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "nomals-dw-homebrew-guilty-gear-compendium",
      title: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGearCompendium.Title"),
      template: `modules/${MODULE_ID}/templates/guilty-gear-compendium.html`,
      width: 480,
      closeOnSubmit: false
    });
  }

  getData() {
    return {
      hint: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGearCompendium.Hint")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find('[data-action="run-create"]').on("click", async (event) => {
      event.preventDefault();

      const $button = $(event.currentTarget);
      $button.prop("disabled", true);
      try {
        const { created, skipped } = await createOrUpdateGuiltyGearCompendium();
        ui.notifications.info(game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGearCompendium.Done", { created, skipped }));
      } finally {
        $button.prop("disabled", false);
      }
    });

    html.find('[data-action="close-menu"]').on("click", (event) => {
      event.preventDefault();
      this.close();
    });
  }

  // 저장 폼이 아니라 실행 버튼만 있는 도구창이라 별도 처리가 없다.
  async _updateObject() {}
}
