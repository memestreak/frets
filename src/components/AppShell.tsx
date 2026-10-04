import type { ReactNode } from 'react';
import { AppFooter } from './AppFooter';
import { AppNav } from './AppNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-[1240px] flex-1 p-5">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
