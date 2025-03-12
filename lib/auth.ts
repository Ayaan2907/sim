import { headers } from 'next/headers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP, genericOAuth } from 'better-auth/plugins'
import { Resend } from 'resend'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import * as schema from '@/db/schema'

const logger = createLogger('Auth')

// If there is no resend key, it might be a local dev environment
// In that case, we don't want to send emails and just log them
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : { emails: { send: async (...args: any[]) => logger.info('Email sent:', args) } }

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration (5 minutes)
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      scopes: ['user:email', 'repo'],
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendVerificationOnSignUp: false,
    throwOnMissingCredentials: true,
    throwOnInvalidCredentials: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      const result = await resend.emails.send({
        from: 'Sim Studio <team@simstudio.ai>',
        to: user.email,
        subject: 'Reset your password',
        html: `
          <h2>Reset Your Password</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${url}">${url}</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      })

      if (!result) {
        throw new Error('Failed to send reset password email')
      }
    },
  },
  plugins: [
    nextCookies(),
    emailOTP({
      sendVerificationOTP: async (data: {
        email: string
        otp: string
        type: 'sign-in' | 'email-verification' | 'forget-password'
      }) => {
        try {
          if (!data.email) {
            throw new Error('Email is required')
          }

          const result = await resend.emails.send({
            from: 'Sim Studio <onboarding@simstudio.ai>',
            to: data.email,
            subject: 'Verify your email',
            html: `
              <h2>Welcome to Sim Studio!</h2>
              <p>Your verification code is:</p>
              <h1 style="font-size: 32px; letter-spacing: 2px; text-align: center; padding: 16px; background-color: #f8f9fa; border-radius: 4px;">${data.otp}</h1>
              <p>This code will expire in 15 minutes.</p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
            `,
          })

          if (!result) {
            throw new Error('Failed to send verification code')
          }
        } catch (error) {
          logger.error('Error sending verification code:', {
            error,
            email: data.email,
            otp: data.otp,
          })
          throw error
        }
      },
      sendVerificationOnSignUp: true,
      otpLength: 6, // Explicitly set the OTP length
      expiresIn: 15 * 60, // 15 minutes in seconds
    }),
    genericOAuth({
      config: [
        {
          providerId: 'github-repo',
          clientId: process.env.GITHUB_CLIENT_ID as string,
          clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
          authorizationUrl: 'https://github.com/login/oauth/authorize',
          accessType: 'offline',
          prompt: 'consent',
          tokenUrl: 'https://github.com/login/oauth/access_token',
          userInfoUrl: 'https://api.github.com/user',
          scopes: ['user:email', 'repo'],
        },
        {
          providerId: 'github-workflow',
          clientId: process.env.GITHUB_CLIENT_ID as string,
          clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
          authorizationUrl: 'https://github.com/login/oauth/authorize',
          accessType: 'offline',
          tokenUrl: 'https://github.com/login/oauth/access_token',
          userInfoUrl: 'https://api.github.com/user',
          scopes: ['workflow', 'repo'],
          prompt: 'consent',
        },

        // Google providers for different purposes
        {
          providerId: 'google-email',
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          accessType: 'offline',
          scopes: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.labels',
          ],
          prompt: 'consent',
        },
        {
          providerId: 'google-calendar',
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          accessType: 'offline',
          scopes: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/calendar',
          ],
          prompt: 'consent',
        },
        {
          providerId: 'google-drive',
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          accessType: 'offline',
          scopes: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
          ],
          prompt: 'consent',
        },
        {
          providerId: 'google-docs',
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          accessType: 'offline',
          scopes: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive.file',
          ],
          prompt: 'consent',
        },
        {
          providerId: 'google-sheets',
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
          accessType: 'offline',
          scopes: [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ],
          prompt: 'consent',
        },

        // Supabase provider
        {
          providerId: 'supabase',
          clientId: process.env.SUPABASE_CLIENT_ID as string,
          clientSecret: process.env.SUPABASE_CLIENT_SECRET as string,
          authorizationUrl: 'https://api.supabase.com/v1/oauth/authorize',
          accessType: 'offline',
          tokenUrl: 'https://api.supabase.com/v1/oauth/token',
          userInfoUrl: 'https://api.supabase.com/v1/oauth/userinfo',
          scopes: ['database.read', 'database.write', 'projects.read'],
          responseType: 'code',
          pkce: true,
        },

        // X provider
        {
          providerId: 'x',
          clientId: process.env.X_CLIENT_ID as string,
          clientSecret: process.env.X_CLIENT_SECRET as string,
          authorizationUrl: 'https://x.com/i/oauth2/authorize',
          tokenUrl: 'https://api.x.com/2/oauth2/token',
          userInfoUrl: 'https://api.x.com/2/users/me',
          accessType: 'offline',
          scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
          pkce: true,
          redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/x`,
          getUserInfo: async (tokens) => {
            const response = await fetch(
              'https://api.x.com/2/users/me?user.fields=profile_image_url',
              {
                headers: {
                  Authorization: `Bearer ${tokens.accessToken}`,
                },
              }
            )

            const profile = await response.json()

            const now = new Date()

            return {
              id: profile.data.id,
              name: profile.data.name,
              email: profile.data.username || null, // Use username as email
              image: profile.data.profile_image_url,
              emailVerified: profile.data.verified || false,
              createdAt: now,
              updatedAt: now,
            }
          },
        },
      ],
    }),
  ],
  pages: {
    signIn: '/login',
    signUp: '/signup',
    error: '/error',
    verify: '/verify',
    verifyRequest: '/verify-request',
  },
})

// Server-side auth helpers
export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  })
}

export const signIn = auth.api.signInEmail
export const signUp = auth.api.signUpEmail
