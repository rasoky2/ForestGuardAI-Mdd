# ForestGuard AI - Sistema de Monitoreo Territorial y Predicción de Deforestación

ForestGuard AI es una plataforma de análisis geoespacial e inferencia predictiva diseñada para evaluar en tiempo real el riesgo de incendios forestales y pérdida de cobertura boscosa en la región de Madre de Dios, Perú. Combina datos meteorológicos en tiempo vivo, focos térmicos satelitales, registros gubernamentales de deforestación y análisis de expansión de la infraestructura vial.

---

## 1. Arquitectura del Sistema

El sistema está desarrollado bajo el patrón arquitectónico desacoplado cliente-servidor (Thin Client) para garantizar alta eficiencia en la red y optimización de renderizado en el navegador:

### Backend (Capa de Inferencia y Servicios)
*   **Core:** Python 3.11+ y FastAPI (framework de alto rendimiento basado en Starlette y Pydantic).
*   **Base de Datos:** SQLite gestionado mediante SQLAlchemy (ORM) para la persistencia de predicciones históricas, dictámenes técnicos y control de acceso de usuarios.
*   **Seguridad:** Autenticación de sesiones mediante JSON Web Tokens (JWT) y cifrado de contraseñas con algoritmos criptográficos hash.
*   **Resiliencia y Concurrencia:** Implementación del patrón de cerrojo doble comprobación (Double-Checked Locking) y caché en memoria con TTL (Time-To-Live) para mitigar la saturación de APIs externas gubernamentales y de la NASA.

### Frontend (Capa de Visualización y UX)
*   **Core:** React 19 y TypeScript 5+ agrupados con Vite como empaquetador ultrarrápido compatible con HMR (Hot Module Replacement).
*   **Estilos:** Tailwind CSS v4 para un diseño basado en el sistema de marca **Wise**, caracterizado por bordes redondeados canonical de 24 px (`rounded-xl`), contrastes de alto impacto visual y microinteracciones de interfaz limpia.
*   **Visualización Geoespacial:** Leaflet y React-Leaflet para el renderizado del mapa dinámico e interactivo sobre capas base satelitales y CartoDB Dark Matter.

---

## 2. Modelos Matemáticos y Algoritmos Integrados

El motor de predicción del backend realiza cálculos físicos y geoespaciales para evaluar el riesgo de quema y pérdida forestal celda por celda:

### A. Sequedad del Aire y Punto de Rocío (Fórmula de Magnus-Tetens)
Calculamos la presión de vapor de agua en el aire para estimar el punto de rocío y el déficit de humedad de la vegetación forestal.
```
gamma(T, HR) = (17.27 * T) / (237.7 + T) + ln(HR / 100)

Punto_Rocio = (237.7 * gamma) / (17.27 - gamma)
```
Donde `T` es la temperatura en grados Celsius y `HR` es el porcentaje de humedad relativa.

### B. Índice Acumulativo de Peligro de Incendio (Índice de Nesterov)
Estima el nivel de sequedad y combustible fino forestal acumulado mediante la relación entre la temperatura del aire y la brecha del punto de rocío.
```
Indice_Nesterov = T * (T - Punto_Rocio)
```
Este valor climatológico se pondera dinámicamente con la velocidad del viento y las precipitaciones de las últimas 24 horas.

### C. Presión Vial por Decaimiento Exponencial
La expansión de carreteras es el principal facilitador de la deforestación. El factor de presión vial decae exponencialmente a mayor distancia de la infraestructura de transporte.
```
Presion_Vial = e ** (-0.05 * Distancia_a_Carretera)
```

### D. Distancia Geodésica Punto-Segmento (Algoritmo Haversine Vectorial)
Para medir de forma exacta la distancia desde el centro de cada celda hexagonal del mapa hacia las carreteras dibujadas (evitando la distorsión cilíndrica de la Tierra), proyectamos el punto geodésico `P` de la celda sobre cada segmento vial `[AB]`.
1.  Calculamos el factor de proyección escalar `t` acotado en el intervalo `[0, 1]`.
2.  Determinamos la coordenada geodésica proyectada más cercana.
3.  Calculamos la distancia física final usando la fórmula de Haversine:
    ```
    a = sen**2(dLat/2) + cos(lat1) * cos(lat2) * sen**2(dLon/2)
    c = 2 * atan2(raiz(a), raiz(1-a))
    Distancia = Radio_Tierra (6371 km) * c
    ```

