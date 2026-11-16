# Как твикер подкладывает правки в игру (проверено 16.11.2026, GeneralsX 1.0.7)

Зонд: файл `~/GeneralsX/GeneralsZH/Data/INI/GameData/ZHT_probe.ini` с блоком `GameData` был прочитан движком:
журнал `[INI] load('Data/INI/GameData/ZHT_probe.ini')`, `loadFileDirectory('Data\INI\GameData') END - filesRead=2`.

Движок для каждого типа читает `Data\INI\<Тип>.ini` из архива и затем **все файлы каталога** `Data\INI\<Тип>\`
(Object, Weapon, Locomotor, CommandSet, CommandButton, PlayerTemplate, Science, Upgrade, FXList,
ObjectCreationList, GameData, MappedImages и т.д.). Поэтому:

- новые блоки (`Cmdr_*`, `FactionCommander`) пишутся в новые файлы `Data/INI/<Тип>/ZHT_*.ini`;
- ванильные файлы не копируются и не заменяются;
- камера: отдельный блок `GameData` в `Data/INI/GameData/ZHT_GameData.ini` (поля применяются поверх, как у `Default\GameData.ini`);
- `generals.csf` один файл, поэтому для новых строк пишется полная копия `Data/English/generals.csf` с добавленными метками.

Неизвестное поле в блоке (`ZhtProbeGarbageField`) игру не уронило, ошибки молча игнорируются,
поэтому проверка перед записью в твикере обязательна.
