"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { Database, FileText, History, LayoutTemplate } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections = [
  { value: "create", label: "Create Document", icon: FileText, href: "/" },
  { value: "products", label: "Product Database", icon: Database, href: "/?tab=products" },
  { value: "templates", label: "Templates", icon: LayoutTemplate, href: "/?tab=templates" },
] as const;
export type WorkspaceTab = typeof sections[number]["value"];

export function WorkspaceNavigation({ history = false, activeTab = "create" }: { history?: boolean; activeTab?: string }) {
  const navigation = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const nav = navigation.current;
    const pill = indicator.current;
    if (!nav || !pill) return;
    let active = true;
    let frame = 0;
    const measure = () => {
      if (!active) return;
      const target = nav.querySelector<HTMLElement>(history ? '.nav-history[aria-current="page"]' : '[role="tab"][data-state="active"]');
      if (!target) return;
      const parent = nav.getBoundingClientRect();
      const current = target.getBoundingClientRect();
      if (!current.width || !current.height) return;
      const firstMeasurement = nav.dataset.indicatorReady !== "true";
      if (firstMeasurement) pill.style.transition = "none";
      pill.style.width = `${current.width}px`;
      pill.style.height = `${current.height}px`;
      pill.style.transform = `translate3d(${current.left - parent.left - nav.clientLeft}px, ${current.top - parent.top - nav.clientTop}px, 0)`;
      nav.dataset.indicatorReady = "true";
      if (firstMeasurement) frame = requestAnimationFrame(() => { pill.style.transition = ""; });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    nav.querySelectorAll('[role="tab"], .nav-history').forEach(element => observer.observe(element));
    void document.fonts.ready.then(measure);
    return () => { active = false; observer.disconnect(); cancelAnimationFrame(frame); pill.style.transition = ""; };
  }, [history, activeTab]);
  return <nav ref={navigation} className="workspace-navigation no-print" aria-label="Workspace navigation">
    <span ref={indicator} className="workspace-active-indicator" aria-hidden="true"/>
    {history ? <div className="nav-tabs workspace-return-tabs">{sections.map(({ value, label, icon: Icon, href }) => <Link className="nav-history" key={value} href={href}><Icon size={17}/>{label}</Link>)}</div> :
      <TabsList className="nav-tabs" aria-label="Invoice workspace">{sections.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value}><Icon/>{label}</TabsTrigger>)}</TabsList>}
    <Link className="nav-history" href="/history" aria-current={history ? "page" : undefined}><History size={17}/> Document history</Link>
  </nav>;
}
