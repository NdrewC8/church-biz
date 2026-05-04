// ── Firebase 동기화 ───────────────────────
async function saveToFirebase(){
  try{
    await db.collection('data').doc('main').set({
      members: S.members,
      biz: S.biz,
      bizDB: S.bizDB,
      reviews: S.reviews,
      likes: S.likes,
      updatedAt: new Date().toISOString()
    });
    console.log('Firebase 저장 완료');
  }catch(e){ console.error('Firebase 저장 실패:', e); }
}

async function loadFromFirebase(){
  try{
    var doc = await db.collection('data').doc('main').get();
    if(doc.exists){
      var data = doc.data();
      S.members = data.members || [];
      S.biz = data.biz || [];
      S.bizDB = data.bizDB || [];
      S.reviews = data.reviews || [];
      S.likes = data.likes || [];
      console.log('Firebase 데이터 로드 완료');
      doFilter();
      renderAllRv();
    } else {
      console.log('저장된 데이터 없음');
    }
  }catch(e){ console.error('Firebase 로드 실패:', e); }
}



const EM = {'간판/광고':'📢','건축/건설':'🏗️','교육':'📚','꽃집':'🌸','렌탈':'🔧','병원/의료':'🏥','보험':'🛡️','부동산':'🏠','서비스':'💼','스포츠':'⚽','숙박':'🏨','식품/음식점':'🍽️','온라인판매':'🛒','요양시설':'❤️','유통':'📦','이미용':'✂️','인테리어':'🛋️','자동차':'🚗','정보통신/컴퓨터':'💻','제조':'⚙️','카페':'☕','판매':'🏪','법률/세무':'⚖️','설비':'🔩','농업/임업/축산업':'🌾','귀금속/예물':'💍','운수':'🚚','그 외':'🔮','기타':'📌','종교':'⛪'};
const REGIONS = ['강릉','경주','광주','구미','남양주','대구','대전','목포','부산','부천','서산','서울','수원','순천','안동','안산','안양','양산','용인','울산','원주','의정부','익산','인천','일산','전주','제주','제천','창원','천안','청주','춘천','통영','평택','포항','화성'];
const CATS = Object.keys(EM);
const PASTOR = ['목사','전도사'];
const CL = ['#1a5c3a','#c0392b','#2980b9','#8e44ad','#e67e22','#16a085','#d35400','#27ae60'];

let S = { user:null, members:[], biz:[], bizDB:[], reviews:[], csvParsed:[], likes:[], catFilter:'' };
let prevTab = 'list';
let bizPhotosTemp = [];   // 사업체 등록 임시 사진
let rvPhotosTemp  = [];   // 후기 임시 사진


function formatPhone(input) {
  var v = input.value.replace(/[^0-9]/g,'');
  // 02 (서울) - 2자리 지역코드
  if(v.startsWith('02')){
    if(v.length<=2) input.value=v;
    else if(v.length<=6) input.value='02-'+v.slice(2);
    else if(v.length<=9) input.value='02-'+v.slice(2,5)+'-'+v.slice(5);
    else input.value='02-'+v.slice(2,6)+'-'+v.slice(6,10);
  }
  // 010,011,016,017,018,019 (휴대폰)
  else if(/^01[016789]/.test(v)){
    if(v.length<=3) input.value=v;
    else if(v.length<=7) input.value=v.slice(0,3)+'-'+v.slice(3);
    else input.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7,11);
  }
  // 070 (인터넷전화)
  else if(v.startsWith('070')){
    if(v.length<=3) input.value=v;
    else if(v.length<=7) input.value='070-'+v.slice(3);
    else input.value='070-'+v.slice(3,7)+'-'+v.slice(7,11);
  }
  // 030~099 (3자리 지역번호) → 033-333-3333 형식
  else if(v.length>0){
    if(v.length<=3) input.value=v;
    else if(v.length<=6) input.value=v.slice(0,3)+'-'+v.slice(3);
    else if(v.length<=10) input.value=v.slice(0,3)+'-'+v.slice(3,6)+'-'+v.slice(6,10); // 3-3-4
    else input.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7,11); // 3-4-4 (혹시 모를 경우)
  }
}

function initSelects() {
  ['jChurch','epChurch'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    REGIONS.forEach(function(r){ var o=document.createElement('option'); o.value=o.textContent=r; el.appendChild(o); });
  });
  // catSel/bCat 옵션은 HTML에 하드코딩됨
}

// ── 로딩 ─────────────────────────────────
function showLoading(id, txt) {
  var el=document.getElementById(id);
  if(el) el.innerHTML='<div class="loading"><div class="spinner"></div><div class="loading-text">'+(txt||'불러오는 중...')+'</div></div>';
}
function showSkeletons(id, n) {
  var el=document.getElementById(id); if(!el) return;
  var h='';
  for(var i=0;i<=(n||4)-1;i++){
    h+='<div class="sk-card"><div style="display:flex;gap:11px"><div class="skeleton" style="width:42px;height:42px;border-radius:11px;flex-shrink:0"></div>';
    h+='<div style="flex:1"><div class="skeleton sk-line w70"></div><div class="skeleton sk-line w50"></div><div class="skeleton sk-line w30"></div></div></div>';
    h+='<div style="margin-top:8px"><div class="skeleton sk-line w100"></div></div></div>';
  }
  el.innerHTML=h;
}

// ── 탭 ───────────────────────────────────
function showTab(name, btn) {
  document.querySelectorAll('.sc').forEach(function(s){s.classList.remove('on');});
  document.querySelectorAll('.nb').forEach(function(b){b.classList.remove('on');});
  document.getElementById('sc-'+name).classList.add('on');
  btn.classList.add('on');
  if(name!=='detail') prevTab=name;
  if(name==='list'){ showSkeletons('bizList',4); setTimeout(function(){doFilter();},200); }
  if(name==='rec'){ showSkeletons('recList',4); setTimeout(function(){renderRec();},200); }
  if(name==='map'){ showLoading('mapList','지도 불러오는 중...'); setTimeout(function(){renderMap();},200); }
  if(name==='reviews'){ showLoading('rvListAll','후기 불러오는 중...'); setTimeout(function(){renderAllRv();},200); }
  if(name==='mypage') renderMypage();
  if(name==='admin') renderAdmin();
}

function goBack() {
  document.querySelectorAll('.sc').forEach(function(s){s.classList.remove('on');});
  document.querySelectorAll('.nb').forEach(function(b){b.classList.remove('on');});
  document.getElementById('sc-'+prevTab).classList.add('on');
  document.querySelectorAll('.nb').forEach(function(b){
    if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+prevTab+"'")) b.classList.add('on');
  });
  if(prevTab==='list') doFilter();
  else if(prevTab==='rec') renderRec();
}

// ── 업체 카드 HTML ───────────────────────
function bizCardHtml(b) {
  var rvs = S.reviews.filter(function(r){return r.bizId===b.id;});
  var avg = rvs.length ? Math.round(rvs.reduce(function(s,r){return s+r.stars;},0)/rvs.length*10)/10 : 0;
  var kws = b.kw ? b.kw.split(',').filter(function(k){return k;}).map(function(k){return '<span class="tg">'+k.trim()+'</span>';}).join('') : '';
  var tel  = (b.phone||b.ownerPhone||'').replace(/[^0-9]/g,'');
  var btel = (b.bizPhone||'').replace(/[^0-9]/g,'');
  var liked = isLiked(b.id);
  var typeBadge = b.type==='own'
    ? '<span class="type-badge badge-own">운영</span>'
    : '<span class="type-badge badge-rec">추천</span>';
  var desc = b.desc ? '<div class="biz-desc">'+b.desc+'</div>' : '';
  var cardThumb = (b.photos&&b.photos.length)
    ? '<div class="bi" style="background:none;padding:0;overflow:hidden"><img src="'+b.photos[0]+'" style="width:100%;height:100%;object-fit:cover;border-radius:11px"></div>'
    : '<div class="bi">'+(EM[b.cat]||'🏪')+'</div>';
  // 전화 버튼: 휴대폰(초록) + 일반전화(파랑) 둘 다
  var telBtns='';
  if(tel) telBtns+='<a href="tel:'+tel+'" onclick="event.stopPropagation()" title="휴대폰" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:4px 9px;font-size:11px;cursor:pointer;text-decoration:none;font-weight:600">📱</a>';
  if(btel) telBtns+='<a href="tel:'+btel+'" onclick="event.stopPropagation()" title="일반전화" style="background:#2980b9;color:#fff;border:none;border-radius:8px;padding:4px 9px;font-size:11px;cursor:pointer;text-decoration:none;font-weight:600">📞</a>';
  return '<div class="bc" onclick="showDetail('+b.id+')">'+
    typeBadge+
    '<div class="bh">'+cardThumb+
    '<div style="flex:1">'+
      '<div class="bn">'+b.name+'</div>'+
      '<div class="bct">'+b.cat+'</div>'+
      '<div class="bow">'+(b.ownerChurch||b.church||'')+'교회 '+b.owner+' '+(b.ownerRole||'')+'</div>'+
    '</div></div>'+
    (b.addr ? '<div style="font-size:11px;color:var(--t2);margin-top:6px">📍 '+b.addr+'</div>' : '')+
    (kws ? '<div class="tgs">'+kws+'</div>' : '')+
    desc+
    '<div class="bf">'+
      '<span style="color:var(--ac);font-size:12px">'+('⭐'.repeat(Math.round(avg))||'☆☆☆☆☆')+' <span style="font-size:11px;color:var(--t2)">'+rvs.length+'개 후기</span></span>'+
      '<div style="display:flex;align-items:center;gap:5px">'+
        telBtns+
        '<button id="like-'+b.id+'" class="like-btn'+(liked?' on':'')+'" onclick="toggleLike('+b.id+',event)">'+(liked?'❤️':'🤍')+'</button>'+
      '</div>'+
    '</div></div>';
}

