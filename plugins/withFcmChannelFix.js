// expo-notifications writes default_notification_channel_id = "new-jobs" and
// @react-native-firebase/messaging ships the same key with an empty value.
// Mark ours with tools:replace so the manifest merger keeps "new-jobs".
const { withAndroidManifest } = require('expo/config-plugins');

const KEYS = [
  'com.google.firebase.messaging.default_notification_channel_id',
  'com.google.firebase.messaging.default_notification_icon',
];

module.exports = function withFcmChannelFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const m = cfg.modResults.manifest;
    m.$['xmlns:tools'] = m.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    for (const app of m.application || []) {
      for (const md of app['meta-data'] || []) {
        if (!KEYS.includes(md.$['android:name'])) continue;
        const attr = md.$['android:value'] !== undefined ? 'android:value' : 'android:resource';
        const cur = (md.$['tools:replace'] || '').split(',').filter(Boolean);
        if (!cur.includes(attr)) md.$['tools:replace'] = [...cur, attr].join(',');
      }
    }
    return cfg;
  });
};
