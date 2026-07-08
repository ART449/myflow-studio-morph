@echo off
setlocal
set PYTHONPATH=C:\BYFLOW\beat-ia-service
start "MyFlow Beat IA" /B /MIN "C:\BYFLOW\beat-ia-service\venv\Scripts\python.exe" "C:\BYFLOW\beat-ia-service\main.py" > "C:\Users\javie\AppData\Local\Temp\opencode\beatia_stdout.log" 2>"C:\Users\javie\AppData\Local\Temp\opencode\beatia_stderr.log"
endlocal
