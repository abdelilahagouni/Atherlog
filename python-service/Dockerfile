FROM python:3.9-slim

WORKDIR /app

# Install system dependencies if needed (e.g., for some TF ops or numpy)
# RUN apt-get update && apt-get install -y --no-install-recommends build-essential

# Upgrade pip to avoid some download issues
RUN pip install --upgrade pip

COPY requirements.txt .
# Increase timeout to handle large downloads like TensorFlow
RUN pip install --no-cache-dir -r requirements.txt --default-timeout=1000

COPY . .

# Render sets the PORT environment variable
ENV PORT=5000

# Use Gunicorn with a timeout to allow for slow TF startup
# Bind to 0.0.0.0:$PORT
# Reduced workers and threads to stay within 512MB RAM on Render Free Tier
CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 120 app:app
