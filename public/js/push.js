/**
 * Push Notifications registration and subscription helper.
 * Requires window.VAPID_PUBLIC_KEY to be set by the server (injected into HTML) or inline script.
 */
async function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('SW registration failed', e);
    return null;
  }
}

async function ensurePushSubscription(currentUserEmail) {
  if (!('Notification' in window)) return null;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  if (Notification.permission !== 'granted') return null;

  const reg = await registerServiceWorker();
  if (!reg || !('pushManager' in reg)) return null;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    if (!window.VAPID_PUBLIC_KEY) {
      console.warn('VAPID_PUBLIC_KEY not present on window. Cannot subscribe to push.');
      return null;
    }
    const appServerKey = await urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
  }

  // Send to server
  try {
    await fetch('/api/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUserEmail, subscription: sub })
    });
  } catch (e) {
    console.error('Failed to save subscription', e);
  }
  return sub;
}

// Expose globally
window.ChatPush = { ensurePushSubscription };
