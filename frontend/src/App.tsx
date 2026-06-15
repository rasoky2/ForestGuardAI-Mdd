import { useState, useEffect } from 'react';
import { apiCall } from './api';
import type { UserProfile } from './api';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import MapView from './components/MapView';
import ReportsView from './components/ReportsView';

interface NavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ label, active, onClick }: Readonly<NavItemProps>) {
  return (
    <button 
      id={`nav-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
      type="button"
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all text-left font-semibold text-sm ${
        active 
          ? 'bg-primary text-ink font-bold shadow-sm' 
          : 'text-body hover:bg-canvas-soft hover:text-ink'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-ink' : 'bg-slate-300'}`}></div>
      <span className="flex-1">{label}</span>
    </button>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('token') !== null;
  });
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(() => {
    return localStorage.getItem('token') !== null;
  });

  // Validar sesión activa en segundo plano
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    apiCall('/auth/me')
      .then((userData: UserProfile) => {
        setUser(userData);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      })
      .finally(() => setIsCheckingAuth(false));
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.access_token);
    
    const userData: UserProfile = await apiCall('/auth/me');
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'AD';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen bg-canvas-soft items-center justify-center text-ink font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent border-primary mx-auto mb-4"></div>
          <p className="text-body font-semibold">Verificando sesión institucional...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-canvas-soft text-body font-sans">
      
      {/* SIDEBAR INSTITUCIONAL */}
      <aside className="w-64 bg-canvas border-r border-slate-200/50 flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3 border-b border-slate-200/30">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-ink font-black text-xl shadow-[0_0_15px_rgba(159,232,112,0.2)]">F</div>
          <h1 className="font-black text-lg text-ink tracking-tight">ForestGuard <span className="text-primary font-black bg-ink px-1.5 py-0.5 rounded-md">AI</span></h1>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 mt-6">
          <NavItem label="Panel Control" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem label="Mapa Riesgo" active={activeTab === 'mapa'} onClick={() => setActiveTab('mapa')} />
          <NavItem label="Reportes" active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} />
        </nav>

        <div className="p-4 border-t border-slate-200/30 bg-canvas-soft/30">
          <div className="flex items-center gap-3 p-2 hover:bg-canvas-soft/60 rounded-xl transition-colors">
            <div className="w-10 h-10 rounded-full bg-primary-pale text-ink-deep font-bold flex items-center justify-center">
              {getInitials(user?.full_name ?? null)}
            </div>
            <div className="flex-1 text-xs overflow-hidden">
              <p className="text-ink font-bold truncate">{user?.full_name || 'Administrador'}</p>
              <p className="text-mute font-semibold truncate">{user?.email || 'Gore M. de Dios'}</p>
            </div>
            <button 
              id="btn-logout"
              onClick={handleLogout} 
              className="text-slate-400 hover:text-negative-deep font-bold p-1.5 transition-colors cursor-pointer rounded-lg hover:bg-slate-100" 
              title="Cerrar sesión"
            >
              ✕
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className={`flex-1 flex flex-col overflow-y-auto ${activeTab === 'mapa' ? 'p-0' : 'p-8'}`}>
        
        {/* Cabecera dinámica */}
        {activeTab !== 'mapa' && (
          <header className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-black text-ink tracking-tight uppercase">
                {activeTab === 'dashboard' && 'Panel de Control'}
                {activeTab === 'reportes' && 'Reportes Oficiales'}
              </h2>
              <p className="text-body mt-1 font-semibold text-sm">Monitoreo de expansión agrícola en Madre de Dios.</p>
            </div>
          </header>
        )}

        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'mapa' && <MapView />}
        {activeTab === 'reportes' && <ReportsView />}
      </main>
    </div>
  );
}
