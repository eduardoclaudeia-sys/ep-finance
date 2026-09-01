const KEY="epFinanceV12";
const LEGACY_KEYS=["epFinanceV1"];
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const categories=["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Salário","Investimentos","Outros"];
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
function normalize(d){d.transactions=d.transactions||[];d.bills=d.bills||[];d.goals=d.goals||[];d.investments=d.investments||[];d.settings={...defaultData.settings,...(d.settings||{})};return d;}
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
function iconFor(cat){const m={Moradia:"🏠",Alimentação:"🍽️",Transporte:"🚗",Saúde:"❤️",Educação:"🎓",Lazer:"🎮",Salário:"💼",Investimentos:"📈",Outros:"•"};return m[cat]||"•";}

function renderAll(){
  document.body.classList.toggle("dark",data.settings.theme==="dark");
  $("#budgetInput").value=data.settings.budget||"";
  $("#userNameInput").value=data.settings.userName||"";
  renderHome();renderTransactions();renderBills();renderGoals();renderInvestments();
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
function balance(){return realizedTransactions().reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0);}
function available(){return balance();}
function monthEnd(mk){const [y,m]=mk.split("-").map(Number);return `${y}-${String(m).padStart(2,"0")}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;}
function futureTxUntil(mk){const end=monthEnd(mk);return futureTransactions().filter(t=>t.date<=end);}
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
  const sort=$("#statementSort")?.value||"newest";
  let tx=[...data.transactions];
  if(txFilter!=="all")tx=tx.filter(t=>t.type===txFilter);
  if(mk)tx=tx.filter(t=>monthKey(t.date)===mk);
  if(cat!=="all")tx=tx.filter(t=>t.category===cat);
  if(status==="realized")tx=tx.filter(isRealizedTx);
  if(status==="future")tx=tx.filter(isFutureTx);
  if(q)tx=tx.filter(t=>`${t.description} ${t.category} ${t.payment||""} ${t.note||""}`.toLowerCase().includes(q));
  if(sort==="newest")tx.sort(sortNewest);
  if(sort==="oldest")tx.sort((a,b)=>sortNewest(b,a));
  if(sort==="highest")tx.sort((a,b)=>Number(b.value)-Number(a.value));
  if(sort==="lowest")tx.sort((a,b)=>Number(a.value)-Number(b.value));
  return tx;
}
function txRow(t){
  const state=isFutureTx(t)?"Agendado":"Realizado";
  const details=[state,t.category,t.payment,fmtDate(t.date),t.note].filter(Boolean).join(" • ");
  return itemHtml(iconFor(t.category),t.description,details,`${t.type==="income"?"+":"-"} ${money(t.value)}`,t.type,`<div class="tx-actions"><button class="text-btn edit-tx" type="button" data-id="${t.id}">Editar</button><button class="text-btn delete-tx" type="button" data-id="${t.id}">Excluir</button></div>`);
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
      category:b.category||"Outros",date:today(),payment:"Pix",
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
  const invested=investedTotal(),current=currentInvestmentTotal(),result=investmentResult(),pct=invested?result/invested*100:0;
  $("#investedTotal").textContent=money(invested);$("#currentInvestmentTotal").textContent=money(current);$("#investmentResult").textContent=(result>=0?"+ ":"- ")+money(Math.abs(result));$("#investmentResult").className=result>=0?"income":"expense";$("#investmentReturnPercent").textContent=(pct>=0?"+":"")+pct.toFixed(2).replace(".",",")+"%";$("#investmentReturnPercent").className=pct>=0?"income":"expense";
  const list=[...data.investments].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("#investmentList").innerHTML=list.length?list.map(i=>{const gain=Number(i.current)-Number(i.invested),ipct=Number(i.invested)?gain/Number(i.invested)*100:0;return `<div class="item"><div class="item-main"><div class="item-icon">◈</div><div><div class="item-title">${esc(i.name)}</div><div class="investment-meta"><span class="badge">${esc(i.type)}</span><span class="badge">${fmtDate(i.date)}</span></div><div class="item-sub">Aportado: ${money(i.invested)} • Atual: ${money(i.current)}</div></div></div><div><div class="amount ${gain>=0?"income":"expense"}">${gain>=0?"+ ":"- "}${money(Math.abs(gain))}</div><div class="item-sub" style="text-align:right">${ipct>=0?"+":""}${ipct.toFixed(2).replace(".",",")}%</div><div class="investment-actions"><button class="text-btn edit-investment" type="button" data-id="${i.id}">Atualizar</button><button class="text-btn delete-investment" type="button" data-id="${i.id}">Excluir</button></div></div></div>`}).join(""):`<div class="empty">Adicione seu primeiro investimento.</div>`;
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
  $("#txType").value=t?.type||"expense";$("#txDescription").value=t?.description||"";$("#txValue").value=t?.value||"";$("#txCategory").value=t?.category||"Alimentação";$("#txDate").value=t?.date||today();$("#txPayment").value=t?.payment||"Pix";$("#txNote").value=t?.note||"";safeOpen($("#transactionModal"));
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
  const obj={
    id:editId||id(),
    type:$("#txType").value,
    description:$("#txDescription").value.trim(),
    value:Number($("#txValue").value),
    category:$("#txCategory").value,
    date:$("#txDate").value,
    payment:$("#txPayment").value,
    note:$("#txNote").value.trim(),
    ...(previous?.sourceBillId?{sourceBillId:previous.sourceBillId}:{})
  };
  if(editId){
    const ix=data.transactions.findIndex(t=>t.id===editId);
    if(ix>=0)data.transactions[ix]=obj;
  }else data.transactions.push(obj);
  safeClose($("#transactionModal"));save();
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
      category:bill.category||"Outros",date:today(),payment:"Pix",
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
$("#investmentForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;data.investments.push({id:id(),name:$("#investmentName").value.trim(),type:$("#investmentType").value,invested:Number($("#investmentInvested").value),current:Number($("#investmentCurrent").value),date:$("#investmentDate").value});e.currentTarget.reset();safeClose($("#investmentModal"));save();});

$$(".chip").forEach(c=>c.onclick=()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");txFilter=c.dataset.filter;renderTransactions();});
["statementSearch","statementMonth","statementCategory","statementStatus","statementSort","statementView"].forEach(id=>$("#"+id).addEventListener(id==="statementSearch"?"input":"change",renderTransactions));
$("#clearStatementFilters").onclick=()=>{$("#statementSearch").value="";$("#statementMonth").value="";$("#statementCategory").value="all";$("#statementStatus").value="all";$("#statementSort").value="newest";$("#statementView").value="grouped";txFilter="all";$$(".chip").forEach(x=>x.classList.toggle("active",x.dataset.filter==="all"));renderTransactions();};


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
renderAll();
