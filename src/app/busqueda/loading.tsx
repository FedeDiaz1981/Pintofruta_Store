export default function Loading() {
  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <div className="h-12 w-72 animate-pulse rounded-full bg-[rgba(168,109,69,0.12)]" />
      <div className="h-40 animate-pulse rounded-[2rem] bg-[rgba(168,109,69,0.10)]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-[1.6rem] bg-[rgba(168,109,69,0.08)]" />
        ))}
      </div>
    </main>
  );
}
