'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ScannerViewProps {
  onScanResult?: (data: string) => void;
  onError?: (error: string) => void;
}

export function ScannerView({ onScanResult, onError }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [streamActive, setStreamActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera.';
      setErrorMessage(msg);
      onError?.(msg);
    }
  }, [facingMode, onError]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square bg-black rounded-2xl overflow-hidden shadow-xl flex items-center justify-center">
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        aria-label="Live camera preview for emergency QR scanning"
      />

      {/* Target guide overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-3/4 h-3/4 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
        </div>
      </div>

      {/* Camera switch control */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center items-center gap-4 z-10">
        <button
          type="button"
          onClick={toggleCamera}
          className="px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full text-sm font-medium backdrop-blur border border-white/20 transition-colors flex items-center gap-2"
          aria-label="Switch camera"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Switch ({facingMode === 'environment' ? 'Back' : 'Front'})
        </button>
      </div>

      {errorMessage && (
        <div className="absolute inset-0 bg-slate-950/90 text-white p-6 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-sm font-medium text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={startCamera}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            Retry Camera Access
          </button>
        </div>
      )}
    </div>
  );
}
