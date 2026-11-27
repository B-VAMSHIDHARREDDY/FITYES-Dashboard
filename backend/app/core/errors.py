"""Domain exceptions; mapped to HTTP responses in `app.main`.

Each error carries a stable `code` and `params` so clients can render localized text;
`message` is the English fallback.
"""

from typing import Any


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, message: str, *, code: str | None = None, **params: Any) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.params = params


class NotFoundError(DomainError):
    status_code = 404
    code = "not_found"


class ConflictError(DomainError):
    status_code = 409
    code = "conflict"


class UnauthorizedError(DomainError):
    status_code = 401
    code = "unauthorized"
