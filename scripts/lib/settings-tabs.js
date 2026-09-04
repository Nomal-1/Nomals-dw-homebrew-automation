import { MODULE_ID } from "../constants.js";
import { CATEGORY_ORDER, CATEGORY_LABELS, SETTING_CATEGORIES } from "../data/settings-categories.js";

// dw-automation의 lib/settings-tabs.js와 완전히 같은 패턴 — 이 모듈의
// 설정만(이름/키가 "nomals-dw-homebrew-automation."로 시작하는 행만) 순수
// 화면단에서 카테고리 탭으로 재배치한다. 설정 키/저장 값/등록 순서는 전혀
// 건드리지 않으므로, 이 파일을 통째로 지워도 설정 자체는 원래대로 한 줄
// 목록으로 정상 작동한다. dw-automation도 같은 renderSettingsConfig 훅을
// 독립적으로 구독하지만, 서로 접두사가 다른 행만 골라서 건드리므로 충돌
// 없이 공존한다.
function findSettingKey(el, prefix) {
  const raw = el.getAttribute("name") || el.getAttribute("data-key") || "";
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : null;
}

function onRenderSettingsConfig(app, html) {
  const $html = html instanceof jQuery ? html : $(html);
  const prefix = `${MODULE_ID}.`;

  const $marked = $html.find(`[name^="${prefix}"], [data-key^="${prefix}"]`);
  if ($marked.length === 0) return;

  const rowCategories = new Map();
  $marked.each((_, el) => {
    const $row = $(el).closest(".form-group");
    if ($row.length === 0 || rowCategories.has($row[0])) return;

    const key = findSettingKey(el, prefix);
    rowCategories.set($row[0], key ? (SETTING_CATEGORIES[key] ?? null) : null);
  });

  if (rowCategories.size === 0) return;

  const firstRow = rowCategories.keys().next().value;
  const $marker = $('<div class="dwauto-guilty-gear-settings-tabs-anchor"></div>');
  $(firstRow).before($marker);

  const UNCATEGORIZED = "_uncategorized";
  const containers = {};
  for (const category of [...CATEGORY_ORDER, UNCATEGORIZED]) {
    containers[category] = $(`<div class="dwauto-guilty-gear-settings-category"></div>`);
  }

  for (const [rowEl, category] of rowCategories) {
    const target = containers[category] ?? containers[UNCATEGORIZED];
    target.append(rowEl);
  }

  const activeCategories = [...CATEGORY_ORDER, UNCATEGORIZED].filter((c) => containers[c].children().length > 0);
  if (activeCategories.length === 0) {
    $marker.remove();
    return;
  }

  const $nav = $('<nav class="dwauto-guilty-gear-settings-tabs"></nav>');
  const $body = $('<div class="dwauto-guilty-gear-settings-tab-body"></div>');

  activeCategories.forEach((category, index) => {
    const label =
      category === UNCATEGORIZED
        ? game.i18n.localize("NOMALS_DW_HOMEBREW.SettingsTabs.Other")
        : game.i18n.localize(CATEGORY_LABELS[category]);
    const isActive = index === 0;

    const $tab = $(`<a class="dwauto-guilty-gear-settings-tab${isActive ? " active" : ""}" data-category="${category}">${label}</a>`);
    $nav.append($tab);

    const $container = containers[category];
    if (!isActive) $container.hide();
    $body.append($container);
  });

  $nav.on("click", ".dwauto-guilty-gear-settings-tab", (event) => {
    event.preventDefault();
    const category = event.currentTarget.dataset.category;

    $nav.find(".dwauto-guilty-gear-settings-tab").removeClass("active");
    $(event.currentTarget).addClass("active");

    for (const cat of activeCategories) {
      containers[cat].toggle(cat === category);
    }
  });

  $marker.replaceWith($nav);
  $nav.after($body);
}

export function registerSettingsTabs() {
  Hooks.on("renderSettingsConfig", onRenderSettingsConfig);
}
