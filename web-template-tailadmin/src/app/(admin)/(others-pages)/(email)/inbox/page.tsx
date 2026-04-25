import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import EmailContent from "@/components/email/EmailInbox/EmailContent";
import EmailSidebar from "@/components/email/EmailSidebar/EmailSidebar";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Inbox | GInaTor - GInaTor",
  description:
    "This is Next.js Inbox page for GInaTor - GInaTor",
};

export default function Inbox() {
  return (
    <div className="">
      <PageBreadcrumb pageTitle="Inbox" />
      <div className="sm:h-[calc(100vh-174px)] h-screen xl:h-[calc(100vh-186px)">
        <div className="xl:grid xl:grid-cols-12 flex flex-col gap-5 sm:gap-5">
          <div className="xl:col-span-3 col-span-full">
            <EmailSidebar />
          </div>
          <EmailContent />
        </div>
      </div>
    </div>
  );
}
