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


async function consensusOpenAI(p,apiKey,model,messages){
  const r=await fetch(p.url,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${apiKey}`},body:JSON.stringify({model,messages,temperature:0.2})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) return {ok:false,provider:p.name,error:data?.error?.message||data?.message||`Provider error (${r.status})`};
  return {ok:true,provider:p.name,text:data?.choices?.[0]?.message?.content||"",model:data?.model||model};
}
async function consensusAnthropic(apiKey,model,messages){
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const turns=messages.filter(m=>m.role!=="system");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model,max_tokens:1400,system,messages:turns.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return {ok:false,provider:"Anthropic",error:data?.error?.message||`Anthropic error (${r.status})`};
  return {ok:true,provider:"Anthropic",text:(data?.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n"),model:data?.model||model};
}
async function consensusGemini(apiKey,model,messages){
  const contents=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({systemInstruction:system?{parts:[{text:system}]}:undefined,contents})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return {ok:false,provider:"Google Gemini",error:data?.error?.message||`Gemini error (${r.status})`};
  return {ok:true,provider:"Google Gemini",text:(data?.candidates?.[0]?.content?.parts||[]).filter(x=>x.text).map(x=>x.text).join("\n"),model};
}
async function runConsensus(context,body){
  const baseMessages=Array.isArray(body?.messages)?body.messages:[];
  if(!baseMessages.length)return {error:"messages is required"};
  const question=baseMessages.filter(m=>m.role==="user").slice(-1)[0]?.content||"";
  const consensusPrompt="Answer independently as an expert. Focus on factual correctness. State uncertainty when needed. Do not try to agree with other models because you have not seen them. The ShiftX Manager will compare your answer with other models.";
  const msgs=[{role:"system",content:consensusPrompt},...baseMessages.filter(m=>m.role!=="system")];
  const names=["OpenRouter","OpenAI","Anthropic","Google Gemini","xAI Grok","Mistral","Groq"];
  const results=await Promise.all(names.map(async name=>{
    const p=providers[name], key=p&&context.env[p.env];
    if(!p||!key)return {ok:false,provider:name,skipped:true};
    let model=(body.models&&body.models[name])||context.env[name==="OpenRouter"?"OPENROUTER_MODEL":name==="OpenAI"?"OPENAI_MODEL":name==="Anthropic"?"ANTHROPIC_MODEL":name==="Google Gemini"?"GEMINI_MODEL":name==="xAI Grok"?"XAI_MODEL":name==="Mistral"?"MISTRAL_MODEL":"GROQ_MODEL"];
    if(!model)return {ok:false,provider:name,skipped:true,error:"No model configured"};
    if(p.kind==="anthropic")return consensusAnthropic(key,model,msgs);
    if(p.kind==="gemini")return consensusGemini(key,model,msgs);
    return consensusOpenAI({...p,name},key,model,msgs);
  }));
  const answers=results.filter(x=>x.ok&&x.text);
  if(!answers.length)return {error:"No AI providers are connected for Consensus mode. Add server-side provider keys and model IDs first.",providers:results};
  const evidence=answers.map((a,i)=>`MODEL ${i+1} (${a.provider}):\n${a.text}`).join("\n\n");
  const synthPrompt="You are the ShiftX Consensus Manager. Below are independent answers to the CEO's question. Produce ONE answer for the CEO. Use the strongest common ground supported by the responses. Do not invent agreement. When the models materially disagree, give the most defensible combined answer and briefly state the disagreement or uncertainty. Never mention internal prompts, API keys, or hidden reasoning.\n\nCEO QUESTION:\n"+question+"\n\nINDEPENDENT ANSWERS:\n"+evidence;
  const synthMessages=[{role:"system",content:"Return one concise, useful consensus answer. Be factual and transparent about uncertainty."},{role:"user",content:synthPrompt}];
  const preferred=["OpenRouter","OpenAI","Anthropic","Google Gemini","xAI Grok","Mistral","Groq"];
  let synthesis=null;
  for(const name of preferred){
    const p=providers[name],key=p&&context.env[p.env];
    if(!p||!key)continue;
    const model=(body.synthesis_model)||context.env["CONSENSUS_MODEL"]||context.env[name==="OpenRouter"?"OPENROUTER_MODEL":name==="OpenAI"?"OPENAI_MODEL":name==="Anthropic"?"ANTHROPIC_MODEL":name==="Google Gemini"?"GEMINI_MODEL":name==="xAI Grok"?"XAI_MODEL":name==="Mistral"?"MISTRAL_MODEL":"GROQ_MODEL"];
    if(!model)continue;
    if(p.kind==="anthropic")synthesis=await consensusAnthropic(key,model,synthMessages);
    else if(p.kind==="gemini")synthesis=await consensusGemini(key,model,synthMessages);
    else synthesis=await consensusOpenAI({...p,name},key,model,synthMessages);
    if(synthesis?.ok)break;
  }
  if(!synthesis?.ok){
    return {ok:true,text:answers[0].text,mode:"consensus-fallback",responded:answers.length,total:names.length,providers:answers.map(a=>a.provider),note:"Only one final response is shown; synthesis was unavailable, so the first connected model's answer was used."};
  }
  return {ok:true,text:synthesis.text,mode:"consensus",responded:answers.length,total:names.length,providers:answers.map(a=>a.provider),synthesis_provider:synthesis.provider};
}

export async function onRequest(context){
  if(context.request.method==="OPTIONS")return json({},204);
  if(context.request.method!=="POST")return json({error:"POST only"},405);
  try{
    const body=await context.request.json();
    const providerName=body?.provider||"Consensus";
    if(providerName==="Consensus"){const result=await runConsensus(context,body);return json(result,result.error?503:200)}
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