# pyrefly: ignore [missing-import]
from rest_framework.views import exception_handler
# pyrefly: ignore [missing-import]
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        custom_data = {
            "error": {
                "code": getattr(exc, 'default_code', 'ERROR').upper(),
                "message": str(exc.detail) if hasattr(exc, 'detail') and isinstance(exc.detail, str) else "Validation or processing error occurred.",
                "fields": exc.detail if hasattr(exc, 'detail') and isinstance(exc.detail, dict) else {}
            }
        }
        if isinstance(exc.detail, list):
            custom_data["error"]["message"] = " ".join([str(item) for item in exc.detail])
        response.data = custom_data

    return response
