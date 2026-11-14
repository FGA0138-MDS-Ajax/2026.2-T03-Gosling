import jwt
from fastapi import HTTPException, Security,status
from fastapi.security import HTTPAuthorizationCredentials,HTTPBearer
from app.voluntarios.service import ALGORITHM, SECRET_KEY

security = HTTPBearer()

def get_organizacao_logada(
        credenciais: HTTPAuthorizationCredentials = Security(security)

) ->str:
    token = credenciais.credentials
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        user_id : str = payload.get("sub")
        perfil: str = payload.get("perfil")

        if not user_id:
            raise HTTPException(
                status_code= status.HTTP_401_UNAUTHORIZED,
                detail="Token JWT inválido: 'sub' ausente"
            )
        if perfil != "Organizacao":
            status_code= status.HTTP_403_FORBIDDEN,
            detail = "Acesso negado: Endpoint restrito a perfis de Organização"

        return user_id
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Realize login novamente"
        )

    except jwt.PyJWKError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido ou corrompido. ",
        )

    