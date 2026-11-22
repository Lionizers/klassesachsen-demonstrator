import { useEffect, useRef, useState } from 'preact/hooks'
import { checkCode, type Place } from '../places/places'
import { isWithinRadius } from '../places/geo'
import { setStatus } from '../places/progress'
import { qrReader } from '../places/qr'
import { focusHeading } from '../focus'
import type { Group } from '../group'
import { Place as Minigames } from '../minigames/Place'

const RADIUS_M = 100
const WRONG_PLACE = 'Das ist ein anderer Ort. Sucht das Schild von diesem Ort.'

type Props = { place: Place; group: Group | undefined; onBack: () => void }

export function PlaceView({ place, group, onBack }: Props) {
  const [reached, setReached] = useState(false)
  const [denied, setDenied] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [stream, setStream] = useState<MediaStream>()
  const video = useRef<HTMLVideoElement>(null)
  const left = useRef(false)
  useEffect(() => () => { left.current = true }, [])

  /** Hints and progress go to the polite status region, failures to the alert above the content. */
  function say(text: string) {
    setError('')
    setMessage(text)
  }

  function fail(text: string) {
    setMessage('')
    setError(text)
  }

  function reach() {
    setStatus(place.id, 'started').then(
      () => {
        say('')
        setReached(true)
        // The button that was used disappears with the form.
        focusHeading()
      },
      () => fail('Der Fortschritt konnte nicht gespeichert werden.'),
    )
  }

  function finish() {
    setStatus(place.id, 'done').then(onBack, () => fail('Der Fortschritt konnte nicht gespeichert werden.'))
  }

  function tryCode(value: string) {
    setStream(undefined)
    if (checkCode(place.id, value) === 'reached') reach()
    else say(WRONG_PLACE)
  }

  async function startScan() {
    say('')
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }))
    } catch (e) {
      const isDenied = e instanceof DOMException && e.name === 'NotAllowedError'
      if (isDenied) setDenied(true)
      fail(isDenied ? 'Die Kamera ist nicht freigegeben.' : 'Die Kamera ist nicht verfügbar. Gebt den Code ein.')
    }
  }

  useEffect(() => {
    if (!stream || !video.current) return
    const el = video.current
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    el.srcObject = stream
    // Without a camera image there is nothing to scan; stop, or the scan error overwrites this message.
    el.play().catch(() => {
      stopped = true
      setStream(undefined)
      fail('Das Kamerabild konnte nicht gestartet werden.')
    })
    const scanFailed = () => {
      if (stopped) return
      setStream(undefined)
      fail('Der QR-Code konnte nicht gelesen werden. Gebt den Code ein.')
    }
    qrReader()
      .then((read) => {
        const tick = async () => {
          if (stopped) return
          // Frames are only readable once the video has data.
          const text = el.readyState >= 2 ? await read(el) : undefined
          if (stopped) return
          // Later ticks run outside this promise chain, so they need their own error handler.
          if (text === undefined) timer = setTimeout(() => tick().catch(scanFailed), 250)
          else tryCode(text)
        }
        return tick()
      })
      .catch(scanFailed)
    return () => {
      stopped = true
      clearTimeout(timer)
      stream.getTracks().forEach((t) => t.stop())
    }
  }, [stream])

  function checkPosition() {
    if (!navigator.geolocation) {
      setDenied(true)
      fail('Dieses Gerät kann den Standort nicht bestimmen.')
      return
    }
    say('Standort wird geprüft …')
    navigator.geolocation.getCurrentPosition(
      // Only the yes/no result is kept; the coordinates are dropped here.
      ({ coords }) => {
        // An answer after leaving must not mark the place as reached.
        if (left.current) return
        if (isWithinRadius({ lat: coords.latitude, lon: coords.longitude }, place, RADIUS_M)) reach()
        else say('Ihr seid noch nicht nah genug am Ort. Scannt den QR-Code.')
      },
      (err) => {
        const isDenied = err.code === err.PERMISSION_DENIED
        if (isDenied) setDenied(true)
        fail(isDenied ? 'Der Standort ist nicht freigegeben.' : 'Der Standort ist gerade nicht verfügbar. Scannt den QR-Code.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  if (reached && place.id === 'funkelfels') return <Minigames group={group} onBack={onBack} />
  return (
    <section aria-labelledby="place-title">
      <h2 id="place-title" tabIndex={-1}>{place.name}</h2>
      {error && <p role="alert">{error}</p>}
      {/* One node for both views, or the switch to "reached" would not be announced. */}
      <p role="status" class={reached ? 'success' : undefined}>{reached ? 'Station erreicht!' : message}</p>
      {reached ? (
        <>
          <p>Hier entstehen weitere Minigames.</p>
          <button type="button" onClick={finish}>Aufgabe erledigt</button>
        </>
      ) : (
        <>
          <p>Zeigt, dass ihr am Ort seid: Scannt den QR-Code auf dem Schild oder prüft euren Standort.</p>
          <div class="actions">
            <button type="button" onClick={startScan}>QR-Code scannen</button>
            <button type="button" onClick={checkPosition}>Standort prüfen</button>
          </div>
          {stream && <video ref={video} class="scanner" aria-label="Kamerabild zum Scannen" muted playsInline />}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              tryCode(code)
            }}
          >
            <label for="place-code">Code vom Schild</label>
            <p id="place-code-hint" class="hint">Der Code steht unter dem QR-Code.</p>
            <input id="place-code" aria-describedby="place-code-hint" value={code} onInput={(e) => setCode(e.currentTarget.value)} />
            <button type="submit">Code prüfen</button>
          </form>
          {denied && (
            <>
              <p>Ohne Kamera oder Standort könnt ihr diesen Ort im Klassenzimmer spielen.</p>
              <button type="button" onClick={reach}>Im Klassenzimmer spielen</button>
            </>
          )}
        </>
      )}
      <button type="button" onClick={onBack}>Zurück zur Karte</button>
    </section>
  )
}
