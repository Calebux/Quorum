#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, String, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub struct AttackPattern {
    pub pattern_id:   String,
    pub category:     String,   // "prompt_injection" | "slippage_exploit" | "parameter_manipulation" | "deadline_pressure"
    pub description:  String,
    pub signature:    String,   // a fingerprint string arbiters can match against
    pub severity:     u32,      // 1 (low) to 5 (critical)
    pub catch_count:  u32,      // how many times this pattern has been detected
    pub added_at:     u64,
    pub added_by:     String,   // arbiter_id that discovered it
}

#[contract]
pub struct PatternRegistry;

#[contractimpl]
impl PatternRegistry {
    /// Pre-seed with known patterns at deploy time.
    pub fn add_pattern(
        env:         Env,
        admin:       soroban_sdk::Address,
        pattern_id:  String,
        category:    String,
        description: String,
        signature:   String,
        severity:    u32,
        added_by:    String,
    ) {
        admin.require_auth();

        let pattern = AttackPattern {
            pattern_id:  pattern_id.clone(),
            category,
            description,
            signature,
            severity,
            catch_count: 0,
            added_at:    env.ledger().timestamp(),
            added_by,
        };

        env.storage().persistent().set(&pattern_id, &pattern);

        env.events().publish(
            (Symbol::new(&env, "pattern_added"), pattern_id),
            severity,
        );
    }

    /// Called when a pattern is matched during a verification.
    /// Increments catch count — shows the pattern is actively protecting agents.
    pub fn record_catch(env: Env, admin: soroban_sdk::Address, pattern_id: String) {
        admin.require_auth();

        let mut pattern: AttackPattern = env.storage().persistent()
            .get(&pattern_id)
            .expect("Pattern not found");

        pattern.catch_count += 1;
        env.storage().persistent().set(&pattern_id, &pattern);

        env.events().publish(
            (Symbol::new(&env, "pattern_caught"), pattern_id),
            pattern.catch_count,
        );
    }

    pub fn get_pattern(env: Env, pattern_id: String) -> AttackPattern {
        env.storage().persistent()
            .get(&pattern_id)
            .expect("Pattern not found")
    }

    /// Returns all pattern signatures as a list — used by Adversarial Arbiter.
    pub fn get_all_signatures(env: Env) -> Vec<String> {
        Vec::new(&env)  // placeholder — implement storage iteration
    }
}
