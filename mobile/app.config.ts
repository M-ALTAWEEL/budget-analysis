import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the settings; this adds the one file that must not be in git.
// google-services.json (Firebase, for Android notifications) is uploaded to EAS as a
// secret file (GOOGLE_SERVICES_JSON); on this computer it sits next to this file.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    // Receipt photos (feature F10): the camera, with the reason people see when asked.
    [
      "expo-image-picker",
      {
        cameraPermission: "Budget Analysis uses the camera to read the total on a receipt.",
        photosPermission: false,
        microphonePermission: false,
      },
    ],
    // The home-screen widget (feature F12), Android only.
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "Budget",
            label: "Budget left",
            description: "What is left of this month's budget, and a button to add an expense.",
            minWidth: "180dp",
            minHeight: "110dp",
            targetCellWidth: 3,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
