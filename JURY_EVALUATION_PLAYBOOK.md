# 🎓 GastroSync ERP — Jury Evaluation & Live Testing Playbook
**Enterprise Restaurant Management ERP (React Native + React Web + Java 21 / Spring Boot 3.3.4 + PostgreSQL 16)**  
*Document Version: 1.0.0 — Final Graduation Defense (Bitirme Projesi) & Commercial Hand-Off*

---

## ⚡ 1. The One-Command Live Deployment Protocol

GastroSync is fully containerized with zero manual configuration. The evaluation committee can boot the entire multi-tier enterprise stack (PostgreSQL, Spring Boot Backend, and Nginx/React Web) using a single command:

```bash
# Clone/Open the repository root and run:
docker-compose up -d --build
```

### 🚢 Orchestrated Services Architecture:
| Container Name | Service | Internal Port | Host Port | Technology | Healthcheck Mechanism |
|---|---|---|---|---|---|
| `gastrosync-db` | Database | `5432` | `5432` | PostgreSQL 16 Alpine | `pg_isready -U postgres -d gastrosync` |
| `gastrosync-backend` | REST API & Security | `8080` | `8080` | Java 21 / Eclipse Temurin Alpine | `wget http://localhost:8080/v3/api-docs` |
| `gastrosync-frontend`| Web Dashboard | `80` | `80` | React 18 / Vite / Nginx Alpine | Nginx HTTP Reverse Proxy |

---

## 🩺 2. Post-Boot Health Verification Protocol

Once booted, verify that all three containers are healthy and communicating:

### A. Container Status Check
```bash
docker ps
```
*Expected status: All 3 containers should display `(healthy)` or `Up`.*

### B. Spring Boot Database Connection & Auto-Healing Logs
```bash
docker logs gastrosync-backend
```
*Look for the startup sequence in the console:*
```text
🛡️ [GastroSync DB Health] Checking and auto-healing database schema...
✅ [GastroSync DB Health] Database schema verified and auto-healed successfully.
✅ Mock Users seeded successfully with BCrypt password hashes.
✅ Mock Inventory items seeded successfully.
✅ Mock Recipes seeded successfully.
✅ Mock Sales seeded successfully.
Started GastroSyncApplication in 3.4 seconds (process running for 3.9)
```

---

## 📖 3. Interactive Swagger UI & OpenAPI Specification

The jury can inspect all REST endpoints, DTO schema contracts, and test JWT authentication live via Swagger:

