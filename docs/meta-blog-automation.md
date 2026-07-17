# Publicación automática del blog en Meta

Este repositorio incluye una automatización para compartir automáticamente el **último artículo nuevo del blog** en las RRSS de Meta cuando se hace push a `main` con cambios en `index.html`.

## Qué hace

- Se ejecuta con GitHub Actions en cada push a `main`.
- Compara el último artículo del blog en el commit anterior vs. el commit nuevo.
- Si el ID del último artículo no cambió, no publica nada.
- Si detecta un artículo nuevo:
  - publica un post en Facebook Page con título, resumen y enlace;
  - publica un post en Instagram Business usando una imagen pública y un caption con la URL visible.

## Archivos

- Workflow: `.github/workflows/publish-blog-to-meta.yml`
- Script: `scripts/blog/publish-latest-to-meta.mjs`

## Secretos de GitHub necesarios

Configúralos en el repositorio, en **Settings > Secrets and variables > Actions**:

- `META_GRAPH_API_VERSION`
  - Recomendado hoy: `v25.0`
- `META_PAGE_ID`
  - ID de la Facebook Page oficial
- `META_PAGE_ACCESS_TOKEN`
  - Token de página con permisos suficientes para publicar
- `META_INSTAGRAM_USER_ID`
  - ID del usuario de Instagram Business enlazado a la página
- `META_SOCIAL_DEFAULT_IMAGE_URL`
  - Opcional
  - Imagen pública de respaldo para Instagram si el hero del artículo no aporta una URL válida

## Cómo obtener el acceso correcto

Necesitáis una app de Meta en modo Live, con la Facebook Page y la cuenta de Instagram Business conectadas.

Permisos a revisar en Meta:

- `pages_manage_posts`
- `pages_read_engagement`
- `instagram_content_publish`
- `instagram_basic`

## Notas importantes

- Instagram no publica posts de solo enlace como Facebook. Por eso el flujo usa una **imagen pública** y coloca la URL del artículo dentro del caption.
- El script intenta reutilizar la imagen de fondo del hero del artículo. Si no encuentra una, usa `META_SOCIAL_DEFAULT_IMAGE_URL` o, en último caso, `https://www.prontialatam.com/logo-prontia.jpg`.
- Si necesitáis saltaros una ejecución puntual, añadid `[skip-meta]` al mensaje del commit.

## Validación en seco

Se puede probar sin publicar de verdad:

```bash
BLOG_META_DRY_RUN=1 \
META_PAGE_ID=123 \
META_PAGE_ACCESS_TOKEN=test \
META_INSTAGRAM_USER_ID=456 \
node scripts/blog/publish-latest-to-meta.mjs
```

## Fuentes oficiales

- GitHub Actions push/path filters:
  - [Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
  - [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- Meta Pages API:
  - [Get Started - Pages API](https://developers.facebook.com/documentation/pages-api/getting-started)
  - [Posts - Pages API](https://developers.facebook.com/documentation/pages-api/posts)
- Instagram publishing:
  - [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)
  - [IG User Media Publish](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media_publish)
