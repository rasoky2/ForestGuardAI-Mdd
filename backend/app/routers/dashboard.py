import json
import time
import urllib.request
from typing import Annotated, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.prediction import Prediction
from app.models.report import Report
from app.models.user import User
from app.schemas.dashboard import DashboardStats
from app.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

_geobosques_stock_cache: Optional[str] = None
_geobosques_stock_time: float = 0

def _fetch_air_quality(lat: float, lon: float) -> dict:
    try:
        url = (
            "https://air-quality-api.open-meteo.com/v1/air-quality?"
            f"latitude={lat}&longitude={lon}"
            "&current=pm2_5,pm10,european_aqi"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        c = data.get("current", {})
        return {
            "pm2_5": c.get("pm2_5", 0.0),
            "pm10": c.get("pm10", 0.0),
            "european_aqi": c.get("european_aqi", 0),
        }
    except Exception:
        return {"pm2_5": 0.0, "pm10": 0.0, "european_aqi": 0}

def get_live_weather_risk():
    # Coordenadas de Puerto Maldonado, Madre de Dios
    # Consultamos datos actuales y pronóstico diario de 3 días para predicción climatológica de incendios
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        "latitude=-12.5933&longitude=-70.0402"
        "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation"
        "&daily=temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,precipitation_sum"
        "&timezone=auto&forecast_days=3"
    )
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            
            # 1. Datos actuales
            current = data.get("current", {})
            temp = current.get("temperature_2m", 28.0)
            humidity = current.get("relative_humidity_2m", 75.0)
            wind = current.get("wind_speed_10m", 8.0)
            precip = current.get("precipitation", 0.0)
            
            # FWI simplificado para clima actual
            def calculate_risk(t, h, w, p):
                risk_score = 25
                if t > 30:
                    risk_score += (t - 30) * 4
                if h < 65:
                    risk_score += (65 - h) * 1.5
                if w > 8:
                    risk_score += (w - 8) * 1.2
                if p > 0:
                    risk_score = risk_score * 0.1
                score = min(max(int(risk_score), 10), 99)
                
                if score >= 65:
                    lvl = "ALTO"
                elif score >= 35:
                    lvl = "MEDIO"
                else:
                    lvl = "BAJO"
                return score, lvl

            current_score, current_level = calculate_risk(temp, humidity, wind, precip)
            
            # 2. Pronóstico diario (3 días)
            daily = data.get("daily", {})
            time_list = daily.get("time", [])
            temp_max_list = daily.get("temperature_2m_max", [])
            hum_min_list = daily.get("relative_humidity_2m_min", [])
            wind_max_list = daily.get("wind_speed_10m_max", [])
            precip_sum_list = daily.get("precipitation_sum", [])
            
            forecast = []
            days_translation = ["Hoy", "Mañana", "Pasado Mañana"]
            
            for i in range(min(len(time_list), 3)):
                t_max = temp_max_list[i] if i < len(temp_max_list) else 30.0
                h_min = hum_min_list[i] if i < len(hum_min_list) else 60.0
                w_max = wind_max_list[i] if i < len(wind_max_list) else 10.0
                p_sum = precip_sum_list[i] if i < len(precip_sum_list) else 0.0
                
                # Para pronóstico usamos temperatura máxima y humedad mínima (peor escenario de riesgo)
                score, lvl = calculate_risk(t_max, h_min, w_max, p_sum)
                
                forecast.append({
                    "day_label": days_translation[i] if i < len(days_translation) else time_list[i],
                    "date": time_list[i],
                    "temp_max": t_max,
                    "humidity_min": h_min,
                    "precipitation_sum": p_sum,
                    "risk_score": score,
                    "level": lvl
                })
                
            aq = _fetch_air_quality(-12.5933, -70.0402)

            return {
                "temperature": temp,
                "humidity": humidity,
                "wind_speed": wind,
                "precipitation": precip,
                "risk_score": current_score,
                "level": current_level,
                "forecast": forecast,
                "air_quality": aq
            }
    except Exception as e:
        print(f"[WEATHER] Fallback activado debido a error en Open-Meteo: {e}")
        return {
            "temperature": 29.5,
            "humidity": 70.0,
            "wind_speed": 7.5,
            "precipitation": 0.0,
            "risk_score": 42,
            "level": "MEDIO",
            "forecast": [
                {"day_label": "Hoy", "date": "2026-06-14", "temp_max": 31.0, "humidity_min": 65.0, "precipitation_sum": 0.0, "risk_score": 45, "level": "MEDIO"},
                {"day_label": "Mañana", "date": "2026-06-15", "temp_max": 32.5, "humidity_min": 58.0, "precipitation_sum": 0.0, "risk_score": 68, "level": "ALTO"},
                {"day_label": "Pasado Mañana", "date": "2026-06-16", "temp_max": 28.0, "humidity_min": 80.0, "precipitation_sum": 4.5, "risk_score": 12, "level": "BAJO"}
            ],
            "air_quality": {"pm2_5": 0.0, "pm10": 0.0, "european_aqi": 0}
        }

def _fetch_geobosques_stock() -> Optional[str]:
    global _geobosques_stock_cache, _geobosques_stock_time
    now = time.time()
    if _geobosques_stock_cache and (now - _geobosques_stock_time) < 3600:
        return _geobosques_stock_cache

    body = json.dumps({"ubigeo": "17"}).encode("utf-8")
    req = urllib.request.Request(
        "http://geobosques.minam.gob.pe/geobosque/ws/rest/BOSQUEPERDIDA/stockBosquePerdidaRegion",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8-sig"))
        if data.get("result") == 1:
            ha = int(data["stock_bosque_ultimo"])
            formatted = f"{ha / 1_000_000:.1f}M" if ha >= 1_000_000 else f"{ha / 1_000:.1f}k"
            _geobosques_stock_cache = formatted
            _geobosques_stock_time = now
            return formatted
    except Exception as e:
        print(f"[GEOBOSQUES STOCK] Error: {e}")
    return None


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    total_inferences = db.query(Prediction).count()
    alto_inferences = db.query(Prediction).filter(Prediction.level == "ALTO").count()
    alto_reports = db.query(Report).filter(Report.risk == "Alto").count()

    total_zones = total_inferences
    high_risk_alerts = alto_inferences + alto_reports

    geobosques = _fetch_geobosques_stock()
    if geobosques:
        total_hectares = geobosques
    else:
        total_hectares = f"{total_inferences * 187:.1f}k"

    return {
        "total_zones": total_zones,
        "high_risk_alerts": high_risk_alerts,
        "total_hectares": total_hectares,
    }

@router.get("/weather-risk")
def get_weather_risk(current_user: Annotated[User, Depends(get_current_user)]):
    return get_live_weather_risk()
