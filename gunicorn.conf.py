# Gunicorn — продакшен (путь и порт при необходимости поправьте)
import multiprocessing

bind = "127.0.0.1:8010"
workers = min(multiprocessing.cpu_count() * 2 + 1, 4)
threads = 2
timeout = 120
graceful_timeout = 30
accesslog = "-"
errorlog = "-"
capture_output = True
