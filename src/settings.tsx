import { createContext } from 'preact'
import { useContext, useState } from 'preact/hooks'
import { save } from './store/db'
import type { Text } from './minigames/model'

export type Tempo = 'normal' | 'slow'
export type Settings = { rate: number; easy: boolean; contrast: boolean; sound: boolean; tempo: Tempo }

export const SETTINGS_KEY = 'settings'
export const DEFAULTS: Settings = { rate: 1, easy: false, contrast: false, sound: true, tempo: 'normal' }
export const SettingsContext = createContext<Settings>(DEFAULTS)

export const text = (t: Text, easy: boolean) => (easy ? t.easy : t.standard)

const UNAVAILABLE = 'Vorlesen ist in diesem Browser nicht verfügbar.'

// Chrome fills the voice list only after a first request; asking at load has it ready by the first click.
window.speechSynthesis?.getVoices()

/** Speaks `content` in German; `onFail` gets the notice to show when that is not possible. */
export function speak(content: string, rate: number, onFail: (notice: string) => void) {
  const synth = window.speechSynthesis
  if (!synth || !window.SpeechSynthesisUtterance || !synth.getVoices().some((v) => v.lang.startsWith('de'))) {
    onFail(UNAVAILABLE)
    return
  }
  // A new request replaces the one still speaking instead of queueing behind it.
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = 'de-DE'
  utterance.rate = rate
  utterance.onerror = (e) => {
    // Cut off by cancel() for the next request: nothing went wrong.
    if (e.error !== 'interrupted' && e.error !== 'canceled') onFail('Das Vorlesen hat nicht geklappt.')
  }
  synth.speak(utterance)
}

let audio: AudioContext | undefined

export function playSuccessTone() {
  // The tone only repeats what the result text already says, so a failure is logged instead of shown to the group.
  const failed = (e: unknown) => console.warn('Success tone failed:', e)
  if (!window.AudioContext) return
  try {
    audio ??= new AudioContext()
    audio.resume().catch(failed)
    const t = audio.currentTime
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    const osc = audio.createOscillator()
    osc.frequency.value = 880
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  } catch (e) {
    failed(e)
  }
}

/** Reads `text` aloud; without a text it reads the whole current view. */
export function ReadAloud({ text: content }: { text?: string }) {
  const { rate } = useContext(SettingsContext)
  const [notice, setNotice] = useState<string>()
  return (
    <>
      <button
        type="button"
        class="read-aloud"
        aria-label={content && `${content} vorlesen`}
        onClick={() => {
          setNotice(undefined)
          speak(content ?? document.querySelector<HTMLElement>('main section')?.innerText ?? '', rate, setNotice)
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9z" fill="currentColor" />
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        Vorlesen
      </button>
      {notice && <p role="alert">{notice}</p>}
    </>
  )
}

type PanelProps = { settings: Settings; onChange: (settings: Settings) => void }

export function SettingsPanel({ settings, onChange }: PanelProps) {
  const [error, setError] = useState<string>()

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch }
    onChange(next)
    save(SETTINGS_KEY, next).then(
      () => setError(undefined),
      () => setError('Die Einstellungen konnten nicht gespeichert werden.'),
    )
  }

  return (
    <details class="settings">
      <summary>Einstellungen</summary>
      {error && <p role="alert">{error}</p>}
      <label for="rate">Vorlese-Geschwindigkeit: {settings.rate.toLocaleString('de-DE')}×</label>
      <input id="rate" type="range" min="0.5" max="1.5" step="0.25" value={settings.rate}
        onInput={(e) => update({ rate: Number(e.currentTarget.value) })} />
      <label><input type="checkbox" checked={settings.easy} onChange={(e) => update({ easy: e.currentTarget.checked })} /> Einfache Sprache</label>
      <label><input type="checkbox" checked={settings.contrast} onChange={(e) => update({ contrast: e.currentTarget.checked })} /> Hoher Kontrast</label>
      <label><input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.currentTarget.checked })} /> Ton</label>
      <label for="tempo">Spieltempo</label>
      <select id="tempo" value={settings.tempo} onChange={(e) => update({ tempo: e.currentTarget.value as Tempo })}>
        <option value="normal">Normal</option>
        <option value="slow">Langsam</option>
      </select>
    </details>
  )
}
