import { $query, $update, StableBTreeMap, Vec, int8, match, Result, Opt, nat64, ic, int32, Principal } from 'azle';
import {
    Address,
    binaryAddressFromAddress,
    TransferFee,
    Ledger,
    Tokens,
    TransferResult,
} from 'azle/canisters/ledger';

import {Token, InitPayload, Proposal, ProposalPayload, JoinPayload, RedeemPayload, TransferPayload, QueryPayload, AddressPayload, DaoData } from '../types';

const proposalStorage = new StableBTreeMap<int32, Proposal>(0, 44, 10000);
const sharesStorage = new StableBTreeMap<Principal, nat64>(1, 100, 100);

// investor vote mapping ${Principal + proposalId}
const votesMapping = new StableBTreeMap<string, boolean>(2, 120, 100);

let totalShares: nat64;
let availableFunds:  nat64;
let lockedFunds: nat64;
let contributionEnds: nat64;
let nextProposalId: int32;
let quorum: nat64;
let voteTime: nat64;
let admin: Principal;
let network: int8;
let initialized: boolean;

let canisterAddress: Address;
let icpCanister: Ledger;
let tokenCanister: Token;

$update
export async function init(payload: InitPayload): Promise<Result<string, string>> {
    // check if canister is already initialized
    if(initialized){
        ic.trap("already initialized")
    }

    if(payload.quorum < 0 || payload.quorum > 100){
        ic.trap("quorum must be between 0 and 100")
    }

    // initialize variables
    contributionEnds = ic.time() + payload.contributionTime;
    quorum = payload.quorum;
    voteTime = payload.voteTime;
    admin = ic.caller();
    nextProposalId = 0;
    totalShares = BigInt(0);
    availableFunds = BigInt(0);
    lockedFunds = BigInt(0);
    canisterAddress = payload.canisterAddress;
    icpCanister = new Ledger(Principal.fromText(payload.canisterAddress));
    tokenCanister = new Token(Principal.fromText(payload.tokenAddress));
    initialized = true;

    // set up network for testing
    if (payload.network == 0){
        //set up dummyTokens
        network = 0;
        await tokenCanister.initializeSupply('ICToken', payload.canisterAddress, 'ICT', 1_000_000_000_000n).call();
    }else{
        network = 1;
    }

    return Result.Ok<string, string>("Initialized");
}

// function to return dao configuration data
$query
export function getDaoData(): Result<DaoData, string>  {
    // check if canister is already initialized
    if(!initialized){
        return Result.Err<DaoData, string>("not yet initialized")
    }
    
    return Result.Ok<DaoData, string>({
        totalShares: totalShares.toString(),
        availableFunds: availableFunds.toString(),
        lockedFunds: lockedFunds.toString(),
        contributionEnds: contributionEnds.toString(),
        nextProposalId: nextProposalId.toString(),
        quorum: quorum.toString(),
        voteTime: voteTime.toString(),
        admin: admin.toString(),
        network: network.toString(),
        initialized
    })
}

// function to deposit icp tokens and join the dao
$update
export async function joinDAO(payload: JoinPayload): Promise<Result<string, string>>  {
    // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }

    let amount = payload.amount;
    
    // check if contribution period has ended
    if(ic.time() > contributionEnds){
        return Result.Err<string, string>("cannot contribute after contributionEnds");
    }

    // check if amount is not less than 0   
    if(amount <= BigInt(0)){
        return Result.Err<string, string>("please enter an amount greater than zero");
    }

    let caller = ic.caller()

    // if network is set to local network use dummy tokens
    if(network == 0){
        let status = (await tokenCanister.transfer(ic.caller().toString(), canisterAddress, amount).call()).Ok;   
        if(!status){
            ic.trap("Failed to Donate")
        }
    } else {
        // initiate deposit
        await deposit(amount);
    }
    
    // update user shares
    const updatedShares = match(sharesStorage.get(caller), {
        Some: shares => shares + amount,
        None: () => BigInt(0) + amount
    })

    // store in storage
    sharesStorage.insert(caller, updatedShares);

    // update total shares
    totalShares = totalShares + amount;

    // update available shares
    availableFunds = availableFunds + amount;

    return Result.Ok<string, string>("DAO joined successfully")
}

$query
export function getShares(payload: AddressPayload): nat64{
 // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }

    let address: Principal;

    if(payload.address == ""){
        address = ic.caller();
    }else{
        address = Principal.fromText(payload.address)
    }
    // get user shares
    return match(sharesStorage.get(address), {
        Some: shares => shares,
        None: () => 0n
    })
}

