import Database from 'better-sqlite3';
import path from 'path';
import { QuorumDecision } from '../types/intent';

const DB_PATH = process.env.QUORUM_DB_PATH ?? path.join(process.cwd(), 'quorum.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id            TEXT PRIMARY KEY,
      agent_id      TEXT NOT NULL,
      action        TEXT NOT NULL,
      from_asset    TEXT NOT NULL,
      to_asset      TEXT NOT NULL,
      amount        TEXT NOT NULL,
      protocol      TEXT NOT NULL,
      risk_tier     TEXT NOT NULL,
      outcome       TEXT NOT NULL,
      approval_count INTEGER NOT NULL,
      required_count INTEGER NOT NULL,
      exec_tx_hash  TEXT,
      incident_id   TEXT,
      human_prompt  TEXT NOT NULL,
      agent_reasoning TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verdicts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id   TEXT NOT NULL,
      arbiter_id    TEXT NOT NULL,
      decision      TEXT NOT NULL,
      confidence    REAL NOT NULL,
      reasoning     TEXT NOT NULL,
      flags         TEXT NOT NULL,
      timestamp     INTEGER NOT NULL,
      FOREIGN KEY (proposal_id) REFERENCES proposals(id)
    );

    CREATE TABLE IF NOT EXISTS pattern_catches (
      pattern_id    TEXT PRIMARY KEY,
      catch_count   INTEGER NOT NULL DEFAULT 0,
      last_caught   INTEGER
    );
  `);
}

export interface ProposalRow {
  id: string;
  agentId: string;
  action: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  protocol: string;
  riskTier: string;
  outcome: string;
  approvalCount: number;
  requiredCount: number;
  execTxHash: string | null;
  humanPrompt: string;
  createdAt: number;
}

export const db = {
  saveDecision(manifest: {
    proposalId: string;
    agentId: string;
    action: string;
    fromAsset: string;
    toAsset: string;
    amount: string;
    protocol: string;
    humanPrompt: string;
    agentReasoning: string;
  }, decision: QuorumDecision): void {
    const d = getDb();
    const insertProposal = d.prepare(`
      INSERT OR REPLACE INTO proposals
        (id, agent_id, action, from_asset, to_asset, amount, protocol, risk_tier,
         outcome, approval_count, required_count, exec_tx_hash, incident_id,
         human_prompt, agent_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVerdict = d.prepare(`
      INSERT INTO verdicts
        (proposal_id, arbiter_id, decision, confidence, reasoning, flags, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const saveAll = d.transaction(() => {
      insertProposal.run(
        decision.proposalId,
        manifest.agentId,
        manifest.action,
        manifest.fromAsset,
        manifest.toAsset,
        manifest.amount,
        manifest.protocol,
        decision.riskTier,
        decision.outcome,
        decision.approvalCount,
        decision.requiredCount,
        decision.executionTxHash ?? null,
        decision.incidentId ?? null,
        manifest.humanPrompt,
        manifest.agentReasoning,
        decision.timestamp,
      );

      for (const verdict of decision.verdicts) {
        insertVerdict.run(
          decision.proposalId,
          verdict.arbiterId,
          verdict.decision,
          verdict.confidence,
          verdict.reasoning,
          JSON.stringify(verdict.flags),
          verdict.timestamp,
        );
      }
    });

    saveAll();
  },

  getRecentProposals(limit = 50): ProposalRow[] {
    return getDb().prepare(`
      SELECT id, agent_id as agentId, action, from_asset as fromAsset,
             to_asset as toAsset, amount, protocol, risk_tier as riskTier,
             outcome, approval_count as approvalCount, required_count as requiredCount,
             exec_tx_hash as execTxHash, human_prompt as humanPrompt, created_at as createdAt
      FROM proposals
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as ProposalRow[];
  },

  getProposalWithVerdicts(proposalId: string): {
    proposal: ProposalRow;
    verdicts: Array<{
      arbiterId: string;
      decision: string;
      confidence: number;
      reasoning: string;
      flags: string[];
    }>;
  } | null {
    const d = getDb();
    const proposal = d.prepare(`
      SELECT id, agent_id as agentId, action, from_asset as fromAsset,
             to_asset as toAsset, amount, protocol, risk_tier as riskTier,
             outcome, approval_count as approvalCount, required_count as requiredCount,
             exec_tx_hash as execTxHash, human_prompt as humanPrompt, created_at as createdAt
      FROM proposals WHERE id = ?
    `).get(proposalId) as ProposalRow | undefined;

    if (!proposal) return null;

    const verdictRows = d.prepare(`
      SELECT arbiter_id as arbiterId, decision, confidence, reasoning, flags
      FROM verdicts WHERE proposal_id = ? ORDER BY timestamp ASC
    `).all(proposalId) as Array<{ arbiterId: string; decision: string; confidence: number; reasoning: string; flags: string }>;

    return {
      proposal,
      verdicts: verdictRows.map(v => ({
        ...v,
        flags: JSON.parse(v.flags) as string[],
      })),
    };
  },

  incrementPatternCatch(patternId: string): void {
    getDb().prepare(`
      INSERT INTO pattern_catches (pattern_id, catch_count, last_caught)
      VALUES (?, 1, ?)
      ON CONFLICT(pattern_id) DO UPDATE SET
        catch_count = catch_count + 1,
        last_caught = excluded.last_caught
    `).run(patternId, Date.now());
  },

  getPatternCatches(): Record<string, number> {
    const rows = getDb().prepare(`
      SELECT pattern_id, catch_count FROM pattern_catches
    `).all() as Array<{ pattern_id: string; catch_count: number }>;

    return Object.fromEntries(rows.map(r => [r.pattern_id, r.catch_count]));
  },

  getStats(): { totalProposals: number; approved: number; rejected: number } {
    const row = getDb().prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN outcome = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM proposals
    `).get() as { total: number; approved: number; rejected: number };

    return {
      totalProposals: row.total,
      approved:       row.approved,
      rejected:       row.rejected,
    };
  },
};
