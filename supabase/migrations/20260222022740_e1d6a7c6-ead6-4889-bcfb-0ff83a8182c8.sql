
SELECT cron.schedule(
  'delete-old-logs',
  '0 3 * * *',
  $$DELETE FROM public.logs WHERE created_at < NOW() - INTERVAL '60 days'$$
);
