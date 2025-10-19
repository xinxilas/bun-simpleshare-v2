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
- **Verificação**: Validação `sid` retorna `200 OK`, `401` caso contrário.
- **Sessão**: `Map` em memória, valida `IP` e `User-Agent`. Expira em 30 minutos.

### 3. Rotas
- `GET /` → `index.html`
- `POST /login` → cria sessão
- `POST /upload` → salva em `/data/uploads/` (max 50MB, multipart field `file`)
- `GET /files` → lista arquivos [{name, size}]
- `GET /files/:name` → download
- `DELETE /files/:name` → deleta arquivo
- `POST /txt/:name` → salva em `/data/texts/:name.txt` com JSON `{content, open?}`
- `GET /txt/:name` → retorna texto (público se `open:1` no metadata)
- `GET /txts` → lista textos [{name, open}]
- `DELETE /txt/:name` → deleta texto
- Auth em todas exceto `/`, `/login`, textos públicos

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
- Sem minimificação.

## Frontend (index.html)

#### 1. Estrutura e Estilo Index.html
- **Framework**: `petite-vue` com reatividade concisa, via CDN: src="https://unpkg.com/petite-vue@0.4.1/dist/petite-vue.iife.js"
- **Escopo**: Lógica e estado num objeto no `v-scope` do `<body>`.
- **Inicialização**: `PetiteVue.createApp().mount()`.
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

#### 2. UI e UX front end
- **Estilo**: TXTs/notepad, bordas finas, pouca sombra, pouco arredondamento.
- **Navegação**: Abas principais no topo: "Uploads" e "Txts".
- **Aba Arquivos**: Grid de cards para listar arquivos (nome, tamanho, download e delete), um card para upload.
- **Aba Textos**: Abas para cada "arquivo", após a ultime um botão `+` para novo. Ao selecionar arquivo(aba), ter o nome, conteúdo(textbox), checkbox "público" e botão de delete
- **Autenticação**: prompt em loop até senha correta (sem página inicial). Implementar `authLoop()` com fetch POST para `/login`, headers JSON, body {password}, break no success.
- **Debounce Visual**: 1.5s na edição do texto(ou nome), barra de progresso sutil no bottom do textbox indicando o salvamento automático iminente.

## Troubleshooting

### Autenticação não funciona
- **Sintoma:** APIs retornam "Unauthorized" mesmo com senha correta
- **Causa:** Container não foi reiniciado após mudança de senha no docker-compose.yml
- **Solução:** `docker compose down && docker compose up -d`
