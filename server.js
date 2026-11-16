// Jornada Matemática Colaborativa - Backend com PostgreSQL
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const PROFESSOR_EMAIL = process.env.PROFESSOR_EMAIL || 'profjouilson@gmail.com';

if (!DATABASE_URL) {
  console.error('ERRO: configure a variável DATABASE_URL no Render.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(require('path').join(__dirname, 'public')));

const DATABASE = {
  "6": [
    { topic: "Os Polígonos", titles: ["📐 Caçadores de Formas", "🎮 Polígonos nos Games", "🏰 Cidades Geométricas", "🎨 Arte com Polígonos", "🔍 Detetives do Perímetro"], q1: "O que faz uma figura geométrica ser um polígono e por que as linhas não se cruzam?", hint1: "Pense no formato do piso da sala." },
    { topic: "A Porcentagem", titles: ["🏷️ Super Descontos", "🍕 A Mágica do 100%", "📊 Porcentagem Diária", "🎮 Bateria e Porcentagem", "💰 Economizando com %"], q1: "O que a porcentagem (%) significa no dia a dia?", hint1: "Observe a bateria do celular." }
  ],
  "7": [
    { topic: "Sistemas de Equações do 1º Grau", titles: ["🕵️‍♂️ Dupla Dinâmica de Equações", "⚖️ O Enigma dos Dois Desconhecidos", "🍔 Compras na Lanchonete", "🎟️ Ingressos e Trocos", "🧩 Duas Pistas, Uma Solução"], q1: "Como duas informações desconhecidas se cruzam?", hint1: "Pense nos preços combinados de lanches." }
  ],
  "8": [
    { topic: "Equação do 2º Grau (Raízes)", titles: ["🚀 A Trajetória Perfeita", "🎯 O Enigma de Bhaskara", "🏀 A Parábola da Basquete", "🔍 Detetives das Raízes", "⚡ As Raízes da Equação"], q1: "O que significa encontrar as raízes da equação?", hint1: "Pense no arco que uma bola faz ao ser lançada." }
  ]
};
const PRESET_TEAM_NAMES = [
  "🚀 Exploradores da Galáxia Matemática",
  "🕵️‍♂️ Detetives da Lógica Secreta",
  "🎨 Mestres das Cores e Formas",
  "⚡ Esquadrão Raio Numérico",
  "🧠 Super Cientistas da Álgebra"
];


function teamRoom(grade, name) { return `team:${grade}:${name}`; }

function rowToTeam(row) {
  return {
    name: row.name,
    grade: String(row.grade),
    members: row.members || [],
    topic: row.topic || {},
    selectedTitle: row.selected_title || '',
    docContent: row.doc_content || '',
    chat: row.chat || [],
    aiChat: row.ai_chat || [],
    finished: Boolean(row.finished),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
  };
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      grade TEXT NOT NULL,
      name TEXT NOT NULL,
      members JSONB NOT NULL DEFAULT '[]'::jsonb,
      topic JSONB NOT NULL DEFAULT '{}'::jsonb,
      selected_title TEXT NOT NULL DEFAULT '',
      doc_content TEXT NOT NULL DEFAULT '',
      chat JSONB NOT NULL DEFAULT '[]'::jsonb,
      ai_chat JSONB NOT NULL DEFAULT '[]'::jsonb,
      finished BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (grade, name)
    )
  `);

  for (const grade of ['6', '7', '8']) {
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM teams WHERE grade = $1', [grade]);
    if (count.rows[0].total === 0) {
      const initialTeams = PRESET_TEAM_NAMES.map((name, index) => ({
        name,
        grade,
        members: [],
        topic: (DATABASE[grade] || DATABASE['6'])[index % (DATABASE[grade] || DATABASE['6']).length],
        selectedTitle: '',
        docContent: '',
        chat: [],
        aiChat: [],
        finished: false
      }));
      for (const team of initialTeams) {
        await pool.query(
          `INSERT INTO teams (grade, name, members, topic, selected_title, doc_content, chat, ai_chat, finished)
           VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7::jsonb,$8::jsonb,$9)
           ON CONFLICT (grade,name) DO NOTHING`,
          [grade, team.name, JSON.stringify(team.members), JSON.stringify(team.topic),
           team.selectedTitle, team.docContent, JSON.stringify(team.chat), JSON.stringify(team.aiChat), team.finished]
        );
      }
    }
  }
  console.log('Banco PostgreSQL inicializado.');
}

async function findTeam(grade, name, client = pool) {
  const result = await client.query('SELECT * FROM teams WHERE grade = $1 AND name = $2', [String(grade), name]);
  return result.rows[0] ? rowToTeam(result.rows[0]) : null;
}

async function updateTeam(grade, name, fields) {
  const columns = {
    members: ['members', 'json'],
    topic: ['topic', 'json'],
    selectedTitle: ['selected_title', 'text'],
    docContent: ['doc_content', 'text'],
    chat: ['chat', 'json'],
    aiChat: ['ai_chat', 'json'],
    finished: ['finished', 'boolean']
  };
  const sets = [];
  const values = [String(grade), name];
  for (const [key, value] of Object.entries(fields)) {
    if (!columns[key]) continue;
    const [column, type] = columns[key];
    values.push(type === 'json' ? JSON.stringify(value) : value);
    sets.push(`${column} = $${values.length}${type === 'json' ? '::jsonb' : ''}`);
  }
  if (!sets.length) return findTeam(grade, name);
  sets.push('updated_at = NOW()');
  await pool.query(`UPDATE teams SET ${sets.join(', ')} WHERE grade = $1 AND name = $2`, values);
  return findTeam(grade, name);
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(503).json({ ok: false, error: 'Banco de dados indisponível.' });
  }
});

app.get('/api/teams/:grade', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT grade,name,members,topic,selected_title,finished FROM teams WHERE grade=$1 ORDER BY name',
      [String(req.params.grade)]
    );
    res.json({ teams: result.rows.map(row => ({
      name: row.name, grade: String(row.grade), members: row.members || [],
      topic: row.topic || {}, selectedTitle: row.selected_title || '', finished: Boolean(row.finished)
    })) });
  } catch (error) {
    console.error('GET teams:', error);
    res.status(500).json({ error: 'Não foi possível carregar as equipes.' });
  }
});

app.post('/api/join', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 100);
  const grade = String(req.body?.grade || '');
  const teamName = String(req.body?.teamName || '');
  if (!name || !['6','7','8'].includes(grade) || !teamName) {
    return res.status(400).json({ error: 'Informe nome, ano e equipe.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      'SELECT * FROM teams WHERE grade=$1 AND name=$2 FOR UPDATE', [grade, teamName]
    );
    if (!selected.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Equipe não encontrada.' });
    }
    const team = rowToTeam(selected.rows[0]);
    if (!team.members.includes(name)) {
      const other = await client.query(
        `SELECT name FROM teams WHERE grade=$1 AND name<>$2 AND members @> $3::jsonb LIMIT 1`,
        [grade, teamName, JSON.stringify([name])]
      );
      if (other.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Você já está cadastrado em outra equipe deste ano!' });
      }
      const maxMembers = grade === '8' ? 4 : 5;
      if (team.members.length >= maxMembers) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Esta equipe atingiu o limite máximo de ${maxMembers} alunos.` });
      }
      team.members.push(name);
      await client.query(
        'UPDATE teams SET members=$3::jsonb, updated_at=NOW() WHERE grade=$1 AND name=$2',
        [grade, teamName, JSON.stringify(team.members)]
      );
    }
    await client.query('COMMIT');
    const updated = await findTeam(grade, teamName);
    io.to(teamRoom(grade, teamName)).emit('members-update', { members: updated.members });
    res.json({ ok: true, team: updated });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST join:', error);
    res.status(500).json({ error: 'Erro ao registrar participação.' });
  } finally {
    client.release();
  }
});

