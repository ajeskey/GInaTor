import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import TicketDetails from "@/components/support/TicketDetails";
import TicketReplyContent from "@/components/support/TicketReplyContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Support Reply | GInaTor - GInaTor",
  description:
    "This is Next.js Support Reply for GInaTor - GInaTor",
};

export default function SupportReply() {
  return (
    <div className="overflow-hidden xl:h-[calc(100vh-180px)]">
      <PageBreadcrumb pageTitle="Support Reply" />
      <div className="grid h-full grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 2xl:col-span-9">
          <TicketReplyContent />
        </div>
        <div className="xl:col-span-4 2xl:col-span-3">
          <TicketDetails />
        </div>
      </div>
    </div>
  );
}
