import datetime
import time
import os
import json
import threading
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Annotated, Optional, Tuple
from app.database import get_db
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.user import User
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.ml_service import MLInferenceService, update_highway_segments_in_memory
from app.services.lulc_predictor import LULCPredictorService
from app.security import get_current_user

router = APIRouter(prefix="/predictions", tags=["Predictions"])

# Directorio y archivos de cache persistente en disco
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache")
HOTSPOTS_CACHE_FILE = os.path.join(CACHE_DIR, "hotspots.json")
RISK_GRID_CACHE_FILE = os.path.join(CACHE_DIR, "risk_grid.json")

def _read_disk_cache(cache_file: str, ttl: int) -> Optional[list]:
    if not os.path.exists(cache_file):
        return None
    try:
        mtime = os.path.getmtime(cache_file)
        if (time.time() - mtime) < ttl:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[CACHE] Error leyendo cache en disco {cache_file}: {e}")
    return None

def _write_disk_cache(cache_file: str, data: list):
    try:
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        print(f"[CACHE] Error escribiendo cache en disco {cache_file}: {e}")

_hotspots_caches: dict = {}
_hotspots_caches_time: dict = {}
_HOTSPOTS_CACHE_TTL: int = 600

_risk_grid_caches: dict = {}
_risk_grid_caches_time: dict = {}
_RISK_GRID_CACHE_TTL: int = 300

_hotspots_locks = {
    "24h": threading.Lock(),
    "48h": threading.Lock(),
    "7d": threading.Lock(),
}

_risk_grid_locks = {
    "24h": threading.Lock(),
    "48h": threading.Lock(),
    "7d": threading.Lock(),
}