app.post('/api/title', async (req, res) => {
  try {
    const { grade, teamName, title } = req.body || {};
    const team = await updateTeam(grade, teamName, { selectedTitle: String(title || '').slice(0, 250) });
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    io.to(teamRoom(grade, teamName)).emit('title-update', { title: team.selectedTitle });
    res.json({ ok: true, team });
  } catch (error) {
    console.error('POST title:', error);
    res.status(500).json({ error: 'Não foi possível salvar o título.' });
  }
});

app.post('/api/save', async (req, res) => {
  try {
    const { grade, teamName, docContent } = req.body || {};
    if (typeof docContent !== 'string' || docContent.length > 2000000) {
      return res.status(400).json({ error: 'Conteúdo inválido ou muito grande.' });
    }
    const team = await updateTeam(grade, teamName, { docContent });
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error('POST save:', error);
    res.status(500).json({ error: 'Falha ao gravar o trabalho no banco de dados.' });
  }
});

app.post('/api/ai', async (req, res) => {
  try {
    const { grade, teamName, entries } = req.body || {};
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'Histórico inválido.' });
    const team = await updateTeam(grade, teamName, { aiChat: entries });
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    res.json({ ok: true });
  } catch (error) {
    console.error('POST ai:', error);
    res.status(500).json({ error: 'Não foi possível salvar o histórico.' });
  }
});

