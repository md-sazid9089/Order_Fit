/** The retained backend exposes business roles only, with no platform-admin API.
 * Keep the incoming admin views unavailable until a separately integrated server
 * contract supplies and enforces that authority. An owner is not a platform admin.
 */
export function platformAdminEnabled(): boolean {
  return false;
}
