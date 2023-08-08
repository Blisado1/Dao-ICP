# DAO

## Disclaimer

This is a test canister and should not be used in production.

This DAO contract:

- Collects investors money (ICP) & allocate shares
- Keep track of investor contributions with shares
- Allow investors to transfer shares
- Allow investment proposals to be created and voted
- Execute successful investment proposals (i.e send money)
- The number of votes an investor has is equivalent to the number of shares the investor has.

## To start the Local Internet Computer

```bash
dfx start --background
```

To deploy the canister

```bash
dfx deploy
```

## Testing locally

Added the dummy tokens which allows users to test the canister locally.

Steps involved:

- Deploy canister `dfx deploy` and take note of the dao canister address and token canister address. [Link](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/deploy.gif)

![img](src/assets/gifs/deploy.gif)

- Run the `init` function setting the payload network to 0. [Link](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/init.gif)
  
        Parameters:
                - network: 0 for dummy tokens | 1 for ICP Ledger (use 0 for testing)
                - contributionTime: total duration of DAO in nanoseconds;
                - voteTime: time for voting in nanoseconds;
                - quorum: percentage of votes required to pass proposal from 0 - 100;
                - canisterAddress: address of DAO canister from deployment;
                - tokenAddress: address of Token Canister from deployment;

![img](src/assets/gifs/init.gif)

- Then claim faucet dummy tokens using the `getFaucetTokens` function. [Link](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/faucet.gif)

![img](src/assets/gifs/faucet.gif)

- Then you should be able to test the canister properly.

- `JoinDAO` [Test](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/joinDao.gif)
  
  ![img](src/assets/gifs/joinDao.gif)

- `RedeemShares` [Test](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/redeemShares.gif)
  
  ![img](src/assets/gifs/redeemShares.gif)

- `TransferShares` [Test](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/transferShares.gif)
  
  ![img](src/assets/gifs/transferShares.gif)

- `Create Proposal` [Test](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/createProposal.gif)
  
  ![img](src/assets/gifs/createProposal.gif)

- `Vote Proposal` [Test](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/voteProposal.gif)
  
  ![img](src/assets/gifs/voteProposal.gif)

- `Execute Proposal` [Test](https://github.com/Blisado1/Dao-ICP/blob/main/src/assets/gifs/executeProposal.gif)
  
  ![img](src/assets/gifs/executeProposal.gif)


- Test Addresses used in the Tests
        
        user1: asrmz-lmaaa-aaaaa-qaaeq-cai
        user2: b77ix-eeaaa-aaaaa-qaada-cai
