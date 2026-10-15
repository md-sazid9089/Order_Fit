"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  ArrowLeft,
  KeyRound,
  Building2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Filter,
  Mail,
  Lock,
  UserPlus,
  RefreshCw,
  X,
  Check
} from "lucide-react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "risk_officer" | "commercial_lead" | "auditor";
  roleLabel: string;
  tier: "T4" | "T3" | "T2" | "T0";
  tenant: string;
  mfaEnforced: boolean;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  lastActive: string;
}

const INITIAL_USERS: UserRecord[] = [
  {
    id: "usr_01",
    name: "Tariq Rahman",
    email: "tariq.rahman@apexmfg.com",
    role: "superadmin",
    roleLabel: "Platform Superadmin",
    tier: "T4",
    tenant: "Apex Manufacturing",
    mfaEnforced: true,
    status: "ACTIVE",
    lastActive: "Just now",
  },
  {
    id: "usr_02",
    name: "Marcus Vance",
    email: "m.vance@apexretailers.com",
    role: "commercial_lead",
    roleLabel: "Commercial Deal Lead",
    tier: "T2",
    tenant: "Apex Retailers Inc",
    mfaEnforced: true,
    status: "ACTIVE",
    lastActive: "14 mins ago",
  },
  {
    id: "usr_03",
    name: "Elena Rostova",
    email: "elena.rostova@orderfit.internal",
    role: "risk_officer",
    roleLabel: "Senior Risk Officer",
    tier: "T3",
    tenant: "OrderFit Platform",
    mfaEnforced: true,
    status: "ACTIVE",
    lastActive: "1 hour ago",
  },
  {
    id: "usr_04",
    name: "David Chen",
    email: "d.chen@chittagongcorp.bd",
    role: "commercial_lead",
    roleLabel: "Commercial Deal Lead",
    tier: "T2",
    tenant: "Chittagong Industrial Corp",
    mfaEnforced: true,
    status: "ACTIVE",
    lastActive: "3 hours ago",
  },
  {
    id: "usr_05",
    name: "Sarah Lindqvist",
    email: "sarah.l@summitlogistics.eu",
    role: "auditor",
    roleLabel: "Independent Compliance Auditor",
    tier: "T0",
    tenant: "Summit Logistics LLC",
    mfaEnforced: true,
    status: "ACTIVE",
    lastActive: "Yesterday",
  },
  {
    id: "usr_06",
    name: "Klaus Schmidt",
    email: "klaus.s@deltaglobal.de",
    role: "commercial_lead",
    roleLabel: "Commercial Deal Lead",
    tier: "T2",
    tenant: "Delta Global Exports",
    mfaEnforced: false,
    status: "SUSPENDED",
    lastActive: "5 days ago",
  },
  {
    id: "usr_07",
    name: "Amina Al-Mansoor",
    email: "amina.m@gulfmaterials.ae",
    role: "risk_officer",
    roleLabel: "Risk & Credit Analyst",
    tier: "T3",
    tenant: "Apex Manufacturing",
    mfaEnforced: true,
    status: "ACTIVE",
    lastActive: "2 days ago",
  },
];

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRecord["role"]>("commercial_lead");
  const [newUserTenant, setNewUserTenant] = useState("Apex Manufacturing");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.tenant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesTenant = tenantFilter === "ALL" || u.tenant === tenantFilter;
    return matchesSearch && matchesRole && matchesTenant;
  });

  const handleToggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
          showToast(`User ${u.name} status updated to ${nextStatus}.`);
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const roleMap: Record<UserRecord["role"], { label: string; tier: UserRecord["tier"] }> = {
      superadmin: { label: "Platform Superadmin", tier: "T4" },
      risk_officer: { label: "Senior Risk Officer", tier: "T3" },
      commercial_lead: { label: "Commercial Deal Lead", tier: "T2" },
      auditor: { label: "Compliance Auditor", tier: "T0" },
    };

    const newUser: UserRecord = {
      id: `usr_${Date.now().toString().slice(-4)}`,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      roleLabel: roleMap[newUserRole].label,
      tier: roleMap[newUserRole].tier,
      tenant: newUserTenant,
      mfaEnforced: true,
      status: "INVITED",
      lastActive: "Never",
    };

    setUsers((prev) => [newUser, ...prev]);
    setIsInviteModalOpen(false);
    setNewUserName("");
    setNewUserEmail("");
    showToast(`Invitation dispatched to ${newUser.email} with ${newUser.roleLabel} privileges.`);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/admin" className="text-xs text-[#737373] hover:text-[#1E2021] transition-colors">
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021]">Identity & Users</span>
                </div>
                <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">
                  User Management & Role Permissions
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              >
                <UserPlus className="size-3.5" />
                <span>Invite User</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-[#1E2021] text-white text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-white" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Metric KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Total Tracked Users
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                {users.length}
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Across 4 tenant namespaces
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Superadmins (T4)
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                {users.filter((u) => u.tier === "T4").length}
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Hardware token required
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                Risk Officers (T3)
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                {users.filter((u) => u.tier === "T3").length}
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Step-up authorization gate
              </div>
            </div>

            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                MFA Enforced Rate
              </div>
              <div className="text-2xl font-bold font-display text-[#1E2021] mt-1">
                {Math.round((users.filter((u) => u.mfaEnforced).length / users.length) * 100)}%
              </div>
              <div className="text-[11px] text-[#525252] mt-0.5">
                Strict zero-trust posture
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#737373]" />
              <input
                type="text"
                placeholder="Search user name, email, tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF9F7] border border-[#E8E6E1] rounded-xl text-xs text-[#1E2021] placeholder-[#737373] focus:outline-none focus:bg-white focus:border-[#1E2021] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-[#737373]">
                <Filter className="size-3.5" />
                <span>Role:</span>
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
              >
                <option value="ALL">All Roles</option>
                <option value="superadmin">Superadmin (T4)</option>
                <option value="risk_officer">Risk Officer (T3)</option>
                <option value="commercial_lead">Commercial Lead (T2)</option>
                <option value="auditor">Compliance Auditor (T0)</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-[#737373] ml-2">
                <Building2 className="size-3.5" />
                <span>Tenant:</span>
              </div>
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:outline-none focus:border-[#1E2021]"
              >
                <option value="ALL">All Tenants</option>
                <option value="Apex Manufacturing">Apex Manufacturing</option>
                <option value="Apex Retailers Inc">Apex Retailers Inc</option>
                <option value="Chittagong Industrial Corp">Chittagong Industrial</option>
                <option value="Summit Logistics LLC">Summit Logistics</option>
                <option value="Delta Global Exports">Delta Global</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAF9F7] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    <th className="py-3.5 px-5 min-w-[220px]">User & Identity</th>
                    <th className="py-3.5 px-4 min-w-[170px]">Role & Access Tier</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Tenant Namespace</th>
                    <th className="py-3.5 px-4 min-w-[120px]">Security (MFA)</th>
                    <th className="py-3.5 px-4 min-w-[130px]">Status</th>
                    <th className="py-3.5 px-4 min-w-[120px]">Last Active</th>
                    <th className="py-3.5 px-5 text-right min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA] text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#737373]">
                        No users match the selected query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#FAF9F7] transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-[#1E2021] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {user.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#1E2021] truncate">{user.name}</div>
                              <div className="text-[11px] text-[#737373] truncate">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#1E2021]">{user.roleLabel}</span>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FAF9F7] border border-[#E8E6E1] text-[#525252]">
                              {user.tier}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[#525252] font-medium">
                          {user.tenant}
                        </td>

                        <td className="py-3.5 px-4">
                          {user.mfaEnforced ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E2021]">
                              <ShieldCheck className="size-3.5 text-[#1E2021]" />
                              <span>Enforced</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309]">
                              <ShieldAlert className="size-3.5 text-[#B45309]" />
                              <span>Unset</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              user.status === "ACTIVE"
                                ? "bg-[#FAF9F7] text-[#1E2021] border-[#E8E6E1]"
                                : user.status === "INVITED"
                                ? "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                                : "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-[#737373] font-mono text-[11px]">
                          {user.lastActive}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user.id)}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                              user.status === "ACTIVE"
                                ? "bg-[#FAF9F7] hover:bg-[#F4F2ED] text-[#525252] hover:text-[#991B1B] border-[#E8E6E1]"
                                : "bg-[#1E2021] text-white border-[#1E2021] hover:bg-black"
                            }`}
                          >
                            {user.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </button>
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
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E1]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#FAF9F7] border border-[#E8E6E1] text-[#1E2021]">
                  <UserPlus className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-[#1E2021]">Invite Platform User</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#FAF9F7] text-[#737373]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jessica Taylor"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="jessica.t@company.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                  Assigned Permission Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRecord["role"])}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                >
                  <option value="commercial_lead">Commercial Deal Lead [Tier 2 Formulation]</option>
                  <option value="risk_officer">Senior Risk Officer [Tier 3 Step-Up Auth]</option>
                  <option value="auditor">Compliance Auditor [Tier 0 Read-Only]</option>
                  <option value="superadmin">Platform Superadmin [Tier 4 Full Cluster]</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-1">
                  Tenant Organization
                </label>
                <select
                  value={newUserTenant}
                  onChange={(e) => setNewUserTenant(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-medium text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                >
                  <option value="Apex Manufacturing">Apex Manufacturing</option>
                  <option value="Apex Retailers Inc">Apex Retailers Inc</option>
                  <option value="Chittagong Industrial Corp">Chittagong Industrial Corp</option>
                  <option value="Summit Logistics LLC">Summit Logistics LLC</option>
                  <option value="Delta Global Exports">Delta Global Exports</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] text-[11px] text-[#525252]">
                <span className="font-semibold text-[#1E2021]">Zero-Trust Enrollment:</span> An activation link and hardware/TOTP enrollment secret will be sent to the provided address.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] text-xs font-semibold text-[#525252] hover:bg-[#FAF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1E2021] hover:bg-black text-white text-xs font-semibold shadow-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
