import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Map } from 'leaflet';
import { apiCall } from '../api';
import type { HotspotResponse, SectorRisk, RiskGridCell } from '../api';
import {
  madreDeDiosCenter,
  SECTOR_RISK_COORDS,
  getRiskColor,
  getRiskRadius,
  getGridColor,
  getGridOpacity,
  getRiskTextColor,
  getRiskBadgeClass,
  getHexagonPoints,
  INTEROCEANIC_HIGHWAY_BRANCHES
} from './MapView.helpers';
import {
  SectorNavigator,
  LayersLoadingIndicator,
  CartographicLegend,
  MapFilterPanel
} from './MapView.subcomponents';

function MapResizeTrigger() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

interface MapSetRefProps {
  setMap: (map: Map) => void;
}

function MapSetRef({ setMap }: Readonly<MapSetRefProps>) {
  const map = useMap();
  useEffect(() => {
    setMap(map);
  }, [map, setMap]);
  return null;
}

interface MapClickEventHandlerProps {
  onMapClick: (lat: number, lon: number) => void;
  enabled: boolean;
}

function MapClickEventHandler({ onMapClick, enabled }: Readonly<MapClickEventHandlerProps>) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

export default function MapView() {
  const [hotspots, setHotspots] = useState<HotspotResponse[]>([]);
  const [sectorRisks, setSectorRisks] = useState<SectorRisk[]>([]);
  const [riskGrid, setRiskGrid] = useState<RiskGridCell[]>([]);
  
  const [loadingHotspots, setLoadingHotspots] = useState<boolean>(true);
  const [loadingSectors, setLoadingSectors] = useState<boolean>(true);
  const [loadingGrid, setLoadingGrid] = useState<boolean>(true);
  
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'light' | 'dark' | 'satellite' | 'nasa-gibs'>('dark');
  const [selectedSector, setSelectedSector] = useState<SectorRisk | null>(null);
  const [twoDaysAgoDate] = useState(() => new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0]);

  // Estados para control de mapa, filtros y capas
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '48h' | '7d'>("24h");
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [showSectors, setShowSectors] = useState<boolean>(true);
  const [showRiskGrid, setShowRiskGrid] = useState<boolean>(true);

  // Estados para dibujo manual de la Carretera
  const [isDrawingHighway, setIsDrawingHighway] = useState<boolean>(false);
  const [drawnHighwayPoints, setDrawnHighwayPoints] = useState<[number, number][]>([]);
  const [savingHighway, setSavingHighway] = useState<boolean>(false);

  const handleMapClick = (lat: number, lon: number) => {
    setDrawnHighwayPoints((prev) => [...prev, [lat, lon]]);
  };

  const handleSaveHighway = async () => {
    if (drawnHighwayPoints.length < 2) return;
    setSavingHighway(true);
    try {
      const result = await apiCall('/predictions/save-highway', {
        method: 'POST',
        body: JSON.stringify({ points: drawnHighwayPoints })
      });
      if (result.status === 'success') {
        setIsDrawingHighway(false);
        setDrawnHighwayPoints([]);
        // Forzar la recarga en caliente de los datos para recalcular la grilla de riesgos
        await fetchData(timeRange, true);
      } else {
        alert(result.message || 'Error guardando la carretera.');
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Error al conectar con el servidor.';
      alert(msg);
    } finally {
      setSavingHighway(false);
    }
  };

  const fetchData = async (range: string, forceRefresh: boolean = false) => {
    setLoadingHotspots(true);
    setLoadingSectors(true);
    setLoadingGrid(true);
    setError(null);
    
    const suffix = `?time_range=${range}${forceRefresh ? '&refresh=true' : ''}`;
    
    try {
      const hotspotsPromise = apiCall(`/predictions/hotspots${suffix}`);
      const sectorsPromise = apiCall(`/predictions/all-risk${suffix}`);
      const gridPromise = apiCall(`/predictions/risk-grid${suffix}`);
      
      const [newHotspots, newSectors, newGrid] = await Promise.all([
        hotspotsPromise,
        sectorsPromise,
        gridPromise
      ]);
      
      setHotspots(newHotspots);
      setSectorRisks(newSectors);
      setRiskGrid(newGrid);
    } catch (err) {
      console.error("Error al cargar datos:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al cargar los datos satelitales.";
      setError(errorMessage);
    } finally {
      setLoadingHotspots(false);
      setLoadingSectors(false);
      setLoadingGrid(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(timeRange, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [timeRange]);

  const handleRefresh = () => {
    fetchData(timeRange, true);
  };

  const handleFlyTo = (sectorName: string) => {
    const coords = SECTOR_RISK_COORDS[sectorName];
    if (coords && mapInstance) {
      mapInstance.flyTo(coords, 9.5, { animate: true, duration: 1.5 });
    }
  };

  if (error) {
    return (
      <div className="p-8 text-red-600 font-medium">
        Error fatal al cargar datos del mapa: {error}
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative">
      <MapContainer center={madreDeDiosCenter} zoom={8} style={{ height: '100%', width: '100%' }} zoomControl={false} preferCanvas={true}>
        <MapSetRef setMap={setMapInstance} />
        <MapClickEventHandler onMapClick={handleMapClick} enabled={isDrawingHighway} />
        
        {/* Via en dibujo manual por el usuario */}
        {isDrawingHighway && drawnHighwayPoints.length > 0 && (
          <Polyline
            positions={drawnHighwayPoints}
            pathOptions={{
              color: '#9fe870', // Wise Primary Green
              weight: 4,
              opacity: 0.95,
              dashArray: '5, 5',
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}
        {isDrawingHighway && drawnHighwayPoints.map((pt) => (
          <CircleMarker
            key={`drawn-pt-${pt[0]}-${pt[1]}`}
            center={pt}
            radius={5}
            pathOptions={{
              color: '#0e0f0c', // Wise Ink
              fillColor: '#9fe870', // Wise Green
              fillOpacity: 1,
              weight: 2
            }}
          />
        ))}
        {mapType === 'light' && (
          <TileLayer 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" 
          />
        )}
        {mapType === 'dark' && (
          <TileLayer 
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
          />
        )}
        {mapType === 'satellite' && (
          <TileLayer 
            attribution='&copy; <a href="https://www.esri.com/">Esri</a> | &copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
          />
        )}
        {mapType === 'nasa-gibs' && (
          <TileLayer 
            attribution='NASA EOSDIS GIBS | MODIS Terra Corrected Reflectance True Color'
            url={`https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${twoDaysAgoDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
            subdomains="abc"
            maxNativeZoom={9}
          />
        )}

        {/* Trazado de la Carretera Interoceánica (Referencia de Proximidad) */}
        {INTEROCEANIC_HIGHWAY_BRANCHES.map((branch) => (
          <Polyline
            key={`highway-branch-${branch.at(-1)![0]}-${branch.at(-1)![1]}`}
            positions={branch}
            pathOptions={{
              color: '#38c8ff', // Accent Cyan (Wise Design System Token)
              weight: 3,
              opacity: 0.8,
              dashArray: '6, 8',
              lineCap: 'round',
              lineJoin: 'round'
            }}
          >
            <Popup>
              <div className="p-1.5 font-sans min-w-[140px]">
                <strong className="text-ink font-extrabold text-[11px] block">Carretera Interoceánica</strong>
                <span className="text-[9px] text-mute font-bold uppercase mt-0.5 block">Eje de Vulnerabilidad</span>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Grilla de riesgo de propagacion (Hexagonal contigua) */}
        {showRiskGrid && riskGrid.map((cell) => {
          const color = getGridColor(cell.level);
          const points = getHexagonPoints(cell.lat, cell.lon, 0.035 / Math.sqrt(3));
          return (
            <Polygon
              key={`grid-${cell.lat}-${cell.lon}`}
              positions={points}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: getGridOpacity(cell.level),
                weight: cell.level === 'ALTO' ? 1 : 0.5,
              }}
            >
              <Popup>
                <div className="p-2 font-sans min-w-[155px]">
                  <span className="bg-canvas-soft text-ink px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border border-slate-200">Celda Hexagonal</span>
                  <h5 className="font-extrabold text-ink text-xs mt-2">Punto de Inferencia</h5>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`text-lg font-black ${getRiskTextColor(cell.level)}`}>
                      {cell.risk}%
                    </span>
                    <span className="text-[9px] font-bold uppercase text-mute">Riesgo {cell.level}</span>
                  </div>
                  <div className="mt-2 text-[9px] text-mute space-y-0.5 border-t border-slate-100 pt-1.5">
                    <p>Latitud: {cell.lat.toFixed(4)}</p>
                    <p>Longitud: {cell.lon.toFixed(4)}</p>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Zonas de Riesgo por Sector */}
        {showSectors && sectorRisks.map((sr) => {
          const coords = SECTOR_RISK_COORDS[sr.sector];
          if (!coords) return null;
          const color = getRiskColor(sr.level);
          return (
            <Circle
              key={sr.sector}
              center={coords}
              radius={getRiskRadius(sr.risk)}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '8 4',
              }}
              eventHandlers={{
                click: () => {
                  setSelectedSector(sr);
                }
              }}
            >
              <Popup>
                <div className="p-2 font-sans min-w-[180px]">
                  <h5 className="font-extrabold text-ink text-sm">{sr.sector}</h5>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className={`text-2xl font-extrabold ${getRiskTextColor(sr.level)}`}>
                      {sr.risk}%
                    </span>
                    <span className="text-xs font-bold uppercase text-mute">Riesgo {sr.level}</span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-body font-semibold">Deforestación:</span>
                      <span className="font-extrabold text-ink">{sr.evidence_deforestation}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-body font-semibold">Proximidad vial:</span>
                      <span className="font-extrabold text-ink">{sr.evidence_roads}%</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Circle>
          );
        })}
        
        {/* Puntos de Calor NASA */}
        {showHotspots && hotspots.map((spot) => (
          <CircleMarker 
            key={spot.id} 
            center={[spot.lat, spot.lon]} 
            radius={8 + (spot.intensity - 50) * 0.15} 
            pathOptions={{ 
              color: '#dc2626', 
              fillColor: '#dc2626', 
              fillOpacity: 0.6,
              weight: 1.5
            }}
          >
            <Popup>
              <div className="p-2 font-sans">
                <span className="bg-red-50 border border-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Anomalía Térmica</span>
                <h5 className="font-extrabold text-ink text-sm mt-2">{spot.sector}</h5>
                <p className="text-body text-xs mt-0.5">Detección satelital (VIIRS / NASA)</p>
                <p className="text-red-600 font-extrabold text-xs mt-2">Intensidad: {spot.intensity}%</p>
                <p className="text-mute text-[9px] mt-1">Coordenadas: {spot.lat.toFixed(4)}, {spot.lon.toFixed(4)}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <SectorNavigator sectorRisks={sectorRisks} onFlyTo={handleFlyTo} />

      {/* Indicador flotante de carga secuencial en el mapa */}
      {(loadingHotspots || loadingSectors || loadingGrid) && (
        <LayersLoadingIndicator
          loadingHotspots={loadingHotspots}
          loadingSectors={loadingSectors}
          loadingGrid={loadingGrid}
        />
      )}
      
      {/* Controles flotantes en la esquina superior derecha */}
      <div className="absolute top-6 right-6 z-[1000] flex gap-2.5 pointer-events-auto font-sans">
        {/* Cambiar de tipo de mapa */}
        <div className="bg-canvas/80 backdrop-blur-md border border-slate-200/50 p-1.5 rounded-xl shadow-xl flex gap-1.5">
          <button 
            id="btn-map-type-light"
            type="button"
            onClick={() => setMapType('light')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${mapType === 'light' ? 'bg-primary text-ink shadow-sm' : 'text-body hover:bg-canvas-soft/60'}`}
          >
            Claro
          </button>
          <button 
            id="btn-map-type-dark"
            type="button"
            onClick={() => setMapType('dark')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${mapType === 'dark' ? 'bg-primary text-ink shadow-sm' : 'text-body hover:bg-canvas-soft/60'}`}
          >
            Oscuro
          </button>
          <button 
            id="btn-map-type-satellite"
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${mapType === 'satellite' ? 'bg-primary text-ink shadow-sm' : 'text-body hover:bg-canvas-soft/60'}`}
          >
            Satélite
          </button>
          <button 
            id="btn-map-type-nasa"
            type="button"
            onClick={() => setMapType('nasa-gibs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${mapType === 'nasa-gibs' ? 'bg-primary text-ink shadow-sm' : 'text-body hover:bg-canvas-soft/60'}`}
          >
            NASA MODIS
          </button>
        </div>

        {/* Botón de Refresco */}
        <button
          id="btn-refresh-map-data"
          type="button"
          disabled={loadingHotspots || loadingSectors || loadingGrid}
          onClick={handleRefresh}
          className="bg-canvas/80 backdrop-blur-md border border-slate-200/50 p-3.5 rounded-xl shadow-xl flex items-center justify-center hover:bg-canvas-soft/80 transition-all cursor-pointer text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refrescar datos en caliente"
        >
          {loadingHotspots || loadingSectors || loadingGrid ? (
            <div className="w-4 h-4 border-2 border-t-transparent border-ink rounded-full animate-spin"></div>
          ) : (
            <svg 
              className="w-4 h-4"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2.5} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3" 
              />
            </svg>
          )}
        </button>
      </div>

      <MapFilterPanel
        timeRange={timeRange}
        setTimeRange={(r) => setTimeRange(r)}
        showHotspots={showHotspots}
        setShowHotspots={setShowHotspots}
        showSectors={showSectors}
        setShowSectors={setShowSectors}
        showRiskGrid={showRiskGrid}
        setShowRiskGrid={setShowRiskGrid}
        isDrawingHighway={isDrawingHighway}
        setIsDrawingHighway={setIsDrawingHighway}
        drawnHighwayPoints={drawnHighwayPoints}
        savingHighway={savingHighway}
        onSaveHighway={handleSaveHighway}
        onCancelDrawing={() => {
          setIsDrawingHighway(false);
          setDrawnHighwayPoints([]);
        }}
      />

      <CartographicLegend />

      {/* Panel Lateral de Inspección (Drawer) */}
      {selectedSector && (
        <div className="absolute top-6 right-6 bottom-6 w-96 bg-canvas/90 backdrop-blur-md border border-slate-200/50 shadow-2xl rounded-xl z-[1010] flex flex-col p-6 overflow-y-auto font-sans animate-fadeIn pointer-events-auto">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4.5">
            <h4 className="font-extrabold text-ink text-sm tracking-tight">{selectedSector.sector}</h4>
            <button 
              id="btn-close-drawer"
              onClick={() => setSelectedSector(null)} 
              className="text-slate-400 hover:text-slate-600 font-extrabold text-base p-1 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 space-y-6">
            {/* Indicador de Riesgo */}
            <div className="bg-canvas-soft/60 border border-slate-200/35 p-5 rounded-xl text-center">
              <span className="text-[10px] text-mute font-bold uppercase tracking-wider">Nivel de Riesgo Global</span>
              <p className={`text-4xl font-black mt-1 ${getRiskTextColor(selectedSector.level)}`}>
                {selectedSector.risk}%
              </p>
              <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-[10px] font-extrabold border ${getRiskBadgeClass(selectedSector.level)}`}>
                RIESGO {selectedSector.level}
              </span>
            </div>

            {/* Desglose de Indicadores */}
            <div className="space-y-4">
              <h5 className="font-bold text-ink text-[10px] uppercase tracking-wider">Evidencia Geocientífica</h5>
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-body">Deforestación Reciente:</span>
                    <span className="text-ink font-bold">{selectedSector.evidence_deforestation}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${selectedSector.evidence_deforestation}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-body">Proximidad Vial (Interoceánica):</span>
                    <span className="text-ink font-bold">{selectedSector.evidence_roads}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${selectedSector.evidence_roads}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Minivisor Satelital NASA MODIS */}
            <div className="space-y-2">
              <h5 className="font-bold text-ink text-[10px] uppercase tracking-wider">Satélite de Inspección (NASA)</h5>
              <p className="text-body text-[10px] leading-relaxed">
                Vista enfocada (NASA MODIS) para verificar visualmente condiciones de nubosidad o humo en esta zona exacta.
              </p>
              
              <div className="h-44 w-full rounded-xl border border-slate-200 overflow-hidden relative" style={{ zIndex: 1 }}>
                <MapContainer 
                  key={selectedSector.sector}
                  center={SECTOR_RISK_COORDS[selectedSector.sector]} 
                  zoom={10} 
                  style={{ height: '100%', width: '100%' }} 
                  zoomControl={false} 
                  attributionControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                >
                  <MapResizeTrigger />
                  <TileLayer 
                    url={`https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${twoDaysAgoDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`}
                    subdomains="abc"
                    maxNativeZoom={9}
                  />
                  <Circle 
                    center={SECTOR_RISK_COORDS[selectedSector.sector]} 
                    radius={30000} 
                    pathOptions={{ color: getRiskColor(selectedSector.level), fillOpacity: 0.05, weight: 1.5 }} 
                  />
                </MapContainer>
              </div>
              <span className="text-[9px] text-mute font-medium block text-right mt-1.5">Mosaico Terra MODIS del sector</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
