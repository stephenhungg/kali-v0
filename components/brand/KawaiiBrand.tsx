import Image from "next/image";
import type { ReactNode } from "react";

type ClassName = {
  className?: string;
};

export function KaliWordmark({ className = "" }: ClassName) {
  return (
    <div
      className={`relative inline-block aspect-[1842/706] w-[min(82vw,620px)] ${className}`}
      aria-label="Kali"
    >
      <Image
        src="/kawaii/logo-sticker-t.png"
        alt="Kali"
        fill
        priority
        sizes="(min-width: 1024px) 980px, 92vw"
        className="object-contain"
      />
    </div>
  );
}

export function MiniKaliWordmark({ className = "" }: ClassName) {
  return (
    <span className={`relative inline-block aspect-[1842/706] w-[96px] align-middle ${className}`} aria-label="Kali">
      <Image src="/kawaii/logo-sticker-t.png" alt="Kali" fill sizes="120px" className="object-contain" />
    </span>
  );
}

export function MatchaMascot({ className = "" }: ClassName) {
  return (
    <span className={`relative inline-block aspect-[508/436] ${className}`} aria-label="Kali matcha mascot">
      <Image src="/kawaii/mascot-matcha-t.png" alt="Kali matcha mascot" fill sizes="280px" className="object-contain" />
    </span>
  );
}

export function ReceiptSticker({
  label,
  value,
  children,
  className = "",
}: {
  label: string;
  value: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`receipt-sticker ${className}`}>
      <span className="font-mono text-[10px] tracking-[0.18em] text-muted-secondary">
        {label}
      </span>
      <strong className="mt-2 block font-swiss text-[22px] font-medium leading-none text-ink-near">
        {value}
      </strong>
      {children ? <div className="mt-3 text-[13px] leading-[1.35] text-muted-deep">{children}</div> : null}
    </div>
  );
}
