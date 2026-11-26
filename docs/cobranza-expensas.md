# Módulo de cobranza de expensas (v1)

Backoffice para cobrar deuda de expensas de consorcios de PH y conjuntos inmobiliarios
(barrios cerrados, countries, clubes de chacras).

## Pantallas

- `/cobranzas`: expedientes con filtros por estado, consorcio y búsqueda; deuda liquidada a hoy y alertas de prescripción.
- `/cobranzas/consorcios`: alta de consorcios y administradoras.
- `/cobranzas/consorcios/[id]`: unidades o lotes, deudores, carga masiva de deuda por rango de meses, apertura de la cobranza, datos y tasas del consorcio.
- `/cobranzas/[id]`: liquidación por período con fecha de corte, avance de etapa, pagos, plan de pago, deudores, datos judiciales, historial.
- `/cobranzas/[id]/carta-documento` y `/cobranzas/[id]/certificado`: modelos imprimibles que se pueden editar antes de imprimir.

## Etapas

Deuda detectada → Intimación extrajudicial → Carta documento → Certificado de deuda (art. 2048) → Ejecución.
Se puede pasar a plan de pago, cancelada o archivada desde cualquier etapa activa, y volver de plan de pago a CD, certificado o ejecución si el deudor incumple.
Al registrar certificado o ejecución se guarda en el historial la liquidación a esa fecha.

## Supuestos (a validar)

1. **Interés**: simple (sin anatocismo, art. 770), con la tasa moratoria más la punitoria (TNA %) del reglamento, en base 365, desde el vencimiento de cada período (mora automática, art. 886). La tasa se carga por consorcio. No hay tabla de tasas BNA ni BIP variables todavía.
2. **Imputación de pagos**: primero a intereses y después a capital (art. 903), empezando por el período más antiguo, aunque esté prescripto (el pago de una obligación prescripta no se puede repetir, art. 2538). No se aplica la regla de la deuda más onerosa del art. 902.
3. **Prescripción**: el plazo es configurable por consorcio y por defecto es de **24 meses** (art. 2562 inc. c). Es la opción conservadora para alertar: hay salas que aplican 5 años (art. 2560). La primera CD registrada suspende 6 meses, una sola vez (art. 2541), y la fecha de demanda la interrumpe (art. 2546). No contempla el reconocimiento (art. 2545) ni los planes de pago como causa de interrupción.
4. **Plan de pago**: es un registro de las cuotas pactadas. Las cuotas pagadas se cargan como pagos y la liquidación legal sigue corriendo en paralelo (así sirve si el plan caduca). No modela quitas ni intereses de financiación.
5. **Conjuntos inmobiliarios**: si el consorcio no es PH, el certificado avisa que hay que verificar la adecuación al régimen del art. 2075, porque el carácter de título ejecutivo es discutido si sigue como asociación civil.
6. **Accesos**: administradores y abogados ven y operan las cobranzas. Sólo los administradores crean o editan consorcios. Los corresponsales no tienen acceso.
7. **Mediación**: no hay una etapa de mediación previa porque los procesos de ejecución están excluidos (Ley 26.589 art. 5 en CABA; Ley 13.951 en PBA).

## Pendiente (próximas versiones)

- Importar la deuda desde el Excel o el PDF de la administradora.
- Facturación del abono mensual y de los honorarios.
- Tasas variables (BNA activa o pasiva BIP) por período.
- Portal o reporte mensual para el consorcio y la administradora.
- Envío de intimaciones por WhatsApp o email usando la integración que ya existe.

## Tests

`pnpm test:expensas` corre los tests del motor de liquidación (`src/lib/expensas/liquidacion.ts`).

## Migración

`prisma/migrations/20261126180000_add_cobranza_expensas`: sólo agrega tablas y enums nuevos, más una relación opcional desde `AgentUser`. No toca datos existentes.
