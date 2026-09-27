try:
    from .main import app
except (ImportError, ValueError):
    from main import app
