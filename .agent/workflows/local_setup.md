---
description: How to run the AetherLog application locally
---

This workflow guides you through setting up the AetherLog application locally using a hybrid approach (DB in Docker, App on host).

## Prerequisites
- Node.js & npm
- Docker Desktop (running)

## 1. Configure Environment
1. Navigate to the `backend` directory.
2. Create a file named `.env`.
3. Add the following content (adjust keys as needed):
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5435
   POSTGRES_USER=admin
   POSTGRES_PASSWORD=password123
   POSTGRES_DB=ailoganalyzer
   FRONTEND_URL="http://localhost:3000"
   JWT_SECRET="dev-secret"
   PYTHON_SERVICE_URL="http://localhost:5001"
   # Add your API keys here
   # OPENAI_API_KEY=...
   ```

## 2. Start Database
Start the PostgreSQL database using Docker.
```powershell
docker-compose up db -d
```

## 3. Start Backend
Open a new terminal for the backend.
```powershell
cd backend
npm install
npm run dev
```
*Backend will start on http://localhost:4000*

## 4. Start Python Service (AI Features)
Open a new terminal for the Python service.
```powershell
cd python-service
# Install dependencies if needed
pip install -r requirements.txt
pip install tf-keras 'accelerate>=0.26.0'
# Run the service on port 5001
python app_v2.py
```
*Python service will start on http://localhost:5001*

## 5. Start Frontend
Open a new terminal for the frontend.
```powershell
npm install
npm run dev
```
*Frontend will start on http://localhost:5173 (or similar)*

## Troubleshooting
- **Database Connection Error**: Ensure Docker is running and port 5435 is not blocked.
- **Missing Modules**: Run `npm install` in both root and `backend` directories.
