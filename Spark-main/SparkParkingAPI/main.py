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
                "address": p.get("address"),
                "initial_rate": initial_rate,
                "cctvs": cctvs,
                "guards": guards,
                "distance_km": dist_km,
                "open_now": open_now,  # Store open_now in the parking info
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

    results = [
        {
            "name": p["name"],
            "score": score,
            "lat": p["lat"],
            "lng": p["lng"],
            "address": p["address"],
            "initial_rate": p["initial_rate"],
            "cctvs": p["cctvs"],
            "guards": p["guards"],
            "distance_km": p["distance_km"],
            "open_now": p["open_now"]  # Access open_now from parking_info
        }
        for p, score in zip(parking_info, scores)
    ]

    # Sort and return top_k
    results = sorted(results, key=lambda r: r["score"], reverse=True)[:top_k]

    print(f"Returning recommendations: {results}")  # Log the results
    return {"recommendations": results}