// ── 상세 ─────────────────────────────────
function showDetail(bizId) {
  var b=S.biz.find(function(x){return x.id===bizId;});
  if(!b) return;
  S.curBiz=bizId;
  document.querySelectorAll('.sc').forEach(function(s){s.classList.remove('on');});
  document.getElementById('sc-detail').classList.add('on');
  document.getElementById('det-title').textContent=b.name;
  // 찜 버튼
  var lb=document.getElementById('det-like-btn');
  if(lb){
    lb.textContent=isLiked(b.id)?'❤️':'🤍';
    lb.onclick=function(e){toggleLike(b.id,e);lb.textContent=isLiked(b.id)?'❤️':'🤍';};
  }
  // 수정/삭제 버튼
  var eb=document.getElementById('det-edit-btns');
  if(S.user&&S.user.phone===b.phone){
    eb.innerHTML='<button onclick="openEditBiz('+bizId+')" style="background:rgba(255,255,255,.18);border:none;color:#fff;border-radius:8px;padding:5px 10px;font-size:11px;cursor:pointer;margin-right:4px">수정</button>'+
      '<button onclick="deleteBiz('+bizId+')" style="background:rgba(255,0,0,.25);border:none;color:#fff;border-radius:8px;padding:5px 10px;font-size:11px;cursor:pointer">삭제</button>';
  } else { eb.innerHTML=''; }

  var rvs=sortRv(S.reviews.filter(function(r){return r.bizId===bizId;}));
  var avg=rvs.length?Math.round(rvs.reduce(function(s,r){return s+r.stars;},0)/rvs.length*10)/10:0;
  var kws=b.kw?b.kw.split(',').filter(function(k){return k;}).map(function(k){return '<span class="tg">'+k.trim()+'</span>';}).join(''):'';
  var tel=(b.phone||b.ownerPhone||'').replace(/[^0-9]/g,'');
  var btel=(b.bizPhone||'').replace(/[^0-9]/g,'');
  var tp=b.type==='own'?'<span class="type-badge badge-own" style="position:static;display:inline-block;margin-left:6px">운영</span>':'<span class="type-badge badge-rec" style="position:static;display:inline-block;margin-left:6px">추천</span>';

  var html='<div class="det-card">'+
    '<div style="display:flex;align-items:center;gap:13px;margin-bottom:13px">'+
      '<div style="width:52px;height:52px;border-radius:13px;background:var(--pl);display:flex;align-items:center;justify-content:center;font-size:24px">'+(EM[b.cat]||'🏪')+'</div>'+
      '<div><div style="font-size:17px;font-weight:700">'+b.name+tp+'</div>'+
      '<div style="font-size:12px;color:var(--p);margin-top:3px">'+b.cat+'</div>'+
      '<div style="font-size:12px;color:var(--ac)">'+'⭐'.repeat(Math.round(avg))+(avg?'<span style="color:var(--t2);font-size:11px"> '+avg+'점 ('+rvs.length+'개)</span>':'<span style="color:var(--t2);font-size:11px"> 후기없음</span>')+'</div>'+
    '</div></div>'+
    '<div class="det-row"><span class="dl">담당자</span><span class="dv">'+(b.ownerChurch||b.church||'')+'교회 '+b.owner+' '+(b.ownerRole||'')+'</span></div>'+
    (b.phone?'<div class="det-row"><span class="dl">휴대폰</span><span class="dv"><a href="tel:'+(b.phone||b.ownerPhone||'').replace(/[^0-9]/g,'')+'" style="color:var(--p)">'+(b.phone||b.ownerPhone||'')+'</a></span></div>':'')+
    (b.bizPhone?'<div class="det-row"><span class="dl">사업체 전화</span><span class="dv"><a href="tel:'+btel+'" style="color:#2980b9">'+b.bizPhone+'</a></span></div>':'')+
    (b.addr?'<div class="det-row"><span class="dl">주소</span><span class="dv">'+b.addr+'</span></div>':'')+
    (b.regNo?'<div class="det-row"><span class="dl">사업자번호</span><span class="dv">'+b.regNo+'</span></div>':'')+
    (b.web?'<div class="det-row"><span class="dl">홈페이지</span><a href="'+b.web+'" target="_blank" style="font-size:12px;color:#185fa5;text-align:right;word-break:break-all">'+b.web+'</a></div>':'')+
    (kws?'<div style="margin-top:9px;display:flex;gap:4px;flex-wrap:wrap">'+kws+'</div>':'')+
    (b.desc?'<div style="margin-top:10px;font-size:12px;color:var(--t2);line-height:1.7;white-space:pre-line;padding-top:10px;border-top:1px solid var(--bd)">'+b.desc+'</div>':'')+
  '</div>';

  // 전화걸기 버튼 (휴대폰 + 일반전화 나란히)
  if(tel||btel){
    if(tel&&btel){
      html+='<div style="display:flex;gap:8px;margin-bottom:10px">'+
        '<a class="call-btn" href="tel:'+tel+'" style="flex:1;margin-bottom:0">📱 휴대폰</a>'+
        '<a class="call-btn" href="tel:'+btel+'" style="flex:1;margin-bottom:0;background:#2980b9">📞 사업체</a>'+
      '</div>';
    } else {
      html+='<a class="call-btn" href="tel:'+(tel||btel)+'">'+(tel?'📱 휴대폰':'📞 사업체 전화')+'</a>';
    }
  }

  html+='<div style="font-size:13px;font-weight:600;color:var(--t2);margin:4px 0 9px">후기 '+rvs.length+'개</div>'+
    (rvs.length?rvs.map(function(r){return rvHtml(r,true);}).join(''):'<div class="empty">아직 후기가 없어요</div>')+
    '<button onclick="openReviewFromDetail('+bizId+')" style="width:100%;padding:11px;background:var(--pl);color:var(--p);border:1px solid var(--bd);border-radius:11px;font-size:13px;cursor:pointer;margin-top:5px;font-weight:600">✏️ 후기 작성하기</button>';

  document.getElementById('det-body').innerHTML=html;
  // 사진 갤러리
  if(b.photos&&b.photos.length){
    var gal=document.createElement('div');
    gal.className='det-gallery';
    b.photos.forEach(function(src){
      var img=document.createElement('img');img.src=src;
      img.onclick=function(){openViewer(src);};
      gal.appendChild(img);
    });
    document.getElementById('det-body').insertBefore(gal,document.getElementById('det-body').firstChild);
  }
}

// ── 후기 ────────────────────────────────
function isPastor(r){return PASTOR.includes(r);}
function sortRv(rvs){
  return rvs.slice().sort(function(a,b){
    var ap=isPastor(a.role)?1:0,bp=isPastor(b.role)?1:0;
    return ap!==bp?bp-ap:new Date(b.date)-new Date(a.date);
  });
}
function rvHtml(r,showDel){
  var p=isPastor(r.role);
  var del=(showDel&&S.user&&S.user.name===r.reviewer)?'<button class="del-btn" onclick="deleteReview('+r.id+')">삭제</button>':'';
  return '<div class="rv'+(p?' ppick':'')+'" id="rv-'+r.id+'">'+
    '<div class="rv-hd">'+
      '<div class="av'+(p?' av-p':'')+'">'+r.reviewer[0]+'</div>'+
      '<div style="flex:1"><div class="rn">'+(p?'★ ':'')+r.reviewer+(p?'<span class="badge-p">'+r.role+'님 추천</span>':'')+'</div>'+
      '<div style="font-size:11px;color:var(--t2)">'+r.bizName+'</div></div>'+
      '<div style="display:flex;align-items:center;gap:4px"><span style="font-size:13px;color:var(--ac)">'+'⭐'.repeat(r.stars)+'</span>'+del+'</div>'+
    '</div><div class="rt">'+r.text+'</div>'+
    (r.photos&&r.photos.length?'<div class="rv-photos">'+r.photos.map(function(src){return '<img src="'+src+'" onclick="openViewer(\''+src+'\')">'; }).join('')+'</div>':'')+
    '<div class="rd">'+r.date+'</div></div>';
}
function deleteReview(id){
  if(!confirm('후기를 삭제하시겠어요?')) return;
  S.reviews=S.reviews.filter(function(r){return r.id!==id;});
  var el=document.getElementById('rv-'+id); if(el) el.remove();
}

