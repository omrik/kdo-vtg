# KDO Video Tagger - Test Scenarios

This document outlines all test scenarios for the application.

## Test Environment Setup

```bash
# Reset database before testing
docker exec kdo-vtg rm -f /app/config/kdo-vtg.db
docker restart kdo-vtg

# Base URL
BASE_URL=http://localhost:8080
```

## Test User Credentials

| Username | Password | Purpose |
|----------|----------|---------|
| admin | admin123 | Primary admin account |
| testuser | test123 | Test account |

---

## Authentication Tests

### AUTH-001: First Run Setup
**Precondition:** No users exist in database

**Steps:**
1. Clear database
2. Call `GET /api/auth/setup-status`
3. Call `POST /api/auth/register` with username/password

**Expected:**
- Setup status returns `needs_setup: true`
- Registration succeeds and returns valid JWT token
- First user becomes admin automatically

**Status:** ✅ Implemented

---

### AUTH-002: Login with Valid Credentials
**Precondition:** User exists

**Steps:**
1. Call `POST /api/auth/login` with valid credentials

**Expected:**
- Returns 200 OK
- Returns `access_token` and `user` object
- Token is valid JWT

**Status:** ✅ Implemented

---

### AUTH-003: Login with Invalid Credentials
**Precondition:** User exists

**Steps:**
1. Call `POST /api/auth/login` with wrong password

**Expected:**
- Returns 401 Unauthorized
- Error message: "Invalid credentials"

**Status:** ✅ Implemented

---

### AUTH-004: Token Persistence
**Precondition:** Valid login completed

**Steps:**
1. Login and save token
2. Call `GET /api/auth/me` with token
3. Refresh page (simulated)
4. Validate token still works

**Expected:**
- Token remains valid
- User data is returned

**Status:** ✅ Implemented

---

### AUTH-005: Protected Endpoints Without Token
**Precondition:** User exists

**Steps:**
1. Call `GET /api/folders` without Authorization header

**Expected:**
- Returns 401 Unauthorized

**Status:** ✅ Implemented

---

### AUTH-006: Registration Closed After Setup
**Precondition:** At least one user exists

**Steps:**
1. Call `POST /api/auth/register`

**Expected:**
- Returns 403 Forbidden
- Error message: "Registration is closed"

**Status:** ✅ Implemented

---

## Folder Navigation Tests

### FOLD-001: List Root Folders
**Precondition:** Authenticated, /media contains folders

**Steps:**
1. Call `GET /api/folders` with auth token

**Expected:**
- Returns list of folders in /media
- Each folder has `name`, `path`, `video_count`

**Status:** ✅ Implemented

---

### FOLD-002: Navigate Subfolder
**Precondition:** Authenticated, subfolder exists

**Steps:**
1. Call `GET /api/folders/{path}` with subfolder path

**Expected:**
- Returns contents of subfolder
- Videos and subfolders listed

**Status:** ✅ Implemented

---

### FOLD-003: Breadcrumb Navigation
**Precondition:** Navigated into subfolder

**Steps:**
1. Click breadcrumb links to navigate back

**Expected:**
- Can navigate to parent folders
- Breadcrumb updates correctly

**Status:** ✅ Implemented

---

## Scanning Tests

### SCAN-001: Start Scan
**Precondition:** Authenticated, folder with videos exists

**Steps:**
1. Call `POST /api/scan` with folder path
2. Poll `GET /api/scan/{id}` until complete

**Expected:**
- Scan job created with status "started"
- Progress updates in real-time
- Final status is "completed"

**Status:** ✅ Implemented

---

### SCAN-002: Duplicate Scan Prevention
**Precondition:** Folder has been scanned before

**Steps:**
1. Scan same folder again
2. Count total videos in database

**Expected:**
- No duplicate entries created
- Existing videos are updated
- Video count remains the same

**Status:** ✅ Implemented

---

### SCAN-003: Cancel Scan
**Precondition:** Scan is running

**Steps:**
1. Start scan
2. Call `POST /api/scan/{id}/cancel`
3. Check scan status

**Expected:**
- Scan status changes to "cancelled"
- Progress stops

**Status:** ⚠️ Needs verification

---

## Video & Metadata Tests

### VIDEO-001: Get All Videos
**Precondition:** Videos have been scanned

**Steps:**
1. Call `GET /api/videos`

**Expected:**
- Returns all scanned videos
- Includes metadata (resolution, duration, codec, etc.)

**Status:** ✅ Implemented

---

