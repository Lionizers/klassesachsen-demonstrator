import { useEffect, useMemo, useState } from 'preact/hooks'
import { GROUP_KEY, SUGGESTED_NAMES, startCode, type Group } from '../group'
import { load, removeAllExcept, save } from '../store/db'
import { focusHeading } from '../focus'
import { SETTINGS_KEY } from '../settings'
import { PLACE_NAME, burgFunkelfels as GAMES } from '../minigames/burg-funkelfels'
import { MINIGAMES_KEY, demoSolvedIds, initialProgress, placeState, type Progress } from '../minigames/progress'
import { CONTRIBUTIONS_KEY, reviewLabel, type Contribution } from '../collage/layout'
import { DEMO_GROUPS } from '../teacher/demo'
import { INDICATORS, LEVELS, RETENTION_WEEKS, indicators, isExpired } from '../teacher/report'
import { useQrCodes } from '../qr-codes'
import { playScreen, type ScreenProps } from './types'

/** Only suggested names: the class list can never hold a child's name. */
export const CLASS_KEY = 'class'
export type ClassList = { names: string[] }
/** Everything else on the device belongs to its group, so a key added later is deleted with it. */
const removeGroupData = () => removeAllExcept([CLASS_KEY, SETTINGS_KEY])

export async function purgeExpired(now: number): Promise<void> {
  const [group, progress] = await Promise.all([load<Group>(GROUP_KEY), load<Progress>(MINIGAMES_KEY)])
  if (group && isExpired(group.createdAt, progress, GAMES, now)) await removeGroupData()
}

const DEMO = 'Beispielgruppe – erfundene Daten'
const STATUS = { new: 'noch nicht begonnen', started: 'unterwegs', done: 'Quest abgeschlossen' }
const itemName = (id: string) => GAMES.find((g) => g.id === id)?.reward.standard ?? id

type Row = { name: string; demo: boolean; progress?: Progress }
type View = { kind: 'overview' | 'codes' } | { kind: 'group' | 'raster' | 'report'; name: string }
/** `pickerOpen` is fixed at load: the picker must not fold away under the teacher's first choice. */
type Data = { cls?: ClassList; progress?: Progress; contributions: Contribution[]; pickerOpen: boolean }

