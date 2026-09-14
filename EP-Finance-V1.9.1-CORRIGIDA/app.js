const KEY="epFinanceV12";
const LEGACY_KEYS=["epFinanceV1"];
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const categories=["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Salário","Benefícios","Investimentos","Outros"];
const defaultData={transactions:[],bills:[],goals:[],investments:[],settings:{budget:0,theme:"light",hideBalance:false,userName:""}};
let data=load();
let txFilter="all";
let dashboardMonthKey=monthKey();

function load(){
  try{
    let raw=localStorage.getItem(KEY);
    if(!raw){for(const k of LEGACY_KEYS){raw=localStorage.getItem(k);if(raw)break;}}
    const parsed=raw?JSON.parse(raw):{};
    return normalize({...defaultData,...parsed,settings:{...defaultData.settings,...(parsed.settings||{})}});
  }catch{return structuredClone(defaultData);}
}
function normalize(d){d.transactions=d.transactions||[];d.bills=d.bills||[];d.goals=d.goals||[];d.investments=d.investments||[];d.settings={...defaultData.settings,...(d.settings||{})};return window.EPV17Data?window.EPV17Data.migrate(d):d;}
function save(){localStorage.setItem(KEY,JSON.stringify(data));renderAll();}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function today(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function monthKey(d){return (d||today()).slice(0,7);}
function fmtDate(d){if(!d)return"";return new Date(d+"T12:00:00").toLocaleDateString("pt-BR");}
function fmtMonth(mk){if(!mk)return"";const [y,m]=mk.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase());}
function shiftMonth(mk,delta){const [y,m]=mk.split("-").map(Number),d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function iconFor(cat){const m={Moradia:"🏠",Alimentação:"🍽️",Transporte:"🚗",Saúde:"❤️",Educação:"🎓",Lazer:"🎮",Salário:"💼",Benefícios:"🎫",Investimentos:"📈",Outros:"•"};return m[cat]||"•";}
function walletKey(t){return t?.wallet||"cash";}
function walletLabel(w){return w==="va"?"Vale Alimentação":w==="vr"?"Vale Refeição":"Conta / dinheiro";}
function walletBalance(w="cash"){return realizedTransactions().filter(t=>walletKey(t)===w).reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0);}
function walletBadge(w){return w==="cash"?"":`<span class="wallet-badge ${w}">${w==="va"?"VA":"VR"}</span>`;}

function renderAll(){
  document.body.classList.toggle("dark",data.settings.theme==="dark");
  $("#budgetInput").value=data.settings.budget||"";
  $("#userNameInput").value=data.settings.userName||"";
  renderHome();renderTransactions();renderBills();renderGoals();renderInvestments();if(typeof updateBiometricUI==="function")updateBiometricUI();
}

