"""Cronometer sync service for fetching and storing nutrition data."""

import hashlib
import json
import re
from dataclasses import dataclass
from uuid import UUID

from pycronometer import BiometricEntry, Note, Serving
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import BiometricLog, CronometerCredential, FoodLog, HealthNote
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

    async def _upsert_food_logs(self, user_id: UUID, servings: list[Serving]) -> list[FoodLog]:
        """Upsert food log entries from Cronometer servings.

        Args:
            user_id: The user's ID.
            servings: List of Serving objects from pycronometer.

        Returns:
            List of newly created FoodLog objects (excludes duplicates).
        """
        if not servings:
            return []

        # Get existing hashes for deduplication
        existing_hashes = await self._get_existing_hashes(user_id, "food_logs")

        new_logs: list[FoodLog] = []
        for serving in servings:
            # Generate hash from raw_data
            cronometer_hash = self._generate_hash(serving.raw_data)

            # Skip if already exists
            if cronometer_hash in existing_hashes:
                continue

            food_log = FoodLog(
                user_id=user_id,
                logged_at=serving.logged_at,
                food_name=serving.food_name,
                serving_size=serving.serving_size,
                food_group=serving.group,
                calories=serving.calories,
                protein_g=serving.protein_g,
                carbs_g=serving.carbs_g,
                fat_g=serving.fat_g,
                fiber_g=serving.fiber_g,
                sugar_g=serving.sugar_g,
                sodium_mg=serving.sodium_mg,
                raw_data=serving.raw_data,
                cronometer_hash=cronometer_hash,
            )
            self._db.add(food_log)
            new_logs.append(food_log)

        if new_logs:
            await self._db.flush()

        return new_logs

    async def _upsert_biometric_logs(
        self, user_id: UUID, entries: list[BiometricEntry]
    ) -> list[BiometricLog]:
        """Upsert biometric log entries from Cronometer.

        Args:
            user_id: The user's ID.
            entries: List of BiometricEntry objects from pycronometer.

        Returns:
            List of newly created BiometricLog objects (excludes duplicates).
        """
        if not entries:
            return []

        # Get existing hashes for deduplication
        existing_hashes = await self._get_existing_hashes(user_id, "biometric_logs")

        new_logs: list[BiometricLog] = []
        for entry in entries:
            # Generate hash from raw_data
            cronometer_hash = self._generate_hash(entry.raw_data)

            # Skip if already exists
            if cronometer_hash in existing_hashes:
                continue

            biometric_log = BiometricLog(
                user_id=user_id,
                logged_at=entry.logged_at,
                metric_type=entry.metric,
                value=entry.value,
                unit=entry.unit,
                raw_data=entry.raw_data,
                cronometer_hash=cronometer_hash,
            )
            self._db.add(biometric_log)
            new_logs.append(biometric_log)

        if new_logs:
            await self._db.flush()

        return new_logs

    async def _upsert_health_notes(self, user_id: UUID, notes: list[Note]) -> list[HealthNote]:
        """Upsert health notes from Cronometer with bowel movement parsing.

        Args:
            user_id: The user's ID.
            notes: List of Note objects from pycronometer.

        Returns:
            List of newly created HealthNote objects (excludes duplicates).
        """
        if not notes:
            return []

        # Get existing hashes for deduplication
        existing_hashes = await self._get_existing_hashes(user_id, "health_notes")

        new_notes: list[HealthNote] = []
        for note in notes:
            # Generate hash from raw_data
            cronometer_hash = self._generate_hash(note.raw_data)

            # Skip if already exists
            if cronometer_hash in existing_hashes:
                continue

            # Parse bowel movement info from content
            is_bm, bristol_scale, quantity_score = self._parse_bowel_movement(note.content)

            health_note = HealthNote(
                user_id=user_id,
                logged_at=note.logged_at,
                content=note.content,
                is_bowel_movement=is_bm,
                bristol_scale=bristol_scale,
                quantity_score=quantity_score,
                raw_data=note.raw_data,
                cronometer_hash=cronometer_hash,
            )
            self._db.add(health_note)
            new_notes.append(health_note)

        if new_notes:
            await self._db.flush()

        return new_notes

    def _parse_bowel_movement(self, content: str) -> tuple[bool, int | None, int | None]:
        """Parse bowel movement information from note content.

        Args:
            content: The note content string.

        Returns:
            Tuple of (is_bowel_movement, bristol_scale, quantity_score).
            Bristol scale is 1-7, quantity_score is 1-10, both nullable.
        """
        # Check if this is a bowel movement note (case insensitive)
        content_lower = content.lower()
        is_bm = "bowel movement" in content_lower or "bm" in content_lower.split()

        if not is_bm:
            return False, None, None

        # Extract Bristol scale (e.g., "Bristol 4" or "bristol 4")
        bristol_match = re.search(r"bristol\s*(\d)", content, re.IGNORECASE)
        bristol_scale = int(bristol_match.group(1)) if bristol_match else None

        # Extract quantity score (e.g., "quantity 5/10" or "quantity 7/10")
        quantity_match = re.search(r"quantity\s*(\d+)/10", content, re.IGNORECASE)
        quantity_score = int(quantity_match.group(1)) if quantity_match else None

        return True, bristol_scale, quantity_score

    async def _get_existing_hashes(self, user_id: UUID, table: str) -> set[str]:
        """Get existing cronometer_hash values for a user.

        Args:
            user_id: The user's ID.
            table: Table name ('food_logs', 'biometric_logs', 'health_notes').

        Returns:
            Set of existing hash values.
        """
        if table == "food_logs":
            result = await self._db.execute(
                select(FoodLog.cronometer_hash).where(FoodLog.user_id == user_id)
            )
        elif table == "biometric_logs":
            result = await self._db.execute(
                select(BiometricLog.cronometer_hash).where(BiometricLog.user_id == user_id)
            )
        elif table == "health_notes":
            result = await self._db.execute(
                select(HealthNote.cronometer_hash).where(HealthNote.user_id == user_id)
            )
        else:
            return set()

        return {row[0] for row in result.fetchall()}