// ── 찜 ──────────────────────────────────
function isLiked(bizId){
  if(!S.user) return false;
  return S.likes.indexOf(S.user.phone+'_'+bizId)>=0;
}
function toggleLike(bizId,e){
  if(e) e.stopPropagation();
  if(!S.user){openM('choiceM');return;}
  var key=S.user.phone+'_'+bizId;
  var idx=S.likes.indexOf(key);
  if(idx>=0) S.likes.splice(idx,1); else S.likes.push(key);
  var btn=document.getElementById('like-'+bizId);
  if(btn){btn.textContent=isLiked(bizId)?'❤️':'🤍';}
}
function getLikedBiz(){
  if(!S.user) return [];
  return S.biz.filter(function(b){return S.likes.indexOf(S.user.phone+'_'+b.id)>=0;});
}

// ── 필터/렌더 ────────────────────────────
function doFilter(){
  var kw=document.getElementById('kwInput').value.trim().toLowerCase();
  var cat=document.getElementById('catSel').value;
  var region=document.getElementById('regionInput').value.trim().toLowerCase();
  var list=S.biz.filter(function(b){
    var mk=!kw||(b.name.toLowerCase().includes(kw)||(b.kw||'').toLowerCase().includes(kw)||(b.addr||'').toLowerCase().includes(kw)||(b.desc||'').toLowerCase().includes(kw)||(b.owner||'').toLowerCase().includes(kw)||(b.cat||'').toLowerCase().includes(kw));
    var mr=!region||((b.addr||'').toLowerCase().includes(region)||(b.ownerChurch||'').toLowerCase().includes(region));
    return mk&&mr&&(!cat||b.cat===cat);
  });
  list.sort(function(a,b){return (a.name||'').localeCompare(b.name||'','ko');});
  document.getElementById('bizList').innerHTML=list.length?list.map(bizCardHtml).join(''):'<div class="empty">검색 결과가 없어요<br><small style="font-size:11px">키워드·업종·지역을 변경해보세요</small></div>';
  var chips='';
  if(kw) chips+='<div class="chip">🔍 "'+kw+'" <span class="cx" onclick="clKw()">×</span></div>';
  if(cat) chips+='<div class="chip">📂 '+cat+' <span class="cx" onclick="clCat()">×</span></div>';
  if(region) chips+='<div class="chip">📍 '+region+' <span class="cx" onclick="clReg()">×</span></div>';
  document.getElementById('chips').innerHTML=chips;
}
function clKw(){document.getElementById('kwInput').value='';doFilter();}
function clCat(){document.getElementById('catSel').value='';doFilter();}
function clReg(){document.getElementById('regionInput').value='';doFilter();}
function clearAll(){document.getElementById('kwInput').value='';document.getElementById('catSel').value='';document.getElementById('regionInput').value='';doFilter();}

function renderRec(){
  var list=S.biz.filter(function(b){return b.type==='rec';});
  document.getElementById('recList').innerHTML=list.length?list.map(bizCardHtml).join(''):'<div class="empty">추천 사업체가 없어요<br><small>사업체 등록 시 "추천 사업체"로 등록해주세요</small></div>';
}

function renderMap(){
  var CLS=['#1a5c3a','#c0392b','#2980b9','#8e44ad','#e67e22','#16a085','#d35400','#27ae60'];
  document.getElementById('mapPins').innerHTML=S.biz.slice(0,20).map(function(b,i){
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px"><div style="width:11px;height:11px;border-radius:50%;background:'+CLS[i%CLS.length]+';border:2px solid #fff"></div><div style="font-size:10px;color:var(--t2)">'+b.name+'</div></div>';
  }).join('');
  document.getElementById('mapList').innerHTML=S.biz.slice(0,30).map(function(b,i){
    var tel=(b.phone||b.ownerPhone||'').replace(/[^0-9]/g,'');
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--bd);border-radius:12px;margin-bottom:7px;cursor:pointer" onclick="showDetail('+b.id+')">'+
      '<div style="width:9px;height:9px;border-radius:50%;background:'+CLS[i%CLS.length]+';flex-shrink:0"></div>'+
      '<div style="flex:1"><div style="font-size:13px;font-weight:600">'+b.name+'</div>'+
      '<div style="font-size:11px;color:var(--t2)">'+(b.addr||b.region||'')+'</div></div>'+
      (tel?'<a href="tel:'+tel+'" onclick="event.stopPropagation()" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:4px 10px;font-size:11px;text-decoration:none">📞</a>':'')+
    '</div>';
  }).join('');
}

function renderAllRv(){
  var sorted=sortRv(S.reviews.slice());
  document.getElementById('rvListAll').innerHTML=sorted.length?sorted.map(function(r){return rvHtml(r,false);}).join(''):'<div class="empty">아직 후기가 없어요</div>';
}

// ── 마이페이지 ───────────────────────────
function renderMypage(){
  var el=document.getElementById('mypageContent');
  if(!S.user){
    el.innerHTML='<div class="gate"><div style="font-size:32px;margin-bottom:10px">👤</div><div style="font-size:16px;font-weight:700;margin-bottom:7px">로그인이 필요해요</div><div style="font-size:12px;color:var(--t2);line-height:1.8;margin-bottom:18px">성도 비즈니스 네트워크의<br>모든 기능을 이용하려면 로그인해주세요</div><button class="bp" style="max-width:200px;margin:0 auto" onclick="openM(\'choiceM\')">로그인 / 회원가입</button></div>';
    return;
  }
  var myBiz=S.biz.filter(function(b){
    var up=(S.user.phone||'').replace(/[^0-9]/g,'');
    var bp=(b.phone||'').replace(/[^0-9]/g,'');
    var bop=(b.ownerPhone||'').replace(/[^0-9]/g,'');
    return (bp&&bp===up)||(bop&&bop===up)||(b.ownerName===S.user.name&&(bp===up||bop===up||(!bp&&!bop)));
  });
  var myRvs=S.reviews.filter(function(r){return r.reviewer===S.user.name;});
  var liked=getLikedBiz();
  var warn=S.user.pw==='1111'?'<div class="pw-warn">⚠️ 초기 비밀번호(1111) 사용 중 <button onclick="openM(\'changePwM\')" style="background:var(--p);color:#fff;border:none;border-radius:8px;padding:3px 10px;font-size:11px;cursor:pointer;margin-left:6px">변경하기</button></div>':'';
  var html=warn+
    '<div class="pc"><div class="prow">'+
      '<div class="pav">'+S.user.name[0]+'</div>'+
      '<div style="flex:1"><div style="font-size:16px;font-weight:700">'+S.user.name+'</div><div style="font-size:12px;color:var(--t2);margin-top:3px">'+S.user.role+' · 사랑하는교회 '+S.user.church+'</div></div>'+
      '<div style="display:flex;gap:5px">'+
        '<button onclick="loadEdit();openM(\'editM\')" style="padding:5px 10px;background:var(--p);color:#fff;border:none;border-radius:10px;font-size:11px;cursor:pointer;font-weight:600">편집</button>'+
        '<button onclick="openM(\'changePwM\')" style="padding:5px 10px;background:var(--ac);color:#fff;border:none;border-radius:10px;font-size:11px;cursor:pointer;font-weight:600">🔑</button>'+
      '</div></div>'+
      '<div class="pgrid">'+
        '<div class="pi"><div class="pl2">전화번호</div><div class="pv">'+S.user.phone+'</div></div>'+
        '<div class="pi"><div class="pl2">등록교회</div><div class="pv">'+S.user.church+'</div></div>'+
        (S.user.no?'<div class="pi"><div class="pl2">교번</div><div class="pv">'+S.user.no+'</div></div>':'')+
        '<div class="pi"><div class="pl2">직분</div><div class="pv">'+S.user.role+'</div></div>'+
      '</div></div>'+
    '<div style="font-size:13px;font-weight:600;color:var(--t2);margin-bottom:9px">내 사업체 ('+myBiz.length+'개)</div>'+
    (myBiz.length?myBiz.map(function(b){
      return '<div class="bc" onclick="showDetail('+b.id+')">'+
        '<div class="bh"><div class="bi">'+(EM[b.cat]||'🏪')+'</div>'+
        '<div style="flex:1"><div class="bn">'+b.name+'</div><div class="bct">'+b.cat+'</div></div>'+
        '<button onclick="event.stopPropagation();openEditBiz('+b.id+')" style="padding:5px 10px;background:var(--pl);color:var(--p);border:1px solid var(--p);border-radius:8px;font-size:11px;cursor:pointer;flex-shrink:0">수정</button>'+
      '</div></div>';
    }).join(''):'<div class="empty" style="padding:10px">등록된 사업체 없음</div>')+
    '<div style="display:flex;gap:8px;margin-top:8px;margin-bottom:4px">'+
      '<button onclick="openAddBiz(\'own\')" style="flex:1;padding:10px;background:var(--pl);color:var(--p);border:1.5px solid var(--p);border-radius:11px;font-size:12px;cursor:pointer;font-weight:600">🏪 운영업체 추가</button>'+
      '<button onclick="openAddBiz(\'rec\')" style="flex:1;padding:10px;background:#fee2e2;color:#dc2626;border:1.5px solid #dc2626;border-radius:11px;font-size:12px;cursor:pointer;font-weight:600">⭐ 추천업체 추가</button>'+
    '</div>'+
    '<div style="font-size:13px;font-weight:600;color:var(--t2);margin:13px 0 9px">❤️ 찜한 사업체 ('+liked.length+'개)</div>'+
    (liked.length?liked.map(function(b){return '<div class="bc" onclick="showDetail('+b.id+')"><div class="bh"><div class="bi">'+(EM[b.cat]||'🏪')+'</div><div style="flex:1"><div class="bn">'+b.name+'</div><div class="bct">'+b.cat+'</div></div></div></div>';}).join(''):'<div class="empty" style="padding:10px">찜한 사업체 없음</div>')+
    '<div style="font-size:13px;font-weight:600;color:var(--t2);margin:13px 0 9px">내 후기 ('+myRvs.length+'개)</div>'+
    (myRvs.length?myRvs.map(function(r){return rvHtml(r,true);}).join(''):'<div class="empty" style="padding:13px">작성한 후기 없음</div>')+
    '<a href="https://open.kakao.com/o/sf0Mu1si" target="_blank" style="display:block;width:100%;padding:10px;background:#FAE100;color:#3A1D1D;border-radius:11px;font-size:13px;font-weight:700;text-align:center;text-decoration:none;box-sizing:border-box;margin-top:10px">💬 카카오 오픈채팅으로 문의하기</a>'+
    '<button onclick="doLogout()" style="width:100%;padding:10px;background:transparent;color:#a32d2d;border:1.5px solid #a32d2d;border-radius:11px;font-size:13px;cursor:pointer;margin-top:8px;font-weight:500">로그아웃</button>';
  el.innerHTML=html;
}

