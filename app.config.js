module.exports = ({ config }) => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const suffix = '.apps.googleusercontent.com';
  if (!clientId?.endsWith(suffix)) return config;
  const iosUrlScheme = 'com.googleusercontent.apps.' + clientId.slice(0, -suffix.length);
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
  };
};
