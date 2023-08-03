# DAO

## Disclaimer

This is a test contract and should not be used in production.

This DAO contract:

- Collects investors money (ICP) & allocate shares
- Keep track of investor contributions with shares
- Allow investors to transfer shares
- Allow investment proposals to be created and voted
- Execute successful investment proposals (i.e send money)
- The number of votes an investor has is equivalent to the number of shares the investor has.

On deployment the contract has been set to 70 % approval, 365 days of contributions, 24 hours for voting.

## To Deploy

- Start ICP server

```bash
dfx start --background --clean
```

- Generate addresses

```bash
dfx canister create --all
```

- deploy the canister

```bash
dfx deploy
```

## Testing locally

Added the dummy tokens which allows users to test the canister locally.

Steps involved:

- Deploy canister `dfx deploy`
- Run the `initialize` function setting the payload network to 0 using adresses generated from the cli 
- Then claim faucet dummy tokens using the `getFaucetTokens` function
- Then you should be able to test the canister properly.
