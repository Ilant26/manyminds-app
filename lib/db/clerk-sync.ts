import { clerkClient } from '@clerk/nextjs/server';
import { createUser, getUserByClerkId } from '@/lib/db/users';
import type { User } from '@/types';

/** Utilisateur DB à partir du Clerk id (création lazy si besoin). */
export async function getOrCreateDbUser(clerkId: string): Promise<User | null> {
  let user = await getUserByClerkId(clerkId);
  if (user) return user;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkId).catch(() => null);
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `user-${clerkId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@manyminds.local`;

  await createUser({ clerk_id: clerkId, email });
  return getUserByClerkId(clerkId);
}
