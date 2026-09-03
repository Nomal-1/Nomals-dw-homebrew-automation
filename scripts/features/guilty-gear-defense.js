// 폴트리스 디펜스: 기본 액션 "방어"에 얹는 규칙이라 별도 판정이 없다.
// dw-automation의 features/defend.js가 이미 "방어" 판정 결과를 보고 예비
// (hold)를 계산해 flags["dw-automation"].defendReserve에 저장하는데, 그
// 값 자체를 이 모듈이 계산/소모하는 게 아니라(내부 로직을 다시 만들면
// 대신 맞기/반격 등 이미 있는 선택지 UI가 전부 중복 구현이 된다) 여기서는
// "게이지를 쓴 만큼 그 예비에 더 얹기"만 한다 — 액터 플래그는 문서 데이터라
// 직접 읽고 쓰는 게 정상적인 상호운용이고(README/module.json에 적은 "내부
// 스크립트 파일을 import하지 않는다" 원칙은 코드 재사용에 대한 것이지, 이런
// 액터 데이터 상호작용까지 막는 게 아니다), dw-automation 쪽 예비 소비 UI
// (promptDefendChoice 등)는 그대로 재사용된다.
import { SETTINGS } from "../constants.js";
import { getMoveCardInfo, announceActionApplied } from "../lib/dw-api.js";
import { isGuiltyGearEnabled, splitCommaList, hasGuiltyGear, getGauge, trySpendGauge } from "../lib/guilty-gear-state.js";
import { FAULTLESS_DEFENSE_MOVE_NAME } from "../data/guilty-gear-items.js";

const DW_AUTOMATION_MODULE_ID = "dw-automation";
const DEFEND_RESERVE_FLAG = "defendReserve";

function getDwAutomationReserve(actor) {
  return Number(actor.getFlag(DW_AUTOMATION_MODULE_ID, DEFEND_RESERVE_FLAG)) || 0;
}

async function addDwAutomationReserve(actor, amount) {
  const next = Math.max(0, getDwAutomationReserve(actor) + amount);
  await actor.setFlag(DW_AUTOMATION_MODULE_ID, DEFEND_RESERVE_FLAG, next);
}

function promptGaugeSpend(actor, maxGauge) {
  return new Promise((resolve) => {
    new Dialog({
      title: FAULTLESS_DEFENSE_MOVE_NAME,
      content: `
        <form>
          <p>${game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.FaultlessDefensePrompt", { gauge: maxGauge })}</p>
          <div class="form-group">
            <input type="number" name="amount" value="0" min="0" max="${maxGauge}">
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: game.i18n.localize("NOMALS_DW_HOMEBREW.Confirm"),
          callback: (html) => resolve(Math.max(0, Math.min(maxGauge, Number(html.find('[name="amount"]').val()) || 0)))
        },
        cancel: { label: game.i18n.localize("NOMALS_DW_HOMEBREW.Cancel"), callback: () => resolve(0) }
      },
      default: "ok",
      close: () => resolve(0)
    }).render(true);
  });
}

function onCreateChatMessage(message, options, userId) {
  if (game.system.id !== "dungeonworld") return;
  if (!isGuiltyGearEnabled()) return;
  if (userId !== game.user.id) return;

  const info = getMoveCardInfo(message);
  if (!info) return;
  const { actor, title } = info;
  if (actor.type !== "character") return;
  if (!hasGuiltyGear(actor)) return;

  const hasFaultless = actor.items.some((i) => i.type === "move" && i.name === FAULTLESS_DEFENSE_MOVE_NAME);
  if (!hasFaultless) return;

  const defendNames = splitCommaList(SETTINGS.GUILTY_GEAR_DEFEND_MOVE_NAMES);
  if (!defendNames.includes(title)) return;

  const gauge = getGauge(actor);
  if (gauge <= 0) return; // 쓸 게 없으면 물어보지 않는다.

  (async () => {
    const spend = await promptGaugeSpend(actor, gauge);
    if (spend <= 0) return;

    const spent = await trySpendGauge(actor, spend);
    if (!spent) return;

    await addDwAutomationReserve(actor, spend);
    announceActionApplied(
      actor,
      FAULTLESS_DEFENSE_MOVE_NAME,
      game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.FaultlessDefenseApplied", { spend })
    );
  })();
}

export function registerGuiltyGearDefense() {
  Hooks.on("createChatMessage", onCreateChatMessage);
}
