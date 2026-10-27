import Home from "@/components/invoice-workspace";
import { requireSession } from "@/lib/server/auth";
import { getCatalog } from "@/lib/server/catalog";
import { defaultProducts, initialDocument } from "@/lib/server/catalog-defaults";
import { bangladeshDate } from "@/lib/document-history";
import { getHistoryEntry } from "@/lib/server/history";
import { RequestError } from "@/lib/server/http";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page({searchParams}:{searchParams:Promise<{history?:string;tab?:string}>}){
 const session=await requireSession();
 const catalog=await getCatalog();
 const {history,tab}=await searchParams;
 const initialTab=tab==="products"||tab==="templates"?tab:"create";
 let saved;
 if(history){
  try{saved=await getHistoryEntry(history)}catch(error){if(error instanceof RequestError&&error.status===404)notFound();throw error}
 }
 return <Home key={`${saved?.id??"new"}:${initialTab}`} initialTab={initialTab} initialCatalog={catalog.value} presetProducts={defaultProducts} initialDocument={{...initialDocument,date:bangladeshDate()}} savedDocument={saved?{id:saved.id,createdAt:saved.createdAt,snapshot:saved.snapshot}:undefined} session={{email:session.email,csrfToken:session.csrfToken,expiresAt:session.expiresAt}}/>;
}