export function Teacher({ go, group, setGroup }: ScreenProps) {
  const [view, setView] = useState<View>({ kind: 'overview' })
  const [data, setData] = useState<Data>()
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([load<ClassList>(CLASS_KEY), load<Progress>(MINIGAMES_KEY), load<Contribution[]>(CONTRIBUTIONS_KEY)]).then(
      ([cls, progress, contributions]) => {
        setData({ cls, progress, contributions: contributions ?? [], pickerOpen: !cls?.names.length })
        // The loaded view renders a new heading; the focus set on arrival went to the placeholder.
        focusHeading()
      },
      () => setError('Die Daten dieses Geräts konnten nicht geladen werden.'),
    )
  }, [])

  function show(next: View) {
    setView(next)
    setStatus('')
    focusHeading()
  }

  async function toggleClass(name: string) {
    const chosen = data!.cls?.names ?? []
    const names = SUGGESTED_NAMES.filter((n) => (n === name) !== chosen.includes(n))
    const before = data!.cls
    // Updated before the save, so a quick second click builds on this one.
    setData({ ...data!, cls: { names } })
    save(CLASS_KEY, { names }).catch(() => {
      setData((d) => ({ ...d!, cls: before }))
      setError('Die Gruppen der Klasse konnten nicht gespeichert werden.')
    })
  }

  async function decide(id: string, released: boolean) {
    const contributions = data!.contributions.map((c) => (c.id === id ? { ...c, released, reviewed: true } : c))
    try {
      await save(CONTRIBUTIONS_KEY, contributions)
    } catch {
      setError('Die Freigabe konnte nicht gespeichert werden.')
      return
    }
    setData({ ...data!, contributions })
  }

  async function deleteGroup(name: string) {
    if (!confirm(`Alle Daten der Gruppe ${name} auf diesem Gerät jetzt löschen? Das lässt sich nicht rückgängig machen.`)) return
    try {
      await removeGroupData()
    } catch {
      setError('Die Daten der Gruppe konnten nicht gelöscht werden.')
      return
    }
    setGroup(undefined)
    setData({ ...data!, progress: undefined, contributions: [] })
    show({ kind: 'overview' })
    setStatus(`Die Daten der Gruppe ${name} sind gelöscht.`)
  }

  const names = new Set([...(data?.cls?.names ?? []), ...(group ? [group.name] : [])])
  const rows: Row[] = [
    ...[...names].map((name) => ({ name, demo: false, progress: name === group?.name ? initialProgress(GAMES, data?.progress) : undefined })),
    ...DEMO_GROUPS.map((g) => ({ ...g, demo: true })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const row = 'name' in view ? rows.find((r) => r.name === view.name) : undefined
  // `end` marks the first action of a row that belongs on the right, after the ways back.
  const nav = (target: View, label: string, end?: boolean) => (
    <button type="button" class={end ? 'end' : undefined} onClick={() => show(target)}>{label}</button>
  )

  let content
  const backToApp = <button type="button" onClick={() => go(playScreen(group))}>Zurück zur App</button>
  const backToWelcome = <button type="button" onClick={() => go('welcome')}>Zurück zur Willkommensseite</button>
  if (!data) {
    content = (
      <>
        <h2 tabIndex={-1}>Lehrkräfte-Ansicht</h2>
        {/* Also the way out when loading failed. */}
        {backToApp}
        {backToWelcome}
      </>
    )
  } else if (view.kind === 'codes') {
    content = <Codes names={data.cls?.names ?? []} onError={setError} back={nav({ kind: 'overview' }, 'Zurück zur Übersicht')} />
  } else if (row?.progress && view.kind === 'raster') {
    const reached = indicators(row.progress, GAMES)
    content = (
      <>
        <h2 tabIndex={-1}>Kompetenzraster {row.name}</h2>
        {row.demo && <p class="demo">{DEMO}</p>}
        <table class="raster">
          <caption>Kompetenzraster der Gruppe {row.name} · Zuordnung nach Beispielregel</caption>
          <thead>
            <tr>
              <th scope="col">Indikator</th>
              {LEVELS.map((level) => <th key={level} scope="col">{level}</th>)}
            </tr>
          </thead>
          <tbody>
            {INDICATORS.map((indicator, i) => (
              <tr key={indicator.id}>
                <th scope="row">{indicator.name}</th>
                {indicator.descriptions.map((text, l) => (
                  <td key={l} class={reached[i].level === l + 1 ? 'reached' : undefined}>
                    {text}
                    {reached[i].level === l + 1 && <strong> · erreicht</strong>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {nav({ kind: 'group', name: row.name }, 'Zurück zur Gruppenansicht')}
      </>
    )
  } else if (row?.progress && view.kind === 'report') {
    const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    content = (
      <>
        <h2 tabIndex={-1}>Bericht {row.name}</h2>
        {row.demo && <p class="demo">{DEMO}</p>}
        <p>Quest: {PLACE_NAME}</p>
        <p>Datum: {date}</p>
        {indicators(row.progress, GAMES).map((i) => <div key={i.id}><Indicator {...i} /></div>)}
        <p>Die Zuordnung zu den Niveaustufen ist eine Beispielregel. Der Bericht beschreibt die Gruppe als Ganzes und ist eine Grundlage für das Gespräch mit der Klasse.</p>
        <div class="actions">
          {nav({ kind: 'group', name: row.name }, 'Zurück zur Gruppenansicht')}
          <button type="button" class="end" onClick={() => print()}>Drucken oder als PDF speichern</button>
        </div>
      </>
    )
  } else if (row?.progress && view.kind === 'group') {
    const demoIds = demoSolvedIds(row.progress)
    const demoSolved = GAMES.filter((g) => demoIds.has(g.id))
    content = (
      <>
        <h2 tabIndex={-1}>Gruppenansicht {row.name}</h2>
        {row.demo && <p class="demo">{DEMO}</p>}
        {demoSolved.length > 0 && (
          <p class="demo">Per Demo-Hilfe als gelöst markiert, nicht gespielt: {demoSolved.map((g) => g.title.standard).join(', ')}</p>
        )}
        <ul aria-label="Indikatoren" class="checklist">
          {indicators(row.progress, GAMES).map((i) => <li key={i.id}><Indicator {...i} /></li>)}
        </ul>
        <div class="actions">
          {nav({ kind: 'overview' }, 'Zurück zur Übersicht')}
          {nav({ kind: 'raster', name: row.name }, 'Kompetenzraster', true)}
          {nav({ kind: 'report', name: row.name }, 'Bericht')}
        </div>
        {!row.demo && (
          <>
            <h3>Bildbeiträge</h3>
            {data.contributions.length === 0 ? (
              <p>Noch keine Bildbeiträge.</p>
            ) : (
              <Contributions list={data.contributions} decide={decide} />
            )}
            <h3>Daten löschen</h3>
            <p>Löscht sofort alle Daten dieser Gruppe auf diesem Gerät. Ohne Löschen geschieht das {RETENTION_WEEKS} Wochen nach Abschluss der Quest oder nach der letzten Aktivität, spätestens am 1. August zum Ende des Schuljahres.</p>
            <button type="button" class="danger" onClick={() => deleteGroup(row.name)}>Daten der Gruppe löschen</button>
          </>
        )}
      </>
    )
  } else {
    const chosen = data.cls?.names ?? []
    content = (
      <>
        <h2 tabIndex={-1}>Lehrkräfte-Ansicht</h2>
        <p class="role">Die Lehrkräfte-Ansicht ist die zweite Rolle der App: Hier begleitet die Lehrkraft ihre Klasse, sieht den Stand jeder Gruppe und gibt Bildbeiträge frei.</p>
        <p class="hint">Ausschnitt für die Vorführung, ohne Anmeldung und ohne PIN. Die App erfasst nur Gruppen, keine einzelnen Kinder.</p>
        <h3>Übersicht</h3>
        <ul aria-label="Gruppen" class="checklist two">
          {rows.map((r) => {
            const p = r.progress && initialProgress(GAMES, r.progress)
            const station = p && (GAMES.find((g) => p.status[g.id] !== 'done')?.title.standard ?? 'alle geschafft')
            return (
              <li key={r.name}>
                <strong>{r.name}</strong>
                {r.demo && <span class="demo">{DEMO}</span>}
                {p ? (
                  <>
                    <p>
                      Station: {station} · Status: {STATUS[placeState(p)]}
                      {demoSolvedIds(p).size > 0 && ' · teils per Demo-Hilfe gelöst'}
                    </p>
                    {nav({ kind: 'group', name: r.name }, `${r.name} ansehen`)}
                  </>
                ) : (
                  <>
                    <p>Noch nicht gestartet – Startcode verteilen</p>
                    {nav({ kind: 'codes' }, `Startcode für ${r.name}`)}
                  </>
                )}
              </li>
            )
          })}
        </ul>
        <details class="picker" open={data.pickerOpen}>
          <summary>Gruppen der Klasse für die Startcodes ({chosen.length} von {SUGGESTED_NAMES.length} gewählt)</summary>
          <div role="group" aria-label="Gruppen der Klasse" class="class-tiles">
            {SUGGESTED_NAMES.map((name) => (
              <button key={name} type="button" aria-pressed={chosen.includes(name)} onClick={() => toggleClass(name)}>{name}</button>
            ))}
          </div>
        </details>
        <div class="actions">
          {backToApp}
          {backToWelcome}
          {nav({ kind: 'codes' }, 'Startcodes drucken', true)}
        </div>
      </>
    )
  }

  return (
    <section class="teacher">
      {error && <p role="alert">{error}</p>}
      {content}
      {/* Always rendered: a live region must exist before its text arrives to be announced. */}
      <p role="status">{status}</p>
    </section>
  )
}

function Indicator({ name, levelName, description, rule }: ReturnType<typeof indicators>[number]) {
  return (
    <>
      <h3>{name}</h3>
      <p class="pill">Niveaustufe: {levelName}</p>
      <p>{description}</p>
      <p class="hint">{rule}</p>
    </>
  )
}

function Contributions({ list, decide }: { list: Contribution[]; decide: (id: string, released: boolean) => void }) {
  const urls = useMemo(() => list.map((c) => URL.createObjectURL(c.preview)), [list])
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls])
  return (
    <ul aria-label="Bildbeiträge" class="items">
      {list.map((c, i) => (
        <li key={c.id}>
          <img src={urls[i]} width={96} height={96} alt={`Collage aus: ${c.items.map(itemName).join(', ')}`} />
          <div role="group" aria-label={`Beitrag ${i + 1}`} class="actions">
            <button type="button" aria-pressed={!!c.reviewed && c.released} onClick={() => decide(c.id, true)}>Freigeben</button>
            <button type="button" aria-pressed={!!c.reviewed && !c.released} onClick={() => decide(c.id, false)}>Verweigern</button>
          </div>
          <p role="status">Beitrag {i + 1}: {reviewLabel(c)}</p>
        </li>
      ))}
    </ul>
  )
}

function Codes({ names, onError, back }: { names: string[]; onError: (e: string) => void; back: preact.JSX.Element }) {
  const qr = useQrCodes(
    names.map((n) => `${location.origin}/?start=${encodeURIComponent(startCode(n))}`),
    () => onError('Die QR-Codes konnten nicht erzeugt werden.'),
  )
  return (
    <>
      <h2 tabIndex={-1}>Startcodes</h2>
      {names.length === 0 ? (
        <p>Wählt zuerst in der Übersicht die Gruppen der Klasse aus.</p>
      ) : (
        <ul aria-label="Startcodes" class="codes">
          {names.map((n, i) => (
            <li key={n}>
              <h3>Gruppe {n}</h3>
              <p>Startcode: <strong>{startCode(n)}</strong></p>
              {qr[i] && <img src={qr[i]} width={192} height={192} alt={`QR-Code für Gruppe ${n}`} />}
            </li>
          ))}
        </ul>
      )}
      <div class="actions">
        {back}
        <button type="button" class="end" onClick={() => print()}>Drucken</button>
      </div>
    </>
  )
}
