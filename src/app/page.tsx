import Link from 'next/link';

// Static export can't issue an HTTP redirect; Cloudflare Pages handles it
// via public/_redirects, and this page covers any other static host.
export default function Home() {
  return (
    <main className="p-5">
      <meta httpEquiv="refresh" content="0; url=/intervals" />
      <p>
        <Link href="/intervals">Go to the interval trainer</Link>
      </p>
    </main>
  );
}
