import math
import os
import json
from typing import Dict, Any, List

class LULCPredictorService:
    """
    Servicio de Predicción de Uso y Cobertura del Suelo (LULC) en Madre de Dios.
    Analiza la serie temporal de Bosques y Agricultura a nivel regional y provincial,
    y proyecta las tendencias de pérdida forestal y expansión agrícola hasta el año 2035.
    """

    # Datos oficiales históricos de fallback para la región de Madre de Dios (en hectáreas)
    FALLBACK_YEARS = [2010, 2012, 2014, 2016, 2018, 2020]
    FALLBACK_DATA = {
        "bosques": [7923493.17, 7900260.57, 7872484.68, 7838062.20, 7791781.14, 7748338.23],
        "agricultura": [6843.69, 7627.05, 9178.47, 13008.51, 15041.25, 15272.19],
    }

    SECTOR_KEY_MAPPING = {
        "Tambopata - Las Piedras": "tambopata",
        "Tahuamanu - Iberia": "tahuamanu",
        "Manu - Fitzcarrald": "manu",
        "madre_de_dios": "madre_de_dios",
        "tambopata": "tambopata",
        "tahuamanu": "tahuamanu",
        "manu": "manu"
    }

    @staticmethod
    def _calculate_linear_regression(x: List[int], y: List[float]) -> tuple:
        """
        Calcula la pendiente (slope), intercepto y el coeficiente de correlación (r)
        usando el método de mínimos cuadrados ordinarios.
        """
        n = len(x)
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xx = sum(xi * xi for xi in x)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))

        denominator = (n * sum_xx - sum_x * sum_x)
        if denominator == 0:
            return 0.0, 0.0, 0.0

        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n

        # Coeficiente de correlación de Pearson R
        mean_x = sum_x / n
        mean_y = sum_y / n
        numerator_r = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
        den_x = sum((xi - mean_x) ** 2 for xi in x)
        den_y = sum((yi - mean_y) ** 2 for yi in y)

        denominator_r = math.sqrt(den_x * den_y)
        r = numerator_r / denominator_r if denominator_r > 0 else 0.0

        return slope, intercept, r

    @classmethod
    def get_forecast_report(cls, raw_sector: str = "madre_de_dios") -> Dict[str, Any]:
        """
        Calcula y compila el reporte histórico y los pronósticos de regresión
        hasta el año 2035 para Bosques y Agricultura del sector especificado.
        """
        # Mapear sector a llave de JSON
        sector_key = cls.SECTOR_KEY_MAPPING.get(raw_sector, "madre_de_dios")
        
        years = cls.FALLBACK_YEARS
        historical_data = cls.FALLBACK_DATA

        # Intentar cargar datos reales desde disco
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        json_path = os.path.join(base_dir, "data", "land_use_history.json")
        
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    all_data = json.load(f)
                if sector_key in all_data:
                    sector_data = all_data[sector_key]
                    years = sector_data["years"]
                    historical_data = {
                        "bosques": sector_data["bosques"],
                        "agricultura": sector_data["agricultura"]
                    }
            except Exception as e:
                print(f"[LULC-PREDICTOR] Error leyendo land_use_history.json: {e}. Usando fallback.")

        slopes = {}
        intercepts = {}
        r_values = {}

        # 1. Ajustar modelos para cada categoría
        for category, values in historical_data.items():
            slope, intercept, r = cls._calculate_linear_regression(years, values)
            slopes[category] = slope
            intercepts[category] = intercept
            r_values[category] = r

        # 2. Estructurar datos históricos
        historical_list = []
        for i, year in enumerate(years):
            historical_list.append({
                "year": year,
                "bosques": round(historical_data["bosques"][i], 2),
                "agricultura": round(historical_data["agricultura"][i], 2),
            })

        # 3. Calcular pronósticos
        forecast_years = [2022, 2024, 2026, 2028, 2030, 2035]
        forecast_list = []
        for year in forecast_years:
            forecast_item = {"year": year}
            for category in historical_data.keys():
                # Calculo de tendencia lineal
                val = intercepts[category] + slopes[category] * year
                # Clampear a valores positivos (el área no puede ser menor a cero)
                forecast_item[category] = round(max(0.0, val), 2)
            forecast_list.append(forecast_item)

        # 4. Calcular estadísticas de transición de bosques
        forest_lost_total = historical_data["bosques"][0] - historical_data["bosques"][-1]
        agricultura_gain = historical_data["agricultura"][-1] - historical_data["agricultura"][0]

        transitions = {
            "forest_lost_total": round(forest_lost_total, 2),
            "agricultura_pct": round((agricultura_gain / forest_lost_total) * 100, 2) if forest_lost_total > 0 else 0.0
        }

        # 5. Parámetros del modelo (Metadatos de regresión para auditoría científica)
        model_metadata = {}
        for category in historical_data.keys():
            model_metadata[category] = {
                "slope_ha_per_year": round(slopes[category], 4),
                "intercept": round(intercepts[category], 4),
                "pearson_r": round(r_values[category], 4)
            }

        return {
            "sector": sector_key,
            "historical": historical_list,
            "forecast": forecast_list,
            "transitions": transitions,
            "model_metadata": model_metadata
        }
