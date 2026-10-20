import os
import logging
from typing import Tuple, List, Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("media_factory.thumbnail")

# Brand color specifications (Start hex to End hex)
BRAND_GRADIENTS = {
    "talentxcel": ("#1a73e8", "#0d47a1"),  # Google/Modern Blue to Deep Royal
    "chatr": ("#7c4dff", "#4527a0"),       # Vibrant Purple to Deep Indigo
    "nutytales": ("#2e7d32", "#1b5e20"),   # Forest Green to Deep Emerald
}

BRAND_WATERMARKS = {
    "talentxcel": "TALENTXCEL.IN",
    "chatr": "CHATR.AI",
    "nutytales": "NUTYTALES.COM",
}

def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    """Converts hex color string to RGB tuple."""
    hex_str = hex_str.lstrip("#")
    return tuple(int(hex_str[i : i + 2], 16) for i in (0, 2, 4))

def create_vertical_gradient(width: int, height: int, start_color: Tuple[int, int, int], end_color: Tuple[int, int, int]) -> Image.Image:
    """Generates a smooth 2-stop vertical linear gradient image."""
    base = Image.new("RGB", (width, height), start_color)
    draw = ImageDraw.Draw(base)

    r1, g1, b1 = start_color
    r2, g2, b2 = end_color

    for y in range(height):
        factor = y / float(height - 1)
        r = int(r1 + factor * (r2 - r1))
        g = int(g1 + factor * (g2 - g1))
        b = int(b1 + factor * (b2 - b1))
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    return base

def get_preferred_font(font_size: int = 68) -> ImageFont.ImageFont:
    """
    Attempts to locate system TTF font with fallback to Pillow default.
    """
    font_candidates = [
        "C:\\Windows\\Fonts\\arialbd.ttf",       # Arial Bold (Windows)
        "C:\\Windows\\Fonts\\segoeuib.ttf",      # Segoe UI Bold (Windows)
        "C:\\Windows\\Fonts\\calibrib.ttf",      # Calibri Bold (Windows)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", # Linux
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "arial.ttf",
    ]

    for candidate in font_candidates:
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size=font_size)
            except Exception:
                continue

    try:
        # Fallback to standard truetype if resolvable by name
        return ImageFont.truetype("arial", size=font_size)
    except Exception:
        # Final fallback to built-in bitmap font
        return ImageFont.load_default()

def wrap_text_to_lines(text: str, font: ImageFont.ImageFont, max_width: int, draw: ImageDraw.ImageDraw) -> List[str]:
    """Wraps text so no line exceeds max_width in pixels."""
    words = text.split()
    if not words:
        return []

    lines = []
    current_line = []

    for word in words:
        test_line = " ".join(current_line + [word])
        try:
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_width = bbox[2] - bbox[0]
        except AttributeError:
            line_width = draw.textlength(test_line, font=font)

        if line_width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [word]

    if current_line:
        lines.append(" ".join(current_line))

    return lines

def generate_thumbnail(
    hook_text: str,
    output_path: str,
    brand: str = "talentxcel",
    width: int = 1080,
    height: int = 1920,
) -> str:
    """
    Generates a high-impact 1080x1920 9:16 vertical thumbnail with:
    - Smooth brand gradient background
    - Large white centered hook line with shadow contrast
    - Brand watermark badge in bottom-right corner
    - Saved as JPEG with quality=95
    """
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Resolve gradient colors
    grad_colors = BRAND_GRADIENTS.get(brand, BRAND_GRADIENTS["talentxcel"])
    start_rgb = hex_to_rgb(grad_colors[0])
    end_rgb = hex_to_rgb(grad_colors[1])

    # 1. Create gradient canvas
    image = create_vertical_gradient(width, height, start_rgb, end_rgb)
    draw = ImageDraw.Draw(image)

    # 2. Render Hook Text
    font_size = 72
    font = get_preferred_font(font_size)
    max_text_width = width - 160 # 80px margin on each side

    lines = wrap_text_to_lines(hook_text.strip(), font, max_text_width, draw)
    if not lines:
        lines = [hook_text.strip()]

    # Calculate total height of text block
    line_spacing = 24
    line_heights = []
    for line in lines:
        try:
            bbox = draw.textbbox((0, 0), line, font=font)
            line_heights.append(bbox[3] - bbox[1])
        except AttributeError:
            line_heights.append(font_size)

    total_text_height = sum(line_heights) + line_spacing * (len(lines) - 1)
    # Center text vertically in the upper-mid area (y = 800)
    current_y = (height - total_text_height) // 2 - 100

    for i, line in enumerate(lines):
        try:
            bbox = draw.textbbox((0, 0), line, font=font)
            line_w = bbox[2] - bbox[0]
        except AttributeError:
            line_w = draw.textlength(line, font=font)

        line_x = (width - line_w) // 2

        # Draw drop shadow for crisp readability
        shadow_offset = 4
        draw.text((line_x + shadow_offset, current_y + shadow_offset), line, font=font, fill=(10, 10, 10))
        # Draw main white text
        draw.text((line_x, current_y), line, font=font, fill=(255, 255, 255))

        current_y += line_heights[i] + line_spacing

    # 3. Render Brand Watermark in bottom-right
    watermark_label = BRAND_WATERMARKS.get(brand, f"{brand.upper()}.IN")
    wm_font = get_preferred_font(32)

    try:
        wm_bbox = draw.textbbox((0, 0), watermark_label, font=wm_font)
        wm_w = wm_bbox[2] - wm_bbox[0]
        wm_h = wm_bbox[3] - wm_bbox[1]
    except AttributeError:
        wm_w = draw.textlength(watermark_label, font=wm_font)
        wm_h = 32

    padding_x = 24
    padding_y = 12
    margin_right = 70
    margin_bottom = 90

    badge_x2 = width - margin_right
    badge_x1 = badge_x2 - wm_w - (padding_x * 2)
    badge_y2 = height - margin_bottom
    badge_y1 = badge_y2 - wm_h - (padding_y * 2)

    # Draw rounded translucent badge background
    draw.rounded_rectangle(
        [(badge_x1, badge_y1), (badge_x2, badge_y2)],
        radius=14,
        fill=(0, 0, 0),
        outline=(255, 255, 255),
        width=2,
    )

    # Draw watermark text
    text_x = badge_x1 + padding_x
    text_y = badge_y1 + padding_y - 2
    draw.text((text_x, text_y), watermark_label, font=wm_font, fill=(255, 255, 255))

    # 4. Save as high-quality JPEG
    image.save(output_path, format="JPEG", quality=95)
    logger.info(f"Generated 1080x1920 thumbnail for '{brand}' -> {output_path}")
    return os.path.abspath(output_path)
