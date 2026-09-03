import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, announceActionApplied, getOrCreateTagsContainer } from "../lib/dw-api.js";
import {
  isGuiltyGearEnabled,
  splitCommaList,
  hasGuiltyGear,
  hasStrive,
  getActorLevel,
  getGauge,
  getGaugeMax,
  setGauge,
  addGauge,
  ensureGaugeInitialized,
  isDragonInstallActive,
  setDragonInstallActive
} from "../lib/guilty-gear-state.js";
import {
  GUILTY_GEAR_MOVE_NAME,
  STRIVE_MOVE_NAME,
  GUILTY_GEAR_ITEM,
  STRIVE_ITEM,
  GUILTY_GEAR_UNLOCK_ITEMS,
  STRIVE_UNLOCK_ITEMS,
  DRAGON_INSTALL_MOVE_NAME
} from "../data/guilty-gear-items.js";

// 길티기어를 배우면 게이지를 초기화하고 스턴엣지/다이어 에클라/폴트리스
// 디펜스 세 기술을 한 번에 심는다. 스트라이브도 같은 방식(요구 조건은
// requiresLevel/requiresMove 필드에 이미 적어뒀지만, 실제 게이팅은 레벨업
// 창 주입 쪽에서 하고 여기서는 "이미 심어져 있으면 다시 안 심는다"만
// 확인한다 — GM이 아이템을 직접 드래그해서 줘도 정상 동작하게 하기 위함).
async function grantUnlockSet(actor, items) {
  const toCreate = items.filter((item) => !actor.items.some((i) => i.type === "move" && i.name === item.name));
  if (toCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", toCreate);
  }
  return toCreate.map((i) => i.name);
}

async function onCreateItem(item, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (item.type !== "move") return;
  if (userId !== game.user.id) return;

  const actor = item.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "character") return;

  const guiltyGearNames = splitCommaList(SETTINGS.GUILTY_GEAR_MOVE_NAMES);
  const striveNames = splitCommaList(SETTINGS.STRIVE_MOVE_NAMES);

  if (guiltyGearNames.includes(item.name)) {
    await ensureGaugeInitialized(actor);
    const granted = await grantUnlockSet(actor, GUILTY_GEAR_UNLOCK_ITEMS);
    if (granted.length > 0) {
      announceActionApplied(actor, item.name, game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.Unlocked", { moves: granted.join(", ") }));
    }
    return;
  }

  if (striveNames.includes(item.name)) {
    const granted = await grantUnlockSet(actor, STRIVE_UNLOCK_ITEMS);
    if (granted.length > 0) {
      announceActionApplied(actor, item.name, game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.Unlocked", { moves: granted.join(", ") }));
    }
  }
}

// 접근전 판정 결과 7 이상 → 게이지 +1. "접근전"으로 칠 무브 이름은 GM이
// 직접 관리하는 목록(GUILTY_GEAR_MELEE_MOVE_NAMES)으로 판정한다 — 번역된
// 자유 텍스트로 분기하지 않는다는 원칙(ARCHITECTURE.md 2번) 그대로.
function onCreateChatMessageGaugeGain(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, rollTotal } = info;
  if (actor.type !== "character") return;
  if (!hasGuiltyGear(actor)) return;

  const meleeNames = splitCommaList(SETTINGS.GUILTY_GEAR_MELEE_MOVE_NAMES);
  if (!meleeNames.includes(title)) return;

  const threshold = Number(game.settings.get(MODULE_ID, SETTINGS.GAUGE_GAIN_MELEE_THRESHOLD)) || 7;
  if (!Number.isFinite(rollTotal) || rollTotal < threshold) return;
  if (getGauge(actor) >= getGaugeMax(actor)) return;

  addGauge(actor, 1).then((next) => {
    announceActionApplied(actor, GUILTY_GEAR_MOVE_NAME, game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeGained", { gauge: next }));
  });
}

// HP 변화 관찰용 스냅샷. preUpdateActor(취소될 수도 있는 "제안된" 갱신)가
// 아니라 updateActor(실제로 반영이 끝난 뒤)에서 판단해야, 하트리거의 무효화
// 선택으로 결국 피해를 하나도 안 받은 경우까지 게이지를 잘못 주는 일이
// 없다(하트리거는 preUpdateActor에서 원래 갱신을 취소했다가 나중에 다시
// 반영하므로, 실제로 persist된 순간만 봐야 한다).
const pendingHpSnapshot = new Map();

function onPreUpdateActorSnapshot(actor, changes) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (actor.type !== "character") return;

  const flat = foundry.utils.flattenObject(changes);
  if (!("system.attributes.hp.value" in flat)) return;
  if (pendingHpSnapshot.has(actor.id)) return; // 이미 같은 트랜잭션에서 기록해둠

  pendingHpSnapshot.set(actor.id, Number(actor.system.attributes?.hp?.value ?? 0));
}

