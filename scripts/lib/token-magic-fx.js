// Token Magic FX(https://github.com/Feu-Secret/Tokenmagic)를 쓰는 시각 효과가
// 여럿(마비, 게이지 충전, 드래곤 인스톨)이라 공통 로직을 여기 하나로 모은다.
// 안 깔려 있어도(대부분의 세계) 조용히 건너뛰고 항상 정상 동작해야 하므로,
// 이 파일의 모든 함수는 호출될 때마다 존재 여부를 스스로 확인한다(ready 시점에
// 한 번만 확인하고 캐시하지 않는다 - 다른 모듈이므로 로드 순서를 보장할 수 없다).
// Foundry 12 기준으로는 반드시 v0.6.8을 써야 한다(v0.7.0부터 Foundry 13 전용).
//
// 필터 종류는 공식 문서에 파라미터가 정확히 나와 있는 "glow" 하나로 통일한다
// (electric/outline 등 다른 종류는 예시 파라미터가 공개돼 있지 않아 잘못된
// 값으로 조용히 깨질 위험이 있음). 상태별 구분은 색상/강도/애니메이션 속도로만 한다.

export function isTokenMagicActive() {
  return typeof TokenMagic !== "undefined";
}

export function getSceneTokensFor(actor) {
  return canvas.tokens?.placeables?.filter((t) => t.actor?.id === actor.id) ?? [];
}

export async function applyGlowFilter(actor, filterId, { color1, color2, outerStrength = 3, innerStrength = 1, loopDuration = 1500 } = {}) {
  if (!isTokenMagicActive()) return;

  const tokens = getSceneTokensFor(actor);
  if (tokens.length === 0) return;

  const params = [
    {
      filterType: "glow",
      filterId,
      outerStrength,
      innerStrength,
      color: color1,
      quality: 0.5,
      animated: {
        color: {
          active: true,
          loopDuration,
          animType: "colorOscillation",
          val1: color1,
          val2: color2
        }
      }
    }
  ];

  try {
    for (const token of tokens) {
      await TokenMagic.addUpdateFilters(token, params);
    }
  } catch (err) {
    console.warn(`nomals-dw-homebrew-automation | token-magic-fx: apply(${filterId}) failed`, err);
  }
}

export async function clearGlowFilter(actor, filterId) {
  if (!isTokenMagicActive()) return;

  const tokens = getSceneTokensFor(actor);
  if (tokens.length === 0) return;

  try {
    for (const token of tokens) {
      await TokenMagic.deleteFilters(token, filterId);
    }
  } catch (err) {
    console.warn(`nomals-dw-homebrew-automation | token-magic-fx: clear(${filterId}) failed`, err);
  }
}
