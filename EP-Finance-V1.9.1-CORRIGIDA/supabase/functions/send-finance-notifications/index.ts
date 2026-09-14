import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "EP Finance <onboarding@resend.dev>";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type FinanceData = {
  bills?: Array<{id:string,description:string,value:number,due:string,status:string}>;
  transactions?: Array<{id:string,type:string,description:string,value:number,date:string,category?:string,wallet?:string}>;
  settings?: {budget?:number};
};
type Alert = {title:string,body:string,tag:string,url:string,level?:string};

const localDate = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function dayDiff(dateStr:string){const today=new Date(localDate()+"T12:00:00-03:00");const target=new Date(dateStr+"T12:00:00-03:00");return Math.round((target.getTime()-today.getTime())/86400000);}
function brl(v:number){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function localWeekday(){return new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",weekday:"short"}).format(new Date());}
function dateMinus(days:number){const d=new Date(localDate()+"T12:00:00-03:00");d.setDate(d.getDate()-days);return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function esc(v:string){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]!));}

async function sendEmail(to:string, alerts:Alert[]){
  if(!RESEND_API_KEY || !to || !alerts.length) return false;
  const rows=alerts.map(a=>`<div style="padding:14px;border:1px solid #e5e7eb;border-radius:12px;margin:10px 0"><strong>${esc(a.title)}</strong><div style="color:#475569;margin-top:4px">${esc(a.body)}</div></div>`).join("");
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2>EP Finance — seus alertas</h2><p>Confira o que precisa da sua atenção hoje.</p>${rows}<p style="color:#64748b;font-size:12px">Você pode alterar estes canais em Ajustes → Central de alertas.</p></div>`;
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${RESEND_API_KEY}`},body:JSON.stringify({from:FROM_EMAIL,to:[to],subject:`EP Finance — ${alerts.length} alerta${alerts.length>1?"s":""} financeiro${alerts.length>1?"s":""}`,html})});
  if(!r.ok) console.error("email failed",r.status,await r.text());
  return r.ok;
}

Deno.serve(async () => {
  const [{data:subscriptions,error:subError},{data:prefRows,error:prefError}] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id,endpoint,p256dh,auth"),
    supabase.from("notification_preferences").select("user_id,preferences")
  ]);
  if(subError) return new Response(subError.message,{status:500});
  if(prefError) return new Response(prefError.message,{status:500});

  const prefMap=new Map((prefRows||[]).map((r:any)=>[r.user_id,r.preferences||{}]));
  const userIds=[...new Set([...(subscriptions||[]).map((s:any)=>s.user_id),...(prefRows||[]).map((p:any)=>p.user_id)])];
  let pushSent=0,emailSent=0;

  for(const userId of userIds){
    const [{data:financeRow},{data:profile}] = await Promise.all([
      supabase.from("finance_data").select("data").eq("user_id",userId).maybeSingle(),
      supabase.from("profiles").select("email").eq("id",userId).maybeSingle()
    ]);
    const data=(financeRow?.data||{}) as FinanceData;
    const prefs:any=prefMap.get(userId)||{};
    const alerts:Alert[]=[];

    for(const bill of data.bills||[]){
      if(bill.status!=="pending")continue;
      const diff=dayDiff(bill.due);
      if(diff===3 && prefs.bills3Days!==false) alerts.push({title:"Conta chegando",body:`${bill.description} vence em 3 dias • ${brl(bill.value)}`,tag:`bill-3-${bill.id}-${bill.due}`,url:"./",level:"info"});
      if(diff===1 && prefs.bills1Day!==false) alerts.push({title:"Conta vence amanhã",body:`${bill.description} • ${brl(bill.value)}`,tag:`bill-1-${bill.id}-${bill.due}`,url:"./",level:"warning"});
      if(diff<0 && prefs.billsOverdue!==false) alerts.push({title:"Conta vencida",body:`${bill.description} está pendente há ${Math.abs(diff)} dia(s).`,tag:`bill-overdue-${bill.id}-${localDate()}`,url:"./",level:"danger"});
    }

    const month=localDate().slice(0,7);
    const realizedExpenses=(data.transactions||[]).filter(t=>t.type==="expense" && (t.wallet||"cash")==="cash" && t.date<=localDate() && t.date.startsWith(month)).reduce((sum,t)=>sum+Number(t.value||0),0);
    const budget=Number(data.settings?.budget||0); const usage=budget?realizedExpenses/budget:0;
    if(budget && usage>=1 && prefs.budget100!==false) alerts.push({title:"Orçamento atingido",body:`Você atingiu ${Math.round(usage*100)}% do orçamento do mês.`,tag:`budget-100-${month}`,url:"./",level:"danger"});
    else if(budget && usage>=.8 && prefs.budget80!==false) alerts.push({title:"Orçamento em alerta",body:`Você já utilizou ${Math.round(usage*100)}% do orçamento do mês.`,tag:`budget-80-${month}`,url:"./",level:"warning"});

    const userSubs=(subscriptions||[]).filter((s:any)=>s.user_id===userId);
    if(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY){
      for(const alert of alerts){
        for(const s of userSubs){
          try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(alert));pushSent++;}
          catch(e:any){console.error("push failed",e?.statusCode,e?.message);if(e?.statusCode===404||e?.statusCode===410)await supabase.from("push_subscriptions").delete().eq("endpoint",s.endpoint);}
        }
      }
    }

    if(profile?.email){
      const emailAlerts:Alert[]=[];
      if(prefs.emailAlerts===true){
        emailAlerts.push(...alerts.filter(a=>a.level==="danger"||a.level==="warning"));
      }
      if(prefs.weeklyEmail===true && localWeekday()==="Mon"){
        const from=dateMinus(7),to=localDate();
        const weekTx=(data.transactions||[]).filter(t=>t.date>=from&&t.date<=to&&(t.wallet||"cash")==="cash");
        const income=weekTx.filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.value||0),0);
        const expense=weekTx.filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.value||0),0);
        emailAlerts.push({title:"Resumo dos últimos 7 dias",body:`Entradas ${brl(income)} • Saídas ${brl(expense)} • Resultado ${brl(income-expense)}`,tag:`weekly-${to}`,url:"./",level:"info"});
      }
      if(emailAlerts.length && await sendEmail(profile.email,emailAlerts)) emailSent++;
    }
  }
  return Response.json({ok:true,pushSent,emailSent});
});
