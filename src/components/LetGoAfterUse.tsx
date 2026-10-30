'use client';

import { useLetGoAfterUse } from '@/hooks/useLetGoAfterUse';

/** Mounted once by `AppShell`: no widget on any page stays active after use (`useLetGoAfterUse`). */
export function LetGoAfterUse() {
  useLetGoAfterUse();
  return null;
}
