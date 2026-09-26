import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../platform/categories';
import { GAMES } from './catalog';

describe('game catalog', () => {
  it('contains 80+ uniquely identified games', () => {
    expect(GAMES.length).toBeGreaterThanOrEqual(80);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    expect(new Set(GAMES.map((g) => g.title)).size).toBe(GAMES.length);
  });

  it.each(GAMES.map((g) => [g.id, g] as const))('%s has complete, consistent metadata', (_id, g) => {
    expect(g.id).toMatch(/^[a-z0-9-]+$/);
    expect(g.title.length).toBeGreaterThan(2);
    expect(g.tagline.length).toBeLessThanOrEqual(70);
    expect(g.description.length).toBeGreaterThan(40);
    expect(g.howToPlay.length).toBeGreaterThanOrEqual(1);
    expect(g.howToPlay.length).toBeLessThanOrEqual(3);
    expect(g.categories.length).toBeGreaterThan(0);
    for (const c of g.categories) expect(CATEGORIES.some((x) => x.id === c)).toBe(true);
    expect(g.thumbnail).toBeTruthy();
    expect(g.controls.desktop).toBeTruthy();
    expect(g.controls.touch).toBeTruthy();
    const { bronze, silver, gold } = g.medals;
    if (g.score.lowerIsBetter) {
      expect(bronze).toBeGreaterThan(silver);
      expect(silver).toBeGreaterThan(gold);
    } else {
      expect(bronze).toBeLessThan(silver);
      expect(silver).toBeLessThan(gold);
    }
    expect(g.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.popularity).toBeGreaterThanOrEqual(0);
    expect(g.popularity).toBeLessThanOrEqual(100);
  });

  it.each(GAMES.filter((g) => g.shop).map((g) => [g.id, g] as const))('%s has a valid shop', (_id, g) => {
    const shop = g.shop!;
    expect(shop.title.length).toBeGreaterThan(1);
    expect(shop.skins.length).toBeGreaterThan(0);
    // The first skin is what everyone starts with.
    expect(shop.skins[0]!.price).toBe(0);
    expect(shop.skins[0]!.adUnlock).toBeUndefined();
    const ids = [...shop.skins.map((x) => `skin:${x.id}`), ...shop.upgrades.map((u) => `up:${u.id}`)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const skin of shop.skins) {
      for (const c of skin.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      // Every non-default skin is obtainable: coins or rewarded ads.
      if (skin !== shop.skins[0]) expect(skin.price > 0 || (skin.adUnlock ?? 0) > 0).toBe(true);
    }
    for (const u of shop.upgrades) {
      expect(u.maxLevel).toBeGreaterThanOrEqual(1);
      expect(u.maxLevel).toBeLessThanOrEqual(8);
      expect(u.baseCost).toBeGreaterThan(0);
    }
  });

  it('gives most games a shop', () => {
    expect(GAMES.filter((g) => g.shop).length).toBeGreaterThanOrEqual(GAMES.length - 6);
  });

  it('covers every category with at least two games', () => {
    for (const c of CATEGORIES)
      expect(GAMES.filter((g) => g.categories.includes(c.id)).length).toBeGreaterThanOrEqual(2);
  });

  it.each(GAMES.map((g) => [g.id, g] as const))('%s lazily loads a playable module', async (_id, g) => {
    const mod = await g.load();
    expect(typeof mod.Component).toBe('function');
    if (g.resumable) expect(mod.save).toBeDefined();
    if (mod.save) {
      expect(mod.save.version).toBeGreaterThanOrEqual(1);
      expect(mod.save.is(null)).toBe(false);
      expect(mod.save.is({})).toBe(false);
    }
  });
});
