(function(){
  var PROV = {
    vrt:{name:'VRT MAX', titles:[['Ochtendnieuws',30],['Tuinprogramma',45],['Documentaire',60],['Kookprogramma',45],['Quiz',30],['Dramaserie',50],['Avondnieuws',30],['Sportoverzicht',60],['Film',100]]},
    dpg:{name:'VTM GO', titles:[['Ontbijtshow',45],['Soap',30],['Praatprogramma',60],['Realityreeks',60],['Avondnieuws',30],['Amusement',75],['Misdaadreeks',55],['Film',110]]},
    play:{name:'Play', titles:[['Lifestyle',45],['Verbouwprogramma',60],['True crime',55],['Quiz',45],['Realityreeks',60],['Comedy',30],['Film',105]]}
  };
  var V = 'https://www.vrt.be/vrtmax/livestream/video/', G = 'https://www.vtmgo.be/vtmgo/live-kijken/', P = 'https://www.play.tv/live-kijken/';
  var CHANNELS = [
    {id:'vrt1', name:'VRT 1', prov:'vrt', url:V+'vrt1/'},
    {id:'canvas', name:'Canvas', prov:'vrt', url:V+'vrt-canvas/'},
    {id:'ketnet', name:'Ketnet', prov:'vrt', url:V+'ketnet/'},
    {id:'vtm', name:'VTM', prov:'dpg', url:G+'vtm'},
    {id:'vtm2', name:'VTM 2', prov:'dpg', url:G+'vtm2'},
    {id:'vtm3', name:'VTM 3', prov:'dpg', url:G+'vtm3'},
    {id:'vtm4', name:'VTM 4', prov:'dpg', url:G+'vtm4'},
    {id:'vtmgold', name:'VTM Gold', prov:'dpg', url:G+'vtm-gold'},
    {id:'vtmxmas', name:'VTM Xmas', prov:'dpg', url:G+'vtm-xmas'},
    {id:'play', name:'Play', prov:'play', url:P+'play'},
    {id:'playfictie', name:'Play Fictie', prov:'play', url:P+'play-fictie', titles:[['Dramaserie',50],['Film',100],['Miniserie',55]]},
    {id:'playactie', name:'Play Actie', prov:'play', url:P+'play-actie', titles:[['Actiefilm',105],['Thrillerreeks',50]]},
    {id:'playreality', name:'Play Reality', prov:'play', url:P+'play-reality', titles:[['Realityreeks',60],['Datingshow',45],['Make-over',50]]},
    {id:'playcrime', name:'Play Crime', prov:'play', url:P+'play-crime', titles:[['True crime',55],['Misdaadreeks',50],['Cold case',60]]}
  ];
  var KEY = 'betv-links-v1', custom = {}, guide = null, failed = false;
  try{ custom = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){}
  var st = {tab:'guide', prov:'all', day:0, q:'', sel:null, scrollX:null, recenter:true};
  var $ = function(id){ return document.getElementById(id); };

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function safeUrl(u){ return /^https?:\/\//i.test(u || '') ? u : ''; }
  function hm(ts){ var d = new Date(ts * 1000); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  function nowSec(){ return Math.floor(Date.now() / 1000); }
  function link(c){ return safeUrl(custom[c.id]) || c.url; }
  function chById(id){ return CHANNELS.filter(function(c){ return c.id === id; })[0]; }
  function visible(){ return CHANNELS.filter(function(c){ return st.prov === 'all' || c.prov === st.prov; }); }
  function bounds(off){ var d = new Date(), y = d.getFullYear(), m = d.getMonth(), n = d.getDate();
    return [Math.floor(new Date(y, m, n + off) / 1000), Math.floor(new Date(y, m, n + off + 1) / 1000)]; }
  function ppm(){ return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ppm')) || 4; }

  function sample(c){
    var base = bounds(0)[0], idx = CHANNELS.indexOf(c), list = c.titles || PROV[c.prov].titles, t = -((idx * 17) % 45), i = idx * 2, out = [];
    while(t < 3000){ var x = list[i % list.length]; out.push({t:x[0], s:base + t*60, e:base + (t + x[1])*60}); t += x[1]; i++; }
    return out;
  }
  function slotsFor(c){
    var real = guide && guide.channels && guide.channels[c.id];
    if(real && real.length) return real;
    if(guide && guide.updated) return [];
    return c._sample || (c._sample = sample(c));
  }
  function pos(sl, n){
    var cur = -1, nxt = -1;
    for(var k = 0; k < sl.length; k++){ if(sl[k].s <= n && n < sl[k].e) cur = k; else if(sl[k].s > n && nxt < 0) nxt = k; }
    return {cur:cur, nxt:nxt};
  }
  function maxDay(){
    if(!(guide && guide.updated)) return 1;
    var last = 0; CHANNELS.forEach(function(c){ var a = guide.channels[c.id]; if(a && a.length) last = Math.max(last, a[a.length-1].e); });
    return Math.max(0, Math.min(6, Math.floor((last - 1 - bounds(0)[0]) / 86400)));
  }
  function findSel(){
    if(st.sel){ var c = chById(st.sel.ch); if(c && visible().indexOf(c) >= 0){ var sl = slotsFor(c); for(var k = 0; k < sl.length; k++) if(sl[k].s === st.sel.s) return {c:c, s:sl[k]}; } }
    var n = nowSec(), vis = visible();
    for(var i = 0; i < vis.length; i++){ var s2 = slotsFor(vis[i]), p = pos(s2, n); if(p.cur >= 0) return {c:vis[i], s:s2[p.cur]}; }
    return null;
  }
  function logo(c, cls){ return '<img class="logo" src="logos/' + c.id + '.png" alt="' + esc(c.name) + '">'; }
  function fixLogos(root){
    Array.prototype.forEach.call(root.querySelectorAll('img.logo'), function(img){
      img.addEventListener('error', function(){
        var p = this.parentNode; p.classList.add('nologo');
        if(p.classList.contains('thumb')) p.textContent = this.alt; else this.remove();
      });
    });
  }

  function detail(){
    var sel = findSel(), n = nowSec(), el = $('detail');
    if(!sel){ el.innerHTML = '<div><div class="d-title">Niets om te tonen</div><div class="d-desc">Kies een programma in de gids.</div></div><div class="thumb"></div>'; return; }
    var s = sel.s, c = sel.c, on = s.s <= n && n < s.e, pct = on ? Math.round((n - s.s) / (s.e - s.s) * 100) : 0;
    var sub = [s.g, s.st].filter(Boolean).join(' – ') || (PROV[c.prov].name + ' · ' + c.name);
    el.innerHTML = '<div><div class="d-title">' + esc(s.t) + '</div><div class="d-sub">' + esc(sub) + '</div><div class="d-desc">' + esc(s.d || '') + '</div>'
      + '<div class="prog"><span>' + hm(s.s) + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><span>' + hm(s.e) + '</span></div>'
      + '<div class="acts"><a class="btn go" target="_blank" rel="noopener noreferrer" href="' + esc(link(c)) + '">' + (on ? 'Kijk live' : 'Open zender') + '</a>'
      + (safeUrl(s.u) ? '<a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(safeUrl(s.u)) + '">Kijk online</a>' : '')
      + '<button data-act="popup" data-id="' + c.id + '">Pop-up</button><button data-act="edit" data-id="' + c.id + '">Link wijzigen</button></div></div>'
      + (safeUrl(s.i) ? '<div class="thumb pic"><img class="pic" src="' + esc(safeUrl(s.i)) + '" alt="" referrerpolicy="no-referrer"></div>' : '<div class="thumb">' + logo(c) + '</div>');
    fixLogos(el);
    var pic = el.querySelector('img.pic');
    if(pic) pic.addEventListener('error', function(){ var t = pic.parentNode; t.className = 'thumb'; t.innerHTML = logo(c); fixLogos(t); });
  }

  function gridView(){
    var n = nowSec(), b = bounds(st.day), ds = b[0], de = b[1], mins = (de - ds) / 60, k = ppm(), sel = findSel();
    var left = '<div class="axspace"></div>', rows = '', axis = '';
    for(var t = 0; t < mins; t += 15) axis += '<div class="tick" style="left:' + (t * k) + 'px">' + hm(ds + t * 60) + '</div>';
    visible().forEach(function(c){
      var num = String(CHANNELS.indexOf(c) + 1).padStart(3, '0'), blocks = '', sl = slotsFor(c), any = false;
      sl.forEach(function(s){
        if(s.e <= ds || s.s >= de) return;
        var x = (Math.max(s.s, ds) - ds) / 60 * k, w = (Math.min(s.e, de) - Math.max(s.s, ds)) / 60 * k - 2;
        if(w < 4) return;
        any = true;
        blocks += '<button class="blk' + (s.e <= n ? ' past' : '') + (s.s <= n && n < s.e ? ' on' : '') + (sel && sel.s === s ? ' sel' : '')
          + '" style="left:' + x + 'px;width:' + w + 'px" data-ch="' + c.id + '" data-s="' + s.s + '" title="' + esc(s.t) + '">' + esc(s.t) + '</button>';
      });
      left += '<div class="chl' + (sel && sel.c === c ? ' sel' : '') + '" data-ch="' + c.id + '"><span class="num">' + num + '</span>' + logo(c) + '<span class="cname">' + esc(c.name) + '</span></div>';
      rows += '<div class="rowx">' + (any ? blocks : '<span class="nod">Geen gidsgegevens</span>') + '</div>';
    });
    var nowLine = (st.day === 0 && n >= ds && n < de) ? '<div class="now" style="left:' + ((n - ds) / 60 * k - 1) + 'px"></div>' : '';
    $('view').innerHTML = '<div class="grid"><div class="chcol">' + left + '</div><div class="scroller" id="sc"><div class="inner" style="width:' + Math.round(mins * k) + 'px"><div class="axis">' + axis + '</div>' + rows + nowLine + '</div></div></div>';
    fixLogos($('view'));
    var sc = $('sc');
    if(st.recenter || st.scrollX == null){ sc.scrollLeft = Math.max(0, st.day === 0 ? (n - ds) / 60 * k - sc.clientWidth * 0.25 : 18 * 60 * k - sc.clientWidth * 0.1); st.recenter = false; st.scrollX = sc.scrollLeft; }
    else sc.scrollLeft = st.scrollX;
    sc.addEventListener('scroll', function(){ st.scrollX = sc.scrollLeft; }, {passive:true});
  }

  function libraryView(){
    var n = nowSec(), seen = {}, items = [], q = st.q.trim().toLowerCase();
    visible().forEach(function(c){
      slotsFor(c).forEach(function(s){
        var key = c.id + '|' + s.t;
        if(s.e <= n || seen[key] || (q && (s.t + ' ' + c.name).toLowerCase().indexOf(q) < 0)) return;
        seen[key] = 1; items.push({s:s, c:c});
      });
    });
    if(!items.length){ $('view').innerHTML = '<p class="empty">Geen programma\'s gevonden.</p>'; return; }
    var out = '<div class="lib">';
    items.slice(0, 250).forEach(function(i){
      out += '<div class="item">' + (safeUrl(i.s.i) ? '<img class="th" src="' + esc(safeUrl(i.s.i)) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '<span class="ttl">' + esc(i.s.t) + ' <span class="t">' + (i.s.s <= n ? 'nu bezig' : hm(i.s.s)) + '</span></span><span class="tag">' + esc(i.c.name) + '</span>'
        + '<a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(safeUrl(i.s.u) || link(i.c)) + '">' + (safeUrl(i.s.u) ? 'Kijk online' : 'Open live') + '</a></div>';
    });
    $('view').innerHTML = out + '</div>';
    Array.prototype.forEach.call($('view').querySelectorAll('img.th'), function(im){ im.addEventListener('error', function(){ im.remove(); }); });
  }

  function render(){
    var d = new Date(), n = nowSec(), md = maxDay();
    $('clock').textContent = hm(n);
    $('date').innerHTML = esc(d.toLocaleDateString('nl-BE', {weekday:'long'})) + '<br>' + esc(d.toLocaleDateString('nl-BE', {day:'numeric', month:'long'}));
    if(st.day > md) st.day = md;
    var dd = new Date(bounds(st.day)[0] * 1000);
    $('dlabel').textContent = st.day === 0 ? 'Vandaag' : st.day === 1 ? 'Morgen' : dd.toLocaleDateString('nl-BE', {weekday:'short', day:'numeric', month:'short'});
    $('dprev').disabled = st.day <= 0; $('dnext').disabled = st.day >= md;
    var nt = $('notice');
    if(guide && guide.updated){
      var age = (Date.now() - new Date(guide.updated).getTime()) / 36e5;
      nt.textContent = 'Gids bijgewerkt op ' + new Date(guide.updated).toLocaleString('nl-BE', {weekday:'short', hour:'2-digit', minute:'2-digit'}) + (age > 30 ? '. Dat is meer dan een dag geleden, de gidstaak is mogelijk gestopt.' : '.');
    } else if(guide){ nt.textContent = 'Voorbeeldgegevens. De echte programma\'s verschijnen zodra de gidstaak voor het eerst gelopen heeft.'; }
    else if(failed){ nt.textContent = 'Voorbeeldgegevens. guide.js kon niet geladen worden; controleer of het naast index.html staat.'; }
    var h = '', opts = [['all','Alle']].concat(Object.keys(PROV).map(function(x){ return [x, PROV[x].name]; }));
    opts.forEach(function(o){ h += '<button data-prov="' + o[0] + '" aria-pressed="' + (st.prov === o[0]) + '">' + o[1] + '</button>'; });
    h += '<button data-tab="guide" aria-pressed="' + (st.tab === 'guide') + '">Gids</button><button data-tab="lib" aria-pressed="' + (st.tab === 'lib') + '">Bibliotheek</button>';
    $('chips').innerHTML = h;
    detail();
    if(st.tab === 'guide') gridView(); else libraryView();
  }

  function loadGuide(){
    var s = document.createElement('script');
    s.src = 'guide.js?t=' + Date.now();
    s.onload = function(){ if(window.BETV_GUIDE){ guide = window.BETV_GUIDE; failed = false; render(); } s.remove(); };
    s.onerror = function(){ failed = true; render(); s.remove(); };
    document.head.appendChild(s);
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('#vault')) return;
    var el = e.target.closest('button, .chl'); if(!el) return;
    var ds = el.dataset;
    if(el.classList.contains('blk')){ st.sel = {ch:ds.ch, s:+ds.s}; render(); }
    else if(el.classList.contains('chl')){
      var c = chById(ds.ch), sl = slotsFor(c), p = pos(sl, nowSec()), i = p.cur >= 0 ? p.cur : p.nxt;
      if(i >= 0){ st.sel = {ch:c.id, s:sl[i].s}; render(); }
    }
    else if(ds.prov){ st.prov = ds.prov; render(); }
    else if(ds.tab){ st.tab = ds.tab; render(); }
    else if(el.id === 'dprev'){ st.day--; st.recenter = true; render(); }
    else if(el.id === 'dnext'){ st.day++; st.recenter = true; render(); }
    else if(el.id === 'vaultbtn'){ var sl0 = findSel(); openVault(sl0 ? sl0.c.prov : null); }
    else if(el.id === 'nowbtn'){ st.day = 0; st.tab = 'guide'; st.recenter = true; st.sel = null; render(); }
    else if(ds.act){
      if(ds.act === 'vault'){ openVault(ds.id); return; }
      var ch = chById(ds.id);
      if(ds.act === 'popup'){
        var w = null;
        try{ w = window.open(link(ch), 'betv_popup', 'popup=yes,width=1100,height=700'); }catch(err){}
        if(!w) window.open(link(ch), '_blank', 'noopener');
      } else {
        var v = prompt('Live link voor ' + ch.name + ' (laat leeg om te herstellen)', link(ch));
        if(v === null) return;
        v = v.trim();
        if(!v){ delete custom[ch.id]; }
        else { try{ var u = new URL(v); if(u.protocol === 'https:' || u.protocol === 'http:'){ custom[ch.id] = u.href; } else { alert('Gebruik een https://-adres.'); return; } }catch(err){ alert('Dat is geen geldig adres.'); return; } }
        try{ localStorage.setItem(KEY, JSON.stringify(custom)); }catch(err){}
        render();
      }
    }
  });
  $('q').addEventListener('input', function(){ st.q = this.value; st.tab = st.q.trim() ? 'lib' : 'guide'; if(st.tab === 'guide') st.recenter = false; render(); });

  // ---- Accounts: logins kept in an encrypted vault on this device ------------------
  var VKEY = 'betv-vault-v1', VAAD = 'betv-vault-v1', ITER = 600000;
  var PROVIDERS = [
    {id:'vrt', name:'VRT MAX', login:'https://www.vrt.be/vrtmax/', who:'E-mailadres'},
    {id:'dpg', name:'VTM GO', login:'https://www.vtmgo.be/', who:'E-mailadres'},
    {id:'play', name:'Play', login:'https://www.play.tv/', who:'E-mailadres'},
    {id:'netflix', name:'Netflix', login:'https://www.netflix.com/be/login', who:'E-mailadres of telefoonnummer'}
  ];
  var vault = {key:null, data:null, rec:null, timer:null, hideTimer:null, focus:null, changing:false};
  var venc = new TextEncoder(), vdec = new TextDecoder();

  function b64(buf){ var b = new Uint8Array(buf), s = ''; for(var k = 0; k < b.length; k++) s += String.fromCharCode(b[k]); return btoa(s); }
  function unb64(s){ var t = atob(s), b = new Uint8Array(t.length); for(var k = 0; k < t.length; k++) b[k] = t.charCodeAt(k); return b; }
  function loadRec(){ try{ return JSON.parse(localStorage.getItem(VKEY) || 'null'); }catch(e){ return null; } }
  function deriveKey(pass, salt, iter){
    return crypto.subtle.importKey('raw', venc.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function(base){
      return crypto.subtle.deriveKey({name:'PBKDF2', salt:salt, iterations:iter, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
    });
  }
  function seal(key, obj){
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({name:'AES-GCM', iv:iv, additionalData:venc.encode(VAAD)}, key, venc.encode(JSON.stringify(obj))).then(function(ct){ return {iv:b64(iv), data:b64(ct)}; });
  }
  function unseal(key, rec){
    return crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(rec.iv), additionalData:venc.encode(VAAD)}, key, unb64(rec.data)).then(function(pt){ return JSON.parse(vdec.decode(pt)); });
  }
  function persist(){
    return seal(vault.key, vault.data).then(function(s){
      vault.rec = {v:1, kdf:'PBKDF2-SHA256', iter:vault.rec.iter, salt:vault.rec.salt, iv:s.iv, data:s.data};
      localStorage.setItem(VKEY, JSON.stringify(vault.rec));
    });
  }
  function newKey(pass, data){
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveKey(pass, salt, ITER).then(function(key){ vault.key = key; vault.data = data; vault.rec = {iter:ITER, salt:b64(salt)}; return persist(); });
  }
  function unlockVault(pass){
    var rec = loadRec();
    return deriveKey(pass, unb64(rec.salt), rec.iter).then(function(key){
      return unseal(key, rec).then(function(data){ vault.key = key; vault.data = data; vault.rec = rec; });
    });
  }
  function lockVault(){ vault.key = null; vault.data = null; vault.changing = false; clearTimeout(vault.timer); syncVaultIcon(); if($('vault').open) renderVault(); }
  function touchVault(){ clearTimeout(vault.timer); if(vault.key) vault.timer = setTimeout(lockVault, 5 * 60 * 1000); }

  function syncVaultIcon(){ var b = $('vaultbtn'); b.classList.toggle('unlocked', !!vault.key); b.setAttribute('title', vault.key ? 'Accounts (ontgrendeld)' : 'Accounts'); }

  function renderVault(){
    syncVaultIcon();
    var box = $('vaultbox'), rec = loadRec();
    var head = '<div class="vhead"><h2>Accounts</h2><button data-v="close">Sluiten</button></div>', foot = '<p class="vmsg" id="vmsg" role="status"></p>';
    if(!(window.crypto && crypto.subtle)){ box.innerHTML = head + '<p class="vnote">Versleutelen werkt alleen op een beveiligde pagina. Open de app via het https://-adres (GitHub Pages) of via localhost.</p>'; return; }
    if(!rec){
      box.innerHTML = head + '<p class="vnote">Je gegevens worden op dit toestel versleuteld met AES-256 en verlaten het nooit. Kies een hoofdwachtwoord. Het wordt nergens bewaard: vergeet je het, dan moet je de kluis wissen en opnieuw beginnen. Er is geen herstel.</p>'
        + '<label>Hoofdwachtwoord (minstens 10 tekens, liefst een zin)<input type="password" id="vp1" autocomplete="new-password"></label>'
        + '<label>Herhaal hoofdwachtwoord<input type="password" id="vp2" autocomplete="new-password"></label>'
        + '<div class="acts"><button class="btn go" data-v="create">Kluis aanmaken</button></div>' + foot;
      return;
    }
    if(!vault.key){
      box.innerHTML = head + '<p class="vnote">De kluis is vergrendeld.</p><label>Hoofdwachtwoord<input type="password" id="vp1" autocomplete="current-password"></label>'
        + '<div class="acts"><button class="btn go" data-v="unlock">Ontgrendel</button><button data-v="wipe">Kluis wissen</button></div>' + foot;
      return;
    }
    var h = head + '<p class="vnote">De app logt niet voor je in. Kopieer je gegevens en plak ze op de site van de aanbieder. De kluis vergrendelt zichzelf na 5 minuten. Tip: na één keer inloggen onthouden de sites je sessie, en je browser of telefoon kan de login ook zelf invullen.</p>';
    PROVIDERS.forEach(function(p){
      var e = vault.data[p.id] || {};
      h += '<section class="vcard" data-p="' + p.id + '"><h3>' + esc(p.name) + (e.u || e.p ? ' <span class="vok">opgeslagen</span>' : '') + '</h3>'
        + '<label>' + esc(p.who) + '<input type="text" id="vu-' + p.id + '" value="' + esc(e.u || '') + '" autocomplete="off" autocapitalize="off" spellcheck="false"></label>'
        + '<label>Wachtwoord<span class="pw"><input type="password" id="vw-' + p.id + '" value="' + esc(e.p || '') + '" autocomplete="off"><button data-v="show" data-p="' + p.id + '">Toon</button></span></label>'
        + '<div class="acts"><button class="btn go" data-v="save" data-p="' + p.id + '">Opslaan</button>'
        + '<button data-v="copyu" data-p="' + p.id + '">Kopieer gebruikersnaam</button><button data-v="copyw" data-p="' + p.id + '">Kopieer wachtwoord</button>'
        + '<button data-v="open" data-p="' + p.id + '">Open aanmelding</button><button data-v="del" data-p="' + p.id + '">Verwijderen</button></div></section>';
    });
    h += '<div class="acts vfoot"><button data-v="lock">Nu vergrendelen</button><button data-v="change">Hoofdwachtwoord wijzigen</button><button data-v="wipe">Kluis wissen</button></div>';
    if(vault.changing) h += '<div class="vcard"><label>Nieuw hoofdwachtwoord (minstens 10 tekens)<input type="password" id="vp1" autocomplete="new-password"></label>'
      + '<label>Herhaal nieuw hoofdwachtwoord<input type="password" id="vp2" autocomplete="new-password"></label>'
      + '<div class="acts"><button class="btn go" data-v="changego">Wijzigen</button><button data-v="changeno">Annuleren</button></div></div>';
    box.innerHTML = h + foot;
    if(vault.focus){ var c = box.querySelector('[data-p="' + vault.focus + '"]'); if(c){ c.classList.add('focus'); if(c.scrollIntoView) c.scrollIntoView({block:'nearest'}); } }
  }

  function msg(t){ var m = $('vmsg'); if(m) m.textContent = t; }
  function copyText(text, what){
    if(!text){ msg('Er is niets om te kopiëren.'); return; }
    function done(){
      msg(what + ' gekopieerd. Het klembord wordt na 30 seconden gewist.');
      setTimeout(function(){ try{ navigator.clipboard.writeText(''); }catch(e){} }, 30000);
    }
    function fallback(){
      var t = document.createElement('textarea'), ok = false;
      t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      $('vaultbox').appendChild(t); t.select();
      try{ ok = document.execCommand('copy'); }catch(e){}
      t.remove();
      if(ok) done(); else msg('Kopiëren is niet gelukt in deze browser. Kies Toon en kopieer het met de hand.');
    }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, fallback); } else fallback();
  }
  function weak(p1, p2){
    if(p1.length < 10) return 'Gebruik minstens 10 tekens.';
    if(p1 !== p2) return 'De twee wachtwoorden zijn niet gelijk.';
    if(/^(.)\1+$/.test(p1)) return 'Kies een minder voorspelbaar wachtwoord.';
    return '';
  }
  function openVault(focus){
    var d = $('vault'); vault.focus = focus || null; vault.changing = false; renderVault();
    if(d.showModal){ if(!d.open) d.showModal(); } else d.setAttribute('open', '');
    touchVault();
  }

  $('vaultbox').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var v = b.dataset.v, id = b.dataset.p;
    touchVault();
    if(v === 'close'){ $('vault').close(); }
    else if(v === 'create' || v === 'changego'){
      var p1 = $('vp1').value, bad = weak(p1, $('vp2').value);
      if(bad){ msg(bad); return; }
      msg('Bezig met versleutelen…');
      (v === 'create' ? newKey(p1, {}) : newKey(p1, vault.data)).then(function(){
        var done = v === 'create' ? 'Kluis aangemaakt.' : 'Hoofdwachtwoord gewijzigd.';
        vault.changing = false; touchVault(); renderVault(); msg(done);
      }, function(){ msg('Dat is niet gelukt.'); });
    }
    else if(v === 'unlock'){
      var pw = $('vp1').value; if(!pw) return;
      msg('Bezig met ontgrendelen…');
      unlockVault(pw).then(function(){ touchVault(); renderVault(); }, function(){ msg('Onjuist hoofdwachtwoord.'); });
    }
    else if(v === 'save'){
      var u = $('vu-' + id).value.trim(), w = $('vw-' + id).value;
      if(!u && !w) delete vault.data[id]; else vault.data[id] = {u:u, p:w};
      persist().then(function(){ msg('Opgeslagen.'); }, function(){ msg('Opslaan is niet gelukt.'); });
    }
    else if(v === 'open'){
      var pp = PROVIDERS.filter(function(x){ return x.id === id; })[0], uu = $('vu-' + id).value;
      if(uu) copyText(uu, 'Gebruikersnaam'); else msg('Aanmeldpagina geopend. Sla eerst je gegevens op om ze te kunnen kopiëren.');
      window.open(pp.login, '_blank', 'noopener');
    }
    else if(v === 'show'){ var inp = $('vw-' + id); inp.type = inp.type === 'password' ? 'text' : 'password'; b.textContent = inp.type === 'password' ? 'Toon' : 'Verberg'; }
    else if(v === 'copyu'){ copyText($('vu-' + id).value, 'Gebruikersnaam'); }
    else if(v === 'copyw'){ copyText($('vw-' + id).value, 'Wachtwoord'); }
    else if(v === 'del'){
      var pr = PROVIDERS.filter(function(x){ return x.id === id; })[0];
      if(!confirm('Gegevens voor ' + pr.name + ' verwijderen?')) return;
      delete vault.data[id];
      persist().then(function(){ renderVault(); msg('Verwijderd.'); });
    }
    else if(v === 'lock'){ lockVault(); }
    else if(v === 'change'){ vault.changing = true; renderVault(); }
    else if(v === 'changeno'){ vault.changing = false; renderVault(); }
    else if(v === 'wipe'){
      if(!confirm('Alle opgeslagen gegevens en het hoofdwachtwoord wissen? Dit kan niet ongedaan worden gemaakt.')) return;
      try{ localStorage.removeItem(VKEY); }catch(err){}
      vault.key = null; vault.data = null; vault.rec = null; vault.changing = false; clearTimeout(vault.timer);
      renderVault();
    }
  });
  $('vaultbox').addEventListener('keydown', function(e){
    if(e.key === 'Enter' && (e.target.id === 'vp1' || e.target.id === 'vp2')){
      var go = $('vaultbox').querySelector('[data-v="create"],[data-v="unlock"],[data-v="changego"]'); if(go) go.click();
    }
  });
  $('vaultbox').addEventListener('input', touchVault);
  $('vault').addEventListener('close', function(){ $('vaultbox').innerHTML = ''; vault.focus = null; });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden && vault.key){ vault.hideTimer = setTimeout(lockVault, 5 * 60 * 1000); } else { clearTimeout(vault.hideTimer); }
  });

  render();
  loadGuide();
  setInterval(function(){ if(document.activeElement !== $('q')) render(); }, 30000);
  setInterval(loadGuide, 30 * 60 * 1000);
  if('serviceWorker' in navigator && location.protocol.indexOf('http') === 0){ navigator.serviceWorker.register('sw.js').catch(function(){}); }
})();
