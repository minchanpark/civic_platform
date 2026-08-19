import sharp from "sharp";
import { expect, test } from "@playwright/test";

test("phone-only submission and lookup keep another phone out", async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 32 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 32 });
    HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => undefined })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = (callback) => callback(new Blob(["camera"], { type: "image/jpeg" }));
  });
  test.setTimeout(60_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 24.9937, longitude: 121.301 });
  await page.goto("/report?category=public_utility");
  await expect(page.getByRole("combobox", { name: "行政區" })).toHaveValue("taoyuan");
  await page.getByRole("button", { name: "送出陳情" }).click();
  await expect(page.locator(".error-summary")).toBeFocused();
  await expect(page.locator(".error-summary")).not.toContainText("請選擇行政區。");
  await expect(page.locator(".error-summary")).toContainText("請輸入真實姓名。");
  await expect(page.locator(".error-summary")).toContainText("請輸入有效的手機號碼。");
  await page.locator("#latitude").fill("24.9937");
  await page.locator("#longitude").fill("121.301");
  await expect(page.locator("#address")).toContainText("桃園市桃園區測試路1號");
  await page.locator("#realName").fill("王小明");
  await page.locator("#gender").selectOption("other");
  await page.locator("#ageGroup").selectOption("31_40");
  await page.locator("#cellPhone").fill("0900-000-001");
  await expect(page.locator("#cellPhone")).not.toHaveAttribute("readonly", "");
  await page.locator("#lineId").fill("civic.pin");
  await page.locator("#contactEmail").fill("resident@example.com");
  await page.locator("#title").fill("人行道路面破損需要處理");
  await page.locator("#body").fill("人行道路面有明顯坑洞，行人經過時可能跌倒，請協助處理。");
  await page.locator("#photo").setInputFiles({
    name: "site.jpg",
    mimeType: "image/jpeg",
    buffer: await sharp({ create: { width: 32, height: 32, channels: 3, background: "#808080" } }).jpeg().toBuffer(),
  });
  await page.getByRole("button", { name: "送出陳情" }).click();
  await expect(page).toHaveURL(/\/tickets\/CP-/);
  const ticketUrl = page.url();
  await expect(page.locator(".ticket-hero")).toContainText("人行道路面破損需要處理");
  await expect(page.locator(".coordinate-note")).toContainText("桃園市桃園區測試路1號");
  await expect(page.locator(".coordinate-note")).toContainText("24.99370, 121.30100");

  await page.goto("/tickets");
  await expect(page.getByRole("button", { name: "取得驗證碼" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /全部 \d+/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /已受理 \d+/ }).click();
  await expect(page.locator(".ticket-list")).toContainText("人行道路面破損需要處理");
  await page.goto(ticketUrl);
  await expect(page.getByRole("button", { name: "取得驗證碼" })).toHaveCount(0);

  const completedRow = {
    id: "77777777-7777-4777-8777-777777777777",
    ticket_number: ticketUrl.split("/").at(-1),
    reporter_id: "11111111-1111-4111-8111-111111111111",
    submission_key: "22222222-2222-4222-8222-222222222222",
    category: "public_utility",
    district_id: "taoyuan",
    latitude: 24.9937,
    longitude: 121.301,
    address: "桃園市桃園區測試路1號",
    title: "人行道路面破損需要處理",
    body: "人行道路面有明顯坑洞，行人經過時可能跌倒，請協助處理。",
    status: "completed",
    visibility: "private",
    assigned_department: "road_maintenance",
    status_changed_at: "2026-08-16T08:19:22Z",
    created_at: "2026-08-16T08:14:20Z",
    updated_at: "2026-08-16T08:19:22Z",
  };
  const issueRefresh = (route: import("@playwright/test").Route) => route.fulfill({ json: completedRow });
  const auxiliaryFailure = (route: import("@playwright/test").Route) => route.fulfill({ status: 500, json: { message: "temporary failure" } });
  await page.route("**/rest/v1/issues?*", issueRefresh);
  await page.route("**/rest/v1/issue_status_events?*", auxiliaryFailure);
  await page.route("**/rest/v1/rpc/issue_field_status", auxiliaryFailure);
  let recurrenceRequest: Record<string, unknown> | undefined;
  await page.route("**/api/recurrence-token", async (route) => {
    recurrenceRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { token: "A".repeat(43), expiresAt: new Date(Date.now() + 300_000).toISOString() } });
  });
  await expect(page.locator(".ticket-hero")).toContainText("已完成", { timeout: 7_000 });
  await page.getByRole("link", { name: "提交現場再發證明" }).click();
  await expect(page).toHaveURL(/\/report\?mode=recurrence/);
  await expect(page.locator("#title")).toHaveCount(0);
  await expect(page.locator(".map-draft-pin")).toBeVisible();
  await expect(page.getByRole("button", { name: "確認目前位置並準備相機" })).toBeEnabled();
  await page.getByRole("button", { name: "確認目前位置並準備相機" }).click();
  await expect.poll(() => recurrenceRequest?.sourceIssueId).toBe(completedRow.id);
  await expect(page.locator(".map-draft-pin")).toBeVisible();
  await expect(page.getByLabel("現場再發證明相機預覽")).toBeVisible();
  await page.getByRole("button", { name: "拍攝目前現場" }).click();
  await expect(page.locator("#title")).toBeVisible();
  await expect(page.locator("#body")).toBeVisible();
  await expect(page.getByRole("button", { name: "送出陳情" })).toBeVisible();
  await page.goto(ticketUrl);
  await page.unroute("**/api/recurrence-token");
  await page.unroute("**/rest/v1/issues?*", issueRefresh);
  await page.unroute("**/rest/v1/issue_status_events?*", auxiliaryFailure);
  await page.unroute("**/rest/v1/rpc/issue_field_status", auxiliaryFailure);

  await page.getByRole("button", { name: "登出" }).click();
  await page.goto("/tickets");
  await page.locator("#phone-access-number").fill("0900-000-001");
  await page.getByRole("button", { name: "用手機號碼繼續" }).click();
  await expect(page.locator(".ticket-list")).toContainText("人行道路面破損需要處理");
  await page.goto(ticketUrl);

  await page.getByRole("button", { name: "登出" }).click();
  await page.locator("#phone-access-number").fill("0900-000-002");
  await page.getByRole("button", { name: "用手機號碼繼續" }).click();
  await expect(page.getByRole("button", { name: "取得驗證碼" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "無法確認此案件。" })).toBeVisible();
  await expect(page.locator(".issue-summary")).toHaveCount(0);
});
