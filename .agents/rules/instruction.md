---
trigger: always_on
---

## 7. Authentication & User Management
- **Library:** Use **Auth.js (v5)** for all authentication processes.
- **Security:** Sessions should be secure. Always hash passwords using `bcryptjs` before saving them to the database.
- **Server Actions:** Use the `auth()` function from Auth.js strictly within Server Components or Server Actions to verify user sessions before executing DB mutations.

## 8. PWA (Progressive Web App) Standards
- **Architecture:** The application must be fully PWA-compliant (installable, offline-capable).
- **Service Worker:** Use modern libraries like `@serwist/next` to generate and manage the service worker.
- **Manifest:** Use Next.js native Metadata API (`app/manifest.ts`) to generate the Web App Manifest dynamically.

## 9. UX, Error Handling & Loading States
- **Feedback:** Always provide visual feedback for user actions. Use Shadcn's `toast` (or Sonner) for success/error messages.
- **Async UI:** When fetching data or executing Server Actions, always implement loading states (e.g., using `useFormStatus` for forms, or React Suspense boundaries with generic Skeleton loaders).
- **Error Boundaries:** Use Next.js `error.tsx` files to gracefully catch and display unexpected errors without crashing the whole application.

## 10. Self-Correction & Build Integrity (NO BROKEN CODE)
- **Pre-Flight Checks:** Before concluding any task, ensure that your changes have not broken existing TypeScript types, imports, or React hooks in other files.
- **Terminal Usage:** If you have terminal access, ALWAYS run `npx tsc --noEmit` (or Next.js build) after modifying multiple files. 
- **Auto-Fix:** If you encounter build errors, TS errors, or linting errors, DO NOT stop and ask the user to fix them. Read the error log, understand the root cause, and fix the code autonomously until the check passes.