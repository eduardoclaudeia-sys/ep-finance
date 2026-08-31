const KEY="epFinanceV12";
const LEGACY_KEYS=["epFinanceV1"];
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const categories=["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Salário","Investimentos","Outros"];
const defaultData={transactions:[],bills:[],goals:[],investments:[],settings:{budget:0,theme:"light",hideBalance:false,userName:""}};
let data=load();
let txFilter="all";

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
function today(){return new Date().toISOString().slice(0,10);}
function monthKey(d){return (d||today()).slice(0,7);}
function fmtDate(d){if(!d)return"";return new Date(d+"T12:00:00").toLocaleDateString("pt-BR");}
function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function iconFor(cat){const m={Moradia:"🏠",Alimentação:"🍽️",Transporte:"🚗",Saúde:"❤️",Educação:"🎓",Lazer:"🎮",Salário:"💼",Investimentos:"📈",Outros:"•"};return m[cat]||"•";}

function renderAll(){
  document.body.classList.toggle("dark",data.settings.theme==="dark");
  $("#budgetInput").value=data.settings.budget||"";
  $("#userNameInput").value=data.settings.userName||"";
  renderHome();renderTransactions();renderBills();renderGoals();renderInvestments();
}

function currentMonthTx(){const mk=monthKey();return data.transactions.filter(t=>monthKey(t.date)===mk);}
function monthIncome(){return currentMonthTx().filter(t=>t.type==="income").reduce((a,b)=>a+Number(b.value),0);}
function monthExpense(){return currentMonthTx().filter(t=>t.type==="expense").reduce((a,b)=>a+Number(b.value),0);}
function pendingBills(){return data.bills.filter(b=>b.status==="pending").reduce((a,b)=>a+Number(b.value),0);}
function balance(){return data.transactions.reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0);}
function available(){return balance()-pendingBills();}
function investedTotal(){return data.investments.reduce((a,i)=>a+Number(i.invested||0),0);}
function currentInvestmentTotal(){return data.investments.reduce((a,i)=>a+Number(i.current||0),0);}
function investmentResult(){return currentInvestmentTotal()-investedTotal();}
function netWorth(){return balance()+currentInvestmentTotal();}

function shownMoney(v){return data.settings.hideBalance?"••••••":money(v);}

function renderHome(){
  const inc=monthIncome(),exp=monthExpense(),net=inc-exp;
  $("#availableBalance").textContent=shownMoney(available());
  $("#monthIncome").textContent=shownMoney(inc);
  $("#monthExpense").textContent=shownMoney(exp);
  $("#cashBalance").textContent=shownMoney(balance());
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

  const bills=[...data.bills].filter(b=>b.status==="pending").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3);
  $("#upcomingBills").innerHTML=bills.length?bills.map(b=>itemHtml("▣",b.description,`Vence em ${fmtDate(b.due)}`,money(b.value),"expense")).join(""):`<div class="empty">Nenhuma conta pendente.</div>`;
  const tx=[...data.transactions].sort(sortNewest).slice(0,4);
  $("#recentTransactions").innerHTML=tx.length?tx.map(t=>itemHtml(iconFor(t.category),t.description,`${t.category} • ${fmtDate(t.date)}`,`${t.type==="income"?"+":"-"} ${money(t.value)}`,t.type)).join(""):`<div class="empty">Adicione sua primeira movimentação.</div>`;
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
  const sort=$("#statementSort")?.value||"newest";
  let tx=[...data.transactions];
  if(txFilter!=="all")tx=tx.filter(t=>t.type===txFilter);
  if(mk)tx=tx.filter(t=>monthKey(t.date)===mk);
  if(cat!=="all")tx=tx.filter(t=>t.category===cat);
  if(q)tx=tx.filter(t=>`${t.description} ${t.category} ${t.payment||""} ${t.note||""}`.toLowerCase().includes(q));
  if(sort==="newest")tx.sort(sortNewest);
  if(sort==="oldest")tx.sort((a,b)=>sortNewest(b,a));
  if(sort==="highest")tx.sort((a,b)=>Number(b.value)-Number(a.value));
  if(sort==="lowest")tx.sort((a,b)=>Number(a.value)-Number(b.value));
  return tx;
}
function txRow(t){
  const details=[t.category,t.payment,fmtDate(t.date),t.note].filter(Boolean).join(" • ");
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
    $("#transactionList").innerHTML=Object.entries(groups).map(([date,items])=>{const dayNet=items.reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0);return `<section class="statement-day"><div class="statement-day-head"><span>${fmtDate(date)}</span><span class="${dayNet>=0?"income":"expense"}">${dayNet>=0?"+ ":"- "}${money(Math.abs(dayNet))}</span></div>${items.map(txRow).join("")}</section>`}).join("");
  } else $("#transactionList").innerHTML=tx.map(txRow).join("");
  bindTxActions();
}
function bindTxActions(){
  $$(".delete-tx").forEach(b=>b.onclick=()=>{if(confirm("Excluir esta movimentação?")){data.transactions=data.transactions.filter(t=>t.id!==b.dataset.id);save();}});
  $$(".edit-tx").forEach(b=>b.onclick=()=>openTransaction(data.transactions.find(t=>t.id===b.dataset.id)));
}

