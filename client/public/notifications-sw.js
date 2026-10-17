/******************************************************************/
/*                                                                */
/*  The desktop notifications' service worker (lib/               */
/*  jobNotifications.js) : a notification shown through it can    */
/*  carry buttons - Approve, Reject on a job waiting for an       */
/*  approval - where the browser shows them (Chrome and Edge ;    */
/*  Firefox and Safari show the notification without them).       */
/*                                                                */
/*  It decides nothing itself : the sign-in is the page's, so a   */
/*  click goes to an open AnsibleForms tab, which approves,       */
/*  rejects or opens the job. With no tab open any more, the job  */
/*  opens in a new one, to decide there.                          */
/*                                                                */
/*  No fetch handler : the app's requests never go through it.    */
/*                                                                */
/******************************************************************/

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  // a button (approve, reject, open), or the notification itself : open
  const decision = ['approve', 'reject'].includes(event.action) ? event.action : 'open';
  event.notification.close();
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // the tab in front first, else any : one tab acts, once
      const tab = tabs.find((c) => c.focused) || tabs.find((c) => c.visibilityState === 'visible') || tabs[0];
      if (!tab) {
        // every tab closed : the job opens, the user decides there
        if (data.url) await self.clients.openWindow(data.url);
        return;
      }
      tab.postMessage({ type: 'af-job-notification', decision, id: data.id, form: data.form, open: data.open });
      if (decision === 'open') await tab.focus();
    })(),
  );
});
