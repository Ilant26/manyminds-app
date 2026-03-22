import { Webhook } from 'svix';
import { clerkClient } from '@clerk/nextjs/server';
import { createUser, deleteUserByClerkId } from '@/lib/db/users';

function computeAge(dateOfBirth: Date, now: Date) {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: 'Webhook secret not set' }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: 'Missing headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  let payload: {
    type?: string;
    data?: {
      id?: string;
      email_addresses?: { email_address: string }[];
      unsafe_metadata?: Record<string, unknown>;
      public_metadata?: Record<string, unknown>;
    };
  };
  try {
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof payload;
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (payload.type === 'user.created' && payload.data) {
    const clerkId = payload.data.id;
    const email =
      payload.data.email_addresses?.[0]?.email_address ?? '';
    if (!clerkId || !email) return Response.json({ received: true });

    const clerk = await clerkClient();
    const meta = payload.data.unsafe_metadata ?? payload.data.public_metadata ?? {};
    const rawDob = meta['dateOfBirth'] ?? meta['dob'] ?? meta['birthdate'];
    const dateStr = typeof rawDob === 'string' ? rawDob.trim() : '';

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) {
      // If DOB is missing/invalid, refuse: this should be prevented by making the field required in Clerk.
      await deleteUserByClerkId(clerkId).catch(() => {});
      await clerk.users.deleteUser(clerkId).catch(() => {});
      return Response.json({ received: true });
    }

    const [_, y, mo, d] = match;
    const dob = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    const now = new Date();
    const age = computeAge(dob, now);
    const minAge = 16;

    if (age < minAge) {
      await deleteUserByClerkId(clerkId).catch(() => {});
      await clerk.users.deleteUser(clerkId).catch(() => {});
      return Response.json({ received: true });
    }

    await clerk.users
      .updateUser(clerkId, {
        privateMetadata: {
          ageVerified: true,
          ageVerifiedAt: now.toISOString(),
        },
      })
      .catch(() => {});

    try {
      await createUser({ clerk_id: clerkId, email });
    } catch {
      // Already exists or constraint — ignore
    }
  }

  return Response.json({ received: true });
}
