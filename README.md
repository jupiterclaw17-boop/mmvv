# 🎵 MMVV — Sistema de Gestão de Ministério de Louvor

Sistema web para gerenciamento de multitracks, escalas de culto, equipes e membros de um ministério de louvor.

## 📋 Funcionalidades

### 🎶 Multitracks
- Cadastro de multitracks vinculadas a músicas e artistas
- Upload de arquivos de áudio (armazenamento via Supabase Storage)
- Link para versão no YouTube com player embutido (modal)
- Busca por artista e música
- Tom (key) e BPM da multitrack

### 📅 Escalas (Cultos)
- Criação de escalas com data, período (Manhã/Tarde/Noite), equipe, ministro guia e DM
- Vinculação de músicas com tom específico para cada culto
- Indicador visual de multitrack disponível com download direto
- Visualização detalhada em modal com download de multitracks
- Filtro por mês/ano
- Registro de observações

### 👥 Equipes
- Cadastro e gerenciamento de equipes do ministério
- Vinculação de ministro guia responsável
- Status ativo/inativo

### 🔐 Usuários
- Gerenciamento de membros com perfis (nome, email, equipe)
- Sistema de roles: **Admin**, **DM** (Diretor Musical), **Ministro Guia**
- Controle de acesso baseado em roles (RLS no Supabase)
- Criação de usuários via Edge Function (`manage-user`)

### 📝 Logs de Auditoria
- Registro automático de ações (criar, editar, deletar)
- Visível apenas para administradores
- Rastreamento de quem fez o quê e quando

## 🏗️ Arquitetura

### Stack Tecnológica
| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | Tailwind CSS + shadcn/ui |
| **Roteamento** | React Router DOM v6 |
| **Estado** | React Query (TanStack) |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| **Autenticação** | Supabase Auth com RLS (Row Level Security) |

### Estrutura de Pastas

```
src/
├── components/
│   ├── layout/          # AppLayout, AppSidebar, ProtectedRoute
│   ├── shared/          # Autocompletes reutilizáveis (Artista, Música)
│   └── ui/              # Componentes shadcn/ui
├── context/
│   └── AuthContext.tsx   # Contexto de autenticação e perfil do usuário
├── hooks/               # Hooks customizados
├── integrations/
│   └── supabase/        # Cliente Supabase e tipos gerados
├── lib/                 # Utilitários (supabase client, utils)
├── pages/               # Páginas da aplicação
│   ├── Escalas.tsx      # Listagem de escalas
│   ├── EscalaForm.tsx   # Formulário de criação/edição de escala
│   ├── Multitracks.tsx  # Listagem de multitracks
│   ├── MultitrackForm.tsx # Formulário de multitrack
│   ├── Equipes.tsx      # Listagem de equipes
│   ├── EquipeForm.tsx   # Formulário de equipe
│   ├── Usuarios.tsx     # Listagem de usuários
│   ├── UsuarioForm.tsx  # Formulário de usuário
│   ├── Logs.tsx         # Logs de auditoria
│   ├── Login.tsx        # Tela de login
│   └── Index.tsx        # Página inicial (redirect)
├── services/            # Serviços (logs, storage)
└── utils/               # Constantes (tons, períodos)

supabase/
├── config.toml          # Configuração do projeto Supabase
├── functions/
│   └── manage-user/     # Edge Function para criação de usuários
└── migrations/          # Migrações SQL do banco de dados
```

### Modelo de Dados

```
artists ──────── songs ──────── multitracks
                    │
                    └──── service_songs ──── services ──── teams
                                                │
                                          users_profiles
                                                │
                                           user_roles
```

| Tabela | Descrição |
|--------|-----------|
| `artists` | Artistas/bandas |
| `songs` | Músicas vinculadas a artistas |
| `multitracks` | Arquivos de multitrack com tom, BPM, URL do YouTube |
| `services` | Cultos/escalas com data, período, equipe |
| `service_songs` | Músicas de cada culto com tom específico |
| `teams` | Equipes do ministério |
| `users_profiles` | Perfis dos membros |
| `user_roles` | Roles dos usuários (admin, dm, ministro_guia) |
| `logs` | Auditoria de ações |

### Controle de Acesso (Roles)

| Ação | Admin | DM | Ministro Guia |
|------|:-----:|:--:|:-------------:|
| Ver multitracks/escalas | ✅ | ✅ | ✅ |
| Criar/editar multitracks | ✅ | ✅ | ❌ |
| Criar/editar escalas | ✅ | ✅ | ❌ |
| Gerenciar equipes | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Ver logs | ✅ | ❌ | ❌ |
| Deletar escalas | ✅ | ❌ | ❌ |

## 🚀 Setup Local

