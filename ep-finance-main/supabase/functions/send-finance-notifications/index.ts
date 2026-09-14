import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type FinanceData = {
  bills?: Array<{id:string,description:string,value:number,due:string,status:string}>;
  transactions?: Array<{id:string,type:string,description:string,value:number,date:string,category?:string}>;
  settings?: {budget?:number};
};

const localDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

function dayDiff(dateStr:string){
  const today = new Date(localDate()+"T12:00:00-03:00");
  const target = new Date(dateStr+"T12:00:00-03:00");
  return Math.round((target.getTime()-today.getTime())/86400000);
}

Deno.serve(async () => {
  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("user_id,endpoint,p256dh,auth");

  if (subError) return new Response(subError.message, { status: 500 });

  const userIds = [...new Set((subscriptions||[]).map(s=>s.user_id))];
  let sent = 0;

  for (const userId of userIds) {
    const [{ data: financeRow }, { data: prefRow }] = await Promise.all([
      supabase.from("finance_data").select("data").eq("user_id", userId).maybeSingle(),
      supabase.from("notification_preferences").select("preferences").eq("user_id", userId).maybeSingle()
    ]);

    const data = (financeRow?.data || {}) as FinanceData;
    const prefs = prefRow?.preferences || {};
    const alerts: Array<{title:string,body:string,tag:string,url:string}> = [];

    for (const bill of data.bills || []) {
      if (bill.status !== "pending") continue;
      const diff = dayDiff(bill.due);
      if (diff === 3 && prefs.bills3Days !== false)
        alerts.push({title:"Conta chegando",body:`${bill.description} vence em 3 dias • R$ ${Number(bill.value).toFixed(2)}`,tag:`bill-3-${bill.id}-${bill.due}`,url:"./"});
      if (diff === 1 && prefs.bills1Day !== false)
        alerts.push({title:"Conta vence amanhã",body:`${bill.description} • R$ ${Number(bill.value).toFixed(2)}`,tag:`bill-1-${bill.id}-${bill.due}`,url:"./"});
      if (diff < 0 && prefs.billsOverdue !== false)
        alerts.push({title:"Conta vencida",body:`${bill.description} está pendente há ${Math.abs(diff)} dia(s).`,tag:`bill-overdue-${bill.id}-${localDate()}`,url:"./"});
    }

    const month = localDate().slice(0,7);
    const realizedExpenses = (data.transactions || [])
      .filter(t=>t.type==="expense" && t.date<=localDate() && t.date.startsWith(month))
      .reduce((sum,t)=>sum+Number(t.value||0),0);
    const budget = Number(data.settings?.budget||0);
    const usage = budget ? realizedExpenses/budget : 0;

    if (budget && usage >= 1 && prefs.budget100 !== false)
      alerts.push({title:"Orçamento atingido",body:`Você atingiu ${Math.round(usage*100)}% do orçamento do mês.`,tag:`budget-100-${month}`,url:"./"});
    else if (budget && usage >= .8 && prefs.budget80 !== false)
      alerts.push({title:"Orçamento em alerta",body:`Você já utilizou ${Math.round(usage*100)}% do orçamento do mês.`,tag:`budget-80-${month}`,url:"./"});

    const userSubs = (subscriptions||[]).filter(s=>s.user_id===userId);
    for (const alert of alerts) {
      for (const s of userSubs) {
        try {
          await webpush.sendNotification({
            endpoint:s.endpoint,
            keys:{p256dh:s.p256dh,auth:s.auth}
          }, JSON.stringify(alert));
          sent++;
        } catch (e:any) {
          console.error("push failed", e?.statusCode, e?.message);
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
    }
  }

  return Response.json({ok:true,sent});
});
