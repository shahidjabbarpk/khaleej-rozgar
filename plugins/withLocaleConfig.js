/* Config plugin: Android 13+ "App languages" system setting lists our 5 languages
   (res/xml/locales_config.xml + android:localeConfig). The app itself always starts in English. */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const LOCALES = ['en', 'ar', 'ur', 'hi', 'bn'];

module.exports = function withLocaleConfig(config) {
  config = withDangerousMod(config, ['android', async (cfg) => {
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'locales_config.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<locale-config xmlns:android="http://schemas.android.com/apk/res/android">\n${LOCALES.map((l) => `    <locale android:name="${l}"/>`).join('\n')}\n</locale-config>\n`);
    return cfg;
  }]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:localeConfig'] = '@xml/locales_config';
      app.$['android:supportsRtl'] = 'true';
    }
    return cfg;
  });
};
