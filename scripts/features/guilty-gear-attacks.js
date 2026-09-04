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
// 스턴엣지/세이크리드 엣지 둘 중 어느 아이템을 클릭해도 같은 캐스케이드
// 확인(세이크리드 엣지 → 스턴엣지)을 타고, 실제로 무엇이 발동했는지는
// 클릭한 아이템 이름이 아니라 굴리기 직전에 남겨둔 PENDING_RANGED_FLAVOR_FLAG로
// 판단한다(판정 결과 채팅 카드의 제목은 여전히 "클릭한 아이템 이름" 그대로라
// 실제 발동 내역과 다를 수 있기 때문).
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
  STUN_EDGE_ASK_MODE_FLAG,
  DIRE_ECLAIR_ASK_MODE_FLAG
} from "../lib/guilty-gear-state.js";
import {
  STUN_EDGE_MOVE_NAME,
  SACRED_EDGE_MOVE_NAME,
  DIRE_ECLAIR_MOVE_NAME,
  RIDE_THE_LIGHTNING_MOVE_NAME
} from "../data/guilty-gear-items.js";

const BASE_GAUGE_COST = 3;
const PENDING_RANGED_FLAVOR_FLAG = "pendingRangedFlavor";

function focusTarget(targetActor) {
  const token = targetActor.getActiveTokens()[0];
  if (token) token.setTarget(true, { releaseOthers: true });
}

async function applyParalysisWithTarget(actor, moveName, { rollBonus = false } = {}) {
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
    await grantPendingWeaponDamageBonus(actor, "1d8");
    announceActionApplied(actor, moveName, game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.PendingDamageBonusApplied"));
  }
}

