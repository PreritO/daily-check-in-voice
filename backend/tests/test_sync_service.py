"""Unit tests for CronometerSyncService bowel movement parsing."""

import pytest

from src.integrations.cronometer.sync_service import CronometerSyncService


class TestParseBowelMovement:
    """Tests for _parse_bowel_movement method."""

    @pytest.fixture
    def sync_service(self) -> CronometerSyncService:
        """Create a sync service instance with None db (not needed for parsing tests)."""
        # We pass None for db since _parse_bowel_movement doesn't use it
        return CronometerSyncService(None)  # type: ignore[arg-type]

    def test_standard_format(self, sync_service: CronometerSyncService) -> None:
        """Test standard BM note format with both Bristol and quantity."""
        content = "Bowel Movement - quantity 5/10, Bristol 4"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol == 4
        assert quantity == 5

    def test_with_only_bristol(self, sync_service: CronometerSyncService) -> None:
        """Test BM note with only Bristol scale."""
        content = "BM Bristol 3"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol == 3
        assert quantity is None

    def test_with_only_quantity(self, sync_service: CronometerSyncService) -> None:
        """Test BM note with only quantity score."""
        content = "Bowel Movement quantity 7/10"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol is None
        assert quantity == 7

    def test_non_bm_note(self, sync_service: CronometerSyncService) -> None:
        """Test non-BM note returns False and None values."""
        content = "Had a great breakfast today"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is False
        assert bristol is None
        assert quantity is None

    def test_case_insensitivity_bowel_movement(self, sync_service: CronometerSyncService) -> None:
        """Test case insensitivity for 'bowel movement' keyword."""
        content = "BOWEL MOVEMENT - Bristol 5"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol == 5

    def test_case_insensitivity_bm(self, sync_service: CronometerSyncService) -> None:
        """Test case insensitivity for 'BM' abbreviation."""
        content = "bm bristol 6 quantity 3/10"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol == 6
        assert quantity == 3

    def test_bristol_various_formats(self, sync_service: CronometerSyncService) -> None:
        """Test various Bristol scale format variations."""
        # With space
        content1 = "Bowel Movement bristol 4"
        _, bristol1, _ = sync_service._parse_bowel_movement(content1)
        assert bristol1 == 4

        # Without space
        content2 = "Bowel Movement bristol4"
        _, bristol2, _ = sync_service._parse_bowel_movement(content2)
        assert bristol2 == 4

        # Mixed case
        content3 = "Bowel Movement BRISTOL 7"
        _, bristol3, _ = sync_service._parse_bowel_movement(content3)
        assert bristol3 == 7

    def test_quantity_various_formats(self, sync_service: CronometerSyncService) -> None:
        """Test various quantity score format variations."""
        # With space
        content1 = "Bowel Movement quantity 8/10"
        _, _, quantity1 = sync_service._parse_bowel_movement(content1)
        assert quantity1 == 8

        # Without space
        content2 = "Bowel Movement quantity8/10"
        _, _, quantity2 = sync_service._parse_bowel_movement(content2)
        assert quantity2 == 8

        # Mixed case
        content3 = "Bowel Movement QUANTITY 10/10"
        _, _, quantity3 = sync_service._parse_bowel_movement(content3)
        assert quantity3 == 10

    def test_bm_abbreviation_not_in_word(self, sync_service: CronometerSyncService) -> None:
        """Test that 'bm' as part of a word doesn't trigger BM detection."""
        # "IBM" contains "bm" but shouldn't be detected
        content = "Working at IBM today"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is False

    def test_empty_content(self, sync_service: CronometerSyncService) -> None:
        """Test empty string content."""
        content = ""
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is False
        assert bristol is None
        assert quantity is None

    def test_bm_without_scores(self, sync_service: CronometerSyncService) -> None:
        """Test BM note without any scores."""
        content = "Bowel Movement this morning"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol is None
        assert quantity is None

    def test_multiple_numbers(self, sync_service: CronometerSyncService) -> None:
        """Test that correct numbers are extracted when multiple are present."""
        content = "Bowel Movement at 3pm, Bristol 4, quantity 6/10"
        is_bm, bristol, quantity = sync_service._parse_bowel_movement(content)

        assert is_bm is True
        assert bristol == 4
        assert quantity == 6
