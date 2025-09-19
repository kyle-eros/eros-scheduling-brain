# processor.py
"""
Excel file processor for EROS Gmail ETL
Simplified version adapted from working python-etl
"""

import re
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path

import pandas as pd
import numpy as np

from exceptions import ExcelProcessingError

logger = logging.getLogger(__name__)


def normalize_headers(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize DataFrame column headers to lowercase with underscores"""
    new_columns = []
    for col in df.columns:
        # Convert to string and normalize
        normalized = str(col).lower().strip()
        # Replace spaces and special chars with underscores
        normalized = re.sub(r'[^a-z0-9]+', '_', normalized)
        # Remove leading/trailing underscores
        normalized = normalized.strip('_')
        new_columns.append(normalized)

    df.columns = new_columns
    return df


def excel_to_dataframe(file_path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
    """
    Read Excel file into DataFrame with robust processing

    Args:
        file_path: Path to Excel file
        sheet_name: Optional sheet name (uses first sheet if None)

    Returns:
        Processed DataFrame

    Raises:
        ExcelProcessingError: If file cannot be read
    """
    file_path_obj = Path(file_path)

    if not file_path_obj.exists():
        raise ExcelProcessingError(file_path, "File does not exist")

    if not file_path_obj.suffix.lower() in ['.xlsx', '.xls']:
        raise ExcelProcessingError(file_path, f"Invalid file type: {file_path_obj.suffix}")

    logger.info(f"Reading Excel file: {file_path_obj.name}")

    try:
        # Try multiple engines for better compatibility
        engines = ['openpyxl'] if file_path_obj.suffix.lower() == '.xlsx' else ['xlrd', 'openpyxl']

        df = None
        last_error = None

        for engine in engines:
            try:
                logger.debug(f"  Trying engine: {engine}")

                # Read Excel file with various parameters for robustness
                if sheet_name is not None:
                    df = pd.read_excel(file_path, sheet_name=sheet_name, engine=engine)
                else:
                    # Read first sheet by default
                    df = pd.read_excel(file_path, engine=engine)

                logger.debug(f"  Successfully read with {engine}")
                break

            except Exception as e:
                logger.debug(f"  Engine {engine} failed: {e}")
                last_error = e
                continue

        if df is None:
            raise ExcelProcessingError(file_path, f"Could not read file with any engine. Last error: {last_error}")

        logger.info(f"  Read {len(df)} rows, {len(df.columns)} columns")

        # Basic validation
        if df.empty:
            logger.warning(f"File {file_path_obj.name} is empty")
            return df

        # Log original column names for debugging
        logger.debug(f"  Original columns: {list(df.columns)}")

        # Remove completely empty rows
        initial_rows = len(df)
        df = df.dropna(how='all')
        if len(df) < initial_rows:
            logger.debug(f"  Removed {initial_rows - len(df)} empty rows")

        # Remove completely empty columns
        initial_cols = len(df.columns)
        df = df.dropna(axis=1, how='all')
        if len(df.columns) < initial_cols:
            logger.debug(f"  Removed {initial_cols - len(df.columns)} empty columns")

        # Handle common Excel issues
        df = _clean_excel_data(df)

        logger.info(f"  After cleanup: {len(df)} rows, {len(df.columns)} columns")

        return df

    except pd.errors.EmptyDataError:
        logger.warning(f"File {file_path_obj.name} contains no data")
        return pd.DataFrame()
    except ExcelProcessingError:
        raise
    except Exception as e:
        logger.error(f"Error processing {file_path}: {e}", exc_info=True)
        raise ExcelProcessingError(file_path, str(e))


def _clean_excel_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean common Excel data issues"""
    # Convert datetime columns that might be stored as strings
    for col in df.columns:
        if 'time' in col.lower() or 'date' in col.lower():
            # Try to convert to datetime, but keep as string if it fails
            try:
                # Don't convert to datetime here - let Dataform handle it
                # Just clean up obvious issues
                if df[col].dtype == 'object':
                    df[col] = df[col].astype(str).str.strip()
                    # Remove any "SD Chu" suffixes that appear in infloww data
                    df[col] = df[col].str.replace('SD Chu', '', regex=False).str.strip()
            except:
                pass

    # Clean up text columns
    for col in df.columns:
        if df[col].dtype == 'object':
            try:
                # Strip whitespace and handle None/NaN values
                df[col] = df[col].astype(str).str.strip()
                df[col] = df[col].replace({'nan': '', 'None': '', 'NaT': ''})
            except:
                pass

    # Handle numeric columns that might have been read as strings
    for col in df.columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in ['sent', 'viewed', 'purchased', 'earnings', 'price']):
            try:
                # For price/earnings columns, keep as string for Dataform to handle
                if 'price' in col_lower or 'earnings' in col_lower:
                    df[col] = df[col].astype(str)
                # For count columns, try to convert to numeric
                elif col_lower in ['sent', 'viewed', 'purchased']:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            except:
                pass

    return df