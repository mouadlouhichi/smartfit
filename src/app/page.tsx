// Marker page for Vercel Next.js framework detection. The real app is in
// apps/web and is what gets deployed (see vercel.json outputDirectory).
export default function RootMarkerPage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 48, textAlign: 'center' }}>
      <h1>SmartFit</h1>
      <p>The deployed application lives in <code>apps/web</code>.</p>
    </main>
  );
}