### E. Tendencia LULC por Mínimos Cuadrados Ordinarios (Regresión Lineal)
Para modelar y pronosticar el cambio de cobertura de Bosque y Agricultura hasta el año 2035, calculamos los parámetros de la recta de tendencia `y = m * x + b`:
```
m = (n * sum(x * y) - sum(x) * sum(y)) / (n * sum(x ** 2) - sum(x) ** 2)

b = (sum(y) - m * sum(x)) / n
```
Donde `m` representa la ganancia o pérdida anual neta en hectáreas y `R` es el coeficiente de Pearson para validar la confianza estadística.

---

## 3. APIs Externas e Integración de Datos Reales

La solidez científica del sistema radica en que no simula datos aleatorios, sino que se alimenta de fuentes oficiales gubernamentales y científicas globales:

| API / Servicio | Endpoint / Origen | Datos Extraídos | Frecuencia |
| --- | --- | --- | --- |
| **GeoBosques (MINAM)** | `/ALERTAS/ultimasByCobertura` | Coordenadas de alertas tempranas de deforestación activas. | En tiempo vivo |
| **GeoBosques (MINAM)** | `/BOSQUEPERDIDA/stockBosquePerdidaRegion` | Hectáreas de stock boscoso oficial en Madre de Dios. | Anual (Actualizado) |
| **NASA FIRMS (EOSDIS)** | NOAA VIIRS C2 CSV Data | Coordenadas e intensidad térmica (FRP) de focos de calor activos en Sudamérica. | Cada 24h / 48h / 7d |
| **Open-Meteo Weather** | Meteorological Forecast API | Temperatura, humedad, viento y precipitación actual y pronóstico. | Horario / Diario |
| **Open-Meteo Air Quality** | Air Quality API | Niveles de PM2.5, PM10 y AQI europeo para monitoreo de plumas de humo. | En tiempo real |
| **Sentinel Hub** | Statistical API (CDSE Copernicus) | Índice de Vegetación Diferencial Normalizada (NDVI) para evaluar salud foliar. | Cada paso satelital |
| **SENAMHI** | Consulta WFS Estaciones | Lecturas oficiales de las estaciones físicas automáticas (Puerto Maldonado, Iberia, Iñapari). | Horario |
| **Google Maps Cloud** | Directions API | Trazados oficiales de la Carretera Interoceánica decodificados mediante algoritmo nativo. | Bajo Demanda |

---

## 4. Funcionalidades Destacadas del Sistema

1.  **Grilla de Panal Hexagonal Continua (Tessellation):** A diferencia de marcadores simples, el frontend dibuja hexágonos contiguos de tamaño `0.035` grados, encajados exactamente arista con arista (mosaico continuo). Cada celda representa una unidad analítica de riesgo.
2.  **Trazado y Hotswap Vial en Caliente:** Permite a los usuarios dibujar manualmente segmentos de carretera sobre el visor satelital. El backend intercepta estas coordenadas, actualiza el grafo vial en caliente en memoria y recalcula la matriz de influencia vial de forma inmediata.
3.  **Dashboard con Pronóstico Dinámico LULC:** Una pestaña predictiva que permite seleccionar provincias y evalúa tendencias con regresión matemática lineal en tiempo real, ilustrando la tasa de deforestación agraria.
4.  **Generación de Dictámenes Oficiales:** Emisión automática de dictámenes de emergencia para zonas de riesgo Alto, listos para impresión, equipados con QR de firma digital simulada y folios de auditoría.

---

## 5. Instrucciones de Despliegue Local

### Requisitos Previos
*   Python 3.10 o superior instalado.
*   Node.js 18 o superior y npm instalados.

### Paso 1: Configurar y Ejecutar el Backend (FastAPI)
1.  Navega al directorio del backend:
    ```bash
    cd backend
    ```
2.  Crea un entorno virtual e instálalo:
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```
3.  Instala las dependencias del archivo de requerimientos (FastAPI, Uvicorn, SQLAlchemy, PyJWT, Cryptography):
    ```bash
    pip install fastapi uvicorn sqlalchemy pyjwt cryptography
    ```
4.  Inicia el servidor backend:
    ```bash
    python app/main.py
    ```
    El servidor backend estará activo en `http://localhost:8000` con la documentación interactiva OpenAPI en `http://localhost:8000/docs`.

### Paso 2: Configurar y Ejecutar el Frontend (Vite + React)
1.  Navega al directorio del frontend:
    ```bash
    cd ../frontend
    ```
2.  Instala las dependencias de node:
    ```bash
    npm install
    ```
3.  Inicia el servidor de desarrollo local de Vite:
    ```bash
    npm run dev
    ```
    La aplicación se abrirá en `http://localhost:5173`.
