// 길티기어/스트라이브 커스텀 액션의 무브 아이템 원본 데이터. 공식
// 컴펜디엄에서 가져오는 게 아니라(dw-automation의 class-grant.js 등과 다른
// 점 — 이건 GM이 만든 완전 신규 홈브루라 컴펜디엄 자체가 없다) 이 모듈이
// 직접 들고 있다가 actor.createEmbeddedDocuments("Item", [...])로 그대로
// 부여한다.
//
// rollType을 빈 문자열로 둔 항목("판정 없음")은 시스템이 주사위 없이 서술
// 카드만 띄운다(공식 컴펜디엄의 Smite/Balance류와 같은 방식) — 실제 발동
// 로직은 features/guilty-gear-*.js가 다른 트리거(접근전 판정 결과, 방어
// 판정, HP/게이지 변화)를 보고 처리한다. 스턴엣지/세이크리드 엣지만 실제로
// 2d6+민첩 판정 UI를 쓰는 별도 아이템이다(기존 "사격" 무브와는 완전히
// 분리 — 이유는 features/guilty-gear-attacks.js 상단 주석 참고).
export const GUILTY_GEAR_MOVE_NAME = "길티기어";
export const STRIVE_MOVE_NAME = "스트라이브";
export const STUN_EDGE_MOVE_NAME = "스턴엣지";
export const DIRE_ECLAIR_MOVE_NAME = "다이어 에클라";
export const FAULTLESS_DEFENSE_MOVE_NAME = "폴트리스 디펜스";
export const SACRED_EDGE_MOVE_NAME = "세이크리드 엣지";
export const RIDE_THE_LIGHTNING_MOVE_NAME = "라이드 더 라이트닝";
export const DRAGON_INSTALL_MOVE_NAME = "드래곤 인스톨";

export const GUILTY_GEAR_ITEM = {
  name: GUILTY_GEAR_MOVE_NAME,
  type: "move",
  img: "icons/svg/aura.svg",
  system: {
    description:
      "게이지 시스템(최대 5)과 세 기술(스턴엣지, 다이어 에클라, 폴트리스 디펜스)이 한 번에 해금된다.<br><br>" +
      "<strong>게이지 획득</strong>: 접근전 판정 결과 7 이상을 얻을 때, 또는 자신의 체력이 줄어들 때마다 +1(최대 5).",
    rollType: "",
    rollMod: 0,
    requiresLevel: 0
  }
};

export const STRIVE_ITEM = {
  name: STRIVE_MOVE_NAME,
  type: "move",
  img: "icons/svg/upgrade.svg",
  system: {
    description:
      "필요: 길티기어, 6레벨 이후 획득 가능.<br><br>" +
      "스턴엣지·다이어 에클라를 게이지 소비 없이 상시 사용할 수 있게 된다. " +
      "세이크리드 엣지, 라이드 더 라이트닝, 드래곤 인스톨 세 가지가 추가로 해금된다.",
    rollType: "",
    rollMod: 0,
    requiresLevel: 6,
    requiresMove: GUILTY_GEAR_MOVE_NAME
  }
};

export const STUN_EDGE_ITEM = {
  name: STUN_EDGE_MOVE_NAME,
  type: "move",
  img: "icons/svg/paralysis.svg",
  system: {
    description: "소비: 게이지 3(스트라이브 이후 무제한). 원거리 판정(민첩)으로 사격한다. 수치 피해는 없다.",
    rollType: "dex",
    rollMod: 0,
    requiresLevel: 0,
    moveResults: {
      success: { value: "명중! 원거리에 있는 대상 하나에게 마비를 건다." },
      partial: { value: "명중하지만 대가가 있다(GM과 상의). 그래도 마비를 걸 수 있다." },
      failure: { value: "빗나간다. 마비를 걸지 못한다." }
    }
  }
};