// ── 관리자 ───────────────────────────────
var adminSection='stats';
function isAdmin(){return S.user&&S.user.phone==='010-8388-0848';}
function checkAdminTab(){
  var t=document.getElementById('adminTab');
  if(t) t.style.display=isAdmin()?'block':'none';
}

function renderAdmin(){
  if(!isAdmin()){document.getElementById('adminContent').innerHTML='<div class="empty">관리자 권한이 없습니다</div>';return;}
  var el=document.getElementById('adminContent');
  var secs=[['stats','📊 통계'],['members','👥 회원'],['biz','🏪 사업체'],['reviews','💬 후기'],['csv','📥 업로드'],['backup','💾 백업']];
  var tabs='<div class="admin-tab">';
  secs.forEach(function(s){
    tabs+='<button class="at'+(adminSection===s[0]?' on':'')+'" onclick="adminSection=\''+s[0]+'\';renderAdmin()">'+s[1]+'</button>';
  });
  tabs+='</div>';

  var body='';
  if(adminSection==='stats'){
    body+='<div class="stat-grid">'+
      '<div class="stat-card"><div class="stat-num">'+S.members.length+'</div><div class="stat-label">전체 회원</div></div>'+
      '<div class="stat-card"><div class="stat-num">'+S.biz.length+'</div><div class="stat-label">등록 사업체</div></div>'+
      '<div class="stat-card"><div class="stat-num">'+S.reviews.length+'</div><div class="stat-label">전체 후기</div></div>'+
      '<div class="stat-card"><div class="stat-num">'+S.likes.length+'</div><div class="stat-label">찜 횟수</div></div>'+
    '</div>';
    body+='<div style="font-size:13px;font-weight:600;color:var(--t2);margin-bottom:9px">업종별 사업체</div>';
    var cc={};
    S.biz.forEach(function(b){cc[b.cat]=(cc[b.cat]||0)+1;});
    Object.entries(cc).sort(function(a,b){return b[1]-a[1];}).forEach(function(e){
      body+='<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--bd);border-radius:10px;margin-bottom:6px">'+
        '<span style="font-size:16px">'+(EM[e[0]]||'📌')+'</span>'+
        '<span style="flex:1;font-size:13px;font-weight:500">'+e[0]+'</span>'+
        '<span style="font-size:13px;font-weight:700;color:var(--p)">'+e[1]+'개</span></div>';
    });
  } else if(adminSection==='members'){
    var mKw=(window.adminMemberKw||'').toLowerCase();
    var mSort=window.adminMemberSort||'name-asc';
    var mList=S.members.filter(function(m){
      return !mKw||(m.name||'').toLowerCase().includes(mKw)||(m.phone||'').includes(mKw)||(m.church||'').toLowerCase().includes(mKw)||(m.role||'').includes(mKw);
    });
    if(mSort==='name-asc') mList.sort(function(a,b){return (a.name||'').localeCompare(b.name||'','ko');});
    else if(mSort==='name-desc') mList.sort(function(a,b){return (b.name||'').localeCompare(a.name||'','ko');});
    else if(mSort==='church-asc') mList.sort(function(a,b){return (a.church||'').localeCompare(b.church||'','ko');});
    else if(mSort==='church-desc') mList.sort(function(a,b){return (b.church||'').localeCompare(a.church||'','ko');});
    body='<div style="display:flex;gap:6px;margin-bottom:10px">'+
      '<input id="adminMemberKwInput" class="fi" placeholder="이름,전화,교회 검색..." value="'+(mKw||'')+'" oninput="window.adminMemberKw=this.value;renderAdmin()" style="flex:1;padding:7px 10px;font-size:12px">'+
      '<select onchange="window.adminMemberSort=this.value;renderAdmin()" style="padding:7px;border:1px solid var(--bd);border-radius:8px;font-size:11px">'+
        '<option value="name-asc"'+(mSort==='name-asc'?' selected':'')+'>이름 ↑</option>'+
        '<option value="name-desc"'+(mSort==='name-desc'?' selected':'')+'>이름 ↓</option>'+
        '<option value="church-asc"'+(mSort==='church-asc'?' selected':'')+'>교회 ↑</option>'+
        '<option value="church-desc"'+(mSort==='church-desc'?' selected':'')+'>교회 ↓</option>'+
      '</select>'+
    '</div>'+
    '<div style="font-size:12px;color:var(--t2);margin-bottom:8px">총 '+mList.length+'명 / 전체 '+S.members.length+'명</div>';
    mList.forEach(function(m){
      body+='<div class="admin-row"><div class="admin-row-info"><div class="admin-row-name">'+m.name+' <span style="font-size:11px;color:var(--t2)">'+m.role+'</span></div><div class="admin-row-sub">'+m.church+'교회 · '+m.phone+'</div></div>'+
        '<button class="admin-del" onclick="adminDelMember(\''+m.phone+'\')">삭제</button></div>';
    });
  } else if(adminSection==='biz'){
    var bKw=(window.adminBizKw||'').toLowerCase();
    var bSort=window.adminBizSort||'name-asc';
    var bList=S.biz.filter(function(b){
      return !bKw||(b.name||'').toLowerCase().includes(bKw)||(b.cat||'').toLowerCase().includes(bKw)||(b.owner||'').toLowerCase().includes(bKw)||(b.addr||'').toLowerCase().includes(bKw);
    });
    if(bSort==='name-asc') bList.sort(function(a,b){return (a.name||'').localeCompare(b.name||'','ko');});
    else if(bSort==='name-desc') bList.sort(function(a,b){return (b.name||'').localeCompare(a.name||'','ko');});
    else if(bSort==='cat-asc') bList.sort(function(a,b){return (a.cat||'').localeCompare(b.cat||'','ko');});
    else if(bSort==='cat-desc') bList.sort(function(a,b){return (b.cat||'').localeCompare(a.cat||'','ko');});
    body='<div style="display:flex;gap:6px;margin-bottom:10px">'+
      '<input id="adminBizKwInput" class="fi" placeholder="업체명,업종,담당자 검색..." value="'+(bKw||'')+'" oninput="window.adminBizKw=this.value;renderAdmin()" style="flex:1;padding:7px 10px;font-size:12px">'+
      '<select onchange="window.adminBizSort=this.value;renderAdmin()" style="padding:7px;border:1px solid var(--bd);border-radius:8px;font-size:11px">'+
        '<option value="name-asc"'+(bSort==='name-asc'?' selected':'')+'>이름 ↑</option>'+
        '<option value="name-desc"'+(bSort==='name-desc'?' selected':'')+'>이름 ↓</option>'+
        '<option value="cat-asc"'+(bSort==='cat-asc'?' selected':'')+'>업종 ↑</option>'+
        '<option value="cat-desc"'+(bSort==='cat-desc'?' selected':'')+'>업종 ↓</option>'+
      '</select>'+
    '</div>'+
    '<div style="font-size:12px;color:var(--t2);margin-bottom:8px">총 '+bList.length+'개 / 전체 '+S.biz.length+'개</div>';
    bList.forEach(function(b){
      body+='<div class="admin-row"><div style="font-size:18px;margin-right:4px">'+(EM[b.cat]||'🏪')+'</div>'+
        '<div class="admin-row-info"><div class="admin-row-name">'+b.name+' <span style="font-size:10px;color:var(--p)">'+b.cat+'</span></div><div class="admin-row-sub">'+b.owner+' · '+(b.addr||b.region||'')+'</div></div>'+
        '<button class="admin-del" onclick="adminDelBiz('+b.id+')">삭제</button></div>';
    });
  } else if(adminSection==='reviews'){
    var sorted=sortRv(S.reviews.slice());
    body='<div style="font-size:12px;color:var(--t2);margin-bottom:10px">총 '+sorted.length+'개</div>';
    sorted.forEach(function(r){
      body+='<div class="admin-row" style="align-items:flex-start"><div class="admin-row-info">'+
        '<div class="admin-row-name">'+r.reviewer+' → '+r.bizName+' '+'⭐'.repeat(r.stars)+'</div>'+
        '<div class="admin-row-sub" style="margin-top:4px;line-height:1.5">'+r.text+'</div></div>'+
        '<button class="admin-del" onclick="adminDelReview('+r.id+')">삭제</button></div>';
    });
  } else if(adminSection==='csv'){
    body='<p style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.7">CSV 파일로 회원과 사업체를 일괄 등록할 수 있어요.</p>'+
      '<button class="bp" onclick="closeM(\'skip\');openM(\'csvM\')">📥 CSV 업로드 열기</button>';
  } else if(adminSection==='backup'){
    var now=new Date().toLocaleDateString('ko-KR');
    body='<p style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.7">현재 앱의 모든 데이터(회원·사업체·후기)를 JSON 파일로 백업하거나 복원할 수 있어요.</p>'+
      '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:12px">'+
        '<div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:10px">📊 현재 데이터 현황</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
          '<div style="background:#fff;border:1px solid var(--bd);border-radius:8px;padding:10px;text-align:center">'+
            '<div style="font-size:20px;font-weight:700;color:var(--p)">'+S.members.length+'</div>'+
            '<div style="font-size:11px;color:var(--t2)">회원</div></div>'+
          '<div style="background:#fff;border:1px solid var(--bd);border-radius:8px;padding:10px;text-align:center">'+
            '<div style="font-size:20px;font-weight:700;color:var(--p)">'+S.biz.length+'</div>'+
            '<div style="font-size:11px;color:var(--t2)">사업체</div></div>'+
          '<div style="background:#fff;border:1px solid var(--bd);border-radius:8px;padding:10px;text-align:center">'+
            '<div style="font-size:20px;font-weight:700;color:var(--p)">'+S.reviews.length+'</div>'+
            '<div style="font-size:11px;color:var(--t2)">후기</div></div>'+
          '<div style="background:#fff;border:1px solid var(--bd);border-radius:8px;padding:10px;text-align:center">'+
            '<div style="font-size:20px;font-weight:700;color:var(--p)">'+S.likes.length+'</div>'+
            '<div style="font-size:11px;color:var(--t2)">찜</div></div>'+
        '</div>'+
      '</div>'+
      '<button class="bp" onclick="doBackup()" style="margin-bottom:8px">💾 JSON 백업 파일 다운로드</button>'+
      '<div style="font-size:11px;color:var(--t2);text-align:center;margin-bottom:16px">백업일: '+now+'</div>'+
      '<div style="border-top:1px solid var(--bd);padding-top:14px">'+
        '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--t)">📂 백업 파일에서 복원</div>'+
        '<p style="font-size:11px;color:#a32d2d;margin-bottom:10px;line-height:1.6">⚠️ 복원 시 현재 데이터에 병합됩니다. 중복 데이터는 건너뜁니다.</p>'+
        '<label style="display:block;background:var(--bg2);border:2px dashed var(--bd);border-radius:10px;padding:14px;text-align:center;cursor:pointer;font-size:12px;color:var(--t2)">'+
          '📁 백업 파일 선택 (.json)<input type="file" accept=".json" style="display:none" onchange="doRestore(this.files[0])">'+
        '</label>'+
      '</div>';
  }
  el.innerHTML=tabs+body;
}

