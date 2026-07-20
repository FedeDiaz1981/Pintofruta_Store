import { connection } from "next/server";
import { getAdminPanelViewModel } from "@/application/admin";
import { AdminWorkspace } from "@/components/admin/admin-workspace";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function AdminPage() {
  await connection();
  const model = await getAdminPanelViewModel();

  return <AdminWorkspace model={model} />;
}
