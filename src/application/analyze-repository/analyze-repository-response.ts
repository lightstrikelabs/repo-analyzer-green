import { z } from "zod";

import { ReportCardSchema } from "../../domain/report/report-card";
import type { AnalyzeRepositoryReportCardResult } from "./analyze-repository";

export const DashboardLanguageMixItemSchema = z
  .object({
    language: z.string().min(1),
    fileCount: z.number().int().min(0),
    sourceFileCount: z.number().int().min(0),
    textLineCount: z.number().int().min(0),
    codeLineCount: z.number().int().min(0),
    percentOfCode: z.number().min(0).max(100),
    evidenceReferenceIds: z.array(z.string().min(1)),
  })
  .strict();

export type DashboardLanguageMixItem = z.infer<
  typeof DashboardLanguageMixItemSchema
>;

export const DashboardCodeShapeSummarySchema = z
  .object({
    analyzedFileCount: z.number().int().min(0),
    sourceFileCount: z.number().int().min(0),
    testFileCount: z.number().int().min(0),
    documentationFileCount: z.number().int().min(0),
    largeFileCount: z.number().int().min(0),
    skippedFileCount: z.number().int().min(0),
    unsupportedFileCount: z.number().int().min(0),
    totalTextLineCount: z.number().int().min(0),
    totalCodeLineCount: z.number().int().min(0),
    totalDeferredWorkMarkerCount: z.number().int().min(0),
    totalBranchLikeTokenCount: z.number().int().min(0),
  })
  .strict();

export type DashboardCodeShapeSummary = z.infer<
  typeof DashboardCodeShapeSummarySchema
>;

export const DashboardInsightsSchema = z
  .object({
    evidenceSummary: z.string().min(1),
    languageMix: z.array(DashboardLanguageMixItemSchema),
    codeShapeSummary: DashboardCodeShapeSummarySchema,
  })
  .strict();

export type DashboardInsights = z.infer<typeof DashboardInsightsSchema>;

export const AnalyzeRepositoryResponseSchema = z
  .object({
    reportCard: ReportCardSchema,
    dashboardInsights: DashboardInsightsSchema,
  })
  .strict();

export type AnalyzeRepositoryResponse = z.infer<
  typeof AnalyzeRepositoryResponseSchema
>;

export function buildAnalyzeRepositoryResponse(
  result: AnalyzeRepositoryReportCardResult,
): AnalyzeRepositoryResponse {
  const codeShapeMetrics = result.evidenceBundle.languageCodeShapeMetrics;
  const totalCodeLineCount = Math.max(
    codeShapeMetrics.languageMix.reduce(
      (total, item) => total + item.codeLineCount,
      0,
    ),
    1,
  );

  return AnalyzeRepositoryResponseSchema.parse({
    reportCard: result.reportCard,
    dashboardInsights: {
      evidenceSummary: result.evidenceBundle.evidenceSummary,
      languageMix: codeShapeMetrics.languageMix.map((item) => ({
        language: item.language,
        fileCount: item.fileCount,
        sourceFileCount: item.sourceFileCount,
        textLineCount: item.textLineCount,
        codeLineCount: item.codeLineCount,
        percentOfCode: Math.round(
          (item.codeLineCount / totalCodeLineCount) * 100,
        ),
        evidenceReferenceIds: item.evidenceReferences.map(
          (reference) => reference.id,
        ),
      })),
      codeShapeSummary: codeShapeMetrics.summary,
    },
  });
}
