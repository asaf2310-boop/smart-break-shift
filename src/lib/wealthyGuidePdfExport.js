import { jsPDF } from "jspdf";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildGuideHtml({ title, intro, fields }) {
  const fieldBlocks = fields
    .map((field, index) => {
      const badge = field.required
        ? '<span style="color:#dc2626;font-size:11px;">שדה חובה</span>'
        : '<span style="color:#6b7280;font-size:11px;">אופציונלי</span>';
      const tip = field.tip
        ? `<p style="margin:8px 0 0;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">טיפ: ${escapeHtml(field.tip)}</p>`
        : "";
      return `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#eef2ff;color:#4f46e5;border-radius:6px;font-size:12px;font-weight:700;">${index + 1}</span>
            <strong style="font-size:14px;">${escapeHtml(field.name)}</strong>
            ${badge}
          </div>
          <p style="margin:0;font-size:13px;color:#374151;">${escapeHtml(field.description)}</p>
          ${tip}
        </div>
      `;
    })
    .join("");

  return `
    <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#4b5563;line-height:1.7;">${escapeHtml(intro)}</p>
    <h2 style="margin:0 0 16px;font-size:16px;color:#111827;">הסבר שדות הטופס (${fields.length} שדות)</h2>
    ${fieldBlocks}
  `;
}

/**
 * Client-side PDF export for manual charge guide (Hebrew RTL via rendered HTML).
 */
export function exportManualChargeGuidePdf({ title, intro, fields }) {
  const container = document.createElement("div");
  container.dir = "rtl";
  container.lang = "he";
  container.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:794px",
    "padding:32px",
    "background:#ffffff",
    "color:#111827",
    'font-family:"Heebo","Rubik","Assistant","Noto Sans Hebrew",sans-serif',
    "line-height:1.6",
    "text-align:right",
  ].join(";");
  container.innerHTML = buildGuideHtml({ title, intro, fields });
  document.body.appendChild(container);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  return new Promise((resolve, reject) => {
    doc.html(container, {
      callback: (pdf) => {
        document.body.removeChild(container);
        pdf.save("manual-charge-guide.pdf");
        resolve();
      },
      x: 10,
      y: 10,
      width: 190,
      windowWidth: 794,
      autoPaging: "text",
      margin: [10, 10, 10, 10],
    }).catch((err) => {
      document.body.removeChild(container);
      reject(err);
    });
  });
}
