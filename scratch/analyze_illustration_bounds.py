from PIL import Image
import os

img_path = os.path.abspath("public/icon-512.png")
img = Image.open(img_path).convert("RGBA")
width, height = img.size

# Let's inspect pixels from outer edges moving inward
# We want to identify pixels that are background white (R>230, G>230, B>230) vs part of the artwork.

def is_white_bg(r, g, b, a):
    if a == 0:
        return True
    # If RGB is very close to white/light grey (e.g. R>235, G>235, B>235) and color saturation is near 0
    # Let's check difference between max and min channel
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    spread = max_c - min_c
    return (r > 225 and g > 225 and b > 225 and spread < 25)

# Floodfill from (256, 0), (0, 256), (511, 256), (256, 511) to make all connected white background pixels 100% transparent (0,0,0,0)
pixels = img.load()

visited = set()
queue = []

# Add all border pixels that match is_white_bg
for x in range(width):
    for y in (0, height - 1):
        r, g, b, a = pixels[x, y]
        if is_white_bg(r, g, b, a):
            queue.append((x, y))
            visited.add((x, y))

for y in range(height):
    for x in (0, width - 1):
        r, g, b, a = pixels[x, y]
        if is_white_bg(r, g, b, a) and (x, y) not in visited:
            queue.append((x, y))
            visited.add((x, y))

print(f"Starting floodfill with {len(queue)} seed white pixels...")

# BFS flood fill
count_cleared = 0
while queue:
    x, y = queue.pop(0)
    pixels[x, y] = (0, 0, 0, 0)
    count_cleared += 1

    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
            visited.add((nx, ny))
            r, g, b, a = pixels[nx, ny]
            if is_white_bg(r, g, b, a):
                queue.append((nx, ny))

print(f"Floodfill finished! Cleared {count_cleared} background white pixels.")

# Save result to public/icon-512.png and public/icon-192.png
img.save(os.path.abspath("public/icon-512.png"), "PNG")
print("Saved transparent public/icon-512.png")

# Also resize to icon-192.png
img192 = img.resize((192, 192), Image.Resampling.LANCZOS)
img192.save(os.path.abspath("public/icon-192.png"), "PNG")
print("Saved transparent public/icon-192.png")