- **Primary Swagger UI**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **Nginx Reverse-Proxied Swagger UI**: [http://localhost/swagger-ui/index.html](http://localhost/swagger-ui/index.html)
- **OpenAPI JSON Contract**: [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

### How to Test Live API Calls in Swagger:
1. Navigate to `POST /api/auth/login`.
2. Click **Try it out**, enter username `admin` and password `123456`.
3. Copy the returned `token` from the response body.
4. Click the green **Authorize 🔓** button at the top of Swagger UI.
5. Enter: `Bearer <your_token>` and click **Authorize**.
6. All protected endpoints (User management, Accounting approvals, Inventory CRUD) can now be executed directly from the browser!

---

## 👥 4. Multi-Role Test Accounts & Access Control Matrix

GastroSync enforces strict Role-Based Access Control (RBAC) via Spring Security 6 `@PreAuthorize`. The committee can log in with any of the pre-seeded accounts at [http://localhost](http://localhost):

| Role | Username | Password | Full Name / Description | Authorized Domains & Permissions |
|---|---|---|---|---|
| **System Administrator** | `admin` | `123456` | Ahmet Yılmaz (Genel Yönetici) | **Full Access**: User creation/deletion, system settings, all modules |
| **Restaurant Manager** | `manager` | `123456` | Zeynep Kaya (Restoran Müdürü) | Operational oversight, expense approvals (`APPROVED`), staff coordination |
| **Head Chef** | `chef` | `123456` | Mehmet Şef (Mutfak Şefi) | Recipe management, kitchen chat, waste logging, stock inspection |
| **Warehouse Supervisor** | `warehouse` | `123456` | Ali Depocu (Depo Sorumlusu) | Goods receipt (INBOUND), stock adjustments, supplier management |
| **Accountant / Cashier** | `accountant` | `123456` | Canan Kasa (Kasa & Ön Muhasebe) | Expense creation (`PENDING_APPROVAL`), bill payments, sales viewing |
| **Financial Advisor (SMMM)**| `advisor` | `123456` | Selahattin Müşavir (Mali Müşavir)| Official ledger finalization (`FINALIZED`), tax audits, VUK compliance |
| **Cashier Alternative** | `muhasebe` | `muhasebe123` | Canan Öztürk | Front-office cashiering and expense submission |
| **Advisor Alternative** | `malimusavir` | `musavir123` | SMMM Selim Aydın | Official CPA accounting and ledger governance |

---

## 🧪 5. Step-by-Step Live Testing Scenarios for the Jury

### Scenario 1: Authoritative Recipe-to-Stock COGS Deduction
1. Log in as `chef` or `admin`.
2. Inspect **Inventory** ([http://localhost/#/inventory](http://localhost/#/inventory)). Note the current stock of `Dana Antrikot` (e.g., `12.5 kg`).
3. Place a POS sale for 2 portions of **"Izgara Antrikot"** via POS or API (`POST /api/sales`).
4. Re-inspect `Dana Antrikot`:
   - Stock automatically reduces by `0.50 kg` (250g per portion x 2) to `12.0 kg`.
   - A `StockTransaction` of type `OUTBOUND_SALE` is automatically registered with the operator's name and order number.

### Scenario 2: Multi-Tier Financial Governance State Machine
1. Log in as `accountant` or `chef`. Create an expense request for `"Mutfak Ekstra Sarf Malzeme"` (`₺1,500`).
   - Status is created as `PENDING_APPROVAL`.
2. Attempt to finalize as `chef` -> **403 Forbidden** (Blocked by `@PreAuthorize`).
3. Log in as `manager` -> Click **Approve** (`PUT /api/expenses/{id}/approve`).
   - Status moves to `APPROVED`. `paidByCashier = true`.
4. Log in as `advisor` (SMMM) -> Click **Finalize in Ledger** (`PUT /api/expenses/{id}/finalize`).
   - Status moves to `FINALIZED`. `recordedInLedger = true`. Tamper-proof audit completed.

### Scenario 3: Soft-Delete & Auditing Trail Proof
1. Delete any inventory item or expense as `admin`.
2. Notice the item immediately disappears from the UI without page refresh (TanStack Query cache invalidation).
3. Connect to PostgreSQL (`psql -U postgres -d gastrosync`):
   ```sql
   SELECT id, title, is_deleted, deleted_at, deleted_by, created_by FROM expenses;
   ```
4. The record **still exists physically** with `is_deleted = true`, preserving historical tax compliance (VUK / TTK), while Hibernate's `@SQLRestriction("is_deleted = false")` cleanly filters it out from application queries.

---

## 🏆 6. Top 5 Technical Talking Points for the Defense

| # | Technical Pillar | Implementation Details & Architectural Defense |
|---|---|---|
| **1** | **Compile-Time MapStruct Performance** | GastroSync utilizes **MapStruct 1.5.5** with `lombok-mapstruct-binding` for zero-reflection, compile-time DTO projection. Entities are never exposed over HTTP, completely preventing password hash leakage while outperforming ModelMapper by up to 10x. |
| **2** | **Enterprise Spring Security 6 & JWT RFC 6750** | Fully stateless authentication using standard Bearer tokens signed with HMAC-SHA256 (384-bit secret) and BCrypt 10-round password hashing. All controller mutations are guarded with granular `@PreAuthorize` role expressions preventing IDOR and BOLA vulnerabilities. |
| **3** | **JPA Auditing & Transparent Soft-Deletes** | Configured `BaseAuditableEntity` with Spring's `AuditingEntityListener`. Our custom `SecurityAuditorAware` dynamically extracts the authenticated user from the JWT SecurityContext, while Hibernate 6 `@SQLDelete` and `@SQLRestriction` ensure zero regulatory data loss. |
| **4** | **TanStack Query SWR & Mobile Parity** | Both React Web and React Native Mobile share symmetrical TanStack Query v5 cache keys (`['inventory']`, `['expenses']`, `['sales']`). Mobile uses dynamic host resolution with `authFetch`, eliminating offline mock data fallbacks and synchronizing live PostgreSQL mutations in real time. |
| **5** | **Multi-Language i18n & Dynamic RTL Layout** | Full 4-language localized architecture (🇹🇷 Turkish, 🇬🇧 English, 🇩🇪 German, 🇸🇦 Arabic). Backend resolves messages dynamically via `AcceptHeaderLocaleResolver` and `MessageSource`, while the web frontend dynamically flips page orientation (`dir="rtl"`) for Arabic. |

---

## 🛑 7. Teardown
To cleanly stop and preserve all container data:
```bash
docker-compose down
```
To wipe all containers and start completely fresh:
```bash
docker-compose down -v
```
