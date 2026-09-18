const fs = require('fs');
let content = fs.readFileSync('src/services/pdfGenerator.ts', 'utf8');

const updatedHelper = `
  /**
   * Appends Notes, Amount In Words, and Balance Due to the PDF
   */
  appendSupplementaryInfo(doc: jsPDF, receipt: Receipt, startY: number, margin: number, pageWidth: number): number {
    let y = startY;
    
    const isOwed = receipt.balance < 0;
    const hasChange = receipt.balance > 0;
    const currency = receipt.businessSnapshot.currency || 'UGX';
    
    y += 2;
    
    if (isOwed || hasChange) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      if (isOwed) {
        doc.setTextColor(217, 119, 6); // amber-600
        doc.text('Balance Due:', margin, y);
        doc.text(formatCurrency(Math.abs(receipt.balance), currency), pageWidth - margin, y, { align: 'right' });
      } else {
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.text('Change:', margin, y);
        doc.text(formatCurrency(Math.abs(receipt.balance), currency), pageWidth - margin, y, { align: 'right' });
      }
      y += 8;
    }
    
    if (receipt.amountInWords || receipt.notes) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('SUPPLEMENTARY INFORMATION', margin, y);
      y += 5;
      
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y - 3, pageWidth - margin, y - 3);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      
      if (receipt.amountInWords) {
        doc.setFont('helvetica', 'bold');
        doc.text('Amount in Words:', margin, y);
        doc.setFont('helvetica', 'italic');
        const wordsLines = doc.splitTextToSize(receipt.amountInWords.toUpperCase(), pageWidth - margin * 2 - 30);
        doc.text(wordsLines, margin + 30, y);
        y += wordsLines.length * 4.5 + 1;
      }
      
      if (receipt.notes) {
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', margin, y);
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(receipt.notes, pageWidth - margin * 2 - 15);
        doc.text(notesLines, margin + 15, y);
        y += notesLines.length * 4.5;
      }
    }
    
    return y;
  },
`;

content = content.replace(/\/\*\*[\s\S]*?appendSupplementaryInfo[\s\S]*?return y;\n  \},/m, updatedHelper.trim());

fs.writeFileSync('src/services/pdfGenerator.ts', content);
console.log("Done");
