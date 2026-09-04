// 스턴엣지/세이크리드 엣지를 기존 "사격"(Volley) 무브에 얹지 않고 완전히
// 별개의 아이템으로 만든 이유: 둘 다 같은 createChatMessage 이벤트를 보는
// dw-automation의 공격 자동화(attack-assistant.js)가 "사격"으로 등록된
// 이름을 보면 독립적으로 "정말 무기로 데미지를 굴리시겠습니까?" 확인창을
// 띄우는데, 이 모듈에서 그 훅 콜백 자체를 막을 방법이 없다(둘 다 별개
// 모듈이 각자 Hooks.on으로 구독). 별도 아이템으로 분리하면 dw-automation의
// 사격/근접 무브 이름 설정에 애초에 안 걸려서 그 확인창이 뜨지 않는다.
// 판정 UI(2d6+민첩)와 성공/부분성공/실패 카드 구조는 "사격"과 완전히
// 동일하다 — 시스템 자체의 무브 굴림 경로를 그대로 타기 때문.
//
// 스턴엣지/세이크리드 엣지는 각자 클릭하는 별개 판정이다(캐스케이드 확인
// 없음) — 게이지만 되면 묻지 않고 바로 적용, 세이크리드 엣지의 +1d8은
// 별도 굴림으로 채팅에 뜬다. 반대로 다이어 에클라/라이드 더 라이트닝은
// "접근전 판정에 딸려오는 후속 선택"이라 판정 자체가 없어서, 대신 캐스케이드
// 확인(라이드 더 라이트닝 → 다이어 에클라)으로 어느 걸 쓸지 고르고, 라이드
// 더 라이트닝의 +1d8은 이어서 굴릴 "기본 접근전 데미지"에 수정치로 예약된다.
import { MODULE_ID, SETTINGS } from "../constants.js";
import { getMoveCardInfo, announceActionApplied, promptActorTarget } from "../lib/dw-api.js";
import { applyParalysis } from "../lib/status-effects.js";
import { grantPendingWeaponDamageBonus } from "../lib/pending-damage-bonus.js";
import { promptFaultlessDefenseBonus } from "./guilty-gear-defense.js";
import {
  isGuiltyGearEnabled,
  splitCommaList,
  hasGuiltyGear,
  getGauge,
  trySpendGauge,
  getBaseTechniqueCost,
  getEnhancedTechniqueCost,
  getAskMode,
  DIRE_ECLAIR_ASK_MODE_FLAG
} from "../lib/guilty-gear-state.js";
import {
  STUN_EDGE_MOVE_NAME,
  SACRED_EDGE_MOVE_NAME,
  DIRE_ECLAIR_MOVE_NAME,
  RIDE_THE_LIGHTNING_MOVE_NAME
} from "../data/guilty-gear-items.js";

const BASE_GAUGE_COST = 3;

function focusTarget(targetActor) {
  const token = targetActor.getActiveTokens()[0];
  if (token) token.setTarget(true, { releaseOthers: true });
}

// 세이크리드 엣지의 "마비 성공 시 +1d8" — 이건 스턴엣지 판정 자체의 결과물이라
// 별도 굴림으로 바로 채팅에 띄운다(무기 데미지가 아니라 이 판정 자체가 내는
// 피해). 태그/무기 선택 없이 단순하게 굴리고, 같은 전체/절반/두배 버튼을
// 붙여서 시스템의 기존 데미지 적용 흐름을 그대로 탄다.
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

