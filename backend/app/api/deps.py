from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db

DbSession = Annotated[Session, Depends(get_db)]
PageQ = Annotated[int, Query(ge=1, description="1-based page number")]
PageSizeQ = Annotated[int, Query(ge=1, le=100)]
