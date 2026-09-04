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
    await rollBonusDamage(actor, moveName, target);
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

// ---- 다이어 에클라/라이드 더 라이트닝: dw-automation의 "어떤 무기를 쓸
// 거냐" 대화상자(features/attack-assistant.js의 promptWeaponChoice) 안에
// 드롭다운을 하나 끼워넣는다. 그 대화상자 자체는 내부 함수가 만드는 거라
// 직접 못 건드리지만, 다 그려진 뒤(renderDialog 훅)에 DOM에 필드를
// 추가하는 건 가능하다(레벨업 창에 "배우기" 섹션을 끼워넣는 것과 같은
// 패턴 — features/guilty-gear-core.js의 injectLevelUpSection 참고).
// "정말 데미지를 굴리시겠습니까?" 확인창과 별개 채팅 프롬프트로 경쟁하던
// 이전 방식(v0.2.4까지) 대신, 이미 뜨는 그 대화상자 안에서 고르게 하면
// dw-automation의 확인 흐름과 순서가 자연히 맞아떨어진다.
//
// 어느 액터의 무기 선택 창인지는 대화상자 자체엔 표시가 없어서, 드롭다운의
// 첫 무기 <option>의 아이템 id로 소유 액터를 역으로 찾는다. "이 창이
// 길티기어 접근전 후속 선택 대상인지"는 별도로 판단한다 — 접근전 판정
// 채팅 카드가 뜬 순간 그 액터를 짧게(15초) "대기 중"으로 표시해뒀다가,
// 실제로 무기 선택 창이 뜨면 그 표시를 소모한다. 이렇게 해야 사격(Volley)
// 같은 무관한 무기 굴림에는 드롭다운이 안 뜬다.
const meleeDialogEligible = new Map(); // actorId -> setTimeout 핸들

function markMeleeDialogEligible(actor) {
  const existing = meleeDialogEligible.get(actor.id);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => meleeDialogEligible.delete(actor.id), 15000);
  meleeDialogEligible.set(actor.id, timeout);
}

function consumeMeleeDialogEligible(actorId) {
  const existing = meleeDialogEligible.get(actorId);
  if (!existing) return false;
  clearTimeout(existing);
  meleeDialogEligible.delete(actorId);
  return true;
}

// 접근전 판정이 성공/부분성공이고, 이 액터가 라이드 더 라이트닝이나
// 다이어 에클라를 갖고 있으면 "다음 무기 선택 창에 드롭다운을 끼워넣어도
// 되는" 상태로 표시해둔다.
function onCreateChatMessageMeleeJudgment(message, options, userId) {
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

  const hasRide = actor.items.some((i) => i.type === "move" && i.name === RIDE_THE_LIGHTNING_MOVE_NAME);
  const hasDireEclair = actor.items.some((i) => i.type === "move" && i.name === DIRE_ECLAIR_MOVE_NAME);
  if (!hasRide && !hasDireEclair) return;

  markMeleeDialogEligible(actor);
}

function findActorFromWeaponDialog(html) {
  const itemId = html.find('select[name="weapon"] option').first().val();
  if (!itemId) return null;
  return game.actors.find((a) => a.items.get(itemId)) ?? null;
}

// 다이어 에클라 토글(DIRE_ECLAIR_ASK_MODE_FLAG)의 의미를 드롭다운 기본값에
// 맞게 재해석한다: "항상 미적용"이면 다이어 에클라 자체를 선택지에서 뺀다
// (라이드 더 라이트닝은 이 토글과 무관하게 항상 후보). "항상 적용"이면
// 드롭다운을 열었을 때부터 라이드 더 라이트닝(있으면)이나 다이어 에클라가
// 미리 선택돼 있다(그래도 "사용 안 함"으로 직접 바꿀 수 있다). "매번
// 묻기"(기본값)면 "사용 안 함"이 기본 선택이라 직접 골라야 한다.
function buildMeleeFlavorOptions(actor) {
  const options = [`<option value="none">${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.MeleeFlavorNone")}</option>`];

  const hasRide = actor.items.some((i) => i.type === "move" && i.name === RIDE_THE_LIGHTNING_MOVE_NAME);
  if (hasRide) options.push(`<option value="ride">${RIDE_THE_LIGHTNING_MOVE_NAME}</option>`);

  const hasDireEclair = actor.items.some((i) => i.type === "move" && i.name === DIRE_ECLAIR_MOVE_NAME);
  const eclairMode = getAskMode(actor, DIRE_ECLAIR_ASK_MODE_FLAG, "ask");
  const eclairAvailable = hasDireEclair && eclairMode !== "never";
  if (eclairAvailable) options.push(`<option value="eclair">${DIRE_ECLAIR_MOVE_NAME}</option>`);

  let defaultValue = "none";
  if (eclairMode === "always") {
    if (hasRide) defaultValue = "ride";
    else if (eclairAvailable) defaultValue = "eclair";
  }

  return { optionsHtml: options.join(""), hasRide, eclairAvailable, defaultValue };
}

