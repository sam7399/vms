import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadPDF(
  filename: string,
  title: string,
  rows: Record<string, any>[],
) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) =>
    headers.map((h) => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }),
  );

  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString()} · ${rows.length} rows`,
    14,
    22,
  );

  autoTable(doc, {
    head: [headers],
    body,
    startY: 28,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 8, right: 8 },
  });

  doc.save(filename);
}
