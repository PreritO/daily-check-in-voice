"""Cronometer sync service for fetching and storing nutrition data."""

import hashlib
import json
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import CronometerCredential
from src.utils.encryption import decrypt_string


@dataclass
class SyncResult:
    """Result of a Cronometer sync operation."""

    food_logs_synced: int
    biometric_logs_synced: int
    health_notes_synced: int


class CronometerSyncService:
    """Service for syncing data from Cronometer."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the sync service.

        Args:
            db: Async database session for queries and inserts.
        """
        self._db = db

    async def sync_user(self, user_id: UUID, days_back: int = 7) -> SyncResult:
        """Sync Cronometer data for a user.

        Args:
            user_id: The user's ID to sync data for.
            days_back: Number of days to look back for data. Default 7.

        Returns:
            SyncResult with counts of synced records.

        Raises:
            ValueError: If user has no Cronometer credentials configured.
        """
        # Get and decrypt credentials
        email, password = await self._get_credentials(user_id)

        # TODO: Implement in US-012:
        # 1. Create CronometerClient instance
        # 2. Login with credentials
        # 3. Fetch servings, biometrics, notes
        # 4. Call upsert methods
        # 5. Update last_sync_at

        return SyncResult(
            food_logs_synced=0,
            biometric_logs_synced=0,
            health_notes_synced=0,
        )

    async def _get_credentials(self, user_id: UUID) -> tuple[str, str]:
        """Get decrypted Cronometer credentials for a user.

        Args:
            user_id: The user's ID.

        Returns:
            Tuple of (email, password) decrypted.

        Raises:
            ValueError: If no credentials are configured for the user.
        """
        result = await self._db.execute(
            select(CronometerCredential).where(CronometerCredential.user_id == user_id)
        )
        credential = result.scalar_one_or_none()

        if credential is None:
            raise ValueError(f"No Cronometer credentials configured for user {user_id}")

        email = decrypt_string(credential.encrypted_email)
        password = decrypt_string(credential.encrypted_password)

        return email, password

    def _generate_hash(self, data: dict) -> str:
        """Generate a SHA256 hash for deduplication.

        Args:
            data: Dictionary to hash (typically raw_data from Cronometer).

        Returns:
            Hex-encoded SHA256 hash string (64 characters).
        """
        # Sort keys for consistent hashing
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode()).hexdigest()
