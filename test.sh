#!/bin/bash

# KDO Video Tagger - Automated Test Suite
# Usage: ./test.sh [--all|--auth|--folders|--scan|--ui|--test TEST_ID]

# Don't exit on error - we handle failures manually
# set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
CONTAINER_NAME="${CONTAINER_NAME:-interesting_panini}"
TEST_USER="admin"
TEST_PASS="admin123"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED++))
}

log_section() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

# API Helpers
api_get() {
    local path="$1"
    local token="${2:-}"
    if [ -n "$token" ]; then
        curl -s -X GET "$BASE_URL$path" -H "Authorization: Bearer $token"
    else
        curl -s -X GET "$BASE_URL$path"
    fi
}

api_post() {
    local path="$1"
    local data="$2"
    local token="${3:-}"
    if [ -n "$token" ]; then
        curl -s -X POST "$BASE_URL$path" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "$data"
    else
        curl -s -X POST "$BASE_URL$path" -H "Content-Type: application/json" -d "$data"
    fi
}

# Setup
setup() {
    log_section "SETUP"
    
    # Reset database
    log_info "Resetting database..."
    docker exec "$CONTAINER_NAME" rm -f /app/config/kdo-vtg.db 2>/dev/null || true
    docker restart "$CONTAINER_NAME" >/dev/null
    sleep 3
    
    # Wait for app to be ready
    for i in {1..10}; do
        if curl -s "$BASE_URL/api/health" | grep -q "healthy"; then
            log_info "App is ready"
            return 0
        fi
        sleep 1
    done
    
    log_fail "App failed to start"
    exit 1
}

# Get token
get_token() {
    api_post "/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" | jq -r '.access_token // empty'
}

