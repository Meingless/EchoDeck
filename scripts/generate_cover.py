import math, struct, zlib, os

W, H = 630, 500
SS = 3
WS, HS = W * SS, H * SS

ACCENT = (139, 124, 247)
ACCENT_DIM = (166, 158, 240)
TEXT = (232, 234, 240)
MUTED = (150, 155, 166)

FONT = {
    'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    'B': ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    'C': ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    'H': ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    'K': ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    'S': ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
}

BARS = [(0, 14, 8, 26), (12, 0, 8, 54), (24, 19, 8, 35), (36, 12, 8, 36), (48, 24, 8, 22)]


def glyph_width(text, scale, tracking):
    return len(text) * 5 * scale + (len(text) - 1) * tracking


def draw_text(buf, text, cx, cy, scale, tracking, color):
    total = glyph_width(text, scale, tracking)
    x0 = int(cx - total / 2)
    for i, ch in enumerate(text):
        g = FONT.get(ch)
        if not g:
            continue
        gx = x0 + i * (5 * scale + tracking)
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == '1':
                    for py in range(cy + ry * scale, cy + (ry + 1) * scale):
                        for px in range(gx + rx * scale, gx + (rx + 1) * scale):
                            if 0 <= px < WS and 0 <= py < HS:
                                buf[py * WS + px] = color


def rounded_rect_mask(x, y, x0, y0, w, h, r):
    if not (x0 <= x < x0 + w and y0 <= y < y0 + h):
        return False
    lx, ly = x - x0, y - y0
    cx = min(max(lx, r), w - r)
    cy = min(max(ly, r), h - r)
    return (lx - cx) ** 2 + (ly - cy) ** 2 <= r * r


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


canvas = [None] * (WS * HS)

for y in range(HS):
    t = y / HS
    base = lerp((10, 11, 14), (22, 24, 30), t)
    for x in range(WS):
        dx = (x / WS - 0.5) * 2
        dy = (y / HS - 0.5) * 2
        d = math.sqrt(dx * dx + dy * dy)
        v = max(0.0, d - 0.55) * 0.55
        c = lerp(base, (0, 0, 0), min(1, v))
        canvas[y * WS + x] = c

mark_cx = WS / 2
mark_scale = SS * 2.2
mark_w = 56 * mark_scale
mark_h = 54 * mark_scale
mx0 = int(mark_cx - mark_w / 2)
my0 = int(HS * 0.16)

for y in range(my0, my0 + int(mark_h) + 2):
    for x in range(mx0 - 2, mx0 + int(mark_w) + 2):
        lx = (x - mx0) / mark_scale
        ly = (y - my0) / mark_scale
        on = any(bx <= lx < bx + bw and by <= ly < by + bh for bx, by, bw, bh in BARS)
        if on:
            canvas[y * WS + x] = ACCENT

line_y = int(HS * 0.52)
line_w = int(WS * 0.16)
for x in range(int(WS / 2 - line_w / 2), int(WS / 2 + line_w / 2)):
    for y in range(line_y, line_y + 2 * SS):
        canvas[y * WS + x] = lerp(ACCENT, (40, 42, 52), (x - (WS / 2 - line_w / 2)) / line_w * 0.7)

draw_text(canvas, 'ECHODECK', WS / 2, int(HS * 0.60), int(SS * 3.4), int(SS * 2.4), TEXT)
draw_text(canvas, 'SOUNDBOARD', WS / 2, int(HS * 0.80), int(SS * 1.6), int(SS * 4.2), ACCENT_DIM)

rows = []
for y in range(H):
    row = bytearray([0])
    for x in range(W):
        r = g = b = 0
        for sy in range(SS):
            for sx in range(SS):
                c = canvas[(y * SS + sy) * WS + (x * SS + sx)]
                r += c[0]
                g += c[1]
                b += c[2]
        n = SS * SS
        row += bytes((r // n, g // n, b // n, 255))
    rows.append(bytes(row))

raw = b''.join(rows)


def chunk(tag, data):
    c = tag + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)


png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(raw, 9))
png += chunk(b'IEND', b'')

out = os.path.join(os.path.dirname(__file__), '..', 'resources', 'cover.png')
with open(out, 'wb') as f:
    f.write(png)
print('cover written:', out)
