import { notFound } from "next/navigation";

import {
  getAllPosts,
  getPostBySlug,
  listCollections,
  type PostData,
} from "@/lib/posts";
import { isSafePathSegment } from "@/lib/path-safety";

export interface LessonPageData {
  post: PostData;
  prevPost: Omit<PostData, "content"> | null;
  nextPost: Omit<PostData, "content"> | null;
}

export interface LessonParams {
  courseId: string;
  slug: string;
}

export interface LessonChallengeRouteParams extends LessonParams {
  challengeId: string;
}

export function listLessonParams(): LessonParams[] {
  const collections = listCollections();
  let params: LessonParams[] = [];

  for (const courseId of collections) {
    const posts = getAllPosts(courseId);
    params = params.concat(
      posts.map((post) => ({
        courseId,
        slug: post.slug,
      }))
    );
  }

  return params;
}

export async function listLessonChallengeParams(): Promise<LessonParams[]> {
  const lessonParams = listLessonParams();
  const posts = await Promise.all(
    lessonParams.map(async (params) => ({
      params,
      post: await getPostBySlug(params.courseId, params.slug),
    }))
  );

  return posts
    .filter(({ post }) => (post?.challenges?.length ?? 0) > 0)
    .map(({ params }) => params);
}

export async function listLessonChallengeRouteParams(): Promise<LessonChallengeRouteParams[]> {
  const lessonParams = listLessonParams();
  const posts = await Promise.all(
    lessonParams.map(async (params) => ({
      params,
      post: await getPostBySlug(params.courseId, params.slug),
    }))
  );

  const challengeRouteParams: LessonChallengeRouteParams[] = [];
  for (const { params, post } of posts) {
    for (const challenge of post?.challenges ?? []) {
      challengeRouteParams.push({
        ...params,
        challengeId: challenge.id,
      });
    }
  }

  return challengeRouteParams;
}

export async function getLessonPageData(
  courseId: string,
  slug: string
): Promise<LessonPageData> {
  if (!isSafePathSegment(courseId) || !isSafePathSegment(slug)) {
    notFound();
  }

  const post = await getPostBySlug(courseId, slug);
  if (!post) {
    notFound();
  }

  const allPosts = getAllPosts(courseId);
  const currentIndex = allPosts.findIndex((entry) => entry.slug === post.slug);

  if (currentIndex < 0) {
    notFound();
  }

  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const nextPost =
    currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  return {
    post,
    prevPost,
    nextPost,
  };
}

export function getChallengeIndexById(
  challengeId: string,
  challenges: PostData["challenges"]
): number {
  if (!isSafePathSegment(challengeId)) {
    notFound();
  }

  if (!challenges || challenges.length === 0) {
    notFound();
  }

  const challengeIndex = challenges.findIndex(
    (challenge) => challenge.id === challengeId
  );
  if (challengeIndex < 0) {
    notFound();
  }

  return challengeIndex;
}
