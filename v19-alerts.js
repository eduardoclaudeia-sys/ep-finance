/* EP Finance V1.9 — Central de Alertas, calendário e onboarding PWA */
(function(){
  'use strict';

  const $id=id=>document.getElementById(id);
  const localDate=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const moneyBR=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const dayDiff=dateStr=>{
    const [y,m,d]=String(dateStr||'').split('-').map(Number);
    if(!y||!m||!d)return 99999;
    const a=new Date(); a.setHours(12,0,0,0);
    const b=new Date(y,m-1,d,12,0,0,0);
    return Math.round((b-a)/86400000);
  };
  const currentMonth=()=>localDate().slice(0,7);
  const safeText=s=>String(s??'');

  function prefs(){
    const n=data?.settings?.notifications||{};
    const c=data?.settings?.alertChannels||{};
    return {
      bills3Days:n.bills3Days!==false,
      bills1Day:n.bills1Day!==false,
      billsOverdue:n.billsOverdue!==false,
      budget80:n.budget80!==false,
      budget100:n.budget100!==false,
      weeklySummary:Boolean(n.weeklySummary),
      investmentReminder:Boolean(n.investmentReminder),
      inApp:c.inApp!==false,
      email:Boolean(c.email),
      weeklyEmail:Boolean(c.weeklyEmail)
    };
  }

  function alertId(type,ref,suffix=''){return `${type}:${ref||''}:${suffix}`;}

  function buildAlerts(){
    if(!data)return[];
    const p=prefs();
    const alerts=[];
    const now=localDate();

    for(const bill of data.bills||[]){
      if(bill.status==='paid')continue;
      const diff=dayDiff(bill.due);
      if(diff<0 && p.billsOverdue){
        alerts.push({id:alertId('bill-overdue',bill.id,bill.due),level:'danger',icon:'⚠️',title:'Conta vencida',body:`${safeText(bill.description)} venceu há ${Math.abs(diff)} dia(s) • ${moneyBR(bill.value)}`,date:bill.due,screen:'billsScreen'});
      }else if(diff===1 && p.bills1Day){
        alerts.push({id:alertId('bill-1',bill.id,bill.due),level:'warning',icon:'⏰',title:'Conta vence amanhã',body:`${safeText(bill.description)} • ${moneyBR(bill.value)}`,date:bill.due,screen:'billsScreen'});
      }else if(diff>=0 && diff<=3 && p.bills3Days){
        alerts.push({id:alertId('bill-3',bill.id,bill.due),level:'info',icon:'📅',title:`Conta vence em ${diff} dia${diff===1?'':'s'}`,body:`${safeText(bill.description)} • ${moneyBR(bill.value)}`,date:bill.due,screen:'billsScreen'});
      }
    }

    const mk=currentMonth();
    const expenses=(data.transactions||[]).filter(t=>t.type==='expense' && (t.wallet||'cash')==='cash' && String(t.date||'')<=now && String(t.date||'').startsWith(mk)).reduce((a,t)=>a+Number(t.value||t.amount||0),0);
    const budget=Number(data.settings?.budget||0);
    const use=budget?expenses/budget:0;
    if(budget && use>=1 && p.budget100){
      alerts.push({id:alertId('budget-100',mk),level:'danger',icon:'🚨',title:'Orçamento ultrapassado',body:`Você utilizou ${Math.round(use*100)}% do orçamento de ${moneyBR(budget)}.`,screen:'homeScreen'});
    }else if(budget && use>=.8 && p.budget80){
      alerts.push({id:alertId('budget-80',mk),level:'warning',icon:'📊',title:'Orçamento em alerta',body:`Você já utilizou ${Math.round(use*100)}% do orçamento do mês.`,screen:'homeScreen'});
    }

    const upcoming=(data.transactions||[]).filter(t=>String(t.date||'')>now && String(t.date||'')<=datePlusDays(7));
    if(upcoming.length){
      const totalExp=upcoming.filter(t=>t.type==='expense' && (t.wallet||'cash')==='cash').reduce((a,t)=>a+Number(t.value||0),0);
      alerts.push({id:alertId('upcoming-week',now),level:'info',icon:'🗓️',title:'Próximos 7 dias',body:`${upcoming.length} lançamento(s) agendado(s)${totalExp?` • ${moneyBR(totalExp)} em saídas`:''}.`,screen:'transactionsScreen'});
    }

    if(p.investmentReminder && (data.investments||[]).length && new Date().getDate()>=20){
      const investedThisMonth=(data.transactions||[]).some(t=>t.type==='expense' && t.category==='Investimentos' && String(t.date||'').startsWith(mk));
      if(!investedThisMonth) alerts.push({id:alertId('investment-reminder',mk),level:'info',icon:'📈',title:'Lembrete de aporte',body:'Ainda não encontrei um aporte registrado neste mês.',screen:'investmentsScreen'});
    }

    return alerts.sort((a,b)=>({danger:0,warning:1,info:2}[a.level]-{danger:0,warning:1,info:2}[b.level]));
  }

  function datePlusDays(n){
    const d=new Date(); d.setDate(d.getDate()+n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function readMap(){return data?.settings?.alertCenterRead||{};}
  function isRead(a){return Boolean(readMap()[a.id]);}

  function renderAlertCenter(){
    const alerts=prefs().inApp?buildAlerts():[];
    const list=$id('alertCenterList');
    const count=$id('alertCount');
    const unread=alerts.filter(a=>!isRead(a)).length;
    if(count){count.textContent=String(unread);count.hidden=unread===0;}
    if(!list)return;
    list.innerHTML=alerts.length?alerts.map(a=>`<button class="alert-item ${a.level} ${isRead(a)?'read':''}" type="button" data-alert-id="${a.id}" data-screen="${a.screen||'homeScreen'}"><span class="alert-icon">${a.icon}</span><span class="alert-copy"><strong>${escapeHTML(a.title)}</strong><span>${escapeHTML(a.body)}</span></span><span class="alert-dot"></span></button>`).join(''):'<div class="empty">Tudo tranquilo por aqui. Nenhum aviso importante agora.</div>';
    list.querySelectorAll('.alert-item').forEach(btn=>btn.onclick=()=>{
      markRead(btn.dataset.alertId);
      navigateTo(btn.dataset.screen);
      closeCenter();
    });
  }

  function escapeHTML(v){return safeText(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function markRead(id){
    data.settings=data.settings||{}; data.settings.alertCenterRead=data.settings.alertCenterRead||{};
    data.settings.alertCenterRead[id]=new Date().toISOString();
    pruneRead(); save(); renderAlertCenter();
  }
  function markAllRead(){
    data.settings=data.settings||{}; data.settings.alertCenterRead=data.settings.alertCenterRead||{};
    for(const a of buildAlerts())data.settings.alertCenterRead[a.id]=new Date().toISOString();
    pruneRead(); save(); renderAlertCenter();
  }
  function pruneRead(){
    const map=data.settings?.alertCenterRead||{}; const entries=Object.entries(map).sort((a,b)=>String(b[1]).localeCompare(String(a[1]))).slice(0,100);
    data.settings.alertCenterRead=Object.fromEntries(entries);
  }
  function navigateTo(screen){
    const nav=document.querySelector(`[data-screen="${screen}"]`); if(nav){nav.click();return;}
    const go=document.querySelector(`[data-go="${screen}"]`); if(go)go.click();
  }
  function openCenter(){const o=$id('alertCenterOverlay');if(o)o.hidden=false;renderAlertCenter();}
  function closeCenter(){const o=$id('alertCenterOverlay');if(o)o.hidden=true;}

  function initInputs(){
    const p=prefs();
    if($id('inAppAlertsEnabled'))$id('inAppAlertsEnabled').checked=p.inApp;
    if($id('emailAlertsEnabled'))$id('emailAlertsEnabled').checked=p.email;
    if($id('weeklyEmailEnabled'))$id('weeklyEmailEnabled').checked=p.weeklyEmail;
  }

  async function saveChannels(){
    data.settings=data.settings||{};
    data.settings.alertChannels={inApp:Boolean($id('inAppAlertsEnabled')?.checked),email:Boolean($id('emailAlertsEnabled')?.checked),weeklyEmail:Boolean($id('weeklyEmailEnabled')?.checked)};
    save(); renderAlertCenter();
    try{
      const sb=window.epSupabase;
      if(sb){
        const {data:{user}}=await sb.auth.getUser();
        if(user){
          const np={...(data.settings.notifications||{}),emailAlerts:data.settings.alertChannels.email,weeklyEmail:data.settings.alertChannels.weeklyEmail};
          const {error}=await sb.from('notification_preferences').upsert({user_id:user.id,preferences:np,updated_at:new Date().toISOString()},{onConflict:'user_id'});
          if(error)console.error('EP Finance: erro ao salvar canais de alerta.',error);
        }
      }
      alert('Canais de alerta salvos.');
    }catch(e){console.error(e);alert('Preferências salvas no aparelho. A sincronização em nuvem será tentada novamente.');}
  }

  function icsEscape(v){return safeText(v).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');}
  function icsDate(date){return String(date||'').replace(/-/g,'');}
  function exportCalendar(){
    const bills=(data.bills||[]).filter(b=>b.status!=='paid' && String(b.due||'')>=localDate()).sort((a,b)=>String(a.due).localeCompare(String(b.due)));
    if(!bills.length){alert('Não há contas futuras pendentes para exportar.');return;}
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const events=bills.map(b=>[
      'BEGIN:VEVENT',
      `UID:epfinance-bill-${icsEscape(b.id||Math.random())}@epfinance`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(b.due)}`,
      `DTEND;VALUE=DATE:${icsDate(dateAfter(b.due,1))}`,
      `SUMMARY:${icsEscape('EP Finance: '+(b.description||'Conta a pagar'))}`,
      `DESCRIPTION:${icsEscape(`Conta pendente • ${moneyBR(b.value)}${b.category?` • ${b.category}`:''}`)}`,
      'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',`DESCRIPTION:${icsEscape('Amanhã vence: '+(b.description||'conta'))}`,'END:VALARM',
      'END:VEVENT'
    ].join('\r\n')).join('\r\n');
    const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EP Finance//V1.9//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH',events,'END:VCALENDAR'].join('\r\n');
    const blob=new Blob([content],{type:'text/calendar;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`ep-finance-contas-${currentMonth()}.ics`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }
  function dateAfter(iso,n){const [y,m,d]=String(iso).split('-').map(Number);const dt=new Date(y,m-1,d+n);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}

  function standalone(){return window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone===true;}
  function installHow(){
    if(standalone()){
      alert('O EP Finance já está aberto como aplicativo instalado neste aparelho.');
      return;
    }
    alert('No iPhone: abra o EP Finance pelo Safari, toque no botão Compartilhar e escolha “Adicionar à Tela de Início”. Depois abra o EP Finance pelo novo ícone e ative as notificações em Ajustes.');
  }
  function refreshInstallStatus(){
    const badge=$id('pwaInstallStatus');
    if(!badge)return;
    if(standalone()){badge.textContent='Instalado';badge.classList.add('on');}
    else{badge.textContent='Opcional';badge.classList.remove('on');}
  }

  function bind(){
    $id('alertCenterBtn')?.addEventListener('click',openCenter);
    $id('closeAlertCenter')?.addEventListener('click',closeCenter);
    $id('alertCenterOverlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeCenter();});
    $id('markAlertsRead')?.addEventListener('click',markAllRead);
    $id('saveAlertChannels')?.addEventListener('click',saveChannels);
    $id('exportCalendar')?.addEventListener('click',exportCalendar);
    $id('pwaInstallSettings')?.addEventListener('click',installHow);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderAlertCenter();refreshInstallStatus();}});
    window.addEventListener('epfinance-authenticated',()=>{setTimeout(()=>{initInputs();renderAlertCenter();refreshInstallStatus();},500);});
  }

  initInputs(); bind(); renderAlertCenter(); refreshInstallStatus();
  window.EPV19Alerts={buildAlerts,render:renderAlertCenter,exportCalendar};
})();
