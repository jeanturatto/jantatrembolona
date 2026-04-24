-- Substitui guests_count (integer) por guests (jsonb array de nomes)
-- Convidados nomeados pelos responsáveis. Não entram nas estatísticas, apenas na cobrança.

ALTER TABLE events
  DROP COLUMN IF EXISTS guests_count;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guests JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.guests IS
  'Array JSON de nomes de convidados externos (ex: ["João", "Maria"]). Não entram nas estatísticas, apenas na cobrança.';
