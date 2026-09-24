# Protocolo de Piloto con Datos Reales — Paguro Finance V1

**Versión:** 1.0 (Financial Intelligence + Tax Operations)  
**Objetivo:** Validar la exactitud del cálculo financiero, conciliación bancaria y liquidación tributaria estimada usando datos contables históricos y operativos reales de Paguro Corp S.A.S. (NIT 901.458.120-1).

---

## 1. Filosofía de Validación del Piloto

```
CONSTRUIR V1 (Completado)
  ↓
INGESTAR PERÍODO CONTROLADO CON DATOS REALES
  ↓
VALIDAR LÓGICA FINANCIERA + RECONCILIACIÓN + IMPUESTOS
  ↓
CORREGIR DISCREPANCIAS EN LA COLA DE REVISIÓN
  ↓
ESTABILIZAR OPERACIONES MENSUALES
  ↓
AVANZAR A V2
```

---

## 2. Flujo de Validación Paso a Paso (13 Etapas)

### Etapa 1: Ingesta del Período Piloto
- **Alcance recomendado:** Seleccionar un mes cerrado reciente (ejemplo: Enero 2026 o Septiembre 2025).
- **Acceso:** Iniciar sesión en el portal oficial (`/login`) con credenciales de `SUPER_ADMIN` o `FINANCE`.
- **Carga de Documentos:**
  - Si Google Drive está vinculado con credenciales (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`), presionar **Sincronizar Google Drive** en `/integrations` o `/documents`.
  - Alternativamente, arrastrar o cargar los PDFs y XMLs del mes directamente en `/documents`.

### Etapa 2: Descubrimiento y Clasificación de Documentos
- Navegar a `/documents` pestaña **Todos los Documentos**.
- Comprobar que los archivos importados se hayan clasificado automáticamente según su tipología:
  - Factura Electrónica (`ELECTRONIC_INVOICE`)
  - Comprobante SWIFT (`SWIFT_CONFIRMATION`)
  - Recibo de Pago (`PAYMENT_RECEIPT`)
  - Extracto Bancario (`BANK_STATEMENT`)
  - Packing List (`PACKING_LIST`)
  - Bill of Lading (`BILL_OF_LADING`)
  - Declaración de Importación (`IMPORT_DOCUMENT`)

### Etapa 3: Revisión de Extracción Inteligente y Cola de Revisión
- Ejecutar la extracción estructurada sobre los documentos pendientes.
- **Regla del 85%:** Aquellos documentos cuya confianza sea menor al 85% se enrutan automáticamente a la pestaña **Cola de Revisión** (`REQUIRES_REVIEW`).
- En la Cola de Revisión, verificar y corregir manualmente:
  - Número de factura
  - NIT emisor y receptor
  - Subtotal, IVA discriminado y retenciones
  - Total y moneda (COP / USD)
- Presionar **Aprobar Documento**.

### Etapa 4: Normalización de Movimientos Financieros
- Navegar a `/movements` para comprobar que cada transacción económica esté reflejada en el libro mayor normalizado.
- Si se ingresan movimientos manuales, verificar que el **Motor Antiduplicados** (`checkDuplicateMovement`) prevenga la doble creación si ya existe un movimiento con la misma fecha, monto y contraparte.
- Comprobar que los importes en USD se conviertan con la TRM adecuada a COP.

### Etapa 5: Categorización de Gastos
- Asegurarse de que cada egreso cuente con su categoría asignada (ejemplo: *Software & Subscriptions*, *Marketing*, *Professional Services*, *Logistics*).
- Si se requieren nuevas subdivisiones, crearlas desde `/settings` → **Categorías de Movimientos Financieros**.
- Notar que desactivar una categoría no borra el histórico, garantizando inmutabilidad para auditorías.

### Etapa 6: Asociación Económica Multidocumento y Bancos
- Para operaciones complejas (ejemplo: importaciones que contienen Factura Comercial + Packing List + Bill of Lading + SWIFT):
  - Vincular todos los soportes al **mismo movimiento financiero**.
  - Comprobar en el drawer del movimiento que no se genere un cuádruple gasto erróneo.
- En transacciones de extracto bancario, utilizar el motor de sugerencias en `/movements` para asociar el débito bancario al movimiento contable.

### Etapa 7: Verificación de Totales
- En `/dashboard`, seleccionar el corte correspondiente al período piloto (*Este Mes*, *30 Días* o *Personalizado*).
- Comparar:
  - **Ingresos Totales:** Suma aritmética de movimientos de tipo `INCOME`.
  - **Egresos Totales:** Suma de `EXPENSE`.
  - **Flujo Neto:** Ingresos menos Egresos.
  - Conciliación de cuentas de banco en el módulo bancario.

### Etapa 8: Mapeo Tributario (IVA, Retefuente, ICA)
- Navegar a `/taxes`.
- Evaluar el desglose fiscal:
  - **IVA Generado (19%):** Sobre ventas e ingresos gravables.
  - **IVA Descontable (19%):** Sobre compras y gastos con soporte válido.
  - **Posición Neta Estimada:** Saldo a pagar o Saldo a favor.
  - **Retenciones en la Fuente** y **Estimación de ICA** según el municipio registrado en el perfil.

### Etapa 9: Inspección del Perfil Fiscal de la Empresa
- En `/settings` → **Perfil Fiscal & Tributario (Colombia)**, verificar:
  - Régimen (Responsable de IVA)
  - Municipio y tarifa de ICA (ej: Medellín 7‰ o Bogotá 9.66‰)
  - Año fiscal activo

### Etapa 10: Revisión de Obligaciones en el Calendario
- En `/obligaciones`, verificar que las obligaciones DIAN y municipales estén programadas según el calendario fiscal.
- Probar el flujo de estados:
  - `UPCOMING` → `PREPARED` → `FILED` (adjuntando Formulario 300 o 350) → `PAID` (adjuntando recibo 490).

### Etapa 11: Consulta Financiera con el Asesor IA
- Abrir `/ai-advisor`.
- Probar preguntas operativas reales:
  - *"¿En qué estamos gastando más este período?"*
  - *"¿Cuál es nuestro flujo de caja neto?"*
  - *"¿Qué movimientos o facturas requieren revisión tributaria?"*
  - *"¿Cuánto IVA neto estimamos pagar?"*
- Comprobar que cada respuesta incluya la **Ficha de Trazabilidad del Cálculo** (período exacto, cantidad de registros analizados, base de datos de PostgreSQL y descargo de responsabilidad legal).

### Etapa 12: Estimación de Cash Burn y Runway
- Preguntar al Asesor IA:
  - *"¿Cuál es nuestro cash burn promedio y qué runway tenemos con el saldo en bancos?"*
- Validar que la respuesta se fundamente exclusivamente en los movimientos reales sin inventar números.

### Etapa 13: Cotejo contra Fuentes Originales
- Contrastar el reporte de `/dashboard`, `/taxes` y `/movements` contra el extracto bancario en PDF del mes y la contabilidad previa.
- Registrar cualquier discrepancia en la **Cola Central de Revisión**.

---

## 3. Criterio de Salida del Piloto a Operación Continua

El piloto se considerará exitoso y listo para operación financiera continua cuando:
1. El 100% de las transacciones del período piloto estén normalizadas y categorizadas.
2. La diferencia entre el extracto bancario y el saldo del ledger sea $0 (o esté plenamente explicada por partidas conciliatorias).
3. La estimación de IVA coincida con el borrador del Formulario 300 de la DIAN.
4. No queden alertas pendientes de prioridad ALTA en la Cola Central de Revisión.
