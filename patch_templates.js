const fs = require('fs');
let content = fs.readFileSync('src/components/ReceiptLayoutRenderer.tsx', 'utf8');

// Insert the helper function after imports
const helperFn = `
const renderSupplementaryInfo = (amountInWords?: string, notes?: string, balance: number = 0, currency: string = 'UGX') => {
  const isOwed = balance < 0;
  const hasChange = balance > 0;
  
  if (!amountInWords && !notes && !isOwed && !hasChange) return null;

  return (
    <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700 text-left space-y-1.5 font-sans">
      {(isOwed || hasChange) && (
        <div className="flex justify-between py-0.5 font-bold text-xs">
          <span className={isOwed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
            {isOwed ? 'Balance Due:' : 'Change:'}
          </span>
          <span className={isOwed ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
            {formatCurrency(Math.abs(balance), currency)}
          </span>
        </div>
      )}
      {amountInWords && (
        <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
          <span className="font-semibold text-slate-900 dark:text-slate-200">Amount in Words: </span>
          <span className="italic uppercase">{amountInWords}</span>
        </div>
      )}
      {notes && (
        <div className="text-[11px] text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-200">Notes: </span>
          <span>{notes}</span>
        </div>
      )}
    </div>
  );
};
`;

// Inject helper after imports
content = content.replace("export interface ReceiptRenderData", helperFn + "\nexport interface ReceiptRenderData");

// Now we need to insert `{renderSupplementaryInfo(amountInWords, notes, balance, currency)}` right before the customFooter divs.
// Because the customFooter div structure varies slightly, let's use regex to find lines containing `{customFooter` and prepend the function call.
// Wait, the custom footer is wrapped in a div like `<div className="mt-4 pt-3...">...{customFooter...}...</div>`.
// Finding the opening div of the footer is hard. We can just use the fact that it's the last child before `</div>` (the main container) or `<div className="receipt-print-area">` end.
// Actually, I can just replace the lines that render the custom footer to inject the function right before them.
// Wait, a more robust way is to just look for all occurrences of `{customFooter || ` and replace the entire parent div. 
// Let's print out the lines with `{customFooter` and their 2 preceding lines.
