from PIL import Image
import os

img_path = os.path.abspath("public/icon-512.png")
img = Image.open(img_path).convert("RGBA")
width, height = img.size

print(f"Image dimensions: {width}x{height}")

# Find all non-transparent pixels that are white / near-white
white_pixel_count = 0
transparent_count = 0
color_count = 0

corner_samples = [
    (0, 0), (width//2, 0), (width-1, 0),
    (0, height//2), (width-1, height//2),
    (0, height-1), (width//2, height-1), (width-1, height-1),
    (10, 10), (width-10, 10), (10, height-10), (width-10, height-10),
    (50, 50), (width-50, 50), (50, height-50), (width-50, height-50)
]

for x, y in corner_samples:
    r, g, b, a = img.getpixel((x, y))
    print(f"Pixel at ({x}, {y}): R={r}, G={g}, B={b}, Alpha={a}")

# Let's count how many pixels near the borders are solid white with Alpha=255
top_row_whites = sum(1 for x in range(width) if img.getpixel((x, 0))[3] == 255 and img.getpixel((x, 0))[0] > 240 and img.getpixel((x, 0))[1] > 240 and img.getpixel((x, 0))[2] > 240)
bottom_row_whites = sum(1 for x in range(width) if img.getpixel((x, height-1))[3] == 255 and img.getpixel((x, height-1))[0] > 240 and img.getpixel((x, height-1))[1] > 240 and img.getpixel((x, height-1))[2] > 240)

print(f"Top row white pixels with Alpha=255: {top_row_whites}/{width}")
print(f"Bottom row white pixels with Alpha=255: {bottom_row_whites}/{width}")
