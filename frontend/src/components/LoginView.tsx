import { useState } from 'react';
import type { FormEvent } from 'react';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function LoginView({ onLogin }: Readonly<LoginViewProps>) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const target = e.currentTarget;
    const email = (target.elements.namedItem('email') as HTMLInputElement).value;
    const password = (target.elements.namedItem('password') as HTMLInputElement).value;
    
    try {
      await onLogin(email, password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Credenciales inválidas.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-canvas-soft font-sans w-full">
      {/* Panel Izquierdo: Poloridad Invertida (Wise Dark Hero) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-ink overflow-hidden p-16 flex-col justify-end">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 w-full max-w-lg">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-ink font-black text-3xl mb-6 shadow-lg">F</div>
          <h1 className="text-5xl font-black text-white mb-4 leading-tight tracking-tight">ForestGuard <span className="text-primary font-black">AI</span></h1>
          <p className="text-lg text-canvas-soft/85 font-medium">Plataforma de Inteligencia Artificial y Análisis Geoespacial para el monitoreo y prevención del riesgo de deforestación.</p>
        </div>
      </div>

      {/* Panel Derecho: Formulario en tarjeta */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 bg-canvas-soft">
        <div className="w-full max-w-md bg-canvas border border-slate-200/35 p-10 rounded-xl shadow-lg animate-fadeIn">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-ink mb-1.5 tracking-tight">Iniciar Sesión</h2>
            <p className="text-body font-semibold text-sm">Ingresa tus credenciales del Gobierno Regional.</p>
          </div>
          
          {error && (
            <div id="login-error" className="bg-negative-bg border border-negative-deep text-white rounded-xl p-4 text-xs mb-6 font-bold">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">Correo electrónico</label>
              <input 
                id="login-email"
                type="email" 
                name="email"
                required 
                placeholder="admin@gore-md.gob.pe" 
                className="w-full bg-canvas border border-ink text-ink rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold" 
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-ink uppercase tracking-wider mb-2">Contraseña</label>
              <input 
                id="login-password"
                type="password" 
                name="password"
                required 
                placeholder="••••••••" 
                className="w-full bg-canvas border border-ink text-ink rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold" 
              />
            </div>
            <button 
              id="btn-login-submit"
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-ink font-extrabold py-3 px-4 rounded-xl transition-all shadow-sm mt-4 cursor-pointer"
            >
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
