"""WSGI entry for Gunicorn: gunicorn -c gunicorn.conf.py wsgi:app"""
from app import app

__all__ = ["app"]
