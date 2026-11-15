// Gerador de hash da senha do professor (painel /professor.html)
// Uso no terminal:  node gerar-hash-senha.js "minhaSenhaForte"
// Copie a linha gerada para o Render → Web Service → Environment → variável ADMIN_CRED
const crypto = require('crypto');

const senha = process.argv[2];
if (!senha) {
  console.log('Uso: node gerar-hash-senha.js "suaSenha"');
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(senha, salt, 64).toString('hex');

console.log('\nCole este valor no Render (Environment → ADMIN_CRED):\n');
console.log(`${salt}:${hash}\n`);
console.log('A senha em si nunca deve ser colocada no código nem no HTML.\n');
