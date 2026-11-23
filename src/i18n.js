// Interface language (ru/en). One local user, so the language is a process-wide setting
// saved in <tweakerDir>/settings.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

let lang = 'ru';
export const getLang = () => lang;
export const setLang = l => { lang = l === 'en' ? 'en' : 'ru'; return lang; };
// Inline pair for strings with parameters.
export const L = (ru, en) => (lang === 'en' ? en : ru);
// Dictionary lookup for fixed Russian strings (labels, module names).
export const tr = s => (lang === 'en' && s != null && EN[s]) || s;

const file = dir => join(dir, 'settings.json');
// Returns the saved language, or null when the user never chose one.
export function loadLang(dir) {
  try { const l = JSON.parse(readFileSync(file(dir), 'utf8')).lang; if (l) { setLang(l); return l; } } catch {}
  setLang('ru');
  return null;
}
export function saveLang(dir, l) {
  setLang(l);
  mkdirSync(dir, { recursive: true });
  let s = {};
  try { s = JSON.parse(readFileSync(file(dir), 'utf8')); } catch {}
  writeFileSync(file(dir), JSON.stringify({ ...s, lang }, null, 2));
  return lang;
}

export const EN = {
  // Field labels
  'Цена': 'Cost',
  'Время постройки, с': 'Build time, s',
  'Энергия (плюс даёт, минус потребляет)': 'Power (plus produces, minus consumes)',
  'Энергия от улучшения': 'Power from upgrade',
  'Обзор': 'Vision',
  'Открывает карту в радиусе': 'Reveals map within radius',
  'Сколько мест занимает в транспорте': 'Transport slots it takes',
  'Опыт за уничтожение (по званиям)': 'Experience for killing it (per rank)',
  'Опыт для званий': 'Experience needed for ranks',
  'Получает опыт': 'Gains experience',
  'Давит (уровень)': 'Crusher level',
  'Давится (уровень)': 'Crushable level',
  'Набор кнопок': 'Command set',
  'Ходовая (режим и запись)': 'Locomotor (mode and entry)',
  'Типы объекта': 'Object kinds',
  'Сторона': 'Side',
  'Здоровье': 'Health',
  'Здоровье при появлении': 'Starting health',
  'Оружие (слот и запись)': 'Weapon (slot and entry)',
  'PRIMARY основное, SECONDARY дополнительное, TERTIARY третье': 'PRIMARY main, SECONDARY second, TERTIARY third',
  'Когда действует набор': 'When this set is active',
  'Броня': 'Armor',
  'Мест для пассажиров': 'Passenger slots',
  'Пассажиры стреляют изнутри': 'Passengers can fire from inside',
  'Кого можно сажать': 'Who can get in',
  'Кого нельзя сажать': 'Who cannot get in',
  'Урон пассажирам при гибели транспорта': 'Damage to passengers when destroyed',
  'Задержка высадки, мс': 'Unload delay, ms',
  'Пассажиры при появлении': 'Passengers at spawn',
  'Лечение пассажиров, % в секунду': 'Passenger healing, % per second',
  'Мест в гарнизоне': 'Garrison slots',
  'Урон гарнизону, когда здание разрушено': 'Damage to garrison when the building is destroyed',
  'Солдаты укрыты внутри: их не видно и по ним нельзя стрелять': 'Soldiers are hidden inside and cannot be shot',
  'Полное лечение внутри, мс': 'Full heal inside, ms',
  'Очередь производства': 'Production queue',
  'Лечение за раз': 'Heal per tick',
  'Пауза лечения, мс': 'Heal delay, ms',
  'Скорость': 'Speed',
  'Скорость с повреждениями': 'Speed when damaged',
  'Скорость поворота': 'Turn rate',
  'Разгон': 'Acceleration',
  'Урон': 'Damage',
  'Радиус поражения': 'Damage radius',
  'Урон по краю': 'Edge damage',
  'Радиус урона по краю': 'Edge damage radius',
  'Дальность': 'Range',
  'Минимальная дальность': 'Minimum range',
  'Перезарядка, мс': 'Reload, ms',
  'Выстрелов в обойме': 'Shots per clip',
  'Перезарядка обоймы, мс': 'Clip reload, ms',
  'Тип урона': 'Damage type',
  'Как гибнет цель': 'How the target dies',
  'Скорость снаряда': 'Projectile speed',
  'Снаряд': 'Projectile',
  'Допуск прицеливания, градусы': 'Aim tolerance, degrees',
  '180: стреляет в любую сторону без поворота': '180: fires in any direction without turning',
  'Создаёт при выстреле': 'Spawns on fire',
  'Создаёт при взрыве снаряда': 'Spawns on projectile hit',
  'Эффект выстрела': 'Fire effect',
  'Эффект взрыва снаряда': 'Projectile hit effect',
  'Кого задевает взрыв': 'Who the blast affects',
  'Бьёт по воздуху (техника)': 'Hits aircraft',
  'Бьёт по воздуху (пехота)': 'Hits airborne infantry',
  'Бьёт по земле': 'Hits ground',
  'Сбивает ракеты': 'Shoots down missiles',
  'Перезарядка обоймы': 'Clip reload',
  'Оружие при гибели': 'Weapon on death',
  'Создаёт объекты': 'Spawns objects',
  // Module names
  'Корпус': 'Body',
  'Корпус здания': 'Structure body',
  'Неуничтожимый корпус': 'Indestructible body',
  'Бессмертный корпус': 'Immortal body',
  'Транспорт': 'Transport',
  'Отсек на Оверлорде': 'Overlord bay',
  'Отсек вертолёта': 'Helicopter bay',
  'Гарнизон': 'Garrison',
  'Туннель': 'Tunnel',
  'Парашют': 'Parachute',
  'Хакеры': 'Hackers',
  'Пещера': 'Cave',
  'Лечебный отсек': 'Healing bay',
  'Производство': 'Production',
  'Выход построенных': 'Production exit',
  'Самолечение': 'Self-repair',
  'Электростанция': 'Power plant',
  'Улучшение электростанции': 'Power plant upgrade',
  'Поведение': 'Behavior',
  'Поведение самолёта': 'Jet behavior',
  'Поведение строителя': 'Dozer behavior',
  'Поведение рабочего': 'Worker behavior',
  'Поведение вертолёта': 'Helicopter behavior',
  'Поведение транспорта': 'Transport behavior',
  'Физика': 'Physics',
  'Гибель': 'Death',
  'Создаёт при гибели': 'Spawns on death',
  'Спецспособность': 'Special power',
  'Невидимость': 'Stealth',
  'Обнаружение невидимых': 'Stealth detection',
  'Создание по улучшению': 'Spawn on upgrade',
  'Смена оружия по улучшению': 'Weapon change on upgrade',
  'Броня по улучшению': 'Armor on upgrade',
  'Здоровье по улучшению': 'Health on upgrade',
  'Модель': 'Model',
  'Модель танка': 'Tank model',
  'Модель машины': 'Vehicle model',
  'Удаление при гибели': 'Removal on death',
  'Опыт по улучшению': 'Experience on upgrade',
  'Звание при постройке': 'Rank when built',
  'Радар': 'Radar',
  'Разведка': 'Spy vision',
  'Кнопки по улучшению': 'Buttons on upgrade',
  'Ускорение производства': 'Faster production',
  'Оружие': 'Weapons',
  'Требования для постройки': 'Build requirements',
  'Звуки': 'Sounds',
  // Unit card tiles
  'Время постройки': 'Build time',
  'Мест внутри': 'Slots inside',
  'Энергия': 'Power',
  'Доход': 'Income',
  'Доход раз в': 'Income every',
  'Ящиков на складе': 'Boxes in warehouse',
  'Везёт ящиков за рейс': 'Boxes per trip',
  'Деньги за взлом': 'Cash per hack',
  'Очередь постройки': 'Build queue',
  'Плюс даёт энергию, минус потребляет': 'Plus produces power, minus consumes it',
  'с': 's',
  // Change list
  'Начальное здоровье': 'Starting health',
  'Основное оружие': 'Main weapon',
  'Дополнительное оружие': 'Second weapon',
  'Третье оружие': 'Third weapon',
  'Общие настройки': 'General settings',
};
