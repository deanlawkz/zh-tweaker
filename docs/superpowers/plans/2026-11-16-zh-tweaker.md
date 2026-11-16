# ZH Tweaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Локальный веб-твикер для ванильного Zero Hour на GeneralsX: камера, фракция Commander со всем подряд и универсальный редактор её юнитов, зданий, оружия и наборов команд с иконками из игры.

**Architecture:** Node-сервер на `127.0.0.1:4170` читает `.big`-архивы игры (только чтение), строит модель INI с сохранением текста, собирает Commander как набор `Cmdr_`-копий, накладывает правки пользователя из `tweaks.json` и пишет итоговые INI/CSF как отдельные файлы поверх архивов. Интерфейс: статические HTML/JS-модули без сборки, русский язык, сетки иконок.

**Tech Stack:** Node 26 (ESM, `node:http`, `node:zlib`, `node:test`), без внешних зависимостей. Интерфейс: HTML + CSS + ES-модули.

**Spec:** `docs/superpowers/specs/2026-11-16-zh-tweaker-design.md`

## Global Constraints

- Данные игры: `~/GeneralsX/GeneralsZH` (ZH) и `~/GeneralsX/Generals`. Архивы `.big` только читаются, никогда не пишутся.
- Каталог твикера с данными пользователя: `~/GeneralsX/zh-tweaker/` (`tweaks.json`, `manifest.json`, `cache/icons/*.png`).
- Сервер слушает только `127.0.0.1:4170`.
- Префикс всех объектов Commander: `Cmdr_`. Фракция: `PlayerTemplate FactionCommander`, `Side = Commander`, строка `SIDE:Commander` = «Commander».
- Ванильные записи (без `Cmdr_`) правками пользователя не меняются. Единственная глобальная правка: камера (`MaxCameraHeight`, цель 690).
- Исправление стрельбы из транспорта: `AcceptableAimDelta = 180` на копиях оружия `Cmdr_`-пехоты, включено по умолчанию, выключается переключателем.
- Интерфейс полностью на русском; названия юнитов английские из `generals.csf`; никаких голых текстовых списков юнитов, везде иконки из игры.
- Не использовать длинное тире в текстах интерфейса.
- INI-текст: кодировка latin1, переводы строк сохраняются как в источнике (`\r\n`).

## Review Focus

1. **Повторный «Применить» после правок.** Ожидание: результат всегда строится из чистой ванили, правки не накапливаются дважды. Тест в Task 7: `apply` дважды подряд даёт побайтно одинаковые файлы.
2. **«Сбросить всё» не трогает чужие файлы.** Если пользователь сам положил что-то в `Data/INI`, сброс удаляет только файлы из `manifest.json`. Тест в Task 7.
3. **Ссылка на несуществующую запись** (оружие удалено, опечатка в свободной правке). Ожидание: «Применить» ничего не пишет и показывает, какой объект и поле сломаны. Тест в Task 7.
4. **Переполнение кнопок в наборе команд** (больше слотов, чем умеет движок). Ожидание: понятная ошибка с перечнем того, что не влезло, а не молча обрезанный набор. Тест в Task 6.
5. **Объект без иконки или с отсутствующей текстурой.** Ожидание: заглушка, сервер не падает. Тест в Task 4.

---

## Структура файлов

```
zh-tweaker/
  package.json                 "type":"module", scripts: start, test
  src/paths.js                 пути игры и каталога твикера (переопределяются env для тестов)
  src/big.js                   чтение BIG-архивов и виртуальная файловая система
  src/ini.js                   разбор INI в блоки с позициями, правка с сохранением текста
  src/csf.js                   чтение/запись generals.csf
  src/gamedb.js                загрузка всех нужных INI, индексы объектов/оружия/наборов/картинок/имён
  src/icons.js                 MappedImage → вырезка из TGA → PNG (кэш)
  src/commander.js             сборка фракции Commander из ванили
  src/tweaks.js                модель правок, применение к БД, проверка ссылок
  src/output.js                запись файлов переопределения, manifest, сброс
  src/labels.js                русские подписи и границы частых полей
  src/server.js                HTTP API + статика
  public/index.html, public/app.js, public/views/*.js, public/style.css
  launcher/make-app.sh         сборка «ZH Tweaker.app» в /Applications
  test/*.test.js               node:test; тесты на реальных архивах пропускаются, если их нет
```

---

### Task 1: Чтение архивов и проверка механизма переопределения

