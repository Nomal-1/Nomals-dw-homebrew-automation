// dw-automation의 scripts/lib/*.js 내부 파일을 직접 import하지 않고, 이
// 모듈의 main.js가 ready 훅에서 캐시해둔 game.modules.get("dw-automation").api
// (ARCHITECTURE.md 9번 항목이 정의한 공개 API)로만 접근하기 위한 얇은
// 래퍼. 여기 없는 함수가 더 필요해지면 dw-automation의 public-api.js에
// 실제로 노출돼 있는지 먼저 확인하고 추가할 것.
//
// ready 시점에 한 번 스냅샷해서 캐시해두지 않고 매번 라이브로 조회한다 —
// Foundry가 여러 모듈의 ready 훅을 어떤 순서로 실행하는지 보장하지 않아서,
// dw-automation의 ready 콜백(자기 api를 game.modules.get("dw-automation").api에
// 얹는 부분)이 이 모듈의 ready 콜백보다 늦게 실행되면 스냅샷 시점엔 아직
// api가 비어있는 채로 영영 고정돼버리는 문제가 실제로 있었다(v0.2.0에서
// 채팅 알림/대상 선택/게이지 배지가 전부 조용히 죽는 버그로 나타남). 라이브
// 조회는 실제 플레이 중(ready가 완전히 끝난 한참 뒤) 호출되므로 이 순서
// 문제에서 자유롭다.
function api() {
  const a = game.modules.get("dw-automation")?.api;
  if (!a) {
    throw new Error("nomals-dw-homebrew-automation | dw-automation API가 아직 준비되지 않았습니다(dw-automation이 비활성화됐거나 너무 오래된 버전일 수 있습니다).");
  }
  return a;
}

export function getMoveCardInfo(message) {
  return api().getMoveCardInfo(message);
}

export function findMoveItem(actor, title) {
  return api().findMoveItem(actor, title);
}

export function announceActionApplied(actor, moveLabel, detail = "") {
  return api().announceActionApplied(actor, moveLabel, detail);
}

export function announceInfo(actor, content) {
  return api().announceInfo(actor, content);
}

export function promptActorTarget(actor, options = {}) {
  return api().promptActorTarget(actor, options);
}

export function getOrCreateTagsContainer($item) {
  return api().getOrCreateTagsContainer($item);
}
