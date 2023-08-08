import {
    CallResult,
    nat64,
    Service,
    Record,
    serviceQuery,
    serviceUpdate,
    int8,
    int32,
} from 'azle';

export type Proposal = Record<{
    id: int32;
    title: string;
    amount: nat64;
    recipient: string;
    votes: nat64;
    ends: nat64;
    executed: boolean;
    ended: boolean;
}>

export type DaoData = Record<{
    totalShares: string;
    availableFunds:  string;
    lockedFunds: string;
    contributionEnds: string;
    nextProposalId: string;
    quorum: string;
    voteTime: string;
    admin: string;
    network: string;
    initialized: boolean;
}>

export type InitPayload = Record<{
     // network: local:0 or mainnet:1
    network: int8
    contributionTime: nat64;
    voteTime: nat64;
    quorum: nat64;
    canisterAddress: string;
    tokenAddress: string;
}>

export type ProposalPayload = Record<{
    title: string;
    amount: nat64;
    recipient: string;
}>

export type AddressPayload = Record<{
    address: string
}>

export type JoinPayload = Record<{
    amount: nat64
}>
 
export type RedeemPayload = Record<{
    amount: nat64;
}> 

export type TransferPayload = Record<{
    amount: nat64;
    to: string
}>

export type QueryPayload =Record<{
    proposalId: int32
}>

export type Account = {
    address: string;
    balance: nat64;
};

export type State = {
    accounts: {
        [key: string]: Account;
    };
    name: string;
    ticker: string;
    totalSupply: nat64;
};

export class Token extends Service {
    @serviceUpdate
    initializeSupply: ( name: string, originalAddress: string, ticker: string,totalSupply: nat64) => CallResult<boolean>;

    @serviceUpdate
    transfer: (from: string, to: string, amount: nat64) => CallResult<boolean>;

    @serviceQuery
    balance: (id: string) => CallResult<nat64>;

    @serviceQuery
    ticker: () => CallResult<string>;

    @serviceQuery
    name: () => CallResult<string>;

    @serviceQuery
    totalSupply: () => CallResult<nat64>;
}
