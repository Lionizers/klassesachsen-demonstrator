import { MINIGAME_PLACE, PLACES } from '../places/places'
import type { Minigame, Text } from './model'

export const PLACE_NAME = PLACES.find((p) => p.id === MINIGAME_PLACE)!.name
export const GUIDE_NAME = 'Fuchs Fidelius'
export const PLACE_WELCOME: Text = {
  standard: 'Willkommen am Burgtor! Wählt eine Station, die Reihenfolge ist euch überlassen.',
  easy: 'Willkommen an der Burg! Sucht euch eine Station aus. Ihr dürft anfangen, wo ihr wollt.',
}
/** What the guide says on a station before the group asked for a hint. */
export const ASK_FOR_HELP: Text = { standard: 'Kommt ihr nicht weiter? Fragt mich um Hilfe.', easy: 'Ihr wisst nicht weiter? Fragt mich.' }

export const burgFunkelfels: Minigame[] = [
  {
    id: 'turmuhr',
    kind: 'puzzle',
    title: { standard: 'Die stehende Turmuhr', easy: 'Die Turmuhr steht still' },
    prompt: {
      standard:
        'Die Turmuhr von Burg Funkelfels ist stehen geblieben, weil der Burggeist die Zahnräder durcheinandergebracht hat. Bringt die Schritte in die passende Reihenfolge: vom Aufziehen bis zum Glockenschlag.',
      easy: 'Die Turmuhr ist kaputt. Bringt die Schritte in die passende Reihenfolge. Der erste Schritt ist das Aufziehen.',
    },
    pieces: [
      { standard: 'Der große Zeiger rückt eine Minute weiter.', easy: 'Der Zeiger geht weiter.' },
      { standard: 'Die Burgwartin zieht die Kurbel auf.', easy: 'Die Burgwartin dreht an der Kurbel.' },
      { standard: 'Das große Zahnrad dreht sich langsam.', easy: 'Das große Rad dreht sich langsam.' },
      {
        standard: 'Um zwölf Uhr schlägt die Glocke und alle Fledermäuse im Turm wachen auf.',
        easy: 'Die Glocke schlägt. Die Fledermäuse wachen auf.',
      },
      { standard: 'Das schwere Gewicht sinkt langsam nach unten.', easy: 'Das schwere Gewicht sinkt nach unten.' },
      { standard: 'Das kleine Zahnrad dreht sich schneller.', easy: 'Das kleine Rad dreht sich schnell.' },
    ],
    solution: [1, 4, 2, 5, 0, 3],
    hints: [
      {
        standard: 'Ohne Aufziehen bewegt sich gar nichts. Fangt also bei der Kurbel an.',
        easy: 'Fangt mit der Kurbel an.',
      },
      {
        standard: 'Das Gewicht treibt das große Zahnrad an, und das große treibt das kleine an.',
        easy: 'Erst das Gewicht. Dann das große Rad. Dann das kleine Rad.',
      },
    ],
    reward: { standard: 'ein glänzendes Messingzahnrad', easy: 'ein glänzendes Zahnrad' },
    item: {
      at: [40, 62],
      paths: [
        {
          d: 'M14 1h4v6h-4ZM14 25h4v6h-4ZM1 14h6v4H1ZM25 14h6v4h-6ZM4.7 7.5l2.8-2.8 4.2 4.2-2.8 2.8ZM20.3 23.1l2.8-2.8 4.2 4.2-2.8 2.8ZM4.7 24.5l4.2-4.2 2.8 2.8-4.2 4.2ZM20.3 8.9l4.2-4.2 2.8 2.8-4.2 4.2ZM5 16a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z',
          fill: '#d4a017',
        },
        { d: 'M11 16a5 5 0 1 0 10 0a5 5 0 1 0-10 0Z', fill: '#7a5c0f' },
      ],
    },
  },
  {
    id: 'kanonenkugelkiste',
    kind: 'estimate',
    title: { standard: 'Die Kanonenkugelkiste', easy: 'Die Kiste mit den Keksen' },
    prompt: {
      standard:
        'In der alten Kanonenkugelkiste liegen schon lange keine Kanonenkugeln mehr. Der Burgkoch versteckt dort seine Kekse. In der obersten Lage seht ihr ungefähr 40 Kekse, und die Kiste ist etwa drei Lagen hoch. Wie viele Kekse liegen in der Kiste?',
      easy: 'In der Kiste liegen Kekse. Oben liegen ungefähr 40 Kekse. Es gibt etwa 3 Lagen. Wie viele Kekse sind in der Kiste?',
    },
    target: 120,
    unit: 'Kekse',
    tolerancePercent: 10,
    hints: [
      { standard: 'Zählt zuerst, wie viele Kekse in eine Lage passen.', easy: 'Wie viele Kekse sind in einer Lage?' },
      {
        standard: 'Wenn eine Lage etwa 40 Kekse hat, wie viele haben dann drei Lagen zusammen?',
        easy: 'Rechnet: 3 Lagen mal 40 Kekse.',
      },
    ],
    reward: { standard: 'ein Keks des Burgkochs mit Zuckerwappen', easy: 'ein Keks vom Burgkoch' },
    item: {
      at: [76, 70],
      paths: [
        { d: 'M3 16a13 13 0 1 0 26 0a13 13 0 1 0-26 0Z', fill: '#d9a05b' },
        { d: 'M11 9h10v7c0 4-2.5 6.5-5 8c-2.5-1.5-5-4-5-8Z', fill: '#b23a48' },
        { d: 'M7 13a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0ZM22 21a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0ZM8 21a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z', fill: '#8a5a2b' },
      ],
    },
  },
  {
    id: 'drachenbesuch',
    kind: 'dilemma',
    title: { standard: 'Besuch vom Drachen', easy: 'Ein Drache will zu Besuch' },
    prompt: {
      standard:
        'Ein kleiner, sehr höflicher Drache steht vor dem Burgtor und möchte zum Tee kommen. Die Zugbrücke ist alt und knarrt bei jedem Schritt. Was macht ihr?',
      easy: 'Ein freundlicher Drache steht vor der Burg. Er möchte Tee trinken. Die Brücke ist alt. Was macht ihr?',
    },
    options: [
      {
        label: { standard: 'Zugbrücke herunterlassen', easy: 'Die Brücke runterlassen' },
        consequence: {
          standard:
            'Der Drache trippelt vorsichtig über die Brücke. Sie hält, knarrt aber so laut, dass die Burgkatze sich den Rest des Tages im Turm versteckt. Im Burghof wärmt der Drache mit seinem Atem die Teekanne.',
          easy: 'Der Drache kommt über die Brücke. Die Brücke hält. Die Katze hat Angst. Der Drache macht den Tee warm.',
        },
      },
      {
        label: { standard: 'Einen Brief schreiben', easy: 'Einen Brief schreiben' },
        consequence: {
          standard:
            'Ihr schreibt dem Drachen einen freundlichen Brief und schlagt ein Picknick auf der Wiese vor. Der Drache bringt Pflaumenkuchen mit. Die Zugbrücke bleibt geschont, aber das Picknick beginnt erst am Abend.',
          easy: 'Ihr schreibt dem Drachen einen Brief. Ihr macht ein Picknick auf der Wiese. Der Drache bringt Kuchen mit.',
        },
      },
    ],
    hints: [
      {
        standard: 'Überlegt gemeinsam: Was ist der Burg heute wichtiger, die alte Brücke oder ein gemütlicher Tee?',
        easy: 'Was ist euch wichtiger: die alte Brücke oder Tee mit dem Drachen?',
      },
    ],
    reward: { standard: 'eine schimmernde Drachenschuppe als Andenken', easy: 'eine Drachenschuppe' },
    item: {
      at: [40, 0],
      paths: [
        { d: 'M16 2C25 7 29 16 16 30C3 16 7 7 16 2Z', fill: '#2a9d8f' },
        { d: 'M16 8C21 11 23 17 16 24Z', fill: '#9ee0d6' },
      ],
    },
  },
]
