# Use the official slim Python image from Docker Hub
FROM python:3.11-slim

# Prevent .pyc files from being written to disk and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set default port (can be overridden by Render)
ENV PORT=8000

# Set working directory
WORKDIR /app

# Copy only requirements.txt initially to leverage Docker caching
COPY SparkParkingAPI/requirements.txt /app/requirements.txt

# Install build dependencies, upgrade pip, and install Python dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential gcc ca-certificates \
  && python -m pip install --upgrade pip setuptools wheel \
  && pip install --no-cache-dir -r /app/requirements.txt \
  && apt-get remove -y build-essential gcc \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* /root/.cache/pip

# Copy the entire application code into the container
COPY SparkParkingAPI/ /app/

# Expose the correct port (Render will override this with the dynamic $PORT)
EXPOSE 8000

# Start the FastAPI app using uvicorn with the dynamic $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
