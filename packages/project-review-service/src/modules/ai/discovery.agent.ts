import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { defaultKeyPool } from './key-pool.manager.js';
import env from '../../shared/config/env.config.js';
import logger from '../../shared/config/logger.config.js';

export const PageCatalogItemSchema = z.object({
  filename: z.string().describe('File path of the page'),
  titleOrHeading: z.string().describe('Page title, <title> tag, or main heading'),
  purpose: z.string().describe('What this page contains and does'),
  layoutTechniques: z
    .array(z.string())
    .describe('e.g. Table layout, Flexbox, CSS Grid, Floats, Plain block'),
  keyTagsUsed: z
    .array(z.string())
    .describe('HTML tags actually used on this page (e.g. <table>, <audio>, <fieldset>, <div>)')
});

export const MediaAssetItemSchema = z.object({
  filename: z.string(),
  type: z.string().describe('Audio, Image, Video, Font, Icon, or Data'),
  integrationDetails: z
    .string()
    .describe('How it is referenced or integrated in the project markup/code')
});

export const ProjectDeepDiscoverySchema = z.object({
  primaryLanguage: z.string().describe('The primary programming/markup language detected'),
  detectedFrameworks: z
    .array(z.string())
    .describe('Frameworks, libraries, or technologies detected'),
  uiArchitecture: z.object({
    pageCount: z.number().describe('Number of HTML/frontend pages found'),
    pages: z.array(PageCatalogItemSchema).describe('Catalog of all pages found in the project'),
    stylingApproach: z
      .string()
      .describe(
        'How styling is implemented: e.g. Inline styles, External CSS, Tabular attributes, CSS Grid/Flexbox, None'
      ),
    visualAndMediaAssets: z
      .array(MediaAssetItemSchema)
      .describe('All multimedia and visual assets found in the project'),
    responsiveness: z
      .string()
      .describe('Responsive design implementation (viewport meta, media queries, fixed width)'),
    semanticStructureQuality: z
      .enum(['HIGH_SEMANTIC', 'MODERATE_SEMANTIC', 'GENERIC_DIVS_ONLY', 'INCOMPLETE'])
      .describe('Quality of semantic hierarchy')
  }),
  functionalityAndLogic: z.object({
    interactiveFeatures: z
      .array(z.string())
      .describe(
        'Interactive features: audio playback, quizzes, forms, navigation menus, modals, etc.'
      ),
    clientSideScripts: z
      .array(z.string())
      .describe('Scripts, event listeners, DOM manipulation found'),
    crossPageNavigation: z
      .boolean()
      .describe('Whether pages have functional inter-linking navigation'),
    formsAndInputsCount: z
      .number()
      .describe('Number of forms, inputs, buttons, or interactive controls')
  }),
  complexityAndScope: z.object({
    tier: z
      .enum([
        'COMPREHENSIVE_MULTI_PAGE',
        'MODERATE_MULTI_PAGE',
        'SUBSTANTIAL_SINGLE_PAGE',
        'ELEMENTARY_STARTER'
      ])
      .describe('Project scope category'),
    estimatedTotalLines: z.number().describe('Estimated total lines of code across all files'),
    fileCount: z.number().describe('Total files in the repository'),
    hasMultimedia: z
      .boolean()
      .describe('Whether repository contains audio, video, or rich multimedia assets'),
    technicalDepthScore: z
      .number()
      .min(0)
      .max(100)
      .describe('1-100 technical depth score reflecting implementation effort'),
    minorAspectsAndNuances: z
      .array(z.string())
      .describe(
        'Every minor detail, creative touch, easter egg, syntax defect (e.g. unclosed tags, audio autoplay, custom tables, unique themes)'
      )
  }),
  executiveSummary: z
    .string()
    .describe('Thorough multi-sentence summary of the entire project scope, UI, and functionality')
});

export type ProjectDeepDiscovery = z.infer<typeof ProjectDeepDiscoverySchema>;

export interface RawProjectInput {
  repoUrl: string;
  branch: string;
  allFilePaths: string[];
  allFilesContent: Record<string, string>;
  rawReadme?: string;
  languagesBreakdown?: Record<string, number>;
}

