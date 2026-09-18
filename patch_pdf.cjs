const fs = require('fs');
let content = fs.readFileSync('src/services/pdfGenerator.ts', 'utf8');

const helperFn = `
  /**
   * Appends Notes and Amount In Words to the PDF
   */
  appendSupplementaryInfo(doc: jsPDF, receipt: Receipt, startY: number, margin: number, pageWidth: number): number {
    let y = startY;
    
    // Add balance due if applicable (change is usually handled by the template already, but if it's due we can add it here if not present)
    // Actually we will just let templates handle totals, and we append notes/words below totals.
    
    y += 4;
    
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

content = content.replace("async appendQrCodeToPdf", helperFn + "\n  async appendQrCodeToPdf");

fs.writeFileSync('src/services/pdfGenerator.ts', content);
console.log("Done");
