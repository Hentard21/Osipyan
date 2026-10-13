Аркадий Осипян — прототип сайта (статичный HTML/CSS/JS, без сборки).
Откройте index.html двойным щелчком: всё работает прямо из файла. Шрифты — woff2 из assets/fonts/ (в site.css, font-display:swap).
Если браузер не отдаёт шрифты из file://, site.js сам подключит запасной assets/css/fonts-embedded.css (base64).
Для «чистого показа» без заглушек: index.html?clean (или кнопка «Заглушки» в футере; режим не запоминается).

assets/css/site.css   — вся вёрстка
assets/css/fonts-embedded.css — запасная base64-сборка шрифтов только для file://; на хостинге не грузится
assets/fonts/          — Sofia Sans Extra Condensed + Golos Text (OFL), woff2 + лицензии
assets/js/site.js     — тайм-код от прокрутки, склейки, наезд камеры, видео, пауза движения, заглушки
assets/img/           — реальные фото с общим плёночным грейдом (webp); m-*.webp — обложки Фильмотеки; og-1200.jpg — превью для соцсетей
assets/favicon.svg, favicon-32.png, apple-touch-icon.png — монограмма AO
assets/video/         — архив «работа на лапах»: петля 6 с и полная запись 30 с (mp4 H.264 + webm VP9), без звука

Заглушки помечены [заглушка] и data-placeholder, полный список — ../PLACEHOLDERS.md.
Факты из досье, которые ещё надо подтвердить, помечены [сверить] и data-verify (список в ../PLACEHOLDERS.md → «Сверить»).
Перед публикацией: grep -c data-placeholder index.html должен вернуть 0, теги class="vf" сняты,
снят noindex (meta robots в index.html и X-Robots-Tag в vercel.json), og:image заменён на абсолютный URL.

Vercel: папку site/ можно деплоить как есть (статический сайт без сборки, Framework Preset: Other,
Output Directory: .). vercel.json задаёт noindex на превью и кэш: шрифты 1 год, фото и видео 7 дней, css/js 1 час.
Vercel отдаёт видео с HTTP Range, перемотка со стоп-кадров работает напрямую.
Перемотка полного ролика со стоп-кадров работает и на хостинге без HTTP Range (запасной путь: ролик скачивается целиком, 3,6 МБ).

v6 (13.10.2026)
Порядок сцен: герой → для кого → тренировка → метод → карьера → цены (карусель пакетов) → отзывы → вопросы → контакт → фильмотека → титры.
assets/js/i18n.js     — словарь EN/HY (+ строки JS/CSS для RU). RU-тексты разметки правятся прямо в index.html (data-i18n="ключ").
                        Новый текст: data-i18n="ключ" в разметке + перевод в i18n.js (en, hy). Атрибуты: data-i18n-attr="alt:ключ".
                        Язык: ?lang=ru|en|hy → localStorage ao-lang → язык браузера. EN/HY нужно вычитать носителю.
Тема: кнопка-полукруг в шапке; по умолчанию тёмная, учитывает prefers-color-scheme, выбор в localStorage ao-theme.
assets/fonts/noto-armenian-*.woff2 — Noto Sans Armenian (OFL, NotoSansArmenian-OFL.txt), condensed для заголовков и текстовый;
                        грузятся только при армянском тексте (unicode-range). В fonts-embedded.css (запасной base64 для file://) их нет.
Цены пакетов: data-amd="число" — форматируются по языку; валюта из словаря (cur).
WhatsApp-ссылки: data-wa="ключ сообщения" (+ data-wa-pkg для названия пакета) — текст собирается на языке страницы.
