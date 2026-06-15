# APIs Pendientes de Integrar

## 1. Sentinel Hub (Copernicus Data Space)

Imagenes satelitales Sentinel-2 (10m de resolucion) para deteccion de area quemada y cambios en cobertura vegetal.

**Registro:** https://dataspace.copernicus.eu/

**Obtener credenciales:**
1. Iniciar sesion en https://dataspace.copernicus.eu/
2. Ir a User Settings > OAuth Clients
3. Crear cliente -> obtener Client ID + Client Secret

**Autenticacion:**
```
POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
Body: grant_type=client_credentials&client_id=XXX&client_secret=YYY
```

**Endpoint base:** `https://sh.dataspace.copernicus.eu/`

**Documentacion:** https://documentation.dataspace.copernicus.eu/APIS/SentinelHub.html

**Documentacion API:** https://shapps.dataspace.copernicus.eu/requests-builder (genera codigo listo)

**Caso de uso:** Detectar parcelas quemadas post-incendio comparando imagenes pre/post. Requiere procesamiento de raster (NDVI, NBR).

---

## 2. GeoBosques MINAM (YA INTEGRADO)

API oficial del Ministerio del Ambiente del Peru. Ya integrada en `ml_service.py`.

**Endpoint:** `POST http://geobosques.minam.gob.pe/geobosque/ws/rest/ALERTAS/ultimasByCobertura`
**Body:** `{"coords": "lon1 lat1, lon2 lat2, ..."}` (poligono WGS84)
**Response:** `{result: 1, datos: [{x_: lon, y_: lat}, ...]}`

**Documentacion:** https://geobosques.minam.gob.pe/geobosque/view/geoapi.php

**Endpoints adicionales no integrados:**
- Stock bosque/perdida nivel nacional: `geoapi/stockBosquePerdidaNacional.html`
- Stock bosque/perdida por region: `geoapi/stockBosquePerdidaRegion.html`
- Stock bosque/perdida por provincia: `geoapi/stockBosquePerdidaProvincia.html`
- Stock bosque/perdida por distrito: `geoapi/stockBosquePerdidaDistrito.html`

---

## 3. Open-Meteo Air Quality (YA INTEGRADO)

Sin API key. Integrado en `ml_service.py` y `dashboard.py`.

**Endpoint:** `GET https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm2_5,pm10,european_aqi`

**Documentacion:** https://open-meteo.com/en/docs/air-quality-api

---

## 4. NASA GIBS (WMTS) - Capa visual en mapa

Tiles de imagenes satelitales para superponer en Leaflet. No requiere API key.

**Endpoint WMTS:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
```

**Capas utiles:**
- `MODIS_Terra_CorrectedReflectance_TrueColor` - imagen satelital natural
- `VIIRS_NOAA20_Thermal_Anomalies_375m` - anomalias termicas (fuegos activos)
- `MODIS_Aqua_Aerosol_Optical_Depth` - aerosoles (humo)

**Integracion en React-Leaflet:**
```tsx
<TileLayer
  url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/{layer}/default/{time}/{tileMatrixSet}/{z}/{y}/{x}.jpg"
  layer="MODIS_Terra_CorrectedReflectance_TrueColor"
