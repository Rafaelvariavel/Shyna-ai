# Segredos e configuração

Este repositório não deve conter chaves reais de APIs. Mesmo sendo privado, o GitHub não é um cofre adequado para credenciais permanentes. O arquivo `.env.example` contém somente nomes e placeholders.

## Desenvolvimento local

Copie o modelo para `.env.local` e preencha os valores:

```bash
cp .env.example .env.local
```

`.env.local` já está no `.gitignore` e não deve ser enviado ao GitHub.

## Produção na Vercel

Cadastre cada variável em **Project Settings → Environment Variables**, nos ambientes Production, Preview e Development conforme necessário. Nunca use o prefixo `NEXT_PUBLIC_` nas chaves de IA, banco ou sessão.

As variáveis mínimas são:

- `DATABASE_URL` ou `NEON`
- `SESSION_SECRET`
- `GROQ_API`
- `GROQ_MODEL`
- `GEMINI_API`
- `GEMINI_MODEL`

Para este projeto, os modelos padrão são `llama-3.1-8b-instant` para o chat Groq, por ser rápido para uso pessoal, e `gemini-3.5-flash` para classificação de imagens. O modelo Groq secundário também usa `llama-3.1-8b-instant`.

As integrações opcionais usam `GROQ2_API`, `GROQ2_MODEL`, `IDIOMAS_API`, `IDIOMAS_API_URL`, `IMAGENS_API` e `IMAGENS_API_URL`.

## GitHub Actions

Se for necessário usar uma chave em um workflow, salve-a em **Settings → Secrets and variables → Actions → New repository secret**. Referencie o nome no workflow com `${{ secrets.NOME_DA_CHAVE }}`; não escreva o valor diretamente em YAML, código ou logs.

## Rotação

Se uma chave aparecer em chat, issue, commit, log ou captura de tela, revogue-a no provedor e gere outra. O e-mail de uma conta de provedor não substitui uma chave de API nem um UID de design. Para a DynaPictures, `IMAGENS_API_URL` precisa apontar para um endpoint real e completo; um placeholder como `{id}` não deve ser publicado.
