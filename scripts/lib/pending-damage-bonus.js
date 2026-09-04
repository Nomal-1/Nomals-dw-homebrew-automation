// 세이크리드 엣지/라이드 더 라이트닝의 "+1d8 추가 피해"를 별도 굴림으로
// 띄우지 않고, 다음에 굴리는 무기 데미지 판정 자체에 수정치로 얹는다.
//
// dw-automation의 무기 데미지 굴림(features/attack-assistant.js의
// rollDamage)은 ItemDw.prototype.roll()을 타지 않는 완전히 별개의 내부
// 함수라서(Dialog 버튼 클릭에서 직접 new Roll()을 만든다) libWrapper로
// 가로챌 방법이 없다. 대신 그 함수가 항상 읽는 실제 시스템 데이터 필드
// (system.attributes.damage.misc — 시트에도 노출되는 "기타 피해 보정" 칸)에
// +1d8을 얹어뒀다가, 그 보정이 실제로 반영된 데미지 굴림 채팅 메시지가
// 뜨면(데미지 적용 버튼이 붙은 메시지로 판별) 원래 값으로 되돌린다. 내부
// 함수를 직접 호출/수정하지 않고 공개된 액터 데이터만 건드리는 방식이라
// ARCHITECTURE.md 9번 항목(공개 API로만 접근)과 충돌하지 않는다.
import { MODULE_ID } from "../constants.js";

const ORIGINAL_MISC_FLAG = "pendingDamageBonusOriginalMisc";

function getMisc(actor) {
  return actor.system?.attributes?.damage?.misc ?? "";
}

// 이미 대기 중인 보너스가 있으면(연속 발동 등) 그 시점의 misc를 다시
// 백업하지 않는다 — 안 그러면 "+1d8"이 얹힌 값을 원본으로 착각해서 나중에
// 그 상태로 복원해버려 보너스가 영영 안 지워진다.
export async function grantPendingWeaponDamageBonus(actor, formula) {
  if (actor.getFlag(MODULE_ID, ORIGINAL_MISC_FLAG) === undefined) {
    await actor.setFlag(MODULE_ID, ORIGINAL_MISC_FLAG, getMisc(actor));
  }
  const current = getMisc(actor);
  const next = current ? `${current}+${formula}` : `+${formula}`;
  await actor.update({ "system.attributes.damage.misc": next });
}

async function restoreOriginalMisc(actor) {
  const original = actor.getFlag(MODULE_ID, ORIGINAL_MISC_FLAG);
  if (original === undefined) return;
  await actor.update({ "system.attributes.damage.misc": original });
  await actor.unsetFlag(MODULE_ID, ORIGINAL_MISC_FLAG);
}

// 데미지 적용 버튼(전체/절반/두배)이 붙은 메시지 = 실제 데미지 굴림이
// 반영된 메시지. dw-automation의 rollDamage든 시스템 자체의 formula
// 롤이든 전부 같은 마크업을 쓴다.
function looksLikeDamageRollMessage(message) {
  return typeof message.content === "string" && message.content.includes("chat-damage-buttons");
}

function onCreateChatMessage(message, options, userId) {
  if (userId !== game.user.id) return;
  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const actor = game.actors.get(actorId);
  if (!actor) return;
  if (actor.getFlag(MODULE_ID, ORIGINAL_MISC_FLAG) === undefined) return;
  if (!looksLikeDamageRollMessage(message)) return;

  restoreOriginalMisc(actor);
}

export function registerPendingDamageBonusConsumer() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
