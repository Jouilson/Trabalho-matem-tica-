// Portal de Física - Prof. Jouilson - Backend Online (com persistência em PostgreSQL)
// Se DATABASE_URL estiver definida (Render), usa Postgres (persistente). Senão, usa data.json (local).
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PROFESSOR_EMAIL = 'profjouilson@gmail.com';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const configTurmas = {
  "9": { name: "9º Ano - Ondas, Espectro e Radioatividade", maxPerTeam: 3, teams: {
    "Equipe 1": { desc: "Classificação, Natureza e Propagação das Ondas.", titles: ["O Mundo Ondulatório","Ondas Mecânicas vs Eletromagnéticas","Propagação das Perturbações","A Física das Ondas"] },
    "Equipe 2": { desc: "Tipo e Duração da Perturbação das Ondas.", titles: ["Pulso e Perturbação","Ondas Transversais e Longitudinais","Como as Perturbações Viajam","Duração das Ondas"] },
    "Equipe 3": { desc: "Elementos de uma Onda Periódica.", titles: ["Comprimento de Onda e Frequência","Anatomia de uma Onda Periódica","Velocidade das Ondas","O Ritmo do Universo"] },
    "Equipe 4": { desc: "Espectro Eletromagnético e Radiação do Sol.", titles: ["Regiões do Espectro","A Luz do Sol e Radiações Invisíveis","Do Infravermelho ao Raio-X","Radiação Solar e a Terra"] },
    "Equipe 5": { desc: "A História da Radioatividade.", titles: ["A Descoberta da Radioatividade","Marie Curie e os Pioneiros","Dos Raios-X aos Fenômenos Nucleares","Trajetória da Radioatividade"] }
  }},
  "1": { name: "1º Ano - Leis de Newton e Dinâmica", maxPerTeam: 2, teams: {
    "Equipe 1": { desc: "1ª Lei de Newton (Inércia).", titles: ["A Inércia no Quotidiano","Inércia e Segurança","Compreendendo a 1ª Lei","Inércia e Movimento"] },
    "Equipe 2": { desc: "2ª Lei de Newton (Fundamental).", titles: ["Força, Massa e Aceleração","A 2ª Lei Explica o Movimento","A Matemática da Dinâmica","Força e Aceleração"] },
    "Equipe 3": { desc: "3ª Lei de Newton (Ação e Reação).", titles: ["Ação e Reação","Como os Foguetes Voam","Forças Mútuas","Equilíbrio das Forças"] },
    "Equipe 4": { desc: "Dinâmica Circular (Força Centrípeta).", titles: ["Curvas Perigosas","Física dos Carros de Corrida","Dinâmica Circular","Força Centrípeta"] },
    "Equipe 5": { desc: "Gravitação Universal.", titles: ["A Gravidade do Universo","Satélites em Órbita","Atração dos Corpos Celestes","Gravitação e Kepler"] }
  }},
  "2": { name: "2º Ano - Acústica e Ondas Sonoras", maxPerTeam: 2, teams: {
    "Equipe 1": { desc: "Natureza do Som e Velocidade.", titles: ["O Som como Onda Mecânica","Velocidade do Som","Mundo Sonoro e Propagação","Acústica Básica"] },
    "Equipe 2": { desc: "Altura e Intensidade do Som.", titles: ["Sons Graves e Agudos","Volume e Intensidade","Como o Ouvido Interpreta o Som","Altura e Intensidade"] },
    "Equipe 3": { desc: "Timbre, Eco e Ressonância.", titles: ["O Timbre dos Instrumentos","Eco e Reverberação","Ressonância e Amplificação","Reflexão Sonora"] },
    "Equipe 4": { desc: "Interferência e Difração Sonora.", titles: ["Difração do Som","Interferência de Ondas","Fenômenos Ondulatórios","Som com Barreiras"] },
    "Equipe 5": { desc: "Efeito Doppler.", titles: ["A Sirene que Muda de Tom","Aplicações do Efeito Doppler","Movimento e Frequência","Som da Ambulância"] }
  }},
  "3": { name: "3º Ano - Magnetismo e Eletromagnetismo", maxPerTeam: 3, teams: {
    "Equipe 1": { desc: "Ímanes e Campo Magnético.", titles: ["Os Polos Magnéticos","Linhas de Campo","Magnetismo na Tecnologia","Forças dos Ímanes"] },
    "Equipe 2": { desc: "Magnetismo Terrestre e Bússola.", titles: ["A Terra como Íman","A Bússola e a Navegação","Campo Magnético Planetário","Como a Bússola Acha o Norte"] },
    "Equipe 3": { desc: "Eletromagnetismo (Oersted).", titles: ["Eletricidade Cria Magnetismo","Solenoides e Eletroímanes","A Revolução do Eletromagnetismo","Interação Elétrica e Magnética"] },
    "Equipe 4": { desc: "Força Magnética em Cargas.", titles: ["Força que Desvia Cargas","Partículas no Campo Magnético","Magnetismo e Partículas","Aceleradores de Partículas"] },
    "Equipe 5": { desc: "Força Magnética e Motores.", titles: ["Motores Elétricos","Corrente e Força em Condutores","Eletricidade em Movimento","Aplicações da Força Magnética"] }
  }}
};

