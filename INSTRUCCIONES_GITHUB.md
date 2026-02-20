# Instrucciones para subir el proyecto a GitHub

## Estado actual ✅
- ✅ Repositorio Git inicializado
- ✅ Commit inicial creado: "Initial commit - Menendez v1.0.2"
- ✅ 81 archivos agregados (60,149 líneas de código)

## Paso 1: Crear el repositorio en GitHub

### Opción A: Usando GitHub CLI (más rápido)
```powershell
# 1. Autenticarse con GitHub (solo la primera vez)
gh auth login

# 2. Crear el repositorio y subir el código
gh repo create Menendez --public --source=. --remote=origin --push
```

### Opción B: Crear manualmente en GitHub.com
1. Ve a: https://github.com/new
2. Repository name: **Menendez**
3. Description: "Sistema de gestión de transacciones financieras v1.0.2"
4. Visibility: **Public** (o Private si prefieres)
5. ⚠️ **NO marques** "Initialize this repository with a README"
6. Click en **"Create repository"**

## Paso 2: Conectar y subir (solo si usaste Opción B)

Después de crear el repositorio manualmente, ejecuta estos comandos:

```powershell
# Reemplaza <TU_USUARIO> con tu nombre de usuario de GitHub
git remote add origin https://github.com/<TU_USUARIO>/Menendez.git

# Renombrar la rama a 'main' si prefieres (opcional, GitHub usa 'main' por defecto)
git branch -M main

# Subir el código a GitHub
git push -u origin main
```

## Verificar
Una vez completado, deberías poder ver tu repositorio en:
**https://github.com/<TU_USUARIO>/Menendez**

---

## Información del proyecto
- **Nombre**: Menendez
- **Versión**: 1.0.2
- **Tecnologías**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, SQLite
- **Commit inicial**: bc8f1a1

## Próximos pasos sugeridos
1. Agregar un archivo `LICENSE` si quieres especificar la licencia
2. Configurar GitHub Actions para CI/CD (opcional)
3. Agregar badges al README.md (build status, version, etc.)
