import { Injectable, Logger } from '@nestjs/common';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends transactional email via Resend if RESEND_API_KEY is set.
 * Otherwise becomes a no-op that logs what would have been sent.
 * This lets the app run on the free tier without any email provider.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from =
    process.env.RESEND_FROM ||
    'VMS <onboarding@resend.dev>'; // resend's sandbox sender — works without domain verification but only to verified test addresses

  async send({ to, subject, html }: SendArgs): Promise<{ sent: boolean; reason?: string }> {
    if (!this.apiKey) {
      this.log.log(`[noop] would email ${to}: ${subject}`);
      return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.log.warn(`Resend ${res.status}: ${body}`);
        return { sent: false, reason: `Resend HTTP ${res.status}` };
      }
      return { sent: true };
    } catch (e: any) {
      this.log.warn(`Resend send failed: ${e?.message ?? e}`);
      return { sent: false, reason: e?.message ?? 'network error' };
    }
  }

  async sendVisitorPassApproved(args: {
    to: string;
    visitorName: string;
    hostName: string;
    branchName: string;
    expectedEntry: Date | string;
    passUrl: string;
  }) {
    const html = `
      <div style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px;max-width:520px;margin:auto">
        <h2 style="margin-top:0">✓ Your visit is approved</h2>
        <p>Hi ${escape(args.visitorName)},</p>
        <p>Your visit to <strong>${escape(args.branchName)}</strong> hosted by <strong>${escape(args.hostName)}</strong> on ${new Date(args.expectedEntry).toLocaleString()} has been approved.</p>
        <p>Show this pass at the gate:</p>
        <p style="margin:24px 0"><a href="${args.passUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Open visitor pass</a></p>
        <p style="font-size:12px;color:#94a3b8">If the button doesn't work, copy this link: ${args.passUrl}</p>
        <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0"/>
        <p style="font-size:11px;color:#64748b">VMS · TheStudioInfinito × Personify Crafters</p>
      </div>`;
    return this.send({
      to: args.to,
      subject: `Your visitor pass for ${args.branchName}`,
      html,
    });
  }
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
