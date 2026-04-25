import ApiKeyTable from "@/components/api-keys/ApiKeyTable";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js API Keys Page | GInaTor - GInaTor",
  description: "This is Next.js API Keys Page GInaTor GInaTor",
};

export default function ApiKeysPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="API Keys" />
      <ApiKeyTable />
    </div>
  );
}
