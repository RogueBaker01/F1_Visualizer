FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed by fastf1 (matplotlib, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8001"]
