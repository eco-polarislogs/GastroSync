$cp = (Get-Content -Path "C:\Users\solma\AppData\Local\Temp\spring-boot-12916711626821153824.argfile" -Raw).Trim().Trim('"')
$javaFiles = Get-ChildItem -Path "backend\src\main\java" -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
& "C:\Program Files\Java\jdk-26.0.1\bin\javac.exe" --release 21 -encoding UTF-8 -cp $cp -d "backend\target\classes" $javaFiles
if ($LASTEXITCODE -eq 0) {
    Write-Host "COMPILED_RELEASE_21_SUCCESS"
} else {
    Write-Host "FAILED_WITH_CODE $LASTEXITCODE"
}
