/* Static assets only. Learning data stays in the browser, outside this cache. */
const CACHE = 'qicheng-static-v21';
const ASSETS = ['./','./index.html','./styles.css','./details.css','./project.css','./workflow.css','./tutor.css','./content.js','./curriculum.js','./scenario-courses.js','./assets/practice/reading-guide.pdf','./assets/practice/messy-orders.xlsx','./assets/practice/rename-sandbox.zip','./quality-core.js','./workflow-content.js','./workflow-core.js','./core.js','./assets/vendor/marked.umd.js','./markdown.js','./beginner.js','./project-runner.js','./project.js','./workflow.js','./tutor-content.js','./tutor-courses-office.js','./tutor-courses-analysis.js','./tutor-courses-skills.js','./tutor-catalog.js','./tutor-provider.js','./tutor.js','./app.js','./favicon.svg','./manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key=>key.startsWith('qicheng-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached || (event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
