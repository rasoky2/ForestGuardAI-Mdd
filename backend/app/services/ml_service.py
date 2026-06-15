import json
import math
import urllib.request
import csv
import io
import threading
import time
import os
from typing import Dict, Any, List, Optional, Tuple

USER_AGENT = "Mozilla/5.0"

SECTOR_COORDS = {
    "Tambopata - Las Piedras": {"lat": -12.5933, "lon": -69.0402},
    "Tahuamanu - Iberia":     {"lat": -11.4133, "lon": -69.4902},
    "Manu - Fitzcarrald":     {"lat": -12.0833, "lon": -70.3502},
}

INTEROCEANIC_HIGHWAY_WP = [
    (-12.5, -69.0), (-12.6, -69.5), (-12.7, -70.0), (-12.8, -70.5),
    (-11.4, -69.5), (-11.2, -69.6),
]

# Usamos el trazado controlado de referencia
INTEROCEANIC_HIGHWAY_SEGMENTS: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []

# Fallback robusto en caso de ausencia o fallo de lectura del archivo de datos
if not INTEROCEANIC_HIGHWAY_SEGMENTS:
    INTEROCEANIC_HIGHWAY_SEGMENTS = [
        # Rama Sur (Hacia Cusco/Puno)
        ((-12.5, -69.0), (-12.6, -69.5)),
        ((-12.6, -69.5), (-12.7, -70.0)),
        ((-12.7, -70.0), (-12.8, -70.5)),
        # Rama Norte (Hacia Iberia/Iñapari)
        ((-12.5, -69.0), (-11.4, -69.5)),
        ((-11.4, -69.5), (-11.2, -69.6)),
    ]

MADRE_DE_DIOS_POLYGON = (
    "-72.7 -9.8, -68.6 -9.8, -68.6 -13.7, -72.7 -13.7, -72.7 -9.8"
)

_geobosques_cache: Optional[List[Dict[str, float]]] = None
_geobosques_cache_time: float = 0.0
_geobosques_cache_ttl: float = 300.0  # 5 minutos

_nasa_hotspots_caches: Dict[str, List[Dict[str, Any]]] = {}
_nasa_hotspots_caches_time: Dict[str, float] = {}
_nasa_hotspots_cache_ttl: float = 300.0  # 5 minutos

_geobosques_lock = threading.Lock()

_nasa_hotspots_locks = {
    "24h": threading.Lock(),
    "48h": threading.Lock(),
    "7d": threading.Lock(),
}


def update_highway_segments_in_memory(segments: List[Tuple[Tuple[float, float], Tuple[float, float]]]):
    global INTEROCEANIC_HIGHWAY_SEGMENTS
    INTEROCEANIC_HIGHWAY_SEGMENTS = segments
    print(f"[ML-HOTSWAP] Segmentos de carretera actualizados en memoria: {len(INTEROCEANIC_HIGHWAY_SEGMENTS)}")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _calculate_dew_point(temp: float, hum: float) -> float:
    a = 17.27
    b = 237.7
    hum_clamped = max(min(hum, 100.0), 0.1)
    gamma = (a * temp) / (b + temp) + math.log(hum_clamped / 100.0)
    return (b * gamma) / (a - gamma)


def _calculate_nesterov_index(temp: float, hum: float) -> float:
    dew_point = _calculate_dew_point(temp, hum)
    diff = temp - dew_point
    diff_clamped = max(diff, 0.1)
    temp_clamped = max(temp, 0.0)
    return temp_clamped * diff_clamped


def _fetch_weather(lat: float, lon: float) -> Dict[str, float]:
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation"
        "&timezone=auto"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
    c = data.get("current", {})
    return {
        "temperature": c.get("temperature_2m", 28.0),
        "humidity":    c.get("relative_humidity_2m", 75.0),
        "wind":        c.get("wind_speed_10m", 8.0),
        "precip":      c.get("precipitation", 0.0),
        "wind_direction": c.get("wind_direction_10m", 180.0),
    }


