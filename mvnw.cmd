@echo off
setlocal
set "MAVEN_CMD=%~dp0backend\maven\apache-maven-3.9.9\bin\mvn.cmd"
if not exist "%MAVEN_CMD%" (
    echo Maven binary not found at %MAVEN_CMD%
    exit /b 1
)
call "%MAVEN_CMD%" -f "%~dp0backend\pom.xml" %*