function adminDelMember(phone){if(!confirm('회원을 삭제하시겠어요?'))return;S.members=S.members.filter(function(m){return m.phone!==phone;});renderAdmin();}
function adminDelBiz(id){if(!confirm('사업체를 삭제하시겠어요?'))return;S.biz=S.biz.filter(function(b){return b.id!==id;});renderAdmin();doFilter();}
function adminDelReview(id){if(!confirm('후기를 삭제하시겠어요?'))return;S.reviews=S.reviews.filter(function(r){return r.id!==id;});renderAdmin();}

function doBackup(){
  var data={
    version:1,
    date:new Date().toISOString(),
    members:S.members,
    biz:S.biz,
    bizDB:S.bizDB,
    reviews:S.reviews,
    likes:S.likes
  };
  var json=JSON.stringify(data,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  var d=new Date();
  var ds=d.getFullYear()+''+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  a.href=url;a.download='사랑하는교회_백업_'+ds+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert('백업 파일이 다운로드되었습니다!');
}
function doRestore(file){
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data.version||!data.members){alert('올바른 백업 파일이 아닙니다');return;}
      if(!confirm('백업 데이터를 복원하시겠어요?\n회원 '+data.members.length+'명, 사업체 '+data.biz.length+'개, 후기 '+data.reviews.length+'개\n\n현재 데이터와 병합됩니다.'))return;
      // 병합 (중복 제외)
      var added={m:0,b:0,r:0};
      data.members.forEach(function(m){
        if(!S.members.find(function(x){return x.phone===m.phone;})){S.members.push(m);added.m++;}
      });
      (data.biz||[]).forEach(function(b){
        if(!S.biz.find(function(x){return x.id===b.id;})){S.biz.push(b);added.b++;}
      });
      (data.bizDB||[]).forEach(function(b){
        if(!S.bizDB.find(function(x){return x.id===b.id;})){S.bizDB.push(b);}
      });
      (data.reviews||[]).forEach(function(r){
        if(!S.reviews.find(function(x){return x.id===r.id;})){S.reviews.push(r);added.r++;}
      });
      renderAdmin();doFilter();
      alert('복원 완료!\n회원 '+added.m+'명, 사업체 '+added.b+'개, 후기 '+added.r+'개 추가되었습니다.');
    }catch(err){alert('파일을 읽을 수 없어요: '+err);}
  };
  reader.readAsText(file,'UTF-8');
}

// ── 회원가입/로그인 ──────────────────────
function onHdBtn(){S.user?(loadEdit(),openM('editM')):openM('choiceM');}

function checkBizMatch(){
  var name=document.getElementById('jName').value.trim();
  var phone=document.getElementById('jPhone').value.trim();
  var mb=document.getElementById('matchBox');
  var ml=document.getElementById('matchList');
  if(!name||phone.length<=8){mb.style.display='none';return;}
  var np=phone.replace(/[^0-9]/g,'');
  var matches=S.bizDB.filter(function(b){
    var bp=(b.ownerPhone||b.phone||'').replace(/[^0-9]/g,'');
    return b.ownerName===name&&bp===np;
  });
  if(!matches.length){mb.style.display='none';return;}
  ml.innerHTML=matches.map(function(b){
    return '<div class="match-item"><div><div style="font-size:13px;font-weight:600">'+b.name+'</div><div style="font-size:11px;color:var(--t2)">'+b.cat+'</div></div></div>';
  }).join('');
  mb.style.display='block';
}

