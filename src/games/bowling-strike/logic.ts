/** Ten-pin bowling scoring. `rolls` is the pinfall of every roll so far. */
export function frameScores(rolls: readonly number[]): (number | null)[] {
  const out: (number | null)[] = [];
  let i = 0;
  let total = 0;
  for (let frame = 0; frame < 10; frame++) {
    const a = rolls[i];
    if (a === undefined) {
      out.push(null);
      continue;
    }
    if (a === 10) {
      const b = rolls[i + 1];
      const c = rolls[i + 2];
      if (b === undefined || c === undefined) out.push(null);
      else {
        total += 10 + b + c;
        out.push(total);
      }
      i += 1;
      continue;
    }
    const b = rolls[i + 1];
    if (b === undefined) {
      out.push(null);
      i += 1;
      continue;
    }
    if (a + b === 10) {
      const c = rolls[i + 2];
      if (c === undefined) out.push(null);
      else {
        total += 10 + c;
        out.push(total);
      }
    } else {
      total += a + b;
      out.push(total);
    }
    i += 2;
  }
  return out;
}

/** Where the game stands: current frame (0-9), roll within it, and whether it's over. */
export function position(rolls: readonly number[]): {
  frame: number;
  roll: number;
  done: boolean;
  standing: number;
} {
  let i = 0;
  for (let frame = 0; frame < 9; frame++) {
    if (rolls[i] === undefined) return { frame, roll: 0, done: false, standing: 10 };
    if (rolls[i] === 10) {
      i += 1;
      continue;
    }
    if (rolls[i + 1] === undefined) return { frame, roll: 1, done: false, standing: 10 - rolls[i]! };
    i += 2;
  }
  const t = rolls.slice(i);
  if (t.length === 0) return { frame: 9, roll: 0, done: false, standing: 10 };
  if (t.length === 1) return { frame: 9, roll: 1, done: false, standing: t[0] === 10 ? 10 : 10 - t[0]! };
  if (t.length === 2) {
    const [a, b] = t as [number, number];
    if (a === 10) return { frame: 9, roll: 2, done: false, standing: b === 10 ? 10 : 10 - b };
    if (a + b === 10) return { frame: 9, roll: 2, done: false, standing: 10 };
    return { frame: 9, roll: 2, done: true, standing: 0 };
  }
  return { frame: 9, roll: 3, done: true, standing: 0 };
}

/** Frame marks for the score sheet: X for strike, / for spare, - for zero. */
export function marks(rolls: readonly number[]): string[][] {
  const out: string[][] = [];
  let i = 0;
  for (let frame = 0; frame < 10; frame++) {
    const m: string[] = [];
    if (frame < 9) {
      const a = rolls[i];
      if (a === undefined) {
        out.push(m);
        continue;
      }
      if (a === 10) {
        m.push('X');
        i += 1;
      } else {
        m.push(a === 0 ? '-' : String(a));
        const b = rolls[i + 1];
        if (b !== undefined) m.push(a + b === 10 ? '/' : b === 0 ? '-' : String(b));
        i += 2;
      }
    } else {
      const t = rolls.slice(i);
      t.forEach((r, k) => {
        const prev = t[k - 1];
        if (r === 10 && (k === 0 || prev === 10 || (k === 2 && t[0]! + t[1]! === 10))) m.push('X');
        else if (
          k > 0 &&
          prev !== undefined &&
          prev !== 10 &&
          prev + r === 10 &&
          !(k === 2 && t[0]! + t[1]! === 10)
        )
          m.push('/');
        else m.push(r === 0 ? '-' : String(r));
      });
    }
    out.push(m);
  }
  return out;
}
