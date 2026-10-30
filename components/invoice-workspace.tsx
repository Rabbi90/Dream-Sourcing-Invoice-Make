"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/client-api";
import { deliveryAddressSchema, type DeliveryAddress, type Catalog } from "@/lib/catalog-schema";
import { documentFilename, formatBangladeshTime, MAX_PDF_BYTES, type DocumentSnapshot, type HistorySummary } from "@/lib/document-history";
import { documentSnapshotSchema } from "@/lib/document-schema";
import { flushSync } from "react-dom";
import { TermsEditor } from "@/components/terms-editor";
import { DocumentPages } from "@/components/document-pages";
import { labels, money, sortProducts, type ColumnKey, type Product, type Line, type Template, type ProductSort, type WidthKey } from "@/lib/invoice-layout";
import { FileDown, LayoutTemplate, Plus, Save, Trash2 } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { WorkspaceNavigation, type WorkspaceTab } from "@/components/workspace-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";

const allColumns:ColumnKey[]=["name","code","brand","specification","unit","qty","price","total"];
const blank=():Product=>({name:"",code:"",brand:"",specification:"",unit:"pcs",price:0,defaultQty:1});
const line=(p:Product):Line=>({...p,rowId:crypto.randomUUID(),qty:p.defaultQty??1});
const PRODUCTS_KEY="dream-sourcing-products";
const TEMPLATES_KEY="dream-sourcing-templates";
const PRODUCT_SORT_KEY="dream-sourcing-product-sort";
const productSortOptions:ProductSort[]=["default","name-asc","name-desc","price-asc","price-desc"];
const productSortLabels:Record<ProductSort,string>={default:"Original order","name-asc":"Name: A to Z","name-desc":"Name: Z to A","price-asc":"Price: Low to high","price-desc":"Price: High to low"};
const freshTemplate=():Template=>({name:"New Template",columns:["name","specification","unit","qty","price","total"],vatRate:0,totalLabel:"TOTAL"});