// ── 약관 동의 ──────────────────────────
var TERMS_TEXT = {
  use: {
    title: '이용약관',
    content: '제1조 (목적)\n본 약관은 사랑하는교회 성도 비즈니스 네트워크(이하 "서비스")의 이용 조건 및 절차, 이용자와 운영자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.\n\n제2조 (서비스 이용)\n본 서비스는 사랑하는교회 성도를 대상으로 하며, 성도 간 사업체 정보를 공유하고 소개하는 플랫폼입니다.\n\n제3조 (회원의 의무)\n회원은 허위 정보를 등록하거나 타인의 정보를 도용해서는 안 됩니다. 사업체 정보는 실제 운영 중이거나 추천할 수 있는 업체만 등록할 수 있습니다.\n\n제4조 (서비스 제한)\n운영자는 서비스의 원활한 운영을 위해 사전 고지 없이 서비스 내용을 변경하거나 중단할 수 있습니다.\n\n제5조 (면책)\n서비스를 통해 이루어진 성도 간 거래에 대해 교회 및 운영자는 책임을 지지 않습니다.'
  },
  privacy: {
    title: '개인정보 수집·이용 동의',
    content: '수집 항목\n· 필수: 이름, 전화번호, 소속 교회, 직분\n· 선택: 교번, 사업체 정보\n\n수집 목적\n· 성도 인증 및 회원 관리\n· 사업체 정보 연동 및 표시\n· 서비스 이용 내역 관리\n\n보유 기간\n· 회원 탈퇴 시 즉시 삭제\n· 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관\n\n제3자 제공\n수집된 개인정보는 외부에 제공되지 않으며, 서비스 운영 목적 내에서만 사용됩니다.'
  },
  marketing: {
    title: '마케팅·알림 수신 동의',
    content: '수신 동의 항목\n· 새로운 성도 사업체 등록 알림\n· 교회 행사 및 공지사항\n· 서비스 업데이트 안내\n\n수신 방법\n· 문자(SMS), 카카오톡 알림\n\n동의 철회\n본 동의는 선택사항으로, 동의하지 않으셔도 서비스 이용에 불이익이 없습니다. 수신 동의 후에도 마이페이지에서 언제든 철회하실 수 있습니다.'
  }
};
function toggleTerm(id){
  var el=document.getElementById(id);
  el.classList.toggle('on');
  syncAllTerms();
}
function toggleAllTerms(){
  var allOn=['tc-1','tc-2','tc-3','tc-4'].every(function(id){return document.getElementById(id).classList.contains('on');});
  ['tc-1','tc-2','tc-3','tc-4'].forEach(function(id){
    var el=document.getElementById(id);
    if(allOn) el.classList.remove('on'); else el.classList.add('on');
  });
  syncAllTerms();
}
function syncAllTerms(){
  var allOn=['tc-1','tc-2','tc-3','tc-4'].every(function(id){return document.getElementById(id).classList.contains('on');});
  var allEl=document.getElementById('tc-all');
  if(allEl) allOn?allEl.classList.add('on'):allEl.classList.remove('on');
}
function resetTerms(){
  ['tc-all','tc-1','tc-2','tc-3','tc-4'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.classList.remove('on');
  });
}
function openTermsView(type){
  var t=TERMS_TEXT[type];
  document.getElementById('termsViewTitle').textContent=t.title;
  document.getElementById('termsViewContent').textContent=t.content;
  openM('termsViewM');
}
function doJoin(){
  var name=document.getElementById('jName').value.trim();
  var phone=document.getElementById('jPhone').value.trim();
  var pw=document.getElementById('jPw').value;
  var church=document.getElementById('jChurch').value;
  var role=document.getElementById('jRole').value;
  var no=document.getElementById('jNo').value.trim();
  var err=document.getElementById('joinErr');
  if(!name||!phone||!pw||!church||!role){err.textContent='필수 항목을 모두 입력해주세요';err.style.display='block';return;}
  if(pw.length<=5){err.textContent='비밀번호는 6자 이상이어야 해요';err.style.display='block';return;}
  // 필수 약관 확인 (tc-1: 이용약관, tc-2: 개인정보, tc-4: 14세 이상)
  if(!document.getElementById('tc-1').classList.contains('on')){err.textContent='이용약관에 동의해주세요';err.style.display='block';return;}
  if(!document.getElementById('tc-2').classList.contains('on')){err.textContent='개인정보 수집·이용에 동의해주세요';err.style.display='block';return;}
  if(!document.getElementById('tc-4').classList.contains('on')){err.textContent='만 14세 이상 확인에 동의해주세요';err.style.display='block';return;}
  if(S.members.find(function(m){return m.phone===phone;})){err.textContent='이미 가입된 전화번호입니다';err.style.display='block';return;}
  err.style.display='none';
  var m={name:name,phone:phone,pw:pw,church:church,role:role,no:no};
  S.members.push(m); S.user=m;
  document.getElementById('loginBtn').textContent=name+' '+role;
  checkAdminTab();
  var np=phone.replace(/[^0-9]/g,'');
  var matched=S.bizDB.filter(function(b){
    var bp=(b.ownerPhone||b.phone||'').replace(/[^0-9]/g,'');
    return b.ownerName===name&&bp===np;
  });
  var linked=0;
  matched.forEach(function(b){
    if(!S.biz.find(function(x){return x.id===b.id;})){
      b.phone=phone;b.ownerRole=role;b.ownerChurch=church;b.type='own';
      S.biz.push(b);linked++;
    } else {
      var ex=S.biz.find(function(x){return x.id===b.id;});
      ex.phone=phone;ex.ownerRole=role;ex.ownerChurch=church;ex.type='own';
    }
  });
  closeM('joinM');
  resetTerms();
  saveToFirebase();
  saveToFirebase();
  var msg='가입 완료! '+name+' '+role+'님 환영합니다!';
  if(linked>0) msg+='\n\n🏪 사업체 '+linked+'개가 자동으로 연결되었습니다!';
  alert(msg);
  renderMypage(); doFilter();
}

function doLogin(){
  var phone=document.getElementById('lPhone').value.trim();
  var pw=document.getElementById('lPw').value;
  var err=document.getElementById('loginErr');
  if(!phone||!pw){err.textContent='전화번호와 비밀번호를 입력해주세요';err.style.display='block';return;}
  err.textContent='확인 중...';err.style.display='block';
  loadFromFirebase().then(function(){
    var m=S.members.find(function(x){return x.phone===phone&&x.pw===pw;});
    if(!m){err.textContent='전화번호 또는 비밀번호가 맞지 않아요';err.style.display='block';return;}
    err.style.display='none';S.user=m;
    try{localStorage.setItem('savedLogin',JSON.stringify({phone:phone,pw:pw}));}catch(e){}
    document.getElementById('loginBtn').textContent=m.name+' '+m.role;
    checkAdminTab();closeM('loginM');renderMypage();doFilter();
  });
}

function loadEdit(){
  if(!S.user) return;
  document.getElementById('epName').value=S.user.name;
  document.getElementById('epPhone').value=S.user.phone;
  document.getElementById('epChurch').value=S.user.church;
  document.getElementById('epRole').value=S.user.role;
  document.getElementById('epNo').value=S.user.no||'';
}
function saveProfile(){
  var name=document.getElementById('epName').value.trim();
  if(!name){alert('이름은 필수입니다');return;}
  S.user.name=name;S.user.phone=document.getElementById('epPhone').value.trim();
  S.user.church=document.getElementById('epChurch').value;S.user.role=document.getElementById('epRole').value;
  S.user.no=document.getElementById('epNo').value.trim();
  document.getElementById('loginBtn').textContent=name+' '+S.user.role;
  closeM('editM');renderMypage();alert('저장되었습니다');
}
function doChangePw(){
  var old=document.getElementById('cpOld').value;
  var n1=document.getElementById('cpNew').value;
  var n2=document.getElementById('cpNew2').value;
  var err=document.getElementById('cpErr');
  if(!old||!n1||!n2){err.textContent='모든 항목을 입력해주세요';err.style.display='block';return;}
  if(S.user.pw!==old){err.textContent='현재 비밀번호가 맞지 않아요';err.style.display='block';return;}
  if(n1.length<=5){err.textContent='새 비밀번호는 6자 이상이어야 해요';err.style.display='block';return;}
  if(n1!==n2){err.textContent='새 비밀번호가 일치하지 않아요';err.style.display='block';return;}
  err.style.display='none';
  S.user.pw=n1;
  var idx=S.members.findIndex(function(m){return m.phone===S.user.phone;});
  if(idx>=0) S.members[idx].pw=n1;
  closeM('changePwM');['cpOld','cpNew','cpNew2'].forEach(function(id){document.getElementById(id).value='';});
  alert('비밀번호가 변경되었습니다!');renderMypage();
}

// ── 사업체 등록/수정/삭제 ────────────────
function requireLogin(type){
  if(!S.user){
    document.getElementById('gateTx').textContent=type==='biz'?'사업체 등록은 성도만 가능해요':'후기 작성은 성도만 가능해요';
    document.getElementById('gateDesc').textContent=type==='biz'?'회원가입 후 내 사업을 소개해보세요!':'회원가입 후 경험을 공유해주세요!';
    openM('gateM');return;
  }
  if(type==='biz'||type==='rec'){openAddBiz(type==='rec'?'rec':'own');}
  else{
    // 검색창 초기화
    document.getElementById('rvBizSearch').value='';
    document.getElementById('rvBiz').value='';
    document.getElementById('rvBizDrop').style.display='none';
    document.getElementById('rvBizSelected').style.display='none';
    document.getElementById('rvText').value='';
    document.getElementById('rvStars').value='5';
    rvPhotosTemp=[];renderRvPhotoPreview();
    var titleEl=document.querySelector('#addRvM .mt');
    if(titleEl) titleEl.textContent='후기 작성';
    openM('addRvM');
  }
}
// ── 사진 업로드 ───────────────────────────
function readFilesToBase64(files, maxCount, current, cb){
  var remaining=maxCount-current.length;
  if(remaining<=0){alert('최대 '+maxCount+'장까지만 등록할 수 있어요');return;}
  var toRead=Array.from(files).slice(0,remaining);
  var results=[];var done=0;
  toRead.forEach(function(f){
    if(f.size>5*1024*1024){alert(f.name+' 파일이 5MB를 초과해요');done++;if(done===toRead.length)cb(results);return;}
    var reader=new FileReader();
    reader.onload=function(e){results.push(e.target.result);done++;if(done===toRead.length)cb(results);};
    reader.readAsDataURL(f);
  });
}
function addBizPhotos(files){
  readFilesToBase64(files,4,bizPhotosTemp,function(imgs){
    bizPhotosTemp=bizPhotosTemp.concat(imgs);renderBizPhotoPreview();
    document.getElementById('bizPhotoInput').value='';
  });
}
function renderBizPhotoPreview(){
  var wrap=document.getElementById('bizPhotoPreview');
  if(!wrap)return;
  wrap.innerHTML=bizPhotosTemp.map(function(src,i){
    return '<div class="photo-thumb"><img src="'+src+'"><button class="photo-del" onclick="bizPhotosTemp.splice('+i+',1);renderBizPhotoPreview()">×</button></div>';
  }).join('');
}
function addRvPhotos(files){
  readFilesToBase64(files,3,rvPhotosTemp,function(imgs){
    rvPhotosTemp=rvPhotosTemp.concat(imgs);renderRvPhotoPreview();
    document.getElementById('rvPhotoInput').value='';
  });
}
function renderRvPhotoPreview(){
  var wrap=document.getElementById('rvPhotoPreview');
  if(!wrap)return;
  wrap.innerHTML=rvPhotosTemp.map(function(src,i){
    return '<div class="photo-thumb"><img src="'+src+'"><button class="photo-del" onclick="rvPhotosTemp.splice('+i+',1);renderRvPhotoPreview()">×</button></div>';
  }).join('');
}
function openViewer(src){
  document.getElementById('viewerImg').src=src;
  document.getElementById('photoViewer').classList.add('on');
}
function closeViewer(){document.getElementById('photoViewer').classList.remove('on');}

