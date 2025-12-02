# AIRA Medical - Roadmap to Production Readiness

## Goal

Transition the project from a demo state (in-memory data) to a robust, testable application suitable for ~2000 users, integrating SQLite and finalizing security measures.

## Estimated Time

**Total Realistic Time:** ~3-4 Hours

## Phase 1: Persistence Layer Integration (1.5 Hours)

**Objective:** Replace in-memory mock data with robust SQLite storage.

- [ ] **Modify `server-frontend.js`**:
  - Import `services/sqlite.js`.
  - Replace `mockPatients`, `mockSessions`, `mockUsers` with DB calls.
  - Ensure all API endpoints (`/api/patients`, `/api/sessions`, `/api/whatsapp/*`) read/write to DB.
- [ ] **Verify Persistence**:
  - Start server, create data, restart server, verify data exists.

## Phase 2: Cleanup & Configuration (0.5 Hours)

**Objective:** Remove ambiguity and ensure correct environment setup.

- [ ] **Consolidate Server**:
  - Archive/Remove `server-demo-funcional.js` to prevent confusion.
  - Ensure `package.json` scripts point to `server-frontend.js`.
- [ ] **Environment Setup**:
  - Create a clean `.env` template with all required keys (Encryption, JWT, Google AI).

## Phase 3: Security Validation (1 Hour)

**Objective:** Ensure the system is secure and compliant before "Go Live".

- [ ] **Run Validation**: Execute `npm run security:validate`.
- [ ] **Fix Blockers**: Address any "CRITICAL" issues reported by the script (usually missing secrets or permissions).
- [ ] **Hardening**: Verify `helmet` and rate limits are active in the main server.

## Phase 4: Integration Testing (1 Hour)

**Objective:** Verify the complete flow, including n8n integration.

- [ ] **n8n Flow Test**: Simulate a WhatsApp message to the API and verify it creates a session in SQLite.
- [ ] **Frontend Test**: Verify the dashboard loads data correctly from the DB.

## "Testable Level" Definition

At the end of this roadmap, you will have:

1.  A single, stable server command (`npm start`).
2.  Real data persistence (no data loss on restart).
3.  Working WhatsApp/n8n integration points.
4.  A passing security audit.
