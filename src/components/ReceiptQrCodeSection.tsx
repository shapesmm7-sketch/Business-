import React, { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { generateReceiptQrDataUrl, ReceiptDataForQr } from '../utils/qrCode';
import { Receipt } from '../types';

interface ReceiptQrCodeSectionProps {
  data: ReceiptDataForQr | Receipt;
  className?: string;
  size?: number;
  darkBg?: boolean;
}

export const ReceiptQrCodeSection: React.FC<ReceiptQrCodeSectionProps> = ({
  className = '',
  darkBg = false,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center shrink-0 ${className}`}>
      {/* Powered by Brivu watermark on bottom */}
      <div
        className={`text-center text-[11px] tracking-wide font-medium select-none ${
          darkBg ? 'text-slate-400/80' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        Powered by Brivu
      </div>
    </div>
  );
};
