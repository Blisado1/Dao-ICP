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

## To start the Local Internet Computer

```bash
dfx start --background
```

To deploy the canister

```bash
dfx deploy --argument '(record {contributionTime= <nat>; voteTime= <nat>; quorum= <nat>; canisterAddress= "CANISTER_ADDRESS"})' DAO
```
