import { getAdminPanelViewModel } from "@/application/admin";
import { AdminWorkspace } from "@/components/admin/admin-workspace";

export default async function AdminPage() {
  const model = await getAdminPanelViewModel();

  return <AdminWorkspace model={model} />;
}

