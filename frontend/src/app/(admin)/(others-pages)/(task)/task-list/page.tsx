import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import TaskList from "@/components/task/task-list/TaskList";

export const metadata: Metadata = {
  title: "Next.js Task List | GInaTor - GInaTor",
  description:
    "This is Next.js Task List page for GInaTor - GInaTor",
  // other metadata
};

export default function TaskListPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Task List" />
      <TaskList />
    </div>
  );
}
