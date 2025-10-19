# SimpleShare - Bun + Docker

Sistema minimalista de upload/compartilhamento usando Bun + Docker, zero bibliotecas externas.

> **⚠️ Projeto Educacional**: Este projeto foi criado para aprender e experimentar com Bun, Docker e prompts replicáveis para IA. **Não segue melhores práticas de produção** (segurança, escalabilidade, etc). Use apenas para estudos e ambientes pessoais.

## 🤖 Experimento de Prompt Replicável

Este projeto foi gerado de um prompt estruturado (`PROMPT.md`). Você pode tentar replicar o resultado usando o mesmo prompt em sua IA favorita (ChatGPT, Claude, Gemini, etc) e comparar os resultados!

## 🚀 Quick Start

```bash
# 1. Configurar senha no docker-compose.yml
vim docker-compose.yml  # Alterar PASSWORD

# 2. Iniciar
docker compose up -d

# 3. Acessar
http://localhost:8081  # ou porta 80/443 se SSL configurado
```

## 📁 Estrutura

```
project/
├── docker-compose.yml  # Config Docker
├── server.js          # Backend Bun
├── index.html         # Frontend PetiteVue
├── data/
│   ├── uploads/       # Arquivos enviados
│   └── texts/         # Textos salvos
│       └── .meta.json # Metadata (público/privado)
└── ssl/              # Certificados SSL (se existir)
```

## 🔐 Autenticação

- Senha definida em `docker-compose.yml` (`PASSWORD`)
- Sessão por cookie `sid` (30 minutos)
- Valida IP e User-Agent

## 🌐 Portas e SSL

O sistema detecta automaticamente:

1. **Porta 80 ocupada?** → Usa porta 8081 (sem SSL)
2. **Certificados existem?** (`/ssl/*.pem`) → Usa porta 443 (SSL)
3. **Certbot disponível?** (com DOMAIN/EMAIL) → Tenta obter SSL → porta 443 ou 80

## 📝 Rotas API

### Públicas
- `GET /` → Interface web
- `POST /login` → Login (retorna cookie)
- `GET /txt/:name` → Lê texto público

### Autenticadas
- `POST /upload` → Upload arquivo (max 50MB)
- `GET /files` → Lista arquivos
- `GET /files/:name` → Download arquivo
- `DELETE /files/:name` → Deleta arquivo
- `POST /txt/:name` → Salva texto (JSON: `{content, open}`)
- `GET /txt/:name` → Lê texto
- `GET /txts` → Lista textos
- `DELETE /txt/:name` → Deleta texto

## 🛠️ Comandos

```bash
# Ver logs
docker compose logs -f

# Reiniciar
docker compose restart

# Parar
docker compose down

# Atualizar código (sem perder dados)
docker compose down && docker compose up -d
```

## 🐛 Troubleshooting

### Erro "Unauthorized" após mudar senha
```bash
docker compose down && docker compose up -d
```

### Ver arquivos salvos
```bash
ls -lh data/uploads/
ls -lh data/texts/
```

## 📦 Tecnologias

- **Runtime**: Bun (JavaScript)
- **Container**: Docker + Alpine Linux
- **Frontend**: PetiteVue (reatividade)
- **SSL**: Certbot (Let's Encrypt)

## 📄 Licença

MIT
