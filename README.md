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
