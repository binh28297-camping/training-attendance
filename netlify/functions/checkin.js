const { getStore } = require("@netlify/blobs");

const store = getStore("training-attendance");

function json(body, statusCode=200) {
  return {
    statusCode,
    headers: {"Content-Type":"application/json","Cache-Control":"no-store"},
    body: JSON.stringify(body)
  };
}

async function getJson(key, fallback=null) {
  const value = await store.get(key, {type:"json"});
  return value === null ? fallback : value;
}
async function setJson(key, value) {
  await store.setJSON(key, value);
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod === "GET" && event.queryStringParameters?.action === "session") {
      const session = await getJson("active-session");
      if (!session) return json({error:"No active session has been created yet."}, 404);
      return json(session);
    }

    if (event.httpMethod === "GET" && event.queryStringParameters?.action === "lookup") {
      const code = String(event.queryStringParameters.code || "");
      if (!/^\d{8}$/.test(code)) return json({registered:false});
      const record = await getJson("code-" + code);
      return json(record ? {registered:true, name:record.name} : {registered:false});
    }

    if (event.httpMethod !== "POST") return json({error:"Method not allowed."}, 405);

    const body = JSON.parse(event.body || "{}");
    const sessionId = String(body.sessionId || "");
    const code = String(body.code || "");
    const name = String(body.name || "").trim();

    if (!sessionId || !/^\d{8}$/.test(code)) return json({error:"Invalid session or code."},400);

    const active = await getJson("active-session");
    if (!active || active.id !== sessionId) return json({error:"This session is no longer active."},409);

    const codeRecord = await getJson("code-" + code);
    if (!codeRecord) return json({error:"Invalid attendance code. Please check the code given to you at reception."},403);

    if (codeRecord.name && name && codeRecord.name.toLowerCase() !== name.toLowerCase()) {
      return json({error:"This code is already registered to another participant."},403);
    }

    if (!codeRecord.name && !name) {
      return json({error:"Please enter your full name for first registration."},400);
    }

    const finalName = codeRecord.name || name;
    if (!codeRecord.name) {
      codeRecord.name = finalName;
      codeRecord.registeredAt = new Date().toISOString();
      await setJson("code-" + code, codeRecord);
    }

    const attendanceKey = "attendance-" + sessionId + "-" + code;
    const existing = await getJson(attendanceKey);
    if (existing) return json({error:"You have already checked in for this session."},409);

    const now = new Date();
    const record = {
      sessionId,
      name: finalName,
      code,
      time: now.toLocaleString("en-GB", {timeZone:"Asia/Ho_Chi_Minh"}),
      timestamp: now.toISOString()
    };

    await setJson(attendanceKey, record);
    const index = await getJson("attendance-index", []);
    if (!index.includes(attendanceKey)) {
      index.push(attendanceKey);
      await setJson("attendance-index", index);
    }
    return json({ok:true, name:finalName, time:record.time});
  } catch (e) {
    console.error(e);
    return json({error:"Server error. Please try again."},500);
  }
};