def _fetch_air_quality(lat: float, lon: float) -> Dict[str, float]:
    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality?"
        f"latitude={lat}&longitude={lon}"
        "&current=pm2_5,pm10,european_aqi"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
    c = data.get("current", {})
    return {
        "pm2_5": c.get("pm2_5", 0.0),
        "pm10": c.get("pm10", 0.0),
        "european_aqi": c.get("european_aqi", 0),
    }


def _fetch_geobosques_alerts(refresh: bool = False) -> List[Dict[str, float]]:
    global _geobosques_cache, _geobosques_cache_time
    with _geobosques_lock:
        now = time.time()
        if not refresh and _geobosques_cache is not None and (now - _geobosques_cache_time) < _geobosques_cache_ttl:
            return _geobosques_cache

        url = "http://geobosques.minam.gob.pe/geobosque/ws/rest/ALERTAS/ultimasByCobertura"
        body = json.dumps({"coords": MADRE_DE_DIOS_POLYGON}).encode("utf-8")
        req = urllib.request.Request(url, data=body,
                                     headers={"Content-Type": "application/json",
                                              "User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8-sig"))
            if isinstance(data, list):
                data = data[0] if len(data) > 0 else {}
            if data.get("result") != 1:
                return []
            raw = data.get("datos", [])
            alerts = []
            for p in raw:
                try:
                    lon = float(p["x_"])
                    lat = float(p["y_"])
                    alerts.append({"lat": lat, "lon": lon})
                except (ValueError, KeyError):
                    continue
            _geobosques_cache = alerts
            _geobosques_cache_time = now
            return alerts
        except Exception as e:
            print(f"[GEOBOSQUES] Error: {e}")
            if _geobosques_cache is not None:
                return _geobosques_cache
            return []


def _parse_nasa_csv_row(row: Dict[str, str], md_device: bool) -> Optional[Dict[str, Any]]:
    try:
        lat, lon = float(row["latitude"]), float(row["longitude"])
        if md_device and not (-13.7 <= lat <= -9.8 and -72.7 <= lon <= -68.6):
            return None
        return {
            "lat": lat,
            "lon": lon,
            "frp": float(row.get("frp", 0.0)),
            "confidence": row.get("confidence", "n"),
        }
    except (ValueError, KeyError):
        return None


def _fetch_nasa_hotspots(md_device: bool = True, time_range: str = "24h", refresh: bool = False) -> List[Dict[str, Any]]:
    global _nasa_hotspots_caches, _nasa_hotspots_caches_time
    
    if time_range not in ["24h", "48h", "7d"]:
        time_range = "24h"
        
    lock = _nasa_hotspots_locks[time_range]
    with lock:
        now = time.time()
        mem_cache = _nasa_hotspots_caches.get(time_range)
        mem_time = _nasa_hotspots_caches_time.get(time_range, 0.0)
        
        if not refresh and md_device and mem_cache is not None and (now - mem_time) < _nasa_hotspots_cache_ttl:
            return mem_cache

        url = (f"https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
               f"noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_{time_range}.csv")
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                reader = csv.DictReader(io.StringIO(resp.read().decode("utf-8")))
            hotspots = []
            for row in reader:
                parsed = _parse_nasa_csv_row(row, md_device)
                if parsed:
                    hotspots.append(parsed)
            if md_device:
                _nasa_hotspots_caches[time_range] = hotspots
                _nasa_hotspots_caches_time[time_range] = now
            return hotspots
        except Exception as e:
            print(f"[NASA HOTSPOTS] Error: {e}")
            if md_device and mem_cache is not None:
                return mem_cache
            return []


def _min_distance_to_highway(lat: float, lon: float) -> float:
    min_dist = float('inf')
    
    for (lat1, lon1), (lat2, lon2) in INTEROCEANIC_HIGHWAY_SEGMENTS:
        d_lat = lat2 - lat1
        d_lon = lon2 - lon1
        
        denom = d_lat**2 + d_lon**2
        if denom == 0:
            proj_lat, proj_lon = lat1, lon1
        else:
            t = ((lat - lat1) * d_lat + (lon - lon1) * d_lon) / denom
            t = max(0.0, min(1.0, t))
            proj_lat = lat1 + t * d_lat
            proj_lon = lon1 + t * d_lon
            
        dist = _haversine_km(lat, lon, proj_lat, proj_lon)
        if dist < min_dist:
            min_dist = dist
            
    return min_dist


