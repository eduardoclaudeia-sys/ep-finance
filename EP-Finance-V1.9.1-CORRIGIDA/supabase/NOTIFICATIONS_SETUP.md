# EP Finance V1.9 — alertas automáticos

A Edge Function `send-finance-notifications` entrega o mesmo alerta por Push e, opcionalmente, por e-mail.

## Secrets
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `RESEND_API_KEY` (necessário para alertas por e-mail)
- `FROM_EMAIL` (ex.: `EP Finance <alertas@seudominio.com>`)

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos/configurados no ambiente da função.

## Agendamento
Agende `send-finance-notifications` diariamente. Sugestão: 11:00 UTC (08:00 de Brasília).

## Importante
A preferência `emailAlerts` é salva no JSON de `notification_preferences`, então não é necessária alteração destrutiva no banco.
