# ⛽ Bomba Certa

Mapa colaborativo de preços de combustível em **Palmas-TO**. Usuários reportam o preço nos postos, o app
mostra o mais barato perto de você e o histórico de cada posto. Uma importação semanal dos dados abertos da ANP
garante dados mesmo sem usuários, e alertas de preço avisam quando algum posto no seu raio ficar abaixo do valor que você definiu.

> Projeto de portfólio full stack, do banco ao deploy. Nome provisório.

|                                      Mapa (tema claro)                                       |                       Mapa (tema escuro)                        |
| :------------------------------------------------------------------------------------------: | :-------------------------------------------------------------: |
| ![Mapa com pinos por faixa de preço, legenda e lista ordenada](docs/screenshots/web-map.jpg) | ![Mesmo mapa no tema escuro](docs/screenshots/web-map-dark.jpg) |

|                                  Posto, histórico e reporte                                   |                                 Celular: bottom sheet                                  |
| :-------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------: |
| ![Página do posto com preços atuais e gráfico do histórico](docs/screenshots/web-station.jpg) | ![Mapa no celular com o posto selecionado na bandeja](docs/screenshots/web-mobile.jpg) |

> Os **preços** das imagens são **fictícios** (seed de desenvolvimento). Os postos do seed são reais, vindos do OpenStreetMap (veja _Fontes de dados_).
> O app Expo ainda não foi executado em aparelho neste repositório: o print mobile acima é o web em viewport de celular.

## Funcionalidades

- **Cadastro e login** com JWT de acesso curto + _refresh token_ rotativo com detecção de reuso
- **Postos** com localização (`geography(Point, 4326)`), bandeira e endereço
- **Reporte de preço** por combustível (gasolina comum, aditivada, etanol, diesel S10)
- **Busca por raio** com `ST_DWithin`, ordenada por preço ou distância, paginada
- **Mapa** com pinos por faixa de preço (barato, médio, caro) que usam **forma além da cor** (▼ ◆ ▲), _clustering_ que mostra a quantidade e o preço mais barato do grupo, e destaque para preço desatualizado
- **Página do posto** com histórico de preços (Recharts)
- **Tema claro e escuro**, _bottom sheet_ no celular, estados de carregamento (skeleton), erro (com "tentar novamente") e vazio, e toasts
- **Acessibilidade verificada em três camadas** (veja "Front-end"): contraste WCAG medido nos tokens, `axe-core` nas telas e axe em navegador real
- **Storybook** com os átomos, moléculas e organismos nos dois temas e o painel de acessibilidade
- **PWA instalável e com modo offline**: botão "Instalar", aviso de nova versão (o usuário escolhe quando atualizar) e faixa "você está offline". Sem rede, o app abre e mostra os últimos postos, preços, gráficos e tiles do mapa vistos
- **Importação semanal da ANP** por job agendado no BullMQ, filtrada por Palmas
- **Alertas de preço** processados em fila, com notificação in-app, e-mail e push (Expo). No web: página **Alertas** (criar, listar, excluir com "desfazer"), caixa de notificações e um **sino** no cabeçalho com contagem de não lidas e toast quando um alerta dispara
- **Confirmação de reportes** com o botão só para quem pode usá-lo: a API informa `isMine` e `confirmedByMe` (autenticação opcional; o id do autor nunca é exposto)
- **Mobile (Expo)** com mapa, reporte rápido, alertas e push notifications

### Regras de negócio

| Regra                                                                                              | Como é feita                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O preço exibido é o reporte mais recente com no máximo 7 dias; mais antigo aparece "desatualizado" | `station_current_prices` + flag `stale` calculada na resposta                                                                                                                        |
| Reporte fora da faixa plausível fica pendente                                                      | Mediana da cidade ±15% (configurável), referência da **ANP** primeiro; fora da faixa vira `PENDING`                                                                                  |
| Outros usuários podem confirmar; confirmados têm mais peso                                         | 2 confirmações de usuários diferentes (nunca o autor) tiram o reporte de `PENDING`. **O "peso" é só esse portão**: não há ponderação entre reportes já ativos (o mais recente vence) |
| Um reporte por usuário, posto e combustível a cada 6 horas                                         | Checagem no serviço sobre índice `(user, posto, combustível, data)`; responde 429                                                                                                    |
| Dados da ANP e dos usuários marcados com a origem                                                  | Enum `PriceSource` (`USER` \| `ANP`) em postos e reportes                                                                                                                            |

