import { Category } from "./generated/prisma/client";

export const CATEGORIES: Category[] = [
  "FOOD_DINING",
  "TRANSPORT",
  "BILLS",
  "SHOPPING",
  "ENTERTAINMENT",
  "SALARY",
  "TRANSFERS",
  "OTHER",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  FOOD_DINING: "Food & Dining",
  TRANSPORT: "Transport",
  BILLS: "Bills",
  SHOPPING: "Shopping",
  ENTERTAINMENT: "Entertainment",
  SALARY: "Salary",
  TRANSFERS: "Transfers",
  OTHER: "Other",
};
