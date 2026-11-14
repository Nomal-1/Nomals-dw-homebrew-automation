import { MODULE_ID, SETTINGS } from "../constants.js";
import {
  GUILTY_GEAR_MOVE_NAME,
  STRIVE_MOVE_NAME,
  STUN_EDGE_MOVE_NAME,
  SACRED_EDGE_MOVE_NAME,
  DIRE_ECLAIR_MOVE_NAME,
  RIDE_THE_LIGHTNING_MOVE_NAME,
  FAULTLESS_DEFENSE_MOVE_NAME,
  DRAGON_INSTALL_MOVE_NAME
} from "../data/guilty-gear-items.js";

// dw-automation(0.122+)의 직업별 자동화 창에 이 모듈의 자동화를 알린다. 그 창은 자기
// 모듈의 설정만 보고 기능을 찾기 때문에, 알리지 않으면 길티기어 액션들이 "자동화 없음"으로
// 보인다. 켜기 설정은 이 모듈의 것(길티기어/스트라이브 자동화 켜기) 하나를 모두 같이 쓴다 —
// 창에서도 "함께 켜지고 꺼짐"으로 보인다. 창이 표를 만들 때마다 이 훅을 부르므로 모듈
// ready 순서와 상관없다. 옛 dw-automation은 이 훅을 부르지 않으니 아무 일도 없다.
const L = (key) => `NOMALS_DW_HOMEBREW.ClassAutomation.${key}`;

export function registerClassAutomationFeatures() {
  Hooks.on("dwAutomationCollectFeatures", (register) => {
    const base = { namespace: MODULE_ID, enableKey: SETTINGS.ENABLE_GUILTY_GEAR_ASSISTANT };
    register({
      ...base,
      label: L("Gauge.Label"),
      hint: L("Gauge.Hint"),
      names: [GUILTY_GEAR_MOVE_NAME],
      nameKeys: [SETTINGS.GUILTY_GEAR_MOVE_NAMES],
      reactingNameKeys: [SETTINGS.GUILTY_GEAR_MELEE_MOVE_NAMES]
    });
    register({ ...base, label: L("Edge.Label"), hint: L("Edge.Hint"), names: [STUN_EDGE_MOVE_NAME, SACRED_EDGE_MOVE_NAME] });
    register({
      ...base,
      label: L("Melee.Label"),
      hint: L("Melee.Hint"),
      names: [DIRE_ECLAIR_MOVE_NAME, RIDE_THE_LIGHTNING_MOVE_NAME],
      reactingNameKeys: [SETTINGS.GUILTY_GEAR_MELEE_MOVE_NAMES]
    });
    register({
      ...base,
      label: L("Faultless.Label"),
      hint: L("Faultless.Hint"),
      names: [FAULTLESS_DEFENSE_MOVE_NAME],
      reactingNames: ["Defend"],
      reactingNameKeys: [SETTINGS.GUILTY_GEAR_DEFEND_MOVE_NAMES]
    });
    register({
      ...base,
      label: L("Strive.Label"),
      hint: L("Strive.Hint"),
      names: [STRIVE_MOVE_NAME],
      nameKeys: [SETTINGS.STRIVE_MOVE_NAMES]
    });
    register({ ...base, label: L("Dragon.Label"), hint: L("Dragon.Hint"), names: [DRAGON_INSTALL_MOVE_NAME] });
  });
}
