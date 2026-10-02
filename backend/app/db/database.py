import socket

_orig_getaddrinfo = socket.getaddrinfo
def _getaddrinfo_ipv4_first(host, port, family=0, type=0, proto=0, flags=0):
    try:
        return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
    except Exception:
        return _orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = _getaddrinfo_ipv4_first

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

try:
    from app.core.config import settings
except ModuleNotFoundError:
    from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)


def warm_pool(n: int = 4) -> None:
    """Open n connections in parallel at startup so first requests don't pay the ~5s connect."""
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(n) as ex:
        conns = list(ex.map(lambda _: engine.connect(), range(n)))
    for c in conns:
        c.close()

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
