from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

    @property
    def pages(self) -> int:
        return max((self.total + self.page_size - 1) // self.page_size, 1)


class ErrorResponse(BaseModel):
    code: str
    message: str
    params: dict = {}
