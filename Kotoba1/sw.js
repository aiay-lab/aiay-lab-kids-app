const CACHE = 'kotoba-quiz-v2';

const APP_FILES = [
  './kotoba1.html',
  './app.js',
  './quiz-data.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

const IMAGE_FILES = [
  'ame-ga-furu','ame-gumo','atsui-oyu','birthday-cake','birthday-cake-dark',
  'chiisai-booru','denki-wo-kesu','denki-wo-tsukeru','doa-wo-akeru','doa-wo-shimeru',
  'icho-namiki','ha-wo-migaku','hana-ga-saku','hanabi-uchiage','hoshi-kirakira',
  'ie-ni-kaeru','inu-ga-aruku','inu-ga-hashiru','kaidan-wo-noboru','kaidan-wo-oriru',
  'kingyo','kutsu-wo-haku','kutsu-wo-nugu',
  'banana','hanbaagu-wo-kiru','hikouki-ga-tobu',
  'naku-kao','neko','tori-ga-tobu',
  'soujiki-de-souji','tori','warau-kao',
  'kaminari-ga-naru','kanashii-kao','kasa-wo-akeru','kasa-wo-shimeru','kumo',
  'mado-wo-akeru','mado-wo-shimeru',
  'kyuukyuusha-ga-tomaru','mijikai-densha-ga-hashiru','momiji-chiru','nagai-densha-ga-hashiru',
  'natsu-no-umi','nezumi','ookii-booru','patokaa-ga-hashiru','ra-men',
  'sakura-chiru','sakura-saku','sora-ga-hareru','sora-ga-hareru2','taiyou-kagayaki',
  'te-wo-arau','te-wo-fuku','terebi-wo-kesu','terebi-wo-tsukeru','tsumetai-mizu',
  'udon','ureshii-kao','usagi-jump','yuki-ga-furu','zou','zou-jump',
  'neru','okiru','ukiwa','tanbarin',
].map(n => `./images/${n}.svg`);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([...APP_FILES, ...IMAGE_FILES]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
