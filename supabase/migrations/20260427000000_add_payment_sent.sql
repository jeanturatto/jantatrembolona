-- Adicionar campo payment_sent para controlar se cobrança já foi enviada
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_sent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN events.payment_sent IS 'Indica se a cobrança desta janta já foi enviada/marcada como enviada';