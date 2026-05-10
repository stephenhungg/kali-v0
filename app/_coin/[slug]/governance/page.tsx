/**
 * Governance UI. Lists proposals + tally + vote-cast form for a cause coin.
 * Holders > X tokens (`PROPOSAL_THRESHOLD`) can create proposals.
 *
 * Voting in v1 is just clicking — production replaces with a Privy-signed
 * message proving wallet ownership at the snapshot block.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenants";
import { loadCoinByTenant } from "@/lib/causecoin/trading";
import { listProposals, tallyVotes } from "@/lib/causecoin/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROPOSAL_THRESHOLD = 1_000_000;

export default async function GovernancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();
  const coin = loadCoinByTenant(tenant.id);
  if (!coin) notFound();

  const proposals = await listProposals(coin.id);
  const detailed = await Promise.all(
    proposals.map(async (p) => ({ p, tally: await tallyVotes(p.id) })),
  );

  return (
    <main className="min-h-screen bg-[var(--cream)] text-[var(--matcha-deep)]">
      <section className="mx-auto max-w-[1100px] px-6 pt-16 pb-24 sm:px-12">
        <Link
          href={`/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60 hover:opacity-100"
        >
          ← back to ${coin.symbol}
        </Link>

        <h1 className="r-display mt-8 text-5xl">community fund proposals</h1>
        <p className="mt-4 max-w-[640px] text-sm opacity-80">
          {coin.communityFundBps / 100}% of every ${coin.symbol} trade routes to a holder-governed
          fund. Holders propose grants to programs, partner orgs, or emergency relief. Votes
          weighted by snapshotted balance. 30% participation quorum, simple majority to pass.
        </p>

        {detailed.length === 0 && (
          <div className="chat-card mt-12 p-8 text-sm opacity-70">
            No proposals yet. The first holder above {PROPOSAL_THRESHOLD.toLocaleString()} tokens
            can submit one.
          </div>
        )}

        <ul className="mt-12 space-y-6">
          {detailed.map(({ p, tally }) => (
            <li key={p.id} className="chat-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
                    proposal · {p.status}
                  </div>
                  <h3 className="r-display mt-2 text-2xl">{p.title}</h3>
                  <p className="mt-2 max-w-[600px] text-sm opacity-80">{p.description}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">amount</div>
                  <div className="r-display text-2xl">${p.amountUsdc.toLocaleString()}</div>
                  <div className="mt-1 text-[11px] opacity-60">
                    to {p.recipientWallet.slice(0, 6)}…{p.recipientWallet.slice(-4)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
                <Bar
                  label="for"
                  value={tally.forVotes}
                  pct={
                    tally.forVotes + tally.againstVotes + tally.abstainVotes > 0
                      ? (tally.forVotes /
                          (tally.forVotes + tally.againstVotes + tally.abstainVotes)) *
                        100
                      : 0
                  }
                  color="var(--matcha-mid)"
                />
                <Bar
                  label="against"
                  value={tally.againstVotes}
                  pct={
                    tally.forVotes + tally.againstVotes + tally.abstainVotes > 0
                      ? (tally.againstVotes /
                          (tally.forVotes + tally.againstVotes + tally.abstainVotes)) *
                        100
                      : 0
                  }
                  color="var(--strawberry-deep)"
                />
                <Bar
                  label="abstain"
                  value={tally.abstainVotes}
                  pct={
                    tally.forVotes + tally.againstVotes + tally.abstainVotes > 0
                      ? (tally.abstainVotes /
                          (tally.forVotes + tally.againstVotes + tally.abstainVotes)) *
                        100
                      : 0
                  }
                  color="var(--gray-ink)"
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] opacity-70">
                <span>participation: {tally.participationPct.toFixed(1)}%</span>
                <span>closes {new Date(p.voteEnd).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* Submission form is intentionally minimal in v1 — production renders a
            Privy-signed creation flow with on-chain anchoring. */}
        <div className="mt-16 chat-card p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-60">
            submit a proposal
          </div>
          <p className="mt-2 text-sm opacity-70">
            Hold at least {PROPOSAL_THRESHOLD.toLocaleString()} ${coin.symbol} to submit. Use the
            agent (just ask Kali in chat: &ldquo;propose disbursing $5K to Food Security Network&rdquo;) — the
            governance tool wires it up automatically.
          </p>
        </div>
      </section>
    </main>
  );
}

function Bar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wide">
        <span className="opacity-60">{label}</span>
        <span className="font-mono">
          {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-[var(--mint-pale)]">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
