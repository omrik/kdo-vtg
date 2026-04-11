"""
KDO Video Tagger - API Tests

Run against local Docker container:
    docker build -t kdo-vtg:stage .
    docker run -d -p 8080:8000 -v ~/Movies:/media:ro -v kdo-vtg-test:/app/config --name kdo-vtg-test kdo-vtg:stage
    
Then run tests:
    pytest tests/ -v
"""

import pytest
from httpx import Client


BASE_URL = "http://localhost:8080"


@pytest.fixture(scope="module")
def client():
    with Client(base_url=BASE_URL, timeout=30) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    """Login and return auth headers"""
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestHealth:
    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestAuth:
    def test_setup_status(self, client):
        response = client.get("/api/auth/setup-status")
        assert response.status_code == 200
        data = response.json()
        assert "needs_setup" in data
        assert "user_count" in data

    def test_protected_endpoint_requires_auth(self, client):
        response = client.get("/api/folders")
        assert response.status_code == 401

    def test_login_success(self, client):
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong"}
        )
        assert response.status_code == 401


class TestFolders:
    def test_list_folders_requires_auth(self, client):
        response = client.get("/api/folders")
        assert response.status_code == 401

    def test_list_folders(self, client, auth):
        response = client.get("/api/folders", headers=auth)
        assert response.status_code == 200
        data = response.json()
        assert "folders" in data

    def test_get_folder_contents(self, client, auth):
        response = client.get("/api/folders/Scan", headers=auth)
        assert response.status_code in [200, 404]


class TestScanning:
    def test_scan_requires_auth(self, client):
        response = client.post("/api/scan", json={"folder_path": "/media/Scan"})
        assert response.status_code == 401

    def test_start_scan(self, client, auth):
        response = client.post(
            "/api/scan",
            json={"folder_path": "/media/Scan", "yolo_enabled": False},
            headers=auth
        )
        assert response.status_code == 200
        data = response.json()
        assert "scan_id" in data
        assert data["status"] == "started"


class TestVideos:
    def test_get_videos_requires_auth(self, client):
        response = client.get("/api/videos")
        assert response.status_code == 401

    def test_get_videos(self, client, auth):
        response = client.get("/api/videos", headers=auth)
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data

    def test_get_stats(self, client, auth):
        response = client.get("/api/stats", headers=auth)
        assert response.status_code == 200
        data = response.json()
        assert "total_videos" in data


class TestCollections:
    def test_create_collection(self, client, auth):
        response = client.post(
            "/api/collections",
            json={"name": "Test Collection"},
            headers=auth
        )
        assert response.status_code == 200

    def test_list_collections(self, client, auth):
        response = client.get("/api/collections", headers=auth)
        assert response.status_code == 200


class TestProjects:
    def test_create_project(self, client, auth):
        response = client.post(
            "/api/projects",
            json={"name": "Test Project"},
            headers=auth
        )
        assert response.status_code == 200

    def test_list_projects(self, client, auth):
        response = client.get("/api/projects", headers=auth)
        assert response.status_code == 200
