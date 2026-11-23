import { expect, it } from 'vitest'
import { crc32, zip } from './zip'

const bytes = (s: string) => new TextEncoder().encode(s)

it('AE9: CRC32 matches the standard check value', () => {
  expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  expect(crc32(new Uint8Array())).toBe(0)
})

it('AE9: the archive has local headers, a central directory and an end record that point at each other', () => {
  const files = [
    { name: 'a.json', data: bytes('{"a":1}') },
    { name: 'b.png', data: new Uint8Array([137, 80, 78, 71, 0, 255]) },
  ]
  const out = zip(files)
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
  const end = out.length - 22
  expect(view.getUint32(0, true)).toBe(0x04034b50)
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  expect(view.getUint16(end + 10, true)).toBe(2)
  let central = view.getUint32(end + 16, true)
  expect(central + view.getUint32(end + 12, true)).toBe(end)

  for (const file of files) {
    expect(view.getUint32(central, true)).toBe(0x02014b50)
    const nameLength = view.getUint16(central + 28, true)
    expect(new TextDecoder().decode(out.subarray(central + 46, central + 46 + nameLength))).toBe(file.name)
    expect(view.getUint16(central + 10, true)).toBe(0) // stored, not compressed
    expect(view.getUint32(central + 16, true)).toBe(crc32(file.data))
    const local = view.getUint32(central + 42, true)
    expect(view.getUint32(local, true)).toBe(0x04034b50)
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    expect(out.subarray(start, start + view.getUint32(local + 18, true))).toEqual(file.data)
    central += 46 + nameLength
  }
})

it('AE9: an empty export is still a valid archive', () => {
  const out = zip([])
  expect(out).toHaveLength(22)
  expect(new DataView(out.buffer).getUint32(0, true)).toBe(0x06054b50)
})
