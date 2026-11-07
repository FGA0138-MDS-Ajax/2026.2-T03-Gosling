from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr = Field(
        ...,
        description="E-mail institucional do usuário",
        examples=["usuario@faculdade.edu"],
    )

    password: str = Field(
        ...,
        min_length=6,
        description="Senha do usuário",
        examples=["SenhaForte123"],
    )


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in_minutes: int = 60


class TokenPayload(BaseModel):
    sub: str
    perfil: str
    exp: int
