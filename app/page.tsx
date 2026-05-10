export default function Home() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 antialiased">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-24 sm:px-10">
        <header className="flex items-center justify-between">
          <span className="font-mono text-sm tracking-tight text-zinc-400">
            kali / v0
          </span>
          <span className="font-mono text-xs tracking-widest text-zinc-600">
            HACKDAVIS · 2026
          </span>
        </header>

        <section className="mt-32 flex-1">
          <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
            the agentic context layer for nonprofits.
          </h1>
          <p className="mt-8 max-w-xl text-balance text-base leading-relaxed text-zinc-400 sm:text-lg">
            one chat interface across eleven SaaS tools — quickbooks,
            salesforce, sharepoint, m365, mailchimp, slack, and more.
            ask anything in plain english. get an answer with citations,
            not a tab graveyard.
          </p>

          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
            <span>11 connectors</span>
            <span aria-hidden>·</span>
            <span>unified context</span>
            <span aria-hidden>·</span>
            <span>solana payouts</span>
            <span aria-hidden>·</span>
            <span>citation-grounded</span>
          </div>
        </section>

        <footer className="mt-24 border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-600">
          v1 prototype · scope at{" "}
          <code className="text-zinc-400">data/v1-prototype-scope.md</code>
        </footer>
      </div>
    </main>
  );
}
