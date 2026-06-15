import type { SectorRisk } from '../api';
import { getRiskTextColor } from './MapView.helpers';

// 1. Navegador de Sectores (FlyTo)
interface SectorNavigatorProps {
  sectorRisks: SectorRisk[];
  onFlyTo: (sector: string) => void;
}

export function SectorNavigator({ sectorRisks, onFlyTo }: Readonly<SectorNavigatorProps>) {
  return (
    <div className="absolute top-6 left-6 z-[1000] bg-canvas/80 backdrop-blur-md border border-slate-200/50 p-5 rounded-xl shadow-xl font-sans pointer-events-auto min-w-[240px] flex flex-col gap-4">
      <span className="font-extrabold text-ink uppercase tracking-wider text-[9px]">Monitoreo por Sector</span>
      <div className="flex flex-col gap-2">
        {sectorRisks.map((sr) => (
          <button
            id={`btn-flyto-${sr.sector.toLowerCase().replace(/\s+/g, '-')}`}
            key={sr.sector}
            type="button"
            onClick={() => onFlyTo(sr.sector)}
            className="flex justify-between items-center p-3 rounded-xl border border-slate-200/30 bg-canvas-soft/40 hover:bg-canvas-soft/80 transition-all text-left cursor-pointer group"
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-ink group-hover:text-ink transition-colors">{sr.sector.split(' - ')[0]}</span>
              <span className="text-[9px] font-bold text-mute uppercase tracking-wider mt-0.5">{sr.level}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[12px] font-black ${getRiskTextColor(sr.level)}`}>{sr.risk}%</span>
              <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-ink group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 2. Indicador Flotante de Carga de Capas
interface LayersLoadingIndicatorProps {
  loadingHotspots: boolean;
  loadingSectors: boolean;
  loadingGrid: boolean;
}

export function LayersLoadingIndicator({
  loadingHotspots,
  loadingSectors,
  loadingGrid,
}: Readonly<LayersLoadingIndicatorProps>) {
  return (
    <div className="absolute top-[230px] left-6 z-[1000] bg-canvas/80 backdrop-blur-md border border-slate-200/50 p-5 rounded-xl shadow-lg font-sans text-xs flex flex-col gap-3 min-w-[240px] animate-fadeIn pointer-events-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="font-extrabold text-ink uppercase tracking-wider text-[10px]">Carga de Capas</span>
        <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-body">
          <span className="font-semibold">1. Focos de calor (NASA)</span>
          {loadingHotspots ? (
            <span className="text-orange-600 font-bold animate-pulse">Cargando...</span>
          ) : (
            <span className="text-emerald-700 font-extrabold">✓ Listo</span>
          )}
        </div>
        <div className="flex justify-between items-center text-body">
          <span className="font-semibold">2. Sectores de riesgo</span>
          {loadingSectors ? (
            <span className="text-orange-600 font-bold animate-pulse">Analizando...</span>
          ) : (
            <span className="text-emerald-700 font-extrabold">✓ Listo</span>
          )}
        </div>
        <div className="flex justify-between items-center text-body">
          <span className="font-semibold">3. Matriz de propagación</span>
          {loadingGrid ? (
            <span className="text-orange-600 font-bold animate-pulse">Procesando...</span>
          ) : (
            <span className="text-emerald-700 font-extrabold">✓ Listo</span>
          )}
        </div>
      </div>
    </div>
  );
}

// 3. Leyenda Cartográfica
export function CartographicLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-[1000] bg-canvas/80 backdrop-blur-md border border-slate-200/50 p-5 rounded-xl shadow-xl font-sans pointer-events-auto max-w-xs animate-fadeIn">
      <h5 className="font-bold text-ink text-xs uppercase tracking-wider">Leyenda Cartográfica</h5>
      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-red-600/70 border border-red-700"></div>
          <span className="text-body text-xs font-semibold">Foco de Calor NASA</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-sm bg-red-500/60 border border-red-500"></div>
          <span className="text-body text-xs font-semibold">Predicción ALTO</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500/35 border border-orange-500"></div>
          <span className="text-body text-xs font-semibold">Predicción MEDIO</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-sm bg-green-600/20 border border-green-600"></div>
          <span className="text-body text-xs font-semibold">Predicción BAJO</span>
        </div>
        <div className="flex items-center gap-2.5 mt-1 pt-2 border-t border-slate-100">
          <div className="w-4 h-2 rounded-sm bg-red-500/40 border border-red-500 dashed"></div>
          <span className="text-body text-xs font-semibold">Sector Riesgo ALTO</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-2 rounded-sm bg-orange-500/25 border border-orange-500 dashed"></div>
          <span className="text-body text-xs font-semibold">Sector Riesgo MEDIO</span>
        </div>
      </div>
    </div>
  );
}

// 4. Panel de Filtros, Capas y Edición de Vía
interface MapFilterPanelProps {
  timeRange: '24h' | '48h' | '7d';
  setTimeRange: (range: '24h' | '48h' | '7d') => void;
  showHotspots: boolean;
  setShowHotspots: (show: boolean) => void;
  showSectors: boolean;
  setShowSectors: (show: boolean) => void;
  showRiskGrid: boolean;
  setShowRiskGrid: (show: boolean) => void;
  isDrawingHighway: boolean;
  setIsDrawingHighway: (drawing: boolean) => void;
  drawnHighwayPoints: [number, number][];
  savingHighway: boolean;
  onSaveHighway: () => void;
  onCancelDrawing: () => void;
}

export function MapFilterPanel({
  timeRange,
  setTimeRange,
  showHotspots,
  setShowHotspots,
  showSectors,
  setShowSectors,
  showRiskGrid,
  setShowRiskGrid,
  isDrawingHighway,
  setIsDrawingHighway,
  drawnHighwayPoints,
  savingHighway,
  onSaveHighway,
  onCancelDrawing,
}: Readonly<MapFilterPanelProps>) {
  return (
    <div className="absolute top-24 right-6 z-[1000] bg-canvas/80 backdrop-blur-md border border-slate-200/50 p-5 rounded-xl shadow-xl font-sans pointer-events-auto flex flex-col gap-4.5 min-w-[240px]">
      {/* Filtro Temporal */}
      <div>
        <span className="font-extrabold text-ink uppercase tracking-wider text-[9px]">Filtro Focos (NASA)</span>
        <div className="flex gap-1.5 mt-2.5">
          {(['24h', '48h', '7d'] as const).map((range) => (
            <button
              id={`btn-time-range-${range}`}
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                timeRange === range
                  ? 'bg-primary text-ink shadow-sm'
                  : 'bg-canvas-soft/60 text-body hover:bg-canvas-soft hover:text-ink'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Visibilidad de Capas */}
      <div className="border-t border-slate-200/40 pt-3.5">
        <span className="font-extrabold text-ink uppercase tracking-wider text-[9px] block mb-2.5">Visibilidad de Capas</span>
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 text-xs font-semibold text-body cursor-pointer select-none">
            <input
              id="checkbox-layer-hotspots"
              type="checkbox"
              checked={showHotspots}
              onChange={(e) => setShowHotspots(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
            <span>Focos de Calor (NASA)</span>
          </label>
          <label className="flex items-center gap-3 text-xs font-semibold text-body cursor-pointer select-none">
            <input
              id="checkbox-layer-sectors"
              type="checkbox"
              checked={showSectors}
              onChange={(e) => setShowSectors(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
            <span>Sectores de Riesgo</span>
          </label>
          <label className="flex items-center gap-3 text-xs font-semibold text-body cursor-pointer select-none">
            <input
              id="checkbox-layer-risk-grid"
              type="checkbox"
              checked={showRiskGrid}
              onChange={(e) => setShowRiskGrid(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
            <span>Grilla de Propagación</span>
          </label>
        </div>
      </div>

      {/* Edición manual de vías */}
      <div className="border-t border-slate-200/40 pt-3.5 flex flex-col gap-2">
        <span className="font-extrabold text-ink uppercase tracking-wider text-[9px] block">Edición de Vía</span>
        
        {/* Usamos condición afirmativa primero de acuerdo con las reglas de lint del IDE */}
        {isDrawingHighway ? (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-orange-600 font-bold animate-pulse text-center">
              Modo Dibujo Activo
            </span>
            <span className="text-[9px] text-mute text-center">
              Haz clic en el mapa satélite. Puntos: {drawnHighwayPoints.length}
            </span>
            <div className="flex gap-1.5">
              <button
                id="btn-save-drawn-highway"
                type="button"
                disabled={drawnHighwayPoints.length < 2 || savingHighway}
                onClick={onSaveHighway}
                className="flex-1 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
              >
                {savingHighway ? 'Guardando...' : '✓ Guardar'}
              </button>
              <button
                id="btn-cancel-drawing-highway"
                type="button"
                disabled={savingHighway}
                onClick={onCancelDrawing}
                className="flex-1 py-1.5 bg-slate-200 text-ink rounded-xl text-[10px] font-bold hover:bg-slate-300 transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            id="btn-start-drawing-highway"
            type="button"
            onClick={() => setIsDrawingHighway(true)}
            className="w-full py-2 bg-primary text-ink rounded-xl text-[11px] font-bold shadow-sm hover:bg-primary-active transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Dibujar Carretera
          </button>
        )}
      </div>
    </div>
  );
}