app.get('/api/state/:grade/:teamName', async (req, res) => {
  try {
    const team = await findTeam(req.params.grade, req.params.teamName);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    res.json({ team });
  } catch (error) {
    console.error('GET state:', error);
    res.status(500).json({ error: 'Não foi possível carregar o trabalho.' });
  }
});

function htmlToText(html) {
  return String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

app.post('/api/send-email', async (req, res) => {
  try {
    const { grade, teamName } = req.body || {};
    const team = await findTeam(grade, teamName);
    if (!team) return res.status(404).json({ ok: false, error: 'Equipe não encontrada.' });
    const payload = {
      _subject: `Trabalho de Matemática - ${team.grade}º Ano - Equipe: ${team.name}`,
      _template: 'table',
      _captcha: 'false',
      'Ano': `${team.grade}º Ano`,
      'Equipe': team.name,
      'Tema': team.topic?.topic || '-',
      'Título': team.selectedTitle || '-',
      'Integrantes': team.members.join(', ') || '-',
      'Conteúdo do Trabalho': htmlToText(team.docContent) || '(vazio)'
    };
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(PROFESSOR_EMAIL)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    const providerAccepted = response.ok && (data.success === true || data.success === 'true' || String(data.message || '').toLowerCase().includes('success'));
    if (!providerAccepted) {
      console.error('FormSubmit recusou o envio:', response.status, data);
      return res.status(502).json({
        ok: false,
        error: data.message || data.error || 'O serviço de e-mail não confirmou o envio. Verifique a ativação do FormSubmit.'
      });
    }
    await updateTeam(grade, teamName, { finished: true });
    res.json({ ok: true, message: 'O serviço de e-mail confirmou o recebimento.' });
  } catch (error) {
    console.error('POST send-email:', error);
    res.status(500).json({ ok: false, error: 'Erro ao enviar o trabalho por e-mail.' });
  }
});

io.on('connection', (socket) => {
  socket.on('join-team', async ({ grade, teamName, userName } = {}) => {
    const room = teamRoom(grade, teamName);
    if (socket.data.room && socket.data.room !== room) socket.leave(socket.data.room);
    socket.join(room);
    socket.data.room = room;
    socket.data.userName = userName;
    io.to(room).emit('user-joined', { userName, online: countOnline(room) });
  });

  socket.on('chat', async ({ grade, teamName, sender, text, time } = {}) => {
    try {
      const team = await findTeam(grade, teamName);
      if (!team || !String(text || '').trim()) return;
      const msg = {
        sender: String(sender || 'Aluno').slice(0, 100),
        text: String(text).trim().slice(0, 2000),
        time: time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      team.chat.push(msg);
      if (team.chat.length > 200) team.chat = team.chat.slice(-200);
      await updateTeam(grade, teamName, { chat: team.chat });
      io.to(teamRoom(grade, teamName)).emit('chat', msg);
    } catch (error) { console.error('Socket chat:', error); }
  });

  socket.on('doc-update', async ({ grade, teamName, docContent, by } = {}) => {
    try {
      if (typeof docContent !== 'string' || docContent.length > 2000000) return;
      const team = await updateTeam(grade, teamName, { docContent });
      if (team) socket.to(teamRoom(grade, teamName)).emit('doc-update', { docContent, by });
    } catch (error) { console.error('Socket doc-update:', error); }
  });

  socket.on('disconnect', () => {
    if (socket.data.room) {
      io.to(socket.data.room).emit('user-left', {
        userName: socket.data.userName,
        online: Math.max(0, countOnline(socket.data.room))
      });
    }
  });
});

function countOnline(room) {
  const r = io.sockets.adapter.rooms.get(room);
  return r ? r.size : 0;
}

// ============================================================
// PAINEL DO PROFESSOR (tutor) — área protegida por senha
// Bloco ADICIONAL: não altera nenhuma rota existente dos alunos.
// A senha é validada no SERVIDOR; o hash (scrypt + salt) vem da
// variável de ambiente ADMIN_CRED no Render — nunca fica no HTML
// nem no repositório. Gere o hash com: node gerar-hash-senha.js "suaSenha"
// ============================================================
const crypto = require('crypto');

// Formato da variável de ambiente: ADMIN_CRED = "salt:hash_hex"
const [ADMIN_SALT, ADMIN_HASH] = (process.env.ADMIN_CRED || '').split(':');
const adminSessions = new Map(); // token de sessão -> true (memória)

function verifyAdminPassword(password) {
  if (!ADMIN_SALT || !ADMIN_HASH) return false;
  try {
    const candidate = crypto.scryptSync(String(password), ADMIN_SALT, 64);
    const stored = Buffer.from(ADMIN_HASH, 'hex');
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  } catch (e) { return false; }
}

// Middleware de proteção: aplicado SOMENTE nas rotas /api/admin/*
function requireAdmin(req, res, next) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)prof_token=([a-f0-9]+)/);
  const token = match && match[1];
  if (token && adminSessions.has(token)) return next();
  return res.status(401).json({ error: 'Acesso restrito ao professor. Faça login.' });
}

