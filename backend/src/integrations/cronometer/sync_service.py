"""Cronometer sync service for fetching and storing nutrition data."""

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from pycronometer import BiometricEntry, CronometerClient, Exercise, Note, Serving
from pycronometer.exceptions import CronometerAuthError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import BiometricLog, CronometerCredential, ExerciseLog, FoodLog, HealthNote
from src.utils.encryption import decrypt_string


@dataclass
class SyncResult:
    """Result of a Cronometer sync operation."""

    food_logs_synced: int
    biometric_logs_synced: int
    health_notes_synced: int
    exercises_synced: int


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
            CronometerAuthError: If login to Cronometer fails.
        """
        # Get and decrypt credentials
        email, password = await self._get_credentials(user_id)

        # Create client and login
        client = CronometerClient()
        try:
            client.login(email, password)
        except CronometerAuthError:
            raise

        # Calculate date range
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)

        # Fetch data from Cronometer
        servings = client.get_servings(start_date, end_date)
        biometrics = client.get_biometrics(start_date, end_date)
        notes = client.get_notes(start_date, end_date)
        exercises = client.get_exercises(start_date, end_date)

        # Upsert data
        food_logs = await self._upsert_food_logs(user_id, servings)
        biometric_logs = await self._upsert_biometric_logs(user_id, biometrics)
        health_notes = await self._upsert_health_notes(user_id, notes)
        exercise_logs = await self._upsert_exercise_logs(user_id, exercises)

        # Update last_sync_at timestamp
        await self._update_last_sync(user_id)

        return SyncResult(
            food_logs_synced=len(food_logs),
            biometric_logs_synced=len(biometric_logs),
            health_notes_synced=len(health_notes),
            exercises_synced=len(exercise_logs),
        )

    async def _update_last_sync(self, user_id: UUID) -> None:
        """Update the last_sync_at timestamp on the credential record.

        Args:
            user_id: The user's ID.
        """
        result = await self._db.execute(
            select(CronometerCredential).where(CronometerCredential.user_id == user_id)
        )
        credential = result.scalar_one_or_none()
        if credential:
            credential.last_sync_at = datetime.now(UTC)
            await self._db.flush()

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

            # Skip if already exists (in DB or current batch)
            if cronometer_hash in existing_hashes:
                continue

            # Track this hash to avoid duplicates within the same batch
            existing_hashes.add(cronometer_hash)

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

    # High-frequency Apple Health metrics to skip entirely
    SKIPPED_BIOMETRIC_TYPES = frozenset(
        {
            "Heart Rate (Apple Health)",
            "Walking Heart Rate Average (Apple Health)",
        }
    )

    # Metrics to downsample to one reading per day
    DAILY_SAMPLED_BIOMETRIC_TYPES = frozenset(
        {
            "Resting Heart Rate (Apple Health)",
            "Heart Rate Variability (Apple Health)",
        }
    )

    async def _upsert_biometric_logs(
        self, user_id: UUID, entries: list[BiometricEntry]
    ) -> list[BiometricLog]:
        """Upsert biometric log entries from Cronometer.

        Filters out high-frequency Apple Health metrics (heart rate) and
        downsamples certain metrics to one reading per day.

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

        # Get existing daily entries for downsampled metrics
        existing_daily_entries = await self._get_existing_daily_biometrics(user_id)

        # Track daily entries added in current batch: {(metric_type, date): True}
        batch_daily_entries: set[tuple[str, date]] = set()

        new_logs: list[BiometricLog] = []
        for entry in entries:
            # Skip high-frequency Apple Health metrics entirely
            if entry.metric in self.SKIPPED_BIOMETRIC_TYPES:
                continue

            # For daily-sampled metrics, only keep one per day
            if entry.metric in self.DAILY_SAMPLED_BIOMETRIC_TYPES:
                entry_date = entry.logged_at.date()
                daily_key = (entry.metric, entry_date)

                # Skip if we already have this metric for this day (in DB or batch)
                if daily_key in existing_daily_entries or daily_key in batch_daily_entries:
                    continue

                # Track that we're adding this metric for this day
                batch_daily_entries.add(daily_key)

            # Generate hash from raw_data
            cronometer_hash = self._generate_hash(entry.raw_data)

            # Skip if already exists (in DB or current batch)
            if cronometer_hash in existing_hashes:
                continue

            # Track this hash to avoid duplicates within the same batch
            existing_hashes.add(cronometer_hash)

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

    async def _upsert_exercise_logs(
        self, user_id: UUID, exercises: list[Exercise]
    ) -> list[ExerciseLog]:
        """Upsert exercise log entries from Cronometer.

        Args:
            user_id: The user's ID.
            exercises: List of Exercise objects from pycronometer.

        Returns:
            List of newly created ExerciseLog objects (excludes duplicates).
        """
        if not exercises:
            return []

        # Get existing hashes for deduplication
        existing_hashes = await self._get_existing_hashes(user_id, "exercise_logs")

        new_logs: list[ExerciseLog] = []
        for exercise in exercises:
            # Generate hash from raw_data
            cronometer_hash = self._generate_hash(exercise.raw_data)

            # Skip if already exists (in DB or current batch)
            if cronometer_hash in existing_hashes:
                continue

            # Track this hash to avoid duplicates within the same batch
            existing_hashes.add(cronometer_hash)

            exercise_log = ExerciseLog(
                user_id=user_id,
                logged_at=exercise.logged_at,
                name=exercise.name,
                duration_minutes=exercise.duration_minutes,
                calories_burned=exercise.calories_burned,
                raw_data=exercise.raw_data,
                cronometer_hash=cronometer_hash,
            )
            self._db.add(exercise_log)
            new_logs.append(exercise_log)

        if new_logs:
            await self._db.flush()

        return new_logs

    async def _get_existing_daily_biometrics(self, user_id: UUID) -> set[tuple[str, date]]:
        """Get existing (metric_type, date) pairs for daily-sampled biometrics.

        Args:
            user_id: The user's ID.

        Returns:
            Set of (metric_type, date) tuples that already exist.
        """
        from sqlalchemy import func

        result = await self._db.execute(
            select(
                BiometricLog.metric_type,
                func.date(BiometricLog.logged_at).label("log_date"),
            )
            .where(BiometricLog.user_id == user_id)
            .where(BiometricLog.metric_type.in_(self.DAILY_SAMPLED_BIOMETRIC_TYPES))
            .distinct()
        )

        return {(row[0], row[1]) for row in result.fetchall()}

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

            # Skip if already exists (in DB or current batch)
            if cronometer_hash in existing_hashes:
                continue

            # Track this hash to avoid duplicates within the same batch
            existing_hashes.add(cronometer_hash)

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
            table: Table name ('food_logs', 'biometric_logs', 'health_notes', 'exercise_logs').

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
        elif table == "exercise_logs":
            result = await self._db.execute(
                select(ExerciseLog.cronometer_hash).where(ExerciseLog.user_id == user_id)
            )
        else:
            return set()

        return {row[0] for row in result.fetchall()}
