"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getSession,
  listMembers,
  changeRole,
  createInvitation,
  revokeMember,
  getBusiness,
} from "@/lib/p7-api";
import {
  buildInvitation,
  buildRevocation,
  buildRoleChange,
  describeP7Error,
  invitationLink,
  roleLabel,
  type Role,
} from "@/lib/p7-model";
import {
  exportToCsv,
  loadAggregatedUsers,
  type AdminDatabaseUser,
} from "@/lib/admin-api";
import type { SessionView } from "@/lib/generated-api";
import {
  Users,
  ArrowLeft,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Download,
  UserX,
  RefreshCw,
  Mail,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Shield,
} from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [users, setUsers] = useState<AdminDatabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("All Tenants");
  const [selectedRole, setSelectedRole] = useState("All Roles");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail Modal State
  const [detailUser, setDetailUser] = useState<AdminDatabaseUser | null>(null);

  // Provision Modal State
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTenantId, setNewTenantId] = useState<string>("");
  const [newRole, setNewRole] = useState<Role>("commercial_lead");
  const [provisionBusy, setProvisionBusy] = useState(false);
  const [invitationResultLink, setInvitationResultLink] = useState<string | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  // Edit Role Modal State
  const [editingUser, setEditingUser] = useState<AdminDatabaseUser | null>(null);
  const [editRole, setEditRole] = useState<Role>("commercial_lead");
  const [editBusy, setEditBusy] = useState(false);

  // Revoke Modal State
  const [revokingUser, setRevokingUser] = useState<AdminDatabaseUser | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeBusy, setRevokeBusy] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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

      const aggregation = await loadAggregatedUsers(sess);
      setUsers(aggregation.users);
    } catch {
      router.replace("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router, newTenantId]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void loadDatabaseUsers();
    }, 0);
    return () => clearTimeout(initial);
  }, [loadDatabaseUsers]);

  const tenantsList = useMemo(() => {
    const list = new Set(users.map((u) => u.tenantName));
    return ["All Tenants", ...Array.from(list)];
  }, [users]);

  const availableRoles = [
    "All Roles",
    "admin",
    "owner",
    "risk_officer",
    "commercial_lead",
    "auditor",
    "viewer",
  ];

  // Search & Filter combined
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.tenantName.toLowerCase().includes(q);

      const matchesTenant = selectedTenant === "All Tenants" || u.tenantName === selectedTenant;
      const matchesRole =
        selectedRole === "All Roles" ||
        (selectedRole === "admin" && (u.isPlatformAdmin || u.role === "admin")) ||
        u.role === selectedRole;

      const matchesStatus =
        selectedStatus === "All Statuses" ||
        (selectedStatus === "ACTIVE" && !u.revokedAt) ||
        (selectedStatus === "REVOKED" && Boolean(u.revokedAt)) ||
        (selectedStatus === "SUSPENDED" && Boolean(u.revokedAt));

      return matchesSearch && matchesTenant && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, selectedTenant, selectedRole, selectedStatus]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTenant, selectedRole, selectedStatus, pageSize]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Edit Role Handler
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Guard: Prevent an admin from removing their own last admin privilege
    if (
      session &&
      editingUser.userId === session.user_id &&
      editRole !== "owner" &&
      (editRole as string) !== "admin"
    ) {
      const otherAdmins = users.filter(
        (u) => u.userId !== session.user_id && (u.role === "owner" || u.isPlatformAdmin)
      );
      if (otherAdmins.length === 0) {
        showToast("Cannot demote the last remaining platform administrator or owner.");
        return;
      }
    }

    setEditBusy(true);
    try {
      const biz = await getBusiness(editingUser.businessId);
      await changeRole(
        editingUser.businessId,
        editingUser.userId,
        buildRoleChange({ version: editingUser.version }, editRole, biz.financial_revision)
      );
      showToast(`Database role updated to ${roleLabel(editRole)} for ${editingUser.fullName}`);
      setEditingUser(null);
      await loadDatabaseUsers();
    } catch (err) {
      showToast(`Role was not changed. ${describeP7Error(err).message}`);
    } finally {
      setEditBusy(false);
    }
  };

  // Revoke Access Handler
  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingUser || revokeReason.trim().length < 10) return;

    // Guard: Prevent self-revocation if the administrator would lock themselves out
    if (session && revokingUser.userId === session.user_id) {
      showToast("Administrators cannot revoke their own active administrative access.");
      return;
    }

    // Guard: Prevent removal of the last Owner in a tenant
    if (revokingUser.role === "owner") {
      const otherOwners = users.filter(
        (u) =>
          u.businessId === revokingUser.businessId &&
          u.userId !== revokingUser.userId &&
          u.role === "owner" &&
          !u.revokedAt
      );
      if (otherOwners.length === 0) {
        showToast("Cannot revoke access for the last remaining Owner of this organization.");
        return;
      }
    }

    setRevokeBusy(true);
    try {
      const biz = await getBusiness(revokingUser.businessId);
      await revokeMember(
        revokingUser.businessId,
        revokingUser.userId,
        buildRevocation({ version: revokingUser.version }, revokeReason, biz.financial_revision)
      );
      showToast(`Membership revoked in database for ${revokingUser.fullName}`);
      setRevokingUser(null);
      setRevokeReason("");
      await loadDatabaseUsers();
    } catch (err) {
      showToast(`Access was not revoked. ${describeP7Error(err).message}`);
    } finally {
      setRevokeBusy(false);
    }
  };

  // Provision Invitation Handler
  const handleProvisionInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newTenantId) return;

    // Check for existing active membership
    const existing = users.find(
      (u) =>
        u.businessId === newTenantId &&
        u.email.toLowerCase() === newEmail.trim().toLowerCase() &&
        !u.revokedAt
    );
    if (existing) {
      showToast(`User ${newEmail} is already an active member of this organization.`);
      return;
    }

    setProvisionBusy(true);
    setInvitationResultLink(null);
    try {
      const biz = await getBusiness(newTenantId);
      const created = await createInvitation(
        newTenantId,
        buildInvitation(newEmail.trim(), newRole, biz.financial_revision)
      );
      const link = invitationLink(window.location.origin, created.invitation_url);
      setInvitationResultLink(link);
      showToast(`Invitation created in database for ${newEmail}. Copy the secure token link below.`);
      await loadDatabaseUsers();
    } catch (err) {
      showToast(`No invitation was created. ${describeP7Error(err).message}`);
    } finally {
      setProvisionBusy(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setHasCopiedLink(true);
    setTimeout(() => setHasCopiedLink(false), 2500);
  };

  // Export CSV Handler with Formula Injection Sanitization
  const handleExportCsv = () => {
    const today = new Date().toISOString().split("T")[0];
    const fileName = `orderfit-users-${today}.csv`;
    const headers = [
      "User ID",
      "Full Name",
      "Email Address",
      "Tenant Organization",
      "Tenant ID",
      "Role",
      "Platform Admin",
      "Membership Status",
      "Record Version",
    ];

    const rows = filteredUsers.map((u) => [
      u.userId,
      u.fullName,
      u.email,
      u.tenantName,
      u.businessId,
      u.role,
      u.isPlatformAdmin ? "YES" : "NO",
      u.revokedAt ? "REVOKED" : "ACTIVE",
      u.version,
    ]);

    exportToCsv(fileName, headers, rows);
    showToast(`Exported ${filteredUsers.length} matching user records to CSV.`);
  };

  const getRoleBadge = (role: string, isPlatformAdmin?: boolean) => {
    if (isPlatformAdmin || role === "admin") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white dark:bg-white dark:text-[#181A1B]">
          Admin
        </span>
      );
    }
    switch (role) {
      case "owner":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2021] text-white dark:bg-white dark:text-[#181A1B]">
            Owner
          </span>
        );
      case "risk_officer":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] dark:bg-[#8B5CF6]/20 dark:text-[#C4B5FD] dark:border-[#8B5CF6]/30">
            Risk Officer
          </span>
        );
      case "commercial_lead":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] dark:bg-[#059669]/20 dark:text-[#6EE7B7] dark:border-[#059669]/30">
            Commercial Lead
          </span>
        );
      case "auditor":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] dark:bg-[#D97706]/20 dark:text-[#FCD34D] dark:border-[#D97706]/30">
            Auditor
          </span>
        );
      case "viewer":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] dark:bg-[#26282A] dark:text-[#D1D5DB] dark:border-[#373A3C]">
            {roleLabel(role)}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] dark:bg-[#1E2021] text-[#1A1A1A] dark:text-[#F3F4F6] font-sans flex flex-row selection:bg-neutral-300 dark:selection:bg-neutral-700 selection:text-neutral-900 dark:selection:text-white">
      <AppSidebar variant="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-[#181A1B]/95 backdrop-blur-md border-b border-[#E8E6E1] dark:border-[#2A2C2D] px-3 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 pl-11 lg:pl-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-[#F3F4F6] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                  <Link
                    href="/admin"
                    className="text-xs text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white transition-colors"
                  >
                    Admin Console
                  </Link>
                  <span className="text-[#A3A3A3] dark:text-[#737373] text-xs">/</span>
                  <span className="text-xs font-semibold text-[#1E2021] dark:text-[#F3F4F6]">
                    User Management
                  </span>
                </div>
                <h1 className="text-sm sm:text-base font-bold text-[#1E2021] dark:text-white font-display leading-tight truncate">
                  Database User Credentials & Membership Roles
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <ThemeToggle variant="icon" />

              <button
                type="button"
                onClick={() => void loadDatabaseUsers()}
                disabled={loading}
                aria-label="Refresh user list"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredUsers.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#2A2C2D] border border-[#E8E6E1] dark:border-[#2A2C2D] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInvitationResultLink(null);
                  setIsProvisionOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#1E2021] hover:bg-black dark:bg-white dark:hover:bg-[#E5E7EB] text-white dark:text-[#181A1B] text-xs font-semibold transition-all shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>Invite User</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-3.5 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1 min-w-0">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#059669] shrink-0" />
                <span className="break-words">{toastMessage}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                aria-label="Dismiss message"
                className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-black/10 text-white/70 dark:text-black/70"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Search & Filters Card */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Field */}
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-[#737373]" />
                <input
                  type="text"
                  placeholder="Search by name, email, or user UUID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#1E2021] dark:hover:text-white text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Tenant Filter */}
                <select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  aria-label="Filter by Tenant Organization"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  {tenantsList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                {/* Role Filter */}
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  aria-label="Filter by Role"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r === "All Roles" ? "All Roles" : roleLabel(r)}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter by Status"
                  className="px-3 py-2 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value="All Statuses">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="REVOKED">Revoked / Suspended</option>
                </select>
              </div>
            </div>

            {/* Filter Summary & Record Counts */}
            <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A3A3A3] pt-2 border-t border-[#F0EEEA] dark:border-[#2A2C2D]">
              <div>
                Showing <span className="font-bold text-[#1E2021] dark:text-white">{filteredUsers.length}</span> of{" "}
                <span className="font-bold text-[#1E2021] dark:text-white">{users.length}</span> database memberships
                {searchQuery || selectedTenant !== "All Tenants" || selectedRole !== "All Roles" || selectedStatus !== "All Statuses" ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedTenant("All Tenants");
                      setSelectedRole("All Roles");
                      setSelectedStatus("All Statuses");
                    }}
                    className="ml-2.5 text-[#DC2626] dark:text-[#F87171] hover:underline font-semibold"
                  >
                    Reset all filters
                  </button>
                ) : null}
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Records per page"
                  className="bg-transparent font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Table Card */}
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A3A3A3]">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEA] dark:divide-[#2A2C2D]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#737373] dark:text-[#A3A3A3]">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#1E2021] dark:text-white" />
                        <span>Querying PostgreSQL database user records...</span>
                      </td>
                    </tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#737373] dark:text-[#A3A3A3]">
                        <div className="size-12 rounded-2xl bg-[#FAF9F7] dark:bg-[#222425] flex items-center justify-center mx-auto mb-3">
                          <Users className="size-6 text-[#A3A3A3]" />
                        </div>
                        <p className="font-semibold text-sm text-[#1E2021] dark:text-white">
                          No database records matched your criteria
                        </p>
                        <p className="text-xs text-[#737373] dark:text-[#A3A3A3] mt-1">
                          Try adjusting your search query, tenant organization, or role filter.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => {
                      const isRevoked = Boolean(u.revokedAt);
                      return (
                        <tr
                          key={`${u.businessId}-${u.userId}`}
                          className="hover:bg-[#FAF9F7] dark:hover:bg-[#222425] transition-colors group"
                        >
                          {/* User info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-[#FAF9F7] dark:bg-[#26282A] border border-[#E8E6E1] dark:border-[#373A3C] flex items-center justify-center text-xs font-bold text-[#1E2021] dark:text-white shrink-0">
                                {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-[#1E2021] dark:text-white truncate">
                                  {u.fullName}
                                </div>
                                <div className="text-[11px] text-[#737373] dark:text-[#A3A3A3] font-mono truncate">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Organization */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-medium text-[#1E2021] dark:text-white">
                              <Building2 className="size-3.5 text-[#737373] dark:text-[#A3A3A3] shrink-0" />
                              <span className="truncate">{u.tenantName}</span>
                            </div>
                            <div className="text-[10px] text-[#737373] dark:text-[#A3A3A3] font-mono truncate">
                              ID: {u.businessId ? u.businessId.slice(0, 8) : "Platform"}
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">{getRoleBadge(u.role, u.isPlatformAdmin)}</td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isRevoked ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#991B1B] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5] border border-[#FCA5A5] dark:border-[#DC2626]/30">
                                <span className="size-1.5 rounded-full bg-[#DC2626]" />
                                Revoked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#065F46] dark:bg-[#059669]/20 dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#059669]/30">
                                <span className="size-1.5 rounded-full bg-[#059669]" />
                                Active
                              </span>
                            )}
                          </td>

                          {/* Version */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-[#737373] dark:text-[#A3A3A3]">
                            v{u.version}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Details */}
                              <button
                                type="button"
                                onClick={() => setDetailUser(u)}
                                title="View User Details"
                                className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                              >
                                <Eye className="size-4" />
                              </button>

                              {/* Edit Role */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditRole(u.role as Role);
                                }}
                                disabled={isRevoked}
                                title="Edit Role"
                                className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ShieldCheck className="size-4" />
                              </button>

                              {/* Revoke Access */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokingUser(u);
                                  setRevokeReason("");
                                }}
                                disabled={isRevoked}
                                title="Revoke Membership"
                                className="p-1.5 rounded-lg text-[#737373] dark:text-[#A3A3A3] hover:text-[#DC2626] dark:hover:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#DC2626]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <UserX className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredUsers.length > 0 && (
              <div className="p-4 border-t border-[#E8E6E1] dark:border-[#2A2C2D] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-[#737373] dark:text-[#A3A3A3]">
                  Showing {(currentPage - 1) * pageSize + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} records
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`size-8 rounded-lg text-xs font-semibold transition-colors ${
                            currentPage === pageNum
                              ? "bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B]"
                              : "border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#525252] dark:text-[#D1D5DB] hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D]"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return (
                        <span key={pageNum} className="text-[#737373] px-1">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D] bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EFECE6] dark:hover:bg-[#2A2C2D] transition-colors"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ======================================================== */}
      {/* 1. User Details Modal                                    */}
      {/* ======================================================== */}
      {detailUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#FAF9F7] dark:bg-[#26282A] border border-[#E8E6E1] dark:border-[#373A3C] flex items-center justify-center text-sm font-bold text-[#1E2021] dark:text-white">
                  {detailUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                    {detailUser.fullName}
                  </h3>
                  <p className="text-xs text-[#737373] dark:text-[#A3A3A3] font-mono">
                    {detailUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                aria-label="Close user details"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF9F7] dark:bg-[#222425] p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D]">
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-[10px] uppercase font-semibold">
                  User ID
                </span>
                <span className="font-mono font-medium text-[#1E2021] dark:text-white break-all">
                  {detailUser.userId}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-[10px] uppercase font-semibold">
                  Tenant Organization
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {detailUser.tenantName}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-[10px] uppercase font-semibold">
                  Assigned Role
                </span>
                <span className="mt-1 inline-block">
                  {getRoleBadge(detailUser.role, detailUser.isPlatformAdmin)}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-[10px] uppercase font-semibold">
                  Membership Status
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {detailUser.revokedAt ? "Revoked" : "Active"}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-[10px] uppercase font-semibold">
                  Record Version
                </span>
                <span className="font-mono text-[#1E2021] dark:text-white">
                  v{detailUser.version}
                </span>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A3A3A3] block text-[10px] uppercase font-semibold">
                  Platform Admin
                </span>
                <span className="font-semibold text-[#1E2021] dark:text-white">
                  {detailUser.isPlatformAdmin ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="px-4 py-2 rounded-xl bg-[#1E2021] text-white dark:bg-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Invite User Modal                                     */}
      {/* ======================================================== */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                  <Mail className="size-4" />
                </div>
                <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                  Invite User to Organization
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionOpen(false)}
                aria-label="Close invite modal"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            {invitationResultLink ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#ECFDF5] dark:bg-[#059669]/20 border border-[#A7F3D0] dark:border-[#059669]/30 text-xs space-y-2">
                  <div className="font-bold text-[#065F46] dark:text-[#6EE7B7] flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    <span>Invitation Successfully Persisted</span>
                  </div>
                  <p className="text-[#047857] dark:text-[#A7F3D0]">
                    Email delivery is running in link-based sandbox mode. Share this one-time secure link with the invitee:
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      readOnly
                      value={invitationResultLink}
                      className="w-full p-2 bg-white dark:bg-[#181A1B] border border-[#A7F3D0] dark:border-[#059669]/40 rounded-lg text-[11px] font-mono text-[#1E2021] dark:text-white select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(invitationResultLink)}
                      className="px-3 py-2 rounded-lg bg-[#059669] text-white font-semibold flex items-center gap-1 shrink-0 hover:bg-[#047857] transition-colors"
                    >
                      {hasCopiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{hasCopiedLink ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProvisionOpen(false);
                    setInvitationResultLink(null);
                    setNewEmail("");
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleProvisionInvitation} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="teammate@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#1E2021] dark:focus:ring-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                    Target Organization
                  </label>
                  <select
                    value={newTenantId}
                    onChange={(e) => setNewTenantId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                  >
                    {session?.memberships?.map((m) => (
                      <option key={m.business_id} value={m.business_id}>
                        {m.business_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                    Membership Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                  >
                    <option value="commercial_lead">Commercial Lead (Intake, review & what-if plans)</option>
                    <option value="risk_officer">Risk Officer (Holds & reserve calibration)</option>
                    <option value="auditor">Auditor (Tamper-evident logs & read-only history)</option>
                    <option value="viewer">Viewer (Read-only pipeline access)</option>
                    <option value="owner">Owner (Full business administration)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProvisionOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={provisionBusy || !newEmail.trim() || !newTenantId}
                    className="px-4 py-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {provisionBusy ? "Persisting..." : "Create Invitation"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. Edit Role Modal                                       */}
      {/* ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FAF9F7] dark:bg-[#222425] text-[#1E2021] dark:text-white">
                  <ShieldCheck className="size-4" />
                </div>
                <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                  Update Membership Role
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                aria-label="Close edit role modal"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="p-3 bg-[#FAF9F7] dark:bg-[#222425] rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs space-y-1">
                <div className="font-semibold text-[#1E2021] dark:text-white">
                  {editingUser.fullName}
                </div>
                <div className="text-[#737373] dark:text-[#A3A3A3] font-mono">
                  {editingUser.email}
                </div>
                <div className="text-[11px] text-[#525252] dark:text-[#A3A3A3]">
                  Organization: <span className="font-semibold">{editingUser.tenantName}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                  Select New Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs font-semibold text-[#1E2021] dark:text-white cursor-pointer focus:outline-none"
                >
                  <option value="commercial_lead">Commercial Lead (Intake, review & plans)</option>
                  <option value="risk_officer">Risk Officer (Holds & reserve calibration)</option>
                  <option value="auditor">Auditor (Tamper-evident logs & read-only history)</option>
                  <option value="viewer">Viewer (Read-only pipeline access)</option>
                  <option value="owner">Owner (Full business administration)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="px-4 py-2 rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#181A1B] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {editBusy ? "Saving..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. Revoke Access Confirmation Modal                      */}
      {/* ======================================================== */}
      {revokingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FEF2F2] dark:bg-[#DC2626]/20 text-[#DC2626]">
                  <AlertTriangle className="size-4" />
                </div>
                <h3 className="text-base font-bold text-[#1E2021] dark:text-white">
                  Revoke Organization Access
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRevokingUser(null)}
                aria-label="Close revoke modal"
                className="p-1.5 rounded-lg text-[#737373] hover:text-[#1E2021] dark:hover:text-white hover:bg-[#F4F2ED] dark:hover:bg-[#222425]"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-[#525252] dark:text-[#A3A3A3] leading-relaxed">
              This will revoke the tenant membership for{" "}
              <strong className="text-[#1E2021] dark:text-white">{revokingUser.fullName}</strong> in{" "}
              <strong className="text-[#1E2021] dark:text-white">{revokingUser.tenantName}</strong>. The user
              account is preserved, but all active access to this organization will be severed immediately.
            </p>

            <form onSubmit={handleRevoke} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1E2021] dark:text-white">
                  Reason for Revocation (min 10 characters)
                </label>
                <textarea
                  required
                  minLength={10}
                  placeholder="e.g. Employee offboarding or team restructuring"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] dark:bg-[#222425] border border-[#E8E6E1] dark:border-[#2A2C2D] rounded-xl text-xs text-[#1E2021] dark:text-white placeholder-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevokingUser(null)}
                  className="px-4 py-2 rounded-xl border border-[#E8E6E1] dark:border-[#2A2C2D] text-xs font-semibold text-[#525252] dark:text-[#A3A3A3] hover:text-[#1E2021] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revokeBusy || revokeReason.trim().length < 10}
                  className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {revokeBusy ? "Revoking..." : "Confirm Revocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
