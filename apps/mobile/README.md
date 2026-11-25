# Bomba Certa — app mobile (Expo)

Mapa de preços de combustível em Palmas-TO, reporte rápido e alertas com push notification.

Stack: Expo SDK 58, expo-router, `react-native-maps`, TanStack Query, `expo-secure-store`,
`expo-notifications`. Validação e formatação vêm de `packages/shared` (mesmos schemas Zod da API e do web).

## Rodando

Pré-requisitos: API no ar (`pnpm db:up` na raiz, `pnpm --filter @bomba-certa/api start:dev`) e
`pnpm --filter @bomba-certa/shared build`.

```powershell
pnpm --filter @bomba-certa/mobile start
```

- **Emulador Android**: a API é acessada em `http://10.0.2.2:3000` (padrão).
- **Aparelho físico**: defina o IP do seu computador na rede local:
  `$env:EXPO_PUBLIC_API_URL = "http://192.168.0.10:3000"`.

### Variáveis de ambiente

| Variável              | Para quê                                                 |
| --------------------- | -------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | URL da API (padrão `http://10.0.2.2:3000`)               |
| `GOOGLE_MAPS_API_KEY` | Chave do Maps SDK for Android (tiles do mapa no Android) |
| `EAS_PROJECT_ID`      | ID do projeto EAS, necessário para obter o token de push |

## Push notifications — o que é preciso configurar

Push **não funciona no Expo Go (Android)** nem em emulador sem Google Play: use um _development build_
em um aparelho físico.

1. `pnpm dlx eas-cli login` e, dentro de `apps/mobile`, `eas init` (cria o projeto e informa o `projectId`).
2. Defina `EAS_PROJECT_ID` com esse id.
3. Android: crie um projeto no Firebase, baixe a credencial de serviço (FCM v1) e envie com
   `eas credentials`. iOS: requer conta Apple Developer paga.
4. `eas build --profile development --platform android` e instale o APK.
5. No app: aba **Conta → Ativar neste aparelho**. O token é registrado em `POST /devices`.

O servidor envia via Expo Push Service (`apps/api/src/alerts/expo-push.channel.ts`) e remove sozinho
tokens que o Expo marca como `DeviceNotRegistered`.

## Decisões

- **`react-native-maps`** no lugar do Leaflet (Leaflet depende de DOM).
- **Tokens no Keychain/Keystore** (`expo-secure-store`), ao contrário do `localStorage` do web.
- **Renovação de token única**: 401s concorrentes compartilham uma só chamada de refresh, porque o
  refresh token é de uso único (há teste em `src/lib/api.test.ts`).
- **Cores do mapa** por tercil dos preços visíveis (`computeBands`, em `packages/shared`).

## Verificação

```powershell
pnpm --filter @bomba-certa/mobile typecheck
pnpm --filter @bomba-certa/mobile test
pnpm --filter @bomba-certa/mobile export   # bundle do Metro: prova que o monorepo resolve
```

> O app ainda não foi executado em aparelho/emulador neste repositório: a verificação automatizada
> cobre tipos, testes do cliente e o bundle. Teste manualmente o mapa, o reporte e o push.
