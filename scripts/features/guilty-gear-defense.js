// 폴트리스 디펜스: "방어" 판정을 굴리기 전에 게이지를 원하는 만큼 소비해서
// 그 판정 자체에 보정치(+N)를 더한다 — 판정 결과가 나온 뒤에 예비(hold)로
// 환산해서 얹는 방식이 아니다(v0.2.0에서는 그렇게 만들었었는데, 실제
// 의도와 달랐다). dw-automation의 방어 예비 계산(성공 3/부분성공 1/실패
// 0 + 견고한 방어 보너스 등)은 건드리지 않는다 — 게이지 보정이 이미
// 반영된 판정 결과를 보고 dw-automation이 항상 하던 대로 알아서 계산한다.
//
// 이 파일은 훅을 직접 등록하지 않는다. 판정 자체를 가로채야 하는데,
// libWrapper는 같은 모듈이 같은 대상(game.dungeonworld.ItemDw.prototype.roll)을
// 두 번 wrap하면 에러를 던진다(dw-automation의 lib/roll-wrapper.js 상단
// 주석이 실제로 겪은 버그로 기록해둔 것과 같은 함정). 그래서 스턴엣지/
// 세이크리드 엣지 게이트가 이미 등록해둔 단 하나의 wrappedRoll
// (features/guilty-gear-attacks.js)에서 이 파일의 promptFaultlessDefenseBonus를
// 호출하는 방식으로 합친다.
import { SETTINGS } from "../constants.js";
import { splitCommaList, hasGuiltyGear, getGauge, trySpendGauge } from "../lib/guilty-gear-state.js";
import { announceActionApplied } from "../lib/dw-api.js";
import { FAULTLESS_DEFENSE_MOVE_NAME } from "../data/guilty-gear-items.js";

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

// item이 "방어"(GUILTY_GEAR_DEFEND_MOVE_NAMES) 판정이고 이 액터가 폴트리스
// 디펜스를 배웠으면 게이지 소비 다이얼로그를 띄우고, 실제로 쓴 만큼
// 게이지를 깎은 뒤 그 값을 반환한다(굴림 직전에 rollMod에 더할 값 —
// 호출부인 guilty-gear-attacks.js의 wrappedRoll이 실제로 반영한다). 해당
// 없으면 0을 반환해서 아무 것도 안 건드리게 한다.
export async function promptFaultlessDefenseBonus(item, actor) {
  const defendNames = splitCommaList(SETTINGS.GUILTY_GEAR_DEFEND_MOVE_NAMES);
  if (!defendNames.includes(item.name)) return 0;
  if (!hasGuiltyGear(actor)) return 0;

  const hasFaultless = actor.items.some((i) => i.type === "move" && i.name === FAULTLESS_DEFENSE_MOVE_NAME);
  if (!hasFaultless) return 0;

  const gauge = getGauge(actor);
  if (gauge <= 0) return 0;

  const spend = await promptGaugeSpend(actor, gauge);
  if (spend <= 0) return 0;

  const spent = await trySpendGauge(actor, spend);
  if (!spent) return 0;

  announceActionApplied(
    actor,
    FAULTLESS_DEFENSE_MOVE_NAME,
    game.i18n.format("NOMALS_DW_HOMEBREW.GuiltyGear.FaultlessDefenseApplied", { spend })
  );

  return spend;
}
