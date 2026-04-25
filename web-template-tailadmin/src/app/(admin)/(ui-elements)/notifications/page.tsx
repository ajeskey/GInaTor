import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import NotificationExample from "@/components/ui/notification/NotificationExample";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Notifications | GInaTor - GInaTor",
  description:
    "This is Next.js Notifications page for GInaTor - GInaTor",
};

export default function Notifications() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Notifications" />
      <NotificationExample />
    </div>
  );
}
