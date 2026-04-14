#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct ArbiterRecord {
    pub arbiter_id:    String,
    pub address:       Address,
    pub speciality:    String,   // "intent" | "parameter" | "adversarial"
    pub reputation:    i32,      // starts at 50, max 100, min 0
    pub verdicts_cast: u32,
    pub registered_at: u64,
    pub active:        bool,
}

#[contract]
pub struct ArbiterRegistry;

#[contractimpl]
impl ArbiterRegistry {
    pub fn register(
        env:        Env,
        arbiter_id: String,
        address:    Address,
        speciality: String,
    ) {
        address.require_auth();

        let record = ArbiterRecord {
            arbiter_id:    arbiter_id.clone(),
            address,
            speciality,
            reputation:    50,   // start neutral
            verdicts_cast: 0,
            registered_at: env.ledger().timestamp(),
            active:        true,
        };

        env.storage().persistent().set(&arbiter_id, &record);

        env.events().publish(
            (Symbol::new(&env, "arbiter_registered"), arbiter_id),
            50_i32,
        );
    }

    /// Called after each verdict to update reputation.
    /// delta: positive for correct verdicts, negative for disputes.
    pub fn update_reputation(
        env:        Env,
        arbiter_id: String,
        admin:      Address,
        delta:      i32,
    ) {
        admin.require_auth();

        let mut record: ArbiterRecord = env.storage().persistent()
            .get(&arbiter_id)
            .expect("Arbiter not found");

        record.reputation    = (record.reputation + delta).clamp(0, 100);
        record.verdicts_cast += 1;

        env.storage().persistent().set(&arbiter_id, &record);

        env.events().publish(
            (Symbol::new(&env, "reputation_updated"), arbiter_id),
            record.reputation,
        );
    }

    pub fn get_arbiter(env: Env, arbiter_id: String) -> ArbiterRecord {
        env.storage().persistent()
            .get(&arbiter_id)
            .expect("Arbiter not found")
    }

    pub fn get_reputation(env: Env, arbiter_id: String) -> i32 {
        let record: ArbiterRecord = env.storage().persistent()
            .get(&arbiter_id)
            .expect("Arbiter not found");
        record.reputation
    }
}
