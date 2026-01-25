import type { ReactNode } from "react";
import {
  BookOpen,
  Code2,
  Cpu,
  Search,
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
  "build-gpt": {
    id: "build-gpt",
    title: "Build GPT from Scratch",
    description:
      "From raw text to a working GPT. You'll implement every component of a transformer-based language model from the ground up.",
    outcome: [
      "The complete Transformer architecture, built layer by layer",
      "Your own language model that generates text like ChatGPT",
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
        title: "The Transformer Core",
        description:
          "Build attention, feed-forward networks, and the transformer block.",
        stepRange: [5, 9.99],
        icon: <Cpu className="w-4 h-4" />,
      },
      {
        title: "Project GPT",
        description: "Build, train, and generate text with your own language model.",
        stepRange: [10, 10.99],
        icon: <Code2 className="w-4 h-4" />,
      },
    ],
    status: "available",
    tags: ["Transformers", "PyTorch", "GPT"],
    heroIcon: <Terminal className="w-5 h-5" />,
  },
  "mech-interp": {
    id: "mech-interp",
    title: "Mechanistic Interpretability",
    description:
      "Reverse-engineer neural networks. Dissect transformers layer by layer, neuron by neuron.",
    outcome:
      "The tools and intuition to analyze transformer internals and understand how they represent knowledge.",
    prerequisites: [
      "Python proficiency",
      "Transformer architecture basics",
      "PyTorch fundamentals",
    ],
    phases: [],
    status: "coming-soon",
    tags: ["Interpretability", "Transformers", "Research"],
    heroIcon: <Search className="w-5 h-5" />,
  },
};

export function getCourseConfig(courseId: string) {
  return courseConfig[courseId];
}

export const courseList = Object.values(courseConfig);
