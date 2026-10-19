# Shyna AI — projeto para Vercel


Interface web de IA inspirada na referência visual enviada: tema escuro, barra lateral, busca e histórico de conversas, streaming de respostas, acesso direto sem login, preferências, termos e política de cookies.

## Estrutura compacta (5 pastas)

```text
shyna-ai-vercel/
├── app/                  # Interface e estilos
│   ├── [slug]/           # Termos e cookies em uma página dinâmica
│   └── api/
│       └── [...path]/    # Entrada única que distribui os endpoints
└── lib/                  # Identificador local, provedores e handlers de API
```

Os endpoints do app (`/api/chat`, `/api/images` etc.) são distribuídos por `app/api/[...path]/route.ts`; os handlers ficam diretamente em `lib/`. Não existem endpoints de login ou cadastro. As páginas `/terms` e `/cookies` compartilham `app/[slug]/page.tsx`.

## Funcionalidades

- Acesso direto, sem conta, senha ou sistema de login; um identificador aleatório do navegador separa os históricos por navegador.
- Chat Groq com resposta em streaming (SSE) e histórico no armazenamento local do navegador.
- Melhoria opcional de prompts de imagem via `GROQ2_API`.
- Classificação/descrição de imagens via Gemini (`GEMINI_API`).
- Classificação de idioma por API externa configurável.
- Geração de imagem por API externa configurável.
- Preferências de tema e melhoria de prompts salvas no armazenamento local do navegador.
- Exclusão individual ou limpeza de todas as conversas.
- Tratamento de erros, limites simples por usuário/IP, validação de entradas e limite de upload de imagem.
- Nenhuma chave de provedor é enviada deliberadamente ao navegador; variáveis secretas devem ser configuradas apenas no servidor.
- Layout responsivo para desktop e celular, sem bibliotecas de fontes externas, para reduzir chamadas externas.

## 1. Deploy no Vercel

1. Descompacte este ZIP e envie o diretório para um repositório GitHub.
2. No Vercel, escolha **Add New → Project** e importe esse repositório.
3. O Vercel detecta Next.js automaticamente. Use o comando padrão `npm run build`.
4. Em **Project → Settings → Environment Variables**, configure as variáveis necessárias (lista abaixo) nos ambientes desejados.
5. Faça um redeploy depois de salvar as variáveis.

Requisitos: Node.js 20.9 ou superior é recomendado. O pacote usa Next.js 16.4.2, versão estável indicada no momento da montagem. Não renomeie chaves privadas para `NEXT_PUBLIC_*`.

## 2. Variáveis de ambiente

| Variável | Para que serve | Obrigatória? |
|---|---|---|
| `GROQ_API` | Chave Groq para chat | Para chat |
| `GROQ2_API` | Chave Groq opcional para melhorar prompts de imagem | Opcional |
| `GEMINI_API` | Chave Google Gemini para classificar imagens | Para classificador |
| `GEMINI_MODEL` | Modelo Gemini disponível para sua chave; padrão no projeto `gemini-3.5-flash` | Opcional |
| `GROQ_MODEL` | Modelo habilitado na sua conta Groq | Opcional |
| `GROQ2_MODEL` | Modelo para a melhoria de prompt | Opcional |
| `IDIOMAS_API_URL` | URL completa do endpoint da sua API de classificação de idioma | Para idioma |
| `IDIOMAS_API` | Token/chave dessa API; também aceita uma URL completa em vez de URL + chave | Se exigido pelo endpoint |
| `IMAGENS_API_URL` | URL completa do endpoint da sua API de geração de imagens | Para geração |
| `IMAGENS_API` | Token/chave dessa API; também aceita uma URL completa em vez de URL + chave | Se exigido pelo endpoint |
| `APP_URL` | URL pública (informativa para a implantação futura) | Opcional |

### Histórico e preferências locais

Histórico de conversas e preferências são guardados no `localStorage` do navegador. O app não exige banco de dados e não envia conversas antigas para armazenamento remoto; o chat recebe apenas o contexto recente incluído na solicitação atual. Os dados podem desaparecer se o navegador for limpo ou se o usuário trocar de dispositivo.

### Groq

