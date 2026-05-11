-- Garante que a coluna scope existe (adição segura caso a tabela já exista sem ela)
ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS scope TEXT;

ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
