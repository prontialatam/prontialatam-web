#!/usr/bin/env python3
from pathlib import Path
import csv
import textwrap
import zipfile

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image as RLImage,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle
)


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "img" / "kit-30d-contenido"
KIT_DIR = ROOT / "downloads" / "kit-30-dias-contenido"
PDF_OUT = ROOT / "output" / "pdf" / "kit-30-dias-contenido-conversaciones-latam.pdf"
ZIP_OUT = ROOT / "downloads" / "kit-30-dias-contenido-conversaciones.zip"
LANDING_URL = "prontialatam.com/kit-gratis-afiliados"
LOGO_CANDIDATES = [
    ROOT.parent / "LOGOS PRONTIA" / "LOGO.jpg",
    ROOT / "logo-prontia.jpg",
]

PURPLE = colors.HexColor("#34125D")
PURPLE_SOFT = colors.HexColor("#6D28D9")
MAGENTA = colors.HexColor("#D946EF")
ORANGE = colors.HexColor("#F97316")
CREAM = colors.HexColor("#FFF7ED")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5E6678")
PALE = colors.HexColor("#F7F1FB")
WHITE = colors.white


CALENDAR_ROWS = [
    ("Día 1", "Presentarte", "Post", "Cuenta por qué estás aprendiendo a vender productos digitales.", "Pregunta: ¿qué te gustaría monetizar?"),
    ("Día 2", "Detectar dolor", "Story", "Pregunta qué es lo que más frena a quien quiere vender online.", "Usa encuesta o caja de preguntas."),
    ("Día 3", "Educar", "Carrusel", "Tres errores que bloquean a un afiliado principiante.", "Invita a guardar el contenido."),
    ("Día 4", "Interacción", "Post", "Haz una comparación entre improvisar y usar un plan.", "Pide que comenten 'PLAN'."),
    ("Día 5", "Presentar solución", "Reel", "Explica qué cambia cuando tienes un sistema de publicaciones.", "CTA a mensaje privado."),
    ("Día 6", "Confianza", "Post", "Comparte una historia personal o una lección reciente.", "Pregunta si se identifican."),
    ("Día 7", "Conversación", "Story", "Abre conversación con una palabra clave.", "Pide responder 'GUÍA'."),
    ("Día 8", "Objeción", "Post", "Habla del miedo a parecer spam y cómo evitarlo.", "Invita a comentar la objeción."),
    ("Día 9", "Autoridad", "Carrusel", "Checklist de lo que revisar antes de recomendar un producto.", "CTA a guardar."),
    ("Día 10", "Diagnóstico", "Post", "Describe una situación típica del cliente ideal.", "Pregunta si está en esa fase."),
    ("Día 11", "Valor rápido", "Reel", "Comparte un tip de contenido aplicable en 30 minutos.", "CTA a compartir."),
    ("Día 12", "Interacción", "Story", "Haz una encuesta entre tres problemas frecuentes.", "Usa opción múltiple."),
    ("Día 13", "Error común", "Post", "Habla del error de publicar solo enlaces.", "Pide escribir 'sí' o 'no'."),
    ("Día 14", "Microprueba", "Carrusel", "Ejemplo de antes/después de un mensaje mejor redactado.", "Invita a guardar."),
    ("Día 15", "Confianza", "Post", "Cuenta qué aprendiste después de varias publicaciones.", "Pregunta si quieren el guion."),
    ("Día 16", "Conversación", "Story", "Lanza una caja de preguntas sobre ventas o afiliación.", "Responde luego en privado."),
    ("Día 17", "Educar", "Post", "Tres señales de que tu contenido no está llamando a la acción.", "CTA a comentar 'REVISAR'."),
    ("Día 18", "Visual", "Carrusel", "Explica un mini proceso paso a paso.", "Invita a enviar DM."),
    ("Día 19", "Relevancia", "Reel", "Gancho sobre el error que casi todos repiten al empezar.", "Pide guardar el vídeo."),
    ("Día 20", "Conversación", "Post", "Pregunta cuál es el mayor freno para publicar constante.", "Invita a responder en comentarios."),
    ("Día 21", "Oferta suave", "Story", "Presenta un recurso gratuito sin vender agresivamente.", "Deja CTA a palabra clave."),
    ("Día 22", "Educar", "Post", "Explica la diferencia entre contenido útil y contenido promocional.", "Pregunta en qué fase están."),
    ("Día 23", "Confianza", "Post", "Comparte un mini caso o resultado realista.", "Invita a pedir el ejemplo."),
    ("Día 24", "Interacción", "Story", "Haz una votación sobre qué formato cuesta más.", "Usa sticker."),
    ("Día 25", "Producto", "Carrusel", "Habla de cómo presentar una solución sin forzar compra.", "Pide guardar."),
    ("Día 26", "Conversación", "Post", "Invita a escribir una palabra y responderás con un ejemplo.", "CTA a comentario."),
    ("Día 27", "Objeción", "Reel", "Responde a 'todavía no tengo audiencia'.", "CTA a DM."),
    ("Día 28", "Seguimiento", "Post", "Explica por qué seguir a quien mostró interés sin insistir.", "Pregunta quién quiere plantilla."),
    ("Día 29", "Llamada a acción", "Story", "Recuerda que quien no pregunta no avanza.", "CTA a responder."),
    ("Día 30", "Cierre del ciclo", "Post", "Resume qué has aprendido en 30 días y cuál será tu siguiente paso.", "Invita a conversar."),
]

