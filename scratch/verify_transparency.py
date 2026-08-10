from PIL import Image
import os

img_path = os.path.abspath("public/icon-512.png")
img = Image.open(img_path).convert("RGBA")
width, height = img.size

# Check four corners and four midpoint edges
samples = [
    ("Top-Left", 0, 0),
    ("Top-Center", 256, 0),
    ("Top-Right", 511, 0),
    ("Left-Center", 0, 256),
    ("Right-Center", 511, 256),
    ("Bottom-Left", 0, 511),
    ("Bottom-Center", 256, 511),
    ("Bottom-Right", 511, 511),
    ("Top-Inset 10px", 256, 10),
    ("Bottom-Inset 10px", 256, 501),
]

for label, x, y in samples:
    r, g, b, a = img.getpixel((x, y))
    print(f"{label} ({x}, {y}): Alpha={a} (R={r}, G={g}, B={b})")

# Count how many non-transparent pixels exist on the border
border_alpha = sum(
    img.getpixel((x, 0))[3] + img.getpixel((x, 511))[3] +
    img.getpixel((0, y))[3] + img.getpixel((511, y))[3]
    for x in range(width) for y in range(height) if (x in (0, 511) or y in (0, 511))
)
print(f"Total non-transparent border pixels: {border_alpha}")
