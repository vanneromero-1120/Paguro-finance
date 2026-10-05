# PAGURO FINANCE V1 — TEST DATASET INDEX
## SIMULATED INVOICES FOR CONTROLLED PIPELINE TESTING

> **IMPORTANTE — REGLAS DE SEGURIDAD FISCAL:**
> - Todos los documentos incluidos en este conjunto de datos son **SIMULADOS Y FICTICIOS**.
> - Cada archivo PDF contiene marcas de agua y encabezados visibles: **"DOCUMENTO SIMULADO PARA PRUEBAS — NO VÁLIDO COMO DOCUMENTO TRIBUTARIO"**.
> - Este índice y los archivos correspondientes pertenecen exclusivamente al entorno de pruebas de Paguro Finance V1.
> - **NO MODIFICAR** la carpeta de contabilidad de producción.

---

### ESTRUCTURA DEL DIRECTORIO DE PRUEBAS

```
contabilidad test/
├── 06_JUNIO/
│   ├── TEST_JUN_001_SERVICIOS.pdf
│   ├── TEST_JUN_002_SOFTWARE.pdf
│   ├── TEST_JUN_003_LOGISTICA.pdf
│   ├── TEST_JUN_004_INVENTARIO.pdf
│   ├── TEST_JUN_005_MARKETING.pdf
│   ├── TEST_JUN_006_PROFESIONALES.pdf
│   ├── TEST_JUN_007_METADATA_COMPLETA.pdf
│   └── TEST_JUN_008_IMPORTACION.pdf
├── 07_JULIO/
│   ├── TEST_JUL_009_SIN_IVA.pdf
│   ├── TEST_JUL_010_REGIMEN_SIMPLE.pdf
│   ├── TEST_JUL_011_METADATA_INCOMPLETA.pdf
│   ├── TEST_JUL_012_DESCRIPCION_AMBIGUA.pdf
│   ├── TEST_JUL_013_ACTUALIZACION_POSTERIOR.pdf
│   ├── TEST_JUL_014_POSIBLE_DUPLICADO.pdf
│   └── TEST_JUL_015_REVISION_MANUAL.pdf
└── TEST_DATA_INDEX.md
```

---

### TABLA MAESTRA DE DOCUMENTOS SIMULADOS (15 ARCHIVOS)

