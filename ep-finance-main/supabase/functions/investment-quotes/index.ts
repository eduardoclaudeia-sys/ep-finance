import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const normalizeTicker = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\.SA$/i, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({error:"method_not_allowed"}), {status:405,headers:{...corsHeaders,"Content-Type":"application/json"}});
  try {
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.tickers) ? body.tickers : [body?.ticker];
    const tickers = [...new Set(raw.map(normalizeTicker).filter(Boolean))].slice(0,20);
    if (!tickers.length) return new Response(JSON.stringify({error:"ticker_required"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(tickers.join(","))}?fundamental=false`;
    const response = await fetch(url,{headers:{"User-Agent":"EP-Finance/1.7"}});
    const payload = await response.json().catch(()=>({}));
    if(!response.ok) return new Response(JSON.stringify({error:"quote_provider_error",status:response.status}),{status:502,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const map = new Map((Array.isArray(payload?.results)?payload.results:[]).map((x:any)=>[normalizeTicker(x?.symbol),x]));
    const now=new Date().toISOString();
    const results=tickers.map(ticker=>{const x:any=map.get(ticker);return x?{ticker,price:Number(x.regularMarketPrice)||null,currency:x.currency||"BRL",changePercent:Number(x.regularMarketChangePercent)||0,name:x.longName||x.shortName||null,source:"brapi",updatedAt:now}:{ticker,price:null,currency:null,changePercent:null,name:null,source:"brapi",updatedAt:now,error:"quote_not_found"}});
    return new Response(JSON.stringify({results}),{headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"}});
  } catch (e) {
    return new Response(JSON.stringify({error:"unexpected_error",message:String(e)}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
