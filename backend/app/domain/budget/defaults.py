"""The default categories every student starts with.

The first migration inserts these rows, and the test setup inserts them too.
Changing this list does NOT change existing databases: add a new migration for that.
"""

DEFAULT_CATEGORIES: list[dict[str, str]] = [
    {"slug": "food", "name": "Food", "icon": "utensils", "color": "#F97316"},
    {"slug": "transport", "name": "Transport", "icon": "bus", "color": "#3B82F6"},
    {"slug": "study", "name": "Study", "icon": "book-open", "color": "#8B5CF6"},
    {"slug": "entertainment", "name": "Entertainment", "icon": "gamepad-2", "color": "#EC4899"},
    {"slug": "shopping", "name": "Shopping", "icon": "shopping-bag", "color": "#14B8A6"},
    {"slug": "health", "name": "Health", "icon": "heart-pulse", "color": "#EF4444"},
    {"slug": "bills", "name": "Bills", "icon": "receipt", "color": "#EAB308"},
    {"slug": "other", "name": "Other", "icon": "circle-ellipsis", "color": "#64748B"},
]
