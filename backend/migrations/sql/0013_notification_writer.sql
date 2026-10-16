-- Notification writer repair (forward revision after 0011_p7_operations).
--
-- Finding: 0003 granted INSERT, UPDATE ON ALL TABLES to orderfit_app and 0012 (P7) added the
-- PUBLIC policy notification_tenant_insert (business_id = app.business_id, user_id NOT NULL).
-- Together they let any member insert arbitrary notifications for any other member of the
-- business through the restricted runtime login. The only intended writer is the
-- SECURITY DEFINER p7_notify(), called by p7_event_notification() triggers and owned by the
-- migration role.
--
-- * The runtime role loses INSERT; UPDATE stays limited to the read flag (read_at), which
--   the own-row UPDATE policy and the first-read-wins trigger already constrain.
-- * The permissive PUBLIC insert policy is replaced by one that applies only to the owning
--   role, so p7_notify() keeps working under FORCE ROW LEVEL SECURITY when the owner is not
--   a superuser. Its predicate is unchanged.
-- * The recipient foreign key (user_id, business_id) -> membership already exists since
--   0001, so no new constraint is needed.
REVOKE INSERT, UPDATE ON notification FROM orderfit_app;
GRANT UPDATE (read_at) ON notification TO orderfit_app;
DROP POLICY notification_tenant_insert ON notification;
DO $$ BEGIN
 EXECUTE format('CREATE POLICY notification_definer_insert ON notification FOR INSERT TO %I'
  ' WITH CHECK(business_id=(SELECT app_business_id()) AND user_id IS NOT NULL)', current_user);
END $$;
