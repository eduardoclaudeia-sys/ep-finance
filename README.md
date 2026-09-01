# EP Finance V1

PWA de controle financeiro pessoal.

## Como publicar grátis
1. Descompacte o ZIP.
2. Arraste a pasta para um serviço de hospedagem estática como Netlify Drop ou publique no GitHub Pages.
3. Abra a URL no Safari do iPhone.
4. Toque em Compartilhar > Adicionar à Tela de Início.

## Recursos da V1
- Receitas e despesas
- Contas e vencimentos
- Metas
- Orçamento mensal
- Saldo disponível
- Tema claro/escuro
- Backup e restauração em JSON
- Funcionamento offline após o primeiro carregamento
- Dados salvos no navegador do aparelho

## Novidades V1.1
- Área de investimentos
- Carteira por tipo de ativo
- Total aportado e valor atual
- Resultado em R$ e %
- Atualização manual do valor do ativo
- Patrimônio investido separado do caixa do dia a dia

## EP Finance V1.2
- Correção do fechamento dos modais no Safari/iPhone
- Fechar por X, Cancelar, toque fora e gesto/tecla de cancelamento
- Painel inicial reformulado com caixa, investimentos e patrimônio total
- Resumo mensal e gastos por categoria
- Extrato interativo com busca, mês, categoria, tipo, ordenação e visual agrupado
- Edição e exclusão de movimentações
- Forma de pagamento e observação nos lançamentos
- Migração automática dos dados da V1/V1.1
- Service Worker atualizado para reduzir cache de versão antiga


## V1.3 — Login, nuvem e relatório mensal
- Cadastro e login com e-mail/senha via Supabase Auth
- Confirmação de e-mail e recuperação de senha
- Sincronização automática dos dados financeiros com Supabase
- Dados isolados por usuário com Row Level Security (RLS)
- Preferência para receber relatório mensal por e-mail
- Edge Function pronta para gerar resumo mensal
- Envio via Resend
- Logout remove o cache financeiro local do aparelho

### Configuração
1. Crie um projeto no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Copie URL e chave pública/publishable para `config.js`. Nunca coloque `service_role` no frontend.
4. Em Auth, configure a URL do seu site Render em Site URL/Redirect URLs.
5. Crie uma conta Resend, verifique seu domínio (para produção) e configure `RESEND_API_KEY`, `FROM_EMAIL` e `CRON_SECRET` nos secrets da Edge Function.
6. Faça deploy da função `monthly-report`.
7. Configure o job mensal conforme `supabase/CRON_SETUP.md`.


## V1.3.2 - correções de autenticação e sincronização
- Corrigida a aba Criar conta que podia ficar sem ação quando a configuração falhava.
- auth.js aceita SUPABASE_PUBLISHABLE_KEY e SUPABASE_ANON_KEY.
- Corrigida a chave local de sincronização para epFinanceV12 (mesma usada pelo app.js).
- Corrigido possível loop de reload quando finance_data existe vazio (`{}`).
- Migração automática do armazenamento legado epFinanceV1.
- Cache do PWA atualizado para buscar JS/HTML novos primeiro.
- Query string v=1.3.2 nos arquivos principais para reduzir cache antigo no Render/iPhone.


## V1.4 — Saldo por data

Correções e melhorias:
- Saldo atual considera somente receitas/despesas com data até hoje.
- Movimentações futuras ficam como "Agendadas" e não afetam o saldo atual.
- Receitas futuras, despesas futuras e saldo projetado aparecem separadamente no painel.
- Patrimônio atual usa saldo realizado + valor atual dos investimentos.
- Resumo mensal e orçamento usam apenas movimentações já realizadas.
- Extrato ganhou filtro por status: Realizados / Agendados.
- Agenda financeira mostra os próximos lançamentos futuros.
- Contas não descontam o saldo automaticamente.
- Botão "Pagar hoje" registra a despesa na data atual e marca a conta como paga.
- Reabrir conta desfaz a movimentação criada automaticamente por "Pagar hoje".
- Data de hoje agora usa o fuso local do aparelho, evitando erro de virada de dia causado por UTC.


## V1.4.1 — Edição completa
- Editar qualquer receita ou despesa pelo extrato.
- Editar lançamentos futuros/agendados.
- Atalho Editar também no painel inicial e na agenda financeira.
- Editar contas: descrição, valor, vencimento, categoria e status.
- Alterações em conta paga sincronizam com a movimentação criada pelo pagamento.
- Ao mudar uma conta paga para pendente, a movimentação automática vinculada é removida.
- Movimentações vinculadas a contas preservam o vínculo ao serem editadas.


## V1.5 — Dashboard mensal e Contas nos compromissos futuros
- Dashboard ganhou seletor de competência (mês/ano) com botões anterior/próximo.
- Resumo, orçamento e categorias passam a exibir explicitamente o mês selecionado.
- Contas pendentes com vencimento futuro entram em Compromissos futuros do Dashboard.
- Compromissos futuros = despesas agendadas no Extrato + Contas pendentes do mês, sem descontar o saldo atual.
- Agenda financeira do Dashboard combina lançamentos agendados e contas pendentes.
- Saldo projetado calcula o saldo atual menos/mais compromissos e receitas até o fim do mês selecionado.
- A aba Contas continua sendo controle de obrigações; ao pagar, a despesa é registrada no Extrato.


## V1.6 — Central de Notificações
- Botão para solicitar permissão de notificações.
- Botão de notificação de teste.
- Preferências para vencimentos, orçamento, resumo semanal e aportes.
- Service Worker recebe Web Push e abre o app ao tocar na notificação.
- Tabelas Supabase para subscriptions e preferências.
- Edge Function preparada para alertas automáticos de contas e orçamento.
- Estrutura VAPID pronta para notificações com o app fechado.

### Importante
Notificações de teste funcionam após a permissão do navegador.
Notificações automáticas com o app fechado exigem configurar VAPID e publicar a Edge Function.


## V1.6.1 — Correção do registro Web Push
- Corrigido o caso em que o iPhone já tinha permissão, mas não aparecia em push_subscriptions.
- Registro automático ao abrir o app.
- Nova tentativa ao voltar para o app.
- Nova tentativa após autenticação.
- Botão para sincronizar manualmente o dispositivo.
- Subscription existente é reutilizada e salva no Supabase.
- Cache atualizado para v1.6.1.


## V1.6.2 — Diagnóstico Web Push
- Exibe no próprio iPhone a causa exata de falha no registro.
- Diagnostica Service Worker, PushManager, VAPID, autenticação e RLS/Supabase.
- `ensurePushRegistration()` só retorna sucesso quando o registro foi realmente salvo no banco.
- Cache atualizado para v1.6.2.
