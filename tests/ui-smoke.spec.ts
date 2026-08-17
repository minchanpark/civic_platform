import { expect, test } from "@playwright/test";

test("citizen can enter the report flow, move the map and choose either photo source", async ({ page, context }) => {
  await page.setViewportSize({ width: 425, height: 812 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 24.97669, longitude: 121.20916 });
  await page.goto("/tickets");
  await expect(page.locator("#phone-access-number")).toBeVisible();
  await expect(page.getByRole("button", { name: "用手機號碼繼續" })).toBeVisible();
  await expect(page.getByRole("button", { name: "取得驗證碼" })).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "取得驗證碼" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /把社區問題標在地圖上/ })).toBeVisible();
  await expect(page.locator("main.citizen-page")).toBeVisible();
  await expect(page.locator("main.admin-page")).toHaveCount(0);
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "提交新陳情" })).toHaveCount(0);

  await page.getByRole("link", { name: "水、電、瓦斯" }).click();
  await expect(page).toHaveURL(/\/report\?category=public_utility$/);
  await expect(page.getByRole("heading", { name: "問題類型" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "問題類別" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "行政區" })).toHaveValue("");
  const map = page.getByRole("region", { name: "桃園陳情位置選擇地圖" });
  await expect(map).toBeVisible();
  await expect(page.locator(".map-current-location")).toBeVisible();
  await expect(page.locator(".leaflet-control-zoom-in")).toHaveClass(/leaflet-disabled/);
  await page.getByRole("combobox", { name: "行政區" }).selectOption("zhongli");
  await expect(map).toHaveAttribute("data-center-latitude", "24.97669");
  await expect(map).toHaveAttribute("data-center-longitude", "121.20916");
  await expect(map).toHaveAttribute("data-zoom", "14");
  const locationButton = page.getByRole("button", { name: "返回目前位置" });
  const [mapBox, locationButtonBox] = await Promise.all([map.boundingBox(), locationButton.boundingBox()]);
  expect(locationButtonBox?.width).toBe(44);
  expect(locationButtonBox?.height).toBe(44);
  expect(Math.round((mapBox?.x ?? 0) + (mapBox?.width ?? 0) - (locationButtonBox?.x ?? 0) - (locationButtonBox?.width ?? 0))).toBe(12);
  expect(Math.round((mapBox?.y ?? 0) + (mapBox?.height ?? 0) - (locationButtonBox?.y ?? 0) - (locationButtonBox?.height ?? 0))).toBe(24);
  await expect(locationButton.locator("svg")).toBeVisible();
  await locationButton.click();
  await expect(page.locator(".map-current-location")).toBeVisible();
  await expect(page.locator(".leaflet-control-zoom-in")).toHaveClass(/leaflet-disabled/);
  await map.click({ position: { x: 180, y: 165 } });
  await expect(page.locator(".map-draft-pin")).toBeVisible();
  await expect(page.locator("#address")).toContainText("桃園市桃園區測試路1號");
  await expect(page.locator("#photo")).not.toHaveAttribute("capture", "environment");
  await expect(page.locator("#camera-photo")).toHaveAttribute("capture", "environment");
  await expect(page.getByText("處理完成後仍未解決的現場再發證明")).toHaveCount(0);
  await page.locator("#camera-photo").setInputFiles({ name: "camera.jpg", mimeType: "image/jpeg", buffer: Buffer.from("camera") });
  await expect(page.locator("#photo-help")).toContainText("camera.jpg");
  await expect(page.getByRole("heading", { name: "市民資料" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "真實姓名" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "性別" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "年齡" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(425);
  await expect(page.getByText("個人資料與 AI 使用說明")).toBeVisible();
  await expect(page.getByText("FINAL STEP")).toHaveCount(0);
  await expect(page.locator("#otp-phone")).toHaveCount(0);
  await expect(page.locator("#cellPhone")).toBeVisible();
  await expect(page.getByRole("button", { name: "取得驗證碼" })).toHaveCount(0);
});

test("admin entry does not expose the dashboard before authentication", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await expect(page.locator("main.admin-page")).toBeVisible();
  await expect(page.locator("main.citizen-page")).toHaveCount(0);
  await expect(page.locator('a[href="/"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Complaint management" })).toHaveCount(0);
});

test("admin follows Chinese system locale and lets the manager persist English", async ({ browser }) => {
  const context = await browser.newContext({ locale: "zh-TW" });
  const page = await context.newPage();
  await page.goto("/admin");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expect(page.getByRole("heading", { name: "管理員登入" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await context.close();
});

test("admin OTP rate limits explain that the manager should wait", async ({ page }) => {
  await page.route("**/api/admin/otp", (route) => route.fulfill({
    status: 429,
    headers: { "Retry-After": "30" },
    json: { error: "retry later" },
  }));
  await page.goto("/admin");
  await page.getByRole("textbox", { name: "Email" }).fill("manager@example.com");
  await page.getByRole("button", { name: "Get code" }).click();
  await expect(page.locator("#otp-message")).toHaveText("Please wait before requesting another code.");
});

test("citizen design system reflows without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  const cards = page.locator(".category-card");
  await expect(cards).toHaveCount(8);
  await expect(cards.first().locator(":scope > *")).toHaveCount(2);
  await expect(cards.first().locator("svg")).toBeVisible();
  await expect(cards.first()).toHaveCSS("box-shadow", "rgba(19, 35, 47, 0.16) 0px 4px 12px 0px");
  const [first, second, third] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox(), cards.nth(2).boundingBox()]);
  expect(first?.y).toBe(second?.y);
  expect(third?.y).toBeGreaterThan(first?.y ?? 0);
  await expect(page.locator("html")).toHaveCSS("font-family", /system-ui/);
  await expect(page.locator(".citizen-page")).toHaveCSS("--color-primary", "#25798a");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.setViewportSize({ width: 1200, height: 900 });
  const [desktopFirst, desktopFourth, desktopFifth] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(3).boundingBox(), cards.nth(4).boundingBox()]);
  expect(desktopFirst?.y).toBe(desktopFourth?.y);
  expect(desktopFifth?.y).toBeGreaterThan(desktopFirst?.y ?? 0);

  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.goto("/report");
  await expect(page).toHaveURL(/\/#category-title$/);
  await page.goto("/report?category=road_sidewalk");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문 바로가기" })).toBeFocused();
});

test("route themes and accessible public data contract are present", async ({ page }) => {
  await page.goto("/admin");
  const admin = page.locator("main.admin-page");
  await expect(admin).toHaveCSS("--color-primary", "#256ef4");
  await expect(admin).toHaveCSS("font-size", "17px");

  await page.goto("/player");
  await expect(page.getByRole("link", { name: "公開進度" })).toHaveAttribute("aria-current", "page");
  const databaseTotal = await page.evaluate(async () => {
    const response = await fetch("/api/player");
    const result = await response.json() as { snapshots: Array<{ ticketCount: number }> };
    return result.snapshots.reduce((total, snapshot) => total + snapshot.ticketCount, 0);
  });
  await expect(page.locator(".player-metrics dd").first()).toHaveText(String(databaseTotal));
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "現場解決確認率" })).toBeVisible();
});

