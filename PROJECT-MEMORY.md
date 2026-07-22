# Memória do projeto — FabMakers

> Ler no início; atualizar ao encerrar. Brain: `docs/brain/`. Foco: `.cursor/rules/fabmakers-focus.mdc`.

## Autonomia (permanente)
- **Sempre pode seguir** — permissão explícita do founder (2026-07-22).
- Não perguntar “posso continuar?” / “A ou B?”.
- Só acionar humano: secrets · risco alto · bloqueio sem caminho.

## Status atual
- **Status:** active
- **Última sessão:** 2026-07-22
- **Modo:** autonomia total
- **Foco:** D025 ops harden. Pronto para roteiro de teste (`e2e:all`).
- **Prod:** https://fabmakers.com.br

## Contas
- admin@ / admin123 · roda@ / 123 · designer@ / 123 · tech@ / 123
- Senhas + `ADMIN_API_SECRET`: `SECRETS.local.md` (gitignored)

## Teste
```bash
npm run e2e:all -- https://fabmakers.com.br
```
