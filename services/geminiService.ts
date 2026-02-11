import { GoogleGenAI, Type } from "@google/genai";
import { Course, Module, Lesson, Quiz } from "../types";

// Initialize Gemini Client
// IMPORTANT: process.env.API_KEY is injected by the runtime environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

/**
 * Generates a structured course syllabus based on a user's topic.
 */
export const generateCourse = async (topic: string): Promise<Course> => {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Create a comprehensive, structured learning path for the following topic: "${topic}". 
    The course should be broken down into logical modules, and each module should have specific lessons.
    Aim for 3-5 modules and 3-5 lessons per module.
    Make the titles and descriptions engaging and educational.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The main title of the course" },
          description: { type: Type.STRING, description: "A brief motivating overview of the course" },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                lessons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ["title", "description"],
                  },
                },
              },
              required: ["title", "description", "lessons"],
            },
          },
        },
        required: ["title", "description", "modules"],
      },
    },
  });

  const data = JSON.parse(response.text || "{}");

  // Post-process to add IDs and initial state
  const course: Course = {
    id: crypto.randomUUID(),
    title: data.title,
    description: data.description,
    createdAt: Date.now(),
    modules: data.modules.map((m: any, mIdx: number) => ({
      id: `m-${mIdx}`,
      title: m.title,
      description: m.description,
      lessons: m.lessons.map((l: any, lIdx: number) => ({
        id: `l-${mIdx}-${lIdx}`,
        title: l.title,
        description: l.description,
        isCompleted: false,
        isLocked: mIdx === 0 && lIdx === 0 ? false : true, // Unlock first lesson only
      })),
    })),
  };

  return course;
};

/**
 * Generates detailed educational content for a specific lesson.
 */
export const generateLessonContent = async (
  courseTitle: string,
  moduleTitle: string,
  lessonTitle: string
): Promise<string> => {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `You are an expert tutor. Write a comprehensive educational lesson for the following context:
    Course: ${courseTitle}
    Module: ${moduleTitle}
    Lesson: ${lessonTitle}

    Structure the response in Markdown format.
    Include:
    1. Introduction
    2. Key Concepts (use bullet points)
    3. Detailed Explanation (use subheadings)
    4. Practical Examples or Code Snippets (if applicable)
    5. Summary
    
    Keep the tone encouraging, clear, and easy to understand.`,
  });

  return response.text || "Failed to generate content.";
};

/**
 * Generates a quiz for a completed module or lesson.
 */
export const generateQuiz = async (
  courseTitle: string,
  context: string
): Promise<Quiz> => {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Create a multiple-choice quiz based on this context: ${courseTitle} - ${context}.
    Generate 3 to 5 questions to test understanding.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
                correctAnswerIndex: { type: Type.INTEGER, description: "Zero-based index of the correct option" },
                explanation: { type: Type.STRING, description: "Explanation of why the answer is correct" }
              },
              required: ["question", "options", "correctAnswerIndex", "explanation"],
            },
          },
        },
        required: ["title", "questions"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as Quiz;
};
