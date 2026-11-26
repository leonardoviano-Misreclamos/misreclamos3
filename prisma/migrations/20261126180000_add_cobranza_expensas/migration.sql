-- CreateEnum
CREATE TYPE "TipoConsorcio" AS ENUM ('PROPIEDAD_HORIZONTAL', 'BARRIO_CERRADO', 'COUNTRY', 'CLUB_DE_CHACRAS', 'OTRO');

-- CreateEnum
CREATE TYPE "Jurisdiccion" AS ENUM ('CABA', 'PBA', 'OTRA');

-- CreateEnum
CREATE TYPE "RolDeudor" AS ENUM ('PROPIETARIO', 'COPROPIETARIO', 'POSEEDOR', 'USUFRUCTUARIO', 'HEREDERO', 'OTRO');

-- CreateEnum
CREATE TYPE "ConceptoExpensa" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA', 'FONDO_RESERVA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCobranza" AS ENUM ('DETECTADA', 'INTIMACION_EXTRAJUDICIAL', 'CARTA_DOCUMENTO', 'CERTIFICADO_DEUDA', 'EJECUCION', 'PLAN_DE_PAGO', 'CANCELADA', 'ARCHIVADA');

-- CreateTable
CREATE TABLE "Administradora" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cuit" TEXT,
    "matricula" TEXT,
    "contacto" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "domicilio" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Administradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consorcio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoConsorcio" NOT NULL DEFAULT 'PROPIEDAD_HORIZONTAL',
    "cuit" TEXT,
    "domicilio" TEXT,
    "localidad" TEXT,
    "jurisdiccion" "Jurisdiccion" NOT NULL DEFAULT 'CABA',
    "administradoraId" TEXT,
    "tasaMoratoriaAnual" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "tasaPunitoriaAnual" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "diaVencimiento" INTEGER NOT NULL DEFAULT 10,
    "prescripcionMeses" INTEGER NOT NULL DEFAULT 24,
    "abonoMensual" DECIMAL(14,2),
    "honorariosExtrajudicialesPct" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consorcio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadFuncional" (
    "id" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "porcentual" DECIMAL(8,4),
    "matricula" TEXT,
    "partida" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadFuncional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deudor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "domicilioReal" TEXT,
    "domicilioNotificacion" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deudor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadDeudor" (
    "unidadId" TEXT NOT NULL,
    "deudorId" TEXT NOT NULL,
    "rol" "RolDeudor" NOT NULL DEFAULT 'PROPIETARIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnidadDeudor_pkey" PRIMARY KEY ("unidadId","deudorId")
);

-- CreateTable
CREATE TABLE "DeudaPeriodo" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "periodo" DATE NOT NULL,
    "concepto" "ConceptoExpensa" NOT NULL DEFAULT 'ORDINARIA',
    "monto" DECIMAL(14,2) NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeudaPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobranzaExpensas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "consorcioId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "estado" "EstadoCobranza" NOT NULL DEFAULT 'DETECTADA',
    "asignadoAId" TEXT,
    "expedienteNumber" TEXT,
    "juzgado" TEXT,
    "fechaInicioJuicio" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CobranzaExpensas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobranzaEvento" (
    "id" TEXT NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "estadoDesde" "EstadoCobranza",
    "estadoHasta" "EstadoCobranza",
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "data" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CobranzaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoExpensas" (
    "id" TEXT NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "medio" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoExpensas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPago" (
    "id" TEXT NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "fechaAcuerdo" DATE NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "cantidadCuotas" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuotaPlan" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "pagadaAt" DATE,

    CONSTRAINT "CuotaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consorcio_administradoraId_idx" ON "Consorcio"("administradoraId");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadFuncional_consorcioId_identificacion_key" ON "UnidadFuncional"("consorcioId", "identificacion");

-- CreateIndex
CREATE INDEX "Deudor_documento_idx" ON "Deudor"("documento");

-- CreateIndex
CREATE INDEX "DeudaPeriodo_unidadId_fechaVencimiento_idx" ON "DeudaPeriodo"("unidadId", "fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "DeudaPeriodo_unidadId_periodo_concepto_key" ON "DeudaPeriodo"("unidadId", "periodo", "concepto");

-- CreateIndex
CREATE UNIQUE INDEX "CobranzaExpensas_code_key" ON "CobranzaExpensas"("code");

-- CreateIndex
CREATE INDEX "CobranzaExpensas_consorcioId_idx" ON "CobranzaExpensas"("consorcioId");

-- CreateIndex
CREATE INDEX "CobranzaExpensas_unidadId_idx" ON "CobranzaExpensas"("unidadId");

-- CreateIndex
CREATE INDEX "CobranzaExpensas_estado_idx" ON "CobranzaExpensas"("estado");

-- CreateIndex
CREATE INDEX "CobranzaEvento_cobranzaId_fecha_idx" ON "CobranzaEvento"("cobranzaId", "fecha");

-- CreateIndex
CREATE INDEX "PagoExpensas_cobranzaId_fecha_idx" ON "PagoExpensas"("cobranzaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CuotaPlan_planId_numero_key" ON "CuotaPlan"("planId", "numero");

-- AddForeignKey
ALTER TABLE "Consorcio" ADD CONSTRAINT "Consorcio_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "Administradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadFuncional" ADD CONSTRAINT "UnidadFuncional_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "Consorcio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadDeudor" ADD CONSTRAINT "UnidadDeudor_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "UnidadFuncional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadDeudor" ADD CONSTRAINT "UnidadDeudor_deudorId_fkey" FOREIGN KEY ("deudorId") REFERENCES "Deudor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeudaPeriodo" ADD CONSTRAINT "DeudaPeriodo_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "UnidadFuncional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobranzaExpensas" ADD CONSTRAINT "CobranzaExpensas_consorcioId_fkey" FOREIGN KEY ("consorcioId") REFERENCES "Consorcio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobranzaExpensas" ADD CONSTRAINT "CobranzaExpensas_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "UnidadFuncional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobranzaExpensas" ADD CONSTRAINT "CobranzaExpensas_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "AgentUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobranzaEvento" ADD CONSTRAINT "CobranzaEvento_cobranzaId_fkey" FOREIGN KEY ("cobranzaId") REFERENCES "CobranzaExpensas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoExpensas" ADD CONSTRAINT "PagoExpensas_cobranzaId_fkey" FOREIGN KEY ("cobranzaId") REFERENCES "CobranzaExpensas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPago" ADD CONSTRAINT "PlanPago_cobranzaId_fkey" FOREIGN KEY ("cobranzaId") REFERENCES "CobranzaExpensas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuotaPlan" ADD CONSTRAINT "CuotaPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

