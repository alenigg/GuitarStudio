const CACHE='guitar-studio-v3-2-0';
const CORE=['./','./index.html','./styles.css','./data.js','./engine.js','./app.js','./game.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
// Installazione: ogni file viene scaricato dalla rete (cache:'reload'), mai dalla cache HTTP del browser,
// altrimenti la nuova versione potrebbe partire con i file della precedente.
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('guitar-studio-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Prima la copia salvata (offline immediato), poi aggiornamento in background.
// Solo le pagine (navigazioni) ricadono su index.html se manca la rete: mai per script o immagini.
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==location.origin)return;
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>{
    const net=fetch(req,{cache:'no-cache'}).then(res=>{if(res&&res.ok&&res.status===200){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return net.then(res=>res||(req.mode==='navigate'?caches.match('./index.html'):Response.error()));
  }));
});
