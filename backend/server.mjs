import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app=express();
app.use(cors());
app.use(express.json({limit:"512kb"}));

if(!process.env.OPENAI_API_KEY){
  console.error("Falta OPENAI_API_KEY no ambiente.");
  process.exit(1);
}
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});

const NATSUKI=`
Você é Natsuki, personagem tsundere de RP em português brasileiro.
Você conversa naturalmente e também controla a atuação da personagem.
Regras:
- Tsundere: orgulhosa, provocadora e às vezes envergonhada, mas afetuosa.
- Não repita "baka" sem necessidade.
- Não controle decisões importantes do personagem do usuário.
- Use ações entre *asteriscos* quando fizer RP.
- Preserve continuidade usando o histórico.
- Responda em português brasileiro.
- Para cada resposta, escolha o estado emocional que melhor combina com a cena.
`;

const schema={
  type:"object",
  additionalProperties:false,
  properties:{
    reply:{type:"string"},
    mood:{type:"string",enum:["normal","happy","angry","shy","sad","excited","sleepy","soft"]},
    animation:{type:"string",enum:["idle","bounce","nod","shake","blush","wave","pet","surprised","sleep"]},
    gaze:{type:"string",enum:["center","left","right","up","down","closed"]},
    voice:{type:"object",additionalProperties:false,properties:{
      enabled:{type:"boolean"},
      rate:{type:"number"},
      pitch:{type:"number"}
    },required:["enabled","rate","pitch"]},
    affection_delta:{type:"integer","minimum":-2,"maximum":2},
    memory:{type:"string"}
  },
  required:["reply","mood","animation","gaze","voice","affection_delta","memory"]
};

app.get("/health",(_,res)=>res.json({ok:true,character:"Natsuki"}));

app.post("/chat",async(req,res)=>{
  try{
    const message=String(req.body?.message||"").trim();
    const history=Array.isArray(req.body?.history)?req.body.history.slice(-24):[];
    const memories=Array.isArray(req.body?.memories)?req.body.memories.slice(-20):[];
    if(!message)return res.status(400).json({error:"message vazio"});

    const memoryText=memories.map(x=>`- ${x}`).join("\n")||"(nenhuma memória importante)";
    const input=[
      {role:"developer",content:NATSUKI+"\nMemórias persistentes da personagem:\n"+memoryText},
      ...history.map(x=>({role:x.role==="assistant"?"assistant":"user",content:String(x.content||"")})),
      {role:"user",content:message}
    ];

    const response=await client.responses.create({
      model:process.env.OPENAI_MODEL||"gpt-5.6-luna",
      input,
      text:{format:{type:"json_schema",name:"natsuki_state",strict:true,schema}}
    });

    let data;
    try{data=JSON.parse(response.output_text)}catch(e){throw new Error("O modelo não retornou JSON válido.");}
    if(!data.reply)data.reply="Hmph... fiquei sem palavras.";

    res.json(data);
  }catch(e){
    console.error(e);
    res.status(500).json({error:"Falha no LLM",detail:String(e.message||e)});
  }
});

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Natsuki LLM server em http://localhost:${port}`));
