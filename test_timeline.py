import requests
import json
from datetime import datetime, timedelta

url = "http://localhost:5000/timeline"
logs = [
    {"timestamp": (datetime.now() - timedelta(minutes=i*10)).isoformat(), "message": f"Log {i}", "level": "INFO", "source": "test"}
    for i in range(50)
]

try:
    response = requests.post(url, json={"logs": logs})
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
