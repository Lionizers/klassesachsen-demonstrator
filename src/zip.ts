const TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})

export function crc32(data: Uint8Array): number {
  let crc = ~0
  for (const byte of data) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return ~crc >>> 0
}

/** Little-endian fields of 2 or 4 bytes. */
function fields(...values: [number, 2 | 4][]): Uint8Array {
  const out = new Uint8Array(values.reduce((sum, [, width]) => sum + width, 0))
  const view = new DataView(out.buffer)
  let at = 0
  for (const [value, width] of values) {
    if (width === 2) view.setUint16(at, value, true)
    else view.setUint32(at, value, true)
    at += width
  }
  return out
}

// 01.01.1980, the earliest DOS date: the export carries no time of its own.
const DATE = (1 << 5) | 1

/** Stored, not compressed: PNG, WebP and JPEG are compressed already. ASCII names only. */
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(data)
    // version needed, flags, method, time, date, crc, compressed size, size, name length, extra length
    const common: [number, 2 | 4][] = [[10, 2], [0, 2], [0, 2], [0, 2], [DATE, 2], [crc, 4], [data.length, 4], [data.length, 4], [nameBytes.length, 2], [0, 2]]
    parts.push(fields([0x04034b50, 4], ...common), nameBytes, data)
    // + comment length, disk, internal and external attributes, offset of the local header
    central.push(fields([0x02014b50, 4], [10, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = fields([0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [centralSize, 4], [offset, 4], [0, 2])
  const all = [...parts, ...central, end]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}
