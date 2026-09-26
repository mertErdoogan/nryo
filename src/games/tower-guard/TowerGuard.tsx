import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';
import {
  CanvasStage,
  FloatingText,
  Particles,
  createContinueGate,
  useGameLoop,
  useSeededRng,
} from '../../engine';
import type { CanvasView, StagePointer } from '../../engine';
import { circle, fillRoundRect, text } from '../../engine/draw';
import { arr, num, obj, oneOf, type Infer } from '../../lib/schema';
import type { GameProps, VersionedSpec } from '../../platform/types';
import {
  CELL,
  COLS,
  CREEPS,
  hpScale,
  MAP_Y,
  PATH_POINTS,
  pathCells,
  ROWS,
  sellValue,
  TOWERS,
  towerDamage,
  towerRange,
  upgradeCost,
  waveCreeps,
  WAVES,
  type CreepKind,
  type TowerType,
} from './logic';
import styles from './TowerGuard.module.css';

const W = 360;
const H = 640;
const START_COINS = 160;
const START_LIVES = 20;
const BREAK = 12;

const towerSchema = obj({
  c: num({ int: true, min: 0, max: COLS - 1 }),
  r: num({ int: true, min: 0, max: ROWS - 1 }),
  type: oneOf(['blaster', 'frost', 'cannon'] as const),
  level: num({ int: true, min: 1, max: 3 }),
});
const saveSchema = obj({
  towers: arr(towerSchema, { max: 120 }),
  coins: num({ int: true, min: 0 }),
  lives: num({ int: true, min: 1 }),
  wave: num({ int: true, min: 0 }),
  score: num({ min: 0 }),
  kills: num({ int: true, min: 0 }),
});
type Save = Infer<typeof saveSchema>;
export const saveSpec: VersionedSpec<Save> = { version: 1, is: saveSchema.is };

interface Tower {
  c: number;
  r: number;
  type: TowerType;
  level: number;
  cd: number;
  angle: number;
}
interface Creep {
  kind: CreepKind;
  x: number;
  y: number;
  seg: number;
  hp: number;
  maxHp: number;
  slow: number;
}
interface Shot {
  x: number;
  y: number;
  target: Creep;
  type: TowerType;
  damage: number;
}

const PATH = pathCells();

