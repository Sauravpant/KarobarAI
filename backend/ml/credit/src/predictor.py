
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Union

import joblib

from .config import MODEL_ARTIFACT_PATH


@lru_cache(maxsize=1)
def load_predictor(model_path: Union[str, Path] = MODEL_ARTIFACT_PATH) -> Any:

    model_path = Path(model_path)
    if not model_path.exists():
        raise FileNotFoundError(
            f"No trained model found at {model_path}. Run `python train.py` first."
        )
    return joblib.load(model_path)


def predict(**raw_features: Any) -> Dict[str, Any]:
    return load_predictor().predict(**raw_features)


def predict_probability(**raw_features: Any) -> Dict[str, Any]:
    return load_predictor().predict_probability(**raw_features)


def explain_prediction(**raw_features: Any) -> Dict[str, Any]:
    return load_predictor().explain_prediction(**raw_features)


def get_global_feature_importance() -> Dict[str, Any]:
    return load_predictor().get_global_feature_importance()


def get_model_metadata() -> Dict[str, Any]:
    return load_predictor().get_model_metadata()
