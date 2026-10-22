/**
 * Fallback client-side QR decoder for browsers lacking native BarcodeDetector API.
 * Dynamically loaded on-demand only when native scanner is unsupported.
 */
import jsQR from 'jsqr';

let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

export async function decodeVideoFrameWithFallback(video: HTMLVideoElement): Promise<string | null> {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
  }

  if (offscreenCanvas.width !== video.videoWidth || offscreenCanvas.height !== video.videoHeight) {
    offscreenCanvas.width = video.videoWidth;
    offscreenCanvas.height = video.videoHeight;
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }

  if (!offscreenCtx) return null;

  offscreenCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  const imageData = offscreenCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);

  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });

  return code?.data ?? null;
}