async function commitMeleeFlavor(actor, flavor) {
  const cost = flavor === "ride" ? getEnhancedTechniqueCost(actor, BASE_GAUGE_COST) : getBaseTechniqueCost(actor, BASE_GAUGE_COST);
  if (cost > 0 && getGauge(actor) < cost) {
    ui.notifications.warn(game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeInsufficient", { name: actor.name, cost }));
    return false;
  }

  if (cost > 0) await trySpendGauge(actor, cost);
  if (flavor === "ride") {
    await grantPendingWeaponDamageBonus(actor, "1d8");
    announceActionApplied(actor, RIDE_THE_LIGHTNING_MOVE_NAME, game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.PendingDamageBonusApplied"));
  }

  const moveName = flavor === "ride" ? RIDE_THE_LIGHTNING_MOVE_NAME : DIRE_ECLAIR_MOVE_NAME;
  await applyParalysisWithTarget(actor, moveName, { rollBonus: false });
  return true;
}

function injectMeleeFlavorSelect(html, actor) {
  if (html.find('[name="dwautoGuiltyGearMeleeFlavor"]').length) return; // 이미 끼워넣음(중복 렌더 방지)

  const { optionsHtml, hasRide, eclairAvailable, defaultValue } = buildMeleeFlavorOptions(actor);
  if (!hasRide && !eclairAvailable) return; // 보여줄 선택지가 없음

  const $group = $(`
    <div class="form-group dwauto-guilty-gear-melee-flavor-group">
      <label>${game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.MeleeFlavorLabel")}</label>
      <select name="dwautoGuiltyGearMeleeFlavor">${optionsHtml}</select>
    </div>
  `);
  const $select = $group.find("select");
  $select.val(defaultValue);

  const $modGroup = html.find('[name="mod"]').closest(".form-group");
  if ($modGroup.length) $modGroup.after($group);
  else html.find("form").append($group);

  // 한 번 정해지면(사용 안 함이 아닌 걸 고르면) 그 자리에서 바로
  // 게이지/데미지 보정을 적용하고 드롭다운을 잠근다 — 나중에 "롤" 버튼을
  // 누르는 시점과 완전히 분리해서, 언제 눌러도(또는 아예 안 눌러도) 이미
  // 반영된 상태를 유지한다. 실패(게이지 부족)하면 "사용 안 함"으로 되돌린다.
  let committed = false;
  $select.on("change", async (event) => {
    if (committed) return;
    const flavor = event.currentTarget.value;
    if (flavor === "none") return;

    committed = true;
    $select.prop("disabled", true);

    const applied = await commitMeleeFlavor(actor, flavor);
    if (!applied) {
      $select.prop("disabled", false);
      $select.val("none");
      committed = false;
    }
  });
}

function onRenderDialog(app, html) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (!html.find('select[name="weapon"]').length || !html.find('input[name="mod"]').length) return;

  const actor = findActorFromWeaponDialog(html);
  if (!actor) return;
  if (!consumeMeleeDialogEligible(actor.id)) return;

  injectMeleeFlavorSelect(html, actor);
}

export function registerGuiltyGearAttacks() {
  Hooks.on("createChatMessage", onCreateChatMessageRangedResult);
  Hooks.on("createChatMessage", onCreateChatMessageMeleeJudgment);
  Hooks.on("renderDialog", onRenderDialog);
}
