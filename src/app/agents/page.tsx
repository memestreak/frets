import type { Metadata } from 'next';
import { AgentsPage } from '@/features/agents/AgentsPage';

export const metadata: Metadata = { title: 'AI agents · Frets' };

export default function Agents() {
  return <AgentsPage />;
}