function isFutureTx(t){return Boolean(t?.date)&&t.date>today();}
function isRealizedTx(t){return !isFutureTx(t);}
function realizedTransactions(){return data.transactions.filter(isRealizedTx);}
function futureTransactions(){return data.transactions.filter(isFutureTx);}
function monthTransactions(mk=dashboardMonthKey){return realizedTransactions().filter(t=>monthKey(t.date)===mk);}
function currentMonthTx(){return monthTransactions(dashboardMonthKey);}
function allCurrentMonthTx(){return data.transactions.filter(t=>monthKey(t.date)===dashboardMonthKey);}
function monthIncome(mk=dashboardMonthKey){return monthTransactions(mk).filter(t=>t.type==="income").reduce((a,b)=>a+Number(b.value),0);}
function monthExpense(mk=dashboardMonthKey){return monthTransactions(mk).filter(t=>t.type==="expense").reduce((a,b)=>a+Number(b.value),0);}
function futureTransactionsForMonth(mk=dashboardMonthKey){return futureTransactions().filter(t=>monthKey(t.date)===mk);}
function futureIncome(mk=dashboardMonthKey){return futureTransactionsForMonth(mk).filter(t=>t.type==="income").reduce((a,b)=>a+Number(b.value),0);}
function futureTxExpense(mk=dashboardMonthKey){return futureTransactionsForMonth(mk).filter(t=>t.type==="expense").reduce((a,b)=>a+Number(b.value),0);}
function pendingBillsForMonth(mk=dashboardMonthKey){return data.bills.filter(b=>b.status!=="paid"&&monthKey(b.due)===mk&&b.due>=today());}
function pendingBillsExpense(mk=dashboardMonthKey){return pendingBillsForMonth(mk).reduce((a,b)=>a+Number(b.value),0);}
function futureExpense(mk=dashboardMonthKey){return futureTxExpense(mk)+pendingBillsExpense(mk);}
function balance(){return walletBalance("cash");}
function available(){return balance();}
function monthEnd(mk){const [y,m]=mk.split("-").map(Number);return `${y}-${String(m).padStart(2,"0")}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;}
function futureTxUntil(mk){const end=monthEnd(mk);return futureTransactions().filter(t=>t.date<=end&&walletKey(t)==="cash");}
function pendingBillsUntil(mk){const end=monthEnd(mk);return data.bills.filter(b=>b.status!=="paid"&&b.due>=today()&&b.due<=end);}
function projectedBalance(mk=dashboardMonthKey){
  const tx=futureTxUntil(mk).reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0);
  const bills=pendingBillsUntil(mk).reduce((a,b)=>a+Number(b.value),0);
  return balance()+tx-bills;
}
function investedTotal(){return data.investments.reduce((a,i)=>a+Number(i.invested||0),0);}
function currentInvestmentTotal(){return data.investments.reduce((a,i)=>a+Number(i.current||0),0);}
function investmentResult(){return currentInvestmentTotal()-investedTotal();}
function netWorth(){return balance()+currentInvestmentTotal();}

function shownMoney(v){return data.settings.hideBalance?"••••••":money(v);}

function renderHome(){
  const mk=dashboardMonthKey,inc=monthIncome(mk),exp=monthExpense(mk),net=inc-exp;
  if($("#dashboardMonth"))$("#dashboardMonth").value=mk;
  if($("#dashboardMonthLabel"))$("#dashboardMonthLabel").textContent=fmtMonth(mk);
  if($("#monthSummaryTitle"))$("#monthSummaryTitle").textContent=`Resumo realizado • ${fmtMonth(mk)}`;
  if($("#budgetTitle"))$("#budgetTitle").textContent=`Orçamento • ${fmtMonth(mk)}`;
  if($("#categoryTitle"))$("#categoryTitle").textContent=`Gastos por categoria • ${fmtMonth(mk)}`;
  $("#availableBalance").textContent=shownMoney(available());
  if($("#vaBalance"))$("#vaBalance").textContent=shownMoney(walletBalance("va"));
  if($("#vrBalance"))$("#vrBalance").textContent=shownMoney(walletBalance("vr"));
  $("#monthIncome").textContent=shownMoney(inc);
  $("#monthExpense").textContent=shownMoney(exp);
  $("#futureIncome").textContent=shownMoney(futureIncome(mk));
  $("#futureExpense").textContent=shownMoney(futureExpense(mk));
  $("#projectedBalance").textContent=shownMoney(projectedBalance(mk));
  $("#projectedBalance").className=projectedBalance(mk)>=0?"income":"expense";
  $("#futureIncomeHint").textContent=`Previstas em ${fmtMonth(mk)}`;
  $("#futureExpenseHint").textContent=`${money(futureTxExpense(mk))} agendado + ${money(pendingBillsExpense(mk))} em Contas`;
  $("#projectedBalanceHint").textContent=`Saldo estimado até ${fmtDate(monthEnd(mk))}`;
  $("#homeInvestments").textContent=shownMoney(currentInvestmentTotal());
  $("#netWorth").textContent=shownMoney(netWorth());
  $("#summaryIncome").textContent=shownMoney(inc);
  $("#summaryExpense").textContent=shownMoney(exp);
  $("#summaryNet").textContent=shownMoney(net);
  $("#summaryNet").className=net>=0?"income":"expense";
  $("#monthResult").textContent=(net>=0?"+ ":"- ")+shownMoney(Math.abs(net));
  $("#monthResult").className=net>=0?"income":"expense";

  const budget=Number(data.settings.budget||0),pct=budget?Math.min(100,Math.round(exp/budget*100)):0;
  $("#budgetPercent").textContent=budget?pct+"%":"0%";
  $("#budgetBar").style.width=pct+"%";
  $("#budgetText").textContent=budget?`${money(exp)} de ${money(budget)} utilizados. ${exp>budget?"Orçamento ultrapassado.":money(Math.max(0,budget-exp))+" restantes."}`:"Defina um orçamento mensal nas configurações.";

  const byCat={};currentMonthTx().filter(t=>t.type==="expense").forEach(t=>byCat[t.category]=(byCat[t.category]||0)+Number(t.value));
  const catRows=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5),max=catRows[0]?.[1]||1;
  $("#categoryBreakdown").innerHTML=catRows.length?catRows.map(([cat,val])=>`<div class="category-row"><div class="category-name">${iconFor(cat)} ${esc(cat)}</div><div class="category-track"><div class="category-fill" style="width:${Math.max(4,val/max*100)}%"></div></div><div class="category-value">${money(val)}</div></div>`).join(""):`<div class="empty">Ainda não há despesas neste mês.</div>`;

  const scheduledTx=[...futureTransactionsForMonth(mk)].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const scheduledBills=[...pendingBillsForMonth(mk)].sort((a,b)=>(a.due||"").localeCompare(b.due||""));
  const agenda=[
    ...scheduledTx.map(t=>({kind:"tx",date:t.date,item:t})),
    ...scheduledBills.map(b=>({kind:"bill",date:b.due,item:b}))
  ].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
  $("#scheduledTransactions").innerHTML=agenda.length?agenda.map(x=>x.kind==="tx"
    ?itemHtml(iconFor(x.item.category),x.item.description,`Extrato agendado • ${x.item.category} • ${fmtDate(x.item.date)}`,`${x.item.type==="income"?"+":"-"} ${money(x.item.value)}`,x.item.type,`<div class="tx-actions"><button class="text-btn edit-tx" type="button" data-id="${x.item.id}">Editar</button></div>`)
    :itemHtml("▣",x.item.description,`Conta pendente • ${x.item.category||"Outros"} • ${fmtDate(x.item.due)}`,`- ${money(x.item.value)}`,"expense",`<div class="tx-actions"><button class="text-btn edit-bill" type="button" data-id="${x.item.id}">Editar</button></div>`)
  ).join(""):`<div class="empty">Nenhum compromisso futuro em ${fmtMonth(mk)}.</div>`;

  const bills=[...data.bills].filter(b=>b.status==="pending").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3);
  $("#upcomingBills").innerHTML=bills.length?bills.map(b=>itemHtml("▣",b.description,`Vence em ${fmtDate(b.due)} • não descontado`,money(b.value),"expense")).join(""):`<div class="empty">Nenhuma conta pendente.</div>`;

  const tx=[...realizedTransactions()].sort(sortNewest).slice(0,4);
  $("#recentTransactions").innerHTML=tx.length?tx.map(t=>itemHtml(iconFor(t.category),t.description,`Realizado • ${t.category} • ${fmtDate(t.date)}`,`${t.type==="income"?"+":"-"} ${money(t.value)}`,t.type,`<div class="tx-actions"><button class="text-btn edit-tx" type="button" data-id="${t.id}">Editar</button></div>`)).join(""):`<div class="empty">Adicione sua primeira movimentação realizada.</div>`;
  bindTxActions();
  $$("#homeScreen .edit-bill").forEach(btn=>btn.onclick=()=>openBill(data.bills.find(x=>x.id===btn.dataset.id)));
}

function itemHtml(icon,title,sub,amount,type,actions=""){
  return `<div class="item"><div class="item-main"><div class="item-icon">${icon}</div><div><div class="item-title">${esc(title)}</div><div class="item-sub">${esc(sub)}</div></div></div><div><div class="amount ${type}">${amount}</div>${actions}</div></div>`;
}
function sortNewest(a,b){return ((b.date||"")+String(b.id||"")).localeCompare((a.date||"")+String(a.id||""));}

function hydrateCategoryFilter(){
  const select=$("#statementCategory"),current=select.value||"all";
  select.innerHTML=`<option value="all">Todas</option>`+categories.map(c=>`<option>${c}</option>`).join("");
  select.value=categories.includes(current)?current:"all";
}
function getFilteredTransactions(){
  const q=$("#statementSearch")?.value.trim().toLowerCase()||"";
  const mk=$("#statementMonth")?.value||"";
  const cat=$("#statementCategory")?.value||"all";
  const status=$("#statementStatus")?.value||"all";
  const wallet=$("#statementWallet")?.value||"all";
  const sort=$("#statementSort")?.value||"newest";
  let tx=[...data.transactions];
  if(txFilter!=="all")tx=tx.filter(t=>t.type===txFilter);
  if(mk)tx=tx.filter(t=>monthKey(t.date)===mk);
  if(cat!=="all")tx=tx.filter(t=>t.category===cat);
  if(status==="realized")tx=tx.filter(isRealizedTx);
  if(status==="future")tx=tx.filter(isFutureTx);
  if(wallet!=="all")tx=tx.filter(t=>walletKey(t)===wallet);
  if(q)tx=tx.filter(t=>`${t.description} ${t.category} ${t.payment||""} ${t.note||""}`.toLowerCase().includes(q));
  if(sort==="newest")tx.sort(sortNewest);
  if(sort==="oldest")tx.sort((a,b)=>sortNewest(b,a));
  if(sort==="highest")tx.sort((a,b)=>Number(b.value)-Number(a.value));
  if(sort==="lowest")tx.sort((a,b)=>Number(a.value)-Number(b.value));
  return tx;
}
function txRow(t){
  const scheduled=isFutureTx(t), series=t.seriesType==="installment"?` • Parcela ${t.installmentNumber}/${t.installmentCount}`:t.seriesType==="recurring"?` • Recorrente ${t.recurringIndex||""}/${t.recurringCount||""}`:"";
  const actions=`<div class="tx-actions"><button class="text-btn edit-tx" type="button" data-id="${t.id}">Editar</button>${t.seriesId?`<button class="text-btn delete-series" type="button" data-series="${t.seriesId}">Excluir série</button>`:""}<button class="text-btn delete-tx" type="button" data-id="${t.id}">Excluir</button></div>`;
  return itemHtml(iconFor(t.category),`${esc(t.description)} ${walletBadge(walletKey(t))}`,`${esc(t.category)} • ${esc(walletLabel(walletKey(t)))} • ${esc(t.payment||"")}${series}${scheduled?" • Agendado":""}`,`${t.type==="income"?"+ ":"- "}${money(t.value)}`,t.type,actions);
}
function renderTransactions(){
  hydrateCategoryFilter();
  const tx=getFilteredTransactions();
  const inc=tx.filter(t=>t.type==="income").reduce((a,b)=>a+Number(b.value),0),exp=tx.filter(t=>t.type==="expense").reduce((a,b)=>a+Number(b.value),0),net=inc-exp;
  $("#statementIncome").textContent=money(inc);$("#statementIncome").className="income";
  $("#statementExpense").textContent=money(exp);$("#statementExpense").className="expense";
  $("#statementNet").textContent=money(net);$("#statementNet").className=net>=0?"income":"expense";
  const grouped=$("#statementView")?.value!=="flat";
  if(!tx.length){$("#transactionList").innerHTML=`<div class="empty">Nenhuma movimentação encontrada com esses filtros.</div>`;bindTxActions();return;}
  if(grouped){
    const groups={};tx.forEach(t=>(groups[t.date]??=[]).push(t));
    $("#transactionList").innerHTML=Object.entries(groups).map(([date,items])=>{const dayNet=items.reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0),scheduled=date>today();return `<section class="statement-day ${scheduled?"scheduled-day":""}"><div class="statement-day-head"><span>${fmtDate(date)}${scheduled?" • AGENDADO":""}</span><span class="${dayNet>=0?"income":"expense"}">${dayNet>=0?"+ ":"- "}${money(Math.abs(dayNet))}</span></div>${items.map(txRow).join("")}</section>`}).join("");
  } else $("#transactionList").innerHTML=tx.map(txRow).join("");
  bindTxActions();
}
function bindTxActions(){
  $$(".delete-tx").forEach(b=>b.onclick=()=>{if(confirm("Excluir esta movimentação?")){data.transactions=data.transactions.filter(t=>t.id!==b.dataset.id);save();}});
  $$(".delete-series").forEach(b=>b.onclick=()=>{if(confirm("Excluir os lançamentos de hoje em diante desta série?")){data=EPV17Data.deleteSeries(data,b.dataset.series,"future");save();}});
  $$(".edit-tx").forEach(b=>b.onclick=()=>openTransaction(data.transactions.find(t=>t.id===b.dataset.id)));
}

function renderBills(){
  const bills=[...data.bills].sort((a,b)=>(a.due||"").localeCompare(b.due||""));
  $("#billList").innerHTML=bills.length?bills.map(b=>{
    const paid=b.status==="paid";
    const actions=`<div class="tx-actions"><button class="text-btn edit-bill" type="button" data-id="${b.id}">Editar</button><button class="text-btn ${paid?"reopen-bill":"pay-bill"}" type="button" data-id="${b.id}">${paid?"Reabrir":"Pagar hoje"}</button><button class="text-btn delete-bill" type="button" data-id="${b.id}">Excluir</button></div>`;
    return itemHtml("▣",b.description,`${paid?"Pago":"Pendente"} • ${b.category||"Outros"} • vence ${fmtDate(b.due)}`,money(b.value),paid?"income":"expense",actions)
  }).join(""):`<div class="empty">Nenhuma conta cadastrada.</div>`;

  $$(".edit-bill").forEach(btn=>btn.onclick=()=>openBill(data.bills.find(x=>x.id===btn.dataset.id)));

  $$(".pay-bill").forEach(btn=>btn.onclick=()=>{
    const b=data.bills.find(x=>x.id===btn.dataset.id);if(!b)return;
    const linked=data.transactions.find(t=>t.sourceBillId===b.id);
    if(linked){b.status="paid";save();return;}
    data.transactions.push({
      id:id(),type:"expense",description:b.description,value:Number(b.value),
      category:b.category||"Outros",date:today(),wallet:"cash",payment:"Pix",
      note:`Pagamento da conta com vencimento em ${fmtDate(b.due)}`,sourceBillId:b.id
    });
    b.status="paid";save();
  });

  $$(".reopen-bill").forEach(btn=>btn.onclick=()=>{
    const b=data.bills.find(x=>x.id===btn.dataset.id);if(!b)return;
    if(confirm("Reabrir a conta e remover a movimentação criada por este pagamento?")){
      data.transactions=data.transactions.filter(t=>t.sourceBillId!==b.id);
      b.status="pending";save();
    }
  });

  $$(".delete-bill").forEach(btn=>btn.onclick=()=>{
    if(confirm("Excluir esta conta? A movimentação de pagamento, se existir, será mantida.")){
      data.bills=data.bills.filter(x=>x.id!==btn.dataset.id);save();
    }
  });
}
function renderGoals(){
  $("#goalList").innerHTML=data.goals.length?data.goals.map(g=>{const pct=Math.min(100,Math.round(Number(g.saved||0)/Number(g.target||1)*100));return `<div class="goal-card"><div class="goal-head"><div><div class="item-title">${esc(g.name)}</div><div class="item-sub">${pct}% concluído</div></div><div class="goal-value">${money(g.saved)} / ${money(g.target)}</div></div><div class="progress goal-progress"><div style="width:${pct}%"></div></div><div class="tx-actions"><button class="secondary compact add-goal" type="button" data-id="${g.id}">Adicionar valor</button><button class="text-btn delete-goal" type="button" data-id="${g.id}">Excluir</button></div></div>`}).join(""):`<div class="empty">Crie uma meta para acompanhar seus objetivos.</div>`;
  $$(".add-goal").forEach(btn=>btn.onclick=()=>{const g=data.goals.find(x=>x.id===btn.dataset.id),v=Number(prompt("Quanto deseja adicionar à meta?")||0);if(v>0){g.saved=Number(g.saved||0)+v;save();}});
  $$(".delete-goal").forEach(btn=>btn.onclick=()=>{if(confirm("Excluir esta meta?")){data.goals=data.goals.filter(x=>x.id!==btn.dataset.id);save();}});
}
function renderInvestments(){
  $("#investedTotal").textContent=shownMoney(investedTotal());$("#currentInvestmentTotal").textContent=shownMoney(currentInvestmentTotal());$("#investmentResult").textContent=shownMoney(investmentResult());
  const pct=investedTotal()?investmentResult()/investedTotal()*100:0;$("#investmentReturnPercent").textContent=`${pct>=0?"+":""}${pct.toFixed(2).replace(".",",")}%`;
  const list=[...data.investments].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("#investmentList").innerHTML=list.length?list.map(i=>{const gain=Number(i.current)-Number(i.invested),ipct=Number(i.invested)?gain/Number(i.invested)*100:0;const ticker=i.ticker?`<span class="badge">${esc(i.ticker)}</span>`:"";const quote=i.quoteUpdatedAt?`<span class="badge">Cotação ${fmtDate(String(i.quoteUpdatedAt).slice(0,10))}</span>`:"";return `<div class="item"><div class="item-main"><div class="item-icon">◈</div><div><div class="item-title">${esc(i.name)}</div><div class="investment-meta"><span class="badge">${esc(i.type)}</span>${ticker}${quote}<span class="badge">${fmtDate(i.date)}</span></div><div class="item-sub">Aportado: ${money(i.invested)} • Atual: ${money(i.current)}${Number(i.quantity)>0?` • Qtd.: ${Number(i.quantity).toLocaleString("pt-BR")}`:""}</div></div></div><div><div class="amount ${gain>=0?"income":"expense"}">${gain>=0?"+ ":"- "}${money(Math.abs(gain))}</div><div class="item-sub" style="text-align:right">${ipct>=0?"+":""}${ipct.toFixed(2).replace(".",",")}%</div><div class="investment-actions"><button class="text-btn edit-investment" type="button" data-id="${i.id}">Atualizar manual</button><button class="text-btn delete-investment" type="button" data-id="${i.id}">Excluir</button></div></div></div>`}).join(""):`<div class="empty">Adicione seu primeiro investimento.</div>`;
  $$(".edit-investment").forEach(btn=>btn.onclick=()=>{const inv=data.investments.find(x=>x.id===btn.dataset.id),val=Number(prompt("Qual é o valor atual deste investimento?",inv.current)||inv.current);if(Number.isFinite(val)&&val>=0){inv.current=val;inv.date=today();save();}});
  $$(".delete-investment").forEach(btn=>btn.onclick=()=>{if(confirm("Excluir este investimento?")){data.investments=data.investments.filter(x=>x.id!==btn.dataset.id);save();}});
}

function go(screen){
  $$(".screen").forEach(s=>s.classList.toggle("active",s.id===screen));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.screen===screen));
  $("#fab").style.display=["homeScreen","transactionsScreen"].includes(screen)?"block":"none";
  if(screen==="transactionsScreen")renderTransactions();
  scrollTo({top:0,behavior:"smooth"});
}
$$(".nav-item").forEach(n=>n.onclick=()=>go(n.dataset.screen));
$$("[data-go]").forEach(n=>n.onclick=()=>go(n.dataset.go));

function safeOpen(dialog){if(dialog&&!dialog.open){try{dialog.showModal();}catch{dialog.setAttribute("open","");}}}
function safeClose(dialog){if(!dialog)return;try{if(dialog.open)dialog.close();else dialog.removeAttribute("open");}catch{dialog.removeAttribute("open");}}
function setupModal(openSel,modalSel,dateSel){const opener=$(openSel),modal=$(modalSel);if(!opener||!modal)return;opener.onclick=()=>{if(dateSel)$(dateSel).value=today();safeOpen(modal);};}
$("#openBillModal").onclick=()=>openBill();setupModal("#openGoalModal","#goalModal");setupModal("#openInvestmentModal","#investmentModal","#investmentDate");
$("#openTransactionModal").onclick=()=>openTransaction();$("#fab").onclick=()=>openTransaction();
$$(".close-modal").forEach(btn=>btn.onclick=()=>safeClose($("#"+btn.dataset.close)));
$$('dialog').forEach(d=>{
  d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)safeClose(d);});
  d.addEventListener('cancel',e=>{e.preventDefault();safeClose(d);});
});

function openTransaction(t=null){
  $("#transactionForm").reset();$("#txEditId").value=t?.id||"";$("#transactionModalTitle").textContent=t?"Editar movimentação":"Nova movimentação";
  $("#txType").value=t?.type||"expense";$("#txDescription").value=t?.description||"";$("#txValue").value=t?.value||"";$("#txCategory").value=t?.category||"Alimentação";$("#txDate").value=t?.date||today();$("#txWallet").value=t?.wallet||"cash";$("#txPayment").value=t?.payment||"Pix";$("#txNote").value=t?.note||"";
  $("#txScheduleType").value="single";$("#txScheduleType").disabled=Boolean(t);updateScheduleFields();safeOpen($("#transactionModal"));
}

function openBill(b=null){
  $("#billForm").reset();
  $("#billEditId").value=b?.id||"";
  $("#billModalTitle").textContent=b?"Editar conta":"Nova conta";
  $("#billDescription").value=b?.description||"";
  $("#billValue").value=b?.value||"";
  $("#billDue").value=b?.due||today();
  $("#billCategory").value=b?.category||"Outros";
  $("#billStatus").value=b?.status||"pending";
  safeOpen($("#billModal"));
}

$("#transactionForm").addEventListener("submit",e=>{
  e.preventDefault();if(!e.currentTarget.reportValidity())return;
  const editId=$("#txEditId").value;
  const previous=editId?data.transactions.find(t=>t.id===editId):null;
  const obj={id:editId||id(),type:$("#txType").value,description:$("#txDescription").value.trim(),value:Number($("#txValue").value),category:$("#txCategory").value,date:$("#txDate").value,wallet:$("#txWallet").value,payment:$("#txPayment").value,note:$("#txNote").value.trim(),...(previous?.sourceBillId?{sourceBillId:previous.sourceBillId}:{})};
  if(editId){const ix=data.transactions.findIndex(t=>t.id===editId);if(ix>=0)data.transactions[ix]={...previous,...obj};}
  else {
    const mode=$("#txScheduleType").value;
    if(mode==="installment"){data=EPV17Data.createInstallments(data,obj,Number($("#txInstallmentCount").value)).data;}
    else if(mode==="recurring"){data=EPV17Data.createRecurring(data,obj,{frequency:$("#txRecurringFrequency").value,count:Number($("#txRecurringCount").value)}).data;}
    else data.transactions.push(obj);
  }
  $("#txScheduleType").disabled=false;safeClose($("#transactionModal"));save();
});
$("#billForm").addEventListener("submit",e=>{
  e.preventDefault();if(!e.currentTarget.reportValidity())return;
  const editId=$("#billEditId").value;
  const bill={
    id:editId||id(),
    description:$("#billDescription").value.trim(),
    value:Number($("#billValue").value),
    due:$("#billDue").value,
    category:$("#billCategory").value,
    status:$("#billStatus").value
  };

  if(editId){
    const ix=data.bills.findIndex(b=>b.id===editId);
    if(ix>=0)data.bills[ix]=bill;
  }else data.bills.push(bill);

  let linked=data.transactions.find(t=>t.sourceBillId===bill.id);

  if(bill.status==="paid"&&!linked){
    data.transactions.push({
      id:id(),type:"expense",description:bill.description,value:Number(bill.value),
      category:bill.category||"Outros",date:today(),wallet:"cash",payment:"Pix",
      note:`Pagamento da conta com vencimento em ${fmtDate(bill.due)}`,sourceBillId:bill.id
    });
    linked=data.transactions.find(t=>t.sourceBillId===bill.id);
  }

  if(bill.status==="pending"&&linked){
    data.transactions=data.transactions.filter(t=>t.sourceBillId!==bill.id);
    linked=null;
  }

  if(bill.status==="paid"&&linked){
    linked.description=bill.description;
    linked.value=Number(bill.value);
    linked.category=bill.category||"Outros";
    linked.note=`Pagamento da conta com vencimento em ${fmtDate(bill.due)}`;
  }

  e.currentTarget.reset();safeClose($("#billModal"));save();
});
$("#goalForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;data.goals.push({id:id(),name:$("#goalName").value.trim(),target:Number($("#goalTarget").value),saved:Number($("#goalSaved").value||0)});e.currentTarget.reset();safeClose($("#goalModal"));save();});
$("#investmentForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;data.investments.push({id:id(),name:$("#investmentName").value.trim(),type:$("#investmentType").value,ticker:$("#investmentTicker").value.trim().toUpperCase(),quantity:Number($("#investmentQuantity").value||0),invested:Number($("#investmentInvested").value),current:Number($("#investmentCurrent").value),date:$("#investmentDate").value});e.currentTarget.reset();safeClose($("#investmentModal"));save();});

$$(".chip").forEach(c=>c.onclick=()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");txFilter=c.dataset.filter;renderTransactions();});
["statementSearch","statementMonth","statementCategory","statementStatus","statementWallet","statementSort","statementView"].forEach(id=>$("#"+id).addEventListener(id==="statementSearch"?"input":"change",renderTransactions));
$("#clearStatementFilters").onclick=()=>{$("#statementSearch").value="";$("#statementMonth").value="";$("#statementCategory").value="all";$("#statementStatus").value="all";$("#statementWallet").value="all";$("#statementSort").value="newest";$("#statementView").value="grouped";txFilter="all";$$(".chip").forEach(x=>x.classList.toggle("active",x.dataset.filter==="all"));renderTransactions();};



// V1.8 — carteira de benefícios
$("#txWallet")?.addEventListener("change",e=>{if(e.target.value==="va")$("#txPayment").value="Vale Alimentação";else if(e.target.value==="vr")$("#txPayment").value="Vale Refeição";});

// ============================================
// V1.7 — PARCELAS, RECORRÊNCIAS, IMPORTAÇÃO, COTAÇÕES E BIOMETRIA
// ============================================
function updateScheduleFields(){
  const mode=$("#txScheduleType")?.value||"single";
  if($("#txInstallmentFields")) $("#txInstallmentFields").hidden=mode!=="installment";
  if($("#txRecurringFields")) $("#txRecurringFields").hidden=mode!=="recurring";
}
$("#txScheduleType")?.addEventListener("change",updateScheduleFields);updateScheduleFields();

let bankImportPreview=[];
let bankImportMeta={};
const importCategories=()=>categories.map(c=>`<option>${c}</option>`).join("");
function importRowHtml(x,i){
  const duplicate=x._duplicateLevel;
  const dupText=duplicate==="exact"?"Duplicado praticamente idêntico ao extrato atual":duplicate==="possible"?`Possível duplicado${x._duplicateMatch?`: ${esc(x._duplicateMatch)}`:""}`:"";
  return `<tr class="${duplicate?"epv17-duplicate":""}">
    <td><input class="import-row-check" data-i="${i}" type="checkbox" ${duplicate?"":"checked"}></td>
    <td><input class="imp-date" data-i="${i}" type="date" value="${esc(x.date)}"></td>
    <td><input class="imp-desc" data-i="${i}" value="${esc(x.description)}">${dupText?`<span class="duplicate-warning ${duplicate}">${esc(dupText)}</span>`:""}</td>
    <td><select class="imp-type" data-i="${i}"><option value="expense" ${x.type==="expense"?"selected":""}>Despesa</option><option value="income" ${x.type==="income"?"selected":""}>Receita</option></select></td>
    <td><select class="imp-cat" data-i="${i}">${importCategories()}</select></td>
    <td><select class="imp-wallet" data-i="${i}"><option value="cash">Conta / dinheiro</option><option value="va" ${x.wallet==="va"?"selected":""}>Vale Alimentação</option><option value="vr" ${x.wallet==="vr"?"selected":""}>Vale Refeição</option></select></td>
    <td><input class="imp-value" data-i="${i}" type="number" min="0.01" step="0.01" value="${Number(x.value||x.amount||0).toFixed(2)}"></td>
  </tr>`;
}
function syncImportPreviewFromUI(){
  bankImportPreview.forEach((x,i)=>{
    const get=cls=>document.querySelector(`${cls}[data-i="${i}"]`);
    x._skip=!get('.import-row-check')?.checked;
    x.date=get('.imp-date')?.value||x.date;x.description=get('.imp-desc')?.value.trim()||x.description;
    x.type=get('.imp-type')?.value||x.type;x.category=get('.imp-cat')?.value||x.category;x.wallet=get('.imp-wallet')?.value||x.wallet;
    const val=Number(get('.imp-value')?.value);if(Number.isFinite(val)&&val>0){x.value=val;x.amount=val;}
  });
}
$("#bankImportFile")?.addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    const signature=await EPV18Import.fileSignature(file);
    const already=(data.v18?.importHistory||[]).find(h=>h.fileSignature===signature);
    let parsed=[];
    if(ext==="pdf") parsed=await EPV18Import.parsePDF(file);
    else {const text=await file.text();parsed=ext==="ofx"?EPV17Import.parseOFX(text):EPV17Import.parseCSV(text);}
    bankImportPreview=EPV18Import.preview(data.transactions,parsed);
    bankImportMeta={fileName:file.name,fileSignature:signature,fileType:ext,found:parsed.length};
    const exact=bankImportPreview.filter(x=>x._duplicateLevel==="exact").length,possible=bankImportPreview.filter(x=>x._duplicateLevel==="possible").length;
    $("#importPreviewSummary").classList.toggle("import-file-repeat",Boolean(already));
    $("#importPreviewSummary").innerHTML=`<strong>${parsed.length} lançamento(s) encontrado(s) em ${esc(file.name)}</strong><span>${exact} duplicado(s) exato(s) • ${possible} possível(is) duplicidade(s).${already?" ⚠️ Este mesmo arquivo já foi importado anteriormente.":""}</span>`;
    $("#importPreviewTable").innerHTML=bankImportPreview.length?`<table class="v18-import-table"><thead><tr><th>Adicionar</th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Carteira</th><th>Valor</th></tr></thead><tbody>${bankImportPreview.map(importRowHtml).join("")}</tbody></table>`:`<div class="empty">Nenhum lançamento foi reconhecido. Se o PDF for escaneado como imagem, exporte pelo internet banking em PDF com texto, OFX ou CSV.</div>`;
    $$('.imp-cat').forEach(sel=>{const i=Number(sel.dataset.i);sel.value=bankImportPreview[i]?.category||"Outros";});
    safeOpen($("#importPreviewModal"));
  }catch(err){console.error(err);alert("Não foi possível ler este extrato. PDFs com texto são suportados; PDFs escaneados como imagem podem precisar ser exportados novamente pelo banco.");}
  e.target.value="";
});
$("#importPreviewForm")?.addEventListener("submit",e=>{
  e.preventDefault();syncImportPreviewFromUI();
  const result=EPV18Import.merge(data,bankImportPreview,bankImportMeta);data=result.data;safeClose($("#importPreviewModal"));save();alert(`${result.accepted.length} lançamento(s) adicionado(s) ao extrato.`);
});

$("#updateQuotes")?.addEventListener("click",async()=>{
  const btn=$("#updateQuotes"),status=$("#quoteStatus");const withTicker=data.investments.filter(i=>i.ticker);
  if(!withTicker.length){alert("Cadastre o ticker em pelo menos um investimento.");return;}
  btn.disabled=true;status.textContent="Buscando cotações...";
  try{const quotes=await EPV17Quotes.fetchQuotes(window.epSupabase,withTicker.map(i=>i.ticker));data=EPV17Quotes.applyQuotes(data,quotes);save();const ok=quotes.filter(q=>q.price!=null).length;status.textContent=`${ok} cotação(ões) atualizada(s) agora.`;}
  catch(err){console.error(err);status.textContent="Não foi possível atualizar agora. Valores manuais foram mantidos.";alert("Falha ao buscar cotações. Seus valores atuais não foram alterados.");}
  finally{btn.disabled=false;}
});

const BIO_CRED_KEY="epFinanceV17BioCredential";const BIO_ENABLED_KEY="epFinanceV17BioEnabled";
function updateBiometricUI(){const enabled=localStorage.getItem(BIO_ENABLED_KEY)==="1";if($("#biometricLockEnabled"))$("#biometricLockEnabled").checked=enabled;if($("#biometricStatus")){ $("#biometricStatus").textContent=enabled?"Ativada":"Desativada";$("#biometricStatus").classList.toggle("on",enabled);$("#biometricStatus").classList.toggle("off",!enabled);}}
async function biometricUnlock(){const cred=localStorage.getItem(BIO_CRED_KEY);if(!cred)throw new Error("Biometria ainda não configurada neste aparelho.");return EPV17Security.unlock(cred);}
$("#enableBiometric")?.addEventListener("click",async()=>{try{if(!(await EPV17Security.available()))throw new Error("Biometria/passkey não disponível neste navegador.");const u=await window.epSupabase?.auth?.getUser();const user=u?.data?.user;if(!user)throw new Error("Entre na sua conta primeiro.");const r=await EPV17Security.register(user.id,user.email||"EP Finance");localStorage.setItem(BIO_CRED_KEY,r.credentialId);localStorage.setItem(BIO_ENABLED_KEY,"1");updateBiometricUI();alert("Biometria configurada neste aparelho.");}catch(err){console.error(err);alert(err.message||"Não foi possível configurar a biometria.");}});
$("#testBiometric")?.addEventListener("click",async()=>{try{await biometricUnlock();alert("Desbloqueio confirmado ✅");}catch(err){alert(err.message||"Não foi possível desbloquear.");}});
$("#biometricLockEnabled")?.addEventListener("change",e=>{if(e.target.checked&&!localStorage.getItem(BIO_CRED_KEY)){e.target.checked=false;alert("Configure a biometria primeiro.");return;}localStorage.setItem(BIO_ENABLED_KEY,e.target.checked?"1":"0");updateBiometricUI();});
$("#unlockBiometric")?.addEventListener("click",async()=>{const msg=$("#biometricLockMessage");try{msg.textContent="";await biometricUnlock();$("#biometricLock").hidden=true;}catch(err){msg.textContent=err.message||"Falha no desbloqueio.";}});
window.addEventListener("epfinance-authenticated",()=>{if(localStorage.getItem(BIO_ENABLED_KEY)==="1"&&localStorage.getItem(BIO_CRED_KEY)){$("#biometricLock").hidden=false;}});updateBiometricUI();

function setDashboardMonth(mk){
  if(!/^\d{4}-\d{2}$/.test(mk||""))return;
  dashboardMonthKey=mk;renderHome();
}
$("#dashboardMonth").addEventListener("change",e=>setDashboardMonth(e.target.value));
$("#prevDashboardMonth").onclick=()=>setDashboardMonth(shiftMonth(dashboardMonthKey,-1));
$("#nextDashboardMonth").onclick=()=>setDashboardMonth(shiftMonth(dashboardMonthKey,1));

$("#saveSettings").onclick=()=>{data.settings.budget=Number($("#budgetInput").value||0);data.settings.userName=$("#userNameInput").value.trim();save();alert("Configurações salvas.");};
$("#themeBtn").onclick=()=>{data.settings.theme=data.settings.theme==="dark"?"light":"dark";save();};
$("#toggleBalance").onclick=()=>{data.settings.hideBalance=!data.settings.hideBalance;save();};
$("#exportData").onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ep-finance-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);};
$("#importData").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());data=normalize({...defaultData,...parsed,settings:{...defaultData.settings,...(parsed.settings||{})}});save();alert("Backup restaurado.");}catch{alert("Arquivo de backup inválido.");}};
$("#clearData").onclick=()=>{if(confirm("Apagar todos os dados do EP Finance neste aparelho?")){data=structuredClone(defaultData);save();}};

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));}

// ============================================
// NOTIFICAÇÕES
// ============================================

function getNotificationPreferences(){
  return {
    bills3Days: data.settings?.notifications?.bills3Days ?? true,
    bills1Day: data.settings?.notifications?.bills1Day ?? true,
    billsOverdue: data.settings?.notifications?.billsOverdue ?? true,
    budget80: data.settings?.notifications?.budget80 ?? true,
    budget100: data.settings?.notifications?.budget100 ?? true,
    weeklySummary: data.settings?.notifications?.weeklySummary ?? false,
    investmentReminder: data.settings?.notifications?.investmentReminder ?? false
  };
}

function setNotificationInputs(){
  const p=getNotificationPreferences();
  const map={
    notifyBills3Days:p.bills3Days,
    notifyBills1Day:p.bills1Day,
    notifyBillsOverdue:p.billsOverdue,
    notifyBudget80:p.budget80,
    notifyBudget100:p.budget100,
    notifyWeeklySummary:p.weeklySummary,
    notifyInvestmentReminder:p.investmentReminder
  };
  Object.entries(map).forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(el)el.checked=val;
  });
}

function notificationSupported(){
  return "Notification" in window && "serviceWorker" in navigator;
}

function isStandalonePWA(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone===true;
}

function updateNotificationUI(){
  const support=document.getElementById("notificationSupportText");
  const badge=document.getElementById("notificationStatusBadge");
  const enable=document.getElementById("enableNotifications");
  const test=document.getElementById("testNotification");
  if(!support||!badge||!enable||!test)return;

  if(!notificationSupported()){
    support.textContent="Este navegador não oferece suporte a notificações web.";
    badge.textContent="Indisponível";
    badge.className="status-badge off";
    enable.disabled=true;test.disabled=true;
    return;
  }

  const permission=Notification.permission;
  if(permission==="granted"){
    support.textContent=isStandalonePWA()
      ?"Notificações autorizadas neste aparelho."
      :"Autorizadas. No iPhone, use o app instalado na Tela de Início para Web Push.";
    badge.textContent="Ativas";
    badge.className="status-badge on";
    enable.textContent="Sincronizar este dispositivo";
    enable.disabled=false;
    test.disabled=false;
  }else if(permission==="denied"){
    support.textContent="A permissão foi bloqueada. Libere notificações nas configurações do navegador/aparelho.";
    badge.textContent="Bloqueadas";
    badge.className="status-badge off";
    enable.textContent="Permissão bloqueada";
    enable.disabled=true;
    test.disabled=true;
  }else{
    support.textContent=isStandalonePWA()
      ?"Toque em Ativar notificações para autorizar o EP Finance."
      :"No iPhone, adicione o EP Finance à Tela de Início antes de ativar.";
    badge.textContent="Desativadas";
    badge.className="status-badge";
    enable.textContent="Ativar notificações";
    enable.disabled=false;
    test.disabled=true;
  }
}

function urlBase64ToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=atob(base64);
  return Uint8Array.from([...rawData].map(char=>char.charCodeAt(0)));
}


function showPushDiagnostic(message, type="error"){
  const box=document.getElementById("pushDiagnostic");
  if(!box)return;
  box.hidden=false;
  box.className=`push-diagnostic ${type}`;
  box.textContent=message;
}

function clearPushDiagnostic(){
  const box=document.getElementById("pushDiagnostic");
  if(!box)return;
  box.hidden=true;
  box.textContent="";
}

function pushErrorText(err){
  if(!err)return "Erro desconhecido.";
  const name=err.name?`${err.name}: `:"";
  return name+(err.message||String(err));
}

async function persistPushSubscription(subscription){
  if(!subscription){
    showPushDiagnostic("Não existe uma PushSubscription para salvar.");
    return false;
  }

  if(!window.epSupabase){
    showPushDiagnostic("Supabase ainda não foi carregado no aplicativo.");
    return false;
  }

  let userResult;
  try{
    userResult=await window.epSupabase.auth.getUser();
  }catch(err){
    showPushDiagnostic("Falha ao consultar o usuário: "+pushErrorText(err));
    return false;
  }

  const user=userResult?.data?.user;
  const userError=userResult?.error;

  if(userError){
    showPushDiagnostic("Erro de autenticação: "+(userError.message||String(userError)));
    return false;
  }

  if(!user){
    showPushDiagnostic("Nenhum usuário autenticado. Saia da conta e entre novamente.");
    return false;
  }

  const j=subscription.toJSON();

  if(!j.endpoint){
    showPushDiagnostic("A assinatura Push não retornou endpoint.");
    return false;
  }

  if(!j.keys?.p256dh || !j.keys?.auth){
    showPushDiagnostic("A assinatura Push não retornou as chaves p256dh/auth.");
    return false;
  }

  const payload={
    user_id:user.id,
    endpoint:j.endpoint,
    p256dh:j.keys.p256dh,
    auth:j.keys.auth,
    user_agent:navigator.userAgent,
    updated_at:new Date().toISOString()
  };

  let result;
  try{
    result=await window.epSupabase
      .from("push_subscriptions")
      .upsert(payload,{onConflict:"endpoint"})
      .select("id,user_id,endpoint")
      .maybeSingle();
  }catch(err){
    showPushDiagnostic("Falha de rede ao salvar no Supabase: "+pushErrorText(err));
    return false;
  }

  if(result.error){
    const code=result.error.code?` [${result.error.code}]`:"";
    showPushDiagnostic(
      "Supabase recusou o dispositivo"+code+": "+
      (result.error.message||"erro desconhecido")+
      (result.error.details?` — ${result.error.details}`:"")
    );
    return false;
  }

  clearPushDiagnostic();
  showPushDiagnostic("Dispositivo registrado com sucesso no Supabase ✅","success");
  console.info("EP Finance: dispositivo registrado em push_subscriptions.",result.data);
  return true;
}

async function subscribeForPush(){
  clearPushDiagnostic();

  if(!notificationSupported()){
    showPushDiagnostic("Este navegador não oferece Notification + Service Worker.");
    return null;
  }

  if(Notification.permission!=="granted"){
    showPushDiagnostic("Permissão de notificação não está como granted.");
    return null;
  }

  const vapid=window.EP_CONFIG?.VAPID_PUBLIC_KEY;
  if(!vapid){
    showPushDiagnostic("VAPID_PUBLIC_KEY está vazia no config.js.");
    return null;
  }

  let registration;
  try{
    registration=await navigator.serviceWorker.ready;
  }catch(err){
    showPushDiagnostic("Service Worker não ficou pronto: "+pushErrorText(err));
    return null;
  }

  if(!registration.pushManager){
    showPushDiagnostic("PushManager não está disponível neste PWA.");
    return null;
  }

  let subscription;
  try{
    subscription=await registration.pushManager.getSubscription();
  }catch(err){
    showPushDiagnostic("Falha ao consultar subscription existente: "+pushErrorText(err));
    return null;
  }

  if(!subscription){
    try{
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(vapid)
      });
    }catch(err){
      showPushDiagnostic("Falha ao criar PushSubscription: "+pushErrorText(err));
      return null;
    }
  }

  const saved=await persistPushSubscription(subscription);
  if(!saved)return null;

  return subscription;
}

async function ensurePushRegistration(){
  if(!notificationSupported()){
    showPushDiagnostic("Notificações Web Push não são suportadas neste navegador.");
    return false;
  }
  if(Notification.permission!=="granted"){
    showPushDiagnostic("A permissão de notificações ainda não foi concedida.");
    return false;
  }

  try{
    const subscription=await subscribeForPush();
    return Boolean(subscription);
  }catch(err){
    showPushDiagnostic("Falha inesperada no registro Push: "+pushErrorText(err));
    console.error("EP Finance: falha ao garantir registro push:",err);
    return false;
  }
}

async function enableNotifications(){
  if(!notificationSupported())return;
  try{
    let permission=Notification.permission;

    if(permission==="default"){
      permission=await Notification.requestPermission();
    }

    updateNotificationUI();

    if(permission==="granted"){
      const registered=await ensurePushRegistration();

      if(registered){
        await sendLocalNotification(
          "EP Finance",
          "Dispositivo sincronizado com o Web Push ✅",
          {tag:"ep-finance-enabled",url:"./"}
        );
      }else{
        alert("Não foi possível sincronizar. Veja o diagnóstico exibido logo abaixo das preferências de notificações.");
      }
    }
  }catch(err){
    console.error(err);
    alert("Não foi possível ativar ou sincronizar as notificações neste aparelho.");
  }
}

async function sendLocalNotification(title,body,options={}){
  if(!notificationSupported()||Notification.permission!=="granted")return false;
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification(title,{
    body,
    icon:"./icons/icon-192.png",
    badge:"./icons/icon-192.png",
    tag:options.tag||"ep-finance",
    data:{url:options.url||"./",...(options.data||{})}
  });
  return true;
}

async function testNotification(){
  const ok=await sendLocalNotification(
    "EP Finance",
    "Teste concluído. Suas notificações estão funcionando ✅",
    {tag:"ep-finance-test"}
  );
  if(!ok)alert("Ative as notificações primeiro.");
}

function saveNotificationPreferences(){
  data.settings=data.settings||{};
  data.settings.notifications={
    bills3Days:$("#notifyBills3Days").checked,
    bills1Day:$("#notifyBills1Day").checked,
    billsOverdue:$("#notifyBillsOverdue").checked,
    budget80:$("#notifyBudget80").checked,
    budget100:$("#notifyBudget100").checked,
    weeklySummary:$("#notifyWeeklySummary").checked,
    investmentReminder:$("#notifyInvestmentReminder").checked
  };
  save();
  if(window.epSupabase){
    window.epSupabase.auth.getUser().then(async({data:{user}})=>{
      if(!user)return;
      const {error}=await window.epSupabase.from("notification_preferences").upsert({
        user_id:user.id,
        preferences:data.settings.notifications,
        updated_at:new Date().toISOString()
      },{onConflict:"user_id"});
      if(error)console.error(error);
    });
  }
  alert("Preferências de notificações salvas.");
}

function initNotifications(){
  setNotificationInputs();
  updateNotificationUI();

  const enable=document.getElementById("enableNotifications");
  const test=document.getElementById("testNotification");
  const saveBtn=document.getElementById("saveNotificationPreferences");
  if(enable)enable.onclick=enableNotifications;
  if(test)test.onclick=testNotification;
  if(saveBtn)saveBtn.onclick=saveNotificationPreferences;

  if(notificationSupported()&&Notification.permission==="granted"){
    setTimeout(()=>ensurePushRegistration(),1200);
  }

  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"){
      updateNotificationUI();
      if(Notification.permission==="granted"){
        ensurePushRegistration();
      }
    }
  });
}


window.ensureEpPushRegistration=ensurePushRegistration;
renderAll();
initNotifications();
