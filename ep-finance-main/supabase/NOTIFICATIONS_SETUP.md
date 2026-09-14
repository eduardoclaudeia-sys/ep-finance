# Configuração das notificações automáticas

1. Execute `supabase/notifications.sql` no SQL Editor.
2. Gere um par VAPID (public/private).
3. Coloque a chave pública VAPID em `config.js` -> `VAPID_PUBLIC_KEY`.
4. Configure os Secrets da Edge Function:
   - VAPID_PUBLIC_KEY
   - VAPID_PRIVATE_KEY
   - VAPID_SUBJECT (ex.: mailto:seuemail@dominio.com)
5. Deploy da função `send-finance-notifications`.
6. Agende a função para rodar diariamente (ex.: 09:00 horário de Brasília) via Supabase Cron.
7. No iPhone, instale o PWA na Tela de Início e use Ajustes -> Notificações -> Ativar.
