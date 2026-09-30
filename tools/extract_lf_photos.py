"""Pull the two prototype photos out of the Lost & Found final assignment PDF."""
import pypdfium2 as pdfium
import pypdfium2.raw as raw
from PIL import Image

SRC = "C:/Users/jakub/Desktop/KdG/fablab/Fusion challange/Final Assignment_Michalec_Lost & Found.pdf"
OUT = "C:/Users/jakub/Desktop/PORTFOLIO/site/assets/img/"
pdf = pdfium.PdfDocument(SRC)
names = {13: "lost-and-found-outside.jpg", 14: "lost-and-found-inside.jpg"}   # 0-based pages 14 and 15
for idx, name in names.items():
    page = pdf[idx]
    imgs = [o for o in page.get_objects(filter=(raw.FPDF_PAGEOBJ_IMAGE,))]
    imgs.sort(key=lambda o: -(o.get_bounds()[2] - o.get_bounds()[0]) * (o.get_bounds()[3] - o.get_bounds()[1]))
    im = imgs[0].get_bitmap().to_pil().convert("RGB").transpose(Image.ROTATE_270)  # the PDF stores the photo sideways
    im.thumbnail((1500, 1500), Image.LANCZOS)
    im.save(OUT + name, "JPEG", quality=82, optimize=True, progressive=True)
    print(name, im.size)
