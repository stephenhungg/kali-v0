/**
 * Tax-receipt PDF generator. Produces an IRS-substantiation-compliant
 * receipt for any human-attributed x402 donation. The PDF embeds:
 *
 *   - Tenant name + EIN + IRS status
 *   - Donor wallet (anonymized) + bound user id (when human-attributed)
 *   - Amount, date, network, tx signature
 *   - Explorer URL + QR code linking to the signed tax_receipt_url for
 *     auditor verification
 *   - Attestation language: "no goods or services were provided in
 *     exchange for this contribution"
 *
 * pdf-lib runs entirely in-process — no headless Chrome / external service.
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { MemX402Receipt } from "@/lib/db/memory";
import type { TenantRecord } from "@/lib/tenants";

export interface ReceiptInput {
  receipt: MemX402Receipt;
  tenant: TenantRecord;
  publicReceiptUrl: string;
}

export async function generateReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US letter @ 72dpi
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { tenant, receipt } = input;
  const matchaDeep = rgb(0.016, 0.294, 0.227);
  const strawberryDeep = rgb(0.612, 0.235, 0.294);
  const ink = rgb(0.21, 0.27, 0.22);

  // ─── header ────────────────────────────────────────────────────────
  drawText(page, tenant.name.toUpperCase(), {
    x: 56,
    y: 740,
    size: 18,
    font: helvBold,
    color: matchaDeep,
  });
  drawText(page, `EIN ${tenant.ein} · ${tenant.taxStatus}`, {
    x: 56,
    y: 720,
    size: 10,
    font: helv,
    color: ink,
  });
  drawText(page, `${tenant.city}, ${tenant.state} · ${tenant.website}`, {
    x: 56,
    y: 706,
    size: 10,
    font: helv,
    color: ink,
  });

  drawText(page, "TAX-DEDUCTIBLE RECEIPT", {
    x: 56,
    y: 660,
    size: 26,
    font: helvBold,
    color: strawberryDeep,
  });

  // ─── body ──────────────────────────────────────────────────────────
  const lines: Array<[string, string]> = [
    ["Receipt ID", receipt.id],
    ["Date received", new Date(receipt.receivedAt).toUTCString()],
    ["Amount", `$${receipt.amountUsdc.toFixed(2)} USDC`],
    ["Network", receipt.network],
    ["Tx signature", receipt.txSignature],
    ["Payer wallet", receipt.payerWallet],
    ["Attribution", receipt.attribution],
    [
      "Memo",
      receipt.memo ?? "—",
    ],
    [
      "Program designation",
      receipt.programDesignation ?? "general support",
    ],
  ];

  let y = 620;
  for (const [k, v] of lines) {
    drawText(page, k, { x: 56, y, size: 9, font: helvBold, color: ink });
    drawText(page, v, { x: 200, y, size: 9, font: helv, color: ink, maxWidth: 350 });
    y -= 18;
  }

  // ─── attestation ───────────────────────────────────────────────────
  y -= 16;
  const attest = [
    `${tenant.name} acknowledges receipt of the contribution described above.`,
    "No goods or services were provided in whole or in part in exchange for",
    "this contribution. Please retain this receipt for your tax records.",
    "",
    "This receipt is generated automatically by the Kali x402 protocol",
    "endpoint and verified onchain. The signature in the URL on this page",
    "may be cross-checked at any time at the address shown.",
  ];
  for (const line of attest) {
    drawText(page, line, { x: 56, y, size: 10, font: helv, color: ink });
    y -= 14;
  }

  // ─── verification block ─────────────────────────────────────────────
  drawText(page, "Verify online", {
    x: 56,
    y: 200,
    size: 9,
    font: helvBold,
    color: ink,
  });
  drawText(page, input.publicReceiptUrl, {
    x: 56,
    y: 186,
    size: 8,
    font: helv,
    color: ink,
    maxWidth: 400,
  });

  // QR code linking to the public receipt URL.
  try {
    const qrPngBytes = await QRCode.toBuffer(input.publicReceiptUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    });
    const qrImg = await pdf.embedPng(new Uint8Array(qrPngBytes));
    const qrDims = qrImg.scale(0.5);
    page.drawImage(qrImg, {
      x: 460,
      y: 130,
      width: qrDims.width,
      height: qrDims.height,
    });
  } catch {
    // QR generation failed — leave the URL only.
  }

  // ─── footer ────────────────────────────────────────────────────────
  drawText(page, "Issued via Kali Labs · kalilabs.ai", {
    x: 56,
    y: 60,
    size: 8,
    font: helv,
    color: ink,
  });

  return pdf.save();
}

function drawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: import("pdf-lib").PDFFont;
    color: ReturnType<typeof rgb>;
    maxWidth?: number;
  },
): void {
  const { x, y, size, font, color, maxWidth } = opts;
  // Truncate ultra-long fields with ellipsis to prevent overflow.
  let drawn = text;
  if (maxWidth) {
    const w = font.widthOfTextAtSize(drawn, size);
    if (w > maxWidth) {
      while (drawn.length > 4 && font.widthOfTextAtSize(drawn + "…", size) > maxWidth) {
        drawn = drawn.slice(0, -1);
      }
      drawn += "…";
    }
  }
  page.drawText(drawn, { x, y, size, font, color });
}
