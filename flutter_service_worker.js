'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {
  "assets/fonts/MaterialIcons-Regular.otf": "71a37f10a31bf50587d18db1de0c3017",
  "assets/AssetManifest.bin": "c4c985f4576ba21e30580ae177852e1d",
  "assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "89ed8f4e49bcdfc0b5bfc9b24591e347",
  "assets/assets/background.png": "5d8b7659cdf1044564710a009b05bba7",
  "assets/shaders/ink_sparkle.frag": "f8b80e740d33eb157090be4e995febdf",
  "assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
  "assets/NOTICES": "8d80cdf9e40c61c0af32860f145b205a",
  "assets/AssetManifest.json": "5c65c4b0c73328224c871f5ebe7fded1",
  "canvaskit/canvaskit.js": "5caccb235fad20e9b72ea6da5a0094e6",
  "canvaskit/skwasm.wasm": "d1fde2560be92c0b07ad9cf9acb10d05",
  "canvaskit/canvaskit.wasm": "d9f69e0f428f695dc3d66b3a83a4aa8e",
  "canvaskit/skwasm.js": "95f16c6690f955a45b2317496983dbe9",
  "canvaskit/chromium/canvaskit.js": "ffb2bb6484d5689d91f393b60664d530",
  "canvaskit/chromium/canvaskit.wasm": "393ec8fb05d94036734f8104fa550a67",
  "canvaskit/skwasm.worker.js": "51253d3321b11ddb8d73fa8aa87d3b15",
  "manifest.json": "8b8bb93ab71ef689f76b7f54a19d02bd",
  "version.json": "d5ffca5f63deae8a816df6d188799414",
  "privacy-policy.html": "6e3c94dc56a778d3c39b8ea04fb33c25",
  "icons/apple-touch-icon.png": "9c008c0d056865b9e6f829b8ef557f6d",
  "icons/icon-192-maskable.png": "761132ed7a4f26bf55b7d719e8110e2b",
  "icons/icon-192.png": "ded194ed3ec9af90c02f79aa88a834a2",
  "icons/icon-512-maskable.png": "8e325895c37486707234e54997e3c9cf",
  "icons/icon-512.png": "e62908e9740cc880dfccc8d6910c2d8f",
  "main.dart.js": "e710d71371877a65ea0ea925c0a7398c",
  "favicon.ico": "32cc726f07dc18fd561d650ee5320293",
  "flutter.js": "6fef97aeca90b426343ba6c5c9dc5d4a",
  "game.html": "0fca2d80015cbddadfbd36b75ce31e62",
  "/": "0fca2d80015cbddadfbd36b75ce31e62"
};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
  "game.html",
  "assets/AssetManifest.json",
  "assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, { 'cache': 'reload' })));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function (event) {
  return event.waitUntil(async function () {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) => {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
