@echo off
rem Starts the backend for TESTS: TEST_MODE=true blocks every e-mail/SMS/webhook/Slack/Teams/Telegram notification.
rem Usage: START_BACKEND_TEST_MODE.bat            (keyword rule)
rem        START_BACKEND_TEST_MODE.bat cascade    (BGL cascade)
cd /d "%~dp0..\backend"
set TEST_MODE=true
if /i "%1"=="cascade" (set ANOMALY_MODEL=cascade) else (set ANOMALY_MODEL=keyword)
echo Backend in TEST_MODE, ANOMALY_MODEL=%ANOMALY_MODEL%
npm run dev
