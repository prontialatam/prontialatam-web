# Despliegue Fase 1: Talleres Mecánicos

## Qué necesita esta fase para funcionar de verdad

La web actual ya tiene:

- landing propia del producto
- página de afiliados
- botón de compra conectado a un endpoint propio
- webhook de Stripe preparado

Para activarlo en producción faltan estas piezas externas:

## 1. Hosting con funciones serverless

Esta implementación está preparada para Vercel. GitHub Pages por sí sola no sirve para el webhook ni para crear sesiones de Stripe.

## 2. Variables de entorno

Configurar en el proyecto desplegado:

- `SITE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TALLERES_PRICE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ORDER_FULFILLMENT_WEBHOOK_URL` opcional
- `AFFILIATE_DEFAULT_COMMISSION_RATE`

Referencia: [.env.example](/Users/luiscurras/Desktop/ProntIA/prontialatam-web/.env.example)

## 3. Stripe

Crear en Stripe:

- un producto para `100 Prompts para Talleres Mecánicos`
- un `Price` de `29 USD`
- un webhook apuntando a `/api/stripe/webhook`

El `price_id` debe copiarse a `STRIPE_TALLERES_PRICE_ID`.

## 4. Supabase

Crear las tablas con:

- [supabase/phase1_schema.sql](/Users/luiscurras/Desktop/ProntIA/prontialatam-web/supabase/phase1_schema.sql)

## 5. Entrega del producto

Si queréis automatizar la entrega completa, el webhook puede reenviar el pedido a vuestro sistema mediante `ORDER_FULFILLMENT_WEBHOOK_URL`.

## Orden recomendado

1. Crear producto y precio en Stripe.
2. Crear tablas en Supabase.
3. Desplegar en Vercel.
4. Cargar variables de entorno.
5. Configurar el webhook de Stripe.
6. Hacer una compra de prueba.
