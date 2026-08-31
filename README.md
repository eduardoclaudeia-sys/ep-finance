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
