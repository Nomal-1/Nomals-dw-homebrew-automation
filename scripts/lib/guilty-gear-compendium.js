// GM이 설정 메뉴 버튼(apps/guilty-gear-compendium-menu.js)을 눌렀을 때만
// 실행된다 — 자동으로 실행되지 않는다. 진짜 Foundry 컴펜디엄을 만드는
// 이유는 dw-automation의 lib/race-core-compendium.js와 같다: 레벨업 창의
// "배우기" 버튼과 별개로, GM이 아무 캐릭터에게나 언제든 드래그해서 넣을 수
// 있게 하기 위함이다(빌드 도구 없이 실행 중인 Foundry가 그 자리에서 만든다).
import {
  GUILTY_GEAR_ITEM,
  STRIVE_ITEM,
  GUILTY_GEAR_UNLOCK_ITEMS,
  STRIVE_UNLOCK_ITEMS,
  GUILTY_GEAR_MOVE_NAME,
  STRIVE_MOVE_NAME
} from "../data/guilty-gear-items.js";

const PACK_NAME = "guilty-gear-actions";

const GROUPS = [
  { folderName: GUILTY_GEAR_MOVE_NAME, items: [GUILTY_GEAR_ITEM, ...GUILTY_GEAR_UNLOCK_ITEMS] },
  { folderName: STRIVE_MOVE_NAME, items: [STRIVE_ITEM, ...STRIVE_UNLOCK_ITEMS] }
];

async function getOrCreatePack() {
  const existing = game.packs.get(`world.${PACK_NAME}`);
  if (existing) return existing;

  return CompendiumCollection.createCompendium({
    type: "Item",
    label: game.i18n.localize("NOMALS_DW_HOMEBREW.GuiltyGearCompendium.PackLabel"),
    name: PACK_NAME,
    system: game.system.id
  });
}

async function getOrCreateFolder(pack, folderName) {
  const existing = pack.folders.find((f) => f.name === folderName);
  if (existing) return existing;

  return Folder.create({ name: folderName, type: "Item", parent: null }, { pack: pack.collection });
}

// 이미 있는 폴더/아이템은 건드리지 않고 없는 것만 채워 넣는다 — GM이 이름이나
// 내용을 고쳐놓은 뒤에 이 버튼을 다시 눌러도 덮어써지지 않는다(dw-automation의
// createOrUpdateRaceCoreCompendium과 같은 원칙).
export async function createOrUpdateGuiltyGearCompendium() {
  const pack = await getOrCreatePack();
  await pack.getIndex();

  let created = 0;
  let skipped = 0;

  for (const group of GROUPS) {
    const folder = await getOrCreateFolder(pack, group.folderName);

    for (const item of group.items) {
      if (pack.index.some((e) => e.name === item.name)) {
        skipped++;
        continue;
      }

      await Item.create({ ...item, folder: folder.id }, { pack: pack.collection });
      created++;
    }
  }

  return { pack, created, skipped };
}
