# Módulo de Conciliaciones

## Descripción

El módulo de **Conciliaciones** permite importar datos de transacciones desde el sistema ERP (Soft) y conciliarlas automáticamente con las transacciones importadas de los distintos proveedores de pago (Payway, MercadoPago, American Express, etc.).

## Características Principales

### 1. Importación de Datos del ERP

- **Formato**: CSV con la estructura del sistema Soft
- **Campos Soportados**:
  - `IdCuponTarjetaCredito`: ID único del cupón
  - `CuponFecha`: Fecha de la transacción
  - `CuponImporte`: Importe de la transacción (formato: `115829,00000000`)
  - `NombreTarjeta`: Nombre de la tarjeta (AMEX, CABAL CRED, etc.)
  - `CodigoAprobacion`: Código de autorización
  - `CuponDocumento`: Número de documento/factura
  - Y todos los demás campos del sistema ERP

### 2. Algoritmo de Conciliación

El sistema concilia las transacciones automáticamente basándose en:

1. **Código de Aprobación**: Match exacto entre ERP y proveedor
2. **Nombre de Tarjeta**: Coincidencia parcial o total
3. **Monto**: Diferencia menor a $0.01

### 3. Estados de Conciliación

Las transacciones pueden tener los siguientes estados:

- ✅ **Conciliado** (`matched`): Transacción encontrada en ambos sistemas con datos coincidentes
- ⚠️ **Solo en ERP** (`erp_only`): Transacción registrada en el ERP pero no encontrada en los proveedores
- 🔶 **Solo en Proveedor** (`provider_only`): Transacción registrada por el proveedor pero no en el ERP
- ❌ **Diferencia de Monto** (`amount_mismatch`): Se encontró la transacción pero con montos diferentes

## Cómo Usar

### Paso 1: Importar Transacciones del ERP

1. Navega a **Conciliaciones** en el menú lateral
2. Haz clic en **"Subir CSV"** en la sección "Importar desde ERP"
3. Selecciona el archivo CSV exportado desde el sistema Soft
4. El sistema procesará e importará automáticamente las transacciones

### Paso 2: Conciliar Transacciones

1. Selecciona el rango de fechas que deseas conciliar:
   - **Fecha Inicio**: Primera fecha del período
   - **Fecha Fin**: Última fecha del período

2. Haz clic en **"Conciliar"**

3. El sistema procesará las transacciones y mostrará:
   - **Total**: Número total de registros analizados
   - **Conciliados**: Transacciones que coinciden perfectamente
   - **Solo ERP**: Transacciones solo en el sistema contable
   - **Solo Proveedor**: Transacciones solo reportadas por proveedores
   - **Diff. Monto**: Transacciones con diferencias de importe

### Paso 3: Revisar Resultados

1. Utiliza el filtro desplegable para ver solo un tipo de estado específico
2. Revisa la tabla de resultados que muestra:
   - Estado de la conciliación
   - Fecha de la transacción
   - Tarjeta utilizada
   - Código de autorización
   - Importes del ERP y del proveedor
   - Diferencia (si la hay)
   - Proveedor de pago

### Paso 4: Exportar Resultados

1. Haz clic en **"Exportar CSV"** para descargar un archivo con todos los resultados
2. El archivo incluirá todas las columnas relevantes de ambos sistemas
3. Útil para análisis detallado en Excel o para reportes

## Formato del CSV del ERP

El archivo CSV debe tener la siguiente estructura (con header):

```csv
IdCuponTarjetaCredito,IdTarjeta,CuponNumero,CuponFecha,CuponRazonSocial,CuponImporte,NumeroTarjeta,CuponDocumento,AcreditadoEnSeleccion,IdCierreTurno,IdCaja,TurnoDescripcion,IdLoteTarjetasCredito,LotePrefijo,LoteNumero,LoteFecha,LoteComprobante,NombreTarjeta,ComprobanteAcreditacion,Telefono,CodigoAprobacion,CuponPendiente,TipoAcreditacion
98393,4,"0,00000000",01/12/2025 00:00:00.000,,"115829,00000000","0,00000000",,False,8694,,PLAYA-01/12/2025 05:43:57,,0,0,,Sin cierre de lote,AMEX,Sin acreditación,,,No,
```

### Notas sobre el Formato:

- **Fechas**: Formato `DD/MM/YYYY HH:mm:ss.fff`
- **Importes**: Formato con coma como separador decimal (`115829,00000000`)
- **Encoding**: UTF-8 preferiblemente
- **Separador**: Coma (`,`)

## Archivo de Ejemplo

Puedes encontrar un archivo de ejemplo en: `ejemplos/erp_sample.csv`

## API Endpoints

Para desarrolladores que quieran integrar esta funcionalidad:

### Importar Transacciones ERP
```http
POST /api/erp-transactions/bulk
Content-Type: application/json

[{
  "id": "uuid",
  "IdCuponTarjetaCredito": "98393",
  "CuponFecha": "2025-12-01",
  "CuponImporte": 115829,
  ...
}]
```

### Ejecutar Conciliación
```http
POST /api/reconcile
Content-Type: application/json

{
  "startDate": "2025-12-01",
  "endDate": "2025-12-31"
}
```

### Obtener Transacciones ERP
```http
GET /api/erp-transactions
```

## Base de Datos

Se crean dos nuevas tablas:

### `erp_transactions`
Almacena todas las transacciones importadas del ERP con todos los campos originales.

### `reconciliations`
Almacena los resultados históricos de conciliaciones para auditoría y seguimiento.

## Consejos y Mejores Prácticas

1. **Importa regularmente**: Mantén actualizados los datos del ERP importándolos periódicamente
2. **Concilia por períodos cortos**: Es más fácil identificar problemas conciliando períodos de una semana o un mes
3. **Revisa las diferencias**: Los estados "Solo en ERP" o "Solo en Proveedor" pueden indicar:
   - Retrasos en la acreditación
   - Transacciones anuladas
   - Errores de registro
4. **Exporta para análisis**: Usa el CSV exportado para análisis detallados o reportes gerenciales
5. **Verifica códigos de autorización**: Son el campo más confiable para la conciliación

## Solución de Problemas

### El archivo CSV no se importa correctamente

- Verifica que el encoding sea UTF-8
- Asegúrate de que el separador sea coma (`,`)
- Revisa que el archivo tenga la cabecera correcta

### No se encuentran coincidencias

- Verifica que las fechas del rango incluyan las transacciones
- Revisa que los códigos de autorización estén correctos en ambos sistemas
- Asegúrate de haber importado transacciones de proveedores para el mismo período

### Diferencias de monto

- Pueden deberse a:
  - Comisiones no incluidas
  - Retenciones aplicadas
  - Diferencias de tipo de cambio (si aplica)
  - Errores de registro

## Futuras Mejoras

- [ ] Conciliación automática al importar
- [ ] Reglas personalizables de conciliación
- [ ] Notificaciones de discrepancias
- [ ] Exportación a múltiples formatos (Excel, PDF)
- [ ] Dashboard de análisis de conciliaciones
- [ ] Historial de conciliaciones realizadas
