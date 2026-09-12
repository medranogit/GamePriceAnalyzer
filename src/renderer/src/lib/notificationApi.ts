import { notification } from 'antd'

type NotificationApi = ReturnType<typeof notification.useNotification>[0]

let currentApi: NotificationApi | null = null

export function registerNotificationApi(api: NotificationApi): void {
  currentApi = api
}

export function dismissAllInAppNotifications(): void {
  currentApi?.destroy()
}
