#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Symbol, token
};

#[contracttype]
#[derive(Clone)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
    Returned,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowRecord {
    pub proposal_id:   String,
    pub agent_id:      Address,
    pub asset:         Address,   // Stellar asset contract address
    pub amount:        i128,
    pub status:        ProposalStatus,
    pub created_at:    u64,
    pub resolved_at:   u64,
    pub exec_tx_hash:  String,    // empty until executed
}

#[contract]
pub struct QuorumEscrow;

#[contractimpl]
impl QuorumEscrow {
    /// Agent calls this to lock funds when proposing a transaction.
    /// Returns the escrow record ID.
    pub fn lock_funds(
        env:         Env,
        proposal_id: String,
        agent:       Address,
        asset:       Address,
        amount:      i128,
    ) -> String {
        agent.require_auth();

        // Transfer from agent to this escrow contract
        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&agent, &env.current_contract_address(), &amount);

        let record = EscrowRecord {
            proposal_id:  proposal_id.clone(),
            agent_id:     agent,
            asset,
            amount,
            status:       ProposalStatus::Pending,
            created_at:   env.ledger().timestamp(),
            resolved_at:  0,
            exec_tx_hash: String::from_str(&env, ""),
        };

        env.storage().persistent().set(&proposal_id, &record);

        // Emit event so dashboard picks it up
        env.events().publish(
            (Symbol::new(&env, "funds_locked"), proposal_id.clone()),
            amount,
        );

        proposal_id
    }

    /// Called by Quorum consensus manager after 2/3 arbiter approval.
    /// Releases funds to the target protocol for execution.
    pub fn release_funds(
        env:         Env,
        proposal_id: String,
        quorum_auth: Address,   // the authorised Quorum orchestrator address
        recipient:   Address,   // the protocol contract to send funds to
        tx_hash:     String,
    ) {
        quorum_auth.require_auth();

        let mut record: EscrowRecord = env.storage().persistent()
            .get(&proposal_id)
            .expect("Proposal not found");

        assert!(
            matches!(record.status, ProposalStatus::Pending),
            "Funds already resolved"
        );

        let token_client = token::Client::new(&env, &record.asset);
        token_client.transfer(&env.current_contract_address(), &recipient, &record.amount);

        record.status       = ProposalStatus::Executed;
        record.resolved_at  = env.ledger().timestamp();
        record.exec_tx_hash = tx_hash;

        env.storage().persistent().set(&proposal_id, &record);

        env.events().publish(
            (Symbol::new(&env, "funds_released"), proposal_id),
            record.amount,
        );
    }

    /// Called by Quorum consensus manager when arbiters reject.
    /// Returns funds to the original agent.
    pub fn return_funds(
        env:         Env,
        proposal_id: String,
        quorum_auth: Address,
    ) {
        quorum_auth.require_auth();

        let mut record: EscrowRecord = env.storage().persistent()
            .get(&proposal_id)
            .expect("Proposal not found");

        assert!(
            matches!(record.status, ProposalStatus::Pending),
            "Funds already resolved"
        );

        let token_client = token::Client::new(&env, &record.asset);
        token_client.transfer(
            &env.current_contract_address(),
            &record.agent_id,
            &record.amount,
        );

        record.status      = ProposalStatus::Returned;
        record.resolved_at = env.ledger().timestamp();

        env.storage().persistent().set(&proposal_id, &record);

        env.events().publish(
            (Symbol::new(&env, "funds_returned"), proposal_id),
            record.amount,
        );
    }

    /// Read a proposal's current status — callable by anyone.
    pub fn get_status(env: Env, proposal_id: String) -> EscrowRecord {
        env.storage().persistent()
            .get(&proposal_id)
            .expect("Proposal not found")
    }
}
