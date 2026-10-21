import { Platform } from 'react-native';

// Local server (supported via 'adb reverse tcp:3000 tcp:3000' for physical devices and localhost for emulators)
// export const API_URL = 'http://localhost:3000/api';

// Production API URL hosted on Railway (uncomment once changes are pushed to Railway)
export const API_URL = 'https://nufi-production.up.railway.app/api';

// Configurable Privacy Policy URL
export const PRIVACY_POLICY_URL = 'https://nufi.up.railway.app/privacy-policy';

if (!__DEV__ && !PRIVACY_POLICY_URL) {
  throw new Error('Fatal: PRIVACY_POLICY_URL must be configured for Health Connect compliance in production.');
}
