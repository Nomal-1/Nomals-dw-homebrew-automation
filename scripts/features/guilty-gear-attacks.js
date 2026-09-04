// 스턴엣지/세이크리드 엣지를 기존 "사격"(Volley) 무브에 얹지 않고 완전히
// 별개의 아이템으로 만든 이유: 둘 다 같은 createChatMessage 이벤트를 보는
// dw-automation의 공격 자동화(attack-assistant.js)가 "사격"으로 등록된
// 이름을 보면 독립적으로 "정말 무기로 데미지를 굴리시겠습니까?" 확인창을
// 띄우는데, 이 모듈에서 그 훅 콜백 자체를 막을 방법이 없다(둘 다 별개
// 모듈이 각자 Hooks.on으로 구독). 별도 아이템으로 분리하면 dw-automation의
// 사격/근접 무브 이름 설정에 애초에 안 걸려서 그 확인창이 뜨지 않는다.
// 판정 UI(2d6+민첩)와 성공/부분성공/실패 카드 구조는 "사격"과 완전히
// 동일하다 — 시스템 자체의 무브 굴림 경로를 그대로 타기 때문.
import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, announceActionApplied, promptActorTarget } from "../lib/dw-api.js";
import { applyParalysis } from "../lib/status-effects.js";
import { promptFaultlessDefenseBonus } from "./guilty-gear-defense.js";
import {
  isGuiltyGearEnabled,
  splitCommaList,
  hasGuiltyGear,
  getGauge,
  trySpendGauge,
  getBaseTechniqueCost,
  getEnhancedTechniqueCost
} from "../lib/guilty-gear-state.js";
import {
  STUN_EDGE_MOVE_NAME,
  SACRED_EDGE_MOVE_NAME,
  DIRE_ECLAIR_MOVE_NAME,
  RIDE_THE_LIGHTNING_MOVE_NAME
} from "../data/guilty-gear-items.js";

const BASE_GAUGE_COST = 3;

// 대상 토큰을 실제로 타겟팅해둔다 — 던전월드 시스템의 데미지 적용 버튼
// (전체/절반/두배)이 game.user.targets를 보고 동작하므로, 이 버튼이 바로
// 먹히게 하려면 우리가 고른 대상을 미리 타겟팅해줘야 한다.
function focusTarget(targetActor) {
  const token = targetActor.getActiveTokens()[0];
  if (token) token.setTarget(true, { releaseOthers: true });
}

// 세이크리드 엣지/라이드 더 라이트닝의 "마비 성공 시 +1d8" 보너스 피해.
// 무기 데미지가 아니라 그냥 고정 주사위라 attack-assistant.js의 rollDamage처럼
// 태그/무기 선택 없이 단순하게 굴리고, 같은 전체/절반/두배/치유 버튼을
// 그대로 붙여서 시스템의 기존 데미지 적용 흐름을 그대로 탄다.
async function rollBonusDamage(actor, moveName, target) {
  const roll = new Roll("1d8", actor.getRollData());
  await roll.evaluate();

  focusTarget(target);

  const rollHtml = await roll.render();
  const content = `
    <h3>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.BonusDamageFlavor", { move: moveName })}</h3>
    ${rollHtml}
    <div class="chat-damage-buttons">
      <button type="button" class="button damage full-damage" data-action="damage" title="${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.ApplyFullTitle")}"><i class="fas fa-user-minus"></i></button>
      <button type="button" class="button damage half-damage" data-action="half-damage" title="${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.ApplyHalfTitle")}"><i class="fas fa-user-minus"></i> 1/2</button>
      <button type="button" class="button damage double-damage" data-action="double-damage" title="${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.ApplyDoubleTitle")}"><i class="fas fa-user-minus"></i> 2X</button>
    </div>
  `;

  const chatData = { user: game.user.id, speaker: ChatMessage.getSpeaker({ actor }), content };
  if (game.dice3d) {
    await game.dice3d.showForRoll(roll, game.user, true, null, false);
  } else {
    chatData.sound = CONFIG.sounds.dice;
  }
  await ChatMessage.create(chatData);
}

