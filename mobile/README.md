# Budget Analysis: mobile app

The iPhone and Android app (Expo, React Native). Same screens, texts and rules as the website.

## Run it
```
npm install
npx expo start
```
Scan the QR code with Expo Go. The app talks to the staging API
(`EXPO_PUBLIC_API_URL` to change it).

## Shared with the website
Types, texts (3 languages), API calls, and the month and money rules are copied from
`frontend/src`. Edit them there, then:
```
npm run sync-shared
```
CI fails if they drift (`node scripts/sync-shared.mjs --check`).