@router.post("/predict", response_model=PredictionResponse)
def predict(
    request: PredictionRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    # Ejecutar inferencia utilizando el servicio de Machine Learning
    result = MLInferenceService.run_inference(request.sector)
    
    # Crear registro de predicción en base de datos
    db_prediction = Prediction(
        sector=result["sector"],
        risk=result["risk"],
        level=result["level"],
        evidence_deforestation=result["evidence_deforestation"],
        evidence_roads=result["evidence_roads"]
    )
    db.add(db_prediction)
    db.commit()
    db.refresh(db_prediction)
    
    # Auto-generar un Dictamen Técnico si el riesgo es Alto o Medio
    if result["level"] in ["ALTO", "MEDIO"]:
        # Determinar el ID correlativo del reporte
        report_count = db.query(Report).count()
        report_id = f"REP-{42 + report_count:03d}"
        
        # Guardar en base de datos de reportes
        db_report = Report(
            id=report_id,
            sector=result["sector"],
            risk=result["level"].capitalize()
        )
        db.add(db_report)
        db.commit()
        
    return db_prediction

@router.get("/history", response_model=List[PredictionResponse])
def get_prediction_history(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    return db.query(Prediction).order_by(Prediction.created_at.desc()).all()

def _classify_border_location(lat: float, lon: float) -> str:
    if lon > -68.65:
        return "Zona Limítrofe (Bolivia)"
    if lat > -9.95:
        return "Zona Limítrofe (Brasil)" if lon > -70.5 else "Zona Limítrofe (Ucayali)"
    if lat < -13.33:
        return "Zona Limítrofe (Cusco)" if lon < -70.5 else "Zona Limítrofe (Puno)"
    if lon < -72.52:
        return "Zona Limítrofe (Cusco / Ucayali)"
    return "Zona Limítrofe (Frontera Externa)"


def _classify_hotspot_location(lat: float, lon: float) -> str:
    # Limites politicos aproximados de Madre de Dios
    MD_MIN_LAT, MD_MAX_LAT = -13.33, -9.95
    MD_MIN_LON, MD_MAX_LON = -72.52, -68.65

    if (MD_MIN_LAT <= lat <= MD_MAX_LAT) and (MD_MIN_LON <= lon <= MD_MAX_LON):
        if lat > -11.8:
            return "Tahuamanu (Iberia / Iñapari)"
        if lat < -12.8:
            return "Manu (Salvación)"
        return "Tambopata (Pto. Maldonado)"

    return _classify_border_location(lat, lon)


def _parse_hotspot_row(row: dict, id_counter: int) -> Optional[dict]:
    MIN_LAT, MAX_LAT = -13.7, -9.8
    MIN_LON, MAX_LON = -72.7, -68.6

    try:
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        if not (MIN_LAT <= lat <= MAX_LAT and MIN_LON <= lon <= MAX_LON):
            return None

        frp = float(row.get("frp", 0.0))
        confidence = row.get("confidence", "n")

        intensity = 70
        if confidence == "l":
            intensity = 45
        elif confidence == "h":
            intensity = 95

        provincia = _classify_hotspot_location(lat, lon)

        return {
            "id": id_counter,
            "lat": lat,
            "lon": lon,
            "intensity": intensity,
            "sector": f"{provincia} (Radiacion FRP: {frp})"
        }
    except (ValueError, KeyError):
        return None


def fetch_real_nasa_hotspots(time_range: str = "24h", refresh: bool = False):
    global _hotspots_caches, _hotspots_caches_time
    import urllib.request
    import csv
    import io

    if time_range not in ["24h", "48h", "7d"]:
        time_range = "24h"

    lock = _hotspots_locks[time_range]
    with lock:
        cache_file = os.path.join(CACHE_DIR, f"hotspots_{time_range}.json")

        # 1. Intentar cache de memoria (Double-Checked)
        now = time.time()
        mem_cache = _hotspots_caches.get(time_range)
        mem_time = _hotspots_caches_time.get(time_range, 0.0)
        if not refresh and mem_cache is not None and (now - mem_time) < _HOTSPOTS_CACHE_TTL:
            print(f"[NASA] Sirviendo {len(mem_cache)} hotspots para {time_range} desde cache de memoria ({int(now - mem_time)}s de antiguedad)")
            return mem_cache

        # 2. Intentar cache de disco (Double-Checked)
        if not refresh:
            disk_data = _read_disk_cache(cache_file, _HOTSPOTS_CACHE_TTL)
            if disk_data is not None:
                _hotspots_caches[time_range] = disk_data
                _hotspots_caches_time[time_range] = os.path.getmtime(cache_file)
                print(f"[NASA] Sirviendo {len(disk_data)} hotspots para {time_range} desde cache de disco")
                return disk_data

        url = f"https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_{time_range}.csv"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as response:
                csv_content = response.read().decode('utf-8')
                f = io.StringIO(csv_content)
                reader = csv.DictReader(f)

                hotspots = []
                id_counter = 1

                for row in reader:
                    parsed = _parse_hotspot_row(row, id_counter)
                    if parsed:
                        hotspots.append(parsed)
                        id_counter += 1

            if hotspots:
                _hotspots_caches[time_range] = hotspots[:50]
                _hotspots_caches_time[time_range] = time.time()
                _write_disk_cache(cache_file, _hotspots_caches[time_range])
                print(f"[NASA] Fetch exitoso: {len(_hotspots_caches[time_range])} hotspots en Madre de Dios ({time_range}) (guardados en disco)")
                return _hotspots_caches[time_range]

            print(f"[NASA] 0 hotspots encontrados en Madre de Dios ({time_range})")
            return []

        except Exception as e:
            print(f"[NASA] Error de conexion para {time_range}: {e}")
            mem_cache = _hotspots_caches.get(time_range)
            mem_time = _hotspots_caches_time.get(time_range, 0.0)
            if mem_cache is not None:
                antiguedad = int(time.time() - mem_time)
                print(f"[NASA] Fallo conexion. Sirviendo cache de memoria para {time_range} con antiguedad de {antiguedad}s")
                return mem_cache
            # Intentar leer desde el disco como fallback definitivo (incluso si expiro)
            disk_data = _read_disk_cache(cache_file, 86400 * 7)  # Fallback de 7 dias
            if disk_data is not None:
                _hotspots_caches[time_range] = disk_data
                _hotspots_caches_time[time_range] = os.path.getmtime(cache_file)
                print(f"[NASA] Fallo conexion. Sirviendo cache de disco expirado para {time_range} como fallback")
                return disk_data
            print(f"[NASA] Sin cache disponible para {time_range}. Devolviendo lista vacia.")
            return []

@router.get("/all-risk")
def get_all_risk(
    current_user: Annotated[User, Depends(get_current_user)],
    time_range: str = "24h",
    refresh: bool = False
):
    sectores = [
        "Tambopata - Las Piedras",
        "Tahuamanu - Iberia",
        "Manu - Fitzcarrald",
    ]
    return [MLInferenceService.run_inference(s, time_range=time_range, refresh=refresh) for s in sectores]

@router.get("/risk-grid")
def get_risk_grid(
    current_user: Annotated[User, Depends(get_current_user)],
    time_range: str = "24h",
    refresh: bool = False
):
    global _risk_grid_caches, _risk_grid_caches_time
    
    if time_range not in ["24h", "48h", "7d"]:
        time_range = "24h"
        
    lock = _risk_grid_locks[time_range]
    with lock:
        now = time.time()
        cache_file = os.path.join(CACHE_DIR, f"risk_grid_{time_range}.json")
        
        mem_cache = _risk_grid_caches.get(time_range)
        mem_time = _risk_grid_caches_time.get(time_range, 0.0)
        
        # 1. Intentar cache de memoria (Double-Checked)
        if not refresh and mem_cache is not None and (now - mem_time) < _RISK_GRID_CACHE_TTL:
            return mem_cache
            
        # 2. Intentar cache de disco (Double-Checked)
        if not refresh:
            disk_data = _read_disk_cache(cache_file, _RISK_GRID_CACHE_TTL)
            if disk_data is not None:
                _risk_grid_caches[time_range] = disk_data
                _risk_grid_caches_time[time_range] = os.path.getmtime(cache_file)
                print(f"[RISK-GRID] Sirviendo {len(disk_data)} celdas para {time_range} desde cache de disco")
                return disk_data
            
        # 3. Procesar / Calcular si no hay cache o se solicita refresh
        print(f"[RISK-GRID] Iniciando calculo completo de la grilla de riesgo ({time_range})...")
        cells = MLInferenceService.compute_risk_grid(time_range=time_range, refresh=refresh)
        _risk_grid_caches[time_range] = cells
        _risk_grid_caches_time[time_range] = now
        _write_disk_cache(cache_file, cells)
        return cells

@router.get("/hotspots")
def get_hotspots(
    current_user: Annotated[User, Depends(get_current_user)],
    time_range: str = "24h",
    refresh: bool = False
):
    return fetch_real_nasa_hotspots(time_range=time_range, refresh=refresh)


class SaveHighwayRequest(BaseModel):
    points: List[List[float]]


class ImportGoogleHighwayRequest(BaseModel):
    api_key: str
    origin: str
    destination: str


@router.post("/save-highway", responses={
    400: {"description": "Se requieren al menos 2 puntos para formar la carretera."},
    500: {"description": "Error interno al guardar los datos en disco."}
})
def save_highway(
    request: SaveHighwayRequest,
    current_user: Annotated[User, Depends(get_current_user)]
):
    points = request.points
    if len(points) < 2:
        raise HTTPException(
            status_code=400,
            detail="Se requieren al menos 2 puntos para formar segmentos de carretera."
        )
    
    segments_json = []
    segments_memory = []
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i+1]
        segments_json.append([
            [p1[0], p1[1]],
            [p2[0], p2[1]]
        ])
        segments_memory.append(
            ((p1[0], p1[1]), (p2[0], p2[1]))
        )
        
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(base_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        data_file = os.path.join(data_dir, "interoceanica.json")
        with open(data_file, "w", encoding="utf-8") as f:
            json.dump(segments_json, f, indent=2)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error guardando la carretera en disco: {str(e)}"
        )
        
    update_highway_segments_in_memory(segments_memory)
    
    return {
        "status": "success", 
        "message": f"Carretera guardada con éxito. {len(segments_memory)} segmentos registrados en caliente."
    }


def decode_google_polyline(polyline_str: str) -> List[Tuple[float, float]]:
    index, lat, lng = 0, 0, 0
    coordinates = []
    changes = {'latitude': 0, 'longitude': 0}

    while index < len(polyline_str):
        for unit in ['latitude', 'longitude']:
            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[index]) - 63
                index += 1
                result |= (byte & 0x1f) << shift
                shift += 5
                if byte < 0x20:
                    break
            if result & 1:
                changes[unit] = ~(result >> 1)
            else:
                changes[unit] = (result >> 1)

        lat += changes['latitude']
        lng += changes['longitude']

        coordinates.append((lat / 100000.0, lng / 100000.0))

    return coordinates