// 세이크리드 엣지 → (아니오면) 스턴엣지 순서로 캐스케이드 확인한다. 세이크리드
// 엣지는 갖고 있고 게이지가 되면 항상 물어본다(토글 없음). 스턴엣지는
// STUN_EDGE_ASK_MODE_FLAG(항상 적용/매번 묻기/항상 미적용)를 따른다. 어느
// 쪽도 안 쓰기로 하면 { flavor: null }을 돌려줘서 평범한 판정으로만 흘러가게
// 한다.
async function resolveRangedFlavor(actor) {
  const hasSacred = actor.items.some((i) => i.type === "move" && i.name === SACRED_EDGE_MOVE_NAME);
  if (hasSacred) {
    const sacredCost = getEnhancedTechniqueCost(actor, BASE_GAUGE_COST);
    if (sacredCost <= 0 || getGauge(actor) >= sacredCost) {
      const confirmed = await Dialog.confirm({
        title: SACRED_EDGE_MOVE_NAME,
        content: `<p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.RangedFlavorPrompt", { move: SACRED_EDGE_MOVE_NAME, cost: sacredCost })}</p>`,
        defaultYes: false
      });
      if (confirmed) return { flavor: "sacred", cost: sacredCost };
    }
  }

  const mode = getAskMode(actor, STUN_EDGE_ASK_MODE_FLAG, "always");
  if (mode === "never") return { flavor: null, cost: 0 };

  const stunCost = getBaseTechniqueCost(actor, BASE_GAUGE_COST);

  if (mode === "ask") {
    if (stunCost > 0 && getGauge(actor) < stunCost) return { flavor: null, cost: 0 };
    const confirmed = await Dialog.confirm({
      title: STUN_EDGE_MOVE_NAME,
      content: `<p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.RangedFlavorPrompt", { move: STUN_EDGE_MOVE_NAME, cost: stunCost })}</p>`,
      defaultYes: false
    });
    return confirmed ? { flavor: "stun", cost: stunCost } : { flavor: null, cost: 0 };
  }

  // mode === "always": 묻지 않고 게이지만 되면 바로 적용.
  if (stunCost > 0 && getGauge(actor) < stunCost) return { flavor: null, cost: 0 };
  return { flavor: "stun", cost: stunCost };
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

  // 스턴엣지/세이크리드 엣지: 둘 중 어느 아이템을 클릭해도 같은 캐스케이드로
  // 물어보고, 실제 발동 내역을 플래그에 남긴다(판정 결과 처리는
  // onCreateChatMessageRangedResult가 이 플래그를 읽는다).
  if (this.name === STUN_EDGE_MOVE_NAME || this.name === SACRED_EDGE_MOVE_NAME) {
    const { flavor, cost } = await resolveRangedFlavor(actor);

    if (flavor) {
      await actor.setFlag(MODULE_ID, PENDING_RANGED_FLAVOR_FLAG, flavor);
      if (cost > 0) await trySpendGauge(actor, cost);
    } else {
      await actor.unsetFlag(MODULE_ID, PENDING_RANGED_FLAVOR_FLAG);
    }

    try {
      return await wrapped(...args);
    } finally {
      await actor.unsetFlag(MODULE_ID, PENDING_RANGED_FLAVOR_FLAG);
    }
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
// 대상을 골라 마비를 건다. 세이크리드 엣지는 추가로 다음 무기 데미지
// 굴림에 +1d8을 예약한다. ----
function onCreateChatMessageRangedResult(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title, result } = info;
  if (actor.type !== "character") return;
  if (title !== STUN_EDGE_MOVE_NAME && title !== SACRED_EDGE_MOVE_NAME) return;

  const flavor = actor.getFlag(MODULE_ID, PENDING_RANGED_FLAVOR_FLAG);
  actor.unsetFlag(MODULE_ID, PENDING_RANGED_FLAVOR_FLAG); // 한 번 쓰고 정리 — 다음 판정에 안 새게 한다.
  if (!flavor) return;
  if (result !== "success" && result !== "partial") return;

  const moveName = flavor === "sacred" ? SACRED_EDGE_MOVE_NAME : STUN_EDGE_MOVE_NAME;
  applyParalysisWithTarget(actor, moveName, { rollBonus: flavor === "sacred" });
}

// ---- 다이어 에클라/라이드 더 라이트닝: 접근전 액션이 실패하지 않았을 때
// (성공/부분성공) 사용할지 물어본다. 라이드 더 라이트닝(강화판)을 배웠으면
// 그쪽을 우선한다 — 같은 발동 조건에 순수 상위호환이라 굳이 기본판을
// 따로 물어볼 이유가 없다. DIRE_ECLAIR_ASK_MODE_FLAG(기본값 "ask")를
// 따르고, "ask" 모드일 땐 게이지 상태와 무관하게 항상 물어본 뒤(원하시는
// 대로) 실제로 쓰겠다고 답했을 때만 게이지 부족 여부를 확인한다. ----
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

  const mode = getAskMode(actor, DIRE_ECLAIR_ASK_MODE_FLAG, "ask");
  if (mode === "never") return;

  const moveName = hasRideTheLightning ? RIDE_THE_LIGHTNING_MOVE_NAME : DIRE_ECLAIR_MOVE_NAME;
  const cost = hasRideTheLightning ? getEnhancedTechniqueCost(actor, BASE_GAUGE_COST) : getBaseTechniqueCost(actor, BASE_GAUGE_COST);

  (async () => {
    if (mode === "ask") {
      const confirmed = await Dialog.confirm({
        title: moveName,
        content: `<p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.MeleeFollowUpPrompt", { move: moveName, cost })}</p>`,
        defaultYes: false
      });
      if (!confirmed) return;
    }

    if (cost > 0 && getGauge(actor) < cost) {
      ui.notifications.warn(game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeInsufficient", { name: actor.name, cost }));
      return;
    }

    if (cost > 0) await trySpendGauge(actor, cost);
    await applyParalysisWithTarget(actor, moveName, { rollBonus: hasRideTheLightning });
  })();
}

export function registerGuiltyGearAttacks() {
  Hooks.on("createChatMessage", onCreateChatMessageRangedResult);
  Hooks.on("createChatMessage", onCreateChatMessageMeleeFollowUp);
}
