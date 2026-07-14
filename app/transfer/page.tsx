import { requireCurrentUserForPage } from "@/lib/session";
import { TransferForm } from "@/components/TransferForm";

export default async function TransferPage() {
  await requireCurrentUserForPage();
  return <TransferForm />;
}
