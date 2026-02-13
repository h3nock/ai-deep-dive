import dynamic from "next/dynamic";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { Action } from "@/components/mdx/Action";
import { ByteStream } from "@/components/mdx/ByteStream";
import { Callout } from "@/components/mdx/Callout";
import { ComingSoon } from "@/components/mdx/ComingSoon";
import { Command } from "@/components/mdx/Command";
import { Description } from "@/components/mdx/Description";
import { ProcessTimeline } from "@/components/mdx/ProcessTimeline";
import { ProjectRoadmap } from "@/components/mdx/ProjectRoadmap";
import { SplitLayout } from "@/components/mdx/SplitLayout";
import { Step } from "@/components/mdx/Step";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/mdx/Table";
import { ThinkingProcess } from "@/components/mdx/ThinkingProcess";

const FrequencyWaves = dynamic(() =>
    import("@/components/mdx/FrequencyWaves").then((mod) => mod.FrequencyWaves)
);
const BinaryVsSmooth = dynamic(() =>
    import("@/components/mdx/BinaryVsSmooth").then((mod) => mod.BinaryVsSmooth)
);
const RotationVisualization = dynamic(() =>
    import("@/components/mdx/RotationVisualization").then(
        (mod) => mod.RotationVisualization
    )
);
const EmbeddingSpace = dynamic(() =>
    import("@/components/mdx/EmbeddingSpace").then((mod) => mod.EmbeddingSpace)
);
const LiveByteInspector = dynamic(() =>
    import("@/components/mdx/LiveByteInspector").then(
        (mod) => mod.LiveByteInspector
    )
);
const EncodingCompare = dynamic(() =>
    import("@/components/mdx/EncodingCompare").then((mod) => mod.EncodingCompare)
);
const NormalizedStepSize = dynamic(() =>
    import("@/components/mdx/NormalizedStepSize").then(
        (mod) => mod.NormalizedStepSize
    )
);

const components = {
    SplitLayout,
    Step,
    Description,
    Action,
    Command,
    ProjectRoadmap,
    ThinkingProcess,
    EmbeddingSpace,
    Callout,
    ByteStream,
    table: Table,
    thead: TableHead,
    tbody: TableBody,
    tr: TableRow,
    th: TableHeader,
    td: TableCell,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableHeader,
    TableCell,
    ComingSoon,
    ProcessTimeline,
    LiveByteInspector,
    EncodingCompare,
    FrequencyWaves,
    NormalizedStepSize,
    BinaryVsSmooth,
    RotationVisualization,
};

interface LessonGuideContentProps {
    source: string;
}

export function LessonGuideContent({ source }: LessonGuideContentProps) {
    return (
        <MDXRemote
            source={source}
            components={components}
            options={{
                blockJS: false,
                blockDangerousJS: true,
                mdxOptions: {
                    remarkPlugins: [remarkGfm, remarkMath],
                    rehypePlugins: [
                        rehypeKatex,
                        [
                            rehypePrettyCode,
                            {
                                theme: "github-dark",
                                keepBackground: true,
                            },
                        ],
                    ],
                },
            }}
        />
    );
}
