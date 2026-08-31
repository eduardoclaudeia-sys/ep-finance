# Agendamento mensal

No Supabase Dashboard, abra **Integrations > Cron** e crie um job mensal para chamar a Edge Function `monthly-report`.

Sugestão: `0 11 1 * *` (dia 1 de cada mês, 11:00 UTC = 08:00 em Brasília, fora do horário de verão).

Faça uma requisição HTTP POST para a URL da função e adicione o header `x-cron-secret` com o mesmo valor configurado no secret `CRON_SECRET`.

Secrets necessários na Edge Function:
- `RESEND_API_KEY`
- `FROM_EMAIL` (ex.: `EP Finance <relatorios@seudominio.com>`)
- `CRON_SECRET`

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados/configurados no ambiente do projeto conforme o deploy.
