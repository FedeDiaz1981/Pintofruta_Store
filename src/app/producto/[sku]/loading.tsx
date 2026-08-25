export default function Loading() {
  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <div className="h-8 w-40 animate-pulse rounded-full bg-[rgba(168,109,69,0.12)]" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="h-[28rem] animate-pulse rounded-[2rem] bg-[rgba(168,109,69,0.10)]" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 animate-pulse rounded-full bg-[rgba(168,109,69,0.12)]" />
          <div className="h-28 animate-pulse rounded-[1.6rem] bg-[rgba(168,109,69,0.08)]" />
          <div className="h-40 animate-pulse rounded-[1.6rem] bg-[rgba(168,109,69,0.08)]" />
        </div>
      </div>
    </main>
  );
}