POST_TEMPLATES = [
    ("Comentarios", "¿Qué te está frenando ahora mismo?", "Si hoy tuvieses que ser sincero, ¿qué es lo que más te bloquea para vender online? A veces no falta talento, falta claridad.", "Comenta la palabra BLOQUEO."),
    ("Comentarios", "No necesitas publicar más", "No necesitas publicar más. Necesitas publicar algo que conecte con un problema real y abra una conversación.", "Escribe CLARIDAD y te doy un ejemplo."),
    ("Comentarios", "Improvisar vs sistema", "Improvisar consume energía. Un sistema te libera para ejecutar mejor y con menos ansiedad.", "¿Eres más de improvisar o planificar?"),
    ("Comentarios", "Pregunta de diagnóstico", "Si quisieras conseguir tu primera conversación de venta esta semana, ¿qué paso te costaría más?", "Comenta el número 1, 2 o 3."),
    ("Comentarios", "Contenido que no pregunta", "Mucho contenido explica, poco contenido pregunta. Y sin preguntas, casi nunca llegan conversaciones.", "¿Te pasa?"),
    ("Educativo", "3 errores", "Tres errores al empezar: publicar solo enlaces, hablar de ti y no del problema, y no cerrar con CTA claro.", "Guarda este post."),
    ("Educativo", "Estructura simple", "Gancho, problema, recomendación y CTA. Esa estructura te ahorra tiempo y mejora tus publicaciones.", "¿Quieres un ejemplo?"),
    ("Educativo", "Qué sí compartir", "Comparte errores, historias, aprendizajes, comparaciones y preguntas. Eso genera confianza antes de vender.", "Guárdalo para esta semana."),
    ("Educativo", "Cómo responder comentarios", "No respondas con el enlace directo. Primero valida, pregunta y lleva a conversación cuando tenga sentido.", "Escribe MENSAJE si quieres una plantilla."),
    ("Educativo", "Qué medir", "No midas solo ventas: mide comentarios, mensajes, respuestas y seguimientos.", "¿Qué estás midiendo tú?"),
    ("Solución", "Recurso listo", "Preparé una ruta de publicaciones para quien quiere dejar de improvisar y empezar a generar conversaciones.", "Pide la GUÍA."),
    ("Solución", "Primer paso", "Si no sabes qué publicar, no empieces por vender. Empieza por una pregunta concreta sobre el problema del cliente.", "Guarda este consejo."),
    ("Solución", "Sistema de 30 días", "Con un sistema de 30 días puedes publicar con coherencia y aprender mucho más rápido qué conecta.", "Escríbeme 30D si lo quieres."),
    ("Solución", "Contenido y WhatsApp", "El contenido no cierra solo. Su trabajo es abrir la puerta a una conversación por mensaje.", "¿Quieres ver el flujo?"),
    ("Solución", "Promesa realista", "No prometas ventas rápidas. Promete claridad, constancia y conversaciones de calidad.", "Comenta REALISTA."),
    ("Conversación", "DM natural", "Si te interesa, te puedo enseñar el tipo de publicación que usaría en tu nicho.", "Escribe tu nicho."),
    ("Conversación", "Respuesta personalizada", "No te voy a mandar un texto genérico. Si me dices tu caso, te respondo con un ejemplo adaptado.", "Mándame un mensaje."),
    ("Conversación", "Invitación a explicar", "Si quieres, te explico cómo convertir una publicación en una conversación sin parecer spam.", "Escribe AYUDA."),
    ("Conversación", "Elegir formato", "¿Qué te resulta más natural: post, story o reel? Según eso te puedo sugerir el mejor primer paso.", "Comenta tu formato."),
    ("Conversación", "Siguiente paso", "Lo importante no es publicar mucho. Lo importante es saber qué hacer cuando alguien muestra interés.", "Escribe CONVERSAR."),
]

