import nodemailer from "nodemailer";
import { getSupabaseSecretClient } from "@/lib/supabase/server";

type ClaimedEmail = {
  id: string; status_event_id: string; recipient_email: string; ticket_number: string;
  email_type: "completed" | "on_hold"; event_at: string;
  hold_reason: string | null; next_check_at: string | null;
};

const eventAtFormatter = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei",
});

export async function runNotificationDispatch(limit = 10) {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const secret = getSupabaseSecretClient();
  if (!host || !from || !appUrl || !secret || !Number.isInteger(port) || port < 1 || port > 65_535 || Boolean(user) !== Boolean(pass)) {
    return { ok: false as const, error: "configuration" };
  }
  const transport = nodemailer.createTransport({
    host, port, secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  const lockToken = crypto.randomUUID();
  const claim = await secret.rpc("claim_completion_emails", { target_limit: limit, target_lock_token: lockToken });
  if (claim.error) return { ok: false as const, error: "claim" };

  const jobs = (claim.data ?? []) as ClaimedEmail[];
  let sent = 0;
  let failed = 0;
  let finishErrors = 0;
  for (const job of jobs) {
    let deliveryError: string | null = null;
    try {
      const held = job.email_type === "on_hold";
      await transport.sendMail({
        from, to: job.recipient_email,
        subject: `[CivicPin] ${job.ticket_number} ${held ? "案件暫緩通知" : "案件處理完成"}`,
        text: [
          `CivicPin 案件 ${job.ticket_number}${held ? "已暫緩處理。" : "已完成處理。"}`,
          `${held ? "變更" : "完成"}時間：${eventAtFormatter.format(new Date(job.event_at))}`,
          ...(held ? [`暫緩原因：${job.hold_reason}`, `下次確認：${eventAtFormatter.format(new Date(job.next_check_at!))}`] : []),
          "", `查看處理結果：${appUrl}/tickets/${encodeURIComponent(job.ticket_number)}`, "",
          "案件內容與照片僅能在手機號碼驗證後查看。",
        ].join("\n"),
        messageId: `<civicpin-${job.email_type}-${job.status_event_id}@civicpin.local>`,
      });
      sent += 1;
    } catch (error) {
      deliveryError = error instanceof Error ? error.message : String(error);
      failed += 1;
    }
    const finished = await secret.rpc("finish_completion_email", {
      target_id: job.id, target_lock_token: lockToken,
      target_sent: deliveryError === null, target_error: deliveryError,
    });
    if (finished.error || finished.data !== true) finishErrors += 1;
  }
  return { ok: true as const, claimed: jobs.length, sent, failed, finishErrors };
}
