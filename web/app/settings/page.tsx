"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  Settings,
  ShieldCheck,
  Save,
  CheckCircle2,
  Building2,
  Lock,
  Sliders,
  DollarSign,
  AlertCircle,
  User,
  Mail,
  Bell,
  Cpu,
  RotateCcw,
  KeyRound,
  FileText,
  Briefcase,
  Layers,
  Sparkles,
  Phone,
  Globe,
  MapPin,
  Clock,
  Shield,
  Palette
} from "lucide-react";

export default function SettingsPage() {
  // Tabs: "company" | "user" | "engine" | "security" | "notifications"
  const [activeTab, setActiveTab] = useState<"company" | "user" | "engine" | "security" | "notifications">("company");
  const [isSaved, setIsSaved] = useState(false);

  // 1. Company Profile Settings
  const [companyName, setCompanyName] = useState("Apex Manufacturing");
  const [tradeRegistration, setTradeRegistration] = useState("US-DE-892104-MFG");
  const [industrySector, setIndustrySector] = useState("Precision Machining & Fabrication");
  const [companyEmail, setCompanyEmail] = useState("finance@apex-mfg.com");
  const [companyPhone, setCompanyPhone] = useState("+1 (555) 234-8900");
  const [companyWebsite, setCompanyWebsite] = useState("https://apex-mfg.com");
  const [companyAddress, setCompanyAddress] = useState("4500 Industrial Parkway, Suite 100, Wilmington, DE 19801");
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState("30");
  const [taxId, setTaxId] = useState("XX-XXX4912");

  // 2. User / Owner Profile Settings
  const [userName, setUserName] = useState("Alexandre Vance");
  const [userRole, setUserRole] = useState("Owner & Chief Financial Officer");
  const [userEmail, setUserEmail] = useState("alexandre.vance@apex-mfg.com");
  const [userPhone, setUserPhone] = useState("+1 (555) 902-4412");
  const [timezone, setTimezone] = useState("America/New_York (UTC-5)");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD (ISO 8601)");
  const [userLanguage, setUserLanguage] = useState("English (US)");

  // 3. Financial Engine & Safety Reserve Constraints (OrderFit Core)
  const [safetyReserve, setSafetyReserve] = useState("100000");
  const [minDelayTolerance, setMinDelayTolerance] = useState("14");
  const [currency, setCurrency] = useState("USD");
  const [maxCustomerConcentration, setMaxCustomerConcentration] = useState("40");
  const [minOrderProfit, setMinOrderProfit] = useState("15000");
  const [defaultTargetScenario, setDefaultTargetScenario] = useState<"downside" | "base" | "severe">("downside");
  const [depositDiscountBpsPer10Pct, setDepositDiscountBpsPer10Pct] = useState("50"); // 50 bps = 0.5% per 10% cash deposit
  const [downsideOrderDelayDays, setDownsideOrderDelayDays] = useState("30");
  const [downsideArDelayDays, setDownsideArDelayDays] = useState("14");

  // 4. Security, RLS & Tenant Scoping
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [tierStepUpApproval, setTierStepUpApproval] = useState(true); // Tier 2/3 Step-Up Enforced
  const [hashChainedAuditLog, setHashChainedAuditLog] = useState(true); // ADR 0005
  const [rowLevelSecurity, setRowLevelSecurity] = useState(true); // ADR 0004 FORCE ROW LEVEL SECURITY
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState("30");

  // 5. Notifications & Alerts
  const [notifyFragilePlan, setNotifyFragilePlan] = useState(true);
  const [notifyReserveBreach, setNotifyReserveBreach] = useState(true);
  const [notifyCounterpartyReplies, setNotifyCounterpartyReplies] = useState(true);
  const [notifyExecutionStale, setNotifyExecutionStale] = useState(true);
  const [emailDigestFrequency, setEmailDigestFrequency] = useState("instant");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleResetDefaults = () => {
    setSafetyReserve("100000");
    setMinDelayTolerance("14");
    setCurrency("USD");
    setMaxCustomerConcentration("40");
    setMinOrderProfit("15000");
    setDefaultTargetScenario("downside");
    setCompanyName("Apex Manufacturing");
    setUserName("Alexandre Vance");
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar companyName={companyName} currency={`${currency} ($)`} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight flex items-center gap-2">
                <Settings className="size-4 text-[#1E2021]" />
                <span>Account & Workspace Settings</span>
              </h1>
              <p className="text-[11px] text-[#737373] leading-tight hidden sm:block">
                Manage business profile, owner identity, mathematical safety floors, and deterministic engine rules
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer"
                title="Reset engine constraints to factory defaults"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1E2021] text-white hover:bg-black transition-all active:scale-[0.98] shadow-xs cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>{isSaved ? "Saved Successfully!" : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full space-y-6 flex-1">
          {isSaved && (
            <div className="p-4 bg-[#FAF9F7] border border-[#1E2021] rounded-2xl flex items-center gap-2 text-xs font-semibold text-[#1E2021] shadow-xs">
              <CheckCircle2 className="size-4 text-[#1E2021] shrink-0" />
              <span>Configuration successfully saved. Real-time parameters and company identity have been synchronized across active engines.</span>
            </div>
          )}

          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-1.5 border-b border-[#E8E6E1] pb-2 overflow-x-auto w-full">
            <button
              type="button"
              onClick={() => setActiveTab("company")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "company"
                  ? "bg-[#1E2021] text-white shadow-xs"
                  : "bg-white text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1]"
              }`}
            >
              <Building2 className="size-3.5" />
              <span>Company Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("user")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "user"
                  ? "bg-[#1E2021] text-white shadow-xs"
                  : "bg-white text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1]"
              }`}
            >
              <User className="size-3.5" />
              <span>User & Owner Identity</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("engine")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "engine"
                  ? "bg-[#1E2021] text-white shadow-xs"
                  : "bg-white text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1]"
              }`}
            >
              <Cpu className="size-3.5" />
              <span>Financial Engine & Reserve Floors</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "security"
                  ? "bg-[#1E2021] text-white shadow-xs"
                  : "bg-white text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1]"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Security & Tenant Scoping</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "notifications"
                  ? "bg-[#1E2021] text-white shadow-xs"
                  : "bg-white text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1]"
              }`}
            >
              <Bell className="size-3.5" />
              <span>Alerts & Notifications</span>
            </button>
          </div>

          {/* TAB 1: COMPANY PROFILE */}
          {activeTab === "company" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <Building2 className="size-4 text-[#1E2021]" />
                    Company & Entity Information
                  </h2>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Primary legal entity details applied to generated deal summaries, audit reports, and supplier notices.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Company Legal Name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373]">Shown on top of the sidebar and customer proposals.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Trade Registration / Entity ID
                    </label>
                    <input
                      type="text"
                      value={tradeRegistration}
                      onChange={(e) => setTradeRegistration(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373]">Commercial registry or state corporation identifier.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Industry Sector / Business Type
                    </label>
                    <input
                      type="text"
                      value={industrySector}
                      onChange={(e) => setIndustrySector(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373]">Used for sector-specific financing benchmarks.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Corporate Finance Email
                    </label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Corporate Telephone
                    </label>
                    <input
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Official Website
                    </label>
                    <input
                      type="url"
                      value={companyWebsite}
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      HQ Registered Address
                    </label>
                    <input
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Federal Tax ID / EIN
                    </label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>
                </div>
              </div>

              {/* Commercial Terms Defaults */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                  <Briefcase className="size-4 text-[#1E2021]" />
                  Default Commercial Policy
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-[#1E2021]">
                      Standard Customer Payment Term (Days)
                    </label>
                    <select
                      value={defaultPaymentTermsDays}
                      onChange={(e) => setDefaultPaymentTermsDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] font-semibold text-[#1E2021] focus:bg-white focus:outline-none"
                    >
                      <option value="15">Net 15 Days</option>
                      <option value="30">Net 30 Days (Standard)</option>
                      <option value="45">Net 45 Days</option>
                      <option value="60">Net 60 Days</option>
                      <option value="90">Net 90 Days</option>
                    </select>
                    <p className="text-[11px] text-[#737373]">Pre-populated when drafting new customer order terms.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-[#1E2021]">
                      Baseline Working Capital Cycle
                    </label>
                    <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1] flex items-center justify-between">
                      <span className="text-[#525252]">Average Production Lead Time:</span>
                      <span className="font-bold text-[#1E2021]">40 Business Days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER & OWNER IDENTITY */}
          {activeTab === "user" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <User className="size-4 text-[#1E2021]" />
                    Owner Identity & Executive Profile
                  </h2>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Account credentials, executive sign-off authority, and regional format preferences.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373]">Attached as the actor name in the hash-chained audit log.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Organizational Title & Role
                    </label>
                    <input
                      type="text"
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373]">Database role: <code className="font-mono font-bold text-[#1E2021]">app_owner</code></p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Direct Email Address
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Direct Mobile / SMS
                    </label>
                    <input
                      type="tel"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373]">Used for Tier 3 step-up authorization codes.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Operating Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none"
                    >
                      <option value="America/New_York (UTC-5)">Eastern Time - New York (UTC-5)</option>
                      <option value="America/Chicago (UTC-6)">Central Time - Chicago (UTC-6)</option>
                      <option value="America/Denver (UTC-7)">Mountain Time - Denver (UTC-7)</option>
                      <option value="America/Los_Angeles (UTC-8)">Pacific Time - Los Angeles (UTC-8)</option>
                      <option value="Europe/London (UTC+0)">London (UTC+0 / GMT)</option>
                      <option value="Asia/Dhaka (UTC+6)">Dhaka (UTC+6)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E2021]">
                      Standard Date Format
                    </label>
                    <select
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none"
                    >
                      <option value="YYYY-MM-DD (ISO 8601)">ISO 8601 (2026-12-14) - Recommended</option>
                      <option value="MM/DD/YYYY">US Standard (12/14/2026)</option>
                      <option value="DD/MM/YYYY">International (14/12/2026)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Security Snapshot for User */}
              <div className="p-4 bg-white border border-[#E8E6E1] rounded-2xl flex items-center justify-between gap-4 shadow-xs text-xs">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="size-4 text-[#1E2021]" />
                  <div>
                    <span className="font-bold text-[#1E2021]">Sign-off Authority: Tier 0 through Tier 4 Unrestricted</span>
                    <p className="text-[11px] text-[#737373]">Sole account holder authorized to execute sandbox disbursements and sign financing notes.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#FAF9F7] text-[#1E2021] border border-[#E8E6E1] text-[11px] font-bold">
                  Verified Owner
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL ENGINE & SAFETY RESERVE CONSTRAINTS */}
          {activeTab === "engine" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[#1E2021]" />
                    Core Financial Invariants & Safety Floors (ADR 0001 & ADR 0003)
                  </h2>
                  <p className="text-xs text-[#737373] mt-0.5">
                    The pure mathematical engine strictly blocks any order plan that breaches these parameters.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                      Minimum Protected Cash Reserve Floor ($ USD)
                    </label>
                    <input
                      type="number"
                      value={safetyReserve}
                      onChange={(e) => setSafetyReserve(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373] mt-1.5">
                      The red line buffer. Projected cash across all calendar days must remain strictly above this floor.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                      Minimum Delay Tolerance Threshold (Days)
                    </label>
                    <input
                      type="number"
                      value={minDelayTolerance}
                      onChange={(e) => setMinDelayTolerance(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373] mt-1.5">
                      Plans tolerating fewer than this number of payment delay days are flagged as fragile (<code className="font-mono text-[#991B1B]">E-FRAGILE-BEST</code>).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                      System Operating Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    >
                      <option value="USD">USD ($) - United States Dollar (ADR 0001 Exponent: 2)</option>
                      <option value="EUR">EUR (€) - Euro (Exponent: 2)</option>
                      <option value="GBP">GBP (£) - British Pound (Exponent: 2)</option>
                      <option value="BDT">BDT (৳) - Bangladeshi Taka (Exponent: 2)</option>
                    </select>
                    <p className="text-[11px] text-[#737373] mt-1.5">
                      Integer minor unit arithmetic: 100 minor units = 1.00 major unit.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                      Maximum Single-Customer Exposure (% of total pipeline)
                    </label>
                    <input
                      type="number"
                      value={maxCustomerConcentration}
                      onChange={(e) => setMaxCustomerConcentration(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373] mt-1.5">
                      Alerts if any single counterparty exceeds this percentage of total outstanding AR.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                      Minimum Order Net Profit Threshold ($ USD)
                    </label>
                    <input
                      type="number"
                      value={minOrderProfit}
                      onChange={(e) => setMinOrderProfit(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-mono font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373] mt-1.5">
                      Orders generating net profit below this figure trigger an economic rejection.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                      Default Evaluator Target Resilience
                    </label>
                    <select
                      value={defaultTargetScenario}
                      onChange={(e) => setDefaultTargetScenario(e.target.value as "downside" | "base" | "severe")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none focus:border-[#1E2021]"
                    >
                      <option value="downside">Downside Scenario (Recommended - 30d order delay + 14d AR delay)</option>
                      <option value="base">Base Case (On-Time Only)</option>
                      <option value="severe">Severe Stress (45d delay + 10% cost overrun)</option>
                    </select>
                    <p className="text-[11px] text-[#737373] mt-1.5">
                      Baseline stress condition required for a recommended accept plan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Concession Pricing Ladder Parameters */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                  <Sliders className="size-4 text-[#1E2021]" />
                  Negotiation Concession & Discount Ladder
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                  <div>
                    <label className="block font-semibold text-[#1E2021] mb-1">
                      Customer Early Deposit Discount (Basis Points per 10% cash)
                    </label>
                    <input
                      type="number"
                      value={depositDiscountBpsPer10Pct}
                      onChange={(e) => setDepositDiscountBpsPer10Pct(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] font-mono font-semibold text-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373] mt-1">
                      50 bps = 0.5% price cut offered to buyer in return for each 10% upfront deposit.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1E2021] mb-1">
                      Downside AR Receipt Shock (Days)
                    </label>
                    <input
                      type="number"
                      value={downsideArDelayDays}
                      onChange={(e) => setDownsideArDelayDays(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] font-mono font-semibold text-[#1E2021]"
                    />
                    <p className="text-[11px] text-[#737373] mt-1">
                      How many days late customer receipts are modeled under the downside test.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & TENANT SCOPING */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Tenant Details */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                  <Building2 className="size-4 text-[#1E2021]" />
                  Active Tenant Scoping (ADR 0004 & REQ-10)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">Tenant Identifier</div>
                    <div className="font-mono font-bold text-[#1E2021] mt-1">tenant_apex_mfg_01</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">Database Role</div>
                    <div className="font-mono font-bold text-[#1E2021] mt-1">app_owner (Scoped)</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div className="text-[11px] text-[#737373] uppercase font-semibold">Permission Gate</div>
                    <div className="font-mono font-bold text-[#1E2021] mt-1">Tier 2/3 Step-Up Enforced</div>
                  </div>
                </div>
              </div>

              {/* Cryptographic Controls & Safeguards */}
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                  <Shield className="size-4 text-[#1E2021]" />
                  Deterministic Engine Security Controls
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Two-Factor Authentication (2FA) for Approvals
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Requires TOTP / Hardware Key token when signing deal executions.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={twoFactorAuth}
                      onChange={(e) => setTwoFactorAuth(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Tier 2/3 Step-Up Verification (ADR 0005)
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        AI agent is strictly barred from autonomous execution; requires human owner sign-off.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={tierStepUpApproval}
                      onChange={(e) => setTierStepUpApproval(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Append-Only Hash-Chained Audit Trail
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        SHA-256 operation block chained for all financial actions with cryptographic integrity.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={hashChainedAuditLog}
                      onChange={(e) => setHashChainedAuditLog(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        PostgreSQL Row-Level Security (RLS) Enforced
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Database-level multi-tenant isolation enforced via tenant scoped session contexts.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={rowLevelSecurity}
                      onChange={(e) => setRowLevelSecurity(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS & ALERTS */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 shadow-xs space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-[#1E2021] flex items-center gap-2">
                    <Bell className="size-4 text-[#1E2021]" />
                    Runway Monitoring & Event Subscriptions
                  </h2>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Configure real-time alerts for buffer breach events, fragile deal plans, and counterparty replies.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Fragile Plan Alerts (E-FRAGILE-BEST)
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Notifies when a recommended plan tolerates fewer than {minDelayTolerance} delay days.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyFragilePlan}
                      onChange={(e) => setNotifyFragilePlan(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Cash Reserve Breach Warning
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Immediate notification if timeline dips within 15% of the ${Number(safetyReserve).toLocaleString()} reserve floor.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyReserveBreach}
                      onChange={(e) => setNotifyReserveBreach(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Counterparty Negotiation Replies
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Triggers alert when customer or supplier submits counter-proposals requiring re-simulation.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyCounterpartyReplies}
                      onChange={(e) => setNotifyCounterpartyReplies(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E8E6E1]">
                    <div>
                      <div className="text-xs font-bold text-[#1E2021]">
                        Stale Plan Invalidation Alerts
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Alerts if baseline cash commitments change and invalidate pending deal approvals.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyExecutionStale}
                      onChange={(e) => setNotifyExecutionStale(e.target.checked)}
                      className="size-4 accent-[#1E2021] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-[#1E2021] mb-1.5">
                    Executive Notification Digest Frequency
                  </label>
                  <select
                    value={emailDigestFrequency}
                    onChange={(e) => setEmailDigestFrequency(e.target.value)}
                    className="w-full sm:w-72 px-3.5 py-2.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] text-xs font-semibold text-[#1E2021] focus:bg-white focus:outline-none"
                  >
                    <option value="instant">Instant Real-Time Push & Email</option>
                    <option value="daily">Daily Morning Financial Digest (08:00)</option>
                    <option value="weekly">Weekly Pipeline Summary</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
