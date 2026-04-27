-- Adicionar coluna payment_value se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'payment_value'
  ) THEN
    ALTER TABLE events ADD COLUMN payment_value NUMERIC(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'payment_sent'
  ) THEN
    ALTER TABLE events ADD COLUMN payment_sent BOOLEAN DEFAULT FALSE;
  END IF;
END $$;