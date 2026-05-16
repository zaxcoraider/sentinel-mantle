export default function Home() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-mono font-bold tracking-widest text-foreground uppercase">
          SENTINEL
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          The circuit breaker for autonomous AI agents on Mantle.
        </p>
        <p className="text-muted-foreground font-mono text-xs opacity-50">
          Building in public — Phase 1
        </p>
      </div>
    </main>
  );
}
