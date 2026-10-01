import type { ReactNode } from 'react';
import { AppNav, type Section } from './AppNav';

export function AppShell({ active, children }: { active: Section; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active={active} />
      <main className="mx-auto w-full max-w-[1240px] flex-1 p-5">
        {children}
      </main>
    </div>
  );
}
