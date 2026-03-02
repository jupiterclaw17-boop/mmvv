# HANDOFF — MMVV (Multitracks)

## Estado atual (checkpoint)

- **Branch ativa:** `feat/terabox-storage-mvp`
- **Main:** não alterada
- **README:** atualizado com arquitetura atual e decisões
- **Objetivo da fase:** validar upload/download de multitracks via TeraBox com suporte a arquivos grandes

---

## O que já está funcionando

1. Upload de arquivos grandes (ex.: 11MB, 60MB) via uploader externo no VPS
2. Integração do app com provider `terabox` via variável de ambiente
3. Deploy de preview funcionando na Vercel para testes de branch
4. Serviço `terabox-uploader` online no EasyPanel com endpoint de health

---

## Componentes e papel de cada um

## App principal (`praise-harmony-hub`)

- `src/services/storageService.ts`
  - seleciona provider por `VITE_STORAGE_PROVIDER`
- `src/services/storage/teraboxStorageService.ts`
  - upload no uploader externo (quando `VITE_TERABOX_UPLOADER_URL` existe)
  - fallback legado serverless/base64 para compatibilidade
- `src/pages/MultitrackForm.tsx`
  - valida extensão + MIME (corrigido para aceitar ZIP com MIME inconsistente)
- `api/terabox/*`
  - rotas legadas de MVP (base64), limitadas para arquivos grandes

## Uploader externo (`terabox-uploader`)

- Repo: `jupiterclaw17-boop/terabox-uploader`
- Endpoint:
  - `GET /health`
  - `POST /upload` (multipart)
- Responsável por enviar arquivo ao TeraBox fora do limite serverless da Vercel

---

## Variáveis de ambiente (app)

- `VITE_STORAGE_PROVIDER=terabox`
- `VITE_TERABOX_UPLOADER_URL=<url do uploader no easypanel>`
- `VITE_TERABOX_UPLOADER_TOKEN=<token de autenticação do uploader>`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## Variáveis de ambiente (uploader no VPS)

- `PORT=3000`
- `UPLOAD_API_TOKEN=<token>`
- `TERABOX_NDUS`
- `TERABOX_JS_TOKEN`
- `TERABOX_APP_ID=250528`
- `TERABOX_BDSTOKEN`
- `TERABOX_BROWSER_ID`

---

## Limitações conhecidas

1. Download nem sempre é direto: pode abrir página intermediária do TeraBox
2. `VITE_TERABOX_UPLOADER_TOKEN` expõe token no frontend (melhorar segurança antes de produção)
3. Links antigos salvos antes dos ajustes podem não refletir a estratégia atual de URL

---

## Próximos passos recomendados (antes de merge)

1. Testar lote maior de uploads/downloads (formatos e tamanhos diversos)
2. Validar edição/deleção de multitracks com arquivos no TeraBox
3. Melhorar segurança do token do uploader (assinar requests ou proxy server-side)
4. Revisar UX do botão de download (direto vs share)
5. Abrir PR de `feat/terabox-storage-mvp` para `main` somente após validação final

---

## Comandos úteis

```bash
# app principal
cd C:\Users\oliver\.openclaw\workspace\praise-harmony-hub
git checkout feat/terabox-storage-mvp
git pull
npx vercel --yes

# uploader externo
# (deploy via EasyPanel conectado ao repo GitHub)
```

---

## Nota de segurança

Após estabilizar em produção, rotacionar credenciais/tokens que circularam durante testes:
- `TERABOX_NDUS`
- `TERABOX_JS_TOKEN`
- `TERABOX_BDSTOKEN`
- `UPLOAD_API_TOKEN`
