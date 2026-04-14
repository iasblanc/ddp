// @ts-nocheck
"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";

const T = {
  bg:"#0D0D14", card:"#1A1A2E", light:"#E8E4DC",
  silver:"#6B6B80", blue:"#4A6FA5", green:"#2D6A4F",
  amber:"#C9853A", border:"#252538", surface:"#141420", mauve:"#7B5EA7",
};
const SESSION_COLOR: Record<string,string> = { learn:T.blue, practice:T.amber, review:T.mauve, test:T.green };
const SESSION_LABEL: Record<string,string> = { learn:"Aprender", practice:"Praticar", review:"Rever", test:"Testar" };
const DIFF_COLOR: Record<string,string>   = { easy:T.green, medium:T.amber, hard:"#E05252" };
const DIFF_LABEL: Record<string,string>   = { easy:"Fácil", medium:"Médio", hard:"Desafiador" };

function BlockContent() {
  const router  = useRouter();
  const { id: blockId } = useParams() as { id: string };
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<any>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Dados
  const [block,     setBlock]     = useState<any>(null);
  const [brief,     setBrief]     = useState<any>(null);
  const [objective, setObjective] = useState<any>(null);
  const [dream,     setDream]     = useState<any>(null);
  const [dreamId,   setDreamId]   = useState<string|null>(null);
  const [loading,   setLoading]   = useState(true);

  // Timer — integrado no mesmo painel, não substitui a tela
  const [timerState,  setTimerState]  = useState<"idle"|"running"|"done">("idle");
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [totalTime,   setTotalTime]   = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>([]);

  // Chat
  const [messages,   setMessages]   = useState<any[]>([]);
  const [chatInput,  setChatInput]  = useState("");
  const [streaming,  setStreaming]  = useState(false);
  const [streamText, setStreamText] = useState("");

  // Pós-bloco (inline no painel direito)
  const [postStep,  setPostStep]  = useState(0);  // 0 = oculto, 1 = o que concluiu, 2 = obstáculo
  const [postAns,   setPostAns]   = useState("");
  const [postObs,   setPostObs]   = useState("");
  const [postDone,  setPostDone]  = useState(false);

  const scrollChat = () => setTimeout(()=>chatEndRef.current?.scrollIntoView({behavior:"smooth"}),60);

  useEffect(()=>{ loadBrief(); return ()=>{ if(timerRef.current) clearInterval(timerRef.current); }; },[]);

  async function loadBrief() {
    const res = await fetch("/api/north/task-brief",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({blockId})});
    if (res.ok) {
      const data = await res.json();
      setBlock(data.block);
      setBrief(data.brief);
      setObjective(data.objective);
      setDream(data.dream);
      setDreamId(data.block?.dream_id||null);
      const dur = (data.block?.duration_minutes||30)*60;
      setTimeLeft(dur); setTotalTime(dur);
      setCheckedSteps(new Array(data.brief?.steps?.length||0).fill(false));
      if (data.brief?.mission) {
        setMessages([{role:"assistant",content:`${data.brief.mission}\n\nTem alguma dúvida antes de começar?`}]);
      }
    }
    setLoading(false);
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  function startTimer() {
    if (timerState!=="idle") return;
    setTimerState("running");
    fetch(`/api/blocks/${blockId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"active"})});
    timerRef.current = setInterval(()=>{
      setTimeLeft(prev=>{
        if (prev<=1) {
          clearInterval(timerRef.current);
          setTimerState("done");
          setPostStep(1);
          return 0;
        }
        return prev-1;
      });
    },1000);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
    setTimerState("done");
    setPostStep(1);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function sendChat() {
    if (!chatInput.trim()||streaming) return;
    const msg = {role:"user",content:chatInput.trim()};
    const newMessages = [...messages,msg];
    setMessages(newMessages); setChatInput(""); setStreaming(true); setStreamText(""); scrollChat();
    const res = await fetch("/api/north/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:newMessages,conversationType:"pre_block",dreamId,blockId})});
    const reader=res.body!.getReader(); const dec=new TextDecoder(); let full="";
    while(true){
      const{done,value}=await reader.read(); if(done)break;
      for(const line of dec.decode(value).split("\n")){
        if(line.startsWith("data: ")){try{const d=JSON.parse(line.slice(6));if(d.text){full+=d.text;setStreamText(full);scrollChat();}if(d.done){setMessages(p=>[...p,{role:"assistant",content:full}]);setStreamText("");scrollChat();}}catch{}}
      }
    }
    setStreaming(false);
  }

  // ── Pós-bloco ─────────────────────────────────────────────────────────────
  async function submitPost() {
    if (postStep===1) { if(!postAns.trim()) return; setPostStep(2); return; }
    await fetch(`/api/blocks/${blockId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"completed",notes:`${postAns}|${postObs}`})});
    await fetch("/api/north/post-block",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({blockId,dreamId,completed:postAns,obstacle:postObs})});
    setPostDone(true); setPostStep(0);
    setMessages(p=>[...p,{role:"assistant",content:`Bloco concluído.\n\n${postAns?`Você concluiu: ${postAns.slice(0,80)}...`:""}\n\nO que precisa de mim agora?`}]);
    scrollChat();
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const fmtTime = (s:number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const progress = totalTime>0 ? ((totalTime-timeLeft)/totalTime)*100 : 0;
  const sessColor = SESSION_COLOR[block?.session_type]||T.blue;
  const backUrl   = dreamId ? `/schedule?dreamId=${dreamId}` : "/dashboard";

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:"20px",color:T.silver,marginBottom:"8px"}}>North está preparando o seu briefing...</p>
        <p style={{fontSize:"13px",color:T.silver,fontFamily:"Inter,sans-serif"}}>Isso leva alguns segundos.</p>
      </div>
    </div>
  );

  // ── MAIN PAGE (briefing + timer integrado) ────────────────────────────────
  return (
    <div style={{minHeight:"100vh",height:"100vh",background:T.bg,color:T.light,fontFamily:"Inter,sans-serif",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Header */}
      <header style={{borderBottom:`1px solid ${T.border}`,padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:`${T.bg}F8`,backdropFilter:"blur(12px)",zIndex:50}}>
        <button onClick={()=>router.push(backUrl)} style={{background:"none",border:"none",color:T.silver,cursor:"pointer",fontSize:"13px",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:"6px"}}>
          ← Agenda
        </button>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          {block?.session_type&&<span style={{fontSize:"10px",color:sessColor,background:`${sessColor}18`,padding:"3px 9px",borderRadius:"999px",border:`1px solid ${sessColor}33`}}>{SESSION_LABEL[block.session_type]}</span>}
          {brief?.difficulty&&<span style={{fontSize:"10px",color:DIFF_COLOR[brief.difficulty]||T.silver}}>{DIFF_LABEL[brief.difficulty]||""}</span>}
          {block?.is_critical&&<span style={{fontSize:"10px",color:T.amber}}>★ Crítica</span>}
          {postDone&&<span style={{fontSize:"10px",color:T.green,background:`${T.green}18`,padding:"3px 9px",borderRadius:"999px",border:`1px solid ${T.green}33`}}>✓ Concluído</span>}
        </div>
      </header>

      {/* Two-panel layout — sempre visível */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* ── PAINEL ESQUERDO — Info da tarefa (sempre visível) ─────────────── */}
        <div style={{width:"52%",borderRight:`1px solid ${T.border}`,overflowY:"auto",padding:"24px 28px",display:"flex",flexDirection:"column",gap:"18px"}}>

          {/* Contexto: sonho + objectivo */}
          {(dream||objective)&&(
            <div style={{padding:"10px 14px",background:`${T.blue}0A`,border:`1px solid ${T.blue}22`,borderRadius:"8px"}}>
              {dream&&<p style={{margin:"0 0 2px",fontSize:"10px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.08em"}}>Sonho</p>}
              {dream&&<p style={{margin:"0 0 8px",fontSize:"13px",fontFamily:"'Playfair Display',serif"}}>{dream.title}</p>}
              {objective&&<p style={{margin:"0 0 2px",fontSize:"10px",color:T.blue,textTransform:"uppercase",letterSpacing:"0.08em"}}>Objetivo</p>}
              {objective&&<p style={{margin:0,fontSize:"12px",fontWeight:500}}>{objective.title}</p>}
              {objective?.why&&<p style={{margin:"3px 0 0",fontSize:"11px",color:T.silver,fontStyle:"italic"}}>→ {objective.why}</p>}
            </div>
          )}

          {/* Título */}
          <div>
            {brief?.focus_word&&<p style={{margin:"0 0 6px",fontSize:"10px",color:sessColor,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:600}}>{brief.focus_word}</p>}
            <h1 style={{margin:"0 0 6px",fontSize:"20px",fontFamily:"'Playfair Display',serif",lineHeight:1.3}}>{block?.title}</h1>
            {block?.description&&<p style={{margin:0,fontSize:"13px",color:T.silver,lineHeight:1.6}}>{block.description}</p>}
          </div>

          {/* Missão de North */}
          {brief?.mission&&(
            <div style={{padding:"14px 18px",background:T.card,borderLeft:`3px solid ${T.silver}44`,borderRadius:"0 8px 8px 0"}}>
              <p style={{margin:"0 0 4px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.08em"}}>North</p>
              <p style={{margin:0,fontSize:"13px",fontWeight:300,fontStyle:"italic",lineHeight:1.8}}>{brief.mission}</p>
            </div>
          )}

          {/* Recurso */}
          {block?.resource_url&&(
            <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",background:T.surface,border:`1px solid ${T.blue}33`,borderRadius:"10px",textDecoration:"none"}}>
              <div style={{width:"32px",height:"32px",background:`${T.blue}22`,borderRadius:"7px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:"16px"}}>🔗</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:"0 0 1px",fontSize:"12px",fontWeight:500,color:T.light}}>{block.resource_name||"Abrir recurso"}</p>
                <p style={{margin:0,fontSize:"10px",color:T.blue,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{block.resource_url}</p>
              </div>
              <span style={{fontSize:"11px",color:T.blue,flexShrink:0}}>Abrir →</span>
            </a>
          )}

          {/* Passos — com checkboxes durante execução */}
          {brief?.steps?.length>0&&(
            <div>
              <p style={{margin:"0 0 10px",fontSize:"10px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.08em"}}>Como fazer estes 30 minutos</p>
              {brief.steps.map((step:string,i:number)=>(
                <div key={i}
                  onClick={()=>{
                    if (timerState!=="idle") {
                      const newChecked=[...checkedSteps]; newChecked[i]=!newChecked[i]; setCheckedSteps(newChecked);
                    }
                  }}
                  style={{display:"flex",gap:"10px",marginBottom:"8px",cursor:timerState!=="idle"?"pointer":"default",alignItems:"flex-start",opacity:checkedSteps[i]?0.45:1,transition:"opacity 200ms ease"}}>
                  <div style={{width:"22px",height:"22px",borderRadius:"50%",background:checkedSteps[i]?`${T.green}44`:`${sessColor}22`,border:`1px solid ${checkedSteps[i]?T.green:sessColor}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px",transition:"all 200ms ease"}}>
                    {checkedSteps[i]
                      ? <span style={{fontSize:"10px",color:T.green}}>✓</span>
                      : <span style={{fontSize:"10px",fontWeight:700,color:sessColor}}>{i+1}</span>
                    }
                  </div>
                  <p style={{margin:0,fontSize:"12px",lineHeight:1.6,color:T.light,textDecoration:checkedSteps[i]?"line-through":"none"}}>{step}</p>
                </div>
              ))}
            </div>
          )}

          {/* Grid: Antes de começar + Resultado */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            {brief?.prepare?.length>0&&(
              <div style={{padding:"12px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"10px"}}>
                <p style={{margin:"0 0 8px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.08em"}}>Antes de começar</p>
                {brief.prepare.map((item:string,i:number)=>(
                  <div key={i} style={{display:"flex",gap:"6px",marginBottom:"4px",alignItems:"flex-start"}}>
                    <span style={{color:T.amber,fontSize:"11px",marginTop:"2px"}}>◦</span>
                    <p style={{margin:0,fontSize:"11px",lineHeight:1.4}}>{item}</p>
                  </div>
                ))}
              </div>
            )}
            {brief?.expected_outcome&&(
              <div style={{padding:"12px 14px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"10px"}}>
                <p style={{margin:"0 0 6px",fontSize:"9px",color:T.silver,textTransform:"uppercase",letterSpacing:"0.08em"}}>Ao final dos 30min</p>
                <p style={{margin:0,fontSize:"11px",lineHeight:1.5}}>{brief.expected_outcome}</p>
              </div>
            )}
          </div>

          {/* Dica */}
          {brief?.north_tip&&(
            <div style={{padding:"10px 14px",background:`${T.amber}0A`,border:`1px solid ${T.amber}22`,borderRadius:"8px"}}>
              <p style={{margin:"0 0 3px",fontSize:"9px",color:T.amber,textTransform:"uppercase",letterSpacing:"0.08em"}}>💡 Dica</p>
              <p style={{margin:0,fontSize:"12px",fontStyle:"italic",lineHeight:1.6}}>{brief.north_tip}</p>
            </div>
          )}
        </div>

        {/* ── PAINEL DIREITO — Timer integrado + Chat ───────────────────────── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Timer — aparece em cima quando activo, senão mostra só o botão */}
          {timerState==="idle" ? (
            // Estado idle: botão de início proeminente
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,background:T.surface,display:"flex",alignItems:"center",gap:"12px"}}>
              <button onClick={startTimer}
                style={{flex:1,padding:"12px",background:T.blue,border:"none",borderRadius:"10px",color:T.light,fontSize:"14px",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:"0.02em",transition:"background 150ms ease"}}>
                ▶ Iniciar bloco — {block?.duration_minutes||30} min
              </button>
            </div>
          ) : timerState==="running" ? (
            // Timer activo — compacto, sempre visível
            <div style={{padding:"12px 20px",borderBottom:`1px solid ${T.border}`,background:T.surface,flexShrink:0}}>
              {/* Countdown + barra */}
              <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"8px"}}>
                <p style={{fontFamily:"monospace",fontSize:"36px",fontWeight:300,margin:0,color:timeLeft<60?T.amber:T.light,letterSpacing:"0.04em",lineHeight:1}}>
                  {fmtTime(timeLeft)}
                </p>
                <div style={{flex:1}}>
                  <div style={{height:"4px",background:`${T.border}`,borderRadius:"999px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${progress}%`,background:sessColor,borderRadius:"999px",transition:"width 1s linear"}} />
                  </div>
                  <p style={{margin:"4px 0 0",fontSize:"10px",color:T.silver}}>{Math.round(progress)}% concluído</p>
                </div>
                <button onClick={stopTimer}
                  style={{padding:"6px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"7px",color:T.silver,fontSize:"11px",cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
                  Terminar
                </button>
              </div>
              {/* Passos restantes */}
              <p style={{margin:0,fontSize:"10px",color:T.silver}}>
                {checkedSteps.filter(Boolean).length}/{checkedSteps.length} passos marcados · clica nos passos à esquerda para marcá-los
              </p>
            </div>
          ) : (
            // Timer done — barra verde preenchida
            <div style={{padding:"12px 20px",borderBottom:`1px solid ${T.border}`,background:`${T.green}0A`,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{height:"4px",flex:1,background:T.green,borderRadius:"999px"}} />
                <span style={{fontSize:"12px",color:T.green,fontWeight:500,flexShrink:0}}>Bloco concluído ✓</span>
              </div>
            </div>
          )}

          {/* Pós-bloco inline — aparece acima do chat quando timer termina */}
          {postStep>0&&!postDone&&(
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,background:T.card,flexShrink:0}}>
              <p style={{margin:"0 0 8px",fontSize:"12px",fontStyle:"italic",fontWeight:300,lineHeight:1.6,color:T.light}}>
                {postStep===1 ? "O que você concluiu neste bloco?" : "Houve algum obstáculo? (opcional)"}
              </p>
              <div style={{display:"flex",gap:"8px"}}>
                <input
                  value={postStep===1?postAns:postObs}
                  onChange={e=>postStep===1?setPostAns(e.target.value):setPostObs(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&submitPost()}
                  placeholder={postStep===1?"O que fiz...":"Obstáculo ou não... (Enter para pular)"}
                  autoFocus
                  style={{flex:1,background:T.surface,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"9px 12px",color:T.light,fontSize:"12px",fontFamily:"Inter,sans-serif",outline:"none"}}
                />
                <button onClick={submitPost}
                  style={{padding:"9px 14px",background:T.green,border:"none",borderRadius:"8px",color:T.light,fontSize:"12px",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {postStep===1?"→":"Guardar"}
                </button>
                {postStep===2&&(
                  <button onClick={()=>{setPostObs("");submitPost();}}
                    style={{padding:"9px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"8px",color:T.silver,fontSize:"11px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    Pular
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Após concluir pós-bloco — navegação */}
          {postDone&&(
            <div style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`,background:`${T.green}08`,display:"flex",gap:"8px",flexShrink:0}}>
              <button onClick={()=>router.push(backUrl)}
                style={{flex:1,padding:"8px",background:T.blue,border:"none",borderRadius:"8px",color:T.light,fontSize:"12px",fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                ← Voltar à Agenda
              </button>
              <button onClick={()=>router.push(dreamId?`/objectives?dreamId=${dreamId}`:"/dashboard")}
                style={{padding:"8px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"8px",color:T.silver,fontSize:"11px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                Objetivos
              </button>
            </div>
          )}

          {/* Chat com North — ocupa o restante */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 20px",display:"flex",flexDirection:"column",gap:"10px"}}>
            {messages.map((m:any,i:number)=>(
              <div key={i} style={{maxWidth:m.role==="user"?"80%":"88%",alignSelf:m.role==="user"?"flex-end":"flex-start",padding:"10px 14px",borderRadius:m.role==="user"?"10px 10px 2px 10px":"10px 10px 10px 2px",background:m.role==="user"?T.surface:T.card,border:`1px solid ${T.border}`,borderLeft:m.role==="assistant"?`2px solid ${T.silver}44`:undefined}}>
                <p style={{margin:0,fontSize:"12px",lineHeight:1.7,fontWeight:m.role==="assistant"?300:400,fontStyle:m.role==="assistant"?"italic":"normal",whiteSpace:"pre-wrap"}}>{m.content}</p>
              </div>
            ))}
            {streaming&&streamText&&(
              <div style={{maxWidth:"88%",padding:"10px 14px",background:T.card,borderRadius:"10px 10px 10px 2px",border:`1px solid ${T.border}`,borderLeft:`2px solid ${T.silver}44`}}>
                <p style={{margin:0,fontSize:"12px",fontWeight:300,fontStyle:"italic",lineHeight:1.7}}>{streamText}<span style={{opacity:0.3}}>▊</span></p>
              </div>
            )}
            {streaming&&!streamText&&(
              <div style={{padding:"10px 14px",background:T.card,borderRadius:"10px 10px 10px 2px",border:`1px solid ${T.border}`,alignSelf:"flex-start"}}>
                <p style={{margin:0,fontSize:"11px",color:T.silver,fontStyle:"italic"}}>North está pensando...</p>
              </div>
            )}
            <div ref={chatEndRef} style={{height:"1px"}} />
          </div>

          {/* Input de chat — sempre visível */}
          <div style={{padding:"10px 16px 14px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",gap:"7px"}}>
              <input ref={inputRef} value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendChat()}
                placeholder={timerState==="running"?"Dúvida durante o bloco? Chama North...":"Pergunta algo a North antes de começar..."}
                disabled={streaming}
                style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",padding:"9px 13px",color:T.light,fontSize:"12px",fontFamily:"Inter,sans-serif",outline:"none",opacity:streaming?0.6:1}}
              />
              <button onClick={sendChat} disabled={!chatInput.trim()||streaming}
                style={{padding:"9px 13px",background:chatInput.trim()&&!streaming?T.blue:T.border,border:"none",borderRadius:"8px",color:T.light,cursor:"pointer",fontSize:"13px",transition:"background 150ms ease"}}>→</button>
            </div>
            {timerState==="running"&&(
              <p style={{margin:"6px 0 0",fontSize:"10px",color:T.silver,textAlign:"center"}}>
                Timer a correr · clica nos passos à esquerda para marcá-los
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlockPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#0D0D14"}} />}>
      <BlockContent />
    </Suspense>
  );
}
