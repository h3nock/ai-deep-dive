import type { ReactNode } from "react";
import {
  BookOpen,
  Code2,
  Cpu,
  Image as ImageIcon,
  Terminal,
} from "lucide-react";

export type CoursePhase = {
  title: string;
  description: string;
  stepRange: [number, number];
  icon: ReactNode;
};

export type CourseConfig = {
  id: string;
  title: string;
  description: string;
  outcome: string | string[];
  prerequisites: string[];
  phases: CoursePhase[];
  status: "available" | "coming-soon" | "planned";
  tags: string[];
  heroIcon: ReactNode;
};

export const courseConfig: Record<string, CourseConfig> = {
  "build-chatgpt": {
    id: "build-chatgpt",
    title: "Build ChatGPT from Scratch",
    description:
      "From raw text to a working GPT. You'll implement every component of a transformer-based language model from the ground up.",
    outcome: [
      "An encoder-decoder Transformer that translates between languages",
      "A decoder-only GPT that generates text, trained on FineWeb-Edu",
    ],
    prerequisites: [
      "Python proficiency",
      "Linear algebra fundamentals",
      "Basic PyTorch",
      "Neural network basics",
    ],
    phases: [
      {
        title: "Foundations",
        description: "How text becomes numbers for neural networks.",
        stepRange: [0, 4.99],
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        title: "The Transformer",
        description:
          "Build the architecture that powers modern LLMs, then use it to build a translator.",
        stepRange: [5, 10.99],
        icon: <Cpu className="w-4 h-4" />,
      },
      {
        title: "GPT",
        description: "Go decoder-only and build a text-generating GPT.",
        stepRange: [11, 12.99],
        icon: <Code2 className="w-4 h-4" />,
      },
    ],
    status: "available",
    tags: ["Transformers", "PyTorch", "GPT"],
    heroIcon: <Terminal className="w-5 h-5" />,
  },
  "diffusion-from-scratch": {
    id: "diffusion-from-scratch",
    title: "Diffusion from Scratch",
    description:
      "Build an image generator from pure noise. Understand how Stable Diffusion actually works.",
    outcome:
      "A functional diffusion pipeline you assembled end-to-end, with intuition for every moving part.",
    prerequisites: [
      "Python proficiency",
      "Deep learning basics",
      "Familiarity with convolutions",
    ],
    phases: [],
    status: "planned",
    tags: ["Generative", "Vision", "U-Net"],
    heroIcon: <ImageIcon className="w-5 h-5" />,
  },
};

export function getCourseConfig(courseId: string) {
  return courseConfig[courseId];
}

export const courseList = Object.values(courseConfig);
