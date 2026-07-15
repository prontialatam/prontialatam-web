#!/usr/bin/env python3
from pathlib import Path
from textwrap import dedent
import csv
import zipfile

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image as RLImage, KeepTogether, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle
)


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "img" / "kit-afiliados-principiantes"
KIT_DIR = ROOT / "downloads" / "kit-venta-digital-principiantes"
PDF_OUT = ROOT / "output" / "pdf" / "kit-venta-productos-digitales-principiantes-latam.pdf"
ZIP_OUT = ROOT / "downloads" / "kit-venta-productos-digitales-principiantes.zip"
HERO = ASSET_DIR / "hero-latam.png"

PURPLE = colors.HexColor("#3B176B")
PURPLE_2 = colors.HexColor("#6D28D9")
MAGENTA = colors.HexColor("#C0267D")
ORANGE = colors.HexColor("#F97316")
CREAM = colors.HexColor("#FFF7ED")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5E6678")
PALE = colors.HexColor("#F7F3FB")
WHITE = colors.white


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def fit_text(draw, text, box_width, max_size, min_size=26, bold=True):
    for size in range(max_size, min_size - 1, -2):
        selected = font(size, bold=bold)
        if draw.textbbox((0, 0), text, font=selected)[2] <= box_width:
            return selected
    return font(min_size, bold=bold)


def create_social_asset(name, size, title, subtitle, crop_anchor=0.5):
    source = Image.open(HERO).convert("RGB")
    width, height = size
    scale = max(width / source.width, height / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, min(resized.width - width, round((resized.width - width) * crop_anchor)))
    top = max(0, round((resized.height - height) * 0.5))
    canvas = resized.crop((left, top, left + width, top + height)).convert("RGBA")

    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle((36, 36, width - 36, height - 36), radius=34, fill=(30, 11, 60, 150), outline=(255, 255, 255, 80), width=2)
    overlay = overlay.filter(ImageFilter.GaussianBlur(0.2))
    canvas = Image.alpha_composite(canvas, overlay)
    draw = ImageDraw.Draw(canvas)

    pad = max(58, round(width * 0.065))
    label_font = font(max(22, round(width * 0.024)), bold=True)
    title_font = fit_text(draw, title, width - pad * 2, max(42, round(width * 0.062)), max(30, round(width * 0.035)))
    subtitle_font = font(max(20, round(width * 0.026)), bold=False)
    brand_font = font(max(21, round(width * 0.025)), bold=True)

    y = pad
    draw.rounded_rectangle((pad, y, pad + round(width * 0.35), y + 48), radius=24, fill=(249, 115, 22, 235))
    draw.text((pad + 22, y + 10), "RECURSO GRATUITO", font=label_font, fill="white")
    y += 90
    words = title.split()
    lines, current = [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=title_font)[2] <= width - pad * 2:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    for line in lines:
        draw.text((pad, y), line, font=title_font, fill="white", stroke_width=1, stroke_fill=(45, 15, 70, 180))
        y += round(title_font.size * 1.12)
    y += 24
    for line in subtitle.split("\n"):
        draw.text((pad, y), line, font=subtitle_font, fill=(255, 244, 232, 255))
        y += round(subtitle_font.size * 1.35)
    draw.text((pad, height - pad - brand_font.size), "prontIA LATAM | Portal privado de afiliados", font=brand_font, fill="white")

    output = ASSET_DIR / name
    canvas.convert("RGB").save(output, quality=94, optimize=True)
    return output


class KitDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=20 * mm, bottomMargin=18 * mm, **kwargs)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates([PageTemplate(id="kit", frames=frame, onPage=self.decorate_page)])

    def decorate_page(self, canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.setFillColor(PURPLE)
            canvas.rect(0, A4[1] - 10 * mm, A4[0], 10 * mm, stroke=0, fill=1)
            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica", 8)
            canvas.drawString(18 * mm, 10 * mm, "ProntIA LATAM - Kit Venta de Productos Digitales para Principiantes")
            canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, str(doc.page))
        canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="KitTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=WHITE, alignment=TA_LEFT, spaceAfter=10))
styles.add(ParagraphStyle(name="SectionKicker", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=ORANGE, spaceBefore=4, spaceAfter=6, uppercase=True))
styles.add(ParagraphStyle(name="H1Kit", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=23, leading=27, textColor=PURPLE, spaceBefore=8, spaceAfter=12))
styles.add(ParagraphStyle(name="H2Kit", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=PURPLE_2, spaceBefore=12, spaceAfter=7))
styles.add(ParagraphStyle(name="BodyKit", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.2, leading=15, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="SmallKit", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.6, leading=12.5, textColor=MUTED, spaceAfter=5))
styles.add(ParagraphStyle(name="BulletKit", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.8, leading=14, leftIndent=13, firstLineIndent=-7, bulletIndent=0, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10.4, leading=15, textColor=PURPLE, spaceAfter=0))
styles.add(ParagraphStyle(name="CenterKit", parent=styles["BodyText"], alignment=TA_CENTER, fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=PURPLE))