| # | Archivo | Mes | Factura No. | Proveedor Ficticio | Subtotal (COP) | IVA (COP) | Retención (COP) | Total Neto (COP) | Escenario de Prueba | Comportamiento Esperado en Paguro Finance |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `TEST_JUN_001_SERVICIOS.pdf` | 06_JUNIO | FE-1042 | Andes Cloud Solutions S.A.S. | $2.500.000 | $475.000 | $100.000 | $2.875.000 | 1. Factura estándar de servicios con IVA del 19% | Clasificación automática como ELECTRONIC_INVOICE, extracción con confianza >95%, IVA descontable 19% ($475,000) y ReteFuente 4% ($100,000). |
| 2 | `TEST_JUN_002_SOFTWARE.pdf` | 06_JUNIO | NTS-8891 | NexoTech Software Corp S.A.S. | $3.800.000 | $0 | $133.000 | $3.667.000 | 2. Factura de software / suscripción (SaaS) | Asignación a categoría Software & Subscriptions, tratamiento de IVA 0% (exención legal computación en la nube) validado sin alertas fiscales erróneas. |
| 3 | `TEST_JUN_003_LOGISTICA.pdf` | 06_JUNIO | TCC-4015 | Transportes & Carga Continental S.A.S. | $1.850.000 | $0 | $18.500 | $1.831.500 | 3. Factura de servicios de logística y transporte de carga | Categorización en Logistics, reconocimiento de exclusión tributaria de IVA según Art. 476 numeral 9 E.T., retención del 1%. |
| 4 | `TEST_JUN_004_INVENTARIO.pdf` | 06_JUNIO | DMT-9920 | Distribuidora Mayorista Textil S.A.S. | $6.200.000 | $1.178.000 | $155.000 | $7.223.000 | 4. Factura de compra de inventario / insumos de producción | Asignación a Costo de Ventas / Inventario, cómputo de IVA descontable de $1,178,000 en panel de impuestos y retención en compras 2.5%. |
| 5 | `TEST_JUN_005_MARKETING.pdf` | 06_JUNIO | PRISMA-302 | Agencia Creativa Prisma Digital S.A.S. | $4.200.000 | $798.000 | $168.000 | $4.830.000 | 5. Factura de servicios de marketing y publicidad digital | Categorización automática en Marketing & Advertising, IVA 19% ($798,000) incorporado en posición fiscal mensual. |
| 6 | `TEST_JUN_006_PROFESIONALES.pdf` | 06_JUNIO | LEX-780 | Consultoría Jurídica & Financiera LexCorp S.A.S. | $5.000.000 | $950.000 | $550.000 | $5.400.000 | 6. Factura de honorarios y servicios profesionales | Mapeo a Professional Services, detección precisa de retención por honorarios al 11% ($550,000) e IVA 19% ($950,000). |
| 7 | `TEST_JUN_007_METADATA_COMPLETA.pdf` | 06_JUNIO | SEC-55100 | Suministros & Equipos Corporativos de Colombia S.A.S. | $3.450.000 | $655.500 | $119.577 | $3.985.923 | 7. Factura con NIT transparente, múltiples ítems y metadata completa | Score de confianza de extracción 100%, desglose de 2 ítems, validación automática de retenciones cruzadas (ReteFuente + ReteICA Medellín). |
| 8 | `TEST_JUN_008_IMPORTACION.pdf` | 06_JUNIO | ADU-2025-891 | Agencia de Aduanas Panamericana Nivel 1 S.A.S. | $4.850.000 | $171.000 | $36.000 | $4.985.000 | 8. Documento soporte de importación / servicios aduaneros con bases mixtas | Clasificación como IMPORT_DOCUMENT o soporte aduanero; cálculo diferencial de IVA únicamente sobre honorarios propios ($900k) excluyendo aranceles de terceros ($3.95M). |
| 9 | `TEST_JUL_009_SIN_IVA.pdf` | 07_JULIO | MED-4412 | Centro Médico Ocupacional & Ergonomía S.A.S. | $1.450.000 | $0 | $29.000 | $1.421.000 | 9. Factura de servicios médicos legalmente excluida de IVA (0%) | Mapeo tributario con tasa 0% sin disparar alertas de omisión de IVA; validación legal del Numeral 1 Artículo 476 E.T. |
| 10 | `TEST_JUL_010_REGIMEN_SIMPLE.pdf` | 07_JULIO | RST-1185 | Soluciones Ambientales & Reciclaje Verde S.A.S. - SIMPLE | $2.100.000 | $399.000 | $0 | $2.499.000 | 10. Factura de proveedor en Régimen Simple de Tributación (RST) | Detección de cláusula RST: exención legal de retención a título de renta (0%) y registro íntegro del IVA descontable al 19% ($399,000). |
| 11 | `TEST_JUL_011_METADATA_INCOMPLETA.pdf` | 07_JULIO | FRA-0441 | Ferretería & Repuestos Industriales El Sol | $1.150.000 | $218.500 | $0 | $1.368.500 | 11. Factura con metadata intencionalmente incompleta (NIT borroso y fecha sin día) | Score de confianza inferior al 85%, direccionamiento obligatorio a REQUIRES_REVIEW (Cola de Revisión) con advertencia de NIT y fecha faltantes. |
| 12 | `TEST_JUL_012_DESCRIPCION_AMBIGUA.pdf` | 07_JULIO | GSI-882 | Gestiones & Servicios Integrales de Antioquia S.A.S. | $2.900.000 | $551.000 | $116.000 | $3.335.000 | 12. Factura con descripción de concepto ambigua o genérica | El clasificador heurístico o de lenguaje detecta baja confianza en asignación de categoría, solicitando confirmación manual en Settings o Review Queue. |
| 13 | `TEST_JUL_013_ACTUALIZACION_POSTERIOR.pdf` | 07_JULIO | MMI-2025-109 | Maquinaria & Montajes Industriales del Caribe S.A.S. | $6.000.000 | $1.140.000 | $240.000 | $6.900.000 | 13. Factura diseñada para actualización posterior (Anticipo de contrato mayor) | Prueba de ciclo de vida documental y actualización posterior: registro inicial del anticipo con saldo pendiente para posterior cruce con acta de liquidación final. |
| 14 | `TEST_JUL_014_POSIBLE_DUPLICADO.pdf` | 07_JULIO | FE-1042-DUP | Andes Cloud Solutions S.A.S. | $2.500.000 | $475.000 | $100.000 | $2.875.000 | 14. Factura diseñada para asemejar un posible duplicado de transacción | El motor antiduplicados (checkDuplicateMovement) activa bandera de advertencia DUPLICATE_SUSPECT por coincidencia de proveedor, subtotal ($2.5M) e IVA ($475k). |
| 15 | `TEST_JUL_015_REVISION_MANUAL.pdf` | 07_JULIO | CC-099 | Taller & Soldaduras Industriales Don Carlos (Carlos Alberto Restrepo) | $3.750.000 | $350.000 | $0 | $4.100.000 | 15. Documento diseñado para requerir revisión humana obligatoria | El validador aritmético fiscal detecta discrepancia en IVA ($350,000 no equivale ni al 19% [$712.5k] ni al 5% [$187.5k]), forzando estado REQUIRES_REVIEW con nota detallada. |