## Arquitetura

```mermaid
flowchart LR
  subgraph Clientes
    W["Web<br/>React + Leaflet"]
    M["Mobile<br/>Expo + react-native-maps"]
  end

  subgraph API["API NestJS"]
    direction TB
    AUTH[auth / users]
    ST[stations]
    PR[prices]
    AL[alerts]
    ANP[anp-import]
    HE[health]
  end

  PG[("PostgreSQL<br/>+ PostGIS")]
  RD[("Redis")]
  BQ{{"BullMQ<br/>filas: alerts, anp-import"}}
  EXT_ANP[/"Dados abertos<br/>da ANP"/]
  GEO[/"Nominatim<br/>geocoding"/]
  EXPO[/"Expo Push"/]
  SMTP[/"SMTP"/]

  W -- "REST + JWT" --> API
  M -- "REST + JWT" --> API
  AUTH & ST & PR & AL --> PG
  PR -- "preço mudou" --> BQ
  ANP -- "preço mudou" --> BQ
  BQ <--> RD
  BQ -- "worker alerts" --> AL
  AL -- "notifica" --> EXPO
  AL --> SMTP
  BQ -- "cron semanal" --> ANP
  ANP --> EXT_ANP
  ANP --> GEO
```

Monorepo **pnpm workspaces**:

```
apps/
  api/        NestJS 11 · Prisma · PostgreSQL/PostGIS · BullMQ · Swagger
  web/        React 19 · Vite · Tailwind 4 · TanStack Query · Leaflet + markercluster · Recharts
  mobile/     Expo SDK 58 · expo-router · react-native-maps · expo-notifications
packages/
  shared/     Schemas Zod, tipos da API, formatadores e faixas de preço (usado por todos)
```

## Como rodar localmente

Pré-requisitos: **Node 22+**, **pnpm 11** (`corepack enable`) e **Docker**.

```powershell
pnpm install
Copy-Item .env.example .env
Copy-Item .env.example apps/api/.env
docker compose up -d            # PostGIS, Redis e Mailpit
pnpm --filter @bomba-certa/shared build
pnpm --filter @bomba-certa/api prisma:deploy
pnpm --filter @bomba-certa/api seed     # postos reais (OpenStreetMap) com preços fictícios
```

Defina `JWT_ACCESS_SECRET` (32+ caracteres) no `.env` e no `apps/api/.env`. Depois, em dois terminais:

```powershell
pnpm --filter @bomba-certa/api start:dev   # API em http://localhost:3000  (Swagger em /docs)
pnpm --filter @bomba-certa/web dev         # Web em http://localhost:5173
```

Portas do Docker Compose: PostgreSQL **5440** (evita conflito com um Postgres local), Redis 6379, Mailpit UI 8026.
Para o app mobile, veja [apps/mobile/README.md](apps/mobile/README.md).

