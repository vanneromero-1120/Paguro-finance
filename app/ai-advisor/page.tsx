import { redirect } from 'next/navigation';

// ============================================================================
// Paguro Finance V1 - Production Route Guard
// AI Advisor module moved to Version 2 scope.
// Redirects to Dashboard to ensure zero visible AI module in V1 production UI.
// ============================================================================

export default function AiAdvisorPage() {
  redirect('/dashboard');
}