export function TowerGuard({ api, paused }: GameProps<Save>) {
  const rng = useSeededRng(api.seed);
  const view = useRef<CanvasView | null>(null);
  const fx = useRef({ particles: new Particles(400, rng.next), floaters: new FloatingText() });
  const [selectedType, setSelectedType] = useState<TowerType | null>('blaster');
  const [menu, setMenu] = useState<Tower | null>(null);
  const [, setTick] = useState(0);
  const r = api.resume;
  const lo = api.loadout;
  const damageScale = 1 + 0.06 * lo.level('damage');
  const continueGate = useRef(createContinueGate(api)).current;
  const s = useRef({
    towers: (r?.towers ?? []).map((t) => ({ ...t, cd: 0, angle: 0 })) as Tower[],
    creeps: [] as Creep[],
    shots: [] as Shot[],
    queue: [] as CreepKind[],
    spawnTimer: 0,
    coins: r?.coins ?? START_COINS + 25 * lo.level('gold'),
    lives: r?.lives ?? START_LIVES + 3 * lo.level('lives'),
    wave: r?.wave ?? 0,
    score: r?.score ?? 0,
    kills: r?.kills ?? 0,
    breakTimer: BREAK,
    inWave: false,
    over: false,
    time: 0,
    hover: null as null | { c: number; r: number },
  }).current;
  const refresh = () => setTick((t) => t + 1);

  const persist = () =>
    api.save(
      {
        towers: s.towers.map(({ c, r: row, type, level }) => ({ c, r: row, type, level })),
        coins: s.coins,
        lives: s.lives,
        wave: s.wave,
        score: s.score,
        kills: s.kills,
      },
      { label: `Wave ${s.wave}/${WAVES} · ${s.lives} lives`, progress: s.wave / WAVES },
    );

  const startWave = () => {
    if (s.inWave || s.over) return;
    if (s.wave > 0 && s.breakTimer > 0) {
      const bonus = Math.round(s.breakTimer * 2);
      s.coins += bonus;
      if (bonus > 0) fx.current.floaters.add(`Early call +${bonus} gold`, W / 2, MAP_Y + 40, '#fde047', 16);
    }
    s.wave += 1;
    s.queue = waveCreeps(s.wave);
    s.spawnTimer = 0.4;
    s.inWave = true;
    api.sfx('powerup');
    refresh();
  };

  const finish = (won: boolean) => {
    if (s.over) return;
    s.over = true;
    if (won) {
      s.score += s.lives * 50;
      api.setScore(s.score);
    }
    api.sfx(won ? 'win' : 'gameover');
    const end = () =>
      api.gameOver({
        score: s.score,
        won,
        stats: [
          { label: 'Waves', value: `${won ? WAVES : s.wave - 1}/${WAVES}` },
          { label: 'Creeps stopped', value: String(s.kills) },
          { label: 'Lives left', value: String(Math.max(0, s.lives)) },
        ],
      });
    if (won) {
      setTimeout(end, 800);
      return;
    }
    continueGate(() => {
      // Reinforcements: the creeps on the road are swept away and the base is repaired.
      s.creeps = [];
      s.shots = [];
      s.lives = 10;
      s.over = false;
      fx.current.floaters.add('Base repaired: 10 ♥', W / 2, MAP_Y + 60, '#86efac', 20, 1.4);
      refresh();
    }, end);
  };

  const onDown = (p: StagePointer) => {
    if (s.over || paused) return;
    const c = Math.floor(p.x / CELL);
    const row = Math.floor((p.y - MAP_Y) / CELL);
    if (row < 0 || row >= ROWS || c < 0 || c >= COLS) {
      setMenu(null);
      return;
    }
    const existing = s.towers.find((t) => t.c === c && t.r === row);
    if (existing) {
      setMenu(menu === existing ? null : existing);
      api.sfx('tick');
      return;
    }
    setMenu(null);
    if (!selectedType || PATH.has(`${c},${row}`)) {
      api.sfx('error');
      return;
    }
    const cost = TOWERS[selectedType].cost;
    if (s.coins < cost) {
      fx.current.floaters.add('Not enough gold', p.x, p.y - 10, '#fca5a5', 14, 0.8);
      api.sfx('error');
      return;
    }
    s.coins -= cost;
    s.towers.push({ c, r: row, type: selectedType, level: 1, cd: 0, angle: 0 });
    fx.current.particles.burst(c * CELL + CELL / 2, MAP_Y + row * CELL + CELL / 2, {
      count: 12,
      color: TOWERS[selectedType].color,
      speed: 100,
      life: 0.4,
    });
    api.sfx('tap');
    if (!s.inWave) persist();
    refresh();
  };
  const onMove = (p: StagePointer) => {
    const c = Math.floor(p.x / CELL);
    const row = Math.floor((p.y - MAP_Y) / CELL);
    s.hover = row >= 0 && row < ROWS && c >= 0 && c < COLS ? { c, r: row } : null;
  };

  const upgrade = (t: Tower) => {
    const cost = upgradeCost(t.type, t.level);
    if (t.level >= 3 || s.coins < cost) return;
    s.coins -= cost;
    t.level += 1;
    api.sfx('powerup');
    if (!s.inWave) persist();
    refresh();
  };
  const sell = (t: Tower) => {
    s.coins += sellValue(t.type, t.level);
    s.towers = s.towers.filter((x) => x !== t);
    setMenu(null);
    api.sfx('coin');
    if (!s.inWave) persist();
  };

  useGameLoop((dt) => {
    const v = view.current;
    if (!v) return;
    const { particles, floaters } = fx.current;
    s.time += dt;
    let changed = false;

    if (!s.over) {
      if (!s.inWave) {
        s.breakTimer -= dt;
        if (s.breakTimer <= 0 && s.wave < WAVES) startWave();
      } else {
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0 && s.queue.length) {
          const kind = s.queue.shift()!;
          const hp = CREEPS[kind].hp * hpScale(s.wave);
          s.creeps.push({ kind, x: PATH_POINTS[0]!.x, y: PATH_POINTS[0]!.y, seg: 0, hp, maxHp: hp, slow: 0 });
          s.spawnTimer = kind === 'boss' ? 1.6 : Math.max(0.45, 1 - s.wave * 0.035);
        }
      }

      for (const c of s.creeps) {
        const def = CREEPS[c.kind];
        let move = def.speed * (c.slow > 0 ? 0.55 : 1) * dt;
        c.slow = Math.max(0, c.slow - dt);
        while (move > 0 && c.seg < PATH_POINTS.length - 1) {
          const target = PATH_POINTS[c.seg + 1]!;
          const dx = target.x - c.x;
          const dy = target.y - c.y;
          const d = Math.hypot(dx, dy);
          if (d <= move) {
            c.x = target.x;
            c.y = target.y;
            c.seg += 1;
            move -= d;
          } else {
            c.x += (dx / d) * move;
            c.y += (dy / d) * move;
            move = 0;
          }
        }
        if (c.seg >= PATH_POINTS.length - 1) {
          c.hp = -1;
          s.lives -= def.leak;
          floaters.add(`−${def.leak} ♥`, c.x, c.y - 30, '#fca5a5', 16);
          api.sfx('miss');
          api.haptic(40);
          changed = true;
        }
      }

      for (const t of s.towers) {
        t.cd -= dt;
        const tx = t.c * CELL + CELL / 2;
        const ty = MAP_Y + t.r * CELL + CELL / 2;
        const range = towerRange(t.type, t.level);
        let best: Creep | null = null;
        for (const c of s.creeps) {
          if (c.hp <= 0) continue;
          if ((c.x - tx) ** 2 + (c.y - ty) ** 2 > range * range) continue;
          if (!best || c.seg > best.seg) best = c;
        }
        if (best) t.angle = Math.atan2(best.y - ty, best.x - tx);
        if (best && t.cd <= 0) {
          t.cd = TOWERS[t.type].rate;
          s.shots.push({
            x: tx,
            y: ty,
            target: best,
            type: t.type,
            damage: towerDamage(t.type, t.level) * damageScale,
          });
          if (t.type === 'cannon') api.sfx('shoot');
        }
      }

      for (const shot of s.shots) {
        const tg = shot.target;
        const dx = tg.x - shot.x;
        const dy = tg.y - shot.y;
        const d = Math.hypot(dx, dy);
        const speed = shot.type === 'cannon' ? 260 : 420;
        if (d < 8 || tg.hp <= 0) {
          if (tg.hp > 0 || shot.type === 'cannon') {
            if (shot.type === 'cannon') {
              particles.burst(tg.x, tg.y, {
                count: 14,
                colors: ['#fb923c', '#fde047'],
                speed: 140,
                life: 0.4,
              });
              for (const c of s.creeps)
                if (c.hp > 0 && (c.x - tg.x) ** 2 + (c.y - tg.y) ** 2 < 46 * 46) c.hp -= shot.damage;
            } else {
              tg.hp -= shot.damage;
              if (shot.type === 'frost') tg.slow = 1.3;
            }
          }
          shot.damage = -1;
        } else {
          shot.x += (dx / d) * speed * dt;
          shot.y += (dy / d) * speed * dt;
        }
      }
      s.shots = s.shots.filter((sh) => sh.damage >= 0);
      for (const c of s.creeps) {
        if (c.hp <= 0 && c.hp !== -1) {
          const def = CREEPS[c.kind];
          s.coins += def.reward;
          s.kills += 1;
          s.score += c.kind === 'boss' ? 200 : 10;
          particles.burst(c.x, c.y, {
            count: c.kind === 'boss' ? 40 : 8,
            color: def.color,
            speed: 120,
            life: 0.4,
          });
          floaters.add(`+${def.reward}`, c.x, c.y - 12, '#fde047', 12, 0.6);
          if (c.kind === 'boss') api.sfx('explode');
          else if (rng.chance(0.4)) api.sfx('hit');
          c.hp = -1;
          changed = true;
        }
      }
      s.creeps = s.creeps.filter((c) => c.hp > 0);
      if (s.lives <= 0) finish(false);
      if (s.inWave && s.queue.length === 0 && s.creeps.length === 0 && !s.over) {
        s.inWave = false;
        s.breakTimer = BREAK;
        s.score += 100;
        s.coins += 20 + s.wave * 3;
        api.addCoins(1 + Math.floor(s.wave / 5));
        floaters.add(`Wave ${s.wave} cleared!`, W / 2, MAP_Y + ROWS * CELL * 0.5, '#bef264', 24, 1.4);
        api.sfx('score');
        if (s.wave >= WAVES) finish(true);
        else persist();
        changed = true;
      }
      api.setScore(s.score);
    }
    if (changed || Math.floor(s.time * 4) !== Math.floor((s.time - dt) * 4)) refresh();
    particles.update(dt);
    floaters.update(dt);

    // ---- render
    const ctx = v.ctx;
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, W, H);
    for (let row = 0; row < ROWS; row++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL;
        const y = MAP_Y + row * CELL;
        if (PATH.has(`${c},${row}`)) {
          ctx.fillStyle = '#a8a29e';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(x + 4, y + 4, 6, 6);
        } else {
          ctx.fillStyle = (c + row) % 2 === 0 ? '#4d7c0f' : '#3f6212';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }
    // entry / exit markers
    text(ctx, '▼', PATH_POINTS[1]!.x - CELL * 0, MAP_Y + 10, { size: 12, color: '#fde047' });
    fillRoundRect(
      ctx,
      PATH_POINTS[PATH_POINTS.length - 1]!.x - 18,
      MAP_Y + ROWS * CELL - 12,
      36,
      12,
      4,
      '#e11d48',
    );

    const selected = selectedType;
    if (
      s.hover &&
      selected &&
      !PATH.has(`${s.hover.c},${s.hover.r}`) &&
      !s.towers.some((t) => t.c === s.hover!.c && t.r === s.hover!.r)
    ) {
      const hx = s.hover.c * CELL + CELL / 2;
      const hy = MAP_Y + s.hover.r * CELL + CELL / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.arc(hx, hy, TOWERS[selected].range, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      circle(ctx, hx, hy, 13, TOWERS[selected].color);
      ctx.globalAlpha = 1;
    }
    for (const t of s.towers) {
      const tx = t.c * CELL + CELL / 2;
      const ty = MAP_Y + t.r * CELL + CELL / 2;
      if (menu === t) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(tx, ty, towerRange(t.type, t.level), 0, Math.PI * 2);
        ctx.fill();
      }
      fillRoundRect(ctx, tx - 16, ty - 16, 32, 32, 8, '#292524');
      circle(ctx, tx, ty, 12, TOWERS[t.type].color);
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(t.angle) * 16, ty + Math.sin(t.angle) * 16);
      ctx.stroke();
      for (let l = 0; l < t.level; l++) circle(ctx, tx - 8 + l * 8, ty + 18, 2.5, '#fde047');
    }
    for (const c of s.creeps) {
      const def = CREEPS[c.kind];
      circle(ctx, c.x, c.y, def.r, c.slow > 0 ? '#67e8f9' : def.color);
      circle(ctx, c.x + 3, c.y - 2, def.r * 0.28, '#111');
      fillRoundRect(ctx, c.x - def.r, c.y - def.r - 7, def.r * 2, 3, 1.5, 'rgba(0,0,0,0.5)');
      fillRoundRect(
        ctx,
        c.x - def.r,
        c.y - def.r - 7,
        def.r * 2 * Math.max(0, c.hp / c.maxHp),
        3,
        1.5,
        '#4ade80',
      );
    }
    for (const sh of s.shots) circle(ctx, sh.x, sh.y, sh.type === 'cannon' ? 5 : 3, TOWERS[sh.type].color);
    particles.draw(ctx);
    floaters.draw(ctx);

    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, W, MAP_Y);
    text(ctx, `Wave ${s.wave}/${WAVES}`, 12, 22, { size: 14, weight: 800, align: 'left' });
    text(ctx, `💰 ${s.coins}`, W / 2, 22, { size: 15, weight: 800, color: '#fde047' });
    text(ctx, `♥ ${Math.max(0, s.lives)}`, W - 12, 22, {
      size: 15,
      weight: 800,
      align: 'right',
      color: '#fb7185',
    });
  }, !paused);

  const menuStyle = (t: Tower): CSSProperties => {
    const v = view.current;
    const scale = v ? v.scale : 1;
    return { left: (t.c * CELL + CELL / 2) * scale, top: (MAP_Y + t.r * CELL) * scale - 4 };
  };

  return (
    <CanvasStage
      ref={view}
      width={W}
      height={H}
      label="Tower Guard map"
      onPointerDown={onDown}
      onPointerMove={onMove}
    >
      <div className={styles.panel}>
        {(Object.keys(TOWERS) as TowerType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={styles.btn}
            aria-pressed={selectedType === type}
            disabled={s.coins < TOWERS[type].cost && selectedType !== type}
            onClick={() => {
              setSelectedType(selectedType === type ? null : type);
              setMenu(null);
            }}
          >
            <span aria-hidden="true">{TOWERS[type].icon}</span>
            {TOWERS[type].name}
            <strong>💰{TOWERS[type].cost}</strong>
          </button>
        ))}
        <button
          type="button"
          className={`${styles.btn} ${styles.wave}`}
          disabled={s.inWave || s.over || s.wave >= WAVES}
          onClick={startWave}
        >
          {s.inWave ? `Wave ${s.wave}` : s.wave === 0 ? 'Start' : `Next wave`}
          <strong>{s.inWave ? '⚔️' : s.wave === 0 ? '▶' : `${Math.ceil(Math.max(0, s.breakTimer))}s`}</strong>
        </button>
      </div>
      {menu && s.towers.includes(menu) && (
        <div className={styles.menu} style={menuStyle(menu)}>
          <button
            type="button"
            className={styles.btn}
            disabled={menu.level >= 3 || s.coins < upgradeCost(menu.type, menu.level)}
            onClick={() => upgrade(menu)}
          >
            {menu.level >= 3 ? 'Max level' : `Upgrade 💰${upgradeCost(menu.type, menu.level)}`}
          </button>
          <button type="button" className={styles.btn} onClick={() => sell(menu)}>
            Sell +{sellValue(menu.type, menu.level)}
          </button>
        </div>
      )}
    </CanvasStage>
  );
}
