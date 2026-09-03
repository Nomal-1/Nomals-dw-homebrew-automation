// dw-automation의 scripts/lib/*.js 내부 파일을 직접 import하지 않고, 이
// 모듈의 main.js가 ready 훅에서 캐시해둔 game.modules.get("dw-automation").api
// (ARCHITECTURE.md 9번 항목이 정의한 공개 API)로만 접근하기 위한 얇은
// 래퍼. 여기 없는 함수가 더 필요해지면 dw-automation의 public-api.js에
// 실제로 노출돼 있는지 먼저 확인하고 추가할 것.
import { getDwAutomationApi } from "../main.js";

function api() {
  const a = getDwAutomationApi();
  if (!a) {
    throw new Error("nomals-dw-homebrew-automation | dw-automation API가 아직 준비되지 않았습니다(ready 이전이거나 dw-automation이 비활성화됨).");
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
