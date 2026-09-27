import * as fs from 'fs';
import * as path from 'path';
import LessonContent from './LessonContent';
import languageConfigs from '@/data/language-configs.json';

// Use dynamic config instead of hardcoded list
const LANGUAGES = languageConfigs.availableLanguages;

interface LegacyPath {
  path: {
    slug: string;
  };
  milestones?: Array<{ slug?: string }>;
}

interface Lesson {
  id: number;
  slug: string;
}

interface LearningPathsData {
  paths: Record<string, {
    id: string;
    milestones: Array<{
      id: string;
      lessons?: string[];
    }>;
  }>;
  pathOrder: string[];
}

interface AILesson {
  id: string;
  slug: string;
}

/**
 * Generate static params for all lesson pages at build time.
 * Creates combinations of pathId and lessonId from both legacy and AI-generated data.
 */
export async function generateStaticParams() {
  const params: { pathId: string; lessonId: string }[] = [];
  const dataDir = path.join(process.cwd(), 'public', 'data');

  for (const lang of LANGUAGES) {
    const curriculumPath = path.join(dataDir, lang, 'curriculum.json');
    const lessonsPath = path.join(dataDir, lang, 'lessons.json');
    const learningPathsPath = path.join(dataDir, lang, 'learning-paths.json');
    const aiLessonsPath = path.join(dataDir, lang, 'ai-lessons.json');

    // Get all path slugs from legacy curriculum
    const pathSlugs: string[] = [];
    if (fs.existsSync(curriculumPath)) {
      try {
        const curriculumData = JSON.parse(fs.readFileSync(curriculumPath, 'utf-8'));
        if (Array.isArray(curriculumData)) {
          for (const item of curriculumData as LegacyPath[]) {
            if (item.path?.slug) {
              pathSlugs.push(item.path.slug);
              for (const milestone of item.milestones || []) {
                if (milestone.slug) {
                  params.push({ pathId: item.path.slug, lessonId: milestone.slug });
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read curriculum for ${lang}:`, error);
      }
    }

    // Get all lesson slugs from legacy lessons
    const lessonSlugs: string[] = [];
    if (fs.existsSync(lessonsPath)) {
      try {
        const lessonsData = JSON.parse(fs.readFileSync(lessonsPath, 'utf-8')) as Lesson[];
        for (const lesson of lessonsData) {
          if (lesson.slug) {
            lessonSlugs.push(lesson.slug);
          }
        }
      } catch (error) {
        console.warn(`Failed to read lessons for ${lang}:`, error);
      }
    }

    // Read AI-generated learning-paths.json
    if (fs.existsSync(learningPathsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(learningPathsPath, 'utf-8')) as LearningPathsData;

        // AI format: { paths: { "path-id": { milestones: [...] } }, pathOrder: [...] }
        if (data.paths) {
          for (const [pathId, pathData] of Object.entries(data.paths)) {
            pathSlugs.push(pathId);

            // Extract lesson slugs and milestone IDs from milestones
            if (pathData.milestones) {
              for (const milestone of pathData.milestones) {
                // Add milestone ID as valid lessonId (for milestone pages)
                if (milestone.id) {
                  lessonSlugs.push(milestone.id);
                }
                // Add actual lesson slugs
                if (milestone.lessons) {
                  lessonSlugs.push(...milestone.lessons);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read learning-paths for ${lang}:`, error);
      }
    }

    // Read AI-generated lessons
    if (fs.existsSync(aiLessonsPath)) {
      try {
        const aiLessons = JSON.parse(fs.readFileSync(aiLessonsPath, 'utf-8')) as AILesson[];
        for (const lesson of aiLessons) {
          if (lesson.slug || lesson.id) {
            lessonSlugs.push(lesson.slug || lesson.id);
          }
        }
      } catch (error) {
        console.warn(`Failed to read ai-lessons for ${lang}:`, error);
      }
    }

    // Generate combinations - each lesson can be accessed from any path
    // This is a broad approach; in practice, users navigate from specific paths
    for (const pathSlug of pathSlugs) {
      for (const lessonSlug of lessonSlugs) {
        params.push({
          pathId: pathSlug,
          lessonId: lessonSlug,
        });
      }
    }
  }

  // Deduplicate
  const uniqueParams = Array.from(
    new Map(params.map((p) => [`${p.pathId}-${p.lessonId}`, p])).values()
  );

  return uniqueParams;
}

export default function LessonPage() {
  return <LessonContent />;
}
