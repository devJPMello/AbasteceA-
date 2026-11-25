import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Env } from './config/env';

/** Shared by main.ts and the e2e tests so both run the exact same app configuration. */
export function setupApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.useLogger(app.get(Logger));
  // Security headers (nosniff, frame protection, HSTS, no X-Powered-By...). CSP is off on purpose:
  // this is a JSON API, and Swagger UI at /docs needs inline scripts. The web app sets its own
  // headers (apps/web/public/_headers).
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  );
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }).split(',') });
  app.enableShutdownHooks();
  // Without this, behind a proxy every request appears to come from the proxy's IP and the
  // rate limiter would throttle all users together.
  if (config.get('TRUST_PROXY', { infer: true })) {
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void }).set(
      'trust proxy',
      1,
    );
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Bomba Certa API')
      .setDescription('Mapa colaborativo de preços de combustível em Palmas-TO')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));
}
