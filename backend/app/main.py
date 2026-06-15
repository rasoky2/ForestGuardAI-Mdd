import sys
import os

# Bootstrap de rutas: Añadir el directorio raíz de backend al PATH
# para permitir la ejecución directa del script sin ModuleNotFoundError
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.security import get_password_hash
from app.routers import auth, dashboard, predictions, reports

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ForestGuard AI API",
    description="Backend de análisis geoespacial y predicción de deforestación por expansión agrícola.",
    version="1.0.0"
)

# Configurar middleware de CORS
# Permitir conexiones desde cualquier origen local/remoto para facilitar la integración
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar enrutadores bajo el prefijo /api
app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# Evento de inicialización / Semillero (Seeding) de base de datos
@app.on_event("startup")
def seed_data():
    db = SessionLocal()
    try:
        # 1. Sembrar el administrador predeterminado
        admin_email = settings.DEFAULT_ADMIN_EMAIL
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            hashed_pw = get_password_hash(settings.DEFAULT_ADMIN_PASSWORD)
            new_admin = User(
                email=admin_email,
                hashed_password=hashed_pw,
                full_name="Administrador ForestGuard",
                role="admin"
            )
            db.add(new_admin)
            db.commit()
            print(f"[SEED] Usuario administrador creado exitosamente: {admin_email}")

        # 2. Los reportes se generan automaticamente desde /predictions/predict
        #    cuando el riesgo es ALTO o MEDIO. No se siembran datos falsos.
            
    except Exception as e:
        print(f"[SEED] Error sembrando base de datos: {e}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "ForestGuard AI API está activa. Visita /docs para ver la documentación de OpenAPI."}

if __name__ == "__main__":
    import uvicorn
    # Levantar servidor de desarrollo si el script se ejecuta directamente
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
