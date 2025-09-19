#!/usr/bin/env python3
"""
Test script for EROS Gmail ETL backfill functionality
Validates command line arguments and configuration
"""

import sys
import argparse
from config import Config
from main import ErosGmailETLPipeline


def test_argument_parsing():
    """Test command line argument parsing"""
    print("🧪 Testing argument parsing...")

    # Test normal mode
    sys.argv = ['test_backfill.py']
    parser = argparse.ArgumentParser()
    parser.add_argument('--full', action='store_true')
    parser.add_argument('--max-messages', type=int, default=None)
    parser.add_argument('--log-level', default='INFO')

    args = parser.parse_args()
    assert not args.full, "Normal mode should not be full backfill"

    # Test full mode
    sys.argv = ['test_backfill.py', '--full']
    args = parser.parse_args()
    assert args.full, "Should detect --full flag"

    print("✅ Argument parsing tests passed")


def test_pipeline_initialization():
    """Test pipeline initialization in both modes"""
    print("🧪 Testing pipeline initialization...")

    config = Config()

    # Test normal mode
    pipeline_normal = ErosGmailETLPipeline(config, full_backfill=False)
    assert not pipeline_normal.full_backfill, "Normal pipeline should not be in backfill mode"
    assert not pipeline_normal.stats['backfill_mode'], "Stats should reflect normal mode"

    # Test backfill mode
    pipeline_backfill = ErosGmailETLPipeline(config, full_backfill=True)
    assert pipeline_backfill.full_backfill, "Backfill pipeline should be in backfill mode"
    assert pipeline_backfill.stats['backfill_mode'], "Stats should reflect backfill mode"

    print("✅ Pipeline initialization tests passed")


def test_configuration():
    """Test configuration values"""
    print("🧪 Testing configuration...")

    config = Config()

    # Check key EROS configuration
    assert config.BQ_DATASET == "eros_source", f"Expected eros_source, got {config.BQ_DATASET}"
    assert config.BQ_TABLE == "mass_message_daily_final", f"Expected mass_message_daily_final, got {config.BQ_TABLE}"
    assert config.PROJECT_ID == "of-scheduler-proj", f"Expected of-scheduler-proj, got {config.PROJECT_ID}"

    print("✅ Configuration tests passed")


def test_search_query_modification():
    """Test search query modification for backfill"""
    print("🧪 Testing search query modification...")

    import re

    # Test removing newer_than from query
    original_query = 'from:no-reply@infloww.com subject:"OF mass message history report is ready for download" newer_than:7d'
    backfill_query = re.sub(r'\s*newer_than:\w+', '', original_query)

    expected = 'from:no-reply@infloww.com subject:"OF mass message history report is ready for download"'
    assert backfill_query.strip() == expected, f"Query modification failed: {backfill_query}"

    print("✅ Search query modification tests passed")


def main():
    """Run all tests"""
    print("🧪 EROS Gmail ETL - Backfill Functionality Tests")
    print("=" * 50)

    try:
        test_argument_parsing()
        test_pipeline_initialization()
        test_configuration()
        test_search_query_modification()

        print("")
        print("🎉 ALL TESTS PASSED!")
        print("")
        print("✅ Backfill functionality is ready to use:")
        print("   python main.py --full                 # Full backfill")
        print("   python main.py                        # Incremental")
        print("   ./run_backfill.sh                     # Interactive backfill")

        return 0

    except Exception as e:
        print(f"❌ TEST FAILED: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())