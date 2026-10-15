// src/utils/report_pdf.js
// Shared minimalist PDF builder for the Client / Employee information reports.
// jsPDF from CDN, table drawn by hand: wrapped cells, dynamic row height,
// repeating column headers, group sections, "Page X of Y" footer.
// Palette: white page, slate text, hairline rules. No fills.

const JSPDF_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const TEXT = [30, 41, 59];
const MUTED = [130, 140, 150];
const LINE = [226, 230, 234];
const RULE = [60, 70, 80];

export function loadJsPDF() {
  return new Promise((resolve) => {
    if (window.jspdf && window.jspdf.jsPDF) return resolve(true);
    let s = document.querySelector(`script[src="${JSPDF_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = JSPDF_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => resolve(true));
    s.addEventListener("error", () => resolve(false));
  });
}

const loadLogo = (src = "/fs.png") =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        resolve({
          data: c.toDataURL("image/png"),
          ratio: img.naturalWidth / img.naturalHeight,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

const clean = (v) => {
  const s = v === null || v === undefined || v === "" ? "-" : String(v);
  return s.replace(/[\u2014\u2013]/g, "-").replace(/\u20b1/g, "PHP ");
};

/**
 * @param {Object}   opts
 * @param {string}   opts.title
 * @param {string}   [opts.subtitle]  Filter description (1 line)
 * @param {Array}    opts.cols        [{ label, w }]  w = relative width weight
 * @param {Array}    opts.groups      [{ label?, sublabel?, countLabel?, rows: string[][] }]
 * @param {string}   opts.fileName
 * @param {string}   [opts.format]    "a4" | "legal"  (always landscape)
 */
export async function exportTablePDF({
  title,
  subtitle = "",
  cols,
  groups,
  fileName,
  format = "a4",
}) {
  const ok = await loadJsPDF();
  if (!ok) {
    alert("Unable to load the PDF library. Please check your connection.");
    return;
  }
  const logo = await loadLogo();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 32;
  const mR = 32;
  const usableW = pageW - mL - mR;
  const limit = pageH - 34;

  const NUM_W = 22;
  const FONT = 6.5;
  const LH = 8;
  const PX = 3;
  const PY = 4;

  const totalWeight = cols.reduce((s, c) => s + (c.w || 1), 0);
  const colW = cols.map((c) => ((usableW - NUM_W) * (c.w || 1)) / totalWeight);
  const colX = [];
  colW.reduce((x, w, i) => {
    colX[i] = x;
    return x + w;
  }, mL + NUM_W);

  const totalRecords = groups.reduce((s, g) => s + g.rows.length, 0);

  // header cells (wrapped once)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  const headLines = cols.map((c, i) =>
    doc.splitTextToSize(c.label.toUpperCase(), colW[i] - PX * 2),
  );
  const headH = Math.max(...headLines.map((l) => l.length), 1) * 7 + PY * 2;

  // body rows (wrapped once)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT);
  const prepared = groups.map((g) => ({
    ...g,
    rows: g.rows.map((cells) => {
      const lines = cells.map((t, i) =>
        doc.splitTextToSize(clean(t), colW[i] - PX * 2),
      );
      const h = Math.max(...lines.map((l) => l.length), 1) * LH + PY * 2;
      return { lines, h };
    }),
  }));

  // ── page header ──
  const drawPageHeader = () => {
    let lx = mL;
    if (logo) {
      const h = 26;
      const w = h * logo.ratio;
      doc.addImage(logo.data, "PNG", mL, 18, w, h);
      lx = mL + w + 8;
    }
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("FORTISERV", lx, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text("Business Management Services", lx, 39);

    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, pageW - mR, 28, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    const sub = [
      subtitle
        ? doc.splitTextToSize(subtitle, pageW * 0.55)[0]
        : "",
      new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    ]
      .filter(Boolean)
      .join("   |   ");
    doc.text(sub, pageW - mR, 39, { align: "right" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.8);
    doc.line(mL, 50, pageW - mR, 50);
    return 62;
  };

  // ── column headers ──
  const drawHead = (y) => {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("#", mL + PX, y + PY + 5.5);
    headLines.forEach((lines, i) => {
      lines.forEach((ln, li) =>
        doc.text(ln, colX[i] + PX, y + PY + 5.5 + li * 7),
      );
    });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.6);
    doc.line(mL, y + headH, mL + usableW, y + headH);
    return y + headH;
  };

  // ── body row ──
  const drawRow = (row, n, y) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT);
    doc.setTextColor(...MUTED);
    doc.text(String(n), mL + PX, y + PY + 5.5);
    doc.setTextColor(...TEXT);
    row.lines.forEach((lines, i) => {
      lines.forEach((ln, li) =>
        doc.text(ln, colX[i] + PX, y + PY + 5.5 + li * LH),
      );
    });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(mL, y + row.h, mL + usableW, y + row.h);
  };

  // ── group heading (text only) ──
  const GROUP_H = 24;
  const drawGroupHeader = (g, y) => {
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(clean(g.label), mL, y + 10);
    if (g.sublabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(clean(g.sublabel), mL, y + 19);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      g.countLabel || `${g.rows.length} records`,
      mL + usableW,
      y + 10,
      { align: "right" },
    );
    return y + GROUP_H + 2;
  };

  // ── render ──
  let y = drawPageHeader();

  prepared.forEach((g) => {
    if (g.rows.length === 0) return;
    const firstH = g.rows[0].h;
    const need = (g.label ? GROUP_H + 2 : 0) + headH + firstH;
    if (y + need > limit) {
      doc.addPage();
      y = drawPageHeader();
    }
    if (g.label) y = drawGroupHeader(g, y);
    y = drawHead(y);

    g.rows.forEach((row, idx) => {
      if (y + row.h > limit) {
        doc.addPage();
        y = drawPageHeader();
        y = drawHead(y);
      }
      drawRow(row, idx + 1, y);
      y += row.h;
    });
    y += 16;
  });

  // ── footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text("Confidential - Fortiserv Business Management Services", mL, pageH - 14);
    doc.text(
      `${totalRecords} record${totalRecords === 1 ? "" : "s"}   |   Page ${p} of ${pages}`,
      pageW - mR,
      pageH - 14,
      { align: "right" },
    );
  }

  doc.save(fileName);
}