// Login do professor (a senha nunca é armazenada em texto; só o hash é comparado)
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.set(token, true);
  res.setHeader('Set-Cookie', `prof_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)prof_token=([a-f0-9]+)/);
  if (match) adminSessions.delete(match[1]);
  res.setHeader('Set-Cookie', 'prof_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

const MAX_MEMBERS = { "6": 5, "7": 5, "8": 4 };

function teamProgress(t) {
  const docChars = (t.docContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
  let progress = 0;
  if (t.members && t.members.length > 0) progress += 25; // equipe formada
  if (t.selectedTitle) progress += 25;                 // título escolhido
  if (docChars > 0) progress += 30;                     // trabalho escrito
  if (t.finished) progress += 20;                        // enviado/concluído
  let status = 'vazia';
  if (t.finished) status = 'concluida';
  else if (t.members && t.members.length > 0) status = 'andamento';
  return { progress, status, docChars, aiCount: (t.aiChat || []).length, chatCount: (t.chat || []).length };
}

// Visão geral protegida: todas as equipes dos 6º, 7º e 8º anos com resumo de andamento
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT grade, name, members, topic, selected_title, doc_content, chat, ai_chat, finished, updated_at
       FROM teams WHERE grade = ANY($1) ORDER BY grade, name`,
      [['6', '7', '8']]
    );
    const summary = { teams: 0, members: 0, finished: 0, inProgress: 0, empty: 0 };
    const grades = ['6', '7', '8'].map(g => {
      const teams = result.rows
        .filter(row => String(row.grade) === g)
        .map(row => {
          const t = rowToTeam(row);
          const p = teamProgress(t);
          summary.teams++;
          summary.members += t.members.length;
          if (p.status === 'concluida') summary.finished++;
          else if (p.status === 'andamento') summary.inProgress++;
          else summary.empty++;
          return {
            name: t.name, grade: t.grade, members: t.members,
            maxMembers: MAX_MEMBERS[g] || 5,
            topic: t.topic ? t.topic.topic : "",
            selectedTitle: t.selectedTitle,
            finished: t.finished,
            progress: p.progress, status: p.status,
            docChars: p.docChars, aiCount: p.aiCount, chatCount: p.chatCount,
            updatedAt: t.updatedAt
          };
        });
      return { grade: g, name: `${g}º Ano`, teams };
    });
    res.json({ summary, grades });
  } catch (error) {
    console.error('GET admin overview:', error);
    res.status(500).json({ error: 'Não foi possível carregar o painel.' });
  }
});

// Detalhe protegido de uma equipe: trabalho salvo, chat e interações com a IA
app.get('/api/admin/team/:grade/:teamName', requireAdmin, async (req, res) => {
  try {
    const team = await findTeam(req.params.grade, req.params.teamName);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    res.json({ team, progress: teamProgress(team) });
  } catch (error) {
    console.error('GET admin team:', error);
    res.status(500).json({ error: 'Não foi possível carregar a equipe.' });
  }
});

initializeDatabase()
  .then(() => server.listen(PORT, () => console.log(`Jornada Matemática rodando na porta ${PORT}`)))
  .catch(error => {
    console.error('Falha ao inicializar PostgreSQL:', error);
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  await pool.end().catch(() => {});
  process.exit(0);
});
