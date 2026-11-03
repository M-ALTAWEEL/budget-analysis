# ibudgi logo kit

## Brand colors
| Name   | Hex       | Use                                  |
|--------|-----------|--------------------------------------|
| Indigo | `#3A36DB` | Primary: icon tile, buttons, links   |
| Coral  | `#FF7A59` | Accent: the coin, highlights only    |
| Ink    | `#15172A` | Text, dark backgrounds               |
| Cream  | `#F4F3EE` | Light page background                |

Font for the wordmark: **Sora SemiBold (600)**, from Google Fonts. The SVG wordmarks are already converted to outlines, so they work without the font installed.

## Folders

### `svg/`: master files, use these wherever you can
- `ibudgi-logo.svg`: icon + name, for light backgrounds (landing-page header)
- `ibudgi-logo-white.svg`: icon + white name, for dark backgrounds (footer, dark mode)
- `ibudgi-icon.svg`: the rounded indigo tile on its own
- `ibudgi-mark.svg` / `-white` / `-ink`: just the bars + coin, no tile
- `ibudgi-wordmark.svg` / `-white`: just the name

### `app/`: React Native app
**Expo (`app.json`)**
```json
{
  "expo": {
    "name": "ibudgi",
    "icon": "./assets/AppIcon-1024.png",
    "ios": { "icon": "./assets/AppIcon-1024.png" },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/ic_launcher_foreground.png",
        "backgroundColor": "#3A36DB"
      }
    },
    "splash": {
      "image": "./assets/splash-logo@2x.png",
      "resizeMode": "contain",
      "backgroundColor": "#3A36DB"
    }
  }
}
```
(Newer Expo versions use the `expo-splash-screen` plugin with the same image and color.)

**Bare React Native**
- iOS: drag `ios/AppIcon-1024.png` into Xcode → Images.xcassets → AppIcon (single-size).
- Android: Android Studio → right-click `res` → New → Image Asset → Foreground = `ic_launcher_foreground.png`, Background color = `#3A36DB`. This generates every mipmap size.
- Splash: use `splash-logo.png` with `react-native-bootsplash`, background `#3A36DB`.
- Store listing: `android/play-store-icon-512.png` for Google Play; App Store uses the 1024 icon.

The iOS and Play Store icons are square on purpose. The stores round the corners themselves.

### `web/`: landing page
Put these files in the site's root (or `public/`) and add this to `<head>`:
```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:image" content="https://YOUR-DOMAIN/og-image.png">
```
`og-image.png` is the preview card shown when the link is shared on WhatsApp, LinkedIn, X, etc.
`icon-192.png` and `icon-512.png` go in `manifest.json` if you make the site installable.

## Rules
- Leave space around the logo at least as wide as the coin.
- Keep the coin coral; never recolor the bars coral.
- Don't stretch, rotate or add shadows/gradients.
- Below 24px, use the icon only, without the name.
