/** Build-time guard. It checks configuration presence/consistency, not live credentials. */
export function deploymentErrors(env) {
  if (env.NODE_ENV !== 'production' || env.SMARTFIT_DEPLOYMENT === 'demo') return [];
  const errors = [];
  for (const key of [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST',
  ]) {
    if (env[key]) errors.push(`${key} must not be set on a real production deployment.`);
  }
  for (const key of [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]) {
    if (!env[key]?.trim()) errors.push(`${key} is required.`);
  }
  const publicProject = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  let adminProject = env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  if (env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim()) {
    try {
      const service = JSON.parse(env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
      if (!service?.private_key && !service?.privateKey)
        errors.push('Service account private key is required.');
      if (!service?.client_email && !service?.clientEmail)
        errors.push('Service account client email is required.');
      const serviceProject = service?.project_id ?? service?.projectId;
      if (!serviceProject || serviceProject !== publicProject)
        errors.push('Service account and public Firebase project must match.');
      adminProject = adminProject || serviceProject;
    } catch {
      errors.push('FIREBASE_ADMIN_SERVICE_ACCOUNT must be valid JSON.');
    }
  } else if (env.SMARTFIT_ADMIN_ADC === 'true') {
    adminProject = adminProject || env.GOOGLE_CLOUD_PROJECT?.trim();
  } else {
    if (!env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim())
      errors.push('FIREBASE_ADMIN_CLIENT_EMAIL is required (or explicitly configure ADC).');
    if (!env.FIREBASE_ADMIN_PRIVATE_KEY?.trim())
      errors.push('FIREBASE_ADMIN_PRIVATE_KEY is required (or explicitly configure ADC).');
  }
  if (!adminProject || adminProject !== publicProject)
    errors.push('Admin and public Firebase project IDs must match.');
  return errors;
}