let db = { teamsByGrade: {} };
let pgPool = null;

async function initPG() {
  if (!process.env.DATABASE_URL) return false;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pgPool.query(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);
    console.log('✅ PostgreSQL conectado (dados persistentes)');
    return true;
  } catch (e) { console.error('Erro Postgres:', e.message); pgPool = null; return false; }
}

function initTeamsForGrade(grade) {
  const info = configTurmas[grade]; if (!info) return [];
  return Object.keys(info.teams).map(tname => ({
    name: tname, grade, members: [],
    topic: { topic: info.teams[tname].desc, titles: info.teams[tname].titles },
    selectedTitle: "", docContent: "", chat: [], aiChat: [], finished: false, updatedAt: Date.now()
  }));
}

async function loadDB() {
  let loaded = false;
  if (pgPool) {
    try { const r = await pgPool.query(`SELECT value FROM kv WHERE key='data'`); if (r.rows.length) { db = r.rows[0].value; loaded = true; } }
    catch (e) { console.error('loadDB pg:', e.message); }
  }
  if (!loaded) { try { if (fs.existsSync(DATA_FILE)) { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); loaded = true; } } catch(e){} }
  if (!db.teamsByGrade) db.teamsByGrade = {};
  for (const g of ["9","1","2","3"]) {
    if (!db.teamsByGrade[g] || !Array.isArray(db.teamsByGrade[g]) || !db.teamsByGrade[g].length) db.teamsByGrade[g] = initTeamsForGrade(g);
  }
}

let saveTimer = null;
function saveDB() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (pgPool) {
      try { await pgPool.query(`INSERT INTO kv (key, value) VALUES ('data', $1) ON CONFLICT (key) DO UPDATE SET value=$1`, [db]); return; }
      catch (e) { console.error('saveDB pg:', e.message); }
    }
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); } catch(e){}
  }, 300);
}

const getTeams = g => db.teamsByGrade[g] || [];
const findTeam = (g,n) => getTeams(g).find(t => t.name === n);
const teamRoom = (g,n) => `team:${g}:${n}`;

