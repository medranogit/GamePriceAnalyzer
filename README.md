# GamePriceAnalyzer

Aplicativo desktop (Windows) que fica em segundo plano monitorando sua **wishlist da Steam** e cruzando
os preços com o [GG.deals](https://gg.deals), pra avisar automaticamente quando alguma oferta ficar boa —
sem notificar de jogos que você já possui na Steam.

## Funcionalidades

- **Sincronização automática da wishlist** direto da Steam (via SteamID64, sem precisar de chave de API)
  — sem exportar/importar arquivo nenhum.
- **Sincronização da biblioteca Steam** (jogos já possuídos), usada só pra excluir das ofertas o que você
  já tem.
- **Cruzamento de preços** com o GG.deals: preço atual (loja oficial e keyshops) e menor preço histórico
  já registrado.
- **Notificações em background** (nativa do Windows + in-app) quando uma oferta atinge o desconto mínimo
  configurado, ou quando o preço atual iguala/supera o menor preço histórico do GG.deals.
- **Dashboard de ofertas** com filtro por desconto mínimo, faixa de preço, gênero, keyshops e busca por
  nome.
- **Página de wishlist** com atualização de preço sob demanda e histórico do menor preço já visto pelo
  próprio programa.
- **Histórico de eventos** (sincronizações, ofertas encontradas, etc.).
- Roda minimizado na bandeja do sistema, com opção de iniciar junto com o Windows.

## Stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) + React + TypeScript
- [AntDesign](https://ant.design/) (componentes) + [styled-components](https://styled-components.com/) (estilo customizado)
- [electron-builder](https://www.electron.build/) (empacotamento do instalador Windows/NSIS) + `electron-updater` (auto-update)
- [Vitest](https://vitest.dev/) (testes unitários)
- Arquitetura em camadas (Clean Architecture): `domain` (regras de negócio, puro) → `infrastructure`
  (clients HTTP, storage, Electron) → `renderer` (apresentação), conectados por um bridge de IPC
  (`preload` + `contextBridge`, sem `nodeIntegration`).

## APIs usadas

- **GG.deals Prices API** — preços e menor histórico por AppID da Steam (precisa de chave própria,
  gerada em [gg.deals/api](https://gg.deals/api/)).
- **Steam Web API** (`IPlayerService/GetOwnedGames`) — biblioteca de jogos possuídos (precisa de chave,
  gerada em [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)).
- **Steam IWishlistService/GetWishlist** e **Store API** (`appdetails`, `storesearch`) — wishlist, capa,
  gêneros e busca por nome (públicas, sem chave).

## Rodando localmente

Pré-requisitos: Node.js 20+ e um perfil Steam público (pra sincronização de wishlist/biblioteca).

```bash
npm install
npm run dev          # sobe o app em modo desenvolvimento
```

Outros scripts:

```bash
npm run build         # build de produção (main + preload + renderer)
npm run package       # build + empacota o instalador Windows (.exe) em release/
npm run typecheck     # checagem de tipos (main e renderer)
npm test              # roda os testes (Vitest)
npm run lint           # ESLint
npm run lint:fix       # ESLint com correção automática
npm run format         # Prettier (formata o projeto todo)
```

Configuração (SteamID64, chaves de API, intervalo de checagem, horário silencioso) fica na aba
**Configurações** dentro do próprio app — nada é configurado por variável de ambiente ou arquivo texto.

## Estrutura do projeto

```
src/
  main/                  # processo principal (Node/Electron)
    domain/               # regras de negócio: use-cases + interfaces de repositório (sem depender de Electron)
    infrastructure/       # implementações concretas: clients HTTP, storage em disco, tray, notificações
    ipc/                  # handlers que expõem os use-cases pro renderer via IPC
  preload/                # bridge segura (contextBridge) entre main e renderer
  renderer/               # UI React (páginas, componentes, hooks)
  shared/                 # tipos e lógica pura reaproveitados por main e renderer
```
