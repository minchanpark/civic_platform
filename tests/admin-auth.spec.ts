import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { emailOtp } from "./mailpit";

const localEnv = existsSync(".env.local")
  ? Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^['"]|['"]$/g, "")]];
  }))
  : {};

const env = (name: string) => process.env[name] ?? localEnv[name];

test("admin must complete email OTP and staff number before dashboard access", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8:${Date.now().toString(16).slice(-4)}::1` });
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY");
  test.skip(!url || !secretKey, "Local Supabase credentials are required");

  const server = createClient(url!, secretKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `admin-e2e-${Date.now()}@example.com`;
  const staffNumber = "CP-E2E-ADMIN-01";
  const created = await server.auth.admin.createUser({ email, email_confirm: true });
  expect(created.error).toBeNull();
  const userId = created.data.user?.id;
  expect(userId).toBeTruthy();

  try {
    const provisioned = await server.rpc("provision_staff", { target_user_id: userId, target_staff_number: staffNumber });
    expect(provisioned.error).toBeNull();

    await page.goto("/admin");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByRole("button", { name: "Get code" }).click();
    await page.getByRole("textbox", { name: "6-digit code" }).fill(await emailOtp(request, email));
    await page.getByRole("button", { name: "Verify", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Admin number verification" })).toBeVisible();
    await page.getByRole("textbox", { name: "Personal admin number" }).fill(staffNumber);
    await page.getByRole("button", { name: "Verify admin number" }).click();
    await expect(page.getByRole("heading", { name: "Complaint management" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Complaint management" })).toBeVisible();

    const issue = {
      id: "99999999-9999-4999-8999-999999999999",
      ticket_number: "CP-20260816-000999",
      category: "road_sidewalk",
      district_id: "taoyuan",
      latitude: 24.9937,
      longitude: 121.301,
      address: "桃園市桃園區測試路1號",
      title: "AI 위험도 테스트 민원",
      body: "보행로를 막고 있는 시설물 때문에 사고 위험이 있습니다.",
      status: "viewed",
      visibility: "private",
      assigned_department: null,
      status_changed_at: "2026-08-16T01:00:00Z",
      created_at: "2026-08-16T00:00:00Z",
      updated_at: "2026-08-16T01:00:00Z",
      metric_valid: true,
      metric_exclusion_reason: null,
    };
    const detail = {
      issue,
      contact: {
        email: "private@example.com",
        realName: "王小明",
        gender: "other",
        ageGroup: "31_40",
        cellPhone: "0912-345-678",
        lineId: "civic.pin",
        contactEmail: "resident@example.com",
      },
      field: { status: "active", recurrenceCount: 0, urgent: false, issueCount: 6, problemSpot: true },
      recurrenceCandidate: null,
      resolutionEvidence: null,
      aiAssistance: null,
      risk: {
        assessmentStatus: "evaluated",
        aiLevel: 4,
        effectiveLevel: 4,
        source: "ai",
        riskReasonCodes: ["accident_risk", "pedestrian_obstruction"],
        filterReasonCodes: [],
        inputScope: ["title", "body", "category"],
        model: "civic-risk",
        modelVersion: "2026-08",
        assessedAt: "2026-08-16T00:00:01Z",
        history: [],
      },
      events: [{ id: "88888888-8888-4888-8888-888888888888", fromStatus: "received", toStatus: "viewed", reason: "opened", holdReason: null, nextCheckAt: null, finalAnswer: null, createdAt: "2026-08-16T01:00:00Z" }],
    };
    await page.route("**/rest/v1/rpc/staff_issue_status_counts", (route) => route.fulfill({ json: {
      received: 0, viewed: 1, in_progress: 0, on_hold: 0, completed: 0,
    } }));
    const mapQueries: Array<Record<string, unknown>> = [];
    await page.route("**/rest/v1/rpc/list_staff_issue_map", (route) => {
      mapQueries.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: {
        total: 1, truncated: false,
        items: [{ ...issue, effective_risk: 4, field_status: "active", recurrence_count: 2, urgent: false, problem_spot_id: "66666666-8888-4888-8888-666666666666", issue_count: 6, problem_spot: true }],
      } });
    });
    await page.route("**/rest/v1/rpc/list_staff_issues", (route) => route.fulfill({ json: {
      total: 1,
      items: [{ ...issue, effective_risk: 4, field_status: "active", recurrence_count: 2, urgent: false, problem_spot_id: "66666666-8888-4888-8888-666666666666", issue_count: 6, problem_spot: true }],
    } }));
    await page.route("**/rest/v1/rpc/acknowledge_issue", (route) => route.fulfill({ json: detail }));
    await page.route("**/rest/v1/rpc/override_issue_risk", (route) => route.fulfill({ json: {
      ...detail,
      risk: {
        ...detail.risk,
        effectiveLevel: 3,
        source: "manager",
        history: [{ id: "77777777-7777-4777-8777-777777777777", fromLevel: 4, toLevel: 3, reason: "현장 사진상 즉각적인 사고 위험은 낮다고 판단했습니다.", createdAt: "2026-08-16T02:00:00Z" }],
      },
    } }));
    await page.reload();
    await expect.poll(() => mapQueries.length).toBeGreaterThan(0);
    const allStatusTab = page.getByRole("button", { name: "All 1" });
    await expect(allStatusTab).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Under staff review 1" }).click();
    await expect.poll(() => mapQueries.some((query) => query.target_status === "viewed")).toBe(true);
    const filteredQueryCount = mapQueries.length;
    await allStatusTab.click();
    await expect(allStatusTab).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => mapQueries.length).toBeGreaterThan(filteredQueryCount);
    expect(mapQueries.at(-1)?.target_status).toBeNull();
    await expect(page.locator(".map-category-pin.problem-spot")).toBeVisible();
    await expect(page.locator(".map-problem-count")).toHaveText("6");
    await page.getByRole("combobox", { name: "District", exact: true }).selectOption("taoyuan");
    await expect(page.locator(".admin-map .issue-map")).toHaveAttribute("data-center-latitude", "24.99735");
    await expect(page.locator(".admin-map .issue-map")).toHaveAttribute("data-center-longitude", "121.29602");
    await expect(page.locator(".admin-map .issue-map")).toHaveAttribute("data-zoom", "14");
    await page.getByRole("combobox", { name: "Risk", exact: true }).selectOption("4");
    await expect.poll(() => mapQueries.some((query) => query.target_risk_level === 4
      && typeof query.target_south === "number" && typeof query.target_north === "number")).toBe(true);
    await page.getByRole("checkbox", { name: "Problem spots only" }).check();
    await expect.poll(() => mapQueries.some((query) => query.target_problem_spot_only === true)).toBe(true);
    await page.getByRole("button", { name: "Full list" }).click();
    await expect(page.getByRole("combobox", { name: "Risk", exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("combobox", { name: "Text size" }).selectOption("150");
    await page.getByRole("button", { name: "High contrast" }).click();
    await expect(page.locator("main.admin-page")).toHaveAttribute("data-text-scale", "150");
    await expect(page.locator("main.admin-page")).toHaveAttribute("data-high-contrast", "true");
    await expect(page.locator(".admin-list")).toContainText("Risk 4 · Recurrences 2 reports");
    await expect(page.locator(".admin-list")).toContainText("Problem spot 6 reports");
    await expect(page.locator(".admin-list li small").last()).toHaveCSS("white-space", "nowrap");
    await expect(page.locator(".admin-list").getByText("AI 위험도 테스트 민원")).toBeVisible();
    const opener = page.locator(".admin-list").getByRole("button", { name: /AI 위험도 테스트 민원/ });
    await opener.click();
    const close = page.getByRole("button", { name: "Close complaint details" }).last();
    await expect(close).toBeFocused();
    await expect(page.locator(".admin-sheet")).toContainText("桃園市桃園區測試路1號");
    await expect(page.locator(".admin-sheet")).toContainText("王小明");
    await expect(page.locator(".admin-sheet")).toContainText("0912-345-678");
    await expect(page.locator(".admin-sheet")).toContainText("resident@example.com");
    await page.keyboard.press("Shift+Tab");
    await expect(close).not.toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".admin-sheet")).toHaveCount(0);
    await expect(opener).toBeFocused();
    await opener.click();
    const [detailsBox, actionsBox] = await Promise.all([
      page.locator(".sheet-grid > section").first().boundingBox(),
      page.locator(".admin-actions").boundingBox(),
    ]);
    expect(actionsBox?.x).toBeGreaterThan((detailsBox?.x ?? 0) + (detailsBox?.width ?? 0));
    expect(Math.abs((actionsBox?.y ?? 0) - (detailsBox?.y ?? 0))).toBeLessThan(2);
    await expect(page.locator(".risk-panel")).toContainText("4 · High");
    await expect(page.locator(".risk-panel")).toContainText("AI suggestion");
    await page.getByLabel("Manager risk rating").selectOption("3");
    await page.getByLabel("Change reason").fill("현장 사진상 즉각적인 사고 위험은 낮다고 판단했습니다.");
    await page.getByRole("button", { name: "Record risk change" }).click();
    await expect(page.locator(".risk-panel")).toContainText("3 · Caution");
    await expect(page.locator(".risk-panel")).toContainText("Manager override");
    await expect(page.locator(".risk-panel")).toContainText("Manager change history 1 reports");
  } finally {
    if (userId) await server.auth.admin.deleteUser(userId);
  }
});
