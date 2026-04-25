import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ButtonGroupWithLeftIcon from "@/components/ui/buttons-group/ButtonGroupWithLeftIcon";
import ButtonGroupWithRightIcon from "@/components/ui/buttons-group/ButtonGroupWithRightIcon";
import PrimaryButtonGroup from "@/components/ui/buttons-group/PrimaryButtonGroup";
import SecondaryButtonGroup from "@/components/ui/buttons-group/SecondaryButtonGroup";
import SecondaryButtonGroupWithLeftIcon from "@/components/ui/buttons-group/SecondaryButtonGroupWithLeftIcon";
import SecondaryButtonGroupWithRightIcon from "@/components/ui/buttons-group/SecondaryButtonGroupWithRightIcon";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js Button Groups | GInaTor - GInaTor",
  description:
    "This is Next.js Button Groups page for GInaTor - GInaTor",
};

export default function ButtonsGroupPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Buttons Group" />
      <div className="space-y-5 sm:space-y-6">
        <ComponentCard title="Primary Button Group">
          <PrimaryButtonGroup />
        </ComponentCard>
        <ComponentCard title="Primary Button Group with Left Icon">
          <ButtonGroupWithLeftIcon />
        </ComponentCard>
        <ComponentCard title="Primary Button Group with Right Icon">
          <ButtonGroupWithRightIcon />
        </ComponentCard>
        <ComponentCard title="Secondary Button Group">
          <SecondaryButtonGroup />
        </ComponentCard>
        <ComponentCard title="Secondary Button Group with Left Icon">
          <SecondaryButtonGroupWithLeftIcon />
        </ComponentCard>
        <ComponentCard title="Secondary Button Group with Right Icon">
          <SecondaryButtonGroupWithRightIcon />
        </ComponentCard>
      </div>
    </div>
  );
}