---

### DESCRIPCIÓN DETALLADA DE ESCENARIOS Y CASOS DE PRUEBA

#### 06_JUNIO (8 Documentos)

1. **`TEST_JUN_001_SERVICIOS.pdf`**
   - **Escenario:** Factura electrónica de servicios estándar con tarifa general del 19% de IVA.
   - **Proveedor:** Andes Cloud Solutions S.A.S. (NIT 900.812.345-6)
   - **Valores:** Subtotal $2,500,000 COP, IVA 19% $475,000 COP, ReteFuente 4% $100,000 COP. Total Neto: $2,875,000 COP.
   - **Objetivo Paguro:** Validar extracción de alta confianza (>95%), clasificación como `ELECTRONIC_INVOICE`, cómputo de IVA descontable y retención en la fuente.

2. **`TEST_JUN_002_SOFTWARE.pdf`**
   - **Escenario:** Factura de software y suscripciones en la nube (SaaS).
   - **Proveedor:** NexoTech Software Corp S.A.S. (NIT 901.234.567-8)
   - **Valores:** Subtotal $3,800,000 COP, IVA 0% (Exento Ley 1819 art. 187), ReteFuente 3.5% $133,000 COP. Total Neto: $3,667,000 COP.
   - **Objetivo Paguro:** Asignación a categoría *Software & Subscriptions*, reconocimiento de tarifa exenta de IVA sin reportar inconsistencia tributaria.

3. **`TEST_JUN_003_LOGISTICA.pdf`**
   - **Escenario:** Factura de logística y transporte de carga intermunicipal.
   - **Proveedor:** Transportes & Carga Continental S.A.S. (NIT 900.567.890-1)
   - **Valores:** Subtotal $1,850,000 COP, IVA 0% (Excluido Art. 476 Numeral 9 E.T.), ReteFuente 1% $18,500 COP. Total Neto: $1,831,500 COP.
   - **Objetivo Paguro:** Asignación a categoría *Logistics*, tarifa de retención reducida al 1% por transporte y verificación de exclusión de IVA.

