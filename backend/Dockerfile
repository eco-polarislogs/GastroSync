# ═══════════════════════════════════════════════════════════════
# 1. Derleme: resmi Maven + Java 21 imajı (depoda Maven dağıtımı gerekmez)
# ═══════════════════════════════════════════════════════════════
FROM maven:3.9.9-eclipse-temurin-21 AS builder
WORKDIR /workspace

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
# Testler CI hattında (mvn test) çalıştırılır; imaj derlemesi yalnızca paketler
RUN mvn -B -q package -DskipTests

# ═══════════════════════════════════════════════════════════════
# 2. Çalışma: minimal JRE, yetkisiz kullanıcı, yerel saat dilimi
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache tzdata wget \
    && addgroup -S gastrosync && adduser -S gastrosync -G gastrosync

ENV TZ=Europe/Istanbul \
    SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -XX:MaxRAMPercentage=75.0 -Duser.timezone=Europe/Istanbul"

WORKDIR /app
COPY --from=builder /workspace/target/*.jar app.jar
RUN chown -R gastrosync:gastrosync /app
USER gastrosync

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"UP"' || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
