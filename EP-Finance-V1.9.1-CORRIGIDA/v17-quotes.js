/* EP Finance V1.7 - cotação automática com fallback manual */
(function(global){
  'use strict';
  async function directBrapi(list){
    const symbols=list.map(t=>String(t).toUpperCase().replace(/\.SA$/i,'')).join(',');
    const r=await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(symbols)}?fundamental=false`);
    if(!r.ok) throw new Error('Provedor de cotação indisponível');
    const payload=await r.json();const now=new Date().toISOString();
    return (payload.results||[]).map(x=>({ticker:String(x.symbol||'').toUpperCase().replace(/\.SA$/i,''),price:Number(x.regularMarketPrice)||null,currency:x.currency||'BRL',changePercent:Number(x.regularMarketChangePercent)||0,name:x.longName||x.shortName||null,source:'brapi',updatedAt:now}));
  }
  async function fetchQuotes(supabase,tickers){
    const list=[...new Set((tickers||[]).map(x=>String(x||'').trim().toUpperCase().replace(/\.SA$/i,'')).filter(Boolean))].slice(0,20);
    if(!list.length)return[];
    if(supabase?.functions?.invoke){
      try{const {data,error}=await supabase.functions.invoke('investment-quotes',{body:{tickers:list}});if(!error&&Array.isArray(data?.results)&&data.results.some(x=>x.price!=null))return data.results;}catch(e){console.warn('EP Finance: Edge Function de cotação indisponível; usando fallback público.',e);}
    }
    return directBrapi(list);
  }
  function applyQuotes(financeData,quotes){
    const out=window.EPV17Data?window.EPV17Data.migrate(financeData):JSON.parse(JSON.stringify(financeData||{}));
    const map=new Map((quotes||[]).map(q=>[String(q.ticker||'').toUpperCase().replace(/\.SA$/i,''),q]));
    out.investments=(out.investments||[]).map(inv=>{
      const ticker=String(inv.ticker||inv.symbol||'').toUpperCase().replace(/\.SA$/i,'');const q=map.get(ticker);if(!q||q.price==null)return inv;
      const qty=Number(inv.quantity??inv.qty??0);const current=qty>0?qty*q.price:Number(inv.current||0);
      return {...inv,ticker,quotePrice:q.price,quoteUpdatedAt:q.updatedAt,quoteSource:q.source,current};
    });
    return out;
  }
  global.EPV17Quotes={fetchQuotes,applyQuotes};
})(window);
