// Labels for common INI fields and modules (Russian here, English in i18n.js).
import { getLang, tr } from './i18n.js';
// Key: "Field" (any owner) or "ModuleClass.Field" (specific module).

const n = (ru, min, max, hint) => ({ ru, type: 'number', min, max, hint });
const b = (ru, hint) => ({ ru, type: 'bool', hint });
const r = (ru, ref, hint) => ({ ru, type: 'ref', ref, hint });
const e = (ru, options, hint) => ({ ru, type: 'enum', options, hint });
const t = (ru, hint) => ({ ru, type: 'text', hint });

const KINDS = ['INFANTRY', 'VEHICLE', 'AIRCRAFT', 'HUGE_VEHICLE', 'STRUCTURE', 'DOZER', 'HARVESTER', 'PORTABLE_STRUCTURE'];
const DAMAGE = ['ARMOR_PIERCING', 'SMALL_ARMS', 'EXPLOSION', 'FLAME', 'POISON', 'RADIATION', 'LASER', 'GATTLING',
  'INFANTRY_MISSILE', 'AURORA_BOMB', 'SNIPER', 'PARTICLE_BEAM', 'JET_MISSILES', 'STEALTHJET_MISSILES',
  'MOLOTOV_COCKTAIL', 'COMANCHE_VULCAN', 'SUBDUAL_MISSILE', 'SUBDUAL_VEHICLE', 'SUBDUAL_BUILDING',
  'MICROWAVE', 'KILL_GARRISONED', 'HAZARD_CLEANUP', 'WATER', 'CRUSH', 'SURRENDER', 'UNRESISTABLE'];

export const FIELD_LABELS = {
  // Object
  BuildCost: n('Цена', 0, 100000),
  BuildTime: n('Время постройки, с', 0, 600),
  EnergyProduction: n('Энергия (плюс даёт, минус потребляет)', -1000, 1000),
  EnergyBonus: n('Энергия от улучшения', -1000, 1000),
  VisionRange: n('Обзор', 0, 2000),
  ShroudClearingRange: n('Открывает карту в радиусе', 0, 5000),
  TransportSlotCount: n('Сколько мест занимает в транспорте', 0, 40),
  ExperienceValue: t('Опыт за уничтожение (по званиям)'),
  ExperienceRequired: t('Опыт для званий'),
  IsTrainable: b('Получает опыт'),
  CrusherLevel: n('Давит (уровень)', 0, 3),
  CrushableLevel: n('Давится (уровень)', 0, 3),
  CommandSet: r('Набор кнопок', 'CommandSet'),
  Locomotor: t('Ходовая (режим и запись)'),
  KindOf: t('Типы объекта'),
  Side: t('Сторона'),
  // Body
  MaxHealth: n('Здоровье', 1, 1000000),
  InitialHealth: n('Здоровье при появлении', 1, 1000000),
  // WeaponSet
  'WeaponSet.Weapon': t('Оружие (слот и запись)', 'PRIMARY основное, SECONDARY дополнительное, TERTIARY третье'),
  'WeaponSet.Conditions': t('Когда действует набор'),
  'ArmorSet.Armor': r('Броня', 'Armor'),
  // Transport
  'TransportContain.Slots': n('Мест для пассажиров', 0, 40),
  'TransportContain.PassengersAllowedToFire': b('Пассажиры стреляют изнутри'),
  'TransportContain.AllowInsideKindOf': e('Кого можно сажать', KINDS),
  'TransportContain.ForbidInsideKindOf': e('Кого нельзя сажать', KINDS),
  'TransportContain.DamagePercentToUnits': t('Урон пассажирам при гибели транспорта'),
  'TransportContain.ExitDelay': n('Задержка высадки, мс', 0, 10000),
  'TransportContain.InitialPayload': t('Пассажиры при появлении'),
  'TransportContain.HealthRegen%PerSec': n('Лечение пассажиров, % в секунду', 0, 100),
  'OverlordContain.Slots': n('Мест для пассажиров', 0, 40),
  'HelixContain.Slots': n('Мест для пассажиров', 0, 40),
  'HelixContain.PassengersAllowedToFire': b('Пассажиры стреляют изнутри'),
  'GarrisonContain.ContainMax': n('Мест в гарнизоне', 0, 40),
  'GarrisonContain.DamagePercentToUnits': t('Урон гарнизону, когда здание разрушено'),
  'GarrisonContain.IsEnclosingContainer': b('Солдаты укрыты внутри: их не видно и по ним нельзя стрелять'),
  'TunnelContain.TimeForFullHeal': n('Полное лечение внутри, мс', 0, 600000),
  // Production / power
  'ProductionUpdate.MaxQueueEntries': n('Очередь производства', 1, 50),
  'AutoHealBehavior.HealingAmount': n('Лечение за раз', 0, 100000),
  'AutoHealBehavior.HealingDelay': n('Пауза лечения, мс', 0, 600000),
  // Locomotor
  Speed: n('Скорость', 0, 1000),
  SpeedDamaged: n('Скорость с повреждениями', 0, 1000),
  TurnRate: n('Скорость поворота', 0, 10000),
  Acceleration: n('Разгон', 0, 10000),
  // Weapon
  PrimaryDamage: n('Урон', 0, 1000000),
  PrimaryDamageRadius: n('Радиус поражения', 0, 5000),
  SecondaryDamage: n('Урон по краю', 0, 1000000),
  SecondaryDamageRadius: n('Радиус урона по краю', 0, 5000),
  AttackRange: n('Дальность', 0, 10000),
  MinimumAttackRange: n('Минимальная дальность', 0, 10000),
  DelayBetweenShots: t('Перезарядка, мс'),
  ClipSize: n('Выстрелов в обойме', 0, 1000),
  ClipReloadTime: t('Перезарядка обоймы, мс'),
  DamageType: e('Тип урона', DAMAGE),
  DeathType: t('Как гибнет цель'),
  WeaponSpeed: n('Скорость снаряда', 0, 100000),
  ProjectileObject: r('Снаряд', 'Object'),
  AcceptableAimDelta: n('Допуск прицеливания, градусы', 0, 180, '180: стреляет в любую сторону без поворота'),
  FireOCL: r('Создаёт при выстреле', 'ObjectCreationList'),
  ProjectileDetonationOCL: r('Создаёт при взрыве снаряда', 'ObjectCreationList'),
  FireFX: r('Эффект выстрела', 'FXList'),
  ProjectileDetonationFX: r('Эффект взрыва снаряда', 'FXList'),
  RadiusDamageAffects: t('Кого задевает взрыв'),
  AntiAirborneVehicle: b('Бьёт по воздуху (техника)'),
  AntiAirborneInfantry: b('Бьёт по воздуху (пехота)'),
  AntiGround: b('Бьёт по земле'),
  AntiBallisticMissile: b('Сбивает ракеты'),
  AutoReloadsClip: e('Перезарядка обоймы', ['Yes', 'No', 'RETURN_TO_BASE']),
  // Death / spawning
  DeathWeapon: r('Оружие при гибели', 'Weapon'),
  CreationList: r('Создаёт объекты', 'ObjectCreationList'),
};

