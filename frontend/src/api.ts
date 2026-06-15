const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : (rawApiUrl.endsWith('/') ? `${rawApiUrl}api` : `${rawApiUrl}/api`);

// Interfaces TypeScript para Tipado Estricto de la API
export interface UserProfile {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export interface ReportResponse {
  id: string;
  sector: string;
  risk: string;
  created_at: string;
  date: string;
}

export interface DashboardStatsResponse {
  total_zones: number;
  high_risk_alerts: number;
  total_hectares: string;
}

export interface WeatherForecastItem {
  day_label: string;
  date: string;
  temp_max: number;
  humidity_min: number;
  precipitation_sum: number;
  risk_score: number;
  level: string;
}

export interface WeatherRiskResponse {
  temperature: number;
  humidity: number;
  wind_speed: number;
  precipitation: number;
  risk_score: number;
  level: string;
  forecast: WeatherForecastItem[];
}

export interface HotspotResponse {
  id: number;
  lat: number;
  lon: number;
  intensity: number;
  sector: string;
}

export interface SectorRisk {
  sector: string;
  risk: number;
  level: string;
  evidence_deforestation: number;
  evidence_roads: number;
}

export interface RiskGridCell {
  lat: number;
  lon: number;
  risk: number;
  level: string;
}


export interface LULCHistoricalItem {
  year: number;
  bosques: number;
  agricultura: number;
}

export interface LULCForecastItem {
  year: number;
  bosques: number;
  agricultura: number;
}

export interface LULCTransitionStats {
  forest_lost_total: number;
  agricultura_pct: number;
}

export interface LULCForecastResponse {
  historical: LULCHistoricalItem[];
  forecast: LULCForecastItem[];
  transitions: LULCTransitionStats;
  model_metadata: Record<string, {
    slope_ha_per_year: number;
    intercept: number;
    pearson_r: number;
  }>;
}


// Helper para peticiones asíncronas con token JWT

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (endpoint !== '/auth/me') {
      globalThis.location.reload();
    }
    throw new Error('Sesión expirada. Inicie sesión nuevamente.');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Ocurrió un error en el servidor.');
  }

  return response.json();
}
