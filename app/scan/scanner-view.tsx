'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { detectQrCode } from '@/lib/qr/detectQr';
import { validateQrPayload, type QrValidationResult } from '@/lib/qr/validateQrPayload';
import { parseCameraError, getTorchController, type TorchSupport } from '@/lib/camera/camera-controls';

interface ScannerViewProps {
  onScanResult?: (result: QrValidationResult) => void;
  onError?: (error: string) => void;
}

export function ScannerView({ onScanResult, onError }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torch, setTorch] = useState<TorchSupport | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanActive, setScanActive] = useState(true);

  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported in this browser.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setTorch(getTorchController(mediaStream));
      }
    } catch (err: unknown) {
      const details = parseCameraError(err);
      setErrorMessage(details.userMessage);
      onError?.(details.userMessage);
    }
  }, [facingMode, onError]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Continuous frame detection loop
  useEffect(() => {
    let animId: number;
    let isDetecting = false;

    const scanFrame = async () => {
      if (!scanActive || !videoRef.current || videoRef.current.readyState < 2) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      if (!isDetecting) {
        isDetecting = true;
        try {
          const rawResult = await detectQrCode(videoRef.current);
          if (rawResult) {
            setScanActive(false);
            const validated = validateQrPayload(rawResult);
            onScanResult?.(validated);
          }
        } catch {
          // Ignore transient frame decode glitches
        } finally {
          isDetecting = false;
        }
      }

      if (scanActive) {
        animId = requestAnimationFrame(scanFrame);
      }
    };

    animId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animId);
  }, [scanActive, onScanResult]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleToggleTorch = async () => {
    if (torch?.isSupported) {
      const state = await torch.toggle();
      setIsTorchOn(state);
    }
  };

  return (
    <div
      role="region"
      aria-label="QR Code Scanner Preview"
      className="relative w-full max-w-md mx-auto aspect-square bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-slate-800"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
        aria-label="Live camera preview feed"
      />

      {/* Target guide alignment box */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
        <div className="w-3/4 h-3/4 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
        </div>
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center items-center gap-3 z-10 px-4">
        <button
          type="button"
          onClick={toggleCamera}
          className="px-4 py-2 bg-slate-900/85 hover:bg-slate-800 text-white rounded-full text-xs font-semibold backdrop-blur border border-white/20 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          aria-label={`Switch camera to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {facingMode === 'environment' ? 'Back' : 'Front'}
        </button>

        {torch?.isSupported && (
          <button
            type="button"
            onClick={handleToggleTorch}
            className={`px-4 py-2 rounded-full text-xs font-semibold backdrop-blur border border-white/20 transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
              isTorchOn ? 'bg-amber-500 text-black border-amber-300' : 'bg-slate-900/85 text-white hover:bg-slate-800'
            }`}
            aria-label={isTorchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Torch
          </button>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute inset-0 bg-slate-950/95 text-white p-6 flex flex-col items-center justify-center text-center gap-3 z-20"
        >
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
