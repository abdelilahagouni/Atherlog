import requests
import json
import time

url = 'http://localhost:5001/train'
data = {
    'model_type': 'huggingface',
    'model_name': 'distilbert-base-uncased',
    'dataset_name': 'custom',
    'epochs': 1,
    'batch_size': 4,
    'logs': [] # Empty logs to trigger backend DB fetch
}
headers = {'Content-Type': 'application/json'}

print("Triggering training...")
try:
    response = requests.post(url, json=data, headers=headers, timeout=300)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
