@echo off
setlocal
set "MAVEN_CMD=%~dp0maven\apache-maven-3.9.9\bin\mvn.cmd"
if not exist "%MAVEN_CMD%" (
    echo Maven binary not found at %MAVEN_CMD%
    exit /b 1
)
call "%MAVEN_CMD%" %*
