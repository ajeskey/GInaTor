import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SupportTicketsList from "@/components/support/SupportList";
import SupportMetrics from "@/components/support/SupportMetrics";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Support List | GInaTor - GInaTor",
  description:
    "This is Next.js Support List for GInaTor - GInaTor",
};

export default function SupportListPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Support List" />
      <SupportMetrics />
      <SupportTicketsList />
    </div>
  );
}
