import { env } from "../../config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Wraps raw body HTML in a branded Teamspree shell (orange #ff9412 accent).
 * Callers pass simple HTML; this gives every outbound email a consistent look.
 */
export function renderBrandedEmail(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#ff9412;padding:20px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Teamspree</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#1f2430;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #eceef1;color:#8a94a6;font-size:12px;line-height:1.5;">
                Sent by Teamspree · SySpree Digital Pvt Ltd
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Renders a primary button. Use inside body HTML passed to email sends.
 */
export function emailButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#ff9412;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px;margin:8px 0;">${label}</a>`;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    // Dev default: no provider configured, so verification/reset/invite links
    // are logged here instead of actually emailed. Set EMAIL_PROVIDER=resend
    // (+ RESEND_API_KEY, EMAIL_FROM) to send for real.
    console.log("\n──────── 📧 EMAIL (console provider) ────────");
    console.log(`To: ${message.to}`);
    console.log(`Subject: ${message.subject}`);
    console.log(message.html);
    console.log("───────────────────────────────────────────\n");
  }
}

/**
 * Sends via the Resend REST API (https://resend.com) using global fetch —
 * no SDK dependency. Requires RESEND_API_KEY and EMAIL_FROM.
 */
class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: renderBrandedEmail(message.html),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend send failed (${res.status}): ${detail}`);
    }
  }
}

function createEmailProvider(): EmailProvider {
  switch (env.emailProvider) {
    case "resend": {
      if (!env.resendApiKey || !env.emailFrom) {
        console.warn(
          "[email] EMAIL_PROVIDER=resend but RESEND_API_KEY/EMAIL_FROM missing — falling back to console provider.",
        );
        return new ConsoleEmailProvider();
      }
      return new ResendEmailProvider(env.resendApiKey, env.emailFrom);
    }
    case "console":
    default:
      return new ConsoleEmailProvider();
  }
}

export const emailProvider: EmailProvider = createEmailProvider();

/** Whether outbound mail is actually being sent, not just logged to the console. */
export const emailIsLive = Boolean(env.emailProvider === "resend" && env.resendApiKey && env.emailFrom);