**Files:**
- Create: `package.json`, `src/paths.js`, `src/big.js`, `scripts/probe-override.sh`
- Test: `test/big.test.js`

**Interfaces:**
- Produces:
  - `paths.js`: `GAME_ZH`, `GAME_GEN`, `TWEAKER_DIR` (из env `ZHT_GAME_ZH`, `ZHT_GAME_GEN`, `ZHT_DIR`, иначе значения из Global Constraints).
  - `big.js`: `readBigIndex(file: string): Array<{name: string, offset: number, size: number}>`; `class Vfs { static async open(dirs: string[]): Vfs; has(name): boolean; read(name): Buffer; list(prefix: string): string[]; sourceOf(name): string }`. Имена нормализуются: нижний регистр, `/` → `\`. Порядок архивов: по каталогу ZH, затем Generals; внутри каталога по алфавиту; **побеждает первый встреченный** (как в движке, отсюда приём с `!` в имени).

- [ ] **Step 1: Тесты**

```js
test('readBigIndex читает синтетический BIGF', () => {
  // собрать в tmp архив из 2 файлов: заголовок 'BIGF', size LE, count BE, headerSize BE, затем записи (offset BE, size BE, name\0)
  assert.deepEqual(readBigIndex(tmp).map(e => e.name), ['Data\\INI\\A.ini', 'Data\\INI\\B.ini']);
});
test('Vfs: первый архив по алфавиту побеждает', ...); // !a.big и b.big содержат один файл с разным текстом → read() отдаёт из !a.big
test('реальный INIZH.big', { skip: !existsSync(GAME_ZH) }, async () => {
  const v = await Vfs.open([GAME_ZH, GAME_GEN]);
  assert.match(v.read('data\\ini\\gamedata.ini').toString('latin1'), /MaxCameraHeight = 310\.0/);
  assert.ok(v.list('data\\ini\\object\\').length >= 30);
});
```

- [ ] **Step 2: Запустить `node --test test/big.test.js`, ожидать FAIL (модуль не найден)**
- [ ] **Step 3: Реализовать `big.js`, `paths.js`, `package.json`**
- [ ] **Step 4: `node --test test/big.test.js` → PASS**
- [ ] **Step 5: Проверка переопределения (ручной зонд, без кода твикера).** `scripts/probe-override.sh` кладёт `~/GeneralsX/GeneralsZH/Data/INI/GameData.ini` = ванильный текст с `MaxCameraHeight = 690.0`, плюс намеренно битую строку во втором прогоне. Прогон А (битая строка): запустить `GeneralsXZH.app`, ожидать аварийный выход с ошибкой разбора INI в журнале (`~/Library/Application Support/GeneralsX/` или stderr) → значит, файл читается. Прогон Б (без битой строки): игра стартует. Затем удалить файл.
  Если прогон А **не** падает: переопределение не работает; переключить `output.js` (Task 7) на запись архива `~/GeneralsX/GeneralsZH/!ZHTweaker.big` (писатель BIGF добавить в `big.js` как `writeBig(file, entries: Array<{name, data: Buffer}>)`) и повторить зонд с архивом. Записать результат в `docs/override-mechanism.md`.
- [ ] **Step 6: Commit** `feat: чтение BIG и проверка переопределения`

### Task 2: Модель INI с сохранением текста

**Files:**
- Create: `src/ini.js`
- Test: `test/ini.test.js`

**Interfaces:**
- Produces:
  ```
  parseIni(text: string, file: string): IniFile
  IniFile { file, text, blocks: Block[] ; toString(): string }
  Block { type: string, name: string, start: number, end: number,   // позиции символов, end после строки End
          props: Prop[], modules: Module[], file: string }
  Module { kind: 'Behavior'|'Body'|'Draw'|'ClientUpdate'|'WeaponSet'|'ArmorSet'|'Prerequisites'|'UnitSpecificSounds'|string,
           className: string|null, tag: string|null, start, end, props: Prop[], modules: Module[] }
  Prop { key: string, value: string, start, end }                     // value без комментария
  // правка возвращает новый текст, позиции пересчитываются повторным разбором
  setProp(file: IniFile, owner: Block|Module, key: string, value: string): IniFile   // заменить или вставить перед End
  removeModule(file, block, module): IniFile
  insertModule(file, block, moduleText: string): IniFile             // перед End блока
  blockText(file, block): string
  ```
  Правила разбора: `;` и `//` начинают комментарий; блок верхнего уровня = `<Type> <Name>` … `End`; вложенные модули: строка вида `Behavior = Class Tag`, `Body = Class Tag`, `Draw = Class Tag`, а также `WeaponSet`, `ArmorSet`, `Prerequisites`, `UnitSpecificSounds`, `Turret`, `AltTurret`, `ConditionState`, `DefaultConditionState`, `TransitionState`, `ModelConditionState`, `AnimationState`, любые строки без `=`, за которыми идёт тело с `End`. Блоки без `End` внутри объекта не открываются (строка-значение).