// function to withdraw icp tokens from dao
$update
export async function redeemShares(payload: RedeemPayload):  Promise<Result<string, string>> {
    // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }
    
    let caller = ic.caller();

    let amount = payload.amount;

    // check if the available amount is greater than the amount
    if(availableFunds < amount){
        return Result.Err<string, string>("not enough available funds");
    }

    // get the updated shares
    const updatedShares = match(sharesStorage.get(caller), {
        Some: shares => {
            if(shares < amount){
                ic.trap("not enough shares")
            };

            return shares - amount;
        },
        None: () => ic.trap("you don't have any shares")
    })

    // if network is set to local network use dummy tokens
    if(network == 0){
        let status = (await tokenCanister.transfer(canisterAddress, ic.caller().toString(), amount).call()).Ok;   
        if(!status){
            ic.trap("Failed to Redeem shares")
        }
    } else {
        // transfer funds
        await transfer(ic.caller().toString(), amount);    
    }

    // check if user shares become 0 and remove user from dao or update the remaining amount
    if(updatedShares == BigInt(0)){
        sharesStorage.remove(caller);
    }else{
        sharesStorage.insert(caller, updatedShares);
    }

    // update the amount in storage
    totalShares = totalShares - amount;

    availableFunds = availableFunds - amount;

    return Result.Ok<string, string>("shares redeemed succesfully")
}


// function to transfer shares from one user to another
$update 
export function transferShares(payload: TransferPayload): Result<string, string> {
    // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }

    let caller = ic.caller();
    let to = Principal.fromText(payload.to);
    let amount = payload.amount;

    // get updated shares for sender
    const updatedFromShares = match(sharesStorage.get(caller), {
        Some: shares => {
            if(shares < amount){
                ic.trap("not enough shares")
            };

            return shares - amount;
        },
        None: () => ic.trap("you don't have any shares")
    })

    // get updated shares of recipient
    const updatedToShares = match(sharesStorage.get(to), {
        Some: shares => shares + amount,
        None: () => BigInt(0) + amount
    })

    // check if user shares become 0 and remove user from dao or update the remaining amount
    if(updatedFromShares == BigInt(0)){
        sharesStorage.remove(caller);
    }else{
        sharesStorage.insert(caller, updatedFromShares);
    }

    // update the recipients record in the storage
    sharesStorage.insert(to, updatedToShares);

    return Result.Ok<string, string>("shares transferred succesfully")
}

// function to create a new proposal
$update
export function createProposal(payload: ProposalPayload): Result<string, string>{
    // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }
    
    let caller = ic.caller();

    // check if available funds is enough
    if(availableFunds < payload.amount){
        return Result.Err<string, string>("not enough available funds");
    }

    // check if user is a part of the dao
    if(sharesStorage.get(caller).Some === undefined){
        return Result.Err<string, string>("you don't have any shares");
    }

    // populate proposal information
    const proposal: Proposal = {
        id: nextProposalId,
        title: payload.title,
        amount: payload.amount,
        recipient: payload.recipient,
        votes: BigInt(0),
        ends: ic.time() + voteTime,
        executed: false,
        ended: false
    }

    // add proposal to the storage
    proposalStorage.insert(nextProposalId, proposal);

    // update variables
    availableFunds = availableFunds - payload.amount;
    lockedFunds = lockedFunds + payload.amount;

    nextProposalId = nextProposalId + 1;

    return Result.Ok<string, string>("proposal created succesfully")
}


// function to vote for a proposal
$update
export function voteProposal(proposal: QueryPayload): Result<string, string>{
    // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }

    let caller = ic.caller();
    let proposalId = proposal.proposalId;

    // get user shares
    const shares = match(sharesStorage.get(caller), {
        Some: shares => shares,
        None: () => ic.trap("you don't have any shares")
    })

    let address = caller.toString();

    // create identifier with user address and proposal id
    let id =  `${address + proposalId.toString()}`

    // check if investor has voted
    let hasVoted = match(votesMapping.get(id), {
        Some: hasVoted => hasVoted,
        None: () => false
    })

    // check if user has voted before
    if(hasVoted){
        return Result.Err<string, string>("you can only vote once");
    }

    // get proposal information and add user vote
    match(proposalStorage.get(proposalId), {
        Some: proposal => {

            if(ic.time() > proposal.ends){
                ic.trap("proposal has ended")
            };

            const votes = proposal.votes + shares;

            const updatedProposal: Proposal = { ...proposal, votes };

            proposalStorage.insert(proposalId, updatedProposal);
        },

        None: () => ic.trap(`proposal with id ${proposalId} does not exist`)
    })

    // set investor to hasVoted
    votesMapping.insert(id, true);

    return Result.Ok<string, string>("voted succesfully")
}


