# Prompt Final - Sistema de Upload/Compartilhamento com Bun + Docker

## Objetivo
Sistema minimalista de upload/compartilhamento usando Bun + Docker, zero bibliotecas externas, **2 arquivos principais**.

- **Inicio**: Não tendo ./server.js ainda indica projeto novo, criar pasta copiando este (`.md`) como PROMPT.md para inicio do projeto lá.
- **Versionamento**: Sendo novo projeto, iniciar rep `git` na pasta do projeto. Realizar `git commit` após cada etapa significativa ou funcionalidade implementada, inclusive a primeira.
- **Documentação Viva**: Manter o novo `PROMPT.md` atualizado após edições importantes, mantendo sendo certeiro nas instruções novas curtas e diretas para possibilidade de replicação. Encaixando-as no lugar adequado.

## Estrutura final do projeto(após Docker, e BUN iniciar)
```
project/
├── docker-compose.yml
├── server.js
├── index.html
├── data/
│   ├── uploads/
│   └── texts/
│       └── .meta.json
└── ssl/ (se necessário conforme fluxo)
```

O bun deve criar as pastas se ainda não estiver criadas(e não quebrar se ja estiverem)

## Requisitos do Backend (Bun) - Arquivo único `server.js`

### 1. Inicialização (top-level await)

**Fluxo SSL/Porta:**
```
1. Porta 80 ocupada? (spawn: ss -tuln | grep ':80')
   → SIM: PORT=8081, SSL=false
   → NÃO: continua ↓
   
2. Certificados existem? (existsSync /ssl/*.pem)
   → SIM: PORT=443, SSL=true
   → NÃO: continua ↓
   
3. Certbot obtém SSL? (spawn certbot, copia para /ssl/)
   → SIM: PORT=443, SSL=true
   → NÃO: PORT=80, SSL=false
```

### 2. Autenticação
- **Login**: `POST /login`, password hardcoded no docker-compose, sessão de cookie `sid` (UUID) `HttpOnly`.
- **Cookie**: `sid=${sid}; HttpOnly; Path=/; Max-Age=1800; SameSite=Lax${SSL ? '; Secure' : ''}`
- **Verificação**: `GET /auth` retorna `200 OK` ou `401`, valida cookie no backend
- **Sessão**: `Map` em memória, valida `IP` e `User-Agent`. Expira em 30 minutos.
- **Frontend**: Ao carregar, primeiro tenta `GET /auth`. Se 200→authed, se 401→pede senha.

### 3. Rotas
- `GET /` → `index.html`
- `POST /login` → cria sessão, retorna cookie
- `GET /auth` → valida sessão existente (200/401)
- `POST /upload` → salva em `/data/uploads/` (max 50MB, multipart field `file`)
- `GET /files` → lista arquivos [{name, size}]
- `GET /files/:name` → download
- `DELETE /files/:name` → deleta arquivo
- `POST /txt/:name` → salva em `/data/texts/:name.txt` com JSON `{content, name, open?}`
- `GET /txt/:name` → retorna "txt". Se header `Accept: application/json` → JSON completo. Senão (browser) → `content` como plain text. Público se `open:1` no metadata.
- `GET /h/:name` → retorna txt público como `text/html` se `.html` no nome. Permite servir HTML públicos diretamente no browser.
- `GET /txts` → lista textos [{name, open}]
- `DELETE /txt/:name` → deleta texto
- Auth em todas exceto `/`, `/login`, textos públicos, `/h/:name`

### 4. Metadata textos públicos
- Arquivo `/data/texts/.meta.json`: `{[name]: {open: 1}}`
- Carregar no início, atualizar ao salvar texto com ou sem `open:1`

### 5. Sanitização (no backend)
- Regex: para rever nomes invalidos que podem bugar, ex: `name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)`
- Remove: `/\:*?"<>|`, `../`, `..\\`

### 6. SSL
- `Bun.serve({ tls: { cert: file(...), key: file(...) } })` se SSL=true

## Docker (docker-compose.yml)

- Imagem: `oven/bun:1-alpine`
- Command: `sh -c "apk add --no-cache iproute2 certbot && bun /app/server.js"`
- Env: `DOMAIN`, `EMAIL`, `PASSWORD` (hardcoded)
- `network_mode: host`

**Volumes (host↔container):**
```
./server.js → /app/server.js
./index.html → /app/index.html
./data/uploads → /data/uploads
./data/texts → /data/texts
./ssl → /ssl
```

