# Guía de Despliegue en Railway (ForestGuard AI)

Esta guía detalla los pasos y requisitos técnicos para desplegar la plataforma **ForestGuard AI** en Railway, configurando el Backend (FastAPI + PostgreSQL) y el Frontend (React + Vite) como dos servicios independientes dentro del mismo proyecto.

---

## 1. Estrategia de Despliegue (Monorepositorio)

Dado que el proyecto está estructurado como un monorepositorio con las carpetas `/backend` y `/frontend`, en Railway crearemos **dos servicios independientes** que apunten al mismo repositorio de GitHub, pero configurando carpetas raíz (Root Directory) y comandos de compilación distintos.

```
                  +---------------------------+
                  |    Repositorio GitHub     |
                  +-------------+-------------+
                                |
        +-----------------------+-----------------------+
        |                                               |
        v                                               v
+-------+---------------+                       +-------+---------------+
|    Servicio Backend   |                       |   Servicio Frontend   |
|   (Directorio: /backend) |                       |  (Directorio: /frontend) |
|   Construido por Docker|                       | Construido por Nixpacks|
+-------+---------------+                       +-------+---------------+
        |                                               |
        v (Lee/Escribe en DB)                           v (Consume API)
+-------+---------------+                               |
|   Servicio Database   | <-----------------------------+
|     (PostgreSQL)      |
+-----------------------+
```

---

## 2. Requisitos Previos

1. El repositorio de GitHub debe estar actualizado y sincronizado en la rama principal (`main`).
2. Una cuenta en [Railway.app](https://railway.app).
3. Instalar la CLI de Railway (opcional, pero recomendado si prefieres desplegar desde la terminal).

---

## 3. Paso 1: Crear el Proyecto y la Base de Datos PostgreSQL

1. Inicia sesión en Railway y presiona **New Project**.
2. Selecciona **Provision PostgreSQL**. Esto creará un proyecto vacío con una base de datos PostgreSQL activa.
3. La base de datos creará automáticamente las variables de entorno de conexión necesarias (`DATABASE_URL`, `PGPASSWORD`, `PGPORT`, etc.).

---

## 4. Paso 2: Desplegar y Configurar el Backend (FastAPI)

El backend de ForestGuard AI incluye un `Dockerfile` optimizado en `/backend/Dockerfile` que detecta dinámicamente el puerto de ejecución y realiza el semillero de datos inicial.

### Configuración del Servicio de Backend:
1. En tu proyecto de Railway, haz clic en **+ New** -> **Github Repo** y selecciona tu repositorio `ForestGuardAI-Mdd`.
2. Una vez creado el servicio, renómbralo a `backend` (o el nombre que prefieras).
3. Ve a la pestaña **Settings** del servicio de backend:
   * **Root Directory**: Configúralo como `/backend`.
   * **Custom Start Command**: Déjalo en blanco. Railway detectará automáticamente el `Dockerfile` y ejecutará la instrucción `CMD` contenida en él.
4. Ve a la pestaña **Variables** y agrega las siguientes variables de entorno:
   * `ENVIRONMENT`: `production`
   * `DATABASE_URL`: `${{PostgreSQL.DATABASE_URL}}` (Al presionar el botón de variables de Railway, podrás referenciar la URL de conexión de la base de datos PostgreSQL que creaste en el Paso 1).
   * `JWT_SECRET_KEY`: Genera una clave hexadecimal segura de 32 bytes (puedes ejecutar `openssl rand -hex 32` en tu terminal local para obtener una).
   * `JWT_ALGORITHM`: `HS256`
   * `ACCESS_TOKEN_EXPIRE_MINUTES`: `120`
   * `DEFAULT_ADMIN_EMAIL`: `admin@gore-md.gob.pe` (o tu correo administrador preferido).
   * `DEFAULT_ADMIN_PASSWORD`: Tu contraseña secreta para la cuenta de administrador.
5. Ve a la pestaña **Settings** y, en la sección **Networking**, haz clic en **Generate Domain**. Esto te dará una URL pública para tu API (por ejemplo, `https://backend-production-xxxx.up.railway.app`). Copia esta URL ya que la necesitaremos para el frontend.

> [!NOTE]
> Al iniciar por primera vez, el backend detectará automáticamente que está conectado a PostgreSQL y ejecutará la sincronización de tablas mediante SQLAlchemy (`Base.metadata.create_all`). También sembrará el usuario administrador por defecto configurado en las variables.

---

## 5. Paso 3: Desplegar y Configurar el Frontend (React + Vite)

> [!IMPORTANT]
> A diferencia del backend, las variables de entorno de Vite (como `VITE_API_URL`) se inyectan en los archivos JavaScript del navegador durante el tiempo de compilación (Build Time), no en tiempo de ejecución. Por lo tanto, la variable de API debe estar configurada en Railway **antes** de iniciar el build.

### Configuración del Servicio de Frontend:
1. En tu proyecto de Railway, haz clic en **+ New** -> **Github Repo** y selecciona nuevamente tu repositorio `ForestGuardAI-Mdd`.
2. Renombra este nuevo servicio a `frontend`.
3. Ve a la pestaña **Variables** del servicio de frontend y define:
   * `VITE_API_URL`: Pega la URL pública del backend generada en el paso anterior (incluyendo el protocolo `https://` y sin la barra final `/`, por ejemplo: `https://backend-production-xxxx.up.railway.app`).
4. Ve a la pestaña **Settings** del servicio de frontend:
   * **Root Directory**: Configúralo como `/frontend`.
   * **Build Command**: `npm run build`
   * **Start Command**: `npx serve -s dist -l $PORT` (Esto levantará un servidor web estático ultraligero que servirá los archivos compilados de la carpeta `dist` en el puerto asignado por Railway).
5. En la sección **Networking**, haz clic en **Generate Domain** para crear la URL pública de la interfaz de usuario.
6. Si habías configurado las variables después de que el primer build automático fallara o se ejecutara, ve a la pestaña **Deployments** y haz clic en **Redeploy** para recompilar el frontend con la URL del API correcta.

---

## 6. Monitoreo y Verificación

1. Abre la URL pública del frontend. Deberías ver la pantalla de inicio de sesión de ForestGuard AI.
2. Inicia sesión utilizando las credenciales de administrador que configuraste en el backend (`DEFAULT_ADMIN_EMAIL` y `DEFAULT_ADMIN_PASSWORD`).
3. Ve a la pestaña del **Mapa** y el **Dashboard** para comprobar que el frontend realiza consultas exitosas al backend en tiempo real.
4. Puedes verificar los registros de logs del servidor en cualquier momento desde la pestaña **Logs** de cada servicio en el panel de Railway.
