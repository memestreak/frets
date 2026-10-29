import type { Metadata } from 'next';
import { AgentsPage } from '@/features/agents/AgentsPage';

export const metadata: Metadata = { title: 'Agents · Frets' };

export default function Agents() {
  return <AgentsPage />;
}
