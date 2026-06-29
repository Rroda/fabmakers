process.env.TURSO_DATABASE_URL = 'libsql://fabmakers-db-rroda.aws-us-east-2.turso.io';
// Sem token - deve dar 401 mas não URL_INVALID

const { PrismaLibSql } = require('@prisma/adapter-libsql');
const { PrismaClient } = require('@prisma/client');

// FORMA CORRETA: passa a config { url, authToken } não um client pronto
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL,
});

console.log('adapter criado:', adapter.adapterName, adapter.provider);

const prisma = new PrismaClient({ adapter });
console.log('PrismaClient criado!');

prisma.user.count()
  .then(function(n) { console.log('SUCESSO! Total users:', n); process.exit(0); })
  .catch(function(e) { console.log('RESULTADO:', e.message.slice(0, 200)); process.exit(e.message.includes('401') || e.message.includes('SERVER_ERROR') ? 0 : 1); });
