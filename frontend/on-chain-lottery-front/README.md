# on-chain-lottery-front

This is a React/Vite app containing:

- Tailwind and Shadcn UI for styling
- [Gill](https://gill.site/) Solana SDK
- Shadcn [Wallet UI](https://registry.wallet-ui.dev) components

## Getting Started

### Installation

#### Download the template

```shell
yarn create solana-dapp@latest -t gh:solana-foundation/templates/gill/on-chain-lottery-front
```

#### Install Dependencies

```shell
yarn
```

### Start the app

```shell
yarn dev
```

## Codama Client (generate from Anchor IDL)

This project is configured to generate a TypeScript client from the Anchor IDL using Codama and `gill`. See the official guide: [Generate Solana program clients with Codama](https://www.gillsdk.com/docs/guides/codama).

### Prerequisites
- Build your Anchor program to produce the IDL:
  ```shell
  cd ../../programs/on-chain-lottery
  anchor build
  ```
  The IDL should exist at: `programs/on-chain-lottery/target/idl/on_chain_lottery.json`

### Install dependencies (once)
```shell
yarn
```

### Generate the client
```shell
yarn codama:gen
```
The client is emitted to: `src/clients/generated`. You can then import it in your app code.

If the IDL changes (after a new Anchor build), re-run `yarn codama:gen`.
