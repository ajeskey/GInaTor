import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import NotificationExample from "@/components/ui/notification/NotificationExample";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Notifications | GInaTor - Next.js Dashboard Template",
  description:
    "This is Next.js Notifications page for GInaTor - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function Notifications() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Notifications" />
      <NotificationExample />
    </div>
  );
}
