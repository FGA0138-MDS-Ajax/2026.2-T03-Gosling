"""Registro dos modelos persistidos, compartilhando os metadados do Base."""

from app.candidaturas.models import Candidatura as Candidatura
from app.core.database import Base
from app.favoritos.models import VagaSalva as VagaSalva
from app.midias.models import ArquivoMidia as ArquivoMidia
from app.midias.models import MidiaVaga as MidiaVaga

metadata = Base.metadata
