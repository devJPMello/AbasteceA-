import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { Env } from './config/env';

/** Shared by main.ts and the e2e tests so both run the exact same app configuration. */
export function setupApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.useLogger(app.get(Logger));
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }).split(',') });
  app.enableShutdownHooks();

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
