import Link from "next/link";

export function AppBrand({ compact = false, onHome }: { compact?: boolean; onHome?: () => void }) {
  return <>
    <Link href="/" onNavigate={onHome} className="brand-mark brand-home-link" aria-label="Dream Sourcing home">DS</Link>
    <Link href="/" onNavigate={onHome} className="brand-copy brand-home-link">{compact ? <><b>Dream Sourcing</b><span>Invoice & Challan Maker</span></> : <><h1>Dream Sourcing</h1><p>Invoice & Challan Maker</p></>}</Link>
  </>;
}