function openReviewFromDetail(bizId){
  if(!S.user){
    document.getElementById('gateTx').textContent='후기 작성은 성도만 가능해요';
    document.getElementById('gateDesc').textContent='회원가입 후 경험을 공유해주세요!';
    openM('gateM');return;
  }
  var biz=S.biz.find(function(b){return b.id===bizId;});
  // 검색창 초기화 후 해당 업체 자동 선택
  document.getElementById('rvBizSearch').value='';
  document.getElementById('rvBiz').value='';
  document.getElementById('rvBizDrop').style.display='none';
  rvBizSelect(bizId);
  // 모달 제목 업체명으로
  var titleEl=document.querySelector('#addRvM .mt');
  if(titleEl&&biz) titleEl.textContent='✏️ '+biz.name+' 후기 작성';
  document.getElementById('rvText').value='';
  document.getElementById('rvStars').value='5';
  rvPhotosTemp=[];renderRvPhotoPreview();
  openM('addRvM');
}
// 업체 검색 자동완성
function rvBizSearchInput(){
  var kw=document.getElementById('rvBizSearch').value.trim().toLowerCase();
  var drop=document.getElementById('rvBizDrop');
  var list=kw?S.biz.filter(function(b){return b.name.toLowerCase().includes(kw)||((b.cat||'').toLowerCase().includes(kw));})
             :S.biz.slice(0,30);
  if(!list.length){drop.innerHTML='<div style="padding:11px 13px;font-size:12px;color:var(--t2)">검색 결과가 없어요</div>';drop.style.display='block';return;}
  drop.innerHTML=list.map(function(b){
    return '<div onclick="rvBizSelect('+b.id+')" style="padding:10px 13px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px" onmouseover="this.style.background=\'var(--pl)\'" onmouseout="this.style.background=\'\'">'+
      '<span style="font-size:16px">'+(EM[b.cat]||'🏪')+'</span>'+
      '<span style="flex:1"><strong>'+b.name+'</strong> <span style="font-size:11px;color:var(--t2)">'+b.cat+'</span></span>'+
      '<span style="font-size:10px;color:var(--t2)">'+b.owner+'</span>'+
    '</div>';
  }).join('');
  drop.style.display='block';
}
function rvBizSelect(bizId){
  var biz=S.biz.find(function(b){return b.id===bizId;});
  if(!biz) return;
  document.getElementById('rvBiz').value=bizId;
  document.getElementById('rvBizSearch').value='';
  document.getElementById('rvBizDrop').style.display='none';
  var sel=document.getElementById('rvBizSelected');
  sel.style.display='flex';
  sel.innerHTML=(EM[biz.cat]||'🏪')+' <span style="flex:1;margin-left:6px">'+biz.name+' <span style="font-size:11px;color:var(--t2);font-weight:400">'+biz.cat+'</span></span>'+
    '<span onclick="rvBizClear()" style="cursor:pointer;font-size:14px;color:var(--t2);padding:0 2px">×</span>';
}
function rvBizClear(){
  document.getElementById('rvBiz').value='';
  document.getElementById('rvBizSearch').value='';
  document.getElementById('rvBizSelected').style.display='none';
  document.getElementById('rvBizSearch').focus();
  rvBizSearchInput();
  // 모달 제목 초기화
  var titleEl=document.querySelector('#addRvM .mt');
  if(titleEl) titleEl.textContent='후기 작성';
}
function onBizTypeChange(){
  var isRec = document.getElementById('bType').value === 'rec';
  var lblBizPhone = document.getElementById('lblBizPhone');
  var lblPhone    = document.getElementById('lblPhone');
  var fgBizPhone  = document.getElementById('fgBizPhone');
  var fgPhone     = document.getElementById('fgPhone');
  if(isRec){
    // 추천업체: 사업체전화 필수(위) / 휴대폰 선택(아래)
    lblBizPhone.innerHTML = '사업체 전화 <span class="req">필수</span>';
    lblPhone.innerHTML    = '담당자 휴대폰 <span class="opt-l">선택</span>';
    // 순서: 사업체전화 → 휴대폰
    fgBizPhone.parentNode.insertBefore(fgBizPhone, fgPhone);
  } else {
    // 운영업체: 휴대폰 필수(위) / 사업체전화 선택(아래)
    lblPhone.innerHTML    = '담당자 휴대폰 <span class="req">필수</span>';
    lblBizPhone.innerHTML = '사업체 전화 <span class="opt-l">일반전화 · 선택</span>';
    // 순서: 휴대폰 → 사업체전화
    fgBizPhone.parentNode.insertBefore(fgPhone, fgBizPhone);
  }
}
function openAddBiz(defaultType){
  document.getElementById('bizModalTitle').textContent='사업체 등록';
  document.getElementById('editBizId').value='';
  ['bName','bPhone','bBizPhone','bRegNo','bAddr','bWeb','bKw','bDesc'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('bCat').value='';
  document.getElementById('bType').value=defaultType||'own';
  document.getElementById('bPhone').value=S.user?S.user.phone:'';
  document.getElementById('bizErr').style.display='none';
  bizPhotosTemp=[];renderBizPhotoPreview();
  onBizTypeChange();
  openM('addBizM');
}
function openEditBiz(bizId){
  var b=S.biz.find(function(x){return x.id===bizId;});
  if(!b) return;
  document.getElementById('bizModalTitle').textContent='사업체 수정';
  document.getElementById('editBizId').value=bizId;
  document.getElementById('bType').value=b.type||'own';
  document.getElementById('bName').value=b.name||'';
  document.getElementById('bCat').value=b.cat||'';
  document.getElementById('bPhone').value=b.phone||b.ownerPhone||'';
  document.getElementById('bBizPhone').value=b.bizPhone||'';
  document.getElementById('bRegNo').value=b.regNo||'';
  document.getElementById('bAddr').value=b.addr||'';
  document.getElementById('bWeb').value=b.web||'';
  document.getElementById('bKw').value=b.kw||'';
  document.getElementById('bDesc').value=b.desc||'';
  document.getElementById('bizErr').style.display='none';
  bizPhotosTemp=b.photos?b.photos.slice():[];renderBizPhotoPreview();
  onBizTypeChange();
  openM('addBizM');
}
function saveBiz(){
  var name=document.getElementById('bName').value.trim();
  var cat=document.getElementById('bCat').value;
  var phone=document.getElementById('bPhone').value.trim();
  var bizPhone=document.getElementById('bBizPhone').value.trim();
  var addr=document.getElementById('bAddr').value.trim();
  var isRec=document.getElementById('bType').value==='rec';
  var err=document.getElementById('bizErr');
  if(!name||!cat||!addr){err.textContent='상호명, 업종, 주소는 필수입니다';err.style.display='block';return;}
  if(isRec&&!bizPhone){err.textContent='추천업체는 사업체 전화번호가 필수입니다';err.style.display='block';return;}
  if(!isRec&&!phone){err.textContent='운영업체는 담당자 휴대폰이 필수입니다';err.style.display='block';return;}
  err.style.display='none';
  var editId=document.getElementById('editBizId').value;
  if(editId){
    var b=S.biz.find(function(x){return String(x.id)===String(editId);});
    if(b){
      b.type=document.getElementById('bType').value;b.name=name;b.cat=cat;
      b.phone=phone;b.bizPhone=document.getElementById('bBizPhone').value.trim();
      b.regNo=document.getElementById('bRegNo').value.trim();
      b.addr=addr;b.web=document.getElementById('bWeb').value.trim();
      b.kw=document.getElementById('bKw').value.trim();b.desc=document.getElementById('bDesc').value.trim();
      b.photos=bizPhotosTemp.slice();
    }
    closeM('addBizM');doFilter();renderMypage();saveToFirebase();alert('사업체 정보가 수정되었습니다!');
  } else {
    S.biz.push({id:Date.now(),name:name,cat:cat,type:document.getElementById('bType').value,
      owner:S.user.name,ownerName:S.user.name,ownerRole:S.user.role,ownerChurch:S.user.church,
      phone:phone,ownerPhone:phone,bizPhone:document.getElementById('bBizPhone').value.trim(),
      regNo:document.getElementById('bRegNo').value.trim(),addr:addr,
      web:document.getElementById('bWeb').value.trim(),kw:document.getElementById('bKw').value.trim(),
      desc:document.getElementById('bDesc').value.trim(),photos:bizPhotosTemp.slice()});
    closeM('addBizM');doFilter();renderMypage();saveToFirebase();alert('사업체가 등록되었습니다!');
  }
}
function deleteBiz(bizId){
  if(!confirm('사업체를 삭제하시겠어요?'))return;
  S.biz=S.biz.filter(function(b){return b.id!==bizId;});
  goBack();
}
function addReview(){
  var bizId=document.getElementById('rvBiz').value;
  if(!bizId){alert('사업체를 선택해주세요');document.getElementById('rvBizSearch').focus();return;}
  bizId=parseFloat(bizId);
  var biz=S.biz.find(function(b){return b.id===bizId;});
  var text=document.getElementById('rvText').value.trim();
  if(!text){alert('후기 내용을 입력해주세요');return;}
  S.reviews.unshift({id:Date.now(),bizId:bizId,bizName:biz.name,reviewer:S.user.name,role:S.user.role,stars:parseInt(document.getElementById('rvStars').value),text:text,date:new Date().toISOString().slice(0,10),photos:rvPhotosTemp.slice()});
  // 제목 초기화
  var titleEl=document.querySelector('#addRvM .mt');
  if(titleEl) titleEl.textContent='후기 작성';
  closeM('addRvM');
  // 상세페이지가 열려있으면 해당 업체 상세 새로고침
  if(S.curBiz===bizId) showDetail(bizId);
  renderAllRv();document.getElementById('rvText').value='';saveToFirebase();alert('후기가 등록되었습니다!');
}

// ── CSV 처리 ─────────────────────────────
function parseCSV(text){
  return text.split(/\r?\n/).map(function(line){
    var cols=[],cur='',inQ=false;
    for(var i=0;i<=line.length-1;i++){
      var ch=line[i];
      if(ch==='"'){inQ=!inQ;}
      else if(ch===','&&!inQ){cols.push(cur.trim());cur='';}
      else{cur+=ch;}
    }
    cols.push(cur.trim());return cols;
  });
}
function isMobile(num){return /^01[016789]/.test((num||'').replace(/[^0-9]/g,''));}
function handleDrop(e){e.preventDefault();document.getElementById('dropZone').style.borderColor='';var f=e.dataTransfer.files[0];if(f)handleFile(f);}
function handleFile(file){
  if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var text=e.target.result;
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      var rows=parseCSV(text);
      var dataRows=rows.slice(2).filter(function(r){return r[0]&&String(r[0]).trim();});
      S.csvParsed=dataRows.map(function(r){
        var rawPhone=String(r[1]||'').trim();
        // 휴대폰/일반전화 자동 분류
        var mobilePhone='', bizPhone='';
        if(isMobile(rawPhone)){mobilePhone=rawPhone;}
        else{bizPhone=rawPhone;}
        return {name:String(r[0]||'').trim(),phone:mobilePhone,bizPhone:bizPhone,
          pw:(String(r[2]||'').trim())||'1111',
          church:String(r[3]||'').trim(),role:String(r[4]||'성도').trim(),no:'',
          biz_cat:String(r[5]||'').trim(),biz_name:String(r[6]||'').trim(),
          biz_addr:String(r[7]||'').trim(),biz_desc:String(r[8]||'').trim()};
      });
      showCsvPreview();
    }catch(err){alert('파일을 읽을 수 없어요: '+err);}
  };
  reader.readAsText(file,'UTF-8');
}
function showCsvPreview(){
  var valid=S.csvParsed.filter(function(m){return m.name&&(m.phone||m.bizPhone);});
  var noMobile=S.csvParsed.filter(function(m){return m.name&&!m.phone&&m.bizPhone;});
  var invalid=S.csvParsed.filter(function(m){return !m.name||(!m.phone&&!m.bizPhone);});
  document.getElementById('csvCount').textContent=
    '총 '+S.csvParsed.length+'명 인식 · 유효 '+valid.length+'명'+
    (noMobile.length?' · 📵 휴대폰 없음(로그인불가) '+noMobile.length+'명':'')+
    (invalid.length?' · 누락 '+invalid.length+'명':'');
  var h='<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)">'+
    ['이름','휴대폰','일반전화','교회','직분','상태'].map(function(t){return '<th style="padding:6px 7px;text-align:left;border-bottom:1px solid var(--bd);font-size:11px;white-space:nowrap">'+t+'</th>';}).join('')+
    '</tr></thead><tbody>';
  S.csvParsed.forEach(function(m){
    var missing=!m.name||(!m.phone&&!m.bizPhone);
    var dup=m.phone&&S.members.find(function(ex){return ex.phone===m.phone;});
    var noPhone=!m.phone&&m.bizPhone;
    var status=missing?'<span style="color:#a32d2d">✗ 필수누락</span>':
               dup?'<span style="color:#854f0b">기존회원</span>':
               noPhone?'<span style="color:#e67e22">⚠ 로그인불가</span>':
               '<span style="color:#0f6e56">✓</span>';
    var bg=missing?'#fff5f5':noPhone?'#fffbf0':dup?'#fffdf5':'';
    h+='<tr style="background:'+bg+'">'+
      '<td style="padding:5px 7px;border-bottom:1px solid var(--bd);font-size:11px">'+(m.name||'-')+'</td>'+
      '<td style="padding:5px 7px;border-bottom:1px solid var(--bd);font-size:11px;color:'+(m.phone?'var(--t)':'#aaa')+'">'+(m.phone||'없음')+'</td>'+
      '<td style="padding:5px 7px;border-bottom:1px solid var(--bd);font-size:11px;color:'+(m.bizPhone?'var(--t)':'#aaa')+'">'+(m.bizPhone||'-')+'</td>'+
      '<td style="padding:5px 7px;border-bottom:1px solid var(--bd);font-size:11px">'+(m.church||'-')+'</td>'+
      '<td style="padding:5px 7px;border-bottom:1px solid var(--bd);font-size:11px">'+(m.role||'-')+'</td>'+
      '<td style="padding:5px 7px;border-bottom:1px solid var(--bd);font-size:11px">'+status+'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('csvTable').innerHTML=h;
  document.getElementById('csvPreview').style.display='block';
}
function doUpload(){
  var addedM=0,addedB=0,skipped=0;
  S.csvParsed.forEach(function(m){
    if(!m.name||(!m.phone&&!m.bizPhone)){skipped++;return;}
    // 회원 등록은 휴대폰 있을 때만 (로그인용)
    if(m.phone){
      var member=S.members.find(function(ex){return ex.phone===m.phone;});
      if(!member){member={name:m.name,phone:m.phone,pw:m.pw||'1111',church:m.church,role:m.role,no:''};S.members.push(member);addedM++;}
    }
    if(m.biz_name){
      var refPhone=m.phone||m.bizPhone||'';
      var np=refPhone.replace(/[^0-9]/g,'');
      var exists=S.bizDB.find(function(b){
        var bp=(b.ownerPhone||b.phone||'').replace(/[^0-9]/g,'');
        var bbp=(b.bizPhone||'').replace(/[^0-9]/g,'');
        return b.ownerName===m.name&&(bp===np||bbp===np)&&b.name===m.biz_name&&b.cat===m.biz_cat;
      });
      if(!exists){
        var nb={id:Date.now()+Math.random(),name:m.biz_name,cat:m.biz_cat||'기타',type:'own',
          owner:m.name,ownerName:m.name,ownerPhone:m.phone||'',bizPhone:m.bizPhone||'',
          ownerRole:m.role,ownerChurch:m.church,
          phone:m.phone||'',addr:m.biz_addr,regNo:'',web:'',kw:'',desc:m.biz_desc};
        S.bizDB.push(nb);
        var dupBiz=S.biz.find(function(b){return b.name===nb.name&&b.ownerName===nb.ownerName&&b.cat===nb.cat;});
        if(!dupBiz){S.biz.push(nb);addedB++;}
      }
    }
  });
  closeM('csvM');S.csvParsed=[];document.getElementById('csvPreview').style.display='none';document.getElementById('csvInput').value='';
  alert('업로드 완료!\n\n회원 '+addedM+'명 등록\n사업체 '+addedB+'개 등록'+(skipped?'\n('+skipped+'건 건너뜀)':''));
  doFilter();renderMypage();
}

function doLogout(){
  if(confirm('로그아웃 하시겠어요?')){
    S.user=null;try{localStorage.removeItem('savedLogin');}catch(e){}
    document.getElementById('loginBtn').textContent='로그인';
    checkAdminTab();renderMypage();
  }
}
function openM(id){document.getElementById(id).classList.add('op');}
function closeM(id){var el=document.getElementById(id);if(el)el.classList.remove('op');}
document.querySelectorAll('.ov').forEach(function(el){el.addEventListener('click',function(e){if(e.target===el)el.classList.remove('op');});});
document.addEventListener('click',function(e){
  var drop=document.getElementById('rvBizDrop');
  var search=document.getElementById('rvBizSearch');
  if(drop&&search&&!drop.contains(e.target)&&e.target!==search) drop.style.display='none';
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.ov.op').forEach(function(el){el.classList.remove('op');});});


initSelects();
loadFromFirebase();


