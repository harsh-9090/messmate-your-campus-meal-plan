import os
from PIL import Image, ImageDraw, ImageOps

source_path = "/home/harshvardhan/.gemini/antigravity/brain/4338fa9a-fffe-4af8-b639-570962f799d8/media__1779168652254.png"
public_dir = "/home/harshvardhan/HARSH/freelancing/messmate-your-campus-meal-plan/frontend/public"

def main():
    if not os.path.exists(source_path):
        print(f"Error: Source image not found at {source_path}")
        return

    # Load source image
    src = Image.open(source_path).convert("RGBA")
    print(f"Loaded source image {src.size}")

    # Let's crop it to a tighter square to zoom in on the crest (making the content larger and clearer)
    w, h = src.size
    side = 570  # Tighter square centered directly on the circular crest
    left = (w - side) // 2
    top = (h - side) // 2
    right = left + side
    bottom = top + side
    square_src = src.crop((left, top, right, bottom))
    print(f"Cropped to zoomed square of size {square_src.size}")

    # Ensure output dirs exist
    os.makedirs(os.path.join(public_dir, "icons"), exist_ok=True)
    os.makedirs(os.path.join(public_dir, "images"), exist_ok=True)

    # 1. Generate PWA and standard solid icons (just resized squares)
    icon_specs = [
        ("apple-touch-icon.png", (180, 180)),
        ("apple-touch-icon-precomposed.png", (180, 180)),
        ("favicon.png", (32, 32)),
        ("icons/icon-192x192.png", (192, 192)),
        ("icons/icon-512x512.png", (512, 512)),
    ]

    for filename, size in icon_specs:
        out_path = os.path.join(public_dir, filename)
        resized = square_src.resize(size, Image.Resampling.LANCZOS)
        resized.save(out_path, "PNG")
        print(f"Saved solid {filename} at {size}")

    # 2. Generate multi-resolution favicon.ico
    ico_path = os.path.join(public_dir, "favicon.ico")
    square_src.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
    print("Saved multi-res favicon.ico")

    # 3. Generate og-image.png (usually 1200x630, centered on brand background)
    # The logo has background color: oklch(0.32 0.07 160) or deep forest green. Let's sample the top-left pixel color.
    bg_color = src.getpixel((10, 10))
    print(f"Sampled background color: {bg_color}")

    og_img = Image.new("RGBA", (1200, 630), bg_color)
    # Centered square logo inside og-image
    logo_sz = 400
    logo_resized = square_src.resize((logo_sz, logo_sz), Image.Resampling.LANCZOS)
    offset_x = (1200 - logo_sz) // 2
    offset_y = (630 - logo_sz) // 2
    og_img.paste(logo_resized, (offset_x, offset_y), logo_resized)
    og_img.save(os.path.join(public_dir, "og-image.png"), "PNG")
    print("Saved og-image.png (1200x630)")

    # 4. Generate circular masked versions in case we need clean circular badges
    # Let's save a clean circular badge as well for use in sidebar / loaders if desired
    mask = Image.new("L", (side, side), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, side, side), fill=255)
    
    circular_src = square_src.copy()
    circular_src.putalpha(mask)
    
    # Save a circular cropped version to public/images/moms_kitchen_circular_badge.png
    circular_badge_path = os.path.join(public_dir, "images", "moms_kitchen_circular_badge.png")
    circular_src.resize((256, 256), Image.Resampling.LANCZOS).save(circular_badge_path, "PNG")
    print("Saved circular masked badge to images/moms_kitchen_circular_badge.png")

if __name__ == "__main__":
    main()
