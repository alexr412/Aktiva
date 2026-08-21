import os
from PIL import Image, ImageFilter

source_path = r"c:/Users/alexa/Desktop/Aktiva/Aktiva/public/assets/preview/option_1.jpg"
app_dir = r"c:/Users/alexa/Desktop/Aktiva/Aktiva"

img = Image.open(source_path).convert("RGBA")
r, g, b, a = img.split()

# 1. Map red channel to full solid opacity with high threshold
def calc_alpha(val):
    if val < 20:
        return 0
    elif val > 60:
        return 255
    else:
        return int((val - 20) * (255 / 40))

alpha = r.point(calc_alpha)

# Create a bold, vibrant crimson-red image for the letter 'A'
vivid_red = Image.new("RGBA", img.size, (245, 45, 75, 255))

# Thicken stroke with MaxFilter for extra boldness
thick_alpha = alpha.filter(ImageFilter.MaxFilter(5))
vivid_red.putalpha(thick_alpha)

# 2. Crop tightly to exact pixel bounds of the bold 'A'
bbox = vivid_red.getbbox()
if bbox:
    cropped_a = vivid_red.crop(bbox)
    w, h = cropped_a.size
    max_dim = max(w, h)
    
    # 0% padding: fill 100% of the canvas height/width
    final_square = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
    offset_x = (max_dim - w) // 2
    offset_y = (max_dim - h) // 2
    final_square.paste(cropped_a, (offset_x, offset_y), cropped_a)
else:
    final_square = vivid_red

# Save output formats
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

preview_path = os.path.join(app_dir, "public", "assets", "preview", "bold_large_a_preview.png")
final_square.resize((256, 256), Image.Resampling.LANCZOS).save(preview_path, format="PNG")

print("Bold large 'A' icons generated successfully!")