REEL_SCRIPTS = [
    ("No te falta constancia", "Si publicas todos los días y nadie te pregunta, quizá no te falte constancia. Te falta hablar de un problema específico. En vez de decir compra esto, explica qué error ayuda a resolver y cierra con una pregunta."),
    ("Publicar no es vender", "Publicar no es vender. Publicar es abrir una puerta. La venta empieza cuando alguien comenta, responde o te escribe por privado y tú sabes continuar la conversación."),
    ("El error del enlace", "Uno de los errores más comunes al empezar es publicar solo el enlace. Eso corta la relación. Primero genera interés, luego conversación y después presenta la solución."),
    ("Qué publicar hoy", "Si no sabes qué publicar hoy, responde a esta pregunta: ¿qué duda repite tu cliente ideal una y otra vez? Esa respuesta ya te da un post, una story y un reel."),
    ("Spam vs ayuda", "La diferencia entre spam y ayuda no está solo en el enlace. Está en si tu mensaje nace de una necesidad real del cliente y respeta su contexto."),
    ("Métricas iniciales", "Si todavía no vendes, no te obsesiones con la caja. Mira comentarios, respuestas, mensajes y seguimientos. Ahí empieza el aprendizaje real."),
    ("Por qué nadie responde", "Muchas veces nadie responde porque tu CTA no invita a reaccionar. Cambia descubre más por una pregunta concreta o una palabra clave."),
    ("Historia corta", "Cuenta una historia breve: qué intentaste, qué error cometiste y qué aprendiste. Esa estructura conecta mucho más que un post puramente promocional."),
    ("WhatsApp natural", "WhatsApp funciona mejor cuando llegas desde el contenido. Si alguien ya te respondió o te pidió más información, la conversación entra más caliente y natural."),
    ("Plan de 30 días", "No necesitas inventar una idea nueva cada mañana. Necesitas un calendario simple que combine educación, interacción, confianza y conversación."),
]

HOOKS = [
    "El error que comete casi todo afiliado principiante…",
    "No necesitas publicar más; necesitas publicar esto…",
    "Si nadie te responde, revisa esta parte de tu mensaje…",
    "Lo que me habría gustado saber antes de empezar en afiliación…",
    "Publicas, pero nadie te pregunta. Suele pasar por esto…",
    "Antes de recomendar un producto, revisa estas tres cosas…",
    "Si hoy tuviera que empezar desde cero, haría esto primero…",
    "No es falta de audiencia. A veces es falta de enfoque…",
    "El problema no es tu contenido; es lo que no estás diciendo…",
    "La mayoría intenta vender demasiado pronto y pierde esto…",
    "Si quieres conversaciones, deja de terminar tus posts así…",
    "Esto parece pequeño, pero cambia la reacción de tu audiencia…",
    "La pregunta más útil que puedes publicar hoy es esta…",
    "Si alguien no te compra hoy, aún puedes hacer esto…",
    "La mayoría comparte beneficios. Pocos hablan del bloqueo real…",
    "No empieces por el enlace. Empieza por aquí…",
    "El contenido que más se guarda no siempre es el más largo…",
    "Si tu post suena a anuncio, prueba este cambio…",
    "Tres señales de que tu CTA no está funcionando…",
    "La gente no siempre necesita más información; necesita claridad…",
    "No publiques para todos. Publica para esta persona…",
    "La diferencia entre contenido bonito y contenido útil es esta…",
    "Muchos quieren vender, pocos saben abrir conversación…",
    "Si hoy nadie te escribió, revisa este punto…",
    "Esto es lo que haría para conseguir mi primera conversación esta semana…",
    "Un reel corto puede abrir más conversaciones que un post largo si haces esto…",
    "La objeción que más se repite al empezar no es la que imaginas…",
    "Cuando alguien comenta, esta respuesta funciona mejor…",
    "Si te da miedo parecer spam, lee esto…",
    "El problema no es vender. El problema es vender sin contexto…",
    "Esto ayuda a que la gente confíe antes de escribirte…",
    "Una publicación puede educar, vender y abrir conversación al mismo tiempo…",
    "Si tu contenido no mueve a nadie, simplifica esto…",
    "No hace falta parecer experto para ayudar de verdad…",
    "Haz esta comparación y verás más interacción…",
    "Este tipo de historia genera más cercanía que cualquier promesa…",
    "No necesitas una gran comunidad para empezar a conversar…",
    "Así puedes presentar una solución sin presionar…",
    "Si todavía no sabes qué vender, empieza por esta pregunta…",
    "Tu primera venta puede empezar con un comentario sencillo…",
    "El mejor CTA no siempre pide comprar…",
    "Esto es lo que más frena a quien quiere vender online…",
    "Si tu nicho no responde, quizá no estás tocando este punto…",
    "La gente reacciona mejor cuando escucha esto primero…",
    "No publiques solo lo que ofreces: publica lo que cambia…",
    "Así conviertes una duda en una conversación…",
    "Un mensaje más humano suele vender mejor que uno más técnico…",
    "Cuando no sabes qué publicar, usa esta estructura…",
    "Si quieres que te escriban, evita esta frase…",
    "La mayoría busca ventas; tú busca primero señales de interés…",
]