/>
```

**Documentacion:** https://nasa-gibs.github.io/gibs-api-docs/

---

## 5. OpenAQ - Calidad del aire global

API con datos de estaciones de monitoreo de calidad del aire a nivel global.

**Endpoint:** `GET https://api.openaq.org/v2/latest?coordinates={lat},{lon}&radius=50000`
**Requiere:** API key (gratuita en https://openaq.org/)

**Limitacion:** Cobertura limitada en Madre de Dios (pocas estaciones). Open-Meteo Air Quality (CAMS) es mas practico por su cobertura global via satelite.

---

## 6. SENAMHI Peru - Datos meteorologicos oficiales

Servicio Nacional de Meteorologia e Hidrologia del Peru.

**Pagina:** https://www.senamhi.gob.pe/

**Estado:** No tiene API REST publica documentada. Los datos se obtienen via:
- Descarga de archivos CSV/historico
- Visualizacion en mapa web interactivo
- Contacto directo via `atencionalciudadano@senamhi.gob.pe`

No es prioritario mientras funcione Open-Meteo.

---

## 7. Global Forest Watch (GFW) API (Requiere Registro)

Alertas de deforestacion en tiempo real (alertas GLAD/RADD) de 30 metros de resolucion para predecir proximas quemas controladas.

**Registro:** https://developers.globalforestwatch.org/

**Obtener credenciales:**
1. Crear cuenta en el portal de desarrolladores de Global Forest Watch.
2. Ir a API Keys y generar un API Token.

**Endpoint de Alertas GLAD:**
```
GET https://api.resourcewatch.org/v2/query/glad-alerts?sql=SELECT count(*) FROM index_glad_alerts WHERE lat={lat} AND lon={lon} AND date > 'YYYY-MM-DD'
```

**Caso de Uso:** Identificar si hay deforestacion reciente en un sector. Si hay alertas de tala forestal activas, la probabilidad de que esa parcela sea quemada en las proximas semanas para agricultura aumenta exponencialmente.

---

## 8. NASA Earthdata API - Humedad del Suelo (SMAP) (Requiere Registro)

Datos globales del satelite SMAP (Soil Moisture Active Passive) para obtener el porcentaje de agua en la capa superficial del suelo.

**Registro:** https://urs.earthdata.nasa.gov/

**Autenticacion:**
Requiere credenciales del portal NASA Earthdata Login. Se consume mediante peticiones HTTP autenticadas con Basic Auth.

**Endpoint de descarga (DAAC National Snow and Ice Data Center):**
```
GET https://n5eil01u.ecs.nsidc.org/SMAP/SPL4SMGP.006/{date}/
```

**Caso de Uso:** Alimentar el componente de humedad foliar en la formula de prediccion (FWI). Suelo con humedad < 10% representa vegetacion extremadamente inflamable.

---

## 9. NOAA / NASA - Satélite Geoestacionario GOES-16 (Monitoreo Térmico de Alta Frecuencia) (Requiere Registro)

Imágenes y lecturas del satélite GOES-16 en bandas infrarrojas térmicas (bandas 7, 14, 15) para detectar anomalías térmicas en tiempo real.

**Registro:** https://www.earthdata.nasa.gov/ o a través del repositorio público de AWS Open Data (NOAA GOES).

**Caso de Uso:** Permite complementar a los satélites polares (VIIRS/MODIS) que pasan solo 2 veces al día. GOES-16 transmite datos de Madre de Dios cada 10-15 minutos. Esto permite una detección ultra-temprana de incendios forestales activos.

---

## 10. Copernicus CDS - Sentinel-1 Radar de Apertura Sintética (SAR) (Requiere Registro)

Telemetría de radar de órbita polar para medir la retrodispersión y la humedad de la superficie terrestre a través de microondas (banda C).

**Registro:** https://dataspace.copernicus.eu/ (mismas credenciales que Sentinel Hub).

**Caso de Uso:** A diferencia de Sentinel-2 (óptico), el radar SAR traspasa la cobertura nubosa y el dosel forestal húmedo. Esto permite monitorear perturbaciones del suelo, humedad foliar profunda y deforestación/quemas ilegales incluso durante la época de lluvias intensas o nubosidad persistente en Madre de Dios.

---

## 11. Core ML - Algoritmo de Predicción Avanzado (XGBoost / U-Net) (Plan de Mejora Interno)

Implementación de un modelo de aprendizaje automático supervisado o red neuronal convolucional (CNN) entrenado con datos históricos del proyecto.

**Estado:** Planificación de modelo local en el servidor (no requiere API Key externa).

**Caso de Uso:** Reemplazar el cálculo heurístico simplificado actual de FWI por un clasificador entrenado (XGBoost) que aprenda la relación no lineal entre meteorología histórica de Open-Meteo, alertas de GeoBosques e incendios históricos de la NASA. O, a largo plazo, entrenar una red U-Net de segmentación semántica para mapear el riesgo pixel por pixel.

