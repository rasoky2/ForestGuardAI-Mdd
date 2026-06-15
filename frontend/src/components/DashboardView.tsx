import { useState, useEffect } from 'react';
import { apiCall } from '../api';
import type { DashboardStatsResponse, WeatherRiskResponse, LULCForecastResponse } from '../api';

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ label, value, color }: Readonly<StatCardProps>) {
  return (
    <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <p className="text-mute text-xs font-bold tracking-wider uppercase">{label}</p>
      <h4 className={`text-3xl font-black mt-2 ${color} tracking-tight`}>{value}</h4>
    </div>
  );
}

interface WeatherSectionProps {
  loading: boolean;
  error: string | null;
  data: WeatherRiskResponse | null;
}

function WeatherSection({ loading, error, data }: Readonly<WeatherSectionProps>) {
  const getForecastBadgeStyles = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ALTO':
        return 'bg-negative-bg text-white border-negative-deep';
      case 'MEDIO':
        return 'bg-warning/10 text-warning-content border-warning/20';
      default:
        return 'bg-primary-pale text-ink-deep border-primary-neutral';
    }
  };

  const getWeatherLevelColor = (level: string) => {
    if (level === 'ALTO') return 'text-negative-deep';
    if (level === 'MEDIO') return 'text-warning-deep';
    return 'text-ink-deep';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Shimmer para el Banner del Clima */}
        <div className="bg-canvas border border-slate-200/30 p-6 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-4 border-l-primary">
          <div className="space-y-2 flex-1">
            <div className="w-28 h-4 rounded shimmer"></div>
            <div className="w-52 h-6 rounded shimmer"></div>
            <div className="w-80 h-4 rounded shimmer"></div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="w-16 h-10 rounded shimmer"></div>
            <div className="w-16 h-10 rounded shimmer"></div>
            <div className="w-16 h-10 rounded shimmer"></div>
            <div className="w-24 h-12 rounded shimmer"></div>
          </div>
        </div>
        
        {/* Shimmer para Pronóstico de 3 Días */}
        <div className="bg-canvas border border-slate-200/30 p-6 rounded-xl shadow-sm">
          <div className="w-64 h-4 rounded shimmer mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={`shimmer-forecast-${i}`} className="border border-slate-100 p-4 rounded-xl min-h-[140px] flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="w-24 h-4 rounded shimmer"></div>
                    <div className="w-16 h-3 rounded shimmer"></div>
                  </div>
                  <div className="w-12 h-5 rounded shimmer"></div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100/60">
                  <div className="h-6 rounded shimmer"></div>
                  <div className="h-6 rounded shimmer"></div>
                  <div className="h-6 rounded shimmer"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-warning/10 border border-warning/20 text-warning-content p-4 rounded-xl font-semibold">
        Monitoreo climatológico temporalmente no disponible: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fadeIn border-l-4 border-l-primary">
        <div>
          <span className="bg-primary-pale text-ink-deep px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border border-primary-neutral">API En Vivo: Open-Meteo</span>
          <h4 className="text-lg font-black text-ink mt-2">Monitoreo Climatológico de Incendios</h4>
          <p className="text-body text-sm mt-0.5 font-medium">Condiciones meteorológicas actuales en Puerto Maldonado, Madre de Dios.</p>
        </div>
        <div className="flex items-center gap-6 md:gap-8 flex-wrap">
          <div className="text-center">
            <span className="text-mute text-xs font-bold uppercase tracking-wider">Temperatura</span>
            <p className="text-ink font-black text-lg">{data.temperature}°C</p>
          </div>
          <div className="text-center">
            <span className="text-mute text-xs font-bold uppercase tracking-wider">Humedad</span>
            <p className="text-ink font-black text-lg">{data.humidity}%</p>
          </div>
          <div className="text-center">
            <span className="text-mute text-xs font-bold uppercase tracking-wider">Viento</span>
            <p className="text-ink font-black text-lg">{data.wind_speed} km/h</p>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-8 text-left md:text-right w-full md:w-auto">
            <span className="text-mute text-xs font-bold uppercase tracking-wider">Índice FWI (Riesgo)</span>
            <p className={`text-xl font-black ${getWeatherLevelColor(data.level)}`}>
              {data.risk_score}% ({data.level})
            </p>
          </div>
        </div>
      </div>

      {data.forecast && (
        <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm animate-fadeIn">
          <h4 className="text-xs font-bold text-mute mb-4 tracking-wider uppercase">Pronóstico de Riesgo de Incendios (3 Días)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.forecast.map((item) => (
              <div key={item.date} className="border border-slate-200/35 p-5 rounded-xl hover:bg-canvas-soft/40 transition-colors flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-ink text-sm">{item.day_label}</h5>
                    <p className="text-mute text-[10px] font-semibold mt-0.5">{item.date}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getForecastBadgeStyles(item.level)}`}>
                    {item.level}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                  <div>
                    <span className="text-[10px] text-mute font-bold uppercase tracking-wider">Temp Máx</span>
                    <p className="text-ink font-semibold text-xs mt-0.5">{item.temp_max}°C</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-mute font-bold uppercase tracking-wider">Hum Mín</span>
                    <p className="text-ink font-semibold text-xs mt-0.5">{item.humidity_min}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-mute font-bold uppercase tracking-wider">Lluvia</span>
                    <p className="text-ink font-semibold text-xs mt-0.5">{item.precipitation_sum}mm</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatsSectionProps {
  loading: boolean;
  error: string | null;
  data: DashboardStatsResponse | null;
}

function StatsSection({ loading, error, data }: Readonly<StatsSectionProps>) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={`shimmer-stats-${i}`} className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm space-y-3">
            <div className="w-28 h-4 rounded shimmer"></div>
            <div className="w-20 h-8 rounded shimmer"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-negative-bg border border-negative-deep text-white p-4 rounded-xl font-semibold">
        Error al cargar estadísticas: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fadeIn">
      <StatCard label="Zonas Analizadas" value={data.total_zones.toLocaleString()} color="text-ink" />
      <StatCard label="Alertas Riesgo Alto" value={data.high_risk_alerts.toLocaleString()} color="text-negative-deep" />
      <StatCard label="Hectáreas Monitoreadas" value={data.total_hectares} color="text-ink" />
    </div>
  );
}

interface LULCSectionProps {
  loading: boolean;
  error: string | null;
  data: LULCForecastResponse | null;
  selectedSector: string;
  onSectorChange: (sector: string) => void;
}

function LULCSection({ loading, error, data, selectedSector, onSectorChange }: Readonly<LULCSectionProps>) {
  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-canvas border border-slate-200/35 p-4 rounded-xl h-16 shimmer"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={`shimmer-lulc-card-${i}`} className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm space-y-3">
              <div className="w-32 h-4 rounded shimmer"></div>
              <div className="w-24 h-8 rounded shimmer"></div>
            </div>
          ))}
        </div>
        <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm h-64 shimmer"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4 flex-wrap bg-canvas-soft p-4 rounded-xl border border-slate-200/35">
          <div>
            <h5 className="font-bold text-ink text-sm">Sector de Análisis</h5>
            <p className="text-mute text-[10px] font-semibold">Seleccione el área de Madre de Dios a proyectar.</p>
          </div>
          <select
            value={selectedSector}
            onChange={(e) => onSectorChange(e.target.value)}
            className="bg-canvas border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-ink focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="madre_de_dios">Madre de Dios (Toda la Región)</option>
            <option value="tambopata">Provincia de Tambopata</option>
            <option value="tahuamanu">Provincia de Tahuamanu</option>
            <option value="manu">Provincia de Manu</option>
          </select>
        </div>
        <div className="bg-warning/10 border border-warning/20 text-warning-content p-4 rounded-xl font-semibold">
          Error al cargar predicciones de cobertura: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const t = data.transitions;
  const meta = data.model_metadata;
  const slopeBosque = meta.bosques ? meta.bosques.slope_ha_per_year : 0;
  const rBosque = meta.bosques ? meta.bosques.pearson_r : 0;
  const slopeAgri = meta.agricultura ? meta.agricultura.slope_ha_per_year : 0;
  const rAgri = meta.agricultura ? meta.agricultura.pearson_r : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Selector de Sector / Provincia */}
      <div className="flex justify-between items-center gap-4 flex-wrap bg-canvas-soft p-4 rounded-xl border border-slate-200/35">
        <div>
          <h5 className="font-bold text-ink text-sm">Sector de Análisis</h5>
          <p className="text-mute text-[10px] font-semibold">Seleccione el área de Madre de Dios a proyectar.</p>
        </div>
        <select
          value={selectedSector}
          onChange={(e) => onSectorChange(e.target.value)}
          className="bg-canvas border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-ink focus:outline-none focus:border-primary cursor-pointer"
        >
          <option value="madre_de_dios">Madre de Dios (Toda la Región)</option>
          <option value="tambopata">Provincia de Tambopata</option>
          <option value="tahuamanu">Provincia de Tahuamanu</option>
          <option value="manu">Provincia de Manu</option>
        </select>
      </div>

      {/* KPI Cards de Proyección */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-negative-bg/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <p className="text-mute text-[10px] font-bold tracking-wider uppercase">Tasa Pérdida Bosque Primario</p>
          <h4 className="text-3xl font-black mt-2 text-negative-deep tracking-tight">
            -{Math.abs(slopeBosque).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm font-bold text-mute">ha/año</span>
          </h4>
          <p className="text-body text-[11px] mt-1 font-semibold">
            Deforestación neta anual proyectada (R = {rBosque.toFixed(3)})
          </p>
        </div>
        <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <p className="text-mute text-[10px] font-bold tracking-wider uppercase">Expansión Agrícola Anual</p>
          <h4 className="text-3xl font-black mt-2 text-primary tracking-tight">
            +{slopeAgri.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm font-bold text-mute">ha/año</span>
          </h4>
          <p className="text-body text-[11px] mt-1 font-semibold">
            Crecimiento agrícola tendencial (R = {rAgri.toFixed(3)})
          </p>
        </div>
      </div>

      {/* Relación de Deforestación por Agricultura */}
      <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm">
        <h4 className="text-sm font-black text-ink mb-2">Pérdida de Bosque y Expansión Agrícola (2010 - 2020)</h4>
        <p className="text-mute text-xs mb-6 font-medium">
          Análisis de la conversión directa de las <strong>{t.forest_lost_total.toLocaleString()} hectáreas</strong> de bosque primario deforestadas en este sector.
        </p>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold text-ink mb-1">
              <span>Conversión Directa a Agricultura Comercial Estática</span>
              <span>{t.agricultura_pct}%</span>
            </div>
            <div className="w-full bg-canvas-soft border border-slate-200/40 h-2.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: `${t.agricultura_pct}%` }} />
            </div>
          </div>
        </div>
        
        <p className="mt-6 text-[11px] text-mute font-medium leading-relaxed bg-canvas-soft p-3 rounded-lg border border-slate-100">
          <strong>Nota de Análisis:</strong> El {t.agricultura_pct}% de la pérdida forestal neta se tradujo en la expansión directa de agricultura comercial. El {(100 - t.agricultura_pct).toFixed(2)}% restante del bosque consumido se atribuye a otras presiones antrópicas, principalmente la minería aluvial aurífera, pasturas para ganadería y la degradación forestal temporal por prácticas de rozo y quema de subsistencia (agricultura migratoria).
        </p>
      </div>

      {/* Tabla Histórica y de Proyecciones */}
      <div className="bg-canvas border border-slate-200/35 p-6 rounded-xl shadow-sm overflow-hidden">
        <h4 className="text-sm font-black text-ink mb-1">Matriz de Cobertura y Uso del Suelo: Histórica vs. Pronóstico</h4>
        <p className="text-mute text-xs mb-4 font-medium">Hectáreas de cobertura estimadas mediante satélite y proyectadas por regresión lineal.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-canvas-soft text-mute font-extrabold uppercase tracking-wider text-[10px]">
                <th className="p-3">Año / Estado</th>
                <th className="p-3 text-right">Bosques</th>
                <th className="p-3 text-right">Agricultura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 text-ink font-semibold">
              {/* Históricos */}
              {data.historical.map((row) => (
                <tr key={`lulc-hist-${row.year}`} className="hover:bg-canvas-soft/40 transition-colors">
                  <td className="p-3 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    {row.year} <span className="text-[9px] font-extrabold text-slate-500 uppercase bg-slate-100 px-1.5 rounded text-center">Histórico</span>
                  </td>
                  <td className="p-3 text-right">{row.bosques.toLocaleString()}</td>
                  <td className="p-3 text-right">{row.agricultura.toLocaleString()}</td>
                </tr>
              ))}

              {/* Proyecciones */}
              {data.forecast.map((row) => (
                <tr key={`lulc-fore-${row.year}`} className="hover:bg-primary-pale/10 bg-primary-pale/5 transition-colors font-medium">
                  <td className="p-3 flex items-center gap-1.5 font-bold text-ink">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {row.year} <span className="text-[9px] font-extrabold text-ink-deep uppercase bg-primary-neutral px-1.5 py-0.5 rounded text-center">Pronóstico</span>
                  </td>
                  <td className="p-3 text-right text-negative-deep font-bold">{row.bosques.toLocaleString()}</td>
                  <td className="p-3 text-right">{row.agricultura.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [weather, setWeather] = useState<WeatherRiskResponse | null>(null);
  const [lulc, setLulc] = useState<LULCForecastResponse | null>(null);
  
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);
  const [loadingLulc, setLoadingLulc] = useState<boolean>(true);
  
  const [errorStats, setErrorStats] = useState<string | null>(null);
  const [errorWeather, setErrorWeather] = useState<string | null>(null);
  const [errorLulc, setErrorLulc] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'climate' | 'lulc'>('climate');
  const [lulcSector, setLulcSector] = useState<string>("madre_de_dios");

  useEffect(() => {
    apiCall('/dashboard/stats')
      .then((statsData: DashboardStatsResponse) => {
        setStats(statsData);
        setLoadingStats(false);
      })
      .catch((err: Error) => {
        setErrorStats(err.message);
        setLoadingStats(false);
      });

    apiCall('/dashboard/weather-risk')
      .then((weatherData: WeatherRiskResponse) => {
        setWeather(weatherData);
        setLoadingWeather(false);
      })
      .catch((err: Error) => {
        setErrorWeather(err.message);
        setLoadingWeather(false);
      });
  }, []);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active) {
        setLoadingLulc(true);
        setErrorLulc(null);
      }
    });

    apiCall(`/predictions/lulc-forecast?sector=${lulcSector}`)
      .then((lulcData: LULCForecastResponse) => {
        if (active) {
          setLulc(lulcData);
          setLoadingLulc(false);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setErrorLulc(err.message);
          setLoadingLulc(false);
        }
      });

    return () => {
      active = false;
    };
  }, [lulcSector]);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Métricas Generales Superiores */}
      <h4 className="text-xs font-bold text-mute tracking-wider uppercase">Métricas Generales de Monitoreo</h4>
      <StatsSection loading={loadingStats} error={errorStats} data={stats} />

      {/* 2. Selector de Pestañas Premium */}
      <div className="flex gap-4 border-b border-slate-200/40 pb-px">
        <button
          onClick={() => setActiveTab('climate')}
          className={`pb-2 text-xs font-extrabold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'climate'
              ? 'border-primary text-primary'
              : 'border-transparent text-mute hover:text-ink'
          }`}
        >
          Riesgo de Incendios
        </button>
        <button
          onClick={() => setActiveTab('lulc')}
          className={`pb-2 text-xs font-extrabold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'lulc'
              ? 'border-primary text-primary'
              : 'border-transparent text-mute hover:text-ink'
          }`}
        >
          Pronóstico de Suelos (LULC)
        </button>
      </div>

      {/* 3. Renderizado de la Sección Activa */}
      {activeTab === 'climate' ? (
        <WeatherSection loading={loadingWeather} error={errorWeather} data={weather} />
      ) : (
        <LULCSection
          loading={loadingLulc}
          error={errorLulc}
          data={lulc}
          selectedSector={lulcSector}
          onSectorChange={setLulcSector}
        />
      )}
    </div>
  );
}

