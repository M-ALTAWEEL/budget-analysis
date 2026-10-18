"""Money-related shared definitions. Decimal helpers are added in phase 3."""

from enum import StrEnum


class Currency(StrEnum):
    TRY = "TRY"  # Turkish Lira
    USD = "USD"  # US Dollar
    AED = "AED"  # UAE Dirham
    SAR = "SAR"  # Saudi Riyal
    QAR = "QAR"  # Qatari Riyal
    EUR = "EUR"  # Euro