### VIDEO-002: Filter Videos by Folder
**Precondition:** Videos exist in multiple folders

**Steps:**
1. Call `GET /api/videos?folder_path={path}`

**Expected:**
- Only returns videos from specified folder

**Status:** ✅ Implemented

---

### VIDEO-003: Get Video Stats
**Precondition:** Videos have been scanned

**Steps:**
1. Call `GET /api/stats`

**Expected:**
- Returns total video count
- Returns resolution breakdown
- Returns camera type breakdown
- Returns total duration

**Status:** ✅ Implemented

---

## Export Tests

### EXP-001: CSV Export
**Precondition:** Videos exist

**Steps:**
1. Call `GET /api/export/csv`

**Expected:**
- Returns CSV file download
- Contains video metadata columns

**Status:** ⚠️ Needs verification

---

### EXP-002: Excel Export
**Precondition:** Videos exist

**Steps:**
1. Call `GET /api/export/excel`

**Expected:**
- Returns XLSX file download
- Contains video metadata

**Status:** ⚠️ Needs verification

---

## Collections & Projects Tests

### COL-001: Create Collection
**Precondition:** Authenticated

**Steps:**
1. Call `POST /api/collections` with name
2. Call `GET /api/collections`

**Expected:**
- Collection created successfully
- Collection appears in list

**Status:** ⚠️ Needs frontend integration

---

### PROJ-001: Create Project
**Precondition:** Authenticated

**Steps:**
1. Call `POST /api/projects` with name
2. Call `GET /api/projects`

**Expected:**
- Project created successfully
- Project appears in list

**Status:** ⚠️ Needs frontend integration

---

## UI/UX Tests

### UI-001: First Run Welcome Modal
**Precondition:** No users exist

**Steps:**
1. Open app in browser
2. Observe modal

**Expected:**
- "Welcome! Create Admin Account" modal appears
- No option to close (forced setup)
- Username and password fields visible

**Status:** ✅ Implemented

---

### UI-002: Login Modal After Setup
**Precondition:** User exists, not logged in

**Steps:**
1. Open app or logout
2. Click Login button

**Expected:**
- Login modal appears
- No Register option visible

**Status:** ✅ Implemented

---

### UI-003: Session Persistence
**Precondition:** Logged in

**Steps:**
1. Login to app
2. Refresh browser page
3. Verify still logged in

**Expected:**
- Session persists
- No need to re-login

**Status:** ✅ Implemented

---

### UI-004: Protected Content
**Precondition:** Not logged in

**Steps:**
1. Open app without logging in

**Expected:**
- Folders not visible
- Setup/login modal appears

**Status:** ✅ Implemented

---

## Security Tests

### SEC-001: SQL Injection Prevention
**Steps:**
1. Try folder path: `/media/'; DROP TABLE videos; --`

**Expected:**
- Returns 404 or sanitized response
- No database corruption

**Status:** ⚠️ Needs verification

---

### SEC-002: JWT Token Validation
**Steps:**
1. Try expired/invalid token
2. Try tampered token

**Expected:**
- Returns 401 Unauthorized

**Status:** ✅ Implemented

---

## Performance Tests

### PERF-001: Large Folder Scan
**Precondition:** Folder with 100+ videos

**Steps:**
1. Start scan on large folder
2. Monitor response time

**Expected:**
- Scan completes without timeout
- Memory usage stays reasonable

**Status:** ⚠️ Needs verification

---

## Test Execution

### Run All Tests
```bash
./test.sh --all
```

### Run Specific Category
```bash
./test.sh --auth
./test.sh --folders
./test.sh --scan
./test.sh --ui
```

### Run Single Test
```bash
./test.sh --test AUTH-001
```

---

## Known Issues

| Issue | Test | Status |
|-------|------|--------|
| bcrypt version compatibility | AUTH-001 | ✅ Fixed |
| Duplicate scan prevention | SCAN-002 | ✅ Fixed |
| Auth token in requests | UI-004 | ✅ Fixed |

---

## Test Coverage

| Category | Tests | Passed |
|----------|-------|--------|
| Authentication | 6 | 6 |
| Folder Navigation | 3 | 3 |
| Scanning | 3 | 2 |
| Videos | 3 | 3 |
| Export | 2 | 0 |
| Collections/Projects | 2 | 0 |
| UI/UX | 4 | 4 |
| Security | 2 | 1 |
| Performance | 1 | 0 |

**Total:** 26 test scenarios | **Coverage:** ~60%
