# ═══════════════════════════════════════════════════════════════
# STAGE 1: Build Stage using Java 21 & Maven
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace

# Copy maven wrapper & pom.xml first for layer caching
COPY pom.xml .
COPY maven ./maven
COPY src ./src

# Build production jar skipping tests
RUN chmod +x ./maven/apache-maven-3.9.9/bin/mvn && ./maven/apache-maven-3.9.9/bin/mvn clean package -DskipTests


# ═══════════════════════════════════════════════════════════════
# STAGE 2: Minimal Production JRE Runtime
# ═══════════════════════════════════════════════════════════════
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create unprivileged application user for container security
RUN addgroup -S gastrosync && adduser -S gastrosync -G gastrosync

# Copy compiled artifact from builder stage
COPY --from=builder /workspace/target/*.jar app.jar
RUN chown -R gastrosync:gastrosync /app

USER gastrosync

EXPOSE 8080

# Production JVM flags for memory efficiency in containers
ENV JAVA_OPTS="-XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
