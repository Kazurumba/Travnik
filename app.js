/* ============ УТИЛИТЫ ============ */
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function p2(n){return n<10?'0'+n:''+n}
function showToast(m){var c=document.getElementById('tc'),t=document.createElement('div');t.className='tt';t.innerHTML='<svg><use href="#i-leaf"/></svg> '+esc(m);c.appendChild(t);setTimeout(function(){t.remove()},3000)}
/* ============ API КЛИЕНТ ============ */
function apiCall(action, data){
data = data || {};
return fetch('api.php?action=' + encodeURIComponent(action), {
method:'POST',
headers:{'Content-Type':'application/json'},
body: JSON.stringify(data)
}).then(function(res){
if (!res.ok) throw new Error('HTTP ' + res.status);
return res.text();
}).then(function(text){
if (!text || !text.trim()) throw new Error('Пустой ответ');
try { return JSON.parse(text); }
catch(e){ console.error('JSON:', text); throw new Error('Некорректный ответ'); }
}).catch(function(e){
console.error('API Error ['+action+']:', e);
showToast('Ошибка: ' + e.message);
return {success:false, error:e.message};
});
}
/* ============ ГЛОБАЛЬНОЕ СОСТОЯНИЕ ============ */
var CURRENT_USER = null;
var POSTS = [];
var HERBS = [];
var activeHerbId = null;
var chemFilters = {};
var herbPhotosArr = [];
var herbBm = JSON.parse(localStorage.getItem('t-herb-bm') || '[]');
var postBm = JSON.parse(localStorage.getItem('t-post-bm') || '[]');
var CAL = JSON.parse(localStorage.getItem('t-cal') || '{}');
var NOTI = JSON.parse(localStorage.getItem('t-noti') || '[]');
var _editingPostId = null;
function sHerbBm(){ localStorage.setItem('t-herb-bm', JSON.stringify(herbBm)); }
function sPostBm(){ localStorage.setItem('t-post-bm', JSON.stringify(postBm)); }
(function restoreSession(){
try {
var saved = localStorage.getItem('t-session');
if (saved) CURRENT_USER = JSON.parse(saved);
} catch(e){}
})();
function saveSession(){
if (CURRENT_USER) localStorage.setItem('t-session', JSON.stringify(CURRENT_USER));
else localStorage.removeItem('t-session');
}
function currentUserEmail(){ return CURRENT_USER ? CURRENT_USER.email : ''; }
function currentUserName(){ return CURRENT_USER ? (CURRENT_USER.name || 'Пользователь') : ''; }
function userInitials(){
if (!CURRENT_USER || !CURRENT_USER.name) return '?';
var parts = CURRENT_USER.name.split(' ');
return ((parts[0]||'')[0]||'') + ((parts[1]||'')[0]||'');
}
/* ============ МОДАЛКИ ============ */
var profileOpen=false;
function toggleProfile(){ var dd=document.getElementById('profile-dd'); if(!dd) return; profileOpen=!profileOpen; dd.classList.toggle('open',profileOpen); }
function closeProfile(){ profileOpen=false; var dd=document.getElementById('profile-dd'); if(dd) dd.classList.remove('open'); }
document.addEventListener('click',function(e){
var wrap=document.querySelector('.profile-wrap');
if(wrap && !wrap.contains(e.target)) closeProfile();
if(!e.target.closest('.post-menu-wrap')) closeAllPostMenus();
});
document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ closeProfile(); closeAllPostMenus(); document.querySelectorAll('.mo.open').forEach(function(m){ m.classList.remove('open'); }); }});
document.querySelectorAll('.mo').forEach(function(o){ o.addEventListener('click',function(e){ if(e.target===o) o.classList.remove('open'); }); });
function showPage(p){
document.querySelectorAll('.page,.cal-page,.bm-page,.herb-page,.herb-detail,.ref-page').forEach(function(e){ e.classList.remove('active'); });
var el=document.getElementById('pg-'+p); if(el) el.classList.add('active');
if(p==='market'){ rMP(); rMM(); rMC(); }
if(p==='calendar'){ rCal(); }
if(p==='bookmarks'){ rBm(); }
if(p==='herb'){ initHerb(); renderHerbs(); }
if(p==='reference'){ initRef(); }
closeProfile();
}
function sN(el){ document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('act'); }); el.classList.add('act'); }
function oSt(){ document.getElementById('stm').classList.add('open'); }
function cSt(){ document.getElementById('stm').classList.remove('open'); }
/* ============ АВТОРИЗАЦИЯ ============ */
function iL(){ return !!CURRENT_USER; }
function rA(){ if(iL()) return true; oAM(); showToast('Войдите для этого действия'); return false; }
function oAM(){ document.getElementById('aum').classList.add('open'); }
function cam(){ document.getElementById('aum').classList.remove('open'); }
function sat(t){
document.getElementById('atl').classList.toggle('on',t==='l');
document.getElementById('atr').classList.toggle('on',t==='r');
document.getElementById('atl').style.background = t==='l' ? 'var(--card)' : 'transparent';
document.getElementById('atl').style.color = t==='l' ? 'var(--ac)' : 'var(--tx-s)';
document.getElementById('atr').style.background = t==='r' ? 'var(--card)' : 'transparent';
document.getElementById('atr').style.color = t==='r' ? 'var(--ac)' : 'var(--tx-s)';
document.getElementById('aul').style.display = t==='l' ? '' : 'none';
document.getElementById('aur').style.display = t==='r' ? '' : 'none';
}
function dR(){
var n=document.getElementById('rn').value.trim();
var e=document.getElementById('re').value.trim();
var p=document.getElementById('rp').value;
var err=document.getElementById('re1');
err.textContent='';
if(!n || !e || p.length<4){ err.textContent='Заполните все поля (пароль ≥ 4 симв.)'; return; }
var btn = event.target; btn.disabled=true; btn.textContent='Создание...';
apiCall('register', {name:n, email:e, pass:p}).then(function(res){
btn.disabled=false; btn.textContent='Создать аккаунт';
if(res.success){
CURRENT_USER = {
id: res.user.id, name: res.user.name, email: res.user.email,
avatar: res.user.avatar, bio: res.user.bio, city: res.user.city, status_msg: res.user.status_msg
};
saveSession(); cam(); uUI(); loadPosts();
showToast('Добро пожаловать, ' + n + '!');
} else {
err.textContent = res.error || 'Ошибка регистрации';
}
});
}
function dL(){
var e=document.getElementById('le').value.trim();
var p=document.getElementById('lp').value;
var err=document.getElementById('le1');
err.textContent='';
if(!e || !p){ err.textContent='Заполните все поля'; return; }
var btn = event.target; btn.disabled=true; btn.textContent='Вход...';
apiCall('login', {email:e, pass:p}).then(function(res){
btn.disabled=false; btn.textContent='Войти';
if(res.success){
CURRENT_USER = {
id: res.user.id, name: res.user.name, email: res.user.email,
avatar: res.user.avatar, bio: res.user.bio, city: res.user.city, status_msg: res.user.status_msg
};
saveSession(); cam(); uUI(); loadPosts();
showToast('С возвращением, ' + res.user.name + '!');
} else {
err.textContent = res.error || 'Неверные данные';
}
});
}
function dO(){
CURRENT_USER = null; saveSession(); POSTS = []; renderFeed(); uUI();
showToast('Вы вышли из аккаунта'); closeProfile();
}
/* ============ UI ============ */
function uav(el){
if(!el) return;
if(CURRENT_USER && CURRENT_USER.avatar){
el.innerHTML = '<img src="'+CURRENT_USER.avatar+'" alt=""><span class="at" style="display:none">'+esc(userInitials())+'</span>';
} else {
el.innerHTML = '<span class="at">'+esc(userInitials())+'</span>';
}
}
function uUI(){
var a=document.getElementById('ha');
if(iL()){
var bmCount = postBm.length + herbBm.length;
// В ШАПКЕ УБРАН СТАТУС — только аватар и имя
a.innerHTML = '<div class="profile-wrap">'+
'<div class="profile-btn" onclick="toggleProfile()">'+
'<div class="mini-av">'+(CURRENT_USER.avatar?'<img src="'+CURRENT_USER.avatar+'">':'<span>'+esc(userInitials())+'</span>')+'</div>'+
'<span class="mini-name">'+esc(currentUserName())+'</span>'+
'</div>'+
'<div class="profile-dropdown" id="profile-dd">'+
'<div class="profile-header">'+
'<div class="pd-av">'+(CURRENT_USER.avatar?'<img src="'+CURRENT_USER.avatar+'">':'<span>'+esc(userInitials())+'</span>')+'</div>'+
'<div class="pd-info"><div class="pd-name">'+esc(currentUserName())+'</div><div class="pd-status">'+esc(CURRENT_USER.status_msg||'Травник')+'</div></div>'+
'</div>'+
'<div class="profile-body">'+
'<div class="profile-item" onclick="oPr();closeProfile()"><svg><use href="#i-user"/></svg> Мой профиль</div>'+
'<div class="profile-item" onclick="showPage(\'bookmarks\');closeProfile()"><svg><use href="#i-bm"/></svg> Закладки <span class="p-badge" id="pd-bm-bdg" style="display:'+(bmCount?'':'none')+'">'+bmCount+'</span></div>'+
'<div class="profile-item" onclick="showPage(\'calendar\');closeProfile()"><svg><use href="#i-calendar"/></svg> Календарь</div>'+
'<div class="profile-divider"></div>'+
'<div class="profile-item" onclick="oSt();closeProfile()"><svg><use href="#i-cog"/></svg> Настройки</div>'+
'</div>'+
'<div class="profile-footer">'+
'<button class="profile-logout" onclick="dO()"><svg><use href="#i-logout"/></svg> Выйти</button>'+
'</div>'+
'</div>'+
'</div>';
} else {
a.innerHTML = '<button class="auth-hdr-btn" onclick="oAM()">Войти</button>';
}
uav(document.getElementById('fa')); uav(document.getElementById('sa'));
uav(document.getElementById('pma')); uav(document.getElementById('pal'));
uav(document.getElementById('cma'));
document.getElementById('sn').textContent = iL() ? currentUserName() : 'Гость';
document.getElementById('ss').textContent = iL() ? (CURRENT_USER.status_msg||'Травник') : 'Войдите для полного доступа';
var ciEl=document.getElementById('s-ci'); var biEl=document.getElementById('s-bi');
if(CURRENT_USER && CURRENT_USER.city){ ciEl.textContent='📍 '+CURRENT_USER.city; ciEl.style.display=''; } else ciEl.style.display='none';
if(CURRENT_USER && CURRENT_USER.bio){ biEl.textContent=CURRENT_USER.bio; biEl.style.display=''; } else biEl.style.display='none';
document.getElementById('pmn').textContent = currentUserName() || 'Имя';
// Обновим резюме-хедер в модалке профиля
var pdn = document.getElementById('pr-display-name');
var pds = document.getElementById('pr-display-status');
var pde = document.getElementById('pr-display-email');
var pdm = document.getElementById('pr-display-meta');
if(pdn) pdn.textContent = currentUserName() || 'Имя пользователя';
if(pds) pds.textContent = (CURRENT_USER && CURRENT_USER.status_msg) || 'Травник';
if(pde) pde.textContent = currentUserEmail() || '';
if(pdm){
var metaItems = [];
if(CURRENT_USER && CURRENT_USER.city) metaItems.push('<span class="profile-resume-meta-item"><svg><use href="#i-globe"/></svg> '+esc(CURRENT_USER.city)+'</span>');
if(CURRENT_USER && CURRENT_USER.bio) metaItems.push('<span class="profile-resume-meta-item"><svg><use href="#i-book"/></svg> '+esc(CURRENT_USER.bio)+'</span>');
pdm.innerHTML = metaItems.join('');
}
updBmBadge();
}
/* ============ ЗАКЛАДКИ ============ */
function isPostBm(id){ return postBm.indexOf(String(id)) !== -1; }
function isHerbBm(id){ return herbBm.indexOf(String(id)) !== -1; }
function togglePostBm(id){
id = String(id);
var idx = postBm.indexOf(id);
if(idx !== -1){ postBm.splice(idx,1); showToast('Удалено из закладок'); }
else { postBm.push(id); showToast('Добавлено в закладки'); }
sPostBm(); updBmBadge();
var el = document.querySelector('[data-pid="'+id+'"]');
if(el){ var btn = el.querySelector('[data-bm-btn]'); if(btn) updBmBtn(btn,id); }
}
function toggleBmHerb(id){
id = String(id);
var idx = herbBm.indexOf(id);
if(idx !== -1){ herbBm.splice(idx,1); showToast('Удалено из закладок'); }
else { herbBm.push(id); showToast('Добавлено в закладки'); }
sHerbBm(); updBmBadge();
if(String(activeHerbId) === id) openHerbDetail(id);
}
function updBmBtn(btn,id){
var bookmarked = isPostBm(id);
btn.classList.toggle('bm', bookmarked);
btn.setAttribute('title', bookmarked ? 'Убрать из закладок' : 'В закладки');
btn.innerHTML = '<svg><use href="'+(bookmarked?'#i-bm-f':'#i-bm')+'"/></svg> <span>'+(bookmarked?'✓':'☆')+'</span>';
}
function updBmBadge(){
var count = postBm.length + herbBm.length;
['bm-bdg','pd-bm-bdg'].forEach(function(id){
var b = document.getElementById(id);
if(!b) return;
if(count > 0){ b.style.display=''; b.textContent = count; } else b.style.display='none';
});
var countEl = document.getElementById('bm-count');
if(countEl) countEl.textContent = count ? '('+count+')' : '';
}
function rBm(){
var bmPosts = POSTS.filter(function(p){ return isPostBm(p.id); });
var bmHerbs = HERBS.filter(function(h){ return isHerbBm(h.id); });
var listEl = document.getElementById('bm-list');
var total = bmPosts.length + bmHerbs.length;
updBmBadge();
if(!total){
listEl.innerHTML = '<div class="bm-empty"><svg><use href="#i-bm"/></svg><p>Закладок пока нет</p><span>Добавьте посты или травы в закладки</span></div>';
return;
}
var html = '';
if(bmHerbs.length){
html += '<h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ac)">🌿 Травы</h3>';
html += bmHerbs.map(function(h){
var propClass = getPropertyClass(h.properties);
return '<div class="herb-card '+propClass+'" style="margin-bottom:16px;cursor:pointer" onclick="showPage(\'herb\');setTimeout(function(){openHerbDetail('+h.id+')},100)"><div class="herb-card-header"><div class="herb-card-icon" style="background:'+typeColors[h.type]+'">'+(h.photos && h.photos.length>0?'<img src="'+h.photos[0]+'">':'<svg><use href="'+typeIcons[h.type]+'"/></svg>')+'</div><div class="herb-card-info"><div class="herb-card-name">'+esc(h.name)+'</div><div class="herb-card-latin">'+esc(h.latin_name||'')+'</div></div></div><div class="herb-card-footer"><span>'+typeNames[h.type]+'</span><span style="color:var(--ac)">✓ В закладках</span></div></div>';
}).join('');
}
if(bmPosts.length){
html += '<h3 style="font-size:16px;font-weight:700;margin:16px 0 12px;color:var(--tx)">📝 Записи</h3>';
html += bmPosts.map(function(p){ return '<article class="post" data-pid="'+p.id+'" style="margin-bottom:16px">'+buildPostHTML(p)+'</article>'; }).join('');
}
listEl.innerHTML = html;
}
/* ============ ПОСТЫ (СЕРВЕР) ============ */
var carIdx = {};
var ppArr = [];
function fmtTimeAgo(dt){
if(!dt) return 'только что';
var d = new Date(dt.replace(' ','T'));
var diff = Math.floor((Date.now() - d.getTime())/1000);
if(diff < 60) return 'только что';
if(diff < 3600) return Math.floor(diff/60) + ' мин. назад';
if(diff < 86400) return Math.floor(diff/3600) + ' ч. назад';
return p2(d.getDate()) + '.' + p2(d.getMonth()+1) + '.' + d.getFullYear();
}
function loadPosts(){
var loading = document.getElementById('feed-loading');
var statusEl = document.getElementById('global-db-status');
if(statusEl){
statusEl.className = 'db-status-badge loading';
statusEl.querySelector('.db-text').textContent = 'Загрузка постов...';
}
if(loading) loading.style.display = 'block';
apiCall('get_posts', {user_email: currentUserEmail()}).then(function(res){
if(loading) loading.style.display = 'none';
if(res.success){
if(statusEl){
statusEl.className = 'db-status-badge success';
statusEl.querySelector('.db-text').textContent = 'БД: ✓ Посты: ' + (res.data||[]).length;
statusEl.title = 'База данных подключена. Постов: ' + (res.data||[]).length;
}
POSTS = (res.data || []).map(function(p){
return {
id: p.id, user_id: p.user_id, text: p.text,
images: Array.isArray(p.images) ? p.images : [],
likes_count: parseInt(p.likes_count || 0),
shares_count: parseInt(p.shares_count || 0),
created_at: p.created_at,
author_name: p.author_name, author_avatar: p.author_avatar,
comments: (p.comments || []).map(function(c){
return { id: c.id, user_id: c.user_id, author_name: c.author_name,
author_avatar: c.author_avatar, text: c.text, created_at: c.created_at };
}),
liked_by_me: !!p.liked_by_me,
owned_by_me: CURRENT_USER && (p.user_id == CURRENT_USER.id)
};
});
renderFeed();
} else {
if(statusEl){
statusEl.className = 'db-status-badge error';
statusEl.querySelector('.db-text').textContent = '❌ ' + (res.error||'Ошибка').substring(0, 30);
statusEl.title = 'ОШИБКА БД: ' + (res.error||'Неизвестная ошибка') + ' Кликните для диагностики';
statusEl.style.cursor = 'pointer';
statusEl.onclick = function(){ runDiagnose(); };
}
POSTS = [];
renderFeed();
showToast('❌ Ошибка постов: ' + (res.error||''));
}
});
}
function runDiagnose(){
showToast('🔍 Запуск диагностики...');
apiCall('diagnose').then(function(res){
if(res.success){
var msg = '📊 ДИАГНОСТИКА БД: ';
msg += '✅ Таблицы: ' + res.tables.join(', ') + ' ';
msg += '📈 Количество записей: ';
for(var t in res.counts){ msg += '  • ' + t + ': ' + res.counts[t] + ' '; }
if(res.big_images_posts && res.big_images_posts.length > 0){
msg += ' ⚠️ Посты с огромными картинками (>1MB): ';
res.big_images_posts.forEach(function(p){ msg += '  • ID ' + p.id + ' (' + Math.round(p.img_size/1024) + ' KB) '; });
msg += ' 💡 Рекомендую очистить таблицу posts: Выполните в phpMyAdmin: TRUNCATE TABLE posts;';
}
alert(msg);
} else {
alert('❌ Ошибка диагностики: ' + res.error);
}
});
}
function renderFeed(){
var fd = document.getElementById('feed');
var composer = fd.querySelector('.pc');
fd.innerHTML = ''; fd.appendChild(composer);
if(!POSTS.length){
var empty = document.createElement('div');
empty.className = 'loading-feed';
empty.innerHTML = '<p style="margin-bottom:6px">📭 Лента пуста</p><span>Станьте первым, кто поделится рецептом!</span>';
fd.appendChild(empty);
return;
}
POSTS.forEach(function(p){
var d = document.createElement('article');
d.className = 'post'; d.dataset.pid = p.id;
d.innerHTML = buildPostHTML(p);
fd.appendChild(d);
});
// После рендера проверяем, какие тексты длинные и добавляем "Показать полностью"
setTimeout(attachReadMoreButtons, 50);
}

