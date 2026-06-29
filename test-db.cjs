process.env.TURSO_DATABASE_URL = 'libsql://fabmakers-db-rroda.aws-us-east-2.turso.io';
process.env.DATABASE_URL = 'file:./dev.db';

const { createClient } = require('@libsql/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const { PrismaClient } = require('@prisma/client');

const libsql = createClient({ url: process.env.TURSO_DATABASE_URL });
console.log('libsql criado');
const adapter = new PrismaLibSql(libsql);
console.log('adapter criado | adapterName:', adapter.adapterName, '| provider:', adapter.provider);

const prisma = new PrismaClient({ adapter });
console.log('PrismaClient criado com sucesso!');

prisma.user.count()
  .then(function(n) { console.log('CONECTADO AO TURSO! Total users:', n); process.exit(0); })
  .catch(function(e) { console.log('ERRO na query:', e.message); process.exit(1); });