CTA_LIST = [
    "¿Cuál de estos problemas tienes tú ahora mismo?",
    "Escribe GUÍA y te explico por dónde empezaría.",
    "Guarda esta publicación para aplicarla después.",
    "¿Quieres que prepare un ejemplo para tu nicho?",
    "Cuéntame qué estás intentando vender.",
    "¿Estás en la fase 1, 2 o 3?",
    "Si te sirve, te muestro una estructura lista para adaptar.",
    "Escríbeme por privado si quieres un ejemplo aterrizado.",
    "Dime tu principal bloqueo y te doy una idea concreta.",
    "Comparte esto con alguien que esté en esta fase.",
    "¿Prefieres post, story o reel? Te leo.",
    "Si quieres la plantilla, comenta PLANTILLA.",
    "Responde con una palabra y sigo por privado.",
    "¿Te gustaría que lo convierta en checklist?",
    "Guárdalo para cuando vayas a publicar.",
    "Si estás empezando, escribe EMPEZAR.",
    "¿Qué parte te cuesta más: idea, texto o cierre?",
    "Cuéntame tu país y adapto el ejemplo.",
    "Pide el ejemplo si quieres verlo aplicado.",
    "Si te identificas, responde con un sí.",
]

WHATSAPP_FLOW = [
    ("Mensaje de bienvenida", "Gracias por escribirme. Para ayudarte bien, cuéntame qué te gustaría vender o qué te está costando ahora mismo."),
    ("Pregunta de situación", "¿Ahora mismo tu mayor bloqueo es no saber qué publicar, no conseguir respuestas o no saber cómo presentar el producto?"),
    ("Diagnóstico breve", "Perfecto. Entonces no necesitas más información genérica: necesitas un ejemplo aplicable a tu caso."),
    ("Puente a solución", "Si quieres, te comparto una estructura simple para publicar sin sonar promocional y abrir una conversación real."),
    ("Presentación natural", "Después de ver lo que buscas, creo que este recurso/kit te encaja porque te ayuda a resolver exactamente ese punto."),
    ("Seguimiento 24h", "Ayer te compartí la estructura. ¿Pudiste verla? Si quieres, te preparo una idea adaptada a tu nicho."),
    ("Objeción dinero", "Lo entiendo. Mientras tanto, te recomiendo aplicar primero el calendario y validar si consigues conversaciones."),
    ("Objeción pensarlo", "Sin problema. Si quieres, dime qué te genera duda y te respondo con claridad para que decidas con calma."),
    ("Cierre suave", "Si te encaja, te paso el siguiente paso. Y si todavía no, te dejo una recomendación práctica para avanzar igual."),
]

AI_PROMPTS = [
    "Actúa como estratega de contenidos para LATAM y crea 5 ideas de publicación sobre [producto] para [tipo de persona] con foco en conversación, no en venta directa.",
    "Convierte este problema del cliente en un post corto para Facebook con tono cercano y CTA a comentario: [problema].",
    "Escribe un Reel de 30 segundos con estructura gancho, problema, recomendación y CTA para [producto].",
    "Dame 10 ganchos de curiosidad para hablar de [tema] sin prometer resultados irreales.",
    "Crea una secuencia de 3 stories para mover a alguien desde interés inicial hasta mensaje privado sobre [tema].",
    "Redacta una respuesta a la objeción 'no tengo dinero' manteniendo empatía y sin presionar la venta.",
    "Convierte este testimonio en una publicación ética, sin exageraciones y con aprendizaje aplicable: [testimonio].",
    "Genera 5 CTA breves y humanos para cerrar una publicación sobre [tema] sin parecer spam.",
    "Adapta este copy a un tono más natural para [país LATAM]: [texto].",
    "Dame 3 ideas de contenido educativo, 3 de interacción y 3 de conversación para [nicho].",
    "Crea una tabla de 7 días con idea, formato, gancho y CTA para [producto] y [audiencia].",
    "Escribe una respuesta breve para un comentario positivo que abra conversación privada con elegancia.",
    "Resume en 5 puntos cómo explicar un producto digital sin sonar vendedor.",
    "Dame 8 preguntas que podría hacer a mi audiencia para entender qué le impide vender online.",
    "Transforma esta idea vaga en un carrusel claro de 5 diapositivas: [idea].",
]


