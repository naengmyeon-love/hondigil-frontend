(function(){
  'use strict';

  var STORAGE_KEY='hondigil_mvp_v3';
  var PROFILE_KEY='hondigil_device_profile_v1';
  prepareCourseRoutes();
  var defaults={xp:0,totalDistance:0,completions:[],background:'제주 바다',textSize:'normal',reduceMotion:false,filters:{type:'전체',distance:'전체',difficulty:'전체',env:'전체',parking:false,toilet:false},restaurantFilter:'전체'};
  var state=loadState();
  var deviceProfile=loadDeviceProfile();
  var ui={map:null,mapCourse:null,mapBounds:null,activity:null,timer:null,watchId:null,leafletLoading:false,toastTimer:null,sidebarOpen:false};

  function clone(obj){return JSON.parse(JSON.stringify(obj));}
  function loadState(){
    try{var raw=localStorage.getItem(STORAGE_KEY);var saved=raw?JSON.parse(raw):{};return mergeState(saved);}catch(e){return clone(defaults);}
  }
  function mergeState(saved){
    var next=clone(defaults),k;
    if(!saved||typeof saved!=='object')return next;
    for(k in next){if(Object.prototype.hasOwnProperty.call(saved,k)&&k!=='filters')next[k]=saved[k];}
    if(saved.filters&&typeof saved.filters==='object'){for(k in next.filters){if(Object.prototype.hasOwnProperty.call(saved.filters,k))next.filters[k]=saved.filters[k];}}
    if(!Array.isArray(next.completions))next.completions=[];
    return next;
  }
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){toast('이 브라우저에서는 저장이 제한되어 있어요.');}}
  function normalizeNickname(value){var text=String(value==null?'':value);if(text.normalize)text=text.normalize('NFKC');return text.replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();}
  function validateNickname(value){var nickname=normalizeNickname(value),length=Array.from(nickname).length;if(length<2||length>12)return {nickname:nickname,error:'별명은 2자 이상 12자 이하로 입력해 주세요.'};return {nickname:nickname,error:''};}
  function createDeviceId(){if(window.crypto&&typeof window.crypto.randomUUID==='function')return 'device_'+window.crypto.randomUUID();return 'device_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);}
  function loadDeviceProfile(){
    try{
      var raw=localStorage.getItem(PROFILE_KEY),saved=raw?JSON.parse(raw):null,validated=saved?validateNickname(saved.nickname):null,deviceId=saved&&String(saved.deviceId||'');
      if(!saved||!validated||validated.error||!/^[A-Za-z0-9_-]{8,80}$/.test(deviceId))return null;
      return {deviceId:deviceId,nickname:validated.nickname,createdAt:String(saved.createdAt||'')};
    }catch(e){return null;}
  }
  function saveDeviceProfile(nickname){
    try{var profile={deviceId:createDeviceId(),nickname:nickname,createdAt:new Date().toISOString()};localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));deviceProfile=profile;return true;}catch(e){return false;}
  }
  function deviceCode(){return deviceProfile?deviceProfile.deviceId.replace(/[^A-Za-z0-9]/g,'').slice(-6).toUpperCase():'';}
  function setSession(key,value){try{sessionStorage.setItem(key,value);}catch(e){}}
  function getSession(key,fallback){try{return sessionStorage.getItem(key)||fallback;}catch(e){return fallback;}}
  function esc(value){return String(value==null?'':value).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function fmtKm(n){return (Math.round(Number(n||0)*10)/10).toFixed(1)+'km';}
  function fmtTime(sec){sec=Math.max(0,Math.floor(sec||0));var m=Math.floor(sec/60),s=sec%60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;}
  function courseById(id){return courses.filter(function(c){return c.id===id;})[0]||null;}
  function restaurantById(id){return restaurants.filter(function(r){return r.id===id;})[0]||null;}
  function activePage(){var hash=location.hash||'#/home';var part=hash.replace(/^#\//,'').split('/')[0];return navItems.some(function(n){return n.id===part;})?part:(part==='course'||part==='activity'||part==='complete'?'courses':'home');}
  function navigate(path){location.hash='#/'+path;}
  function topbar(title,sub){return '<div class="topbar"><a class="brand" href="#/home" data-nav="home"><span class="brand-mark" aria-hidden="true">ㅎ</span><span>혼디길</span></a><div class="top-actions"><button class="icon-btn" data-nav="settings" aria-label="설정 열기">⚙️</button></div></div>'+(title?'<div class="section-head"><div><p class="eyebrow">'+esc(sub||'혼디길')+'</p><h1>'+esc(title)+'</h1></div></div>':'');}
  function sampleNotice(){return '<div class="notice"><span aria-hidden="true">ⓘ</span><span>코스 선과 거리는 OpenStreetMap 보행로를, 식당 마커는 OpenStreetMap에 등록된 실제 위치를 기준으로 표시합니다. 영업시간·메뉴와 현장 상황은 방문 전 확인해 주세요.</span></div>';}
  function renderNav(){
    var current=activePage();
    var html=navItems.map(function(n){return '<button class="nav-btn" data-nav="'+n.id+'" '+(current===n.id?'aria-current="page"':'')+'><span class="nav-icon" aria-hidden="true">'+n.icon+'</span><span>'+n.label+'</span></button>';}).join('');
    document.getElementById('bottomNav').innerHTML=html;document.getElementById('desktopNav').innerHTML=html;
  }
  function setSidebar(open){
    ui.sidebarOpen=!!open;
    document.body.classList.toggle('sidebar-open',ui.sidebarOpen);
    var toggle=document.getElementById('sidebarToggle'),icon=document.getElementById('sidebarToggleIcon'),rail=document.getElementById('desktopRail');
    if(toggle){toggle.setAttribute('aria-expanded',String(ui.sidebarOpen));toggle.setAttribute('aria-label',ui.sidebarOpen?'사이드바 닫기':'사이드바 열기');}
    if(icon)icon.textContent=ui.sidebarOpen?'✕':'☰';
    if(rail)rail.setAttribute('aria-hidden',String(!ui.sidebarOpen));
  }
  function applyPrefs(){
    document.documentElement.style.setProperty('--text-scale',state.textSize==='large'?'1.1':'1');
    document.body.classList.toggle('reduce-motion',!!state.reduceMotion);
  }
  function level(){return Math.floor(state.xp/100)+1;}
  function dolStage(){var lv=level(),n=state.completions.length,nextExp=100-(state.xp%100||0),next='다음 장식까지 '+nextExp+' EXP';if(lv>=5)return {name:'왕관 쓴 제주 돌하르방',stage:'legend',base:'🗿',decoration:'👑',next:'최고 단계 달성'};if(lv>=4)return {name:'선글라스 돌하르방',stage:'shades',base:'🗿',decoration:'😎',next:next};if(lv>=3)return {name:'메달 돌하르방',stage:'runner',base:'🗿',decoration:'🏅',next:next};if(lv>=2)return {name:'헤어밴드 돌하르방',stage:'headband',base:'🗿',decoration:'',next:next};if(n>=1)return {name:'작은 돌하르방',stage:'small',base:'🗿',decoration:'',next:next};return {name:'아직 잠든 돌',stage:'stone',base:'🪨',decoration:'',next:'첫 완주가 필요해요'};}
  function dolFigure(dol){return '<span class="dol-figure dol-stage-'+esc(dol.stage)+'" role="img" aria-label="'+esc(dol.name)+'"><img class="dol-base" src="./static/assets/dol-hareubang.svg" alt="" aria-hidden="true"><span class="dol-band" aria-hidden="true"></span><span class="dol-badge" aria-hidden="true">'+esc(dol.decoration||'')+'</span></span>';}
  function treeStage(){var d=state.totalDistance;if(d>=100)return {name:'귤이 열린 나무',stage:'fruit',emoji:'🍊🌳',next:'최고 단계 달성'};if(d>=50)return {name:'귤꽃 나무',stage:'flower',emoji:'🌼🌳',next:'다음 성장까지 '+fmtKm(100-d)};if(d>=30)return {name:'어린 나무',stage:'tree',emoji:'🌳',next:'다음 성장까지 '+fmtKm(50-d)};if(d>=10)return {name:'새싹',stage:'sprout',emoji:'🌱',next:'다음 성장까지 '+fmtKm(30-d)};return {name:'씨앗',stage:'seed',emoji:'',next:'다음 성장까지 '+fmtKm(10-d)};}
  function treeFigure(tree){return '<span class="tree-figure tree-stage-'+esc(tree.stage)+'" role="img" aria-label="'+esc(tree.name)+'">'+(tree.stage==='seed'?'<img class="tree-art" src="./static/assets/seed.svg" alt="" aria-hidden="true">':esc(tree.emoji))+'</span>';}
  function onboardingView(){return '<section class="onboarding"><div class="onboarding-card"><div class="onboarding-brand"><span class="brand-mark" aria-hidden="true">ㅎ</span><strong>혼디길</strong></div><div class="onboarding-art" aria-hidden="true"><img src="./static/assets/seed.svg" alt=""></div><p class="eyebrow">계정 없이 가볍게</p><h1>이 기기에서 쓸<br>별명을 정해 주세요</h1><p class="onboarding-copy">아이디와 비밀번호는 필요 없어요. 별명 하나만 만들면 다음부터 바로 혼디길로 들어옵니다.</p><form class="nickname-form" data-form="nickname" novalidate><label for="nicknameInput">나의 별명</label><input class="nickname-input" id="nicknameInput" name="nickname" type="text" minlength="2" maxlength="12" autocomplete="nickname" autocapitalize="off" enterkeyhint="done" placeholder="2~12자" aria-describedby="nicknameHelp nicknameError" required><p class="nickname-error" id="nicknameError" role="alert" aria-live="polite"></p><button class="btn btn-primary btn-block" type="submit">이 별명으로 시작하기</button></form><p class="onboarding-note" id="nicknameHelp"><span aria-hidden="true">🔒</span><span>별명은 이 브라우저에 하나만 저장되며 앱 안에서는 바꿀 수 없어요. 브라우저 데이터를 지우면 다시 만들어야 합니다.</span></p></div></section>';}
  function deviceSettingsView(){return topbar('설정','내게 편한 혼디길')+'<div class="settings-layout"><section class="card settings-group device-profile-card"><p class="eyebrow">이 기기의 별명</p><h2>'+esc(deviceProfile.nickname)+'</h2><p class="small muted">계정과 비밀번호 없이 이 브라우저에서 바로 입장해요. 별명은 앱 안에서 변경할 수 없고 다른 기기에서는 같은 별명을 사용할 수 있습니다.</p><span class="device-code">브라우저 코드 · '+esc(deviceCode())+'</span></section><section class="card settings-group"><p class="eyebrow">화면</p><h2>보기 편하게</h2><div class="setting-row"><div class="setting-copy"><strong>큰 글씨</strong><span>전체 글자를 약 10% 키워요.</span></div><label class="switch"><input type="checkbox" data-setting="largeText" '+(state.textSize==='large'?'checked':'')+'><span></span></label></div><div class="setting-row"><div class="setting-copy"><strong>움직임 줄이기</strong><span>축하 효과와 전환을 최소화해요.</span></div><label class="switch"><input type="checkbox" data-setting="reduceMotion" '+(state.reduceMotion?'checked':'')+'><span></span></label></div><div class="setting-row"><div class="setting-copy"><strong>제주방 배경</strong><span>선택은 이 브라우저에 저장돼요.</span></div><select class="select" data-setting="background">'+['제주 바다','귤밭','오름','돌담길'].map(function(x){return '<option '+(state.background===x?'selected':'')+'>'+x+'</option>';}).join('')+'</select></div></section><section class="card settings-group"><p class="eyebrow">위치·개인정보</p><h2>GPS는 이렇게 사용해요</h2><p class="small muted">이 MVP는 계정이나 서버가 없으며 GPS 기록을 서버에 올리지 않습니다. 활동 중에는 거리 계산에만 사용하고, 완주 후에는 코스명·거리·시간 같은 단순 기록만 이 브라우저에 저장합니다.</p><div class="notice" style="margin-bottom:0"><span>🔒</span><span>파일을 직접 열면 브라우저 보안 정책 때문에 실제 GPS가 제한될 수 있어요. 데모 모드는 항상 사용할 수 있습니다.</span></div></section><section class="card settings-group"><p class="eyebrow">데이터 관리</p><h2>기록과 설정</h2><p class="small muted">완주 기록과 화면 설정만 초기화합니다. 이 기기의 별명은 그대로 유지돼요.</p><button class="btn btn-danger btn-block" data-action="reset">기록과 설정 초기화</button></section></div><section class="section card card-pad"><h3>안전 안내</h3><ul class="small muted"><li>운전 중에는 혼디길을 사용하지 마세요.</li><li>출발 전 날씨, 탐방로 개방, 지역 통제 여부를 확인하세요.</li><li>실제 서비스 출시 전에는 별도의 개인정보처리방침이 필요합니다.</li></ul></section>'+sampleNotice();}
  function resetRecordsData(){openModal('<div class="modal-head"><div><p class="eyebrow">되돌릴 수 없어요</p><h2>기록과 설정을 지울까요?</h2></div><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div><p class="muted">완주 기록, 성장 단계와 제주방 배경 설정이 초기화됩니다. 별명 ‘'+esc(deviceProfile.nickname)+'’도 그대로 유지돼요.</p><div class="btn-row"><button class="btn btn-secondary" data-action="close-modal">취소</button><button class="btn btn-danger" data-action="confirm-records-reset">기록만 지우기</button></div>');}
  function homeView(){
    var recent=state.completions[0],dol=dolStage(),tree=treeStage(),recommended=courses[0];
    return topbar()+'<section class="hero"><div class="hero-copy"><p class="eyebrow">제주에서 혼디, 같이 걷는 길</p><h1>걷고 달릴수록<br>나의 제주가 자라요</h1><p>제주 코스를 완주하고 돌하르방과 제주방을 키운 뒤, 가까운 로컬 식당을 발견해 보세요.</p><div class="btn-row"><button class="btn btn-primary" data-course-type="러닝">👟 러닝 코스 보기</button><button class="btn btn-secondary" data-course-type="트래킹">🥾 트래킹 코스 보기</button></div></div><div class="hero-art" aria-label="제주 오름길 일러스트"><span class="hero-road"></span></div></section>'+
    '<section class="card profile-card"><div class="avatar-orb" aria-hidden="true">'+dolFigure(dol)+'</div><div><div class="course-actions" style="margin-top:0"><strong>Lv.'+level()+' 나의 돌하르방</strong><span class="pill orange">EXP '+state.xp+'</span></div><p class="small muted">다음 레벨까지 '+(100-(state.xp%100||0))+' EXP</p><div class="level-bar" aria-label="레벨 진행률"><div class="level-fill" style="width:'+(state.xp%100)+'%"></div></div></div></section>'+
    '<section class="section"><div class="grid stats"><div class="card stat"><div class="stat-icon">✓</div><div class="stat-value">'+state.completions.length+'</div><div class="stat-label">완주 코스</div></div><div class="card stat"><div class="stat-icon">↗</div><div class="stat-value">'+fmtKm(state.totalDistance)+'</div><div class="stat-label">누적 거리</div></div><div class="card stat"><div class="stat-icon">'+dolFigure(dol)+'</div><div class="stat-value small">'+dol.name+'</div><div class="stat-label">'+dol.next+'</div></div><div class="card stat"><div class="stat-icon">'+treeFigure(tree)+'</div><div class="stat-value small">'+tree.name+'</div><div class="stat-label">'+tree.next+'</div></div></div></section>'+
    '<section class="section"><div class="section-head"><div><p class="eyebrow">오늘의 추천</p><h2>부담 없이 시작해요</h2></div><button class="text-btn" data-nav="courses">전체 보기</button></div><div class="grid course-grid">'+courseCard(recommended)+'</div></section>'+
    '<section class="section grid home-feature-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))"><div class="card card-pad"><p class="eyebrow">🌱 완주 보상</p><h3>기록이 눈에 보이게 자라요</h3><p class="muted small">완주 횟수로 돌하르방이, 누적 거리로 귤나무가 성장해요.</p><button class="text-btn" data-nav="room">나의 제주방 보기 →</button></div><div class="card card-pad"><p class="eyebrow">🍚 로컬 발견</p><h3>코스 주변의 실제 한 끼</h3><p class="muted small">OpenStreetMap에 등록된 식당 3곳을 실제 좌표에 표시해요.</p><button class="text-btn" data-course="'+recommended.id+'">코스에서 미리 보기 →</button></div></section>'+
    '<section class="section"><div class="section-head"><div><p class="eyebrow">최근 기록</p><h2>'+(recent?'다시 만난 제주':'첫 기록을 만들어 보세요')+'</h2></div></div>'+(recent?historyCard(recent):'<div class="card empty"><div class="empty-icon">👟</div><h3>아직 완주 기록이 없어요</h3><p class="muted small">데모 코스로 먼저 경험해도 좋아요.</p><button class="btn btn-soft" data-course="hamdeok-run">3.2km 코스 체험하기</button></div>')+'</section>'+sampleNotice();
  }
  function courseCard(c){
    var cls=c.env==='해안'?'coast':c.env==='숲길'||c.env==='오름'?'forest':'city';
    return '<article class="card course-card"><div class="course-visual '+cls+'"><div class="pills"><span class="pill '+(c.type==='러닝'?'orange':'green')+'">'+c.type+'</span><span class="pill">'+c.region+'</span></div><span class="course-scene" aria-hidden="true">'+c.scene+'</span></div><div class="course-body"><h3>'+esc(c.name)+'</h3><p class="small muted">'+esc(c.reason)+'</p><div class="course-meta"><span>↗ '+fmtKm(c.distance)+'</span><span>◷ 약 '+c.duration+'분</span><span>◆ '+c.difficulty+'</span><span>'+c.env+'</span></div><div class="course-actions"><div class="pills"><span class="pill">'+(c.parking?'🅿 주차':'주차 확인')+'</span><span class="pill">'+(c.toilet?'🚻 화장실':'화장실 확인')+'</span></div><button class="btn btn-soft" data-course="'+c.id+'">상세 보기</button></div></div></article>';
  }
  function courseView(){
    var f=state.filters,filtered=courses.filter(function(c){
      var dist=f.distance==='전체'||(f.distance==='3km 이하'&&c.distance<=3)||(f.distance==='3–5km'&&c.distance>3&&c.distance<=5)||(f.distance==='5–10km'&&c.distance>5&&c.distance<=10)||(f.distance==='10km 이상'&&c.distance>=10);
      return (f.type==='전체'||c.type===f.type)&&dist&&(f.difficulty==='전체'||c.difficulty===f.difficulty)&&(f.env==='전체'||c.env===f.env)&&(!f.parking||c.parking)&&(!f.toilet||c.toilet);
    });
    return topbar('제주 코스','내 속도에 맞는 길 찾기')+sampleNotice()+'<section class="card filter-panel" aria-label="코스 필터">'+filterGroup('종류','type',['전체','러닝','트래킹'])+filterGroup('거리','distance',['전체','3km 이하','3–5km','5–10km','10km 이상'])+filterGroup('난이도','difficulty',['전체','초급','중급','상급'])+filterGroup('환경','env',['전체','해안','오름','숲길','도심'])+'<div class="filter-title">편의시설</div><div class="filter-row"><button class="filter-btn" data-filter="parking" data-value="toggle" aria-pressed="'+f.parking+'">🅿 주차 가능</button><button class="filter-btn" data-filter="toilet" data-value="toggle" aria-pressed="'+f.toilet+'">🚻 화장실 있음</button></div></section><div class="results-line"><strong>'+filtered.length+'개 코스</strong><button class="text-btn" data-action="clear-filters">필터 초기화</button></div>'+(filtered.length?'<div class="grid course-grid">'+filtered.map(courseCard).join('')+'</div>':'<div class="card empty"><div class="empty-icon">🔎</div><h3>조건에 맞는 코스가 없어요</h3><p class="muted">필터를 하나씩 줄여 보세요.</p><button class="btn btn-soft" data-action="clear-filters">필터 모두 지우기</button></div>');
  }
  function filterGroup(title,key,values){return '<div class="filter-title">'+title+'</div><div class="filter-row">'+values.map(function(v){return '<button class="filter-btn" data-filter="'+key+'" data-value="'+v+'" aria-pressed="'+(state.filters[key]===v)+'">'+v+'</button>';}).join('')+'</div>';}
  function backRow(title){return '<div class="back-row"><button class="back-btn" data-action="back" aria-label="이전 화면">←</button><span class="back-title">'+esc(title)+'</span></div>';}
  function detailView(id){
    var c=courseById(id);if(!c)return notFound();
    var rs=c.restaurants.map(restaurantById).filter(Boolean);
    setTimeout(function(){initMap(c);},30);
    return backRow('코스 목록')+'<section><p class="eyebrow">'+c.region+' · '+c.type+'</p><h1>'+esc(c.name)+'</h1><div class="pills"><span class="pill orange">'+fmtKm(c.distance)+'</span><span class="pill">약 '+c.duration+'분</span><span class="pill green">'+c.difficulty+'</span><span class="pill sea">'+c.env+'</span></div></section><section class="map-shell" aria-label="'+esc(c.name)+' 경로 지도"><div class="map-canvas" id="map-main"></div><div class="map-fallback" id="mapFallback"><svg viewBox="0 0 320 180" aria-hidden="true"><path class="route-line" d="M25,145 C65,108 83,129 120,92 S180,52 206,79 S260,45 297,25"/><circle cx="25" cy="145" r="10" fill="#3e7751"/><circle cx="297" cy="25" r="10" fill="#e85d24"/></svg><div class="fallback-note">지도 연결을 확인하고 있어요. 경로 정보와 활동 체험은 그대로 이용할 수 있어요.</div></div><div class="map-topbar"><div class="map-summary"><strong>'+esc(c.name)+' · '+fmtKm(c.mapDistance)+'</strong><span>'+esc(c.start)+' 출발 · '+esc(c.routeNote)+'</span></div><div class="map-tools"><button class="map-tool" data-action="fit-map" aria-label="전체 경로와 식당 보기" title="전체 경로와 식당 보기">⌖</button></div></div><div class="map-legend"><span class="legend-item"><i class="legend-dot" style="background:#3e7751"></i>출발</span><span class="legend-item"><i class="legend-line"></i>코스</span><span class="legend-item"><i class="legend-dot" style="background:#e85d24"></i>종료</span><span class="legend-item"><i class="legend-restaurant">🍚</i>식당</span></div></section><div class="detail-grid"><section class="card card-pad"><h2>코스 한눈에 보기</h2><p class="muted">'+esc(c.desc)+'</p><div class="info-list">'+info('출발',c.start)+info('도착',c.end)+info('지도 경로',fmtKm(c.mapDistance))+info('경로 방식',c.routeNote)+info('주차',c.parking?'가능':'현장 확인')+info('화장실',c.toilet?'있음':'현장 확인')+info('편의점',c.store?'주변 있음':'미리 준비')+info('반려동물',c.pet)+info('추천 시간',c.best)+info('야간',c.night)+'</div><div class="warning-box"><strong>날씨 주의</strong><br>'+esc(c.weather)+'</div><div class="warning-box"><strong>안전 안내</strong><br>'+esc(c.safety)+'</div></section><section><div class="section-head"><div><p class="eyebrow">코스 주변 추천</p><h2>실제 위치의 로컬 한 끼 3곳</h2></div></div><div class="grid">'+rs.slice(0,3).map(restaurantCard).join('')+'</div></section></div><div class="sticky-action"><div class="btn-row"><button class="btn btn-secondary" data-start-real="'+c.id+'">📍 실제 GPS로 시작</button><button class="btn btn-primary" data-start-demo="'+c.id+'">▶ 데모로 체험</button></div></div>'+sampleNotice();
  }
  function info(label,value){return '<div class="info-item"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';}
  function initMap(c){
    ui.mapCourse=c;
    if(window.L){drawLeaflet(c);return;}
    if(ui.leafletLoading)return;
    ui.leafletLoading=true;var s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.crossOrigin='anonymous';
    s.onload=function(){ui.leafletLoading=false;if(ui.mapCourse&&document.getElementById('map-main'))drawLeaflet(ui.mapCourse);};
    s.onerror=function(){ui.leafletLoading=false;toast('지도 연결이 어려워 대체 경로를 표시했어요.');};document.head.appendChild(s);
  }
  function drawLeaflet(c){
    var el=document.getElementById('map-main');if(!el||!window.L)return;
    destroyMap();
    try{
      ui.map=window.L.map(el,{zoomControl:false,attributionControl:true,scrollWheelZoom:true,doubleClickZoom:true,touchZoom:true,boxZoom:true,keyboard:true,tap:true});
      window.L.control.zoom({position:'bottomright',zoomInTitle:'지도 확대',zoomOutTitle:'지도 축소'}).addTo(ui.map);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(ui.map);
      var line=window.L.polyline(c.coords,{color:'#e85d24',weight:6,opacity:.95,lineCap:'round'}).addTo(ui.map);
      window.L.circleMarker(c.coords[0],{radius:9,color:'#fff',weight:3,fillColor:'#3e7751',fillOpacity:1}).addTo(ui.map).bindPopup('<strong>출발</strong><br>'+esc(c.start));
      window.L.circleMarker(c.coords[c.coords.length-1],{radius:9,color:'#fff',weight:3,fillColor:'#e85d24',fillOpacity:1}).addTo(ui.map).bindPopup('<strong>코스 종료</strong><br>'+esc(c.end)+'<br>'+fmtKm(c.mapDistance));
      var restaurantIcon=window.L.divIcon({className:'restaurant-map-icon',html:'🍚',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-16]});
      ui.mapBounds=line.getBounds();
      c.restaurants.map(restaurantById).filter(Boolean).forEach(function(restaurant){
        var marker=window.L.marker([restaurant.lat,restaurant.lng],{icon:restaurantIcon,title:restaurant.name}).addTo(ui.map);
        var travel=restaurantTravel(restaurant);
        marker.bindPopup('<div class="restaurant-popup"><strong>'+esc(restaurant.name)+'</strong><span>'+esc(restaurant.menu)+' · '+travel.icon+' '+esc(travel.label)+'</span><a target="_blank" rel="noopener noreferrer" href="'+esc(restaurant.osmUrl)+'">정확한 위치 보기 ↗</a></div>');
        ui.mapBounds.extend([restaurant.lat,restaurant.lng]);
      });
      ui.map.fitBounds(ui.mapBounds,{padding:[45,45]});
      var fb=document.getElementById('mapFallback');if(fb)fb.classList.add('hidden');setTimeout(function(){if(ui.map)ui.map.invalidateSize();},100);
    }catch(e){destroyMap();}
  }
  function destroyMap(){if(ui.map){try{ui.map.remove();}catch(e){}ui.map=null;}ui.mapBounds=null;}
  function startActivity(id,mode){
    var c=courseById(id);if(!c)return;
    stopActivity();
    ui.activity={courseId:id,mode:mode,status:mode==='demo'?'running':'locating',elapsed:0,distance:0,progress:0,accuracy:mode==='demo'?8:null,lastPos:null,startedAt:Date.now()};
    navigate('activity/'+id);
    if(mode==='demo')setTimeout(runDemo,100);else setTimeout(runGps,100);
  }
  function runDemo(){if(!ui.activity||ui.activity.mode!=='demo')return;clearInterval(ui.timer);ui.timer=setInterval(function(){if(!ui.activity||ui.activity.status!=='running')return;ui.activity.elapsed+=5;ui.activity.progress=Math.min(100,ui.activity.progress+2.5);var c=courseById(ui.activity.courseId);ui.activity.distance=c.distance*ui.activity.progress/100;updateActivityDom();if(ui.activity.progress>=100)clearInterval(ui.timer);},850);}
  function runGps(){
    if(!ui.activity)return;
    if(!navigator.geolocation){gpsFail('이 브라우저는 위치 기능을 지원하지 않아요.');return;}
    if(location.protocol==='file:'||(!window.isSecureContext&&location.hostname!=='localhost')){gpsFail('파일로 열면 실제 GPS가 제한될 수 있어요. 데모 모드를 이용해 주세요.');return;}
    try{ui.watchId=navigator.geolocation.watchPosition(onPosition,function(err){var msg=err.code===1?'위치 권한이 거부되었어요.':err.code===2?'현재 위치를 확인할 수 없어요.':'위치 확인 시간이 초과되었어요.';gpsFail(msg);},{enableHighAccuracy:true,timeout:12000,maximumAge:3000});ui.activity.status='running';ui.timer=setInterval(function(){if(ui.activity&&ui.activity.status==='running'){ui.activity.elapsed++;updateActivityDom();}},1000);}catch(e){gpsFail('GPS를 시작하지 못했어요.');}
  }
  function onPosition(pos){
    if(!ui.activity)return;var a=ui.activity,c=courseById(a.courseId),now={lat:pos.coords.latitude,lng:pos.coords.longitude};a.accuracy=Math.round(pos.coords.accuracy||0);
    if(a.lastPos){var add=haversine(a.lastPos,now);if(add<.3)a.distance+=add;}a.lastPos=now;a.progress=Math.min(100,(a.distance/c.minDistance)*100);updateActivityDom();
  }
  function haversine(a,b){var R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180,x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
  function gpsFail(msg){if(!ui.activity)return;ui.activity.status='error';ui.activity.error=msg;updateActivityDom();toast(msg);}
  function activityView(id){
    var c=courseById(id),a=ui.activity;if(!c||!a||a.courseId!==id)return '<div class="card empty"><div class="empty-icon">📍</div><h2>진행 중인 활동이 없어요</h2><button class="btn btn-primary" data-course="'+(c?c.id:'hamdeok-run')+'">코스 보기</button></div>';
    var status=a.status==='paused'?'일시정지':a.status==='error'?'GPS 확인 필요':a.mode==='demo'?'데모 이동 중':'GPS 기록 중';
    return backRow('활동 종료')+'<section class="card activity-hero"><p class="eyebrow" style="justify-content:center">'+(a.mode==='demo'?'안전한 데모 체험':'실제 GPS 활동')+'</p><h1>'+esc(c.name)+'</h1><div class="activity-ring" id="activityRing" style="--p:'+a.progress+'"><div class="activity-ring-content"><strong id="progressText">'+Math.round(a.progress)+'%</strong><span>코스 진행률</span></div></div><div class="grid activity-stats"><div class="card stat"><div class="stat-value" id="distanceText">'+fmtKm(a.distance)+'</div><div class="stat-label">이동 거리</div></div><div class="card stat"><div class="stat-value" id="timeText">'+fmtTime(a.elapsed)+'</div><div class="stat-label">활동 시간</div></div><div class="card stat"><div class="stat-value" id="accuracyText">'+(a.accuracy!=null?'약 '+a.accuracy+'m':'확인 중')+'</div><div class="stat-label">GPS 정확도</div></div></div><div class="gps-status"><i class="pulse" id="gpsPulse"></i><span id="gpsStatus">'+status+'</span></div>'+(a.error?'<div class="warning-box" id="gpsError">'+esc(a.error)+'</div>':'<div class="warning-box hidden" id="gpsError"></div>')+'<div class="warning-box">화면보다 주변을 먼저 살펴 주세요. 운전 중에는 사용하지 마세요.</div><div class="btn-row" style="justify-content:center;margin-top:18px"><button class="btn btn-secondary" data-action="pause">'+(a.status==='paused'?'▶ 다시 시작':'Ⅱ 일시정지')+'</button><button class="btn btn-primary" data-action="finish">✓ 완주 처리</button><button class="btn btn-danger" data-action="end-activity">활동 종료</button></div></section>';
  }
  function updateActivityDom(){
    var a=ui.activity;if(!a)return;var ring=document.getElementById('activityRing'),p=document.getElementById('progressText'),d=document.getElementById('distanceText'),t=document.getElementById('timeText'),ac=document.getElementById('accuracyText'),s=document.getElementById('gpsStatus'),er=document.getElementById('gpsError');
    if(ring)ring.style.setProperty('--p',a.progress);if(p)p.textContent=Math.round(a.progress)+'%';if(d)d.textContent=fmtKm(a.distance);if(t)t.textContent=fmtTime(a.elapsed);if(ac)ac.textContent=a.accuracy!=null?'약 '+a.accuracy+'m':'확인 중';if(s)s.textContent=a.status==='paused'?'일시정지':a.status==='error'?'GPS 확인 필요':a.mode==='demo'?'데모 이동 중':'GPS 기록 중';if(er&&a.error){er.textContent=a.error;er.classList.remove('hidden');}
  }
  function attemptFinish(){
    var a=ui.activity;if(!a)return;var c=courseById(a.courseId);
    if(a.mode==='demo'){a.progress=100;a.distance=c.distance;a.elapsed=Math.max(a.elapsed,c.minDuration*60);completeActivity(c,a);return;}
    var remain=Math.max(0,c.minDistance-a.distance),timeRemain=Math.max(0,c.minDuration*60-a.elapsed);
    if(remain>.05||timeRemain>0){openModal('<h2>아직 완주 조건이 남았어요</h2><p>완주까지 약 <strong>'+fmtKm(remain)+'</strong>'+(timeRemain?'와 '+Math.ceil(timeRemain/60)+'분':'')+'이 남았어요.</p><p class="small muted">실제 서비스에서는 도착지 접근 여부도 함께 확인합니다.</p><div class="btn-row"><button class="btn btn-secondary btn-block" data-action="close-modal">계속 활동하기</button></div>');return;}
    completeActivity(c,a);
  }
  function completeActivity(c,a){
    var beforeDol=dolStage().name,beforeTree=treeStage().name,record={id:'h'+Date.now(),courseId:c.id,name:c.name,type:c.type,distance:c.distance,duration:a.elapsed,date:new Date().toISOString(),xp:20};
    state.completions.unshift(record);state.totalDistance=Math.round((state.totalDistance+c.distance)*10)/10;state.xp+=20;saveState();stopActivity(false);var growth=beforeDol!==dolStage().name?'돌하르방이 '+dolStage().name+' 단계로 성장했어요!':beforeTree!==treeStage().name?'귤나무가 '+treeStage().name+' 단계로 성장했어요!':'제주방에 완주 스티커가 추가됐어요!';setSession('hondigil_last_growth',growth);navigate('complete/'+c.id);
  }
  function stopActivity(clear){clearInterval(ui.timer);ui.timer=null;if(ui.watchId!=null&&navigator.geolocation){try{navigator.geolocation.clearWatch(ui.watchId);}catch(e){}}ui.watchId=null;if(clear!==false)ui.activity=null;}
  function completionView(id){
    var c=courseById(id),rec=state.completions[0];if(!c||!rec||rec.courseId!==id)return notFound();var growth=getSession('hondigil_last_growth','제주방에 완주 스티커가 추가됐어요!');
    return '<section class="card completion"><div class="celebrate" aria-hidden="true">🎉</div><p class="eyebrow" style="justify-content:center">완주 성공</p><h1>'+esc(c.name)+'</h1><p class="muted">제주에서 오늘의 길을 멋지게 채웠어요.</p><div class="grid stats"><div class="stat"><div class="stat-value">'+fmtKm(rec.distance)+'</div><div class="stat-label">완주 거리</div></div><div class="stat"><div class="stat-value">'+fmtTime(rec.duration)+'</div><div class="stat-label">활동 시간</div></div><div class="stat"><div class="stat-value">+20</div><div class="stat-label">경험치</div></div><div class="stat"><div class="stat-value">'+state.completions.length+'</div><div class="stat-label">누적 완주</div></div></div><div class="reward-card"><div style="font-size:42px">'+treeFigure(treeStage())+'</div><strong>'+esc(growth)+'</strong><p class="small muted">'+esc(treeStage().next)+'</p></div><div class="btn-row" style="justify-content:center"><button class="btn btn-primary" data-nav="restaurants" data-course-restaurants="'+c.id+'">🍚 주변 식당 보기</button><button class="btn btn-secondary" data-nav="room">🏡 제주방 보기</button><button class="btn btn-soft" data-action="share" data-record="'+rec.id+'">공유하기</button></div></section>'+restaurantSection(c);
  }
  function restaurantSection(c){
    var list=c.restaurants.map(restaurantById).filter(Boolean);var filter=state.restaurantFilter;if(filter!=='전체')list=list.filter(function(r){return r.category===filter||(filter==='혼밥 가능'&&r.solo)||(filter==='주차 가능'&&r.parking)||(filter==='현재 영업 중'&&isOpen(r));});
    var filters=['전체','든든한 한 끼','가볍게 먹기','제주다운 메뉴','카페·음료','혼밥 가능','주차 가능','현재 영업 중'];
    return '<section class="section" id="restaurants"><div class="section-head"><div><p class="eyebrow">완주 후 추천</p><h2>코스 주변 실제 식당</h2></div></div><div class="filter-row" style="margin-bottom:13px">'+filters.map(function(x){return '<button class="filter-btn" data-restaurant-filter="'+x+'" aria-pressed="'+(filter===x)+'">'+x+'</button>';}).join('')+'</div><div class="grid restaurant-grid">'+(list.length?list.map(restaurantCard).join(''):'<div class="card empty"><div class="empty-icon">🍽️</div><h3>조건에 맞는 식당이 없어요</h3><button class="btn btn-soft" data-restaurant-filter="전체">필터 지우기</button></div>')+'</div></section>'+sampleNotice();
  }
  function isOpen(r){
    var match=String(r.hours||'').match(/^(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})$/);
    if(!match)return false;
    var now=new Date(),current=now.getHours()*60+now.getMinutes(),start=Number(match[1])*60+Number(match[2]),end=Number(match[3])*60+Number(match[4]);
    return end>start?current>=start&&current<end:current>=start||current<end;
  }
  function restaurantTravel(r){return {icon:r.travelMode==='차량'?'🚗':'🚶',label:(r.travelMode||'도보')+' '+r.travelMin+'분'};}
  function availability(value,yes,no,unknown){return value===true?yes:value===false?no:unknown;}
  function restaurantCard(r){var travel=restaurantTravel(r),score=Math.max(72,100-r.travelMin+(r.solo===true?3:0)+(r.parking===true?3:0));return '<article class="card restaurant-card"><div class="restaurant-top"><div><div class="pills"><span class="pill green">실제 위치</span><span class="pill">'+esc(r.region)+'</span></div><h3 style="margin-top:10px">'+esc(r.name)+'</h3><p class="small muted">'+esc(r.menu)+' · '+esc(r.price)+'</p></div><span class="restaurant-score" title="추천 적합도">'+score+'</span></div><div class="restaurant-reason">✓ '+esc(r.reason)+'</div><div class="pills"><span class="pill">'+travel.icon+' '+esc(travel.label)+'</span><span class="pill">'+availability(r.solo,'혼밥 가능','2인 이상 추천','혼밥 확인')+'</span><span class="pill">'+availability(r.parking,'주차 가능','주차 없음','주차 확인')+'</span></div><div class="restaurant-actions"><button class="btn btn-secondary" data-restaurant="'+r.id+'">상세 정보</button><a class="btn btn-soft" target="_blank" rel="noopener noreferrer" href="'+esc(r.osmUrl)+'">정확한 위치 ↗</a></div></article>';}
  function restaurantModal(id){var r=restaurantById(id);if(!r)return;var travel=restaurantTravel(r);openModal('<div class="modal-head"><div><p class="eyebrow">OpenStreetMap 등록 식당</p><h2>'+esc(r.name)+'</h2><p class="muted">'+esc(r.menu)+' · '+esc(r.price)+'</p></div><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div><div class="info-list">'+info('코스에서 이동',travel.icon+' '+travel.label)+info('영업시간',r.hours)+info('쉬는 시간',r.breakTime)+info('휴무',r.closed)+info('주차',availability(r.parking,'가능','없음','현장 확인'))+info('혼밥',availability(r.solo,'가능','2인 이상 추천','현장 확인'))+info('포장',availability(r.takeout,'가능','매장 식사','현장 확인'))+'</div><div class="restaurant-reason">'+esc(r.reason)+'</div><p class="small muted">이름·좌표 확인 기준일: '+r.verified+' · 영업시간과 메뉴는 방문 전 다시 확인해 주세요.</p><div class="btn-row"><a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="'+esc(r.osmUrl)+'">정확한 위치 열기</a><a class="btn btn-secondary" target="_blank" rel="noopener noreferrer" href="https://map.naver.com/p/search/'+encodeURIComponent(r.name+' 제주')+'">네이버지도 검색</a></div>');}
  function roomView(){var dol=dolStage(),tree=treeStage();return topbar('나의 제주방','완주할수록 자라는 공간')+'<section class="room" data-bg="'+esc(state.background)+'"><span class="room-label">Lv.'+level()+' · '+esc(state.background)+'</span><span class="room-sun"></span><span class="room-dol">'+dolFigure(dol)+'</span><span class="room-tree">'+treeFigure(tree)+'</span><span class="room-wall"></span><div class="stickers">'+(state.completions.length?state.completions.slice(0,6).map(function(r){return '<span class="sticker" title="'+esc(r.name)+'">'+(r.type==='러닝'?'👟':'🥾')+'</span>';}).join(''):'<span class="sticker" title="첫 완주를 기다려요">＋</span>')+'</div></section><section class="section grid growth-grid"><div class="card growth-card"><div class="growth-emoji">'+dolFigure(dol)+'</div><h3>'+esc(dol.name)+'</h3><p class="small muted">'+esc(dol.next)+'</p></div><div class="card growth-card"><div class="growth-emoji">'+treeFigure(tree)+'</div><h3>'+esc(tree.name)+'</h3><p class="small muted">'+esc(tree.next)+'</p></div></section><section class="card card-pad"><div class="section-head"><div><p class="eyebrow">방 꾸미기</p><h2>오늘의 제주 배경</h2></div></div><div class="filter-row">'+['제주 바다','귤밭','오름','돌담길'].map(function(bg){return '<button class="filter-btn" data-background="'+bg+'" aria-pressed="'+(state.background===bg)+'">'+bg+'</button>';}).join('')+'</div></section>';
  }
  function historyCard(r){return '<article class="history-item"><span class="history-icon">'+(r.type==='러닝'?'👟':'🥾')+'</span><div><strong>'+esc(r.name)+'</strong><div class="small muted">'+new Date(r.date).toLocaleDateString('ko-KR')+' · '+fmtKm(r.distance)+'</div></div><span class="pill orange">+20 EXP</span></article>';}
  function historyView(){return topbar('완주 기록','차곡차곡 쌓인 나의 제주')+(state.completions.length?'<section class="card card-pad"><div class="grid stats" style="margin-bottom:12px"><div class="stat"><div class="stat-value">'+state.completions.length+'</div><div class="stat-label">완주 횟수</div></div><div class="stat"><div class="stat-value">'+fmtKm(state.totalDistance)+'</div><div class="stat-label">누적 거리</div></div></div>'+state.completions.map(historyCard).join('')+'</section>':'<section class="card empty"><div class="empty-icon">📝</div><h2>기록장이 비어 있어요</h2><p class="muted">데모 코스를 완주하면 이곳에 자동으로 저장돼요.</p><button class="btn btn-primary" data-nav="courses">코스 고르기</button></section>');}
  function settingsView(){return topbar('설정','내게 편한 혼디길')+'<div class="settings-layout"><section class="card settings-group"><p class="eyebrow">화면</p><h2>보기 편하게</h2><div class="setting-row"><div class="setting-copy"><strong>큰 글씨</strong><span>전체 글자를 약 10% 키워요.</span></div><label class="switch"><input type="checkbox" data-setting="largeText" '+(state.textSize==='large'?'checked':'')+'><span></span></label></div><div class="setting-row"><div class="setting-copy"><strong>움직임 줄이기</strong><span>축하 효과와 전환을 최소화해요.</span></div><label class="switch"><input type="checkbox" data-setting="reduceMotion" '+(state.reduceMotion?'checked':'')+'><span></span></label></div><div class="setting-row"><div class="setting-copy"><strong>제주방 배경</strong><span>선택은 이 브라우저에 저장돼요.</span></div><select class="select" data-setting="background">'+['제주 바다','귤밭','오름','돌담길'].map(function(x){return '<option '+(state.background===x?'selected':'')+'>'+x+'</option>';}).join('')+'</select></div></section><section class="card settings-group"><p class="eyebrow">위치·개인정보</p><h2>GPS는 이렇게 사용해요</h2><p class="small muted">이 MVP는 계정이나 서버가 없으며 GPS 기록을 서버에 올리지 않습니다. 활동 중에는 거리 계산에만 사용하고, 완주 후에는 코스명·거리·시간 같은 단순 기록만 이 브라우저에 저장합니다.</p><div class="notice" style="margin-bottom:0"><span>🔒</span><span>파일을 직접 열면 브라우저 보안 정책 때문에 실제 GPS가 제한될 수 있어요. 데모 모드는 항상 사용할 수 있습니다.</span></div></section><section class="card settings-group"><p class="eyebrow">데이터 관리</p><h2>시연 데이터</h2><p class="small muted">기록과 배경 설정은 이 기기의 localStorage에만 보관돼요. 아래 버튼으로 한 번에 삭제할 수 있습니다.</p><button class="btn btn-danger btn-block" data-action="reset">모든 기록과 설정 초기화</button></section></div><section class="section card card-pad"><h3>안전 안내</h3><ul class="small muted"><li>운전 중에는 혼디길을 사용하지 마세요.</li><li>출발 전 날씨, 탐방로 개방, 지역 통제 여부를 확인하세요.</li><li>실제 서비스 출시 전에는 별도의 개인정보처리방침이 필요합니다.</li></ul></section>'+sampleNotice();}
  function notFound(){return '<section class="card empty"><div class="empty-icon">🧭</div><h1>길을 다시 찾고 있어요</h1><p class="muted">요청한 화면을 찾지 못했어요.</p><button class="btn btn-primary" data-nav="home">홈으로 가기</button></section>';}
  function render(){
    destroyMap();applyPrefs();var main=document.getElementById('main-content'),hash=(location.hash||'#/home').replace(/^#\//,'').split('/'),page=hash[0],id=hash[1],html='';
    if(!deviceProfile){document.body.classList.add('onboarding-active');setSidebar(false);document.getElementById('bottomNav').innerHTML='';document.getElementById('desktopNav').innerHTML='';main.innerHTML=onboardingView();main.focus({preventScroll:true});window.scrollTo(0,0);var nicknameInput=document.getElementById('nicknameInput');if(nicknameInput)nicknameInput.focus({preventScroll:true});return;}
    document.body.classList.remove('onboarding-active');renderNav();
    if(page==='home')html=homeView();else if(page==='courses')html=courseView();else if(page==='course')html=detailView(id);else if(page==='activity')html=activityView(id);else if(page==='complete')html=completionView(id);else if(page==='room')html=roomView();else if(page==='history')html=historyView();else if(page==='settings')html=deviceSettingsView();else html=notFound();main.innerHTML=html;if(page==='home'){var profileName=main.querySelector('.profile-card .course-actions strong');if(profileName)profileName.textContent=deviceProfile.nickname+'님의 돌하르방 · Lv.'+level();}main.focus({preventScroll:true});window.scrollTo(0,0);renderNav();
  }
  function legalModal(kind){
    var docs={
      terms:{title:'서비스 이용약관',body:'<h3>서비스의 목적</h3><p>혼디길은 제주 러닝·트래킹 코스 탐색, GPS 활동 체험, 완주 기록과 주변 식당 정보를 제공하는 MVP 서비스입니다.</p><h3>이용자의 책임</h3><ul><li>이용자는 교통법규와 현장 통제, 탐방로 운영시간을 지켜야 합니다.</li><li>운전 중에는 서비스를 조작하지 않으며 날씨와 건강 상태를 먼저 확인해야 합니다.</li></ul><h3>정보와 서비스의 한계</h3><p>코스, 거리, 식당과 운영 정보는 실제 현장과 다를 수 있습니다. 서비스는 안전이나 영업 여부를 보증하지 않으며, 점검 또는 기술적 사유로 일부 기능이 제한될 수 있습니다.</p>'},
      privacy:{title:'개인정보처리방침',body:'<h3>처리하는 정보와 목적</h3><ul><li>현재 위치: 실제 GPS 활동 중 거리와 진행률 계산</li><li>완주 기록: 코스명, 거리, 시간과 경험치 표시</li><li>화면 설정: 글자 크기, 움직임과 제주방 배경 유지</li></ul><h3>보관과 삭제</h3><p>GPS 좌표는 활동 중 브라우저 메모리에서만 사용하며 활동 종료 시 추적을 중단합니다. 완주 기록과 설정은 현재 기기의 브라우저 저장소에 보관되고, 설정의 “모든 기록과 설정 초기화” 또는 브라우저 데이터 삭제로 즉시 지울 수 있습니다.</p><h3>외부 전송과 제공</h3><p>혼디길 앱의 GPS와 완주 기록은 자체 서버에 전송하거나 제3자에게 제공하지 않습니다. 운영 문의는 Google Forms에서 별도로 접수되며, 이용자가 폼에 직접 입력한 내용만 Google을 통해 폼 소유자에게 전달됩니다. 지도와 화면 자원을 불러오는 과정에서는 OpenStreetMap·UNPKG 서버에 IP 주소 등 통상적인 접속 정보가 전달될 수 있습니다.</p><h3>이용자의 권리</h3><p>브라우저에서 위치 권한을 거부하거나 철회할 수 있고, 저장된 기록과 설정을 언제든 삭제할 수 있습니다. 관련 문의는 하단의 운영 문의 채널로 접수할 수 있습니다.</p>'},
      location:{title:'위치정보 이용안내',body:'<h3>이용 목적과 범위</h3><p>현재 위치는 이용자가 “실제 GPS로 시작”을 선택하고 브라우저 권한을 허용한 동안 이동 거리, 진행률과 GPS 정확도를 계산하는 데만 사용합니다.</p><h3>보관과 제공</h3><p>개별 GPS 좌표는 서버에 저장하거나 제3자에게 제공하지 않으며, 활동을 종료하거나 페이지를 닫으면 위치 추적을 중단합니다.</p><h3>권한 철회와 주의사항</h3><p>위치 권한은 브라우저 또는 기기 설정에서 언제든 철회할 수 있습니다. GPS 오차가 발생할 수 있으므로 화면의 위치를 안전 판단이나 긴급구조 수단으로 사용하지 마세요.</p>'},
      safety:{title:'안전·운영 안내',body:'<h3>야외 활동 안전</h3><ul><li>출발 전 날씨, 탐방로 개방, 지역 통제와 일몰 시간을 확인해 주세요.</li><li>차도와 교차로에서는 화면보다 주변을 먼저 살피고 운전 중에는 사용하지 마세요.</li><li>건강 이상이나 위험 상황에서는 즉시 활동을 멈추고 119 등 공식 긴급기관에 연락해 주세요.</li></ul><h3>정보 확인</h3><p>거리와 예상 시간은 참고용이며 GPS 환경에 따라 달라질 수 있습니다. 식당 위치는 OpenStreetMap 등록 좌표를 기준으로 하며 영업시간, 메뉴와 휴무는 방문 전 매장에 확인해 주세요.</p>'}
    },doc=docs[kind];if(!doc)return;
    openModal('<div class="modal-head"><div><p class="eyebrow">혼디길 법적 안내</p><h2>'+doc.title+'</h2><p class="legal-effective">시행일: 2026년 7월 17일</p></div><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div><div class="legal-copy">'+doc.body+'</div>');
  }
  function openModal(html){var root=document.getElementById('modalRoot');root.innerHTML='<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true">'+html+'</section></div>';var focus=root.querySelector('button,a,select');if(focus)focus.focus();}
  function closeModal(){document.getElementById('modalRoot').innerHTML='';}
  function toast(msg){var el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(ui.toastTimer);ui.toastTimer=setTimeout(function(){el.classList.remove('show');},2600);}
  function shareRecord(id){var r=state.completions.filter(function(x){return x.id===id;})[0];if(!r)return;var text=r.name+' 코스를 '+fmtKm(r.distance)+' 완주했어요!\n돌하르방 경험치 +'+r.xp+'\n'+treeStage().name+' 단계의 제주방을 키우는 중이에요. #혼디길';if(navigator.share){navigator.share({title:'혼디길 완주 기록',text:text}).catch(function(){});}else if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(function(){toast('완주 문구를 복사했어요.');}).catch(function(){copyFallback(text);});}else copyFallback(text);}
  function copyFallback(text){var t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy');toast('완주 문구를 복사했어요.');}catch(e){toast('복사가 어려워요. 기록 화면을 캡처해 주세요.');}document.body.removeChild(t);}
  function resetData(){openModal('<div class="modal-head"><div><p class="eyebrow">되돌릴 수 없어요</p><h2>모든 데이터를 지울까요?</h2></div><button class="modal-close" data-action="close-modal" aria-label="닫기">×</button></div><p class="muted">완주 기록, 성장 단계와 제주방 배경 설정이 모두 초기화됩니다.</p><div class="btn-row"><button class="btn btn-secondary" data-action="close-modal">취소</button><button class="btn btn-danger" data-action="confirm-reset">모두 지우기</button></div>');}
  function handleClick(e){
    var el=e.target.closest('button,a');if(!el)return;
    if(el.dataset.legal){e.preventDefault();legalModal(el.dataset.legal);return;}
    if(el.dataset.nav){e.preventDefault();setSidebar(false);if(el.dataset.nav==='restaurants'){var sec=document.getElementById('restaurants');if(sec)sec.scrollIntoView();return;}navigate(el.dataset.nav);return;}
    if(el.dataset.course){navigate('course/'+el.dataset.course);return;}
    if(el.dataset.courseType){state.filters.type=el.dataset.courseType;saveState();navigate('courses');return;}
    if(el.dataset.filter){var k=el.dataset.filter,v=el.dataset.value;state.filters[k]=v==='toggle'?!state.filters[k]:v;saveState();render();return;}
    if(el.dataset.restaurantFilter){state.restaurantFilter=el.dataset.restaurantFilter;saveState();render();setTimeout(function(){var s=document.getElementById('restaurants');if(s)s.scrollIntoView();},0);return;}
    if(el.dataset.background){state.background=el.dataset.background;saveState();render();return;}
    if(el.dataset.courseRestaurants){var section=document.getElementById('restaurants');if(section)section.scrollIntoView({behavior:state.reduceMotion?'auto':'smooth'});return;}
    if(el.dataset.restaurant){restaurantModal(el.dataset.restaurant);return;}
    if(el.dataset.startDemo){startActivity(el.dataset.startDemo,'demo');return;}
    if(el.dataset.startReal){startActivity(el.dataset.startReal,'gps');return;}
    var action=el.dataset.action;if(!action)return;
    if(action==='toggle-sidebar'){setSidebar(!ui.sidebarOpen);return;}
    if(action==='close-sidebar'){setSidebar(false);return;}
    if(action==='clear-filters'){state.filters=clone(defaults.filters);saveState();render();}
    else if(action==='back'){if(location.hash.indexOf('#/activity/')===0){if(confirm('활동을 종료하고 이전 화면으로 돌아갈까요?')){var cid=ui.activity&&ui.activity.courseId;stopActivity();navigate('course/'+(cid||'hamdeok-run'));}}else if(location.hash.indexOf('#/course/')===0)navigate('courses');else if(location.hash.indexOf('#/complete/')===0)navigate('history');else history.back();}
    else if(action==='fit-map'){if(ui.map&&ui.mapBounds){ui.map.fitBounds(ui.mapBounds,{padding:[45,45]});}else toast('현재 전체 경로를 간단한 선으로 표시하고 있어요.');}
    else if(action==='pause'){if(!ui.activity)return;ui.activity.status=ui.activity.status==='paused'?'running':'paused';render();if(ui.activity.mode==='demo'&&ui.activity.status==='running')runDemo();}
    else if(action==='finish')attemptFinish();
    else if(action==='end-activity'){if(confirm('활동 기록을 저장하지 않고 종료할까요?')){var id=ui.activity&&ui.activity.courseId;stopActivity();navigate('course/'+id);}}
    else if(action==='share')shareRecord(el.dataset.record);
    else if(action==='reset')resetRecordsData();
    else if(action==='confirm-records-reset'){try{localStorage.removeItem(STORAGE_KEY);}catch(err){}state=clone(defaults);closeModal();applyPrefs();navigate('home');render();toast('별명은 유지하고 기록과 설정을 초기화했어요.');}
    else if(action==='confirm-reset'){try{localStorage.removeItem(STORAGE_KEY);}catch(err){}state=clone(defaults);closeModal();applyPrefs();navigate('home');render();toast('모든 데이터를 초기화했어요.');}
    else if(action==='close-modal')closeModal();
    else if(action==='backdrop-close'&&e.target===el)closeModal();
  }
  function handleSubmit(e){
    var form=e.target;if(!form||form.dataset.form!=='nickname')return;e.preventDefault();
    if(deviceProfile){render();return;}
    var input=form.elements.nickname,error=document.getElementById('nicknameError'),validated=validateNickname(input&&input.value);
    if(validated.error){if(error)error.textContent=validated.error;if(input){input.setAttribute('aria-invalid','true');input.focus();}return;}
    if(!saveDeviceProfile(validated.nickname)){if(error)error.textContent='별명을 저장하지 못했어요. 브라우저 저장소 사용을 허용한 뒤 다시 시도해 주세요.';if(input)input.setAttribute('aria-invalid','true');return;}
    render();toast(validated.nickname+'님, 혼디길에 오신 걸 환영해요!');
  }
  function handleChange(e){var el=e.target;if(el.dataset.setting==='largeText'){state.textSize=el.checked?'large':'normal';saveState();applyPrefs();}else if(el.dataset.setting==='reduceMotion'){state.reduceMotion=el.checked;saveState();applyPrefs();}else if(el.dataset.setting==='background'){state.background=el.value;saveState();}}
  document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('submit',handleSubmit);
  window.addEventListener('hashchange',render);window.addEventListener('beforeunload',function(){stopActivity(false);});
  window.addEventListener('keydown',function(e){if(e.key==='Escape'){setSidebar(false);closeModal();}});
  if(!location.hash)location.replace('#/home');else render();
}());
