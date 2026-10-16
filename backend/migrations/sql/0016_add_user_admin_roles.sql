-- Forward migration: add user and admin roles to reference table app_role.
INSERT INTO app_role (code, tier, description) VALUES
  ('user',  'T0', 'Standard user'),
  ('admin', 'T4', 'Administrator')
ON CONFLICT (code) DO NOTHING;
