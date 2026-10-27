import "server-only";
import type { Product, Template } from "../invoice-layout";

const P=(name:string,brand:string,specification:string,unit:string,price:number,defaultQty:number,code=""):Product=>({name,brand,specification,unit,price,defaultQty,code});
export const defaultProducts:Product[]=[
 P("A4 Yellow Paper","Super Best","1 Rim Paket","rim",750,10),P("Tiffin Biscuit","Pops/ Yoyo/ Chocolay","18-20 g","pcs",5.45,3600),P("Milk Powder","Diploma","500 g","pkt",480,18),P("Sugar","Tir/ Fresh","1 Kg Paket","kg",155,20),P("Tea Leafe","Ispahani","400 G Paket","pkt",245,6),P("Soap mini size","Meril/ Detol/ Sevlon","22 Gram","pcs",20,130),P("Hand wash","Lifebuoy","","pcs",85,6),P("Tea Bag","Ispahani / Kazi","50 Pcs Box","box",95,12),P("Box Ficial Tissue","Partex/ Basundhara","2 ply","box",80,6),P("Hand Towel Tissue","Partex/Basundhara","1 ply","pcs",105,6),P("Marker Pen Black","Petra Mira/707/Red Leaf","Parmenent Marker","dzn",1050,8),P("Ditergent Powder","Wheel","1 Kg Paket","kg",155,5),P("Toilet Tissue","Bashundhara","1 Pcs","pcs",30,12),P("Staple Pin","Cangaro","1000 Staples 24/6-1M","box",28,100),P("Super Glue","Fevicol","","pcs",25,12),P("Or-Saline","SMC Orsaline-N","","box",180,2),P("Antacid Plus","","","pcs",3,100),P("Ace Plus","","","pcs",3,100),
 P("Paper Core 46mm","","Paper Core 46X76 mm - Thickness 2.5mm for RFID","PCS",4,13000,"Paper Core 46mm"),P("Paper Core 64mm","","Paper Core 64X76 mm - Thickness 2.5mm for RFID","PCS",5,6000,"Paper Core 64mm"),P("Paper Core 82mm","","Paper Core 82X76 mm - Thickness 2.5mm for RFID","PCS",6,6000,"Paper Core 82mm"),P("Special Black Foil","","SPECIAL BLACK FOIL","ROLL",9200,30,"FOILCO-7067AAQ-BD")
].map((product,index)=>({...product,id:-(index+1)}));
export const defaults:Template[]=[
 {id:-1,name:"Mail Bill Challan",columns:["name","brand","specification","qty","unit","price","total"],vatRate:0,totalLabel:"TOTAL"},
 {id:-2,name:"Paper Core",columns:["code","specification","unit","qty","price","total"],vatRate:10,totalLabel:"TOTAL"},
 {id:-3,name:"Foil Paper",columns:["code","specification","unit","qty","price","total"],vatRate:0,totalLabel:"TOTAL"}
];

export const initialDocument={billNo:"DS/SML/AUG/01",challanNo:"DS/SML/CHA2681",date:"2026-08-09",company:"SML Trims Packaging Limited",address:"Ziraboo, Ashulia, Savar, Bangladesh",contact:"Md. Shahidul Islam (01712991118)",po:""};
