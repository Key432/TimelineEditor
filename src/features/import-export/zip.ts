import { deflateRawSync, inflateRawSync } from "node:zlib";

const encoder = new TextEncoder();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function createZip(files: { name: string; content: string }[], method: 0 | 8) {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const compressed =
      method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + compressed.length);
    const localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, 0x0800);
    u16(localView, 8, method);
    u32(localView, 14, crc);
    u32(localView, 18, compressed.length);
    u32(localView, 22, data.length);
    u16(localView, 26, name.length);
    local.set(name, 30);
    local.set(compressed, 30 + name.length);
    chunks.push(local);
    const entry = new Uint8Array(46 + name.length);
    const entryView = new DataView(entry.buffer);
    u32(entryView, 0, 0x02014b50);
    u16(entryView, 4, 20);
    u16(entryView, 6, 20);
    u16(entryView, 8, 0x0800);
    u16(entryView, 10, method);
    u32(entryView, 16, crc);
    u32(entryView, 20, compressed.length);
    u32(entryView, 24, data.length);
    u16(entryView, 28, name.length);
    u32(entryView, 42, offset);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length;
  }
  const centralSize = central.reduce((sum, value) => sum + value.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, files.length);
  u16(endView, 10, files.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, offset);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const chunk of [...chunks, ...central, end]) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}

export function createStoredZip(files: { name: string; content: string }[]) {
  return createZip(files, 0);
}

export function createDeflatedZip(files: { name: string; content: string }[]) {
  return createZip(files, 8);
}

export function readStoredZip(input: Uint8Array) {
  const files = new Map<string, string>();
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let offset = 0;
  while (
    offset + 30 <= input.length &&
    view.getUint32(offset, true) === 0x04034b50
  ) {
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    if ((flags & 0x08) !== 0 || (method !== 0 && method !== 8))
      throw new Error("このZIP圧縮方式には対応していません。");
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = new TextDecoder().decode(
      input.subarray(nameStart, nameStart + nameLength),
    );
    const compressed = input.subarray(dataStart, dataStart + compressedSize);
    const data =
      method === 8 ? new Uint8Array(inflateRawSync(compressed)) : compressed;
    files.set(
      name,
      new TextDecoder("utf-8").decode(data).replace(/^\uFEFF/, ""),
    );
    offset = dataStart + compressedSize;
  }
  return files;
}
