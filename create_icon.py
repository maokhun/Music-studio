"""
Generate a custom CamMusic AI icon (.ico) using only Python standard library + PIL/Pillow.
Creates a beautiful purple/gold music-themed icon.
"""
try:
    from PIL import Image, ImageDraw, ImageFont
    import math, os

    def draw_icon(size=256):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        s = size

        # --- Background: dark purple gradient ---
        for y in range(s):
            ratio = y / s
            r = int(20 + ratio * 30)
            g = int(0 + ratio * 10)
            b = int(60 + ratio * 80)
            for x in range(s):
                dist = math.sqrt((x - s/2)**2 + (y - s/2)**2) / (s/2)
                factor = max(0, 1 - dist * 0.4)
                draw.point((x, y), fill=(
                    min(255, int(r * factor + 10)),
                    min(255, int(g * factor)),
                    min(255, int(b * factor + 20)),
                    255
                ))

        # --- Rounded corners mask ---
        mask = Image.new("L", (s, s), 0)
        mask_draw = ImageDraw.Draw(mask)
        radius = s // 6
        mask_draw.rounded_rectangle([0, 0, s-1, s-1], radius=radius, fill=255)
        img.putalpha(mask)

        # Redraw on top with rounded bg
        bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        bg_draw = ImageDraw.Draw(bg)
        for y in range(s):
            ratio = y / s
            r = int(20 + ratio * 30)
            g = int(0 + ratio * 10)
            b = int(60 + ratio * 80)
            bg_draw.line([(0, y), (s, y)], fill=(r, g, b, 255))
        bg.putalpha(mask)
        draw = ImageDraw.Draw(bg)

        # --- Glow circle behind note ---
        cx, cy = s // 2, int(s * 0.42)
        glow_r = int(s * 0.28)
        for i in range(5, 0, -1):
            alpha = int(40 * i / 5)
            r2 = glow_r + i * int(s * 0.025)
            draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2],
                         fill=(150, 100, 255, alpha))

        # --- Sound waves (arcs) ---
        arc_colors = [(0, 200, 255, 180), (0, 180, 220, 120), (0, 160, 200, 70)]
        for i, color in enumerate(arc_colors):
            offset = int(s * 0.18) + i * int(s * 0.07)
            draw.arc([cx - offset, cy - offset, cx + offset, cy + offset],
                     start=200, end=340, fill=color, width=max(2, s // 60))

        # --- Musical Note (♪) ---
        note_size = int(s * 0.45)
        note_x = int(cx - note_size * 0.22)
        note_y = int(cy - note_size * 0.48)

        # Note stem
        stem_w = max(3, s // 40)
        stem_x = note_x + int(note_size * 0.55)
        draw.rectangle([stem_x, note_y, stem_x + stem_w, note_y + int(note_size * 0.72)],
                       fill=(255, 215, 0, 255))

        # Note head (ellipse)
        head_rx = int(note_size * 0.22)
        head_ry = int(note_size * 0.16)
        head_cx = note_x + int(note_size * 0.3)
        head_cy = note_y + int(note_size * 0.72)
        draw.ellipse([head_cx - head_rx, head_cy - head_ry,
                      head_cx + head_rx, head_cy + head_ry],
                     fill=(255, 215, 0, 255))

        # Note flag
        flag_pts = [
            (stem_x + stem_w, note_y),
            (stem_x + stem_w + int(note_size * 0.3), note_y + int(note_size * 0.15)),
            (stem_x + stem_w + int(note_size * 0.2), note_y + int(note_size * 0.35)),
            (stem_x + stem_w, note_y + int(note_size * 0.3)),
        ]
        draw.polygon(flag_pts, fill=(255, 215, 0, 255))

        # --- AI circuit dots around note ---
        dot_color = (0, 220, 255, 200)
        dot_positions = [
            (cx - int(s*0.30), cy - int(s*0.15)),
            (cx + int(s*0.28), cy - int(s*0.18)),
            (cx - int(s*0.25), cy + int(s*0.12)),
            (cx + int(s*0.22), cy + int(s*0.15)),
            (cx - int(s*0.10), cy - int(s*0.32)),
            (cx + int(s*0.08), cy + int(s*0.28)),
        ]
        dot_r = max(2, s // 50)
        for dx, dy in dot_positions:
            draw.ellipse([dx-dot_r, dy-dot_r, dx+dot_r, dy+dot_r], fill=dot_color)
            draw.line([(cx, cy), (dx, dy)], fill=(0, 200, 255, 80), width=max(1, s//100))

        # --- Text: "CamMusic AI" ---
        text = "CamMusic AI"
        try:
            font_size = max(12, s // 11)
            font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
        except:
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        tx = (s - tw) // 2
        ty = int(s * 0.78)

        # Text shadow/glow
        for ox, oy in [(-1,-1),(1,-1),(-1,1),(1,1)]:
            draw.text((tx+ox*2, ty+oy*2), text, font=font, fill=(100, 50, 200, 150))
        draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

        return bg

    # Generate multiple sizes for .ico
    sizes = [256, 128, 64, 48, 32, 16]
    images = [draw_icon(sz) for sz in sizes]

    out_path = r"d:\code\AI_Music_Studio\cammusic_ai.ico"
    images[0].save(out_path, format="ICO", sizes=[(sz, sz) for sz in sizes],
                   append_images=images[1:])

    print(f"[OK] Icon saved to: {out_path}")

except ImportError:
    print("Pillow not found. Installing...")
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    print("Please run this script again after installation.")