type WorkspaceProps={initialCatalog:Catalog;presetProducts:Product[];initialDocument:{billNo:string;challanNo:string;date:string;company:string;address:string;contact:string;po:string};initialTab?:WorkspaceTab;savedDocument?:{id:string;createdAt:string;snapshot:DocumentSnapshot};session:{email:string;csrfToken:string;expiresAt:number}};
export default function Home({initialCatalog,presetProducts:defaultProducts,initialDocument,session,savedDocument,initialTab="create"}:WorkspaceProps){
 const draft=savedDocument?.snapshot;
 const documentDetails=draft??initialDocument;
 const generationLock=useRef(false);
 const [catalogRevision,setCatalogRevision]=useState(initialCatalog.revision);
 const [legacyImported,setLegacyImported]=useState(initialCatalog.legacyImported);
 const [hasLegacy,setHasLegacy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [products,setProducts]=useState<Product[]>(initialCatalog.products);
 const [activeTab,setActiveTab]=useState<string>(initialTab);
 const [productSort,setProductSort]=useState<ProductSort>("default");
 const sortedProducts=useMemo(()=>sortProducts(products,productSort),[products,productSort]);
 const dropdownProducts=useMemo(()=>sortProducts(products,"name-asc"),[products]);
 const sortStorageKey=`${PRODUCT_SORT_KEY}:${session.email}`;
 const changeProductSort=(value:ProductSort)=>{
  setProductSort(value);
  try{localStorage.setItem(sortStorageKey,value)}catch{/* Browser storage may be disabled. */}
 };
 const [addresses,setAddresses]=useState<DeliveryAddress[]>(initialCatalog.addresses??[]);
 const [addressId,setAddressId]=useState("");
 const [editingProductIndex,setEditingProductIndex]=useState<number|null>(null);
 const [templates,setTemplates]=useState<Template[]>(initialCatalog.templates);
 const [templateIndex,setTemplateIndex]=useState(0);
 const [lines,setLines]=useState<Line[]>(()=>draft?.lines??[line(initialCatalog.products.find(p=>p.id===-2)??initialCatalog.products[0]??defaultProducts[1])]);
 const [docType,setDocType]=useState<"bill"|"challan"|"both">(draft?.docType??"both");
 const [pageMode,setPageMode]=useState<"split"|"single">(draft?.pageMode??"split");
 const [billNo,setBillNo]=useState(documentDetails.billNo),[challanNo,setChallanNo]=useState(documentDetails.challanNo),[date,setDate]=useState(documentDetails.date);
 const [company,setCompany]=useState(documentDetails.company),[address,setAddress]=useState(documentDetails.address),[contact,setContact]=useState(documentDetails.contact),[po,setPo]=useState(documentDetails.po);
 const [restoredTemplate,setRestoredTemplate]=useState<Template|null>(draft?.template??null);
 const [editingProduct,setEditingProduct]=useState<Product>(blank());
 const [customTemplate,setCustomTemplate]=useState<Template>(freshTemplate);
 const [editingTemplateIndex,setEditingTemplateIndex]=useState<number|null>(null);
 const [notice,setNotice]=useState("");
 const [generating,setGenerating]=useState(false);
 useEffect(()=>{
  const checkSession=()=>{apiRequest("/api/auth/session").catch(()=>undefined)};
  const timer=window.setTimeout(()=>{
   try{const saved=localStorage.getItem(sortStorageKey);if(productSortOptions.includes(saved as ProductSort))setProductSort(saved as ProductSort)}catch{/* Use original order when storage is unavailable. */}
   try{setHasLegacy(Boolean(localStorage.getItem(PRODUCTS_KEY)||localStorage.getItem(TEMPLATES_KEY)))}catch{setHasLegacy(false)}
  },0);
  const interval=window.setInterval(checkSession,60000);
  window.addEventListener("focus",checkSession);
  const onVisibility=()=>{if(document.visibilityState==="visible")checkSession()};
  const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload()};
  document.addEventListener("visibilitychange",onVisibility);window.addEventListener("pageshow",onPageShow);
  return()=>{window.clearTimeout(timer);window.clearInterval(interval);window.removeEventListener("focus",checkSession);document.removeEventListener("visibilitychange",onVisibility);window.removeEventListener("pageshow",onPageShow)};
 },[sortStorageKey]);
 async function persistCatalog(nextProducts:Product[],nextTemplates:Template[],imported=legacyImported,nextAddresses=addresses){
  const result=await apiRequest<Catalog>("/api/catalog",{method:"PUT",csrfToken:session.csrfToken,body:{products:nextProducts,templates:nextTemplates,addresses:nextAddresses,revision:catalogRevision,legacyImported:imported}});
  setAddresses(result.addresses);setCatalogRevision(result.revision);setProducts(result.products);setTemplates(result.templates);setLegacyImported(result.legacyImported);
 }
 async function importLegacy(){
  setSaving(true);
  try{
   const productText=localStorage.getItem(PRODUCTS_KEY),templateText=localStorage.getItem(TEMPLATES_KEY);
   if((productText?.length||0)+(templateText?.length||0)>500000)throw new Error("Saved browser data is too large to import.");
   const oldProducts=productText?JSON.parse(productText):[];
   const oldTemplateData=templateText?JSON.parse(templateText):[];
   const oldTemplates=Array.isArray(oldTemplateData)?oldTemplateData:oldTemplateData.templates;
   if(!Array.isArray(oldProducts)||!Array.isArray(oldTemplates))throw new Error("Saved browser data could not be read.");
   const mergedProducts=[...products];
   const usedIds=new Set(products.map(p=>p.id));let nextId=Date.now();
   for(const item of oldProducts){
    const index=mergedProducts.findIndex(p=>item.id!==undefined?p.id===item.id:(["name","code","brand","specification","unit"] as const).every(key=>p[key]===item[key]));
    let id=item.id??(index>=0?mergedProducts[index].id:undefined);
    if(id===undefined){while(usedIds.has(nextId))nextId++;id=nextId++}
    usedIds.add(id);
    if(index<0)mergedProducts.push({...item,id});else mergedProducts[index]={...item,id};
   }
   const mergedTemplates=[...templates];for(const item of oldTemplates){const index=mergedTemplates.findIndex(t=>item.id!==undefined&&t.id===item.id);if(index<0)mergedTemplates.push(item);else mergedTemplates[index]=item}
   await persistCatalog(mergedProducts,mergedTemplates,true);
   localStorage.removeItem(PRODUCTS_KEY);localStorage.removeItem(TEMPLATES_KEY);setHasLegacy(false);setNotice("Previous products and templates imported into your private account.");
  }catch(error){setNotice(error instanceof Error?error.message:"The import failed. Your original browser data is still available.")}
  finally{setSaving(false)}
 }
 async function logout(){try{await apiRequest("/api/auth/logout",{method:"POST",body:{},csrfToken:session.csrfToken});window.location.replace("/login")}catch(error){setNotice(error instanceof Error?error.message:"Sign out failed.")}}

 const template=restoredTemplate??templates[templateIndex]??templates[0];
 const subtotal=useMemo(()=>lines.reduce((s,l)=>s+(+l.qty||0)*(+l.price||0),0),[lines]),vat=subtotal*template.vatRate/100,total=subtotal+vat;
 const setLine=(id:string,key:keyof Line,value:string|number)=>setLines(v=>v.map(l=>l.rowId===id?{...l,[key]:value}:l));
 const chooseTemplate=(i:number)=>{setRestoredTemplate(null);setTemplateIndex(i);const t=templates[i];if(t.id===-2)setLines(defaultProducts.slice(18,21).map(p=>line(products.find(item=>item.id===p.id)??p)));else if(t.id===-3)setLines([line(products.find(p=>p.id===-22)??defaultProducts[21])])};
 async function saveProduct(){
  if(saving)return;setSaving(true);
  try{const item={...editingProduct,name:editingProduct.name.trim(),id:editingProduct.id??Date.now()};const updated=editingProductIndex!==null?products.map((p,i)=>i===editingProductIndex?item:p):[...products,item];await persistCatalog(updated,templates);setEditingProduct(blank());setEditingProductIndex(null);setNotice("Product saved.")}
  catch(error){setNotice(error instanceof Error?error.message:"Product could not be saved.")}
  finally{setSaving(false)}
 }
 async function deleteProduct(index:number){
  if(saving||!window.confirm(`Delete product "${products[index].name}"? Existing document items stay unchanged.`))return;
  setSaving(true);
  try{await persistCatalog(products.filter((_,i)=>i!==index),templates);
   if(editingProductIndex===index){setEditingProductIndex(null);setEditingProduct(blank())}
   else if(editingProductIndex!==null&&editingProductIndex>index)setEditingProductIndex(editingProductIndex-1);
   setNotice("Product deleted.");
  }catch(error){setNotice(error instanceof Error?error.message:"Delete failed.")}finally{setSaving(false)}
 }
 async function saveAddress(){
  if(saving)return;
  const parsed=deliveryAddressSchema.safeParse({id:addressId||crypto.randomUUID(),company,address,contact});
  if(!parsed.success){setNotice("Enter a company and address (up to 200 and 2000 characters), and a contact up to 500 characters.");return}
  setSaving(true);
  try{const item=parsed.data;await persistCatalog(products,templates,legacyImported,addressId?addresses.map(a=>a.id===addressId?item:a):[...addresses,item]);setAddressId(item.id);setNotice("Delivery address saved.")}
  catch(error){setNotice(error instanceof Error?error.message:"Address could not be saved.")}finally{setSaving(false)}
 }
 async function deleteAddress(){
  if(saving||!addressId||!window.confirm("Delete this saved delivery address? The current document keeps its address."))return;
  setSaving(true);
  try{await persistCatalog(products,templates,legacyImported,addresses.filter(a=>a.id!==addressId));setAddressId("");setNotice("Saved address deleted.")}
  catch(error){setNotice(error instanceof Error?error.message:"Address could not be deleted.")}finally{setSaving(false)}
 }
 async function deleteTemplate(index:number){
  if(saving)return;
  if(templates.length===1){setNotice("Keep at least one template. Create another before deleting this one.");return}
  if(!window.confirm(`Delete template "${templates[index].name}"? Saved history documents will remain available.`))return;
  setSaving(true);
  try{
   await persistCatalog(products,templates.filter((_,i)=>i!==index));
   setTemplateIndex(current=>current===index?0:current>index?current-1:current);
   if(editingTemplateIndex===index){setEditingTemplateIndex(null);setCustomTemplate(freshTemplate())}
   else if(editingTemplateIndex!==null&&editingTemplateIndex>index)setEditingTemplateIndex(editingTemplateIndex-1);
   setNotice("Template deleted.");
  }catch(error){setNotice(error instanceof Error?error.message:"Template could not be deleted.")}
  finally{setSaving(false)}
 }
 async function saveTemplate(){
  if(saving)return;
  const name=customTemplate.name.trim();
  if(!name){setNotice("Enter a template name.");return}
  if(!customTemplate.columns.some(c=>c!=="price"&&c!=="total")){setNotice("Select at least one column that can also appear on the challan.");return}
  const keys:WidthKey[]=["serial",...customTemplate.columns];
  const widths=keys.map(key=>customTemplate.columnWidths?.[key]);
  const widthTotal=widths.reduce<number>((sum,width)=>sum+(width||0),0);
  if(widths.some(width=>width!==undefined&&(!Number.isFinite(width)||width<2||width>95))||widthTotal>100.01||(widths.some(width=>!width)&&widthTotal>=100)||(widths.every(Boolean)&&Math.abs(widthTotal-100)>.01)){
   setNotice("Column widths must be 2–95%. Leave some columns on Auto, or make all widths add up to 100%.");return;
  }
  if([customTemplate.rowHeight,customTemplate.headerHeight,customTemplate.totalRowHeight].some(height=>height!==undefined&&(!Number.isFinite(height)||height<20||height>200))){setNotice("Use a height from 20 to 200 px, or leave it blank for the current size.");return}
  if(!Number.isFinite(customTemplate.vatRate)||customTemplate.vatRate<0||customTemplate.vatRate>100){setNotice("VAT must be from 0 to 100%.");return}
  if(!(customTemplate.totalLabel?.trim()||"TOTAL")||((customTemplate.totalLabel?.trim()||"TOTAL").length>40)){setNotice("Use a TOTAL row label of up to 40 characters.");return}
  const item={...customTemplate,name,totalLabel:customTemplate.totalLabel?.trim()||"TOTAL",id:customTemplate.id??Date.now()};
  const updated=editingTemplateIndex===null?[...templates,item]:templates.map((t,i)=>i===editingTemplateIndex?item:t);
  setSaving(true);
  try{await persistCatalog(products,updated)}catch(error){setNotice(error instanceof Error?error.message:"Template could not be saved.");return}finally{setSaving(false)}
  const index=editingTemplateIndex??updated.length-1;
  setRestoredTemplate(null);setTemplateIndex(index);setEditingTemplateIndex(index);setCustomTemplate(item);
  setNotice(editingTemplateIndex===null?"Template created and selected.":"Template updated.");
 }
 async function generatePdf(){
  if(generationLock.current)return;
  const parsed=documentSnapshotSchema.safeParse({billNo,challanNo,date,company,address,contact,po,docType,pageMode,template,lines});
  if(!parsed.success){setNotice("Check the document date, company, document numbers and items. Quantities and prices must be non-negative, with at least one item.");return}
  const snapshot=parsed.data;
  generationLock.current=true;
  setGenerating(true);
  try{
   await apiRequest("/api/auth/session");
   flushSync(()=>setActiveTab("create"));
   if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
   await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   await document.fonts.ready;
   await Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.addEventListener("load",()=>resolve(),{once:true});img.addEventListener("error",()=>resolve(),{once:true})})));
   const [{default:html2canvas},{jsPDF}]=await Promise.all([import("html2canvas"),import("jspdf")]);
   const deadline=performance.now()+5000;
   while(document.querySelector('[data-pagination-ready="false"]')){
    if(performance.now()>deadline)throw new Error("Page layout is still loading. Please try again.");
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
   const layoutError=document.querySelector(".pagination-error");
   if(layoutError)throw new Error(layoutError.textContent||"The table does not fit the page.");
   const pages=Array.from(document.querySelectorAll<HTMLElement>(".paper[data-export-page]"));
   if(!pages.length)throw new Error("No document page found");
   const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
   for(let i=0;i<pages.length;i++){
    const table=pages[i].querySelector("table")!,body=pages[i].querySelector(".document-body")!;
    if(Math.max(table.getBoundingClientRect().bottom,pages[i].querySelector(".document-terms")?.getBoundingClientRect().bottom??0)>body.getBoundingClientRect().bottom+1)throw new Error("Page layout changed. Please try again.");
    const canvas=await html2canvas(pages[i],{
     scale:3,useCORS:true,backgroundColor:"#ffffff",logging:false,
     onclone:(clonedDocument)=>{
      // html2canvas measures text baselines with an inline 1px image.
      // Tailwind's block-image reset shifts that measurement downward.
      // Correct it only in the export clone; the live UI stays unchanged.
      const baselineStyle=clonedDocument.createElement("style");
      baselineStyle.textContent="img { display: inline-block; }";
      clonedDocument.head.appendChild(baselineStyle);
     },
    });
    if(i>0)pdf.addPage("a4","portrait");
    pdf.addImage(canvas.toDataURL("image/jpeg",.92),"JPEG",0,0,210,297,undefined,"FAST");
   }
   if(pdf.output("blob").size>MAX_PDF_BYTES)throw new Error("This PDF exceeds the 3 MB history limit. Generate fewer items at a time.");
   const pdfBase64=pdf.output("datauristring").split(",")[1];
   const saved=await apiRequest<HistorySummary>("/api/history",{method:"POST",csrfToken:session.csrfToken,body:{snapshot,pdfBase64,pageCount:pages.length,...(savedDocument?{sourceId:savedDocument.id}:{})}});
   try{
    await pdf.save(documentFilename(snapshot),{returnPromise:true});
    setNotice(`PDF download started and saved in history. ${formatBangladeshTime(saved.createdAt)}`);
   }catch{setNotice(`PDF saved in history at ${formatBangladeshTime(saved.createdAt)}. Download it from History.`)}
  }catch(error){setNotice(error instanceof Error?`PDF generation failed: ${error.message}`:"PDF generation failed. Please try again.")}
  finally{generationLock.current=false;setGenerating(false)}
 }
 return <main className="min-h-screen bg-[#eef4f8] text-slate-900">
  <header className="app-header no-print"><AppBrand onHome={()=>setActiveTab("create")}/><Button onClick={generatePdf} disabled={generating} className="ml-auto bg-[#164995] hover:bg-[#103a78]"><FileDown/> {generating?"Generating…":"Generate PDF"}</Button><a className="account-link" href="/account">Account</a><Button variant="outline" onClick={logout}>Sign out</Button></header>
  {savedDocument&&<div className="workspace-links no-print"><span>Editing a copy saved {formatBangladeshTime(savedDocument.createdAt)}. Generate PDF to save a new version.</span><Link href="/">New document</Link></div>}
  {hasLegacy&&!legacyImported&&<div className="legacy-banner no-print"><span>Previous products and templates were found in this browser.</span><Button variant="outline" onClick={importLegacy} disabled={saving}>Import previous data</Button></div>}
  <Tabs value={activeTab} onValueChange={setActiveTab} className="workspace" inert={generating}>
   <WorkspaceNavigation activeTab={activeTab}/>
   <TabsContent value="create" className="create-grid">
    <section className="editor no-print">
     <Section n="01" title="Document setup"/>{restoredTemplate&&<p className="template-help">Using saved layout: {restoredTemplate.name}. Select a template below to replace it.</p>}<div className="template-pills">{templates.map((t,i)=><button key={t.name+i} className={!restoredTemplate&&i===templateIndex?"active":""} onClick={()=>chooseTemplate(i)}>{t.name}</button>)}</div>
     <div className="field-grid three"><label>Output<select value={docType} onChange={e=>setDocType(e.target.value as typeof docType)}><option value="both">Bill + Challan</option><option value="bill">Bill only</option><option value="challan">Challan only</option></select></label><label>Item page layout<select value={pageMode} onChange={e=>setPageMode(e.target.value as typeof pageMode)}><option value="split">Split across pages</option><option value="single">Fit on one page (compact)</option></select></label><label>Bill No.<Input value={billNo} onChange={e=>setBillNo(e.target.value)}/></label><label>Challan No.<Input value={challanNo} onChange={e=>setChallanNo(e.target.value)}/></label><label>Date<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>PO / Reference<Input value={po} onChange={e=>setPo(e.target.value)} placeholder="Optional"/></label></div>
     <Section n="02" title="Delivery address"/>
     <div className="address-presets">
      <label>Saved delivery addresses<select value={addressId} disabled={saving} onChange={e=>{const id=e.target.value;setAddressId(id);const selected=addresses.find(a=>a.id===id);if(selected){setCompany(selected.company);setAddress(selected.address);setContact(selected.contact)}}}><option value="">Current / unsaved address</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.company} — {a.address}</option>)}</select></label>
      <div className="address-actions"><Button variant="outline" disabled={saving} onClick={()=>{setAddressId("");setCompany("");setAddress("");setContact("")}}><Plus/> New address</Button><Button variant="outline" disabled={saving} onClick={saveAddress}><Save/> {addressId?"Save changes":"Save address"}</Button>{addressId&&<Button className="address-delete" variant="outline" disabled={saving} onClick={deleteAddress}><Trash2/> Delete</Button>}</div>
      <p className="address-help">Choose a saved address to edit it, or create a new one.</p>
     </div>
     <div className="field-grid two"><label>Company<Input value={company} onChange={e=>setCompany(e.target.value)}/></label><label>Contact person & phone<Input value={contact} onChange={e=>setContact(e.target.value)}/></label><label className="wide">Address<Textarea value={address} onChange={e=>setAddress(e.target.value)} rows={2}/></label></div>
     <div className="section-head"><div><span>03</span><h2>Items</h2></div><select aria-label="Add from database (A–Z)" className="product-picker" defaultValue="" onChange={e=>{if(e.currentTarget.value==="")return;const p=dropdownProducts[Number(e.currentTarget.value)];if(p)setLines(v=>[...v,line(p)]);e.currentTarget.value=""}}><option value="">+ Add from database (A–Z)</option>{dropdownProducts.map((p,i)=><option value={i} key={p.id??i}>{p.name} — Tk {money(p.price)}</option>)}</select></div>
     <div className="line-list">{lines.map((l,i)=><div className="line-card" key={l.rowId}><div className="line-title"><b>Item {i+1}</b><button aria-label="Remove item" onClick={()=>setLines(v=>v.filter(x=>x.rowId!==l.rowId))}><Trash2/></button></div><div className="field-grid two">
      {template.columns.includes("name")&&<Field label="Product" value={l.name} set={v=>setLine(l.rowId,"name",v)}/>}
      {template.columns.includes("code")&&<Field label="Product code" value={l.code} set={v=>setLine(l.rowId,"code",v)}/>}
      {template.columns.includes("brand")&&<Field label="Brand" value={l.brand} set={v=>setLine(l.rowId,"brand",v)}/>}
      {template.columns.includes("specification")&&<Field label="Specification" value={l.specification} set={v=>setLine(l.rowId,"specification",v)}/>}
      <Field label="Unit" value={l.unit} set={v=>setLine(l.rowId,"unit",v)}/><Num label="Quantity" value={l.qty} set={v=>setLine(l.rowId,"qty",v)}/><Num label="Unit price" value={l.price} set={v=>setLine(l.rowId,"price",v)}/><label>Line total<Input value={money(l.qty*l.price)} disabled/></label>
     </div></div>)}</div><Button variant="outline" className="w-full" onClick={()=>setLines(v=>[...v,line(blank())])}><Plus/> Add blank row</Button>
    </section>
    <section className="preview-shell"><div className="preview-label no-print"><span>Live A4 preview</span><b>{template.name}</b></div>{(docType==="bill"||docType==="both")&&<DocumentPages kind="bill" pageMode={pageMode} template={template} lines={lines} company={company} address={address} contact={contact} po={po} number={billNo} date={date} subtotal={subtotal} vat={vat} total={total}/>} {(docType==="challan"||docType==="both")&&<DocumentPages kind="challan" pageMode={pageMode} template={template} lines={lines} company={company} address={address} contact={contact} po={po} number={challanNo} date={date} subtotal={subtotal} vat={0} total={total}/>}</section>
   </TabsContent>
   <TabsContent value="products" className="manage-panel no-print"><div className="manage-head"><div><p>Preset data</p><h2>Product & price database</h2></div><Button variant="outline" onClick={()=>{setEditingProductIndex(null);setEditingProduct(blank())}}><Plus/> New product</Button></div><div className="catalog-toolbar"><label>Sort products<select value={productSort} onChange={e=>changeProductSort(e.target.value as ProductSort)}>{productSortOptions.map(sort=><option key={sort} value={sort}>{productSortLabels[sort]}</option>)}</select></label></div><div className="catalog-grid"><div className="catalog-table"><div className="catalog-row catalog-title"><span>Product</span><span>Unit</span><span>Price</span></div>{sortedProducts.map((p,i)=><div className="catalog-product" key={p.id??i}><button className="catalog-row" aria-label={`Edit ${p.name}`} onClick={()=>{setEditingProductIndex(products.indexOf(p));setEditingProduct({...p})}}><span><b>{p.name}</b><small>{p.brand||p.code||p.specification}</small><small>Edit product</small></span><span>{p.unit}</span><span>Tk {money(p.price)}</span></button><button className="product-delete" aria-label={`Delete ${p.name}`} title="Delete product" disabled={saving} onClick={()=>deleteProduct(products.indexOf(p))}><Trash2/></button></div>)}</div><div className="form-card"><h3>{editingProductIndex!==null?"Edit product":"Add product"}</h3>{(["name","code","brand","specification","unit"] as const).map(k=><label key={k}>{labels[k as ColumnKey]||k}<Input value={editingProduct[k]} onChange={e=>setEditingProduct(v=>({...v,[k]:e.target.value}))}/></label>)}<div className="field-grid two"><Num label="Price" value={editingProduct.price} set={v=>setEditingProduct(x=>({...x,price:v}))}/><Num label="Default qty" value={editingProduct.defaultQty} set={v=>setEditingProduct(x=>({...x,defaultQty:v}))}/></div><Button onClick={saveProduct} disabled={saving}><Save/> Save product</Button></div></div></TabsContent>
   <TabsContent value="templates" className="manage-panel no-print">
    <div className="manage-head"><div><p>Reusable layouts</p><h2>Document templates</h2></div><Button variant="outline" onClick={()=>{setEditingTemplateIndex(null);setCustomTemplate(freshTemplate())}}><Plus/> New template</Button></div>
    <p className="template-help">Select a template to change its name or layout, or create a new one.</p>
    <div className="template-manager"><div className="saved-templates">{templates.map((t,i)=><div className="template-card" key={t.id??i}><button className={`template-card-select ${editingTemplateIndex===i?"selected":""}`} onClick={()=>{chooseTemplate(i);setEditingTemplateIndex(i);setCustomTemplate({...t,columns:[...t.columns],columnWidths:{...t.columnWidths}})}}><LayoutTemplate/><span><b>{t.name}</b><small>{t.columns.length} columns · VAT {t.vatRate}%</small><small>Edit name & layout</small></span></button><button type="button" className="template-card-delete" aria-label={`Delete template ${t.name}`} title={templates.length===1?"Keep at least one template":"Delete template"} disabled={saving||templates.length===1} onClick={()=>deleteTemplate(i)}><Trash2 aria-hidden="true"/></button></div>)}</div>
     <div className="form-card"><h3>{editingTemplateIndex===null?"Create a template":"Edit template"}</h3>
      <Field label="Template name" value={customTemplate.name} set={v=>setCustomTemplate(x=>({...x,name:v}))}/>
      <Num label="VAT rate (%)" value={customTemplate.vatRate} set={v=>setCustomTemplate(x=>({...x,vatRate:v}))}/>
      <div className="column-picker">{allColumns.map(c=><label key={c}><input type="checkbox" checked={customTemplate.columns.includes(c)} onChange={()=>setCustomTemplate(v=>({...v,columns:v.columns.includes(c)?v.columns.filter(x=>x!==c):[...v.columns,c]}))}/><span>{labels[c]}</span></label>)}</div>
      <div className="column-picker">
       <label><input type="checkbox" checked={customTemplate.showDocumentMeta!==false} onChange={e=>setCustomTemplate(t=>({...t,showDocumentMeta:e.target.checked}))}/>Bill / challan number and date box</label>
       <label><input type="checkbox" checked={customTemplate.showTotals!==false} onChange={e=>setCustomTemplate(t=>({...t,showTotals:e.target.checked}))}/>Summary and VAT rows (requires Total Value)</label>
       <label><input type="checkbox" checked={!!customTemplate.showTerms} onChange={e=>setCustomTemplate(t=>({...t,showTerms:e.target.checked}))}/>Terms and conditions</label>
      </div>
      {customTemplate.showTerms&&<TermsEditor value={customTemplate.terms??""} onChange={terms=>setCustomTemplate(t=>({...t,terms}))}/>}
      <p className="template-help">Unchecked fields are hidden in preview and PDF after saving the template.</p>
      <fieldset className="dimension-controls"><legend>Row & column sizes (optional)</legend><p>Leave blank to keep the current sizes. Rows expand when text needs more space.</p>
       <div className="field-grid two"><SizeInput label="Minimum row height (px)" value={customTemplate.rowHeight} min={20} max={200} set={value=>setCustomTemplate(t=>({...t,rowHeight:value}))}/><SizeInput label="Minimum header height (px)" value={customTemplate.headerHeight} min={20} max={200} set={value=>setCustomTemplate(t=>({...t,headerHeight:value}))}/></div>
       <p>Column widths use a percentage of the table. Auto columns share the remaining space. The table always stays inside the page.</p>
       <div className="field-grid two">{(["serial",...customTemplate.columns] as WidthKey[]).map(key=><SizeInput key={key} label={`${key==="serial"?"SL. No":labels[key]} width (%)`} value={customTemplate.columnWidths?.[key]} min={2} max={95} set={value=>setCustomTemplate(t=>({...t,columnWidths:{...t.columnWidths,[key]:value}}))}/>)}</div>
       <Button variant="outline" onClick={()=>setCustomTemplate(t=>({...t,rowHeight:undefined,headerHeight:undefined,totalRowHeight:undefined,columnWidths:undefined}))}>Reset sizes to original</Button>
      </fieldset>
      <fieldset className="dimension-controls total-row-controls"><legend>TOTAL row</legend><p>Shown on the final bill page when Total Value and summary rows are enabled. The amount includes VAT when applicable.</p><Field label="TOTAL row label" value={customTemplate.totalLabel??"TOTAL"} set={value=>setCustomTemplate(t=>({...t,totalLabel:value}))}/><SizeInput label="Minimum TOTAL row height (px)" value={customTemplate.totalRowHeight} min={20} max={200} set={value=>setCustomTemplate(t=>({...t,totalRowHeight:value}))}/></fieldset>
      {editingTemplateIndex!==null&&templates.length===1&&<p className="template-help">Create another template before deleting the last one.</p>}
      <Button onClick={saveTemplate} disabled={saving}><Save/> {editingTemplateIndex===null?"Save template":"Save changes"}</Button>
     </div>
    </div>
   </TabsContent>
  </Tabs>{generating&&<div className="pdf-progress no-print" role="status">Preparing and saving your PDF…</div>}{notice&&<div className="toast no-print" role="status" aria-live="polite"><span>{notice}</span><Link href="/history">View history</Link><button aria-label="Dismiss notification" onClick={()=>setNotice("")}>×</button></div>}
 </main>
}
function Section({n,title}:{n:string;title:string}){return <div className="section-head"><div><span>{n}</span><h2>{title}</h2></div></div>}
function Field({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <label>{label}<Input value={value} onChange={e=>set(e.target.value)}/></label>}
function Num({label,value,set}:{label:string;value:number;set:(v:number)=>void}){return <label>{label}<Input type="number" min={0} step="any" value={value} onChange={e=>set(+e.target.value)}/></label>}
function SizeInput({label,value,min,max,set}:{label:string;value:number|undefined;min:number;max:number;set:(v:number|undefined)=>void}){return <label>{label}<Input type="number" min={min} max={max} step={1} placeholder="Auto" value={value??""} onChange={e=>set(e.target.value===""?undefined:Number(e.target.value))}/></label>}
