"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession, listMembers, changeRole, createInvitation, revokeMember, getBusiness } from "@/lib/p7-api";
import { ROLES, buildInvitation, buildRevocation, buildRoleChange, describeP7Error, invitationLink, roleLabel, type Role } from "@/lib/p7-model";
import type { Member, SessionView } from "@/lib/generated-api";
import {
  Users,
  ArrowLeft,
  Search,
  Plus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Download,
  UserCheck,
  UserX,
  RefreshCw,
  Mail,
  Building2,
  X,
  Lock,
} from "lucide-react";

interface DatabaseUser {
  userId: string;
  fullName: string;
  email: string;
  tenantName: string;
  businessId: string;
  role: string;
  revokedAt: string | null;
  version: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [users, setUsers] = useState<DatabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("All Tenants");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  // Provision Modal State
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newTenantId, setNewTenantId] = useState<string>("");
  const [newRole, setNewRole] = useState<Role>("commercial_lead");
  const [provisionBusy, setProvisionBusy] = useState(false);

  // Edit Role Modal State
  const [editingUser, setEditingUser] = useState<DatabaseUser | null>(null);
  const [editRole, setEditRole] = useState<Role>("commercial_lead");
  const [editBusy, setEditBusy] = useState(false);

  // Revoke Modal State
  const [revokingUser, setRevokingUser] = useState<DatabaseUser | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeBusy, setRevokeBusy] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDatabaseUsers = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await getSession();
      setSession(sess);

      const admin = Boolean(sess.is_platform_admin === true);
      if (!admin) {
        router.replace("/deals");
        return;
      }

      const memberships = sess.memberships ?? [];
      if (memberships.length > 0 && !newTenantId) {
        setNewTenantId(memberships[0].business_id);
      }

      const collectedUsers: DatabaseUser[] = [];

      await Promise.all(
        memberships.map(async (m) => {
          try {
            const page = await listMembers(m.business_id);
            for (const item of page.items) {
              collectedUsers.push({
                userId: item.user_id,
                fullName: item.full_name,
                email: item.email,
                tenantName: m.business_name,
                businessId: m.business_id,
                role: item.role,
                revokedAt: item.revoked_at,
                version: item.version,
              });
            }
          } catch {
            // If tenant has no members yet or lacks permission, skip
          }
        })
      );

      // If no members in businesses yet, ensure the admin themselves is shown from session
      if (collectedUsers.length === 0 && sess) {
        collectedUsers.push({
          userId: sess.user_id,
          fullName: sess.profile.full_name || "Platform Admin",
          email: sess.email,
          tenantName: sess.memberships?.[0]?.business_name || "Platform Administration",
          businessId: sess.memberships?.[0]?.business_id || "",
          role: "admin",
          revokedAt: null,
          version: sess.profile_version,
        });
      }

      setUsers(collectedUsers);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router, newTenantId]);

  useEffect(() => {
    const initial = setTimeout(() => { void loadDatabaseUsers(); }, 0);
    return () => clearTimeout(initial);
  }, [loadDatabaseUsers]);

  const tenantsList = useMemo(() => {
    const list = new Set(users.map((u) => u.tenantName));
    return ["All Tenants", ...Array.from(list)];
  }, [users]);

  // Platform administrative and business roles
  const availableRoles = ["All Roles", "admin", "owner", "risk_officer", "commercial_lead", "auditor", "viewer"];

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.userId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTenant = selectedTenant === "All Tenants" || u.tenantName === selectedTenant;
      const matchesRole = selectedRole === "All Roles" || u.role === selectedRole;
      const matchesStatus =
        selectedStatus === "All Statuses" ||
        (selectedStatus === "ACTIVE" && !u.revokedAt) ||
        (selectedStatus === "SUSPENDED" && Boolean(u.revokedAt));
      return matchesSearch && matchesTenant && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, selectedTenant, selectedRole, selectedStatus]);

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditBusy(true);
    try {
      await changeRole(
        editingUser.businessId,
        editingUser.userId,
        buildRoleChange({ version: editingUser.version }, editRole, (await getBusiness(editingUser.businessId)).financial_revision)
      );
      showToast(`Database role updated to ${roleLabel(editRole)} for ${editingUser.fullName}`);
      setEditingUser(null);
      await loadDatabaseUsers();
    } catch (e) {
      showToast(`Role was not changed. ${describeP7Error(e).message}`);
      await loadDatabaseUsers();
    } finally {
      setEditBusy(false);
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingUser || revokeReason.trim().length < 10) return;
    setRevokeBusy(true);
    try {
      await revokeMember(
        revokingUser.businessId,
        revokingUser.userId,
        buildRevocation({ version: revokingUser.version }, revokeReason, (await getBusiness(revokingUser.businessId)).financial_revision)
      );
      showToast(`Access revoked in database for ${revokingUser.fullName}`);
      setRevokingUser(null);
      setRevokeReason("");
      await loadDatabaseUsers();
    } catch (e) {
      showToast(`Access was not revoked. ${describeP7Error(e).message}`);
      await loadDatabaseUsers();
    } finally {
      setRevokeBusy(false);
    }
  };

  const handleProvisionInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newTenantId) return;
    setProvisionBusy(true);
    try {
      const created = await createInvitation(newTenantId, buildInvitation(newEmail, newRole, (await getBusiness(newTenantId)).financial_revision));
      const link = invitationLink(window.location.origin, created.invitation_url);
      showToast(link ? `Invitation created for ${newEmail}. Nothing was emailed; share this one-time link yourself: ${link}` : `Invitation created for ${newEmail}. Nothing was emailed.`);
      setIsProvisionOpen(false);
      setNewEmail("");
      await loadDatabaseUsers();
    } catch (e) {
      showToast(`No invitation was created. ${describeP7Error(e).message}`);
    } finally {
      setProvisionBusy(false);
    }
  };

  const handleExportCsv = () => {
    const headers = "User_ID,Name,Email,Tenant,Role,Status,Version\n";
    const rows = users
      .map(
        (u) =>
          `"${u.userId}","${u.fullName}","${u.email}","${u.tenantName}","${u.role}","${u.revokedAt ? "REVOKED" : "ACTIVE"}",${u.version}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `orderfit-database-users-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${users.length} database user records.`);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white dark:bg-white dark:text-[#181A1B]">Admin</span>;
      case "owner":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white dark:bg-white dark:text-[#181A1B]">Owner</span>;
      case "risk_officer":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] dark:bg-[#8B5CF6]/20 dark:text-[#C4B5FD] dark:border-[#8B5CF6]/30">Risk Officer</span>;
      case "commercial_lead":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] dark:bg-[#059669]/20 dark:text-[#6EE7B7] dark:border-[#059669]/30">Commercial Lead</span>;
      case "auditor":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] dark:bg-[#D97706]/20 dark:text-[#FCD34D] dark:border-[#D97706]/30">Auditor</span>;
      case "viewer":
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] dark:bg-[#26282A] dark:text-[#D1D5DB] dark:border-[#373A3C]">{roleLabel(role)}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] font-sans flex flex-row selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-[#181A1B]/95 backdrop-blur-md border-b border-[#E8E6E1] dark:border-[#2A2C2D] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-[#F3F4F6] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/admin" className="text-xs text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white transition-colors">
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] dark:text-[#737373] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021] dark:text-[#F3F4F6]">User Management</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight">
                  Database User Credentials & Membership Roles
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={users.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-[#F3F4F6] border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5 text-[#525252] dark:text-[#A3A3A3]" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsProvisionOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-[#181A1B] text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Invite User</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{toastMessage}</span>
              </div>
              <button onClick={() => setToastMessage(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/70">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Database Metric Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Database Users
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Users className="size-4 text-[#1E2021]" />
                <span>{users.length} Users</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Across {tenantsList.length - 1 || 1} organizations</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Admin & Privileged Accounts
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#1E2021]" />
                <span>
                  {users.filter((u) => u.role === "admin" || u.role === "owner" || u.role === "risk_officer").length} Privileged
                </span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Admin, Owner & Risk roles</div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Active Memberships
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#059669]" />
                <span>{users.filter((u) => !u.revokedAt).length} Active</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                {users.filter((u) => Boolean(u.revokedAt)).length} revoked
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                PostgreSQL Isolation
              </div>
              <div className="text-xl font-bold font-display text-[#1E2021] mt-1 flex items-center gap-2">
                <Building2 className="size-4 text-[#059669]" />
                <span>RLS Active</span>
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">Row-level security enforced</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#737373]" />
              <input
                type="text"
                placeholder="Search database user by name, email, or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#A3A3A3] focus:outline-none focus:border-[#1E2021] focus:bg-white transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021] cursor-pointer"
              >
                {tenantsList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021] cursor-pointer"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r === "All Roles" ? r : roleLabel(r)}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021] cursor-pointer"
              >
                <option value="All Statuses">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Revoked / Suspended</option>
              </select>

              {(searchQuery || selectedTenant !== "All Tenants" || selectedRole !== "All Roles" || selectedStatus !== "All Statuses") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTenant("All Tenants");
                    setSelectedRole("All Roles");
                    setSelectedStatus("All Statuses");
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#FEF2F2] rounded-xl transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Database Users Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF9F7] border-b border-[#E8E6E1] text-[#737373] font-semibold">
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Tenant Organization</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#737373]">
                        <RefreshCw className="size-4 animate-spin inline-block mr-2" />
                        Loading database user credentials...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#737373]">
                        No user accounts found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={`${user.businessId}-${user.userId}`} className="hover:bg-[#FAF9F7] transition-colors group">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-xs text-[#1E2021]">{user.fullName}</div>
                          <div className="text-[11px] text-[#737373] flex items-center gap-1 mt-0.5 font-mono">
                            <Mail className="size-3 text-[#A3A3A3]" />
                            <span>{user.email}</span>
                          </div>
                          <div className="text-[10px] text-[#A3A3A3] font-mono mt-0.5">{user.userId}</div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-[#1E2021]">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-[#737373] shrink-0" />
                            <span className="truncate max-w-[190px]">{user.tenantName}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {getRoleBadge(user.role)}
                        </td>

                        <td className="py-3.5 px-4">
                          {user.revokedAt ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                              <span className="size-1.5 rounded-full bg-[#DC2626]" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                              <span className="size-1.5 rounded-full bg-[#059669]" />
                              Active
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[#737373]">
                          v{user.version}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!user.revokedAt && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditRole(
                                      ROLES.includes(user.role as Role) ? (user.role as Role) : "commercial_lead"
                                    );
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-[#E8E6E1] hover:border-[#1E2021] bg-white text-[#1E2021] font-semibold text-[11px] transition-colors cursor-pointer"
                                >
                                  Edit Role
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setRevokingUser(user)}
                                  className="p-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                                  title="Revoke member access"
                                >
                                  <UserX className="size-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Invite User Modal */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#E8E6E1] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1E2021] font-display">Invite User to Organization</h3>
                <p className="text-xs text-[#737373] mt-0.5">Creates an invitation record. Nothing is emailed; you share the one-time link.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionOpen(false)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#1E2021] hover:bg-[#FAF9F7]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleProvisionInvitation} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1E2021] mb-1">Business Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. member@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] focus:outline-none focus:border-[#1E2021] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">Target Organization</label>
                  <select
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021]"
                  >
                    {session?.memberships?.map((m) => (
                      <option key={m.business_id} value={m.business_id}>
                        {m.business_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1E2021] mb-1">Assigned Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8E6E1] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] hover:bg-[#FAF9F7] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionBusy}
                  className="px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {provisionBusy ? "Inviting..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#E8E6E1] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1E2021] font-display">Update Security Role</h3>
                <p className="text-xs text-[#737373] mt-0.5">{editingUser.fullName} ({editingUser.email})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#1E2021] hover:bg-[#FAF9F7]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1E2021] mb-1">Select Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] font-medium focus:outline-none focus:border-[#1E2021]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-[11px] text-[#737373] leading-relaxed">
                Role change is recorded immutably in the PostgreSQL audit log and updates tenant privilege boundaries immediately.
              </div>

              <div className="pt-4 border-t border-[#E8E6E1] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] hover:bg-[#FAF9F7] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {editBusy ? "Saving..." : "Apply Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Access Modal */}
      {revokingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#E8E6E1] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#991B1B] font-display">Revoke Access</h3>
                <p className="text-xs text-[#737373] mt-0.5">{revokingUser.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRevokingUser(null)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#1E2021] hover:bg-[#FAF9F7]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRevoke} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1E2021] mb-1">
                  Revocation Reason (at least 10 characters)
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  placeholder="Explain reason for access revocation (recorded in audit log)..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] focus:outline-none focus:border-[#991B1B]"
                />
              </div>

              <div className="pt-4 border-t border-[#E8E6E1] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRevokingUser(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] hover:bg-[#FAF9F7] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revokeBusy || revokeReason.trim().length < 10}
                  className="px-4 py-2 rounded-xl bg-[#991B1B] hover:bg-[#7F1D1D] text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {revokeBusy ? "Revoking..." : "Revoke Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
