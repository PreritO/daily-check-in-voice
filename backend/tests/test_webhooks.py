"""Integration tests for webhook endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.main import app
from src.models import User


class TestTwilioWebhook:
    """Tests for POST /api/webhooks/twilio/incoming endpoint."""

    @pytest.fixture
    async def webhook_client(self, test_session: AsyncSession) -> AsyncClient:
        """Create a client for webhook tests (no auth required)."""

        async def override_get_db():
            try:
                yield test_session
                await test_session.commit()
            except Exception:
                await test_session.rollback()
                raise

        app.dependency_overrides[get_db] = override_get_db

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac

        app.dependency_overrides.clear()

    @pytest.fixture
    def twilio_form_data(self, test_user: User) -> dict:
        """Create standard Twilio webhook form data."""
        return {
            "AccountSid": "ACxxxxxxxxxxxxx",
            "CallSid": "CAxxxxxxxxxxxxx",
            "From": test_user.phone_number,  # +1234567890
            "To": "+19876543210",
            "CallStatus": "ringing",
        }

    @patch("src.api.routes.webhooks.RequestValidator")
    @patch("src.api.routes.webhooks.get_settings")
    async def test_twilio_incoming_success(
        self,
        mock_get_settings: MagicMock,
        mock_validator_class: MagicMock,
        webhook_client: AsyncClient,
        test_user: User,
        twilio_form_data: dict,
    ) -> None:
        """Test successful incoming call creates call record and returns TwiML."""
        # Mock settings
        mock_settings = MagicMock()
        mock_settings.TWILIO_AUTH_TOKEN = "test_auth_token"
        mock_settings.TWILIO_WEBHOOK_URL = "https://example.com/webhooks/twilio/incoming"
        mock_settings.LIVEKIT_SIP_DOMAIN = "test.sip.livekit.cloud"
        mock_get_settings.return_value = mock_settings

        # Mock validator to return True
        mock_validator = MagicMock()
        mock_validator.validate.return_value = True
        mock_validator_class.return_value = mock_validator

        response = await webhook_client.post(
            "/api/webhooks/twilio/incoming",
            data=twilio_form_data,
            headers={"X-Twilio-Signature": "valid_signature"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/xml"
        assert b"<Response>" in response.content
        assert b"<Dial>" in response.content
        assert b"<Sip>" in response.content

    @patch("src.api.routes.webhooks.RequestValidator")
    @patch("src.api.routes.webhooks.get_settings")
    async def test_twilio_incoming_unknown_phone(
        self,
        mock_get_settings: MagicMock,
        mock_validator_class: MagicMock,
        webhook_client: AsyncClient,
        twilio_form_data: dict,
    ) -> None:
        """Test incoming call from unknown phone returns reject TwiML."""
        # Mock settings
        mock_settings = MagicMock()
        mock_settings.TWILIO_AUTH_TOKEN = "test_auth_token"
        mock_settings.TWILIO_WEBHOOK_URL = "https://example.com/webhooks/twilio/incoming"
        mock_settings.LIVEKIT_SIP_DOMAIN = "test.sip.livekit.cloud"
        mock_get_settings.return_value = mock_settings

        # Mock validator to return True
        mock_validator = MagicMock()
        mock_validator.validate.return_value = True
        mock_validator_class.return_value = mock_validator

        # Use unknown phone number
        twilio_form_data["From"] = "+1999999999"

        response = await webhook_client.post(
            "/api/webhooks/twilio/incoming",
            data=twilio_form_data,
            headers={"X-Twilio-Signature": "valid_signature"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/xml"
        # Should contain reject or say message
        content = response.content.decode()
        assert "<Response>" in content
        # Either Reject or Say with message
        assert "Reject" in content or "Sorry" in content or "not registered" in content.lower()

    @patch("src.api.routes.webhooks.RequestValidator")
    @patch("src.api.routes.webhooks.get_settings")
    async def test_twilio_incoming_invalid_signature(
        self,
        mock_get_settings: MagicMock,
        mock_validator_class: MagicMock,
        webhook_client: AsyncClient,
        twilio_form_data: dict,
    ) -> None:
        """Test incoming call with invalid signature returns 403."""
        # Mock settings
        mock_settings = MagicMock()
        mock_settings.TWILIO_AUTH_TOKEN = "test_auth_token"
        mock_settings.TWILIO_WEBHOOK_URL = "https://example.com/webhooks/twilio/incoming"
        mock_get_settings.return_value = mock_settings

        # Mock validator to return False (invalid signature)
        mock_validator = MagicMock()
        mock_validator.validate.return_value = False
        mock_validator_class.return_value = mock_validator

        response = await webhook_client.post(
            "/api/webhooks/twilio/incoming",
            data=twilio_form_data,
            headers={"X-Twilio-Signature": "invalid_signature"},
        )

        assert response.status_code == 403

    async def test_twilio_incoming_missing_signature(
        self, webhook_client: AsyncClient, twilio_form_data: dict
    ) -> None:
        """Test incoming call without signature header returns 422."""
        response = await webhook_client.post(
            "/api/webhooks/twilio/incoming",
            data=twilio_form_data,
            # No X-Twilio-Signature header
        )

        assert response.status_code == 422

    @patch("src.api.routes.webhooks.RequestValidator")
    @patch("src.api.routes.webhooks.get_settings")
    async def test_twilio_incoming_no_sip_domain(
        self,
        mock_get_settings: MagicMock,
        mock_validator_class: MagicMock,
        webhook_client: AsyncClient,
        test_user: User,
        twilio_form_data: dict,
    ) -> None:
        """Test incoming call without SIP domain configured returns hangup."""
        # Mock settings with no SIP domain
        mock_settings = MagicMock()
        mock_settings.TWILIO_AUTH_TOKEN = "test_auth_token"
        mock_settings.TWILIO_WEBHOOK_URL = "https://example.com/webhooks/twilio/incoming"
        mock_settings.LIVEKIT_SIP_DOMAIN = None  # No SIP domain
        mock_get_settings.return_value = mock_settings

        # Mock validator to return True
        mock_validator = MagicMock()
        mock_validator.validate.return_value = True
        mock_validator_class.return_value = mock_validator

        response = await webhook_client.post(
            "/api/webhooks/twilio/incoming",
            data=twilio_form_data,
            headers={"X-Twilio-Signature": "valid_signature"},
        )

        assert response.status_code == 200
        content = response.content.decode()
        assert "<Response>" in content
        # Should hangup or reject due to missing config
        assert "Hangup" in content or "Reject" in content or "not available" in content.lower()

    @patch("src.api.routes.webhooks.RequestValidator")
    @patch("src.api.routes.webhooks.get_settings")
    async def test_twilio_incoming_creates_inbound_call(
        self,
        mock_get_settings: MagicMock,
        mock_validator_class: MagicMock,
        webhook_client: AsyncClient,
        test_user: User,
        test_session: AsyncSession,
        twilio_form_data: dict,
    ) -> None:
        """Test that incoming call creates a call record with direction=inbound."""
        from src.models import Call, CallDirection

        # Mock settings
        mock_settings = MagicMock()
        mock_settings.TWILIO_AUTH_TOKEN = "test_auth_token"
        mock_settings.TWILIO_WEBHOOK_URL = "https://example.com/webhooks/twilio/incoming"
        mock_settings.LIVEKIT_SIP_DOMAIN = "test.sip.livekit.cloud"
        mock_get_settings.return_value = mock_settings

        # Mock validator to return True
        mock_validator = MagicMock()
        mock_validator.validate.return_value = True
        mock_validator_class.return_value = mock_validator

        response = await webhook_client.post(
            "/api/webhooks/twilio/incoming",
            data=twilio_form_data,
            headers={"X-Twilio-Signature": "valid_signature"},
        )

        assert response.status_code == 200

        # Verify call was created with inbound direction
        from sqlalchemy import select

        result = await test_session.execute(select(Call).where(Call.user_id == test_user.id))
        call = result.scalar_one_or_none()
        assert call is not None
        assert call.direction == CallDirection.INBOUND