export const SACRED_EDGE_ITEM = {
  name: SACRED_EDGE_MOVE_NAME,
  type: "move",
  img: "icons/svg/sun.svg",
  system: {
    description:
      "스턴엣지의 강화판. 소비: 게이지 3(드래곤 인스톨 중에는 무제한). 원거리 판정(민첩)으로 사격한다. " +
      "대상에게 마비를 거는 데 성공할 때마다 +1d8 추가 피해 — 횟수 제한 없이, 같은 대상에게 다시 걸어도 매번 터진다.",
    rollType: "dex",
    rollMod: 0,
    requiresLevel: 6,
    requiresMove: STUN_EDGE_MOVE_NAME,
    moveResults: {
      success: { value: "명중! 원거리에 있는 대상 하나에게 마비를 걸고, +1d8 추가 피해를 입힌다." },
      partial: { value: "명중하지만 대가가 있다(GM과 상의). 마비와 +1d8 추가 피해는 그대로 적용된다." },
      failure: { value: "빗나간다. 마비를 걸지 못한다." }
    }
  }
};

export const DIRE_ECLAIR_ITEM = {
  name: DIRE_ECLAIR_MOVE_NAME,
  type: "move",
  img: "icons/svg/explosion.svg",
  system: {
    description:
      "소비: 게이지 3(스트라이브 이후 무제한). 판정 없음 — 이번 접근전 액션이 실패하지 않았을 때" +
      "(성공 또는 부분 성공) 발동할 수 있다. 그 접근전으로 피해를 입힌 대상에게 추가로 마비를 건다.",
    rollType: "",
    rollMod: 0,
    requiresLevel: 0
  }
};

export const RIDE_THE_LIGHTNING_ITEM = {
  name: RIDE_THE_LIGHTNING_MOVE_NAME,
  type: "move",
  img: "icons/svg/lightning.svg",
  system: {
    description:
      "다이어 에클라의 강화판. 소비: 게이지 3(드래곤 인스톨 중에는 무제한). 판정 없음 — 다이어 에클라와 같은 " +
      "조건(접근전 액션이 실패하지 않았을 때)으로 발동한다. 마비를 걸 때마다 +1d8 추가 피해, 횟수 제한 없음.",
    rollType: "",
    rollMod: 0,
    requiresLevel: 6,
    requiresMove: DIRE_ECLAIR_MOVE_NAME
  }
};

export const FAULTLESS_DEFENSE_ITEM = {
  name: FAULTLESS_DEFENSE_MOVE_NAME,
  type: "move",
  img: "icons/svg/holy-shield.svg",
  system: {
    description:
      "기본 액션 '방어'와 연계된다. 방어를 판정할 때 원하는 만큼 게이지를 소비할 수 있다. 소비한 만큼 예비를 " +
      "추가로 얻는다(게이지 1점 = 예비 1점) — 방어의 원래 +체 판정 결과와는 별개로 붙는 보너스다. 드래곤 " +
      "인스톨 중에도 예외 없이 게이지가 실제로 깎인다.",
    rollType: "",
    rollMod: 0,
    requiresLevel: 0
  }
};

export const DRAGON_INSTALL_ITEM = {
  name: DRAGON_INSTALL_MOVE_NAME,
  type: "move",
  img: "icons/svg/fire.svg",
  system: {
    description:
      "발동 조건: HP가 최대치의 30% 이하(소수점 반올림)이면서 게이지가 최대치(5)일 때 자동으로 발동한다.<br><br>" +
      "이 상태 동안 스턴엣지·다이어 에클라·세이크리드 엣지·라이드 더 라이트닝을 게이지 소비 없이 난사할 수 있다.<br><br>" +
      "종료: HP가 다시 30%를 넘으면 즉시 해제된다.",
    rollType: "",
    rollMod: 0,
    requiresLevel: 6,
    requiresMove: STRIVE_MOVE_NAME
  }
};

// 길티기어가 부여할 때 함께 심을 세 기술.
export const GUILTY_GEAR_UNLOCK_ITEMS = [STUN_EDGE_ITEM, DIRE_ECLAIR_ITEM, FAULTLESS_DEFENSE_ITEM];

// 스트라이브가 부여할 때 함께 심을 세 기술.
export const STRIVE_UNLOCK_ITEMS = [SACRED_EDGE_ITEM, RIDE_THE_LIGHTNING_ITEM, DRAGON_INSTALL_ITEM];
