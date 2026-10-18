"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { mutate, type Deal, type Customer, ApiError } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";

interface CostLineItem {
  id: string;
  name: string;
  amount: number;
  date: string;
  deferrable: boolean;
  incremental: boolean;
  kind: "supplier_payment" | "labour" | "freight" | "subcontract";
}

const INITIAL_COST_ITEMS: CostLineItem[] = [
  {
    id: "c1",
    name: "Raw Material Supplier Deposit",
    amount: 90000,
    date: "2026-11-04",
    deferrable: false,
    incremental: true,
    kind: "supplier_payment",
  },
  {
    id: "c2",
    name: "Supplier Balance on Delivery",
    amount: 90000,
    date: "2026-12-07",
    deferrable: true,
    incremental: true,
    kind: "supplier_payment",
  },
  {
    id: "c3",
    name: "Tooling, Plates & Labour",
    amount: 30000,
    date: "2026-12-10",
    deferrable: false,
    incremental: true,
    kind: "labour",
  },
  {
    id: "c4",
    name: "Outbound Freight & Logistics",
    amount: 10000,
    date: "2026-12-14",
    deferrable: false,
    incremental: true,
    kind: "freight",
  },
];

export default function ValidatePage() {
  const router = useRouter();
  const { businessId } = useScope();

  // Commercial Parameters & Constraints
  const [poNumber, setPoNumber] = useState("PO-8841");
  const [customerName, setCustomerName] = useState("Apex Retailers Inc");
  const [orderValue, setOrderValue] = useState<number>(360000);
  const [deliveryDate, setDeliveryDate] = useState("2026-12-14");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(45);
  const [paymentTermsAnchor, setPaymentTermsAnchor] = useState<"delivery" | "invoice" | "ambiguous">("delivery");
  const [targetScenario, setTargetScenario] = useState<"downside" | "base" | "severe">("downside");
  const [cashReserveFloor, setCashReserveFloor] = useState("$100,000.00");

  // Production Obligations & Cost Schedule
  const [dealId, setDealId] = useState("");
  const [costItems, setCostItems] = useState<CostLineItem[]>(INITIAL_COST_ITEMS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Read draft from localStorage or query params if present (works identically for auto and manual intake)
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        const urlDealId = searchParams.get("dealId");
        const urlPo = searchParams.get("poNumber");
        if (urlDealId) setDealId(urlDealId);
        if (urlPo) setPoNumber(urlPo);

        const stored = localStorage.getItem("orderfit_deal_draft");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.dealId) setDealId(parsed.dealId);
          if (parsed.poNumber) {
            setPoNumber(parsed.poNumber);
          } else if (parsed.poText && parsed.poText.length > 5) {
            const matchPo = parsed.poText.match(/PO-?\d+/i);
            if (matchPo) setPoNumber(matchPo[0].toUpperCase());
          } else if (parsed.poFileName) {
            const matchPo = parsed.poFileName.match(/PO-?\d+/i);
            if (matchPo) setPoNumber(matchPo[0].toUpperCase());
          }
          if (parsed.customerName) setCustomerName(parsed.customerName);
          if (parsed.orderValue && Number(parsed.orderValue) > 0) setOrderValue(Number(parsed.orderValue));
          if (parsed.deliveryDate) setDeliveryDate(parsed.deliveryDate);
          if (parsed.paymentTermsDays && Number(parsed.paymentTermsDays) > 0) setPaymentTermsDays(Number(parsed.paymentTermsDays));
          if (parsed.paymentTermsAnchor) setPaymentTermsAnchor(parsed.paymentTermsAnchor);
          if (parsed.reserveFloor) {
            setCashReserveFloor(parsed.reserveFloor.startsWith("$") ? parsed.reserveFloor : `$${parsed.reserveFloor}`);
          }
          if (parsed.costItems && Array.isArray(parsed.costItems) && parsed.costItems.length > 0) {
            setCostItems(parsed.costItems);
          }
        }
      }
    } catch {
      // Ignore fallback
    }
  }, []);

  const handleToggleDeferral = (id: string) => {
    setCostItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deferrable: !item.deferrable } : item
      )
    );
  };

  const handleUpdateCostAmount = (id: string, amount: number) => {
    setCostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const handleUpdateCostName = (id: string, name: string) => {
    setCostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name } : item))
    );
  };

  const handleUpdateCostDate = (id: string, date: string) => {
    setCostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, date } : item))
    );
  };

  const handleUpdateCostKind = (
    id: string,
    kind: "supplier_payment" | "labour" | "freight" | "subcontract"
  ) => {
    setCostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, kind } : item))
    );
  };

  const handleRemoveCostItem = (id: string) => {
    setCostItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCostItem = () => {
    const newItem: CostLineItem = {
      id: `cost-${Date.now()}`,
      name: "Additional Production Obligation",
      amount: 15000,
      date: deliveryDate,
      deferrable: false,
      incremental: true,
      kind: "supplier_payment",
    };
    setCostItems((prev) => [...prev, newItem]);
  };

  // Live calculations for summary bar
  const totalIncrementalCosts = costItems.reduce((acc, item) => acc + item.amount, 0);
  const projectedProfit = orderValue - totalIncrementalCosts;
  const grossMargin =
    orderValue > 0 ? ((projectedProfit / orderValue) * 100).toFixed(1) : "0.0";

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      if (typeof window !== "undefined") {
        const validatedData = {
          poNumber: poNumber.trim() || "PO-8841",
          customerName,
          orderValue,
          deliveryDate,
          paymentTermsDays,
          paymentTermsAnchor,
          targetScenario,
          cashReserveFloor,
          costItems,
          totalIncrementalCosts,
          projectedProfit,
        };
        localStorage.setItem("orderfit_deal_validated", JSON.stringify(validatedData));
      }

      const targetId = dealId ? encodeURIComponent(dealId) : encodeURIComponent(poNumber.trim() || "PO-8841");
      const targetUrl = `/deals/${targetId}/confirm${query}`;

      setTimeout(() => {
        setIsSubmitting(false);
        router.push(targetUrl);
      }, 500);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to confirm parameters.");
      setIsSubmitting(false);
    }
  };

  const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  const currentPo = dealId ? encodeURIComponent(dealId) : encodeURIComponent(poNumber.trim() || "PO-8841");

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1560px] mx-auto w-full min-w-0">
      {/* Top Header & Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/deals/new${query}`}
            className="p-2 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0"
            title="Return to Ingest Step"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-neutral-400 mb-0.5">
              <Link href={`/deals${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
                Deals Pipeline
              </Link>
              <span className="text-[#A3A3A3]">/</span>
              <Link href={`/deals/new${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
                New Order
              </Link>
              <span className="text-[#A3A3A3]">/</span>
              <span className="font-semibold text-[#1E2021] dark:text-white">Validate</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white font-display leading-tight">
              Validate Parameters &amp; Costs
            </h1>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] text-[11px] font-medium text-[#737373] dark:text-neutral-400">
          <Link href={`/deals/new${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
            1. Ingest
          </Link>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="font-bold text-[#1E2021] dark:text-white flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[#1E2021] dark:bg-white" />
            2. Validate
          </span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <Link href={`/deals/${currentPo}/confirm${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
            3. Confirm
          </Link>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <Link href={`/deals/${currentPo}${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
            4. Compute
          </Link>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <Link href={`/deals/${currentPo}/negotiate${query}`} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
            5. Approve
          </Link>
        </div>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-xs text-red-800 dark:text-red-200">
          {submitError}
        </div>
      )}

      {/* 1. COMMERCIAL PARAMETERS & CONSTRAINTS */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 w-full">
        <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
          <h2 className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
            Commercial Parameters &amp; Constraints
          </h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B] text-[11px] text-[#525252] dark:text-neutral-300">
            <Lock className="size-3 text-[#737373] dark:text-neutral-400" />
            <span>Integer Cent Precision (ADR 0001)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PO Reference */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              PO Reference
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            />
          </div>

          {/* Customer Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            />
          </div>

          {/* Order Gross Revenue */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Order Gross Revenue ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#737373] dark:text-neutral-400">
                $
              </span>
              <input
                type="number"
                value={orderValue}
                onChange={(e) => setOrderValue(Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-bold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
              />
            </div>
          </div>

          {/* Delivery Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Delivery Date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            />
          </div>

          {/* Payment Term Days */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Payment Term Days
            </label>
            <input
              type="number"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            />
          </div>

          {/* Payment Anchor Event */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Payment Anchor Event
            </label>
            <select
              value={paymentTermsAnchor}
              onChange={(e) =>
                setPaymentTermsAnchor(e.target.value as "delivery" | "invoice" | "ambiguous")
              }
              className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            >
              <option value="delivery">After Goods Delivery</option>
              <option value="invoice">After Invoice Date</option>
              <option value="ambiguous">Ambiguous Anchor (Requires Clarification)</option>
            </select>
          </div>

          {/* Owner Target Resilience */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Owner Target Resilience
            </label>
            <select
              value={targetScenario}
              onChange={(e) =>
                setTargetScenario(e.target.value as "downside" | "base" | "severe")
              }
              className="w-full px-3 py-2 bg-white dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs text-[#1E2021] dark:text-white font-semibold focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            >
              <option value="downside">Downside Scenario (Recommended)</option>
              <option value="base">Base Case (On-Time Only)</option>
              <option value="severe">Severe Stress (45d Customer Late)</option>
            </select>
          </div>

          {/* Hard Cash Reserve Floor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E2021] dark:text-neutral-200">
              Hard Cash Reserve Floor
            </label>
            <input
              type="text"
              value={cashReserveFloor}
              onChange={(e) => setCashReserveFloor(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF9F7] dark:bg-[#151718] border border-[#E8E6E1] dark:border-[#2C302F] rounded-xl text-xs font-bold text-[#1E2021] dark:text-white focus:outline-none focus:border-[#1E2021] dark:focus:border-white"
            />
          </div>
        </div>
      </div>

      {/* 2. PRODUCTION OBLIGATIONS & COST SCHEDULE */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 w-full">
        <div className="flex items-center justify-between border-b border-[#F0EEEA] dark:border-[#2C302F] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#1E2021] dark:text-white" />
            <h2 className="text-xs font-bold text-[#1E2021] dark:text-white uppercase tracking-wider">
              Production Obligations &amp; Cost Schedule
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAddCostItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F7] dark:bg-[#2C302F] hover:bg-[#F4F2ED] dark:hover:bg-[#383C3B] border border-[#E8E6E1] dark:border-[#383C3B] text-xs font-semibold text-[#1E2021] dark:text-white transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Line Item</span>
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#151718] text-[11px] font-semibold uppercase tracking-wider text-[#737373] dark:text-neutral-400">
                <th className="py-3 px-4 min-w-[220px]">Cost Description</th>
                <th className="py-3 px-4 min-w-[120px]">Amount ($)</th>
                <th className="py-3 px-4 min-w-[130px]">Date</th>
                <th className="py-3 px-4 min-w-[140px]">Type</th>
                <th className="py-3 px-4 min-w-[150px]">Supplier Extension</th>
                <th className="py-3 px-4 min-w-[100px]">Status</th>
                <th className="py-3 px-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EEEA] dark:divide-[#2C302F]">
              {costItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#FAF9F7]/70 dark:hover:bg-[#2C302F]/40 transition-colors">
                  {/* Cost Description */}
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateCostName(item.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg text-xs font-semibold text-[#1E2021] dark:text-white transition-colors"
                    />
                  </td>

                  {/* Amount ($) */}
                  <td className="py-3 px-4 font-bold text-[#1E2021] dark:text-white">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#737373] dark:text-neutral-400 text-[11px]">$</span>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => handleUpdateCostAmount(item.id, Number(e.target.value))}
                        className="w-28 pl-5 pr-2 py-1.5 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg text-xs font-bold text-[#1E2021] dark:text-white transition-colors"
                      />
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4">
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) => handleUpdateCostDate(item.id, e.target.value)}
                      className="px-2 py-1 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg font-mono text-[11px] text-[#525252] dark:text-neutral-300"
                    />
                  </td>

                  {/* Type */}
                  <td className="py-3 px-4">
                    <select
                      value={item.kind}
                      onChange={(e) =>
                        handleUpdateCostKind(
                          item.id,
                          e.target.value as "supplier_payment" | "labour" | "freight" | "subcontract"
                        )
                      }
                      className="px-2 py-1 bg-transparent hover:bg-white dark:hover:bg-[#151718] focus:bg-white dark:focus:bg-[#151718] border border-transparent hover:border-[#E8E6E1] dark:hover:border-[#2C302F] focus:border-[#1E2021] dark:focus:border-white rounded-lg text-xs text-[#525252] dark:text-neutral-300 capitalize"
                    >
                      <option value="supplier_payment">Supplier Payment</option>
                      <option value="labour">Labour</option>
                      <option value="freight">Freight</option>
                      <option value="subcontract">Subcontract</option>
                    </select>
                  </td>

                  {/* Supplier Extension (Deferrable Toggle) */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleToggleDeferral(item.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        item.deferrable
                          ? "bg-[#1E2021] text-white dark:bg-white dark:text-[#1E2021] shadow-2xs"
                          : "bg-[#F4F2ED] dark:bg-[#2C302F] text-[#737373] dark:text-neutral-300 hover:text-[#1E2021] dark:hover:text-white border border-[#E8E6E1] dark:border-[#383C3B]"
                      }`}
                    >
                      {item.deferrable ? "✓ +30d Deferrable" : "Non-deferrable"}
                    </button>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-[#525252] dark:text-neutral-400">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FAF9F7] dark:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#383C3B]">
                      Incremental
                    </span>
                  </td>

                  {/* Delete button */}
                  <td className="py-3 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveCostItem(item.id)}
                      className="p-1 rounded text-[#A3A3A3] hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove line item"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. BOTTOM SUMMARY & SUBMIT BAR */}
      <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 w-full">
        {/* Financial Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 xl:gap-10">
          <div>
            <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
              Gross Revenue
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
              ${orderValue.toLocaleString()}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
              Incremental Costs
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
              ${totalIncrementalCosts.toLocaleString()}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
              Projected Profit
            </span>
            <div
              className={`text-xl sm:text-2xl font-bold font-display mt-0.5 ${
                projectedProfit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {projectedProfit >= 0
                ? `+$${projectedProfit.toLocaleString()}`
                : `-$${Math.abs(projectedProfit).toLocaleString()}`}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-[#737373] dark:text-neutral-400 uppercase tracking-wider block">
              Gross Margin
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white mt-0.5">
              {grossMargin}%
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0 self-end xl:self-center w-full sm:w-auto">
          <Link
            href={`/deals/new${query}`}
            className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#2C302F] hover:bg-[#F4F2ED] dark:hover:bg-[#383C3B] border border-[#E8E6E1] dark:border-[#383C3B] text-[#525252] dark:text-neutral-200 hover:text-[#1E2021] text-xs font-semibold transition-colors"
          >
            Back to Ingest
          </Link>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] dark:hover:bg-neutral-200 text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Evaluating Feasibility...</span>
              </>
            ) : (
              <>
                <span>Submit &amp; Evaluate Feasibility</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Decision Engine Guarantee Footnote */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#737373] dark:text-neutral-400 gap-2 pt-1 px-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-[#1E2021] dark:text-white shrink-0" />
          <span>
            Pure Decision Engine: Integer minor unit arithmetic (ADR 0001, ADR 0003). Zero float errors.
          </span>
        </div>
        <Link href={`/audit-log${query}`} className="hover:text-[#1E2021] dark:hover:text-white font-medium transition-colors">
          Inspect Operation Log →
        </Link>
      </div>
    </main>
  );
}