## Estilo de código (Javascript do BUN, e do frontend no PetiteVue)
**Princípio**: Brevidade e eficiência mas sem **Sem minimificação**.
- Ternários em atribuições, aninhar 2-3 níveis se legível
- Short-circuit: `value || default`, `condition && execute()`, `obj?.prop ?? fallback`
- Destructuring inline: `const {ip, headers} = req`, entre outros
- Arrow sem chaves para retorno direto: `map(x => x * 2)`
- Template literals sobre concatenação
- Early return sem else desnecessário
- Comparações implícitas quando apropriado: `if (arr.length)`
- Encadear 2-3 métodos: `arr.filter().map()`
- Objetos shorthand: `{ip, ua}`
- Spread para merge/clone
- Regex inline, extrair const se complexo
- Funções auxiliares se reutilizado 2+ vezes
- Evitar variáveis intermediárias óbvias
- Top-level await para inicialização
- Resumindo o principio: Brevidade e eficiência sobre convenções tradicionais


## Frontend (index.html)

#### 1. Estrutura e Estilo Index.html
- **Framework**: `petite-vue` com reatividade concisa, via CDN: src="https://unpkg.com/petite-vue@0.4.1/dist/petite-vue.iife.js"
- **Escopo**: `<body v-scope @vue:mounted="init">` (vazio, sem objeto inline)
- **Inicialização**: `PetiteVue.createApp({...state e métodos}).mount()` no `<script>` final
- **Javascript**: O mesmo do Estilo de código usado no BUN.
- **Estilo HTML/CSS Compacto**:
    - **Atributos customizados**: `[BTN]`, `[FLEXR]` vs classes.
    - **Seletores**: `*[BTN]{...}`, `div[Hdr]>div{...}`.
    - **Nomes curtos**: `FLEXR`, `G5`, `CLK`.
    - **Atributos booleanos**: `[red]`, `[FLEX1]`.
    - **Classes**: Apenas para estados dinâmicos (`.actv`).
    - **CSS**: Compacto, sem espaços desnecessários.
    - **Hierarquia HTML**: Estruturar o HTML para minimizar CSS, aproveitando `>` e atributos combinados. E revisar quando necessário.
    - **Princípio**: Brevidade e eficiência sobre convenções tradicionais.

#### 2. Design System e UX
- **Estilo Visual**: Minimalista tipográfico, fonte monospace, contraste alto (#333/#fff), bordas sutis (#999), hover suave (0.2s), feedback visual imediato.
- **Botões**: Estilo unificado replicável via atributo `[btn]` - borda, padding, hover/active states, transições. Evitar inline styles exceto casos únicos.
- **Layout Horizontal**: Abas e controles lado a lado (flexbox), não empilhados. Aproveitar viewport height (`height:100%`, `flex:1`, `min-height:0`).
- **Espaçamento Simétrico**: Gap/padding consistentes (10px/15px), evitar margins isolados, usar flexbox gaps.
- **Navegação**: Abas principais topo: "📝 Txts" (padrão), "📁 Uploads". Sub-abas horizontais para textos individuais.
- **Aba Textos**: Abas horizontais, aba botão `+` que cira arquivo nome "new" e "new2/new3". Fetch header `Accept: application/json` para receber JSON completo.
- **Autenticação**: Valida sessão (`GET /auth`) antes de prompt. Loop até senha correta.
- **Feedback Save**: Progress bar 6px altura com preenchimento visual (interval 50ms), aba fica verde ao salvar, reseta após 500ms. A cada input reseta debounce E progress bar (width:0, restart interval).
- **URLs Públicos**: Quando txt é público (`open:1`), exibir links clicáveis para `/txt/:name` e `/h/:name` (se `.html`). Mostrar em div dedicada abaixo do textarea.

#### 3. Sintaxe PetiteVue e Reatividade Segura
- **CORRETO**: `<body v-scope>` + `PetiteVue.createApp({...}).mount()` no script
- **ERRADO**: `<body v-scope="{...}">` (causa erro de sintaxe no template)
- **Null-Safety em v-model**: Usar `:value` + `@input` com optional chaining quando objeto pode ser null: `:value="obj?.prop||''"` + `@input="obj && (obj.prop=$event.target.value,saveFunc())"`
- **Bindings Seguros**: Usar `obj?.prop` (não `obj.prop`) em `:class`, interpolações, quando objeto pode ser null durante render/delete
- **Delete Limpo**: Limpar timers (clearTimeout/clearInterval) antes de setar objeto como null, previne race conditions

## Troubleshooting

### Autenticação não funciona
- **Sintoma:** APIs retornam "Unauthorized" mesmo com senha correta
- **Causa:** Container não foi reiniciado após mudança de senha no docker-compose.yml
- **Solução:** `docker compose down && docker compose up -d`
