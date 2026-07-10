# Activación en producción - Kit Agenda Llena 30 Días

Producto:
Kit Agenda Llena 30 Días para Centros de Estética

Landing:
https://prontialatam.com/centros-estetica

Entrega comprador:
https://prontialatam.com/kit-agenda-llena-centros-estetica

Descarga:
https://prontialatam.com/downloads/kit-agenda-llena-centros-estetica.zip

## Pendiente antes de publicar

1. Crear en Stripe un producto/precio de pago único:
   - Nombre: Kit Agenda Llena 30 Días para Centros de Estética
   - Precio visible en la web: 37 USD
   - Moneda: USD

2. Copiar el Price ID de Stripe y configurarlo en Vercel:
   - Variable: `STRIPE_ESTETICA_PRICE_ID`
   - Valor: `price_...`
   - Entorno: production

3. Desplegar `prontialatam-web` en producción.

4. Probar flujo real:
   - Abrir `/centros-estetica`
   - Clic en "Ir al pago seguro"
   - Confirmar que Stripe abre el checkout
   - Tras pago, confirmar que `/checkout-success` muestra descarga
   - Revisar que el email de compra incluye el enlace de entrega

## Validado localmente

- Producto añadido a la configuración de checkout.
- Página de venta creada.
- Página de entrega creada.
- ZIP de comprador incorporado.
- Kit de afiliados de Estética incorporado.
- Submenú Estética añadido al portal de afiliados.
- Referencias a la plataforma externa anterior eliminadas de documentos, código y nombres visibles del workspace.
