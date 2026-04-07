-- Atualiza o trigger de criação de usuário para incluir telefone, pix e data_nascimento
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, telefone, pix, data_nascimento)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'USER',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'pix',
    CASE
      WHEN new.raw_user_meta_data->>'data_nascimento' IS NOT NULL
       AND new.raw_user_meta_data->>'data_nascimento' != ''
      THEN (new.raw_user_meta_data->>'data_nascimento')::DATE
      ELSE NULL
    END
  );
  RETURN new;
END;
$$;