async function applyParalysisWithTarget(actor, moveName, { rollBonus = false, pendingBonus = false } = {}) {
  const target = await promptActorTarget(actor, {
    title: moveName,
    label: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.ParalysisTargetLabel"),
    excludeSelf: false
  });
  if (!target) return;

  focusTarget(target);
  await applyParalysis(target);
  announceActionApplied(actor, moveName, game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.ParalysisApplied", { target: target.name }));

  if (rollBonus) {
    await rollBonusDamage(actor, moveName, target);
  } else if (pendingBonus) {
    await grantPendingWeaponDamageBonus(actor, "1d8");
    announceActionApplied(actor, moveName, game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.PendingDamageBonusApplied"));
  }
}

// ---- 판정 직전 개입: 스턴엣지/세이크리드 엣지 게이지 게이트 + 폴트리스
// 디펜스. libWrapper는 같은 모듈이 같은 대상(game.dungeonworld.ItemDw.
// prototype.roll)을 두 번 wrap하면 에러를 던지므로(dw-automation의
// lib/roll-wrapper.js가 실제로 겪고 기록해둔 버그), 이 모듈에서 이 대상을
// wrap하는 자리는 반드시 여기 하나뿐이어야 한다 — 폴트리스 디펜스
// (features/guilty-gear-defense.js)도 별도로 wrap하지 않고 이 함수 안에서
// 호출된다. ----
async function wrappedRoll(wrapped, ...args) {
  if (!this.actor || this.type !== "move") return wrapped(...args);
  if (game.system.id !== "dungeonworld" || !isGuiltyGearEnabled()) return wrapped(...args);

  const actor = this.actor;

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
// 대상을 골라 마비를 건다. 세이크리드 엣지는 추가로 +1d8을 별도로 굴린다. ----
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

// 라이드 더 라이트닝(있고 게이지가 되면 항상 물어봄, 토글 없음) → (아니오/
// 불가면) 다이어 에클라(DIRE_ECLAIR_ASK_MODE_FLAG 토글에 따름) 순서로
// 캐스케이드 확인한다. 라이드 더 라이트닝을 쓰면 이어서 굴릴 "기본 접근전
// 데미지"에 +1d8을 예약한다(별도 굴림 없음).
async function resolveMeleeFlavor(actor) {
  const hasRideTheLightning = actor.items.some((i) => i.type === "move" && i.name === RIDE_THE_LIGHTNING_MOVE_NAME);
  if (hasRideTheLightning) {
    const rideCost = getEnhancedTechniqueCost(actor, BASE_GAUGE_COST);
    if (rideCost <= 0 || getGauge(actor) >= rideCost) {
      const confirmed = await Dialog.confirm({
        title: RIDE_THE_LIGHTNING_MOVE_NAME,
        content: `<p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.MeleeFollowUpPrompt", { move: RIDE_THE_LIGHTNING_MOVE_NAME, cost: rideCost })}</p>`,
        defaultYes: false
      });
      if (confirmed) return { flavor: "ride", cost: rideCost };
    }
  }

  const hasDireEclair = actor.items.some((i) => i.type === "move" && i.name === DIRE_ECLAIR_MOVE_NAME);
  if (!hasDireEclair) return { flavor: null, cost: 0 };

  const mode = getAskMode(actor, DIRE_ECLAIR_ASK_MODE_FLAG, "ask");
  if (mode === "never") return { flavor: null, cost: 0 };

  const eclairCost = getBaseTechniqueCost(actor, BASE_GAUGE_COST);

  if (mode === "ask") {
    const confirmed = await Dialog.confirm({
      title: DIRE_ECLAIR_MOVE_NAME,
      content: `<p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.MeleeFollowUpPrompt", { move: DIRE_ECLAIR_MOVE_NAME, cost: eclairCost })}</p>`,
      defaultYes: false
    });
    if (!confirmed) return { flavor: null, cost: 0 };
    if (eclairCost > 0 && getGauge(actor) < eclairCost) {
      ui.notifications.warn(game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeInsufficient", { name: actor.name, cost: eclairCost }));
      return { flavor: null, cost: 0 };
    }
    return { flavor: "eclair", cost: eclairCost };
  }

  // mode === "always": 묻지 않고 게이지만 되면 바로 적용.
  if (eclairCost > 0 && getGauge(actor) < eclairCost) return { flavor: null, cost: 0 };
  return { flavor: "eclair", cost: eclairCost };
}

// ---- 다이어 에클라/라이드 더 라이트닝: 접근전 액션이 실패하지 않았을 때
// (성공/부분성공) 발동한다. ----
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

  (async () => {
    // dw-automation의 attack-assistant.js도 같은 채팅 메시지를 보고 "정말
    // 무기로 데미지를 굴리시겠습니까?" 확인창을 독립적으로 띄운다. 그쪽
    // 내부 콜백에 걸 방법이 없어서 "답할 때까지 정확히 기다리기"는 불가능
    // 하지만, 우리 확인창을 살짝 늦춰서 그쪽이 먼저 화면에 뜨고 포커스를
    // 잡게 한다 — 두 확인창이 동시에 겹쳐 뜨는 것보다 훨씬 자연스럽다.
    await new Promise((resolve) => setTimeout(resolve, 600));

    const { flavor, cost } = await resolveMeleeFlavor(actor);
    if (!flavor) return;

    if (cost > 0) await trySpendGauge(actor, cost);

    const moveName = flavor === "ride" ? RIDE_THE_LIGHTNING_MOVE_NAME : DIRE_ECLAIR_MOVE_NAME;
    await applyParalysisWithTarget(actor, moveName, { pendingBonus: flavor === "ride" });
  })();
}

export function registerGuiltyGearAttacks() {
  Hooks.on("createChatMessage", onCreateChatMessageRangedResult);
  Hooks.on("createChatMessage", onCreateChatMessageMeleeFollowUp);
}
