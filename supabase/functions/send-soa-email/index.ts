
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY")!;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Fortiserv Billing <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// ── Email HTML template ──
function buildEmailHtml(data: {
  clientFirstName: string;
  billTo: string;
  soaNumber: string;
  soaDate: string;
  dueDate: string;
  totalDue: number;
  subtotal: number;
  downPayment: number;
  withholdingTax: number;
  items: Array<{
    account_code: string;
    agency: string;
    description: string;
    period_covered: string;
    amount: number;
  }>;
  notes: string;
  approvedBy: string;
}) {
  const fmt = (n: number) =>
    Number(n || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const now = new Date();
  const dueDateObj = data.dueDate ? new Date(data.dueDate) : null;
  const isOverdue = dueDateObj ? dueDateObj < now : false;

  const itemRows = data.items
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#64748b;">${item.account_code || "—"}</td>
      <td style="padding:10px 12px;font-size:12px;color:#475569;">${item.agency || ""}</td>
      <td style="padding:10px 12px;font-size:12px;color:#1e293b;font-weight:500;">${item.description}</td>
      <td style="padding:10px 12px;font-size:12px;color:#64748b;">${item.period_covered}</td>
      <td style="padding:10px 12px;font-size:12px;color:#1e293b;font-weight:600;text-align:right;font-family:monospace;">₱${fmt(item.amount)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Payment Reminder – ${data.soaNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER BANNER -->
  <tr>
    <td style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%);padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:20px 32px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.7);">
              Fortiserv Business Management Enterprise, Co.
            </p>
            <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
              Payment Reminder
            </p>
          </td>
          <td style="padding:20px 32px;text-align:right;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.6);">SOA No.</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#ffffff;font-family:monospace;">${data.soaNumber}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- AMOUNT DUE HERO -->
  <tr>
    <td style="padding:32px;background:#ffffff;text-align:center;border-bottom:1px solid #f1f5f9;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:500;">Total Amount Due</p>
      <p style="margin:0;font-size:42px;font-weight:800;color:#1d4ed8;letter-spacing:-1px;">
        ₱${fmt(data.totalDue)}
        <span style="font-size:16px;font-weight:500;color:#94a3b8;vertical-align:middle;margin-left:4px;">PHP</span>
      </p>
      <p style="margin:12px 0 0;font-size:13px;font-weight:600;color:${isOverdue ? "#dc2626" : "#f59e0b"};">
        ${isOverdue ? "⚠ OVERDUE" : "📅 DUE"} — ${formatDate(data.dueDate)}
      </p>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:32px;">

      <!-- GREETING -->
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi <strong>${data.clientFirstName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
        Please find below your Statement of Account from <strong>Fortiserv Business Management Enterprise, Co.</strong>
        Your bill of <strong>₱${fmt(data.totalDue)}</strong> is due on <strong>${formatDate(data.dueDate)}</strong>.
      </p>

      <!-- SOA DETAILS TABLE -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr style="background:#f8fafc;">
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;" colspan="2">SOA Details</td>
        </tr>
        ${[
          ["Bill To", data.billTo],
          ["SOA Date", formatDate(data.soaDate)],
          ["Due Date", formatDate(data.dueDate)],
          ["Approved By", data.approvedBy],
        ]
          .map(
            ([k, v]) => `
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:10px 16px;font-size:12px;color:#64748b;width:140px;">${k}</td>
          <td style="padding:10px 16px;font-size:12px;color:#1e293b;font-weight:500;">${v}</td>
        </tr>`
          )
          .join("")}
      </table>

      <!-- BILLING ITEMS TABLE -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <tr style="background:#1d4ed8;">
          <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#fff;text-align:left;">Code</th>
          <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#fff;text-align:left;">Agency</th>
          <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#fff;text-align:left;">Description</th>
          <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#fff;text-align:left;">Period</th>
          <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#fff;text-align:right;">Amount</th>
        </tr>
        ${itemRows}
      </table>

      <!-- TOTALS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td width="60%"></td>
          <td style="padding:6px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 16px;font-size:12px;color:#64748b;">Subtotal</td>
                <td style="padding:10px 16px;font-size:12px;color:#1e293b;font-weight:600;text-align:right;font-family:monospace;">₱${fmt(data.subtotal)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 16px;font-size:12px;color:#64748b;">Less: Down Payment</td>
                <td style="padding:10px 16px;font-size:12px;color:#1e293b;text-align:right;font-family:monospace;">₱${fmt(data.downPayment)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 16px;font-size:12px;color:#64748b;">Less: Withholding Tax</td>
                <td style="padding:10px 16px;font-size:12px;color:#1e293b;text-align:right;font-family:monospace;">₱${fmt(data.withholdingTax)}</td>
              </tr>
              <tr style="background:#1d4ed8;">
                <td style="padding:12px 16px;font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Total Due</td>
                <td style="padding:12px 16px;font-size:14px;font-weight:800;color:#fff;text-align:right;font-family:monospace;">₱${fmt(data.totalDue)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- PAYMENT DETAILS -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:1px;">Payment Methods</p>
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#1e293b;">Pick up (cash / cheque)</p>
            <p style="margin:0 0 12px;font-size:12px;color:#64748b;font-style:italic;">Monday, Wednesday, and Friday</p>
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#1e293b;">Bank Transfer / Deposit</p>
            <p style="margin:2px 0;font-size:12px;color:#374151;">China Bank &nbsp;·&nbsp; <span style="font-family:monospace;">1307000000077</span></p>
            <p style="margin:2px 0;font-size:12px;color:#374151;">BDO &nbsp;·&nbsp; <span style="font-family:monospace;">004500601972</span></p>
          </td>
        </tr>
      </table>

      <!-- NOTES -->
      <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.7;white-space:pre-line;">${data.notes}</p>

      <p style="margin:24px 0 0;font-size:13px;color:#374151;">
        If you have any questions, please don't hesitate to contact us.<br/>
        <strong>Fortiserv Business Management Enterprise, Co.</strong><br/>
        <span style="color:#64748b;font-size:12px;">(02) 8995-0486 &nbsp;·&nbsp; 0917-315-9779</span>
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">
        Unit 32-A 3rd Floor M. Arce St. Heroes Del 96 Barangay 74, 1400 City of Caloocan NCR Philippines
      </p>
      <p style="margin:4px 0 0;font-size:10px;color:#cbd5e1;">
        This is an automated message. Please do not reply to this email directly.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    const {
      clientEmail,
      clientFirstName,
      billTo,
      soaNumber,
      soaDate,
      dueDate,
      totalDue,
      subtotal,
      downPayment,
      withholdingTax,
      items,
      notes,
      approvedBy,
    } = body;

    if (!clientEmail || !soaNumber) {
      return new Response(
        JSON.stringify({ error: "clientEmail and soaNumber are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const html = buildEmailHtml({
      clientFirstName: clientFirstName || billTo,
      billTo,
      soaNumber,
      soaDate,
      dueDate,
      totalDue,
      subtotal,
      downPayment,
      withholdingTax,
      items,
      notes,
      approvedBy,
    });

 await sendEmail({
  to: clientEmail,
  subject: `Payment Reminder – SOA ${soaNumber} | ₱${Number(totalDue).toLocaleString("en-PH", { minimumFractionDigits: 2 })} Due`,
  html,
});

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${clientEmail}` }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-soa-email error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});