export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-deep-night flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center max-w-sm">
        <h1 className="font-display text-north-light text-2xl font-normal tracking-widest mb-2">
          DONT DREAM.
        </h1>
        <h1 className="font-display text-north-light text-2xl font-bold tracking-wide mb-8">
          PLAN.
        </h1>

        <div className="w-8 h-0.5 bg-muted-silver mx-auto mb-8" />

        <p className="text-muted-silver font-light leading-relaxed mb-6">
          You seem to be offline.
        </p>
        <p className="text-muted-silver font-light text-sm leading-relaxed">
          Your plan and recent blocks are still available.
          Connect to continue with North.
        </p>
      </div>
    </main>
  );
}
