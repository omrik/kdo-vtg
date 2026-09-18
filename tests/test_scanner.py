"""
KDO Video Tagger - Scanner Unit Tests

Run against local Docker container:
    pytest tests/test_scanner.py -v
"""

import datetime

import pytest

from backend.scanner import VideoScanner


class TestParseExiftoolDatetime:
    def test_parses_colon_date(self):
        result = VideoScanner._parse_exiftool_datetime("2025:09:18 19:39:04")
        assert result == datetime.datetime(2025, 9, 18, 19, 39, 4)

    def test_parses_dash_date(self):
        result = VideoScanner._parse_exiftool_datetime("2025-09-18 19:39:04")
        assert result == datetime.datetime(2025, 9, 18, 19, 39, 4)

    def test_parses_iso_t(self):
        result = VideoScanner._parse_exiftool_datetime("2025-09-18T19:39:04")
        assert result == datetime.datetime(2025, 9, 18, 19, 39, 4)

    def test_parses_date_only(self):
        result = VideoScanner._parse_exiftool_datetime("2025:09:18")
        assert result == datetime.datetime(2025, 9, 18)

    def test_parses_fractional_and_offset(self):
        result = VideoScanner._parse_exiftool_datetime(
            "2025:09:18 19:39:04.123456+03:00"
        )
        assert result == datetime.datetime(2025, 9, 18, 19, 39, 4)

    def test_parses_single_digits(self):
        result = VideoScanner._parse_exiftool_datetime("2025:9:8 9:39:4")
        assert result == datetime.datetime(2025, 9, 8, 9, 39, 4)

    def test_returns_none_for_empty(self):
        assert VideoScanner._parse_exiftool_datetime("") is None

    def test_returns_none_for_garbage(self):
        assert VideoScanner._parse_exiftool_datetime("not-a-date") is None

    def test_passes_through_datetime(self):
        now = datetime.datetime(2025, 9, 18, 19, 39, 4)
        assert VideoScanner._parse_exiftool_datetime(now) == now

    def test_returns_none_for_none(self):
        assert VideoScanner._parse_exiftool_datetime(None) is None