# AUTH Tests
test_auth() {
    log_section "AUTHENTICATION TESTS"
    
    # AUTH-001: First Run Setup
    log_info "Testing AUTH-001: First Run Setup..."
    docker exec "$CONTAINER_NAME" rm -f /app/config/kdo-vtg.db 2>/dev/null || true
    docker restart "$CONTAINER_NAME" >/dev/null
    sleep 3
    
    local setup_status=$(api_get "/api/auth/setup-status")
    if echo "$setup_status" | jq -e '.needs_setup == true' >/dev/null 2>&1; then
        log_pass "AUTH-001: Setup status returns needs_setup=true"
    else
        log_fail "AUTH-001: Setup status failed"
    fi
    
    local register_result=$(api_post "/api/auth/register" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    if echo "$register_result" | jq -e '.access_token' >/dev/null 2>&1; then
        log_pass "AUTH-001: Registration succeeds"
        local NEW_TOKEN=$(echo "$register_result" | jq -r '.access_token')
        
        # Verify first user is admin
        if echo "$register_result" | jq -e '.user.is_admin == true' >/dev/null 2>&1; then
            log_pass "AUTH-001: First user is admin"
        else
            log_fail "AUTH-001: First user not admin"
        fi
    else
        log_fail "AUTH-001: Registration failed - $(echo "$register_result" | jq -r '.detail')"
    fi
    
    # AUTH-002: Login with Valid Credentials
    log_info "Testing AUTH-002: Login with valid credentials..."
    local login_result=$(api_post "/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    if echo "$login_result" | jq -e '.access_token' >/dev/null 2>&1; then
        log_pass "AUTH-002: Valid login succeeds"
    else
        log_fail "AUTH-002: Valid login failed"
    fi
    
    # AUTH-003: Login with Invalid Credentials
    log_info "Testing AUTH-003: Login with invalid credentials..."
    local invalid_login=$(api_post "/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"wrongpass\"}")
    if echo "$invalid_login" | jq -e '.detail == "Invalid credentials"' >/dev/null 2>&1; then
        log_pass "AUTH-003: Invalid login returns correct error"
    else
        log_fail "AUTH-003: Invalid login error incorrect"
    fi
    
    # AUTH-004: Token Persistence
    log_info "Testing AUTH-004: Token persistence..."
    local TOKEN=$(echo "$login_result" | jq -r '.access_token')
    local me_result=$(api_get "/api/auth/me" "$TOKEN")
    if echo "$me_result" | jq -e '.username == "admin"' >/dev/null 2>&1; then
        log_pass "AUTH-004: Token validation works"
    else
        log_fail "AUTH-004: Token validation failed"
    fi
    
    # AUTH-005: Protected Endpoints Without Token
    log_info "Testing AUTH-005: Protected endpoints without token..."
    local unprotected=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/folders")
    if [ "$unprotected" = "401" ]; then
        log_pass "AUTH-005: Folders endpoint protected"
    else
        log_fail "AUTH-005: Folders endpoint not protected (got $unprotected)"
    fi
    
    # AUTH-006: Registration Closed After Setup
    log_info "Testing AUTH-006: Registration closed after setup..."
    local closed_register=$(api_post "/api/auth/register" "{\"username\":\"newuser\",\"password\":\"pass123\"}")
    if echo "$closed_register" | jq -e '.detail == "Registration is closed. Please login."' >/dev/null 2>&1; then
        log_pass "AUTH-006: Registration properly closed"
    else
        log_fail "AUTH-006: Registration not closed properly"
    fi
    
    # Store token for other tests
    echo "$TOKEN" > /tmp/kdo-test-token.txt
}

# Folder Tests
test_folders() {
    log_section "FOLDER NAVIGATION TESTS"
    local TOKEN=$(cat /tmp/kdo-test-token.txt 2>/dev/null || echo "")
    
    # FOLD-001: List Root Folders
    log_info "Testing FOLD-001: List root folders..."
    local folders=$(api_get "/api/folders" "$TOKEN")
    if echo "$folders" | jq -e '.folders | length > 0' >/dev/null 2>&1; then
        log_pass "FOLD-001: Root folders listed"
    else
        log_fail "FOLD-001: No folders found"
    fi
    
    # FOLD-002: Navigate Subfolder
    log_info "Testing FOLD-002: Navigate subfolder..."
    local scan_path=$(echo "$folders" | jq -r '.folders[] | select(.name == "Scan") | .path')
    if [ -n "$scan_path" ] && [ "$scan_path" != "null" ]; then
        # Encode the path for URL
        local encoded_path=$(echo "$scan_path" | sed 's/\//%2F/g')
        local contents=$(curl -s "$BASE_URL/api/folders/$encoded_path" -H "Authorization: Bearer $TOKEN")
        if echo "$contents" | jq -e '.contents | length > 0' >/dev/null 2>&1; then
            log_pass "FOLD-002: Subfolder contents retrieved"
        else
            log_fail "FOLD-002: Subfolder empty or error"
        fi
    else
        log_skip "FOLD-002: Scan folder not found"
    fi
}

# Scan Tests
test_scan() {
    log_section "SCANNING TESTS"
    local TOKEN=$(cat /tmp/kdo-test-token.txt 2>/dev/null || echo "")
    
    # SCAN-001: Start Scan
    log_info "Testing SCAN-001: Start scan..."
    local scan_result=$(api_post "/api/scan" "{\"folder_path\":\"/media/Scan\",\"yolo_enabled\":false}" "$TOKEN")
    local scan_id=$(echo "$scan_result" | jq -r '.scan_id // empty')
    
    if [ -n "$scan_id" ] && [ "$scan_id" != "null" ]; then
        log_pass "SCAN-001: Scan started (ID: $scan_id)"
        
        # Wait for completion
        sleep 2
        
        # Check status
        local status=$(api_get "/api/scan/$scan_id" "$TOKEN")
        local scan_status=$(echo "$status" | jq -r '.status')
        local processed=$(echo "$status" | jq -r '.processed_files')
        
        if [ "$scan_status" = "completed" ]; then
            log_pass "SCAN-001: Scan completed ($processed files)"
        else
            log_fail "SCAN-001: Scan status: $scan_status"
        fi
    else
        log_fail "SCAN-001: Scan failed to start"
    fi
    
    # SCAN-002: Duplicate Scan Prevention
    log_info "Testing SCAN-002: Duplicate scan prevention..."
    
    # Get current video count
    local count_before=$(api_get "/api/stats" "$TOKEN" | jq -r '.total_videos')
    
    # Scan again
    local scan2=$(api_post "/api/scan" "{\"folder_path\":\"/media/Scan\",\"yolo_enabled\":false}" "$TOKEN")
    sleep 2
    
    # Get new count
    local count_after=$(api_get "/api/stats" "$TOKEN" | jq -r '.total_videos')
    
    if [ "$count_before" = "$count_after" ]; then
        log_pass "SCAN-002: No duplicates (still $count_before videos)"
    else
        log_fail "SCAN-002: Duplicates created ($count_before -> $count_after)"
    fi
}

# Video Tests
test_videos() {
    log_section "VIDEO TESTS"
    local TOKEN=$(cat /tmp/kdo-test-token.txt 2>/dev/null || echo "")
    
    # VIDEO-001: Get All Videos
    log_info "Testing VIDEO-001: Get all videos..."
    local videos=$(api_get "/api/videos" "$TOKEN")
    local video_count=$(echo "$videos" | jq -r '.videos | length')
    if [ "$video_count" -gt 0 ]; then
        log_pass "VIDEO-001: Got $video_count videos"
    else
        log_fail "VIDEO-001: No videos returned"
    fi
    
    # VIDEO-003: Get Stats
    log_info "Testing VIDEO-003: Get stats..."
    local stats=$(api_get "/api/stats" "$TOKEN")
    if echo "$stats" | jq -e '.total_videos > 0' >/dev/null 2>&1; then
        local total=$(echo "$stats" | jq -r '.total_videos')
        log_pass "VIDEO-003: Stats returned (total: $total)"
    else
        log_fail "VIDEO-003: Stats not working"
    fi
}

# UI Tests (simulated)
test_ui() {
    log_section "UI TESTS (Simulated)"
    
    # UI-001: First Run Welcome Modal
    log_info "Testing UI-001: First run welcome modal..."
    docker exec "$CONTAINER_NAME" rm -f /app/config/kdo-vtg.db 2>/dev/null || true
    docker restart "$CONTAINER_NAME" >/dev/null
    sleep 3
    
    local setup=$(api_get "/api/auth/setup-status")
    if echo "$setup" | jq -e '.needs_setup == true' >/dev/null 2>&1; then
        log_pass "UI-001: Setup modal would appear"
    else
        log_fail "UI-001: Setup detection failed"
    fi
    
    # Create user for remaining tests
    api_post "/api/auth/register" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" >/dev/null
    
    # UI-003: Session Persistence
    log_info "Testing UI-003: Session persistence..."
    local login=$(api_post "/api/auth/login" "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
    local token=$(echo "$login" | jq -r '.access_token')
    
    # Simulate page reload
    local me=$(api_get "/api/auth/me" "$token")
    if echo "$me" | jq -e '.username == "admin"' >/dev/null 2>&1; then
        log_pass "UI-003: Session persists across 'reload'"
    else
        log_fail "UI-003: Session not persisted"
    fi
    
    # UI-004: Protected Content
    log_info "Testing UI-004: Protected content..."
    local code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/folders")
    if [ "$code" = "401" ]; then
        log_pass "UI-004: Content protected when not logged in"
    else
        log_fail "UI-004: Content accessible (code: $code)"
    fi
}

# Main
main() {
    echo ""
    echo "========================================"
    echo "  KDO Video Tagger - Test Suite"
    echo "========================================"
    echo ""
    echo "Base URL: $BASE_URL"
    echo "Container: $CONTAINER_NAME"
    echo ""
    
    # Parse arguments
    local test_category="${1:-all}"
    
    case "$test_category" in
        --all)
            setup
            test_auth
            test_folders
            test_scan
            test_videos
            test_ui
            ;;
        --auth)
            setup
            test_auth
            ;;
        --folders)
            test_folders
            ;;
        --scan)
            test_scan
            ;;
        --videos)
            test_videos
            ;;
        --ui)
            test_ui
            ;;
        --test)
            log_info "Single test mode: $2"
            # Could implement single test execution
            ;;
        *)
            echo "Usage: $0 [--all|--auth|--folders|--scan|--videos|--ui|--test TEST_ID]"
            exit 1
            ;;
    esac
    
    # Summary
    echo ""
    echo "========================================"
    echo "  TEST SUMMARY"
    echo "========================================"
    echo -e "  ${GREEN}Passed:${NC}  $PASSED"
    echo -e "  ${RED}Failed:${NC}  $FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
    echo "========================================"
    
    if [ "$FAILED" -gt 0 ]; then
        exit 1
    fi
    
    exit 0
}

main "$@"
