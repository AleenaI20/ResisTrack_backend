from dataclasses import dataclass
from os import getenv
from pathlib import Path


DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parent.parent / "genome_firewall_models.pkl"
)


@dataclass(frozen=True)
class Settings:
    ncbi_email: str | None
    ncbi_api_key: str | None
    amrfinderplus_api_url: str
    cors_origins: tuple[str, ...]
    model_path: Path

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = tuple(
            origin.strip()
            for origin in getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        )
        return cls(
            ncbi_email=getenv("NCBI_EMAIL") or None,
            ncbi_api_key=getenv("NCBI_API_KEY") or None,
            amrfinderplus_api_url=getenv(
                "AMRFINDERPLUS_API_URL",
                "https://cams-ftp-veteran-reported.trycloudflare.com",
            ).rstrip("/"),
            cors_origins=origins,
            model_path=Path(
                getenv("GENOME_FIREWALL_MODEL_PATH", str(DEFAULT_MODEL_PATH))
            ).expanduser(),
        )
