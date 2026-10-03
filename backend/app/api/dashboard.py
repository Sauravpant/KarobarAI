import uuid
from datetime import date

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.core.clock import nepal_today
from app.models.user import User
from app.schemas.dashboard import DashboardDetail, DailyBriefResponse
from app.schemas.response import ApiResponse
import app.services.dashboard_service as dashboard_service
import app.services.daily_brief_service as daily_brief_service
router = APIRouter(prefix="/shops/{shop_id}/dashboard", tags=["Dashboard"])


@router.get("", response_model=ApiResponse[DashboardDetail])
def get_dashboard(
    shop_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = dashboard_service.get_dashboard(db, current_user, shop_id)
    return ApiResponse(
        message="Dashboard data fetched",
        data=data,
    )


@router.get("/brief", response_model=ApiResponse[DailyBriefResponse])
async def get_daily_brief(
    shop_id: uuid.UUID,
    request: Request,
    brief_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    brief_date = brief_date or nepal_today()
    audio_url = str(request.url_for("get_daily_brief_audio", shop_id=shop_id).include_query_params(brief_date=brief_date))
    data = await daily_brief_service.get_or_create_brief(db, current_user, shop_id, brief_date, audio_url)
    return ApiResponse(message="Daily brief fetched", data=data)


@router.get("/brief/audio")
async def get_daily_brief_audio(
    shop_id: uuid.UUID,
    brief_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audio = await daily_brief_service.get_brief_audio(db, current_user, shop_id, brief_date or nepal_today())
    return Response(content=audio, media_type="audio/mpeg")
