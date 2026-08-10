from PIL import Image, ImageDraw
import os

def make_corners_transparent(image_path):
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size

    # Create a mask for the squircle shape with rounded corners
    # The squircle fits inside width x height
    # Corner radius is typically around 20-22% of the width
    radius = int(width * 0.225)

    # Create a transparency mask: 255 inside rounded rect, 0 outside
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, width - 1, height - 1], radius=radius, fill=255)

    # Apply the mask to the alpha channel of the image
    datas = img.getdata()
    mask_datas = mask.getdata()

    new_data = []
    for i, item in enumerate(datas):
        if mask_datas[i] == 0:
            # Fully transparent outside the squircle
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(image_path, "PNG")
    print(f"Successfully processed {image_path} with transparent corners (radius: {radius}px).")

if __name__ == "__main__":
    icon512 = os.path.abspath("public/icon-512.png")
    icon192 = os.path.abspath("public/icon-192.png")

    if os.path.exists(icon512):
        make_corners_transparent(icon512)
    if os.path.exists(icon192):
        make_corners_transparent(icon192)
