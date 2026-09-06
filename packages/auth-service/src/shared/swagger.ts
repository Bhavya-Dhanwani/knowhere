import { Express, Request, Response, NextFunction } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { openApiDocument } from './openapi.js';

export function setupSwagger(app: Express) {
  // Expose raw OpenAPI 3.1 JSON specification
  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiDocument);
  });

  app.get('/api/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiDocument);
  });

  // Scalar interactive API reference handler
  const scalarHandler = apiReference({
    spec: {
      content: openApiDocument
    },
    theme: 'purple',
    pageTitle: 'Knowhere LMS API Documentation',
    defaultHttpClient: {
      targetKey: 'js',
      clientKey: 'fetch'
    }
  });

  const docsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Prevent Helmet from blocking Scalar stylesheets, scripts, and web fonts
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    return (scalarHandler as any)(req, res, next);
  };

  app.use('/docs', docsMiddleware);
  app.use('/api/docs', docsMiddleware);
}