// function to execute a proposal, can only be called by the contract admin
$update 
export function executeProposal(payload: QueryPayload): Promise<Result<string, string>> {
    // check if canister is already initialized
    if(!initialized){
        ic.trap("canister not yet initialized")
    }

    let caller = ic.caller();
    let proposalId = payload.proposalId;

    let executed: boolean;
    // check if caller is admin
    if(caller.toString() !== admin.toString()){
        ic.trap("only admin can execute proposal");
    }

    // get proposal information and update
    return match( proposalStorage.get(proposalId), {
        Some: async (proposal) =>
        {
            if(ic.time() < proposal.ends){
                ic.trap("cannot execute proposal before end date")
            };

            if(proposal.ended){
                ic.trap("cannot execute proposal already ended")
            }
            
            if(proposal.votes * 100n / totalShares >=  quorum){ 
                // initiate transfer
                
                // if network is set to local network use dummy tokens
                if(network == 0){
                    let status = (await tokenCanister.transfer(canisterAddress, proposal.recipient, proposal.amount).call()).Ok;   
                    if(!status){
                        ic.trap("failed to transfer")
                    }
                } else {
                    // mainnet function
                    await transfer(proposal.recipient, proposal.amount);
                }

                executed = true;
            }else{
                //release funds back to available funds
                availableFunds = availableFunds + proposal.amount;
                executed = false;
            }

            lockedFunds = lockedFunds - proposal.amount;

            const updatedProposal: Proposal = {...proposal, ended: true, executed: executed};

            proposalStorage.insert(proposalId, updatedProposal);

            return Result.Ok<string, string>("proposal completed")
        },
        None: async () => Result.Err<string, string>("Error")
    })
}

$query;
export function getProposals(): Result<Vec<Proposal>, string> {
    return Result.Ok(proposalStorage.values());
}


$query;
export function getProposal(proposalId: int32): Result<Proposal, string> {
    return match(proposalStorage.get(proposalId), {
        Some: (proposal) => Result.Ok<Proposal, string>(proposal),
        None: () => Result.Err<Proposal, string>(`proposal with id=${proposalId} not found`)
    });
}

// Helper functions
$update
export async function getFaucetTokens(): Promise<Result<boolean, string>>{
    const caller = ic.caller();
    const returnVal = (await tokenCanister.balance(caller.toString()).call()).Ok;
    const balance = returnVal? returnVal : 0n;
    if(balance > 0n){
        ic.trap("To prevent faucet drain, please utilize your existing tokens");
    }
    return await tokenCanister.transfer(canisterAddress, caller.toString(), 100n).call();   
}

$update;
export async function walletBalanceLocal(payload: AddressPayload): Promise<Result<nat64, string>> {
    let address = payload.address
    if(address == ""){
        address = ic.caller().toString();
    }
    return await tokenCanister.balance(address).call();
}

async function getAccountBalance(
    address: Address
): Promise<Result<Tokens, string>> {
    return await icpCanister
        .account_balance({
            account: binaryAddressFromAddress(address)
        })
        .call();
}

async function deposit(
    amount: nat64,
): Promise<Result<TransferResult, string>> {
    const balance = (await getAccountBalance(ic.caller().toText())).Ok?.e8s;
    const transfer_fee = (await getTransferFee()).Ok?.transfer_fee.e8s

    if(balance !== undefined && balance > amount){
        return await icpCanister
            .transfer({
                memo: 0n,
                amount: {
                    e8s: amount
                },
                fee: {
                    e8s: transfer_fee? transfer_fee : 10000n 
                },
                from_subaccount: Opt.None,
                to: binaryAddressFromAddress(canisterAddress),
                created_at_time: Opt.None
            })
            .call();
    } else{
        ic.trap("Fund your account first")
    }
}

async function transfer(
    to: Address,
    amount: nat64,
): Promise<Result<TransferResult, string>> {
    const balance = (await getAccountBalance(canisterAddress)).Ok?.e8s;
    const transfer_fee = (await getTransferFee()).Ok?.transfer_fee.e8s;

    if(balance !== undefined && balance > amount){
        return await icpCanister
        .transfer({
            memo: 0n,
            amount: {
                e8s: amount
            },
            fee: {
                e8s: transfer_fee? transfer_fee : 10000n 
            },
            from_subaccount: Opt.None,
            to: binaryAddressFromAddress(to),
            created_at_time: Opt.None
        })
        .call();
    }else{
        ic.trap("Account is empty")
    }
}

async function getTransferFee(): Promise<Result<TransferFee, string>> {
    return await icpCanister.transfer_fee({}).call();
}