def resolve_logo_path():
    for candidate in LOGO_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("No se encontró el logo de ProntIA LATAM para generar el kit 30D.")


LOGO_PATH = resolve_logo_path()
LOGO_READER = ImageReader(str(LOGO_PATH))


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def wrap_lines(draw, text, selected_font, width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
      candidate = (current + " " + word).strip()
      if draw.textbbox((0, 0), candidate, font=selected_font)[2] <= width:
        current = candidate
      else:
        lines.append(current)
        current = word
    if current:
      lines.append(current)
    return lines


def fit_title(draw, text, width, max_size, min_size):
    for size in range(max_size, min_size - 1, -2):
        current = font(size, bold=True)
        lines = wrap_lines(draw, text, current, width)
        if len(lines) <= 4:
            return current, lines
    current = font(min_size, bold=True)
    return current, wrap_lines(draw, text, current, width)


def create_social_image(path, size, title, subtitle, cta, footer, accent_text):
    width, height = size
    canvas = Image.new("RGB", size, "#090c20")
    draw = ImageDraw.Draw(canvas)

    for offset, color in [(0, (18, 20, 54)), (1, (34, 14, 78)), (2, (255, 106, 0))]:
        ellipse = Image.new("RGBA", size, (0, 0, 0, 0))
        edraw = ImageDraw.Draw(ellipse)
        bbox = (int(width * (0.02 + offset * 0.08)), int(height * (0.05 + offset * 0.06)), int(width * (0.82 + offset * 0.05)), int(height * (0.92 - offset * 0.05)))
        edraw.ellipse(bbox, fill=(*color, 56))
        ellipse = ellipse.filter(ImageFilter.GaussianBlur(38))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), ellipse).convert("RGB")
        draw = ImageDraw.Draw(canvas)

    outer = (36, 36, width - 36, height - 36)
    draw.rounded_rectangle(outer, radius=28, fill=(10, 16, 38), outline=(255, 255, 255, 32), width=2)

    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_size = 96 if width >= 1000 else 72
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    canvas.paste(logo, (66, 60), logo)

    brand_font = font(28 if width >= 1000 else 22, bold=True)
    draw.text((66 + logo_size + 18, 78), "prontIA LATAM", font=brand_font, fill=(255, 255, 255))

    tag_font = font(18 if width >= 1000 else 14, bold=True)
    draw.rounded_rectangle((66, 180, 66 + (360 if width >= 1000 else 250), 226), radius=23, fill=(255, 106, 0))
    draw.text((86, 193), accent_text, font=tag_font, fill=(255, 255, 255))

    title_font, title_lines = fit_title(draw, title, width - 132, 78 if width >= 1000 else 54, 36 if width >= 1000 else 26)
    y = 258
    for line in title_lines:
        draw.text((66, y), line, font=title_font, fill=(255, 255, 255))
        y += int(title_font.size * 1.02)

    subtitle_font = font(28 if width >= 1000 else 20, bold=False)
    for line in subtitle.split("\n"):
        draw.text((66, y + 18), line, font=subtitle_font, fill=(231, 236, 248))
        y += int(subtitle_font.size * 1.42)

    draw.rounded_rectangle((66, height - 210, width - 66, height - 134), radius=20, fill=(16, 25, 60))
    cta_font = font(26 if width >= 1000 else 18, bold=True)
    footer_font = font(24 if width >= 1000 else 17, bold=False)
    draw.text((96, height - 188), cta, font=cta_font, fill=(255, 190, 130))
    draw.text((96, height - 148), footer, font=footer_font, fill=(255, 255, 255))

    canvas.save(path, quality=94, optimize=True)


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kit30Kick", fontName="Helvetica-Bold", fontSize=9.6, leading=12, textColor=ORANGE, uppercase=True, spaceAfter=6))
styles.add(ParagraphStyle(name="Kit30Title", fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=WHITE, alignment=TA_LEFT, spaceAfter=8))
styles.add(ParagraphStyle(name="Kit30H1", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=PURPLE, spaceBefore=4, spaceAfter=10))
styles.add(ParagraphStyle(name="Kit30H2", fontName="Helvetica-Bold", fontSize=15.5, leading=19, textColor=PURPLE_SOFT, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name="Kit30Body", fontName="Helvetica", fontSize=10.1, leading=15, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="Kit30Small", fontName="Helvetica", fontSize=8.6, leading=12, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name="Kit30Bullet", fontName="Helvetica", fontSize=9.8, leading=14, leftIndent=12, firstLineIndent=-7, textColor=INK, spaceAfter=4))
styles.add(ParagraphStyle(name="Kit30Callout", fontName="Helvetica-Bold", fontSize=10.4, leading=14, textColor=PURPLE))
styles.add(ParagraphStyle(name="Kit30Center", fontName="Helvetica-Bold", fontSize=10.2, leading=14, textColor=PURPLE, alignment=TA_CENTER))


