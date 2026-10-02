from __future__ import annotations

import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import LocationType

class DemandForecastRequest(BaseModel):
    shop_id: str = Field(..., description="Shop identifier string (e.g. 'S01')")
    category: str = Field(..., description="Product category slug (e.g. 'cooking_essentials')")
    location_type: str = Field(..., description="Shop location type: 'urban', 'semi_urban', or 'rural'")
    is_staple: int = Field(..., ge=0, le=1, description="1 if the product category is a staple item")
    is_perishable: int = Field(..., ge=0, le=1, description="1 if the product category is perishable")
    last_date: str = Field(..., description="Date of the LAST entry in history (YYYY-MM-DD)")
    sales_history: List[float] = Field(
        ...,
        min_length=21,
        description="Daily units sold, oldest to newest. Must be >= 21 entries."
    )
    transactions_history: List[int] = Field(
        ...,
        min_length=21,
        description="Daily transaction count, oldest to newest. Same length as sales_history."
    )

    @field_validator("transactions_history")
    @classmethod
    def histories_same_length(cls, v, info):
        sales = info.data.get("sales_history")
        if sales is not None and len(v) != len(sales):
            raise ValueError(
                f"transactions_history length ({len(v)}) must match "
                f"sales_history length ({len(sales)})"
            )
        return v

class DemandForecastByProductRequest(BaseModel):
    product_id: uuid.UUID
    last_date: str = Field(..., description="Date of the last known sales data (YYYY-MM-DD)")
    sales_history: Optional[List[float]] = Field(
        None,
        description="Daily units sold for this product, oldest to newest."
    )
    transactions_history: Optional[List[int]] = Field(
        None,
        description="Daily transaction count for this product, oldest to newest."
    )

    @field_validator("transactions_history")
    @classmethod
    def histories_same_length(cls, v, info):
        sales = info.data.get("sales_history")
        if sales is not None and v is not None:
            if len(v) != len(sales):
                raise ValueError(
                    f"transactions_history length ({len(v)}) must match "
                    f"sales_history length ({len(sales)})"
                )
        return v

class DemandForecastByProductBodyRequest(BaseModel):
    last_date: str = Field(..., description="Date of the last known sales data (YYYY-MM-DD)")
    sales_history: Optional[List[float]] = Field(
        None,
        description="Daily units sold for this product, oldest to newest."
    )
    transactions_history: Optional[List[int]] = Field(
        None,
        description="Daily transaction count for this product, oldest to newest."
    )

    @field_validator("transactions_history")
    @classmethod
    def histories_same_length(cls, v, info):
        sales = info.data.get("sales_history")
        if sales is not None and v is not None:
            if len(v) != len(sales):
                raise ValueError(
                    f"transactions_history length ({len(v)}) must match "
                    f"sales_history length ({len(sales)})"
                )
        return v

class DailyForecastResponse(BaseModel):
    forecast_date: str
    predicted_units: float
    model: str
    confidence: float

class ShapImpactFeature(BaseModel):
    feature: str
    impact: float

class DailyForecastExplainResponse(BaseModel):
    forecast_date: str
    prediction: float
    base_value: float
    top_positive_features: List[ShapImpactFeature]
    top_negative_features: List[ShapImpactFeature]
    feature_contributions: Dict[str, float]
    human_readable_explanation: str

class DemandGlobalImportanceResponse(BaseModel):
    native_importance: List[Dict[str, Any]]
    shap_importance: Optional[List[Dict[str, Any]]] = None

class DemandStockSummaryResponse(BaseModel):
    product_id: str
    product_name: str
    current_stock: int
    next_day_forecast: float
    next_7_day_forecast: float
    stock_for_next_day: int
    stock_for_next_7_days: int
    recommended_restock: int
    stock_gap_for_next_day: int
    stock_gap_for_next_7_days: int
    status: str
    summary: str

class DemandModelMetadataResponse(BaseModel):
    metadata: Dict[str, Any]