def P(text, style="BodyKit"):
    return Paragraph(text, styles[style])


def bullets(items):
    return [P("• " + item, "BulletKit") for item in items]


def callout(title, body, color=PALE):
    table = Table([[P(title, "Callout"), P(body, "BodyKit")]], colWidths=[42 * mm, 118 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E7DDF2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def chapter(story, number, title, promise):
    if story:
        story.append(PageBreak())
    story.append(P(f"MÓDULO {number}", "SectionKicker"))
    story.append(P(title, "H1Kit"))
    story.append(callout("Qué conseguirás", promise, CREAM))
    story.append(Spacer(1, 7))


def checklist_table(rows, headers=("Paso", "Hecho")):
    data = [[P(headers[0], "Callout"), P(headers[1], "Callout")]] + [[P(row, "SmallKit"), P("□", "CenterKit")] for row in rows]
    table = Table(data, colWidths=[145 * mm, 15 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#DED6E8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def build_pdf():
    KIT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
    story = []

    cover = Image.open(HERO)
    cover_path = ASSET_DIR / "cover-source.jpg"
    cover.convert("RGB").save(cover_path, quality=92)
    cover_table = Table([
        [P("KIT GRATUITO PARA AFILIADOS", "SectionKicker")],
        [P("Kit Venta de Productos Digitales para Principiantes", "KitTitle")],
        [Paragraph("Método práctico para empezar desde cero en LATAM, comunicar con confianza y construir ingresos complementarios con productos digitales.", ParagraphStyle(name="CoverCopy", fontName="Helvetica", fontSize=13, leading=19, textColor=WHITE))],
    ], colWidths=[160 * mm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (0, 0), 12),
        ("TOPPADDING", (0, 1), (0, 1), 7),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 16),
    ]))
    story.extend([Spacer(1, 14 * mm), cover_table, Spacer(1, 7 * mm), RLImage(str(cover_path), width=160 * mm, height=90 * mm), Spacer(1, 7 * mm), P("ProntIA LATAM · Formación inicial para afiliados aprobados", "CenterKit")])

    story.append(PageBreak())
    story.append(P("ANTES DE EMPEZAR", "SectionKicker"))
    story.append(P("Una ruta realista para tu primer sistema de ventas", "H1Kit"))
    story.append(P("Este kit no promete dinero rápido. Enseña un método repetible para recomendar productos digitales útiles, ganar confianza, aprender de los datos y mejorar cada semana. Tu resultado dependerá de tu audiencia, tu constancia, la calidad de tu comunicación y el encaje de cada producto."))
    story.append(callout("La idea central", "No necesitas ser influencer. Necesitas entender a una audiencia concreta, recomendar una solución relevante y facilitar una decisión informada."))
    story.append(P("Cómo usar este kit", "H2Kit"))
    story.extend(bullets([
        "Lee los módulos 1 a 4 antes de publicar tu primer enlace.",
        "Elige un solo nicho y un solo producto durante los primeros 14 días.",
        "Usa el plan de 30 días y registra cada acción, clic, conversación y venta.",
        "Adapta los copies a tu voz: no copies mensajes que suenen ajenos o exagerados.",
        "Consulta siempre las condiciones vigentes del programa de afiliados dentro del portal privado."
    ]))
    story.append(P("Índice", "H2Kit"))
    index_rows = [
        ["01", "Cómo funciona el marketing de afiliación"], ["02", "Elegir nicho y persona compradora"],
        ["03", "Entender el producto antes de recomendarlo"], ["04", "Tu propuesta y tu perfil de confianza"],
        ["05", "Contenido que educa y convierte"], ["06", "WhatsApp, mensajes y conversaciones"],
        ["07", "Enlaces, atribución y seguimiento"], ["08", "Objeciones y cierres éticos"],
        ["09", "Métricas y mejora semanal"], ["10", "Plan de acción de 30 días"],
        ["11", "Errores, ética y cumplimiento"], ["12", "Plantillas y recursos listos"]
    ]
    t = Table([[P(a, "Callout"), P(b, "BodyKit")] for a, b in index_rows], colWidths=[18 * mm, 142 * mm])
    t.setStyle(TableStyle([("ROWBACKGROUNDS", (0,0), (-1,-1), [PALE, WHITE]), ("BOX", (0,0), (-1,-1), 0.4, colors.HexColor("#E4D9EE")), ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E4D9EE")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 8), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    story.append(t)

    chapter(story, 1, "Cómo funciona el marketing de afiliación", "Entenderás el modelo, quién participa, cuándo se genera una comisión y qué sí depende de ti.")
    story.append(P("En marketing de afiliación recomiendas un producto de otra empresa y recibes una comisión cuando una venta válida queda atribuida a tu código o enlace. No fabricas el producto ni procesas el pago, pero sí eres responsable de la calidad de tu recomendación."))
    story.append(P("Las cuatro piezas del modelo", "H2Kit"))
    story.extend(bullets([
        "Producto: la solución digital que compra el cliente.",
        "Marca: quien crea, cobra, entrega y da soporte al producto.",
        "Afiliado: quien identifica una audiencia, explica el valor y comparte el enlace o código.",
        "Cliente: quien decide comprar porque la propuesta resuelve una necesidad concreta."
    ]))
    story.append(P("De dónde sale tu comisión", "H2Kit"))
    story.append(P("La marca reserva un porcentaje del importe para remunerar la captación. En ProntIA LATAM la tasa concreta de cada afiliado aparece dentro del portal. La comisión se genera tras una venta pagada y validada, pasa a pendiente cuando se prepara la liquidación y finalmente a pagada cuando se cierra el abono."))
    story.append(callout("Regla de oro", "Nunca presentes una comisión como un salario garantizado. Estás creando una actividad comercial basada en resultados."))
    story.append(P("Qué depende de ti", "H2Kit"))
    story.extend(bullets(["Elegir bien a quién hablas.", "Publicar con constancia.", "Explicar beneficios sin inventar resultados.", "Responder dudas y dar seguimiento.", "Medir y mejorar."]))

    chapter(story, 2, "Elegir nicho y persona compradora", "Aprenderás a escoger una audiencia suficientemente concreta para comunicar con claridad.")
    story.append(P("Un nicho no es solo una industria. Es un grupo de personas con problemas, lenguaje, prioridades y capacidad de compra parecidos. Cuanto mejor entiendas ese contexto, menos tendrás que presionar."))
    story.append(P("Matriz rápida para elegir nicho", "H2Kit"))
    matrix = Table([
        [P("Criterio", "Callout"), P("Pregunta", "Callout"), P("Puntuación 1-5", "Callout")],
        [P("Acceso", "SmallKit"), P("¿Ya conozco o puedo encontrar personas de este nicho?", "SmallKit"), P("", "SmallKit")],
        [P("Dolor", "SmallKit"), P("¿Tienen un problema frecuente y reconocible?", "SmallKit"), P("", "SmallKit")],
        [P("Encaje", "SmallKit"), P("¿El producto resuelve una parte concreta de ese problema?", "SmallKit"), P("", "SmallKit")],
        [P("Lenguaje", "SmallKit"), P("¿Entiendo cómo hablan y qué objeciones tienen?", "SmallKit"), P("", "SmallKit")],
        [P("Constancia", "SmallKit"), P("¿Puedo crear contenido sobre esto durante 30 días?", "SmallKit"), P("", "SmallKit")],
    ], colWidths=[30*mm, 105*mm, 25*mm])
    matrix.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PURPLE), ("TEXTCOLOR",(0,0),(-1,0),WHITE), ("GRID",(0,0),(-1,-1),0.45,colors.HexColor("#DED6E8")), ("VALIGN",(0,0),(-1,-1),"TOP"), ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PALE]), ("LEFTPADDING",(0,0),(-1,-1),7), ("RIGHTPADDING",(0,0),(-1,-1),7), ("TOPPADDING",(0,0),(-1,-1),7), ("BOTTOMPADDING",(0,0),(-1,-1),6)]))
    story.append(matrix)
    story.append(P("Perfil mínimo de persona compradora", "H2Kit"))
    story.extend(bullets([
        "Quién es y qué responsabilidad tiene.", "Qué quiere conseguir durante los próximos 30-90 días.",
        "Qué le impide avanzar hoy.", "Qué ya ha probado y por qué no le funcionó.",
        "Qué teme perder: tiempo, dinero, reputación o clientes.", "Qué canal usa más: Instagram, Facebook, TikTok, LinkedIn, WhatsApp o email."
    ]))
    story.append(callout("Ejemplo", "No digas 'vendo prompts'. Di: 'Ayudo a talleres mecánicos a responder mejor por WhatsApp y publicar contenido sin perder horas escribiendo'."))

    chapter(story, 3, "Entender el producto antes de recomendarlo", "Podrás presentar un producto con seguridad y sabrás cuándo no recomendarlo.")
    story.append(P("Tu credibilidad depende de que entiendas el producto. Antes de compartir un enlace, revisa la landing, el contenido, la entrega, el precio, las condiciones y las preguntas frecuentes."))
    story.append(checklist_table([
        "Puedo explicar el resultado principal del producto en una frase.",
        "Sé para quién es y para quién no es.",
        "Conozco el precio y la moneda mostrada en la landing.",
        "He revisado qué archivos o recursos recibe el cliente.",
        "Sé cómo se entrega y dónde pedir soporte.",
        "Conozco las limitaciones y no prometo resultados garantizados.",
        "He preparado tres ejemplos de uso adaptados al nicho."
    ]))
    story.append(P("Transforma características en beneficios", "H2Kit"))
    feature_table = Table([
        [P("Característica", "Callout"), P("Beneficio", "Callout"), P("Prueba o ejemplo", "Callout")],
        [P("100 prompts", "SmallKit"), P("Reduce el tiempo de empezar desde cero", "SmallKit"), P("Muestra un antes/después de un mensaje", "SmallKit")],
        [P("Plan de 30 días", "SmallKit"), P("Da orden y continuidad", "SmallKit"), P("Enseña una semana de ejemplo", "SmallKit")],
        [P("Plantillas", "SmallKit"), P("Permite aplicar sin diseñar todo", "SmallKit"), P("Comparte una vista previa autorizada", "SmallKit")],
    ], colWidths=[43*mm, 57*mm, 60*mm])
    feature_table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PURPLE), ("TEXTCOLOR",(0,0),(-1,0),WHITE), ("GRID",(0,0),(-1,-1),0.45,colors.HexColor("#DED6E8")), ("VALIGN",(0,0),(-1,-1),"TOP"), ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PALE]), ("LEFTPADDING",(0,0),(-1,-1),7), ("TOPPADDING",(0,0),(-1,-1),7), ("BOTTOMPADDING",(0,0),(-1,-1),6)]))
    story.append(feature_table)

    chapter(story, 4, "Tu propuesta y tu perfil de confianza", "Construirás una presentación clara para que las personas entiendan a quién ayudas y por qué seguirte.")
    story.append(P("No necesitas aparentar una trayectoria que todavía no tienes. Puedes posicionarte como curador, facilitador o aprendiz avanzado: alguien que encuentra recursos útiles, los prueba, los traduce a lenguaje simple y acompaña la decisión."))
    story.append(P("Fórmula de posicionamiento", "H2Kit"))
    story.append(callout("Plantilla", "Ayudo a [audiencia] a [resultado concreto] con recursos digitales prácticos y explicaciones sencillas, sin [frustración principal]."))
    story.append(P("Ejemplos", "H2Kit"))
    story.extend(bullets([
        "Ayudo a pequeños restaurantes a ahorrar tiempo creando promociones y respuestas para clientes.",
        "Comparto recursos sencillos para que centros de estética llenen mejor su agenda sin depender de una agencia.",
        "Enseño a emprendedores LATAM a aplicar IA en ventas sin conocimientos técnicos."
    ]))
    story.append(P("Elementos mínimos de tu perfil", "H2Kit"))
    story.extend(bullets(["Foto clara o identidad coherente.", "Nombre y especialidad.", "Bio con audiencia + resultado + enfoque.", "Un solo enlace principal.", "Canal de contacto.", "Aviso transparente de afiliación cuando corresponda."]))
    story.append(callout("Transparencia", "Puedes indicar: 'Algunos enlaces son de afiliado. Si compras a través de ellos, puedo recibir una comisión sin coste adicional para ti'."))

    chapter(story, 5, "Contenido que educa y convierte", "Tendrás un sistema sencillo de contenidos para atraer, educar, demostrar y presentar la oferta.")
    story.append(P("El contenido de afiliación funciona mejor cuando la venta es la consecuencia de haber ayudado. Alterna cuatro tipos de publicación:"))
    story.extend(bullets([
        "Problema: describe una situación que la audiencia reconoce.",
        "Educación: enseña un paso, error o método corto.",
        "Demostración: muestra cómo se usa una plantilla o prompt.",
        "Oferta: conecta el problema con el producto y una llamada a la acción."
    ]))
    story.append(P("Fórmula AIDA adaptada", "H2Kit"))
    story.extend(bullets(["Atención: abre con una observación concreta.", "Interés: explica por qué importa.", "Deseo: muestra el resultado y reduce esfuerzo percibido.", "Acción: pide un solo siguiente paso."]))
    story.append(P("Ejemplo de publicación", "H2Kit"))
    story.append(callout("Copy", "Si tardas 30 minutos en responder cada consulta de WhatsApp, no te falta voluntad: te falta un sistema. Este kit incluye respuestas y prompts que puedes adaptar en minutos. Te explico cómo funciona y para quién sirve en el enlace."))
    story.append(P("Calendario semanal mínimo", "H2Kit"))
    calendar = Table([
        [P("Día", "Callout"), P("Objetivo", "Callout"), P("Formato", "Callout")],
        [P("Lunes", "SmallKit"), P("Problema frecuente", "SmallKit"), P("Carrusel o texto", "SmallKit")],
        [P("Martes", "SmallKit"), P("Consejo aplicable", "SmallKit"), P("Reel corto", "SmallKit")],
        [P("Miércoles", "SmallKit"), P("Demostración", "SmallKit"), P("Pantalla o antes/después", "SmallKit")],
        [P("Jueves", "SmallKit"), P("Objeción", "SmallKit"), P("Historia o FAQ", "SmallKit")],
        [P("Viernes", "SmallKit"), P("Oferta", "SmallKit"), P("Post + WhatsApp", "SmallKit")],
    ], colWidths=[25*mm, 75*mm, 60*mm])
    calendar.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PURPLE), ("TEXTCOLOR",(0,0),(-1,0),WHITE), ("GRID",(0,0),(-1,-1),0.45,colors.HexColor("#DED6E8")), ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PALE]), ("VALIGN",(0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),7), ("TOPPADDING",(0,0),(-1,-1),6), ("BOTTOMPADDING",(0,0),(-1,-1),5)]))
    story.append(calendar)

    chapter(story, 6, "WhatsApp, mensajes y conversaciones", "Aprenderás a iniciar conversaciones sin spam y a dar seguimiento sin presionar.")
    story.append(P("WhatsApp es un canal de confianza en LATAM, pero también es íntimo. No envíes mensajes masivos sin permiso. Prioriza contactos que ya te conocen, respuestas a historias, grupos donde esté permitido compartir y conversaciones iniciadas por interés real."))
    story.append(P("Secuencia de conversación", "H2Kit"))
    story.extend(bullets([
        "1. Contexto: por qué escribes y de dónde conoces a la persona.",
        "2. Pregunta: identifica su situación antes de recomendar.",
        "3. Relevancia: conecta su respuesta con un beneficio concreto.",
        "4. Permiso: pregunta si quiere ver la información.",
        "5. Seguimiento: recuerda una vez y cierra con respeto."
    ]))
    story.append(P("Plantilla inicial", "H2Kit"))
    story.append(callout("Mensaje", "Hola, [nombre]. Vi que estás trabajando en [contexto]. Estoy compartiendo un recurso para [resultado] pensado para [nicho]. Antes de enviarte nada: ¿ahora mismo te cuesta más [problema A] o [problema B]?"))
    story.append(P("Seguimiento respetuoso", "H2Kit"))
    story.append(callout("Mensaje", "Hola, [nombre]. Te dejo este último recordatorio por si querías revisar el recurso. Si ahora no es prioridad, no pasa nada y no vuelvo a insistir."))
    story.append(callout("Nunca hagas esto", "Comprar bases de datos, añadir personas a grupos sin permiso, ocultar que cobras comisión o prometer ingresos garantizados."))

    chapter(story, 7, "Enlaces, atribución y seguimiento", "Sabrás compartir correctamente tu enlace, explicar tu código y registrar la actividad.")
    story.append(P("Tu enlace incorpora un código que permite atribuir la venta. Dentro del portal de ProntIA LATAM puedes copiar enlaces por nicho. Si el comprador no entra por tu enlace, puede introducir tu código manualmente en la landing antes del pago."))
    story.append(P("Buenas prácticas", "H2Kit"))
    story.extend(bullets([
        "Prueba cada enlace en una ventana privada antes de publicarlo.",
        "No acortes enlaces con servicios desconocidos si reducen confianza.",
        "Usa una llamada a la acción coherente con la página de destino.",
        "No cambies manualmente el parámetro ref.",
        "Registra canal, fecha, pieza y resultado para saber qué funciona."
    ]))
    story.append(P("Registro mínimo", "H2Kit"))
    tracking = Table([
        [P("Fecha", "Callout"), P("Canal", "Callout"), P("Contenido", "Callout"), P("Clics", "Callout"), P("Ventas", "Callout")],
        [P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit")],
        [P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit")],
        [P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit"), P("", "SmallKit")],
    ], colWidths=[25*mm, 30*mm, 65*mm, 20*mm, 20*mm], rowHeights=[10*mm, 14*mm, 14*mm, 14*mm])
    tracking.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PURPLE), ("TEXTCOLOR",(0,0),(-1,0),WHITE), ("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#CFC4DA")), ("VALIGN",(0,0),(-1,-1),"MIDDLE"), ("LEFTPADDING",(0,0),(-1,-1),6)]))
    story.append(tracking)

    chapter(story, 8, "Objeciones y cierres éticos", "Responderás dudas sin confrontar y ayudarás a decidir si el producto encaja.")
    objections = [
        ("Es caro", "Pregunta con qué lo compara. Reencuadra el valor en tiempo ahorrado o recursos incluidos, sin minimizar su presupuesto."),
        ("No tengo tiempo", "Muestra el primer paso mínimo y cuánto tarda. No prometas que todo se resuelve solo."),
        ("No sé usar IA", "Explica que el producto está diseñado para principiantes y muestra un ejemplo corto."),
        ("Lo pensaré", "Pregunta qué información necesita para decidir. Acordad un seguimiento concreto o cierra con respeto."),
        ("¿Garantiza ventas?", "Responde que no. El recurso mejora método y velocidad, pero los resultados dependen de aplicación, mercado y oferta."),
    ]
    for title, body in objections:
        story.append(KeepTogether([P(title, "H2Kit"), P(body)]))
    story.append(P("Cierre sencillo", "H2Kit"))
    story.append(callout("Pregunta", "Por lo que me cuentas, el kit puede ayudarte especialmente con [beneficio]. ¿Quieres que te pase la página para revisar todo el contenido y decidir con calma?"))

    chapter(story, 9, "Métricas y mejora semanal", "Distinguirás actividad de resultado y tomarás decisiones con datos simples.")
    story.append(P("Al principio no necesitas herramientas complejas. Mide pocas cosas y revisa cada siete días."))
    metrics = Table([
        [P("Métrica", "Callout"), P("Qué indica", "Callout"), P("Qué mejorar", "Callout")],
        [P("Publicaciones", "SmallKit"), P("Constancia", "SmallKit"), P("Rutina y planificación", "SmallKit")],
        [P("Conversaciones", "SmallKit"), P("Interés real", "SmallKit"), P("Pregunta y llamada a la acción", "SmallKit")],
        [P("Clics", "SmallKit"), P("Curiosidad por la oferta", "SmallKit"), P("Gancho y relevancia", "SmallKit")],
        [P("Ventas", "SmallKit"), P("Conversión", "SmallKit"), P("Encaje, objeciones y landing", "SmallKit")],
        [P("Comisión", "SmallKit"), P("Resultado económico", "SmallKit"), P("Volumen, ticket y mezcla de productos", "SmallKit")],
    ], colWidths=[35*mm, 55*mm, 70*mm])
    metrics.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PURPLE), ("TEXTCOLOR",(0,0),(-1,0),WHITE), ("GRID",(0,0),(-1,-1),0.45,colors.HexColor("#DED6E8")), ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PALE]), ("VALIGN",(0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),7), ("TOPPADDING",(0,0),(-1,-1),6), ("BOTTOMPADDING",(0,0),(-1,-1),5)]))
    story.append(metrics)
    story.append(P("Revisión semanal de 20 minutos", "H2Kit"))
    story.extend(bullets(["¿Qué contenido generó más conversaciones?", "¿Qué objeción se repitió?", "¿Qué canal trajo clics de calidad?", "¿Dónde abandonan las personas?", "¿Qué una sola cosa voy a cambiar la próxima semana?"]))
    story.append(callout("Lectura correcta", "Una semana sin ventas no demuestra que el programa no funciona. Revisa si hubo suficiente actividad relevante antes de sacar conclusiones."))

    chapter(story, 10, "Plan de acción de 30 días", "Pasarás de cero a un sistema básico con una acción concreta cada día.")
    weeks = [
        ("Semana 1 - Preparación", ["Elige un nicho", "Completa tu perfil", "Estudia un producto", "Escribe tu propuesta", "Prepara 10 preguntas de audiencia", "Crea tu registro", "Revisa y ajusta"]),
        ("Semana 2 - Contenido", ["Publica el problema 1", "Publica un consejo", "Haz una demostración", "Responde una objeción", "Presenta la oferta", "Conversa con 3 interesados", "Mide y mejora"]),
        ("Semana 3 - Conversación", ["Pide feedback", "Publica caso de uso", "Crea un FAQ", "Envía seguimiento con permiso", "Comparte una checklist", "Haz una historia de aprendizaje", "Revisa métricas"]),
        ("Semana 4 - Optimización", ["Repite el mejor formato", "Mejora el gancho", "Prueba otro canal", "Publica comparación", "Haz oferta clara", "Ordena contactos", "Cierra el mes y planifica el siguiente"]),
    ]
    for week, actions in weeks:
        story.append(P(week, "H2Kit"))
        story.append(checklist_table(actions, headers=("Acción", "Hecho")))
        story.append(Spacer(1, 8))
    story.append(P("Días 29 y 30", "H2Kit"))
    story.append(checklist_table(["Resume tus aprendizajes y las objeciones más frecuentes.", "Define una meta de actividad para los próximos 30 días: publicaciones, conversaciones y seguimientos."]))

    chapter(story, 11, "Errores, ética y cumplimiento", "Evitarás prácticas que dañan la confianza, la marca y tu actividad.")
    story.append(P("El marketing de afiliación sostenible protege al comprador. No utilices escasez falsa, testimonios inventados, capturas de ingresos ajenas, spam, identidades falsas ni afirmaciones que no puedas demostrar."))
    story.append(P("Errores frecuentes", "H2Kit"))
    story.extend(bullets([
        "Promocionar demasiados nichos al mismo tiempo.", "Publicar solo enlaces sin educación ni contexto.",
        "Hablar del producto sin entenderlo.", "Copiar mensajes con tono agresivo o ajeno.",
        "No declarar la relación de afiliación cuando corresponde.", "Ignorar reglas de privacidad, consentimiento y baja.",
        "Confundir facturación con beneficio neto.", "No reservar documentación para obligaciones fiscales locales."
    ]))
    story.append(callout("Aviso", "Este material es educativo y no sustituye asesoramiento legal, fiscal o financiero. Consulta las reglas aplicables en tu país y conserva registros de tus cobros y gastos."))
    story.append(P("Checklist de publicación responsable", "H2Kit"))
    story.append(checklist_table([
        "La promesa es concreta y no garantiza resultados.", "La información de precio y contenido coincide con la landing.",
        "La pieza identifica o permite identificar la relación de afiliación.", "La llamada a la acción conduce a la página correcta.",
        "No uso datos personales sin permiso.", "Puedo responder dudas básicas o dirigir al soporte oficial."
    ]))

    chapter(story, 12, "Plantillas y recursos listos", "Tendrás mensajes base, un guion de vídeo, ideas de contenido y una hoja de trabajo para empezar hoy.")
    story.append(P("15 ganchos para adaptar", "H2Kit"))
    story.extend(bullets([
        "Si hoy empezara desde cero en [nicho], haría esto primero.",
        "El error que hace perder horas a muchos [audiencia].",
        "Tres tareas que puedes simplificar esta semana.",
        "Antes de comprar otra herramienta, revisa esto.",
        "No necesitas publicar todos los días: necesitas un sistema.",
        "La pregunta que revela si este recurso te conviene.",
        "Así convierto una idea en cinco contenidos.",
        "Qué incluye realmente este kit y para quién no es.",
        "La diferencia entre una plantilla y un resultado garantizado.",
        "Un ejemplo práctico que puedes probar hoy.",
        "Si WhatsApp te roba tiempo, guarda este mensaje.",
        "Cómo explicar tu oferta sin sonar insistente.",
        "La objeción que más escucho y cómo la respondo.",
        "Mi revisión honesta después de estudiar el recurso.",
        "Tu primer objetivo no son 100 ventas: es entender 10 conversaciones."
    ]))
    story.append(P("Guion de vídeo de 30 segundos", "H2Kit"))
    story.append(callout("Guion", "Gancho: 'Si [problema], esto te interesa'. Contexto: 'Muchos [audiencia] pierden tiempo porque [causa]'. Valor: 'Este recurso incluye [3 elementos] para ayudarte a [resultado]'. Transparencia: 'Soy afiliado y puedo recibir comisión'. Acción: 'Revisa todo el contenido en mi enlace y decide si encaja contigo'."))
    story.append(P("Tu compromiso de 30 días", "H2Kit"))
    story.append(checklist_table([
        "Trabajaré un solo nicho durante 30 días.", "Publicaré al menos 3 piezas útiles por semana.",
        "Iniciaré conversaciones con permiso y sin spam.", "Registraré clics, conversaciones, ventas y aprendizajes.",
        "No prometeré resultados garantizados.", "Pediré ayuda en el portal cuando tenga dudas."
    ]))

    story.append(PageBreak())
    story.append(P("TU SIGUIENTE PASO", "SectionKicker"))
    story.append(P("Empieza pequeño, mide y mejora", "H1Kit"))
    story.append(P("Tu ventaja no es saberlo todo. Es avanzar con un método, escuchar a tu audiencia y usar recursos preparados para comunicar con claridad. Abre el portal privado, completa tu perfil, elige un nicho y empieza el plan de 30 días."))
    story.append(callout("Soporte", "hola@prontialatam.com · www.prontialatam.com/portal-afiliados", CREAM))
    story.append(Spacer(1, 15 * mm))
    story.append(RLImage(str(cover_path), width=160 * mm, height=90 * mm))
    story.append(Spacer(1, 8 * mm))
    story.append(P("ProntIA LATAM", "CenterKit"))
    story.append(P("Recursos digitales prácticos para negocios y afiliados en Latinoamérica.", "SmallKit"))

    doc = KitDocTemplate(str(PDF_OUT), title="Kit Venta de Productos Digitales para Principiantes", author="ProntIA LATAM")
    doc.build(story)
    (KIT_DIR / PDF_OUT.name).write_bytes(PDF_OUT.read_bytes())