app.get('/api/teams/:grade', (req, res) => {
  const info = configTurmas[req.params.grade]; const max = info ? info.maxPerTeam : 3;
  res.json({ maxPerTeam: max, teams: getTeams(req.params.grade).map(t => ({ name:t.name, grade:t.grade, members:t.members, topic:t.topic, selectedTitle:t.selectedTitle, finished:t.finished })) });
});
app.post('/api/join', (req, res) => {
  const { name, grade, teamName } = req.body || {};
  if (!name || !grade || !teamName) return res.status(400).json({ error: 'Dados incompletos' });
  const info = configTurmas[grade]; const max = info ? info.maxPerTeam : 3;
  const teams = getTeams(grade); const team = findTeam(grade, teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  if (!team.members.includes(name)) {
    if (teams.some(t => t.members.includes(name))) return res.status(400).json({ error: 'Você já está em outra equipe desta turma!' });
    if (team.members.length >= max) return res.status(400).json({ error: `Esta equipe atingiu o limite de ${max} alunos.` });
    team.members.push(name); team.updatedAt = Date.now(); saveDB();
    io.to(teamRoom(grade, teamName)).emit('members-update', { members: team.members });
  }
  res.json({ ok: true, team });
});
app.post('/api/title', (req, res) => {
  const { grade, teamName, title } = req.body || {};
  const team = findTeam(grade, teamName); if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  team.selectedTitle = title; team.updatedAt = Date.now(); saveDB();
  io.to(teamRoom(grade, teamName)).emit('title-update', { title });
  res.json({ ok: true, team });
});
app.post('/api/save', (req, res) => {
  const { grade, teamName, docContent, title } = req.body || {};
  const team = findTeam(grade, teamName); if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  team.docContent = docContent || ""; if (title) team.selectedTitle = title;
  team.updatedAt = Date.now(); saveDB();
  res.json({ ok: true, savedAt: new Date().toISOString() });
});
app.post('/api/ai', (req, res) => {
  const { grade, teamName, entries } = req.body || {};
  const team = findTeam(grade, teamName); if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  if (Array.isArray(entries)) team.aiChat = entries;
  team.updatedAt = Date.now(); saveDB();
  res.json({ ok: true });
});
app.get('/api/state/:grade/:teamName', (req, res) => {
  const team = findTeam(req.params.grade, req.params.teamName);
  if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  res.json({ team });
});
app.post('/api/send-email', async (req, res) => {
  const { grade, teamName } = req.body || {};
  const team = findTeam(grade, teamName); if (!team) return res.status(404).json({ error: 'Equipe não encontrada' });
  team.finished = true; team.updatedAt = Date.now(); saveDB();
  const plain = (team.docContent || "").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const payload = { _subject: `[Trabalho Física] ${grade}º Ano - ${team.name}`, _replyto: PROFESSOR_EMAIL, _template: "table",
    "Turma": configTurmas[grade]?.name || grade, "Equipe": team.name, "Subtema": team.topic?.topic || "-",
    "Título": team.selectedTitle || "-", "Integrantes": (team.members||[]).join(", ") || "-", "Conteúdo": plain || "(vazio)" };
  try {
    const r = await fetch(`https://formsubmit.co/ajax/${PROFESSOR_EMAIL}`, { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload) });
    const d = await r.json().catch(()=>({})); res.json({ ok: true, info: d });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

io.on('connection', (socket) => {
  socket.on('join-team', ({ grade, teamName, userName }) => {
    const room = teamRoom(grade, teamName);
    socket.join(room); socket.data.room = room; socket.data.userName = userName;
    io.to(room).emit('user-joined', { userName, online: (io.sockets.adapter.rooms.get(room)||{size:0}).size });
  });
  socket.on('chat', ({ grade, teamName, sender, text, time }) => {
    const team = findTeam(grade, teamName); if (!team) return;
    const msg = { sender, text, time: time || new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) };
    team.chat.push(msg); if (team.chat.length > 200) team.chat = team.chat.slice(-200);
    team.updatedAt = Date.now(); saveDB();
    io.to(teamRoom(grade, teamName)).emit('chat', msg);
  });
  socket.on('doc-update', ({ grade, teamName, docContent, title, by }) => {
    const team = findTeam(grade, teamName); if (!team) return;
    team.docContent = docContent || ""; if (title) team.selectedTitle = title;
    team.updatedAt = Date.now(); saveDB();
    socket.to(teamRoom(grade, teamName)).emit('doc-update', { docContent, title, by });
  });
  socket.on('disconnect', () => {
    if (socket.data.room) {
      const n = (io.sockets.adapter.rooms.get(socket.data.room)||{size:0}).size;
      io.to(socket.data.room).emit('user-left', { userName: socket.data.userName, online: Math.max(0, n-1) });
    }
  });
});

(async () => {
  await initPG();
  await loadDB();
  saveDB();
  server.listen(PORT, () => console.log(`✅ Portal de Física rodando em http://localhost:${PORT} ${pgPool?'(Postgres persistente)':'(arquivo local)'}`));
})();
