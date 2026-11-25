# Deploy gratuito: Render + Neon + Cloudflare Pages

```
Cloudflare Pages (web, estático)  ──HTTPS──►  Render (API NestJS, Docker)  ──►  Neon (PostgreSQL + PostGIS)
                                                       │
                                                       └──────────────────►  Render Key Value (Redis / BullMQ)
```

Custo: **R$ 0**. O preço é a hibernação e a efemeridade descritas em [Limitações](#limitações-do-plano-gratuito).
Os limites dos planos mudam com frequência: confirme nas páginas oficiais antes de depender deles.

> O repositório está **pronto** para este deploy (Dockerfile testado, Blueprint, workflow de keep-alive),
> mas nada foi publicado: criar contas e projetos nos provedores é com você. Os passos abaixo são na ordem certa.

## 1. Neon (PostgreSQL com PostGIS)

1. Crie um projeto em [neon.com](https://neon.com), de preferência na região mais próxima (ex.: `sa-east-1`).
2. Em **Connect**, copie **duas** strings de conexão do mesmo banco:
   - **Pooled** (host com `-pooler`): vai em `DATABASE_URL`. Acrescente `&pgbouncer=true&connection_limit=5&connect_timeout=15`.
   - **Direct** (sem `-pooler`): vai em `DIRECT_URL`. Só as migrations usam.
3. O PostGIS é habilitado pela própria migration (`CREATE EXTENSION postgis`) quando a API sobe. Se o Neon
   recusar por permissão, rode `CREATE EXTENSION postgis;` uma vez no SQL Editor.

Por que duas URLs? O pooler (PgBouncer) é o que absorve o _scale to zero_ do Neon sem derrubar as conexões
do Prisma, mas ele não consegue rodar migrations. O container usa `DIRECT_URL` só no `prisma migrate deploy`.

## 2. Render (API + Redis)

1. **New → Blueprint**, escolha este repositório. O [render.yaml](render.yaml) cria a API (`bomba-certa-api`,
   Docker, plano free) e o Key Value (`bomba-certa-redis`, free).
2. Preencha as variáveis marcadas `sync: false`:

   | Variável                  | Valor                                                                           |
   | ------------------------- | ------------------------------------------------------------------------------- |
   | `DATABASE_URL`            | string **pooled** do Neon (passo 1)                                             |
   | `DIRECT_URL`              | string **direct** do Neon                                                       |
   | `CORS_ORIGIN`             | URL do Cloudflare Pages (passo 4). Pode ficar para depois e redeployar          |
   | `ANP_DATASET_URL`         | vazio por enquanto (veja o passo 6)                                             |
   | `ANP_MATCH_RADIUS_METERS` | opcional, padrão 200: raio para casar revendas da ANP com postos já cadastrados |

   `REDIS_URL` é ligado automaticamente ao Key Value e `JWT_ACCESS_SECRET` é gerado pelo Render.

3. Confirme no Key Value que a política de memória é **`noeviction`** (o BullMQ exige; o Blueprint pede isso,
   mas confira no painel). Sem ela o BullMQ avisa no log ao iniciar.
4. Quando o deploy terminar, teste:

   ```powershell
   curl https://SEU-SERVICO.onrender.com/health
   curl https://SEU-SERVICO.onrender.com/health/ready   # {"status":"ok","checks":{"database":"up","redis":"up"}}
   ```

   A documentação interativa fica em `/docs`.

Se o painel rejeitar algum campo do Blueprint (ele não foi validado contra o Render), crie manualmente:
Web Service → Docker → `Dockerfile Path: apps/api/Dockerfile`, `Docker Build Context: .`, plano Free,
`Health Check Path: /health`, com as mesmas variáveis; e um Key Value Free.

### Dados de demonstração (opcional)

O seed apaga postos e preços e carrega os postos reais do OpenStreetMap (© OpenStreetMap contributors, ODbL) com preços **fictícios**. Ele **recusa rodar** em banco que não seja `localhost` sem confirmação explícita:

```powershell
$env:DATABASE_URL = "<string DIRECT do Neon>"
$env:SEED_CONFIRM = "yes"
pnpm --filter @bomba-certa/api seed
```

Use só no banco de demonstração. Os preços são fictícios.

## 3. Manter a API acordada

O serviço gratuito hiberna após 15 min sem tráfego (≈1 min para acordar). Hibernando, os **workers de alerta
param** e o **cron semanal não dispara**. O workflow [keep-alive.yml](.github/workflows/keep-alive.yml) faz
um ping em `/health` a cada 10 min:

1. No GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Nome `API_URL`, valor `https://SEU-SERVICO.onrender.com`.

Ressalvas: o cron do GitHub é _best effort_ e pode atrasar, então isso **reduz** a hibernação mas não a garante;
e o GitHub desativa workflows agendados após 60 dias sem atividade no repositório. Um serviço pago sempre ligado
é a solução definitiva. Um serviço rodando 24/7 consome ~744 h do total de ~750 h gratuitas por mês.

## 4. Cloudflare Pages (web)

1. **Workers & Pages → Create → Pages → Connect to Git**, escolha o repositório.
2. Configuração de build:

   | Campo                  | Valor                                                                    |
   | ---------------------- | ------------------------------------------------------------------------ |
   | Build command          | `pnpm install --frozen-lockfile && pnpm --filter @bomba-certa/web build` |
   | Build output directory | `apps/web/dist`                                                          |
   | Root directory         | `/` (raiz do repositório)                                                |

3. Variáveis de ambiente: `NODE_VERSION=22` e `VITE_API_URL=https://SEU-SERVICO.onrender.com`.
4. O fallback de SPA (`/stations/:id` abrindo direto) vem de [apps/web/public/\_redirects](apps/web/public/_redirects).
   O [\_headers](apps/web/public/_headers) garante que `sw.js`, `index.html` e o manifesto **nunca** fiquem em cache do navegador
   (senão usuários podem ficar presos numa versão antiga) e que `/assets/*` seja imutável. Como o app é um PWA, confira depois do
   deploy: DevTools → Application → Manifest/Service Workers, e um relatório PWA do Lighthouse. A API precisa liberar o domínio do
   Pages em `CORS_ORIGIN`, ou o Service Worker não consegue ler (nem cachear) as respostas.
5. Com a URL final (`https://….pages.dev`), volte ao Render e defina `CORS_ORIGIN` com ela. Redeploy.

O web importa os schemas Zod de `packages/shared` direto do código-fonte (alias do Vite): não há build extra.

## 5. Mobile

Aponte o app para a API publicada: `EXPO_PUBLIC_API_URL=https://SEU-SERVICO.onrender.com`. Push notifications
exigem projeto EAS, credencial FCM e _development build_: veja [apps/mobile/README.md](apps/mobile/README.md).

## 6. Importação da ANP

O link e o formato do arquivo semanal da ANP **não foram confirmados** durante o desenvolvimento (o parser
foi escrito contra o dicionário de dados oficial e um arquivo de exemplo fictício). Antes de ligar:

1. Localize o arquivo atual em [gov.br/anp → Dados abertos](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos)
   e confirme que **Palmas-TO** está nele (a pesquisa da ANP cobre uma amostra de municípios).
2. Teste localmente: baixe o arquivo e rode `pnpm --filter @bomba-certa/api anp:import -- --file=caminho.csv`.
   O resumo mostra linhas lidas, importadas e ignoradas. O geocoder (Nominatim) faz 1 requisição por segundo.
3. No Render: `ANP_DATASET_URL=<link>` e `ANP_IMPORT_ENABLED=true`. O job roda aos sábados 09:00 (fuso de Araguaína).

## Verificação pós-deploy

- [ ] `GET /health` e `GET /health/ready` respondem 200
- [ ] `GET /docs` abre o Swagger
- [ ] Cadastro e login funcionam no web (sem erro de CORS no console)
- [ ] `GET /stations/nearby?lat=-10.1844&lng=-48.3336&fuelType=GASOLINE_COMMON` devolve postos
- [ ] Reportar um preço atualiza o mapa
- [ ] Criar um alerta e reportar um preço abaixo do alvo gera uma notificação em `/notifications`

## Limitações do plano gratuito

| Componente         | Limitação                                              | Efeito                                           | Mitigação                                 |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------- |
| Render Web (free)  | Hiberna após 15 min sem tráfego; sem disco persistente | Primeira requisição ≈1 min; workers e cron param | Keep-alive; ou plano pago                 |
| Render Key Value   | Em memória, efêmero, 25 MB, 1 por workspace            | Jobs em voo podem se perder num restart          | Agendamento se recria sozinho a cada hora |
| Neon (free)        | Compute escala a zero em 5 min; 1 GB por projeto       | Primeira consulta após ociosidade mais lenta     | Conexão pooled + `connect_timeout`        |
| Eventos pós-commit | Enfileiramento é _best effort_                         | Se o Redis cair, o alerta atrasa (o preço salva) | Outbox transacional (evolução)            |

## Caminho de evolução

Quando o gratuito deixar de bastar: um VPS barato com Docker Compose (API + PostGIS + Redis + Caddy para HTTPS)
elimina a hibernação, mantém os dados e roda os workers 24/7 por poucos euros ao mês. A imagem da API já é a mesma.
