@echo off
rem Sets platform roles in the cluster's auth DB, using the auth pod's own MONGO_URI.
rem   scripts\promote-admin.bat                      (admin@example.com -> admin, trainer@example.com -> trainer)
rem   scripts\promote-admin.bat someone@x.com admin
for /f %%p in ('kubectl get pod -l app^=auth -o jsonpath^={.items[0].metadata.name}') do set POD=%%p
if "%~1"=="" (
  call :set admin@example.com admin
  call :set trainer@example.com trainer
) else (
  call :set %1 %2
)
exit /b

:set
kubectl exec -i %POD% -- env EMAIL=%1 ROLE=%2 node < "%~dp0promote-admin.js"
exit /b
