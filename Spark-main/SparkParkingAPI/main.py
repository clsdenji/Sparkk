from datetime import datetime
from typing import Optional, List, Dict, Any
from math import radians, sin, cos, asin, sqrt
import re
import math

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
import os
import json
from urllib import request as urlrequest
from urllib.parse import urlencode
from urllib.error import URLError
import logging

# FastAPI app setup
app = FastAPI(
    title="Spark Parking Recommender API",
    version="1.0.0",
    description="API for recommending parking spots",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute distance in km between two lat/lng points."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return R * c

def yn_to_int(val: Any) -> int:
    """Convert YES/NO (or similar) to 1/0."""
    if isinstance(val, str):
        s = val.strip().upper()
        if s.startswith("Y"):
            return 1
        if s.startswith("N"):
            return 0
    if isinstance(val, (int, float)):
        return int(bool(val))
    return 0

def discount_to_int(val: Any) -> int:
    """Convert PWD/SC DISCOUNT text to 1/0."""
    if isinstance(val, str):
        s = val.strip().upper()
        if "EXEMPT" in s or "DISCOUNT" in s or "YES" in s:
            return 1
    return 0

def rate_to_float(val: Any) -> float:
    """Extract a numeric INITIAL RATE; return 0.0 if missing."""
    if isinstance(val, (int, float)):
        try:
            if np.isnan(val):  # type: ignore
                return 0.0
        except Exception:
            pass
        return float(val)
    if isinstance(val, str):
        m = re.search(r"(\d+(\.\d+)?)", val.replace(",", ""))
        if m:
            return float(m.group(1))
    return 0.0

def parse_hour_from_str(s: Any) -> Optional[int]:
    """Parse hour from strings like '6:00 AM', '7:00PM'. Returns hour in 0–23, or None if unknown."""
    if not isinstance(s, str):
        return None
    s = s.strip()
    if not s or s.upper() == "N/A":
        return None
    if "24/7" in s:
        return 0  # treat 24/7 specially
    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None
        return int(dt.hour)
    except Exception:
        return None

def compute_open_now(opening: Any, closing: Any, hour: int) -> int:
    """Compute open_now (1/0) based on opening/closing times."""
    if isinstance(opening, str) and "24/7" in opening.upper():
        print(f"Parking is open 24/7. Open now: {1}")
        return 1
    if isinstance(closing, str) and "24/7" in closing.upper():
        print(f"Parking is open 24/7. Open now: {1}")
        return 1
    open_h = parse_hour_from_str(opening)
    close_h = parse_hour_from_str(closing)
    
    print(f"Parsed times: Opening - {open_h}, Closing - {close_h}")
    
    if open_h is None or close_h is None:
        print(f"Invalid hours: Opening - {opening}, Closing - {closing}. Open now: {1}")
        return 1  # Default to open if hours are not valid
    if open_h == close_h:
        print(f"Opening and closing times are the same. Open now: {1}")
        return 1
    if open_h < close_h:
        open_now = int(open_h <= hour < close_h)
        print(f"Open now: {open_now} (open_h: {open_h}, hour: {hour}, close_h: {close_h})")
        return open_now
    else:
        open_now = int(hour >= open_h or hour < close_h)
        print(f"Open now: {open_now} (open_h: {open_h}, hour: {hour}, close_h: {close_h})")
        return open_now

# Load Excel metadata
def load_parking_excel(path: str = "./PARKING.xlsx") -> List[Dict[str, Any]]:
    """Load parking data from Excel file."""
    try:
        xls = pd.ExcelFile(path)
    except Exception as e:
        print(f"❌ Error opening Excel file: {e}")
        return []
    all_rows = []
    for sheet in xls.sheet_names:
        try:
            df = pd.read_excel(xls, sheet_name=sheet)
            df.columns = [c.strip().upper() for c in df.columns]
            rename_map = {
                "PARKING NAME": "name",
                "DETAILS": "details",
                "ADDRESS": "address",
                "OPENING": "opening",
                "CLOSING": "closing",
                "LINK": "link",
                "LATITUDE": "lat",
                "LONGITUDE": "lng",
                "GUARDS": "guards_raw",
                "CCTVS": "cctvs_raw",
                "INITIAL RATE": "initial_rate_raw",
                "PWD/SC DISCOUNT": "discount_raw",
                "STREET PARKING": "street_raw",
            }
            actual_map = {k: v for k, v in rename_map.items() if k in df.columns}
            df = df.rename(columns=actual_map)
            df = df.dropna(subset=["lat", "lng"])
            df["city"] = sheet
            records = df.to_dict(orient="records")
            all_rows.extend(records)
            print(f"📄 Loaded {len(records)} rows from sheet '{sheet}'")
        except Exception as e:
            print(f"⚠ Error reading sheet '{sheet}': {e}")
    print(f"✅ Total parking rows loaded from Excel: {len(all_rows)}")
    return all_rows

## Resolve data paths relative to this module so server can be started from project root
MODULE_DIR = os.path.dirname(__file__)
EXCEL_PATH = os.path.join(MODULE_DIR, "PARKING.xlsx")
MODEL_PATH = os.path.join(MODULE_DIR, "parking_recommender_model_v6.joblib")

PARKINGS = load_parking_excel(EXCEL_PATH)

# Load ML model
try:
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)
    print(f"🤖 Model loaded. n_features_in_ = {getattr(model, 'n_features_in_', 'unknown')}")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

