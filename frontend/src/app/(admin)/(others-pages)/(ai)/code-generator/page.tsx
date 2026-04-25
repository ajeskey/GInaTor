import AiLayout from "@/components/ai/AiLayout";
import AiPageBreadcrumb from "@/components/ai/AiPageBreadcrumb";
import CodeGeneratorContent from "@/components/ai/CodeGeneratorContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Next.js AI Code Generator | GInaTor - GInaTor",
  description:
    "This is Next.js AI Code Generator page for GInaTor - GInaTor",
};

export default function CodeGeneratorPage() {
  return (
    <div>
      <AiPageBreadcrumb pageTitle="Code Generator" />
      <AiLayout>
        <CodeGeneratorContent />
      </AiLayout>
    </div>
  );
}
