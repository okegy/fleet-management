import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createClerkClient, verifyToken } from '@clerk/backend';
import Organization from '../models/Organization.js';
import User from '../models/User.js';

const generateToken = (userId, role, tokenVersion) => {
  return jwt.sign(
    { userId, role, tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '7d' }
  );
};

// Clerk enforces a strong password policy on the Mongo user we provision.
// The user never types this password: Clerk owns the credential.
const randomPassword = () => `Cf${crypto.randomBytes(14).toString('base64url')}9!`;

/**
 * POST /api/auth/clerk
 * Exchange a verified Clerk session token for the app's own HTTP-only cookie.
 * This keeps every existing /api route and UI screen unchanged while allowing
 * Google/GitHub sign-in through Clerk.
 */
export const clerkLogin = async (req, res) => {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      return res.status(503).json({ error: 'Clerk is not configured on the server' });
    }

    const token = req.body?.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'Clerk session token is required' });
    }

    let payload;
    try {
      payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired Clerk token' });
    }

    const clerkUserId = payload?.sub;
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Clerk token is missing a subject' });
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerk.users.getUser(clerkUserId);

    const primaryEmail =
      clerkUser.emailAddresses?.find((entry) => entry.id === clerkUser.primaryEmailAddressId) ||
      clerkUser.emailAddresses?.[0];
    const email = primaryEmail?.emailAddress?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Clerk account has no email address' });
    }

    const orgQuery = process.env.CLERK_DEFAULT_ORG_SLUG
      ? { slug: process.env.CLERK_DEFAULT_ORG_SLUG }
      : { active: true };

    const organization = await Organization.findOne(orgQuery);
    if (!organization) {
      return res.status(503).json({ error: 'No organization is available for social sign-in' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
        email.split('@')[0];

      user = await User.create({
        name,
        email,
        password: randomPassword(),
        role: process.env.CLERK_DEFAULT_ROLE || 'dispatcher',
        organizationId: organization._id,
      });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token2 = generateToken(user._id, user.role, user.tokenVersion);

    res.cookie('fleetflow_token', token2, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(200).json({
      message: 'Signed in with Clerk',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error('Clerk sign-in error:', error.message);
    return res.status(500).json({ error: 'Failed to complete social sign-in' });
  }
};
