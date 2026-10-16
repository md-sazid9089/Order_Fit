-- Global process capacity evidence, never tenant/business authority.
CREATE TABLE worker_presence (
 id uuid PRIMARY KEY,
 login name NOT NULL,
 heartbeat_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL
);
ALTER TABLE worker_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_presence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON worker_presence FROM PUBLIC, orderfit_app, orderfit_worker;
DO $$ BEGIN
 EXECUTE format('CREATE POLICY presence_owner ON worker_presence TO %I USING(true) WITH CHECK(true)',current_user);
END $$;
CREATE INDEX worker_presence_expiry ON worker_presence(expires_at);

CREATE FUNCTION worker_presence_publish(p_id uuid, p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT pg_has_role(session_user,'orderfit_worker','USAGE') THEN
  RAISE EXCEPTION 'worker authority required' USING ERRCODE='42501';
 END IF;
 IF p_active THEN
  INSERT INTO public.worker_presence(id,login,heartbeat_at,expires_at)
   VALUES(p_id,session_user,clock_timestamp(),clock_timestamp()+interval '60 seconds')
   ON CONFLICT(id) DO UPDATE SET heartbeat_at=clock_timestamp(),expires_at=clock_timestamp()+interval '60 seconds'
    WHERE worker_presence.login=session_user;
  DELETE FROM public.worker_presence WHERE expires_at<clock_timestamp()-interval '1 day';
 ELSE
  DELETE FROM public.worker_presence WHERE id=p_id AND login=session_user;
 END IF;
END $$;
REVOKE ALL ON FUNCTION worker_presence_publish(uuid,boolean) FROM PUBLIC,orderfit_app;
GRANT EXECUTE ON FUNCTION worker_presence_publish(uuid,boolean) TO orderfit_worker;

CREATE FUNCTION worker_capacity_live() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.worker_presence WHERE expires_at>clock_timestamp())
$$;
REVOKE ALL ON FUNCTION worker_capacity_live() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worker_capacity_live() TO orderfit_app;
