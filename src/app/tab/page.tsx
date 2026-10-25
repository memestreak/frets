import type { Metadata } from 'next';
import { TabPageClient } from '@/features/tab/TabLoader';

export const metadata: Metadata = { title: 'Tab · Frets' };

export default function TabPage() {
  return <TabPageClient />;
}
