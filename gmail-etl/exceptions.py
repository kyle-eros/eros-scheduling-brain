# exceptions.py
"""
Custom exceptions for EROS Gmail ETL Pipeline
"""


class PipelineError(Exception):
    """Base exception for pipeline errors"""
    pass


class GmailError(PipelineError):
    """Gmail API related errors"""
    pass


class NoMessagesFoundError(GmailError):
    """No messages found matching search criteria"""
    pass


class MessageFetchError(GmailError):
    """Error fetching message content"""
    pass


class NoDownloadUrlFound(GmailError):
    """No download URL found in message"""
    pass


class ExcelProcessingError(PipelineError):
    """Error processing Excel file"""
    def __init__(self, file_path: str, message: str):
        self.file_path = file_path
        self.message = message
        super().__init__(f"Excel processing error for {file_path}: {message}")


class DataValidationError(PipelineError):
    """Data validation error"""
    def __init__(self, field_name: str, issue: str, sample_value: str = ""):
        self.field_name = field_name
        self.issue = issue
        self.sample_value = sample_value
        super().__init__(f"Data validation error in {field_name}: {issue}")


class InvalidFileError(PipelineError):
    """Invalid file format or content"""
    pass


class BigQueryLoadError(PipelineError):
    """BigQuery load operation failed"""
    pass


class AuthenticationError(PipelineError):
    """Authentication/authorization error"""
    pass