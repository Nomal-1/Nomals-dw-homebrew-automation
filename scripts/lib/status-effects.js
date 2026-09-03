// 스턴엣지 계열이 거는 "마비" 상태를 Foundry 상태 이펙트로 표현한다(고정
// 수치 효과가 없는, 서사적 판단용 상태 — ARCHITECTURE.md 원문 참고). GM이
// "기본 상태 아이콘은 너무 밋밋하다"고 해서, CONFIG.statusEffects에 이
// 모듈 전용 항목을 하나 등록해 최소한 전용 아이콘(icons/svg/paralysis.svg)이
// 확실히 뜨게 하고, Sequencer + JB2A가 깔려 있으면(둘 다 없어도 정상 동작 —
// 있으면 덤으로) 발동/해제 순간 번쩍이는 연출을 한 번 얹는다.
//
// 더 화려한 상태 아이콘 자체를 원하면 GM이 별도로 "DFreds Status Effects"
// 같은 상태 이펙트 관리 모듈을 설치해서 이 statusId(아래 STATUS_ID)에 맞는
// 아이콘을 덮어쓰는 방법도 있다 — 이 모듈이 직접 그런 모듈에 의존하지는
// 않는다(설치 여부와 무관하게 항상 동작해야 하므로).
const STATUS_ID = "nomalsDwHomebrewParalysis";

export function registerParalysisStatusEffect() {
  const exists = CONFIG.statusEffects?.some((e) => e.id === STATUS_ID);
  if (exists) return;

  CONFIG.statusEffects.push({
    id: STATUS_ID,
    name: "NOMALS_DW_HOMEBREW.GuiltyGear.ParalysisStatusName",
    img: "icons/svg/paralysis.svg"
  });
}

function getSceneTokensFor(actor) {
  return canvas.tokens?.placeables?.filter((t) => t.actor?.id === actor.id) ?? [];
}

// Sequencer/JB2A가 없어도(대부분의 세계에 없음) 조용히 건너뛴다 — 있을 때만
// 번개가 대상을 스치는 연출을 한 번 재생한다. 실패해도 상태 적용 자체는
// 이미 끝난 뒤라 게임 진행에 영향이 없도록 별도로 감싸서 처리한다.
async function maybePlayFlourish(actor) {
  if (typeof Sequencer === "undefined") return;
  if (!game.modules.get("jb2a_patreon")?.active && !game.modules.get("JB2A_DnD5e")?.active) return;

  const tokens = getSceneTokensFor(actor);
  if (tokens.length === 0) return;

  try {
    const file = "jb2a.static_electricity.03.blue";
    for (const token of tokens) {
      new Sequence().effect().file(file).attachTo(token).scaleToObject(2).fadeOut(500).play();
    }
  } catch (err) {
    console.warn("nomals-dw-homebrew-automation | status-effects: Sequencer flourish failed", err);
  }
}

export function isParalyzed(actor) {
  return Boolean(actor.statuses?.has(STATUS_ID));
}

export async function applyParalysis(actor) {
  if (isParalyzed(actor)) return;
  await actor.toggleStatusEffect(STATUS_ID, { active: true });
  await maybePlayFlourish(actor);
}

export async function clearParalysis(actor) {
  if (!isParalyzed(actor)) return;
  await actor.toggleStatusEffect(STATUS_ID, { active: false });
}
