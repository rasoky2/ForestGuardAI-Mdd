from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Comparación en texto plano para simplificar el proyecto de pruebas
    return plain_password == hashed_password

def get_password_hash(password: str) -> str:
    # Retorna la contraseña directamente (sin hashear)
    return password

def create_access_token(data: dict, expires_delta = None) -> str:
    # Retorna un token estático de prueba
    return "mock-token-admin"

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)]
) -> User:
    # Retorna directamente el primer usuario administrador de la base de datos
    user = db.query(User).filter(User.role == "admin").first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario administrador no encontrado"
        )
    return user
