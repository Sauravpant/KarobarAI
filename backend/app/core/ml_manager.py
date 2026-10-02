from __future__ import annotations

import logging
import sys
from pathlib import Path

import joblib

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

CREDIT_RISK_MODEL_PATH = _BACKEND_ROOT / "ml" / "credit_risk" / "models" / "credit_risk_pipeline.joblib"
DEMAND_MODEL_PATH = _BACKEND_ROOT / "ml" / "demand" / "models" / "forecasting_pipeline.joblib"

_credit_risk_predictor = None
_demand_forecaster = None

def load_credit_risk_model():
    global _credit_risk_predictor
    if _credit_risk_predictor is None:
        if not CREDIT_RISK_MODEL_PATH.exists():
            logger.error(
                "Credit risk model not found at %s. "
                "Run `python train.py` in ml/credit_risk/ first.",
                CREDIT_RISK_MODEL_PATH,
            )
            return None
        logger.info("Loading credit risk model from %s ...", CREDIT_RISK_MODEL_PATH)
        orig_sys_path = list(sys.path)
        try:
            credit_risk_dir = str(CREDIT_RISK_MODEL_PATH.parent.parent)
            sys.path = [credit_risk_dir] + [p for p in sys.path if p != credit_risk_dir]
            if 'src' in sys.modules:
                del sys.modules['src']
            for key in list(sys.modules.keys()):
                if key.startswith('src.'):
                    del sys.modules[key]
            _credit_risk_predictor = joblib.load(CREDIT_RISK_MODEL_PATH)
            logger.info("Credit risk model loaded: %r", _credit_risk_predictor)
        finally:
            sys.path = orig_sys_path
    return _credit_risk_predictor

def load_demand_model():
    global _demand_forecaster
    if _demand_forecaster is None:
        if not DEMAND_MODEL_PATH.exists():
            logger.error(
                "Demand model not found at %s. "
                "Run `python train.py` in ml/demand/ first.",
                DEMAND_MODEL_PATH,
            )
            return None
        logger.info("Loading demand forecasting model from %s ...", DEMAND_MODEL_PATH)
        orig_sys_path = list(sys.path)
        try:
            demand_dir = str(DEMAND_MODEL_PATH.parent.parent)
            sys.path = [demand_dir] + [p for p in sys.path if p != demand_dir]
            if 'src' in sys.modules:
                del sys.modules['src']
            for key in list(sys.modules.keys()):
                if key.startswith('src.'):
                    del sys.modules[key]
            _demand_forecaster = joblib.load(DEMAND_MODEL_PATH)
            logger.info("Demand forecasting model loaded: %s", type(_demand_forecaster).__name__)
        finally:
            sys.path = orig_sys_path
    return _demand_forecaster

def get_credit_risk_predictor():
    return _credit_risk_predictor

def get_demand_forecaster():
    return _demand_forecaster

