import { useState, useEffect } from 'react';
import { apiCall } from '../api';
import type { ReportResponse } from '../api';

export default function ReportsView() {
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y Buscador
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRisk, setSelectedRisk] = useState<string>('todos');

  // Estado del Modal de Detalle
  const [activeReport, setActiveReport] = useState<ReportResponse | null>(null);

  useEffect(() => {
    apiCall('/reports')
      .then((data: ReportResponse[]) => {
        // Ordenar reportes por ID de forma descendente para mostrar los más recientes arriba
        const sorted = [...data].sort((a, b) => b.id.localeCompare(a.id));
        setReports(sorted);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  // Calcular la lista de reportes filtrados bajo demanda durante el renderizado
  const filteredReports = reports.filter(r => {
    const matchesSearch = searchTerm.trim() === '' || 
      r.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = selectedRisk === 'todos' || 
      r.risk.toLowerCase() === selectedRisk.toLowerCase();
      
    return matchesSearch && matchesRisk;
  });

  // Contadores para las tarjetas KPI
  const countTotal = reports.length;
  const countHigh = reports.filter(r => r.risk.toLowerCase() === 'alto').length;
  const countMedium = reports.filter(r => r.risk.toLowerCase() === 'medio').length;
  const countLow = reports.filter(r => r.risk.toLowerCase() === 'bajo').length;

  const getRiskBadgeStyles = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'alto':
        return 'bg-negative-bg text-white border-negative-deep';
      case 'medio':
        return 'bg-warning/10 text-warning-content border-warning/20';
      default:
        return 'bg-primary-pale text-ink-deep border-primary-neutral';
    }
  };

  const getReportJustification = (report: ReportResponse) => {
    const sectorClean = report.sector.replace(/ \(Radiacion.*\)/g, '');
    switch (report.risk.toLowerCase()) {
      case 'alto':
        return `Se ha detectado una alta concentración de anomalías térmicas activas combinada con tasas aceleradas de deforestación reciente en el sector ${sectorClean}. Las variables meteorológicas registradas y la proximidad a vías de acceso terrestre críticas, tales como la Carretera Interoceánica, incrementan de manera exponencial la probabilidad de propagación de incendios forestales incontrolados. Se recomienda la declaración inmediata de Alerta Roja Forestal y la movilización de brigadas de emergencia del GOREMAD y SERFOR.`;
      case 'medio':
        return `El sector ${sectorClean} presenta un nivel de riesgo moderado para incendios y degradación de biomasa forestal. Se identifican focos de calor aislados y factores climáticos de resequedad de la vegetación que exigen atención temprana. Se recomienda establecer patrullajes preventivos del Comité de Gestión Forestal local y emitir alertas a los agricultores de la zona para evitar quemas agrícolas de rastrojos durante las horas críticas de viento.`;
      default:
        return `El sector ${sectorClean} se encuentra actualmente bajo condiciones estables de bajo riesgo geocientífico. No se registran focos de calor activos y el Índice de Vegetación (NDVI) satelital muestra niveles de humedad normales en el dosel forestal. Se recomienda continuar con el monitoreo ordinario periódico a través de la plataforma ForestGuard AI.`;
    }
  };

  const handlePrint = () => {
    globalThis.print();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-6 animate-pulse">
        {/* Skeleton de Tarjetas KPI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-canvas border border-slate-200/30 p-5 rounded-xl h-24 shimmer"></div>
          ))}
        </div>
        {/* Skeleton de Tabla */}
        <div className="bg-canvas border border-slate-200/30 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-200/30 flex gap-4">
            <div className="w-64 h-10 rounded-xl shimmer"></div>
            <div className="w-32 h-10 rounded-xl shimmer"></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-body">
              <thead className="bg-canvas-soft/40 border-b border-slate-200/30">
                <tr>
                  <th className="px-6 py-4"><div className="w-20 h-4 rounded shimmer"></div></th>
                  <th className="px-6 py-4"><div className="w-44 h-4 rounded shimmer"></div></th>
                  <th className="px-6 py-4"><div className="w-16 h-5 rounded shimmer"></div></th>
                  <th className="px-6 py-4"><div className="w-28 h-4 rounded shimmer"></div></th>
                  <th className="px-6 py-4"><div className="w-20 h-4 rounded shimmer"></div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="px-6 py-5"><div className="w-16 h-4 rounded shimmer"></div></td>
                    <td className="px-6 py-5"><div className="w-40 h-4 rounded shimmer"></div></td>
                    <td className="px-6 py-5"><div className="w-12 h-5 rounded shimmer"></div></td>
                    <td className="px-6 py-5"><div className="w-24 h-4 rounded shimmer"></div></td>
                    <td className="px-6 py-5"><div className="w-20 h-8 rounded shimmer"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-negative-bg border border-negative-deep text-white p-6 rounded-xl font-bold animate-fadeIn">
        Error al cargar los dictámenes: {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 font-sans w-full">
      {/* 1. Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Total */}
        <div className="bg-canvas border border-slate-200/35 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-mute font-bold uppercase tracking-wider text-[10px]">Total Dictámenes</span>
            <h4 className="text-2xl font-black text-ink mt-1">{countTotal}</h4>
          </div>
          <div className="w-11 h-11 rounded-xl bg-canvas-soft border border-slate-200/40 flex items-center justify-center text-ink">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        {/* Alto */}
        <div className="bg-canvas border border-slate-200/35 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-negative-deep font-bold uppercase tracking-wider text-[10px]">Riesgo Alto</span>
            <h4 className="text-2xl font-black text-negative-deep mt-1">{countHigh}</h4>
          </div>
          <div className="w-11 h-11 rounded-xl bg-negative-bg border border-negative-deep flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Medio */}
        <div className="bg-canvas border border-slate-200/35 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-warning-deep font-bold uppercase tracking-wider text-[10px]">Riesgo Medio</span>
            <h4 className="text-2xl font-black text-warning-deep mt-1">{countMedium}</h4>
          </div>
          <div className="w-11 h-11 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning-deep">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Bajo */}
        <div className="bg-canvas border border-slate-200/35 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-ink-deep font-bold uppercase tracking-wider text-[10px]">Riesgo Bajo</span>
            <h4 className="text-2xl font-black text-ink-deep mt-1">{countLow}</h4>
          </div>
          <div className="w-11 h-11 rounded-xl bg-primary-pale border border-primary-neutral flex items-center justify-center text-ink-deep">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Sección Principal: Filtros + Tabla */}
      <div className="bg-canvas border border-slate-200/35 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden animate-fadeIn">
        {/* Barra de Búsqueda y Filtros */}
        <div className="p-5 border-b border-slate-200/30 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-canvas-soft/30">
          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <input 
              id="input-reports-search"
              type="text"
              placeholder="Buscar por sector o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-ink placeholder-mute bg-canvas transition-all font-semibold"
            />
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Filtro por Riesgo */}
          <div className="flex gap-1.5 p-1 bg-canvas-soft rounded-xl self-start md:self-auto border border-slate-200/30">
            {['todos', 'alto', 'medio', 'bajo'].map((r) => (
              <button
                id={`btn-filter-risk-${r}`}
                key={r}
                onClick={() => setSelectedRisk(r)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                  selectedRisk === r 
                    ? 'bg-primary text-ink font-bold shadow-sm' 
                    : 'text-body hover:text-ink hover:bg-canvas-soft/50 font-semibold'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Resultados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-body border-collapse">
            <thead className="bg-canvas-soft/40 text-mute border-b border-slate-200/30 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 font-extrabold">ID Reporte</th>
                <th className="px-6 py-4 font-extrabold">Sector Evaluado</th>
                <th className="px-6 py-4 font-extrabold">Nivel Riesgo</th>
                <th className="px-6 py-4 font-extrabold">Fecha Emisión</th>
                <th className="px-6 py-4 font-extrabold text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/30">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-canvas-soft/20 transition-colors group">
                  <td className="px-6 py-4.5 font-mono text-ink-deep font-bold text-xs">{report.id}</td>
                  <td className="px-6 py-4.5 text-ink font-semibold">{report.sector}</td>
                  <td className="px-6 py-4.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getRiskBadgeStyles(report.risk)}`}>
                      {report.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4.5 text-body font-medium">{report.date}</td>
                  <td className="px-6 py-4.5 text-center">
                    <button
                      id={`btn-open-report-${report.id.toLowerCase()}`}
                      onClick={() => setActiveReport(report)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-ink text-ink hover:bg-canvas-soft transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Ver Dictamen
                    </button>
                  </td>
                </tr>
              ))}

              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-semibold text-xs text-mute">No se encontraron dictámenes técnicos para este filtro.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Modal de Vista de Dictamen Técnico Oficial */}
      {activeReport && (
        <div className="fixed inset-0 z-[2000] bg-ink/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn pointer-events-auto">
          <div className="bg-canvas rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200/50 flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="px-6 py-4.5 border-b border-slate-200/30 flex justify-between items-center bg-canvas-soft/30">
              <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />{' '}
                Vista Previa de Documento
              </span>
              <button 
                id="btn-close-modal"
                onClick={() => setActiveReport(null)}
                className="text-body hover:text-ink font-bold text-base p-1.5 transition-colors cursor-pointer rounded-xl hover:bg-canvas-soft"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Dictamen */}
            <div className="flex-1 overflow-y-auto p-8 font-sans leading-relaxed text-body max-w-prose mx-auto w-full print:p-0 print:text-ink">
              {/* Marco de doble borde de estilo dictamen oficial */}
              <div className="border-4 border-double border-slate-200/80 p-8 rounded-xl bg-canvas flex flex-col">
                {/* Encabezado del Documento Oficial */}
                <div className="text-center pb-6 border-b-2 border-slate-200 mb-8 flex flex-col items-center">
                  {/* Escudo/Símbolo Institucional */}
                  <div className="w-14 h-14 rounded-xl border-2 border-primary flex items-center justify-center mb-3 bg-primary-pale">
                    <svg className="w-7 h-7 text-ink-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-mute">Plataforma Tecnológica ForestGuard AI</span>
                  <h2 className="text-base font-black text-ink mt-1.5 uppercase">Dictamen Técnico de Alerta Forestal</h2>
                  <span className="text-[9px] font-bold text-body uppercase tracking-wide mt-1">Gobierno Regional de Madre de Dios - Gerencia Regional Forestal</span>
                </div>

                {/* Contenido / Metadatos */}
                <div className="text-xs bg-canvas-soft/50 border border-slate-200/30 rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-mute tracking-wider">Código del Reporte</span>
                    <span className="font-mono text-ink font-bold text-sm">{activeReport.id}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-mute tracking-wider">Fecha de Emisión</span>
                    <span className="font-semibold text-ink">{activeReport.date}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-mute tracking-wider">Sector Evaluado</span>
                    <span className="font-semibold text-ink">{activeReport.sector.replace(/ \(Radiacion.*\)/g, '')}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-mute tracking-wider">Estado de Alerta</span>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${getRiskBadgeStyles(activeReport.risk)}`}>
                      RIESGO {activeReport.risk}
                    </span>
                  </div>
                </div>

                {/* Redacción Principal */}
                <div className="space-y-4.5 text-xs md:text-sm text-body leading-relaxed text-justify">
                  <p>
                    <strong className="text-ink">Considerando:</strong> Que, mediante el subsistema de inferencia espacial de la plataforma ForestGuard AI, y en cruce directo con la base de datos satelital de anomalías térmicas (VIIRS/NASA FIRMS) y la cartografía de pérdida de cobertura boscosa del Ministerio del Ambiente (GeoBosques - MINAM), se realiza la evaluación continua de factores de riesgo forestal en la región de Madre de Dios.
                  </p>
                  <p>
                    <strong className="text-ink">Evaluación Técnica:</strong> {getReportJustification(activeReport)}
                  </p>
                  <div className="text-xs">
                    <strong className="text-ink">Recomendaciones Directas:</strong>
                    {activeReport.risk.toLowerCase() === 'alto' && (
                      <ul className="list-disc pl-5 mt-2 space-y-1.5 font-medium">
                        <li>Establecer zona de veda temporal de quemas agrícolas en un radio de 50 kilómetros.</li>
                        <li>Desplegar de inmediato brigadas de vigilancia de fauna silvestre y control forestal del SERFOR.</li>
                        <li>Comunicar de inmediato al Centro de Operaciones de Emergencia Regional (COER).</li>
                      </ul>
                    )}
                    {activeReport.risk.toLowerCase() === 'medio' && (
                      <ul className="list-disc pl-5 mt-2 space-y-1.5 font-medium">
                        <li>Incrementar la frecuencia de análisis satelital a lapsos de 12 horas.</li>
                        <li>Sensibilizar e informar a las asociaciones locales sobre los riesgos climatológicos actuales.</li>
                        <li>Mantener alerta a los guardabosques de las concesiones circundantes.</li>
                      </ul>
                    )}
                    {activeReport.risk.toLowerCase() === 'bajo' && (
                      <ul className="list-disc pl-5 mt-2 space-y-1.5 font-medium">
                        <li>Mantener el flujo estándar de recolección de datos satelitales.</li>
                        <li>Fomentar las buenas prácticas forestales ordinarias.</li>
                      </ul>
                    )}
                  </div>
                </div>

                {/* Firmas y Sellos */}
                <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center">
                  {/* QR de Validación */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-16 bg-canvas-soft border border-slate-200/60 rounded-lg p-1.5 flex items-center justify-center">
                      <svg className="w-full h-full text-slate-700" viewBox="0 0 100 100" fill="currentColor">
                        <rect x="0" y="0" width="20" height="20" />
                        <rect x="0" y="80" width="20" height="20" />
                        <rect x="80" y="0" width="20" height="20" />
                        <rect x="35" y="35" width="30" height="30" />
                        <rect x="10" y="45" width="10" height="10" />
                        <rect x="45" y="10" width="10" height="10" />
                        <rect x="80" y="80" width="10" height="10" />
                        <rect x="65" y="70" width="10" height="15" />
                      </svg>
                    </div>
                    <span className="text-[7px] text-mute font-bold uppercase tracking-wider">Firma Digital ForestGuard</span>
                  </div>

                  {/* Firma de Director Regional */}
                  <div className="flex flex-col items-center text-center">
                    <div className="font-serif italic text-slate-500 h-8 text-sm flex items-end font-semibold">
                      Gerencia Regional Forestal
                    </div>
                    <div className="w-36 border-t border-slate-300 mt-1"></div>
                    <span className="text-[9px] font-bold text-ink mt-1.5 uppercase">Área de Monitoreo Satelital</span>
                    <span className="text-[7.5px] text-mute font-semibold tracking-wide uppercase">Gerencia Forestal GOREMAD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="px-6 py-4.5 border-t border-slate-200/30 flex justify-end gap-3 bg-canvas-soft/30">
              <button 
                id="btn-close-modal-footer"
                onClick={() => setActiveReport(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-body hover:text-ink hover:bg-canvas-soft transition-all cursor-pointer border border-transparent"
              >
                Cerrar
              </button>
              <button 
                id="btn-print-report"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-primary text-ink hover:bg-primary-hover transition-all cursor-pointer shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h6z" />
                </svg>
                Imprimir Dictamen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