@router.post("/import-google-highway", responses={
    400: {"description": "Petición inválida, error en respuesta de Google o polilínea corrupta."},
    404: {"description": "No se encontró ninguna ruta entre el origen y el destino."},
    500: {"description": "Error en la conexión con la API de Google o al guardar el archivo en disco."}
})
def import_google_highway(
    request: ImportGoogleHighwayRequest,
    current_user: Annotated[User, Depends(get_current_user)]
):
    import urllib.parse
    import urllib.request
    
    encoded_origin = urllib.parse.quote(request.origin)
    encoded_dest = urllib.parse.quote(request.destination)
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={encoded_origin}&destination={encoded_dest}&key={request.api_key}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            parsed = json.loads(res_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error en la conexion con Google Maps API: {str(e)}"
        )
        
    status_api = parsed.get("status")
    if status_api != "OK":
        raise HTTPException(
            status_code=400,
            detail=f"Google Maps API retorno estado no-OK: {status_api}. Error: {parsed.get('error_message', 'Sin mensaje de error')}"
        )
        
    routes = parsed.get("routes", [])
    if not routes:
        raise HTTPException(
            status_code=404,
            detail="No se encontro ninguna ruta entre el origen y destino proporcionados."
        )
        
    overview_poly = routes[0].get("overview_polyline", {}).get("points", "")
    if not overview_poly:
        raise HTTPException(
            status_code=400,
            detail="La respuesta de Google Maps no contiene la geometria simplificada de la polilinea."
        )
        
    try:
        decoded_points = decode_google_polyline(overview_poly)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error decodificando la polilinea de Google: {str(e)}"
        )
        
    if len(decoded_points) < 2:
        raise HTTPException(
            status_code=400,
            detail="La polilinea decodificada contiene menos de 2 coordenadas."
        )
        
    segments_json = []
    segments_memory = []
    for i in range(len(decoded_points) - 1):
        p1 = decoded_points[i]
        p2 = decoded_points[i+1]
        segments_json.append([
            [p1[0], p1[1]],
            [p2[0], p2[1]]
        ])
        segments_memory.append(
            ((p1[0], p1[1]), (p2[0], p2[1]))
        )
        
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(base_dir, "data")
        os.makedirs(data_dir, exist_ok=True)
        data_file = os.path.join(data_dir, "interoceanica.json")
        with open(data_file, "w", encoding="utf-8") as f:
            json.dump(segments_json, f, indent=2)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error guardando los segmentos de Google en disco: {str(e)}"
        )
        
    update_highway_segments_in_memory(segments_memory)
    
    return {
        "status": "success",
        "message": f"Ruta importada exitosamente desde Google Maps. {len(segments_memory)} segmentos guardados en caliente."
    }


@router.get("/lulc-forecast")
def get_lulc_forecast(
    current_user: Annotated[User, Depends(get_current_user)],
    sector: Optional[str] = "madre_de_dios"
):
    """
    Retorna el reporte de Cambio de Cobertura y Uso del Suelo (LULC) en Madre de Dios o sector específico,
    incluyendo datos históricos, pronósticos hasta el año 2035 y estadísticas de transición.
    """
    try:
        s_name = sector if sector else "madre_de_dios"
        return LULCPredictorService.get_forecast_report(s_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar el reporte LULC: {str(e)}"
        )



