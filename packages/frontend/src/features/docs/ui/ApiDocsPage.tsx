import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../../shared/ui/Logo';

export const ApiDocsPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load Scalar standalone bundle from CDN
    const existingScript = document.getElementById('scalar-bundle-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'scalar-bundle-script';
      script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
      script.async = true;
      script.onload = () => {
        if ((window as any).Scalar && containerRef.current) {
          (window as any).Scalar.createApiReference(containerRef.current, {
            spec: {
              url: '/openapi.json'
            },
            theme: 'purple',
            pageTitle: 'Knowhere LMS API Reference',
            defaultHttpClient: {
              targetKey: 'js',
              clientKey: 'fetch'
            }
          });
        }
      };
      document.head.appendChild(script);
    } else if ((window as any).Scalar && containerRef.current) {
      (window as any).Scalar.createApiReference(containerRef.current, {
        spec: {
          url: '/openapi.json'
        },
        theme: 'purple',
        pageTitle: 'Knowhere LMS API Reference',
        defaultHttpClient: {
          targetKey: 'js',
          clientKey: 'fetch'
        }
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0e13] text-white flex flex-col">
      {/* Top Banner Navigation */}
      <header className="h-14 bg-surface/80 backdrop-blur-md border-b border-white/10 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/dashboard">
            <Logo size="sm" />
          </Link>
          <span className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            Interactive API Specs (Scalar 3.1)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <a
            href="/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white border border-white/10 transition-colors flex items-center gap-1.5"
          >
            <span>Raw JSON Spec</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Scalar Container */}
      <div className="flex-1 w-full" ref={containerRef} id="scalar-api-reference-container">
        <div className="p-12 text-center text-muted text-sm animate-pulse">
          Loading Scalar API Reference...
        </div>
      </div>
    </div>
  );
};
