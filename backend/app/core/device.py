"""A short, human name for the device behind a request: "Chrome on Windows".

Shown in Settings → Security next to each session. Deliberately coarse (no versions):
enough for a person to recognise their own devices, not enough to fingerprint them.
"""

# Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
_BROWSERS = [
    ("edg/", "Edge"),
    ("opr/", "Opera"),
    ("samsungbrowser", "Samsung Internet"),
    ("firefox/", "Firefox"),
    ("fxios/", "Firefox"),
    ("crios/", "Chrome"),
    ("chrome/", "Chrome"),
    ("safari/", "Safari"),
]
_SYSTEMS = [
    ("iphone", "iPhone"),
    ("ipad", "iPad"),
    ("android", "Android"),
    ("windows", "Windows"),
    ("mac os x", "macOS"),
    ("macintosh", "macOS"),
    ("cros", "ChromeOS"),
    ("linux", "Linux"),
]


def describe_device(user_agent: str | None, client: str | None = None) -> str:
    """`client` is the X-Client header the mobile apps will send (phase 6)."""
    if client in ("ios", "android"):
        return "iPhone app" if client == "ios" else "Android app"

    ua = (user_agent or "").lower()
    browser = next((name for key, name in _BROWSERS if key in ua), None)
    system = next((name for key, name in _SYSTEMS if key in ua), None)
    if browser and system:
        return f"{browser} on {system}"
    return browser or system or "Unknown device"