export const MODULE_LABELS = {
  ActiveBody: 'Корпус', StructureBody: 'Корпус здания', HighlanderBody: 'Неуничтожимый корпус', ImmortalBody: 'Бессмертный корпус',
  TransportContain: 'Транспорт', OverlordContain: 'Отсек на Оверлорде', HelixContain: 'Отсек вертолёта',
  GarrisonContain: 'Гарнизон', TunnelContain: 'Туннель', ParachuteContain: 'Парашют', InternetHackContain: 'Хакеры',
  CaveContain: 'Пещера', HealContain: 'Лечебный отсек',
  ProductionUpdate: 'Производство', QueueProductionExitUpdate: 'Выход построенных', DefaultProductionExitUpdate: 'Выход построенных',
  AutoHealBehavior: 'Самолечение', PowerPlantUpdate: 'Электростанция', PowerPlantUpgrade: 'Улучшение электростанции',
  AIUpdateInterface: 'Поведение', JetAIUpdate: 'Поведение самолёта', DozerAIUpdate: 'Поведение строителя',
  WorkerAIUpdate: 'Поведение рабочего', ChinookAIUpdate: 'Поведение вертолёта', TransportAIUpdate: 'Поведение транспорта',
  PhysicsBehavior: 'Физика', SlowDeathBehavior: 'Гибель', InstantDeathBehavior: 'Гибель', FireWeaponWhenDeadBehavior: 'Оружие при гибели',
  CreateObjectDie: 'Создаёт при гибели', SpecialPowerModule: 'Спецспособность', OCLSpecialPower: 'Спецспособность',
  StealthUpdate: 'Невидимость', StealthDetectorUpdate: 'Обнаружение невидимых', ObjectCreationUpgrade: 'Создание по улучшению',
  WeaponSetUpgrade: 'Смена оружия по улучшению', ArmorUpgrade: 'Броня по улучшению', MaxHealthUpgrade: 'Здоровье по улучшению',
  W3DModelDraw: 'Модель', W3DTankDraw: 'Модель танка', W3DTruckDraw: 'Модель машины', W3DDependencyModelDraw: 'Модель',
  DestroyDie: 'Удаление при гибели', ExperienceScalarUpgrade: 'Опыт по улучшению', VeterancyGainCreate: 'Звание при постройке',
  RadarUpdate: 'Радар', SpyVisionUpdate: 'Разведка', CommandSetUpgrade: 'Кнопки по улучшению', ProductionSpeedUpgrade: 'Ускорение производства',
  WeaponSet: 'Оружие', ArmorSet: 'Броня', Prerequisites: 'Требования для постройки', UnitSpecificSounds: 'Звуки',
};

// The label text sits in `ru` for historical reasons; it is returned in the current interface language.
const localize = lab => (lab && getLang() === 'en' ? { ...lab, ru: tr(lab.ru), hint: lab.hint && tr(lab.hint) } : lab);

export function labelFor(moduleClass, key) {
  if (moduleClass && FIELD_LABELS[`${moduleClass}.${key}`]) return localize(FIELD_LABELS[`${moduleClass}.${key}`]);
  return localize(FIELD_LABELS[key] || null);
}

export function moduleLabel(classOrKind) { return tr(MODULE_LABELS[classOrKind]) || null; }
