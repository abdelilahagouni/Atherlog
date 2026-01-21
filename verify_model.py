import requests
import json

url = 'http://localhost:5001/predict_hf'
data = {'text': 'CRITICAL: Database connection failed due to memory leak in auth-service'}
headers = {'Content-Type': 'application/json'}

try:
    response = requests.post(url, json=data, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