- [ ] **Step 1: Тесты**

```js
const src = 'Object Foo\r\n  BuildCost = 700 ; цена\r\n  Body = ActiveBody ModuleTag_02\r\n    MaxHealth = 240.0\r\n  End\r\n  Behavior = TransportContain ModuleTag_05\r\n    Slots = 5\r\n  End\r\nEnd\r\n';
test('разбор', () => { const f = parseIni(src,'x'); const o=f.blocks[0];
  assert.equal(o.name,'Foo'); assert.equal(o.props[0].value,'700');
  assert.equal(o.modules[1].className,'TransportContain'); assert.equal(o.modules[1].props[0].value,'5'); });
test('setProp сохраняет комментарий и \\r\\n', () => {
  const f = setProp(parseIni(src,'x'), parseIni(src,'x').blocks[0], 'BuildCost', '100');
  assert.ok(f.toString().includes('BuildCost = 100 ; цена\r\n')); });
test('setProp вставляет отсутствующее поле перед End модуля', ...); // Slots-модуль + PassengersAllowedToFire = Yes
test('без правок toString() === исходник для всех реальных INI', { skip: !hasGame }, ...); // все файлы data\ini\**\*.ini из Vfs
test('removeModule и insertModule', ...);
```

- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS**
- [ ] **Step 5: Commit** `feat: модель INI с сохранением текста`

### Task 3: База игры и имена

**Files:**
- Create: `src/csf.js`, `src/gamedb.js`
- Test: `test/csf.test.js`, `test/gamedb.test.js`

