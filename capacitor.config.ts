import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onebyte.coder',
  appName: '2OneByte-Coder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    buildOptions: {
      keystorePath: process.env.KEYSTORE_PATH,
      keystorePassword: process.env.KEYSTORE_PASSWORD,
      keystoreAlias: process.env.KEYSTORE_ALIAS,
      keystoreAliasPassword: process.env.KEYSTORE_ALIAS_PASSWORD,
      releaseType: 'APK'
    },
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0f172a',
    loggingBehavior: 'debug',
    appendUserAgent: '2OneByte-Coder/1.0',
    permissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.MANAGE_EXTERNAL_STORAGE'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: true
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    Haptics: {
      enabled: true
    },
    Preferences: {
      group: '2onebyte-coder-prefs'
    },
    App: {
      launchUrl: '/'
    }
  }
};

export default config;