4. **`TEST_JUN_004_INVENTARIO.pdf`**
   - **Escenario:** Compra de inventario físico y materias primas de confección.
   - **Proveedor:** Distribuidora Mayorista Textil S.A.S. (NIT 800.789.012-3)
   - **Valores:** Subtotal $6,200,000 COP, IVA 19% $1,178,000 COP, ReteFuente 2.5% $155,000 COP. Total Factura: $7,378,000 COP.
   - **Objetivo Paguro:** Mapeo a *Costo de Ventas / Inventario*, impacto en flujo de caja y cómputo de IVA descontable por compras físicas.

5. **`TEST_JUN_005_MARKETING.pdf`**
   - **Escenario:** Factura de agencia de marketing y pauta digital.
   - **Proveedor:** Agencia Creativa Prisma Digital S.A.S. (NIT 901.345.678-9)
   - **Valores:** Subtotal $4,200,000 COP, IVA 19% $798,000 COP, ReteFuente 4% $168,000 COP. Total Neto: $4,830,000 COP.
   - **Objetivo Paguro:** Categorización en *Marketing & Advertising*, verificación de base gravable e IVA general.

6. **`TEST_JUN_006_PROFESIONALES.pdf`**
   - **Escenario:** Honorarios profesionales legales y corporativos.
   - **Proveedor:** Consultoría Jurídica & Financiera LexCorp S.A.S. (NIT 900.432.198-7)
   - **Valores:** Subtotal $5,000,000 COP, IVA 19% $950,000 COP, ReteFuente 11% $550,000 COP. Total Neto: $5,400,000 COP.
   - **Objetivo Paguro:** Categorización en *Professional Services*, validación de tarifa de retención de honorarios al 11%.

7. **`TEST_JUN_007_METADATA_COMPLETA.pdf`**
   - **Escenario:** Factura con metadata exhaustiva, múltiples ítems, CUFE completo y ReteICA municipal.
   - **Proveedor:** Suministros & Equipos Corporativos de Colombia S.A.S. (NIT 830.123.456-7)
   - **Valores:** Subtotal $3,450,000 COP, IVA 19% $655,500 COP, ReteFuente 2.5% $86,250 COP, ReteICA Medellín 0.966% $33,327 COP. Total Neto: $3,985,923 COP.
   - **Objetivo Paguro:** Máxima confianza de extracción (100%), lectura de CUFE, liquidación coordinada de retención nacional y territorial (Medellín).

8. **`TEST_JUN_008_IMPORTACION.pdf`**
   - **Escenario:** Documento de intermediación aduanera / soporte de importación con base mixta.
   - **Proveedor:** Agencia de Aduanas Panamericana Nivel 1 S.A.S. (NIT 860.055.443-2)
   - **Valores:** Subtotal $4,850,000 COP (Terceros: $3.95M / Propios: $900k), IVA 19% sobre base propia $171,000 COP, ReteFuente 4% $36,000 COP. Total Neto: $4,985,000 COP.
   - **Objetivo Paguro:** Clasificación como `IMPORT_DOCUMENT`, procesamiento de pagos por cuenta de terceros sin distorsión del IVA deducible propio.

---

#### 07_JULIO (7 Documentos)

9. **`TEST_JUL_009_SIN_IVA.pdf`**
   - **Escenario:** Factura médica y de salud ocupacional excluida de IVA.
   - **Proveedor:** Centro Médico Ocupacional & Ergonomía S.A.S. (NIT 900.665.441-0)
   - **Valores:** Subtotal $1,450,000 COP, IVA 0% (Excluido Art. 476 Numeral 1 E.T.), ReteFuente 2% $29,000 COP. Total Neto: $1,421,000 COP.
   - **Objetivo Paguro:** Comprobación de servicio exento/excluido de IVA en salud sin disparar alertas de error.

