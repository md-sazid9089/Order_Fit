import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Real HTTP through the built same-origin proxy, only in the disposable E2E stack.
test("HTTP bursts preserve tenant isolation, exact replay and strict input rejection", async ({ playwright, baseURL }) => {
  test.setTimeout(120_000); // Includes a declared 60-second sustained workload below.
  const origin = new URL(baseURL!).origin;
  const contexts: APIRequestContext[] = [];

  async function signup() {
    const client = await playwright.request.newContext({ baseURL });
    contexts.push(client);
    const challenge = await client.get("/api/v1/auth/csrf");
    expect(challenge.status()).toBe(200);
    const csrf = (await challenge.json()).csrf_token;
    const response = await client.post("/api/v1/auth/signup", {
      headers: { Origin: origin, "X-CSRF-Token": csrf, "Idempotency-Key": randomUUID() },
      data: { email: `stress-${randomUUID()}@example.invalid`, password: `Synthetic-${randomUUID()}`,
        full_name: "Synthetic HTTP stress", business_name: "Disposable HTTP stress", currency: "BDT", timezone: "Asia/Dhaka" },
    });
    expect(response.status()).toBe(201);
    const state = await client.storageState();
    const sessionCsrf = state.cookies.find(cookie => cookie.name === "orderfit_csrf")!.value;
    const business = (await response.json()).memberships[0].business_id as string;
    return { client, business, headers: { Origin: origin, "X-CSRF-Token": sessionCsrf } };
  }

  async function burst(label: string, count: number, concurrency: number, call: (i: number) => Promise<void>) {
    let next = 0;
    const times: number[] = [];
    const start = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const index = next++;
        const began = performance.now();
        await call(index);
        times.push(performance.now() - began);
      }
    }));
    times.sort((a, b) => a - b);
    console.log("HTTP_STRESS_METRIC", JSON.stringify({ label, count, concurrency,
      wall_ms: +(performance.now() - start).toFixed(2), p50_ms: +times[Math.floor(count / 2)].toFixed(2),
      p95_ms: +times[Math.min(count - 1, Math.floor(count * .95))].toFixed(2), max_ms: +times[count - 1].toFixed(2) }));
  }

  try {
    const a = await signup();
    const b = await signup();
    await burst("mixed-tenant-profile-reads", 200, 16, async i => {
      const own = i % 2 ? a : b;
      const foreign = i % 2 ? b : a;
      const blocked = i % 4 === 0;
      const target = blocked ? foreign : own;
      const response = await own.client.get(`/api/v1/businesses/${target.business}/profile`);
      expect(response.status()).toBe(blocked ? 404 : 200);
      expect(response.headers()["cache-control"]).toContain("no-store");
      if (!blocked) expect((await response.json()).id).toBe(own.business);
      await response.dispose();
    });
    const profile = await a.client.get(`/api/v1/businesses/${a.business}/profile`);
    const revision = (await profile.json()).financial_revision;
    const key = randomUUID();
    const ids: string[] = [];
    const data = { expected_financial_revision: revision, customer: { name: "Exact replay customer", known_domains: [], red_flags: [] } };
    await burst("customer-write-same-key", 32, 16, async () => {
      const response = await a.client.post(`/api/v1/businesses/${a.business}/customers`, {
        headers: { ...a.headers, "Idempotency-Key": key }, data,
      });
      expect(response.status()).toBe(200);
      ids.push((await response.json()).id);
      await response.dispose();
    });
    expect(new Set(ids).size).toBe(1);
    const customers = await a.client.get(`/api/v1/businesses/${a.business}/customers`);
    expect((await customers.json()).items).toHaveLength(1);
    const conflict = await a.client.post(`/api/v1/businesses/${a.business}/customers`, {
      headers: { ...a.headers, "Idempotency-Key": key }, data: { ...data, customer: { ...data.customer, name: "Changed material" } },
    });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
    const malformed = [
      { ...data, unexpected: true }, { ...data, expected_financial_revision: true },
      { ...data, expected_financial_revision: "1" }, { ...data, customer: { ...data.customer, name: "" } },
    ];
    await burst("malformed-customer-writes", 32, 8, async i => {
      const response = await a.client.post(`/api/v1/businesses/${a.business}/customers`, {
        headers: { ...a.headers, "Idempotency-Key": randomUUID() }, data: malformed[i % malformed.length],
      });
      expect(response.status()).toBe(422);
      await response.dispose();
    });
    const after = await a.client.get(`/api/v1/businesses/${a.business}/customers`);
    expect((await after.json()).items).toHaveLength(1);
    await after.dispose();
    // Acceptance budget declared before measurement: 60 seconds, concurrency 8,
    // at most 100,000 requests, no 5xx/unhandled responses, exact tenant/replay
    // invariants and local p95 under 2 seconds. This is not a hosted SLO.
    const sustainedStart = performance.now();
    const deadline = sustainedStart + 60_000;
    const latencies: number[] = [];
    const statuses: Record<string, number> = {};
    let sequence = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (performance.now() < deadline && sequence < 100_000) {
        const index = sequence++;
        const began = performance.now();
        const own = index % 2 ? a : b;
        const foreign = index % 2 ? b : a;
        const crossTenant = index % 8 === 2;
        const response = index % 8 === 0
          ? await a.client.post(`/api/v1/businesses/${a.business}/customers`, { headers: { ...a.headers, "Idempotency-Key": key }, data })
          : index % 8 === 1
            ? await own.client.post(`/api/v1/businesses/${own.business}/customers`, { headers: { ...own.headers, "Idempotency-Key": randomUUID() }, data: malformed[0] })
            : await own.client.get(`/api/v1/businesses/${crossTenant ? foreign.business : own.business}/profile`);
        const expected = index % 8 === 1 ? 422 : crossTenant ? 404 : 200;
        expect(response.status()).toBe(expected);
        if (index % 8 === 0) expect((await response.json()).id).toBe(ids[0]);
        else if (expected === 200) expect((await response.json()).id).toBe(own.business);
        statuses[expected] = (statuses[expected] ?? 0) + 1;
        latencies.push(performance.now() - began);
        await response.dispose();
      }
    }));
    latencies.sort((x, y) => x - y);
    const p95 = latencies[Math.floor(latencies.length * .95)];
    expect(p95).toBeLessThan(2000);
    console.log("HTTP_SUSTAINED_METRIC", JSON.stringify({ count: latencies.length, concurrency: 8,
      seconds: (performance.now() - sustainedStart) / 1000, statuses,
      p50_ms: latencies[Math.floor(latencies.length / 2)], p95_ms: p95, max_ms: latencies[latencies.length - 1] }));
  } finally {
    await Promise.all(contexts.map(context => context.dispose()));
  }
});