def _get_sector_weather(sector: str, lat: float, lon: float) -> Dict[str, Any]:
    temp, hum, wind, precip = 28.0, 75.0, 8.0, 0.0
    clima_origen = "Open-Meteo"
    
    estacion_map = {
        "Tambopata - Las Piedras": "Puerto Maldonado",
        "Tahuamanu - Iberia": "Iberia",
        "Manu - Fitzcarrald": "Salvacion"
    }
    estacion_name = estacion_map.get(sector)
    if estacion_name:
        try:
            from app.services.data_enrichment import SENAMHIScraperService
            s_data = SENAMHIScraperService.get_station_data(estacion_name)
            if s_data and s_data.get("temperature") is not None:
                temp = s_data["temperature"]
                hum = s_data["humidity"]
                wind = s_data["wind_speed"]
                precip = s_data["precipitation"]
                clima_origen = f"SENAMHI ({estacion_name})"
        except Exception as ex:
            print(f"[ML] Error obteniendo datos de SENAMHI para {estacion_name}: {ex}")

    if clima_origen == "Open-Meteo":
        try:
            w = _fetch_weather(lat, lon)
            temp, hum, wind, precip = w["temperature"], w["humidity"], w["wind"], w["precip"]
        except Exception:
            pass
            
    return {
        "temp": temp,
        "hum": hum,
        "wind": wind,
        "precip": precip,
        "clima_origen": clima_origen
    }


def _get_nasa_hotspots_evidence(lat: float, lon: float, time_range: str, refresh: bool) -> Dict[str, Any]:
    nearby = []
    avg_frp = 0.0
    try:
        all_hotspots = _fetch_nasa_hotspots(md_device=True, time_range=time_range, refresh=refresh)
        for h in all_hotspots:
            d = _haversine_km(lat, lon, h["lat"], h["lon"])
            if d <= 50:
                nearby.append(h)
        if nearby:
            avg_frp = sum(h["frp"] for h in nearby) / len(nearby)
    except Exception:
        pass
    return {
        "n_hotspots": len(nearby),
        "avg_frp": avg_frp
    }


def _get_geobosques_alerts_count(lat: float, lon: float, refresh: bool) -> int:
    geo_nearby = 0
    try:
        all_alerts = _fetch_geobosques_alerts(refresh=refresh)
        for a in all_alerts:
            d = _haversine_km(lat, lon, a["lat"], a["lon"])
            if d <= 30:
                geo_nearby += 1
    except Exception:
        pass
    return geo_nearby


def _calculate_inference_risk(
    temp: float, hum: float, wind: float, precip: float,
    n_hotspots: int, avg_frp: float, pm25: float, geo_nearby: int, ndvi: float
) -> int:
    nesterov = _calculate_nesterov_index(temp, hum)
    climatological_risk = min(nesterov * 0.08, 50.0)

    risk = 10.0 + climatological_risk
    if wind > 8:
        risk += (wind - 8) * 1.2
    if precip > 0:
        risk *= 0.1
    if n_hotspots > 0:
        risk += min(n_hotspots * 3, 25)
    if avg_frp > 50:
        risk += 8
    if pm25 > 50:
        risk += 10
    elif pm25 > 25:
        risk += 5
    if geo_nearby > 0:
        risk += min(geo_nearby * 4, 20)

    # Ajuste de riesgo por NDVI
    if ndvi < 0.4:
        risk += (0.4 - ndvi) * 40
    elif ndvi > 0.7:
        risk -= (ndvi - 0.7) * 20

    return min(max(int(risk), 10), 99)


