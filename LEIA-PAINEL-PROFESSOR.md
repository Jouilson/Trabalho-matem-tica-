# Painel do Professor — instruções de deploy (app de Matemática com PostgreSQL)

## O que foi acrescentado (nada do código original foi alterado)

| Arquivo | Situação |
|---|---|
| `server.js` | **Mesmo arquivo do GitHub** + blocos novos no final (login, logout, `/api/admin/overview`, `/api/admin/team/...`). Todas as rotas dos alunos continuam iguais. |
| `public/professor.html` | **Novo** — página do tutor (login + visão geral + detalhes). |
| `gerar-hash-senha.js` | **Novo** — gera o hash seguro da senha. |
| `package.json` | **Não muda** — nenhuma dependência nova (o `crypto` já vem no Node; o `pg` já existe). |
| `public/index.html` | **Não muda** — a área dos alunos continua exatamente como está. |

## Passo a passo no Render / GitHub

1. **Suba os arquivos para o repositório conectado ao Render:**
   - substitua `server.js` pelo desta pasta;
   - adicione `public/professor.html` dentro da pasta `public/`;
   - adicione `gerar-hash-senha.js` na raiz.
2. **Gere o hash da senha do professor** (no seu computador, na pasta do projeto):
   ```bash
   node gerar-hash-senha.js "suaSenhaForte"
   ```
   Copie o valor `salt:hash` gerado.
3. **No Render** → seu Web Service → **Environment**, adicione a variável:
   - `ADMIN_CRED` = `salt:hash`
   - (a variável `DATABASE_URL` já existe e não precisa ser mexida)
4. Salve e aguarde o deploy automático.
5. Acesse:
   - Alunos: `https://seu-app.onrender.com/`
   - Professor: `https://seu-app.onrender.com/professor.html`

## O que o painel mostra

- Equipes dos 6º, 7º e 8º anos com nomes dos integrantes.
- Tema e título escolhido, trabalho salvo, barra de andamento.
- Dúvidas e interações com a IA, mensagens do chat da equipe.
- Selo ✅ Concluída nas equipes que enviaram o trabalho; filtros por situação.
- Atualização automática a cada 10 segundos.

## Segurança

- A senha é validada **no servidor**; o HTML só recebe o campo de senha.
- A senha fica armazenada como **hash scrypt com salt** na variável `ADMIN_CRED` — nunca no código, no HTML nem no GitHub.
- Existe uma única conta de professor; as rotas `/api/admin/*` só respondem após o login.
- Se a variável `ADMIN_CRED` não estiver definida, o login recusa qualquer senha (o painel fica inativo por segurança).
- A sessão do professor expira quando o servidor reinicia; basta entrar novamente.
