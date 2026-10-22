'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScannerView } from './scanner-view';
import { SafeQrResult } from '@/components/qr/safe-qr-result';
import type { QrValidationResult } from '@/lib/qr/validateQrPayload';

export default function ScanPage() {
  const router = useRouter();
  const [result, setResult] = useState<QrValidationResult | null>(null);

  const handleScanResult = (res: QrValidationResult) => {
    setResult(res);
  };

  const handleNavigate = (url: string) => {
    if (result?.path) {
      router.push(result.path);
    } else {
      window.location.href = url;
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Emergency Card</h1>
          <p className="text-sm text-slate-400 mt-1">
            Point camera at patient QR code to read verified health records.
          </p>
        </div>

        {!result ? (
          <ScannerView onScanResult={handleScanResult} />
        ) : (
          <SafeQrResult
            payload={result.rawText}
            isLafiyaCard={result.isValidLafiyaUrl}
            onNavigate={handleNavigate}
            onReset={handleReset}
          />
        )}

        <p className="text-xs text-slate-500">
          Camera processing occurs on-device. Non-Lafiya QR content is safely presented as plain text without auto-opening.
        </p>
      </div>
    </main>
  );
}