### Pré-requisitos
- Node.js 18+ (recomendado instalar via [nvm](https://github.com/nvm-sh/nvm))
- Conta no [Supabase](https://supabase.com) com projeto configurado

### Instalação

```sh
# 1. Clone o repositório
git clone <URL_DO_REPOSITORIO>
cd <NOME_DO_PROJETO>

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
# O arquivo .env já contém as variáveis do Supabase:
# VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

### Deploy

O deploy pode ser feito diretamente pelo Lovable clicando em **Share → Publish**.

### Storage Provider (Supabase ou TeraBox)

A aplicação usa uma camada de abstração (`storageService`) para permitir troca de provider.

- `VITE_STORAGE_PROVIDER="supabase"` (padrão)
- `VITE_STORAGE_PROVIDER="terabox"` (modo teste)

#### TeraBox (modo teste)

Quando `VITE_STORAGE_PROVIDER="terabox"`, há dois modos de upload:

1. **Uploader externo (VPS) - recomendado para arquivos grandes**
   - `VITE_TERABOX_UPLOADER_URL`
   - `VITE_TERABOX_UPLOADER_TOKEN`

2. **Rotas serverless em `/api/terabox/*` (legado)**
   - `TERABOX_NDUS`
   - `TERABOX_JS_TOKEN`
   - `TERABOX_APP_ID` (geralmente `250528`)
   - `TERABOX_BDSTOKEN` (opcional)
   - `TERABOX_BROWSER_ID` (opcional)

> Observação: o modo serverless legado usa base64 e pode limitar uploads grandes no plano free. Para ZIPs maiores, use o uploader externo no VPS.

## 📌 Status Atual do Projeto (checkpoint)

> **Branch de trabalho atual:** `feat/terabox-storage-mvp`  
> **Main não foi alterada** durante estes testes.

### O que foi implementado nesta fase

1. **Provider de storage por configuração**
   - Arquivo: `src/services/storageService.ts`
   - `VITE_STORAGE_PROVIDER` define o provider ativo (`supabase` ou `terabox`).

2. **Integração inicial TeraBox via rotas serverless**
   - Arquivos: `api/terabox/upload.js` e `api/terabox/delete.js`
   - Objetivo: MVP rápido para validar fluxo.
   - Limitação encontrada: payload base64 em serverless (erro com arquivos maiores).

3. **Correções de UX/validação de upload**
   - Arquivo: `src/pages/MultitrackForm.tsx`
   - Aceite por extensão (`.zip`, `.mp3`, `.wav`, `.m4a`) além de MIME.

4. **Integração com uploader externo (VPS/EasyPanel) para arquivos grandes**
   - Arquivo: `src/services/storage/teraboxStorageService.ts`
   - Nova lógica: quando `VITE_TERABOX_UPLOADER_URL` está configurado, upload é feito via `FormData` para uploader externo.
   - Fallback legado (base64/serverless) permanece apenas para compatibilidade.

### Repositório auxiliar criado para upload externo

- Repo: `jupiterclaw17-boop/terabox-uploader`
- Papel: receber arquivos grandes no VPS e enviar ao TeraBox sem limite do serverless da Vercel free.

#### Responsabilidades do `terabox-uploader`

- `POST /upload`
  - recebe multipart (`file`)
  - envia ao TeraBox
  - retorna URL de download e path salvo
- `GET /health`
  - healthcheck de disponibilidade

#### Ajustes aplicados no uploader

- inclusão de `package-lock.json` para suportar `npm ci`
- preservação de **nome/extensão original** no upload
- estratégia de URL de download:
  - tenta link direto válido primeiro
  - usa share URL como fallback

### Variáveis de ambiente usadas no app (branch de teste)

- `VITE_STORAGE_PROVIDER=terabox`
- `VITE_TERABOX_UPLOADER_URL=<url do uploader VPS>`
- `VITE_TERABOX_UPLOADER_TOKEN=<token do uploader>`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Limitações e comportamento atual

- Upload de arquivos grandes agora funciona via uploader VPS.
- Download pode abrir página intermediária do TeraBox quando link direto não for validado.
- Fluxo está funcional para piloto, mas ainda requer validação adicional de UX e estabilidade.

### Próximos passos sugeridos (antes de merge)

1. validar lote maior de uploads e downloads em produção de teste
2. revisar segurança de token no frontend (`VITE_TERABOX_UPLOADER_TOKEN`)
3. considerar proxy/autorização server-side para não expor token no cliente
4. validar exclusão/edição de multitrack ponta a ponta
5. só então abrir PR de `feat/terabox-storage-mvp` para `main`

## 🔒 Melhorias de Segurança (Pós-MVP)

Itens identificados para implementar após a fase de apresentação:

| # | Item | Dificuldade | Descrição |
|---|------|:-----------:|-----------|
| 1 | **Bucket privado + Signed URLs** | Média | Tornar o bucket `multitracks` privado e usar `createSignedUrl()` no lugar de `getPublicUrl()` para evitar acesso não autenticado aos arquivos. |
| 2 | **CORS restrito na Edge Function** | Fácil | Substituir `Access-Control-Allow-Origin: *` pelo domínio de produção na função `manage-user`. |
| 3 | **Validação server-side de uploads** | Média | Adicionar validação de tipo/tamanho de arquivo via políticas de storage ou edge function de pré-upload. |
| 4 | **Leaked password protection** | Fácil | Ativar a proteção contra senhas vazadas no painel do Supabase Auth. |
| 5 | **Testes de RLS** | Média | Criar testes automatizados para verificar que as políticas RLS bloqueiam acessos não autorizados. |

> **Nota:** Os checks client-side de role (`canWrite`, `ProtectedRoute`) são apenas para UX — toda segurança real é garantida por RLS no banco de dados.

## 📄 Licença

Projeto privado — uso interno do ministério.
