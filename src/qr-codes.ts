import { useEffect, useState } from 'preact/hooks'

/** Data URLs of QR codes for `texts`, filled once encoded; `onError` hears when encoding fails. */
export function useQrCodes(texts: string[], onError: () => void): string[] {
  const [qr, setQr] = useState<string[]>([])
  useEffect(() => {
    // Only the print sheets need the encoder, so it stays out of the app bundle.
    import('qrcode')
      .then((QR) => Promise.all(texts.map((t) => QR.toDataURL(t, { width: 192 }))))
      .then(setQr, onError)
  }, [])
  return qr
}
