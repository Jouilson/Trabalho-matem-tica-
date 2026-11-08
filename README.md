# Jornada Matemática Colaborativa — Versão Online Completa

App originalmente em HTML/localStorage, transformado em aplicação full-stack com backend real.

## ✅ O que agora funciona de verdade

1. **Disponível na internet** — o app roda em um servidor web e pode ser acessado por qualquer pessoa pelo link.
2. **Equipes gravadas online** — tudo (membros, títulos, textos) é salvo no servidor em `data.json`, não mais no navegador. Alunos de dispositivos diferentes veem as mesmas equipes.
3. **Botão Salvar** — grava o texto no servidor (também salva automaticamente a cada 2 segundos). Você pode fechar e continuar de onde parou em outro computador.
4. **Chat entre membros da equipe** — bate-papo em tempo real via Socket.io; quem entra na mesma equipe recebe as mensagens na hora.
5. **Baixar PDF** — gera um arquivo PDF real (com título, equipe, tema e conteúdo) e baixa automaticamente.
6. **Enviar para o professor** — envia e-mail de verdade para `profjouilson@gmail.com` via FormSubmit (não abre apenas o cliente de e-mail).

## 🔗 Link ao vivo (temporário)

```
http://bore.pub:40072
```

> ⚠️ Este link fica no ar enquanto esta sessão estiver ativa. Para um endereço permanente, faça o deploy gratuito em 2 minutos (veja abaixo).

## 🚀 Deploy permanente (gratuito, em 2 minutos)

### Opção 1 — Render (mais fácil)
1. Crie uma conta grátis em https://render.com
2. Dê upload desta pasta (ou conecte um repositório GitHub)
3. Novo **Web Service**, comando de build: `npm install`, comando de start: `node server.js`
4. Pronto! Você ganha um endereço `https://seu-app.onrender.com` permanente.

### Opção 2 — Railway / Replit / Glitch
Qualquer hospedagem que rode Node.js funciona. Basta subir a pasta e rodar `npm install && node server.js`.

### Opção 3 — Rodar no seu próprio computador
```bash
npm install
node server.js
# abre http://localhost:3000
```

## 📧 Sobre o envio de e-mail ao professor

- O envio usa o **FormSubmit** (similar ao Formspree, mas **não precisa criar conta**).
- **Na primeira vez** que uma equipe enviar o trabalho, o professor receberá um e-mail da FormSubmit com um botão **"Activate Form"**. Ele deve clicar uma única vez.
- A partir daí, todos os trabalhos chegam direto na caixa de entrada do `profjouilson@gmail.com`.
- Se preferir usar Formspree mesmo: crie um formulário em formspree.io e troque a URL em `server.js` (linha do `fetch` para `https://formsubmit.co/ajax/...`).

## 📁 Estrutura

```
math-app/
├── server.js          # Backend: API + Socket.io + salvamento + e-mail
├── package.json
├── data.json          # Banco de dados (criado automaticamente)
└── public/
    └── index.html     # Frontend (seu app original, adaptado)
```

## 🛠️ Tecnologias
- **Node.js + Express** — servidor e API REST
- **Socket.io** — chat em tempo real e sincronia do documento
- **jsPDF + html2canvas** — geração real de PDF
- **FormSubmit** — envio de e-mail sem necessidade de SMTP/senha
