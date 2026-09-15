import math, struct, wave, zlib, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'resources', 'demo')
os.makedirs(OUT, exist_ok=True)
SR = 44100

def write_wav(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for s in samples:
            s = max(-1.0, min(1.0, s))
            frames += struct.pack('<h', int(s * 32000))
        w.writeframes(bytes(frames))

def env(i, n, a=0.01, r=0.3):
    t = i / SR
    total = n / SR
    attack = max(t / max(a, 1e-4), 0.0) if a > 0 else 1.0
    rel = max((total - t) / r, 0.0) if r > 0 else 1.0
    return min(1.0, attack, min(1.0, rel))

# Laser: descending square sweep
n = int(SR * 0.42)
s = []
phase = 0.0
for i in range(n):
    t = i / n
    f = 1400 * (2 ** (-2.2 * t)) + 60
    phase += f / SR
    square = 1.0 if (phase % 1.0) < 0.5 else -1.0
    s.append(0.5 * square * env(i, n, 0.004, 0.16))
write_wav('Laser.wav', s)

# Riser: rising sawtooth with tremolo
n = int(SR * 1.1)
s = []
phase = 0.0
for i in range(n):
    t = i / n
    f = 160 * (2 ** (2.0 * t))
    phase += f / SR
    saw = 2.0 * (phase % 1.0) - 1.0
    trem = 0.75 + 0.25 * math.sin(2 * math.pi * 9 * t)
    s.append(0.42 * saw * trem * env(i, n, 0.03, 0.12))
write_wav('Riser.wav', s)

# Kick: pitch-dropping sine
n = int(SR * 0.36)
s = []
phase = 0.0
for i in range(n):
    t = i / SR
    f = 150 * math.exp(-t * 24) + 42
    phase += f / SR
    amp = math.exp(-t * 11)
    click = math.exp(-t * 220) * 0.4
    s.append(0.9 * math.sin(2 * math.pi * phase) * amp + click)
write_wav('Kick.wav', s)

# Siren: alternating tones
n = int(SR * 1.0)
s = []
phase = 0.0
for i in range(n):
    t = i / SR
    f = 620 if (int(t * 3) % 2 == 0) else 460
    slide = f * (1 + 0.04 * math.sin(2 * math.pi * 6 * t))
    phase += slide / SR
    s.append(0.4 * math.sin(2 * math.pi * phase) * env(i, n, 0.01, 0.1))
write_wav('Siren.wav', s)

# Chime: detuned bell partials
n = int(SR * 1.4)
s = []
for i in range(n):
    t = i / SR
    v = 0.0
    v += 0.5 * math.sin(2 * math.pi * 880 * t) * math.exp(-t * 3.2)
    v += 0.3 * math.sin(2 * math.pi * 1322 * t) * math.exp(-t * 4.5)
    v += 0.2 * math.sin(2 * math.pi * 1764 * t) * math.exp(-t * 6.0)
    s.append(v * env(i, n, 0.002, 0.4))
write_wav('Chime.wav', s)

print('demo sounds written:', os.listdir(OUT))

# ---- App icon (512px) ----
SIZE = 512
S = SIZE / 256.0
R = 58 * S
ACCENT = (139, 124, 247)
BARS = [(62, 96, 22, 64, 11), (92, 62, 22, 132, 11), (122, 108, 22, 86, 11), (152, 84, 22, 88, 11), (182, 118, 22, 54, 11)]

def rounded_mask(x, y, r=R):
    # rounded-square mask with margin 8
    m = 8 * S
    size = SIZE - 2 * m
    if not (m <= x < SIZE - m and m <= y < SIZE - m):
        return False
    lx, ly = x - m, y - m
    cx = min(max(lx, r), size - r)
    cy = min(max(ly, r), size - r)
    return (lx - cx) ** 2 + (ly - cy) ** 2 <= r * r

def bar_mask(x, y, bx, by, bw, bh, br):
    if not (bx <= x < bx + bw and by <= y < by + bh):
        return False
    lx, ly = x - bx, y - by
    cx = min(max(lx, br), bw - br)
    cy = min(max(ly, br), bh - br)
    return (lx - cx) ** 2 + (ly - cy) ** 2 <= br * br

rows = []
for y in range(SIZE):
    row = bytearray([0])
    for x in range(SIZE):
        if rounded_mask(x, y):
            t = y / SIZE
            base = (
                int(21 + 8 * (1 - t)),
                int(22 + 9 * (1 - t)),
                int(27 + 12 * (1 - t)),
            )
            # subtle top highlight edge
            edge = rounded_mask(x, y - 1) is False
            if edge:
                base = tuple(min(255, c + 26) for c in base)
            on_bar = any(
                bar_mask(x, y, bx * S, by * S, bw * S, bh * S, br * S)
                for bx, by, bw, bh, br in BARS
            )
            if on_bar:
                px = (*ACCENT, 255)
            else:
                px = (*base, 255)
            row += bytes(px)
        else:
            row += bytes((0, 0, 0, 0))
    rows.append(bytes(row))

raw = b''.join(rows)

def chunk(tag, data):
    c = tag + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(raw, 9))
png += chunk(b'IEND', b'')

icon_path = os.path.join(os.path.dirname(__file__), '..', 'resources', 'icon.png')
os.makedirs(os.path.dirname(icon_path), exist_ok=True)
with open(icon_path, 'wb') as f:
    f.write(png)
print('icon written:', icon_path)
