"""Integration tests for API endpoints."""

import uuid

from httpx import AsyncClient

from src.models import Call, Schedule, User

# =============================================================================
# Users API Tests
# =============================================================================


class TestUsersAPI:
    """Tests for /api/users endpoints."""

    async def test_list_users_empty(self, client: AsyncClient) -> None:
        """Test listing users when no users exist."""
        response = await client.get("/api/users/")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_users_with_data(
        self, client: AsyncClient, test_user: User, test_user_2: User
    ) -> None:
        """Test listing users returns all users."""
        response = await client.get("/api/users/")
        assert response.status_code == 200
        users = response.json()
        assert len(users) == 2
        emails = {u["email"] for u in users}
        assert "testuser@example.com" in emails
        assert "another@example.com" in emails

    async def test_list_users_pagination(
        self, client: AsyncClient, test_user: User, test_user_2: User
    ) -> None:
        """Test listing users with pagination."""
        response = await client.get("/api/users/?skip=0&limit=1")
        assert response.status_code == 200
        users = response.json()
        assert len(users) == 1

        response = await client.get("/api/users/?skip=1&limit=1")
        assert response.status_code == 200
        users = response.json()
        assert len(users) == 1

    async def test_get_user_success(self, client: AsyncClient, test_user: User) -> None:
        """Test getting a user by ID."""
        response = await client.get(f"/api/users/{test_user.id}")
        assert response.status_code == 200
        user = response.json()
        assert user["id"] == str(test_user.id)
        assert user["email"] == "testuser@example.com"
        assert user["name"] == "Test User"
        assert user["timezone"] == "America/New_York"
        assert user["phone_number"] == "+1234567890"

    async def test_get_user_not_found(self, client: AsyncClient) -> None:
        """Test getting a non-existent user returns 404."""
        non_existent_id = uuid.uuid4()
        response = await client.get(f"/api/users/{non_existent_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_create_user_success(self, client: AsyncClient) -> None:
        """Test creating a new user."""
        user_data = {
            "email": "newuser@example.com",
            "name": "New User",
            "timezone": "Europe/London",
            "phone_number": "+449876543210",
        }
        response = await client.post("/api/users/", json=user_data)
        assert response.status_code == 201
        user = response.json()
        assert user["email"] == "newuser@example.com"
        assert user["name"] == "New User"
        assert user["timezone"] == "Europe/London"
        assert user["phone_number"] == "+449876543210"
        assert "id" in user
        assert "created_at" in user

    async def test_create_user_minimal(self, client: AsyncClient) -> None:
        """Test creating a user with only required fields."""
        user_data = {
            "email": "minimal@example.com",
            "name": "Minimal User",
        }
        response = await client.post("/api/users/", json=user_data)
        assert response.status_code == 201
        user = response.json()
        assert user["email"] == "minimal@example.com"
        assert user["timezone"] == "UTC"  # Default value
        assert user["phone_number"] is None

    async def test_create_user_duplicate_email(self, client: AsyncClient, test_user: User) -> None:
        """Test creating a user with duplicate email returns 409."""
        user_data = {
            "email": "testuser@example.com",  # Same as test_user
            "name": "Duplicate User",
        }
        response = await client.post("/api/users/", json=user_data)
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

    async def test_create_user_invalid_email(self, client: AsyncClient) -> None:
        """Test creating a user with invalid email returns 422."""
        user_data = {
            "email": "not-an-email",
            "name": "Bad Email User",
        }
        response = await client.post("/api/users/", json=user_data)
        assert response.status_code == 422

    async def test_update_user_success(self, client: AsyncClient, test_user: User) -> None:
        """Test updating a user."""
        update_data = {"name": "Updated Name", "timezone": "Asia/Tokyo"}
        response = await client.patch(f"/api/users/{test_user.id}", json=update_data)
        assert response.status_code == 200
        user = response.json()
        assert user["name"] == "Updated Name"
        assert user["timezone"] == "Asia/Tokyo"
        assert user["email"] == "testuser@example.com"  # Unchanged

    async def test_update_user_not_found(self, client: AsyncClient) -> None:
        """Test updating a non-existent user returns 404."""
        non_existent_id = uuid.uuid4()
        update_data = {"name": "New Name"}
        response = await client.patch(f"/api/users/{non_existent_id}", json=update_data)
        assert response.status_code == 404

    async def test_update_user_duplicate_email(
        self, client: AsyncClient, test_user: User, test_user_2: User
    ) -> None:
        """Test updating a user with duplicate email returns 409."""
        update_data = {"email": "another@example.com"}  # Same as test_user_2
        response = await client.patch(f"/api/users/{test_user.id}", json=update_data)
        assert response.status_code == 409

    async def test_update_user_empty_body(self, client: AsyncClient, test_user: User) -> None:
        """Test updating a user with empty body returns the user unchanged."""
        response = await client.patch(f"/api/users/{test_user.id}", json={})
        assert response.status_code == 200
        user = response.json()
        assert user["name"] == "Test User"  # Unchanged

    async def test_delete_user_success(
        self, authenticated_client: AsyncClient, test_user: User
    ) -> None:
        """Test deleting a user (own account)."""
        response = await authenticated_client.delete(f"/api/users/{test_user.id}")
        assert response.status_code == 204

        # Verify user is deleted - use regular client since user is gone
        response = await authenticated_client.get(f"/api/users/{test_user.id}")
        assert response.status_code == 404

    async def test_delete_user_forbidden(
        self, authenticated_client: AsyncClient, test_user_2: User
    ) -> None:
        """Test deleting another user's account returns 403."""
        # authenticated_client is logged in as test_user, trying to delete test_user_2
        response = await authenticated_client.delete(f"/api/users/{test_user_2.id}")
        assert response.status_code == 403
        assert "You can only delete your own account" in response.json()["detail"]

    async def test_delete_user_unauthenticated(self, client: AsyncClient, test_user: User) -> None:
        """Test deleting a user without authentication returns 401."""
        response = await client.delete(f"/api/users/{test_user.id}")
        assert response.status_code == 401


# =============================================================================
# Calls API Tests
# =============================================================================


class TestCallsAPI:
    """Tests for /api/calls endpoints."""

    async def test_list_calls_empty(self, client: AsyncClient) -> None:
        """Test listing calls when no calls exist."""
        response = await client.get("/api/calls/")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_calls_with_data(self, client: AsyncClient, test_call: Call) -> None:
        """Test listing calls returns all calls."""
        response = await client.get("/api/calls/")
        assert response.status_code == 200
        calls = response.json()
        assert len(calls) == 1
        assert calls[0]["id"] == str(test_call.id)

    async def test_list_calls_filter_by_user(
        self, client: AsyncClient, test_call: Call, test_user: User, test_user_2: User
    ) -> None:
        """Test listing calls filtered by user_id."""
        # List calls for test_user (should have 1)
        response = await client.get(f"/api/calls/?user_id={test_user.id}")
        assert response.status_code == 200
        calls = response.json()
        assert len(calls) == 1

        # List calls for test_user_2 (should have 0)
        response = await client.get(f"/api/calls/?user_id={test_user_2.id}")
        assert response.status_code == 200
        calls = response.json()
        assert len(calls) == 0

    async def test_list_calls_pagination(self, client: AsyncClient, test_call: Call) -> None:
        """Test listing calls with pagination."""
        response = await client.get("/api/calls/?skip=0&limit=10")
        assert response.status_code == 200
        assert len(response.json()) == 1

        response = await client.get("/api/calls/?skip=1&limit=10")
        assert response.status_code == 200
        assert len(response.json()) == 0

    async def test_get_call_success(self, client: AsyncClient, test_call: Call) -> None:
        """Test getting a call by ID with details."""
        response = await client.get(f"/api/calls/{test_call.id}")
        assert response.status_code == 200
        call = response.json()
        assert call["id"] == str(test_call.id)
        assert call["status"] == "scheduled"
        assert "transcripts" in call
        assert "summary" in call
        assert call["transcripts"] == []
        assert call["summary"] is None

    async def test_get_call_not_found(self, client: AsyncClient) -> None:
        """Test getting a non-existent call returns 404."""
        non_existent_id = uuid.uuid4()
        response = await client.get(f"/api/calls/{non_existent_id}")
        assert response.status_code == 404

    async def test_create_call_success(self, client: AsyncClient, test_user: User) -> None:
        """Test creating a new call."""
        call_data = {
            "user_id": str(test_user.id),
            "status": "scheduled",
        }
        response = await client.post("/api/calls/", json=call_data)
        assert response.status_code == 201
        call = response.json()
        assert call["user_id"] == str(test_user.id)
        assert call["status"] == "scheduled"
        assert "id" in call
        assert "created_at" in call

    async def test_create_call_user_not_found(self, client: AsyncClient) -> None:
        """Test creating a call for non-existent user returns 404."""
        non_existent_user_id = uuid.uuid4()
        call_data = {
            "user_id": str(non_existent_user_id),
        }
        response = await client.post("/api/calls/", json=call_data)
        assert response.status_code == 404
        assert "user" in response.json()["detail"].lower()

    async def test_update_call_success(self, client: AsyncClient, test_call: Call) -> None:
        """Test updating a call status."""
        update_data = {"status": "in_progress"}
        response = await client.patch(f"/api/calls/{test_call.id}", json=update_data)
        assert response.status_code == 200
        call = response.json()
        assert call["status"] == "in_progress"

    async def test_update_call_not_found(self, client: AsyncClient) -> None:
        """Test updating a non-existent call returns 404."""
        non_existent_id = uuid.uuid4()
        update_data = {"status": "completed"}
        response = await client.patch(f"/api/calls/{non_existent_id}", json=update_data)
        assert response.status_code == 404

    async def test_update_call_empty_body(self, client: AsyncClient, test_call: Call) -> None:
        """Test updating a call with empty body returns the call unchanged."""
        response = await client.patch(f"/api/calls/{test_call.id}", json={})
        assert response.status_code == 200
        call = response.json()
        assert call["status"] == "scheduled"  # Unchanged

    async def test_delete_call_success(self, client: AsyncClient, test_call: Call) -> None:
        """Test deleting a call."""
        response = await client.delete(f"/api/calls/{test_call.id}")
        assert response.status_code == 204

        # Verify call is deleted
        response = await client.get(f"/api/calls/{test_call.id}")
        assert response.status_code == 404

    async def test_delete_call_not_found(self, client: AsyncClient) -> None:
        """Test deleting a non-existent call returns 404."""
        non_existent_id = uuid.uuid4()
        response = await client.delete(f"/api/calls/{non_existent_id}")
        assert response.status_code == 404


# =============================================================================
# Schedules API Tests
# =============================================================================


class TestSchedulesAPI:
    """Tests for /api/schedules endpoints."""

    async def test_list_schedules_empty(self, client: AsyncClient) -> None:
        """Test listing schedules when no schedules exist."""
        response = await client.get("/api/schedules/")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_schedules_with_data(
        self, client: AsyncClient, test_schedule: Schedule
    ) -> None:
        """Test listing schedules returns all schedules."""
        response = await client.get("/api/schedules/")
        assert response.status_code == 200
        schedules = response.json()
        assert len(schedules) == 1
        assert schedules[0]["id"] == str(test_schedule.id)

    async def test_list_schedules_filter_by_user(
        self, client: AsyncClient, test_schedule: Schedule, test_user: User, test_user_2: User
    ) -> None:
        """Test listing schedules filtered by user_id."""
        # List schedules for test_user (should have 1)
        response = await client.get(f"/api/schedules/?user_id={test_user.id}")
        assert response.status_code == 200
        schedules = response.json()
        assert len(schedules) == 1

        # List schedules for test_user_2 (should have 0)
        response = await client.get(f"/api/schedules/?user_id={test_user_2.id}")
        assert response.status_code == 200
        schedules = response.json()
        assert len(schedules) == 0

    async def test_list_schedules_pagination(
        self, client: AsyncClient, test_schedule: Schedule
    ) -> None:
        """Test listing schedules with pagination."""
        response = await client.get("/api/schedules/?skip=0&limit=10")
        assert response.status_code == 200
        assert len(response.json()) == 1

        response = await client.get("/api/schedules/?skip=1&limit=10")
        assert response.status_code == 200
        assert len(response.json()) == 0

    async def test_get_schedule_success(self, client: AsyncClient, test_schedule: Schedule) -> None:
        """Test getting a schedule by ID."""
        response = await client.get(f"/api/schedules/{test_schedule.id}")
        assert response.status_code == 200
        schedule = response.json()
        assert schedule["id"] == str(test_schedule.id)
        assert schedule["cron_expression"] == "0 9 * * 1-5"
        assert schedule["enabled"] is True

    async def test_get_schedule_not_found(self, client: AsyncClient) -> None:
        """Test getting a non-existent schedule returns 404."""
        non_existent_id = uuid.uuid4()
        response = await client.get(f"/api/schedules/{non_existent_id}")
        assert response.status_code == 404

    async def test_create_schedule_success(self, client: AsyncClient, test_user: User) -> None:
        """Test creating a new schedule."""
        schedule_data = {
            "user_id": str(test_user.id),
            "cron_expression": "30 8 * * 1-5",
            "enabled": True,
        }
        response = await client.post("/api/schedules/", json=schedule_data)
        assert response.status_code == 201
        schedule = response.json()
        assert schedule["user_id"] == str(test_user.id)
        assert schedule["cron_expression"] == "30 8 * * 1-5"
        assert schedule["enabled"] is True
        assert "id" in schedule
        assert "created_at" in schedule

    async def test_create_schedule_user_not_found(self, client: AsyncClient) -> None:
        """Test creating a schedule for non-existent user returns 404."""
        non_existent_user_id = uuid.uuid4()
        schedule_data = {
            "user_id": str(non_existent_user_id),
            "cron_expression": "0 9 * * *",
        }
        response = await client.post("/api/schedules/", json=schedule_data)
        assert response.status_code == 404
        assert "user" in response.json()["detail"].lower()

    async def test_create_schedule_invalid_cron(self, client: AsyncClient, test_user: User) -> None:
        """Test creating a schedule with invalid cron expression returns 422."""
        schedule_data = {
            "user_id": str(test_user.id),
            "cron_expression": "invalid cron",
        }
        response = await client.post("/api/schedules/", json=schedule_data)
        assert response.status_code == 422

    async def test_create_schedule_invalid_cron_fields(
        self, client: AsyncClient, test_user: User
    ) -> None:
        """Test creating a schedule with wrong number of cron fields returns 422."""
        schedule_data = {
            "user_id": str(test_user.id),
            "cron_expression": "0 9 * *",  # Only 4 fields, need 5
        }
        response = await client.post("/api/schedules/", json=schedule_data)
        assert response.status_code == 422

    async def test_update_schedule_success(
        self, client: AsyncClient, test_schedule: Schedule
    ) -> None:
        """Test updating a schedule."""
        update_data = {"cron_expression": "0 10 * * 1-5", "enabled": False}
        response = await client.patch(f"/api/schedules/{test_schedule.id}", json=update_data)
        assert response.status_code == 200
        schedule = response.json()
        assert schedule["cron_expression"] == "0 10 * * 1-5"
        assert schedule["enabled"] is False

    async def test_update_schedule_not_found(self, client: AsyncClient) -> None:
        """Test updating a non-existent schedule returns 404."""
        non_existent_id = uuid.uuid4()
        update_data = {"enabled": False}
        response = await client.patch(f"/api/schedules/{non_existent_id}", json=update_data)
        assert response.status_code == 404

    async def test_update_schedule_invalid_cron(
        self, client: AsyncClient, test_schedule: Schedule
    ) -> None:
        """Test updating a schedule with invalid cron expression returns 422."""
        update_data = {"cron_expression": "bad cron"}
        response = await client.patch(f"/api/schedules/{test_schedule.id}", json=update_data)
        assert response.status_code == 422

    async def test_update_schedule_empty_body(
        self, client: AsyncClient, test_schedule: Schedule
    ) -> None:
        """Test updating a schedule with empty body returns the schedule unchanged."""
        response = await client.patch(f"/api/schedules/{test_schedule.id}", json={})
        assert response.status_code == 200
        schedule = response.json()
        assert schedule["cron_expression"] == "0 9 * * 1-5"  # Unchanged

    async def test_delete_schedule_success(
        self, client: AsyncClient, test_schedule: Schedule
    ) -> None:
        """Test deleting a schedule."""
        response = await client.delete(f"/api/schedules/{test_schedule.id}")
        assert response.status_code == 204

        # Verify schedule is deleted
        response = await client.get(f"/api/schedules/{test_schedule.id}")
        assert response.status_code == 404

    async def test_delete_schedule_not_found(self, client: AsyncClient) -> None:
        """Test deleting a non-existent schedule returns 404."""
        non_existent_id = uuid.uuid4()
        response = await client.delete(f"/api/schedules/{non_existent_id}")
        assert response.status_code == 404
