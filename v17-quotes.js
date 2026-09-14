/* EP Finance V1.7 - cotação automática com fallback manual */
(function(global){
  'use strict';
  async function fetchQuotes(supabase,tickers){
    if(!supabase?.functions?.invoke) throw new Error('Cliente Supabase indisponível');
    const list=[...new Set((tickers||[]).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))].slice(0,20);
    if(!list.length)return[];
    const {data,error}=await supabase.functions.invoke('investment-quotes',{body:{tickers:list}});
    if(error) throw error;
    return Array.isArray(data?.results)?data.results:[];
  }
  function applyQuotes(financeData,quotes){
    const out=window.EPV17Data?window.EPV17Data.migrate(financeData):JSON.parse(JSON.stringify(financeData||{}));
    const map=new Map((quotes||[]).map(q=>[String(q.ticker||'').toUpperCase(),q]));
    out.investments=(out.investments||[]).map(inv=>{
      const ticker=String(inv.ticker||inv.symbol||'').toUpperCase(); const q=map.get(ticker); if(!q||q.price==null)return inv;
      const qty=Number(inv.quantity??inv.qty??0);
      return {...inv,ticker,quotePrice:q.price,quoteUpdatedAt:q.updatedAt,quoteSource:q.source,currentValue:qty>0?qty*q.price:(inv.currentValue??inv.valueCurrent??q.price)};
    });
    return out;
  }
  global.EPV17Quotes={fetchQuotes,applyQuotes};
})(window);