def P(text, style="Kit30Body"):
    return Paragraph(text, styles[style])


class KitDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=22 * mm, bottomMargin=18 * mm)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates([PageTemplate(id="kit", frames=frame, onPage=self.decorate_page)])

    def decorate_page(self, canvas, doc):
        canvas.saveState()
        header_top = A4[1] - 8 * mm
        canvas.drawImage(LOGO_READER, 18 * mm, header_top - 12 * mm, width=12 * mm, height=12 * mm, preserveAspectRatio=True, mask="auto")
        canvas.setStrokeColor(colors.HexColor("#E9DDF5"))
        canvas.setLineWidth(0.6)
        canvas.line(18 * mm, header_top - 14 * mm, A4[0] - 18 * mm, header_top - 14 * mm)
        canvas.setFillColor(PURPLE)
        canvas.setFont("Helvetica-Bold", 9.5)
        canvas.drawString(33 * mm, header_top - 6.5 * mm, "ProntIA LATAM")
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(33 * mm, header_top - 10.4 * mm, "Kit 30D - Conversaciones de venta")
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(18 * mm, 10 * mm, "ProntIA LATAM - 30 dias de contenido para primeras conversaciones")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, str(doc.page))
        canvas.restoreState()


def callout(title, body, bg=CREAM):
    table = Table([[P(title, "Kit30Callout"), P(body, "Kit30Body")]], colWidths=[40 * mm, 120 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E5D6F3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def write_csv(path, headers, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(rows)


def write_text(path, title, items):
    chunks = [title, ""]
    for index, item in enumerate(items, start=1):
        if isinstance(item, tuple):
            chunks.append(f"{index}. {item[0]}")
            chunks.append(item[1])
        else:
            chunks.append(f"{index}. {item}")
        chunks.append("")
    path.write_text("\n".join(chunks).strip() + "\n", encoding="utf-8")


def build_pdf():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    KIT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)

    story = []
    hero_path = ASSET_DIR / "kit-30d-landscape.jpg"
    if not hero_path.exists():
        create_social_image(
            hero_path,
            (1600, 900),
            "30 días de contenido para conseguir tus primeras conversaciones de venta",
            "Calendario, ganchos, guiones y CTA\npara dejar de improvisar y empezar a conversar.",
            "Descarga gratis sin darte de alta como afiliado",
            LANDING_URL,
            "KIT 30D GRATUITO"
        )

    cover = Table([
        [P("KIT GRATUITO PARA AFILIADOS", "Kit30Kick")],
        [P("30 días de contenido para conseguir tus primeras conversaciones de venta", "Kit30Title")],
        [Paragraph("Publicaciones, guiones, mensajes y prompts para que un afiliado principiante deje de improvisar y empiece a generar conversaciones de valor.", ParagraphStyle(name="CoverBody", fontName="Helvetica", fontSize=13, leading=18, textColor=WHITE))],
    ], colWidths=[160 * mm])
    cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
    ]))
    story.extend([
        Spacer(1, 14 * mm),
        cover,
        Spacer(1, 7 * mm),
        RLImage(str(hero_path), width=160 * mm, height=90 * mm),
        Spacer(1, 6 * mm),
        P("Recurso orientado a LATAM con enfoque en contenido, conversación y ventas éticas.", "Kit30Center"),
        PageBreak(),
        P("ANTES DE EMPEZAR", "Kit30Kick"),
        P("Qué hace diferente a este kit", "Kit30H1"),
        P("Este recurso no vuelve a explicarte desde cero cómo funciona la afiliación. Da por hecho que ya quieres avanzar y resuelve el problema siguiente: no saber qué publicar, qué decir ni cómo mover a alguien a una conversación útil."),
        callout("Promesa realista", "Publicar durante 30 días con una estructura clara para despertar interés, recibir respuestas y abrir conversaciones sin hacer spam."),
        P("Úsalo así", "Kit30H2"),
        P("• Elige un nicho o un producto.<br/>• Publica con constancia, no con perfeccionismo.<br/>• Usa los CTA para abrir conversación.<br/>• Registra respuestas, mensajes y seguimientos.", "Kit30Bullet"),
        P("Qué encontrarás dentro del ZIP", "Kit30H2"),
    ])

    include_rows = [
        ["Calendario 30D", "30 ideas con objetivo, formato y CTA."],
        ["20 publicaciones", "Textos casi listos para adaptar."],
        ["10 guiones de vídeo", "Estructura gancho, problema, recomendación y CTA."],
        ["50 ganchos", "Abridores para captar atención sin exagerar."],
        ["20 CTA", "Llamadas a la acción sin parecer spam."],
        ["WhatsApp", "Mensajes y seguimientos para conversar mejor."],
        ["Prompts IA", "Instrucciones para crear contenido más rápido."],
        ["Tracking", "Plantilla para medir actividad y conversaciones."],
    ]
    include_table = Table([[P("Recurso", "Kit30Callout"), P("Uso", "Kit30Callout")]] + [[P(a, "Kit30Small"), P(b, "Kit30Body")] for a, b in include_rows], colWidths=[44 * mm, 116 * mm], repeatRows=1)
    include_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#E0D6EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([include_table, PageBreak(), P("CALENDARIO", "Kit30Kick"), P("30 días para dejar de improvisar", "Kit30H1")])

    calendar_table = Table(
        [[P("Día", "Kit30Callout"), P("Objetivo", "Kit30Callout"), P("Formato", "Kit30Callout"), P("Idea", "Kit30Callout"), P("CTA", "Kit30Callout")]] +
        [[P(a, "Kit30Small"), P(b, "Kit30Small"), P(c, "Kit30Small"), P(d, "Kit30Small"), P(e, "Kit30Small")] for a, b, c, d, e in CALENDAR_ROWS],
        colWidths=[18 * mm, 28 * mm, 23 * mm, 57 * mm, 34 * mm],
        repeatRows=1
    )
    calendar_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E1D6EE")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([calendar_table, PageBreak(), P("GUIONES Y MENSAJES", "Kit30Kick"), P("Guiones, CTA y WhatsApp", "Kit30H1"), callout("Clave de este módulo", "El contenido no busca cerrar por sí solo. Busca abrir una conversación que puedas continuar con contexto y criterio.", PALE), P("10 guiones para Reels, Shorts y TikTok", "Kit30H2")])

    for title, script in REEL_SCRIPTS:
        story.append(callout(title, script, CREAM))
        story.append(Spacer(1, 4))

    story.append(P("20 CTA sin sonar a spam", "Kit30H2"))
    for chunk_start in range(0, len(CTA_LIST), 5):
        chunk = CTA_LIST[chunk_start:chunk_start + 5]
        story.append(P("<br/>".join([f"• {item}" for item in chunk]), "Kit30Bullet"))

    story.append(P("Flujo base de conversación por WhatsApp", "Kit30H2"))
    whatsapp_table = Table([[P("Paso", "Kit30Callout"), P("Mensaje orientativo", "Kit30Callout")]] + [[P(step, "Kit30Small"), P(message, "Kit30Small")] for step, message in WHATSAPP_FLOW], colWidths=[42 * mm, 118 * mm], repeatRows=1)
    whatsapp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE_SOFT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E1D6EE")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([whatsapp_table, PageBreak(), P("IA Y SEGUIMIENTO", "Kit30Kick"), P("Prompts y mentalidad de medición", "Kit30H1"), P("La IA acelera, pero no reemplaza tu criterio. Usa estos prompts para producir más rápido, no para sonar genérico."), P("Prompts recomendados", "Kit30H2")])

    for prompt in AI_PROMPTS:
        story.append(P(f"• {prompt}", "Kit30Bullet"))

    story.extend([
        P("Qué medir cada semana", "Kit30H2"),
        callout("Métrica mínima", "Registra contenidos publicados, comentarios, mensajes, seguimientos y conversaciones útiles. Las ventas llegarán mejor si antes observas estas señales."),
        P("Cierre recomendado", "Kit30H2"),
        P("Si completas los 30 días, habrás generado dos activos muy valiosos: claridad sobre qué mensaje conecta y un pequeño banco de conversaciones reales. A partir de ahí, el siguiente paso ya no es improvisar más. Es repetir lo que sí funcionó y descartar lo que no."),
    ])

    KitDoc(str(PDF_OUT)).build(story)


