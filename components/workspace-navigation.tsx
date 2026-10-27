"use client";

import Link from "next/link";
import { Database, FileText, History, LayoutTemplate } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections = [
  { value: "create", label: "Create Document", icon: FileText, href: "/" },
  { value: "products", label: "Product Database", icon: Database, href: "/?tab=products" },
  { value: "templates", label: "Templates", icon: LayoutTemplate, href: "/?tab=templates" },
] as const;
export type WorkspaceTab = typeof sections[number]["value"];

export function WorkspaceNavigation({ history = false }: { history?: boolean }) {
  return <nav className="workspace-navigation no-print" aria-label="Workspace navigation">
    {history ? <div className="nav-tabs workspace-return-tabs">{sections.map(({ value, label, icon: Icon, href }) => <Link className="nav-history" key={value} href={href}><Icon size={17}/>{label}</Link>)}</div> :
      <TabsList className="nav-tabs" aria-label="Invoice workspace">{sections.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value}><Icon/>{label}</TabsTrigger>)}</TabsList>}
    <Link className="nav-history" href="/history" aria-current={history ? "page" : undefined}><History size={17}/> Document history</Link>
  </nav>;
}
