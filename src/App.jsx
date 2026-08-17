import { useState, useRef, useEffect, useCallback } from "react";

const C = { bg:"#0b0e1a",surface:"#111526",surface2:"#1a1f35",border:"#252b45",accent:"#6c63ff",accent2:"#00d4aa",accent3:"#ff6b6b",text:"#e8eaf6",muted:"#7b82a8" };

const inp = { background:C.surface2,border:"1px solid "+C.border,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%" };
const sel = { background:C.surface2,border:"1px solid "+C.border,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%" };
const tex = { background:C.surface2,border:"1px solid "+C.border,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",minHeight:70,resize:"vertical" };
const lab = { fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6 };
const btn = { background:"linear-gradient(135deg,#6c63ff,#8b7bff)",color:"#fff",border:"none",borderRadius:9,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",marginTop:12 };
const ghost = { background:"transparent",color:C.muted,border:"1px solid "+C.border,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer" };
const rbox = { background:C.surface2,border:"1px solid rgba(108,99,255,.3)",borderRadius:12,padding:16,marginTop:14 };
const wrap = { flex:1,overflowY:"auto",padding:18 };

const MEM_KEY = "cai_v1";
function loadMem() { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || null; } catch { return null; } }
function saveMem(m) { try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch {} }
const DEF = { user:{name:"Henri Marcel Konan",niche:"",cible:""}, produits:[], analyses:[], prompts:[], posts:[], historique:[], revenus:[], chatHistory:[], lastUpdated:null };

// ── COPY MODAL ──
function CopyModal(props) {
  var text = props.text; var onClose = props.onClose;
  var ref = useRef();
  useEffect(function(){
    if (ref.current) {
      ref.current.select();
      try { document.execCommand("copy"); } catch(e){}
    }
  },[]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,.7)"}}>
      <div style={{background:C.surface,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>📋 Copier le texte</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <p style={{fontSize:12,color:C.accent2,marginBottom:10}}>👆 Appuie longuement sur le texte → "Tout sélectionner" → "Copier" → colle dans Google Docs</p>
        <textarea ref={ref} readOnly value={text}
          style={{flex:1,background:C.surface2,border:"1px solid "+C.border,borderRadius:10,padding:12,color:C.text,fontSize:13,lineHeight:1.7,fontFamily:"inherit",resize:"none",outline:"none",minHeight:200}}/>
        <button onClick={onClose} style={Object.assign({},btn,{marginTop:12})}>✅ Fermer</button>
      </div>
    </div>
  );
}

function copyText(text, onResult) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function(){ onResult(true); }).catch(function(){ onResult(false); });
  } else {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position="fixed"; ta.style.left="-9999px";
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta); onResult(!!ok);
    } catch(e) { onResult(false); }
  }
}

// Détecte si on est dans Claude.ai (artifact) ou sur Vercel (production)
const IS_CLAUDE = typeof window !== "undefined" && window.location.href.includes("claude.ai");
const API_URL = IS_CLAUDE
  ? "https://api.anthropic.com/v1/messages"  // direct depuis Claude.ai
  : "/api/chat";                               // backend sécurisé sur Vercel

async function ai(system, msg, history) {
  const fullSystem = system + "\n\nIMPORTANT : Reste concis et structuré. Termine TOUJOURS ta réponse complètement. Si le sujet est vaste, fais un résumé complet plutôt qu'un développement trop long.";
  const msgs = history && history.length ? [...history,{role:"user",content:msg}] : [{role:"user",content:msg}];

  if (IS_CLAUDE) {
    // Mode Claude.ai : appel direct (clé gérée par Claude)
    const r = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,system:fullSystem,messages:msgs})
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return d.content[0].text;
  } else {
    // Mode Vercel : appel via notre backend sécurisé
    const r = await fetch(API_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({system:fullSystem,messages:msgs,max_tokens:2000})
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d.text;
  }
}

function ctx(mem) {
  if (!mem) return "";
  const p = [];
  if (mem.user?.niche) p.push("Niche: "+mem.user.niche);
  if (mem.user?.cible) p.push("Cible: "+mem.user.cible);
  if (mem.produits?.length) p.push("Produits créés: "+mem.produits.map(function(x){return x.titre;}).join(", "));
  if (mem.analyses?.length) p.push("Sites analysés: "+mem.analyses.map(function(x){return x.url;}).join(", "));
  return p.length ? "\n\nCONTEXTE:\n"+p.join("\n") : "";
}

function addHist(prev, outil, apercu, contenu) {
  return { historique:[...(prev.historique||[]),{outil:outil,apercu:apercu.slice(0,60),contenu:contenu,date:new Date().toISOString()}], lastUpdated:new Date().toISOString() };
}

