import { listLessonParams } from "@/lib/lesson-page-data";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return listLessonParams();
}

export default function StepPage() {
  return null;
}
