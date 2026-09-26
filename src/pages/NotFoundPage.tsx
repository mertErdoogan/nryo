import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { notFoundMeta } from '../seo';
import { ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/Section';

export function NotFoundPage() {
  useDocumentMeta(notFoundMeta());
  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <EmptyState
        icon="👾"
        level={1}
        title="This level doesn’t exist"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <ButtonLink to="/" variant="primary" icon="home">
              Return home
            </ButtonLink>
            <ButtonLink to="/games" icon="grid">
              Browse games
            </ButtonLink>
          </div>
        }
      >
        The page you were looking for has wandered off. Plenty of games are waiting, though.
      </EmptyState>
    </div>
  );
}
