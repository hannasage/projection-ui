// A small reader for zip files. It lists the entries from the central directory and inflates one entry.
// It refuses anything it cannot read, so a file of garbage bytes with a zip signature in front does not pass.
import { inflateRawSync } from "node:zlib";

/** Returns `{ ok: true, entries }` or `{ ok: false, error }`. Each entry is { name, method, compressedSize, size, offset }. */
export function readZip(buffer) {
  if (buffer.length < 22) return { ok: false, error: "the file is too short to be a zip" };
  const floor = Math.max(0, buffer.length - 22 - 0xffff);
  let end = -1;
  for (let index = buffer.length - 22; index >= floor; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) return { ok: false, error: "no end-of-directory record, so this is not a complete zip" };
  const count = buffer.readUInt16LE(end + 10);
  const size = buffer.readUInt32LE(end + 12);
  const offset = buffer.readUInt32LE(end + 16);
  if (offset + size > end) return { ok: false, error: "the central directory is out of range" };
  const entries = [];
  let cursor = offset;
  for (let item = 0; item < count; item += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) return { ok: false, error: "the central directory is damaged" };
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    entries.push({ name, method: buffer.readUInt16LE(cursor + 10), compressedSize: buffer.readUInt32LE(cursor + 20), size: buffer.readUInt32LE(cursor + 24), offset: buffer.readUInt32LE(cursor + 42) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { ok: true, entries };
}

/** Returns the bytes of one entry, or null when the entry cannot be read or its size is wrong. */
export function zipEntryData(buffer, entry) {
  try {
    if (buffer.readUInt32LE(entry.offset) !== 0x04034b50) return null;
    const start = entry.offset + 30 + buffer.readUInt16LE(entry.offset + 26) + buffer.readUInt16LE(entry.offset + 28);
    const raw = buffer.subarray(start, start + entry.compressedSize);
    const data = entry.method === 0 ? raw : entry.method === 8 ? inflateRawSync(raw) : null;
    return data !== null && data.length === entry.size ? data : null;
  } catch {
    return null;
  }
}
