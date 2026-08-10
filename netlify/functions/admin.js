const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

let store;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHANGE-ME";

function json(body,statusCode=200){return {statusCode,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(body)}}
async function getJson(key,fallback=null){const v=await store.get(key,{type:"json"});return v===null?fallback:v}
async function setJson(key,v){await store.setJSON(key,v)}
async function del(key){try{await store.delete(key)}catch{}}
function tokenFor(password){return crypto.createHash("sha256").update(password).digest("hex")}
function authorized(event){return event.headers&&event.headers["x-admin-token"]===tokenFor(ADMIN_PASSWORD)}
function randomCode(){return String(Math.floor(10000000+Math.random()*90000000))}
function csvEscape(v){return '"'+String(v??"").replaceAll('"','""')+'"'}

exports.handler=async function(event){
  try{
const store = getStore("training-attendance", {
  siteID: process.env.SITE_ID,
  token: process.env.NETLIFY_AUTH_TOKEN
});
    const action=event.queryStringParameters?.action;
    if(action==="login"&&event.httpMethod==="POST"){
      const body=JSON.parse(event.body||"{}");
      if(body.password!==ADMIN_PASSWORD)return json({error:"Incorrect password."},401);
      return json({token:tokenFor(ADMIN_PASSWORD)});
    }
    if(!authorized(event))return json({error:"Unauthorized."},401);

    if(action==="createSession"&&event.httpMethod==="POST"){
      const body=JSON.parse(event.body||"{}");const id=String(body.id||"").trim(),name=String(body.name||"").trim();
      if(!id||!name)return json({error:"Session ID and name are required."},400);
      const session={id,name,createdAt:new Date().toISOString()};
      await setJson("active-session",session);return json({session});
    }

    if(action==="generateCodes"&&event.httpMethod==="POST"){
      const =JSON.parse(event.body||"{}");const count=Math.min(Math.max(Number(body.count)||0,1),1000);const codes=[];
      const index=await getJson("code-index",[]);
      const existing=new Set(index);
      for(let i=0;i<count;i++){let code;do{code=randomCode()}while(existing.has(code));existing.add(code);await setJson("code-"+code,{code,registered:false,createdAt:new Date().toISOString()});codes.push(code)}
      await setJson("code-index",Array.from(existing));return json({codes});
    }

    if(action==="codes"){
      const index=await getJson("code-index",[]);const codes=[];
      for(const code of index){const r=await getJson("code-"+code);if(r)codes.push(r)}
      codes.sort((a,b)=>a.code.localeCompare(b.code));return json({codes});
    }

    if(action==="data"){
      const session=await getJson("active-session");const attendance=await getAttendance(session?.id);return json({session,attendance});
    }

    if(action==="attendance"){
      const index=await getJson("attendance-index",[]);const rows=[];
      for(const key of index){const r=await getJson(key);if(r)rows.push(r)}
      rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));return json({rows});
    }

    if(action==="resetSession"&&event.httpMethod==="POST"){
      const session=await getJson("active-session");
      if(!session)return json({error:"No active session."},404);
      const index=await getJson("attendance-index",[]);
      const remaining=[];
      let removed=0;
      for(const key of index){
        if(key.startsWith("attendance-"+session.id+"-")){await del(key);removed++}else remaining.push(key)
      }
      await setJson("attendance-index",remaining);
      return json({message:`Current session reset. Removed ${removed} attendance record(s). Teacher-code registrations were kept.`});
    }

    if(action==="resetEverything"&&event.httpMethod==="POST"){
      const codeIndex=await getJson("code-index",[]);
      for(const code of codeIndex)await del("code-"+code);
      const attendanceIndex=await getJson("attendance-index",[]);
      for(const key of attendanceIndex)await del(key);
      await del("code-index");await del("attendance-index");await del("active-session");
      return json({message:"Everything has been reset. All codes, registrations, attendance, and the active session were deleted."});
    }

    return json({error:"Unknown action."},404);
  }catch(e){console.error(e);return json({error:"Server error."},500)}
};

async function getAttendance(sessionId){
  if(!sessionId)return [];
  const index=await getJson("attendance-index",[]);const rows=[];
  for(const key of index){if(key.startsWith("attendance-"+sessionId+"-")){const r=await getJson(key);if(r)rows.push(r)}}
  rows.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));return rows;
}
