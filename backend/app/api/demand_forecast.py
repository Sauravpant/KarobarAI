from __future__ import annotations

import uuid
from typing import Any, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.demand_forecast import (
    DemandForecastRequest,
    DemandForecastByProductRequest,
    DemandForecastByProductBodyRequest,
    DailyForecastResponse,
    DailyForecastExplainResponse,
    DemandGlobalImportanceResponse,
    DemandStockSummaryResponse,
)
import app.services.demand_forecast_service as demand_service

router_generic = APIRouter(prefix="/ml/demand", tags=["ML – Demand Forecasting"])

router_shop = APIRouter(
    prefix="/shops/{shop_id}/demand",
    tags=["ML – Demand Forecasting (Shop/Product)"],
)

@router_generic.post("/predict-next-day", response_model=ApiResponse[DailyForecastResponse])
def predict_next_day(
    payload: DemandForecastRequest,
    current_user: User = Depends(get_current_user),
):
    result = demand_service.forecast_next_day(payload)
    return ApiResponse(message="Next day forecast generated", data=result)

@router_generic.post("/predict-next-7-days", response_model=ApiResponse[List[DailyForecastResponse]])
def predict_next_7_days(
    payload: DemandForecastRequest,
    current_user: User = Depends(get_current_user),
):
    results = demand_service.forecast_next_7_days(payload)
    return ApiResponse(message="7-day forecast generated", data=results)

@router_generic.post("/explain-next-day", response_model=ApiResponse[DailyForecastExplainResponse])
def explain_next_day(
    payload: DemandForecastRequest,
    current_user: User = Depends(get_current_user),
):
    result = demand_service.explain_next_day(payload)
    return ApiResponse(message="Next day forecast explanation generated", data=result)

@router_generic.post("/explain-next-7-days", response_model=ApiResponse[List[DailyForecastExplainResponse]])
def explain_next_7_days(
    payload: DemandForecastRequest,
    current_user: User = Depends(get_current_user),
):
    results = demand_service.explain_next_7_days(payload)
    return ApiResponse(message="7-day forecast explanations generated", data=results)

@router_generic.get("/global-importance", response_model=ApiResponse[DemandGlobalImportanceResponse])
def global_feature_importance(
    current_user: User = Depends(get_current_user),
):
    result = demand_service.get_global_feature_importance()
    return ApiResponse(message="Global feature importance fetched", data=result)

@router_generic.get("/model-info", response_model=ApiResponse[dict])
def model_metadata(
    current_user: User = Depends(get_current_user),
):
    result = demand_service.get_model_metadata()
    return ApiResponse(message="Model metadata fetched", data=result)

@router_shop.post("/products/{product_id}/predict-next-day", response_model=ApiResponse[dict])
def predict_next_day_for_product(
    shop_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: DemandForecastByProductBodyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    full_payload = DemandForecastByProductRequest(
        product_id=product_id,
        last_date=payload.last_date,
        sales_history=payload.sales_history,
        transactions_history=payload.transactions_history,
    )
    result = demand_service.forecast_next_day_for_product(db, shop_id, full_payload)
    return ApiResponse(message="Product next-day demand forecast generated", data=result)

@router_shop.get("/products/{product_id}/stock-summary", response_model=ApiResponse[DemandStockSummaryResponse])
def get_product_stock_summary(
    shop_id: uuid.UUID,
    product_id: uuid.UUID,
    last_date: str | None = Query(
        None,
        description="Optional date of the last known sales data (YYYY-MM-DD). If omitted, the backend will use the latest recorded sale date.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if last_date is None:
        last_date = demand_service.get_product_last_sales_date(db, shop_id, product_id)
    full_payload = DemandForecastByProductRequest(product_id=product_id, last_date=last_date)
    result = demand_service.get_stock_demand_summary(db, shop_id, product_id, full_payload)
    return ApiResponse(message="Stock and demand summary generated", data=result)

@router_shop.post("/products/{product_id}/predict-next-7-days", response_model=ApiResponse[List[dict]])
def predict_next_7_days_for_product(
    shop_id: uuid.UUID,
    product_id: uuid.UUID,
    payload: DemandForecastByProductBodyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    full_payload = DemandForecastByProductRequest(
        product_id=product_id,
        last_date=payload.last_date,
        sales_history=payload.sales_history,
        transactions_history=payload.transactions_history,
    )
    result = demand_service.forecast_next_7_days_for_product(db, shop_id, full_payload)
    return ApiResponse(message="Product 7-day demand forecast generated", data=result)

