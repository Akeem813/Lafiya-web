import React from 'react';
import { ScannerView } from './scanner-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scan Emergency QR — Lafiya',
  description: 'Instant offline camera scanner for patient emergency cards and verification QR codes.',
};

export default function ScanPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Emergency Card</h1>
          <p className="text-sm text-slate-400 mt-1">
            Point camera at the patient QR code to read vital emergency health records.
          </p>
        </div>

        <ScannerView />

        <p className="text-xs text-slate-500">
          Camera processing occurs strictly on-device. No video stream data is sent to remote servers.
        </p>
      </div>
    </main>
  );
}