10. **`TEST_JUL_010_REGIMEN_SIMPLE.pdf`**
    - **Escenario:** Factura de proveedor en Régimen Simple de Tributación (RST).
    - **Proveedor:** Soluciones Ambientales & Reciclaje Verde S.A.S. - SIMPLE (NIT 901.778.992-3)
    - **Valores:** Subtotal $2,100,000 COP, IVA 19% $399,000 COP, ReteFuente 0% (Exento por Art. 911 E.T.). Total: $2,499,000 COP.
    - **Objetivo Paguro:** Detección de régimen fiscal especial, omisión correcta de retención en la fuente y aprovechamiento del IVA descontable.

11. **`TEST_JUL_011_METADATA_INCOMPLETA.pdf`**
    - **Escenario:** Factura física con metadata incompleta (NIT con caracteres ilegibles y fecha sin día exacto).
    - **Proveedor:** Ferretería & Repuestos Industriales El Sol (NIT 800.12?-?)
    - **Valores:** Subtotal $1,150,000 COP, IVA 19% $218,500 COP. Total: $1,368,500 COP.
    - **Objetivo Paguro:** Disminución del puntaje de confianza (<85%), enrutamiento automático a `REQUIRES_REVIEW` (Cola de Revisión) para corrección humana.

12. **`TEST_JUL_012_DESCRIPCION_AMBIGUA.pdf`**
    - **Escenario:** Factura con descripción vaga o ambigua ("Apoyo y coordinación general").
    - **Proveedor:** Gestiones & Servicios Integrales de Antioquia S.A.S. (NIT 900.991.223-4)
    - **Valores:** Subtotal $2,900,000 COP, IVA 19% $551,000 COP. Total: $3,451,000 COP.
    - **Objetivo Paguro:** Prueba de robustez del clasificador de categorías; solicitud de validación de categoría al usuario.

13. **`TEST_JUL_013_ACTUALIZACION_POSTERIOR.pdf`**
    - **Escenario:** Factura de anticipo (40%) para adecuación electromecánica con saldo pendiente.
    - **Proveedor:** Maquinaria & Montajes Industriales del Caribe S.A.S. (NIT 890.334.221-5)
    - **Valores:** Subtotal $6,000,000 COP, IVA 19% $1,140,000 COP, ReteFuente 4% $240,000 COP. Total Anticipo: $6,900,000 COP.
    - **Objetivo Paguro:** Probar actualización posterior del ciclo de vida del movimiento financiero y conciliación de entregas parciales.

14. **`TEST_JUL_014_POSIBLE_DUPLICADO.pdf`**
    - **Escenario:** Documento espejo diseñado para simular un posible duplicado de la factura FE-1042 de junio.
    - **Proveedor:** Andes Cloud Solutions S.A.S. (NIT 900.812.345-6)
    - **Valores:** Subtotal $2,500,000 COP, IVA 19% $475,000 COP, Total Neto: $2,875,000 COP.
    - **Objetivo Paguro:** Activación del motor de detección de duplicados (`checkDuplicateMovement` / `DUPLICATE_SUSPECT`) para advertir al usuario sobre posible doble pago.

15. **`TEST_JUL_015_REVISION_MANUAL.pdf`**
    - **Escenario:** Cuenta de cobro con inconsistencia aritmética en el cálculo del IVA ($350,000 sobre $3,750,000).
    - **Proveedor:** Taller & Soldaduras Industriales Don Carlos (NIT 71.345.890-2)
    - **Valores:** Subtotal $3,750,000 COP, IVA $350,000 COP (Tasa inconsistente), Total: $4,100,000 COP.
    - **Objetivo Paguro:** Detección de error de cálculo fiscal por el motor de validación, retención forzada en `REQUIRES_REVIEW` hasta resolución por el contador.

---
*Generado automáticamente para el entorno de validación Paguro Finance V1.*
