/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { API_PREFIX, handleApi, isApiRequest } from './api'
import { CONTRIBUTIONS_KEY, type Contribution } from './collage/layout'
import { load } from './store/db'

declare let self: ServiceWorkerGlobalScope

// A new version takes over at once, as the app registers with autoUpdate.
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// The interface lives in this worker, so its paths must not fall back to the app shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [new RegExp(`^${API_PREFIX}`)] }))
registerRoute(isApiRequest, ({ url }) => handleApi(url.pathname, () => load<Contribution[]>(CONTRIBUTIONS_KEY)))
