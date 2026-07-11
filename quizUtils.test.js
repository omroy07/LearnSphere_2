import { describe, it, expect } from "vitest";
import quizUtils from "./quizUtils.js";

describe("quizUtils - Unit Tests", () => {
  describe("calculateCorrectAnswers", () => {
    it("should prioritize correctCount when it is a valid finite number", () => {
      expect(quizUtils.calculateCorrectAnswers(0.8, 10, 8)).toBe(8);
      expect(quizUtils.calculateCorrectAnswers(50, 10, 0)).toBe(0);
      expect(quizUtils.calculateCorrectAnswers(1.2, 5, 2)).toBe(2);
    });

    it("should infer correct answers from score as a ratio (0..1) when correctCount is missing", () => {
      expect(quizUtils.calculateCorrectAnswers(0.6, 10, null)).toBe(6);
      expect(quizUtils.calculateCorrectAnswers(0.75, 4, undefined)).toBe(3);
      expect(quizUtils.calculateCorrectAnswers(0, 5, null)).toBe(0);
      expect(quizUtils.calculateCorrectAnswers(1.0, 8, null)).toBe(8);
    });

    it("should infer correct answers from score as a percentage (1..100) when correctCount is missing", () => {
      expect(quizUtils.calculateCorrectAnswers(80, 10, null)).toBe(8);
      expect(quizUtils.calculateCorrectAnswers(25, 4, null)).toBe(1);
      expect(quizUtils.calculateCorrectAnswers(100, 7, null)).toBe(7);
    });

    it("should return null if totalQuestions is 0 or invalid", () => {
      expect(quizUtils.calculateCorrectAnswers(0.8, 0, null)).toBeNull();
      expect(quizUtils.calculateCorrectAnswers(0.8, -5, null)).toBeNull();
      expect(quizUtils.calculateCorrectAnswers(0.8, "invalid", null)).toBeNull();
    });

    it("should return null if score is out of expected ratio/percentage ranges and correctCount is missing", () => {
      expect(quizUtils.calculateCorrectAnswers(-0.5, 10, null)).toBeNull();
      expect(quizUtils.calculateCorrectAnswers(150, 10, null)).toBeNull();
    });
  });

  describe("calculateWeeklyAggregates", () => {
    it("should correctly split 14-day history and calculate averages", () => {
      const history = [
        0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.5, // first 7 days (prev7) -> avg: ~0.714
        0.8, 0.8, 0.9, 0.9, 1.0, 1.0, 0.6, // last 7 days (last7) -> avg: ~0.857
      ];
      const result = quizUtils.calculateWeeklyAggregates(history);
      expect(result.prev7).toEqual([0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.5]);
      expect(result.last7).toEqual([0.8, 0.8, 0.9, 0.9, 1.0, 1.0, 0.6]);
      expect(result.prevAvg).toBeCloseTo(0.714, 3);
      expect(result.lastAvg).toBeCloseTo(0.857, 3);
    });

    it("should ignore null or non-finite values in averaging", () => {
      const history = [
        0.5, null, 0.7, "invalid", 0.9, 1.0, 0.5, // prev7
        0.8, 0.8, null, 0.9, undefined, 1.0, 0.6, // last7
      ];
      const result = quizUtils.calculateWeeklyAggregates(history);
      // prev7 valid: 0.5, 0.7, 0.9, 1.0, 0.5 (sum=3.6, len=5, avg=0.72)
      // last7 valid: 0.8, 0.8, 0.9, 1.0, 0.6 (sum=4.1, len=5, avg=0.82)
      expect(result.prevAvg).toBeCloseTo(0.72, 2);
      expect(result.lastAvg).toBeCloseTo(0.82, 2);
    });

    it("should return null averages when no valid numbers are present", () => {
      const result = quizUtils.calculateWeeklyAggregates([null, null, undefined]);
      expect(result.lastAvg).toBeNull();
      expect(result.prevAvg).toBeNull();
    });

    it("should return empty results for non-array input", () => {
      expect(quizUtils.calculateWeeklyAggregates(null)).toEqual({
        last7: [],
        prev7: [],
        lastAvg: null,
        prevAvg: null,
      });
    });
  });

  describe("calculateSkillMasteryTrend", () => {
    it("should compute last3 accuracy, prev accuracy, and delta", () => {
      const list = [
        { ts: 1, correct: true },
        { ts: 2, correct: false },
        { ts: 3, correct: true },
        { ts: 4, correct: true }, // last3 starts here (ts 2..4?) depends on slice(-6,-3)
        { ts: 5, correct: true },
        { ts: 6, correct: false },
      ];

      const res = quizUtils.calculateSkillMasteryTrend(list);
      // sorted same order.
      // last3 = ts 4,5,6 => correct: true,true,false => 2/3
      expect(res.last3N).toBe(3);
      expect(res.last3Acc).toBeCloseTo(2 / 3, 6);

      // prev = ts 1,2,3 => true,false,true => 2/3
      expect(res.prevAcc).toBeCloseTo(2 / 3, 6);
      expect(res.delta).toBeCloseTo(0, 6);
    });

    it("should return nulls when attempts list is empty", () => {
      const res = quizUtils.calculateSkillMasteryTrend([]);
      expect(res.last3Acc).toBeNull();
      expect(res.prevAcc).toBeNull();
      expect(res.delta).toBeNull();
      expect(res.last3N).toBe(0);
    });
  });

  describe("estimateReadinessPct", () => {
    it("should produce a percent between 0 and 100", () => {
      const pct = quizUtils.estimateReadinessPct({ accuracyRatio: 0.6, trendDelta: 0.2, attemptsN: 5 });
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });
  });

  describe("aggregateQuizHistory", () => {

    it("should return empty structure when attempts array is empty", () => {
      const result = quizUtils.aggregateQuizHistory([]);
      expect(result.totalAttempts).toBe(0);
      expect(result.firstAttemptAt).toBeNull();
      expect(result.lastAttemptAt).toBeNull();
      expect(result.byTopic).toEqual([]);
      expect(result.attempts).toEqual([]);
    });

    it("should aggregate attempts by topic and order them by count descending", () => {
      const attempts = [
        { topicId: "physics-motion", totalQuestions: 10, correctCount: 8, finishedAt: 1000 },
        { topicId: "maths-calculus", totalQuestions: 5, correctCount: 4, finishedAt: 2000 },
        { topicId: "physics-motion", totalQuestions: 10, correctCount: 9, finishedAt: 3000 },
      ];

      const result = quizUtils.aggregateQuizHistory(attempts);
      expect(result.totalAttempts).toBe(3);
      expect(result.firstAttemptAt).toBe(new Date(1000).toISOString());
      expect(result.lastAttemptAt).toBe(new Date(3000).toISOString());

      expect(result.byTopic).toHaveLength(2);
      // physics-motion should be first because it has 2 attempts
      expect(result.byTopic[0]).toEqual({
        topicId: "physics-motion",
        quizAttemptCount: 2,
        questionsAttempted: 20,
        correctCount: 17,
        accuracy: 0.85,
      });
      // maths-calculus should be second with 1 attempt
      expect(result.byTopic[1]).toEqual({
        topicId: "maths-calculus",
        quizAttemptCount: 1,
        questionsAttempted: 5,
        correctCount: 4,
        accuracy: 0.8,
      });
    });

    it("should stably sort topics alphabetically by topicId when attempt count is equal", () => {
      const attempts = [
        { topicId: "physics-motion", totalQuestions: 5, correctCount: 4, finishedAt: 2000 },
        { topicId: "chemistry-atomic", totalQuestions: 5, correctCount: 3, finishedAt: 1000 },
      ];
      const result = quizUtils.aggregateQuizHistory(attempts);
      expect(result.byTopic).toHaveLength(2);
      // both have 1 attempt, but "chemistry-atomic" comes first alphabetically
      expect(result.byTopic[0].topicId).toBe("chemistry-atomic");
      expect(result.byTopic[1].topicId).toBe("physics-motion");
    });

    it("should limit attempts preview to the last 25 attempts", () => {
      const attempts = Array.from({ length: 30 }, (_, i) => ({
        topicId: "topic",
        totalQuestions: 10,
        correctCount: 8,
        finishedAt: 1000 + i,
      }));

      const result = quizUtils.aggregateQuizHistory(attempts);
      expect(result.totalAttempts).toBe(30);
      expect(result.attempts).toHaveLength(25);
      // The preview attempts should correspond to the last ones (timestamps 1005 to 1029)
      expect(result.attempts[0].finishedAt).toBe(new Date(1005).toISOString());
      expect(result.attempts[24].finishedAt).toBe(new Date(1029).toISOString());
    });
  });

  describe("resolveSyncConflicts", () => {
    it("should return empty array if no events are provided", () => {
      expect(quizUtils.resolveSyncConflicts([])).toEqual([]);
    });

    it("should resolve conflicts by retaining the latest event for a given type, topic, and quiz", () => {
      const events = [
        {
          type: "quiz_attempt",
          timestamp: 1000,
          payload: { topicId: "physics-motion", quizId: "quiz:motion", score: 5 },
        },
        {
          type: "quiz_attempt",
          timestamp: 3000,
          payload: { topicId: "physics-motion", quizId: "quiz:motion", score: 9 }, // latest conflict
        },
        {
          type: "quiz_attempt",
          timestamp: 2000,
          payload: { topicId: "physics-motion", quizId: "quiz:motion", score: 7 },
        },
        {
          type: "quiz_attempt",
          timestamp: 1500,
          payload: { topicId: "maths-calculus", quizId: "quiz:calculus", score: 4 }, // non-conflicting
        },
      ];

      const resolved = quizUtils.resolveSyncConflicts(events, "latest");
      expect(resolved).toHaveLength(2);

      const motionEvent = resolved.find((e) => e.payload.topicId === "physics-motion");
      const calculusEvent = resolved.find((e) => e.payload.topicId === "maths-calculus");

      expect(motionEvent.timestamp).toBe(3000);
      expect(motionEvent.payload.score).toBe(9);
      expect(calculusEvent.timestamp).toBe(1500);
    });

    it("should not modify events if an unsupported/default strategy is passed", () => {
      const events = [
        { type: "test", timestamp: 10, payload: { topicId: "t" } },
        { type: "test", timestamp: 20, payload: { topicId: "t" } },
      ];
      expect(quizUtils.resolveSyncConflicts(events, "unknown-strategy")).toEqual(events);
    });
  });
});
