const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"POST,OPTIONS"}});

const providers={
  "OpenRouter":{env:"OPENROUTER_API_KEY",url:"https://openrouter.ai/api/v1/chat/completions",kind:"openai-compatible"},
  "OpenAI":{env:"OPENAI_API_KEY",url:"https://api.openai.com/v1/chat/completions",kind:"openai-compatible"},
  "xAI Grok":{env:"XAI_API_KEY",url:"https://api.x.ai/v1/chat/completions",kind:"openai-compatible"},
  "Mistral":{env:"MISTRAL_API_KEY",url:"https://api.mistral.ai/v1/chat/completions",kind:"openai-compatible"},
  "Groq":{env:"GROQ_API_KEY",url:"https://api.groq.com/openai/v1/chat/completions",kind:"openai-compatible"},
  "Anthropic":{env:"ANTHROPIC_API_KEY",url:"https://api.anthropic.com/v1/messages",kind:"anthropic"},
  "Google Gemini":{env:"GEMINI_API_KEY",url:"https://generativelanguage.googleapis.com/v1beta",kind:"gemini"},
  "Local Ollama":{env:"OLLAMA_BASE_URL",url:"http://127.0.0.1:11434",kind:"ollama"}
};

function getProvider(name){return providers[name]||providers.OpenRouter}

async function openaiCompatible(p,apiKey,model,messages){
  const r=await fetch(p.url,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${apiKey}`,"x-openrouter-title":"ShiftX Agent"},body:JSON.stringify({model,messages,temperature:0.7})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return json({error:data?.error?.message||data?.message||`Provider error (${r.status})`},r.status);
  return json({ok:true,text:data?.choices?.[0]?.message?.content||"",provider:p.name||"provider",model:data?.model||model,raw_usage:data?.usage||null});
}

async function anthropic(apiKey,model,messages){
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const turns=messages.filter(m=>m.role!=="system");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model,max_tokens:1200,system,messages:turns.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return json({error:data?.error?.message||`Anthropic error (${r.status})`},r.status);
  const text=(data?.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n");
  return json({ok:true,text,provider:"Anthropic",model:data?.model||model,raw_usage:data?.usage||null});
}

async function gemini(apiKey,model,messages){
  const contents=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({systemInstruction:system?{parts:[{text:system}]}:undefined,contents})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return json({error:data?.error?.message||`Gemini error (${r.status})`},r.status);
  const text=(data?.candidates?.[0]?.content?.parts||[]).filter(x=>x.text).map(x=>x.text).join("\n");
  return json({ok:true,text,provider:"Google Gemini",model,raw_usage:data?.usageMetadata||null});
}

async function ollama(base,model,messages){
  const url=(base||"http://127.0.0.1:11434").replace(/\/$/,"")+"/api/chat";
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({model,messages,stream:false})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return json({error:data?.error||`Ollama error (${r.status})`},r.status);
  return json({ok:true,text:data?.message?.content||"",provider:"Local Ollama",model:data?.model||model,raw_usage:{prompt_eval_count:data?.prompt_eval_count||0,eval_count:data?.eval_count||0}});
}

export async function onRequest(context){
  if(context.request.method==="OPTIONS")return json({},204);
  if(context.request.method!=="POST")return json({error:"POST only"},405);
  try{
    const body=await context.request.json();
    const providerName=body?.provider||"OpenRouter";
    const p=getProvider(providerName);
    const messages=Array.isArray(body?.messages)?body.messages:[];
    if(!messages.length)return json({error:"messages is required"},400);
    let model=body?.model;
    if(!model){
      model=providerName==="OpenRouter"?"openrouter/free":
            providerName==="OpenAI"?"gpt-5":
            providerName==="Anthropic"?"claude-sonnet-4-6":
            providerName==="Google Gemini"?"gemini-3.1-flash-lite":
            providerName==="xAI Grok"?"grok-4-1-fast-reasoning":
            providerName==="Mistral"?"mistral-large-latest":
            providerName==="Groq"?"openai/gpt-oss-120b":
            "llama3.2";
    }
    if(p.kind==="ollama")return ollama(context.env.OLLAMA_BASE_URL,model,messages);
    const key=context.env[p.env];
    if(!key)return json({error:`${providerName} is not connected yet. Set server secret ${p.env} in your hosting environment.`},503);
    if(p.kind==="anthropic")return anthropic(key,model,messages);
    if(p.kind==="gemini")return gemini(key,model,messages);
    return openaiCompatible(p,key,model,messages);
  }catch(err){
    return json({error:"ShiftX backend error",detail:err?.message||String(err)},500);
  }
}