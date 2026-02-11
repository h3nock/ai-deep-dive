import {
  listLessonChallengeParams,
} from "@/lib/lesson-page-data";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export async function generateStaticParams() {
  return listLessonChallengeParams();
}

export default function ChallengeListPage() {
  return null;
}
