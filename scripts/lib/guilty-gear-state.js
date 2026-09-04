import { MODULE_ID, SETTINGS } from "../constants.js";

// 게이지(0~5)는 던전월드 시스템 템플릿에 이미 있는 범용 자원 필드
// (system.attributes.resource1 — value/max/label)에 그대로 얹는다. 커스텀
// 플래그를 새로 만들지 않는 이유: 이 필드라야 Foundry 토큰 설정의 "리소스 바"
// 드롭다운에서 바로 골라 액터 위/아래에 바 형태로 표시할 수 있다(플래그
// 경로는 시스템의 getTrackedAttributes가 못 읽는다). 이 필드를 다른 용도로
// 이미 쓰고 있는 GM 세계라면 충돌할 수 있으니 주의.
const GAUGE_MAX = 5;
const GAUGE_PATH = "system.attributes.resource1";

export function splitCommaList(settingKey) {
  return game.settings
    .get(MODULE_ID, settingKey)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isGuiltyGearEnabled() {
  return game.system.id === "dungeonworld" && game.settings.get(MODULE_ID, SETTINGS.ENABLE_GUILTY_GEAR_ASSISTANT);
}

export function hasGuiltyGear(actor) {
  const names = splitCommaList(SETTINGS.GUILTY_GEAR_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

export function hasStrive(actor) {
  const names = splitCommaList(SETTINGS.STRIVE_MOVE_NAMES);
  return actor.items.some((i) => i.type === "move" && names.includes(i.name));
}

export function getActorLevel(actor) {
  return Number(actor.system?.attributes?.level?.value) || 1;
}

export function getGauge(actor) {
  return Number(actor.system?.attributes?.resource1?.value) || 0;
}

export function getGaugeMax(actor) {
  return Number(actor.system?.attributes?.resource1?.max) || GAUGE_MAX;
}

// 길티기어를 배운 시점에 한 번만 호출한다. 이미 값이 들어있으면(재발동 등)
// value는 건드리지 않고 max/label만 맞춰준다.
export async function ensureGaugeInitialized(actor) {
  const current = actor.system?.attributes?.resource1;
  const changes = {
    [`${GAUGE_PATH}.max`]: GAUGE_MAX,
    [`${GAUGE_PATH}.label`]: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGear.GaugeLabel")
  };
  if (current?.value === undefined || current?.value === null) {
    changes[`${GAUGE_PATH}.value`] = 0;
  }
  await actor.update(changes);
}

export async function setGauge(actor, value) {
  const clamped = Math.max(0, Math.min(GAUGE_MAX, Math.round(Number(value) || 0)));
  await actor.update({ [`${GAUGE_PATH}.value`]: clamped });
  return clamped;
}

export async function addGauge(actor, amount) {
  return setGauge(actor, getGauge(actor) + amount);
}

// amount가 현재 게이지보다 많으면 소비하지 않고 false를 돌려준다(호출부가
// "게이지 부족" 안내를 하도록). 실제로 깎였으면 true.
export async function trySpendGauge(actor, amount) {
  const current = getGauge(actor);
  if (amount <= 0) return true;
  if (current < amount) return false;
  await setGauge(actor, current - amount);
  return true;
}

// 드래곤 인스톨(용의 각성) 발동 여부. HP <= 최대치의 30%(반올림) + 게이지가
// 가득 찬 상태에서 자동 발동하고, HP가 30%를 다시 넘으면 즉시 해제된다
// (features/guilty-gear-core.js의 updateActor 훅이 실제 판정을 담당한다).
// 이 플래그는 그 판정 결과를 저장만 한다.
const DRAGON_INSTALL_FLAG = "dragonInstallActive";

export function isDragonInstallActive(actor) {
  return Boolean(actor.getFlag(MODULE_ID, DRAGON_INSTALL_FLAG));
}

export async function setDragonInstallActive(actor, active) {
  if (active) {
    await actor.setFlag(MODULE_ID, DRAGON_INSTALL_FLAG, true);
  } else {
    await actor.unsetFlag(MODULE_ID, DRAGON_INSTALL_FLAG);
  }
}

// 스턴엣지/다이어 에클라(기본 두 기술)의 실제 게이지 비용. 스트라이브를
// 배우면 무제한(0)으로 바뀐다(원문: "게이지 소비 없이 상시 사용 가능").
// 드래곤 인스톨 여부는 이 둘에 영향이 없다 — 애초에 스트라이브 없이는
// 드래곤 인스톨 자체가 없다.
export function getBaseTechniqueCost(actor, baseCost) {
  return hasStrive(actor) ? 0 : baseCost;
}

// 세이크리드 엣지/라이드 더 라이트닝(강화판)의 실제 게이지 비용. 드래곤
// 인스톨 중에는 무제한(0), 아니면 항상 baseCost(스트라이브가 있어도 이
// 둘은 여전히 게이지를 쓴다 — 원문: "대신 매번 게이지 3을 다시 태워야 함").
export function getEnhancedTechniqueCost(actor, baseCost) {
  return isDragonInstallActive(actor) ? 0 : baseCost;
}

// 다이어 에클라 옆 배지에서 클릭으로 순환시키는 3단계 모드.
//   "always" — 묻지 않고 게이지만 되면 자동 적용
//   "ask"    — 매번 사용할지 Y/N으로 물어봄(기본값)
//   "never"  — 항상 미적용, 효과 자체를 안 씀
export const DIRE_ECLAIR_ASK_MODE_FLAG = "direEclairAskMode";
const ASK_MODE_ORDER = ["always", "ask", "never"];

export function getAskMode(actor, flagKey, defaultMode = "always") {
  const value = actor.getFlag(MODULE_ID, flagKey);
  return ASK_MODE_ORDER.includes(value) ? value : defaultMode;
}

export async function cycleAskMode(actor, flagKey, defaultMode = "always") {
  const current = getAskMode(actor, flagKey, defaultMode);
  const next = ASK_MODE_ORDER[(ASK_MODE_ORDER.indexOf(current) + 1) % ASK_MODE_ORDER.length];
  await actor.setFlag(MODULE_ID, flagKey, next);
  return next;
}