def build_support_files():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    KIT_DIR.mkdir(parents=True, exist_ok=True)

    write_csv(KIT_DIR / "calendario-30-dias-contenido.csv", ["Dia", "Objetivo", "Formato", "Tema", "CTA"], CALENDAR_ROWS)
    write_csv(KIT_DIR / "20-publicaciones-listas.csv", ["Categoria", "Titulo", "Texto base", "CTA"], POST_TEMPLATES)
    write_csv(KIT_DIR / "50-ganchos.csv", ["Hook"], [(item,) for item in HOOKS])
    write_csv(KIT_DIR / "20-cta-sin-spam.csv", ["CTA"], [(item,) for item in CTA_LIST])
    write_csv(KIT_DIR / "10-guiones-video-corto.csv", ["Titulo", "Guion"], REEL_SCRIPTS)
    write_csv(KIT_DIR / "hoja-seguimiento-conversaciones.csv", ["Fecha", "Contenido", "Formato", "Alcance", "Comentarios", "Mensajes", "Seguimientos", "Resultado", "Notas"], [])

    write_text(KIT_DIR / "mensajes-whatsapp.txt", "Guía rápida de mensajes y seguimientos por WhatsApp", WHATSAPP_FLOW)
    write_text(KIT_DIR / "prompts-ia.txt", "Prompts IA para producir contenido más rápido", AI_PROMPTS)

    readme = textwrap.dedent(
        f"""\
        PRONTIA LATAM
        Kit 30D - 30 días de contenido para conseguir tus primeras conversaciones de venta

        Qué incluye:
        - PDF principal con la metodología y la estructura de uso.
        - Calendario de 30 días.
        - 20 publicaciones listas para adaptar.
        - 50 ganchos.
        - 20 CTA sin spam.
        - 10 guiones de vídeo corto.
        - Mensajes de WhatsApp.
        - Prompts IA.
        - Hoja de seguimiento.

        Descarga gratuita:
        https://{LANDING_URL}
        """
    )
    (KIT_DIR / "00-LEEME-PRIMERO.txt").write_text(readme, encoding="utf-8")

    create_social_image(
        ASSET_DIR / "kit-30d-landscape.jpg",
        (1600, 900),
        "30 días de contenido para conseguir tus primeras conversaciones de venta",
        "Calendario, ganchos, CTA y mensajes\npara publicar con intención y conversar mejor.",
        "Descarga gratis sin darte de alta como afiliado",
        LANDING_URL,
        "KIT 30D GRATUITO"
    )
    create_social_image(
        ASSET_DIR / "kit-30d-square.jpg",
        (1080, 1080),
        "30 días de contenido para tus primeras conversaciones",
        "Publica con estructura.\nConversa sin improvisar.",
        "Gratis · acceso inmediato",
        LANDING_URL,
        "NUEVO KIT GRATUITO"
    )
    create_social_image(
        ASSET_DIR / "kit-30d-story.jpg",
        (1080, 1920),
        "30 días de contenido para vender mejor",
        "Ganchos, mensajes y CTA\nen español para LATAM.",
        "Descárgalo gratis hoy",
        LANDING_URL,
        "KIT 30D"
    )
    create_social_image(
        ASSET_DIR / "facebook-post-viral-kit-30d.jpg",
        (1200, 1200),
        "Descarga gratis el Kit 30D de contenido",
        "No necesitas darte de alta como afiliado.\nEntra, deja 3 datos y bájalo al instante.",
        "prontialatam.com/kit-gratis-afiliados",
        "Material práctico para vender por nicho",
        "POST VIRAL FACEBOOK"
    )


def build_zip():
    with zipfile.ZipFile(ZIP_OUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(KIT_DIR.rglob("*")):
            if file_path.is_file():
                archive.write(file_path, file_path.relative_to(KIT_DIR.parent))


def main():
    build_support_files()
    build_pdf()
    pdf_target = KIT_DIR / PDF_OUT.name
    pdf_target.write_bytes(PDF_OUT.read_bytes())
    build_zip()
    print(f"[OK] PDF generado en {PDF_OUT}")
    print(f"[OK] ZIP generado en {ZIP_OUT}")


if __name__ == "__main__":
    main()