async function applyParalysisWithTarget(actor, moveName, { rollBonus = false } = {}) {
  const target = await promptActorTarget(actor, {
    title: moveName,
    label: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.ParalysisTargetLabel"),
    excludeSelf: false
  });
  if (!target) return;

  await applyParalysis(target);
  announceActionApplied(actor, moveName, game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.ParalysisApplied", { target: target.name }));

  if (rollBonus) {
    await rollBonusDamage(actor, moveName, target);
  }
}

// ---- 판정 직전 개입 전부를 여기 한 wrappedRoll에 모은다. libWrapper는
// 같은 모듈이 같은 대상(game.dungeonworld.ItemDw.prototype.roll)을 두 번
// wrap하면 에러를 던지므로(dw-automation의 lib/roll-wrapper.js가 실제로
// 겪고 기록해둔 버그), 이 모듈에서 이 대상을 wrap하는 자리는 반드시 여기
// 하나뿐이어야 한다 — 폴트리스 디펜스(features/guilty-gear-defense.js)도
// 별도로 wrap하지 않고 이 함수 안에서 호출된다. ----
async function wrappedRoll(wrapped, ...args) {
  if (!this.actor || this.type !== "move") return wrapped(...args);
  if (game.system.id !== "dungeonworld" || !isGuiltyGearEnabled()) return wrapped(...args);

  const actor = this.actor;

  // 스턴엣지/세이크리드 엣지: 게이지 소비 게이트. 판정 자체는 시스템의
  // 원래 경로를 그대로 태우고, 굴리기 전에 게이지가 부족하면 아예 판정을
  // 취소한다(dw-automation의 roll-bypass 패턴과 같은 방식).
  const isStunEdge = this.name === STUN_EDGE_MOVE_NAME;
  const isSacredEdge = this.name === SACRED_EDGE_MOVE_NAME;
  if (isStunEdge || isSacredEdge) {
    const cost = isStunEdge ? getBaseTechniqueCost(actor, BASE_GAUGE_COST) : getEnhancedTechniqueCost(actor, BASE_GAUGE_COST);

    if (cost > 0 && getGauge(actor) < cost) {
      ui.notifications.warn(game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeInsufficient", { name: actor.name, cost }));
      return undefined;
    }

    if (cost > 0) await trySpendGauge(actor, cost);
    return wrapped(...args);
  }

  // 폴트리스 디펜스: "방어" 판정이면 게이지를 소비한 만큼 이번 판정에
  // rollMod로 그대로 더한다(dw-automation 자신의 wrappedRoll도 같은 방식
  // — this.system.rollMod를 굴리기 직전에 임시로 올렸다가 끝나면
  // 되돌린다 — 여러 모듈이 같은 대상을 wrap해도 이 패턴은 서로 누적되지
  // 서로 덮어쓰지 않는다).
  const bonus = await promptFaultlessDefenseBonus(this, actor);
  if (bonus > 0) {
    const original = this.system.rollMod;
    this.system.rollMod = (Number(original) || 0) + bonus;
    try {
      return await wrapped(...args);
    } finally {
      this.system.rollMod = original;
    }
  }

  return wrapped(...args);
}

export function registerGuiltyGearRollGate() {
  libWrapper.register(MODULE_ID, "game.dungeonworld.ItemDw.prototype.roll", wrappedRoll, "MIXED");
}

// ---- 판정 결과 반응: 스턴엣지/세이크리드 엣지가 명중하면(성공/부분성공)
// 대상을 골라 마비를 건다. 세이크리드 엣지는 추가로 +1d8을 굴린다. ----
function onCreateChatMessageRangedResult(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result } = info;
  if (actor.type !== "character") return;
  if (result !== "success" && result !== "partial") return;

  if (title === STUN_EDGE_MOVE_NAME) {
    applyParalysisWithTarget(actor, title, { rollBonus: false });
  } else if (title === SACRED_EDGE_MOVE_NAME) {
    applyParalysisWithTarget(actor, title, { rollBonus: true });
  }
}

// ---- 다이어 에클라/라이드 더 라이트닝: 접근전 액션이 실패하지 않았을 때
// (성공/부분성공) 사용할지 물어본다. 라이드 더 라이트닝(강화판)을 배웠으면
// 그쪽을 우선한다 — 같은 발동 조건에 순수 상위호환이라 굳이 기본판을
// 따로 물어볼 이유가 없다. ----
function onCreateChatMessageMeleeFollowUp(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result } = info;
  if (actor.type !== "character") return;
  if (result !== "success" && result !== "partial") return;
  if (!hasGuiltyGear(actor)) return;

  const meleeNames = splitCommaList(SETTINGS.GUILTY_GEAR_MELEE_MOVE_NAMES);
  if (!meleeNames.includes(title)) return;

  const hasRideTheLightning = actor.items.some((i) => i.type === "move" && i.name === RIDE_THE_LIGHTNING_MOVE_NAME);
  const hasDireEclair = actor.items.some((i) => i.type === "move" && i.name === DIRE_ECLAIR_MOVE_NAME);
  if (!hasRideTheLightning && !hasDireEclair) return;

  const moveName = hasRideTheLightning ? RIDE_THE_LIGHTNING_MOVE_NAME : DIRE_ECLAIR_MOVE_NAME;
  const cost = hasRideTheLightning ? getEnhancedTechniqueCost(actor, BASE_GAUGE_COST) : getBaseTechniqueCost(actor, BASE_GAUGE_COST);
  if (cost > 0 && getGauge(actor) < cost) return; // 못 쓰는 선택지는 아예 물어보지 않는다.

  (async () => {
    const confirmed = await Dialog.confirm({
      title: moveName,
      content: `<p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.MeleeFollowUpPrompt", { move: moveName, cost })}</p>`,
      defaultYes: false
    });
    if (!confirmed) return;

    if (cost > 0) await trySpendGauge(actor, cost);
    await applyParalysisWithTarget(actor, moveName, { rollBonus: hasRideTheLightning });
  })();
}

export function registerGuiltyGearAttacks() {
  Hooks.on("createChatMessage", onCreateChatMessageRangedResult);
  Hooks.on("createChatMessage", onCreateChatMessageMeleeFollowUp);
}
