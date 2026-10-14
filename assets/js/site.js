/* Аркадий Осипян — прототип. Монтаж: таймкод = прокрутка, склейки, наезд камеры. */
(function(){
  'use strict';
  var root=document.documentElement, body=document.body;
  var FPS=24, PX_PER_FRAME=1;            // 1px прокрутки = 1 кадр плёнки
  var mqReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  function mkStore(t){return {get:function(k){try{return window[t].getItem(k)}catch(e){return null}},set:function(k,v){try{window[t].setItem(k,v)}catch(e){}},del:function(k){try{window[t].removeItem(k)}catch(e){}}};}
  var local=mkStore('localStorage'), session=mkStore('sessionStorage');
  var D=window.AO_I18N||{ui:{ru:{}},meta:{ru:{}},edl:{}}, LANG=root.getAttribute('lang')||'ru';
  function T(k){ var u=D.ui[LANG]||{}; return (k in u)?u[k]:(D.ui.ru[k]||k); }
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
    root.setAttribute('data-motion',motionOn?'on':'off'); if(window.__aoTvSync) window.__aoTvSync(); if(window.__aoHeroSync) window.__aoHeroSync(); if(window.__aoReelsSync) window.__aoReelsSync(); if(window.__aoContactSync) window.__aoContactSync(); if(window.__aoFxSync) window.__aoFxSync();
    if(mBtn){mBtn.setAttribute('aria-pressed',String(!motionOn));mBtn.setAttribute('aria-label',motionOn?T('motion_off'):T('motion_on'));}
    if(mLabel) mLabel.textContent = motionOn?T('pause'):T('play');
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
  var quiet=[document.getElementById('prices'),document.getElementById('faq')].filter(Boolean);
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
    var txt=(dd.getAttribute('data-value')||dd.textContent).trim(); if(!/\d/.test(txt)) return;
    var vis=document.createElement('span'); vis.className='odo'; vis.setAttribute('aria-hidden','true'); vis.setAttribute('translate','no');
    var di=0;
    txt.split('').forEach(function(ch){
      if(!/\d/.test(ch)){ var t=document.createElement('span'); t.className='odo__sep'; t.setAttribute('data-ch',ch); vis.appendChild(t); return; }
      var d=+ch, n=10+d+(di%2?0:10);           // 1–2 полных оборота + до нужной цифры
      var col=document.createElement('span'); col.className='odo__d';
      var strip=document.createElement('span'); strip.className='odo__s';   /* цифры ленты рисует CSS (::before), в DOM-тексте их нет */
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
      menuBtn.setAttribute('aria-expanded',String(open)); nav.classList.toggle('is-open',open); root.classList.toggle('nav-open',open);
      menuBtn.querySelector('.sr').textContent=open?T('menu_close'):T('menu');
    });
    nav.addEventListener('click',function(e){ if(e.target.closest('a')){ menuBtn.setAttribute('aria-expanded','false'); nav.classList.remove('is-open'); root.classList.remove('nav-open'); menuBtn.querySelector('.sr').textContent=T('menu'); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&nav.classList.contains('is-open')){ menuBtn.click(); menuBtn.focus(); } });
  }

  /* ---------- current section in nav ---------- */
  /* v13: подсветка считается по позиции прокрутки, а не по событиям IO — на герое и в разделах без пункта меню подсветки нет */
  var links={}; document.querySelectorAll('.nav a:not(.btn)').forEach(function(a){links[a.getAttribute('href').slice(1)]=a});
  var scenes=[].slice.call(document.querySelectorAll('[data-scene]')), navTick=false, navCur=null;
  function navSync(){ navTick=false; var line=innerHeight*.45, id=null;
    for(var i=0;i<scenes.length;i++){ var r=scenes[i].getBoundingClientRect(); if(r.top<=line&&r.bottom>line){ id=scenes[i].id; break; } }
    if(window.scrollY<innerHeight*.5) id=null;
    var a=id&&links[id]||null; if(a===navCur) return; navCur=a;
    Object.keys(links).forEach(function(k){links[k].removeAttribute('aria-current')}); if(a) a.setAttribute('aria-current','true'); }
  addEventListener('scroll',function(){ if(!navTick){ navTick=true; requestAnimationFrame(navSync); } },{passive:true});
  addEventListener('resize',navSync); navSync();

  /* ---------- copy message ---------- */
  var copyBtn=document.querySelector('[data-copy]'), msg=document.querySelector('[data-msg]');
  if(copyBtn&&msg){
    copyBtn.addEventListener('click',function(){
      var text=msg.textContent.trim();
      function done(){copyBtn.textContent=T('copied'); setTimeout(function(){copyBtn.textContent=T('copy')},1800);}
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
    if(phBtn){ phBtn.setAttribute('aria-pressed',String(!show)); phBtn.innerHTML=T('ph_btn')+': <b>'+(show?T('ph_shown'):T('ph_hidden'))+'</b>'; phBtn.setAttribute('aria-label',show?T('ph_hide_aria'):T('ph_show_aria')); }
    setStarts();
  }
  var phShow=!/(^|[?&#])clean\b/.test(location.search+location.hash);
  applyPh(phShow);
  if(phBtn) phBtn.addEventListener('click',function(){ phShow=body.classList.contains('ph-hidden'); applyPh(phShow); });

  /* ---------- языки RU / EN / HY ----------
     Порядок выбора: ?lang= → localStorage → navigator.language (решено inline-скриптом в <head>).
     RU-тексты разметки снимаются из DOM один раз; EN и HY — из AO_I18N. */
  var RU={}, RUA={};
  var i18nEls=[].slice.call(document.querySelectorAll('[data-i18n]'));
  var i18nAttrEls=[].slice.call(document.querySelectorAll('[data-i18n-attr]'));
  i18nEls.forEach(function(el){ var k=el.getAttribute('data-i18n'); if(!(k in RU)) RU[k]=el.innerHTML; el.__ru=el.innerHTML; });
  i18nAttrEls.forEach(function(el){ el.__ruA={}; el.getAttribute('data-i18n-attr').split(',').forEach(function(p){ var a=p.split(':'); el.__ruA[a[0]]=el.getAttribute(a[0])||''; }); });
  var edlCells=[].slice.call(document.querySelectorAll('.edl__op,.edl__res,.edl__how,.edl__ev i'));
  edlCells.forEach(function(td){ td.__ru=td.textContent; });
  var dates=[].slice.call(document.querySelectorAll('.edl__date'));
  dates.forEach(function(td){ td.__ru=td.textContent; });
  function S(k){ if(LANG==='ru') return RU[k]!=null?RU[k]:T(k); var d=D[LANG]||{}; return (k in d)?d[k]:(RU[k]!=null?RU[k]:T(k)); }
  function plain(html){ var t=document.createElement('div'); t.innerHTML=html; return t.textContent.replace(/\s+/g,' ').trim(); }
  function fmtNum(n){ try{ return new Intl.NumberFormat(D.meta[LANG].num,{maximumFractionDigits:0}).format(n).replace(/[\u202f,]/g, LANG==='en'?',':'\u00a0'); }catch(e){ return String(n); } }
  function fmtDate(s){ var m=s.match(/(\d\d)\.(\d\d)\.(\d{4})/); if(!m) return s; if(LANG==='en'){ try{ return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(+m[3],+m[2]-1,+m[1])); }catch(e){} } return s; }
  function cssStr(v){ return '"'+String(v).replace(/"/g,'\\"')+'"'; }
  function waHref(el){ var key=el.getAttribute('data-wa'), txt=T(key); if(LANG==='ru'&&key==='wa_hello') txt=plain(RU.wa_hello||txt);
    var pk=el.getAttribute('data-wa-pkg'); if(pk) txt=txt.replace('{p}',plain(S(pk)));
    return 'https://wa.me/79891291118?text='+encodeURIComponent(txt); }
  var langBtns=[].slice.call(document.querySelectorAll('[data-lang]'));
  function applyLang(l){
    LANG=l; root.setAttribute('lang',l);
    i18nEls.forEach(function(el){ var k=el.getAttribute('data-i18n'); var v=(l==='ru')?el.__ru:S(k); if(el.innerHTML!==v) el.innerHTML=v; });
    i18nAttrEls.forEach(function(el){ el.getAttribute('data-i18n-attr').split(',').forEach(function(p){ var a=p.split(':'); var v=(l==='ru')?el.__ruA[a[0]]:plain(S(a[1])); el.setAttribute(a[0],v); }); });
    var map=(D.edl&&D.edl[l])||{};
    edlCells.forEach(function(td){ td.textContent=(l==='ru')?td.__ru:(map[td.__ru]||td.__ru); });
    dates.forEach(function(td){ td.textContent=fmtDate(td.__ru); });
    document.querySelectorAll('.ph:not([data-i18n])').forEach(function(e){ e.textContent=T('ph'); });
    document.querySelectorAll('.vf').forEach(function(e){ e.textContent=T('vf'); });
    var cur=D.meta[l].cur;
    document.querySelectorAll('[data-amd]').forEach(function(e){ e.textContent=fmtNum(+e.getAttribute('data-amd')); });
    document.querySelectorAll('[data-amd-inline]').forEach(function(e){ e.textContent=fmtNum(+e.getAttribute('data-amd-inline'))+'\u00a0'+cur; });
    document.querySelectorAll('[data-wa]').forEach(function(a){ a.href=waHref(a); });
    /* строки, которые раньше жили в CSS content: */
    [['--t-soon','t_soon'],['--t-record','t_record'],['--t-review','t_review'],['--t-price','t_price'],['--t-tbc','t_tbc'],['--t-films','t_films'],['--t-open','t_open'],['--t-close','t_close']].forEach(function(p){ root.style.setProperty(p[0],cssStr(T(p[1]))); });
    var m=D.meta[l]; document.title=m.title;
    var set=function(sel,attr,v){ var e=document.querySelector(sel); if(e) e.setAttribute(attr,v); };
    set('meta[name="description"]','content',m.desc); set('meta[property="og:title"]','content',m.title); set('meta[property="og:description"]','content',m.desc); set('meta[property="og:locale"]','content',m.locale);
    langBtns.forEach(function(b){ b.setAttribute('aria-pressed',String(b.getAttribute('data-lang')===l)); });
    if(copyBtn) copyBtn.textContent=T('copy');
    if(menuBtn) menuBtn.querySelector('.sr').textContent=(menuBtn.getAttribute('aria-expanded')==='true')?T('menu_close'):T('menu');
    applyMotion(); applyPh(phShow); applyTheme(); if(window.__aoCar) window.__aoCar.relabel();
    setStarts();
  }
  langBtns.forEach(function(b){ b.addEventListener('click',function(){ var l=b.getAttribute('data-lang'); local.set('ao-lang',l);
    if(/[?&]lang=/.test(location.search) && history.replaceState){ history.replaceState(null,'',location.pathname+location.search.replace(/([?&])lang=(ru|en|hy)&?/,'$1').replace(/[?&]$/,'')+location.hash); }
    applyLang(l); }); });

  /* ---------- тема: тёмная по умолчанию, светлая только по выбору (localStorage) ---------- */
  var thBtn=document.querySelector('[data-theme-toggle]'), thLabel=document.querySelector('[data-theme-label]');
  function applyTheme(){ var t=root.getAttribute('data-theme')==='light'?'light':'dark';
    if(thBtn){ thBtn.setAttribute('aria-pressed',String(t==='light')); thBtn.setAttribute('title',t==='light'?T('theme_dark'):T('theme_light')); }
    if(thLabel) thLabel.textContent=t==='light'?T('theme_dark'):T('theme_light');
    var mc=document.querySelector('meta[name="theme-color"]'); if(mc) mc.setAttribute('content',t==='light'?'#efe7d8':'#0d0b09'); }
  if(thBtn) thBtn.addEventListener('click',function(){ var t=root.getAttribute('data-theme')==='light'?'dark':'light'; root.setAttribute('data-theme',t); local.set('ao-theme',t); applyTheme(); });
  /* v17: всегда тёмная по умолчанию; светлая — только если пользователь выбрал её кнопкой (ao-theme=light) */

  /* ---------- цены (v12): плёночная карусель v10 с контентом v11; открывается на «12 занятий», фон — ролик активного кадра в родной скорости ---------- */
  (function(){
    var car=document.querySelector('[data-carousel]'); if(!car) return;
    var track=car.querySelector('[data-track]'), cards=[].slice.call(track.querySelectorAll('.pk__card'));
    var dotsBox=car.querySelector('[data-dots]'), count=car.querySelector('[data-count]');
    var prev=car.querySelector('[data-prev]'), next=car.querySelector('[data-next]');
    var active=-1, dots=[];
    cards.forEach(function(c,i){ var b=document.createElement('button'); b.type='button'; b.className='pk__dot';
      b.addEventListener('click',function(){ go(i); }); dotsBox.appendChild(b); dots.push(b); });
    function reduced(){ return !motionOn; }
    function center(c){ return c.offsetLeft + c.offsetWidth/2 - track.clientWidth/2; }
    function go(i,instant){ i=Math.max(0,Math.min(cards.length-1,i));
      if(!reduced() && !instant && i!==active){ car.classList.remove('is-advance'); void car.offsetWidth; car.classList.add('is-advance'); }
      track.scrollTo({left:center(cards[i]),behavior:(reduced()||instant)?'auto':'smooth'}); setActive(i); }
    function setActive(i){ if(i===active) return; active=i;
      cards.forEach(function(c,k){ c.classList.toggle('is-active',k===i); c.setAttribute('aria-label',T('slide').replace('{i}',k+1).replace('{n}',cards.length)+': '+plain(c.querySelector('.pk__name').innerHTML));
        var cta=c.querySelector('.pk__cta'); if(cta) cta.tabIndex = (k===i)?0:-1; });
      dots.forEach(function(d,k){ d.setAttribute('aria-current',k===i?'true':'false'); });
      if(count) count.textContent=(i+1)+' / '+cards.length;
      if(prev) prev.disabled=(i===0); if(next) next.disabled=(i===cards.length-1);  tvChange(i); }
    var st=0; track.addEventListener('scroll',function(){ clearTimeout(st); st=setTimeout(function(){
      var best=0,bd=1e9,mid=track.scrollLeft+track.clientWidth/2;
      cards.forEach(function(c,k){ var d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid); if(d<bd){bd=d;best=k;} }); setActive(best); },60); },{passive:true});
    if(prev) prev.addEventListener('click',function(){ go(active-1); });
    if(next) next.addEventListener('click',function(){ go(active+1); });
    track.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'){ e.preventDefault(); go(active+1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); go(active-1); }
      else if(e.key==='Home'){ e.preventDefault(); go(0); } else if(e.key==='End'){ e.preventDefault(); go(cards.length-1); } });
    /* клик по соседнему кадру — подтянуть его в центр */
    cards.forEach(function(c,k){ c.addEventListener('click',function(e){ if(k!==active && !e.target.closest('a')){ go(k); } }); });

    /* ---------- живой фон раздела цен: ролик пакета за плёнкой, кроссфейд при смене ---------- */
    /* Фоны пакетов. Чтобы добавить ролик — одна строка: имя файла в assets/video/bg/ (нужны NAME.mp4 и NAME.webp).
       Пакеты берут ролики по кругу: пакет 1 — первый ролик, пакет 2 — второй и т. д.
       v10: у всех трёх карточек ролик задан в data-clip (группы — fight-a, 12 занятий — punch-b, видеокурс — focus-a).
       Ролики заранее замедлены в 2 раза, без блюра; аналоговый ТВ-вид — в CSS (см. CHANGELOG v8). Запасной: walkout-b. */
    var BG_CLIPS=['focus-a','fight-a','punch-b','walkout-a','focus-b','punch-a','fight-b'], BG_RATE=1;
    cards.forEach(function(c,k){ var n=BG_CLIPS[k%BG_CLIPS.length]; if(!c.getAttribute('data-clip')){ c.setAttribute('data-clip','assets/video/bg/'+n+'.mp4'); c.setAttribute('data-poster','assets/video/bg/'+n+'.webp'); } });
    var bgBox=document.querySelector('[data-pkbg]'), vids=bgBox?[].slice.call(bgBox.querySelectorAll('video')):[], cur=0, inView=false, seen=false, shownK=-1;
    function tvChange(i){ if(!bgBox||!seen) return; show(i); }
    function setSrc(v,src,live){ if(live){ if(v.getAttribute('src')!==src) v.setAttribute('src',src); }
      else if(v.getAttribute('src')&&v.getAttribute('src')!==src){ v.removeAttribute('src'); v.load(); } }   // v13: на паузе — постер этого пакета, а не стоп-кадр чужого ролика
    function show(i,quiet){ var card=cards[i]; if(!card) return;
      var src=card.getAttribute('data-clip'), poster=card.getAttribute('data-poster'), live=inView&&motionOn;
      var v=vids[cur];
      if(i!==shownK){ if(rewV){ rv.pause(); rv.classList.remove('is-on'); bgBox.classList.remove('is-rew'); rewV=null; } shownK=i; cur=1-cur; var nv=vids[cur];
        nv.setAttribute('poster',poster);
        setSrc(nv,src,live);
        nv.classList.add('is-on'); v.classList.remove('is-on');
        if(motionOn&&!quiet&&!reduced()){ bgBox.classList.remove('is-static'); void bgBox.offsetWidth; bgBox.classList.add('is-static'); }
        v.pause(); v=nv; }
      if(live){ if(v.getAttribute('src')!==src) v.setAttribute('src',src); v.defaultPlaybackRate=v.playbackRate=BG_RATE; var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
      else { v.pause(); setSrc(v,src,false); } }
    function sync(){ if(!seen||active<0) return; shownK=-2; cur=1-cur; show(active,true); }   // v13: без «помех» при возобновлении/входе в кадр
    if(bgBox){
      bgBox.addEventListener('animationend',function(e){ if(e.animationName==='pk-static') bgBox.classList.remove('is-static'); });
      if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ es.forEach(function(e){ inView=e.isIntersecting; if(inView) seen=true; if(seen){ if(inView) sync(); else vids.forEach(function(v){v.pause();}); } }); },{rootMargin:'100px 0px'}).observe(bgBox.parentNode); }
      else { inView=seen=true; } }
    /* v15: VHS-перемотка — заранее отрендеренный обратный ролик (NAME-rev.mp4: весь клип задом наперёд, ×3.5, ~0,87 с)
       на отдельном слое поверх. Первый кадр rev = последний кадр клипа, поэтому стык без скачка; в конце rev = первый кадр,
       основной ролик уже стоит на 0 — короткий кроссфейд и дальше play. Reduced motion: кроссфейд через тёмный кадр. */
    var rv=document.createElement('video'); rv.className='pk-bg__v pk-bg__rv'; rv.muted=true; rv.playsInline=true; rv.setAttribute('playsinline',''); rv.preload='auto'; rv.setAttribute('aria-hidden','true');
    if(bgBox) bgBox.insertBefore(rv,bgBox.querySelector('.pk-bg__shade'));
    var rewV=null;
    function revSrc(v){ var s=v.getAttribute('src')||''; return s.replace(/\.mp4$/,'-rev.mp4'); }
    function prepRev(v){ var r=revSrc(v); if(r&&rv.getAttribute('src')!==r){ rv.setAttribute('src',r); rv.load(); } }
    function rewEnd(v){ if(bgBox){ bgBox.classList.remove('is-rew'); rv.classList.remove('is-on'); } rewV=null;
      try{ v.currentTime=0; }catch(e){}
      if(inView&&motionOn&&v.classList.contains('is-on')){ var p=v.play(); if(p&&p.catch) p.catch(function(){}); } }
    function rewind(v){ if(!v.classList.contains('is-on')){ v.currentTime=0; return; }
      if(!motionOn||!inView){ rewEnd(v); return; }
      if(mqReduce.matches){ bgBox.classList.add('is-rewfade'); setTimeout(function(){ v.currentTime=0; var p=v.play(); if(p&&p.catch) p.catch(function(){}); bgBox.classList.remove('is-rewfade'); },260); return; }
      prepRev(v); if(rv.readyState<2){ rewEnd(v); return; }   // обратный ролик ещё не готов — просто с начала
      rewV=v; rv.currentTime=0; rv.classList.add('is-on'); bgBox.classList.add('is-rew');
      var p=rv.play(); if(p&&p.catch) p.catch(function(){ rewEnd(v); });
      v.currentTime=0; }
    rv.addEventListener('ended',function(){ if(rewV) rewEnd(rewV); });
    vids.forEach(function(v){ v.addEventListener('ended',function(){ rewind(v); }); v.addEventListener('playing',function(){ if(v.classList.contains('is-on')) prepRev(v); }); });
    window.__aoRewind=function(){ var v=vids[cur]; if(v) rewind(v); };
    window.__aoTvSync=function(){ if(!motionOn) vids.forEach(function(v){v.pause();}); sync(); };
    car.addEventListener('animationend',function(){ car.classList.remove('is-advance'); });
    var pop=cards.findIndex?cards.findIndex(function(c){return c.classList.contains('is-pop')}):2;
    window.__aoCar={relabel:function(){ var a=active; active=-1; setActive(a<0?pop:a);
      dots.forEach(function(d,k){ d.setAttribute('aria-label',T('dot').replace('{i}',k+1).replace('{name}',plain(cards[k].querySelector('.pk__name').innerHTML))); }); }};
    window.__aoCar.relabel();
    function init(){ go(pop<0?0:pop,true); }
    if(document.readyState==='complete') init(); else addEventListener('load',init);
    addEventListener('resize',function(){ if(active>=0) track.scrollTo({left:center(cards[active])}); });
  })();
  /* ---------- v13: «Голоса из зала» — сторис ----------
     Данные: одна запись = один отзыв. Текстовые поля — ключ i18n ('s1_q') или объект {ru,en,hy}.
     poster — картинка обложки (без неё — тёмный постер с большой буквой имени); video — ролик (необязателен):
     в ряду идёт беззвучным превью (если движение включено), в просмотрщике — со звуком и контролами.
     v14: у заглушек медиа нет — дизайн-обложка с буквой; poster/video добавляются к записи, когда будут настоящие.
     nums — до двух цифр [значение, ключ подписи]. ph:true — пометка [заглушка]. */
  var REVIEWS=window.AO_REVIEWS||[
    {name:'s1_n',meta:'s1_s',quote:'s1_q',result:'s1_hl',ph:true,
     details:{goal:'s1_a2',doubt:'s1_b',first:'s1_c2',res:'s1_d2'},nums:[['20','sn_w'],['38','sn_s']]},
    {name:'s3_n',meta:'s3_s',quote:'s3_q',result:'s3_hl',ph:true,
     details:{goal:'s3_a2',doubt:'s3_b',first:'s3_c2',res:'s3_d2'},nums:[['52','sn_w'],['96','sn_s']]},
    {name:'s2_n',meta:'s2_s',quote:'s2_q',result:'s2_hl',ph:true,
     details:{goal:'s2_a2',doubt:'s2_b',first:'s2_c2',res:'s2_d2'},nums:[['32','sn_w'],['60','sn_s']]},
    {name:'s4_n',meta:'s4_s',quote:'s4_q',result:'s4_hl',ph:true,
     details:{goal:'s4_a2',doubt:'s4_b',first:'s4_c2',res:'s4_d2'},nums:[['12','sn_w'],['24','sn_s']]}
  ];
  (function(){
    var row=document.querySelector('[data-reels]'), dlg=document.querySelector('[data-rvv]'); if(!row||!dlg) return;
    if(dlg.parentNode!==body) body.appendChild(dlg);           // вне секций с transform/inert
    function tx(v){ if(v==null) return ''; if(typeof v==='object') return v[LANG]||v.ru||''; return plain(S(v)); }
    function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    function initial(r){ return (tx(r.name).trim()[0]||'').toUpperCase(); }
    var phTag='<span class="ph">'+esc(T('ph'))+'</span>';
    /* ряд карточек */
    var cards=REVIEWS.map(function(r,i){
      var li=document.createElement('li'); li.className='rcard'+(r.video?' rcard--video':'')+(r.poster?'':' rcard--blank');
      li.innerHTML='<button class="rcard__btn" type="button"><span class="rcard__cover" aria-hidden="true">'+
        (r.poster?'<img src="'+r.poster+'" alt="" loading="lazy" decoding="async" width="540" height="960">':'<span class="rcard__init"></span>')+
        '</span>'+
        '<span class="rcard__txt"><span class="rcard__who"></span><span class="rcard__q"></span><span class="rcard__chip"></span></span></button>';
      row.appendChild(li);
      li.querySelector('button').addEventListener('click',function(){ open(i,li.querySelector('button')); });
      return li; });
    function fill(){
      cards.forEach(function(li,i){ var r=REVIEWS[i];
        li.querySelector('.rcard__who').innerHTML='<b>'+esc(tx(r.name))+'</b>'+(r.ph?' '+'<span class="ph">'+esc(T('ph'))+'</span>':'');
        li.querySelector('.rcard__q').textContent='«'+tx(r.quote)+'»';
        li.querySelector('.rcard__chip').textContent=tx(r.result);
        var ini=li.querySelector('.rcard__init'); if(ini) ini.textContent=initial(r);
        li.querySelector('button').setAttribute('aria-label',T('rv_open').replace('{name}',tx(r.name))+(r.video?' ('+T('rv_vid')+')':'')+'. '+tx(r.quote)); });
      if(cur>=0) render(); }
    /* превью-видео в карточках: только когда движение включено и карточка видна */
    var vis={};
    function previews(){ cards.forEach(function(li,i){ var r=REVIEWS[i]; if(!r.video) return;
      var v=li.querySelector('video.rcard__vid'), want=motionOn&&vis[i]&&!dlg.open;
      if(want){ if(!v){ v=document.createElement('video'); v.className='rcard__vid'; v.muted=true; v.loop=true; v.playsInline=true; v.setAttribute('playsinline',''); v.setAttribute('aria-hidden','true'); v.preload='none'; v.src=r.video;
          v.addEventListener('playing',function(){ v.classList.add('is-on'); }); li.querySelector('.rcard__cover').appendChild(v); }
        var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
      else if(v){ v.pause(); if(!motionOn) v.classList.remove('is-on'); } }); }
    if('IntersectionObserver' in window){ var io=new IntersectionObserver(function(es){ es.forEach(function(e){ vis[cards.indexOf(e.target)]=e.isIntersecting; }); previews(); },{rootMargin:'100px'}); cards.forEach(function(c){ io.observe(c); }); }
    /* просмотрщик */
    var q=function(s){ return dlg.querySelector(s); };
    var bars=q('[data-rvv-bars]'), media=q('[data-rvv-media]'), stage=q('[data-rvv-stage]'), more=q('[data-rvv-more]'), moreBtn=q('[data-rvv-morebtn]');
    var cur=-1, opener=null, t0=0, elapsed=0, raf=0, held=false, DUR=6000;
    bars.innerHTML=REVIEWS.map(function(){ return '<span><i></i></span>'; }).join('');
    var barEls=[].slice.call(bars.children);
    function setBar(i,f){ barEls[i].firstChild.style.transform='scaleX('+Math.max(0,Math.min(1,f))+')'; }
    function auto(){ return motionOn; }
    function stopTimer(){ cancelAnimationFrame(raf); raf=0; }
    function loop(){ var r=REVIEWS[cur]; if(!r) return;
      if(r.video){ var v=media.querySelector('video'); if(v&&v.duration) setBar(cur,v.currentTime/v.duration); }
      /* v16: фото/текст — без автоперехода, листает сам зритель; полоска лишь показывает позицию */
      raf=requestAnimationFrame(loop); }
    function render(){ var r=REVIEWS[cur];
      q('[data-rvv-name]').textContent=tx(r.name); q('[data-rvv-meta]').innerHTML=esc(tx(r.meta))+(r.ph?' <span class="ph">'+esc(T('ph'))+'</span>':'');
      var av=q('[data-rvv-av]'); av.textContent=initial(r);
      q('[data-rvv-q]').textContent='«'+tx(r.quote)+'»'; q('[data-rvv-res]').textContent=tx(r.result);
      var d=r.details||{};
      more.innerHTML='<dl>'+[['st_goal','goal'],['st_doubt','doubt'],['st_first','first'],['st_res','res']].filter(function(p){return d[p[1]];}).map(function(p){ return '<div><dt>'+esc(tx(p[0]))+'</dt><dd>'+esc(tx(d[p[1]]))+'</dd></div>'; }).join('')+'</dl>'+
        ((r.nums&&r.nums.length)?'<ul class="rvv__nums">'+r.nums.slice(0,2).map(function(n){ return '<li><b translate="no">'+esc(n[0])+'</b><span>'+esc(tx(n[1]))+'</span></li>'; }).join('')+'</ul>':'');
      moreBtn.querySelector('span').textContent=more.hidden?T('rv_more'):T('rv_less');
      stage.setAttribute('aria-label',T('rv_count').replace('{i}',cur+1).replace('{n}',REVIEWS.length));
      q('[data-rvv-prev]').disabled=cur===0; }
    function show(i){ var r=REVIEWS[i]; if(!r) return; cur=i; stopTimer(); elapsed=0; t0=performance.now();
      more.hidden=true; moreBtn.setAttribute('aria-expanded','false'); stage.classList.remove('is-more');
      barEls.forEach(function(b,k){ setBar(k,k<i?1:0); });
      media.innerHTML=''; stage.classList.toggle('is-video',!!r.video);
      if(r.video){ var v=document.createElement('video'); v.className='rvv__video'; v.controls=true; v.playsInline=true; v.setAttribute('playsinline',''); v.preload='auto'; if(r.poster) v.poster=r.poster; v.src=r.video;
        v.addEventListener('ended',function(){ setBar(cur,1); if(auto()) next(); });
        media.appendChild(v); if(auto()){ var p=v.play(); if(p&&p.catch) p.catch(function(){ v.muted=true; var p2=v.play(); if(p2&&p2.catch) p2.catch(function(){}); }); } }
      else if(r.poster){ media.innerHTML='<img src="'+r.poster+'" alt="">'; }
      else { media.innerHTML='<span class="rvv__init">'+esc(initial(r))+'</span>'; }
      if(!r.video) setBar(i,1);
      render(); raf=requestAnimationFrame(loop); }
    function next(){ if(cur<REVIEWS.length-1) show(cur+1); else close(); }
    function prev(){ if(cur>0) show(cur-1); else show(0); }
    function open(i,from){ opener=from||document.activeElement; previews(); 
      if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open','');
      root.classList.add('rvv-open'); show(i); previews(); q('[data-rvv-close]').focus(); }
    function close(){ stopTimer(); var v=media.querySelector('video'); if(v) v.pause(); media.innerHTML=''; cur=-1;
      if(dlg.open){ if(dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
      root.classList.remove('rvv-open'); previews(); if(opener&&opener.focus) opener.focus(); }
    dlg.addEventListener('cancel',function(e){ e.preventDefault(); close(); });       // Esc
    dlg.addEventListener('click',function(e){ if(e.target===dlg) close(); });          // клик по затемнению
    q('[data-rvv-close]').addEventListener('click',close);
    q('[data-rvv-prev]').addEventListener('click',prev); q('[data-rvv-next]').addEventListener('click',next);
    moreBtn.addEventListener('click',function(){ var o=more.hidden; more.hidden=!o; stage.classList.toggle('is-more',o); moreBtn.setAttribute('aria-expanded',String(o)); moreBtn.querySelector('span').textContent=o?T('rv_less'):T('rv_more'); });
    dlg.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'){ e.preventDefault(); next(); } else if(e.key==='ArrowLeft'){ e.preventDefault(); prev(); }
      else if(e.key==='Tab'){ var f=[].filter.call(dlg.querySelectorAll('button,video[controls],[href],[tabindex]:not([tabindex="-1"])'),function(el){ return !el.disabled&&el.offsetParent!==null; });
        if(!f.length) return; var a=f[0], z=f[f.length-1];
        if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); } } });
    /* тап по половинам, свайпы, удержание = пауза */
    var tap=q('[data-rvv-tap]'), sx=0, sy=0, st=0, down=false;
    stage.addEventListener('pointerdown',function(e){ if(e.target.closest('button,video,.rvv__body')) return; down=true; sx=e.clientX; sy=e.clientY; st=Date.now(); held=true; });
    stage.addEventListener('pointerup',function(e){ if(!down) return; down=false; held=false; t0=performance.now();
      var dx=e.clientX-sx, dy=e.clientY-sy;
      if(dy>80&&Math.abs(dy)>Math.abs(dx)){ close(); return; }
      if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){ if(dx<0) next(); else prev(); return; }
      if(Math.abs(dx)<10&&Math.abs(dy)<10&&Date.now()-st<500){ var b=stage.getBoundingClientRect(); if(e.clientX-b.left>b.width/2) next(); else prev(); } });
    stage.addEventListener('pointercancel',function(){ down=false; held=false; });
    /* язык и движение */
    var C=window.__aoCar||{relabel:function(){}}, o=C.relabel; C.relabel=function(){ o.apply(C,arguments); fill(); }; window.__aoCar=C;
    window.__aoReelsSync=function(){ previews(); if(cur>=0&&!motionOn){ var r=REVIEWS[cur]; if(!r.video) setBar(cur,1); } };
    fill();
  })();
  /* ---------- живой герой (v9) ----------
     Ролик пользователя поверх фото героя: то же кадрирование, фото — постер и запасной вариант.
     Пинг-понг (вперёд + назад) зашит в файл, поэтому loop бесшовный. Десктоп 1600w, мобильный — кроп под мобильную раскладку.
     Пауза / reduced motion — только фото: видео не грузится или останавливается и гаснет. */
  (function(){
    var v=document.querySelector('[data-hero-video]'); if(!v) return;
    var mq=window.matchMedia('(max-width: 900px)'), vis=true, ready=false;
    function want(){ return v.getAttribute(mq.matches?'data-src-m':'data-src-d'); }
    function sync(){
      if(motionOn && vis && ready){ var s=want(); if(v.getAttribute('src')!==s){ v.classList.remove('is-on'); v.setAttribute('src',s); }
        v.muted=true; v.defaultPlaybackRate=v.playbackRate=1; var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
      else { v.pause(); if(!motionOn) v.classList.remove('is-on'); } }
    v.addEventListener('playing',function(){ if(motionOn) v.classList.add('is-on'); });
    if('IntersectionObserver' in window) new IntersectionObserver(function(es){ vis=es[0].isIntersecting; sync(); }).observe(v.parentNode);
    if(mq.addEventListener) mq.addEventListener('change',sync);
    /* после проявки фото (2,4 с), чтобы не перебить анимацию героя */
    /* v17 perf: ролик героя грузим после load (не конкурирует с LCP-фото) */
    function arm(){ setTimeout(function(){ ready=true; sync(); }, 1600); }
    if(document.readyState==='complete') arm(); else addEventListener('load',arm);
    window.__aoHeroSync=sync;
  })();
  /* ---------- v14: «Место» — галерея зала: большое фото с кроссфейдом + миниатюры, свайп, стрелки, лайтбокс ---------- */
  (function(){
    var g=document.querySelector('[data-gym]'); if(!g) return;
    var gymAssets='assets/img/place-retouched-20261014/';
    var P=['hall','hall2','equip','facade','entry','logo','locker'];
    var A={ru:['Зал: силовая зона','Зал: тренажёры у окон','Свободные веса','Фасад The One Gym','Вход в зал с улицы','Логотип The One Gym','Раздевалка'],
           en:['Gym floor: strength area','Machines by the windows','Free weights','The One Gym facade','Entrance from the street','The One Gym logo','Locker room'],
           hy:['Դահլիճ՝ ուժային գոտի','Մարզասարքեր պատուհանի մոտ','Ազատ կշիռներ','The One Gym-ի ճակատը','Մուտքը փողոցից','The One Gym-ի լոգոն','Հանդերձարան']};
    var main=g.querySelector('[data-gym-main]'), th=g.querySelector('[data-gym-thumbs]'), cnt=g.querySelector('[data-gym-count]'), cur=0;
    var mob=window.matchMedia('(max-width: 700px)');
    function alt(i){ return (A[LANG]||A.ru)[i]; }
    var imgs=P.map(function(n,i){ var im=document.createElement('img'); im.className='gym__img'+(i?'':' is-on'); im.width=1280; im.height=960; im.decoding='async'; im.loading='lazy';
      im.srcset=gymAssets+n+'-m.webp 720w, '+gymAssets+n+'.webp 1280w'; im.sizes='(max-width: 700px) 100vw, 60vw'; im.src=gymAssets+n+'.webp'; main.insertBefore(im,main.querySelector('.gym__nav')); return im; });
    var tb=P.map(function(n,i){ var b=document.createElement('button'); b.type='button'; b.className='gym__t'; b.innerHTML='<img src="'+gymAssets+n+'-t.webp" alt="" width="240" height="180" loading="lazy" decoding="async">';
      b.addEventListener('click',function(){ go(i); }); th.appendChild(b); return b; });
    function label(){ imgs.forEach(function(im,i){ im.alt=alt(i); }); tb.forEach(function(b,i){ b.setAttribute('aria-label',(i+1)+'. '+alt(i)); }); }
    function go(i){ cur=(i+P.length)%P.length; imgs.forEach(function(im,k){ im.classList.toggle('is-on',k===cur); im.setAttribute('aria-hidden',k===cur?'false':'true'); });
      tb.forEach(function(b,k){ b.classList.toggle('is-on',k===cur); b.setAttribute('aria-current',k===cur?'true':'false'); });
      cnt.textContent=(cur+1)+' / '+P.length; var t=tb[cur]; th.scrollTo({left:t.offsetLeft-th.clientWidth/2+t.offsetWidth/2,behavior:motionOn?'smooth':'auto'});
      if(lb.open) lbi.src=gymAssets+P[cur]+'.webp', lbi.alt=alt(cur); }
    g.querySelector('[data-gym-prev]').addEventListener('click',function(){ go(cur-1); });
    g.querySelector('[data-gym-next]').addEventListener('click',function(){ go(cur+1); });
    main.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'){ e.preventDefault(); go(cur-1); } else if(e.key==='ArrowRight'){ e.preventDefault(); go(cur+1); } else if(e.key==='Enter'){ openLb(); } });
    th.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); go(cur+(e.key==='ArrowLeft'?-1:1)); tb[cur].focus(); } });
    function swipe(el){ var x=0,y=0,on=false; el.addEventListener('pointerdown',function(e){ if(e.target.closest('button')) return; on=true; x=e.clientX; y=e.clientY; });
      el.addEventListener('pointerup',function(e){ if(!on) return; on=false; var dx=e.clientX-x, dy=e.clientY-y;
        if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)) go(cur+(dx<0?1:-1)); else if(Math.abs(dx)<8&&Math.abs(dy)<8&&el===main) openLb(); });
      el.addEventListener('pointercancel',function(){ on=false; }); }
    swipe(main);
    var lb=document.querySelector('[data-gym-lb]'), lbi=lb.querySelector('[data-gym-lbimg]');
    if(lb.parentNode!==body) body.appendChild(lb);
    function openLb(){ lbi.src=gymAssets+P[cur]+'.webp'; lbi.alt=alt(cur); if(lb.showModal) lb.showModal(); else lb.setAttribute('open',''); body.style.overflow='hidden'; }
    g.querySelector('[data-gym-zoom]').addEventListener('click',openLb);
    lb.querySelector('[data-gym-lbx]').addEventListener('click',function(){ lb.close(); });
    lb.querySelector('[data-gym-lbp]').addEventListener('click',function(){ go(cur-1); });
    lb.querySelector('[data-gym-lbn]').addEventListener('click',function(){ go(cur+1); });
    lb.addEventListener('click',function(e){ if(e.target===lb) lb.close(); });
    lb.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft') go(cur-1); else if(e.key==='ArrowRight') go(cur+1); });
    lb.addEventListener('close',function(){ body.style.overflow=''; tb[cur].focus({preventScroll:true}); });
    swipe(lb);
    var C=window.__aoCar||{relabel:function(){}}, o=C.relabel; C.relabel=function(){ o.apply(C,arguments); label(); }; window.__aoCar=C;
    label(); go(0);
  })();
  /* ---------- v14: живое фото в «Твой первый раунд» ----------
     Анимация того же фото, кадрирована ровно под contact-1600.webp; пинг-понг зашит в файл.
     Грузится только у вьюпорта; пауза / reduced motion — остаётся фото. */
  (function(){
    var v=document.querySelector('[data-contact-video]'); if(!v) return;
    var mq=window.matchMedia('(max-width: 700px)'), vis=false;
    function sync(){
      if(motionOn&&vis){ var s=v.getAttribute(mq.matches?'data-src-m':'data-src-d'); if(v.getAttribute('src')!==s){ v.classList.remove('is-on'); v.setAttribute('src',s); }
        v.muted=true; v.playbackRate=1; var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
      else { v.pause(); if(!motionOn) v.classList.remove('is-on'); } }
    v.addEventListener('playing',function(){ if(motionOn) v.classList.add('is-on'); });
    if('IntersectionObserver' in window) new IntersectionObserver(function(es){ vis=es[0].isIntersecting; sync(); },{rootMargin:'300px 0px'}).observe(v.parentNode);
    if(mq.addEventListener) mq.addEventListener('change',sync);
    /* v16: атмосфера — красный пульс, блики, пыль в луче. Живёт только в кадре и при включённом движении. */
    var fx=document.querySelector('[data-cfx]'), cv=fx&&fx.querySelector('canvas'), cx=cv&&cv.getContext&&cv.getContext('2d'), P=[], raf=0, last=0;
    function size(){ if(!cv) return; var r=cv.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,1.5); cv.width=Math.max(1,r.width*d|0); cv.height=Math.max(1,r.height*d|0);
      P=[]; var n=Math.round(Math.min(46,r.width*r.height/9000)); for(var i=0;i<n;i++) P.push(seed({},true)); }
    function seed(p,any){ var W=cv.width,H=cv.height; p.x=W*(.35+Math.random()*.6); p.y=any?Math.random()*H:H+5; p.r=(.6+Math.random()*1.6)*(W/700); p.vx=(Math.random()-.4)*.08*(W/700); p.vy=-(.06+Math.random()*.14)*(W/700); p.a=.15+Math.random()*.45; p.t=Math.random()*6.28; return p; }
    function tick(ts){ raf=requestAnimationFrame(tick); if(ts-last<33) return; last=ts; var W=cv.width,H=cv.height; cx.clearRect(0,0,W,H);
      for(var i=0;i<P.length;i++){ var p=P[i]; p.x+=p.vx*2; p.y+=p.vy*2; p.t+=.03; if(p.y<-5||p.x>W+5) seed(p);
        var beam=Math.max(0,1-Math.abs((p.x/W)-(.62+(1-p.y/H)*.18))*3.2), al=p.a*(.25+.75*beam)*(.6+.4*Math.sin(p.t));
        cx.globalAlpha=al; cx.fillStyle='#f3e6d4'; cx.beginPath(); cx.arc(p.x,p.y,p.r,0,6.283); cx.fill(); } }
    function fxSync(){ if(!fx) return; var on=motionOn&&vis; fx.classList.toggle('is-live',on);
      if(on&&cx&&!raf){ if(!P.length) size(); raf=requestAnimationFrame(tick); } else if(!on&&raf){ cancelAnimationFrame(raf); raf=0; if(cx) cx.clearRect(0,0,cv.width,cv.height); } }
    if(cv) addEventListener('resize',function(){ if(raf) size(); });
    var s0=sync; sync=function(){ s0(); fxSync(); };
    window.__aoContactSync=sync;
  })();

  /* ---------- v17: кинематографичные появления при скролле ----------
     Всё скрытое — только под html.fx, который ставит JS при включённом движении. Без JS / пауза / reduced motion — контент виден сразу.
     «Место» (#place) и герой не трогаем. */
  (function(){
    var X='#place, #top';
    function q(sel){ return [].slice.call(document.querySelectorAll(sel)).filter(function(el){ return !el.closest(X); }); }
    var heads=q('main section h2:not(.sr), .x-teach__t');
    var media=q('.x-split__media .reel__frame, .x-moments figure, .fs__photo, .contact__media');
    var groups=[['.x-who li'],['.x-teach__steps li'],['.x-moments li'],['.fs .tl li, #first ol li'],['[data-reels] .rcard'],['.faq details, .faq .qa'],['.contact .steps li'],['.vstats li'],['.callsheet__cell']];
    var items=[];
    groups.forEach(function(g){ q(g[0]).forEach(function(el,i){ el.style.setProperty('--fx-i',i%6); items.push(el); }); });
    heads.forEach(function(el){ el.classList.add('fx-h'); });
    media.forEach(function(el){ el.classList.add('fx-m'); });
    items.forEach(function(el){ el.classList.add('fx-c'); });
    var all=heads.concat(media,items);
    /* clip-path и горизонтальные ленты мешают IO — наблюдаем «триггер»: родителя заголовка / ряд сторис */
    function trig(el){ return el.classList.contains('fx-h')?el.parentNode:(el.closest('[data-reels]')||el); }
    var tmap=new Map();
    var io=('IntersectionObserver' in window)?new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ (tmap.get(e.target)||[]).forEach(function(el){ el.classList.add('fx-in'); }); io.unobserve(e.target); } }); },{rootMargin:'0px 0px -12% 0px',threshold:0}):null;
    function watch(el){ var t=trig(el); if(!tmap.has(t)) tmap.set(t,[]); tmap.get(t).push(el); io.observe(t); }
    /* вспышка-«склейка» при входе в ключевые сцены — один раз */
    var cuts=q('#coach, #contact, #prices');
    var cutIO=('IntersectionObserver' in window)?new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting&&root.classList.contains('fx')){ var lk=document.createElement('span'); lk.className='fx-leak'; lk.setAttribute('aria-hidden','true'); e.target.appendChild(lk); setTimeout(function(){ lk.remove(); },1300); cutIO.unobserve(e.target); } }); },{threshold:.25}):null;
    cuts.forEach(function(c){ c.classList.add('fx-cutable'); if(cutIO) cutIO.observe(c); });
    /* рекорд: «удар» после счётчика */
    var rec=document.querySelector('.x-rec'); var recIO=rec&&('IntersectionObserver' in window)?new IntersectionObserver(function(es){ if(es[0].isIntersecting&&root.classList.contains('fx')){ setTimeout(function(){ rec.classList.add('fx-hit'); },1100); recIO.disconnect(); } },{threshold:.5}):null;
    if(recIO) recIO.observe(rec);
    /* scroll: прогресс-линия + зум/параллакс выхода в «Сначала были бои» */
    var bar=document.createElement('div'); bar.className='fx-progress'; bar.setAttribute('aria-hidden','true'); body.appendChild(bar);
    var fight=document.querySelector('.x-fight'), fimg=fight&&fight.querySelector('.x-fight__ph img'), ticking=false, fightVis=false;
    if(fight&&'IntersectionObserver' in window) new IntersectionObserver(function(es){ fightVis=es[0].isIntersecting; },{rootMargin:'100px 0px'}).observe(fight);
    function frame(){ ticking=false; if(!root.classList.contains('fx')) return;
      var h=document.documentElement.scrollHeight-innerHeight; bar.style.transform='scaleX('+(h>0?Math.min(1,scrollY/h):0).toFixed(4)+')';
      if(fimg&&fightVis){ var r=fight.getBoundingClientRect(), t=Math.max(0,Math.min(1,(innerHeight-r.top)/(innerHeight+r.height)));
        fimg.style.transform='translate3d(0,'+((t-.5)*-6).toFixed(2)+'%,0) scale('+(1.02+t*.14).toFixed(4)+')'; } }
    addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } },{passive:true});
    function sync(){
      if(motionOn){ if(!root.classList.contains('fx')){
          var vh=innerHeight;
          all.forEach(function(el){ if(trig(el).getBoundingClientRect().top<vh*.88) el.classList.add('fx-in'); else if(io) watch(el); else el.classList.add('fx-in'); });
          root.classList.add('fx'); frame(); } }
      else { root.classList.remove('fx'); all.forEach(function(el){ el.classList.add('fx-in'); }); if(io) io.disconnect(); if(fimg) fimg.style.transform=''; }
    }
    /* perf: запуск после load и в простое — не мешает первому экрану */
    var armed=false;
    function arm(){ armed=true; sync(); }
    window.__aoFxSync=function(){ if(armed) sync(); };
    function later(){ (window.requestIdleCallback||function(f){ setTimeout(f,200); })(arm,{timeout:1500}); }
    if(document.readyState==='complete') later(); else addEventListener('load',later);
  })();
  /* v17: подпись — проявление, когда видна */
  (function(){ var sg=document.querySelector('.sign--img'); if(!sg) return;
    if(!('IntersectionObserver' in window)){ sg.classList.add('is-in'); return; }
    var o=new IntersectionObserver(function(es){ if(es[0].isIntersecting){ sg.classList.add('is-in'); o.disconnect(); } },{threshold:.6}); o.observe(sg); })();
  applyLang(LANG);

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
