import * as SecureStore from 'expo-secure-store';

export type UserSettings = {
  notificationsEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  cloudSyncEnabled: boolean;
};

const KEYS: Record<keyof UserSettings, string> = {
  notificationsEnabled: 'avora.notificationsEnabled',
  aiSuggestionsEnabled: 'avora.aiSuggestionsEnabled',
  cloudSyncEnabled: 'avora.cloudSyncEnabled',
};

function parseBool(value: string | null, defaultValue: boolean) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

export async function loadUserSettings(): Promise<UserSettings> {
  const [notificationsEnabledRaw, aiSuggestionsEnabledRaw, cloudSyncEnabledRaw] = await Promise.all([
    SecureStore.getItemAsync(KEYS.notificationsEnabled),
    SecureStore.getItemAsync(KEYS.aiSuggestionsEnabled),
    SecureStore.getItemAsync(KEYS.cloudSyncEnabled),
  ]);

  return {
    notificationsEnabled: parseBool(notificationsEnabledRaw, true),
    aiSuggestionsEnabled: parseBool(aiSuggestionsEnabledRaw, true),
    cloudSyncEnabled: parseBool(cloudSyncEnabledRaw, true),
  };
}

export async function setUserSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
): Promise<void> {
  await SecureStore.setItemAsync(KEYS[key], value ? 'true' : 'false');
}

