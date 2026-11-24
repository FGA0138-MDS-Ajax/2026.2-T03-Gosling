from dataclasses import dataclass
from io import BytesIO
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.midia import pasta_midia

MAX_BYTES_DOCUMENTO = 5 * 1024 * 1024


@dataclass(frozen=True)
class DocumentoRecebido:
    indice: int
    nome: str
    arquivo: str
    conteudo: bytes


def _validar_formato(conteudo: bytes, tipo: str | None) -> str:
    if tipo == "application/pdf" and conteudo.startswith(b"%PDF-"):
        return "pdf"
    formatos = {"image/jpeg": "JPEG", "image/png": "PNG"}
    if tipo in formatos:
        try:
            with Image.open(BytesIO(conteudo), formats=[formatos[tipo]]) as imagem:
                imagem.verify()
            return "jpg" if tipo == "image/jpeg" else "png"
        except (
            UnidentifiedImageError,
            OSError,
            SyntaxError,
            Image.DecompressionBombError,
        ):
            pass
    raise ValueError("Envie um arquivo PDF, JPG ou PNG válido.")


def validar_documentos(
    exigidos: list[str],
    indices: list[int],
    arquivos: list[UploadFile],
) -> list[DocumentoRecebido]:
    if len(arquivos) != len(indices) or sorted(indices) != list(range(len(exigidos))):
        raise HTTPException(422, "Envie um arquivo para cada documento exigido.")

    recebidos = []
    erros = []
    for posicao, (indice, upload) in enumerate(zip(indices, arquivos)):
        try:
            conteudo = upload.file.read(MAX_BYTES_DOCUMENTO + 1)
            if not conteudo:
                raise ValueError("O arquivo está vazio.")
            if len(conteudo) > MAX_BYTES_DOCUMENTO:
                raise ValueError("O arquivo deve ter até 5 MB.")
            extensao = _validar_formato(conteudo, upload.content_type)
            recebidos.append(
                DocumentoRecebido(
                    indice, exigidos[indice], f"{uuid4().hex}.{extensao}", conteudo
                )
            )
        except ValueError as erro:
            erros.append({"loc": ["body", "arquivos", posicao], "msg": str(erro)})
    if erros:
        raise HTTPException(422, detail=erros)
    return recebidos


def pasta_documentos():
    return pasta_midia() / "candidaturas"
