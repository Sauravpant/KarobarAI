from datetime import date, datetime, timedelta, timezone

# Nepal has no DST, so a fixed offset is exact.
NEPAL_TZ = timezone(timedelta(hours=5, minutes=45))


def nepal_today() -> date:
    """Shop calendar day. Never use date.today() or UTC dates for "today"."""
    return datetime.now(NEPAL_TZ).date()
