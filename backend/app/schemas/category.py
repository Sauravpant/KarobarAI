import uuid
from pydantic import BaseModel

class CategoryCreateRequest(BaseModel):
    name: str
    description: str | None = None

class CategoryUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None

class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}