**Interfaces:**
- Consumes: `Vfs`, `parseIni`.
- Produces:
  - `csf.js`: `readCsf(buf: Buffer): Map<string,string>` (метки без учёта регистра; формат: заголовок ` FSC`, метки `LBL `, строки `RTS` с побитовой инверсией UTF-16LE); `writeCsf(original: Buffer, add: Map<string,string>): Buffer` (дописывает метки, обновляет счётчики).
  - `gamedb.js`: `async loadGameDb(vfs): GameDb`.
    ```
    GameDb {
      files: Map<path, IniFile>,                          // все data\ini\**\*.ini
      index: { Object, Weapon, Locomotor, CommandSet, CommandButton, Upgrade, Science,
               ObjectCreationList, FXList, MappedImage, PlayerTemplate, Armor }: Map<name, {file, block}>,
      displayName(objName): string | null,               // DisplayName → csf, иначе null
      side(objName): string | null,                       // поле Side
      general(objName): 'Laser'|'SuperWeapon'|'AirForce'|'Tank'|'Infantry'|'Nuke'|'Toxin'|'Demolition'|'Stealth'|'Boss'|null  // по префиксу Lazr_/SupW_/AirF_/Tank_/Infa_/Nuke_/Chem_/Demo_/Slth_/Boss_
      kind(objName): 'unit'|'building'|'other',           // KindOf: STRUCTURE → building; INFANTRY|VEHICLE|AIRCRAFT|HUGE_VEHICLE → unit
      weaponsOf(objName): string[], usersOfWeapon(weapon): string[],
      csf: Map<string,string>, csfRaw: Buffer
    }
    ```
    Если имя встречается в нескольких файлах, побеждает последнее (порядок загрузки движка: `Default\` раньше основного), а дубль записывается в `db.warnings`.

- [ ] **Step 1: Тесты**

```js
test('csf: круговая запись', ...); // readCsf(writeCsf(buf, new Map([['SIDE:Commander','Commander']]))).get('side:commander') === 'Commander'
test('реальная БД', { skip: !hasGame }, async () => {
  const db = await loadGameDb(vfs);
  assert.equal(db.displayName('AmericaVehicleHumvee'), 'Humvee');        // уточнить точную строку по csf, сравнивать без регистра
  assert.equal(db.kind('AmericaVehicleHumvee'), 'unit');
  assert.equal(db.general('AirF_AmericaJetAurora'), 'AirForce');
  assert.ok(db.index.PlayerTemplate.has('FactionBossGeneral'));
  assert.ok(db.weaponsOf('AmericaJetAurora').length > 0);
});
```

- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS**
- [ ] **Step 5: Commit** `feat: база игры, имена из csf`

### Task 4: Иконки из игры

**Files:**
- Create: `src/icons.js`
- Test: `test/icons.test.js`

**Interfaces:**
- Consumes: `GameDb`, `Vfs`.
- Produces: `async iconPng(db, vfs, objName: string, size: 'button'|'portrait'): Buffer | null`. Цепочка: поле `ButtonImage` / `SelectPortrait` объекта → `MappedImage` (`Texture`, `Coords = Left:L Top:T Right:R Bottom:B`) → файл текстуры: искать `art\textures\<tex>` и `data\english\art\textures\<tex>` → TGA (тип 2 несжатый и тип 10 RLE, 24/32 бит, учитывать бит 5 дескриптора: ориентация сверху/снизу) → вырезка → PNG (RGBA, фильтр 0, `zlib.deflateSync`, CRC32 вручную). Кэш: `TWEAKER_DIR/cache/icons/<objName>-<size>.png`. Для `Cmdr_X` иконка берётся у `X`.
- `placeholderPng(): Buffer` (серый квадрат 60×48).

- [ ] **Step 1: Тесты**

```js
test('TGA 32 бит снизу вверх и RLE', ...);      // синтетические 2×2, проверить пиксели после вырезки
test('PNG валиден', ...);                       // сигнатура, IHDR 60×48 для SAHummer (Coords 435,101 → 495,149)
test('Humvee', { skip: !hasGame }, async () => { const p = await iconPng(db, vfs, 'AmericaVehicleHumvee','button');
  assert.equal(p.readUInt32BE(16), 60); assert.equal(p.readUInt32BE(20), 48); });
test('объект без ButtonImage → null, не исключение', ...);
```

- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS**
- [ ] **Step 5: Commit** `feat: иконки юнитов из текстур игры`

### Task 5: Русские подписи полей

**Files:**
- Create: `src/labels.js`
- Test: `test/labels.test.js`

**Interfaces:**
- Produces: `FIELD_LABELS: Record<string, {ru: string, hint?: string, type: 'number'|'bool'|'ref'|'enum'|'text', ref?: 'Weapon'|'Object'|'Upgrade'|'Locomotor'|'ObjectCreationList'|'FXList'|'Armor'|'Science'|'CommandSet', min?: number, max?: number, options?: string[]}>`; ключ `Поле` или `МодульКласс.Поле`; `labelFor(moduleClass: string|null, key: string)`; `MODULE_LABELS: Record<className, string>`.
  Минимальный набор (точные значения): `BuildCost` «Цена» 0–100000; `BuildTime` «Время постройки, с» 0–600; `Body.MaxHealth`/`InitialHealth` «Здоровье» 1–1000000; `EnergyProduction` «Энергия (плюс даёт, минус потребляет)» −1000–1000; `VisionRange` «Обзор»; `ShroudClearingRange` «Открывает карту в радиусе»; `TransportContain.Slots` «Мест для пассажиров» 0–40; `TransportContain.PassengersAllowedToFire` «Пассажиры стреляют изнутри» bool; `AllowInsideKindOf` «Кого можно сажать» enum (INFANTRY, VEHICLE, …); `DamagePercentToUnits` «Урон пассажирам»; `ExitDelay` «Задержка высадки, мс»; `WeaponSet.Weapon` «Оружие» ref Weapon, с подписями слотов PRIMARY «основное», SECONDARY «дополнительное», TERTIARY «третье»; `Locomotor` «Ходовая» ref; `Speed` «Скорость»; `Weapon.PrimaryDamage` «Урон», `PrimaryDamageRadius` «Радиус поражения», `AttackRange` «Дальность», `DelayBetweenShots` «Перезарядка, мс», `ClipSize` «Выстрелов в обойме», `ClipReloadTime` «Перезарядка обоймы, мс», `DamageType` «Тип урона» enum, `ProjectileObject` «Снаряд» ref Object, `AcceptableAimDelta` «Допуск прицеливания, градусы» 0–180, `FireOCL`/`ProjectileDetonationOCL` «Создаёт при выстреле/взрыве» ref OCL, `FireFX`/`ProjectileDetonationFX` «Эффект» ref FXList. Модули: `TransportContain` «Транспорт», `GarrisonContain` «Гарнизон», `ActiveBody` «Корпус», `ProductionUpdate` «Производство», `AutoHealBehavior` «Самолечение» и т.д.

- [ ] **Step 1: Тест** `labelFor('TransportContain','Slots').ru === 'Мест для пассажиров'`; все `ref` указывают на существующий индекс GameDb; ни одна строка не содержит `—`.
- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS** · **Step 5: Commit** `feat: русские подписи полей`

### Task 6: Сборка фракции Commander

**Files:**
- Create: `src/commander.js`
- Test: `test/commander.test.js`

**Interfaces:**
- Consumes: `GameDb`, `ini.js`.
- Produces: `buildCommander(db: GameDb, opts: {aimFix: boolean}): { files: Map<path, string>, csfAdd: Map<string,string>, report: {cloned: number, overflow: Array<{commandSet, dropped: string[]}>} }`. Новые блоки пишутся в отдельные файлы, которые движок грузит наряду с ванильными: `Data\INI\Object\ZHT_Commander.ini`, а `Weapon`, `Locomotor`, `CommandSet`, `CommandButton`, `PlayerTemplate` дописываются в конец копий ванильных файлов (`Data\INI\Weapon.ini` и т.д.), потому что эти типы движок читает из одного файла. Также `Data\INI\Object\` грузится каталогом: проверить это при зонде Task 1; если нет, дописывать объекты в конец `FactionBuilding.ini`.
  Алгоритм:
  1. Множество `B`: все объекты, на которые ссылаются кнопки (`CommandButton` с `Command = UNIT_BUILD | DOZER_CONSTRUCT`, поле `Object`) в наборах команд, достижимых от `StartingBuilding` и `StartingUnit0` каждой играбельной фракции (кроме Boss, Observer, Civilian), рекурсивно через `CommandSet` найденных объектов.
  2. Для каждого `X ∈ B` блок `Object Cmdr_X` = копия текста с заменами: `Side = Commander`; все ссылки на объекты из `B` (в `Prerequisites`, `CommandSet`-ссылки, `BuildVariations`, `DozerAIUpdate`, `ProductionUpdate` и любые значения, совпадающие с именем из `B`) → `Cmdr_…`; `CommandSet = S` → `Cmdr_S`; `Locomotor` → `Cmdr_L`; оружие в `WeaponSet` → `Cmdr_W`.
  3. Копии `CommandSet`, `CommandButton` (поле `Object` → `Cmdr_…`), `Weapon` (если `opts.aimFix` и носитель `KindOf` содержит `INFANTRY`: `AcceptableAimDelta = 180`), `Locomotor`.
  4. Командный центр: `Cmdr_AmericaCommandCenter` с набором `Cmdr_CommandCenterSet` = три строителя (`Cmdr_AmericaVehicleDozer`, `Cmdr_ChinaVehicleDozer`, `Cmdr_GLAInfantryWorker`) + кнопки улучшений/способностей американского ЦК. У каждого строителя набор = объединение зданий всех генералов его стороны без повторов по `displayName` (предпочтение ванильному варианту без префикса генерала). Наборы зданий: объединение юнитов всех генералов стороны, без повторов по `displayName` (кроме случаев, когда у вариантов разные имена). Лимит слотов набора: 14; лишнее → `report.overflow`.
  5. `PlayerTemplate FactionCommander`: копия `FactionAmerica` с `Side = Commander`, `BaseSide = America`, `PlayableSide = Yes`, `OldFaction = No`, `DisplayName = SIDE:Commander`, `StartingBuilding = Cmdr_AmericaCommandCenter`, `StartingUnit0 = Cmdr_AmericaVehicleDozer`, `IntrinsicSciences` = все `Science`, у которых есть `SciencePurchasePointCost` (то есть все генеральские способности), плюс `SCIENCE_AMERICA SCIENCE_CHINA SCIENCE_GLA`.
  6. `csfAdd`: `SIDE:Commander` → `Commander`, `INI:FactionCommander` → `Commander`.

- [ ] **Step 1: Тесты** (на реальных данных, `skip` без игры)

```js
test('Commander собирается', () => { const r = buildCommander(db,{aimFix:true});
  const db2 = dbFromFiles(r.files);                                   // повторный разбор результата
  assert.ok(db2.index.Object.has('Cmdr_AmericaVehicleHumvee'));
  assert.equal(db2.side('Cmdr_AmericaVehicleHumvee'), 'Commander');
  assert.ok(db2.index.PlayerTemplate.has('FactionCommander'));
  assert.equal(r.csfAdd.get('SIDE:Commander'), 'Commander'); });
test('все ссылки Cmdr_ разрешаются', ...);   // каждое значение, начинающееся с Cmdr_, есть в индексе db2
test('пехота получает AcceptableAimDelta 180 только при aimFix', ...); // оружие Cmdr_AmericaInfantryRanger
test('ванильные блоки не изменились', ...);  // текст исходных блоков в r.files совпадает с ванилью
test('переполнение набора попадает в report.overflow', ...); // синтетический набор из 20 кнопок
```

- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS** · **Step 5: Commit** `feat: сборка фракции Commander`

### Task 7: Правки, проверка и запись файлов

**Files:**
- Create: `src/tweaks.js`, `src/output.js`
- Test: `test/tweaks.test.js`, `test/output.test.js`

**Interfaces:**
- Consumes: `GameDb`, `buildCommander`, `ini.js`, `csf.js`.
- Produces:
  ```
  Tweak =
    | {op:'camera', value:number}
    | {op:'aimFix', on:boolean}
    | {op:'set', block:'Object:Cmdr_X'|'Weapon:Cmdr_W'|'Locomotor:Cmdr_L', module?:string /*tag*/, key, value}
    | {op:'removeModule', block, module /*tag*/}
    | {op:'copyModule', from:'Object:X', module /*tag*/, to:'Object:Cmdr_Y'}   // новый тег ModuleTag_ZHT_n
    | {op:'weaponSlot', object:'Cmdr_X', slot:'PRIMARY'|'SECONDARY'|'TERTIARY', weapon:string}  // во всех WeaponSet
    | {op:'commandSlot', commandSet:'Cmdr_S', slot:number, button:string|null}
    | {op:'raw', block, text}
  loadTweaks(): Tweak[]; saveTweaks(t: Tweak[])            // TWEAKER_DIR/tweaks.json, каждая с id и createdAt
  buildOutput(db, tweaks): {files: Map<path,string|Buffer>, errors: Array<{tweakId, block, key, message}>}
  validate(files): errors                                    // ссылки ref-полей из labels.js существуют; блоки закрыты; числа в границах
  async applyOutput(files): void   // пишет в GAME_ZH (или !ZHTweaker.big по Task 1), manifest.json со списком путей и sha1
  async resetOutput(): void        // удаляет только пути из manifest.json, если sha1 совпадает; иначе оставляет и сообщает
  ```
  `weaponSlot` при оружии, которое используется не только этим `Cmdr_`-юнитом, сначала клонирует его в `Cmdr_<W>_<юнит>`. Правка `Weapon:Cmdr_W` касается только копии. «Ядерная бомба как настоящая» получается так: `weaponSlot` на копию бомбы Авроры + `set ProjectileObject` на объект ядерной ракеты (через выпадающий список «Снаряд»), её смерть сама создаёт гриб, радиацию и эффекты, так как они висят на объекте ракеты.

- [ ] **Step 1: Тесты**

```js
test('камера 690', () => assert.match(out.files.get('data\\ini\\gamedata.ini'), /MaxCameraHeight = 690\.0/));
test('Хаммер на 15 мест', () => { /* set Object:Cmdr_AmericaVehicleHumvee ModuleTag_05 Slots 15 */ ... /Slots\s*=\s*15/ });
test('ванильный Humvee не тронут', ...);
test('двойное применение идемпотентно', ...);        // Review Focus 1
test('сброс удаляет только свои файлы', ...);        // Review Focus 2: чужой файл в Data/INI остаётся
test('битая ссылка → errors и нет записи', ...);     // Review Focus 3
test('Аврора: ProjectileObject = ядерная ракета проходит проверку', ...); // имя объекта ракеты найти по db (Weapon ядерной шахты → ProjectileObject)
```

- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS** · **Step 5: Commit** `feat: применение правок и сброс`

### Task 8: HTTP API

**Files:**
- Create: `src/server.js`
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: всё выше.
- Produces (JSON, `127.0.0.1:4170`):
  - `GET /api/objects?side=&general=&kind=&q=` → `[{name, display, side, general, kind, hasIcon}]` (только `Cmdr_`; `q` ищет по display и name)
  - `GET /api/object/:name` → `{name, display, props:[{key,value,label}], modules:[{kind, className, tag, label, props:[…]}], text}`
  - `GET /api/weapon/:name`, `GET /api/refs/:type?q=` (списки для выпадающих: Weapon, Object, Upgrade, OCL, FX, Locomotor, Armor), `GET /api/commandset/:name` → `{slots:[{slot, button, object, iconOf}]}`
  - `GET /icon/:name/:size.png` → PNG или заглушка
  - `GET/POST/DELETE /api/tweaks[/:id]`, `POST /api/apply` → `{ok, errors, written}`, `POST /api/reset`, `POST /api/play` (`open -a /Applications/GeneralsXZH.app`)
  - Статика из `public/`.
- [ ] **Step 1: Тесты** поднять сервер на случайном порту с `ZHT_*` на временные каталоги и синтетическим мини-архивом; проверить коды и формы ответов, `/api/apply` с битой правкой → `ok:false`.
- [ ] **Step 2: FAIL** · **Step 3: реализовать** · **Step 4: PASS** · **Step 5: Commit** `feat: HTTP API`

### Task 9: Интерфейс

**Files:**
- Create: `public/index.html`, `public/style.css`, `public/app.js`, `public/views/grid.js`, `public/views/card.js`, `public/views/weapon.js`, `public/views/commandset.js`, `public/views/general.js`, `public/views/changes.js`

**Interfaces:**
- Consumes: API Task 8.
- Вкладки: «Камера и общее» (поле высоты камеры, переключатель «Стрельба изнутри во все стороны»), «Юниты и здания» (сетка иконок по стороне → генерал, поиск; клик → карточка с портретом, формами модулей, кнопками «Взять у другого», «Удалить модуль», «Показать текст»), «Оружие» (сетка иконок носителей; карточка оружия), «Что строят здания» (сетка зданий → слоты как в игре, клик по слоту → сетка иконок для выбора), «Commander» (отчёт сборки, переполнения), «Изменения» (список с отменой). Вверху: «Применить», «Сбросить всё», «Играть»; ошибки проверки показываются над карточкой с названием объекта и поля. Тёмная тема, шрифт от 15px.
- [ ] **Step 1:** Запустить `npm start`, открыть `http://127.0.0.1:4170` в панели браузера, пройти сценарий: найти Humvee по иконке → Транспорт → 15 мест → Применить → в `GAME_ZH` появился файл с `Slots = 15` у `Cmdr_AmericaVehicleHumvee`. Снимок экрана.
- [ ] **Step 2:** Сценарий «снайпер в казармах»: «Что строят здания» → казармы США Commander → пустой слот → иконка снайпера Китая/GLA (по имени из db) → Применить → без ошибок.
- [ ] **Step 3:** Сценарий «Аврора»: карточка Авроры → основное оружие → «Снаряд» → ядерная ракета → Применить → без ошибок.
- [ ] **Step 4: Commit** `feat: интерфейс`

### Task 10: Значок запуска и проверка в игре

**Files:**
- Create: `launcher/make-app.sh`, `README.md`

**Interfaces:**
- `make-app.sh` собирает `/Applications/ZH Tweaker.app` (через `osacompile`): если на `127.0.0.1:4170` никто не слушает, запускает `node <repo>/src/server.js` в фоне с журналом `TWEAKER_DIR/server.log`, затем `open http://127.0.0.1:4170`. Иконка: портрет командного центра из игры (`iconutil` из PNG).
- [ ] **Step 1:** `bash launcher/make-app.sh` → приложение есть, двойной запуск не поднимает второй сервер.
- [ ] **Step 2: Проверка в игре** (с пользователем, так как снимки экрана из игры недоступны): Применить (камера 690 + хаммер 15 + Аврора), «Играть», схватка против ИИ за Commander: фракция видна в лобби как «Commander», стартует командный центр и бульдозер, строятся три строителя, камера поднимается выше обычного, в хаммер садятся 15 солдат и стреляют по целям сбоку и сзади, бомба Авроры даёт ядерный гриб. Найденные проблемы → новые задачи.
- [ ] **Step 3:** «Сбросить всё» → игра снова ванильная (Commander нет в лобби).
- [ ] **Step 4: Commit** `feat: значок запуска, README`
