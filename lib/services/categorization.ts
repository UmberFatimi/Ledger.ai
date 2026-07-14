import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  SchemaType,
} from "@google/generative-ai";
import { prisma } from "../prisma";
import { CATEGORIES } from "../categories";
import type { Category } from "../generated/prisma/client";

const MODEL_NAME = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, " ");
}

async function findCorrection(
  userId: string,
  description: string,
): Promise<Category | null> {
  const normalized = normalizeDescription(description);

  const exact = await prisma.categoryCorrection.findUnique({
    where: {
      userId_descriptionPattern: { userId, descriptionPattern: normalized },
    },
  });
  if (exact) return exact.category;

  const corrections = await prisma.categoryCorrection.findMany({
    where: { userId },
  });
  for (const correction of corrections) {
    if (
      normalized.includes(correction.descriptionPattern) ||
      correction.descriptionPattern.includes(normalized)
    ) {
      return correction.category;
    }
  }
  return null;
}

let genAIClient: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    genAIClient = new GoogleGenerativeAI(apiKey);
  }
  return genAIClient;
}

async function callGeminiForCategory(
  description: string,
  amountCents: number,
): Promise<{ category: Category; source: "LLM" | "FALLBACK" }> {
  const model = getClient().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          category: {
            type: SchemaType.STRING,
            format: "enum",
            enum: CATEGORIES,
          },
        },
        required: ["category"],
      },
    },
  });

  const prompt = [
    "Classify this bank transaction into exactly one category based on its description and amount.",
    `Description: "${description}"`,
    `Amount: $${(amountCents / 100).toFixed(2)}`,
    'Use "OTHER" only if none of the other categories genuinely fit.',
  ].join("\n");

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as { category: string };
      const category = CATEGORIES.includes(parsed.category as Category)
        ? (parsed.category as Category)
        : "OTHER";
      return { category, source: "LLM" };
    } catch (err) {
      lastError = err;
      const isRateLimit =
        err instanceof GoogleGenerativeAIFetchError && err.status === 429;
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      break;
    }
  }

  console.error(
    "Gemini categorization failed, falling back to OTHER:",
    lastError,
  );
  return { category: "OTHER", source: "FALLBACK" };
}

export async function categorizeTransaction(
  transactionId: string,
  userId: string,
  description: string,
  amountCents: number,
): Promise<void> {
  const corrected = await findCorrection(userId, description);
  if (corrected) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { category: corrected, categorySource: "PATTERN_MATCH" },
    });
    return;
  }

  const { category, source } = await callGeminiForCategory(
    description,
    amountCents,
  );
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { category, categorySource: source },
  });
}

export async function correctTransactionCategory(
  transactionId: string,
  userId: string,
  category: Category,
): Promise<void> {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
  });
  const normalized = normalizeDescription(transaction.description);

  await prisma.$transaction([
    prisma.categoryCorrection.upsert({
      where: {
        userId_descriptionPattern: { userId, descriptionPattern: normalized },
      },
      create: { userId, descriptionPattern: normalized, category },
      update: { category },
    }),
    prisma.transaction.update({
      where: { id: transactionId },
      data: { category, categorySource: "MANUAL_CORRECTION" },
    }),
  ]);
}