function onUpdateActorGaugeAndDragonInstall(actor, changes, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (actor.type !== "character") return;
  if (userId !== game.user.id) return;

  const flat = foundry.utils.flattenObject(changes);
  const newHp = flat["system.attributes.hp.value"];
  if (newHp === undefined) return;

  const oldHp = pendingHpSnapshot.get(actor.id);
  pendingHpSnapshot.delete(actor.id);

  if (hasGuiltyGear(actor) && oldHp !== undefined) {
    const damage = oldHp - Number(newHp);
    if (damage > 0 && getGauge(actor) < getGaugeMax(actor)) {
      addGauge(actor, 1).then((next) => {
        announceActionApplied(actor, GUILTY_GEAR_MOVE_NAME, game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeGainedFromDamage", { gauge: next }));
      });
    }
  }

  maybeToggleDragonInstall(actor);
}

// 드래곤 인스톨: HP <= 최대치의 30%(반올림) + 게이지 5(가득) → 자동 발동.
// HP가 다시 30%를 넘으면 즉시 해제. 게이지가 5 밑으로 내려가도(폴트리스
// 디펜스로 실제 소비되는 경우 포함) 이미 켜진 드래곤 인스톨은 꺼지지
// 않는다 — 원문상 해제 조건은 HP 회복뿐이다.
async function maybeToggleDragonInstall(actor) {
  if (!hasStrive(actor)) return;

  const hp = Number(actor.system.attributes?.hp?.value ?? 0);
  const maxHp = Number(actor.system.attributes?.hp?.max ?? 0);
  if (maxHp <= 0) return;

  const percent = Number(game.settings.get(MODULE_ID, SETTINGS.DRAGON_INSTALL_HP_PERCENT)) || 30;
  const threshold = Math.round(maxHp * (percent / 100));
  const active = isDragonInstallActive(actor);

  if (!active && hp <= threshold && getGauge(actor) >= getGaugeMax(actor)) {
    await setDragonInstallActive(actor, true);
    announceActionApplied(actor, DRAGON_INSTALL_MOVE_NAME, game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.DragonInstallActivated"));
  } else if (active && hp > threshold) {
    await setDragonInstallActive(actor, false);
    announceActionApplied(actor, DRAGON_INSTALL_MOVE_NAME, game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.DragonInstallDeactivated"));
  }
}

// 게이지가 판정(접근전 7+ 등)이 아니라 아이템 부여 직후 바로 5로 채워지는
// 경우는 없지만, 혹시 GM이 직접 게이지를 5로 맞춘 뒤 HP가 이미 30% 이하인
// 상태였다면 그 즉시 드래곤 인스톨이 켜지도록, 게이지 변경 자체도 감시한다.
function onUpdateActorGaugeChangeCheck(actor, changes, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (actor.type !== "character") return;
  if (userId !== game.user.id) return;

  const flat = foundry.utils.flattenObject(changes);
  if (!("system.attributes.resource1.value" in flat)) return;

  maybeToggleDragonInstall(actor);
}

function promptSetGauge(current, max) {
  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.AdjustGaugeTitle"),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.AdjustGaugeLabel", { max })}</label>
            <input type="number" name="amount" value="${current}" min="0" max="${max}">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("NOMALS_DW_HOMEBREW.Confirm"),
          callback: (html) => resolve(Math.max(0, Math.min(max, Number(html.find('[name="amount"]').val()) || 0)))
        },
        cancel: { label: game.i18n.localize("NOMALS_DW_HOMEBREW.Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });
}

// 길티기어 무브 옆에 "게이지 N/5" 배지를 붙인다(요청하신 "액션명 옆 토글"에
// 해당). 소유자는 클릭해서 원하는 값으로 바로 맞출 수 있다 — 실제 판정에
// 따른 자동 증감(접근전 7+, 피격, 폴트리스 디펜스 소비 등)과 별개로 GM/
// 플레이어가 수동 보정할 창구가 항상 필요하기 때문(dw-automation의 방어
// 예비 배지와 같은 패턴). 드래곤 인스톨 배지는 읽기 전용 표시만 한다 —
// 자동으로만 켜지고 꺼진다.
function onRenderActorSheet(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;

  const actor = app.actor;
  if (actor.type !== "character") return;
  if (!hasGuiltyGear(actor)) return;

  const guiltyGearItem = actor.items.find((i) => i.type === "move" && splitCommaList(SETTINGS.GUILTY_GEAR_MOVE_NAMES).includes(i.name));
  if (guiltyGearItem) {
    const $item = html.find(`.item[data-item-id="${guiltyGearItem.id}"]`);
    if ($item.length) {
      const $tags = getOrCreateTagsContainer($item);
      $tags.find(".dwauto-guilty-gear-gauge-badge").remove();

      const gauge = getGauge(actor);
      const max = getGaugeMax(actor);
      const $badge = $(
        `<a class="tag dwauto-guilty-gear-gauge-badge${gauge > 0 ? " dwauto-guilty-gear-gauge-on" : ""}" title="${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeBadgeTitle")}">${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeLabelValue", { gauge, max })}</a>`
      );
      $tags.append($badge);

      if (actor.isOwner) {
        $badge.on("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const next = await promptSetGauge(gauge, max);
          if (next !== null) await setGauge(actor, next);
        });
      }
    }
  }

  const dragonInstallItem = actor.items.find((i) => i.type === "move" && i.name === DRAGON_INSTALL_MOVE_NAME);
  if (dragonInstallItem) {
    const $item = html.find(`.item[data-item-id="${dragonInstallItem.id}"]`);
    if ($item.length) {
      const $tags = getOrCreateTagsContainer($item);
      $tags.find(".dwauto-dragon-install-badge").remove();

      const active = isDragonInstallActive(actor);
      const $badge = $(
        `<a class="tag dwauto-dragon-install-badge${active ? " dwauto-dragon-install-on" : ""}">${game.i18n.localize(active ? "NOMALS_DW_HOMEBREW.GuiltyGear.DragonInstallOn" : "NOMALS_DW_HOMEBREW.GuiltyGear.DragonInstallOff")}</a>`
      );
      $tags.append($badge);
    }
  }
}

// ---- 레벨업 창 주입 (dw-automation features/level-up-info.js와 같은 패턴) ----
// 던전월드 시스템의 레벨업 대화상자는 클래스 컴펜디엄 무브만 목록에 띄우므로
// 완전 신규 홈브루 액션인 길티기어/스트라이브는 그 목록에 애초에 나올 수
// 없다. 대신 같은 대화상자 안에 별도 섹션을 만들어 "배우기" 버튼을 붙인다.
let lastLevelUpActor = null;

function buildLevelUpSection(actor) {
  const rows = [];

  if (!hasGuiltyGear(actor)) {
    rows.push({ name: GUILTY_GEAR_MOVE_NAME, key: "guiltyGear" });
  } else {
    const striveNames = splitCommaList(SETTINGS.STRIVE_MOVE_NAMES);
    const alreadyHasStrive = actor.items.some((i) => i.type === "move" && striveNames.includes(i.name));
    const requiredLevel = Number(game.settings.get(MODULE_ID, SETTINGS.STRIVE_REQUIRED_LEVEL)) || 6;
    if (!alreadyHasStrive && getActorLevel(actor) >= requiredLevel) {
      rows.push({ name: STRIVE_MOVE_NAME, key: "strive" });
    }
  }

  return rows;
}

async function learnGuiltyGearRow(actor, key) {
  const item = key === "guiltyGear" ? GUILTY_GEAR_ITEM : key === "strive" ? STRIVE_ITEM : null;
  if (!item) return;
  if (actor.items.some((i) => i.type === "move" && i.name === item.name)) return;
  await actor.createEmbeddedDocuments("Item", [item]);
}

function injectLevelUpSection(html, actor) {
  if (!actor) return;
  if (html.find(".dwauto-guilty-gear-levelup").length) return;

  const rows = buildLevelUpSection(actor);
  if (rows.length === 0) return;

  const items = rows
    .map(
      (row) => `
        <li class="dwauto-guilty-gear-levelup-item">
          <div class="selection-content">
            <h3>${row.name}</h3>
            <button type="button" class="dwauto-guilty-gear-learn" data-key="${row.key}">${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.LearnButton")}</button>
          </div>
        </li>
      `
    )
    .join("");

  const $section = $(`
    <section class="cell dwauto-guilty-gear-levelup">
      <h2>${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.LevelUpSectionTitle")}</h2>
      <ul class="items-list">${items}</ul>
    </section>
  `);

  $section.find(".dwauto-guilty-gear-learn").on("click", async (event) => {
    const key = event.currentTarget.dataset.key;
    await learnGuiltyGearRow(actor, key);
    $(event.currentTarget).closest("li").remove();
  });

  const $advancedSection = html.find(".cell--advanced_moves").last();
  if ($advancedSection.length) {
    $advancedSection.after($section);
  } else {
    html.find(".dialog-content").first().append($section);
  }
}

function onRenderDialog(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (!html.find('input[data-type="move"]').length) return;

  injectLevelUpSection(html, lastLevelUpActor);
}

function onRenderActorSheetTrackLevelUp(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;

  html.find(".clickable-level-up").off("click.dwautoGuiltyGearLevelUp").on("click.dwautoGuiltyGearLevelUp", () => {
    lastLevelUpActor = app.actor;
  });
}

export function registerGuiltyGearCore() {
  Hooks.on("createItem", onCreateItem);
  Hooks.on("createChatMessage", onCreateChatMessageGaugeGain);
  Hooks.on("preUpdateActor", onPreUpdateActorSnapshot);
  Hooks.on("updateActor", onUpdateActorGaugeAndDragonInstall);
  Hooks.on("updateActor", onUpdateActorGaugeChangeCheck);
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.on("renderActorSheet", onRenderActorSheetTrackLevelUp);
  Hooks.on("renderDialog", onRenderDialog);
}