### Testes e qualidade

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm --filter @bomba-certa/shared test      # 9
pnpm --filter @bomba-certa/api test         # 57 unitários
pnpm --filter @bomba-certa/api test:e2e     # 30, contra PostgreSQL/PostGIS e Redis reais
pnpm --filter @bomba-certa/web test         # 161 (inclui contraste dos tokens e axe)
pnpm --filter @bomba-certa/web storybook    # catálogo de componentes em http://localhost:6006
pnpm --filter @bomba-certa/mobile test      # 5
```

O GitHub Actions ([ci.yml](.github/workflows/ci.yml)) roda lint, formatação, typecheck, todos os testes (com serviços
`postgis/postgis` e Redis), o build do web e do Storybook, o bundle do mobile e o build da imagem Docker.

## Decisões técnicas

**Geoespacial**

- Coluna `geography(Point, 4326)` com índice **GIST**. A busca usa `ST_DWithin(location, ponto, metros)`, que usa o
  índice (um `ST_Distance(...) < r` no `WHERE` não usaria) e devolve distâncias em metros pelo esferoide.
- `ST_MakePoint(lng, lat)`: x vem antes de y, o oposto de como se fala "lat, lng". Isso está comentado onde importa.
- O Prisma não lê `geography`: o campo é `Unsupported(...)` e as consultas espaciais são `$queryRaw`. O índice GIST sai na
  migration; os índices parciais ficam em SQL manual (o Prisma os ignora sem gerar _drift_).
- Alertas guardam o **centro** do alerta como `geography`: um preço novo é cruzado com todos os alertas por
  `ST_DWithin(alerta.centro, posto.localizacao, alerta.raio)` numa só consulta indexada.

**Dados**

- Preço em **inteiro de milésimos** (R$ 5,899 → `5899`): sem erro de ponto flutuante.
- `station_current_prices` **denormalizada**: a busca por raio ordenada por preço faz um `JOIN`, em vez de um
  `DISTINCT ON` sobre todo o histórico. É atualizada com um único `INSERT … ON CONFLICT … WHERE reported_at <= …`,
  atômico, para que um reporte antigo ativado tarde ou uma linha da ANP nunca sobrescrevam um preço mais novo.
- Importação da ANP **idempotente** por índice único parcial `(posto, combustível, data) WHERE source = 'ANP'`.
- Referência de plausibilidade pela **mediana** (resistente a um valor absurdo) e priorizando a **ANP**, para que um grupo
  de reportes falsos não desloque a referência. Com poucas amostras, nada é julgado.

**Autenticação**

- _Refresh token_ opaco, guardado só como **hash**, de uso único e rotativo. Reapresentar um token já usado revoga a
  família inteira (sinal de roubo). A rotação é um `UPDATE … WHERE revoked_at IS NULL`, então só uma requisição concorrente vence.
- Mesma mensagem para e-mail inexistente e senha errada. _Rate limit_ mais rígido nas rotas de auth.
- No web os tokens ficam no `localStorage` (simples, mas expostos a XSS; a evolução é um cookie `httpOnly`).
  No mobile, no Keychain/Keystore (`expo-secure-store`).

**Filas (BullMQ)**

- _Claim-then-notify_: o `UPDATE … WHERE last_notified_at IS NULL` é o trava. Dois workers (ou um retry) nunca notificam
  duas vezes; se a entrega falha, a trava é liberada e o job tenta de novo.
- Alerta **rearma** sozinho quando nenhum posto no raio está no alvo ou abaixo (sem spam enquanto o preço fica baixo).
- Sem `jobId` por posto: deduplicar descartaria um evento que chega durante um job ativo, que já leu o preço antigo. Os jobs
  são idempotentes, então jobs a mais são inofensivos. (O BullMQ também proíbe `:` em `jobId`; um e2e pegou isso.)
- O agendamento semanal (`upsertJobScheduler`) é idempotente e **se recria a cada hora**, porque um Redis efêmero pode esquecê-lo.
- O in-app é a fonte da verdade (falha → retry); e-mail e push são _best effort_ atrás da interface `NotificationChannel`.

**Front-end (web)**

- **Design tokens** em CSS (`--background`, `--primary`, `--band-cheap`...) mapeados com `@theme inline` do Tailwind 4: os componentes só
  usam nomes semânticos, então o tema escuro é só outro conjunto de valores (classe `.dark`, com script inline que evita o _flash_).
- **Atomic Design** (`atoms/molecules/organisms/templates`), variantes com `class-variance-authority` e `tailwind-merge`.
- **Acessibilidade**: a faixa de preço nunca depende só da cor (ícone + texto na lista, forma no pino); `aria-pressed` nos filtros,
  `aria-expanded` e `inert` no _bottom sheet_, foco visível, _skip link_ e respeito a `prefers-reduced-motion` (inclusive no gráfico).
- **Mapa com a API nativa do Leaflet**, não `react-leaflet`: o `leaflet.markercluster` não tem wrapper React, e criar/destruir o mapa em
  efeitos mantém seguro o duplo _mount_ do StrictMode. Os ícones são HTML gerado por funções puras e testadas (`lib/mapIcons.ts`).
  O tema escuro do mapa inverte os tiles por CSS, sem um segundo provedor.
- **`AsyncStateView`**: um só lugar para os quatro estados de dado remoto (carregando, erro com retry, vazio, sucesso).
- **PWA (`vite-plugin-pwa`, Workbox)**: o _shell_ é pré-cacheado e `registerType: 'prompt'` evita trocar a versão no meio de um reporte.
  Em runtime, **tiles** usam `CacheFirst` (limitado a 400, 7 dias, para ser um cliente educado do OSM) e as leituras **públicas** de postos
  usam `NetworkFirst` com _timeout_ de 4 s, o que também mostra o último dado enquanto uma API gratuita "acorda".
  O que pode ser cacheado é decidido por um arquivo só (`src/pwa/cache-rules.ts`), com testes que garantem que `pending-reports`,
  alertas, notificações e auth **nunca** entram no cache (evita mostrar dados de um usuário a outro num aparelho compartilhado).
- **React Query offline**: `networkMode: 'offlineFirst'` nas consultas (sem isso ele pausa offline e deixa o skeleton para sempre, mesmo
  havendo cache) e `'always'` nas mutações (falham rápido com "sem conexão" em vez de ficarem penduradas).
- O Service Worker só é gerado em produção (`devOptions.enabled: false`): cache em desenvolvimento só atrapalha. Os ícones PNG saem
  de `public/icon.svg` por `pnpm --filter @bomba-certa/web generate-pwa-assets` e são versionados, então o build não precisa do `sharp`.
- _Bottom sheet_ com altura **medida** (`ResizeObserver`), para a bandeja recolhida caber exatamente no conteúdo.

**Acessibilidade e documentação viva (Storybook)**

Três camadas, porque cada uma enxerga o que as outras não enxergam:

1. **Contraste dos tokens** (`src/lib/contrast.test.ts`): lê o `index.css` e aplica a fórmula WCAG a cada par de cores, nos dois temas
   (texto 4,5:1; borda de campo e foco 3:1). Ele pegou falhas reais na primeira execução: badges verdes/âmbar no tema claro
   (3,9 a 4,1:1) e a borda dos campos (1,5:1), já corrigidas escurecendo as cores e reforçando a borda.
2. **`axe-core` nas telas** (`src/test/a11y.test.tsx`): login, cadastro, alertas, posto, mapa (celular e desktop), cabeçalho, lista e _bottom
   sheet_, nos estados com dados, vazio, carregando e erro. Um teste garante que o helper **detecta** violações (para a suíte não passar
   vazia). O jsdom não calcula cores nem avalia regras de página inteira, por isso a camada seguinte existe.
3. **axe em navegador real**, com contraste de verdade, nas telas rodando (claro e escuro). Achou o que o jsdom não vê: faltava `<h1>` no
   mapa e na tela de alertas para visitante. Para repetir, injete `axe.min.js` pelo servidor de dev (`/@fs/…/axe-core/axe.min.js`) e rode `axe.run(document)`.

O **Storybook** (`pnpm --filter @bomba-certa/web storybook`) reaproveita o `index.css`, tem alternância claro/escuro na barra e o painel
de acessibilidade (o PWA fica de fora). Os dados de exemplo (`src/test/fixtures.ts`) são os mesmos dos testes. Telas que dependem
da API (alertas, notificações) são cobertas por testes, não por stories.

**Qualidade**

- Zod como **fonte única**: os mesmos schemas validam a API (`nestjs-zod`, que também gera o Swagger), o web e o mobile.
- Testes de integração contra **PostGIS e Redis reais**, não mocks: as consultas espaciais e as filas são justamente o que dá errado.
  Isso pegou falhas reais (por exemplo, `jobId` com `:` proibido pelo BullMQ, que derrubava os alertas em silêncio).
- Variáveis de ambiente validadas no boot (a aplicação se recusa a subir com ambiente inválido), logs estruturados com `pino`
  (cabeçalho `Authorization` mascarado), filtro global de erros e paginação.
- O seed recusa rodar contra banco remoto sem confirmação explícita.

## Deploy

Gratuito: **Render** (API + Redis) + **Neon** (PostgreSQL com PostGIS) + **Cloudflare Pages** (web). O repositório está pronto
(Dockerfile, [render.yaml](render.yaml), keep-alive), **mas nada foi publicado**. Passo a passo e limitações em [DEPLOY.md](DEPLOY.md).

## Fontes de dados

- **Postos (seed)**: _snapshot_ do OpenStreetMap para Palmas em `apps/api/prisma/data/palmas-osm-stations.json`, gerado por
  `pnpm --filter @bomba-certa/api osm:fetch` (Overpass API). Dados **© OpenStreetMap contributors**, licença [ODbL](https://www.openstreetmap.org/copyright).
  Postos entram com `source = OSM`, sem CNPJ, e bandeira/endereço "não informado" quando o OSM não os tem.
- **Preços do seed**: **fictícios** (fórmula em torno de valores típicos, atribuídos a um usuário "Seed Bot"). Preços reais vêm dos usuários e da ANP.
- **Importador ANP**: para cada revenda, procura por CNPJ; se não achar, geocodifica o endereço e busca postos **sem CNPJ** num raio
  (`ST_DWithin` em `geography`, em metros, usando o índice GIST) com bandeira compatível. Um único candidato claro recebe o CNPJ
  (e preenche só os campos "não informado"); vários candidatos equivalentes = ambíguo, ignorado; nenhum = posto novo (`source = ANP`).
  O resumo da execução informa `stationsMatched` e `stationsAmbiguous`.

## Limitações conhecidas e próximos passos

- **ANP**: testei com os arquivos reais de outubro/2026 (`dsan/2026/10-gasolina-etanol.csv` e `10-diesel-gnv.csv`): têm o formato esperado e
  **23 postos de Palmas** (em julho eram 3: o levantamento é uma amostra). O Nominatim **não geocodifica** os endereços por quadra da ANP
  (`QUADRA 406 NORTE AV NS 6`), então a localização falha em todos. Para não depender dela, o importador cai para o **nome**: casa quando todas as
  palavras distintivas do nome do posto no OSM aparecem na razão social da ANP e a bandeira é compatível. Resultado real: **3 de 23 casaram**
  (Disbrava, DLS, Petroshop); os outros têm razão social sem relação com o nome fantasia, ou não estão no OSM, e ficam de fora (nunca chutados).
  Cair para "só a rua" daria um ponto qualquer de uma avenida longa, por isso não foi feito. Na prática os preços de Palmas vêm sobretudo dos
  usuários; um geocodificador melhor ou um mapa CNPJ → coordenadas ampliaria a cobertura.
- **OpenStreetMap**: a cobertura de Palmas é pequena (21 postos úteis no _snapshot_; 17 de 38 elementos foram descartados por
  serem de aviação ou não terem nome nem bandeira). Nomes e bandeiras podem estar desatualizados, e a bandeira nunca é deduzida do nome.
- **Casamento ANP ↔ OSM**: em quarteirões com vários postos da mesma bandeira o caso é ambíguo e o posto é **ignorado e registrado**,
  nunca adivinhado: um pino duplicado é melhor que preço no posto errado. O endereço da ANP é geocodificado por rua, então o raio
  (`ANP_MATCH_RADIUS_METERS`, padrão 200 m) tolera essa imprecisão.
- **Mobile**: validado por typecheck, testes e _bundle_ do Metro, **não** em aparelho. Push exige projeto EAS e _development build_.
- Eventos de preço são publicados após o _commit_ (_best effort_): se o Redis cair, o preço é salvo mas o alerta atrasa. Um _outbox_ transacional resolveria.
- O mobile ainda não tem a lista de reportes pendentes (só o web), e o sino do web atualiza por _polling_ de 1 min (mais um _refetch_ logo após criar um alerta), não em tempo real: um WebSocket/SSE seria a evolução.
- Sem administração/moderação além das confirmações entre usuários. **Qualquer usuário logado pode cadastrar postos** (`POST /stations`),
  sem deduplicação (um posto igual ao da ANP vira duplicado) e só com o limite global de requisições: um ponto a endurecer antes de abrir ao público.
- `refresh_tokens` expirados e `notifications` antigas **nunca são removidos**: falta um job de limpeza (o BullMQ já está aí para isso).
- O limitador de requisições (`@nestjs/throttler`) guarda contadores em memória: com mais de uma instância da API eles não são compartilhados
  (a solução é o _storage_ em Redis).
- A checagem das 6 horas por usuário/posto/combustível é "ler e depois inserir": duas requisições simultâneas podem passar. É raro e de baixo
  impacto aqui; uma restrição única no banco resolveria.
- Headers de segurança: a API usa `helmet` e o web usa o `_headers` do Pages. Falta uma **Content-Security-Policy** no web (precisa da origem da API
  de produção e de um hash para o script inline do tema).
- Falta um `LICENSE` (a escolha é sua). O Dependabot semanal está configurado, mas o `pnpm audit` ainda não roda no CI. Depois de atualizar
  `nodemailer` e `csv-parse`, os avisos que restam exigem migrações maiores: `@prisma/client` 6 → 7 (`effect`, `deepmerge-ts`),
  `nestjs-zod`/`zod` 3 → 4 e `react-router-dom` 6 → 7, além de ferramentas de build do Expo (`minimatch`).
- No plano gratuito do Render a API hiberna (ver [DEPLOY.md](DEPLOY.md#limitações-do-plano-gratuito)).
