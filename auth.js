(() => {
  const cfg=window.EP_CONFIG||{};
  const gate=document.getElementById('authGate');
  const msg=document.getElementById('authMessage');
  const form=document.getElementById('authForm');
  const email=document.getElementById('authEmail');
  const password=document.getElementById('authPassword');
  const submit=document.getElementById('authSubmit');
  const loginTab=document.getElementById('loginTab');
  const signupTab=document.getElementById('signupTab');
  const LOCAL_KEY='epFinanceV1';
  let mode='login', user=null, lastSynced=null, syncTimer=null;

  const showMsg=(text,type='')=>{msg.textContent=text;msg.className='auth-message '+type};
  const configured=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY;
  if(!configured || !window.supabase){showMsg('Configure o Supabase no arquivo config.js para ativar login e nuvem.','error');return;}
  const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  window.epSupabase=sb;

  function setMode(next){mode=next;loginTab.classList.toggle('active',mode==='login');signupTab.classList.toggle('active',mode==='signup');submit.textContent=mode==='login'?'Entrar':'Criar conta';password.autocomplete=mode==='login'?'current-password':'new-password';showMsg('');}
  loginTab.onclick=()=>setMode('login');signupTab.onclick=()=>setMode('signup');

  async function loadCloudData(){
    const {data:row,error}=await sb.from('finance_data').select('data').eq('user_id',user.id).maybeSingle();
    if(error){console.error(error);return;}
    const local=localStorage.getItem(LOCAL_KEY);
    if(row?.data){localStorage.setItem(LOCAL_KEY,JSON.stringify(row.data));lastSynced=JSON.stringify(row.data);location.reload();return;}
    if(local){try{await sb.from('finance_data').upsert({user_id:user.id,data:JSON.parse(local),updated_at:new Date().toISOString()},{onConflict:'user_id'});lastSynced=local;}catch(e){console.error(e)}}
  }

  async function syncNow(){
    if(!user)return; const raw=localStorage.getItem(LOCAL_KEY); if(!raw||raw===lastSynced)return;
    let parsed; try{parsed=JSON.parse(raw)}catch{return;}
    const {error}=await sb.from('finance_data').upsert({user_id:user.id,data:parsed,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(!error){lastSynced=raw;showSync('Sincronizado ✓');} else console.error(error);
  }
  function showSync(text){let p=document.getElementById('syncPill');if(!p){p=document.createElement('div');p.id='syncPill';p.className='sync-pill';document.body.appendChild(p)}p.textContent=text;p.classList.add('show');setTimeout(()=>p.classList.remove('show'),1200)}

  async function activate(session,initial=false){
    user=session?.user||null;
    if(!user){gate.classList.remove('hidden');return;}
    gate.classList.add('hidden');
    const ae=document.getElementById('accountEmail');if(ae)ae.textContent=user.email||'';
    const {data:profile}=await sb.from('profiles').select('monthly_report_enabled').eq('id',user.id).maybeSingle();
    const cb=document.getElementById('monthlyReportEnabled');if(cb)cb.checked=profile?.monthly_report_enabled!==false;
    if(initial) await loadCloudData();
    clearInterval(syncTimer);syncTimer=setInterval(syncNow,1800);
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();showMsg('');submit.disabled=true;
    try{
      if(mode==='signup'){
        const {data,error}=await sb.auth.signUp({email:email.value.trim(),password:password.value});
        if(error)throw error;
        if(data.session){await activate(data.session,true)} else showMsg('Conta criada. Confira seu e-mail para confirmar o cadastro.','success');
      }else{
        const {data,error}=await sb.auth.signInWithPassword({email:email.value.trim(),password:password.value});
        if(error)throw error;await activate(data.session,true);
      }
    }catch(err){showMsg(err.message||'Não foi possível entrar.','error')} finally{submit.disabled=false;}
  });

  document.getElementById('forgotPassword').onclick=async()=>{
    const value=email.value.trim();if(!value){showMsg('Digite seu e-mail primeiro.','error');return;}
    const {error}=await sb.auth.resetPasswordForEmail(value,{redirectTo:location.origin+location.pathname});
    showMsg(error?error.message:'Enviamos as instruções de recuperação para seu e-mail.',error?'error':'success');
  };

  document.getElementById('logoutBtn').onclick=async()=>{await syncNow();await sb.auth.signOut();localStorage.removeItem(LOCAL_KEY);location.reload();};
  document.getElementById('saveEmailPreferences').onclick=async()=>{
    if(!user)return;const enabled=document.getElementById('monthlyReportEnabled').checked;
    const {error}=await sb.from('profiles').update({monthly_report_enabled:enabled}).eq('id',user.id);
    alert(error?'Não foi possível salvar.':'Preferência de relatório salva.');
  };

  sb.auth.onAuthStateChange((_event,session)=>activate(session,false));
  sb.auth.getSession().then(({data})=>activate(data.session,true));
})();