def build_support_files():
    KIT_DIR.mkdir(parents=True, exist_ok=True)
    (KIT_DIR / "00-LEEME-PRIMERO.txt").write_text(dedent("""
        KIT VENTA DE PRODUCTOS DIGITALES PARA PRINCIPIANTES
        ProntIA LATAM

        1. Empieza por el PDF principal.
        2. Completa el autodiagnóstico y el plan de 30 días.
        3. Elige un solo nicho y usa un único enlace durante tus primeras dos semanas.
        4. Adapta los copies a tu voz y declara tu relación de afiliación.
        5. Consulta el portal privado para enlaces, comisiones y soporte actualizado.

        Este material es educativo. No promete ingresos garantizados ni sustituye asesoramiento legal, fiscal o financiero.
        Soporte: hola@prontialatam.com
    """).strip() + "\n", encoding="utf-8")

    hooks = [
        ("Descubrimiento", "Si hoy empezara desde cero en [nicho], esta sería mi primera tarea."),
        ("Problema", "El error que hace perder horas a muchos [audiencia] sin que se den cuenta."),
        ("Educación", "Tres tareas que puedes simplificar esta semana con un recurso bien preparado."),
        ("Transparencia", "Qué incluye realmente este kit y para quién no es."),
        ("Demostración", "Así convierto una idea en cinco contenidos sin empezar de cero."),
        ("WhatsApp", "Si responder mensajes te roba tiempo, guarda esta estructura."),
        ("Objeción", "¿No tengo tiempo? Esta es la forma más pequeña de empezar."),
        ("Oferta", "Si quieres aplicar este método, aquí tienes el recurso completo."),
    ]
    with (KIT_DIR / "30-hooks-y-copies.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["tipo", "copy", "llamada_a_la_accion"])
        for i in range(30):
            kind, base = hooks[i % len(hooks)]
            writer.writerow([kind, base.replace("[nicho]", "tu nicho").replace("[audiencia]", "tu audiencia"), "Revisa el contenido completo en mi enlace de afiliado."])

    with (KIT_DIR / "plan-30-dias.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["dia", "fase", "accion", "resultado", "hecho"])
        phases = [
            ("Preparación", ["Elegir un nicho", "Completar el perfil", "Estudiar un producto", "Definir audiencia", "Escribir propuesta", "Preparar registro", "Revisar semana"]),
            ("Contenido", ["Publicar problema", "Publicar consejo", "Crear demostración", "Responder objeción", "Presentar oferta", "Conversar con interesados", "Revisar métricas"]),
            ("Conversación", ["Pedir feedback", "Publicar caso de uso", "Crear FAQ", "Hacer seguimiento", "Compartir checklist", "Contar aprendizaje", "Revisar métricas"]),
            ("Optimización", ["Repetir mejor formato", "Mejorar gancho", "Probar otro canal", "Publicar comparación", "Hacer oferta clara", "Ordenar contactos", "Cerrar mes"]),
        ]
        day = 1
        for phase, actions in phases:
            for action in actions:
                writer.writerow([day, phase, action, "", ""])
                day += 1
        writer.writerow([29, "Cierre", "Resumir aprendizajes y objeciones", "", ""])
        writer.writerow([30, "Cierre", "Planificar el siguiente mes", "", ""])

    with (KIT_DIR / "registro-semanal.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["fecha", "canal", "nicho", "pieza", "conversaciones", "clics", "ventas", "comision", "aprendizaje"])
        for _ in range(20):
            writer.writerow(["", "", "", "", "", "", "", "", ""])

    (KIT_DIR / "checklist-publicacion-responsable.txt").write_text(dedent("""
        CHECKLIST ANTES DE PUBLICAR
        [ ] La promesa es concreta y no garantiza resultados.
        [ ] Precio, contenido y entrega coinciden con la landing oficial.
        [ ] Declaro que puedo recibir comisión cuando corresponde.
        [ ] El enlace contiene mi código correcto.
        [ ] No utilizo datos personales sin permiso.
        [ ] No uso escasez falsa, testimonios inventados ni capturas de ingresos ajenas.
        [ ] Sé responder dudas básicas o dirigir al soporte oficial.
    """).strip() + "\n", encoding="utf-8")


def build_zip():
    with zipfile.ZipFile(ZIP_OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(KIT_DIR.rglob("*")):
            if file.is_file():
                zf.write(file, arcname=f"Kit-Venta-Digital-Principiantes/{file.relative_to(KIT_DIR)}")


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    create_social_asset("kit-principiantes-square.jpg", (1080, 1080), "Vende productos digitales desde cero", "Método educativo para afiliados en LATAM", 0.72)
    create_social_asset("kit-principiantes-story.jpg", (1080, 1920), "Tu primer sistema de afiliación", "Aprende · Publica · Mide · Mejora", 0.68)
    create_social_asset("kit-principiantes-landscape.jpg", (1200, 628), "Kit Venta Digital para Principiantes", "Gratis para afiliados aprobados de ProntIA LATAM", 0.55)
    build_pdf()
    build_support_files()
    for asset_name in ["hero-latam.png", "kit-principiantes-square.jpg", "kit-principiantes-story.jpg", "kit-principiantes-landscape.jpg"]:
        source = ASSET_DIR / asset_name
        target = KIT_DIR / "imagenes" / asset_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
    build_zip()
    print(PDF_OUT)
    print(ZIP_OUT)


if __name__ == "__main__":
    main()
