import logging
import logging.config
from flask import request, has_request_context

logging_config = {
    "version": 1,
    "formatters": {
        "default": {
            "format": "[%(asctime)s][%(ip)s] (%(funcName)s) %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        }
    },
    "handlers": {
        "file": {
            "level": "DEBUG",
            "class": "logging.FileHandler",
            "filename": "logs/app.log",
            "formatter": "default",
            "encoding": "utf-8"
        },
        "stream": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "default"
        }
    },
    "root": {
        "level": "DEBUG",
        "handlers": ["file", "stream"]
    }
}

# logger 초기화
logging.config.dictConfig(logging_config)
    
# RequestFilter 클래스 정의
class RequestFilter(logging.Filter):
    def filter(self, record):
        record.ip = request.remote_addr if has_request_context() else 'N/A'
        return True

# 로거 생성 및 필터 추가
logger = logging.getLogger()
logger.addFilter(RequestFilter())

# werkzeug 로거 완전 비활성화
logging.getLogger("werkzeug").disabled = True