from typing import Optional, List, Dict, Any
from math import radians, sin, cos, asin, sqrt
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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


# =========================
# FastAPI app setup
# =========================

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


# =========================
# Helper functions
# =========================

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
    """
    Very simple parsing of hour from strings like '6:00 AM', '7:00PM'.
    Returns hour in 0–23, or None if unknown.
    """
    if not isinstance(s, str):
        return None
    s = s.strip()
    if not s or s.upper() == "N/A":
        return None
    if "24/7" in s:
        return 0  # we'll treat 24/7 specially elsewhere

    # use pandas to parse time
    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None
        return int(dt.hour)
    except Exception:
        return None


def compute_open_now(opening: Any, closing: Any, hour: int) -> int:
    """
    Compute open_now (1/0) based on opening/closing strings and current hour.
    '24/7' => always open.
    If parsing fails => assume open (1) so we don't block everything.
    """
    if isinstance(opening, str) and "24/7" in opening.upper():
        return 1
    if isinstance(closing, str) and "24/7" in closing.upper():
        return 1

    open_h = parse_hour_from_str(opening)
    close_h = parse_hour_from_str(closing)

    if open_h is None or close_h is None:
        # can't parse -> assume open
        return 1

    if open_h == close_h:
        # weird schedule -> treat as always open
        return 1

    if open_h < close_h:
        # normal: e.g. 7–22
        return int(open_h <= hour < close_h)
    else:
        # overnight: e.g. 20–4
        return int(hour >= open_h or hour < close_h)


# =========================
# Load Excel metadata
# =========================

def load_parking_excel(path: str = "../PARKING.xlsx") -> List[Dict[str, Any]]:
    """
    Load all sheets from PARKING.xlsx and normalize columns
    to a consistent structure.
    """
    try:
        xls = pd.ExcelFile(path)
    except Exception as e:
        print("❌ Error opening Excel file:", e)
        return []

    all_rows: List[Dict[str, Any]] = []

    for sheet in xls.sheet_names:
        try:
            df = pd.read_excel(xls, sheet_name=sheet)

            # normalize column names: strip + uppercase
            df.columns = [c.strip().upper() for c in df.columns]

            # mapping from Excel columns -> internal names
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

            # only rename columns that exist
            actual_map = {k: v for k, v in rename_map.items() if k in df.columns}
            df = df.rename(columns=actual_map)

            # drop rows without coordinates
            if "lat" not in df.columns or "lng" not in df.columns:
                print(f"⚠ Sheet '{sheet}' has no LATITUDE/LONGITUDE columns, skipping.")
                continue

            df = df.dropna(subset=["lat", "lng"])

            # Add sheet name as city/area
            df["city"] = sheet

            # Convert to list[dict]
            records = df.to_dict(orient="records")
            all_rows.extend(records)

            print(f"📄 Loaded {len(records)} rows from sheet '{sheet}'")

        except Exception as e:
            print(f"⚠ Error reading sheet '{sheet}':", e)

    print(f"✅ Total parking rows loaded from Excel: {len(all_rows)}")
    return all_rows


PARKINGS: List[Dict[str, Any]] = load_parking_excel("../PARKING.xlsx")


# =========================
# Load ML model
# =========================

try:
    model = joblib.load("parking_recommender_model_v6.joblib")
    print(f"🤖 Model loaded. n_features_in_ = {getattr(model, 'n_features_in_', 'unknown')}")
except Exception as e:
    print("❌ Error loading model:", e)
    model = None


# =========================
# Request schema
# =========================

class ParkingRequest(BaseModel):
    user_lat: float
    user_lng: float
    time_of_day: int          # 0–23 (use new Date().getHours() in JS)
    day_of_week: Optional[int] = None  # not used yet


# =========================
# Routing models
# =========================

class LatLon(BaseModel):
    lat: float
    lon: float

class EtaRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    mode: str  # 'car' | 'walk' | 'motor' | 'commute'
    departAt: Optional[str] = None

class RouteRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    mode: str
    stops: Optional[List[LatLon]] = None

class OptimizeRequest(BaseModel):
    origin: LatLon
    destination: LatLon
    stops: List[LatLon]
    mode: str


# =========================
# Endpoints
# =========================

@app.get("/")
def home():
    return {"message": "Spark Parking API running!"}


@app.get("/meta-debug")
def meta_debug():
    """Peek at the first few parking records."""
    return {
        "count": len(PARKINGS),
        "sample": PARKINGS[:3],
    }


@app.post("/recommend")
def recommend(req: ParkingRequest, top_k: int = 5):
    """
    Recommend top_k best parkings for the given user location & time.
    Features (in order) match training:

      [distance_km, open_now, cctvs, guards,
       initial_rate, pwd_discount, street_parking]
    """
    print(f"Received request: {req}")  # Log the incoming request data

    if model is None:
        print("Model not loaded.")
        raise HTTPException(status_code=500, detail="Model not loaded.")
    
    feature_rows = []
    parking_info = []

    for idx, p in enumerate(PARKINGS):
        try:
            lat = float(p["lat"])
            lng = float(p["lng"])
            dist_km = haversine_km(req.user_lat, req.user_lng, lat, lng)
            
            # Ensure all features are processed correctly
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
                "address": p.get("address")
            })
        except Exception as e:
            print(f"Error processing parking {p['name']}: {e}")  # Log errors while processing parking data
            continue  # Continue processing other parkings

    if not feature_rows:
        print("No valid feature rows found.")
        raise HTTPException(status_code=500, detail="No valid feature rows to score.")
    
    X = np.array(feature_rows, dtype=float)

    try:
        print("Making predictions...")  # Log before making predictions
        scores = model.predict(X)
        print(f"Predictions: {scores}")  # Log the predictions
    except Exception as e:
        print(f"Model prediction failed: {str(e)}")  # Log any prediction failures
        raise HTTPException(status_code=500, detail=f"Model prediction failed: {str(e)}")

    results = [{"name": p["name"], "score": score} for p, score in zip(parking_info, scores)]
    results = sorted(results, key=lambda r: r["score"], reverse=True)[:top_k]

    print(f"Returning recommendations: {results}")  # Log the results
    return {"recommendations": results}
