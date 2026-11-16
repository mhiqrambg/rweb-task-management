import Link from 'next/link';
import { copy, routes } from '@taskapp/contracts';
import './app.css';

export default function NotFound() {
  return (
    <main className="center-page">
      <section className="empty-state">
        <h1>{copy.state.notFound.title}</h1>
        <p className="empty-state__body">{copy.state.notFound.body}</p>
        <Link className="btn" data-variant="primary" href={routes.landing}>
          {copy.state.notFound.action}
        </Link>
      </section>
    </main>
  );
}
