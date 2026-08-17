import { expect, type APIRequestContext } from "@playwright/test";

export async function emailOtp(request: APIRequestContext, email: string) {
  let token = "";
  await expect.poll(async () => {
    const response = await request.get("http://127.0.0.1:54324/api/v1/messages");
    const inbox = await response.json() as { messages?: Array<{ ID: string; To?: Array<{ Address: string }> }> };
    const message = inbox.messages?.find((item) => item.To?.some((recipient) => recipient.Address === email));
    if (!message) return "";
    const detail = await request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
    const body = await detail.json() as { HTML?: string; Text?: string };
    token = (body.HTML ?? body.Text ?? "").match(/\b(\d{6})\b/)?.[1] ?? "";
    return token;
  }, { timeout: 10_000 }).toMatch(/^\d{6}$/);
  return token;
}
