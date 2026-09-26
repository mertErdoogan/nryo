import { useEffect, useRef, useState } from 'react';
import { useLoadouts, useTodayKey, useWallet } from '../hooks/usePlatform';
import { rewardedAvailable, showRewarded } from '../platform/ads';
import { platform } from '../platform';
import { ECONOMY, upgradeCost } from '../platform/economy';
import { isSkinOwned, resolveLoadout } from '../platform/services/loadouts';
import type { GameEntry, GameShop, SkinDef } from '../platform/types';
import { Button } from '../ui/Button';
import { CoinAmount, CoinIcon } from '../ui/Coins';
import { Icon } from '../ui/Icon';
import styles from './ShopOverlay.module.css';

interface ShopOverlayProps {
  game: GameEntry;
  shop: GameShop;
  onClose(): void;
}

function SkinSwatch({ skin }: { skin: SkinDef }) {
  const [a, b, c] = skin.colors;
  return (
    <span
      className={styles.swatch}
      style={{ background: `radial-gradient(circle at 35% 30%, ${c}, ${a} 45%, ${b})` }}
      aria-hidden="true"
    >
      {skin.icon}
    </span>
  );
}

/** The game's garage/armory/wardrobe: permanent upgrades and skins bought with coins. */
export function ShopOverlay({ game, shop, onClose }: ShopOverlayProps) {
  const wallet = useWallet();
  const all = useLoadouts();
  const today = useTodayKey();
  const loadout = resolveLoadout(all[game.id], shop);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const freeLeft = platform.wallet.freeCoinsLeft(today);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const buyUpgrade = (id: string, name: string) => {
    const r = platform.buyUpgrade(game, id);
    if (r.ok) {
      setFlash(`${name} upgraded!`);
    } else if (r.reason === 'insufficient') setFlash('Not enough coins yet');
  };

  const buySkin = (skin: SkinDef) => {
    const r = platform.buySkin(game, skin.id);
    if (r.ok) setFlash(`${skin.name} unlocked!`);
    else if (r.reason === 'insufficient') setFlash('Not enough coins yet');
  };

  const watchForSkin = async (skin: SkinDef) => {
    setBusy(true);
    const outcome = await showRewarded('skin-unlock', `Progress towards ${skin.name}`);
    setBusy(false);
    if (outcome === 'rewarded') {
      const unlocked = platform.progressSkinAd(game, skin.id);
      setFlash(unlocked ? `${skin.name} unlocked!` : 'Progress saved');
    }
  };

  const freeCoins = async () => {
    setBusy(true);
    const outcome = await showRewarded('free-coins', `${ECONOMY.freeCoinsAmount} free coins`);
    setBusy(false);
    if (outcome === 'rewarded') {
      const got = platform.wallet.grantFreeCoins(today);
      if (got > 0) setFlash(`+${got} coins`);
    }
  };

  return (
    <div
      className={styles.overlay}
      data-game-overlay
      data-testid="shop-overlay"
      role="dialog"
      aria-label={shop.title}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <span className={styles.title}>
            <span aria-hidden="true">{shop.icon}</span> {shop.title}
          </span>
          <span className={styles.balance} data-testid="shop-balance">
            <CoinAmount value={wallet.coins} size={20} />
          </span>
          <Button ref={closeRef} variant="ghost" icon="x" label="Close shop" onClick={onClose} />
        </header>

        <div className={styles.body}>
          {shop.upgrades.length > 0 && (
            <section aria-label="Upgrades">
              <h3 className={styles.section}>Upgrades · kept forever</h3>
              <ul className={styles.list}>
                {shop.upgrades.map((u) => {
                  const level = loadout.upgrades[u.id] ?? 0;
                  const cost = upgradeCost(u, level);
                  const afford = cost !== null && wallet.coins >= cost;
                  return (
                    <li key={u.id} className={styles.item}>
                      <span className={styles.itemIcon} aria-hidden="true">
                        {u.icon}
                      </span>
                      <span className={styles.itemText}>
                        <span className={styles.itemName}>
                          {u.name}{' '}
                          <span className={styles.level}>
                            Lv {level}/{u.maxLevel}
                          </span>
                        </span>
                        <span className={styles.itemDesc}>{u.description}</span>
                        <span className={styles.pips} aria-hidden="true">
                          {Array.from({ length: u.maxLevel }, (_, i) => (
                            <span key={i} data-on={i < level} />
                          ))}
                        </span>
                      </span>
                      {cost === null ? (
                        <span className={styles.maxed}>
                          <Icon name="check" size={16} /> Max
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={afford ? 'primary' : 'secondary'}
                          disabled={!afford}
                          onClick={() => buyUpgrade(u.id, u.name)}
                          aria-label={`Upgrade ${u.name} for ${cost} coins`}
                        >
                          <CoinIcon size={15} /> {cost}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {shop.skins.length > 1 && (
            <section aria-label={shop.skinLabel ?? 'Skins'}>
              <h3 className={styles.section}>{shop.skinLabel ?? 'Skins'}</h3>
              <div className={styles.skins}>
                {shop.skins.map((skin) => {
                  const owned = isSkinOwned(loadout, shop, skin.id);
                  const equipped = loadout.equipped === skin.id;
                  const adsNeeded = skin.adUnlock ?? 0;
                  const adsDone = loadout.adProgress[skin.id] ?? 0;
                  return (
                    <div key={skin.id} className={styles.skin} data-equipped={equipped}>
                      <SkinSwatch skin={skin} />
                      <span className={styles.itemName}>{skin.name}</span>
                      {skin.perk && <span className={styles.perk}>{skin.perk}</span>}
                      {equipped ? (
                        <span className={styles.equipped}>Equipped</span>
                      ) : owned ? (
                        <Button size="sm" onClick={() => platform.equipSkin(game, skin.id)}>
                          Equip
                        </Button>
                      ) : adsNeeded > 0 && skin.price === 0 ? (
                        <Button
                          size="sm"
                          icon="play"
                          disabled={busy || !rewardedAvailable()}
                          onClick={() => void watchForSkin(skin)}
                          aria-label={`Watch an ad to unlock ${skin.name}, ${adsDone} of ${adsNeeded} watched`}
                        >
                          Ad {adsDone}/{adsNeeded}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={wallet.coins >= skin.price ? 'primary' : 'secondary'}
                          disabled={wallet.coins < skin.price}
                          onClick={() => buySkin(skin)}
                          aria-label={`Buy ${skin.name} for ${skin.price} coins`}
                        >
                          <CoinIcon size={15} /> {skin.price}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className={styles.free}>
            <span>
              Short on coins? Watch a short ad for <CoinAmount value={ECONOMY.freeCoinsAmount} size={14} />
              <span className={styles.freeLeft}> · {freeLeft} left today</span>
            </span>
            <Button
              size="sm"
              icon="play"
              disabled={busy || freeLeft <= 0 || !rewardedAvailable()}
              onClick={() => void freeCoins()}
              data-testid="free-coins"
            >
              Free coins
            </Button>
          </div>
        </div>
        {flash && (
          <p className={styles.flash} role="status">
            {flash}
          </p>
        )}
      </div>
    </div>
  );
}
