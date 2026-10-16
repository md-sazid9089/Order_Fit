-- The flag is writable only by the administrative provisioning role. Its change
-- must never lend existing (possibly stolen) sessions newly elevated authority.
-- Invoker rights deliberately require the provisioner to own auth-session writes;
-- this adds no global runtime grant or RLS bypass.
CREATE FUNCTION platform_authority_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
  UPDATE public.auth_session
     SET revoked_at=coalesce(revoked_at,clock_timestamp()),version=version+1
   WHERE user_id=NEW.id AND revoked_at IS NULL;
  INSERT INTO public.security_event(user_id,code)
   VALUES(NEW.id,CASE WHEN NEW.is_platform_admin THEN 'ADMIN_PROMOTED' ELSE 'ADMIN_DEMOTED' END);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION platform_authority_changed() FROM PUBLIC;
CREATE TRIGGER platform_authority_changed AFTER UPDATE OF is_platform_admin ON app_user
FOR EACH ROW EXECUTE FUNCTION platform_authority_changed();
