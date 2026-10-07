import * as Notifications from 'expo-notifications';

const DAILY_AI_KIND = 'avora_daily_ai_suggestions';

export async function setDailyAiNotificationEnabled(enabled: boolean) {
  // Ensure handler is consistent across app restarts.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (!enabled) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const matching = scheduled.filter((n) => n.content?.data?.kind === DAILY_AI_KIND);
    await Promise.all(matching.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    return;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== 'granted') return;
  }

  // Remove any existing schedule for this "kind" to avoid duplicates.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matching = scheduled.filter((n) => n.content?.data?.kind === DAILY_AI_KIND);
  await Promise.all(matching.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  // Daily trigger (local time).
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'AI Suggestions',
      body: 'Want a new outfit idea? Tell the stylist what you need on the Home tab.',
      data: { kind: DAILY_AI_KIND },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 0,
    },
  });
}

