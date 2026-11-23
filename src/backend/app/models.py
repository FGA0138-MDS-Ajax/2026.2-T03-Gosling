"""Registro dos modelos persistidos, compartilhando os metadados do Base."""

from app.candidaturas.models import Candidatura as Candidatura
from app.core.database import Base
from app.favoritos.models import VagaSalva as VagaSalva

metadata = Base.metadata