# Request schema
class ParkingRequest(BaseModel):
    user_lat: float
    user_lng: float
    time_of_day: int
    day_of_week: Optional[int] = None

# Endpoints
@app.get("/")
def home():
    return {"message": "Spark Parking API running!"}



@app.post("/recommend")
def recommend(req: ParkingRequest, top_k: int = 5):
    """Recommend top_k best parkings for the given user location & time."""
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded.")
    
    feature_rows = []
    parking_info = []

    # Get the current time
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for idx, p in enumerate(PARKINGS):
        try:
            lat = float(p["lat"])
            lng = float(p["lng"])
            dist_km = haversine_km(req.user_lat, req.user_lng, lat, lng)
            opening = p.get("opening", None)
            closing = p.get("closing", None)
            open_now = compute_open_now(opening, closing, req.time_of_day)

            cctvs = yn_to_int(p.get("cctvs_raw", p.get("CCTVS", "")))
            guards = yn_to_int(p.get("guards_raw", p.get("GUARDS", "")))
            initial_rate = rate_to_float(p.get("initial_rate_raw", p.get("INITIAL RATE", "")))
            pwd_discount = discount_to_int(p.get("discount_raw", p.get("PWD/SC DISCOUNT", "")))
            street_parking = yn_to_int(p.get("street_raw", p.get("STREET PARKING", "")))

            feature_rows.append([dist_km, open_now, cctvs, guards, initial_rate, pwd_discount, street_parking])
            parking_info.append({
                "name": p.get("name"),
                "lat": lat,
                "lng": lng,
                "address": p.get("address"),
                "opening": opening,
                "closing": closing,
                "initial_rate": initial_rate,
                "cctvs": cctvs,
                "guards": guards,
                "distance_km": dist_km,
                "open_now": open_now
            })
        except Exception as e:
            print(f"Error processing parking {p['name']}: {e}")
            continue

    if not feature_rows:
        raise HTTPException(status_code=500, detail="No valid feature rows to score.")
    
    X = np.array(feature_rows, dtype=float)
    try:
        scores = model.predict(X)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")

    results = [{"name": p["name"], "score": score, **p} for p, score in zip(parking_info, scores)]
    results = sorted(results, key=lambda r: r["score"], reverse=True)[:top_k]
    
    # Return the current time along with the recommendations
    response_obj = {"recommendations": results, "current_time": current_time}
    data = jsonable_encoder(response_obj)
    return sanitize_for_json(data)

def sanitize_for_json(obj):
    # Recursively sanitize containers
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]

    # Handle numpy types (scalars and arrays) if numpy is available
    try:
        import numpy as _np

        # numpy scalar numbers
        if isinstance(obj, (_np.floating, _np.integer)):
            val = obj.item()
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                return None
            return val

        # numpy arrays -> convert to lists and sanitize
        if isinstance(obj, _np.ndarray):
            return [sanitize_for_json(v) for v in obj.tolist()]
    except Exception:
        pass

    # Python float NaN/Inf
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj

    return obj
