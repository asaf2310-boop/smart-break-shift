import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const RENDER_WIDTH_PX = 794;
const PDF_MARGIN_MM = 10;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWorkflowHtml(workflowSteps) {
  if (!workflowSteps?.length) return "";
  const steps = workflowSteps
    .map(
      (step, index) => `
        <div style="margin-bottom:12px;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
          <strong style="font-size:13px;color:#111827 !important;-webkit-text-fill-color:#111827;">שלב ${index + 1}: ${escapeHtml(step.title)}</strong>
          <p style="margin:4px 0 0;font-size:12px;color:#4b5563 !important;-webkit-text-fill-color:#4b5563;">${escapeHtml(step.description)}</p>
        </div>
      `,
    )
    .join("");
  return `
    <h2 style="margin:0 0 12px;font-size:16px;color:#111827 !important;-webkit-text-fill-color:#111827;">תהליך העבודה</h2>
    <div style="margin:0 0 24px;">${steps}</div>
  `;
}

function buildFieldBlocks(fields, startIndex = 0) {
  return fields
    .map((field, index) => {
      const badge = field.required
        ? '<span style="color:#dc2626 !important;font-size:11px;-webkit-text-fill-color:#dc2626;">שדה חובה</span>'
        : '<span style="color:#6b7280 !important;font-size:11px;-webkit-text-fill-color:#6b7280;">אופציונלי</span>';
      const tip = field.tip
        ? `<p style="margin:8px 0 0;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e !important;-webkit-text-fill-color:#92400e;">טיפ: ${escapeHtml(field.tip)}</p>`
        : "";
      return `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#eef2ff;color:#4f46e5 !important;-webkit-text-fill-color:#4f46e5;border-radius:6px;font-size:12px;font-weight:700;">${startIndex + index + 1}</span>
            <strong style="font-size:14px;color:#111827 !important;-webkit-text-fill-color:#111827;">${escapeHtml(field.name)}</strong>
            ${badge}
          </div>
          <p style="margin:0;font-size:13px;color:#374151 !important;-webkit-text-fill-color:#374151;">${escapeHtml(field.description)}</p>
          ${tip}
        </div>
      `;
    })
    .join("");
}

function buildFieldsSectionHtml(title, fields, startIndex = 0, countLabel = "שדות") {
  if (!fields?.length) return "";
  return `
    <h2 style="margin:0 0 16px;font-size:16px;color:#111827 !important;-webkit-text-fill-color:#111827;">${escapeHtml(title)} (${fields.length} ${countLabel})</h2>
    ${buildFieldBlocks(fields, startIndex)}
  `;
}

