# Segurança

O projeto não armazena chaves reais no GitHub. Use `.env.local` apenas no desenvolvimento local e as Environment Variables da Vercel em produção. O arquivo `.env.example` contém somente placeholders.

O workflow `Security checks` executa, em cada push para `main` e pull request:

- verificação de segredos e arquivos de credenciais versionados;
- bloqueio de padrões comuns de execução remota perigosa;
- `npm audit` para vulnerabilidades altas ou críticas nas dependências de produção;
- verificação TypeScript.

A aplicação também envia cabeçalhos de segurança HTTP, incluindo HSTS, proteção contra MIME sniffing, clickjacking, isolamento de origem e uma política de permissões restritiva.

Nenhum verificador automático consegue provar que um site é absolutamente livre de malware. A garantia adequada combina revisão do código, dependências fixadas no lockfile, auditoria contínua, rotação de segredos e revisão humana dos workflows. O resultado verde deste workflow é uma evidência técnica limitada, não uma certificação de segurança.

Se uma credencial for exposta em chat, issue, log ou commit, revogue-a no provedor e gere outra. Nunca tente esconder uma chave em um arquivo do repositório: um arquivo dentro de um repositório privado ainda pode vazar por clone, backup, fork ou permissão incorreta.
