const KEY="epFinanceV1";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

const defaultData={transactions:[],bills:[],goals:[],settings:{budget:0,theme:"light",hideBalance:false}};
let data=load();
let txFilter="all";

function load(){
  try{return {...defaultData,...JSON.parse(localStorage.getItem(KEY)||"{}")};}
  catch{return structuredClone(defaultData);}
}
function save(){localStorage.setItem(KEY,JSON.stringify(data));renderAll();}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function today(){return new Date().toISOString().slice(0,10);}
function monthKey(d){return (d||today()).slice(0,7);}
function fmtDate(d){if(!d)return""; return new Date(d+"T12:00:00").toLocaleDateString("pt-BR");}
function id(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();}
function iconFor(cat){const m={Moradia:"🏠","Alimentação":"🍽️","Transporte":"🚗","Saúde":"❤️","Educação":"🎓","Lazer":"🎮","Salário":"💼","Outros":"•"};return m[cat]||"•";}

function renderAll(){
  document.body.classList.toggle("dark",data.settings.theme==="dark");
  $("#budgetInput").value=data.settings.budget||"";
  renderHome(); renderTransactions(); renderBills(); renderGoals();
}

function currentMonthTx(){const mk=monthKey();return data.transactions.filter(t=>monthKey(t.date)===mk);}
function monthIncome(){return currentMonthTx().filter(t=>t.type==="income").reduce((a,b)=>a+Number(b.value),0);}
function monthExpense(){return currentMonthTx().filter(t=>t.type==="expense").reduce((a,b)=>a+Number(b.value),0);}
function pendingBills(){return data.bills.filter(b=>b.status==="pending").reduce((a,b)=>a+Number(b.value),0);}
function balance(){return data.transactions.reduce((a,t)=>a+(t.type==="income"?Number(t.value):-Number(t.value)),0);}
function available(){return balance()-pendingBills();}

function renderHome(){
  const hidden=data.settings.hideBalance;
  const mask="••••••";
  $("#availableBalance").textContent=hidden?mask:money(available());
  $("#monthIncome").textContent=hidden?mask:money(monthIncome());
  $("#monthExpense").textContent=hidden?mask:money(monthExpense());

  const budget=Number(data.settings.budget||0), spent=monthExpense();
  const pct=budget?Math.min(100,Math.round(spent/budget*100)):0;
  $("#budgetPercent").textContent=budget?pct+"%":"0%";
  $("#budgetBar").style.width=pct+"%";
  $("#budgetText").textContent=budget?`${money(spent)} de ${money(budget)} utilizados.`:"Defina um orçamento mensal nas configurações.";

  const bills=[...data.bills].filter(b=>b.status==="pending").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3);
  $("#upcomingBills").innerHTML=bills.length?bills.map(b=>itemHtml("▣",b.description,`Vence em ${fmtDate(b.due)}`,money(b.value),"expense")).join(""):`<div class="empty">Nenhuma conta pendente.</div>`;

  const tx=[...data.transactions].sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id)).slice(0,4);
  $("#recentTransactions").innerHTML=tx.length?tx.map(t=>itemHtml(iconFor(t.category),t.description,`${t.category} • ${fmtDate(t.date)}`,`${t.type==="income"?"+":"-"} ${money(t.value)}`,t.type)).join(""):`<div class="empty">Adicione sua primeira movimentação.</div>`;
}

function itemHtml(icon,title,sub,amount,type,actions=""){
  return `<div class="item"><div class="item-main"><div class="item-icon">${icon}</div><div><div class="item-title">${esc(title)}</div><div class="item-sub">${esc(sub)}</div></div></div><div><div class="amount ${type}">${amount}</div>${actions}</div></div>`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

function renderTransactions(){
  let tx=[...data.transactions].sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id));
  if(txFilter!=="all")tx=tx.filter(t=>t.type===txFilter);
  $("#transactionList").innerHTML=tx.length?tx.map(t=>itemHtml(iconFor(t.category),t.description,`${t.category} • ${fmtDate(t.date)}`,`${t.type==="income"?"+":"-"} ${money(t.value)}`,t.type,`<button class="text-btn delete-tx" data-id="${t.id}">Excluir</button>`)).join(""):`<div class="empty">Nenhuma movimentação neste filtro.</div>`;
  $$(".delete-tx").forEach(b=>b.onclick=()=>{data.transactions=data.transactions.filter(t=>t.id!==b.dataset.id);save();});
}

