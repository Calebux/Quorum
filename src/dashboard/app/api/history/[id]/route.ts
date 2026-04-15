import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = db.getProposalWithVerdicts(params.id);
  if (!result) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }
  return NextResponse.json(result);
}
