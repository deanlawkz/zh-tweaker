// In-memory index of the game's INI data.
import { parseIni } from './ini.js';
import { readCsf } from './csf.js';

export const TYPES = ['Object', 'Weapon', 'Locomotor', 'CommandSet', 'CommandButton', 'Upgrade', 'Science',
  'ObjectCreationList', 'FXList', 'MappedImage', 'PlayerTemplate', 'Armor', 'SpecialPower', 'ParticleSystem', 'ControlBarScheme'];

export const GENERALS = {
  AirF: 'AirForce', Lazr: 'Laser', SupW: 'SuperWeapon', Tank: 'Tank', Infa: 'Infantry', Nuke: 'Nuke',
  Chem: 'Toxin', Demo: 'Demolition', Slth: 'Stealth', Boss: 'Boss',
};

const UNIT_KINDS = /\b(INFANTRY|VEHICLE|AIRCRAFT|HUGE_VEHICLE)\b/;

export class GameDb {
  constructor() {
    this.files = new Map();
    this.index = Object.fromEntries(TYPES.map(t => [t, new Map()]));
    this.warnings = [];
    this.csf = new Map();
    this.csfRaw = null;
  }

  addFile(path, text) {
    const f = parseIni(text, path);
    this.files.set(path, f);
    this.indexFile(path, f);
    return f;
  }

  indexFile(path, f) {
    for (const block of f.blocks) {
      const idx = this.index[block.type];
      if (!idx || block.single) continue;
      if (idx.has(block.name) && !path.includes('\\default\\')) {
        this.warnings.push(`${block.type} ${block.name}: определён повторно в ${path}`);
      }
      idx.set(block.name, { file: path, block });
    }
  }

  // Re-parse a file after an edit and refresh the index.
  replaceFile(path, f) {
    this.files.set(path, f);
    this.indexFile(path, f);
  }

  get(type, name) { return this.index[type]?.get(name) || null; }

  prop(type, name, key) {
    const e = this.get(type, name);
    if (!e) return null;
    const p = e.block.props.find(x => x.key.toLowerCase() === key.toLowerCase());
    return p ? p.value : null;
  }

  displayName(obj) {
    const label = this.prop('Object', obj, 'DisplayName');
    if (!label) return null;
    return this.csf.get(label.toLowerCase()) ?? null;
  }

  side(obj) { return this.prop('Object', obj, 'Side'); }

  general(obj) {
    const base = obj.startsWith('Cmdr_') ? obj.slice(5) : obj;
    const m = base.match(/^([A-Za-z]+)_/);
    return m ? GENERALS[m[1]] ?? null : null;
  }

  kind(obj) {
    const k = this.prop('Object', obj, 'KindOf') || '';
    if (/\bSTRUCTURE\b/.test(k)) return 'building';
    if (UNIT_KINDS.test(k)) return 'unit';
    return 'other';
  }

  weaponsOf(obj) {
    const e = this.get('Object', obj);
    if (!e) return [];
    const out = new Set();
    for (const m of e.block.modules) {
      if (m.kind.toLowerCase() !== 'weaponset') continue;
      for (const p of m.props) {
        if (p.key.toLowerCase() !== 'weapon') continue;
        const w = p.value.split(/\s+/)[1];
        if (w && w.toLowerCase() !== 'none') out.add(w);
      }
    }
    return [...out];
  }

  usersOfWeapon(weapon) {
    if (!this._weaponUsers) {
      this._weaponUsers = new Map();
      for (const name of this.index.Object.keys()) {
        for (const w of this.weaponsOf(name)) {
          if (!this._weaponUsers.has(w)) this._weaponUsers.set(w, []);
          this._weaponUsers.get(w).push(name);
        }
      }
    }
    return this._weaponUsers.get(weapon) || [];
  }
}

export async function loadGameDb(vfs) {
  const db = new GameDb();
  // Engine order: Default\ first, then main files.
  const all = vfs.list('data\\ini\\').filter(p => p.endsWith('.ini'));
  all.sort((a, b) => (b.includes('\\default\\') - a.includes('\\default\\')) || a.localeCompare(b));
  for (const p of all) db.addFile(p, vfs.read(p).toString('latin1'));
  if (vfs.has('data\\english\\generals.csf')) {
    db.csfRaw = vfs.read('data\\english\\generals.csf');
    db.csf = readCsf(db.csfRaw);
  }
  return db;
}
