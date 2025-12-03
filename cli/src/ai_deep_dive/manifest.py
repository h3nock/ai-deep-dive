"""Course manifest definitions - what challenges exist for each course."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ChallengeArgument:
    """An argument for a challenge function."""
    name: str
    type: str


@dataclass
class TestCase:
    """A test case for a challenge."""
    id: str
    inputs: dict[str, str]  # argument name -> value (as string)
    expected: str
    hidden: bool = False


@dataclass
class Challenge:
    """A single coding challenge."""
    id: str  # e.g., "02-01" 
    slug: str  # e.g., "pair-counter"
    title: str
    filename: str  # e.g., "01_pair_counter.py"
    function_name: str  # The main function to implement
    chapter: str  # e.g., "02-tokenization"
    chapter_num: int
    challenge_num: int
    difficulty: str = "Medium"
    initial_code: str = ""
    execution_snippet: str = ""  # e.g., "get_stats(ids)"
    arguments: list[ChallengeArgument] = field(default_factory=list)
    test_cases: list[TestCase] = field(default_factory=list)
    description: str = ""


@dataclass
class Chapter:
    """A chapter containing multiple challenges."""
    num: int
    slug: str  # e.g., "02-tokenization"
    title: str
    challenges: list[Challenge] = field(default_factory=list)


@dataclass
class CourseManifest:
    """The complete manifest for a course."""
    id: str  # e.g., "build-chatgpt"
    title: str
    description: str
    chapters: list[Chapter] = field(default_factory=list)
    
    def get_challenge(self, challenge_id: str) -> Optional[Challenge]:
        """
        Get a challenge by its ID.
        
        ID format: "CC-NN" where CC is chapter number, NN is challenge number
        e.g., "02-01" for chapter 2, challenge 1
        """
        try:
            chapter_num, challenge_num = map(int, challenge_id.split("-"))
        except ValueError:
            return None
        
        for chapter in self.chapters:
            if chapter.num == chapter_num:
                for challenge in chapter.challenges:
                    if challenge.challenge_num == challenge_num:
                        return challenge
        
        return None
    
    def get_all_challenges(self) -> list[Challenge]:
        """Get all challenges in order."""
        challenges = []
        for chapter in self.chapters:
            challenges.extend(chapter.challenges)
        return challenges
    
    def get_chapter(self, chapter_num: int) -> Optional[Chapter]:
        """Get a chapter by its number."""
        for chapter in self.chapters:
            if chapter.num == chapter_num:
                return chapter
        return None


# Course manifests registry
COURSE_MANIFESTS: dict[str, CourseManifest] = {}


def register_course(manifest: CourseManifest) -> None:
    """Register a course manifest."""
    COURSE_MANIFESTS[manifest.id] = manifest


def get_course_manifest(course_id: str) -> Optional[CourseManifest]:
    """Get a course manifest by ID."""
    return COURSE_MANIFESTS.get(course_id)


def get_available_courses() -> list[CourseManifest]:
    """Get all available course manifests."""
    return list(COURSE_MANIFESTS.values())