function renderBills(){
  const bills=[...data.bills].sort((a,b)=>a.due.localeCompare(b.due));
  $("#billList").innerHTML=bills.length?bills.map(b=>{
    const status=b.status==="paid"?"Pago":"Pendente";
    const actions=`<button class="text-btn toggle-bill" data-id="${b.id}">${b.status==="paid"?"Marcar pendente":"Marcar pago"}</button> · <button class="text-btn delete-bill" data-id="${b.id}">Excluir</button>`;
    return itemHtml("▣",b.description,`${status} • ${fmtDate(b.due)}`,money(b.value),b.status==="paid"?"income":"expense",actions);
  }).join(""):`<div class="empty">Nenhuma conta cadastrada.</div>`;
  $$(".toggle-bill").forEach(btn=>btn.onclick=()=>{const b=data.bills.find(x=>x.id===btn.dataset.id);b.status=b.status==="paid"?"pending":"paid";save();});
  $$(".delete-bill").forEach(btn=>btn.onclick=()=>{data.bills=data.bills.filter(x=>x.id!==btn.dataset.id);save();});
}

function renderGoals(){
  $("#goalList").innerHTML=data.goals.length?data.goals.map(g=>{
    const pct=Math.min(100,Math.round(Number(g.saved||0)/Number(g.target||1)*100));
    return `<div class="goal-card"><div class="goal-head"><div><div class="item-title">${esc(g.name)}</div><div class="item-sub">${pct}% concluído</div></div><div class="goal-value">${money(g.saved)} / ${money(g.target)}</div></div><div class="progress goal-progress"><div style="width:${pct}%"></div></div><div style="display:flex;gap:8px;margin-top:12px"><button class="secondary add-goal" data-id="${g.id}">Adicionar valor</button><button class="text-btn delete-goal" data-id="${g.id}">Excluir</button></div></div>`;
  }).join(""):`<div class="empty">Crie uma meta para acompanhar seus objetivos.</div>`;
  $$(".add-goal").forEach(btn=>btn.onclick=()=>{const g=data.goals.find(x=>x.id===btn.dataset.id);const v=Number(prompt("Quanto deseja adicionar à meta?")||0);if(v>0){g.saved=Number(g.saved||0)+v;save();}});
  $$(".delete-goal").forEach(btn=>btn.onclick=()=>{data.goals=data.goals.filter(x=>x.id!==btn.dataset.id);save();});
}

function go(screen){
  $$(".screen").forEach(s=>s.classList.toggle("active",s.id===screen));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.screen===screen));
  $("#fab").style.display=screen==="settingsScreen"?"none":"block";
  scrollTo({top:0,behavior:"smooth"});
}
$$(".nav-item").forEach(n=>n.onclick=()=>go(n.dataset.screen));
$$("[data-go]").forEach(n=>n.onclick=()=>go(n.dataset.go));

function setupModal(openSel,modalSel,dateSel){
  $(openSel).onclick=()=>{if(dateSel)$(dateSel).value=today();$(modalSel).showModal();};
}
setupModal("#openTransactionModal","#transactionModal","#txDate");
setupModal("#fab","#transactionModal","#txDate");
setupModal("#openBillModal","#billModal","#billDue");
setupModal("#openGoalModal","#goalModal");

$("#transactionForm").addEventListener("submit",e=>{
  if(e.submitter?.value==="cancel")return;
  e.preventDefault();
  data.transactions.push({id:id(),type:$("#txType").value,description:$("#txDescription").value.trim(),value:Number($("#txValue").value),category:$("#txCategory").value,date:$("#txDate").value});
  e.target.reset(); $("#transactionModal").close(); save();
});
$("#billForm").addEventListener("submit",e=>{
  if(e.submitter?.value==="cancel")return;
  e.preventDefault();
  data.bills.push({id:id(),description:$("#billDescription").value.trim(),value:Number($("#billValue").value),due:$("#billDue").value,status:$("#billStatus").value});
  e.target.reset(); $("#billModal").close(); save();
});
$("#goalForm").addEventListener("submit",e=>{
  if(e.submitter?.value==="cancel")return;
  e.preventDefault();
  data.goals.push({id:id(),name:$("#goalName").value.trim(),target:Number($("#goalTarget").value),saved:Number($("#goalSaved").value||0)});
  e.target.reset(); $("#goalModal").close(); save();
});
$$(".chip").forEach(c=>c.onclick=()=>{$$(".chip").forEach(x=>x.classList.remove("active"));c.classList.add("active");txFilter=c.dataset.filter;renderTransactions();});

$("#saveSettings").onclick=()=>{data.settings.budget=Number($("#budgetInput").value||0);save();alert("Orçamento salvo.");};
$("#themeBtn").onclick=()=>{data.settings.theme=data.settings.theme==="dark"?"light":"dark";save();};
$("#toggleBalance").onclick=()=>{data.settings.hideBalance=!data.settings.hideBalance;save();};

$("#exportData").onclick=()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ep-finance-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
};
$("#importData").onchange=async e=>{
  const file=e.target.files[0]; if(!file)return;
  try{const parsed=JSON.parse(await file.text());data={...defaultData,...parsed};save();alert("Backup restaurado.");}
  catch{alert("Arquivo de backup inválido.");}
};
$("#clearData").onclick=()=>{if(confirm("Apagar todos os dados do EP Finance neste aparelho?")){data=structuredClone(defaultData);save();}};
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));}

renderAll();