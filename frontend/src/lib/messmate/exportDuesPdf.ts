import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Member } from "./types";
import { daysRemaining } from "./dateHelpers";
import { format } from "date-fns";

export function exportDuesPdf(members: Member[]) {
  // Filter students who are expired OR have pending dues
  const targetMembers = members.filter((m) => {
    const expired = daysRemaining(m.subscription?.endDate) < 0;
    const hasDues = (m.subscription?.dueAmount ?? 0) > 0 || !m.subscription?.isPaid;
    return expired || hasDues;
  });

  if (targetMembers.length === 0) {
    throw new Error("No expired members or members with pending dues found.");
  }

  // Sort by highest pending due first, then alphabetically by name
  targetMembers.sort((a, b) => {
    const dueA = a.subscription?.dueAmount ?? 0;
    const dueB = b.subscription?.dueAmount ?? 0;
    if (dueB !== dueA) return dueB - dueA;
    return a.name.localeCompare(b.name);
  });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const todayStr = format(new Date(), "dd MMMM yyyy, hh:mm a");

  // Title & Header Branding
  doc.setFillColor(15, 76, 58); // Mom's Kitchen primary dark green
  doc.rect(0, 0, 210, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Mom's Kitchen - Expired & Pending Dues Report", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 240, 230);
  doc.text(`Generated on: ${todayStr}`, 14, 19);

  // Summary Metrics Banner
  const totalPaid = targetMembers.reduce((sum, m) => sum + (m.subscription?.amountPaid ?? 0), 0);
  const totalDue = targetMembers.reduce((sum, m) => sum + (m.subscription?.dueAmount ?? 0), 0);

  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Total Records: ${targetMembers.length}`, 14, 32);

  doc.setTextColor(15, 76, 58);
  doc.text(`Total Collected: Rs. ${totalPaid.toLocaleString("en-IN")}`, 80, 32);

  doc.setTextColor(190, 30, 30);
  doc.text(`Total Outstanding Dues: Rs. ${totalDue.toLocaleString("en-IN")}`, 145, 32);

  // Table Data: strictly Name, Plan, Paid Amount, Pending Amount
  const tableRows = targetMembers.map((m, idx) => {
    const paid = m.subscription?.amountPaid ?? 0;
    const due = m.subscription?.dueAmount ?? 0;
    const planName = m.subscription?.planLabel || "Standard Plan";

    return [
      String(idx + 1),
      `${m.name} (${m.memberId})`,
      planName,
      `Rs. ${paid.toLocaleString("en-IN")}`,
      `Rs. ${due.toLocaleString("en-IN")}`,
    ];
  });

  autoTable(doc, {
    startY: 37,
    head: [["#", "Student Name", "Meal Plan", "Paid Amount", "Pending Due"]],
    body: tableRows,
    foot: [
      [
        "",
        `Total (${targetMembers.length} Students)`,
        "",
        `Rs. ${totalPaid.toLocaleString("en-IN")}`,
        `Rs. ${totalDue.toLocaleString("en-IN")}`,
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [15, 76, 58],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 65 },
      2: { cellWidth: 45 },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold", textColor: [180, 20, 20] },
    },
    footStyles: {
      fillColor: [240, 245, 242],
      textColor: [20, 20, 20],
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 25,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });

  const filename = `moms_kitchen_expired_dues_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
