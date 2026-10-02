#!/usr/bin/env python3
"""
KarobarAI synthetic daily-demand data generator.

"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


START_DATE = "2020-07-01"
END_DATE = "2026-10-01"
BASE_YEAR = 2020


DASHAIN_DATES = [
    "2020-10-25", "2021-10-15", "2022-10-05", "2023-10-24",
    "2024-10-12", "2025-10-06", "2026-10-20",
]
TIHAR_DATES = [
    "2020-11-14", "2021-11-04", "2022-10-24", "2023-11-12",
    "2024-11-01", "2025-10-20", "2026-11-08",
]

WINDOW = (-14, 3)

TRI_START, TRI_PEAK, TRI_END = -15, -2, 4

SHOPS = {
    "S01": ("urban", 1.000),
    "S02": ("urban", 1.140),
    "S03": ("semi_urban", 0.710),
    "S04": ("semi_urban", 0.645),
    "S05": ("semi_urban", 0.785),
    "S06": ("rural", 0.430),
    "S07": ("rural", 0.360),
    "S08": ("urban", 0.930),
}


@dataclass(frozen=True)
class Category:
    base: float          # expected units, reference shop, Friday, 2020, before floor
    price: float         # unit price in 2020 (NPR)
    upt: float           # nominal units per transaction
    amp_dashain: float   # peak uplift at Dashain  (peak multiplier = 1 + amp)
    amp_tihar: float     # peak uplift at Tihar
    is_staple: int
    is_perishable: int


CATEGORIES: dict[str, Category] = {
    "Groceries":         Category(11.05, 225.0, 1.5, 0.41,  0.23,  1, 0),  # was cooking_essentials
    "Dairy & Eggs":     Category(18.40,  80.0, 1.5, 0.285, 0.62,  1, 1),  # was dairy
    "Stationery":       Category(14.70,  55.0, 1.2, 0.075, 0.105, 0, 0),  # was fresh_bakery
    "Cleaning Supplies": Category(14.70, 105.0, 2.0, 0.27,  0.16,  1, 0),  # was grains_pulses
    "Personal Care":    Category(9.25,  150.0, 1.0, 0.20,  0.09,  1, 0),  # was household_personal_care
    "Household":        Category(3.77,  110.0, 2.0, 5.65,  7.60,  0, 0),  # was puja_items
    "Snacks":           Category(22.10,  85.0, 2.0, 1.21,  0.845, 0, 0),  # was snacks_biscuits_confectionery
    "Beverages":        Category(4.43,  400.0, 1.0, 2.98,  5.00,  0, 0),  # was sweets_mithai
}

# Day-of-week multipliers (Friday = 1.0).  Saturday is Nepal's weekend.
DOW_MULT = {
    "Monday": 0.907, "Tuesday": 0.902, "Wednesday": 0.924, "Thursday": 0.932,
    "Friday": 1.000, "Saturday": 1.192, "Sunday": 0.949,
}

MONTH_END_MULT = 1.146      # is_month_end = day-of-month >= 28 or <= 3
GROWTH_PER_YEAR = 1.04      # volume growth, stepped by calendar year
PRICE_INFLATION = 1.05      # price growth, stepped by calendar year
STOCK_FLOOR = 5.0           # minimum expected units/day for any shop-category
NOISE_CV = 0.15             # multiplicative demand noise (before Poisson)
UPT_CV = 0.15               # spread of units-per-transaction



def signed_offset_to_nearest(dates: pd.DatetimeIndex, anchors: list[str]) -> np.ndarray:

    anchors_ts = pd.to_datetime(anchors)
    if dates.min() < anchors_ts.min() - pd.Timedelta(days=200) or \
       dates.max() > anchors_ts.max() + pd.Timedelta(days=170):
        raise ValueError("Date range extends beyond the festival anchors; add more anchor dates.")
    diffs = (dates.values[:, None] - anchors_ts.values[None, :]).astype("timedelta64[D]").astype(int)
    best = np.argmin(np.abs(diffs) * 2 - (diffs > 0), axis=1)   # tie-break: prefer positive
    return diffs[np.arange(len(dates)), best]


def build_calendar(start: str, end: str) -> pd.DataFrame:
    dates = pd.date_range(start, end, freq="D")
    cal = pd.DataFrame({"date": dates})
    cal["day_of_week"] = dates.day_name()
    cal["is_weekend"] = (cal["day_of_week"] == "Saturday").astype(int)
    dom = dates.day
    cal["is_month_end"] = ((dom >= 28) | (dom <= 3)).astype(int)
    cal["days_to_dashain"] = signed_offset_to_nearest(dates, DASHAIN_DATES)
    cal["days_to_tihar"] = signed_offset_to_nearest(dates, TIHAR_DATES)
    lo, hi = WINDOW
    cal["is_dashain_window"] = cal["days_to_dashain"].between(lo, hi).astype(int)
    cal["is_tihar_window"] = cal["days_to_tihar"].between(lo, hi).astype(int)
    cal["year"] = dates.year
    return cal


def festival_shape(days_to: np.ndarray) -> np.ndarray:
    """Triangular festival intensity in [0, 1]."""
    return np.interp(days_to, [TRI_START, TRI_PEAK, TRI_END], [0.0, 1.0, 0.0], left=0.0, right=0.0)


def expected_units(panel: pd.DataFrame) -> np.ndarray:
    cat = panel["category"].map(CATEGORIES)
    base = cat.map(lambda c: c.base).to_numpy()
    amp_d = cat.map(lambda c: c.amp_dashain).to_numpy()
    amp_t = cat.map(lambda c: c.amp_tihar).to_numpy()

    shop_scale = panel["shop_id"].map({k: v[1] for k, v in SHOPS.items()}).to_numpy()
    dow = panel["day_of_week"].map(DOW_MULT).to_numpy()
    month_end = np.where(panel["is_month_end"] == 1, MONTH_END_MULT, 1.0)
    growth = GROWTH_PER_YEAR ** (panel["year"].to_numpy() - BASE_YEAR)
    # Uplifts add (they only overlap in 2025, when the two windows touch).
    festival = (
        1.0
        + amp_d * festival_shape(panel["days_to_dashain"].to_numpy())
        + amp_t * festival_shape(panel["days_to_tihar"].to_numpy())
    )

    raw = base * shop_scale * dow * month_end * growth * festival
    return np.maximum(STOCK_FLOOR, raw)          # floor last: small shops stay flat off-season


def simulate_units(mu: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    noise = np.clip(rng.normal(1.0, NOISE_CV, size=mu.shape), 0.0, None)
    return rng.poisson(mu * noise)


def simulate_transactions(units: np.ndarray, categories: pd.Series, rng: np.random.Generator) -> np.ndarray:
    upt_nom = categories.map(lambda c: CATEGORIES[c].upt).to_numpy()
    upt = np.clip(rng.normal(upt_nom, UPT_CV * upt_nom), 0.2, None)
    txn = np.maximum(1, np.rint(units / upt)).astype(int)
    return np.where(units == 0, 0, txn)


def compute_revenue(units: np.ndarray, panel: pd.DataFrame) -> np.ndarray:
    price0 = panel["category"].map(lambda c: CATEGORIES[c].price).to_numpy()
    price = price0 * PRICE_INFLATION ** (panel["year"].to_numpy() - BASE_YEAR)
    return np.round(units * price, 2)


def generate(start: str = START_DATE, end: str = END_DATE, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    cal = build_calendar(start, end)

    shops = pd.DataFrame({"shop_id": list(SHOPS), "location_type": [v[0] for v in SHOPS.values()]})
    cats = pd.DataFrame({
        "category": list(CATEGORIES),
        "is_staple": [c.is_staple for c in CATEGORIES.values()],
        "is_perishable": [c.is_perishable for c in CATEGORIES.values()],
    })
    panel = shops.merge(cats, how="cross").merge(cal, how="cross")
    panel = panel.sort_values(["shop_id", "category", "date"]).reset_index(drop=True)

    mu = expected_units(panel)
    panel["units_sold"] = simulate_units(mu, rng)
    panel["num_transactions"] = simulate_transactions(panel["units_sold"].to_numpy(), panel["category"], rng)
    panel["revenue"] = compute_revenue(panel["units_sold"].to_numpy(), panel)

    columns = [
        "date", "shop_id", "location_type", "category", "is_staple", "is_perishable",
        "day_of_week", "is_weekend", "is_month_end", "days_to_dashain", "days_to_tihar",
        "is_dashain_window", "is_tihar_window", "num_transactions", "units_sold", "revenue",
    ]
    out = panel[columns].copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the KarobarAI synthetic daily-demand dataset.")
    parser.add_argument("--start", default=START_DATE)
    parser.add_argument("--end", default=END_DATE)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default="../data/raw/vyaparai_daily_demand.csv")
    args = parser.parse_args()

    df = generate(args.start, args.end, args.seed)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"wrote {len(df):,} rows -> {args.out}")


if __name__ == "__main__":
    main()