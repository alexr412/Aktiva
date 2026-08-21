import os
from PIL import Image

source_path = r"c:/Users/alexa/Desktop/Aktiva/Aktiva/public/assets/preview/option_1.jpg"
app_dir = r"c:/Users/alexa/Desktop/Aktiva/Aktiva"

img = Image.open(source_path).convert("RGBA")

# Extract red channel for thresholding the glowing red 'A'
r, g, b, a = img.split()

# Smooth alpha calculation mapping dark background (luminance < 30) to 0 (transparent)
# and red 'A' (luminance > 30) to high alpha for crisp anti-aliasing
def calc_alpha(val):
    if val < 28:
        return 0
    elif val > 110:
        return 255
    else:
        return int((val - 28) * (255 / 82))

alpha_channel = r.point(calc_alpha)
img.putalpha(alpha_channel)

# Crop to tight bounding box of letter 'A'
bbox = img.getbbox()
if bbox:
    cropped_a = img.crop(bbox)
    w, h = cropped_a.size
    max_dim = max(w, h)
    # Minimal 1% padding so 'A' fills the entire square canvas (like Firebase logo)
    padding = max(1, int(max_dim * 0.01))
    canvas_size = max_dim + (padding * 2)
    
    final_square = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset_x = (canvas_size - w) // 2
    offset_y = (canvas_size - h) // 2
    final_square.paste(cropped_a, (offset_x, offset_y), cropped_a)
else:
    final_square = img

# Output destinations
favicon_ico_app = os.path.join(app_dir, "src", "app", "favicon.ico")
favicon_ico_pub = os.path.join(app_dir, "public", "favicon.ico")
icon_192 = os.path.join(app_dir, "public", "icon-192.png")
icon_512 = os.path.join(app_dir, "public", "icon-512.png")
apple_touch = os.path.join(app_dir, "public", "apple-touch-icon.png")
favicon_32 = os.path.join(app_dir, "public", "favicon-32x32.png")
favicon_16 = os.path.join(app_dir, "public", "favicon-16x16.png")

ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
final_square.save(favicon_ico_app, format="ICO", sizes=ico_sizes)
final_square.save(favicon_ico_pub, format="ICO", sizes=ico_sizes)

final_square.resize((192, 192), Image.Resampling.LANCZOS).save(icon_192, format="PNG")
final_square.resize((512, 512), Image.Resampling.LANCZOS).save(icon_512, format="PNG")
final_square.resize((180, 180), Image.Resampling.LANCZOS).save(apple_touch, format="PNG")
final_square.resize((32, 32), Image.Resampling.LANCZOS).save(favicon_32, format="PNG")
final_square.resize((16, 16), Image.Resampling.LANCZOS).save(favicon_16, format="PNG")

preview_path = os.path.join(app_dir, "public", "assets", "preview", "transparent_a_preview.png")
final_square.resize((256, 256), Image.Resampling.LANCZOS).save(preview_path, format="PNG")

print("Transparent high-res 'A' icons generated successfully!")
