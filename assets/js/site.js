/* Аркадий Осипян — прототип. Монтаж: таймкод = прокрутка, склейки, наезд камеры. */
(function(){
  'use strict';
  var root=document.documentElement, body=document.body;
  var FPS=24, PX_PER_FRAME=1;            // 1px прокрутки = 1 кадр плёнки
  var mqReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  function mkStore(t){return {get:function(k){try{return window[t].getItem(k)}catch(e){return null}},set:function(k,v){try{window[t].setItem(k,v)}catch(e){}},del:function(k){try{window[t].removeItem(k)}catch(e){}}};}
  var local=mkStore('localStorage'), session=mkStore('sessionStorage');
  local.del('ao-motion'); local.del('ao-ph');           // старые версии хранили выбор навсегда

  /* ---------- motion state ----------
     По умолчанию следуем системной настройке prefers-reduced-motion и слушаем её изменения.
     Ручной выбор кнопкой живёт только в этой вкладке (sessionStorage) и запоминает, при какой
     системной настройке он сделан. Если система поменялась — побеждает система, ручной выбор сбрасывается. */
  function sysState(){return mqReduce.matches?'reduce':'no-preference'}
  function readManual(){var v=session.get('ao-motion'); if(!v) return null; var a=v.split('|'); return (a[1]===sysState()&&(a[0]==='on'||a[0]==='off'))?a[0]:null;}
  var manual=readManual(); if(!manual) session.del('ao-motion');
  var motionOn = manual ? manual==='on' : !mqReduce.matches;
  var mBtn=document.querySelector('[data-motion-toggle]'), mLabel=document.querySelector('[data-motion-label]');
  var resumeTimer=0, booted=false;
  function applyMotion(prev){
    if(booted && prev===false && motionOn){            // возобновление: кадр мягко доезжает до текущей позиции
      root.classList.add('motion-resume'); clearTimeout(resumeTimer);
      resumeTimer=setTimeout(function(){root.classList.remove('motion-resume')},750);
    }
    root.setAttribute('data-motion',motionOn?'on':'off');
    if(mBtn){mBtn.setAttribute('aria-pressed',String(!motionOn));mBtn.setAttribute('aria-label',motionOn?'Остановить движение':'Включить движение');}
    if(mLabel) mLabel.textContent = motionOn?'Пауза':'Движение';
    var lv=document.querySelector('[data-loop]');
    if(lv){ if(motionOn && lv.dataset.visible==='1') playSafe(lv); else lv.pause(); }
    /* пауза больше не снимает --push: кадр замирает в текущем масштабе */
    tick();
  }
  if(mBtn) mBtn.addEventListener('click',function(){var prev=motionOn; motionOn=!motionOn; session.set('ao-motion',(motionOn?'on':'off')+'|'+sysState()); applyMotion(prev);});
  function onSysChange(){ var prev=motionOn; session.del('ao-motion'); motionOn=!mqReduce.matches; if(!motionOn) odoFinal(); applyMotion(prev); }
  if(mqReduce.addEventListener) mqReduce.addEventListener('change',onSysChange); else if(mqReduce.addListener) mqReduce.addListener(onSysChange);

  function playSafe(v){var p=v.play(); if(p&&p.catch)p.catch(function(){});}

  /* ---------- timecode ---------- */
  function tc(frames){
    frames=Math.max(0,Math.round(frames));
    var f=frames%FPS, s=Math.floor(frames/FPS), m=Math.floor(s/60), h=Math.floor(m/60);
    function p(n){return (n<10?'0':'')+n}
    return p(h)+':'+p(m%60)+':'+p(s%60)+':'+p(f);
  }
  var tcGlobal=document.querySelectorAll('[data-tc-global]');
  var tcBadge=document.querySelector('.tc-global');
  function setStarts(){
    document.querySelectorAll('[data-scene]').forEach(function(sec){
      var y=sec.getBoundingClientRect().top+window.scrollY;
      sec.querySelectorAll('[data-tc-start]').forEach(function(el){el.textContent=tc(y/PX_PER_FRAME)});
    });
  }

  /* ---------- dolly push-in ---------- */
  var dollies=[].slice.call(document.querySelectorAll('[data-dolly]'));
  var hero=document.querySelector('.hero');
  var sticky=document.querySelector('[data-sticky]');
  var barCta=document.querySelector('[data-bar-cta]');
  var heroCta=document.querySelector('.hero__actions .btn');
  var contact=document.getElementById('contact');
  var quiet=[document.getElementById('terms'),document.getElementById('start')].filter(Boolean);
  var films=document.getElementById('films');   // у фильмотеки свои кнопки: ни липкой, ни кнопки в шапке
  var mqMobile=window.matchMedia('(max-width: 700px)');
  var stickyOn=null;
  var ticking=false;
  function tick(){
    ticking=false;
    var y=window.scrollY, vh=innerHeight;
    var t=tc(y/PX_PER_FRAME);
    for(var i=0;i<tcGlobal.length;i++) tcGlobal[i].textContent=t;
    if(tcBadge) tcBadge.classList.toggle('is-on', y>vh*.6);
    if(motionOn){
      for(var j=0;j<dollies.length;j++){
        var el=dollies[j], r=el.getBoundingClientRect();
        if(r.bottom<-50||r.top>vh+50) continue;
        var p = el.dataset.dolly==='hero' ? Math.min(1,Math.max(0,y/(vh*.9)))
              : Math.min(1,Math.max(0,(vh-r.top)/(vh+r.height)));
        el.style.setProperty('--push',p.toFixed(4));
      }
    }
    /* Одна кнопка «Записаться» на экране (мобильный): кнопка героя → липкая → кнопка в шапке там,
       где липкая мешала бы чтению (условия, раскадровка) → в контакте свои каналы. */
    if(sticky&&hero&&contact){
      var hr=heroCta?heroCta.getBoundingClientRect():hero.getBoundingClientRect();
      var heroCtaVisible = hr.bottom>0 && hr.top<vh;
      var ct=contact.getBoundingClientRect().top, inContact = ct<vh*.7;
      var inQuiet=false;
      for(var k=0;k<quiet.length;k++){var qr=quiet[k].getBoundingClientRect(); if(qr.top<vh*.85 && qr.bottom>vh*.35){inQuiet=true;break;}}
      var inOwn=false; if(films){var fr=films.getBoundingClientRect(); inOwn = fr.top<vh*.7 && fr.bottom>vh*.3;}
      var on = mqMobile.matches && !heroCtaVisible && hero.getBoundingClientRect().bottom<0 && !inContact && !inQuiet && !inOwn;
      if(on!==stickyOn){
        stickyOn=on; sticky.classList.toggle('is-on',on);
        if(on) sticky.removeAttribute('inert'); else { if(document.activeElement===sticky) sticky.blur(); sticky.setAttribute('inert',''); }
      }
      var barOn = !heroCtaVisible && !on && !inContact && !(inOwn && mqMobile.matches);
      root.classList.toggle('cta-bar', barOn);
    }
  }
  function onScroll(){ if(!ticking){ticking=true;requestAnimationFrame(tick);} }
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',function(){setStarts();onScroll();});

  /* ---------- cuts & scene entry ---------- */
  if('IntersectionObserver' in window){
    var cutIO=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-cut'); cutIO.unobserve(e.target);} });
    },{rootMargin:'0px 0px -18% 0px',threshold:0.01});
    document.querySelectorAll('[data-cut]').forEach(function(el){cutIO.observe(el)});
    var sceneIO=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-in'); sceneIO.unobserve(e.target);} });
    },{rootMargin:'0px 0px -30% 0px'});
    document.querySelectorAll('[data-scene]').forEach(function(el){sceneIO.observe(el)});
  } else {
    document.querySelectorAll('[data-cut]').forEach(function(el){el.classList.add('is-cut')});
    document.querySelectorAll('[data-scene]').forEach(function(el){el.classList.add('is-in')});
  }


  /* ---------- record counter: цифры прокручиваются как кадры через фильмовый канал, один раз ----------
     Каждая цифра — лента 0–9,0–9…; анимация шагами (steps), кадр за кадром до нужной цифры.
     reduced motion / пауза до появления блока: сразу финальные значения. Пауза во время прокрутки = стоп-кадр. */
  var odoEls=[].slice.call(document.querySelectorAll('[data-odo] dd')).filter(function(dd){return !dd.closest('.record__tag')});
  odoEls.forEach(function(dd,idx){
    var txt=dd.textContent.trim(); if(!/\d/.test(txt)) return;
    var vis=document.createElement('span'); vis.className='odo'; vis.setAttribute('aria-hidden','true');
    var di=0;
    txt.split('').forEach(function(ch){
      if(!/\d/.test(ch)){ var t=document.createElement('span'); t.textContent=ch; vis.appendChild(t); return; }
      var d=+ch, n=10+d+(di%2?0:10);           // 1–2 полных оборота + до нужной цифры
      var col=document.createElement('span'); col.className='odo__d';
      var strip=document.createElement('span'); strip.className='odo__s';
      var h=''; for(var k=0;k<=n;k++) h+='<span>'+(k%10)+'</span>';
      strip.innerHTML=h;
      strip.style.setProperty('--n',n); strip.style.setProperty('--dur',(n/16).toFixed(2)+'s'); strip.style.setProperty('--delay',(idx*.18+di*.08).toFixed(2)+'s');
      col.style.setProperty('--dur',(n/16).toFixed(2)+'s'); col.style.setProperty('--delay',(idx*.18+di*.08).toFixed(2)+'s');
      col.appendChild(strip); vis.appendChild(col); di++;
    });
    var sr=document.createElement('span'); sr.className='sr'; sr.textContent=txt;
    dd.textContent=''; dd.appendChild(sr); dd.appendChild(vis);
  });
  var odos=[].slice.call(document.querySelectorAll('.odo'));
  function odoFinal(){ odos.forEach(function(o){o.classList.add('odo--static')}); }
  var odoBox=document.querySelector('[data-odo]');
  if(odos.length){
    if(!('IntersectionObserver' in window)) odoFinal();
    else new IntersectionObserver(function(es,obs){
      es.forEach(function(e){ if(!e.isIntersecting) return; obs.disconnect();
        if(motionOn) odos.forEach(function(o){o.classList.add('is-run')}); else odoFinal();
      });
    },{rootMargin:'0px 0px -15% 0px',threshold:.4}).observe(odoBox);
  }

  /* ---------- loop reel (muted fragment) ---------- */
  var loop=document.querySelector('[data-loop]'), loopTc=document.querySelector('[data-loop-tc]');
  if(loop){
    var START=12*FPS;
    loop.addEventListener('timeupdate',function(){ if(loopTc) loopTc.textContent=tc(START+loop.currentTime*FPS); });
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        es.forEach(function(e){
          loop.dataset.visible=e.isIntersecting?'1':'0';
          /* play() сам начинает загрузку: без смены preload и load() — нет оборванного первого запроса */
          if(e.isIntersecting && motionOn){ playSafe(loop); }
          else loop.pause();
        });
      },{threshold:.25}).observe(loop);
    }
  }

  /* ---------- fullscreen player ---------- */
  var dlg=document.querySelector('[data-player]'), full=document.querySelector('[data-full]'), ptc=document.querySelector('[data-player-tc]');
  var opener=null;
  /* Перемотка со стоп-кадра. После loadedmetadata проверяем full.seekable: с HTTP Range (и из file://)
     там весь ролик, ставим currentTime сразу. Хостинг без Range: Chromium отдаёт seekable 0–0 и прыгнуть
     не может вовсе. Тогда один раз скачиваем ролик целиком (fetch → Blob, 3,6 МБ) и играем из blob:-URL,
     он перематывается всегда. Запасной выход по таймауту: играем с начала. */
  var seekJob=null, blobUrl=null, blobPending=null;
  function cancelSeek(){ if(seekJob){ seekJob.stop(); seekJob=null; } }
  function canSeek(t){ try{ var r=full.seekable; for(var i=0;i<r.length;i++){ if(r.start(i)<=t && r.end(i)>=t) return true; } }catch(e){} return false; }
  function whenMeta(fn){ if(full.readyState>=1) fn(); else full.addEventListener('loadedmetadata',fn,{once:true}); }
  function seekAndPlay(t){
    cancelSeek();
    if(!(t>0)){ playSafe(full); return; }
    var alive=true, timer;
    var job={stop:function(){ alive=false; clearTimeout(timer); }}; seekJob=job;
    function go(){ if(!alive) return; try{ full.currentTime=t; }catch(e){} job.stop(); seekJob=null; playSafe(full); }
    full.pause();
    timer=setTimeout(function(){ if(alive){ job.stop(); seekJob=null; playSafe(full); } },15000);
    whenMeta(function(){
      if(!alive) return;
      if(canSeek(t)) return go();
      if(!window.fetch || !window.URL || location.protocol==='file:'){ return go(); }
      if(!blobPending){
        var src=full.currentSrc;
        blobPending=fetch(src).then(function(r){ if(!r.ok) throw new Error(r.status); return r.blob(); })
          .then(function(bl){ blobUrl=URL.createObjectURL(bl); return blobUrl; });
      }
      blobPending.then(function(u){
        if(!alive) return;
        if(full.getAttribute('src')!==u){ full.setAttribute('src',u); full.load(); }
        whenMeta(go);
      },function(){ go(); });
    });
  }
  function openVideo(e){
    if(!dlg) return;
    opener=e.currentTarget;
    var changed=false;
    full.querySelectorAll('source[data-src]').forEach(function(s){ if(!s.getAttribute('src')){ s.setAttribute('src',s.dataset.src); changed=true; } });
    if(changed){ full.preload='auto'; full.load(); }
    if(loop) loop.pause();
    if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','');
    body.style.overflow='hidden';
    var t=parseFloat(opener.getAttribute('data-t')||'0');
    if(!(t>0) && full.readyState>=1 && full.currentTime>0 && !changed){ try{full.currentTime=0}catch(err){} }
    seekAndPlay(t);
    var c=dlg.querySelector('[data-close-video]'); if(c) c.focus();
  }
  function closeVideo(){
    if(!dlg) return;
    cancelSeek(); full.pause();
    if(dlg.open && typeof dlg.close==='function') dlg.close(); else dlg.removeAttribute('open');
  }
  document.querySelectorAll('[data-open-video]').forEach(function(b){b.addEventListener('click',openVideo)});
  if(dlg){
    dlg.querySelector('[data-close-video]').addEventListener('click',closeVideo);
    dlg.addEventListener('close',function(){ full.pause(); body.style.overflow=''; if(opener) opener.focus(); if(loop&&motionOn&&loop.dataset.visible==='1') playSafe(loop); });
    full.addEventListener('timeupdate',function(){ if(ptc) ptc.textContent=tc(full.currentTime*FPS); });
  }

  /* ---------- menu ---------- */
  var menuBtn=document.querySelector('[data-menu]'), nav=document.getElementById('nav');
  if(menuBtn&&nav){
    menuBtn.addEventListener('click',function(){
      var open=menuBtn.getAttribute('aria-expanded')!=='true';
      menuBtn.setAttribute('aria-expanded',String(open)); nav.classList.toggle('is-open',open);
      menuBtn.querySelector('.sr').textContent=open?'Закрыть меню':'Меню';
    });
    nav.addEventListener('click',function(e){ if(e.target.closest('a')){ menuBtn.setAttribute('aria-expanded','false'); nav.classList.remove('is-open'); menuBtn.querySelector('.sr').textContent='Меню'; } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&nav.classList.contains('is-open')){ menuBtn.click(); menuBtn.focus(); } });
  }

  /* ---------- current section in nav ---------- */
  var links={}; document.querySelectorAll('.nav a').forEach(function(a){links[a.getAttribute('href').slice(1)]=a});
  if('IntersectionObserver' in window){
    var navIO=new IntersectionObserver(function(es){
      es.forEach(function(e){ var a=links[e.target.id]; if(!a||!e.isIntersecting) return;
        Object.keys(links).forEach(function(k){links[k].removeAttribute('aria-current')}); a.setAttribute('aria-current','true');
      });
    },{rootMargin:'-45% 0px -50% 0px'});
    document.querySelectorAll('[data-scene]').forEach(function(s){navIO.observe(s)});
  }

  /* ---------- copy message ---------- */
  var copyBtn=document.querySelector('[data-copy]'), msg=document.querySelector('[data-msg]');
  if(copyBtn&&msg){
    copyBtn.addEventListener('click',function(){
      var text=msg.textContent.trim();
      function done(){copyBtn.textContent='Скопировано'; setTimeout(function(){copyBtn.textContent='Скопировать'},1800);}
      if(navigator.clipboard&&window.isSecureContext){ navigator.clipboard.writeText(text).then(done,fallback); } else fallback();
      function fallback(){ var r=document.createRange(); r.selectNodeContents(msg); var s=getSelection(); s.removeAllRanges(); s.addRange(r); try{document.execCommand('copy');done();}catch(e){} }
    });
  }

  /* ---------- placeholders: «чистый показ» ----------
     Скрывает не только теги, а само выдуманное содержимое (все [data-placeholder]): на его месте
     пунктирные «скоро/уточняется», элементы inert (не фокусируются, не читаются скринридером).
     Режим не запоминается: после перезагрузки заглушки снова видны. Для показа можно открыть ?clean или #clean. */
  var phBtn=document.querySelector('[data-ph-toggle]');
  var phEls=[].slice.call(document.querySelectorAll('[data-placeholder]'));
  function applyPh(show){
    body.classList.toggle('ph-hidden',!show);
    phEls.forEach(function(el){ if(show) el.removeAttribute('inert'); else el.setAttribute('inert',''); });
    if(phBtn){ phBtn.setAttribute('aria-pressed',String(!show)); phBtn.innerHTML='Заглушки: <b>'+(show?'видны':'скрыты')+'</b>'; phBtn.setAttribute('aria-label',show?'Скрыть заглушки (чистый показ)':'Показать заглушки'); }
    setStarts();
  }
  applyPh(!/(^|[?&#])clean\b/.test(location.search+location.hash));
  if(phBtn) phBtn.addEventListener('click',function(){ applyPh(body.classList.contains('ph-hidden')); });

  /* ---------- fonts: запасной вариант для file:// ----------
     Chromium грузит woff2 по относительному пути и из file://. Если браузер шрифт не отдал
     (строгая политика file:// в некоторых браузерах), подключаем base64-сборку — уже после отрисовки. */
  if(location.protocol==='file:' && document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){
      var bad=false; document.fonts.forEach(function(f){ if(f.status==='error') bad=true; });
      if(bad){ var l=document.createElement('link'); l.rel='stylesheet'; l.href='assets/css/fonts-embedded.css'; document.head.appendChild(l); }
    });
  }

  /* ---------- go ---------- */
  applyMotion(); booted=true;
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(setStarts); else setStarts();
  addEventListener('load',function(){setStarts();tick();});
})();
