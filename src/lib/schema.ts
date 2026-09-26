/**
 * A tiny runtime validation toolkit used to guard everything we read back from
 * browser storage (and imported save files). It intentionally covers only what
 * this project needs: plain JSON values with a known shape.
 *
 * Every schema exposes `is(value)` (a type guard) and carries its static type,
 * so `Infer<typeof schema>` yields the TypeScript type for free.
 */

export interface Schema<T> {
  is(value: unknown): value is T;
  /** Phantom field for type inference only. */
  readonly _type?: T;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

const make = <T>(is: (value: unknown) => boolean): Schema<T> => ({ is: is as (v: unknown) => v is T });

export interface NumberOptions {
  int?: boolean;
  min?: number;
  max?: number;
}

export const num = (opts: NumberOptions = {}): Schema<number> =>
  make<number>((v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    if (opts.int && !Number.isInteger(v)) return false;
    if (opts.min !== undefined && v < opts.min) return false;
    if (opts.max !== undefined && v > opts.max) return false;
    return true;
  });

export const str = (opts: { max?: number; pattern?: RegExp } = {}): Schema<string> =>
  make<string>((v) => {
    if (typeof v !== 'string') return false;
    if (opts.max !== undefined && v.length > opts.max) return false;
    if (opts.pattern && !opts.pattern.test(v)) return false;
    return true;
  });

export const bool = (): Schema<boolean> => make<boolean>((v) => typeof v === 'boolean');

export const literal = <const L extends string | number | boolean | null>(value: L): Schema<L> =>
  make<L>((v) => v === value);

export const oneOf = <const L extends readonly (string | number)[]>(values: L): Schema<L[number]> =>
  make<L[number]>((v) => (values as readonly unknown[]).includes(v));

export const arr = <T>(item: Schema<T>, opts: { max?: number; min?: number } = {}): Schema<T[]> =>
  make<T[]>((v) => {
    if (!Array.isArray(v)) return false;
    if (opts.max !== undefined && v.length > opts.max) return false;
    if (opts.min !== undefined && v.length < opts.min) return false;
    return v.every((x) => item.is(x));
  });

export const nullable = <T>(inner: Schema<T>): Schema<T | null> =>
  make<T | null>((v) => v === null || inner.is(v));

/** Marks an object field as optional (may be missing or undefined). */
export interface OptionalSchema<T> extends Schema<T | undefined> {
  readonly optional: true;
}

export const optional = <T>(inner: Schema<T>): OptionalSchema<T> => ({
  is: (v: unknown): v is T | undefined => v === undefined || inner.is(v),
  optional: true,
});

type Shape = Record<string, Schema<unknown>>;
type OptionalKeys<S extends Shape> = { [K in keyof S]: S[K] extends OptionalSchema<unknown> ? K : never }[keyof S];
type RequiredKeys<S extends Shape> = Exclude<keyof S, OptionalKeys<S>>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
export type ObjectType<S extends Shape> = Simplify<
  { [K in RequiredKeys<S>]: Infer<S[K]> } & { [K in OptionalKeys<S>]?: Exclude<Infer<S[K]>, undefined> }
>;

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const obj = <S extends Shape>(shape: S): Schema<ObjectType<S>> =>
  make<ObjectType<S>>((v) => {
    if (!isPlainObject(v)) return false;
    for (const key of Object.keys(shape)) {
      if (!shape[key]!.is(v[key])) return false;
    }
    return true;
  });

/** A string-keyed dictionary whose values all match `value`. */
export const record = <T>(value: Schema<T>, opts: { maxKeys?: number } = {}): Schema<Record<string, T>> =>
  make<Record<string, T>>((v) => {
    if (!isPlainObject(v)) return false;
    const keys = Object.keys(v);
    if (opts.maxKeys !== undefined && keys.length > opts.maxKeys) return false;
    return keys.every((k) => value.is(v[k]));
  });

/** A 2D grid (array of equal-length rows). */
export const grid = <T>(cell: Schema<T>, rows?: number, cols?: number): Schema<T[][]> =>
  make<T[][]>((v) => {
    if (!Array.isArray(v)) return false;
    if (rows !== undefined && v.length !== rows) return false;
    const width = cols ?? (Array.isArray(v[0]) ? (v[0] as unknown[]).length : 0);
    return v.every((row) => Array.isArray(row) && row.length === width && row.every((c) => cell.is(c)));
  });

export const any = (): Schema<unknown> => make<unknown>(() => true);
