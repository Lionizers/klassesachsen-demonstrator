import { createContext } from 'preact'
import { useState } from 'preact/hooks'
import { save } from './store/db'
import type { Text } from './minigames/model'

export type Tempo = 'normal' | 'langsam'
export type Settings = { rate: number; easy: boolean; contrast: boolean; sound: boolean; tempo: Tempo }

export const SETTINGS_KEY = 'settings'
export const DEFAULTS: Settings = { rate: 1, easy: false, contrast: false, sound: true, tempo: 'normal' }
export const SettingsContext = createContext<Settings>(DEFAULTS)

export const text = (t: Text, easy: boolean) => (easy ? t.easy : t.standard)

/** Returns false when the browser has no speech output. */
export function speak(content: string, rate: number): boolean {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false
  // A new request replaces the one still speaking instead of queueing behind it.
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = 'de-DE'
  utterance.rate = rate
  speechSynthesis.speak(utterance)
  return true
}

let audio: AudioContext | undefined

export function playSuccessTone() {
  // The tone only repeats what the result text already says, so a browser without audio loses nothing.
  if (!window.AudioContext) return
  audio ??= new AudioContext()
  audio.resume()
  const t = audio.currentTime
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.2, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  const osc = audio.createOscillator()
  osc.frequency.value = 880
  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  osc.stop(t + 0.4)
}

type PanelProps = { settings: Settings; onChange: (settings: Settings) => void }

export function SettingsPanel({ settings, onChange }: PanelProps) {
  const [alert, setAlert] = useState<string>()

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch }
    onChange(next)
    save(SETTINGS_KEY, next).then(
      () => setAlert(undefined),
      () => setAlert('Die Einstellungen konnten nicht gespeichert werden.'),
    )
  }

  function readAloud() {
    const view = document.querySelector<HTMLElement>('main section')
    setAlert(speak(view?.innerText ?? '', settings.rate) ? undefined : 'Vorlesen ist in diesem Browser nicht verfügbar.')
  }

  return (
    <details class="settings">
      <summary>Einstellungen</summary>
      {alert && <p role="alert">{alert}</p>}
      <button type="button" onClick={readAloud}>Vorlesen</button>
      <label for="rate">Vorlese-Geschwindigkeit: {settings.rate.toLocaleString('de-DE')}×</label>
      <input id="rate" type="range" min="0.5" max="1.5" step="0.25" value={settings.rate}
        onInput={(e) => update({ rate: Number(e.currentTarget.value) })} />
      <label><input type="checkbox" checked={settings.easy} onChange={(e) => update({ easy: e.currentTarget.checked })} /> Einfache Sprache</label>
      <label><input type="checkbox" checked={settings.contrast} onChange={(e) => update({ contrast: e.currentTarget.checked })} /> Hoher Kontrast</label>
      <label><input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.currentTarget.checked })} /> Ton</label>
      <label for="tempo">Spieltempo</label>
      <select id="tempo" value={settings.tempo} onChange={(e) => update({ tempo: e.currentTarget.value as Tempo })}>
        <option value="normal">Normal</option>
        <option value="langsam">Langsam</option>
      </select>
    </details>
  )
}
