import { useContext, useEffect, useRef, useState } from 'preact/hooks'
import { PLACE_NAME } from '../minigames/burg-funkelfels'
import type { Minigame } from '../minigames/model'
import { SettingsContext, text } from '../settings'
import { load, save } from '../store/db'
import { drawCollage } from './draw'
import { ARRANGEMENTS, CANVAS, CONTRIBUTIONS_KEY, MOODS, PREVIEW, SIZES, seedOf, type Contribution, type Settings } from './layout'

const SLIDERS = [
  { key: 'arrangement', label: 'Anordnung', steps: ARRANGEMENTS },
  { key: 'size', label: 'Größe', steps: SIZES },
  { key: 'mood', label: 'Farbstimmung', steps: MOODS },
] as const

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(`no ${type}`))), type))

async function previewOf(canvas: HTMLCanvasElement): Promise<Blob> {
  const small = document.createElement('canvas')
  small.width = small.height = PREVIEW
  small.getContext('2d')!.drawImage(canvas, 0, 0, PREVIEW, PREVIEW)
  const webp = await toBlob(small, 'image/webp')
  // Browsers without a WebP encoder hand back a PNG instead of failing.
  return webp.type === 'image/webp' ? webp : toBlob(small, 'image/jpeg')
}

/** Opens after the final quest, i.e. once every station of the place is done. */
export function Collage({ items, unlocked }: { items: Minigame[]; unlocked: boolean }) {
  const [selected, setSelected] = useState(() => items.map((item) => item.id))
  const [settings, setSettings] = useState<Settings>({ arrangement: 0, size: 1, mood: 0 })
  const [busy, setBusy] = useState(false)
  const [download, setDownload] = useState<string>()
  const [error, setError] = useState<string>()
  const canvas = useRef<HTMLCanvasElement>(null)
  const { easy } = useContext(SettingsContext)
  const name = (item: Minigame) => text(item.reward, easy)
  const chosen = items.filter((item) => selected.includes(item.id))

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) drawCollage(ctx, chosen.map((item) => item.item), settings, seedOf(selected))
  }, [selected, settings])
  useEffect(() => () => download && URL.revokeObjectURL(download), [download])

  const title = <h3 id="collage-title" tabIndex={-1}>Collage</h3>
  if (!unlocked) {
    return (
      <section aria-labelledby="collage-title">
        {title}
        <p>Die Collage öffnet sich, wenn ihr alle Stationen bei {PLACE_NAME} geschafft habt.</p>
      </section>
    )
  }

  const toggle = (id: string) =>
    setSelected(items.filter((item) => (item.id === id) !== selected.includes(item.id)).map((item) => item.id))

  async function exportCollage() {
    if (busy) return
    setBusy(true)
    try {
      const png = await toBlob(canvas.current!, 'image/png')
      const contribution: Contribution = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'item-collage',
        items: chosen.map((item) => item.id),
        released: false,
        png,
        preview: await previewOf(canvas.current!),
      }
      await save(CONTRIBUTIONS_KEY, [...((await load<Contribution[]>(CONTRIBUTIONS_KEY)) ?? []), contribution])
      setDownload(URL.createObjectURL(png))
      setError(undefined)
    } catch {
      setDownload(undefined)
      setError('Der Beitrag konnte nicht gespeichert werden.')
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="collage-title">
      {title}
      {error && <p role="alert">{error}</p>}
      <fieldset>
        <legend>Items für die Collage</legend>
        {items.map((item) => (
          <label key={item.id} class="check">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /> {name(item)}
          </label>
        ))}
      </fieldset>
      {SLIDERS.map(({ key, label, steps }) => (
        <label key={key}>
          {label}
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            value={settings[key]}
            aria-valuetext={steps[settings[key]].label}
            onInput={(e) => setSettings({ ...settings, [key]: Number(e.currentTarget.value) })}
          />
        </label>
      ))}
      {chosen.length === 0 ? (
        <p>Wählt mindestens ein Item aus, dann entsteht die Collage.</p>
      ) : (
        <canvas
          ref={canvas}
          width={CANVAS}
          height={CANVAS}
          class="collage"
          role="img"
          aria-label={`Collage aus: ${chosen.map(name).join(', ')}`}
        />
      )}
      <div class="actions">
        {/* aria-disabled, not disabled: a disabled button drops the keyboard focus to the page. */}
        <button type="button" disabled={chosen.length === 0} aria-disabled={busy} onClick={exportCollage}>Collage speichern</button>
        {download && <a href={download} download="collage.png">PNG herunterladen</a>}
      </div>
      <p role="status">{download && 'Gespeichert. Die Lehrkraft kann den Beitrag freigeben.'}</p>
    </section>
  )
}