Pegue a chave no [Groq Console](https://console.groq.com/). O identificador do modelo muda conforme a disponibilidade e o plano da conta. Se o chat retornar erro de modelo, defina `GROQ_MODEL` para um ID ativo mostrado no endpoint de modelos/documentação da Groq.

### Gemini

Crie uma chave no [Google AI Studio](https://aistudio.google.com/). O endpoint usa `generateContent` para receber imagem e solicitar uma classificação/descrição em português. Confira se `GEMINI_MODEL` está liberado para sua chave e sua região.

## 3. Contratos das suas APIs personalizadas

Como você não informou URLs e formatos oficiais de resposta de suas APIs de idioma e imagens, o código usa contratos HTTP configuráveis. Ajuste os adaptadores em `lib/api-language.ts` e `lib/api-images.ts` se o seu serviço exigir outro formato.

### API de classificação de idioma

- Método: `POST` para `IDIOMAS_API_URL`.
- Cabeçalhos: `Content-Type: application/json`; quando `IDIOMAS_API` for token, ele é enviado em `Authorization: Bearer ...` e `x-api-key`.
- Corpo: `{"text":"texto para classificar"}`.
- Resposta sugerida: `{"language":"pt-BR","confidence":0.98}`. O app também reconhece `lang`, `label`, `prediction`, `result` e `data.language`.

### API de geração de imagens

- Método: `POST` para `IMAGENS_API_URL`.
- Cabeçalhos: `Content-Type: application/json`; quando `IMAGENS_API` for token, ele é enviado em `Authorization: Bearer ...` e `x-api-key`.
- Corpo: `{"prompt":"descrição da imagem"}`.
- Resposta recomendada: `{"url":"https://seu-servidor/imagens/resultado.png"}`.
- Também reconhece `image_url`, `imageUrl`, `output_url`, `result.url`, `data.url`, `data[0].url`, `images[0].url` e `b64_json`.
- Como o histórico fica no navegador, prefira devolver uma URL pública/assinada da imagem em vez de base64; imagens em base64 são exibidas somente na sessão atual. Respostas de job assíncrono (`job_id`, `task_id`) são detectadas, mas ainda exigem implementar o endpoint de consulta/polling específico do seu provedor.

### Melhoria de prompts

Se `GROQ2_API` estiver configurada, o app tenta aprimorar prompts de imagem preservando a intenção e o idioma. Se essa chamada falhar, usa o prompt original para não bloquear a geração. Pode ser ligada/desligada nas preferências. A melhoria extra pode aumentar a latência e consumir a cota Groq.

## 4. Desenvolvimento local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Preencha `.env.local` com chaves reais. Não publique `.env.local` nem faça commit dele. Para validar a produção localmente: `npm run build`.

## 5. Segurança e limitações importantes

- Não há login, senha ou cookie de autenticação. O identificador anônimo do navegador separa históricos, mas não substitui autenticação para dados confidenciais.
- Os limites em memória ajudam contra abuso casual, mas em funções serverless não são globais nem persistentes. Antes de um lançamento amplo, implemente rate limiting distribuído (por exemplo, via um serviço de limites dedicado), controles antiabuso e monitoramento de custo.
- Configure limites e orçamento nos painéis dos provedores. O protótipo não promete cotas gratuitas nem controla cobrança feita por serviços externos.
- As conversas enviadas a modelos externos são processadas por esses provedores. Revise suas políticas e não envie dados sensíveis.
- Termos e política de cookies são modelos técnicos iniciais, não aconselhamento jurídico. Atualize com identidade do controlador, contato, prazos de retenção e práticas reais antes de abrir ao público.
- O cookie de consentimento só distingue a escolha no aviso; não instala cookies publicitários. Se você adicionar Analytics, anúncios ou pixels, atualize o aviso, a política e a implementação de consentimento.

## 6. Verificação de compatibilidade das APIs

Este pacote não consegue validar as suas chaves privadas nem inventar o contrato real das APIs `IDIOMAS_API`/`IMAGENS_API`. Depois do deploy, teste cada recurso separadamente. Erros da API externa aparecem em linguagem simplificada no app; logs detalhados não devem conter chaves nem senhas.


## Créditos

Interface criada por **Studio Lite Supremo**.