def _calculate_inference_evidence(
    temp: float, n_hotspots: int, geo_nearby: int, lat: float, lon: float
) -> Tuple[int, int]:
    # Deforestation
    if geo_nearby >= 3:
        evidence_deforestation = min(65 + geo_nearby * 4, 95)
    elif n_hotspots >= 5:
        evidence_deforestation = min(70 + n_hotspots * 2, 95)
    elif n_hotspots >= 1:
        evidence_deforestation = 40 + n_hotspots * 5
    elif geo_nearby >= 1:
        evidence_deforestation = 35 + geo_nearby * 8
    else:
        if temp > 28:
            evidence_deforestation = max(10, int((temp - 25) * 5))
        else:
            evidence_deforestation = 15

    # Roads
    dist_highway = _min_distance_to_highway(lat, lon)
    fpa_vias = math.exp(-0.05 * dist_highway)
    evidence_roads = int(10 + 85 * fpa_vias)
    if n_hotspots > 0:
        evidence_roads = min(evidence_roads + n_hotspots * 2, 95)

    return min(evidence_deforestation, 95), min(evidence_roads, 95)


def _calculate_fire_component(
    lat: float, lon: float, hotspots: List[Dict[str, Any]], wind_dir: float
) -> float:
    fire_weight = 0.0
    nearest_fire_dist = 999.0
    nearest_hotspot = None
    for h in hotspots:
        d = _haversine_km(lat, lon, h["lat"], h["lon"])
        if d > 60:
            continue
        if d < nearest_fire_dist:
            nearest_fire_dist = d
            nearest_hotspot = h
        wgt = math.exp(-(d ** 2) / (2 * 15 ** 2))
        if wgt > fire_weight:
            fire_weight = wgt
    fire_component = fire_weight * 100 * 0.50

    wind_modifier = 1.0
    if nearest_hotspot and nearest_fire_dist < 30:
        dx = lon - nearest_hotspot["lon"]
        workspace_dy = lat - nearest_hotspot["lat"]
        bearing = math.degrees(math.atan2(dx, workspace_dy)) % 360
        angle_diff = abs(bearing - wind_dir)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff
        if angle_diff < 60:
            wind_modifier = 1.0 + (1.0 - angle_diff / 60.0) * 0.5
        elif angle_diff < 120:
            wind_modifier = 1.0 - (angle_diff - 60.0) / 120.0 * 0.3
            
    return min(fire_component * wind_modifier, 50.0)


def _calculate_deforest_component(lat: float, lon: float, alerts: List[Dict[str, Any]]) -> float:
    deforest_weight = 0.0
    for a in alerts:
        d = _haversine_km(lat, lon, a["lat"], a["lon"])
        if d > 30:
            continue
        wgt = math.exp(-(d ** 2) / (2 * 10 ** 2))
        if wgt > deforest_weight:
            deforest_weight = wgt
    return deforest_weight * 100 * 0.20


def _compute_cell_risk(
    lat: float, lon: float, hotspots: List[Dict[str, Any]], alerts: List[Dict[str, Any]],
    dry_score: float, wind_dir: float
) -> Optional[Dict[str, Any]]:
    fire_component = _calculate_fire_component(lat, lon, hotspots, wind_dir)
    dry_component = dry_score * 0.20
    deforest_component = _calculate_deforest_component(lat, lon, alerts)

    # Exponential decay for road component in grid
    dist_road = _min_distance_to_highway(lat, lon)
    road_decay = math.exp(-0.05 * dist_road)
    road_component = road_decay * 100 * 0.10

    risk = fire_component + dry_component + deforest_component + road_component
    risk_int = max(5, min(99, int(round(risk))))

    if risk_int >= 18:
        if risk_int >= 65:
            level = "ALTO"
        elif risk_int >= 35:
            level = "MEDIO"
        else:
            level = "BAJO"
            
        return {
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "risk": risk_int,
            "level": level,
        }
    return None


