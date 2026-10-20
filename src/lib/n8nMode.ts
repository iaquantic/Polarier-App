// URL activa del webhook n8n, decidida por variable de entorno en BUILD time.
//
// VITE_N8N_MODE=prod|test  -> elige cuál de las dos URLs usar (por defecto 'prod').
// Se controla desde Easypanel (Environment) + Rebuild. Ningún usuario puede
// cambiarlo desde la app.

const PROD_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string;
const TEST_URL = (import.meta.env.VITE_N8N_WEBHOOK_URL_TEST as string) || PROD_URL;

const MODE = (import.meta.env.VITE_N8N_MODE as string) === 'test' ? 'test' : 'prod';

export const getN8nWebhookUrl = (): string => {
  return MODE === 'test' ? TEST_URL : PROD_URL;
};

// Webhook dedicado para el envío de informes por correo (flujo n8n aparte).
const EMAIL_PROD_URL = (import.meta.env.VITE_N8N_EMAIL_WEBHOOK_URL as string) || '';
const EMAIL_TEST_URL = (import.meta.env.VITE_N8N_EMAIL_WEBHOOK_URL_TEST as string) || EMAIL_PROD_URL;

export const getN8nEmailWebhookUrl = (): string => {
  return MODE === 'test' ? EMAIL_TEST_URL : EMAIL_PROD_URL;
};

// Base de los webhooks de las automatizaciones (un trigger por rama en el mismo
// workflow del chat). Una sola variable para todas: el path de cada una vive en
// el catálogo, `src/lib/automatizaciones.ts`.
//
// Si no está definida, se deduce de la URL del chat recortando su path, para que
// un despliegue viejo no se quede sin la sección.
const deducirBase = (url: string, modo: 'prod' | 'test'): string => {
  const marca = modo === 'test' ? '/webhook-test/' : '/webhook/';
  const i = url.indexOf(marca);
  return i === -1 ? '' : url.slice(0, i + marca.length - 1);
};

const AUTO_PROD_BASE = (import.meta.env.VITE_N8N_WEBHOOK_BASE as string) || deducirBase(PROD_URL || '', 'prod');
const AUTO_TEST_BASE = (import.meta.env.VITE_N8N_WEBHOOK_BASE_TEST as string) || deducirBase(TEST_URL || '', 'test') || AUTO_PROD_BASE;

export const getAutomationWebhookUrl = (path: string): string => {
  const base = MODE === 'test' ? AUTO_TEST_BASE : AUTO_PROD_BASE;
  if (!base) throw new Error('No hay webhook de automatizaciones configurado (VITE_N8N_WEBHOOK_BASE)');
  return `${base.replace(/\/$/, '')}/${path}`;
};
