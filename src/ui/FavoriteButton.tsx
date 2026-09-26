import { useIsFavorite } from '../hooks/usePlatform';
import { platform } from '../platform';
import { sound } from '../platform/audio';
import { Icon } from './Icon';
import styles from './FavoriteButton.module.css';

interface FavoriteButtonProps {
  gameId: string;
  title: string;
  className?: string;
  plain?: boolean;
  size?: number;
}

export function FavoriteButton({ gameId, title, className, plain, size = 20 }: FavoriteButtonProps) {
  const active = useIsFavorite(gameId);
  return (
    <button
      type="button"
      className={[styles.fav, active && styles.on, plain && styles.plain, className].filter(Boolean).join(' ')}
      aria-pressed={active}
      aria-label={active ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        sound.unlock();
        const on = platform.toggleFavorite(gameId);
        if (on) sound.play('tap');
      }}
    >
      <Icon name="heart" size={size} filled={active} />
    </button>
  );
}
