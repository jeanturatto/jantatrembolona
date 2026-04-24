-- Adiciona coluna guests_count para convidados externos
-- Convidados não entram nas estatísticas de presença, apenas na cobrança
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS guests_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN events.guests_count IS
  'Número de convidados externos adicionados pelos responsáveis. Não entra nas estatísticas, apenas na cobrança.';
