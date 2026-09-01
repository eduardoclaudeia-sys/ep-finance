(() => {
  const cfg = window.EP_CONFIG || {};
  const gate = document.getElementById('authGate');
  const msg = document.getElementById('authMessage');
  const form = document.getElementById('authForm');
  const email = document.getElementById('authEmail');
  const password = document.getElementById('authPassword');
  const submit = document.getElementById('authSubmit');
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');

  // Deve ser o mesmo KEY usado em app.js.
  const LOCAL_KEY = 'epFinanceV12';
  const LEGACY_KEYS = ['epFinanceV1'];

  let mode = 'login';
  let user = null;
  let lastSynced = null;
  let syncTimer = null;
  let sb = null;

  const showMsg = (text, type = '') => {
    if (!msg) return;
    msg.textContent = text;
    msg.className = `auth-message ${type}`.trim();
  };

  function setMode(next) {
    mode = next;
    loginTab?.classList.toggle('active', mode === 'login');
    signupTab?.classList.toggle('active', mode === 'signup');
    if (submit) submit.textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
    if (password) password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    showMsg('');
  }

  // Os botões funcionam mesmo se houver erro de configuração,
  // evitando a sensação de "aba inativa".
  if (loginTab) loginTab.addEventListener('click', () => setMode('login'));
  if (signupTab) signupTab.addEventListener('click', () => setMode('signup'));

  const publicKey = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const configured = Boolean(cfg.SUPABASE_URL && publicKey);

  if (!configured) {
    console.error('EP Finance: SUPABASE_URL ou chave pública não encontrada.', cfg);
    showMsg('Configuração do Supabase não encontrada. Verifique o config.js.', 'error');
    return;
  }

  if (!window.supabase?.createClient) {
    console.error('EP Finance: biblioteca @supabase/supabase-js não carregou.');
    showMsg('Não foi possível carregar a conexão com o Supabase. Atualize a página.', 'error');
    return;
  }

  sb = window.supabase.createClient(cfg.SUPABASE_URL, publicKey);
  window.epSupabase = sb;

  window.addEventListener('load', () => {
    setTimeout(() => {
      if (window.ensureEpPushRegistration) {
        window.ensureEpPushRegistration();
      }
    }, 1500);
  });

  function getLocalRaw() {
    let raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return raw;
    for (const key of LEGACY_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) return raw;
    }
    return null;
  }

  function hasCloudData(value) {
    return value && typeof value === 'object' && Object.keys(value).length > 0;
  }

  function showSync(text) {
    let pill = document.getElementById('syncPill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'syncPill';
      pill.className = 'sync-pill';
      document.body.appendChild(pill);
    }
    pill.textContent = text;
    pill.classList.add('show');
    setTimeout(() => pill.classList.remove('show'), 1400);
  }

  async function loadCloudData() {
    if (!user) return;

    const { data: row, error } = await sb
      .from('finance_data')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('EP Finance: erro ao carregar dados da nuvem.', error);
      showMsg('Login realizado, mas não foi possível carregar seus dados.', 'error');
      return;
    }

    const localRaw = getLocalRaw();

    // Se a nuvem realmente tem dados, ela vira a fonte principal.
    // Não recarrega se o navegador já possui exatamente o mesmo conteúdo.
    if (hasCloudData(row?.data)) {
      const cloudRaw = JSON.stringify(row.data);
      lastSynced = cloudRaw;

      if (localStorage.getItem(LOCAL_KEY) !== cloudRaw) {
        localStorage.setItem(LOCAL_KEY, cloudRaw);
        LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
        location.reload();
      }
      return;
    }

    // Conta nova: o trigger cria finance_data com {}.
    // Se existirem dados locais antigos, manda-os para a nuvem em vez de apagá-los.
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        const { error: upsertError } = await sb
          .from('finance_data')
          .upsert(
            { user_id: user.id, data: parsed, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );

        if (upsertError) throw upsertError;

        localStorage.setItem(LOCAL_KEY, JSON.stringify(parsed));
        LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
        lastSynced = JSON.stringify(parsed);
      } catch (err) {
        console.error('EP Finance: erro ao enviar dados locais para a nuvem.', err);
      }
    }
  }

  async function syncNow() {
    if (!user) return;

    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw || raw === lastSynced) return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const { error } = await sb
      .from('finance_data')
      .upsert(
        { user_id: user.id, data: parsed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('EP Finance: erro na sincronização.', error);
      return;
    }

    lastSynced = raw;
    showSync('Sincronizado ✓');
  }

  async function ensureProfile() {
    if (!user) return;

    // O trigger normalmente já cria este registro. O upsert torna o app
    // resiliente caso o usuário tenha sido criado antes do trigger existir.
    const { error } = await sb.from('profiles').upsert(
      {
        id: user.id,
        email: user.email || '',
      },
      { onConflict: 'id' }
    );

    if (error) console.error('EP Finance: não foi possível garantir o perfil.', error);
  }

  async function activate(session, initial = false) {
    user = session?.user || null;

    if (!user) {
      clearInterval(syncTimer);
      syncTimer = null;
      gate?.classList.remove('hidden');
      return;
    }

    gate?.classList.add('hidden');

    setTimeout(() => {
      if (window.ensureEpPushRegistration) {
        window.ensureEpPushRegistration();
      }
    }, 700);

    const accountEmail = document.getElementById('accountEmail');
    if (accountEmail) accountEmail.textContent = user.email || '';

    await ensureProfile();

    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('monthly_report_enabled')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) console.error('EP Finance: erro ao carregar perfil.', profileError);

    const checkbox = document.getElementById('monthlyReportEnabled');
    if (checkbox) checkbox.checked = profile?.monthly_report_enabled !== false;

    if (initial) await loadCloudData();

    clearInterval(syncTimer);
    syncTimer = setInterval(syncNow, 2000);
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMsg('');

    const emailValue = email?.value.trim() || '';
    const passwordValue = password?.value || '';

    if (!emailValue) {
      showMsg('Digite seu e-mail.', 'error');
      return;
    }
    if (passwordValue.length < 6) {
      showMsg('A senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }

    submit.disabled = true;

    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email: emailValue,
          password: passwordValue,
          options: {
            emailRedirectTo: `${location.origin}${location.pathname}`,
          },
        });

        if (error) throw error;

        if (data.session) {
          await activate(data.session, true);
          showMsg('Conta criada com sucesso.', 'success');
        } else {
          showMsg('Conta criada. Confira seu e-mail para confirmar o cadastro.', 'success');
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({
          email: emailValue,
          password: passwordValue,
        });

        if (error) throw error;
        await activate(data.session, true);
      }
    } catch (err) {
      console.error('EP Finance Auth:', err);
      showMsg(err?.message || 'Não foi possível concluir a operação.', 'error');
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById('forgotPassword')?.addEventListener('click', async () => {
    const value = email?.value.trim() || '';
    if (!value) {
      showMsg('Digite seu e-mail primeiro.', 'error');
      return;
    }

    const { error } = await sb.auth.resetPasswordForEmail(value, {
      redirectTo: `${location.origin}${location.pathname}`,
    });

    showMsg(
      error ? error.message : 'Enviamos as instruções de recuperação para seu e-mail.',
      error ? 'error' : 'success'
    );
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await syncNow();
    await sb.auth.signOut();
    localStorage.removeItem(LOCAL_KEY);
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
    location.reload();
  });

  document.getElementById('saveEmailPreferences')?.addEventListener('click', async () => {
    if (!user) return;

    const enabled = Boolean(document.getElementById('monthlyReportEnabled')?.checked);
    const { error } = await sb
      .from('profiles')
      .update({ monthly_report_enabled: enabled })
      .eq('id', user.id);

    alert(error ? 'Não foi possível salvar.' : 'Preferência de relatório salva.');
  });

  sb.auth.onAuthStateChange((event, session) => {
    // O bootstrap inicial é feito por getSession abaixo.
    if (event === 'INITIAL_SESSION') return;
    activate(session, false);
  });

  sb.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('EP Finance: erro ao recuperar sessão.', error);
      gate?.classList.remove('hidden');
      return;
    }
    activate(data.session, true);
  });
})();
