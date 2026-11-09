"""Genera los íconos de la PWA (PNG) sin dependencias: un monitor de PC con la pantalla
encendida sobre fondo oscuro. Uso: python tools/make-icons.py  (escribe en public/)."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "public")

BG = (27, 24, 20)
FRAME = (243, 234, 217)
SCREEN = (31, 58, 92)
GLOW = (255, 122, 69)
GREEN = (63, 224, 122)


def png(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(c for px in pixels[y * w:(y + 1) * w] for c in px) for y in range(h))
    def chunk(kind, data):
        c = struct.pack(">I", len(data)) + kind + data
        return c + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


def icon(size, pad=0.0):
    """pad: margen extra (íconos 'maskable', que Android recorta en círculo)."""
    px = [BG] * (size * size)
    s = size * (1 - 2 * pad)
    o = size * pad

    def rect(x0, y0, x1, y1, col):
        for y in range(int(o + y0 * s), int(o + y1 * s)):
            for x in range(int(o + x0 * s), int(o + x1 * s)):
                px[y * size + x] = col

    def circle(cx, cy, r, col):
        R = r * s
        X, Y = o + cx * s, o + cy * s
        for y in range(int(Y - R), int(Y + R) + 1):
            for x in range(int(X - R), int(X + R) + 1):
                if 0 <= x < size and 0 <= y < size and (x - X) ** 2 + (y - Y) ** 2 <= R * R:
                    px[y * size + x] = col

    rect(0.14, 0.18, 0.86, 0.68, FRAME)   # marco del monitor
    rect(0.19, 0.23, 0.81, 0.63, SCREEN)  # pantalla
    rect(0.44, 0.68, 0.56, 0.78, FRAME)   # pie
    rect(0.30, 0.78, 0.70, 0.83, FRAME)   # base
    circle(0.50, 0.43, 0.11, GLOW)        # fuego/"Libro" en la pantalla
    circle(0.50, 0.46, 0.05, (255, 210, 120))
    circle(0.73, 0.30, 0.025, GREEN)      # el brillo verde de la cueva
    return px


os.makedirs(OUT, exist_ok=True)
for name, size, pad in [("icon-180.png", 180, 0), ("icon-192.png", 192, 0), ("icon-512.png", 512, 0), ("icon-maskable-512.png", 512, 0.1)]:
    png(os.path.join(OUT, name), size, size, icon(size, pad))
    print("ok", name)
