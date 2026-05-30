import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Header } from './header';
import { Footer } from './footer';

export function PublicLayout(): JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