function renderBills(){
  const bills=[...data.bills].sort((a,b)=>a.due.localeCompare(b.due));
  $("#billList").innerHTML=bills.length?bills.map(b=>{const status=b.status==="paid"?"Pago":"Pendente";const actions=`<div class="tx-actions"><button class="text-btn toggle-bill" type="button" data-id="${b.id}">${b.status==="paid"?"Marcar pendente":"Marcar pago"}</button><button class="text-btn delete-bill" type="button" data-id="${b.id}">Excluir</button></div>`;return itemHtml("▣",b.description,`${status} • ${fmtDate(b.due)}`,money(b.value),b.status==="paid"?"income":"expense",actions)}).join(""):`<div class="empty">Nenhuma conta cadastrada.</div>`;
  $$(".toggle-bill").forEach(btn=>btn.onclick=()=>{const b=data.bills.find(x=>x.id===btn.dataset.id);b.status=b.status==="paid"?"pending":"paid";save();});
  $$(".delete-bill").forEach(btn=>btn.onclick=()=>{if(confirm("Excluir esta conta?")){data.bills=data.bills.filter(x=>x.id!==btn.dataset.id);save();}});
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
setupModal("#openBillModal","#billModal","#billDue");setupModal("#openGoalModal","#goalModal");setupModal("#openInvestmentModal","#investmentModal","#investmentDate");
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

$("#transactionForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;const editId=$("#txEditId").value;const obj={id:editId||id(),type:$("#txType").value,description:$("#txDescription").value.trim(),value:Number($("#txValue").value),category:$("#txCategory").value,date:$("#txDate").value,payment:$("#txPayment").value,note:$("#txNote").value.trim()};if(editId){const ix=data.transactions.findIndex(t=>t.id===editId);if(ix>=0)data.transactions[ix]=obj;}else data.transactions.push(obj);safeClose($("#transactionModal"));save();});
$("#billForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;data.bills.push({id:id(),description:$("#billDescription").value.trim(),value:Number($("#billValue").value),due:$("#billDue").value,status:$("#billStatus").value});e.currentTarget.reset();safeClose($("#billModal"));save();});
$("#goalForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;data.goals.push({id:id(),name:$("#goalName").value.trim(),target:Number($("#goalTarget").value),saved:Number($("#goalSaved").value||0)});e.currentTarget.reset();safeClose($("#goalModal"));save();});
$("#investmentForm").addEventListener("submit",e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;data.investments.push({id:id(),name:$("#investmentName").value.trim(),type:$("#investmentType").value,invested:Number($("#investmentInvested").value),current:Number($("#investmentCurrent").value),date:$("#investmentDate").value});e.currentTarget.reset();safeClose($("#investmentModal"));save();});

$$(".chip").forEach(c=>c.onclick=()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");txFilter=c.dataset.filter;renderTransactions();});
["statementSearch","statementMonth","statementCategory","statementSort","statementView"].forEach(id=>$("#"+id).addEventListener(id==="statementSearch"?"input":"change",renderTransactions));
$("#clearStatementFilters").onclick=()=>{$("#statementSearch").value="";$("#statementMonth").value="";$("#statementCategory").value="all";$("#statementSort").value="newest";$("#statementView").value="grouped";txFilter="all";$$(".chip").forEach(x=>x.classList.toggle("active",x.dataset.filter==="all"));renderTransactions();};

$("#saveSettings").onclick=()=>{data.settings.budget=Number($("#budgetInput").value||0);data.settings.userName=$("#userNameInput").value.trim();save();alert("Configurações salvas.");};
$("#themeBtn").onclick=()=>{data.settings.theme=data.settings.theme==="dark"?"light":"dark";save();};
$("#toggleBalance").onclick=()=>{data.settings.hideBalance=!data.settings.hideBalance;save();};
$("#exportData").onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ep-finance-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);};
$("#importData").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());data=normalize({...defaultData,...parsed,settings:{...defaultData.settings,...(parsed.settings||{})}});save();alert("Backup restaurado.");}catch{alert("Arquivo de backup inválido.");}};
$("#clearData").onclick=()=>{if(confirm("Apagar todos os dados do EP Finance neste aparelho?")){data=structuredClone(defaultData);save();}};

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));}
renderAll();