export class MistralDiscoveryAgent {
  /**
   * Deeply analyzes the whole project using Mistral + LangChain with structured output.
   * Scans every minor aspect: UI architecture, functionality, complexity, assets, and nuances.
   */
  public static async analyzeProject(
    submissionId: string,
    rawProject: RawProjectInput
  ): Promise<ProjectDeepDiscovery> {
    logger.info(
      { submissionId, repoUrl: rawProject.repoUrl, fileCount: rawProject.allFilePaths.length },
      'Starting Mistral Deep Project Discovery Agent'
    );

    const preferredModel = env.MISTRAL_MODEL || 'mistral-medium-latest';
    const candidateModels = Array.from(
      new Set([preferredModel, 'mistral-medium-latest', 'codestral-latest', 'open-mistral-7b'])
    );

    const systemPrompt = [
      'You are a senior technical architect and source-code inspector in the Project Review Engine.',
      'Your task is to conduct an EXHAUSTIVE, DEEP discovery analysis of an entire software repository.',
      '',
      '=== CRITICAL DISCOVERY MANDATES ===',
      '1. SCAN THE ENTIRE PROJECT, NOT JUST ENTRY POINTS:',
      '   - Examine every single file provided in `allFilesContent` and `allFilePaths`.',
      '   - Catalog every page, component, stylesheet, script, and asset.',
      '   - Detect the exact UI architecture: page titles, headings, layout techniques (tables vs flexbox vs grid), styling methods.',
      '   - Detect all functionality: audio controls, quizzes, forms, interactive buttons, cross-page navigation links.',
      '   - Uncover all minor aspects and nuances: creative touches, sound effects, meme themes, unclosed tags, syntax defects.',
      '',
      '2. GROUNDED TRUTHFULNESS & PRECISION:',
      '   - ONLY state elements, tags, or features that ACTUALLY exist in the provided file contents.',
      '   - If a project is only a solitary basic HTML file with <div> tags and an unclosed <p> tag, state that honestly in complexity and nuances.',
      '   - If a project is an ambitious 5-page website with 4 audio files and navigation tables, catalog all 5 pages and 4 audio files in detail.',
      '',
      '3. CATEGORIZE SCOPE ACCURATELY:',
      '   - COMPREHENSIVE_MULTI_PAGE: 3+ interconnected HTML pages, navigation, media assets, rich content.',
      '   - MODERATE_MULTI_PAGE: 2-3 pages with basic navigation.',
      '   - SUBSTANTIAL_SINGLE_PAGE: 1 page but deep, extensive content and sections.',
      '   - ELEMENTARY_STARTER: 1 basic file, 30-50 lines, generic divs, no navigation menu.'
    ].join('\n');

    // Prepare content payload with all files summarized or truncated cleanly if large
    const filesSummary: Record<string, { lines: number; snippet: string }> = {};
    for (const [filePath, content] of Object.entries(rawProject.allFilesContent)) {
      const lines = content.split('\n').length;
      // Provide generous content snapshot per file (up to 4000 chars each)
      filesSummary[filePath] = {
        lines,
        snippet: content.length > 4000 ? content.slice(0, 4000) + '\n... [TRUNCATED]' : content
      };
    }

    const payload = {
      repository: rawProject.repoUrl,
      branch: rawProject.branch,
      totalFilesCount: rawProject.allFilePaths.length,
      allFilePaths: rawProject.allFilePaths,
      languagesBreakdown: rawProject.languagesBreakdown || {},
      filesContentCatalog: filesSummary,
      rawReadmePreview: rawProject.rawReadme ? rawProject.rawReadme.slice(0, 2000) : ''
    };

    if (defaultKeyPool.hasKeys()) {
      for (const modelName of candidateModels) {
        const { model, selectedKey } = defaultKeyPool.getChatMistralInstance({
          modelName,
          temperature: 0.1,
          maxRetries: 1
        });

        try {
          logger.info(
            { submissionId, model: modelName },
            'Invoking LangChain ChatMistralAI Discovery Agent'
          );
          const structuredModel = model.withStructuredOutput(ProjectDeepDiscoverySchema);

          const result = await structuredModel.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(
              `Perform exhaustive whole-project discovery on this repository:\n${JSON.stringify(payload, null, 2)}`
            )
          ]);

          defaultKeyPool.reportSuccess(selectedKey);
          logger.info(
            {
              submissionId,
              tier: result.complexityAndScope.tier,
              pages: result.uiArchitecture.pageCount
            },
            'Mistral Deep Project Discovery completed successfully'
          );
          return result;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn(
            { model: modelName, err: errMsg },
            'Mistral Discovery Agent invocation failed for model, testing next'
          );
          if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Rate limit')) {
            defaultKeyPool.reportRateLimit(selectedKey, 30000);
          }
        }
      }
    }

    // Deterministic fallback if Mistral is unavailable
    logger.warn({ submissionId }, 'Using deterministic whole-project discovery fallback');
    return this.buildDeterministicDiscovery(rawProject);
  }

  /**
   * Deterministic whole-project discovery fallback if AI is unreachable.
   */
  private static buildDeterministicDiscovery(rawProject: RawProjectInput): ProjectDeepDiscovery {
    const filePaths = rawProject.allFilePaths;
    const htmlFiles = filePaths.filter((p) => p.endsWith('.html') || p.endsWith('.htm'));
    const mediaFiles = filePaths.filter((p) =>
      ['.mp3', '.wav', '.ogg', '.png', '.jpg', '.jpeg', '.gif', '.svg'].some((ext) =>
        p.toLowerCase().endsWith(ext)
      )
    );

    const isMultiPage = htmlFiles.length >= 2;
    const hasAudio = filePaths.some((p) => p.endsWith('.mp3') || p.endsWith('.wav'));
    const allContent = Object.values(rawProject.allFilesContent).join('\n');
    const totalLines = allContent.split('\n').length;

    const tier =
      htmlFiles.length >= 3 || (htmlFiles.length >= 2 && hasAudio)
        ? 'COMPREHENSIVE_MULTI_PAGE'
        : htmlFiles.length >= 2
          ? 'MODERATE_MULTI_PAGE'
          : totalLines > 150
            ? 'SUBSTANTIAL_SINGLE_PAGE'
            : 'ELEMENTARY_STARTER';

    const pages = htmlFiles.map((hf) => {
      const content = rawProject.allFilesContent[hf] || '';
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const usesTable = /<table/i.test(content);
      const usesAudio = /<audio/i.test(content);
      const tags: string[] = [];
      if (usesTable) tags.push('<table>');
      if (usesAudio) tags.push('<audio>');
      if (/<header/i.test(content)) tags.push('<header>');
      if (/<nav/i.test(content)) tags.push('<nav>');
      if (/<div/i.test(content)) tags.push('<div>');
      if (/<fieldset/i.test(content)) tags.push('<fieldset>');

      return {
        filename: hf,
        titleOrHeading: titleMatch?.[1]?.trim() || h1Match?.[1]?.trim() || hf,
        purpose: `Page content file containing ${content.split('\n').length} lines.`,
        layoutTechniques: usesTable ? ['Table Layout', 'Block flow'] : ['Generic Div flow'],
        keyTagsUsed: tags.length > 0 ? tags : ['<div>', '<h1>', '<p>']
      };
    });

    const mediaAssets = mediaFiles.map((mf) => {
      const ext = mf.slice(mf.lastIndexOf('.')).toLowerCase();
      const type = ['.mp3', '.wav', '.ogg'].includes(ext) ? 'Audio' : 'Image';
      return {
        filename: mf,
        type,
        integrationDetails: `Referenced in repository file catalog as ${type} asset.`
      };
    });

    const minorNuances: string[] = [];
    if (/<p[^>]*>[^<]*<h[1-6]/i.test(allContent)) {
      minorNuances.push('Syntax defect: unclosed <p> tag immediately preceding a heading element.');
    }
    if (/<audio/i.test(allContent)) {
      minorNuances.push(
        'Rich multimedia: embedded HTML5 <audio> playback elements with custom tracks.'
      );
    }
    if (htmlFiles.some((f) => f.includes('/'))) {
      minorNuances.push('Repository organization: HTML documents nested in subdirectories.');
    }

    return {
      primaryLanguage: htmlFiles.length > 0 ? 'HTML' : 'Generic Code',
      detectedFrameworks: ['HTML5 / Web'],
      uiArchitecture: {
        pageCount: htmlFiles.length,
        pages,
        stylingApproach: /style=/i.test(allContent)
          ? 'Inline styling & presentation attributes'
          : 'Basic styling',
        visualAndMediaAssets: mediaAssets,
        responsiveness: /<meta[^>]*viewport/i.test(allContent)
          ? 'Configured Viewport'
          : 'Default / Fixed',
        semanticStructureQuality: /<header|<nav|<main/i.test(allContent)
          ? 'MODERATE_SEMANTIC'
          : htmlFiles.length > 1
            ? 'MODERATE_SEMANTIC'
            : 'GENERIC_DIVS_ONLY'
      },
      functionalityAndLogic: {
        interactiveFeatures: hasAudio
          ? ['Audio player playback controls', 'Cross-page navigation links']
          : ['Static presentation'],
        clientSideScripts: /<script/i.test(allContent)
          ? ['Client-side script tags detected']
          : ['None / Pure HTML markup'],
        crossPageNavigation: isMultiPage && /href="[^"]*\.html"/i.test(allContent),
        formsAndInputsCount: (allContent.match(/<(input|form|button|select)/gi) || []).length
      },
      complexityAndScope: {
        tier,
        estimatedTotalLines: totalLines,
        fileCount: filePaths.length,
        hasMultimedia: mediaAssets.length > 0,
        technicalDepthScore:
          tier === 'COMPREHENSIVE_MULTI_PAGE'
            ? 90
            : tier === 'MODERATE_MULTI_PAGE'
              ? 75
              : tier === 'SUBSTANTIAL_SINGLE_PAGE'
                ? 60
                : 42,
        minorAspectsAndNuances: minorNuances
      },
      executiveSummary: `Project contains ${filePaths.length} files with ${htmlFiles.length} HTML page(s) totaling ~${totalLines} lines of code. Scope evaluated as ${tier}.`
    };
  }
}

export default MistralDiscoveryAgent;
