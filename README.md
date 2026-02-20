# 📊 Sistema de Conciliación de Pagos - Menedez

Sistema web premium para la gestión, normalización y conciliación de archivos de recaudación de múltiples proveedores (Payway, Fiserv, MercadoPago, Jerárquicos, etc.). Diseñado con una estética moderna **Slate & Blue** y una arquitectura escalable.

---

## 🚀 Características Principales

### 💎 Diseño y Estética Premium
- **Interfaz Slate & Blue**: Estética minimalista y moderna inspirada en herramientas de última generación.
- **Glassmorphism**: Efectos de cristal esmerilado y sombras suaves en toda la interfaz.
- **Modo Oscuro/Claro**: Soporte nativo con persistencia automática.
- **Visualización de Datos**: Gráficos dinámicos (Recharts) que sincronizan sus colores con la identidad institucional de cada proveedor.
- **Reportes Optimizados**: Dashboard preparado para exportación a PDF mediante estilos `@media print` profesionales.

### 📥 Importación y Auditoría
- **Parsing Inteligente**: Detección automática de delimitadores (`;`, `,`), formatos de fecha y separadores decimales.
- **Historial de Importaciones**: Registro cronológico de cada archivo procesado.
- **Función Undo (Deshacer)**: Posibilidad de eliminar un lote de importación completo, borrando automáticamente todas las transacciones asociadas.
- **Control de Duplicados**: Sistema que detecta y omite transacciones ya existentes para evitar errores de conciliación.

### 🏢 Gestión de Proveedores
- **CRUD Completo**: Creación y configuración de proveedores ilimitados.
- **Editor de Mapeo**: Interfaz visual para mapear columnas del CSV a los campos del sistema.
- **Personalización de Marca**: Selector de color integrado (inline) para que cada proveedor mantenga su identidad visual en toda la App.

### 💸 Control de Transacciones
- **Layout de Doble Columna**: Sidebar con filtros avanzados por Proveedor y Navegación de Períodos.
- **Tabla Potente (TanStack Table)**: Paginación fluida, ordenamiento multieje y scroll optimizado.
- **Operaciones Masivas**: Selección múltiple para exportación parcial o eliminación en lote.
- **Edición Manual**: Capacidad de crear o corregir transacciones directamente desde la interfaz.

### 💳 Normalización Inteligente
- **Gestión de Alias**: Sistema para unificar múltiples nombres de tarjetas (ej: "Visa Crédito", "VISA", "VI") bajo un único nombre normalizado.
- **Unificación de Monedas**: Conversión automática a estándares como "ARS".

### ⚖️ Conciliaciones ERP
- **Importación desde ERP**: Carga de archivos CSV del sistema contable (Soft) con análisis automático de campos.
- **Conciliación Automática**: Algoritmo inteligente que compara transacciones ERP vs. Proveedores por:
  - Código de autorización
  - Nombre de tarjeta
  - Monto (tolerancia < $0.01)
- **4 Estados de Conciliación**:
  - ✅ **Conciliado**: Coincidencia perfecta
  - ⚠️ **Solo en ERP**: Registro solo en el sistema contable
  - 🔶 **Solo en Proveedor**: Registro solo en proveedor de pago
  - ❌ **Diferencia de Monto**: Coincidencia con importes distintos
- **Exportación de Resultados**: Descarga CSV completo con todas las comparaciones
- **Análisis Visual**: Dashboard con estadísticas y filtros por estado

📚 **Documentación completa**: [`docs/CONCILIACIONES.md`](docs/CONCILIACIONES.md)

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite 7.
- **Styling**: Tailwind CSS v4 + Lucide Icons.
- **Estado**: Zustand + TanStack Table.
- **Backend**: Node.js + Express (Arquitectura ligera y eficiente).
- **Base de Datos**: SQLite (Garantiza persistencia y portabilidad).
- **Despliegue**: Docker + Docker Compose + Nginx.

---

## 🐳 Despliegue con Docker (Recomendado)

Para levantar el entorno completo (Frontend, Backend y Persistencia de datos) en segundos:

```bash
# Iniciar el sistema
docker compose up -d --build
```

- **Acceso Web**: `http://localhost:8080`
- **Persistencia**: Los datos se almacenan en el volumen `menedez_data`.
- **API Backend**: `http://localhost:3001/api`

---

## 🔧 Instalación Manual (Desarrollo)

Si prefieres ejecutarlo sin Docker:

### 1. Backend
```bash
cd server
npm install
npm run dev
```

### 2. Frontend
```bash
# En la raíz del proyecto
npm install
npm run dev
```

---

## 🔑 Credenciales por Defecto
- **Usuario**: `admin`
- **Contraseña**: `admin123`

---

## 📁 Estructura del Proyecto

```text
├── src/                # Frontend (React + TS)
│   ├── components/     # UI, Layout y Diálogos
│   ├── pages/          # Dashboard, Transacciones, Import, etc.
│   ├── services/       # Lógica de API y Parsing
│   ├── stores/         # Estados globales (Zustand)
│   └── utils/          # Formateadores y utilidades de color
├── server/             # Backend (Node.js + SQLite)
│   ├── src/            # Lógica del servidor y rutas
│   └── data/           # (Volumen) Base de datos SQLite
├── nginx.conf          # Configuración del servidor de producción
└── docker-compose.yml  # Orquestación de contenedores
```

---

## 📄 Licencia
Este proyecto es privado. Todos los derechos reservados.

---
Creado por el equipo de **Menedez** con ❤️ y las mejores tecnologías del 2026.
