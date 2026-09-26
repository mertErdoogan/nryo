import type { Rect } from '../../lib/math';

export interface Mover extends Rect {
  axis: 'x' | 'y';
  min: number;
  max: number;
  speed: number;
}

export interface HoleDef {
  name: string;
  par: number;
  tee: [number, number];
  cup: [number, number];
  walls: Rect[];
  sand?: Rect[];
  water?: Rect[];
  bumpers?: { x: number; y: number; r: number }[];
  movers?: Mover[];
}

/** Play area inside the outer border (logical 360×600 canvas). */
export const COURSE: Rect = { x: 20, y: 60, w: 320, h: 520 };

export const HOLES: HoleDef[] = [
  { name: 'Warm Up', par: 2, tee: [180, 520], cup: [180, 130], walls: [] },
  {
    name: 'Dogleg',
    par: 3,
    tee: [80, 520],
    cup: [80, 130],
    walls: [{ x: 20, y: 310, w: 230, h: 16 }],
  },
  {
    name: 'Pinball',
    par: 2,
    tee: [180, 525],
    cup: [180, 120],
    walls: [],
    bumpers: [
      { x: 110, y: 330, r: 22 },
      { x: 250, y: 330, r: 22 },
      { x: 180, y: 240, r: 26 },
      { x: 180, y: 420, r: 18 },
    ],
  },
  {
    name: 'Beach Day',
    par: 3,
    tee: [180, 525],
    cup: [180, 115],
    walls: [
      { x: 20, y: 200, w: 110, h: 14 },
      { x: 230, y: 200, w: 110, h: 14 },
    ],
    sand: [{ x: 90, y: 250, w: 180, h: 140 }],
  },
  {
    name: 'The Bridge',
    par: 3,
    tee: [180, 530],
    cup: [180, 120],
    walls: [],
    water: [
      { x: 20, y: 290, w: 135, h: 70 },
      { x: 205, y: 290, w: 135, h: 70 },
    ],
  },
  {
    name: 'Switchback',
    par: 4,
    tee: [60, 540],
    cup: [300, 110],
    walls: [
      { x: 20, y: 430, w: 240, h: 16 },
      { x: 100, y: 300, w: 240, h: 16 },
      { x: 20, y: 170, w: 240, h: 16 },
    ],
  },
  {
    name: 'Rush Hour',
    par: 2,
    tee: [180, 525],
    cup: [180, 115],
    walls: [],
    movers: [
      { x: 20, y: 320, w: 110, h: 18, axis: 'x', min: 20, max: 230, speed: 120 },
      { x: 230, y: 220, w: 90, h: 18, axis: 'x', min: 20, max: 250, speed: 150 },
    ],
  },
  {
    name: 'Island Green',
    par: 3,
    tee: [180, 530],
    cup: [180, 170],
    walls: [],
    water: [
      { x: 20, y: 100, w: 320, h: 30 },
      { x: 20, y: 130, w: 90, h: 120 },
      { x: 250, y: 130, w: 90, h: 120 },
      { x: 20, y: 250, w: 130, h: 40 },
      { x: 210, y: 250, w: 130, h: 40 },
    ],
    bumpers: [{ x: 180, y: 380, r: 20 }],
  },
  {
    name: 'Grand Finale',
    par: 4,
    tee: [300, 540],
    cup: [60, 110],
    walls: [
      { x: 100, y: 440, w: 240, h: 14 },
      { x: 20, y: 250, w: 220, h: 14 },
    ],
    sand: [{ x: 30, y: 300, w: 120, h: 100 }],
    movers: [{ x: 120, y: 350, w: 80, h: 16, axis: 'x', min: 150, max: 320, speed: 110 }],
    bumpers: [{ x: 260, y: 160, r: 20 }],
  },
];

export const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

export function scoreName(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one!';
  const diff = strokes - par;
  if (diff <= -2) return 'Eagle!';
  if (diff === -1) return 'Birdie!';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double bogey';
  return `+${diff}`;
}