// ── CHAT ──
function ChatPanel(props) {
  var mem = props.memory; var upd = props.onMemoryUpdate;
  var saved = mem.chatHistory || [];
  var initMsgs = saved.length ? saved.map(function(h){return {role:h.role==="user"?"user":"ai",text:h.content};}) : [{role:"ai",text:"Bonjour "+(mem.user.name||"Henri")+" ! 👋 Comment puis-je vous aider aujourd'hui ?"+(mem.user.niche?" Je sais que tu travailles dans la niche "+mem.user.niche+".":"")}];
  var [msgs,setMsgs] = useState(initMsgs);
  var [inp2,setInp2] = useState("");
  var [loading,setLoading] = useState(false);
  var [hist,setHist] = useState(saved.filter(function(h){return h.role==="user"||h.role==="assistant";}).slice(-10));
  var bot = useRef();
  useEffect(function(){bot.current&&bot.current.scrollIntoView({behavior:"smooth"});},[msgs]);

  async function send() {
    if (!inp2.trim()||loading) return;
    var m = inp2.trim(); setInp2(""); setLoading(true);
    setMsgs(function(prev){return [...prev,{role:"user",text:m}];});
    var nh = [...hist,{role:"user",content:m}];
    setHist(nh);
    try {
      var sys = "Tu es un assistant expert en création et vente de produits numériques pour entrepreneurs africains francophones. Réponds en français."+ctx(mem);
      var reply = await ai(sys, m, hist);
      var uh = [...nh,{role:"assistant",content:reply}];
      setHist(uh);
      setMsgs(function(prev){return [...prev,{role:"ai",text:reply}];});
      upd(function(p){return Object.assign({},p,{chatHistory:uh.slice(-20),lastUpdated:new Date().toISOString()});});
    } catch(e) {
      setMsgs(function(prev){return [...prev,{role:"ai",text:"Erreur: "+e.message}];});
    }
    setLoading(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map(function(m,i){
          return (
            <div key={i} style={{display:"flex",gap:8,alignSelf:m.role==="user"?"flex-end":"flex-start",flexDirection:m.role==="user"?"row-reverse":"row",maxWidth:"82%"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:m.role==="ai"?"linear-gradient(135deg,#6c63ff,#00d4aa)":"linear-gradient(135deg,#6c63ff,#ff6b6b)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,color:"#fff",fontWeight:700}}>
                {m.role==="ai"?"🤖":(mem.user.name||"H")[0]}
              </div>
              <div>
                <div style={{padding:"9px 12px",borderRadius:m.role==="ai"?"4px 12px 12px 12px":"12px 4px 12px 12px",background:m.role==="ai"?C.surface2:"linear-gradient(135deg,#6c63ff,#8b7bff)",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap",border:m.role==="ai"?"1px solid "+C.border:"none",color:C.text}}>
                  {m.text}
                </div>
                {m.role==="ai" && m.text.length>120 && (
                  <ChatCopyBtn text={m.text}/>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{display:"flex",gap:8}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6c63ff,#00d4aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
            <div style={{padding:"10px 12px",background:C.surface2,border:"1px solid "+C.border,borderRadius:"4px 12px 12px 12px",display:"flex",gap:4,alignItems:"center"}}>
              <span style={{animation:"bounce 0.8s 0s infinite",display:"inline-block"}}>•</span>
              <span style={{animation:"bounce 0.8s 0.15s infinite",display:"inline-block"}}>•</span>
              <span style={{animation:"bounce 0.8s 0.3s infinite",display:"inline-block"}}>•</span>
            </div>
          </div>
        )}
        <div ref={bot}/>
      </div>
      <div style={{padding:"10px 14px",borderTop:"1px solid "+C.border,background:C.surface,flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",background:C.surface2,border:"1px solid "+C.border,borderRadius:12,padding:"8px 12px"}}>
          <textarea value={inp2} onChange={function(e){setInp2(e.target.value);}}
            onKeyDown={function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Posez votre question..." rows={1}
            style={{background:"transparent",border:"none",outline:"none",color:C.text,fontSize:13,fontFamily:"inherit",resize:"none",flex:1,minHeight:20}}/>
          <button onClick={send} disabled={loading} style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#6c63ff,#8b7bff)",border:"none",cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>➤</button>
        </div>
      </div>
    </div>
  );
}

// ── RESULT BOX (with robust copy for Google Docs etc.) ──
function ResultBox(props) {
  var title = props.title || "✅ Résultat généré";
  var content = props.content;
  var [status, setStatus] = useState("idle"); // idle | copied | failed
  var [showSelect, setShowSelect] = useState(false);
  var taRef = useRef();

  function handleCopy() {
    copyText(content, function(ok) {
      if (ok) {
        setStatus("copied");
        setTimeout(function(){ setStatus("idle"); }, 2000);
      } else {
        setStatus("failed");
        setShowSelect(true);
      }
    });
  }

  useEffect(function(){
    if (showSelect && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, [showSelect]);

  return (
    <div style={rbox}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
        <span style={{fontSize:12,fontWeight:600,color:C.accent2}}>{title}</span>
        <div style={{display:"flex",gap:6}}>
          <button onClick={handleCopy} style={Object.assign({},ghost,{color:status==="copied"?C.accent2:C.muted})}>
            {status==="copied"?"✅ Copié !":"📋 Copier"}
          </button>
          <button onClick={function(){setShowSelect(function(s){return !s;});}} style={ghost}>
            {showSelect?"✕ Fermer":"📄 Pour Google Docs"}
          </button>
        </div>
      </div>
      {status==="failed" && (
        <div style={{fontSize:11,color:C.accent3,marginBottom:8,background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.2)",borderRadius:8,padding:"6px 10px"}}>
          La copie automatique a échoué. Le texte ci-dessous est sélectionné — appuie longuement et choisis "Copier", puis colle-le dans Google Docs.
        </div>
      )}
      {showSelect ? (
        <textarea
          ref={taRef}
          readOnly
          value={content}
          onFocus={function(e){e.target.select();}}
          style={Object.assign({}, tex, {minHeight:180, fontSize:12, lineHeight:1.6, color:C.text})}
        />
      ) : (
        <div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap",color:C.text}}>{content}</div>
      )}
      {showSelect && (
        <div style={{fontSize:11,color:C.muted,marginTop:8}}>
          💡 Astuce : touche le texte ci-dessus, sélectionne tout (déjà fait automatiquement), copie, puis ouvre Google Docs et colle.
        </div>
      )}
    </div>
  );
}

// ── GENERIC TOOL PANEL ──
function ToolPanel(props) {
  var cfg = props.config; var mem = props.memory; var upd = props.onMemoryUpdate;
  var [vals,setVals] = useState({});
  var [result,setResult] = useState("");
  var [loading,setLoading] = useState(false);

  function setVal(k,v){setVals(function(prev){var n={};Object.assign(n,prev);n[k]=v;return n;});}

  async function generate() {
    setLoading(true); setResult("");
    try {
      var sys = cfg.system + ctx(mem);
      var r = await ai(sys, cfg.prompt(vals));
      setResult(r);
      if (cfg.onSave && upd) upd(function(p){return Object.assign({},p,cfg.onSave(p,vals,r));});
    } catch(e) { setResult("Erreur: "+e.message); }
    setLoading(false);
  }


  return (
    <div style={wrap}>
      {cfg.memoBanner && mem && (function(){
        var count = cfg.memoBanner(mem);
        return count > 0 ? <div style={{background:"rgba(0,212,170,.08)",border:"1px solid rgba(0,212,170,.2)",borderRadius:10,padding:"9px 13px",marginBottom:14,fontSize:12,color:C.accent2}}>🧠 {count} action(s) précédente(s) — l'IA s'en souvient.</div> : null;
      })()}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        {cfg.fields.map(function(f){
          return (
            <div key={f.key} style={f.full?{gridColumn:"1/-1"}:{}}>
              <label style={lab}>{f.label}</label>
              {f.type==="select" ? (
                <select style={sel} value={vals[f.key]||f.options[0]} onChange={function(e){setVal(f.key,e.target.value);}}>
                  {f.options.map(function(o){return <option key={o}>{o}</option>;})}
                </select>
              ) : f.type==="textarea" ? (
                <textarea style={tex} placeholder={f.ph||""} value={vals[f.key]||""} onChange={function(e){setVal(f.key,e.target.value);}}/>
              ) : (
                <input style={inp} placeholder={f.ph||""} value={vals[f.key]||""} onChange={function(e){setVal(f.key,e.target.value);}}/>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={generate} disabled={loading} style={btn}>
        {loading?"⏳ Génération en cours...":cfg.btnLabel}
      </button>
      {result && <ResultBox content={result}/>}
    </div>
  );
}

// ── PRICING PANEL ──
function PricingPanel(props) {
  var mem = props.memory;
  var [calc,setCalc] = useState({prix:"",ventes:"",cout:""});
  var [marge,setMarge] = useState(null);
  var [vals,setVals] = useState({type:"Ebook",marche:"Afrique francophone"});
  var [result,setResult] = useState("");
  var [loading,setLoading] = useState(false);

  function setV(k,v){setVals(function(p){var n={};Object.assign(n,p);n[k]=v;return n;});}
  function setC(k,v){setCalc(function(p){var n={};Object.assign(n,p);n[k]=v;return n;});}

  function calcMarge(){
    var p=parseFloat(calc.prix)||0,v=parseFloat(calc.ventes)||0,c=parseFloat(calc.cout)||0;
    var rev=p*v,ben=rev-c;
    setMarge({rev:rev,ben:ben,pct:rev>0?((ben/rev)*100).toFixed(1):0,tax:(ben*0.15).toFixed(0)});
  }

  async function analyze(){
    if (!vals.produit) return;
    setLoading(true); setResult("");
    try {
      var sys = "Tu es un expert en pricing de produits numériques pour marchés africains. Réponds en français avec des données réalistes en XAF."+ctx(mem);
      var p = "Stratégie de prix pour: \""+vals.produit+"\" ("+vals.type+", marché "+vals.marche+"). Fournis: prix minimum, prix recommandé, prix premium, stratégie early bird, revenus à 10/50/100 ventes, comparaison marché, 3 conseils pour maximiser la valeur perçue.";
      var r = await ai(sys, p);
      setResult(r);
    } catch(e){setResult("Erreur: "+e.message);}
    setLoading(false);
  }

  var stats = marge ? [["Revenu mensuel",marge.rev.toLocaleString()+" XAF",C.accent2],["Bénéfice net",marge.ben.toLocaleString()+" XAF",C.accent],["Marge",marge.pct+"%","#f59e0b"],["Impôt (15%)",parseInt(marge.tax).toLocaleString()+" XAF",C.accent3]] : [];

  return (
    <div style={wrap}>
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:600,color:C.accent2,marginBottom:12}}>💰 Calculateur rapide</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          {[["Prix (XAF)","prix","9900"],["Ventes/mois","ventes","20"],["Coût total XAF","cout","0"]].map(function(f){
            return <div key={f[1]}><label style={lab}>{f[0]}</label><input style={inp} type="number" placeholder={f[2]} value={calc[f[1]]} onChange={function(e){setC(f[1],e.target.value);}}/></div>;
          })}
        </div>
        <button onClick={calcMarge} style={Object.assign({},btn,{marginTop:0})}>🧮 Calculer</button>
        {marge && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
            {stats.map(function(s,i){
              return <div key={i} style={{background:C.surface2,borderRadius:9,padding:"10px 12px",textAlign:"center"}}><div style={{fontSize:11,color:C.muted,marginBottom:4}}>{s[0]}</div><div style={{fontSize:15,fontWeight:700,color:s[2]}}>{s[1]}</div></div>;
            })}
          </div>
        )}
      </div>
      <div style={{marginBottom:12}}>
        <label style={lab}>Produit à analyser</label>
        <input style={Object.assign({},inp,{marginBottom:10})} placeholder="Ex: Ebook sur les finances personnelles" value={vals.produit||""} onChange={function(e){setV("produit",e.target.value);}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["Type","type",["Ebook","Cours en ligne","Template","Coaching","Membership","Pack"]],["Marché","marche",["Afrique francophone","France","International"]]].map(function(f){
            return <div key={f[1]}><label style={lab}>{f[0]}</label><select style={sel} value={vals[f[1]]} onChange={function(e){setV(f[1],e.target.value);}}>{f[2].map(function(o){return <option key={o}>{o}</option>;})}</select></div>;
          })}
        </div>
      </div>
      <button onClick={analyze} disabled={loading} style={btn}>{loading?"⏳ Analyse...":"💰 Analyser ma stratégie de prix"}</button>
      {result && <ResultBox content={result} title="💡 Stratégie recommandée"/>}
    </div>
  );
}

// ── CALENDAR PANEL ──
function CalendarPanel(props) {
  var mem = props.memory; var upd = props.onMemoryUpdate;
  var [niche,setNiche] = useState(mem.user.niche||"");
  var [periode,setPeriode] = useState("1 semaine");
  var [plateforme,setPlateforme] = useState("Instagram");
  var [objectif,setObjectif] = useState("");
  var [result,setResult] = useState("");
  var [loading,setLoading] = useState(false);
  var today = new Date();
  var jours = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  var week = [];
  for (var i=0;i<7;i++){var d=new Date(today);d.setDate(today.getDate()+i);week.push({short:jours[d.getDay()],num:d.getDate(),full:d.toLocaleDateString("fr-FR")});}
  var [selDay,setSelDay] = useState(null);
  var [tasks,setTasks] = useState({});

  async function generate(){
    if (!niche) return;
    setLoading(true); setResult("");
    try {
      var sys = "Tu es un expert en stratégie de contenu pour réseaux sociaux. Réponds en français avec un planning actionnable."+ctx(mem);
      var p = "Calendrier éditorial "+periode+" pour "+plateforme+", niche \""+niche+"\", objectif: "+(objectif||"vendre des produits numériques")+". Pour chaque jour: type de post, sujet précis, format, horaire de publication.";
      var r = await ai(sys, p);
      setResult(r);
      if(upd) upd(function(prev){return Object.assign({},prev,addHist(prev,"🗓️ Calendrier",niche,r));});
    } catch(e){setResult("Erreur: "+e.message);}
    setLoading(false);
  }

  return (
    <div style={wrap}>
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {week.map(function(d,i){
          return (
            <div key={i} onClick={function(){setSelDay(selDay===i?null:i);}} style={{flex:"0 0 auto",width:46,textAlign:"center",padding:"8px 4px",borderRadius:10,background:selDay===i?"rgba(108,99,255,.2)":C.surface,border:"1px solid "+(selDay===i?"rgba(108,99,255,.5)":C.border),cursor:"pointer"}}>
              <div style={{fontSize:10,color:C.muted}}>{d.short}</div>
              <div style={{fontSize:15,fontWeight:700,color:selDay===i?C.accent:C.text,margin:"4px 0"}}>{d.num}</div>
              {tasks[d.full]&&tasks[d.full].length>0&&<div style={{width:6,height:6,borderRadius:"50%",background:C.accent2,margin:"0 auto"}}/>}
            </div>
          );
        })}
      </div>
      {selDay!==null && (
        <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600}}>{week[selDay].full}</span>
          </div>
          {!(tasks[week[selDay].full]&&tasks[week[selDay].full].length) ? (
            <div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"8px 0"}}>Aucune tâche pour ce jour.</div>
          ) : (tasks[week[selDay].full]||[]).map(function(t,i){
            return <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid "+C.border,fontSize:12}}><span style={{color:C.accent2}}>✓</span>{t}</div>;
          })}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={lab}>Période</label><select style={sel} value={periode} onChange={function(e){setPeriode(e.target.value);}}>{["1 semaine","2 semaines","1 mois"].map(function(p){return <option key={p}>{p}</option>;})}</select></div>
        <div><label style={lab}>Plateforme</label><select style={sel} value={plateforme} onChange={function(e){setPlateforme(e.target.value);}}>{["Instagram","Facebook","TikTok","LinkedIn","Toutes"].map(function(p){return <option key={p}>{p}</option>;})}</select></div>
        <div style={{gridColumn:"1/-1"}}><label style={lab}>Ta niche</label><input style={inp} placeholder="Ex: Marketing digital, Finances..." value={niche} onChange={function(e){setNiche(e.target.value);}}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={lab}>Objectif principal</label><input style={inp} placeholder="Ex: Vendre mon ebook..." value={objectif} onChange={function(e){setObjectif(e.target.value);}}/></div>
      </div>
      <button onClick={generate} disabled={loading} style={btn}>{loading?"⏳ Génération...":"🗓️ Générer mon planning"}</button>
      {result&&<ResultBox content={result} title="📅 Planning généré"/>}
    </div>
  );
}

// ── REVENUE PANEL ──
function RevenuePanel(props) {
  var mem = props.memory; var upd = props.onMemoryUpdate;
  var [entries,setEntries] = useState(mem.revenus||[]);
  var [form,setForm] = useState({produit:"",montant:"",plateforme:"Selar",date:new Date().toISOString().split("T")[0]});
  var [advice,setAdvice] = useState("");
  var [loading,setLoading] = useState(false);

  function setF(k,v){setForm(function(p){var n={};Object.assign(n,p);n[k]=v;return n;});}

  function addEntry(){
    if (!form.produit||!form.montant) return;
    var ne = {produit:form.produit,montant:parseFloat(form.montant)||0,plateforme:form.plateforme,date:form.date};
    var updated = [...entries,ne];
    setEntries(updated);
    setForm({produit:"",montant:"",plateforme:"Selar",date:new Date().toISOString().split("T")[0]});
    if(upd) upd(function(p){return Object.assign({},p,{revenus:updated,lastUpdated:new Date().toISOString()});});
  }

  var total = entries.reduce(function(s,e){return s+e.montant;},0);
  var byProd = {};
  entries.forEach(function(e){byProd[e.produit]=(byProd[e.produit]||0)+e.montant;});

  async function getAdvice(){
    if (!entries.length) return;
    setLoading(true);
    try {
      var summary = entries.map(function(e){return e.produit+": "+e.montant+" XAF ("+e.plateforme+")";}).join(", ");
      var r = await ai("Tu es un expert en business de produits numériques en Afrique francophone. Réponds en français avec des conseils concrets."+ctx(mem),"Analyse mes ventes: "+summary+". Total: "+total+" XAF. Donne 5 conseils pour augmenter mes revenus.");
      setAdvice(r);
    } catch(e){setAdvice("Erreur: "+e.message);}
    setLoading(false);
  }

  return (
    <div style={wrap}>
      <div style={{background:"linear-gradient(135deg,rgba(108,99,255,.15),rgba(0,212,170,.08))",border:"1px solid rgba(108,99,255,.25)",borderRadius:12,padding:16,marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>TOTAL REVENUS</div>
        <div style={{fontSize:28,fontWeight:800,color:C.accent2}}>{total.toLocaleString()} XAF</div>
        <div style={{fontSize:12,color:C.muted,marginTop:4}}>{entries.length} vente(s) enregistrée(s)</div>
      </div>
      {Object.keys(byProd).length>0&&(
        <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:C.accent2,marginBottom:10}}>📊 Par produit</div>
          {Object.entries(byProd).map(function(e){
            return <div key={e[0]} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid "+C.border,fontSize:12}}><span>{e[0]}</span><strong style={{color:C.accent2}}>{e[1].toLocaleString()} XAF</strong></div>;
          })}
        </div>
      )}
      <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:C.accent2,marginBottom:10}}>➕ Ajouter une vente</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{gridColumn:"1/-1"}}><label style={lab}>Produit</label><input style={inp} placeholder="Ex: Ebook Marketing" value={form.produit} onChange={function(e){setF("produit",e.target.value);}}/></div>
          <div><label style={lab}>Montant (XAF)</label><input style={inp} type="number" placeholder="9900" value={form.montant} onChange={function(e){setF("montant",e.target.value);}}/></div>
          <div><label style={lab}>Plateforme</label><select style={sel} value={form.plateforme} onChange={function(e){setF("plateforme",e.target.value);}}>{["Selar","Gumroad","Payhip","WhatsApp","Direct"].map(function(p){return <option key={p}>{p}</option>;})}</select></div>
          <div style={{gridColumn:"1/-1"}}><label style={lab}>Date</label><input style={inp} type="date" value={form.date} onChange={function(e){setF("date",e.target.value);}}/></div>
        </div>
        <button onClick={addEntry} style={Object.assign({},btn,{marginTop:0})}>➕ Ajouter</button>
      </div>
      {entries.length>0&&<button onClick={getAdvice} disabled={loading} style={btn}>{loading?"⏳ Analyse...":"🤖 Obtenir des conseils IA"}</button>}
      {advice&&<ResultBox content={advice} title="💡 Conseils personnalisés"/>}
    </div>
  );
}

// ── IMAGE PANEL ──
function ImagePanel(props) {
  var mem = props.memory;
  var [desc,setDesc] = useState("");
  var [style,setStyle] = useState("Réaliste");
  var [result,setResult] = useState(null);
  var [loading,setLoading] = useState(false);
  var [copied,setCopied] = useState(false);
  var [showPrompt,setShowPrompt] = useState(false);
  var styles = ["Réaliste","Illustration","Minimaliste","Coloré","Dark Mode","3D Futuriste","Aquarelle","Cinématique"];
  var grads = {"Réaliste":["#1a1a2e","#16213e","#e8b86d"],"Illustration":["#667eea","#764ba2","#f9ca24"],"Minimaliste":["#2d3436","#636e72","#dfe6e9"],"Coloré":["#f093fb","#f5576c","#4facfe"],"Dark Mode":["#0a0a0a","#1a1a2e","#00f2fe"],"3D Futuriste":["#0f0c29","#302b63","#a78bfa"],"Aquarelle":["#a18cd1","#fbc2eb","#ffecd2"],"Cinématique":["#141e30","#243b55","#f5af19"]};

  async function generate(){
    if (!desc.trim()) return;
    setLoading(true); setResult(null);
    try {
      var sys = "Tu es un expert en création visuelle et prompt engineering. Réponds UNIQUEMENT en JSON valide sans markdown ni backticks."+ctx(mem);
      var p = "Description: \""+desc+"\", Style: \""+style+"\". Genere un JSON avec ces champs: title (titre court en français), subtitle (sous-titre court), keywords (tableau de 3 mots-clés), prompt (prompt anglais optimisé pour DALL-E/Midjourney max 60 mots), emoji. Exemple: {\"title\":\"...\",\"subtitle\":\"...\",\"keywords\":[\"...\",\"...\",\"...\"],\"prompt\":\"...\",\"emoji\":\"...\"}";
      var data = await ai(sys, p);
      var clean = data.replace(/```json/g,"").replace(/```/g,"").trim();
      var parsed = JSON.parse(clean);
      setResult(Object.assign({},parsed,{style:style}));
    } catch(e){alert("Erreur: "+e.message);}
    setLoading(false);
  }

  var g = result ? (grads[result.style]||grads["Réaliste"]) : ["#1a1a2e","#16213e","#e8b86d"];
  var sites = [["Ideogram.ai","https://ideogram.ai","🎨"],["Bing Image","https://www.bing.com/images/create","🖼️"],["Canva IA","https://canva.com/ai-image-generator","🖌️"],["Adobe Firefly","https://firefly.adobe.com","🔥"]];

  return (
    <div style={wrap}>
      <div style={{marginBottom:12}}><label style={lab}>Décrivez votre image en français</label><textarea style={tex} placeholder="Ex: Couverture ebook finances personnelles, fond sombre accents dorés..." value={desc} onChange={function(e){setDesc(e.target.value);}}/></div>
      <div style={{marginBottom:12}}><label style={lab}>Style visuel</label><select style={sel} value={style} onChange={function(e){setStyle(e.target.value);}}>{styles.map(function(st){return <option key={st}>{st}</option>;})}</select></div>
      <button onClick={generate} disabled={loading} style={btn}>{loading?"⏳ Génération...":"🎨 Générer avec l'IA"}</button>
      {result&&(
        <div style={{marginTop:16}}>
          <div style={{borderRadius:12,background:"linear-gradient(135deg,"+g[0]+","+g[1]+")",padding:28,textAlign:"center",marginBottom:12,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"radial-gradient(circle at 70% 30%,"+g[2]+"44,transparent 60%)"}}/>
            <div style={{fontSize:46}}>{result.emoji}</div>
            <div style={{fontSize:17,fontWeight:800,color:"#fff",marginTop:8,textShadow:"0 2px 8px rgba(0,0,0,.5)"}}>{result.title}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.75)",marginTop:4}}>{result.subtitle}</div>
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap",justifyContent:"center"}}>
              {(result.keywords||[]).map(function(k,i){return <span key={i} style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:"rgba(255,255,255,.15)",color:"rgba(255,255,255,.9)"}}>{k}</span>;})}
            </div>
          </div>
          <div style={{background:C.surface2,border:"1px solid rgba(108,99,255,.3)",borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:C.accent2}}>🚀 Prompt à coller</span>
              <button onClick={function(){setShowPrompt(function(s){return !s;});}} style={Object.assign({},ghost,{color:C.accent2})}>
                {showPrompt?"✕ Fermer":"📋 Pour Google Docs"}
              </button>
            </div>
            <div style={{fontSize:12,fontStyle:"italic",lineHeight:1.6,color:C.text}}>"{result.prompt}"</div>
            {showPrompt && (
              <div style={{marginTop:8}}>
                <textarea readOnly value={result.prompt} onFocus={function(e){e.target.select();}}
                  style={{width:"100%",background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:10,color:C.text,fontSize:12,lineHeight:1.6,fontFamily:"inherit",minHeight:80}}/>
                <div style={{fontSize:10,color:C.muted,marginTop:4}}>👆 Appuie longuement → Tout sélectionner → Copier → colle dans Google Docs</div>
              </div>
            )}
          </div>
          <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:10,padding:12}}>
            <div style={{fontSize:10,fontWeight:600,color:C.muted,marginBottom:8,textTransform:"uppercase"}}>Sites gratuits pour générer :</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {sites.map(function(s){return <a key={s[0]} href={s[1]} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><div style={{padding:"5px 11px",borderRadius:20,background:C.surface2,border:"1px solid "+C.border,fontSize:11,fontWeight:600,color:C.text}}>{s[2]} {s[0]}</div></a>;})}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AD LIBRARY ──
function AdPanel() {
  var ads = [
    {emoji:"🎓",brand:"FormationPro.ci",headline:"Apprenez le Marketing Digital en 30 jours",platform:"Facebook",likes:"4.2K",bg:"linear-gradient(135deg,#667eea,#764ba2)"},
    {emoji:"💰",brand:"CashFlow Africa",headline:"Comment j'ai gagné 500 000 XAF en 1 mois avec un ebook",platform:"TikTok",likes:"22K",bg:"linear-gradient(135deg,#4facfe,#00f2fe)"},
    {emoji:"💄",brand:"GlowSkin.co",headline:"La routine beauté qui transforme votre peau en 14 jours",platform:"Instagram",likes:"9.8K",bg:"linear-gradient(135deg,#f093fb,#f5576c)"},
    {emoji:"🏋️",brand:"FitLife Abidjan",headline:"Perdez 5 kg en 21 jours avec notre programme adapté",platform:"Facebook",likes:"7.1K",bg:"linear-gradient(135deg,#43e97b,#38f9d7)"},
    {emoji:"🧠",brand:"MindsetCoach",headline:"5 habitudes des millionnaires africains que personne n'enseigne",platform:"LinkedIn",likes:"11K",bg:"linear-gradient(135deg,#a18cd1,#fbc2eb)"},
    {emoji:"🛍️",brand:"ShopAfrik",headline:"Livraison gratuite sur toute la Côte d'Ivoire",platform:"Instagram",likes:"3.5K",bg:"linear-gradient(135deg,#fa709a,#fee140)"},
  ];
  return (
    <div style={wrap}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {ads.map(function(ad,i){
          return (
            <div key={i} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
              <div style={{height:110,background:ad.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,position:"relative"}}>
                {ad.emoji}
                <span style={{position:"absolute",top:8,right:8,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:5,background:"rgba(0,0,0,.6)",color:"#fff"}}>{ad.platform}</span>
              </div>
              <div style={{padding:10}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:3}}>{ad.brand}</div>
                <div style={{fontSize:12,fontWeight:600,lineHeight:1.4,marginBottom:6}}>{ad.headline}</div>
                <div style={{fontSize:11,color:C.muted}}>❤️ <strong style={{color:C.accent2}}>{ad.likes}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HISTORY PANEL ──
function HistoryPanel(props) {
  var mem = props.memory; var upd = props.onMemoryUpdate;
  var hist = mem.historique||[];
  var [filter,setFilter] = useState("Tous");
  var [expanded,setExpanded] = useState(null);
  var outils = ["Tous"].concat(hist.map(function(h){return h.outil;}).filter(function(v,i,a){return a.indexOf(v)===i;}));
  var filtered = filter==="Tous" ? [...hist].reverse() : hist.filter(function(h){return h.outil===filter;}).reverse();

  function del(item){
    var idx = hist.findIndex(function(h){return h.date===item.date&&h.outil===item.outil;});
    if(idx>=0){var n=hist.filter(function(_,i){return i!==idx;});upd(function(p){return Object.assign({},p,{historique:n,lastUpdated:new Date().toISOString()});});}
  }

  return (
    <div style={wrap}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {outils.map(function(o){return <button key={o} onClick={function(){setFilter(o);setExpanded(null);}} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",border:"1px solid "+(filter===o?"rgba(108,99,255,.5)":C.border),background:filter===o?"rgba(108,99,255,.15)":"transparent",color:filter===o?C.text:C.muted}}>{o}</button>;})}
      </div>
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"50px 20px",color:C.muted}}>
          <div style={{fontSize:40,marginBottom:12}}>📂</div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>Aucune génération encore</div>
          <div style={{fontSize:12}}>Utilise les outils pour créer du contenu — il apparaîtra ici.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(function(h,i){
            return (
              <div key={i} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}} onClick={function(){setExpanded(expanded===i?null:i);}}>
                  <span style={{fontSize:16}}>{h.outil.split(" ")[0]}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600}}>{h.outil}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>{h.apercu}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:C.muted}}>{new Date(h.date).toLocaleDateString("fr-FR")}</span>
                    <span style={{color:C.muted}}>{expanded===i?"▲":"▼"}</span>
                  </div>
                </div>
                {expanded===i&&(
                  <div style={{borderTop:"1px solid "+C.border,padding:14}}>
                    <ResultBox content={h.contenu} title="📄 Contenu"/>
                    <button onClick={function(){del(h);}} style={Object.assign({},ghost,{width:"100%",color:C.accent3,borderColor:C.accent3,marginTop:8})}>🗑️ Supprimer</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MEMORY BADGE ──
function MemBadge(props) {
  var mem = props.memory;
  var count = (mem.produits||[]).length+(mem.analyses||[]).length+(mem.prompts||[]).length+(mem.posts||[]).length;
  return <div onClick={props.onView} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 9px",borderRadius:20,background:"rgba(0,212,170,.1)",border:"1px solid rgba(0,212,170,.25)",cursor:"pointer",fontSize:11,fontWeight:600,color:C.accent2}}>🧠 {count}</div>;
}

// ── MEMORY MODAL ──
function MemModal(props) {
  var mem = props.memory; var onUpd = props.onUpdate; var onClose = props.onClose;
  var [name,setName] = useState(mem.user.name||"");
  var [niche,setNiche] = useState(mem.user.niche||"");
  var [cible,setCible] = useState(mem.user.cible||"");

  function save(){onUpd(function(p){return Object.assign({},p,{user:Object.assign({},p.user,{name:name,niche:niche,cible:cible}),lastUpdated:new Date().toISOString()});});onClose();}
  function clearAll(){if(window.confirm("Effacer toute la mémoire ?")){onUpd(function(){return Object.assign({},DEF);});onClose();}}

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,.65)"}}>
      <div style={{background:C.surface,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:15,fontWeight:700}}>🧠 Mémoire de l'IA</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{background:C.surface2,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:C.accent2,marginBottom:10}}>👤 Ton profil</div>
          {[["Ton nom",name,setName,"Henri Marcel Konan"],["Ta niche",niche,setNiche,"Ex: Marketing digital, Finances..."],["Ton public cible",cible,setCible,"Ex: Entrepreneurs africains débutants"]].map(function(f){
            return <div key={f[0]} style={{marginBottom:10}}><label style={lab}>{f[0]}</label><input style={inp} placeholder={f[3]} value={f[1]} onChange={function(e){f[2](e.target.value);}}/></div>;
          })}
          <button onClick={save} style={btn}>💾 Sauvegarder</button>
        </div>
        {(mem.produits||[]).length>0&&<div style={{background:C.surface2,borderRadius:12,padding:14,marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:C.accent2,marginBottom:10}}>📦 Produits ({mem.produits.length})</div>{mem.produits.map(function(p,i){return <div key={i} style={{padding:"6px 0",borderBottom:"1px solid "+C.border,fontSize:12}}><strong>{p.titre}</strong> <span style={{color:C.muted}}>— {p.type}</span></div>;})}</div>}
        {(mem.historique||[]).length>0&&<div style={{background:C.surface2,borderRadius:12,padding:14,marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:C.accent2,marginBottom:10}}>📂 Historique ({mem.historique.length} générations)</div><div style={{fontSize:12,color:C.muted}}>Consultable depuis l'outil "Historique".</div></div>}
        <button onClick={clearAll} style={Object.assign({},ghost,{width:"100%",color:C.accent3,borderColor:C.accent3,marginTop:4})}>🗑️ Effacer toute la mémoire</button>
      </div>
    </div>
  );
}

// ── DASHBOARD ──
function Dashboard(props) {
  var mem = props.memory; var setPanel = props.setPanel;
  var total = (mem.produits||[]).length+(mem.analyses||[]).length+(mem.posts||[]).length;
  var tools = [
    {id:"chat",e:"💬",n:"Chat IA",c:"#6c63ff"},
    {id:"product",e:"📦",n:"Fabricant de produits",c:"#ff6b6b"},
    {id:"prompts",e:"✨",n:"Créateur d'invites",c:"#00d4aa"},
    {id:"research",e:"🔍",n:"Recherche produits",c:"#a78bfa"},
    {id:"competitor",e:"📊",n:"Analyseur concurrence",c:"#f59e0b"},
    {id:"images",e:"🎨",n:"Créateur d'images",c:"#10b981"},
    {id:"social",e:"📱",n:"Posts réseaux sociaux",c:"#ec4899"},
    {id:"email",e:"📧",n:"Générateur d'emails",c:"#f59e0b"},
    {id:"videos",e:"🎬",n:"Créateur de vidéos",c:"#3b82f6"},
    {id:"pricing",e:"💰",n:"Stratégie de prix",c:"#10b981"},
    {id:"calendar",e:"🗓️",n:"Planificateur contenu",c:"#6c63ff"},
    {id:"revenue",e:"📊",n:"Tableau revenus",c:"#a78bfa"},
    {id:"adlib",e:"📢",n:"Bibliothèque pub.",c:"#ec4899"},
    {id:"history",e:"📂",n:"Historique",c:"#00d4aa"},
    {id:"website",e:"🌐",n:"Créateur de sites web",c:"#3b82f6"},
  ];
  return (
    <div style={wrap}>
      <div style={{background:"linear-gradient(135deg,rgba(108,99,255,.15),rgba(0,212,170,.08))",border:"1px solid rgba(108,99,255,.25)",borderRadius:12,padding:"16px 18px",marginBottom:18}}>
        <h2 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Bonjour {(mem.user.name||"Henri").split(" ")[0]} 👋</h2>
        <p style={{fontSize:12,color:C.muted}}>{total>0?"🧠 L'IA se souvient de "+total+" action(s).":"Commencez à utiliser les outils ci-dessous !"}</p>
        {mem.user.niche&&<div style={{marginTop:6,fontSize:11,color:C.accent2,fontWeight:600}}>🎯 Niche: {mem.user.niche}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {tools.map(function(t){
          return (
            <div key={t.id} onClick={function(){setPanel(t.id);}} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:11,padding:14,cursor:"pointer",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:t.c,borderRadius:"11px 11px 0 0"}}/>
              <div style={{fontSize:22,marginBottom:8}}>{t.e}</div>
              <div style={{fontWeight:600,fontSize:11,lineHeight:1.3,color:C.text}}>{t.n}</div>
              <div style={{fontSize:10,color:C.accent,marginTop:6}}>Ouvrir →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TOOL CONFIGS ──
function makeConfigs(mem, upd) {
  function sh(prev,outil,apercu,r){return Object.assign({},addHist(prev,outil,apercu,r));}
  return {
    product:{
      fields:[{key:"type",label:"Type",type:"select",options:["Ebook","Cours en ligne","Template","Checklist","Pack de ressources","Prompts IA"]},{key:"titre",label:"Titre",type:"text",ph:"Ex: Guide ultime du marketing digital"},{key:"niche",label:"Niche",type:"select",options:["Marketing digital","Finance personnelle","Développement personnel","E-commerce","Santé","Technologie & IA"]},{key:"cible",label:"Public cible",type:"text",ph:"Ex: Entrepreneurs débutants"},{key:"desc",label:"Idée principale",type:"textarea",ph:"Décrivez votre idée...",full:true}],
      btnLabel:"🚀 Générer mon produit",
      system:"Tu es un expert en création de produits numériques pour entrepreneurs africains. Réponds en français. Sois concret.",
      prompt:function(v){return "Crée le plan complet d'un "+(v.type||"Ebook")+" intitulé \""+(v.titre||"Produit")+"\" dans la niche \""+(v.niche||"Marketing")+"\" pour: "+(v.cible||"entrepreneurs")+". Description: "+(v.desc||"")+". Inclus: structure détaillée, prix en XAF, points de vente, 3 titres alternatifs.";},
      memoBanner:function(m){return (m.produits||[]).length;},
      onSave:function(prev,v,r){return Object.assign({},sh(prev,"📦 Produit",v.titre||"Produit",r),{produits:[...(prev.produits||[]),{titre:v.titre||"Produit",type:v.type||"Ebook",niche:v.niche||"",date:new Date().toISOString()}]});}
    },
    prompts:{
      fields:[{key:"pl",label:"Plateforme",type:"select",options:["ChatGPT","Claude","Gemini","Mistral"]},{key:"usage",label:"Utilisation",type:"select",options:["Rédaction de contenu","Marketing & Ventes","Analyse de données","Business & Stratégie","Code"]},{key:"ton",label:"Ton",type:"select",options:["Professionnel","Décontracté","Persuasif","Éducatif","Créatif"]},{key:"long",label:"Longueur",type:"select",options:["Court (< 200 mots)","Moyen (200-500 mots)","Long (500+ mots)","Liste à puces"]},{key:"desc",label:"Ce que tu veux obtenir",type:"textarea",ph:"Ex: Un email de vente pour mon ebook...",full:true}],
      btnLabel:"✨ Générer mon invite",
      system:"Tu es un expert en prompt engineering. Génère des prompts ultra-efficaces. Réponds en français.",
      prompt:function(v){return "Génère un prompt parfait pour "+(v.pl||"ChatGPT")+" : usage="+(v.usage||"contenu")+", ton="+(v.ton||"professionnel")+", longueur="+(v.long||"moyen")+". Objectif: "+(v.desc||"")+". Inclus rôle, contexte, contraintes et format attendu.";},
      memoBanner:function(m){return (m.prompts||[]).length;},
      onSave:function(prev,v,r){return Object.assign({},sh(prev,"✨ Prompt",v.usage||"Contenu",r),{prompts:[...(prev.prompts||[]),{usage:v.usage||"Contenu",plateforme:v.pl||"ChatGPT",date:new Date().toISOString()}]});}
    },
    research:{
      fields:[{key:"mot",label:"Idée de produit",type:"text",ph:"Ex: ebook finances personnelles",full:true},{key:"marche",label:"Marché cible",type:"select",options:["Afrique francophone","France","International"]},{key:"budget",label:"Budget de départ",type:"select",options:["0 XAF (gratuit)","5 000-20 000 XAF","20 000-100 000 XAF"]}],
      btnLabel:"🔍 Analyser le marché",
      system:"Tu es un analyste de marché spécialisé en produits numériques en Afrique francophone. Réponds en français.",
      prompt:function(v){return "Analyse le marché pour: \""+(v.mot||"produit")+"\" sur \""+(v.marche||"Afrique francophone")+"\" avec budget "+(v.budget||"0 XAF")+". Donne: score /10, demande estimée, prix en XAF, concurrence, profil acheteur, meilleures plateformes, canal recommandé, 3 idées dérivées.";}
    },
    competitor:{
      fields:[{key:"url",label:"URL du site concurrent",type:"text",ph:"Ex: digitalmaker.ai",full:true},{key:"type",label:"Type d'analyse",type:"select",options:["Analyse complète","Trafic & SEO","Revenus & Business","Contenu & Stratégie"]}],
      btnLabel:"🔎 Lancer l'analyse",
      system:"Tu es un analyste SEO et business intelligence. Réponds en français avec des estimations réalistes.",
      prompt:function(v){return "Analyse concurrentielle de \""+(v.url||"")+"\". Fournis: trafic mensuel, revenus USD/mois, autorité domaine, backlinks, taux rebond, top 5 mots-clés, stratégie contenu, forces/faiblesses, 3 opportunités. Précise que c'est une estimation.";},
      onSave:function(prev,v,r){return Object.assign({},sh(prev,"📊 Analyse",v.url||"",r),{analyses:[...(prev.analyses||[]),{url:v.url||"",date:new Date().toISOString()}]});}
    },
    social:{
      fields:[{key:"reseau",label:"Réseau social",type:"select",options:["Instagram","Facebook","LinkedIn","TikTok","Twitter/X","WhatsApp Status"]},{key:"type",label:"Type de post",type:"select",options:["Post de vente","Témoignage","Conseil / Astuce","Storytelling","Carrousel 5 slides","Lancement"]},{key:"ton",label:"Ton",type:"select",options:["Motivant","Professionnel","Décontracté","Humour","Urgent","Inspirant"]},{key:"sujet",label:"Sujet / Produit",type:"textarea",ph:"Ex: Mon ebook sur les finances à 9 900 XAF...",full:true}],
      btnLabel:"📱 Générer mon post",
      system:"Tu es un expert en copywriting pour réseaux sociaux en Afrique francophone. Génère des posts qui engagent et convertissent. Réponds en français.",
      prompt:function(v){return "Génère un post "+(v.type||"de vente")+" pour "+(v.reseau||"Instagram")+" avec ton \""+(v.ton||"Motivant")+"\" sur: \""+(v.sujet||"produit numérique")+"\". Inclus: accroche percutante, corps du texte, CTA clair, emojis pertinents, hashtags optimisés.";},
      memoBanner:function(m){return (m.posts||[]).length;},
      onSave:function(prev,v,r){return Object.assign({},sh(prev,"📱 Post "+(v.reseau||""),v.sujet||"",r),{posts:[...(prev.posts||[]),{reseau:v.reseau||"",type:v.type||"",date:new Date().toISOString()}]});}
    },
    email:{
      fields:[{key:"type",label:"Type d'email",type:"select",options:["Email de vente","Email de bienvenue","Séquence 5 emails","Email de relance","Newsletter","Email de lancement"]},{key:"ton",label:"Ton",type:"select",options:["Persuasif","Professionnel","Amical","Urgent","Storytelling","Éducatif"]},{key:"produit",label:"Produit / Offre",type:"text",ph:"Ex: Ebook marketing digital à 12 000 XAF...",full:true},{key:"prix",label:"Prix",type:"text",ph:"Ex: 12 000 XAF"},{key:"cible",label:"Public cible",type:"text",ph:"Ex: Entrepreneurs débutants"}],
      btnLabel:"📧 Générer mon email",
      system:"Tu es un expert en email marketing et copywriting pour entrepreneurs africains francophones. Réponds en français.",
      prompt:function(v){return "Génère un \""+(v.type||"Email de vente")+"\" avec ton \""+(v.ton||"Persuasif")+"\" pour: \""+(v.produit||"")+"\". Prix: "+(v.prix||"non précisé")+". Cible: "+(v.cible||"entrepreneurs")+". Inclus objet accrocheur, corps structuré accroche/problème/solution/CTA. Max 400 mots.";},
      onSave:function(prev,v,r){return sh(prev,"📧 Email",v.produit||"",r);}
    },
    videos:{
      fields:[{key:"type",label:"Type de vidéo",type:"select",options:["Publicité produit (15-30s)","Tutoriel / Formation","Vidéo de vente (VSL)","Short TikTok"]},{key:"duree",label:"Durée",type:"select",options:["15 secondes","30 secondes","1 minute","3 minutes"]},{key:"desc",label:"Décrivez votre vidéo",type:"textarea",ph:"Ex: Présentation de mon ebook sur les finances...",full:true}],
      btnLabel:"🎬 Générer le script",
      system:"Tu es un expert en production vidéo et copywriting. Réponds en français.",
      prompt:function(v){return "Script vidéo \""+(v.type||"publicité")+"\" de "+(v.duree||"30 secondes")+" pour: "+(v.desc||"produit numérique")+". Structure avec timecodes, type de plan, didascalies visuelles, texte dit. Ajoute hashtags recommandés.";},
      onSave:function(prev,v,r){return sh(prev,"🎬 Script vidéo",v.desc||"",r);}
    },
    website:{
      fields:[{key:"desc",label:"Décrivez votre site",type:"text",ph:"Ex: Site de vente d'ebooks sur le marketing",full:true},{key:"style",label:"Style",type:"select",options:["Moderne & Épuré","Dynamique & Coloré","Professionnel & Sobre","Créatif & Original"]}],
      btnLabel:"🌐 Générer le contenu du site",
      system:"Tu es un expert en création de sites web et copywriting. Réponds en français.",
      prompt:function(v){return "Contenu complet site web style \""+(v.style||"moderne")+"\" pour: \""+(v.desc||"")+"\". Inclus: headline héro, sous-titre, CTA, 3 fonctionnalités (titre+description+emoji), témoignage fictif, footer slogan.";},
      onSave:function(prev,v,r){return sh(prev,"🌐 Site web",v.desc||"",r);}
    },
  };
}

// ── MAIN APP ──
export default function App() {
  var [panel,setPanel] = useState("dashboard");
  var [menuOpen,setMenuOpen] = useState(false);
  var [memOpen,setMemOpen] = useState(false);
  var [memory,setMemory] = useState(function(){return loadMem()||Object.assign({},DEF);});

  var updMem = useCallback(function(updater){
    setMemory(function(prev){
      var next = typeof updater==="function" ? updater(prev) : updater;
      saveMem(next);
      return next;
    });
  },[]);

  var titles = {dashboard:"🏠 Accueil",chat:"💬 Chat IA",product:"📦 Fabricant de produits",prompts:"✨ Créateur d'invites",research:"🔍 Recherche produits",competitor:"📊 Analyseur concurrence",images:"🎨 Créateur d'images",social:"📱 Posts réseaux sociaux",email:"📧 Générateur d'emails",videos:"🎬 Créateur de vidéos",pricing:"💰 Stratégie de prix",calendar:"🗓️ Planificateur",revenue:"📊 Tableau revenus",adlib:"📢 Bibliothèque pub.",history:"📂 Historique",website:"🌐 Créateur de sites"};

  var navItems = [
    {id:"dashboard",icon:"🏠",label:"Accueil"},{id:"chat",icon:"💬",label:"Chat IA"},
    {id:"product",icon:"📦",label:"Fabricant de produits"},{id:"prompts",icon:"✨",label:"Créateur d'invites"},
    {id:"research",icon:"🔍",label:"Recherche produits"},{id:"competitor",icon:"📊",label:"Analyseur concurrence"},
    {id:"images",icon:"🎨",label:"Créateur d'images"},{id:"social",icon:"📱",label:"Posts réseaux sociaux"},
    {id:"email",icon:"📧",label:"Générateur d'emails"},{id:"videos",icon:"🎬",label:"Créateur de vidéos"},
    {id:"pricing",icon:"💰",label:"Stratégie de prix"},{id:"calendar",icon:"🗓️",label:"Planificateur contenu"},
    {id:"revenue",icon:"📊",label:"Tableau revenus"},{id:"adlib",icon:"📢",label:"Bibliothèque pub."},
    {id:"history",icon:"📂",label:"Historique"},{id:"website",icon:"🌐",label:"Créateur de sites"},
  ];

  var bottomNav = [{id:"dashboard",icon:"🏠",label:"Accueil"},{id:"chat",icon:"💬",label:"Chat"},{id:"product",icon:"📦",label:"Produits"},{id:"social",icon:"📱",label:"Posts"},{id:"revenue",icon:"📊",label:"Revenus"}];

  var configs = makeConfigs(memory, updMem);

  function renderPanel(){
    var p = {memory:memory,onMemoryUpdate:updMem};
    if (panel==="dashboard") return <Dashboard memory={memory} setPanel={setPanel}/>;
    if (panel==="chat") return <ChatPanel {...p}/>;
    if (panel==="images") return <ImagePanel memory={memory}/>;
    if (panel==="pricing") return <PricingPanel memory={memory}/>;
    if (panel==="calendar") return <CalendarPanel {...p}/>;
    if (panel==="revenue") return <RevenuePanel {...p}/>;
    if (panel==="adlib") return <AdPanel/>;
    if (panel==="history") return <HistoryPanel {...p}/>;
    if (configs[panel]) return <ToolPanel config={configs[panel]} memory={memory} onMemoryUpdate={updMem}/>;
    return <div style={wrap}>Bientôt disponible.</div>;
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.text,fontFamily:"Inter,sans-serif"}}>
      <style>{"*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#252b45;border-radius:10px}@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}"}</style>

      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,padding:"9px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#6c63ff,#00d4aa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🤖</div>
        <span style={{fontSize:14,fontWeight:700}}>Creator<span style={{color:C.accent2}}>AI</span></span>
        <span style={{fontSize:11,color:C.muted,flex:1}}>· {titles[panel]}</span>
        <MemBadge memory={memory} onView={function(){setMemOpen(true);}}/>
        <button onClick={function(){setMenuOpen(true);}} style={{background:C.surface2,border:"1px solid "+C.border,borderRadius:7,width:32,height:32,cursor:"pointer",fontSize:15,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>☰</button>
      </div>

      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {renderPanel()}
      </div>

      <div style={{background:C.surface,borderTop:"1px solid "+C.border,display:"flex",flexShrink:0}}>
        {bottomNav.map(function(n){
          return <div key={n.id} onClick={function(){setPanel(n.id);}} style={{flex:1,padding:"8px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",borderTop:panel===n.id?"2px solid "+C.accent:"2px solid transparent"}}><span style={{fontSize:17}}>{n.icon}</span><span style={{fontSize:9,fontWeight:600,color:panel===n.id?C.accent:C.muted}}>{n.label}</span></div>;
        })}
        <div onClick={function(){setMenuOpen(true);}} style={{flex:1,padding:"8px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",borderTop:"2px solid transparent"}}><span style={{fontSize:17}}>⋯</span><span style={{fontSize:9,fontWeight:600,color:C.muted}}>Plus</span></div>
      </div>

      {menuOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={function(){setMenuOpen(false);}} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)"}}/>
          <div style={{position:"relative",background:C.surface,borderRadius:"18px 18px 0 0",padding:"14px 14px 28px",animation:"slideUp .25s ease",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{width:34,height:4,background:C.border,borderRadius:4,margin:"0 auto 14px"}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {navItems.map(function(n){
                return <div key={n.id} onClick={function(){setPanel(n.id);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:9,padding:"11px 12px",borderRadius:10,background:panel===n.id?"rgba(108,99,255,.15)":C.surface2,border:"1px solid "+(panel===n.id?"rgba(108,99,255,.4)":C.border),cursor:"pointer"}}><span style={{fontSize:18}}>{n.icon}</span><span style={{fontSize:12,fontWeight:500,color:panel===n.id?C.text:C.muted}}>{n.label}</span></div>;
              })}
            </div>
          </div>
        </div>
      )}

      {memOpen&&<MemModal memory={memory} onUpdate={updMem} onClose={function(){setMemOpen(false);}}/>}
    </div>
  );
}
