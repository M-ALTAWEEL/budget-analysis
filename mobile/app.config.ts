import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the settings; this adds the one file that must not be in git.
// google-services.json (Firebase, for Android notifications) is uploaded to EAS as a
// secret file (GOOGLE_SERVICES_JSON); on this computer it sits next to this file.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
