(function(){
"use strict";
/* OmegaWeapon dashboard engine. One page per target domain. Boots from the inline JSON payload (a standalone build) or
   from a host message {type:"omega:data", data} (the OmegaWeapon app hosting it in a frame). Same code either way. */
var D = null, M = {}, MODS = {}, AN = {}, PB = {}, RUN = {}, T = {}, META = {};
var HOSTED = (function(){ try { return window.parent && window.parent !== window; } catch (e) { return true; } })();
function hostPost(msg){ if(!HOSTED) return; try { window.parent.postMessage(msg, "*"); } catch (e) {} }
var MODULE_LABEL = {crawl:"Crawl and index", technical:"Technical", content:"Content", local:"Local", links:"Authority and links", competitors:"Competitors", paid:"Paid media", social:"Social", ai:"AI visibility", apps:"Apps", exposure:"Compliance and exposure", agency:"Agency lens", market:"Market read", copy:"Copy gate"};

/* ---------- DOM helpers: every string enters as a text node; links only for http(s) ---------- */
function el(tag, attrs, kids){ var e=document.createElement(tag); attrs=attrs||{}; for(var k in attrs){ if(attrs[k]==null) continue; if(k==="class") e.className=attrs[k]; else if(k==="text") e.textContent=attrs[k]; else if(k==="style") e.style.cssText=String(attrs[k]); else if(k==="html"){} else e.setAttribute(k, attrs[k]); }
  (kids||[]).forEach(function(c){ if(c==null) return; if(typeof c==="string"||typeof c==="number") e.appendChild(document.createTextNode(String(c))); else e.appendChild(c); }); return e; }
function txt(s){ return document.createTextNode(s==null?"":String(s)); }
function safeUrl(u){ return (typeof u==="string" && /^https?:\/\//i.test(u)) ? u : null; }
function link(u, label){ var s=safeUrl(u); if(!s) return txt(label||u||""); return el("a",{href:s,target:"_blank",rel:"noopener noreferrer",text:label||shortUrl(s)}); }
function shortUrl(u){ try{ var x=new URL(u); var p=x.pathname.length>42?x.pathname.slice(0,40)+"…":x.pathname; return x.host.replace(/^www\./,"")+(p==="/"?"":p);}catch(e){return u;} }
function fmt(n, d){ if(n==null||n==="") return "n/a"; if(typeof n!=="number") return String(n); return d==null? (Math.abs(n)>=1000? n.toLocaleString(): String(Math.round(n*100)/100)) : n.toFixed(d); }
function pct(x){ return x==null? "n/a" : Math.round(x*100)+"%"; }
function chip(text, cls){ return el("span",{class:"chip "+(cls||"na"),text:text}); }
function gradeCls(g){ if(g==="A"||g==="B") return "good"; if(g==="C") return "warn"; if(g==="D"||g==="F") return "bad"; return "na"; }
function sevCls(s){ return s==="High"?"bad": s==="Medium"?"warn": s==="Win"?"good": s==="Low"?"acc":"na"; }
function dispCls(d){ return d==="CONFIRMED"?"bad": d==="CANDIDATE"?"warn": d==="CLEARED"?"good":"na"; }
function evCls(e){ return e==="observed"?"good": e==="inferred"?"warn":"na"; }
function statusCls(s){ return s==="run"?"good": s==="partial"?"warn": s==="blocked"?"bad":"na"; }
function gradeBox(g){ var k=(g==="?")?"Q":(g||"NA"); return el("span",{class:"grade "+k,text:g||"NA","aria-label":"grade "+(g||"not assessed")}); }
function sec(title, aside, kids){ var s=el("section",{class:"sec"}); s.appendChild(el("div",{class:"sec-head"},[el("h2",{text:title}), aside? el("span",{class:"aside",text:aside}):null])); (kids||[]).forEach(function(k){ if(k) s.appendChild(k); }); return s; }
function card(kids, cls){ return el("div",{class:"card"+(cls?" "+cls:"")}, kids); }
function h3(t){ return el("h3",{text:t}); }
function h4(t){ return el("h4",{text:t}); }
function p(t, cls){ return el("p",{class:cls||"",text:t}); }
function empty(t){ return el("p",{class:"empty",text:t||"No rows recorded."}); }
function list(items){ var u=el("ul"); (items||[]).forEach(function(i){ u.appendChild(el("li",{}, typeof i==="string"?[i]:[i])); }); return u; }
function kv(label, value){ var d=el("div",{class:"row small"}); d.appendChild(el("span",{class:"muted",text:label+": "})); if(typeof value==="string"||typeof value==="number") d.appendChild(txt(value)); else if(value) d.appendChild(value); return d; }

/* table: cols = [{k, label, cls, render(row)}] */
function table(cols, rows, opts){ opts=opts||{}; if(!rows||!rows.length) return empty(opts.emptyText); var t=el("table"); var thead=el("thead"); var tr=el("tr"); cols.forEach(function(c){ tr.appendChild(el("th",{text:c.label})); }); thead.appendChild(tr); t.appendChild(thead);
  var tb=el("tbody"); rows.forEach(function(r){ var trr=el("tr"); cols.forEach(function(c){ var td=el("td",{class:c.cls||""}); var v=c.render? c.render(r): r[c.k]; if(v==null||v==="") td.appendChild(txt(c.k==="url"?"":"")); else if(typeof v==="object" && v.nodeType) td.appendChild(v); else if(Array.isArray(v)) td.appendChild(txt(v.join("; "))); else if(typeof v==="object") td.appendChild(txt(JSON.stringify(v))); else if(typeof v==="boolean") td.appendChild(chip(v?"yes":"no", v?"good":"na")); else td.appendChild(txt(v)); trr.appendChild(td); }); tb.appendChild(trr); }); t.appendChild(tb);
  var w=el("div",{class:"tblwrap"},[t]); return w; }
function bar(label, val, max, cls, valText){ var w=Math.max(0,Math.min(1,(max?val/max:0))); var b=el("div",{class:"bar"},[el("span",{class:"lab",text:label}), el("span",{class:"trk"},[el("span",{class:"fil "+(cls||""),style:"width:"+(w*100).toFixed(1)+"%"})]), el("span",{class:"val",text:valText!=null?valText:fmt(val)})]); return b; }
function diverge(label, z, zmax, cls, subtext){ var half=Math.min(1,Math.abs(z)/zmax)*50; var f=el("span",{class:"fil",style:(z>=0?"left:50%;":"right:50%;")+"width:"+half.toFixed(1)+"%;background:"+(z>=0?"var(--moon-bar)":"var(--sun-bar)")}); return el("div",{class:"diverge"},[el("span",{class:"lab",text:label}), el("span",{class:"trk"},[el("span",{class:"mid"}), f]), el("span",{class:"z",text:(z>0?"+":"")+z.toFixed(2)})]); }
function stacked(parts){ var total=parts.reduce(function(a,b){return a+b.v;},0)||1; var s=el("div",{class:"stacked"}); parts.forEach(function(x){ s.appendChild(el("span",{style:"width:"+(x.v/total*100).toFixed(1)+"%;background:"+x.color,title:x.label+": "+x.v})); }); var lg=el("div",{class:"legend"}); parts.forEach(function(x){ lg.appendChild(el("span",{},[el("i",{style:"background:"+x.color}), txt(x.label+" "+x.v)])); }); return el("div",{class:"stack"},[s,lg]); }
function icdBar(range){ var nums=(String(range||"").match(/\d+/g)||[]).map(Number); var lo=nums[0]||0, hi=nums[1]||lo; return el("div",{class:"icd"},[el("div",{class:"trk"},[el("div",{class:"fil",style:"left:"+lo+"%;width:"+Math.max(1,hi-lo)+"%"})]), el("span",{class:"mono small",text:lo+" to "+hi+"%"})]); }
function findingsTable(rows, opts){ opts=opts||{}; return table([
  {label:"ID",k:"id",cls:"num"},
  {label:"Severity",render:function(r){return chip(r.severity, sevCls(r.severity));}},
  {label:"Finding",cls:"wrap",render:function(r){ var d=el("div",{},[el("div",{text:r.title}), el("div",{class:"small muted",text:r.evidence||""})]); return d;}},
  {label:"Evidence",render:function(r){return chip(r.evidence_class, evCls(r.evidence_class));}},
  {label:"Fix",cls:"wrap",k:"fix"},
  {label:"Owner",k:"owner"},
  {label:"Module",render:function(r){return MODULE_LABEL[r.module]||r.module;}},
  {label:"Link",render:function(r){return link(r.url);}}
], rows, {emptyText:opts.emptyText||"No findings recorded for this module."}); }
function modFindings(mid){ return (D.findings||[]).filter(function(f){return f.module===mid;}); }
function modStatusLine(mid){ var m=MODS[mid]||{}; var d=el("div",{class:"row small"},[chip((m.status||"not_run").replace("_"," "), statusCls(m.status))]); if(m.why) d.appendChild(el("span",{class:"muted",text:m.why})); if(m.sources&&m.sources.length) d.appendChild(el("span",{class:"muted",text:"Sources: "+m.sources.join(", ")})); return d; }
function ran(mid){ var s=(MODS[mid]||{}).status; return s==="run"||s==="partial"||s==="blocked"; }

/* ---------- masthead ---------- */
function mast(){ var eye=document.getElementById("m-eyebrow"); eye.textContent = META.name_on_page? "OmegaWeapon run": "Digital position, exposure and market read";
  document.getElementById("m-title").textContent = T.business_name || T.domain;
  document.getElementById("m-sub").textContent = [T.domain, T.recipient? "Prepared for "+T.recipient: null, META.archetype_label, T.geography&&T.geography.label? T.geography.label: null].filter(Boolean).join("  ·  ");
  var dk=document.getElementById("m-docket"); [["Run", RUN.run_date+"  "+(RUN.id||"")],["Access tier", "Tier "+(RUN.tier==null?"0":RUN.tier)],["Posture", T.posture||""],["Overall", (M.overall&&M.overall.grade||"NA")+"  ("+(M.overall?M.overall.pillars_graded:0)+" of "+(M.overall?M.overall.pillars_total:0)+" pillars graded)"]].forEach(function(kvp){ var d=el("div"); d.appendChild(el("dt",{text:kvp[0]})); d.appendChild(el("dd",{text:kvp[1]})); dk.appendChild(d); });
  document.getElementById("foot").textContent = "Built "+(META.built_at||"")+" from run "+(RUN.id||"")+". Doctrine dated "+(META.doctrine_date||"")+". Every number on this page is computed from the run manifest; grades follow the constants on the Method tab. Nothing here is a guarantee of any outcome.";
  var rad = radarOfRecord(); if (rad) { var d=el("div"); d.appendChild(el("dt",{text:"Agency of record"})); d.appendChild(el("dd",{text:rad.name+(rad.ok? "  ("+rad.band+" "+signedNum(rad.hti)+")": "")})); dk.appendChild(d); }
}
/* the Radar block the platform attaches when the agency of record is one of the tracked agencies */
function radarOfRecord(){ var of=(MODS.agency||{}).of_record||{}; return of.radar && of.radar.id ? of.radar : null; }
function signedNum(v){ if(v==null) return ""; var r=Math.round(v); return (r>0?"+":r<0?"-":"")+Math.abs(r); }
function radarNav(hash, label){ var a=el("a",{href:"#"+hash.replace(/^#/,""),text:label,class:"radar-link"}); a.addEventListener("click",function(ev){ ev.preventDefault(); if(HOSTED) hostPost({type:"omega:nav", hash:hash}); }); return a; }

/* ---------- tabs ---------- */
var TABS = [
 {id:"brief", label:"Brief", render:renderBrief},
 {id:"site", label:"Site and crawl", mods:["crawl","technical"], render:renderSite},
 {id:"content", label:"Content", mods:["content","copy"], render:renderContent},
 {id:"local", label:"Local", mods:["local"], render:renderLocal},
 {id:"authority", label:"Authority", mods:["links"], render:renderAuthority},
 {id:"competitors", label:"Competitors", mods:["competitors"], render:renderCompetitors},
 {id:"paid", label:"Paid", mods:["paid"], render:renderPaid},
 {id:"social", label:"Social", mods:["social"], render:renderSocial},
 {id:"ai", label:"AI visibility", mods:["ai"], render:renderAI},
 {id:"apps", label:"Apps", mods:["apps"], render:renderApps},
 {id:"exposure", label:"Exposure", mods:["exposure"], render:renderExposure, count:function(){return (D.exposure||[]).length;}},
 {id:"agency", label:"Agency lens", mods:["agency"], render:renderAgency},
 {id:"market", label:"Market", mods:["market"], render:renderMarket},
 {id:"forecast", label:"Forecast", render:renderForecast, count:function(){return (AN.key_judgments||[]).length;}},
 {id:"playbook", label:"Playbook", render:renderPlaybook, count:function(){return (D.tasks||[]).length;}},
 {id:"ledger", label:"Ledger", render:renderLedger, count:function(){return (D.findings||[]).length;}},
 {id:"method", label:"Method", render:renderMethod}
];
var tabsEl, main, panels={};
function buildTabs(){ tabsEl=document.getElementById("tabs"); main=document.getElementById("main"); panels={};
TABS.forEach(function(t){ var off = t.mods && !t.mods.some(ran); var b=el("button",{class:"tab"+(off?" off":""),role:"tab","aria-selected":"false","aria-controls":"panel-"+t.id,id:"tab-"+t.id},[t.label]); var n = t.count? t.count() : (t.mods? t.mods.reduce(function(a,m){return a+modFindings(m).length;},0):0); if(n) b.appendChild(el("span",{class:"n",text:String(n)})); if(off) b.appendChild(el("span",{class:"n",text:"not run"})); b.addEventListener("click",function(){ select(t.id); history.replaceState(null,"","#"+t.id); }); tabsEl.appendChild(b);
  var pnl=el("div",{class:"panel tabpanel",role:"tabpanel",id:"panel-"+t.id,hidden:"hidden","aria-labelledby":"tab-"+t.id}); main.appendChild(pnl); panels[t.id]={tab:t,el:pnl,done:false}; });
}
function select(id){ if(!panels[id]) id="brief"; hostPost({type:"omega:tab", tab:id}); Object.keys(panels).forEach(function(k){ var pn=panels[k]; var on=k===id; pn.el.hidden=!on; document.getElementById("tab-"+k).setAttribute("aria-selected", on?"true":"false"); if(on&&!pn.done){ try{ pn.tab.render(pn.el); }catch(e){ pn.el.appendChild(card([p("This section could not render: "+e.message)])); } pn.done=true; } }); }
window.addEventListener("hashchange",function(){ select(location.hash.slice(1)||"brief"); });
window.addEventListener("message",function(ev){ var m=ev.data||{}; if(m.type==="omega:select" && D && panels[m.tab]) { select(m.tab); window.scrollTo(0,0); } if(m.type==="omega:theme"){ if(m.theme==="light"||m.theme==="dark") document.documentElement.setAttribute("data-theme", m.theme); else document.documentElement.removeAttribute("data-theme"); } });
document.addEventListener("click",function(ev){ var a=ev.target.closest&&ev.target.closest("a[data-tab]"); if(a){ ev.preventDefault(); select(a.getAttribute("data-tab")); history.replaceState(null,"","#"+a.getAttribute("data-tab")); window.scrollTo(0,0);} });
function tabLink(id,label){ return el("a",{href:"#"+id,"data-tab":id,text:label}); }

/* ---------- Brief ---------- */
function renderBrief(root){
  var sc=M.scorecard||{}, hc=M.honest_count||{}, cov=M.coverage||{};
  root.appendChild(sec("The brief", "Run "+(RUN.run_date||""), [
    card([ el("p",{class:"eyebrow",text:"Headline"}), el("h3",{text:AN.headline||"Headline pending: the analysis of record has not been written for this run."}), el("div",{class:"stack",style:"margin-top:10px"}, (AN.bluf||[]).map(function(x){return p(x,"lede");})) ]),
    el("div",{class:"grid-3"},[
      card([h4("Win"), p((AN.win_watch_next||{}).win||"pending")]),
      card([h4("Watch"), p((AN.win_watch_next||{}).watch||"pending")]),
      card([h4("Next"), p((AN.win_watch_next||{}).next||"pending")])
    ])
  ]));
  /* coverage strip */
  var strip=el("div",{class:"strip"}); strip.appendChild(chip("Tier "+(RUN.tier==null?0:RUN.tier), "acc")); strip.appendChild(chip((RUN.presence&&RUN.presence.mode==="honest")?"Presence: DECLARED":"Presence: "+((RUN.presence||{}).mode||"unknown"), "acc"));
  (cov.modules||[]).forEach(function(r){ strip.appendChild(chip(MODULE_LABEL[r.module]+": "+r.status.replace("_"," "), statusCls(r.status))); });
  var blocked=(cov.blocked||[]).map(function(b){return b.surface+": "+b.why;});
  root.appendChild(sec("Coverage: what this run could and could not see", (cov.run||0)+" run, "+(cov.partial||0)+" partial, "+(cov.not||0)+" not assessed", [
    card([ strip, el("div",{style:"margin-top:12px"},[ kv("Presence line", (RUN.presence||{}).line||"not recorded"), kv("Vantage", (RUN.presence||{}).vantage||""), kv("Fetches", (RUN.fetches_used||0)+" of a "+(RUN.fetch_budget||0)+" budget") ]),
           blocked.length? el("div",{style:"margin-top:10px"},[h4("Blocked or not fetchable from here"), list(blocked)]) : null,
           el("div",{class:"grid-2",style:"margin-top:10px"},[ el("div",{},[h4("Exports supplied"), (RUN.exports_supplied||[]).length? list(RUN.exports_supplied): p("None. Every ranking, traffic and spend statement on this page is a protocol until they arrive.","small muted")]), el("div",{},[h4("Exports that would sharpen the next run"), list(RUN.exports_requested||[])]) ]) ])
  ]));
  /* scorecard */
  var tiles=el("div",{class:"grid-4"});
  (D.dict.pillars||[]).forEach(function(pn){ var r=sc[pn]||{grade:"NA"}; var g=r.grade||"NA"; var d=[]; if(r.confidence) d.push("confidence "+r.confidence); if(r.n!=null) d.push(r.n+" finding"+(r.n===1?"":"s")); if(r.weight&&r.weight!==1) d.push("weight "+r.weight); if(r.override) d.push("analyst grade; computed "+r.computed_grade); var t=el("div",{class:"tile"+((g==="NA"||g==="?")?" dim":"")},[gradeBox(g), el("div",{},[el("div",{class:"t",text:pn}), el("div",{class:"d",text:d.join(" · ")}), r.why? el("div",{class:"d",text:r.why}):null])]); tiles.appendChild(t); });
  root.appendChild(sec("Where you stand", "Overall "+((M.overall||{}).grade||"NA")+"; grades are computed, see Method", [tiles, el("p",{class:"small muted",text:"NA: the module did not run. ?: the read was partial and nothing could be graded. A grade never rests on unverified evidence; unverified rows lower confidence, not the letter."})]));
  /* three ones + honest count */
  root.appendChild(sec("The three that matter", null, [ el("div",{class:"grid-3"},[
    card([h4("The one rival to watch"), p(AN.one_rival||"pending")]),
    card([h4("The one paid opportunity"), p(AN.one_paid_opportunity||"pending")]),
    card([h4("The one exposure that could stop the lights"), p(AN.one_exposure||"pending")]) ]),
    card([h4("The honest count"), el("p",{class:"lede",text:hc.sentence||""}), el("p",{class:"small muted",text:"Compliance coverage: "+((hc.coverage||{}).testable||0)+" of "+((hc.coverage||{}).families||0)+" clause families testable from here. "}), el("p",{class:"small"},[tabLink("exposure","Open the exposure table")])], "tint") ]));
  /* key judgments short */
  var kjs=(AN.key_judgments||[]);
  if(kjs.length){ var wrap=el("div",{class:"stack"}); kjs.forEach(function(k){ wrap.appendChild(el("div",{class:"kj"},[ el("div",{class:"hd"},[el("strong",{text:k.id+"  "+k.title}), chip(k.likelihood, "moon"), chip("confidence "+k.confidence,"na"), chip(k.horizon,"acc")]), p(k.judgment), icdBar(k.range) ])); }); root.appendChild(sec("Key judgments", "ICD 203 terms; evidence and falsifiers on the Forecast tab", [wrap])); }
  /* momentum */
  var mo=M.momentum; if(mo){ var rows=Object.keys(mo.grade_delta||{}).map(function(k){var g=mo.grade_delta[k]; return {pillar:k, from:g.from, to:g.to, delta:g.delta};}); root.appendChild(sec("Since the previous run", mo.previous_run+" ("+mo.previous_date+")", [ el("div",{class:"grid-2"},[ card([h4("Grade movement"), table([{label:"Pillar",k:"pillar"},{label:"From",render:function(r){return gradeBox(r.from||"NA");}},{label:"To",render:function(r){return gradeBox(r.to||"NA");}},{label:"Change",render:function(r){ return r.delta==null? chip("n/a","na"): r.delta>0? chip("improved "+r.delta,"good"): r.delta<0? chip("worse "+(-r.delta),"bad"): chip("held","na"); }}], rows)]), card([h4("Findings resolved"), mo.findings_resolved.length? list(mo.findings_resolved.map(function(f){return f.id+" "+f.title;})): p("None","small muted"), h4("New findings"), mo.findings_new.length? list(mo.findings_new.map(function(f){return f.id+" "+f.title;})): p("None","small muted"), h4("Exposure"), p(Object.keys(mo.exposure_delta).map(function(k){return k+" "+(mo.exposure_delta[k]>0?"+":"")+mo.exposure_delta[k];}).join(", "),"small")]) ]), p(mo.frame_note,"small muted") ])); }
  var jc=RUN.judgment_calls||[]; if(jc.length) root.appendChild(sec("Judgment calls made in this run", null, [card([list(jc)])]));
}

/* ---------- Site and crawl ---------- */
function renderSite(root){
  var cr=MODS.crawl||{}, te=MODS.technical||{}, cm=M.crawl||{};
  root.appendChild(sec("Crawl and index", null, [modStatusLine("crawl"),
    el("div",{class:"grid-2"},[
      card([h4("Index status of fetched pages"), cm.n? stacked([{label:"indexable",v:cm.status.indexable||0,color:"var(--good)"},{label:"noindex or blocked",v:cm.status["noindex or blocked"]||0,color:"var(--warn)"},{label:"redirect",v:cm.status.redirect||0,color:"var(--moon-bar)"},{label:"error",v:cm.status.error||0,color:"var(--bad)"},{label:"unfetched",v:cm.status.unfetched||0,color:"var(--na)"}]) : empty("No pages recorded."), el("p",{class:"small muted",style:"margin-top:8px",text:"Whether Google actually indexed a URL is closed by GSC URL Inspection and the Pages report, run by the owner. The crawl cannot see it."})]),
      card([h4("Summary"), el("div",{class:"grid-4"}, Object.keys(cr.summary||{}).map(function(k){ return el("div",{class:"kpi"},[el("div",{class:"v mono",text:fmt(cr.summary[k])}), el("div",{class:"l",text:k.replace(/_/g," ")})]); })), Object.keys(cm.depth||{}).length? el("div",{style:"margin-top:10px"},[h4("Click depth"), el("div",{class:"stack"}, Object.keys(cm.depth).map(function(d){ return bar("depth "+d, cm.depth[d], Math.max.apply(null,Object.values(cm.depth)), "", String(cm.depth[d])); }))]) : null ])
    ]),
    table([{label:"URL",render:function(r){return link(r.url);}},{label:"Status",cls:"num",k:"status"},{label:"Indexable",render:function(r){return r.indexable==null? "": chip(r.indexable?"yes":"no", r.indexable?"good":"warn");}},{label:"Canonical",k:"canonical"},{label:"In sitemap",render:function(r){return r.in_sitemap==null?"":chip(r.in_sitemap?"yes":"no", r.in_sitemap?"good":"na");}},{label:"Depth",cls:"num",k:"depth"},{label:"Raw words",cls:"num",k:"words_raw"},{label:"Rendered",cls:"num",k:"words_rendered"},{label:"JS share",cls:"num",render:function(r){return r.js_share==null?"":pct(r.js_share);}},{label:"LCP lab ms",cls:"num",k:"lcp_lab_ms"},{label:"Money",render:function(r){return r.money? chip("money","acc"):"";}},{label:"Title",cls:"wrap",k:"title"}], (cr.pages||[]).slice().sort(function(a,b){return (b.money?1:0)-(a.money?1:0);}), {emptyText:"No crawl rows. Run google_crawler.py crawl and omega_ingest.py."}),
    (cr.sitemaps||[]).length? card([h4("Sitemaps"), table([{label:"Sitemap",render:function(r){return link(r.url);}},{label:"URLs",cls:"num",k:"urls"},{label:"Children",cls:"num",k:"children"},{label:"Issues",k:"issues"}], cr.sitemaps)]) : null,
    (cr.render||[]).length? card([h4("Render check (mobile, honest launch)"), table([{label:"URL",render:function(r){return link(r.url);}},{label:"Raw words",cls:"num",k:"words_raw"},{label:"Rendered",cls:"num",k:"words_rendered"},{label:"JS share",cls:"num",render:function(r){return pct(r.js_share);}},{label:"LCP lab ms",cls:"num",k:"lcp_lab_ms"},{label:"Verdict",k:"verdict"}], cr.render)]) : null,
    cr.googlebot_verify? card([h4("Googlebot verification"), p(JSON.stringify(cr.googlebot_verify.verdicts||cr.googlebot_verify), "mono small")]) : null,
    findingsTable(modFindings("crawl"))
  ]));
  root.appendChild(sec("Technical", null, [modStatusLine("technical"),
    el("div",{class:"grid-2"},[
      card([h4("Speed and Core Web Vitals"), table([{label:"URL",render:function(r){return link(r.url);}},{label:"LCP p75",cls:"num",render:function(r){return r.lcp_p75==null?"n/a":r.lcp_p75;}},{label:"INP p75",cls:"num",render:function(r){return r.inp_p75==null?"n/a":r.inp_p75;}},{label:"CLS p75",cls:"num",render:function(r){return r.cls_p75==null?"n/a":r.cls_p75;}},{label:"TTFB ms",cls:"num",k:"ttfb_ms"},{label:"Lab LCP ms",cls:"num",k:"lab_lcp_ms"},{label:"Source",k:"source"},{label:"Verdict",cls:"wrap",k:"verdict"}], te.cwv, {emptyText:"No speed rows. Field data needs a PSI key or the GSC Core Web Vitals export; lab data comes from the render probe."}), el("p",{class:"small muted",style:"margin-top:8px",text:"Thresholds at p75: LCP 2.5 s, INP 200 ms, CLS 0.1, TTFB 0.8 s."})]),
      card([h4("Tag inventory"), table([{label:"Tag",k:"tag"},{label:"ID",cls:"num",k:"id"},{label:"Purpose",k:"purpose"},{label:"Load",k:"load"},{label:"Pre-consent",render:function(r){return r.pre_consent==null?"":chip(r.pre_consent?"fires pre-consent":"gated", r.pre_consent?"warn":"good");}},{label:"Owner",k:"owner"}], te.tags, {emptyText:"No tags recorded. The raw scan lists the tag stack; the render log is the firing log."})])
    ]),
    el("div",{class:"grid-2"},[
      card([h4("Bot posture"), table([{label:"Bot",k:"bot"},{label:"Directive",k:"directive"},{label:"Source",k:"source"}], te.bot_posture, {emptyText:"No robots rules recorded."})]),
      card([h4("Headers"), Object.keys(te.headers||{}).length? table([{label:"Header",k:"k"},{label:"Value",render:function(r){return typeof r.v==="boolean"? chip(r.v?"present":"absent", r.v?"good":"warn"): String(r.v);}}], Object.keys(te.headers).map(function(k){return {k:k.replace(/_/g," "),v:te.headers[k]};})) : empty("No headers recorded.")])
    ]),
    (te.redirects||[]).length? card([h4("Redirect map"), table([{label:"From",render:function(r){return link(r.from);}},{label:"To",render:function(r){return link(r.to);}},{label:"Hops",cls:"num",k:"hops"},{label:"Note",k:"note"}], te.redirects)]) : null,
    findingsTable(modFindings("technical"))
  ]));
}

/* ---------- Content ---------- */
function renderContent(root){
  var c=MODS.content||{}, cp=MODS.copy||{};
  root.appendChild(sec("Top pages", null, [modStatusLine("content"),
    table([{label:"URL",render:function(r){return link(r.url);}},{label:"Role",render:function(r){return r.role? chip(r.role, r.role==="money"?"acc":"na"):"";}},{label:"H1",cls:"wrap",k:"h1"},{label:"Title len",cls:"num",k:"title_len"},{label:"Meta len",cls:"num",k:"meta_len"},{label:"Words",cls:"num",k:"words"},{label:"Grade level",cls:"num",k:"grade"},{label:"Passive %",cls:"num",k:"passive_pct"},{label:"Issues",cls:"wrap",k:"issues"}], c.top_pages, {emptyText:"No page rows. The raw scan's text extraction fills this."}),
    (c.demand_map||[]).length? card([h4("Demand map (Autocomplete presence; no volumes are implied)"), table([{label:"Seed",k:"seed"},{label:"Suggestions",cls:"wrap",k:"suggestions"},{label:"Client present",render:function(r){return chip(r.client_present?"present":"absent", r.client_present?"good":"bad");}},{label:"Rivals present",k:"rivals_present"}], c.demand_map)]) : null,
    findingsTable(modFindings("content"))
  ]));
  root.appendChild(sec("Copy gate", "Grammar and readability are corrected; law is flagged, never rewritten", [modStatusLine("copy"),
    el("div",{class:"grid-2"},[ card([h4("Passes run"), (cp.passes_run||[]).length? list(cp.passes_run): empty("No passes recorded."), h4("Readability"), Object.keys(cp.readability||{}).length? list(Object.keys(cp.readability).map(function(k){return k.replace(/_/g," ")+": "+cp.readability[k];})): empty("Not measured.")]),
      card([h4("Flags for an attorney or the owner"), table([{label:"Type",render:function(r){return chip(r.type,"warn");}},{label:"Text",cls:"wrap",k:"text"},{label:"Action",cls:"wrap",k:"action"}], cp.flags, {emptyText:"No copy flags."})]) ]),
    (cp.verify_worklist||[]).length? card([h4("Verification worklist"), list(cp.verify_worklist.map(function(x){return typeof x==="string"?x:JSON.stringify(x);}))]) : null,
    (PB.on_page||[]).length? card([h4("Drop-in titles and descriptions"), table([{label:"URL",render:function(r){return link(r.url);}},{label:"Title",cls:"wrap",k:"title"},{label:"Description",cls:"wrap",k:"description"}], PB.on_page)]) : null
  ]));
}

/* ---------- Local ---------- */
function renderLocal(root){
  var l=MODS.local||{}, rv=M.reviews||{rows:[]};
  root.appendChild(sec("Local scorecard", null, [modStatusLine("local"),
    el("div",{class:"grid-2"},[
      card([h4("Pillars"), table([{label:"Pillar",k:"pillar"},{label:"Grade",render:function(r){return gradeBox(r.grade);}},{label:"Evidence",render:function(r){return chip(r.evidence_class, evCls(r.evidence_class));}},{label:"Note",cls:"wrap",k:"note"}], l.pillars, {emptyText:"No local pillars graded."})]),
      card([h4("Reviews: client against rivals"), rv.rows.length? el("div",{class:"stack"}, rv.rows.map(function(r){ var mx=Math.max.apply(null, rv.rows.map(function(x){return x.count||0;})); return bar(r.entity+(r.is_client?" (client)":""), r.count||0, mx, r.is_client?"good":"", (r.count||0)+" reviews, "+fmt(r.rating)+" rating, "+fmt(r.velocity_30d)+"/30d, "+pct(r.response_rate)+" answered"); })) : empty("No review rows. Review panels are screenshots or the client's GBP export."), el("p",{class:"small muted",style:"margin-top:8px",text:rv.rows.length? "Source and date on each row are in the manifest; counts are snapshots, velocity is inferred from dated reviews.":""})])
    ]),
    (l.gbp||[]).length? card([h4("Google Business Profile audit"), table([{label:"Item",k:"item"},{label:"Status",render:function(r){return chip(r.status, r.status==="Present"?"good": r.status==="Absent"?"bad":"na");}},{label:"Source",k:"source"},{label:"Fix",cls:"wrap",k:"fix"}], l.gbp)]) : null,
    (l.citations||[]).length? card([h4("Citation matrix"), table([{label:"Directory",k:"directory"},{label:"Listing",render:function(r){return link(r.url);}},{label:"Name",render:function(r){return chip(r.name_match?"match":"mismatch", r.name_match?"good":"bad");}},{label:"Address",render:function(r){return chip(r.address_match?"match":"mismatch", r.address_match?"good":"bad");}},{label:"Phone",render:function(r){return chip(r.phone_match?"match":"mismatch", r.phone_match?"good":"bad");}},{label:"Status",k:"status"}], l.citations)]) : null,
    (l.location_pages||[]).length? card([h4("Location pages"), table([{label:"URL",render:function(r){return link(r.url);}},{label:"City",k:"city"},{label:"Unique copy",render:function(r){return r.unique==null?"":chip(r.unique?"unique":"templated", r.unique?"good":"warn");}},{label:"Schema",k:"schema"},{label:"Note",cls:"wrap",k:"note"}], l.location_pages)]) : null,
    (l.listing_integrity||[]).length? card([h4("Listing integrity screen (rival listings)"), table([{label:"Business",k:"business"},{label:"Signal",cls:"wrap",k:"signal"},{label:"Disposition",render:function(r){return chip(r.disposition, dispCls(r.disposition));}},{label:"Control",k:"control"},{label:"Open question",cls:"wrap",k:"open_question"}], l.listing_integrity), p("Verbs about the artifact, never about intent. Redressal filings are the client's decision; the reporter-reputation cost is real.","small muted")]) : null,
    findingsTable(modFindings("local"))
  ]));
}

/* ---------- Authority ---------- */
function renderAuthority(root){
  var k=MODS.links||{};
  root.appendChild(sec("Authority and links", "Referring domains, link quality, footprint and tenure. No vendor authority score appears here.", [modStatusLine("links"),
    Object.keys(k.stats||{}).length? el("div",{class:"grid-4"}, Object.keys(k.stats).map(function(s){ return el("div",{class:"kpi"},[el("div",{class:"v mono",text:fmt(k.stats[s])}), el("div",{class:"l",text:s.replace(/_/g," ")})]); })) : null,
    Object.keys(k.buckets||{}).length? card([h4("Disavow buckets"), stacked([{label:"DISAVOW",v:k.buckets.disavow||0,color:"var(--bad)"},{label:"REVIEW",v:k.buckets.review||0,color:"var(--warn)"},{label:"KEEP",v:k.buckets.keep||0,color:"var(--good)"}]), k.disavow_file? p("Disavow file: "+k.disavow_file+" (domain: lines only)","small muted"):null]) : null,
    table([{label:"Domain",k:"domain"},{label:"Bucket",render:function(r){return chip(r.bucket, r.bucket==="DISAVOW"?"bad": r.bucket==="REVIEW"?"warn":"good");}},{label:"Reason",cls:"wrap",k:"reason"},{label:"Signals",cls:"wrap",k:"signals"}], k.rows, {emptyText:"No link rows. Tier 3 (a GSC or Bing link export) unlocks the classifier and the disavow."}),
    (k.gap||[]).length? card([h4("Link gap (domains linking to rivals, not to the client)"), table([{label:"Domain",k:"domain"},{label:"Links to",k:"links_to"},{label:"Type",k:"type"},{label:"Approach",cls:"wrap",k:"approach"}], k.gap)]) : null,
    findingsTable(modFindings("links"))
  ]));
}

/* ---------- Competitors ---------- */
function renderCompetitors(root){
  var c=MODS.competitors||{}, cm=M.competitors||{rows:[],lenses:[]};
  var cols=[{label:"Threat",cls:"num",k:"threat_rank"},{label:"Rival",render:function(r){return r.domain? link("https://"+r.domain, r.name): txt(r.name);}},{label:"One line",cls:"wrap",k:"one_line"}];
  (cm.lenses||[]).forEach(function(lz){ cols.push({label:lz, render:function(r){return r[lz]? gradeBox(r[lz]):"";}}); });
  cols.push({label:"Steal this",cls:"wrap",k:"steal_this"});
  root.appendChild(sec("Know the enemy", (cm.rows||[]).length+" rivals, five lenses", [modStatusLine("competitors"),
    table(cols, cm.rows, {emptyText:"No rivals recorded."}),
    (c.keyword_gap||[]).length? card([h4("Keyword and demand gap"), table([{label:"Term",k:"term"},{label:"Client",k:"client"},{label:"Rival",k:"rival"},{label:"Evidence",cls:"wrap",k:"evidence"}], c.keyword_gap)]) : null,
    (M.scorecard||{})["Competitive Position"]&&(M.scorecard["Competitive Position"].gap!=null)? card([h4("How the grade was made"), p("Client Technical and Content lens mean "+M.scorecard["Competitive Position"].client_lens_mean+" against "+M.scorecard["Competitive Position"].rival+" lens mean "+M.scorecard["Competitive Position"].rival_lens_mean+" (0 is A, 4 is F); gap "+M.scorecard["Competitive Position"].gap+".","small")]) : null,
    findingsTable(modFindings("competitors"))
  ]));
}

/* ---------- Paid ---------- */
function renderPaid(root){
  var pd=MODS.paid||{}, aa=pd.account_audit||{};
  root.appendChild(sec("Paid media intelligence", "Ad libraries are read by protocol and screenshot; identity and destination are read in full", [modStatusLine("paid"),
    table([{label:"Rival",k:"rival"},{label:"Platform",k:"platform"},{label:"Active",cls:"wrap",k:"active"},{label:"Since",k:"since"},{label:"Formats",k:"formats"},{label:"Hooks",cls:"wrap",k:"hooks"},{label:"Landing page",render:function(r){return r.lp? (safeUrl(r.lp)? link(r.lp): txt(r.lp)): "";}},{label:"Evidence",render:function(r){return r.evidence_class? chip(r.evidence_class, evCls(r.evidence_class)):"";}},{label:"Source",k:"source"},{label:"Date",k:"date"}], pd.intel, {emptyText:"No paid intel rows."}),
    (pd.swipe||[]).length? card([h4("Swipe file"), table([{label:"Rival",k:"rival"},{label:"Platform",k:"platform"},{label:"Headline or hook",cls:"wrap",k:"text"},{label:"Why it works",cls:"wrap",k:"why"},{label:"Screenshot",render:function(r){return r.url? link(r.url,"open"):"";}}], pd.swipe)]) : null
  ]));
  root.appendChild(sec("Own account", aa.status? "Status: "+aa.status.replace(/_/g," "): "not assessed", [
    (aa.pillars||[]).length? table([{label:"Pillar",k:"pillar"},{label:"Grade",render:function(r){return gradeBox(r.grade);}},{label:"Finding",cls:"wrap",k:"finding"},{label:"Report and date",k:"source"},{label:"Fix",cls:"wrap",k:"fix"},{label:"Owner",k:"owner"}], aa.pillars) : card([p("The own-account audit runs on the client's exports (campaign, ad group, keyword, search terms, assets, conversions, Policy manager, Auction Insights). Without them it ships as a protocol, never as a verdict.","small muted")]),
    (pd.search_terms||[]).length? card([h4("Search terms and negatives"), table([{label:"Term",k:"term"},{label:"Cost",cls:"num",k:"cost"},{label:"Conv.",cls:"num",k:"conversions"},{label:"Classification",k:"classification"},{label:"Action",k:"action"}], pd.search_terms), pd.negatives_block? el("div",{style:"margin-top:10px"},[h4("Paste-ready negatives"), el("pre",{text:pd.negatives_block})]) : null]) : null,
    (pd.conversion_actions||[]).length? card([h4("Conversion actions"), table([{label:"Action",k:"action"},{label:"Source",k:"source"},{label:"Status",k:"status"},{label:"Primary",render:function(r){return r.primary==null?"":chip(r.primary?"primary":"secondary", r.primary?"acc":"na");}},{label:"Counting",k:"counting"},{label:"Window",k:"window"},{label:"Verdict",cls:"wrap",k:"verdict"}], pd.conversion_actions)]) : null,
    (pd.landing_pages||[]).length? card([h4("Landing pages"), table([{label:"Campaign",k:"campaign"},{label:"Landing page",render:function(r){return link(r.url);}},{label:"Speed",k:"speed"},{label:"Compliance",k:"compliance"},{label:"Message match",k:"message_match"}], pd.landing_pages)]) : null,
    (pd.auction_insights||[]).length? card([h4("Auction insights"), table([{label:"Rival",k:"rival"},{label:"Impr. share",cls:"num",k:"impression_share"},{label:"Overlap",cls:"num",k:"overlap"},{label:"Outranking",cls:"num",k:"outranking"},{label:"Trend",k:"trend"}], pd.auction_insights)]) : null,
    (pd.budget_scenarios||[]).length? card([h4("Budget scenarios (estimates; assumptions listed)"), table([{label:"Scenario",k:"scenario"},{label:"Monthly budget",cls:"num",k:"monthly_budget"},{label:"Assumed CPC",k:"assumed_cpc"},{label:"Assumed CVR",k:"assumed_cvr"},{label:"Leads range",k:"leads_range"},{label:"Label",k:"label"}], pd.budget_scenarios)]) : null,
    Object.keys(pd.lsa||{}).length? card([h4("Local Services Ads"), list(Object.keys(pd.lsa).map(function(k){return k.replace(/_/g," ")+": "+(typeof pd.lsa[k]==="object"? JSON.stringify(pd.lsa[k]): pd.lsa[k]);}))]) : null,
    findingsTable(modFindings("paid"))
  ]));
}

/* ---------- Social ---------- */
function renderSocial(root){
  var s=MODS.social||{}, aa=s.account_audit||{};
  root.appendChild(sec("Social: organic baseline and competitive read", null, [modStatusLine("social"),
    table([{label:"Platform",k:"platform"},{label:"Profile",render:function(r){return link(r.url, r.handle||r.url);}},{label:"Completeness",k:"completeness"},{label:"Cadence",k:"cadence"},{label:"Last post",k:"last_post"},{label:"Video share",render:function(r){return r.video_share==null?"n/a":pct(r.video_share);}},{label:"Response time",k:"response_time"},{label:"Evidence",render:function(r){return r.evidence_class? chip(r.evidence_class, evCls(r.evidence_class)):"";}}], s.organic, {emptyText:"No profiles inventoried."}),
    (s.intel||[]).length? card([h4("Social paid intel"), table([{label:"Rival",k:"rival"},{label:"Platform",k:"platform"},{label:"Active",k:"active"},{label:"Longest running",k:"longest_running"},{label:"Hooks",cls:"wrap",k:"hooks"},{label:"Landing page",render:function(r){return r.lp&&safeUrl(r.lp)? link(r.lp): txt(r.lp||"");}},{label:"Tier",k:"tier"},{label:"Date",k:"date"}], s.intel)]) : null
  ]));
  root.appendChild(sec("Own social accounts", aa.status? "Status: "+aa.status.replace(/_/g," "): "not assessed", [
    (aa.pillars||[]).length? table([{label:"Pillar",k:"pillar"},{label:"Grade",render:function(r){return gradeBox(r.grade);}},{label:"Finding",cls:"wrap",k:"finding"},{label:"Report and date",k:"source"},{label:"Fix",cls:"wrap",k:"fix"},{label:"Owner",k:"owner"}], aa.pillars) : card([p("The own-account audit runs on Ads Manager, Account Quality and Events Manager exports (or their TikTok, LinkedIn, Pinterest, Snap and Reddit equivalents). Without them it ships as a protocol.","small muted")]),
    (s.measurement_spine||[]).length? card([h4("Measurement spine"), table([{label:"Item",k:"item"},{label:"Verdict",render:function(r){return chip(r.verdict, r.verdict&&/ok|good|pass/i.test(r.verdict)?"good": r.verdict&&/missing|fail|broken/i.test(r.verdict)?"bad":"warn");}},{label:"Evidence",cls:"wrap",k:"evidence"},{label:"Fix",cls:"wrap",k:"fix"}], s.measurement_spine)]) : null,
    (s.creative_ledger||[]).length? card([h4("Creative ledger"), table([{label:"Ad",k:"ad"},{label:"Concept",k:"concept"},{label:"Format",k:"format"},{label:"Start",k:"start"},{label:"Spend",cls:"num",k:"spend"},{label:"Hook / hold",k:"hook_hold"},{label:"CTR",cls:"num",k:"ctr"},{label:"CPA",cls:"num",k:"cpa"},{label:"Flags",cls:"wrap",k:"flags"}], s.creative_ledger)]) : null,
    (s.audience_map||[]).length? card([h4("Audience map"), table([{label:"Audience",k:"audience"},{label:"Type",k:"type"},{label:"Size",cls:"num",k:"size"},{label:"Note",cls:"wrap",k:"note"}], s.audience_map)]) : null,
    (s.creator_compliance||[]).length? card([h4("Creator and influencer compliance"), table([{label:"Creator (public handle)",k:"creator"},{label:"Post",render:function(r){return link(r.url,"open");}},{label:"Disclosure",render:function(r){return chip(r.disclosure, /present|clear/i.test(r.disclosure||"")?"good":"warn");}},{label:"Claims",cls:"wrap",k:"claims"},{label:"Status",render:function(r){return chip(r.status, dispCls(r.status));}}], s.creator_compliance)]) : null,
    findingsTable(modFindings("social"))
  ]));
}

/* ---------- AI ---------- */
function renderAI(root){
  var a=MODS.ai||{}, am=M.ai||{};
  root.appendChild(sec("AI visibility", "No AI visibility API exists; this is assembled from fetched pages, screenshots and referrals", [modStatusLine("ai"),
    el("div",{class:"grid-4"},[ el("div",{class:"kpi"},[el("div",{class:"v mono",text:(am.citable_client||0)+" of "+(am.citable_checked||0)}), el("div",{class:"l",text:"citable sources where the client appears"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(am.prompts_mentioned||0)+" / "+String((am.prompts||0)-(am.prompts_pending||0))}), el("div",{class:"l",text:"prompts where the brand was mentioned, of those checked ("+(am.prompts_pending||0)+" pending)"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(am.brand_facts_inconsistent||0)}), el("div",{class:"l",text:"brand facts inconsistent across sources"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(am.readiness_n||0)}), el("div",{class:"l",text:"readiness items assessed"})]) ]),
    el("div",{class:"grid-2"},[
      card([h4("Readiness"), table([{label:"Item",k:"item"},{label:"Observed",cls:"wrap",k:"observed"},{label:"Fix",cls:"wrap",k:"fix"}], a.readiness, {emptyText:"No readiness rows."})]),
      card([h4("Citable footprint: who the answer engines can find"), Object.keys(am.citable_rivals||{}).length? el("div",{class:"stack"}, [bar(T.business_name+" (client)", am.citable_client||0, am.citable_checked||1, "good", String(am.citable_client||0))].concat(Object.keys(am.citable_rivals).map(function(r){ return bar(r, am.citable_rivals[r], am.citable_checked||1, "", String(am.citable_rivals[r])); }))) : empty("No citable footprint sample."), el("p",{class:"small muted",style:"margin-top:8px",text:"Count of fetched listicles, directories and threads for buying-intent queries in which each business appears."})])
    ]),
    (a.citable_footprint||[]).length? table([{label:"Query",k:"query"},{label:"Source page",render:function(r){return link(r.url, r.page);}},{label:"Type",k:"type"},{label:"Client",render:function(r){return chip(r.client?"present":"absent", r.client?"good":"bad");}},{label:"Rivals present",k:"rivals"},{label:"Date",k:"date"}], a.citable_footprint) : null,
    (a.prompt_tracker||[]).length? card([h4("Prompt tracker"), table([{label:"Prompt",cls:"wrap",k:"prompt"},{label:"Engine",k:"engine"},{label:"Mentioned",render:function(r){return r.mentioned==null? chip("pending","na"): chip(r.mentioned?"yes":"no", r.mentioned?"good":"bad");}},{label:"Cited URL",render:function(r){return r.cited_url? link(r.cited_url):"";}},{label:"Date",k:"date"},{label:"Source",k:"source"}], a.prompt_tracker), p("Screenshots are the evidence; the engines' chat interfaces are not fetched.","small muted")]) : null,
    (a.brand_facts||[]).length? card([h4("Brand facts consistency"), table([{label:"Fact",k:"fact"},{label:"Site",k:"site"},{label:"GBP",k:"gbp"},{label:"LinkedIn",k:"linkedin"},{label:"Directories",k:"directories"},{label:"Consistent",render:function(r){return r.consistent==null?"":chip(r.consistent?"yes":"no", r.consistent?"good":"bad");}}], a.brand_facts)]) : null,
    (a.referrals||[]).length? card([h4("Assistant referrals (a floor, from GA4)"), table([{label:"Source",k:"source"},{label:"Sessions",cls:"num",k:"sessions"},{label:"Key events",cls:"num",k:"key_events"},{label:"Period",k:"period"}], a.referrals)]) : null,
    a.llms_txt? card([h4("llms.txt draft"), el("pre",{text:a.llms_txt})]) : null,
    findingsTable(modFindings("ai"))
  ]));
}

/* ---------- Apps ---------- */
function renderApps(root){
  var a=MODS.apps||{};
  root.appendChild(sec("Apps and ASO", null, [modStatusLine("apps"),
    table([{label:"App",k:"app"},{label:"Store",k:"store"},{label:"Market",k:"market"},{label:"ID",cls:"num",k:"id"},{label:"Developer",k:"developer"},{label:"Version date",k:"version_date"},{label:"Rating",cls:"num",k:"rating"},{label:"Count",cls:"num",k:"count"},{label:"Listing",render:function(r){return link(r.url);}}], a.inventory, {emptyText:"No apps discovered (AASA, assetlinks, store badges and the iTunes search on the brand were checked when the module ran)."}),
    (a.aso||[]).length? card([h4("ASO audit"), table([{label:"Field",k:"field"},{label:"Current",cls:"wrap",k:"current"},{label:"Target",cls:"wrap",k:"target"},{label:"Rationale",cls:"wrap",k:"rationale"},{label:"Listing",render:function(r){return link(r.url,"open");}}], a.aso)]) : null,
    (a.keyword_proxy||[]).length? card([h4("Keyword proxy"), table([{label:"Term",k:"term"},{label:"Apple rank proxy",cls:"num",k:"apple_rank_proxy"},{label:"Rivals",k:"rivals"},{label:"Source",k:"source"}], a.keyword_proxy)]) : null,
    (a.reviews||[]).length? card([h4("Store reviews (RSS and screenshots; velocity and burst signals)"), table([{label:"App",k:"app"},{label:"Store",k:"store"},{label:"Rating",cls:"num",k:"rating"},{label:"Count",cls:"num",k:"count"},{label:"Velocity 30d",cls:"num",k:"velocity_30d"},{label:"Signals",cls:"wrap",k:"signals"}], a.reviews)]) : null,
    Object.keys(a.deep_links||{}).length? card([h4("Deep links and the web to app path"), list(Object.keys(a.deep_links).map(function(k){return k.replace(/_/g," ")+": "+(typeof a.deep_links[k]==="object"? JSON.stringify(a.deep_links[k]): a.deep_links[k]);}))]) : null,
    (a.measurement||[]).length? card([h4("App measurement"), table([{label:"Item",k:"item"},{label:"Verdict",k:"verdict"},{label:"Evidence",cls:"wrap",k:"evidence"},{label:"Fix",cls:"wrap",k:"fix"}], a.measurement)]) : null,
    (a.campaigns||[]).length? card([h4("App campaigns"), table([{label:"Source",k:"source"},{label:"Spend",cls:"num",k:"spend"},{label:"Installs",cls:"num",k:"installs"},{label:"CPA",cls:"num",k:"cpa"},{label:"Attribution model",k:"attribution"}], a.campaigns)]) : null,
    (a.vitals||[]).length? card([h4("Vitals and retention (from exports)"), table([{label:"Metric",k:"metric"},{label:"Value",k:"value"},{label:"Period",k:"period"},{label:"Source",k:"source"}], a.vitals)]) : null,
    findingsTable(modFindings("apps"))
  ]));
}

/* ---------- Exposure ---------- */
function renderExposure(root){
  var x=MODS.exposure||{}, hc=M.honest_count||{}, rows=D.exposure||[];
  root.appendChild(sec("Compliance and exposure", hc.sentence, [modStatusLine("exposure"),
    el("div",{class:"grid-4"},[ el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(hc.confirmed||0)}),el("div",{class:"l",text:"CONFIRMED"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(hc.routable||0)}),el("div",{class:"l",text:"routable"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(hc.candidate||0)}),el("div",{class:"l",text:"CANDIDATE, held as intelligence"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:String(hc.cleared||0)}),el("div",{class:"l",text:"CLEARED by a control"})]) ]),
    card([p("You cannot see the ad; you can see almost everything the ad is judged against. Every row below binds to one disposition. CONFIRMED means the evidence is quoted, maps to a rule clause that was fetched or vintage-flagged, survived the controls and was verified adversarially. CANDIDATE means a real observation with an innocent reading still open. CLEARED means a control knocked it down, and it stays on the page so the reader can see what was ruled out. Filing is the client's decision; the reporter-reputation cost is real.","small")], "tint")
  ]));
  var filt=el("div",{class:"filters"}); var selD=el("select"); ["all dispositions","CONFIRMED","CANDIDATE","CLEARED"].forEach(function(o){selD.appendChild(el("option",{value:o,text:o}));}); var selB=el("select"); selB.appendChild(el("option",{value:"all",text:"all batteries"})); var bats={}; rows.forEach(function(r){bats[r.battery]=1;}); Object.keys(bats).sort().forEach(function(b){selB.appendChild(el("option",{value:b,text:"Battery "+b}));}); var q=el("input",{type:"search",placeholder:"search rules, cites, evidence"}); filt.appendChild(selD); filt.appendChild(selB); filt.appendChild(q);
  var host=el("div"); function draw(){ var rs=rows.filter(function(r){ if(selD.value!=="all dispositions"&&r.disposition!==selD.value) return false; if(selB.value!=="all"&&r.battery!==selB.value) return false; var s=q.value.toLowerCase(); if(s && !(JSON.stringify(r).toLowerCase().indexOf(s)>=0)) return false; return true; }); host.textContent=""; host.appendChild(table([
    {label:"ID",cls:"num",k:"id"},{label:"Battery / test",render:function(r){return r.battery+" / "+r.test;}},
    {label:"Rule and cite",cls:"wrap",render:function(r){return el("div",{},[el("div",{text:r.rule}), el("div",{class:"small muted",text:r.cite||""}), el("div",{class:"small",},[chip(r.cite_fetched? "cite fetched "+r.cite_fetched: (r.cite_vintage? "vintage: "+r.cite_vintage: "no cite"), r.cite_fetched?"good":"warn")])]);}},
    {label:"Evidence",cls:"wrap",render:function(r){return el("div",{},[txt(r.evidence), el("div",{class:"small"},[link(r.url)])]);}},
    {label:"Disposition",render:function(r){return el("div",{class:"stack"},[chip(r.disposition, dispCls(r.disposition)), chip(r.confidence,"na"), chip(r.severity, sevCls(r.severity))]);}},
    {label:"Base rate",cls:"wrap",k:"base_rate"},
    {label:"Control / open question",cls:"wrap",render:function(r){return r.disposition==="CLEARED"? txt(r.control||""): txt(r.open_question||"");}},
    {label:"Route",render:function(r){return el("div",{},[chip(r.route||"NONE", (r.route&&r.route!=="NONE"&&r.route!=="PRIVATE")?"acc":"na"), r.channel? el("div",{class:"small muted",text:r.channel}):null]);}}
  ], rs, {emptyText:"No rows match."})); }
  [selD,selB].forEach(function(s){s.addEventListener("change",draw);}); q.addEventListener("input",draw); draw();
  root.appendChild(sec("Findings", rows.length+" observations", [filt, host]));
  root.appendChild(sec("What was ruled out, what was covered, what could not be seen", null, [
    el("div",{class:"grid-2"},[
      card([h4("Controls applied"), table([{label:"Candidate",cls:"wrap",k:"candidate"},{label:"Control",cls:"wrap",k:"control"},{label:"Result",render:function(r){return chip(r.result, dispCls(r.result));}}], x.controls_applied, {emptyText:"No controls recorded."})]),
      card([h4("Clause coverage"), table([{label:"Clause family",k:"family"},{label:"Status",render:function(r){return chip(r.status, /^testable/.test(r.status||"")?"good": /partial/.test(r.status||"")?"warn":"na");}}], x.clause_coverage, {emptyText:"No clause families recorded."})])
    ]),
    (x.inventory||[]).length? card([h4("Platform inventory"), table([{label:"Surface",render:function(r){return safeUrl(r.surface)? link(r.surface): txt(r.surface);}},{label:"Tags",cls:"wrap",k:"tags"},{label:"CMP",k:"cmp"},{label:"Handles",cls:"wrap",k:"handles"},{label:"Apps",k:"apps"}], x.inventory)]) : null,
    (x.consent_trackers||[]).length? card([h4("Consent and trackers, page by page"), table([{label:"Page",render:function(r){return link(r.url);}},{label:"Trackers pre-consent",cls:"wrap",k:"pre_consent"},{label:"CMP",k:"cmp"},{label:"Consent Mode",k:"consent_mode"},{label:"Note",cls:"wrap",k:"note"}], x.consent_trackers)]) : null,
    (x.accounts||[]).length? card([h4("Accounts and channels a report would name"), table([{label:"Platform",k:"platform"},{label:"Account",render:function(r){return r.url? link(r.url, r.account): txt(r.account);}},{label:"Report channel",cls:"wrap",k:"channel"}], x.accounts)]) : null,
    card([h4("NOT OBSERVABLE (mandatory)"), table([{label:"Item",k:"item"},{label:"Why",cls:"wrap",k:"why"},{label:"What it costs to close",cls:"wrap",k:"cost_to_close"}], x.not_observable, {emptyText:"Nothing recorded. That is almost never true: creatives, targeting, spend and in-app runtime are not observable from here."})])
  ]));
}

/* ---------- Agency lens ---------- */
function radarCard(){
  var r=radarOfRecord(); if(!r) return null;
  var rows=[]; if(r.ok){ rows.push(kv("Horus read", chip(r.band+" "+signedNum(r.hti), r.band==="Tailwind"||r.band==="Favored"?"good": r.band==="Neutral"?"na":"bad"))); rows.push(kv("Solar Arc", (r.arc_clock||"")+(r.arc_word? "  "+r.arc_word: ""))); if(r.best_fit) rows.push(kv("Best scenario fit", r.best_fit)); if(r.saydo) rows.push(kv("Say and do", r.saydo+" of its own sold lines practised on its own house")); }
  if(r.offshore && r.offshore.index!=null) rows.push(kv("Offshore exposure (Monsoon)", chip(r.offshore.band+" "+Math.round(r.offshore.index), r.offshore.band==="Landfall"||r.offshore.band==="Onshore wind"?"warn":"na")));
  if(r.archetype) rows.push(kv("Radar archetype", r.archetype+(r.segment? "  ·  "+r.segment: ""))); if(r.region) rows.push(kv("Region", r.region+(r.hq && r.hq!==r.region? "  ·  "+r.hq: ""))); if(r.ownership) rows.push(kv("Ownership", r.ownership+(r.owner? "  ·  "+r.owner: "")));
  if((r.leads||[]).length) rows.push(kv("Leads with", r.leads.join(", ")));
  var body=[h4("In the Agency Radar"), el("div",{class:"stack"},[el("h3",{text:r.name}), p((r.verdict||"Tracked in the Radar with no Horus read."),"small")].concat(rows))];
  if((r.house||[]).length) body.push(el("div",{},[h4("Its own house (say and do)"), table([{label:"Sold line",k:"cap"},{label:"Test",render:function(x){return chip(x.result, x.result==="corroborated"?"good": x.result==="contradicted"?"bad":"na");}},{label:"Evidence",cls:"wrap",k:"note"}], r.house)]));
  if((r.gaps||[]).length) body.push(el("div",{},[h4("Gaps on its own house"), list(r.gaps)]));
  if(r.offshore && r.offshore.verdict) body.push(el("div",{},[h4("Offshore delivery exposure"), p(r.offshore.verdict,"small"), p("Migration "+Math.round(r.offshore.migration||0)+", displacement "+Math.round(r.offshore.displacement||0)+"; evidence "+(r.offshore.evidence_class||"inferred")+". The agency's exposure, not the client's; it says how much of what this agency sells can be delivered from a hub.","small muted")]));
  body.push(p("Radar facts are observed on the agency's own public record (site, sitemaps, ad libraries) and dated "+(r.compiled||"")+"; the Horus read is the digital marketing edition "+(r.edition||"")+" mapped onto its sold mix. Open the Radar dossier for the evidence behind each line.","small muted"));
  body.push(el("p",{class:"small"},[radarNav("a."+r.id+".horus", "Open "+r.name+" in the Radar")]));
  return card(body, "tint");
}
function renderAgency(root){
  var g=MODS.agency||{}, of=g.of_record||{}, sc=(M.scorecard||{})["Agency Fit"]||{};
  root.appendChild(sec("The agency behind the site", null, [modStatusLine("agency"), radarCard(),
    el("div",{class:"grid-2"},[
      card([h4("Agency of record"), Object.keys(of).length? el("div",{class:"stack"},[el("h3",{text:of.name||"unknown"}), of.domain? kv("Domain", link("https://"+of.domain, of.domain)):null, kv("Confidence", chip(of.confidence||"Weak", of.confidence==="Confirmed"?"good": of.confidence==="Plausible"?"warn":"na")), h4("Evidence"), list(of.evidence||[]), of.reverse_justice_offered? p("A reverse Justice run (every site wearing this agency's badge) was offered.","small muted"):null]) : empty("No agency of record identified. The footer credit, the RDAP registrant and the shared tag stack were the tests.")]),
      card([h4("Inherited against owned"), (g.inherited_vs_owned||[]).length? (function(){ var inh=g.inherited_vs_owned.filter(function(r){return r.side==="inherited";}).length, own=g.inherited_vs_owned.filter(function(r){return r.side==="owned";}).length; return el("div",{class:"stack"},[stacked([{label:"inherited from the agency's template or stack",v:inh,color:"var(--warn)"},{label:"owned by the client",v:own,color:"var(--good)"}]), sc.inherited_share!=null? p("Inherited share of High and Medium findings: "+pct(sc.inherited_share)+". Agency Fit grade "+(sc.grade||"NA")+".","small"):null, table([{label:"Finding",k:"finding_id"},{label:"Side",render:function(r){return chip(r.side, r.side==="inherited"?"warn":"good");}},{label:"Why",cls:"wrap",k:"why"}], g.inherited_vs_owned)]); })() : empty("No split recorded.")])
    ]),
    (g.shared_layer||[]).length? card([h4("Shared measurement layer"), table([{label:"Type",k:"id_type"},{label:"ID",cls:"num",k:"id"},{label:"Seen on",cls:"wrap",k:"seen_on"}], g.shared_layer), p("The same container, property or widget key on unrelated client sites means data co-mingling, lock-in and a single point of compromise. A CANDIDATE ceiling until the agency's own terms are read.","small muted")]) : null,
    (g.claims||[]).length? card([h4("Claims screen"), table([{label:"Claim",cls:"wrap",k:"claim"},{label:"Where",render:function(r){return link(r.url);}},{label:"Test",cls:"wrap",k:"test"},{label:"Status",render:function(r){return chip(r.status, dispCls(r.status));}}], g.claims)]) : null,
    Object.keys(g.outreach||{}).length? card([h4("Outreach infrastructure"), list(Object.keys(g.outreach).map(function(k){return k.replace(/_/g," ")+": "+(typeof g.outreach[k]==="object"? JSON.stringify(g.outreach[k]): g.outreach[k]);}))]) : null,
    g.pattern_verdict? card([h4("Pattern verdict across the agency's book (Justice)"), p("Trial set: "+(g.pattern_verdict.trial_set_n||0)+" sites. Prevalence at or above 40% is platform-level.","small"), table([{label:"Axis",k:"axis"},{label:"Prevalence",cls:"num",render:function(r){return pct(r.prevalence);}},{label:"Severity",render:function(r){return chip(r.severity, sevCls(r.severity));}},{label:"Examples",cls:"wrap",render:function(r){var d=el("div"); (r.examples||[]).forEach(function(u,i){ if(i) d.appendChild(txt(" · ")); d.appendChild(link(u)); }); return d;}},{label:"Template fix",cls:"wrap",k:"fix"}], g.pattern_verdict.axes||[])]) : null,
    (g.industry_alignment||[]).length? card([h4("What agencies are selling against what the floor says works"), table([{label:"Practice",k:"practice"},{label:"The floor's stance (Moon eye)",cls:"wrap",k:"floor_stance"},{label:"Agency selling or shipping",cls:"wrap",k:"agency_selling"},{label:"Read",cls:"wrap",k:"note"}], g.industry_alignment), p("Read against the digital marketing nome's latest edition; measurement and judgment kept separate.","small muted")]) : null,
    (g.self_audit||[]).length? card([h4("Self-audit tickets (owners, no routes)"), table([{label:"Item",cls:"wrap",k:"item"},{label:"Owner",k:"owner"},{label:"Fix",cls:"wrap",k:"fix"},{label:"Status",k:"status"}], g.self_audit)]) : null,
    findingsTable(modFindings("agency"))
  ]));
}

/* ---------- Market ---------- */
function renderMarket(root){
  var mk=MODS.market||{}, b=M.brand||{rows:[]}, ind=mk.industry||{};
  var zmax=Math.max(2.5, Math.max.apply(null,[0].concat(b.rows.map(function(r){return Math.abs(r.z);}))));
  root.appendChild(sec("Brand Stereopsis: what the brand says against what customers say", b.n_sun+" brand items, "+b.n_moon+" floor items"+(b.thin? " (thin read; below the "+b.minimums.sun_items+" and "+b.minimums.moon_items+" minimums)":""), [modStatusLine("market"),
    el("div",{class:"grid-2"},[
      card([h4("The gap by topic (weighted log-odds z; right means customers raise it more than the brand does)"), b.rows.length? el("div",{class:"stack"}, b.rows.map(function(r){ return diverge(r.label+"  ("+r.sun_n+" vs "+r.moon_n+")", r.z, zmax); })) : empty("No coded items."), el("div",{class:"legend",style:"margin-top:8px"},[el("span",{},[el("i",{style:"background:var(--sun-bar)"}), txt("brand leads")]), el("span",{},[el("i",{style:"background:var(--moon-bar)"}), txt("customers lead")]), el("span",{class:"muted",text:"beyond ±1.96 the gap is unlikely to be sampling noise"})])]),
      card([h4("Read"), el("div",{class:"grid-2"},[ el("div",{},[h4("Customers raise, brand ignores"), (b.floor_led||[]).length? list(b.floor_led.map(function(r){return r.label+": "+r.moon_n+" floor items, "+(r.pain!=null? Math.round(r.pain*100)+"% pain, ":"")+"stance "+fmt(r.stance_moon);})): p("None","small muted")]), el("div",{},[h4("Brand claims, no echo"), (b.broadcast_led||[]).length? list(b.broadcast_led.map(function(r){return r.label+": "+r.sun_n+" brand items, "+r.moon_n+" floor";})): p("None","small muted")]) ]),
        el("div",{class:"grid-4",style:"margin-top:10px"},[ el("div",{class:"kpi"},[el("div",{class:"v mono",text:pct(b.complaint_share)}),el("div",{class:"l",text:"complaint share of floor items"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:fmt((b.stance||{}).moon)}),el("div",{class:"l",text:"mean floor stance (-1 to 1)"})]), el("div",{class:"kpi"},[el("div",{class:"v mono",text:fmt((b.stance||{}).sun)}),el("div",{class:"l",text:"mean brand stance"})]), el("div",{class:"kpi"},[gradeBox((b.grade||{}).grade||"NA"),el("div",{class:"l",text:"Market Position grade"})]) ]),
        el("div",{style:"margin-top:10px"},[h4("Clusters"), table([{label:"Cluster",k:"c"},{label:"Brand share",cls:"num",render:function(r){return pct(r.s);}},{label:"Floor share",cls:"num",render:function(r){return pct(r.m);}}], Object.keys(b.clusters||{}).map(function(c){return {c:c,s:b.clusters[c].sun,m:b.clusters[c].moon};}))])])
    ]),
    card([h4("Frames"), el("div",{class:"grid-2"},[ el("div",{},[chip("Sun eye: the brand's own voice","sun"), list((b.frames||{}).sun||[])]), el("div",{},[chip("Moon eye: the floor talking about the brand","moon"), list((b.frames||{}).moon||[])]) ]), p("Reviewer and poster names are never recorded. One review is one item; a platform's aggregate count is a hard signal below.","small muted")])
  ]));
  var items=((mk.brand||{}).items||[]); if(items.length){ var filt=el("div",{class:"filters"}); var se=el("select"); ["both eyes","sun","moon"].forEach(function(o){se.appendChild(el("option",{value:o,text:o}));}); var st=el("select"); st.appendChild(el("option",{value:"all",text:"all topics"})); (D.dict.brand_topics||[]).forEach(function(t){st.appendChild(el("option",{value:t.id,text:t.id+" "+t.short}));}); var q=el("input",{type:"search",placeholder:"search titles"}); filt.appendChild(se); filt.appendChild(st); filt.appendChild(q); var host=el("div"); var lab={}; (D.dict.brand_topics||[]).forEach(function(t){lab[t.id]=t.short;});
    function draw(){ var rs=items.filter(function(i){ if(se.value!=="both eyes"&&i.eye!==se.value) return false; if(st.value!=="all"&&i.topic!==st.value) return false; var s=q.value.toLowerCase(); if(s&&(i.title||"").toLowerCase().indexOf(s)<0) return false; return true; }); host.textContent=""; host.appendChild(table([{label:"ID",cls:"num",k:"id"},{label:"Eye",render:function(r){return chip(r.eye, r.eye);}},{label:"Topic",render:function(r){return (lab[r.topic]||r.topic)+(r.topic2? " + "+(lab[r.topic2]||r.topic2):"");}},{label:"Intent",cls:"num",k:"intent"},{label:"Stance",cls:"num",render:function(r){return r.stance>0?"+1":String(r.stance);}},{label:"Title",cls:"wrap",k:"title"},{label:"Source",render:function(r){return r.url? link(r.url, r.source||r.url): txt(r.source||"");}}], rs, {emptyText:"No items match."})); }
    [se,st].forEach(function(s){s.addEventListener("change",draw);}); q.addEventListener("input",draw); draw(); root.appendChild(sec("Brand ledger", items.length+" coded items", [filt, host])); }
  if(Object.keys(ind).length){ var topS=(ind.top_sun||[]), topM=(ind.top_moon||[]); root.appendChild(sec("The industry read", (mk.nome_id? "nome: "+mk.nome_id: "")+(mk.edition_stem? "  ·  edition "+mk.edition_stem:""), [
      card([ind.headline? el("h3",{text:ind.headline}):null, ind.edition_note? p(ind.edition_note,"small muted"):null]),
      el("div",{class:"grid-2"},[ card([h4("What the trade press is loudest about (Sun)"), topS.length? el("div",{class:"stack"}, topS.map(function(t){return bar(t[0], t[1], Math.max.apply(null,topS.map(function(x){return x[1];})), "sun", pct(t[1]));})): empty()]), card([h4("What practitioners are loudest about (Moon)"), topM.length? el("div",{class:"stack"}, topM.map(function(t){return bar(t[0], t[1], Math.max.apply(null,topM.map(function(x){return x[1];})), "moon", pct(t[1]));})): empty()]) ]),
      (ind.stereopsis||[]).length? card([h4("Industry Stereopsis"), table([{label:"Topic",render:function(r){return (r.label||r.topic);}},{label:"z",cls:"num",render:function(r){return (r.z>0?"+":"")+fmt(r.z,2);}},{label:"Class",render:function(r){return chip(r.class, /floor/.test(r.class)?"moon": /broadcast/.test(r.class)?"sun":"na");}},{label:"Floor n",cls:"num",k:"nF"},{label:"Broadcast n",cls:"num",k:"nB"}], ind.stereopsis)]) : null
    ])); }
  root.appendChild(sec("Nilometer: hard signals the judgments rest on", "Admiralty grades: A to F reliability, 1 to 6 credibility", [
    table([{label:"ID",cls:"num",k:"id"},{label:"Domain",k:"domain"},{label:"Metric",cls:"wrap",k:"metric"},{label:"Value",cls:"wrap",k:"value"},{label:"Date",k:"date"},{label:"Source",cls:"wrap",render:function(r){return r.url? link(r.url, r.source): txt(r.source||"");}},{label:"Grade",render:function(r){return chip(r.grade, /^[AB][12]/.test(r.grade||"")?"good": /^[C]/.test(r.grade||"")?"warn":"na");}},{label:"Note",cls:"wrap",k:"note"}], mk.nilometer, {emptyText:"No hard signals recorded."}),
    (mk.events||[]).length? card([h4("Events behind the judgments"), table([{label:"Date",k:"date"},{label:"Event",cls:"wrap",k:"label"},{label:"Topic",k:"topic"},{label:"Ref",k:"ref"}], mk.events)]) : null,
    (mk.watch||[]).length? card([h4("Watch calendar"), table([{label:"Date",k:"date"},{label:"Reading",cls:"wrap",k:"label"},{label:"Moves indicator",k:"indicator"}], mk.watch)]) : null,
    findingsTable(modFindings("market"))
  ]));
}

/* ---------- Forecast ---------- */
function renderForecast(root){
  var kjs=AN.key_judgments||[];
  root.appendChild(sec("Key judgments", "Measurement and judgment never blur: shares and gaps come from code; likelihoods are judgments in ICD 203 language, each with the observation that would prove it wrong", kjs.length? kjs.map(function(k){ return el("div",{class:"kj"},[ el("div",{class:"hd"},[el("h3",{text:k.id+"  "+k.title}), el("div",{class:"row"},[chip(k.likelihood,"moon"), chip("confidence "+k.confidence,"na"), chip("horizon "+k.horizon,"acc")])]), p(k.judgment), icdBar(k.range), el("div",{class:"grid-2"},[ el("div",{},[h4("Evidence"), list(k.evidence||[])]), el("div",{},[h4("Falsifiers"), list(k.falsifiers||[])]) ]), k.math? el("pre",{text:typeof k.math==="string"? k.math: JSON.stringify(k.math,null,1)}):null ]); }) : [card([empty("No key judgments written yet.")])]));
  var sc=AN.scenarios||{}; if((sc.quadrants||[]).length){ root.appendChild(sec("Scenario square", (sc.axes||[]).join("  ×  "), [ el("div",{class:"sq"}, sc.quadrants.map(function(q){ return el("div",{class:"q"},[el("div",{class:"p",text:q.probability+"%"}), el("strong",{text:q.name}), p(q.narrative,"small"), (q.signposts||[]).length? el("div",{style:"margin-top:6px"},[h4("Signposts"), list(q.signposts)]):null]); })) ])); }
  root.appendChild(sec("Indicators, unknowns and the graveyard", null, [ el("div",{class:"grid-2"},[
    card([h4("Indicators to watch"), table([{label:"ID",cls:"num",k:"id"},{label:"Watch",cls:"wrap",k:"watch"},{label:"Reading that moves a judgment",cls:"wrap",k:"reading"},{label:"Moves",k:"moves"},{label:"Next reading",k:"next_reading"}], AN.indicators, {emptyText:"No indicators."})]),
    card([h4("The 64th part: what cannot be measured"), (AN.unknowns||[]).length? list(AN.unknowns.map(function(u){return (u.id? u.id+" ":"")+(u.text||"");})): empty("No unknowns named. There are always unknowns.")])
  ]), (AN.graveyard_test||[]).length? card([h4("Graveyard test: does today's prophecy share the shape of a failed one?"), table([{label:"Prophecy",cls:"wrap",k:"prophecy"},{label:"Shape",cls:"wrap",k:"shape"},{label:"Test",cls:"wrap",k:"test"}], AN.graveyard_test)]) : null,
    (AN.moves||[]).length? card([h4("Moves, each tied to the judgments that justify it"), table([{label:"ID",cls:"num",k:"id"},{label:"Move",cls:"wrap",k:"move"},{label:"Justified by",k:"justified_by"}], AN.moves)]) : null,
    (AN.limitations||[]).length? card([h4("Limitations"), list(AN.limitations)]) : null ]));
}

/* ---------- Playbook ---------- */
function renderPlaybook(root){
  root.appendChild(sec("The 90-day playbook", "P1 doable in 30 days; every move has an owner", [
    (PB.phases||[]).length? el("div",{class:"grid-3"}, PB.phases.map(function(ph){ return card([h4(ph.phase), list(ph.moves||[])]); })) : card([empty("No phases written.")]),
    (PB.moves12||[]).length? table([{label:"#",cls:"num",k:"n"},{label:"Move",cls:"wrap",k:"move"},{label:"Impact",render:function(r){return chip(r.impact, r.impact==="High"?"good": r.impact==="Medium"?"warn":"na");}},{label:"Effort",k:"effort"},{label:"Owner",k:"owner"},{label:"When",k:"when"}], PB.moves12) : null
  ]));
  var specs=[["on_page","Drop-in titles and descriptions",[{label:"URL",render:function(r){return link(r.url);}},{label:"Title",cls:"wrap",k:"title"},{label:"Description",cls:"wrap",k:"description"}]],
             ["redirects","301 rules",[{label:"From",render:function(r){return typeof r==="string"? txt(r): link(r.from);}},{label:"To",render:function(r){return typeof r==="string"? "": link(r.to);}}]],
             ["content_offensive","Content offensive",[{label:"Week",cls:"num",k:"week"},{label:"Working title",cls:"wrap",k:"title"},{label:"Target term and demand evidence",cls:"wrap",k:"target"},{label:"Money page",render:function(r){return r.money_page? link(r.money_page):"";}},{label:"Words",cls:"num",k:"words"}]]];
  var kids=[]; specs.forEach(function(s){ if((PB[s[0]]||[]).length) kids.push(card([h4(s[1]), table(s[2], PB[s[0]])])); });
  (PB.schema_blocks||[]).forEach(function(b){ kids.push(card([h4("Ready to paste JSON-LD: "+b.type+(b.url? " for "+shortUrl(b.url):"")), el("pre",{text:JSON.stringify(b.jsonld,null,1)})])); });
  ["local","authority","paid","social","apps","ai","compliance","measurement"].forEach(function(k){ var v=PB[k]; if(v&&v.length) kids.push(card([h4(k.charAt(0).toUpperCase()+k.slice(1)+" specs"), list(v.map(function(x){return typeof x==="string"? x: (x.title? x.title+": ":"")+(x.spec||x.text||JSON.stringify(x));}))])); });
  if(kids.length) root.appendChild(sec("Fixes as specs", null, kids));
  root.appendChild(sec("Task list", (D.tasks||[]).length+" rows, Asana-importable order", [ table([{label:"Name",cls:"wrap",k:"Name"},{label:"Description",cls:"wrap",k:"Description"},{label:"Section",k:"Section/Column"},{label:"Priority",render:function(r){return chip(r.Priority, r.Priority==="High"?"bad": r.Priority==="Medium"?"warn":"na");}},{label:"Tags",k:"Tags"}], D.tasks, {emptyText:"No tasks yet."}) ]));
  root.appendChild(sec("Verify queue", "One row per thing this run could not see, with the exact place to check", [ table([{label:"ID",cls:"num",k:"id"},{label:"Item",cls:"wrap",k:"item"},{label:"Where",render:function(r){return link(r.url);}},{label:"What to do",cls:"wrap",k:"what"},{label:"Why it matters",cls:"wrap",k:"why"},{label:"Owner",k:"owner"}], D.verify_queue, {emptyText:"Nothing queued."}) ]));
}

/* ---------- Ledger ---------- */
function renderLedger(root){
  var rows=D.findings||[]; var filt=el("div",{class:"filters"}); var sm=el("select"); sm.appendChild(el("option",{value:"all",text:"all modules"})); Object.keys(MODULE_LABEL).forEach(function(k){ if(rows.some(function(f){return f.module===k;})) sm.appendChild(el("option",{value:k,text:MODULE_LABEL[k]})); }); var ss=el("select"); ["all severities","High","Medium","Low","Info","Win"].forEach(function(o){ss.appendChild(el("option",{value:o,text:o}));}); var se=el("select"); ["all evidence","observed","inferred","unverified"].forEach(function(o){se.appendChild(el("option",{value:o,text:o}));}); var so=el("select"); ["all owners","Agency","Client","Both"].forEach(function(o){so.appendChild(el("option",{value:o,text:o}));}); var q=el("input",{type:"search",placeholder:"search findings"}); [sm,ss,se,so,q].forEach(function(x){filt.appendChild(x);});
  var host=el("div"); function draw(){ var rs=rows.filter(function(f){ if(sm.value!=="all"&&f.module!==sm.value) return false; if(ss.value!=="all severities"&&f.severity!==ss.value) return false; if(se.value!=="all evidence"&&f.evidence_class!==se.value) return false; if(so.value!=="all owners"&&f.owner!==so.value) return false; var s=q.value.toLowerCase(); if(s&&JSON.stringify(f).toLowerCase().indexOf(s)<0) return false; return true; }); host.textContent=""; host.appendChild(findingsTable(rs,{emptyText:"No findings match."})); }
  [sm,ss,se,so].forEach(function(s){s.addEventListener("change",draw);}); q.addEventListener("input",draw); draw();
  var fs=M.findings||{}; root.appendChild(sec("Every finding", fs.n+" findings: "+Object.keys(fs.by_severity||{}).map(function(k){return (fs.by_severity[k])+" "+k;}).join(", "), [filt, host]));
  root.appendChild(sec("Sources", (D.sources||[]).length+" named sources; every metric traces to one", [ table([{label:"ID",cls:"num",k:"id"},{label:"Source",cls:"wrap",render:function(r){return r.url? link(r.url, r.label): txt(r.label);}},{label:"Kind",render:function(r){return chip(r.kind, r.kind==="vendor-estimate"?"warn": r.kind==="screenshot"||r.kind==="export"?"acc":"na");}},{label:"Ladder rung",cls:"num",k:"rung"},{label:"Date",k:"date"}], D.sources, {emptyText:"No sources recorded."}) ]));
  if((D.glossary||[]).length) root.appendChild(sec("Glossary", null, [ table([{label:"Term",k:"term"},{label:"Meaning and why it matters",cls:"wrap",k:"def"}], D.glossary) ]));
}

/* ---------- Method ---------- */
function renderMethod(root){
  var G=M.grading||{}, cov=M.coverage||{};
  root.appendChild(sec("How to read this page", null, [ card([ el("div",{class:"stack"},[
    p("Three evidence classes sit on every finding: observed (fetched, measured, exported or screenshot), inferred (pattern-based, flagged as such) and unverified (needs access this run lacked; it becomes a verify task, never an assertion). Unverified evidence never moves a grade."),
    p("Three dispositions sit on every compliance observation: CONFIRMED, CANDIDATE, CLEARED. Confidence (Confirmed, Plausible, Weak) and severity (High, Medium, Low) are separate axes. CONFIRMED never rests on Weak evidence and never carries an open control."),
    p("Authority is referring domains, link quality, brand footprint and tenure. No vendor authority score appears anywhere on this page. Keyword volumes, CPCs and download estimates, where present, are labeled vendor estimates."),
    p("Measurement and judgment never blur. Grades, gaps, shares and counts are computed from the run manifest by the metrics engine. Likelihoods on the Forecast tab are judgments in ICD 203 language with a falsifier each."),
    p("Nothing here is a guarantee. Outcomes in search, paid, social, app stores and compliance are never guaranteed; projections are hedged ranges with their assumptions listed.")
  ]) ]) ]));
  root.appendChild(sec("This run", null, [ el("div",{class:"grid-2"},[
    card([h4("Scope"), kv("Target", T.domain), kv("Business", T.business_name), kv("Archetype", META.archetype_label||T.archetype), T.archetype_secondary? kv("Secondary archetype", T.archetype_secondary):null, kv("Vertical", T.vertical||"not set"), kv("Codex overlays", (T.codex_overlays||[]).join(", ")||"none"), kv("Market nome", T.nome||"none"), kv("Geography", (T.geography||{}).label||"not set"), kv("Jurisdictions", (T.jurisdictions||[]).join(", ")||"not set"), kv("Posture", T.posture), kv("Surfaces", (T.surfaces||[]).join(", ")), kv("Question asked", T.question||"none recorded"), kv("Money pages", String((T.money_pages||[]).length))]),
    card([h4("Access and presence"), kv("Access tier", "Tier "+(RUN.tier==null?0:RUN.tier)), kv("Presence mode", (RUN.presence||{}).mode), kv("Presence line", (RUN.presence||{}).line||"not recorded"), kv("Declared UA", (RUN.presence||{}).declared_ua||"not recorded"), kv("Vantage", (RUN.presence||{}).vantage), kv("Fetches used", (RUN.fetches_used||0)+" of "+(RUN.fetch_budget||0)), kv("Cache", RUN.cache_dir||""), kv("Previous run", RUN.previous_run||"none"), kv("Doctrine date", META.doctrine_date||""), kv("Built", META.built_at||"")])
  ]), card([h4("Module status"), table([{label:"Module",render:function(r){return MODULE_LABEL[r.module]||r.module;}},{label:"Planned",render:function(r){return chip(r.planned?"planned":"not planned", r.planned?"acc":"na");}},{label:"Status",render:function(r){return chip(r.status.replace("_"," "), statusCls(r.status));}},{label:"Why",cls:"wrap",k:"why"},{label:"Sources",k:"sources"}], cov.modules||[])]),
    (RUN.judgment_calls||[]).length? card([h4("Judgment calls"), list(RUN.judgment_calls)]) : null ]));
  root.appendChild(sec("How grades are made", "the constants below are assets/grading.json", [ el("div",{class:"grid-2"},[
    card([h4("Defect density pillars (Technical, Content, Local, Authority, Paid, Social, AI, Apps)"), p("score = Σ severity weight × evidence multiplier × money-page multiplier over the pillar's findings; density = score ÷ items assessed (pages, listings, apps or campaigns); the density band gives the letter. Confidence is the observed share of the evidence weight. A pillar whose module did not run is NA; a partial read with no findings is ?.","small"), el("pre",{text:JSON.stringify({severity_weight:G.severity_weight, evidence_multiplier:G.evidence_multiplier, money_page_multiplier:G.money_page_multiplier, density_bands:G.density_bands, confidence_bands:G.confidence_bands},null,1)})]),
    card([h4("Disposition, market, competitive and agency pillars"), p("Compliance & Exposure is graded from dispositions, never density. Market Position is graded from the Moon eye's complaint share and stance. Competitive Position compares the client's Technical and Content grades with the top rival's five lens grades. Agency Fit is the share of High and Medium findings inherited from the agency of record's template or stack. An analyst may override a pillar with a stated why; the computed grade stays beside it.","small"), el("pre",{text:JSON.stringify({exposure_grade:G.exposure_grade, market_grade:G.market_grade, agency_fit_grade:G.agency_fit_grade, honest_count_rules:G.honest_count_rules},null,1)})])
  ]), card([h4("Brand Stereopsis"), p("For each topic w with floor count yF and brand count yB: delta = log((yF + a) / (nF + a0 - yF - a)) - log((yB + a) / (nB + a0 - yB - a)); var ≈ 1/(yF + a) + 1/(yB + a); z = delta / sqrt(var); a0 = number of topics; a = a0 × max(pooled count, 0.5) / (pooled n + 0.5 × topics). Monroe, Colaresi and Quinn (2008). Classes: beyond ±1.96 floor-led or broadcast-led; 1.0 to 1.96 leaning; below 1.0 balanced; one eye empty and the other at 3 (brand) or 2 (floor) items is one-eye-only.","small mono")]),
    card([h4("Rebuild"), el("pre",{text:"python3 scripts/omega_validate.py --manifest "+(RUN.cache_dir||"omega_cache/<domain>")+"/runs/"+(RUN.id||"<run>")+".json\npython3 scripts/omega_build.py --manifest "+(RUN.cache_dir||"omega_cache/<domain>")+"/runs/"+(RUN.id||"<run>")+".json --out omega-"+(T.domain||"domain")+".html"})]) ]));
}

/* ---------- boot ---------- */
function start(data){
  D = data; M = D.metrics || {}; MODS = D.modules || {}; AN = D.analysis || {}; PB = D.playbook || {}; RUN = D.run || {}; T = D.target || {}; META = D.meta || {};
  document.title = (T.business_name || T.domain || "Target") + ": digital position, exposure and market read";
  mast(); buildTabs();
  select((location.hash||"#brief").slice(1));
  hostPost({type:"omega:rendered", domain:T.domain, run_id:RUN.id});
}
(function boot(){
  var inline = document.getElementById("omega-data");
  var raw = inline ? inline.textContent.trim() : "";
  if (raw) { start(JSON.parse(raw)); return; }
  window.addEventListener("message", function(ev){ var m=ev.data||{}; if(m.type==="omega:data" && m.data && !D) start(m.data); });
  hostPost({type:"omega:ready"});
})();
})();
