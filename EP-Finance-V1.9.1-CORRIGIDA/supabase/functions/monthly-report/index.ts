import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY=Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL=Deno.env.get('FROM_EMAIL') || 'EP Finance <onboarding@resend.dev>'
const sb=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}})
const brl=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)

Deno.serve(async(req)=>{
  const secret=Deno.env.get('CRON_SECRET')
  if(secret && req.headers.get('x-cron-secret')!==secret) return new Response('Unauthorized',{status:401})
  const now=new Date(); const first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1));
  const year=first.getUTCFullYear(), month=String(first.getUTCMonth()+1).padStart(2,'0'), key=`${year}-${month}`;
  const label=first.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
  const {data:profiles,error}=await sb.from('profiles').select('id,email').eq('monthly_report_enabled',true); if(error)throw error;
  let sent=0;
  for(const p of profiles||[]){
    const {data:row}=await sb.from('finance_data').select('data').eq('user_id',p.id).maybeSingle(); const d:any=row?.data||{};
    const tx=(d.transactions||[]).filter((t:any)=>String(t.date||'').startsWith(key));
    const income=tx.filter((t:any)=>t.type==='income').reduce((a:number,t:any)=>a+Number(t.value||0),0);
    const expense=tx.filter((t:any)=>t.type==='expense').reduce((a:number,t:any)=>a+Number(t.value||0),0);
    const byCat:any={}; tx.filter((t:any)=>t.type==='expense').forEach((t:any)=>byCat[t.category||'Outros']=(byCat[t.category||'Outros']||0)+Number(t.value||0));
    const cats=Object.entries(byCat).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5);
    const investments=(d.investments||[]).reduce((a:number,i:any)=>a+Number(i.current||0),0);
    const cash=(d.transactions||[]).reduce((a:number,t:any)=>a+(t.type==='income'?Number(t.value||0):-Number(t.value||0)),0);
    const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h1>EP Finance</h1><h2>Resumo de ${label}</h2><table width="100%" cellpadding="10"><tr><td>Receitas<br><b>${brl(income)}</b></td><td>Despesas<br><b>${brl(expense)}</b></td><td>Resultado<br><b>${brl(income-expense)}</b></td></tr></table><h3>Maiores categorias de gastos</h3>${cats.length?`<ul>${cats.map(([c,v]:any)=>`<li>${c}: <b>${brl(v)}</b></li>`).join('')}</ul>`:'<p>Nenhuma despesa registrada no mês.</p>'}<h3>Patrimônio atual</h3><p>Caixa: <b>${brl(cash)}</b><br>Investimentos: <b>${brl(investments)}</b><br>Total: <b>${brl(cash+investments)}</b></p><p style="color:#64748b;font-size:12px">Relatório automático do EP Finance.</p></div>`;
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${RESEND_API_KEY}`},body:JSON.stringify({from:FROM_EMAIL,to:[p.email],subject:`EP Finance — resumo de ${label}`,html})}); if(r.ok)sent++;
  }
  return Response.json({ok:true,sent,period:key});
})
