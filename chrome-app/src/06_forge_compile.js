/* ==== forge_compile ==== */
const FORGE_COMPILE=(()=>{
const HEXC='0123456789abcdef';
const eid=()=>{let s='';for(let i=0;i<7;i++)s+=HEXC[Math.floor(Math.random()*16)];return s;};
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
function hexmix(c,white){white=white==null?0.9:white; c=c.replace('#',''); if(c.length===3) c=c.split('').map(x=>x+x).join(''); const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16); const f=v=>Math.round(v+(255-v)*white); return '#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join('');}
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
const tel=s=>'tel:'+String(s).replace(/[^\d+]/g,'');
function numFrom(v){const m=String(v).match(/[\d,\.]+/); return m?parseFloat(m[0].replace(/,/g,'')):null;}
const FORM_JS='<scr'+'ipt>(function(){var f=document.querySelector("[data-forge-form]");if(!f)return;f.addEventListener("submit",function(e){e.preventDefault();var m=f.querySelector(".forge-form-msg"),b=f.querySelector("button");b.disabled=true;var d={};new FormData(f).forEach(function(v,k){d[k]=v});fetch(f.action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(function(r){return r.json()}).then(function(j){m.textContent=j.message||"Thanks. We will be in touch shortly.";if(j.ok!==false){f.reset();if(window.dataLayer)window.dataLayer.push({event:"forge_lead",page:d.page});}b.disabled=false}).catch(function(){m.textContent="Something went wrong. Please call us.";b.disabled=false})})})();</'+'script>';
const PREVIEW_CSS=':root{--p:%p;--a:%a;--t:%t;--d:%d}*{box-sizing:border-box}body{margin:0;font:16px/1.6 %font;color:#1b1b1a;background:#fff}h1,h2,h3{font-family:%hfont;line-height:1.15;margin:.2em 0 .5em}h1{font-size:clamp(30px,4.2vw,48px)}h2{font-size:clamp(24px,3vw,34px)}h3{font-size:20px}.forge-section{padding:72px 20px}.forge-tint{background:var(--t)}.forge-brand{background:var(--p);color:#fff}.forge-brand h2{color:#fff}.forge-dark{background:var(--d);color:#fff}.forge-inner{max-width:1140px;margin:0 auto}.forge-narrow{max-width:820px}.forge-split{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:center}.forge-split img,.forge-video iframe,video{width:100%;height:auto;border-radius:14px;aspect-ratio:16/10;object-fit:cover}.forge-video{position:relative;aspect-ratio:16/9}.forge-video iframe{position:absolute;inset:0;height:100%}.forge-eyebrow{color:var(--a);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px}.forge-lede{font-size:19px;color:#3f3f3c}.forge-btn{display:inline-block;padding:14px 22px;border-radius:8px;font-weight:700;text-decoration:none;margin:6px 8px 6px 0}.forge-btn-primary{background:var(--p);color:#fff}.forge-btn-secondary{background:var(--a);color:#111}.forge-brand .forge-btn-primary{background:var(--a);color:#111}.forge-trust{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px}.forge-trust li:before{content:"✓ ";color:var(--p);font-weight:700}.forge-answer{font-size:20px;border-left:4px solid var(--p);padding-left:16px}.forge-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}.forge-facts div{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.forge-facts dt{font-size:34px;font-weight:800;color:var(--p)}.forge-brand .forge-facts div{background:rgba(255,255,255,.08)}.forge-brand .forge-facts dt{color:#fff}.forge-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}.forge-card{background:#fff;border-radius:12px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin:0}.forge-steps li{margin-bottom:14px}.forge-faq{border-bottom:1px solid #e3e1da;padding:10px 0}.forge-faq summary{cursor:pointer;list-style:none}.forge-faq summary h3{display:inline;font-size:18px}.forge-form{display:grid;gap:12px;max-width:560px}.forge-form label{display:grid;gap:4px;font-weight:600}.forge-form input,.forge-form textarea{padding:12px;border:1px solid #c3c0b7;border-radius:8px;font:inherit}.forge-consent{font-weight:400!important;font-size:13px;grid-template-columns:auto 1fr;align-items:start}.forge-form button{justify-self:start;border:0;cursor:pointer}.forge-table{width:100%;border-collapse:collapse}.forge-table th,.forge-table td{padding:10px;border-bottom:1px solid #e3e1da;text-align:left}.forge-tablewrap{overflow-x:auto}.forge-links{columns:2}.forge-sticky{display:none}@media(max-width:767px){.forge-split{grid-template-columns:1fr}.forge-section{padding:44px 16px}.forge-sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:99;gap:8px;padding:10px 12px;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.14)}.forge-sticky a{flex:1;text-align:center;padding:12px;border-radius:8px;font-weight:700;text-decoration:none}.forge-sticky-call{background:var(--a);color:#111}.forge-sticky-cta{background:var(--p);color:#fff}body{padding-bottom:70px}}';
const DEF_FIELDS=[{id:'name',label:'Full name',type:'text',required:true},{id:'phone',label:'Phone',type:'tel',required:true},{id:'email',label:'Email',type:'email',required:true},{id:'message',label:'Tell us what happened',type:'textarea',required:false}];
const DEF_CONSENT='By submitting, you agree that we may contact you by phone, text or email about your request. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out of texts.';
const gap=n=>({column:String(n),row:String(n),unit:'px',size:n});
const box=(n,linked)=>({unit:'px',top:String(n),right:String(n),bottom:String(n),left:String(n),isLinked:linked!==false});

class Forge{
  constructor(bp,media){
    this.bp=bp; this.media=media||{}; this.page=bp.page; this.site=bp.site||{}; this.brand=this.site.brand||{};
    this.primary=this.brand.primary||'#13243a'; this.accent=this.brand.accent||'#0b6f6d'; this.dark=this.brand.dark||'#111110';
    this.tint=hexmix(this.primary,0.9); this.cta=this.page.cta||{}; this.warnings=[]; this.use_globals=this.brand.globals!==false;
  }
  m(key){
    if(!key) return null;
    const specs=this.bp.media||{}; let v=this.media[key]||(specs[key]&&specs[key].url?specs[key]:null);
    if(!v){ const spec=specs[key]||{}; const msg=`MEDIA: slot "${key}" unresolved (source: ${spec.source||'?'}) — resolved at deploy from your assets or the site library; a page never ships with a placeholder`; if(!this.warnings.includes(msg)) this.warnings.push(msg);
      return {id:0,url:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#e7e9ec"/><text x="800" y="500" font-family="Arial,sans-serif" font-size="44" fill="#5b6570" text-anchor="middle">'+String(key).replace(/[<&]/g,'')+' image, resolved at deploy</text></svg>'),alt:spec.alt||key,kind:spec.kind||'image'}; }
    v=Object.assign({},v); if(v.kind==null) v.kind=(specs[key]||{}).kind||'image'; if(v.alt==null) v.alt=(specs[key]||{}).alt||''; return v;
  }
  w(t,s){return {id:eid(),elType:'widget',widgetType:t,settings:s,elements:[]};}
  c(els,settings,inner){const s={content_width:'full',flex_direction:'column',flex_gap:gap(16)}; if(settings) Object.assign(s,settings); return {id:eid(),elType:'container',settings:s,elements:els,isInner:inner!==false};}
  section(els,sec,extra){
    const style=sec.style||'light', width=sec.width||'boxed';
    const s={content_width:'boxed',boxed_width:{unit:'px',size:width!=='narrow'?1140:820},flex_direction:'column',flex_gap:gap(20),
      padding:{unit:'px',top:'72',right:'20',bottom:'72',left:'20',isLinked:false},padding_mobile:{unit:'px',top:'44',right:'16',bottom:'44',left:'16',isLinked:false},
      _element_id:sec.id||slug(sec.heading||sec.type),css_classes:'forge-section forge-sec-'+sec.type,html_tag:'section'};
    if(style==='tint') Object.assign(s,{background_background:'classic',background_color:this.tint});
    else if(style==='dark') Object.assign(s,{background_background:'classic',background_color:this.dark});
    else if(style==='brand') Object.assign(s,{background_background:'classic',background_color:this.primary});
    if(extra) Object.assign(s,extra);
    return {id:eid(),elType:'container',settings:s,elements:els,isInner:false};
  }
  heading(text,tag,align,color,size){
    const s={title:text,header_size:tag||'h2',align:align||'left'};
    if(color) s.title_color=color; else if(this.use_globals) s.__globals__={title_color:'globals/colors?id=primary'}; else s.title_color=this.primary;
    if(size) s.size=size; return this.w('heading',s);
  }
  text(html,color){const s={editor:html}; if(color) s.text_color=color; return this.w('text-editor',s);}
  button(label,url,kind,align){
    kind=kind||'primary';
    const s={text:label,link:{url,is_external:'',nofollow:'',custom_attributes:''},size:'lg',align:align||'left',button_type:kind==='primary'?'default':'info',border_radius:box(8),css_classes:'forge-cta forge-cta-'+kind};
    if(this.use_globals) s.__globals__={background_color:kind==='primary'?'globals/colors?id=primary':'globals/colors?id=accent',typography_typography:'globals/typography?id=accent'};
    else Object.assign(s,{background_color:kind==='primary'?this.primary:this.accent,button_text_color:kind==='primary'?'#ffffff':'#111111'});
    if(url.startsWith('tel:')) s.selected_icon={value:'fas fa-phone',library:'fa-solid'};
    return this.w('button',s);
  }
  image(md,size){return this.w('image',{image:{url:md.url,id:md.id||0,alt:md.alt||'',source:md.id?'library':'url'},image_size:size||'large',caption_source:'none',link_to:'none',align:'center'});}
  video(md,poster){
    const url=md.url; const s={lazy_load:'yes',play_on_mobile:'yes',controls:'yes'};
    if(/youtube\.com|youtu\.be/.test(url)) Object.assign(s,{video_type:'youtube',youtube_url:url,yt_privacy:'yes',rel:''});
    else if(/vimeo\.com/.test(url)) Object.assign(s,{video_type:'vimeo',vimeo_url:url});
    else { s.video_type='hosted'; if(md.id) s.hosted_url={url,id:md.id}; else Object.assign(s,{insert_url:'yes',external_url:{url}}); }
    if(poster) Object.assign(s,{show_image_overlay:'yes',image_overlay:{url:poster.url,id:poster.id||0},show_play_icon:'yes'});
    return this.w('video',s);
  }
  ctaButtons(keys,align){
    const els=[]; align=align||'left';
    for(const k of (keys||[])){ const cta=typeof k==='string'?this.cta[k]:k; if(!cta) continue;
      if(cta.url) els.push(this.button(cta.label,cta.url,k==='primary'?'primary':'secondary',align));
      if(cta.phone) els.push(this.button(cta.phone_label||('Call '+cta.phone),tel(cta.phone),'secondary',align)); }
    return els.length?this.c(els,{flex_direction:'row',flex_wrap:'wrap',flex_gap:gap(12),flex_justify_content:align==='left'?'flex-start':'center'}):null;
  }
  iconList(items,icon){return this.w('icon-list',{icon_list:items.map(t=>({text:t,selected_icon:{value:icon||'fas fa-check',library:'fa-solid'},_id:eid()})),view:'traditional',space_between:{unit:'px',size:8}});}
  /* ---------- sections ---------- */
  s_hero(sec){
    const pg=this.page, left=[];
    if(sec.eyebrow) left.push(this.heading(sec.eyebrow,'h6','left',this.accent));
    left.push(this.heading(sec.h1||pg.h1,'h1'));
    if(sec.lede) left.push(this.text('<p class="forge-lede">'+esc(sec.lede)+'</p>'));
    const b=this.ctaButtons(sec.cta||['primary']); if(b) left.push(b);
    if(sec.trust!==false&&pg.conversion&&pg.conversion.trust) left.push(this.iconList(pg.conversion.trust));
    const media=sec.media?this.m(sec.media):null; const layout=sec.layout||(media?'split':'center');
    if(layout==='split'&&media){
      const right=[media.kind==='video'?this.video(media,sec.poster?this.m(sec.poster):null):this.image(media,'full')];
      const row=this.c([this.c(left,{width:{unit:'%',size:55},width_mobile:{unit:'%',size:100},flex_justify_content:'center'}),this.c(right,{width:{unit:'%',size:45},width_mobile:{unit:'%',size:100}})],{flex_direction:'row',flex_direction_mobile:'column',flex_align_items:'center',flex_gap:{column:'40',row:'24',unit:'px',size:40}});
      return this.section([row],sec,{min_height:{unit:'vh',size:60},flex_justify_content:'center'});
    }
    if(layout==='cover'&&media&&media.kind!=='video'){
      for(const el of left) if(el.elType==='widget'&&(el.widgetType==='heading'||el.widgetType==='text-editor')){ delete el.settings.__globals__; el.settings[el.widgetType==='heading'?'title_color':'text_color']='#ffffff'; }
      return this.section([this.c(left,{width:{unit:'%',size:66},width_mobile:{unit:'%',size:100}})],sec,{background_background:'classic',background_image:{url:media.url,id:media.id||0},background_size:'cover',background_position:'center center',background_overlay_background:'classic',background_overlay_color:this.dark,background_overlay_opacity:{unit:'px',size:0.62},min_height:{unit:'vh',size:70},flex_justify_content:'center'});
    }
    for(const el of left) if(el.elType==='widget'&&'align' in el.settings) el.settings.align='center';
    return this.section([this.c(left,{width:{unit:'%',size:80},width_mobile:{unit:'%',size:100},flex_align_items:'center'})],sec,{flex_align_items:'center'});
  }
  s_answer(sec){return this.section([this.heading(sec.heading||'The short answer','h2'),this.text('<p class="forge-answer"><strong>'+esc(sec.body)+'</strong></p>')],Object.assign({},sec,{style:sec.style||'tint',width:'narrow'}));}
  s_key_facts(sec){
    const n=Math.max(1,Math.min(4,sec.items.length));
    const cards=sec.items.map(it=>this.c([this.heading(it.value,'h3','left',this.primary,'xl'),this.text('<p>'+esc(it.label)+(it.source?'<br><small>'+esc(it.source)+'</small>':'')+'</p>')],{width:{unit:'%',size:Math.max(22,Math.floor(100/n))-2},width_mobile:{unit:'%',size:100},background_background:'classic',background_color:'#ffffff',border_radius:box(12),padding:box(22)}));
    const els=(sec.heading?[this.heading(sec.heading,'h2')]:[]).concat([this.c(cards,{flex_direction:'row',flex_wrap:'wrap',flex_gap:gap(16)})]);
    return this.section(els,Object.assign({},sec,{style:sec.style||'tint'}));
  }
  s_rich_text(sec){const els=(sec.heading?[this.heading(sec.heading,sec.tag||'h2')]:[]).concat([this.text(sec.html)]); return this.section(els,Object.assign({},sec,{width:sec.width||'narrow'}));}
  s_steps(sec){const items=sec.steps.map((st,i)=>this.c([this.heading(`${i+1}. ${st.title}`,'h3'),this.text('<p>'+esc(st.text)+'</p>')],{width:{unit:'%',size:100}})); return this.section([this.heading(sec.heading||'How it works','h2')].concat(items),Object.assign({},sec,{width:'narrow'}));}
  s_features(sec){
    const cols=Math.min(3,Math.max(1,sec.items.length)); const cards=[];
    for(const it of sec.items){ const els=[this.heading(it.title,'h3','left',null,'medium'),this.text('<p>'+esc(it.text)+(it.url?' <a href="'+esc(it.url)+'">'+esc(it.link||'Learn more')+'</a>':'')+'</p>')];
      if(it.icon) els.unshift(this.w('icon',{selected_icon:{value:it.icon,library:'fa-solid'},view:'default',align:'left',size:{unit:'px',size:34},primary_color:this.primary}));
      cards.push(this.c(els,{width:{unit:'%',size:Math.floor(100/cols)-2},width_mobile:{unit:'%',size:100}})); }
    return this.section([this.heading(sec.heading,'h2')].concat(sec.text?[this.text('<p>'+esc(sec.text)+'</p>')]:[]).concat([this.c(cards,{flex_direction:'row',flex_wrap:'wrap',flex_gap:gap(28)})]),sec);
  }
  s_media(sec){const md=this.m(sec.media); const w=md.kind==='video'?this.video(md,sec.poster?this.m(sec.poster):null):this.image(md,'full'); const els=(sec.heading?[this.heading(sec.heading,'h2')]:[]).concat([w]).concat(sec.caption?[this.text('<p><small>'+esc(sec.caption)+'</small></p>')]:[]); return this.section(els,Object.assign({},sec,{width:sec.width||'boxed'}));}
  s_video(sec){const md=this.m(sec.media); const els=(sec.heading?[this.heading(sec.heading,'h2')]:[]).concat([this.video(md,sec.poster?this.m(sec.poster):null)]); if(sec.transcript) els.push(this.w('accordion',{tabs:[{tab_title:'Video transcript',tab_content:'<p>'+esc(sec.transcript)+'</p>',_id:eid()}],faq_schema:''})); return this.section(els,Object.assign({},sec,{width:'narrow'}));}
  s_gallery(sec){const cols=sec.columns||3; const imgs=sec.media.map(k=>this.c([this.image(this.m(k),'medium_large')],{width:{unit:'%',size:Math.floor(100/cols)-2},width_mobile:{unit:'%',size:50}})); return this.section((sec.heading?[this.heading(sec.heading,'h2')]:[]).concat([this.c(imgs,{flex_direction:'row',flex_wrap:'wrap',flex_gap:gap(12)})]),sec);}
  s_testimonials(sec){
    const cards=[]; const n=Math.min(3,sec.items.length);
    for(const it of sec.items){ const els=[]; if(it.rating) els.push(this.w('star-rating',{rating:it.rating,star_style:'star_fontawesome',align:'left',stars_color:this.accent}));
      const ts={testimonial_content:it.quote,testimonial_name:it.name||'',testimonial_job:it.role||'',testimonial_alignment:'left',testimonial_image_position:'aside'};
      if(it.media){const md=this.m(it.media); ts.testimonial_image={url:md.url,id:md.id||0};} els.push(this.w('testimonial',ts));
      cards.push(this.c(els,{width:{unit:'%',size:Math.floor(100/n)-2},width_mobile:{unit:'%',size:100},background_background:'classic',background_color:'#ffffff',padding:box(22),border_radius:box(12)})); }
    return this.section([this.heading(sec.heading||'What clients say','h2'),this.c(cards,{flex_direction:'row',flex_wrap:'wrap',flex_gap:gap(20)})],Object.assign({},sec,{style:sec.style||'tint'}));
  }
  s_stats(sec){
    const cards=[]; const n=Math.min(4,sec.items.length);
    for(const it of sec.items){ const num=numFrom(it.value); const wd={width:{unit:'%',size:Math.floor(100/n)-2},width_mobile:{unit:'%',size:50}};
      if(num!=null){ const m=String(it.value).trim().match(/^([^\d]*)([\d,\.]+)(.*)$/); cards.push(this.c([this.w('counter',{starting_number:0,ending_number:num,prefix:m?m[1]:'',suffix:m?m[3]:'',title:it.label,thousand_separator:'yes',title_tag:'div'})],wd)); }
      else cards.push(this.c([this.heading(it.value,'h3','center'),this.text('<p style="text-align:center">'+esc(it.label)+'</p>')],wd)); }
    return this.section((sec.heading?[this.heading(sec.heading,'h2','center')]:[]).concat([this.c(cards,{flex_direction:'row',flex_wrap:'wrap',flex_gap:gap(16)})]),Object.assign({},sec,{style:sec.style||'brand'}));
  }
  s_faq(sec){const acc=this.w('accordion',{tabs:sec.items.map(it=>({tab_title:it.q,tab_content:'<p>'+esc(it.a)+'</p>',_id:eid()})),faq_schema:'',title_html_tag:'h3',selected_icon:{value:'fas fa-plus',library:'fa-solid'},selected_active_icon:{value:'fas fa-minus',library:'fa-solid'}}); return this.section([this.heading(sec.heading||'Frequently asked questions','h2'),acc],Object.assign({},sec,{width:'narrow'}));}
  s_cta_band(sec){
    const els=[this.heading(sec.heading,'h2','center','#ffffff')]; if(sec.text) els.push(this.text('<p style="text-align:center">'+esc(sec.text)+'</p>','#ffffff'));
    const b=this.ctaButtons(sec.cta||['primary'],'center'); if(b){ els.push(b); for(const el of b.elements){ if(this.use_globals) el.settings.__globals__={background_color:'globals/colors?id=accent',typography_typography:'globals/typography?id=accent'}; else Object.assign(el.settings,{background_color:this.accent,button_text_color:'#111111'}); } }
    return this.section(els,Object.assign({},sec,{style:'brand'}),{flex_align_items:'center'});
  }
  s_form(sec){
    const f=(this.page.conversion||{}).form||{}; const prov=f.provider||'html'; const els=[];
    if(sec.heading) els.push(this.heading(sec.heading,'h2')); if(sec.text) els.push(this.text('<p>'+esc(sec.text)+'</p>'));
    const fields=f.fields&&f.fields.length?f.fields:DEF_FIELDS; const consent=f.consent||DEF_CONSENT;
    if(prov==='elementor_pro'){
      const ff=fields.map(x=>({custom_id:x.id,field_label:x.label,field_type:x.type,required:x.required?'true':'',placeholder:x.placeholder||'',width:'100',_id:eid()}));
      ff.push({custom_id:'consent',field_label:consent,field_type:'acceptance',required:'true',width:'100',_id:eid()});
      els.push(this.w('form',{form_name:f.name||'Lead form',form_fields:ff,button_text:f.button||'Send my request',button_size:'md',submit_actions:['email'],email_to:f.email_to||'',email_subject:'New lead: '+(this.page.h1||''),success_message:f.success||'Thanks. We will contact you shortly.',form_id:slug(this.page.slug)+'-form'}));
    } else if(['wpforms','gravity','cf7','fluent','shortcode'].includes(prov)&&f.shortcode) els.push(this.w('shortcode',{shortcode:f.shortcode}));
    else els.push(this.w('html',{html:this.htmlForm()}));
    return this.section(els,Object.assign({},sec,{width:'narrow',style:sec.style||'tint'}),{_element_id:sec.id||'contact'});
  }
  s_map(sec){const els=(sec.heading?[this.heading(sec.heading,'h2')]:[]).concat([this.w('google_maps',{address:sec.address,zoom:{unit:'px',size:14},height:{unit:'px',size:360}})]); if(sec.text) els.push(this.text('<p>'+esc(sec.text)+'</p>')); return this.section(els,sec);}
  s_table(sec){const th=sec.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join(''); const tr=sec.rows.map(r=>'<tr>'+r.map(v=>`<td>${esc(v)}</td>`).join('')+'</tr>').join(''); return this.section((sec.heading?[this.heading(sec.heading,'h2')]:[]).concat([this.w('html',{html:`<div class="forge-tablewrap"><table class="forge-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`})]),sec);}
  s_authors(sec){
    const a=this.page.author||{}; const els=[this.heading(sec.heading||'Reviewed by','h2')]; const row=[];
    if(a.media) row.push(this.c([this.image(this.m(a.media),'thumbnail')],{width:{unit:'%',size:18},width_mobile:{unit:'%',size:40}}));
    row.push(this.c([this.text(`<p><strong>${esc(a.name||'')}</strong>${a.credentials?', '+esc(a.credentials):''}<br>${esc(a.bio||sec.text||'')}`+(a.url?`<br><a href="${esc(a.url)}">Profile</a>`:'')+'</p>')],{width:{unit:'%',size:80},width_mobile:{unit:'%',size:100}}));
    els.push(this.c(row,{flex_direction:'row',flex_align_items:'center',flex_gap:{column:'20',row:'12',unit:'px',size:20}}));
    return this.section(els,Object.assign({},sec,{width:'narrow'}));
  }
  s_links(sec){const items=sec.items||this.page.internal_links||[]; const lst=this.w('icon-list',{icon_list:items.map(it=>({text:it.anchor,link:{url:it.url,is_external:''},selected_icon:{value:'fas fa-arrow-right',library:'fa-solid'},_id:eid()})),view:'traditional'}); return this.section([this.heading(sec.heading||'Related','h2'),lst],Object.assign({},sec,{width:'narrow'}));}
  s_html(sec){return this.section([this.w('html',{html:sec.html})],sec);}
  stickyBar(){
    const p=this.cta.primary||{}; const tl=p.phone?tel(p.phone):null;
    const a=(tl?`<a class="forge-sticky-call" href="${esc(tl)}">Call now</a>`:'')+(p?`<a class="forge-sticky-cta" href="${esc(p.url||'#contact')}">${esc(p.label||'Get started')}</a>`:'');
    const css=`<style>.forge-sticky{display:none}@media(max-width:767px){.forge-sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9999;gap:8px;padding:10px 12px;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.14)}.forge-sticky a{flex:1;text-align:center;padding:12px;border-radius:8px;font-weight:700;text-decoration:none}.forge-sticky-call{background:${this.accent};color:#111}.forge-sticky-cta{background:${this.primary};color:#fff}body{padding-bottom:70px}}</style>`;
    return {id:eid(),elType:'container',settings:{content_width:'full',padding:box(0),css_classes:'forge-sticky-wrap'},elements:[this.w('html',{html:css+'<div class="forge-sticky">'+a+'</div>'})],isInner:false};
  }
  /* ---------- drivers ---------- */
  elementor(){
    const out=[];
    for(const sec of this.bp.sections){ const fn=this['s_'+sec.type]; if(!fn){this.warnings.push(`unknown section type ${sec.type} skipped`);continue;} out.push(fn.call(this,sec)); }
    if((this.page.conversion||{}).sticky_mobile_bar!==false&&this.cta.primary) out.push(this.stickyBar());
    return out;
  }
  pageSettings(){const ps={hide_title:'yes',template:this.page.template||'default'}; if(this.page.custom_css) ps.custom_css=this.page.custom_css; return ps;}
  templateFile(content){return {content,page_settings:this.pageSettings(),version:'0.4',title:this.page.title||this.page.h1,type:'page'};}
  /* ---------- semantic html ---------- */
  html(){
    const pg=this.page, out=[];
    const h=(tag,s,cls)=>`<${tag}${cls?' class="'+cls+'"':''}>${esc(s)}</${tag}>`;
    for(const sec of this.bp.sections){
      const t=sec.type, sid=sec.id||slug(sec.heading||t); let body='';
      switch(t){
        case 'hero':{ const md=sec.media?this.m(sec.media):null;
          body=(sec.eyebrow?h('p',sec.eyebrow,'forge-eyebrow'):'')+h('h1',sec.h1||pg.h1)+(sec.lede?h('p',sec.lede,'forge-lede'):'')+this.htmlCtas(sec.cta||['primary']);
          if(sec.trust!==false&&pg.conversion&&pg.conversion.trust) body+='<ul class="forge-trust">'+pg.conversion.trust.map(x=>h('li',x)).join('')+'</ul>';
          if(md) body=`<div class="forge-split"><div>${body}</div><div>${this.htmlMedia(md,true)}</div></div>`; break; }
        case 'answer': body=h('h2',sec.heading||'The short answer')+`<p class="forge-answer"><strong>${esc(sec.body)}</strong></p>`; break;
        case 'key_facts': body=(sec.heading?h('h2',sec.heading):'')+'<dl class="forge-facts">'+sec.items.map(i=>`<div><dt>${esc(i.value)}</dt><dd>${esc(i.label)}`+(i.source?` <small>(${esc(i.source)})</small>`:'')+'</dd></div>').join('')+'</dl>'; break;
        case 'rich_text': body=(sec.heading?h(sec.tag||'h2',sec.heading):'')+sec.html; break;
        case 'steps': body=h('h2',sec.heading||'How it works')+'<ol class="forge-steps">'+sec.steps.map(s=>`<li><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')+'</ol>'; break;
        case 'features': body=h('h2',sec.heading)+(sec.text?h('p',sec.text):'')+'<div class="forge-grid">'+sec.items.map(i=>`<div class="forge-card"><h3>${i.url?`<a href="${esc(i.url)}">${esc(i.title)}</a>`:esc(i.title)}</h3><p>${esc(i.text)}</p></div>`).join('')+'</div>'; break;
        case 'media': body=(sec.heading?h('h2',sec.heading):'')+this.htmlMedia(this.m(sec.media))+(sec.caption?`<p><small>${esc(sec.caption)}</small></p>`:''); break;
        case 'video': body=(sec.heading?h('h2',sec.heading):'')+this.htmlMedia(this.m(sec.media))+(sec.transcript?`<details><summary>Video transcript</summary><p>${esc(sec.transcript)}</p></details>`:''); break;
        case 'gallery': body=(sec.heading?h('h2',sec.heading):'')+'<div class="forge-grid">'+sec.media.map(k=>this.htmlMedia(this.m(k))).join('')+'</div>'; break;
        case 'testimonials': body=h('h2',sec.heading||'What clients say')+'<div class="forge-grid">'+sec.items.map(i=>`<blockquote class="forge-card"><p>${esc(i.quote)}</p><footer>${esc(i.name||'')}${i.role?', '+esc(i.role):''}${i.rating?' · '+i.rating+'/5':''}</footer></blockquote>`).join('')+'</div>'; break;
        case 'stats': body=(sec.heading?h('h2',sec.heading):'')+'<dl class="forge-facts forge-stats">'+sec.items.map(i=>`<div><dt>${esc(i.value)}</dt><dd>${esc(i.label)}</dd></div>`).join('')+'</dl>'; break;
        case 'faq': body=h('h2',sec.heading||'Frequently asked questions')+sec.items.map(i=>`<details class="forge-faq"><summary><h3>${esc(i.q)}</h3></summary><p>${esc(i.a)}</p></details>`).join(''); break;
        case 'cta_band': body=h('h2',sec.heading)+(sec.text?h('p',sec.text):'')+this.htmlCtas(sec.cta||['primary']); break;
        case 'form': body=(sec.heading?h('h2',sec.heading):'')+(sec.text?h('p',sec.text):'')+this.htmlForm(); break;
        case 'map': body=(sec.heading?h('h2',sec.heading):'')+`<p class="forge-address">${esc(sec.address)}</p>`+(sec.text?h('p',sec.text):''); break;
        case 'table': body=(sec.heading?h('h2',sec.heading):'')+'<div class="forge-tablewrap"><table class="forge-table"><thead><tr>'+sec.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')+'</tr></thead><tbody>'+sec.rows.map(r=>'<tr>'+r.map(v=>`<td>${esc(v)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>'; break;
        case 'authors':{ const a=pg.author||{}; body=h('h2',sec.heading||'Reviewed by')+`<p class="forge-author"><strong>${esc(a.name||'')}</strong>${a.credentials?', '+esc(a.credentials):''}<br>${esc(a.bio||sec.text||'')}`+(a.url?` <a href="${esc(a.url)}">Profile</a>`:'')+'</p>'; break; }
        case 'links':{ const items=sec.items||pg.internal_links||[]; body=h('h2',sec.heading||'Related')+'<ul class="forge-links">'+items.map(i=>`<li><a href="${esc(i.url)}">${esc(i.anchor)}</a></li>`).join('')+'</ul>'; break; }
        case 'html': body=sec.html; break;
      }
      out.push(`<section id="${esc(sid)}" class="forge-section forge-sec-${t} forge-${sec.style||'light'}"><div class="forge-inner${sec.width==='narrow'?' forge-narrow':''}">${body}</div></section>`);
    }
    return out.join('\n');
  }
  htmlCtas(keys){let a=''; for(const k of (keys||[])){ const cta=typeof k==='string'?this.cta[k]:k; if(!cta) continue; if(cta.url) a+=`<a class="forge-btn forge-btn-${typeof k==='string'?k:'primary'}" href="${esc(cta.url)}">${esc(cta.label)}</a> `; if(cta.phone) a+=`<a class="forge-btn forge-btn-secondary" href="${esc(tel(cta.phone))}">${esc(cta.phone_label||('Call '+cta.phone))}</a> `; } return a?`<p class="forge-ctas">${a}</p>`:'';}
  htmlMedia(md,priority){
    if(md.kind==='video'){ const u=md.url; if(/youtube\.com|youtu\.be/.test(u)){ const m=u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/); return `<div class="forge-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${m?m[1]:''}" title="${esc(md.alt||'Video')}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`; }
      return `<video controls preload="metadata" playsinline${md.poster?' poster="'+esc(md.poster)+'"':''}><source src="${esc(u)}" type="${esc(md.mime||'video/mp4')}">${esc(md.alt||'')}</video>`; }
    const wh=md.width&&md.height?` width="${md.width}" height="${md.height}"`:'';
    return `<img src="${esc(md.url)}" alt="${esc(md.alt||'')}"${wh}${priority?'':' loading="lazy"'}${priority?' fetchpriority="high"':''} decoding="async">`;
  }
  htmlForm(){
    const f=(this.page.conversion||{}).form||{}; if(f.shortcode) return f.shortcode;
    const fields=f.fields&&f.fields.length?f.fields:DEF_FIELDS; const consent=f.consent||DEF_CONSENT;
    const rows=fields.map(x=>`<label>${esc(x.label)}`+(x.type==='textarea'?`<textarea name="${esc(x.id)}"${x.required?' required':''}></textarea>`:`<input type="${esc(x.type)}" name="${esc(x.id)}"${x.required?' required':''}>`)+'</label>').join('');
    return `<form class="forge-form" method="post" action="${esc(f.action||'/wp-json/forge/v1/lead')}" data-forge-form><input type="hidden" name="page" value="${esc(this.page.slug)}"><input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">${rows}<label class="forge-consent"><input type="checkbox" name="consent" value="yes" required> ${esc(consent)}</label><button type="submit" class="forge-btn forge-btn-primary">${esc(f.button||'Send my request')}</button><p class="forge-form-msg" aria-live="polite"></p></form>`+FORM_JS;
  }
  /* ---------- schema ---------- */
  schema(){
    const pg=this.page, site=this.site, base=(site.url||'').replace(/\/+$/,''); const url=pg.canonical||`${base}/${String(pg.slug).replace(/^\/+|\/+$/g,'')}/`;
    const ent=pg.entity||null; const org=ent?Object.assign({},ent):{'@type':'Organization',name:this.brand.name||site.name||''};
    if(!org['@type']) org['@type']='Organization'; if(!org.url) org.url=base+'/'; org['@id']=base+'/#organization'; if(this.brand.logo_url) org.logo=this.brand.logo_url;
    const graph=[org];
    const web={'@type':'WebPage','@id':url+'#webpage',url,name:pg.title||pg.h1,description:pg.meta_description||'',inLanguage:pg.language||'en-US',isPartOf:{'@id':base+'/#website'},about:{'@id':org['@id']}};
    const d=pg.dates||{}; if(d.published) web.datePublished=d.published; if(d.modified) web.dateModified=d.modified;
    const hero=this.bp.sections.find(s=>s.type==='hero'&&s.media); if(hero){const md=this.m(hero.media); web.primaryImageOfPage={'@type':'ImageObject',url:md.url};}
    if(this.bp.sections.some(s=>s.type==='answer')) web.speakable={'@type':'SpeakableSpecification',cssSelector:['.forge-answer','h1']};
    if(pg.author){ const a=pg.author; const per={'@type':'Person',name:a.name}; if(a.url) per.url=a.url; if(a.credentials) per.jobTitle=a.credentials; web.reviewedBy=per; graph.push(per); }
    graph.push(web);
    graph.push({'@type':'WebSite','@id':base+'/#website',url:base+'/',name:this.brand.name||site.name||'',publisher:{'@id':org['@id']}});
    if(pg.breadcrumbs) graph.push({'@type':'BreadcrumbList',itemListElement:pg.breadcrumbs.concat([{name:pg.h1,url}]).map((b,i)=>({'@type':'ListItem',position:i+1,name:b.name,item:b.url.startsWith('/')?base+b.url:b.url}))});
    const faq=this.bp.sections.find(s=>s.type==='faq'); if(faq) graph.push({'@type':'FAQPage',mainEntity:faq.items.map(i=>({'@type':'Question',name:i.q,acceptedAnswer:{'@type':'Answer',text:i.a}}))});
    const steps=this.bp.sections.find(s=>s.type==='steps'&&s.howto); if(steps) graph.push({'@type':'HowTo',name:steps.heading||pg.h1,step:steps.steps.map(st=>({'@type':'HowToStep',name:st.title,text:st.text}))});
    if(['service','practice','location'].includes(pg.archetype)&&pg.service){ const sv=Object.assign({},pg.service); if(!sv['@type']) sv['@type']='Service'; if(!sv.name) sv.name=pg.h1; sv.provider={'@id':org['@id']}; if(!sv.url) sv.url=url; graph.push(sv); }
    if(pg.archetype==='article'){ const art={'@type':'Article',headline:pg.h1,mainEntityOfPage:{'@id':url+'#webpage'},publisher:{'@id':org['@id']}}; if(pg.author) art.author={'@type':'Person',name:pg.author.name}; if(d.published) art.datePublished=d.published; if(d.modified) art.dateModified=d.modified; graph.push(art); }
    const vid=this.bp.sections.find(s=>s.type==='video'); if(vid){ const md=this.m(vid.media); const vo={'@type':'VideoObject',name:vid.heading||pg.h1,description:vid.description||pg.meta_description||'',uploadDate:d.published||''}; vo[/youtube|vimeo/.test(md.url)?'embedUrl':'contentUrl']=md.url; if(vid.poster) vo.thumbnailUrl=this.m(vid.poster).url; if(vid.transcript) vo.transcript=vid.transcript; graph.push(vo); }
    (pg.schema_extra||[]).forEach(x=>graph.push(x));
    return {'@context':'https://schema.org','@graph':graph};
  }
  seo(){const pg=this.page; const hero=this.bp.sections.find(s=>s.type==='hero'&&s.media); return {title:pg.title||pg.h1,description:pg.meta_description||'',canonical:pg.canonical||'',noindex:!!pg.noindex,og_image:hero?this.m(hero.media).url:''};}
  lint(){
    const pg=this.page, w=[]; const S=this.bp.sections;
    if((pg.title||'').length>60) w.push(`title ${pg.title.length} chars (aim ≤ 60)`);
    const md=(pg.meta_description||'').length; if(md<70||md>160) w.push(`meta description ${md} chars (aim 120–158)`);
    if(!S.some(s=>s.type==='answer')) w.push('no answer capsule (AI-citable direct answer) — add an "answer" section right after the hero');
    if(!S.some(s=>s.type==='faq')) w.push('no FAQ section — add 4–8 real questions');
    if(S.filter(s=>s.type==='hero').length!==1) w.push('exactly one hero required');
    const h1=S.find(s=>s.type==='hero'); if(h1&&((h1.h1||pg.h1)||'').length>70) w.push('H1 over 70 chars');
    for(const k in (this.bp.media||{})) if(!this.bp.media[k].alt) w.push(`media "${k}" has no alt text`);
    if(!(pg.cta||{}).primary) w.push('no primary CTA');
    if(!pg.internal_links||!pg.internal_links.length) w.push('no internal links declared (verify each against the live sitemap before adding)');
    const blob=JSON.stringify(this.bp).toLowerCase();
    for(const bad of ['[[verify','lorem ipsum','todo:','xxx','placeholder text']) if(blob.includes(bad)) w.push(`BLOCK: "${bad}" found in the blueprint — resolve before deploy`);
    return w.concat(this.warnings);
  }
}
function previewPage(f,body,schema,seo){
  const b=f.brand, p=f.cta.primary||{}; const tl=p.phone?tel(p.phone):null;
  const sticky=((f.page.conversion||{}).sticky_mobile_bar!==false)?('<div class="forge-sticky">'+(tl?`<a class="forge-sticky-call" href="${esc(tl)}">Call now</a>`:'')+(p?`<a class="forge-sticky-cta" href="${esc(p.url||'#contact')}">${esc(p.label||'Get started')}</a>`:'')+'</div>'):'';
  const css=PREVIEW_CSS.replace(/%p/g,f.primary).replace(/%a/g,f.accent).replace(/%t/g,f.tint).replace(/%d/g,f.dark).replace(/%font/g,b.font_body||'system-ui, -apple-system, Segoe UI, Roboto, sans-serif').replace(/%hfont/g,b.font_heading||'inherit');
  return `<!DOCTYPE html><html lang="${esc((f.page.language||'en-US').slice(0,2))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(seo.title)}</title><meta name="description" content="${esc(seo.description)}"><style>${css}</style><scr`+`ipt type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</`+`script></head><body><main>${body}</main>${sticky}</body></html>`;
}
function compile(bp,media){
  const f=new Forge(bp,media||{}); const content=f.elementor(); const html=f.html(); const schema=f.schema(); const seo=f.seo();
  return {template:f.templateFile(content),elementor_data:content,page_settings:f.pageSettings(),html,preview:previewPage(f,html,schema,seo),schema,seo,lint:f.lint(),page:bp.page,blueprint:bp};
}
function bundle(bp,media,r){
  r=r||compile(bp,media); media=media||{};
  const mr={}; for(const k in media){ const v=media[k]; mr[k]={}; for(const kk of ['id','url','alt','kind','width','height','mime']) if(v[kk]!==undefined) mr[k][kk]=v[kk]; }
  const bp2=Object.assign({},bp,{media_resolved:mr}); const hero=bp.sections.find(x=>x.type==='hero'&&x.media);
  return {slug:bp.page.slug,title:bp.page.title,post_title:bp.page.h1,status:'draft',post_type:bp.page.post_type||'page',template:r.page_settings.template,elementor_data:r.elementor_data,page_settings:r.page_settings,content_html:r.html,seo:r.seo,schema:r.schema,blueprint:bp2,summary:bp.page.summary||'',featured_media:hero&&media[hero.media]?(media[hero.media].id||0):0};
}
return {compile,bundle,esc,slug,tel,hexmix,PREVIEW_CSS,Forge};
})();
