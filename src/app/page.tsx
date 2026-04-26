export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16">
      <section className="space-y-5">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Repo Analyzer Green
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold text-slate-950 sm:text-5xl">
          Evidence-backed repository quality analysis.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-700">
          This scaffold is ready for the first domain slice: collecting
          repository evidence, running a structured reviewer, and composing a
          confidence-aware report card.
        </p>
      </section>
    </main>
  );
}
