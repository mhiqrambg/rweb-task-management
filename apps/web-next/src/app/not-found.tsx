import Link from 'next/link';
import { copy, routes } from '@taskapp/contracts';

export default function NotFound() {
  return (
    <main className="center-page">
      <section className="panel auth-panel">
        <h1>{copy.state.notFound.title}</h1>
        <p className="muted">{copy.state.notFound.body}</p>
        <p>
          <Link className="btn" data-variant="primary" href={routes.landing}>
            {copy.state.notFound.action}
          </Link>
        </p>
      </section>
    </main>
  );
}