/* ====== КОМПАКТНЫЕ ПОСТЫ: "ПОКАЗАТЬ ПОЛНОСТЬЮ" ====== */
function attachReadMoreButtons(){
document.querySelectorAll('.post .pt').forEach(function(pt){
// Сначала сбросим
pt.classList.remove('clamped');
var rm = pt.parentElement.querySelector('.read-more');
if(rm) rm.remove();
// Проверим высоту
if(pt.scrollHeight > pt.clientHeight + 4 || pt.textContent.length > 200){
pt.classList.add('clamped');
var btn = document.createElement('button');
btn.className = 'read-more';
btn.textContent = 'Показать полностью ▾';
btn.onclick = function(e){
e.stopPropagation();
pt.classList.remove('clamped');
btn.textContent = 'Свернуть ▴';
btn.onclick = function(ev){
ev.stopPropagation();
pt.classList.add('clamped');
btn.textContent = 'Показать полностью ▾';
};
};
pt.parentElement.insertBefore(btn, pt.nextSibling);
}
});
}

/* ====== МЕНЮ ПОСТА (ТРИ ТОЧКИ) ====== */
function buildPostMenuHTML(p){
var isOwner = !!p.owned_by_me;
var ownerItems = '';
if(isOwner){
ownerItems =
'<button class="post-dropdown-item" onclick="editPost('+p.id+')"><svg><use href="#i-edit"/></svg> Редактировать</button>'+
'<button class="post-dropdown-item danger" onclick="dlP('+p.id+')"><svg><use href="#i-trash"/></svg> Удалить</button>'+
'<div class="post-dropdown-divider"></div>';
}
return '<div class="post-menu-wrap" data-pmenu="'+p.id+'" onclick="event.stopPropagation()">'+
'<button class="post-menu-btn" onclick="event.stopPropagation();togglePostMenu('+p.id+')" title="Меню записи" aria-label="Меню"><svg><use href="#i-more"/></svg></button>'+
'<div class="post-dropdown" id="pmenu-'+p.id+'">'+
ownerItems+
'<button class="post-dropdown-item" onclick="event.stopPropagation();openShareMenu('+p.id+')"><svg><use href="#i-share"/></svg> Поделиться</button>'+
'<div class="share-submenu" id="share-sub-'+p.id+'">'+
'<div class="share-submenu-title">Поделиться в</div>'+
'<div class="share-grid">'+
'<button class="share-btn vk" onclick="shareTo(\'vk\','+p.id+')" title="ВКонтакте"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.547 7h-3.2c-.332 0-.556.178-.658.506-.728 2.37-2.142 4.372-2.772 4.372-.3 0-.39-.234-.39-.686V7.54c0-.352-.1-.54-.35-.54H11.66c-.186 0-.3.132-.3.34 0 .45.68.55.75 1.78v2.67c0 .584-.106.69-.336.69-.614 0-2.108-2.238-2.992-4.798-.172-.496-.344-.696-.68-.696H5.1c-.3 0-.47.178-.47.436 0 .47.602 2.8 2.79 5.852C8.876 15.45 10.832 16.5 12.61 16.5c1.072 0 1.204-.238 1.204-.65v-1.65c0-.524.11-.63.478-.63.272 0 .738.138 1.826 1.18 1.244 1.242 1.45 1.798 2.148 1.798h3.2c.3 0 .456-.15.456-.428 0-.296-.336-.87-1.442-2.066-1.148-1.282-1.398-1.462-1.4-1.798 0-.136.058-.27.18-.392 1.542-1.616 3.192-4.29 3.192-4.688 0-.316-.198-.514-.504-.514z"/></svg><span>VK</span></button>'+
'<button class="share-btn ok" onclick="shareTo(\'ok\','+p.id+')" title="Одноклассники"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm0-2.4a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm3.3 10.5l1.5 1.5a1.2 1.2 0 1 1-1.7 1.7L12 14.8l-3.1 3.1a1.2 1.2 0 1 1-1.7-1.7l1.5-1.5c-1.4-.4-2.5-1.2-3.2-2.3a1.2 1.2 0 0 1 2-1.3c.5.8 1.5 1.3 2.7 1.3h3.6c1.2 0 2.2-.5 2.7-1.3a1.2 1.2 0 0 1 2 1.3c-.7 1.1-1.8 1.9-3.2 2.3z"/></svg><span>OK</span></button>'+
'<button class="share-btn tg" onclick="shareTo(\'tg\','+p.id+')" title="Telegram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg><span>Telegram</span></button>'+
'<button class="share-btn wa" onclick="shareTo(\'wa\','+p.id+')" title="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg><span>WhatsApp</span></button>'+
'</div>'+
'<button class="share-copy" onclick="copyPostLink('+p.id+')"><svg><use href="#i-link"/></svg> Скопировать ссылку</button>'+
'</div>'+
'</div>'+
'</div>';
}
function togglePostMenu(id){
var el = document.getElementById('pmenu-'+id);
if(!el) return;
var wasOpen = el.classList.contains('open');
closeAllPostMenus();
if(!wasOpen) el.classList.add('open');
}
function closeAllPostMenus(){
document.querySelectorAll('.post-dropdown.open').forEach(function(m){ m.classList.remove('open'); });
document.querySelectorAll('.share-submenu').forEach(function(s){ s.style.display='none'; });
}
function openShareMenu(id){
var sub = document.getElementById('share-sub-'+id);
if(!sub) return;
var isShown = sub.style.display === 'block';
sub.style.display = isShown ? 'none' : 'block';
}
function shareTo(service, id){
var p = POSTS.find(function(x){ return x.id == id; });
if(!p) return;
var pageUrl = window.location.href.split('#')[0];
var text = (p.text || '').substring(0, 240);
var url = encodeURIComponent(pageUrl);
var title = encodeURIComponent(text || 'Запись из Травникъ');
var links = {
vk: 'https://vk.com/share.php?url='+url+'&title='+title,
ok: 'https://connect.ok.ru/offer?url='+url+'&title='+title,
tg: 'https://t.me/share/url?url='+url+'&text='+encodeURIComponent(text),
wa: 'https://wa.me/?text='+encodeURIComponent(text + ' ' + pageUrl)
};
if(links[service]){
window.open(links[service], '_blank', 'width=640,height=560,menubar=no,toolbar=no');
}
closeAllPostMenus();
showToast('Открываем '+service.toUpperCase()+'…');
}
function copyPostLink(id){
var p = POSTS.find(function(x){ return x.id == id; });
if(!p) return;
var pageUrl = window.location.href.split('#')[0];
var text = (p.text || '').substring(0, 200);
var finalText = text ? (text + '\n' + pageUrl) : pageUrl;
var done = function(){ showToast('✓ Ссылка скопирована'); closeAllPostMenus(); };
if(navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(finalText).then(done).catch(function(){
fallbackCopy(finalText); done();
});
} else { fallbackCopy(finalText); done(); }
}
function fallbackCopy(txt){
var ta = document.createElement('textarea');
ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0';
document.body.appendChild(ta); ta.select();
try{ document.execCommand('copy'); }catch(e){}
document.body.removeChild(ta);
}
function editPost(id){
closeAllPostMenus();
var p = POSTS.find(function(x){ return x.id == id; });
if(!p) return;
if(!rA()) return;
_editingPostId = p.id;
document.getElementById('pta').value = p.text || '';
ppArr = Array.isArray(p.images) ? p.images.slice() : [];
updatePhotoPreview('ppv','pua');
var tEl = document.getElementById('pm-modal-title');
if(tEl) tEl.textContent = 'Редактировать запись';
var bEl = document.getElementById('pm-submit-btn');
if(bEl) bEl.textContent = 'Сохранить';
document.getElementById('pmm').classList.add('open');
setTimeout(function(){ document.getElementById('pta').focus(); }, 100);
}
function buildPostHTML(p){
var photos = Array.isArray(p.images) ? p.images : [];
var ih = '';
if(photos.length === 1){
ih = '<img class="pi" src="'+photos[0]+'" onclick="oImgV(\''+photos[0].replace(/'/g,"\\'")+'\')" alt="">';
} else if(photos.length > 1){
var dots = photos.map(function(_,i){ return '<span class="car-dot '+(i===0?'act':'')+'"></span>'; }).join('');
ih = '<div class="carousel" data-cid="'+p.id+'" data-len="'+photos.length+'"><img class="car-img" src="'+photos[0]+'" alt=""><button class="car-btn car-prev" onclick="carS('+p.id+',-1)"><svg><use href="#i-chevron-l"/></svg></button><button class="car-btn car-next" onclick="carS('+p.id+',1)"><svg><use href="#i-chevron-r"/></svg></button><div class="car-dots">'+dots+'</div></div>';
}
var th = p.text ? '<div class="pt">'+esc(p.text).replace(/#(\S+)/g,'<span class="ht">#$1</span>')+'</div>' : '';
var avHtml = p.author_avatar ? '<img src="'+p.author_avatar+'" alt="">' : '<span class="at">'+esc(((p.author_name||'?').trim()[0]||'?').toUpperCase())+'</span>';
var menuHTML = buildPostMenuHTML(p);
var cmCount = p.comments ? p.comments.length : 0;
var bookmarked = isPostBm(p.id);
return menuHTML +
'<div class="ph"><div class="avatar-wrap" style="width:40px;height:40px;font-size:13px;cursor:default">'+avHtml+'</div>'+
'<div class="pai"><div class="pa">'+esc(p.author_name||'Аноним')+'</div>'+
'<div class="pm"><span>'+esc(fmtTimeAgo(p.created_at))+'</span> <svg style="width:10px;height:10px"><use href="#i-globe"/></svg></div></div></div>'+
th + ih +
'<div class="ps"><div style="font-size:11px;color:var(--tx-m)">'+p.likes_count+' нравится</div>'+
'<div><span>'+cmCount+' комм.</span> · <span>'+p.shares_count+' реп.</span></div></div>'+
'<div class="pas">'+
'<button class="pab'+(p.liked_by_me?' lk':'')+'" onclick="rA()&&tL('+p.id+')"><svg><use href="'+(p.liked_by_me?'#i-heart-f':'#i-heart')+'"/></svg> <span>'+p.likes_count+'</span></button>'+
'<button class="pab" onclick="rA()&&oCM('+p.id+')"><svg><use href="#i-comment"/></svg> <span>'+cmCount+'</span></button>'+
'<button class="pab" onclick="rA()&&showToast(\'Поделиться\')"><svg><use href="#i-share"/></svg> <span>'+p.shares_count+'</span></button>'+
'<button class="pab'+(bookmarked?' bm':'')+'" data-bm-btn onclick="rA()&&togglePostBm('+p.id+')" title="'+(bookmarked?'Убрать из закладок':'В закладки')+'"><svg><use href="'+(bookmarked?'#i-bm-f':'#i-bm')+'"/></svg> <span>'+(bookmarked?'✓':'☆')+'</span></button>'+
'</div>';
}
function carS(id,dir){
var p = POSTS.find(function(x){ return x.id == id; });
if(!p || !Array.isArray(p.images) || p.images.length < 2) return;
var len = p.images.length;
if(!carIdx[id]) carIdx[id] = 0;
carIdx[id] = (carIdx[id] + dir + len) % len;
var el = document.querySelector('.carousel[data-cid="'+id+'"]');
if(el){
el.querySelector('.car-img').src = p.images[carIdx[id]];
el.querySelectorAll('.car-dot').forEach(function(d,i){ d.classList.toggle('act', i===carIdx[id]); });
}
}
function oPM(){
document.getElementById('pmm').classList.add('open'); ppArr = [];
updatePhotoPreview('ppv','pua');
var tEl = document.getElementById('pm-modal-title');
if(tEl) tEl.textContent = 'Новая запись';
var bEl = document.getElementById('pm-submit-btn');
if(bEl) bEl.textContent = 'Опубликовать';
_editingPostId = null;
setTimeout(function(){ document.getElementById('pta').focus(); }, 100);
}
function cpm(){
document.getElementById('pmm').classList.remove('open'); ppArr = [];
document.getElementById('pta').value = '';
updatePhotoPreview('ppv','pua');
_editingPostId = null;
var tEl = document.getElementById('pm-modal-title');
if(tEl) tEl.textContent = 'Новая запись';
var bEl = document.getElementById('pm-submit-btn');
if(bEl) bEl.textContent = 'Опубликовать';
}
function hpp(inp){ handleMultiFile(inp, function(arr){ ppArr = ppArr.concat(arr); updatePhotoPreview('ppv','pua'); }); }
function handleMultiFile(inp, cb){
var files = Array.from(inp.files);
if(!files.length) return;
var res = [], loaded = 0;
files.forEach(function(f){
if(!f.type.startsWith('image/')) return;
var r = new FileReader();
r.onload = function(e){
compressImage(e.target.result, 1200, 0.8, function(compressed){
res.push(compressed); loaded++;
if(loaded === files.length) cb(res);
});
};
r.readAsDataURL(f);
});
inp.value = '';
}
function compressImage(dataUrl, maxW, quality, cb){
var img = new Image();
img.onload = function(){
var w = img.width, h = img.height;
if(w > maxW){ h = Math.round(h * maxW / w); w = maxW; }
var canvas = document.createElement('canvas');
canvas.width = w; canvas.height = h;
var ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0, w, h);
cb(canvas.toDataURL('image/jpeg', quality));
};
img.src = dataUrl;
}
function updatePhotoPreview(previewId, uploadId){
var cont = document.getElementById(previewId);
if(!cont) return;
cont.innerHTML = '';
var arr = (previewId === 'ppv') ? ppArr : herbPhotosArr;
if(!arr.length){ cont.style.display = 'none'; var up = document.getElementById(uploadId); if(up) up.style.display=''; return; }
cont.style.display = 'flex';
var up2 = document.getElementById(uploadId); if(up2) up2.style.display = arr.length >= 5 ? 'none' : '';
arr.forEach(function(src,i){
var d = document.createElement('div');
d.className = 'ppv-item';
d.innerHTML = '<img src="'+src+'"><button class="ppv-rm" onclick="rmPhoto(\''+previewId+'\','+i+')">×</button>';
cont.appendChild(d);
});
}
function rmPhoto(previewId, idx){
if(previewId === 'ppv') ppArr.splice(idx,1);
else if(previewId === 'herb-ppv') herbPhotosArr.splice(idx,1);
updatePhotoPreview(previewId, previewId === 'ppv' ? 'pua' : 'herb-pua');
}
function pbP(){
var t = document.getElementById('pta').value.trim();
if(!t && !ppArr.length){ showToast('Напишите текст или добавьте фото'); return; }
if(!CURRENT_USER){ showToast('Войдите в аккаунт'); return; }
var btn = document.getElementById('pm-submit-btn');
var originalText = btn ? btn.textContent : 'Опубликовать';
if(btn){ btn.disabled = true; btn.textContent = 'Сохранение...'; }
var doCreate = function(){
apiCall('create_post', {
user_email: currentUserEmail(), text: t, images: ppArr
}).then(function(res){
if(btn){ btn.disabled = false; btn.textContent = originalText; }
if(res.success){
var wasEditing = !!_editingPostId;
_editingPostId = null;
cpm();
showToast(wasEditing ? '✓ Запись обновлена' : '✓ Опубликовано!');
loadPosts();
} else {
showToast('Ошибка: ' + (res.error || ''));
}
});
};
if(_editingPostId){
var editId = _editingPostId;
apiCall('delete_post', {id: editId}).then(function(res){
if(res.success){ doCreate(); }
else {
showToast('Ошибка: ' + (res.error || ''));
if(btn){ btn.disabled = false; btn.textContent = originalText; }
}
});
} else {
doCreate();
}
}
function tL(id){
apiCall('toggle_like', {post_id: id, user_email: currentUserEmail()}).then(function(res){
if(res.success){
var p = POSTS.find(function(x){ return x.id == id; });
if(p){
p.liked_by_me = res.liked;
p.likes_count = Math.max(0, (p.likes_count || 0) + (res.liked ? 1 : -1));
var el = document.querySelector('[data-pid="'+id+'"]');
if(el){ el.innerHTML = buildPostHTML(p); attachReadMoreButtons(); }
}
}
});
}
function dlP(id){
if(!confirm('Удалить запись с сервера?')) return;
apiCall('delete_post', {id: id}).then(function(res){
if(res.success){ showToast('✓ Удалено'); loadPosts(); }
else { showToast('Ошибка: ' + (res.error||'')); }
});
}
var viewCmId = null;
function oCM(id){
viewCmId = id; renderCmList();
document.getElementById('cmi').value = '';
document.getElementById('cmm').classList.add('open');
setTimeout(function(){ document.getElementById('cmi').focus(); }, 100);
}
function ccm(){ document.getElementById('cmm').classList.remove('open'); viewCmId = null; }
function renderCmList(){
var p = POSTS.find(function(x){ return x.id == viewCmId; });
if(!p) return;
var listEl = document.getElementById('cmb-list');
if(!p.comments || !p.comments.length){
listEl.innerHTML = '<div style="text-align:center;color:var(--tx-m);padding:30px 0">Пока нет комментариев</div>';
return;
}
listEl.innerHTML = p.comments.map(function(c){
var ca = c.author_avatar ? '<img src="'+c.author_avatar+'" alt="">' : '<span class="at">'+esc(((c.author_name||'?').trim()[0]||'?').toUpperCase())+'</span>';
return '<div class="cm"><div class="avatar-wrap" style="width:34px;height:34px;font-size:11px;cursor:default">'+ca+'</div>'+
'<div class="cmb"><div class="cma">'+esc(c.author_name||'Аноним')+'</div>'+
'<div class="cmt">'+esc(c.text)+'</div>'+
'<div class="cmtm">'+esc(fmtTimeAgo(c.created_at))+'</div></div></div>';
}).join('');
listEl.scrollTop = listEl.scrollHeight;
}
function aCM(){
var inp = document.getElementById('cmi');
var t = inp.value.trim();
if(!t) return;
if(!CURRENT_USER){ showToast('Войдите в аккаунт'); return; }
apiCall('add_comment', { post_id: viewCmId, user_email: currentUserEmail(), text: t }).then(function(res){
if(res.success){
inp.value = '';
var p = POSTS.find(function(x){ return x.id == viewCmId; });
if(p){
p.comments = p.comments || [];
p.comments.push({
id: res.comment_id, user_id: CURRENT_USER.id,
author_name: currentUserName(), author_avatar: CURRENT_USER.avatar,
text: t, created_at: new Date().toISOString()
});
renderCmList();
var el = document.querySelector('[data-pid="'+p.id+'"]');
if(el) el.innerHTML = buildPostHTML(p);
}
showToast('Комментарий добавлен');
}
});
}
/* ============ ПРОФИЛЬ ============ */
function oPr(){
if(!CURRENT_USER) return;
document.getElementById('pfn').value = CURRENT_USER.name || '';
document.getElementById('pst').value = CURRENT_USER.status_msg || '';
document.getElementById('pci').value = CURRENT_USER.city || '';
document.getElementById('pbi').value = CURRENT_USER.bio || '';
document.getElementById('pem').value = CURRENT_USER.email || '';
uUI();
document.getElementById('prm').classList.add('open');
}
function cprm(){ document.getElementById('prm').classList.remove('open'); }
function hap(inp){
var f = inp.files[0]; if(!f) return;
var r = new FileReader();
r.onload = function(e){
compressImage(e.target.result, 400, 0.85, function(data){
CURRENT_USER.avatar = data; uUI();
showToast('Аватар обновлён (сохранится с профилем)');
});
};
r.readAsDataURL(f);
}
function svP(){
if(!CURRENT_USER) return;
var payload = {
email: currentUserEmail(),
name: document.getElementById('pfn').value.trim() || CURRENT_USER.name,
status_msg: document.getElementById('pst').value.trim(),
city: document.getElementById('pci').value.trim(),
bio: document.getElementById('pbi').value.trim()
};
if(CURRENT_USER.avatar) payload.avatar = CURRENT_USER.avatar;
apiCall('update_profile', payload).then(function(res){
if(res.success){
CURRENT_USER.name = payload.name;
CURRENT_USER.status_msg = payload.status_msg;
CURRENT_USER.city = payload.city;
CURRENT_USER.bio = payload.bio;
saveSession(); uUI(); loadPosts(); cprm();
showToast('✓ Профиль сохранён');
} else {
showToast('Ошибка: ' + (res.error||''));
}
});
}
/* ============ ТРАВНИК ============ */
var typeIcons = { herb:'#i-leaf-simple', shrub:'#i-shrub', tree:'#i-tree', flower:'#i-flower', mushroom:'#i-flower', lichen:'#i-bark' };
var typeColors = {
herb:'linear-gradient(135deg,#4a7a4a,#2d5a2d)', shrub:'linear-gradient(135deg,#5a6a3a,#3a4a1a)',
tree:'linear-gradient(135deg,#6a5a3a,#4a3a1a)', flower:'linear-gradient(135deg,#8a5a7a,#5a3a4a)',
mushroom:'linear-gradient(135deg,#7a5a4a,#5a3a2a)', lichen:'linear-gradient(135deg,#5a5a6a,#3a3a4a)'
};
var propertyColors = {
'противовоспалительное':'anti-inflammatory','anti-inflammatory':'anti-inflammatory',
'мочегонное':'diuretic','diuretic':'diuretic','успокоительное':'sedative','sedative':'sedative',
'желчегонное':'cholagogue','cholagogue':'cholagogue','кровоостанавливающее':'hemostatic','hemostatic':'hemostatic',
'иммуномодулирующее':'immunomodulatory','immunomodulatory':'immunomodulatory',
'антимикробное':'antimicrobial','antimicrobial':'antimicrobial',
'антиоксидантное':'antioxidant','antioxidant':'antioxidant',
'сердечно-сосудистое':'cardiovascular','cardiovascular':'cardiovascular',
'пищеварительное':'digestive','digestive':'digestive'
};
var chemNames = {tannins:'Дубильные',flavonoids:'Флавоноиды',alkaloids:'Алкалоиды',essentialOils:'Эфирные масла',saponins:'Сапонины',glycosides:'Гликозиды',organicAcids:'Орг. кислоты',polysaccharides:'Полисахариды',coumarins:'Кумарины',anthocyanins:'Антоцианы'};
var vitNames = {A:'A',C:'C',E:'E',K:'K',B1:'B₁',B2:'B₂',B6:'B₆',B12:'B₁₂'};
var minNames = {iron:'Fe',zinc:'Zn',magnesium:'Mg',calcium:'Ca',potassium:'K',selenium:'Se',manganese:'Mn',copper:'Cu'};
var partNames = {leaf:'Лист',flower:'Цветок',root:'Корень',bark:'Кора',fruit:'Плод',seed:'Семя',whole:'Всё растение'};
var typeNames = {herb:'Трава',shrub:'Кустарник',tree:'Дерево',flower:'Цветок',mushroom:'Гриб',lichen:'Лишайник'};
function normalizeHerb(h){
return {
id: h.id, name: h.name || '', latin_name: h.latin_name || h.latinName || '',
type: h.type || 'herb',
parts: Array.isArray(h.parts) ? h.parts : [],
chemicals: (typeof h.chemicals === 'string') ? JSON.parse(h.chemicals || '{}') : (h.chemicals || {}),
vitamins: (typeof h.vitamins === 'string') ? JSON.parse(h.vitamins || '{}') : (h.vitamins || {}),
minerals: (typeof h.minerals === 'string') ? JSON.parse(h.minerals || '{}') : (h.minerals || {}),
properties: Array.isArray(h.properties) ? h.properties : [],
indications: Array.isArray(h.indications) ? h.indications : [],
contraindications: Array.isArray(h.contraindications) ? h.contraindications : [],
preparation: h.preparation || '', harvest: h.harvest || '', notes: h.notes || '',
photos: Array.isArray(h.photos) ? h.photos : []
};
}
function initHerb(){
var statusEl = document.getElementById('global-db-status');
if(statusEl){ statusEl.className = 'db-status-badge loading'; statusEl.querySelector('.db-text').textContent = 'Загрузка БД...'; }
apiCall('get_herbs').then(function(res){
if(res.success){
HERBS = (res.data || []).map(normalizeHerb);
if(statusEl){ statusEl.className = 'db-status-badge success'; statusEl.querySelector('.db-text').textContent = 'БД: ' + HERBS.length; }
renderHerbs();
} else {
if(statusEl){ statusEl.className = 'db-status-badge error'; statusEl.querySelector('.db-text').textContent = 'Ошибка БД'; }
showToast('Не удалось загрузить травы: ' + (res.error||''));
HERBS = []; renderHerbs();
}
});
}
function getPropertyClass(props){
if(!props || !props.length) return '';
for(var i=0; i<props.length; i++){
var p = String(props[i]).toLowerCase().trim();
if(propertyColors[p]) return propertyColors[p];
}
return '';
}
function renderHerbs(){
var grid = document.getElementById('herb-grid');
var emptyEl = document.getElementById('herb-empty');
var searchTerm = (document.getElementById('herb-search').value||'').toLowerCase();
var typeFilter = document.getElementById('herb-type-filter').value;
var herbs = HERBS.filter(function(h){
var latin = h.latin_name || '';
if(searchTerm && h.name.toLowerCase().indexOf(searchTerm)===-1 && latin.toLowerCase().indexOf(searchTerm)===-1) return false;
if(typeFilter && h.type !== typeFilter) return false;
for(var key in chemFilters){
if(chemFilters[key] && !(h.chemicals||{})[key] && !(h.vitamins||{})[key] && !(h.minerals||{})[key]) return false;
}
return true;
});
if(!herbs.length){ grid.innerHTML=''; emptyEl.style.display='block'; return; }
emptyEl.style.display='none';
grid.innerHTML = herbs.map(function(h){
var chemTags=[];
var ch = h.chemicals || {}, vt = h.vitamins || {}, mn = h.minerals || {};
for(var c in ch){ if(ch[c]) chemTags.push('<span class="herb-chem">'+(chemNames[c]||c)+'</span>'); }
for(var v in vt){ if(vt[v]) chemTags.push('<span class="herb-chem">Вит.'+vitNames[v]+'</span>'); }
for(var m in mn){ if(mn[m]) chemTags.push('<span class="herb-chem">'+minNames[m]+'</span>'); }
var partsHtml = (h.parts||[]).map(function(p){ return '<span class="herb-tag">'+partNames[p]+'</span>'; }).join('');
var propClass = getPropertyClass(h.properties);
var iconHtml = h.photos && h.photos.length > 0
? '<img src="'+h.photos[0]+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block">'
: '<svg style="width:24px;height:24px"><use href="'+typeIcons[h.type]+'"/></svg>';
return '<div class="herb-card '+propClass+'" onclick="openHerbDetail('+h.id+')">'+
'<div class="herb-card-header"><div class="herb-card-icon" style="background:'+typeColors[h.type]+'">'+iconHtml+'</div>'+
'<div class="herb-card-info"><div class="herb-card-name">'+esc(h.name)+'</div><div class="herb-card-latin">'+esc(h.latin_name)+'</div></div></div>'+
'<div class="herb-card-body"><div class="herb-card-tags">'+partsHtml+'</div>'+
'<div class="herb-card-chemicals">'+chemTags.slice(0,6).join('')+(chemTags.length>6?' <span class="herb-chem">+...</span>':'')+'</div>'+
'<div class="herb-card-parts">'+(h.properties||[]).slice(0,3).join(', ')+(h.properties && h.properties.length>3?'...':'')+'</div></div>'+
'<div class="herb-card-footer"><span>'+typeNames[h.type]+'</span><span>'+(h.parts||[]).length+' част.</span></div></div>';
}).join('');
}
function toggleChemFilter(key, el){ chemFilters[key] = !chemFilters[key]; el.classList.toggle('on', chemFilters[key]); renderHerbs(); }
function clearFilters(){
chemFilters = {};
document.querySelectorAll('.herb-filter.on').forEach(function(el){ el.classList.remove('on'); });
document.getElementById('herb-search').value = '';
document.getElementById('herb-type-filter').value = '';
renderHerbs();
}
function openHerbDetail(id){
activeHerbId = id;
var h = HERBS.find(function(x){ return String(x.id) === String(id); });
if(!h){ showToast('Трава не найдена'); return; }
h.chemicals = h.chemicals || {}; h.vitamins = h.vitamins || {}; h.minerals = h.minerals || {};
h.properties = h.properties || []; h.indications = h.indications || [];
h.contraindications = h.contraindications || []; h.parts = h.parts || []; h.photos = h.photos || [];
var chemHtml = '<div class="herb-chem-grid">';
for(var c in chemNames){ var has = !!h.chemicals[c]; chemHtml += '<div class="herb-chem-item'+(has?' present':'')+'"><svg><use href="#i-flask"/></svg><span>'+(chemNames[c]||c)+'</span>'+(has?' <svg style="width:10px;height:10px;color:var(--on)"><use href="#i-check"/></svg>':'')+'</div>'; }
chemHtml += '</div>';
var vitHtml = '<div class="herb-chem-grid">';
for(var v in vitNames){ var has = !!h.vitamins[v]; vitHtml += '<div class="herb-chem-item'+(has?' present':'')+'"><span>Вит. '+vitNames[v]+'</span>'+(has?' <svg style="width:10px;height:10px;color:var(--on)"><use href="#i-check"/></svg>':'')+'</div>'; }
vitHtml += '</div>';
var minHtml = '<div class="herb-chem-grid">';
for(var m in minNames){ var has = !!h.minerals[m]; minHtml += '<div class="herb-chem-item'+(has?' present':'')+'"><span>'+minNames[m]+'</span>'+(has?' <svg style="width:10px;height:10px;color:var(--on)"><use href="#i-check"/></svg>':'')+'</div>'; }
minHtml += '</div>';
var propsHtml = h.properties.map(function(p){ return '<span class="herb-prop">'+esc(p)+'</span>'; }).join('');
var contrHtml = h.contraindications.map(function(c){ return '<span class="herb-contr">'+esc(c)+'</span>'; }).join('');
var indHtml = h.indications.map(function(i){ return '<span class="herb-prop" style="background:var(--bd-l);color:var(--tx)">'+esc(i)+'</span>'; }).join('');
var photosHtml = '';
if(h.photos && h.photos.length){
photosHtml = '<div style="margin-top:12px"><strong>Фотографии:</strong><div class="herb-images">'+h.photos.map(function(src){ return '<img class="herb-img" src="'+src+'" onclick="oImgV(\''+src.replace(/'/g,"\\'")+'\')" alt="">'; }).join('')+'</div></div>';
}
var partsText = h.parts.map(function(p){ return partNames[p] || p; }).join(', ') || 'не указаны';
document.getElementById('herb-detail-content').innerHTML =
'<div class="herb-detail-header"><div class="herb-detail-icon" style="background:'+typeColors[h.type]+'" onclick="oImgV(\''+(h.photos[0]||'').replace(/'/g,"\\'")+'\')">'+
(h.photos && h.photos.length>0 ? '<img src="'+h.photos[0]+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:16px;display:block">' : '<svg style="width:40px;height:40px"><use href="'+typeIcons[h.type]+'"/></svg>')+
'</div><div class="herb-detail-info"><div class="herb-detail-name">'+esc(h.name)+'</div>'+
'<div class="herb-detail-latin">'+esc(h.latin_name)+'</div>'+
'<div class="herb-detail-meta"><span class="herb-detail-type">'+typeNames[h.type]+'</span><span class="herb-detail-parts">'+partsText+'</span></div>'+
'<div class="herb-detail-actions-top">'+
'<button class="bt bt1" onclick="toggleBmHerb('+h.id+')"><svg style="width:14px;height:14px;vertical-align:-2px"><use href="'+(isHerbBm(h.id)?'#i-bm-f':'#i-bm')+'"/></svg> '+(isHerbBm(h.id)?'✓ В закладках':'☆ В закладки')+'</button>'+
'<button class="bt bt2" style="color:var(--dn);border:1px solid var(--dn)" onclick="deleteHerb('+h.id+')"><svg style="width:14px;height:14px;vertical-align:-2px"><use href="#i-trash"/></svg> Удалить</button>'+
'</div></div></div>'+
'<div class="herb-detail-section"><h4><svg><use href="#i-flask"/></svg> Химический состав</h4><div style="margin-bottom:12px"><strong>Основные соединения:</strong></div>'+chemHtml+'<div style="margin:16px 0 8px"><strong>Витамины:</strong></div>'+vitHtml+'<div style="margin:16px 0 8px"><strong>Минералы:</strong></div>'+minHtml+'</div>'+
'<div class="herb-detail-section"><h4><svg><use href="#i-mortar"/></svg> Показания</h4><div class="herb-props-list">'+(indHtml||'<span style="color:var(--tx-m)">Не указаны</span>')+'</div></div>'+
'<div class="herb-detail-section"><h4><svg><use href="#i-mortar"/></svg> Свойства</h4><div class="herb-props-list">'+(propsHtml||'<span style="color:var(--tx-m)">Не указаны</span>')+'</div></div>'+
'<div class="herb-detail-section"><h4><svg><use href="#i-x"/></svg> Противопоказания</h4><div class="herb-contr-list">'+(contrHtml||'<span style="color:var(--tx-m)">Не указаны</span>')+'</div></div>'+
'<div class="herb-detail-section"><h4><svg><use href="#i-seedling"/></svg> Сбор</h4><div class="herb-prep">'+esc(h.harvest||'Нет данных')+'</div></div>'+
'<div class="herb-detail-section"><h4><svg><use href="#i-mortar"/></svg> Применение</h4><div class="herb-prep">'+esc(h.preparation||'Нет данных')+'</div></div>'+
(h.notes?'<div class="herb-detail-section"><h4><svg><use href="#i-book"/></svg> Заметки</h4><div class="herb-prep">'+esc(h.notes)+'</div></div>':'')+
photosHtml;
document.querySelectorAll('.herb-page,.herb-detail').forEach(function(e){ e.classList.remove('active'); });
document.getElementById('herb-detail').classList.add('active');
window.scrollTo(0,0);
}
function showHerbList(){
document.querySelectorAll('.herb-page,.herb-detail').forEach(function(e){ e.classList.remove('active'); });
document.getElementById('pg-herb').classList.add('active');
renderHerbs();
}
function handleHerbPhotos(inp){
handleMultiFile(inp, function(arr){
herbPhotosArr = herbPhotosArr.concat(arr);
updatePhotoPreview('herb-ppv','herb-pua');
});
}
function oHerbForm(editId){
var form = document.getElementById('herb-form');
var title = document.getElementById('herb-form-title');
if(editId){
var h = HERBS.find(function(x){ return x.id == editId; });
if(!h) return;
title.textContent = 'Редактировать: ' + h.name;
document.getElementById('hf-id').value = h.id;
document.getElementById('hf-name').value = h.name || '';
document.getElementById('hf-latin').value = h.latin_name || '';
document.getElementById('hf-type').value = h.type || 'herb';
document.querySelectorAll('input[name="hf-parts"]').forEach(function(cb){ cb.checked = (h.parts||[]).indexOf(cb.value) !== -1; });
document.querySelectorAll('input[name="hf-chem"]').forEach(function(cb){ cb.checked = !!(h.chemicals||{})[cb.value]; });
document.querySelectorAll('input[name="hf-vit"]').forEach(function(cb){ cb.checked = !!(h.vitamins||{})[cb.value]; });
document.querySelectorAll('input[name="hf-min"]').forEach(function(cb){ cb.checked = !!(h.minerals||{})[cb.value]; });
document.getElementById('hf-indications').value = (h.indications||[]).join(', ');
document.getElementById('hf-harvest').value = h.harvest || '';
document.getElementById('hf-props').value = (h.properties||[]).join(', ');
document.getElementById('hf-contr').value = (h.contraindications||[]).join(', ');
document.getElementById('hf-prep').value = h.preparation || '';
document.getElementById('hf-notes').value = h.notes || '';
herbPhotosArr = h.photos ? h.photos.slice() : [];
updatePhotoPreview('herb-ppv','herb-pua');
} else {
title.textContent = 'Добавить траву';
form.reset(); document.getElementById('hf-id').value = ''; herbPhotosArr = [];
updatePhotoPreview('herb-ppv','herb-pua');
}
document.getElementById('herb-form-modal').classList.add('open');
}
function cHerbForm(){ document.getElementById('herb-form-modal').classList.remove('open'); }
function saveHerb(e){
e.preventDefault();
var id = document.getElementById('hf-id').value;
var chemicals = {}, vitamins = {}, minerals = {};
document.querySelectorAll('input[name="hf-chem"]:checked').forEach(function(cb){ chemicals[cb.value] = true; });
document.querySelectorAll('input[name="hf-vit"]:checked').forEach(function(cb){ vitamins[cb.value] = true; });
document.querySelectorAll('input[name="hf-min"]:checked').forEach(function(cb){ minerals[cb.value] = true; });
var parts = [];
document.querySelectorAll('input[name="hf-parts"]:checked').forEach(function(cb){ parts.push(cb.value); });
var herbData = {
id: id ? parseInt(id) : null,
name: document.getElementById('hf-name').value.trim(),
latin_name: document.getElementById('hf-latin').value.trim(),
type: document.getElementById('hf-type').value,
parts: parts, chemicals: chemicals, vitamins: vitamins, minerals: minerals,
indications: document.getElementById('hf-indications').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
harvest: document.getElementById('hf-harvest').value.trim(),
properties: document.getElementById('hf-props').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
contraindications: document.getElementById('hf-contr').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean),
preparation: document.getElementById('hf-prep').value.trim(),
notes: document.getElementById('hf-notes').value.trim(),
photos: herbPhotosArr
};
var submitBtn = e.target.querySelector('button[type="submit"]');
var originalText = submitBtn.textContent;
submitBtn.disabled = true; submitBtn.textContent = 'Сохранение...';
apiCall('save_herb', herbData).then(function(res){
if(res.success){
showToast(id ? '✓ Запись обновлена в БД' : '✓ Трава добавлена в БД');
cHerbForm(); initHerb();
if(res.id) setTimeout(function(){ openHerbDetail(res.id); }, 300);
} else {
showToast('❌ Ошибка: ' + (res.error||''));
}
submitBtn.disabled = false; submitBtn.textContent = originalText;
});
}
function editCurrentHerb(){ if(activeHerbId) oHerbForm(activeHerbId); }
function deleteHerb(id){
if(!confirm('Удалить запись из базы данных?')) return;
apiCall('delete_herb', {id: id}).then(function(res){
if(res.success){
showToast('✓ Удалено из БД');
herbBm = herbBm.filter(function(bmId){ return String(bmId) != String(id); });
sHerbBm(); updBmBadge();
initHerb(); showHerbList();
} else {
showToast('❌ Ошибка: ' + (res.error||''));
}
});
}
function exportHerbs(){
var data = JSON.stringify(HERBS, null, 2);
var blob = new Blob([data], {type:'application/json'});
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url; a.download = 'travnik-library-' + new Date().toISOString().slice(0,10) + '.json';
document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
showToast('Библиотека экспортирована');
}
function importHerbs(inp){
var file = inp.files[0]; if(!file) return;
var reader = new FileReader();
reader.onload = function(e){
try {
var data = JSON.parse(e.target.result);
if(!Array.isArray(data)){ showToast('Файл должен содержать массив'); return; }
var count = 0;
var promises = data.map(function(h){
if(h.name && (h.latin_name || h.latinName)){
return apiCall('save_herb', h).then(function(res){ if(res.success) count++; });
}
return Promise.resolve();
});
Promise.all(promises).then(function(){
showToast('Импортировано в БД: ' + count + ' трав');
initHerb();
});
} catch(err){ showToast('Ошибка: ' + err.message); }
inp.value = '';
};
reader.readAsText(file);
}
function oImgV(src){ if(!src) return; document.getElementById('img-viewer-src').src = src; document.getElementById('img-viewer-m').classList.add('open'); }
function cImgV(){ document.getElementById('img-viewer-m').classList.remove('open'); }

/* ============ СПРАВОЧНИК ВЕЩЕСТВ ============ */
var REF_DEFAULT = [
{id:'vitA',cat:'vitamins',name:'Витамин A (Ретинол)',formula:'C₂₀H₃₀O',color:'#e67e22',desc:'Жирорастворимый витамин, мощный антиоксидант. Критически важен для зрения (особенно сумеречного), роста и дифференцировки клеток, иммунной функции и целостности кожи и слизистых.',role:'Обеспечивает работу родопсина в сетчатке (ночное зрение), регулирует деление клеток эпителия, поддерживает выработку лимфоцитов и антител. Ускоряет регенерацию тканей.',deficit:'«Куриная слепота» (гемералопия), сухость роговицы (ксерофтальмия), шелушение кожи, частые инфекции, ломкость ногтей, сухость волос, задержка роста у детей.',sources:'Облепиха, морковь, шпинат, петрушка, щавель, крапива, одуванчик, плоды шиповника',tags:['зрение','иммунитет','кожа','антиоксидант']},
{id:'vitC',cat:'vitamins',name:'Витамин C (Аскорбиновая к-та)',formula:'C₆H₈O₆',color:'#f1c40f',desc:'Водорастворимый витамин, сильнейший антиоксидант. Организм человека не может его синтезировать. Участвует в синтезе коллагена, нейромедиаторов, гормонов надпочечников.',role:'Необходим для образования коллагена (связки, сосуды, кожа), усиливает всасывание железа, стимулирует фагоцитоз, защищает клетки от окислительного стресса, снижает гистамин.',deficit:'Цинга (кровоточивость дёсен, выпадение зубов), медленное заживление ран, анемия, слабость, депрессия, частые простуды, ломкость сосудов, синяки.',sources:'Шиповник, чёрная смородина, облепиха, крапива, петрушка, укроп, хвоя, первоцвет, капуста',tags:['иммунитет','коллаген','сосуды','антиоксидант']},
{id:'vitE',cat:'vitamins',name:'Витамин E (Токоферол)',formula:'C₂₉H₅₀O₂',color:'#27ae60',desc:'Жирорастворимый антиоксидант. Главный защитник клеточных мембран от окисления. Называется «витамином фертильности».',role:'Защищает липиды мембран от свободных радикалов, улучшает микроциркуляцию, препятствует тромбообразованию, замедляет старение клеток, поддерживает работу половых желёз.',deficit:'Мышечная дистрофия, бесплодие, выкидыши, гемолиз эритроцитов, сухость кожи, раннее старение, слабость, нарушения координации.',sources:'Облепиха, расторопша, одуванчик, шиповник, крапива, семена льна, подсолнечник',tags:['антиоксидант','кожа','репродукция','сосуды']},
{id:'vitK',cat:'vitamins',name:'Витамин K (Филлохинон)',formula:'C₃₁H₄₆O₂',color:'#2ecc71',desc:'Жирорастворимый витамин, ключевой фактор свёртывания крови. Участвует в синтезе белков, необходимых для коагуляции и минерализации костей.',role:'Активирует протромбин и другие факторы свёртывания, регулирует отложение кальция в костях, предотвращает кальцификацию сосудов.',deficit:'Кровотечения (носовые, дёсенные, внутренние), длительная свёртываемость, остеопороз, кальцификация артерий, синяки без причины.',sources:'Крапива, шпинат, пастушья сумка, тысячелистник, люцерна, зелёный чай, капуста',tags:['свёртывание','кости','кровь']},
{id:'vitB1',cat:'vitamins',name:'Витамин B₁ (Тиамин)',formula:'C₁₂H₁₇N₄OS⁺',color:'#3498db',desc:'Водорастворимый витамин. Играет ключевую роль в метаболизме углеводов и работе нервной системы.',role:'Кофактор ферментов, расщепляющих углеводы до энергии. Необходим для проведения нервных импульсов, синтеза ацетилхолина, работы сердца.',deficit:'Болезнь бери-бери, полиневрит, ухудшение памяти, раздражительность, бессонница, тахикардия, запоры, слабость мышц.',sources:'Зерновые (овёс, гречиха), бобовые, семена подсолнечника, дрожжи, орехи',tags:['нервы','метаболизм','энергия']},
{id:'vitB2',cat:'vitamins',name:'Витамин B₂ (Рибофлавин)',formula:'C₁₇H₂₀N₄O₆',color:'#e74c3c',desc:'Водорастворимый витамин. Участвует в энергетическом обмене. Поддерживает здоровье кожи, слизистых и зрения.',role:'Ключевой компонент дыхательной цепи митохондрий, необходим для синтеза гемоглобина, защиты хрусталика глаза, восстановления тканей.',deficit:'Трещины в углах рта, воспаление языка, себорейный дерматит, светобоязнь, конъюнктивит, анемия, усталость.',sources:'Миндаль, дрожжи, листовая зелень, бобовые, злаки, грибы',tags:['энергия','кожа','зрение']},
{id:'vitB6',cat:'vitamins',name:'Витамин B₆ (Пиридоксин)',formula:'C₈H₁₁NO₃',color:'#9b59b6',desc:'Водорастворимый витамин. Кофактор более 100 ферментов. Критически важен для метаболизма аминокислот и синтеза нейромедиаторов.',role:'Участвует в синтезе серотонина, дофамина, ГАМК, мелатонина. Регулирует уровень гомоцистеина.',deficit:'Депрессия, спутанность сознания, судороги, анемия, дерматиты, трещины губ, ослабление иммунитета, повышение гомоцистеина.',sources:'Банан, авокадо, шпинат, морковь, грецкий орех, зерновые, бобовые',tags:['нервы','кровь','метаболизм']},
{id:'vitB12',cat:'vitamins',name:'Витамин B₁₂ (Кобаламин)',formula:'C₆₃H₈₈CoN₁₄O₁₄P',color:'#c0392b',desc:'Единственный витамин, содержащий металл (кобальт). Критически важен для кроветворения и миелиновой оболочки нервов.',role:'Участвует в синтезе ДНК, миелина, метионина. Регулирует уровень гомоцистеина. Необходим для созревания эритроцитов.',deficit:'Пернициозная анемия, необратимое повреждение нервов, покалывание в конечностях, ухудшение памяти, деменция, слабость.',sources:'В травах практически отсутствует (только в водорослях — спирулина, нори).',tags:['кровь','нервы','ДНК']},
{id:'fe',cat:'minerals',name:'Железо (Fe)',formula:'Fe',color:'#7f8c8d',desc:'Центральный атом гема в гемоглобине. Переносит кислород к тканям.',role:'Ключевая роль в дыхательной функции крови. Участвует в синтезе АТФ, ДНК, работе иммунной системы.',deficit:'Железодефицитная анемия, ломкость ногтей, выпадение волос, синдром беспокойных ног, частые инфекции.',sources:'Крапива, одуванчик, шпинат, петрушка, тысячелистник, пастушья сумка, люцерна',tags:['кровь','кислород','энергия']},
{id:'zn',cat:'minerals',name:'Цинк (Zn)',formula:'Zn',color:'#95a5a6',desc:'Кофактор более 300 ферментов. Необходим для иммунитета, заживления ран, синтеза ДНК.',role:'Регулирует работу более 2000 транскрипционных факторов. Поддерживает барьерную функцию кожи, синтез тестостерона.',deficit:'Частые простуды, медленное заживление ран, потеря вкуса/обоняния, выпадение волос, бесплодие у мужчин.',sources:'Тыквенные семечки, кунжут, имбирь, крапива, шпинат, петрушка, корень лопуха',tags:['иммунитет','кожа','ДНК']},
{id:'mg',cat:'minerals',name:'Магний (Mg)',formula:'Mg',color:'#1abc9c',desc:'Участвует в более чем 600 биохимических реакциях. Главный природный релаксант.',role:'Активирует АТФ, регулирует возбудимость нервной системы, нормализует сердечный ритм, снижает артериальное давление.',deficit:'Судороги икроножных мышц, бессонница, раздражительность, тахикардия, мигрень, запоры, тревожность.',sources:'Крапива, шпинат, петрушка, семена тыквы, подсолнечника, миндаль, овёс, морская капуста',tags:['мышцы','нервы','сердце','стресс']},
{id:'ca',cat:'minerals',name:'Кальций (Ca)',formula:'Ca',color:'#ecf0f1',desc:'Основной минерал костей и зубов. Регулирует мышечные сокращения, передачу нервных импульсов.',role:'Структурный компонент костей, вторичный посредник в клетках, необходим для сокращения мышц, секреции гормонов.',deficit:'Остеопороз, переломы, кариес, судороги, покалывание в пальцах, бессонница, аритмии.',sources:'Крапива, одуванчик, кунжут, мак, шпинат, миндаль, петрушка, люцерна',tags:['кости','мышцы','нервы']},
{id:'k',cat:'minerals',name:'Калий (K)',formula:'K',color:'#34495e',desc:'Главный внутриклеточный катион. Поддерживает водно-солевой баланс, работу сердца.',role:'Формирует мембранный потенциал клеток, регулирует ритм сердца, участвует в синтезе белка.',deficit:'Мышечная слабость, аритмии, отёки, запоры, усталость, судороги, повышение артериального давления.',sources:'Курага, изюм, банан, шпинат, петрушка, одуванчик, картофель, бобовые',tags:['сердце','баланс','нервы']},
{id:'se',cat:'minerals',name:'Селен (Se)',formula:'Se',color:'#e67e22',desc:'Мощный антиоксидант. Защищает щитовидную железу, предотвращает мутации клеток.',role:'Компонент йодтирониндейодиназы, защищает от тяжёлых металлов, поддерживает мужскую фертильность.',deficit:'Болезнь Кешана, гипотиреоз, бесплодие у мужчин, ослабление иммунитета, депрессия.',sources:'Бразильский орех, чеснок, лук, грибы, зерновые, крапива, ромашка',tags:['антиоксидант','щитовидная','защита']},
{id:'mn',cat:'minerals',name:'Марганец (Mn)',formula:'Mn',color:'#d35400',desc:'Активатор ферментов метаболизма аминокислот, холестерина и углеводов.',role:'Кофактор супероксиддисмутазы, участвует в синтезе хондроитина, регуляции глюкозы.',deficit:'Нарушение роста костей, бесплодие, судороги, головокружение, шум в ушах, диабет.',sources:'Овёс, имбирь, гвоздика, чёрный чай, шпинат, ананас, свёкла, листья малины',tags:['кости','метаболизм','ферменты']},
{id:'cu',cat:'minerals',name:'Медь (Cu)',formula:'Cu',color:'#e74c3c',desc:'Необходима для усвоения железа, образования эритроцитов, здоровья сосудов.',role:'Кофактор церулоплазмина, лизилоксидазы, цитохромоксидазы.',deficit:'Анемия, аневризмы, варикоз, ранняя седина, витилиго, остеопороз.',sources:'Какао, кунжут, кешью, грибы, крапива, хвощ, листья малины',tags:['кровь','сосуды','нервы']},
{id:'alk1',cat:'alkaloids',name:'Кофеин',formula:'C₈H₁₀N₄O₂',color:'#6c5ce7',desc:'Психостимулятор, антагонист аденозиновых рецепторов. Повышает бодрость, концентрацию.',role:'Блокирует аденозиновые рецепторы, усиливает выброс дофамина и норадреналина, повышает давление.',deficit:'Синдром отмены: головная боль, сонливость, раздражительность. Сам по себе не необходим.',sources:'Чай, кофе, гуарана, мате, какао, кола',tags:['стимулятор','ЦНС','сердце']},
{id:'alk2',cat:'alkaloids',name:'Берберин',formula:'C₂₀H₁₈NO₄⁺',color:'#fdcb6e',desc:'Изохинолиновый алкалоид, метформин-подобное вещество. Снижает сахар крови.',role:'Активирует AMPK, подавляет глюконеогенез, улучшает чувствительность к инсулину.',deficit:'Применяется при диабете 2 типа, метаболическом синдроме, дисбактериозе.',sources:'Барбарис, золотая нить, желтокорень, магония падуболистная',tags:['сахар','липиды','антимикробное']},
{id:'flv1',cat:'flavonoids',name:'Кверцетин',formula:'C₁₅H₁₀O₇',color:'#fab1a0',desc:'Самый распространённый флавоноид. Мощный антиоксидант и природный антигистамин.',role:'Стабилизирует мембраны тучных клеток, ингибирует циклооксигеназу, защищает сосуды.',deficit:'При дефиците чаще возникают аллергии, сосудистые проблемы, хроническое воспаление.',sources:'Лук, гречиха, каперсы, яблоки, ягоды, зверобой, гинкго, софора',tags:['антиоксидант','антигистамин','сосуды']},
{id:'flv2',cat:'flavonoids',name:'Рутин',formula:'C₂₇H₃₀O₁₆',color:'#ffeaa7',desc:'Гликозид кверцетина. Уменьшает проницаемость капилляров, усиливает витамин C.',role:'Укрепляет сосудистую стенку, уменьшает агрегацию тромбоцитов, улучшает микроциркуляцию.',deficit:'Повышенная ломкость капилляров, синяки, варикоз, геморрой.',sources:'Гречиха, софора японская, цитрусовые, шиповник, чёрная смородина',tags:['сосуды','витамин C','капилляры']},
{id:'flv3',cat:'flavonoids',name:'Апигенин',formula:'C₁₅H₁₀O₅',color:'#81ecec',desc:'Флавон ромашки и петрушки. Анксиолитическое, противовоспалительное, нейропротекторное действие.',role:'Модулирует ГАМК-А рецепторы, ингибирует ароматазу, обладает онкопротекторным эффектом.',deficit:'Применяется при тревожных расстройствах, бессоннице, ПМС.',sources:'Ромашка аптечная, петрушка, сельдерей, артишок, мята',tags:['тревога','воспаление','нервы']},
{id:'sap1',cat:'saponins',name:'Гинзенозиды',formula:'C₄₂H₇₂O₁₄',color:'#a29bfe',desc:'Тритерпеновые сапонины женьшеня. Адаптогены: повышают устойчивость к стрессу.',role:'Модулируют ось гипоталамус-гипофиз-надпочечники, усиливают синтез NO, защищают нейроны.',deficit:'Применяются при астении, хронической усталости, снижении работоспособности.',sources:'Женьшень, элеутерококк, аралия маньчжурская',tags:['адаптоген','тонус','мозг']},
{id:'tan1',cat:'tannins',name:'Танин',formula:'C₇₆H₅₂O₄₆',color:'#b2bec3',desc:'Гидролизуемый танин. Вяжущее, кровоостанавливающее, антисептическое действие.',role:'Связывается с белками, создаёт защитную плёнку на слизистых, останавливает капиллярные кровотечения.',deficit:'Применяется при диарее, стоматитах, ангине, ожогах, геморрое.',sources:'Дуб, гранат, черника, хурма, шалфей, кровохлёбка, лапчатка, чай',tags:['вяжущее','кровоостанавливающее','антисептик']},
{id:'eo1',cat:'essentialOils',name:'Ментол',formula:'C₁₀H₂₀O',color:'#00cec9',desc:'Монотерпен мяты. Местноанестезирующее, охлаждающее, спазмолитическое действие.',role:'Активирует холодовые рецепторы TRPM8, расширяет поверхностные сосуды, рефлекторно снимает боль.',deficit:'Применяется при головной боли, мышечных болях, зуде, заложенности носа.',sources:'Мята перечная, мята полевая, мята кудрявая',tags:['мята','охлаждение','боль']},
{id:'eo2',cat:'essentialOils',name:'Цинеол',formula:'C₁₀H₁₈O',color:'#74b9ff',desc:'Монотерпен эвкалипта. Отхаркивающее, антисептическое, противовоспалительное.',role:'Разжижает мокроту, усиливает мукоцилиарный клиренс, угнетает рост бактерий.',deficit:'Применяется при бронхитах, синуситах, ринитах, астме.',sources:'Эвкалипт, розмарин, чайное дерево, лавр, шалфей, полынь',tags:['эвкалипт','дыхание','антисептик']},
{id:'gly1',cat:'glycosides',name:'Салицин',formula:'C₁₃H₁₈O₇',color:'#dfe6e9',desc:'Предшественник аспирина из коры ивы. Обезболивающее, жаропонижающее, противовоспалительное.',role:'Ингибирует циклооксигеназу, снижая синтез простагландинов. Действует мягче аспирина.',deficit:'Применяется при головной, суставной боли, лихорадке, артритах.',sources:'Ива белая, тополь, таволга, малина (листья)',tags:['ива','боль','температура']},
{id:'cou1',cat:'coumarins',name:'Умбеллиферон',formula:'C₉H₆O₃',color:'#ffeaa7',desc:'Гидроксикумарин. УФ-фильтр, антиоксидант, спазмолитик.',role:'Поглощает УФ-А излучение, ингибирует моноаминоксидазу, расслабляет гладкую мускулатуру.',deficit:'Применяется в солнцезащитной косметике, при спазмах ЖКТ.',sources:'Дягиль, борщевик, морковь (семена), сельдерей, фенхель',tags:['УФ-защита','спазмолитик']},
{id:'pol1',cat:'polysaccharides',name:'Полисахариды',formula:'(C₆H₁₀O₅)ₙ',color:'#a29bfe',desc:'Инулин, пектины, слизи, крахмал. Пребиотики, обволакивающие, регуляторы сахара.',role:'Инулин — пребиотик, снижает сахар. Слизи — защищают слизистые. Пектины — выводят токсины.',deficit:'Дисбактериоз, запоры, колебания сахара, раздражение слизистых ЖКТ.',sources:'Инулин: топинамбур, цикорий, одуванчик. Слизи: алтей, лён. Пектины: яблоки, цитрусовые',tags:['пребиотик','пищеварение','сахар']},
{id:'ant1',cat:'anthocyanins',name:'Антоцианы',formula:'C₁₅H₁₁O⁺',color:'#6c5ce7',desc:'Водорастворимые пигменты синей, фиолетовой, красной окраски. Мощнейшие антиоксиданты.',role:'Защищают сосуды, улучшают ночное зрение, снижают воспаление, защищают нейроны.',deficit:'При дефиците выше риск ССЗ, ухудшение зрения, ускоренное старение.',sources:'Черника, ежевика, чёрная смородина, черноплодная рябина, бузина, виноград',tags:['антиоксидант','зрение','сосуды']}
];
var REF_DATA = [];
var refCat = 'all';
var refCatNames = {
vitamins:'Витамины', minerals:'Минералы', alkaloids:'Алкалоиды',
flavonoids:'Флавоноиды', saponins:'Сапонины', tannins:'Дубильные',
essentialOils:'Эфирные масла', glycosides:'Гликозиды', coumarins:'Кумарины',
organicAcids:'Орг. кислоты', polysaccharides:'Полисахариды', anthocyanins:'Антоцианы'
};
function loadRefData(){
var saved = localStorage.getItem('t-ref-data');
if(saved){
try{ REF_DATA = JSON.parse(saved); } catch(e){ REF_DATA = REF_DEFAULT.slice(); }
} else {
REF_DATA = REF_DEFAULT.slice();
}
}
function saveRefData(){
localStorage.setItem('t-ref-data', JSON.stringify(REF_DATA));
}
function initRef(){
loadRefData();
var tabs = document.getElementById('ref-tabs');
var cats = [
{k:'all',l:'Все'},{k:'vitamins',l:'Витамины'},{k:'minerals',l:'Минералы'},{k:'alkaloids',l:'Алкалоиды'},
{k:'flavonoids',l:'Флавоноиды'},{k:'saponins',l:'Сапонины'},{k:'tannins',l:'Дубильные'},{k:'essentialOils',l:'Эфирные масла'},
{k:'glycosides',l:'Гликозиды'},{k:'coumarins',l:'Кумарины'},{k:'organicAcids',l:'Орг. кислоты'},
{k:'polysaccharides',l:'Полисахариды'},{k:'anthocyanins',l:'Антоцианы'}
];
tabs.innerHTML = cats.map(function(c){
return '<div class="ref-tab'+(refCat===c.k?' on':'')+'" onclick="setRefCat(\''+c.k+'\')">'+c.l+'</div>';
}).join('');
renderRef();
}
function setRefCat(k){ refCat = k; initRef(); }
function renderRef(){
var search = (document.getElementById('ref-search').value||'').toLowerCase();
var items = REF_DATA.filter(function(r){
if(refCat !== 'all' && r.cat !== refCat) return false;
if(search && r.name.toLowerCase().indexOf(search)===-1 && r.desc.toLowerCase().indexOf(search)===-1 && r.tags.join(' ').toLowerCase().indexOf(search)===-1) return false;
return true;
});
var grid = document.getElementById('ref-grid');
if(!items.length){ grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--tx-m)">Вещества не найдены</div>'; return; }
grid.innerHTML = items.map(function(r){
var tagsHtml = (r.tags||[]).slice(0,4).map(function(t){ return '<span class="ref-tag">'+esc(t)+'</span>'; }).join('');
return '<div class="ref-card" onclick="openRefDetail(\''+esc(r.id)+'\')">'+
'<div class="ref-mol">'+esc((r.formula||'?').charAt(0))+'</div>'+
'<div class="ref-card-head">'+
'<div class="ref-icon" style="background:'+(r.color||'#888')+'">'+esc((r.formula||'?').charAt(0))+'</div>'+
'<div><div class="ref-title">'+esc(r.name)+'</div><div class="ref-formula">'+esc(r.formula||'')+'</div></div>'+
'</div>'+
'<div class="ref-desc">'+esc(r.desc)+'</div>'+
'<div class="ref-tags">'+tagsHtml+'</div>'+
'</div>';
}).join('');
}

/* ====== ОТКРЫТИЕ ДЕТАЛЕЙ ВЕЩЕСТВА В МОДАЛКЕ ====== */
var activeRefId = null;
function openRefDetail(id){
var r = REF_DATA.find(function(x){ return x.id === id; });
if(!r){ showToast('Вещество не найдено'); return; }
activeRefId = id;
var catName = refCatNames[r.cat] || r.cat;
var tagsHtml = (r.tags||[]).map(function(t){ return '<span class="ref-tag">'+esc(t)+'</span>'; }).join('');
var body = ''+
'<div class="ref-detail-hero">'+
  '<div class="ref-detail-icon" style="background:'+(r.color||'#888')+'">'+esc((r.formula||'?').charAt(0))+'</div>'+
  '<div class="ref-detail-head">'+
    '<div class="ref-detail-name">'+esc(r.name)+'</div>'+
    '<div class="ref-detail-formula">'+esc(r.formula||'—')+'</div>'+
    '<div class="ref-detail-cat">'+esc(catName)+'</div>'+
  '</div>'+
'</div>'+
'<div class="ref-section">'+
  '<div class="ref-section-title">📝 Описание</div>'+
  '<div class="ref-section-body">'+esc(r.desc||'Нет описания')+'</div>'+
'</div>'+
'<div class="ref-section">'+
  '<div class="ref-section-title">🔬 Роль в организме</div>'+
  '<div class="ref-section-body role">'+esc(r.role||'—')+'</div>'+
'</div>'+
'<div class="ref-section">'+
  '<div class="ref-section-title">⚠️ При дефиците</div>'+
  '<div class="ref-section-body deficit">'+esc(r.deficit||'—')+'</div>'+
'</div>'+
'<div class="ref-section">'+
  '<div class="ref-section-title">🌿 Источники в травах</div>'+
  '<div class="ref-section-body sources">'+esc(r.sources||'—')+'</div>'+
'</div>'+
(tagsHtml ? '<div class="ref-section"><div class="ref-section-title">🏷 Теги</div><div style="display:flex;flex-wrap:wrap;gap:5px">'+tagsHtml+'</div></div>' : '');
document.getElementById('ref-detail-title').textContent = r.name;
document.getElementById('ref-detail-body').innerHTML = body;
document.getElementById('ref-detail-m').classList.add('open');
}
function cRefDetail(){
document.getElementById('ref-detail-m').classList.remove('open');
activeRefId = null;
}

/* ====== РЕДАКТИРОВАНИЕ ВЕЩЕСТВА ====== */
function openRefEdit(){
if(!activeRefId){ showToast('Сначала откройте вещество'); return; }
var r = REF_DATA.find(function(x){ return x.id === activeRefId; });
if(!r) return;
document.getElementById('ref-edit-id').value = r.id;
document.getElementById('ref-edit-name').value = r.name || '';
document.getElementById('ref-edit-cat').value = r.cat || 'vitamins';
document.getElementById('ref-edit-formula').value = r.formula || '';
document.getElementById('ref-edit-color').value = r.color || '#3a7d44';
document.getElementById('ref-edit-desc').value = r.desc || '';
document.getElementById('ref-edit-role').value = r.role || '';
document.getElementById('ref-edit-deficit').value = r.deficit || '';
document.getElementById('ref-edit-sources').value = r.sources || '';
document.getElementById('ref-edit-tags').value = (r.tags||[]).join(', ');
document.getElementById('ref-edit-m').classList.add('open');
}
function cRefEdit(){
document.getElementById('ref-edit-m').classList.remove('open');
}
function saveRefEdit(){
var id = document.getElementById('ref-edit-id').value;
var idx = REF_DATA.findIndex(function(x){ return x.id === id; });
if(idx === -1){ showToast('Ошибка: вещество не найдено'); return; }
var newName = document.getElementById('ref-edit-name').value.trim();
if(!newName){ showToast('Название обязательно'); return; }
REF_DATA[idx] = {
  id: id,
  name: newName,
  cat: document.getElementById('ref-edit-cat').value,
  formula: document.getElementById('ref-edit-formula').value.trim(),
  color: document.getElementById('ref-edit-color').value,
  desc: document.getElementById('ref-edit-desc').value.trim(),
  role: document.getElementById('ref-edit-role').value.trim(),
  deficit: document.getElementById('ref-edit-deficit').value.trim(),
  sources: document.getElementById('ref-edit-sources').value.trim(),
  tags: document.getElementById('ref-edit-tags').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean)
};
saveRefData();
cRefEdit();
showToast('✓ Вещество обновлено');
// Обновим открытую карточку деталей и список
openRefDetail(id);
renderRef();
}

/* ============ РЫНОК ============ */
var dp = [
{id:1,n:'Успокоительный сбор',d:'Валериана, мелисса. 50г',p:450,b:'linear-gradient(135deg,#3a5a4a,#1e3a2a)',o:'s',ph:[]},
{id:2,n:'Настойка эхинацеи',d:'Спиртовая, 100мл',p:380,b:'linear-gradient(135deg,#8a5a3a,#5a3a1a)',o:'s',ph:[]},
{id:3,n:'Печёночный сбор',d:'Расторопша, артишок. 60г',p:520,b:'linear-gradient(135deg,#5a6a3a,#3a4a1a)',o:'s',ph:[]},
{id:4,n:'Мятный чай',d:'Мята, мелисса. 40г',p:290,b:'linear-gradient(135deg,#2a6a4a,#1a4a2a)',o:'s',ph:[]},
{id:5,n:'Прополис',d:'Натуральный. 50мл',p:650,b:'linear-gradient(135deg,#7a5a2a,#5a3a0a)',o:'s',ph:[]},
{id:6,n:'Желудочный сбор',d:'Ромашка, зверобой. 50г',p:410,b:'linear-gradient(135deg,#6a4a3a,#4a2a1a)',o:'s',ph:[]}
];
function gPr(){ var p = JSON.parse(localStorage.getItem('t-pr')||'null'); return p && p.length ? p : dp; }
function sPr(p){ localStorage.setItem('t-pr', JSON.stringify(p)); }
var ct = JSON.parse(localStorage.getItem('t-ct')||'[]');
function sCt(){ localStorage.setItem('t-ct', JSON.stringify(ct)); }
function ucb(){
var c = ct.reduce(function(s,i){ return s+i.q; },0);
['cbn','cbt'].forEach(function(id){
var e = document.getElementById(id);
if(c > 0){ e.style.display=''; e.textContent = c; } else e.style.display='none';
});
}
function mTab(t){
document.getElementById('mtp').classList.toggle('on', t==='p');
document.getElementById('mtm').classList.toggle('on', t==='m');
document.getElementById('mtc').classList.toggle('on', t==='c');
document.getElementById('mp').style.display = t==='p' ? '' : 'none';
document.getElementById('mm').style.display = t==='m' ? '' : 'none';
document.getElementById('mc').style.display = t==='c' ? '' : 'none';
if(t==='c') rMC(); if(t==='m') rMM();
}
function rMP(){
var ps = gPr();
document.getElementById('mp').innerHTML = '<div class="mkg">'+ps.map(function(p){
var ic = ct.find(function(c){ return c.id === p.id; });
return '<div class="mc2"><div class="mc2i" style="background:'+p.b+'"><svg><use href="#i-seedling"/></svg></div>'+
'<div class="mc2b"><div class="mc2n">'+esc(p.n)+'</div><div class="mc2d">'+esc(p.d)+'</div>'+
'<div class="mc2bt"><div class="mc2p">'+p.p+' <small>руб</small></div>'+
'<button class="bc'+(ic?' ic':'')+'" onclick="aCt('+p.id+')"><svg><use href="#i-cart"/></svg>'+(ic?'В корзине':'Купить')+'</button></div></div></div>';
}).join('')+'</div>';
}
function aCt(id){
var x = ct.find(function(c){ return c.id===id; });
if(x) x.q++; else ct.push({id:id,q:1});
sCt(); ucb(); rMP(); showToast('Добавлено в корзину');
}
function rMM(){
var ps = gPr().filter(function(p){ return p.o === 'm'; });
var h = ps.length ? '<div class="mkg">'+ps.map(function(p){
return '<div class="mc2"><div class="mc2i" style="background:'+p.b+'"><svg><use href="#i-seedling"/></svg></div>'+
'<div class="mc2b"><div class="mc2n">'+esc(p.n)+'</div><div class="mc2d">'+esc(p.d)+'</div>'+
'<div class="mc2bt"><div class="mc2p">'+p.p+' <small>руб</small></div>'+
'<button class="bc" onclick="dPr('+p.id+')" style="background:var(--dn-l);color:var(--dn)"><svg><use href="#i-trash"/></svg>Удалить</button></div></div></div>';
}).join('')+'</div>' : '<div class="cep">Нет товаров</div>';
document.getElementById('mm').innerHTML = h+'<div class="apf"><h3 style="font-size:14px;font-weight:700;margin-bottom:10px"><svg style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;color:var(--ac)"><use href="#i-plus"/></svg>Добавить товар</h3>'+
'<div class="fg"><label class="fl">Название</label><input class="fi" type="text" id="npn"></div>'+
'<div class="fg"><label class="fl">Описание</label><input class="fi" type="text" id="npd"></div>'+
'<div class="fr"><div class="fg"><label class="fl">Цена (руб)</label><input class="fi" type="number" id="npp" min="1"></div>'+
'<div class="fg"><label class="fl">Категория</label><select class="fi" id="npc"><option>Сборы</option><option>Настойки</option><option>Чаи</option><option>Мази</option></select></div></div>'+
'<div style="text-align:right;margin-top:6px"><button class="bt bt1" onclick="aPr()">Добавить товар</button></div></div>';
}
function aPr(){
var n = document.getElementById('npn').value.trim();
var d = document.getElementById('npd').value.trim();
var p = parseInt(document.getElementById('npp').value);
if(!n || !p){ showToast('Заполните название и цену'); return; }
var ps = gPr();
var bs = ['linear-gradient(135deg,#4a6a3a,#2a4a1a)','linear-gradient(135deg,#6a5a3a,#4a3a1a)'];
ps.push({id:Date.now(), n:n, d:d||'', p:p, b:bs[Math.floor(Math.random()*bs.length)], ph:[], o:'m'});
sPr(ps); rMP(); rMM(); showToast('Товар добавлен!');
}
function dPr(id){
var ps = gPr().filter(function(p){ return p.id !== id; }); sPr(ps);
ct = ct.filter(function(c){ return c.id !== id; }); sCt(); ucb(); rMP(); rMM(); rMC();
showToast('Удалено');
}
function rMC(){
var el = document.getElementById('mc');
if(!ct.length){ el.innerHTML = '<div class="cep">Корзина пуста</div>'; return; }
var ps = gPr(), tot = 0;
var h = ct.map(function(c){
var p = ps.find(function(x){ return x.id === c.id; });
if(!p) return '';
var s = p.p * c.q; tot += s;
return '<div class="ci2"><div class="ci2i"><div class="ci2n">'+esc(p.n)+' x'+c.q+'</div><div class="ci2p">'+s+' руб</div></div><button class="cirm" onclick="rfC('+p.id+')"><svg><use href="#i-x"/></svg></button></div>';
}).join('');
h += '<div class="ctot"><span>Итого:</span><span style="color:var(--ac)">'+tot+' руб</span></div>';
h += '<div style="background:var(--card);border-radius:12px;padding:16px;box-shadow:var(--sh);margin-top:16px"><div class="fr"><div class="fg"><label class="fl">Имя</label><input class="fi" type="text" id="on" value="'+esc(currentUserName())+'"></div><div class="fg"><label class="fl">Телефон</label><input class="fi" type="tel" id="op"></div></div><div class="fg"><label class="fl">Адрес</label><input class="fi" type="text" id="oa"></div><div style="text-align:right;margin-top:8px"><button class="bt bt1" onclick="ckO('+tot+')">Оплатить '+tot+' руб</button></div></div>';
el.innerHTML = h;
}
function rfC(id){ ct = ct.filter(function(c){ return c.id !== id; }); sCt(); ucb(); rMC(); rMP(); }
function ckO(tot){
var n = document.getElementById('on').value, p = document.getElementById('op').value, a = document.getElementById('oa').value;
if(!n || !p || !a){ showToast('Заполните все поля'); return; }
ct = []; sCt(); ucb();
document.getElementById('mc').innerHTML = '<div class="os"><svg style="width:44px;height:44px;color:var(--ac)"><use href="#i-check"/></svg><h3 style="margin:10px 0 6px;font-size:17px">Заказ оформлен!</h3><p style="color:var(--tx-s);font-size:14px">Сумма: '+tot+' руб</p><button class="bt bt1" style="margin-top:14px" onclick="mTab(\'p\')">Продолжить</button></div>';
showToast('Оплачено '+tot+' руб');
}
/* ============ КАЛЕНДАРЬ ============ */
function sCal(){ localStorage.setItem('t-cal', JSON.stringify(CAL)); }
var calY, calM, selDate = null, selColor = '#c0392b';
var mNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
var dNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
var calColors = [{c:'#c0392b',l:'Срочное'},{c:'#f39c12',l:'Важное'},{c:'#2980b9',l:'Работа'},{c:'#8e44ad',l:'Личное'},{c:'#1abc9c',l:'Здоровье'},{c:'#3a7d44',l:'Сбор трав'}];
var priorityOrder = ['#c0392b','#f39c12','#2980b9','#8e44ad','#1abc9c','#3a7d44'];
function initCal(){ var n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); renderCalColors(); updateCalBadge(); }
function calPrev(){ calM--; if(calM<0){ calM=11; calY--; } rCal(); }
function calNext(){ calM++; if(calM>11){ calM=0; calY++; } rCal(); }
function calToday(){ var n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); rCal(); }
function rCal(){
document.getElementById('cal-title').textContent = mNames[calM] + ' ' + calY;
var grid = document.getElementById('cal-grid'); grid.innerHTML = '';
dNames.forEach(function(d){ var h = document.createElement('div'); h.className = 'cal-head'; h.textContent = d; grid.appendChild(h); });
var fd = new Date(calY, calM, 1).getDay(); fd = fd === 0 ? 6 : fd - 1;
var daysInMonth = new Date(calY, calM + 1, 0).getDate();
var prevDays = new Date(calY, calM, 0).getDate();
var today = new Date();
var todayDs = today.getFullYear()+'-'+p2(today.getMonth()+1)+'-'+p2(today.getDate());
for(var i = fd - 1; i >= 0; i--){
var dd = document.createElement('div'); dd.className = 'cal-day other';
dd.innerHTML = '<div class="cal-day-num">'+(prevDays-i)+'</div>';
grid.appendChild(dd);
}
for(var d = 1; d <= daysInMonth; d++){
var dd = document.createElement('div'); dd.className = 'cal-day';
var ds = calY+'-'+p2(calM+1)+'-'+p2(d);
if(ds === todayDs) dd.classList.add('today');
var tasks = CAL[ds] || [];
var numStyle = '';
if(tasks.length > 0){ var hp = priorityOrder.find(function(pr){ return tasks.some(function(t){ return t.color === pr; }); }); if(hp) numStyle = 'color:'+hp; }
var prevHtml = '';
if(tasks.length > 0){ prevHtml += '<div class="cal-task-prev" style="background:'+tasks[0].color+'"></div>'; if(tasks.length > 1) prevHtml += '<div class="cal-task-prev" style="background:'+tasks[1].color+'"></div>'; if(tasks.length > 2) prevHtml += '<div class="cal-badge">'+tasks.length+'</div>'; }
dd.innerHTML = '<div class="cal-day-num" style="'+numStyle+'">'+d+'</div>'+prevHtml;
dd.onclick = (function(dateStr){ return function(){ oCalDay(dateStr); }; })(ds);
grid.appendChild(dd);
}
var totalCells = fd + daysInMonth;
var rem = totalCells % 7 === 0 ? 0 : 7 - totalCells % 7;
for(var i = 1; i <= rem; i++){
var dd = document.createElement('div'); dd.className = 'cal-day other';
dd.innerHTML = '<div class="cal-day-num">'+i+'</div>';
grid.appendChild(dd);
}
}
function renderCalColors(){
var c = document.getElementById('cal-colors'); c.innerHTML = '';
calColors.forEach(function(cl){
var d = document.createElement('div');
d.className = 'cal-color-opt' + (cl.c === selColor ? ' on' : '');
d.style.background = cl.c; d.title = cl.l; d.textContent = cl.l[0];
d.onclick = function(){ selColor = cl.c; renderCalColors(); };
c.appendChild(d);
});
}
function updateCalBadge(){
var today = new Date();
var ds = today.getFullYear()+'-'+p2(today.getMonth()+1)+'-'+p2(today.getDate());
var tasks = CAL[ds] || [];
var b = document.getElementById('cal-bdg');
if(tasks.length > 0){ b.style.display = ''; b.textContent = tasks.length; } else b.style.display = 'none';
}
function oCalDay(ds){
selDate = ds; var p = ds.split('-');
document.getElementById('calm-title').textContent = parseInt(p[2]) + ' ' + mNames[parseInt(p[1])-1] + ' ' + p[0];
renderCalTasks();
document.getElementById('cal-task-text').value = '';
document.getElementById('cal-task-time').value = '';
document.getElementById('calm').classList.add('open');
}
function cCalM(){ document.getElementById('calm').classList.remove('open'); selDate = null; }
function renderCalTasks(){
var list = document.getElementById('calm-tasks');
var tasks = CAL[selDate] || [];
if(!tasks.length){ list.innerHTML = '<div style="text-align:center;color:var(--tx-m);font-size:13px;padding:10px 0">Нет дел на этот день</div>'; return; }
list.innerHTML = tasks.map(function(t){
var pLbl = (calColors.find(function(c){ return c.c === t.color; }) || {}).l || '';
return '<div class="cal-task-item" style="border-left-color:'+t.color+';background:'+t.color+'15"><div class="cal-task-info"><div class="cal-task-time">'+(t.time||'Без времени')+' <span class="cal-task-priority" style="color:'+t.color+'">'+pLbl+'</span></div><div class="cal-task-text">'+esc(t.text)+'</div></div><button class="cirm" onclick="dCalTask(\''+t.id+'\')"><svg><use href="#i-x"/></svg></button></div>';
}).join('');
}
function aCalTask(){
var txt = document.getElementById('cal-task-text').value.trim();
if(!txt){ showToast('Введите описание'); return; }
if(!selDate) return;
if(!CAL[selDate]) CAL[selDate] = [];
CAL[selDate].push({id:Date.now().toString(), text:txt, color:selColor, time:document.getElementById('cal-task-time').value||'', notified:false});
sCal(); renderCalTasks(); rCal(); updateCalBadge();
document.getElementById('cal-task-text').value = '';
document.getElementById('cal-task-time').value = '';
showToast('Дело добавлено!');
}
function dCalTask(id){
if(!selDate || !CAL[selDate]) return;
CAL[selDate] = CAL[selDate].filter(function(t){ return t.id !== id; });
if(!CAL[selDate].length) delete CAL[selDate];
sCal(); renderCalTasks(); rCal(); updateCalBadge();
showToast('Дело удалено');
}
function checkReminders(){
var now = new Date();
var ds = now.getFullYear()+'-'+p2(now.getMonth()+1)+'-'+p2(now.getDate());
var ts = p2(now.getHours())+':'+p2(now.getMinutes());
var tasks = CAL[ds] || [];
tasks.forEach(function(t){
if(t.time === ts && !t.notified){
t.notified = true; sCal();
addNoti('reminder', 'Напоминание: ' + t.text, 'Время: ' + t.time);
showToast('🔔 Напоминание: ' + t.text);
}
});
}
setInterval(checkReminders, 15000);
/* ============ УВЕДОМЛЕНИЯ ============ */
function sNoti(){ localStorage.setItem('t-noti', JSON.stringify(NOTI)); }
var notiIcons = {
reminder:{class:'reminder',icon:'🔔'}, like:{class:'like',icon:'❤'},
comment:{class:'comment',icon:'💬'}, friend:{class:'friend',icon:'👤'},
system:{class:'system',icon:'⚙'}, market:{class:'market',icon:'🛒'}
};
function addNoti(type, title, desc){
var n = {id:Date.now()+'-'+Math.random().toString(36).substr(2,5), type:type, title:title, desc:desc||'', time:Date.now(), read:false};
NOTI.unshift(n);
if(NOTI.length > 50) NOTI = NOTI.slice(0, 50);
sNoti(); updNotiBadge();
if(document.getElementById('noti-m').classList.contains('open')) renderNotiList();
}
function delNoti(id){ NOTI = NOTI.filter(function(n){ return n.id !== id; }); sNoti(); updNotiBadge(); renderNotiList(); }
function markNotiRead(id){
var n = NOTI.find(function(x){ return x.id === id; });
if(n){ n.read = true; sNoti(); updNotiBadge(); renderNotiList(); }
}
function markAllRead(){ NOTI.forEach(function(n){ n.read = true; }); sNoti(); updNotiBadge(); renderNotiList(); showToast('Все отмечены как прочитанные'); }
function clearAllNoti(){ if(!NOTI.length) return; NOTI = []; sNoti(); updNotiBadge(); renderNotiList(); showToast('Уведомления очищены'); }
function updNotiBadge(){
var unread = NOTI.filter(function(n){ return !n.read; }).length;
var bdg = document.getElementById('noti-bdg');
if(unread > 0){ bdg.style.display=''; bdg.textContent = unread > 99 ? '99+' : unread; } else bdg.style.display='none';
}
function fmtTime(ts){
var d = new Date(ts); var now = new Date();
var diff = Math.floor((now - d) / 1000);
if(diff < 60) return 'только что';
if(diff < 3600) return Math.floor(diff/60) + ' мин. назад';
if(diff < 86400) return Math.floor(diff/3600) + ' ч. назад';
return p2(d.getDate()) + '.' + p2(d.getMonth()+1) + '.' + d.getFullYear();
}
function oNotiM(){
document.getElementById('noti-m').classList.add('open');
renderNotiList();
setTimeout(function(){
NOTI.forEach(function(n){ n.read = true; });
sNoti(); updNotiBadge();
document.querySelectorAll('.noti-item.unread').forEach(function(el){
el.classList.remove('unread'); el.classList.add('read');
var mark = el.querySelector('.noti-mark'); if(mark) mark.style.display = 'none';
});
}, 800);
}
function cNotiM(){ document.getElementById('noti-m').classList.remove('open'); }
function renderNotiList(){
var list = document.getElementById('noti-list');
var label = document.getElementById('noti-count-label');
var unread = NOTI.filter(function(n){ return !n.read; }).length;
var total = NOTI.length;
if(!total){
label.textContent = '';
list.innerHTML = '<div class="noti-empty"><svg><use href="#i-bell"/></svg><p>Нет уведомлений</p><span>Уведомления и напоминания появятся здесь</span></div>';
return;
}
label.textContent = unread > 0 ? '('+unread+' непрочит.)' : '('+total+')';
var html = '';
NOTI.forEach(function(n){
var icon = notiIcons[n.type] || notiIcons.system;
var unreadClass = n.read ? 'read' : 'unread';
html += '<div class="noti-item '+unreadClass+'" onclick="markNotiRead(\''+n.id+'\')">';
html += '<div class="noti-icon '+icon.class+'">'+icon.icon+'</div>';
html += '<div class="noti-body"><div class="noti-title">'+esc(n.title)+'</div>';
if(n.desc) html += '<div class="noti-desc">'+esc(n.desc)+'</div>';
html += '<div class="noti-time">'+fmtTime(n.time)+'</div></div>';
html += '<div class="noti-actions">';
if(!n.read) html += '<div class="noti-mark"></div>';
html += '<button class="noti-del" onclick="event.stopPropagation();delNoti(\''+n.id+'\')" title="Удалить"><svg><use href="#i-x"/></svg></button>';
html += '</div></div>';
});
list.innerHTML = html;
}
function generateDemoNoti(){
if(localStorage.getItem('t-noti-init')) return;
var now = Date.now();
NOTI = [
{id:'demo-1',type:'system',title:'Добро пожаловать в Травникъ!',desc:'Социальная сеть для любителей травничества',time:now-3600000*2,read:false},
{id:'demo-2',type:'friend',title:'Марина хочет добавить вас в друзья',desc:'Отправлено 3 часа назад',time:now-3600000*3,read:false},
{id:'demo-3',type:'reminder',title:'Трава дня: Ромашка аптечная',desc:'Не забудьте заглянуть в справочник',time:now-3600000*24,read:true}
];
sNoti(); localStorage.setItem('t-noti-init','true');
}
generateDemoNoti(); updNotiBadge();
/* ============ РАДИО ============ */
var au = document.getElementById('ra'), pg = false;
au.volume = 0.4;
function tP(){
if(pg){
au.pause(); pg = false;
document.getElementById('pt').innerHTML = '<svg><use href="#i-play"/></svg>';
document.getElementById('eqb').classList.remove('on');
} else {
if(!au.src) au.src = 'https://ice1.somafm.com/groovesalad-128-mp3';
au.play().then(function(){
pg = true;
document.getElementById('pt').innerHTML = '<svg><use href="#i-pause"/></svg>';
document.getElementById('eqb').classList.add('on');
}).catch(function(){ showToast('Не удалось подключиться к радио'); });
}
}
au.addEventListener('error', function(){ document.getElementById('mps').textContent = 'Ошибка'; pg = false; document.getElementById('eqb').classList.remove('on'); });
/* ============ ТЕМЫ ============ */
function sT(t){
document.documentElement.setAttribute('data-theme', t);
localStorage.setItem('t-theme', t);
document.querySelectorAll('.td').forEach(function(d){ d.classList.remove('on'); });
var map = {light:'.td-l','dark-forest':'.td-f','dark-stone':'.td-s','dark-night':'.td-n'};
var el = document.querySelector(map[t]); if(el) el.classList.add('on');
}
(function(){
var saved = localStorage.getItem('t-theme');
if(saved) sT(saved);
})();
/* ============ ИНИЦИАЛИЗАЦИЯ ============ */
function initSidebarFriends(){
var fg = document.getElementById('fg');
if(fg && !fg.children.length){
['Марина','Дмитрий','Ольга','Иван','Наталья','Борис','Алёна','Вера'].forEach(function(n){
var d = document.createElement('div'); d.className = 'faw';
d.innerHTML = '<div class="avatar-wrap" style="width:48px;height:48px;font-size:14px;margin:0 auto;cursor:pointer"><span class="at">'+n[0]+'</span></div><div class="fod"></div><div class="fn">'+n+'</div>';
fg.appendChild(d);
});
}
var gl = document.getElementById('gl');
if(gl && !gl.children.length){
[{n:'Травники Руси',m:'24.5K'},{n:'Фитотерапия',m:'18.3K'},{n:'Настойки и мази',m:'12.1K'},{n:'Сад лекарственных трав',m:'9.7K'}].forEach(function(g){
var d = document.createElement('div'); d.className = 'gi';
d.onclick = function(){ showToast('Открыто: ' + g.n); };
d.innerHTML = '<div class="avatar-wrap" style="width:36px;height:36px;font-size:13px;border-radius:8px;cursor:pointer"><span class="at">'+g.n[0]+'</span></div><div class="gii"><div class="gin">'+g.n+'</div><div class="gim">'+g.m+' участников</div></div>';
gl.appendChild(d);
});
}
}
function bootApp(){
initSidebarFriends();
uUI(); ucb();
initCal();
loadPosts();
loadRefData();
}
bootApp();