class MLInferenceService:
    """
    Servicio de Inferencia basado enteramente en datos remotos reales:
      - Open-Meteo Weather      (temperatura, humedad, viento, lluvia)
      - Open-Meteo Air Quality  (PM2.5, PM10, AQI)
      - NASA FIRMS VIIRS        (focos de calor activos)
      - GeoBosques MINAM        (alertas tempranas de deforestacion oficiales del Peru)
    """

    @staticmethod
    def run_inference(sector: str, time_range: str = "24h", refresh: bool = False) -> Dict[str, Any]:
        coords = SECTOR_COORDS.get(sector, {"lat": -12.5933, "lon": -70.0402})
        lat, lon = coords["lat"], coords["lon"]

        # 1. Weather real (SENAMHI con fallback a Open-Meteo)
        weather = _get_sector_weather(sector, lat, lon)
        temp = weather["temp"]
        hum = weather["hum"]
        wind = weather["wind"]
        precip = weather["precip"]

        # 2. Air quality real (PM2.5 como indicador de humo de incendios sin aqi)
        pm25 = 0.0
        try:
            aq = _fetch_air_quality(lat, lon)
            pm25 = aq["pm2_5"]
        except Exception:
            pass

        # 3. Hotspots reales NASA
        nasa = _get_nasa_hotspots_evidence(lat, lon, time_range, refresh)
        n_hotspots = nasa["n_hotspots"]
        avg_frp = nasa["avg_frp"]

        # 4. Alertas GeoBosques (MINAM)
        geo_nearby = _get_geobosques_alerts_count(lat, lon, refresh)

        # 4.5 Indice de Vegetacion Satelital NDVI (Sentinel Hub)
        ndvi = 0.75
        try:
            from app.services.data_enrichment import SentinelHubService
            sat_service = SentinelHubService()
            ndvi = sat_service.get_ndvi_value(lat, lon)
        except Exception as ex:
            print(f"[ML] Error obteniendo NDVI de Sentinel Hub: {ex}")

        # 5. Risk Score
        risk_score = _calculate_inference_risk(
            temp, hum, wind, precip, n_hotspots, avg_frp, pm25, geo_nearby, ndvi
        )
        
        if risk_score >= 65:
            level = "ALTO"
        elif risk_score >= 35:
            level = "MEDIO"
        else:
            level = "BAJO"

        # 6. Evidencias
        evidence_deforestation, evidence_roads = _calculate_inference_evidence(
            temp, n_hotspots, geo_nearby, lat, lon
        )

        return {
            "sector": sector,
            "risk": risk_score,
            "level": level,
            "evidence_deforestation": evidence_deforestation,
            "evidence_roads": evidence_roads,
        }

    @staticmethod
    def compute_risk_grid(time_range: str = "24h", refresh: bool = False) -> List[Dict[str, Any]]:
        hotspots = _fetch_nasa_hotspots(md_device=True, time_range=time_range, refresh=refresh)
        alerts = _fetch_geobosques_alerts(refresh=refresh)
        try:
            w = _fetch_weather(-11.5, -70.0)
        except Exception:
            w = {"temperature": 28.0, "humidity": 75.0, "wind": 8.0, "precip": 0.0, "wind_direction": 180.0}
        temp, hum = w["temperature"], w["humidity"]
        wind_dir = w.get("wind_direction", 180.0)

        # dry_score using Nesterov Index
        nesterov = _calculate_nesterov_index(temp, hum)
        dry_score = min(nesterov * 0.16, 100.0)

        MIN_LAT, MAX_LAT = -13.7, -9.8
        MIN_LON, MAX_LON = -72.7, -68.6
        STEP = 0.035
        STEP_LAT = STEP * 0.8660254

        cells: List[Dict[str, Any]] = []
        lat = MIN_LAT
        row_idx = 0
        while lat <= MAX_LAT:
            lon_offset = (STEP / 2.0) if (row_idx % 2 == 1) else 0.0
            lon = MIN_LON + lon_offset
            while lon <= MAX_LON:
                cell = _compute_cell_risk(lat, lon, hotspots, alerts, dry_score, wind_dir)
                if cell:
                    cells.append(cell)
                lon += STEP
            lat += STEP_LAT
            row_idx += 1

        print(f"[RISK-GRID] {len(cells)} celdas generadas")
        return cells
