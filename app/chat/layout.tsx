import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getOnboardingState } from "../../lib/supabase/server";
import { UserMenu } from "../../components/chat/UserMenu";
import { StickerLogo } from "../../components/kawaii/StickerLogo";

/**
 * Chat-app layout — locked-viewport flex column.
 *
 * Header at top (h-16, in normal flow), the rest of the viewport `flex-1`
 * for the chat shell. No more `pt-16` + fixed-header dance — that gave the
 * top utility bar nowhere to live and pushed the composer off-screen on
 * smaller viewports. Internal regions use `min-h-0` so they actually
 * shrink instead of overflowing.
 *
 * Auth gate: requires Supabase session AND completed onboarding. Routes
 * unauthenticated visitors to /onboarding; routes mid-flow to last step.
 *
 * Demo escape: `kali_demo_mode=rivertown` cookie OR `NEXT_PUBLIC_SUPABASE_URL`
 * unset both bypass the gate and mount Rivertown.
 */

export default async function ChatLayout({ children }: { children: ReactNode }) {
  const supaConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let tenantName = "Rivertown Community Foundation";
  let tenantMission: string | undefined;
  let userEmail: string | null = null;
  let isDemo = !supaConfigured;

  if (supaConfigured) {
    const cookieJar = await cookies();
    const demoCookie = cookieJar.get("kali_demo_mode")?.value === "rivertown";
    if (demoCookie) {
      isDemo = true;
    } else {
      const { userId, email, state } = await getOnboardingState();
      if (!userId) redirect("/onboarding");
      if (!state?.onboardedAt) {
        const step = state?.currentStep ?? 1;
        redirect(`/onboarding?step=${step}`);
      }
      tenantName = state.tenant?.name ?? tenantName;
      tenantMission = state.tenant?.mission;
      userEmail = email;
    }
  }

  return (
    <div
      className="kawaii-page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <ChatHeader
        tenantName={tenantName}
        tenantMission={tenantMission}
        userEmail={userEmail}
        isDemo={isDemo}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function ChatHeader({
  tenantName,
  tenantMission,
  userEmail,
  isDemo,
}: {
  tenantName: string;
  tenantMission?: string;
  userEmail: string | null;
  isDemo: boolean;
}) {
  return (
    <header
      style={{
        display: "flex",
        height: 64,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "2px dashed var(--hair)",
        background: "rgba(255, 247, 240, 0.9)",
        backdropFilter: "blur(8px)",
        padding: "0 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          <StickerLogo size={56} />
        </Link>
        <nav className="hidden sm:flex" style={{ alignItems: "center", gap: 4 }}>
          <NavLink href="/dashboard">dashboard</NavLink>
          <NavLink href="/chat" active>
            chat
          </NavLink>
          <NavLink href="/crypto">crypto</NavLink>
        </nav>
      </div>

      <div className="hidden sm:flex" style={{ alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--matcha)",
          }}
          className="blink-soft"
        />
        <span
          style={{
            fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--mute)",
          }}
        >
          {tenantName.toLowerCase()}
          {isDemo ? " · demo tenant" : ""}
        </span>
      </div>

      <UserMenu
        email={userEmail}
        tenantName={tenantName}
        tenantMission={tenantMission}
        isDemo={isDemo}
      />
    </header>
  );
}

function NavLink({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        textDecoration: "none",
        background: active ? "var(--mochi)" : "transparent",
        color: active ? "var(--matcha-deep-warm)" : "var(--mute)",
        border: active ? "2px solid white" : "2px solid transparent",
        boxShadow: active ? "1px 2px 0 var(--sticker-shadow)" : "none",
        fontFamily: 'var(--font-quicksand), "Quicksand", system-ui, sans-serif',
      }}
    >
      {children}
    </Link>
  );
}
