type BarcodeDetectorCtor = {
  new (options: { formats: string[] }): { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
  getSupportedFormats(): Promise<string[]>
}

/** Returns a reader that yields the QR text in the current video frame, if any. */
export async function qrReader(): Promise<(video: HTMLVideoElement) => Promise<string | undefined>> {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (Detector && (await Detector.getSupportedFormats()).includes('qr_code')) {
    const detector = new Detector({ formats: ['qr_code'] })
    return async (video) => (await detector.detect(video))[0]?.rawValue
  }
  // Safari/iPad and Firefox lack BarcodeDetector; load the decoder only there.
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return async (video) => {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    return jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data
  }
}