test("recurrence report keeps prior tickets private and requires live location and camera preparation", async ({ page }) => {
  await page.goto("/report?mode=recurrence&source=77777777-7777-4777-8777-777777777777&category=road_sidewalk&district=taoyuan");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByText("處理完成後仍未解決的現場再發證明")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "行政區" })).toHaveValue("taoyuan");
  await expect(page.getByText(/通過後才開啟相機/)).toBeVisible();
  await expect(page.getByRole("button", { name: "確認目前位置並準備相機" })).toBeEnabled();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("citizen locale persists across routes and player QR locks the district", async ({ page }) => {
  await page.goto("/?lang=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Put neighborhood problems on the map." })).toBeVisible();
  await page.getByRole("link", { name: "Public status" }).click();
  await expect(page.getByRole("heading", { name: "Accessible district aggregate table" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".player-table-wrap tbody tr")).toHaveCount(13);
  await page.getByRole("button", { name: "Next district" }).click();
  await expect(page.locator(".district-qr")).toBeVisible();
  await expect(page.locator(".player-qr a")).toHaveAttribute("href", /district=.*&lang=en/);
  await page.locator(".language-picker select").selectOption("vi");
  await page.locator(".player-qr a").click();
  await page.getByRole("link", { name: "Nước, điện và gas" }).click();
  await expect(page).toHaveURL(/category=public_utility&district=/);
  await expect(page.getByRole("heading", { name: "Gửi phản ánh", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});
