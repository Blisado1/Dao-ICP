import {
  $query,
  $update,
  Result,
  Opt,
  nat64,
  Principal,
  ic,
  int32,
  stable64,
  record,
  record_type,
  type,
} from "azle";
import {
  Address,
  binaryAddressFromAddress,
  TransferFee,
  Ledger,
  Tokens,
  TransferResult,
} from "azle/canisters/ledger";

type Proposal = record_type<{
  id: int32;
  title: string;
  amount: nat64;
  recipient: string;
  votes: nat64;
  ends: nat64;
  executed: boolean;
  ended: boolean;
}>;

type initPayload = record_type<{
  contributionTime: nat64;
  voteTime: nat64;
  quorum: nat64;
  canisterAddress: string;
}>;

type ProposalPayload = record_type<{
  id: int32;
  title: string;
  amount: nat64;
  recipient: string;
}>;

const proposalStorage = new StableBTreeMap<int32, Proposal>(
  BigInt(0),
  BigInt(44),
  BigInt(10240)
);
const sharesStorage = new StableBTreeMap<Principal, nat64>(
  BigInt(2),
  BigInt(100),
  BigInt(8)
);

// investor vote mapping ${Principal + proposalId}
const votesMapping = new StableBTreeMap<string, boolean>(
  BigInt(3),
  BigInt(120),
  BigInt(8)
);

let totalShares: nat64 = BigInt(0);
let availableFunds: nat64 = BigInt(0);
let lockedFunds: nat64 = BigInt(0);
let contributionEnds: nat64 = BigInt(0);
let nextProposalId: int32 = BigInt(0);
let quorum: nat64 = BigInt(0);
let voteTime: nat64 = BigInt(0);
let admin: Principal = ic.canister_self();

let canisterAddress: Address = null;
let icpCanister: Ledger = null;

$init
export function init(payload: initPayload): void {
  if (payload.quorum < BigInt(0) || payload.quorum > BigInt(100)) {
    ic.trap("quorum must be between 0 and 100");
  }

  // initialize variables
  contributionEnds = payload.contributionTime;
  quorum = payload.quorum;
  voteTime = payload.voteTime;
  admin = ic.caller();
  nextProposalId = BigInt(0);
  totalShares = BigInt(0);
  availableFunds = BigInt(0);
  lockedFunds = BigInt(0);
  canisterAddress = payload.canisterAddress;
  icpCanister = new Ledger(Principal.fromText(payload.canisterAddress));

  ic.trap("Initialization complete");
}

// function to deposit icp tokens and join the dao
$update
export async function joinDAO(amount: nat64): Promise<Result<string, string>> {
  // check if contribution period has ended
  if (ic.time() > contributionEnds) {
    return Result.Err<string, string>("cannot contribute after contributionEnds");
  }

  // check if amount is not less than 0
  if (amount <= BigInt(0)) {
    return Result.Err<string, string>("please enter an amount greater than zero");
  }

  const caller = ic.caller();

  // initiate deposit
  await deposit(amount);

  // update user shares
  const updatedShares = match(sharesStorage.get(caller), {
    Some: (shares) => shares + amount,
    None: () => BigInt(0) + amount,
  });

  // store in storage
  sharesStorage.insert(caller, updatedShares);

  // update total shares
  totalShares = totalShares + amount;

  // update available shares
  availableFunds = availableFunds + amount;

  return Result.Ok<string, string>("DAO joined successfully");
}

// function to withdraw icp tokens from dao
$update
export async function redeemShares(
  amount: nat64,
  addressTo: string
): Promise<Result<string, string>> {
  const caller = ic.caller();

  // check if the available amount is greater than the amount
  if (availableFunds < amount) {
    return Result.Err<string, string>("not enough available funds");
  }

  // get the updated shares
  const updatedShares = match(sharesStorage.get(caller), {
    Some: (shares) => {
      if (shares < amount) {
        ic.trap("not enough shares");
      }
      return shares - amount;
    },
    None: () => ic.trap("you don't have any shares"),
  });

  // transfer funds
  await transfer(addressTo, amount);

  // check if user shares become 0 and remove user from dao or update the remaining amount
  if (updatedShares === BigInt(0)) {
    sharesStorage.remove(caller);
  } else {
    sharesStorage.insert(caller, updatedShares);
  }

  // update the amount in storage
  totalShares = totalShares - amount;
  availableFunds = availableFunds - amount;

  return Result.Ok<string, string>("shares redeemed successfully");
}

// function to transfer shares from one user to another
$update
export function transferShares(
  amount: nat64,
  to: Principal
): Result<string, string> {
  const caller = ic.caller();

  // get updated shares for sender
  const updatedFromShares = match(sharesStorage.get(caller), {
    Some: (shares) => {
      if (shares < amount) {
        ic.trap("not enough shares");
      }
      return shares - amount;
    },
    None: () => ic.trap("you don't have any shares"),
  });

  // get updated shares of recipient
  const updatedToShares = match(sharesStorage.get(to), {
    Some: (shares) => shares + amount,
    None: () => BigInt(0) + amount,
  });

  // check if user shares become 0 and remove user from dao or update the remaining amount
  if (updatedFromShares === BigInt(0)) {
    sharesStorage.remove(caller);
  } else {
    sharesStorage.insert(caller, updatedFromShares);
  }

  // update the recipient's record in the storage
  sharesStorage.insert(to, updatedToShares);

  return Result.Ok<string, string>("shares transferred successfully");
}

// function