function buildGuideHtml({
  title,
  intro,
  fields,
  screenshotUrl,
  workflowSteps,
  tableFields,
  additionalSections,
  screenshotAlt,
  fieldsSectionTitle = "הסבר שדות הטופס",
  tableSectionTitle = "טבלת בקשות שנשלחו",
}) {
  const fieldBlocks = buildFieldBlocks(fields);

  const screenshotBlock = screenshotUrl
    ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#111827 !important;-webkit-text-fill-color:#111827;">צילום מסך הממשק</h2>
    <div style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f9fafb;">
      <img
        src="${escapeHtml(screenshotUrl)}"
        alt="${escapeHtml(screenshotAlt || "צילום מסך הממשק")}"
        crossorigin="anonymous"
        style="display:block;width:100%;height:auto;"
      />
    </div>
  `
    : "";

  const workflowBlock = buildWorkflowHtml(workflowSteps);

  const tableBlock = tableFields?.length
    ? buildFieldsSectionHtml(tableSectionTitle, tableFields, fields.length, "עמודות ופעולות")
    : "";

  let runningIndex = fields.length;
  const additionalBlocks = (additionalSections || [])
    .map((section) => {
      const block = buildFieldsSectionHtml(section.title, section.fields, runningIndex);
      runningIndex += section.fields?.length || 0;
      return block;
    })
    .join("");

  return `
    <h1 style="margin:0 0 12px;font-size:22px;color:#111827 !important;-webkit-text-fill-color:#111827;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#4b5563 !important;-webkit-text-fill-color:#4b5563;line-height:1.7;">${escapeHtml(intro)}</p>
    ${workflowBlock}
    ${screenshotBlock}
    <h2 style="margin:0 0 16px;font-size:16px;color:#111827 !important;-webkit-text-fill-color:#111827;">${escapeHtml(fieldsSectionTitle)} (${fields.length} שדות)</h2>
    ${fieldBlocks}
    ${tableBlock}
    ${additionalBlocks}
  `;
}

function buildIsolatedGuideDocument(html) {
  const fontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
  const fontHref = fontLink?.href ?? "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="color-scheme" content="light" />
    ${fontHref ? `<link rel="stylesheet" href="${fontHref}" />` : ""}
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html {
        color-scheme: light only;
        background: #ffffff;
      }
      body {
        margin: 0;
        padding: 32px;
        width: ${RENDER_WIDTH_PX}px;
        background: #ffffff !important;
        color: #111827 !important;
        font-family: "Heebo", "Rubik", "Assistant", "Noto Sans Hebrew", sans-serif;
        line-height: 1.6;
        text-align: right;
        -webkit-font-smoothing: antialiased;
      }
      h1, h2, h3, p, strong, span, div {
        -webkit-text-fill-color: currentColor;
      }
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

async function waitForImages(root) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        }),
    ),
  );
}

async function mountIsolatedGuideRoot(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:0",
    "height:0",
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "visibility:hidden",
  ].join(";");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(buildIsolatedGuideDocument(html));
  doc.close();

  if (doc.fonts?.ready) {
    await doc.fonts.ready;
  }
  await waitForImages(doc.body);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  return {
    iframe,
    root: doc.body,
    cleanup() {
      document.body.removeChild(iframe);
    },
  };
}

async function captureGuideCanvas(root) {
  return html2canvas(root, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    width: RENDER_WIDTH_PX,
    windowWidth: RENDER_WIDTH_PX,
    onclone: (_doc, clonedRoot) => {
      clonedRoot.style.background = "#ffffff";
      clonedRoot.style.color = "#111827";
      clonedRoot.querySelectorAll("h1, h2, h3, p, strong, span").forEach((node) => {
        const inlineColor = node.style.color;
        if (!inlineColor || inlineColor.includes("var(")) {
          node.style.setProperty("color", "#111827", "important");
          node.style.setProperty("-webkit-text-fill-color", "#111827", "important");
        } else {
          node.style.setProperty("-webkit-text-fill-color", inlineColor, "important");
        }
      });
    },
  });
}

function addCanvasPagesToPdf(doc, canvas) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const printableWidth = pageWidth - PDF_MARGIN_MM * 2;
  const printableHeight = pageHeight - PDF_MARGIN_MM * 2;
  const imgHeightMm = (canvas.height * printableWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  let offsetMm = 0;
  let pageIndex = 0;

  while (offsetMm < imgHeightMm) {
    if (pageIndex > 0) {
      doc.addPage();
    }
    doc.addImage(
      imgData,
      "JPEG",
      PDF_MARGIN_MM,
      PDF_MARGIN_MM - offsetMm,
      printableWidth,
      imgHeightMm,
    );
    offsetMm += printableHeight;
    pageIndex += 1;
  }
}

/**
 * Client-side PDF export for wealthy guide topics (Hebrew RTL via rasterized HTML).
 */
async function exportWealthyGuidePdf({
  title,
  intro,
  fields,
  screenshotUrl,
  workflowSteps,
  tableFields,
  additionalSections,
  filename,
  screenshotAlt,
  fieldsSectionTitle,
  tableSectionTitle,
}) {
  const guideHtml = buildGuideHtml({
    title,
    intro,
    fields,
    screenshotUrl,
    workflowSteps,
    tableFields,
    additionalSections,
    screenshotAlt,
    fieldsSectionTitle,
    tableSectionTitle,
  });
  const { root, cleanup } = await mountIsolatedGuideRoot(guideHtml);

  try {
    const canvas = await captureGuideCanvas(root);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    addCanvasPagesToPdf(doc, canvas);
    doc.save(filename);
  } finally {
    cleanup();
  }
}

export async function exportManualChargeGuidePdf({ title, intro, fields, screenshotUrl }) {
  return exportWealthyGuidePdf({
    title,
    intro,
    fields,
    screenshotUrl,
    filename: "manual-charge-guide.pdf",
    screenshotAlt: "ממשק חיוב ידני",
  });
}

export async function exportPaymentLinkGuidePdf({
  title,
  intro,
  fields,
  screenshotUrl,
  workflowSteps,
  tableFields,
}) {
  return exportWealthyGuidePdf({
    title,
    intro,
    fields,
    screenshotUrl,
    workflowSteps,
    tableFields,
    filename: "payment-link-guide.pdf",
    screenshotAlt: "ממשק לינק לתשלום",
    tableSectionTitle: "טבלת בקשות שנשלחו",
  });
}

export async function exportTransactionDetailsGuidePdf({
  title,
  intro,
  filterFields,
  tableFields,
  screenshotUrl,
}) {
  return exportWealthyGuidePdf({
    title,
    intro,
    fields: filterFields,
    tableFields,
    screenshotUrl,
    filename: "transaction-details-guide.pdf",
    screenshotAlt: "ממשק פירוט עסקאות",
    fieldsSectionTitle: "סינון ופעולות",
    tableSectionTitle: "עמודות טבלת העסקאות",
  });
}

export async function exportWordPressPluginGuidePdf({
  title,
  intro,
  installFields,
  paramsFields,
  successUrlFields,
  displayFields,
  paymentMethodFields,
  invoiceFields,
  refundFields,
  faqs,
  screenshotUrl,
  workflowSteps,
}) {
  return exportWealthyGuidePdf({
    title,
    intro,
    fields: installFields,
    screenshotUrl,
    workflowSteps,
    filename: "wordpress-plugin-guide.pdf",
    screenshotAlt: "ממשק הגדרת תוסף Hyp ל-WooCommerce",
    fieldsSectionTitle: "שלבי ההתקנה",
    additionalSections: [
      { title: "עדכון פרמטרים מפורטל Hyp", fields: paramsFields },
      { title: "הגדרת כתובת הצלחה (Success URL)", fields: successUrlFields },
      { title: "הגדרות תצוגה ותשלומים", fields: displayFields },
      { title: "שיטות תשלום", fields: paymentMethodFields },
      { title: "הגדרת חשבוניות", fields: invoiceFields },
      { title: "זיכוי עסקה", fields: refundFields },
      { title: "שאלות נפוצות", fields: faqs },
    ],
  });
}

export async function exportThreeDsSettingsGuidePdf({
  title,
  intro,
  fields,
  brandFields,
  advancedFields,
  testFields,
  screenshotUrl,
  workflowSteps,
}) {
  return exportWealthyGuidePdf({
    title,
    intro,
    fields,
    screenshotUrl,
    workflowSteps,
    filename: "3ds-settings-guide.pdf",
    screenshotAlt: "מסך הגדרות עסקה בטוחה",
    fieldsSectionTitle: "פרטי עסקה בטוחה",
    additionalSections: [
      { title: "הגדרות מותגי אשראי (3DSecure)", fields: brandFields },
      { title: "הגדרות מתקדמות", fields: advancedFields },
      { title: "שמירה, בדיקה וסיום", fields: testFields },
    ],
  });
}
