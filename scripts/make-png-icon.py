#!/usr/bin/env python3
"""Generate square PNG app icons (favicons, App Store icons) from the logo.

Pure-python PNG decode/encode — no PIL/ImageMagick needed.

Usage:
    python3 scripts/make-png-icon.py <src.png> <out.png> <size>
"""

import struct
import sys
import zlib


def decode_png(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos = 8
    width = height = bit_depth = color_type = None
    idat = b""
    while pos < len(data):
        length, ctype = struct.unpack(">I4s", data[pos : pos + 8])
        chunk = data[pos + 8 : pos + 8 + length]
        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            if bit_depth != 8:
                raise ValueError(f"unsupported bit depth {bit_depth}")
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"PLTE" and color_type in (3,):
            raise ValueError("palette PNGs not supported")
        pos += 12 + length
    if color_type not in (2, 6):
        raise ValueError(f"unsupported color type {color_type}")
    channels = 4 if color_type == 6 else 3
    raw = zlib.decompress(idat)
    bpp = channels
    stride = width * bpp
    rows = []
    prev = bytearray(stride)
    off = 0
    for _ in range(height):
        ftype = raw[off]
        off += 1
        row = bytearray(raw[off : off + stride])
        off += stride
        if ftype == 1:
            for i in range(bpp, stride):
                row[i] = (row[i] + row[i - bpp]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                row[i] = (row[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(bpp, stride):
                row[i] = (row[i] + ((row[i - bpp] + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = row[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                row[i] = (row[i] + pred) & 0xFF
        rows.append(row)
        prev = row
    return width, height, channels, rows


def encode_png(size, rows):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(ctype, payload):
        return struct.pack(">I", len(payload)) + ctype + payload + struct.pack(
            ">I", zlib.crc32(ctype + payload) & 0xFFFFFFFF
        )

    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    idat = chunk(b"IDAT", zlib.compress(raw, 9))
    return b"\x89PNG\r\n\x1a\n" + ihdr + idat + chunk(b"IEND", b"")


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    src, out, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
    with open(src, "rb") as f:
        data = f.read()
    w, h, channels, rows = decode_png(data)
    scale = min(size / w, size / h)
    tw, th = max(1, round(w * scale)), max(1, round(h * scale))
    ox, oy = (size - tw) // 2, (size - th) // 2

    def px(x, y):
        if x < 0 or x >= w or y < 0 or y >= h:
            return (0, 0, 0, 0)
        r = rows[y]
        i = x * channels
        if channels == 4:
            return (r[i], r[i + 1], r[i + 2], r[i + 3])
        return (r[i], r[i + 1], r[i + 2], 255)

    canvas = [[(0, 0, 0, 0)] * size for _ in range(size)]
    for dy in range(th):
        for dx in range(tw):
            canvas[oy + dy][ox + dx] = px(
                min(w - 1, int(dx / tw * w)), min(h - 1, int(dy / th * h))
            )
    flat = []
    for row in canvas:
        for r, g, b, a in row:
            flat += [r, g, b, a]
    enc_rows = [bytes(flat[y * size * 4 : (y + 1) * size * 4]) for y in range(size)]
    with open(out, "wb") as f:
        f.write(encode_png(size, enc_rows))
    print(f"wrote {out} ({size}x{size}) from {src}")


if __name__ == "__main__":
    main()