import { getGame } from '../games/catalog';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { gameMeta, notFoundMeta } from '../seo';
import { GameInfo } from '../shell/GameInfo';
import { GameShell } from '../shell/GameShell';
import { NotFoundPage } from './NotFoundPage';

export default function PlayPage({ gameId }: { gameId: string }) {
  const game = getGame(gameId);
  useDocumentMeta(game ? gameMeta(game) : notFoundMeta());
  if (!game) return <NotFoundPage />;
  return (
    <>
      <GameShell game={game} />
      <GameInfo game={game} />
    </>
  );
}
